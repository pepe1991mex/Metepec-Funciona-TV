import { useState, useEffect, useRef, Fragment } from 'react'
import { supabase } from '../lib/supabase'
import { useChannels } from '../hooks/useChannels'
import { useBanners } from '../hooks/useBanners'
import { usePreroll } from '../hooks/usePreroll'
import Player from './Player'
import BannerCarousel from './BannerCarousel'
import { useStreamToken } from '../hooks/useStreamToken'

// Detecta canales del VPS (cache.sharkbroadcast.com / b-cdn / IPs Shark) que requieren token.
// Devuelve { name, uri } para tokenizar, o null para canales abiertos (mdstrm, akamai, streamlock),
// que se siguen reproduciendo directo sin token.
function getStreamName(url) {
  if (!url) return null;
  var match = url.match(/\/hls\/([a-zA-Z0-9\-_]+)(\.m3u8|\/)/);
  if (!match) return null;
  if (url.indexOf('cache.sharkbroadcast.com') !== -1 ||
      url.indexOf('b-cdn.net') !== -1 ||
      url.indexOf('51.161.11.132') !== -1 ||
      url.indexOf('51.222.159.36') !== -1 ||
      url.indexOf('195.35.14.230') !== -1 ||
      url.indexOf('sharkbroadcast.com') !== -1) {
    try { return { name: match[1], uri: new URL(url).pathname }; }
    catch (e) { return null; }
  }
  return null;
}

const SYNC_INTERVAL = 60
const ACCENTS = ['#2D4F9F','#5BC0C4','#F08A2E','#9B6BAE','#ACCA14','#EF9FC5','#92D3F3','#F5D623']

// Orden de secciones por categoría (estilo BAIT). Municipal SIEMPRE primero;
// las categorías no listadas van al final, en orden alfabético.
const CATEGORY_ORDER = ['Municipal', 'Entretenimiento', 'Noticias', 'Películas', 'Musical', 'Niños', 'Religión', 'General']

const TICKER_ITEMS = [
  '🏛️ Metepec Ciudad que Funciona — Más seguridad, más iluminación, más servicios',
  '📢 Gobierno Municipal 2025-2027 — Estamos en la Ruta',
  '🎭 Festival Quimera — Arte y cultura en Metepec, Pueblo Mágico',
  '💡 Programa de iluminación LED en colonias del municipio',
  '🛡️ Seguridad ciudadana: Nuevas patrullas y cámaras',
  '❤️ Jornadas de salud gratuitas en tu delegación',
]

const PILLARS = [
  { icon: '🛡️', label: 'Seguridad', color: '#2D4F9F' },
  { icon: '💡', label: 'Iluminación', color: '#F5D623' },
  { icon: '❤️', label: 'Salud', color: '#EF9FC5' },
  { icon: '🤝', label: 'Apoyos', color: '#ACCA14' },
  { icon: '🎭', label: 'Cultura', color: '#9B6BAE' },
  { icon: '⚙️', label: 'Servicios', color: '#5BC0C4' },
]

// Iniciales para canales sin logo (p. ej. "Azteca 1" -> "A1", "Multimedios" -> "MU")
function getInitials(name) {
  if (!name) return '?'
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

// Agrupa canales por categoría respetando CATEGORY_ORDER (Municipal primero).
function groupByCategory(channels) {
  const groups = {}
  for (const ch of channels) {
    const cat = ch.categoria || 'General'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(ch)
  }
  const rank = (c) => {
    const i = CATEGORY_ORDER.indexOf(c)
    return i === -1 ? 999 : i
  }
  return Object.keys(groups)
    .sort((a, b) => {
      const ra = rank(a), rb = rank(b)
      if (ra !== rb) return ra - rb
      return a.localeCompare(b)
    })
    .map(cat => ({ categoria: cat, items: groups[cat] }))
}

export default function HomeView({ usuario, onLogout }) {
  const { channels, loading, reload: reloadChannels } = useChannels()
  const { hero, intermedio, player: playerBanners, reload: reloadBanners } = useBanners()
  const { getRandomVideo } = usePreroll()
  const [selected, setSelected] = useState(null)
  const [blocked, setBlocked] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [query, setQuery] = useState('')
  const secondsRef = useRef(0)
  const timerRef = useRef(null)
  const sessionRef = useRef(null)
  const touchStartY = useRef(null)

  // ─── Tokenización de streams VPS (canales BAIT/TU TV vía cache.sharkbroadcast.com) ───
  // getStreamName devuelve null para canales abiertos (mdstrm, akamai, streamlock): esos
  // usan selected.url_hls directo. El hook usa useState/useEffect, por eso SIEMPRE se llama
  // en cada render (incluso con selected=null); internamente no hace fetch si falta algún dato.
  const streamInfo = selected ? getStreamName(selected.url_hls) : null
  const tokenResult = useStreamToken(
    streamInfo ? streamInfo.name : null,
    usuario && usuario.id ? usuario.id : null,
    usuario && usuario.session_token ? usuario.session_token : null,
    streamInfo ? streamInfo.uri : null
  )
  const playerUrl = !selected
    ? ''
    : (!streamInfo
       ? selected.url_hls                  // canal abierto (mdstrm/akamai/streamlock): directo
       : (tokenResult.streamUrl || ''))    // canal VPS: SOLO la tokenizada, nunca la cruda (el cache responde 403)

  async function closeActiveSession() {
    if (!sessionRef.current) return
    await supabase.from('sesiones').update({ fin: new Date().toISOString() }).eq('id', sessionRef.current)
    sessionRef.current = null
  }

  async function openSession(ch) {
    await supabase.from('sesiones')
      .update({ fin: new Date().toISOString() })
      .eq('usuario_id', usuario.id)
      .is('fin', null)
    sessionRef.current = null
    const { data } = await supabase.from('sesiones').insert({
      usuario_id: usuario.id,
      canal: ch.nombre,
      inicio: new Date().toISOString(),
      fin: null,
      minutos: 0
    }).select('id').single()
    if (data) sessionRef.current = data.id
  }

  async function handleLogout() {
    await closeActiveSession()
    onLogout()
  }

  // Cambiar de canal: actualiza selected (mismo player sticky, sin remontar),
  // cierra la sesión anterior y abre la nueva. No hace nada si ya estás viendo ese canal.
  function selectChannel(ch) {
    if (selected && selected.id === ch.id) return
    setSelected(ch)
    setTimeout(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, 100)
    openSession(ch)
    // Métrica: registrar vista del canal (fire-and-forget, no bloquea)
    supabase.rpc('registrar_vista_canal', { p_canal_slug: ch.slug }).then(() => {}).catch(() => {})
  }

  function handleBack() {
    closeActiveSession()
    setSelected(null)
    setQuery('')
  }

  useEffect(() => {
    return () => { closeActiveSession() }
  }, [])

  function handleTouchStart(e) {
    if (window.scrollY === 0) touchStartY.current = e.touches[0].clientY
  }

  function handleTouchMove(e) {
    if (touchStartY.current === null) return
    if (window.scrollY !== 0) { touchStartY.current = null; return }
    const dist = e.touches[0].clientY - touchStartY.current
    if (dist > 0) setPullDistance(Math.min(dist, 120))
  }

  async function handleTouchEnd() {
    if (pullDistance > 70) {
      setRefreshing(true)
      await Promise.all([reloadChannels(), reloadBanners()])
      setRefreshing(false)
    }
    setPullDistance(0)
    touchStartY.current = null
  }

  useEffect(() => {
    if (!selected || blocked) return
    secondsRef.current = 0
    timerRef.current = setInterval(async () => {
      secondsRef.current += 1
      if (secondsRef.current >= SYNC_INTERVAL) {
        try {
          if (usuario.tipo_tiempo !== 'ilimitado') {
            await supabase.rpc('incrementar_segundos', {
              p_usuario_id: usuario.id,
              p_segundos: secondsRef.current
            })
            await supabase.from('sesiones').insert({
              usuario_id: usuario.id,
              minutos: 1,
              canal: selected.nombre
            })
            const { data } = await supabase
              .from('usuarios')
              .select('minutos_consumidos, minutos_limite')
              .eq('id', usuario.id)
              .single()
            if (data && data.minutos_consumidos >= data.minutos_limite) {
              await closeActiveSession()
              setBlocked(true)
              setSelected(null)
            }
          }
        } catch (err) {
          console.error('Sync error:', err)
        }
        secondsRef.current = 0
      }
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [selected, blocked, usuario.id])

  if (blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow p-8 text-center max-w-sm">
          <div className="text-5xl mb-4">⏱️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Límite alcanzado</h2>
          <p className="text-gray-500 text-sm mb-4">
            {usuario.tipo_tiempo === 'mensual'
              ? 'Has consumido tu tiempo mensual. Se reinicia el próximo mes.'
              : 'Has consumido tu tiempo disponible.'}
          </p>
          <button onClick={handleLogout} className="px-6 py-2 rounded-lg text-white text-sm"
            style={{ background: '#2D4F9F' }}>Cerrar sesión</button>
        </div>
      </div>
    )
  }

  const categories = groupByCategory(channels)

  // Filtro de búsqueda (solo se usa en la vista de canal abierto)
  const q = query.trim().toLowerCase()
  const visibleCategories = q
    ? categories
        .map(g => ({ ...g, items: g.items.filter(c => (c.nombre || '').toLowerCase().includes(q)) }))
        .filter(g => g.items.length > 0)
    : categories

  // Renderiza el catálogo completo (filas por categoría + banner intermedio tras la primera).
  // Resalta el canal en reproducción (selectedId) con borde de color y badge "VIENDO AHORA".
  const renderCatalog = (cats) => cats.map((group, idx) => (
    <Fragment key={group.categoria}>
      <CategoryRow
        categoria={group.categoria}
        items={group.items}
        selectedId={selected ? selected.id : null}
        onSelect={selectChannel}
      />
      {idx === 0 && intermedio.length > 0 && cats.length > 1 && (
        <div className="my-6">
          <BannerCarousel banners={intermedio} className="shadow-soft" />
        </div>
      )}
    </Fragment>
  ))

  return (
    <div className="min-h-screen" style={{ background: '#F7F9FC' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 30 || refreshing) && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '56px', gap: '8px', color: 'white', fontSize: '14px',
          background: 'rgba(45,79,159,0.92)',
          opacity: refreshing ? 1 : Math.min(pullDistance / 70, 1),
          transform: `translateY(${refreshing ? 0 : Math.min(pullDistance - 30, 26)}px)`,
          transition: refreshing ? 'none' : 'opacity 0.1s',
        }}>
          <span className={refreshing ? 'animate-spin-refresh' : ''} style={{ fontSize: '22px', display: 'inline-block' }}>⟳</span>
          <span>{refreshing ? 'Actualizando...' : pullDistance > 70 ? 'Suelta para actualizar' : 'Desliza para actualizar'}</span>
        </div>
      )}

      {/* Header — sticky en el home; estático al ver un canal (para que el player sea el sticky superior) */}
      <header className={`bg-white border-b border-gray-100 shadow-sm ${selected ? 'relative z-40' : 'sticky top-0 z-50'}`}
        style={{ top: 0, paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #F5D623, #EF9FC5, #2D4F9F, #5BC0C4, #F08A2E, #9B6BAE, #ACCA14, #92D3F3)' }} />
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logos/metepec-ruta.png" alt="Metepec" className="h-9 sm:h-11 object-contain" />
            <div className="hidden sm:block">
              <div className="text-base font-black tracking-tight leading-tight">
                <span style={{ color: '#E9AF25' }}>Metepec</span>{' '}
                <span className="text-gray-400 font-semibold">Funciona TV</span>
              </div>
              <div className="text-2xs text-gray-300 uppercase tracking-widest">
                Ciudad que Funciona • 2025-2027
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <img src="/logos/escudo.png" alt="Escudo" className="h-9 sm:h-11 object-contain" />
            <button onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-gray-600 transition ml-2">
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Ticker */}
      <div className="bg-white overflow-hidden border-b-2" style={{ borderColor: '#2D4F9F' }}>
        <div className="flex animate-ticker whitespace-nowrap py-2">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
            <span key={i} className="text-xs font-medium mr-20" style={{ color: '#2D4F9F' }}>{t}</span>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">

        {/* ═══ BANNER HERO — Publicidad principal arriba ═══ */}
        {!selected && hero.length > 0 && (
          <div className="mb-5">
            <BannerCarousel banners={hero} className="shadow-soft" />
          </div>
        )}

        {/* Hero info section */}
        {!selected && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-soft p-5 sm:p-8 mb-7 relative overflow-hidden animate-fade-in">
            <div className="absolute top-[-30px] right-[-30px] w-28 h-28 rounded-full" style={{ background: '#F5D62315' }} />
            <div className="absolute bottom-[-40px] right-16 w-24 h-24 rounded-full" style={{ background: '#EF9FC512' }} />
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="flex-1">
                <img src="/logos/metepec-ruta.png" alt="Estamos en la Ruta" className="h-12 sm:h-14 object-contain mb-4" />
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight mb-2" style={{ color: '#2D4F9F' }}>
                  Metepec <span style={{ color: '#F08A2E' }}>Funciona</span> TV
                </h1>
                <p className="text-sm text-gray-400 max-w-md leading-relaxed">
                  Tu plataforma de televisión digital del municipio. Noticias, cultura, deportes y servicios municipales.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {PILLARS.map((p, i) => (
                    <div key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{ background: p.color + '10', color: p.color, border: `1px solid ${p.color}25` }}>
                      {p.icon} {p.label}
                    </div>
                  ))}
                </div>
              </div>
              <div className="hidden sm:block flex-shrink-0">
                <img src="/logos/metepec-funciona.jpg" alt="Ciudad que Funciona" className="h-24 object-contain rounded-2xl" />
              </div>
            </div>
          </div>
        )}

        {/* ═══ VISTA CANAL ABIERTO — Player sticky + catálogo navegable (estilo Pluto/Samsung TV+) ═══ */}
        {selected && (
          <div>
            {/* Reproductor STICKY: sigue visible y reproduciendo mientras navegas el catálogo.
                No se remonta al hacer scroll ni al cambiar de canal (misma instancia de Player). */}
            <div className="sticky z-30 -mx-4 px-4 pb-3"
              style={{ top: 0, paddingTop: 'env(safe-area-inset-top)', background: '#F7F9FC' }}>
              <div className="mx-auto lg:max-w-3xl">
                {/* Aviso de error al asegurar el canal VPS (token) */}
                {streamInfo && tokenResult.error && (
                  <div className="mb-2 flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-3 py-2">
                    <span>No se pudo asegurar el canal: {tokenResult.error}</span>
                    <button onClick={() => tokenResult.refresh()}
                      className="flex-shrink-0 bg-red-600 text-white px-3 py-1 rounded-md font-semibold hover:bg-red-700 transition">
                      Reintentar
                    </button>
                  </div>
                )}

                {/* El Player solo se monta con URL lista (tokenizada si el canal es VPS).
                    Mientras el token está en vuelo se muestra un placeholder 16/9: así
                    nunca se dispara una petición al cache sin token (403). */}
                {playerUrl ? (
                  <Player channel={selected} url={playerUrl} onBack={handleBack} getRandomVideo={getRandomVideo} />
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-2xl overflow-hidden shadow-lg"
                    style={{ aspectRatio: '16/9', background: '#101B38' }}>
                    {tokenResult.error ? (
                      <p className="text-white/60 text-xs font-medium">Transmisión no disponible</p>
                    ) : (
                      <>
                        <div className="w-12 h-12 border-[3px] border-white/20 rounded-full animate-spin" style={{ borderTopColor: '#2D4F9F' }}></div>
                        <p className="text-white/80 text-xs mt-3 font-medium">Asegurando transmisión…</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Header del canal en reproducción + botón Cerrar */}
            <div className="mt-4 flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 border overflow-hidden"
                style={{ background: '#F4F8FD', borderColor: '#E4E9F0' }}>
                {selected.logo_url
                  ? <img src={selected.logo_url} alt={selected.nombre} className="max-w-[80%] max-h-[80%] object-contain" />
                  : <span className="font-black text-lg" style={{ color: '#2D4F9F' }}>{getInitials(selected.nombre)}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-black tracking-tight text-lg truncate" style={{ color: '#2A3240' }}>{selected.nombre}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center gap-1 bg-red-600 text-white text-2xs font-bold px-1.5 py-0.5 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-live" /> EN VIVO
                  </span>
                  {selected.categoria && (
                    <span className="text-2xs uppercase tracking-wider font-semibold" style={{ color: '#8D96A5' }}>{selected.categoria}</span>
                  )}
                </div>
              </div>
              <button onClick={handleBack}
                className="flex-shrink-0 flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl border transition hover:bg-gray-50 active:scale-95"
                style={{ borderColor: '#E4E9F0', color: '#5A6577' }}>
                ✕ Cerrar
              </button>
            </div>

            {/* ═══ BANNER PLAYER — Debajo del header del canal ═══ */}
            {playerBanners.length > 0 && (
              <div className="mt-4">
                <BannerCarousel banners={playerBanners} className="shadow-soft" />
              </div>
            )}

            {/* Catálogo completo navegable + búsqueda rápida */}
            <div className="mt-7 animate-fade-in">
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{ color: '#B6BECB' }}>🔍</span>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar canal…"
                    className="w-full rounded-2xl border pl-9 pr-3 py-2.5 text-sm outline-none transition"
                    style={{ borderColor: '#E4E9F0', background: 'white', color: '#2A3240' }}
                  />
                </div>
                {query && (
                  <button onClick={() => setQuery('')}
                    className="flex-shrink-0 text-xs font-bold px-3 py-2.5 rounded-xl border transition hover:bg-gray-50 active:scale-95"
                    style={{ borderColor: '#E4E9F0', color: '#5A6577' }}>
                    Limpiar
                  </button>
                )}
              </div>

              {visibleCategories.length === 0 ? (
                <div className="text-center py-12 text-sm" style={{ color: '#8D96A5' }}>
                  Sin resultados para “{query}”.
                </div>
              ) : (
                renderCatalog(visibleCategories)
              )}
            </div>
          </div>
        )}

        {/* ═══ CATÁLOGO POR CATEGORÍAS (sin canal seleccionado) ═══ */}
        {!selected && (
          loading ? (
            <div className="text-center py-20 text-gray-400">
              <div className="text-4xl mb-3 animate-spin">⏳</div>
              Cargando canales...
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <div className="text-4xl mb-3">📺</div>
              <p className="text-sm">No hay canales activos</p>
            </div>
          ) : (
            <div className="animate-fade-in">
              {renderCatalog(categories)}
            </div>
          )
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 mt-10 py-5 text-center">
        <div className="h-[3px] max-w-xs mx-auto rounded-full mb-4"
          style={{ background: 'linear-gradient(90deg, #F5D623, #EF9FC5, #2D4F9F, #5BC0C4, #F08A2E, #9B6BAE, #ACCA14, #92D3F3)' }} />
        <div className="flex items-center justify-center gap-4 mb-3">
          <img src="/logos/escudo.png" alt="Escudo" className="h-8 object-contain" />
          <img src="/logos/metepec-ruta.png" alt="Metepec" className="h-6 object-contain" />
        </div>
        <div className="text-[10px] text-gray-300 leading-6">
          Gobierno Municipal de Metepec 2025-2027 • Estamos en la Ruta<br />
          Solidaridad • Unidad • Participación<br />
          <span style={{ color: '#2A3240', fontSize: '12px', fontWeight: '700', letterSpacing: '0.5px' }}>Powered by Shark Broadcast</span>
        </div>
      </footer>
    </div>
  )
}

// ─── Sección de categoría: título + fila horizontal de tarjetas póster (estilo BAIT/Netflix) ───
function CategoryRow({ categoria, items, selectedId, onSelect }) {
  return (
    <section className="mb-7">
      <div className="flex items-end justify-between mb-3 px-0.5">
        <h2 className="font-black tracking-tight text-base sm:text-lg" style={{ color: '#2A3240' }}>{categoria}</h2>
        {items.length > 3 && (
          <span className="text-2xs uppercase tracking-wider flex-shrink-0 ml-3" style={{ color: '#B6BECB' }}>
            👆 Desliza para ver más
          </span>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
        {items.map((ch, i) => (
          <PosterCard key={ch.id} ch={ch} accent={ACCENTS[i % ACCENTS.length]} active={selectedId === ch.id} onSelect={onSelect} />
        ))}
      </div>
    </section>
  )
}

// ─── Tarjeta de canal estilo póster vertical (4/5) ───
function PosterCard({ ch, accent, active, onSelect }) {
  return (
    <button onClick={() => onSelect(ch)}
      className="press-scale flex-shrink-0 text-left"
      style={{ width: 140 }}>
      <div className="relative rounded-2xl overflow-hidden border"
        style={{
          aspectRatio: '4 / 5',
          background: '#F4F8FD',
          borderColor: active ? accent : '#E4E9F0',
          borderWidth: active ? 2 : 1,
          boxShadow: active ? `0 6px 20px ${accent}44` : '0 2px 8px rgba(0,0,0,0.06)',
        }}>
        {/* Badge: "VIENDO AHORA" si es el canal activo, si no "LIVE" */}
        {active ? (
          <div className="absolute top-2 left-2 right-2 z-10 flex items-center gap-1 text-white text-2xs font-bold px-1.5 py-0.5 rounded" style={{ background: accent }}>
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-live" />
            VIENDO AHORA
          </div>
        ) : (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-red-600 text-white text-2xs font-bold px-1.5 py-0.5 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-live" />
            LIVE
          </div>
        )}

        {/* Logo o iniciales centradas */}
        <div className="absolute inset-0 flex items-center justify-center p-5">
          {ch.logo_url
            ? <img src={ch.logo_url} alt={ch.nombre} className="max-w-full max-h-full object-contain" />
            : <span className="font-black text-4xl" style={{ color: '#2D4F9F' }}>{getInitials(ch.nombre)}</span>}
        </div>

        {/* Botón play circular */}
        <div className="absolute bottom-2 right-2 z-10 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#2A3240" style={{ marginLeft: 1 }}>
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
      <div className="mt-1.5 font-bold text-xs line-clamp-1"
        style={{ color: active ? accent : '#2A3240' }}>{ch.nombre}</div>
    </button>
  )
}
