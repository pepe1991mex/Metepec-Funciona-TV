import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useChannels } from '../hooks/useChannels'
import { useBanners } from '../hooks/useBanners'
import Player from './Player'
import BannerCarousel from './BannerCarousel'

const SYNC_INTERVAL = 60
const ACCENTS = ['#2D4F9F','#5BC0C4','#F08A2E','#9B6BAE','#ACCA14','#EF9FC5','#92D3F3','#F5D623']

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

export default function HomeView({ usuario, onLogout }) {
  const { channels, loading } = useChannels()
  const { hero, intermedio, player: playerBanners } = useBanners()
  const [selected, setSelected] = useState(null)
  const [blocked, setBlocked] = useState(false)
  const secondsRef = useRef(0)
  const timerRef = useRef(null)
  const sessionRef = useRef(null)

  async function closeActiveSession() {
    if (!sessionRef.current) return
    await supabase.from('sesiones').update({ fin: new Date().toISOString() }).eq('id', sessionRef.current)
    sessionRef.current = null
  }

  async function openSession(ch) {
    await closeActiveSession()
    const { data } = await supabase.from('sesiones').insert({
      usuario_id: usuario.id,
      canal: ch.nombre,
      inicio: new Date().toISOString(),
      fin: null,
      minutos: 0
    }).select('id').single()
    if (data) sessionRef.current = data.id
  }

  function selectChannel(ch) {
    setSelected(ch)
    setTimeout(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, 100)
    openSession(ch)
  }

  function handleBack() {
    closeActiveSession()
    setSelected(null)
  }

  useEffect(() => {
    if (!selected || blocked) return
    secondsRef.current = 0
    timerRef.current = setInterval(async () => {
      secondsRef.current += 1
      if (secondsRef.current >= SYNC_INTERVAL) {
        try {
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
          <p className="text-gray-500 text-sm mb-4">Has consumido tu tiempo disponible.</p>
          <button onClick={onLogout} className="px-6 py-2 rounded-lg text-white text-sm"
            style={{ background: '#2D4F9F' }}>Cerrar sesión</button>
        </div>
      </div>
    )
  }

  // Split channels for interstitial banner placement
  const firstRow = channels.slice(0, 4)
  const restRows = channels.slice(4)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #F5D623, #EF9FC5, #2D4F9F, #5BC0C4, #F08A2E, #9B6BAE, #ACCA14, #92D3F3)' }} />
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logos/metepec-ruta.jpg" alt="Metepec" className="h-9 sm:h-11 object-contain" />
            <div className="hidden sm:block">
              <div className="text-base font-bold leading-tight">
                <span style={{ color: '#E9AF25' }}>Metepec</span>{' '}
                <span className="text-gray-400 font-normal">Funciona TV</span>
              </div>
              <div className="text-[9px] text-gray-300 uppercase tracking-widest">
                Ciudad que Funciona • 2025-2027
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <img src="/logos/escudo.png" alt="Escudo" className="h-9 sm:h-11 object-contain" />
            <button onClick={onLogout}
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
            <BannerCarousel banners={hero} className="shadow-sm" />
          </div>
        )}

        {/* Hero info section */}
        {!selected && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-8 mb-6 relative overflow-hidden">
            <div className="absolute top-[-30px] right-[-30px] w-28 h-28 rounded-full" style={{ background: '#F5D62315' }} />
            <div className="absolute bottom-[-40px] right-16 w-24 h-24 rounded-full" style={{ background: '#EF9FC512' }} />
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="flex-1">
                <img src="/logos/metepec-ruta.jpg" alt="Estamos en la Ruta" className="h-12 sm:h-14 object-contain mb-4" />
                <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-2" style={{ color: '#2D4F9F' }}>
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
                <img src="/logos/metepec-funciona.jpg" alt="Ciudad que Funciona" className="h-24 object-contain rounded-lg" />
              </div>
            </div>
          </div>
        )}

        {/* Player */}
        {selected && (
          <div className="mb-4">
            <Player channel={selected} onBack={handleBack} />

            {/* ═══ BANNER PLAYER — Debajo del reproductor ═══ */}
            {playerBanners.length > 0 && (
              <div className="mt-3">
                <BannerCarousel banners={playerBanners} className="shadow-sm" />
              </div>
            )}
          </div>
        )}

        {/* Channel Grid */}
        {loading ? (
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
          <>
            {/* First row of channels */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {firstRow.map((ch, i) => (
                <ChannelCard key={ch.id} ch={ch} i={i} selected={selected} onSelect={selectChannel} />
              ))}
            </div>

            {/* ═══ BANNER INTERMEDIO — Entre filas de canales ═══ */}
            {intermedio.length > 0 && restRows.length > 0 && (
              <div className="my-5">
                <BannerCarousel banners={intermedio} className="shadow-sm" />
              </div>
            )}

            {/* Remaining channels */}
            {restRows.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
                {restRows.map((ch, i) => (
                  <ChannelCard key={ch.id} ch={ch} i={i + 4} selected={selected} onSelect={selectChannel} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 mt-10 py-5 text-center">
        <div className="h-[3px] max-w-xs mx-auto rounded-full mb-4"
          style={{ background: 'linear-gradient(90deg, #F5D623, #EF9FC5, #2D4F9F, #5BC0C4, #F08A2E, #9B6BAE, #ACCA14, #92D3F3)' }} />
        <div className="flex items-center justify-center gap-4 mb-3">
          <img src="/logos/escudo.png" alt="Escudo" className="h-8 object-contain" />
          <img src="/logos/metepec-ruta.jpg" alt="Metepec" className="h-6 object-contain" />
        </div>
        <div className="text-[10px] text-gray-300 leading-6">
          Gobierno Municipal de Metepec 2025-2027 • Estamos en la Ruta<br />
          Solidaridad • Unidad • Participación<br />
          <span className="opacity-50">Powered by Shark Broadcast</span>
        </div>
      </footer>
    </div>
  )
}

// ─── Channel Card (extracted for cleaner code) ───
function ChannelCard({ ch, i, selected, onSelect }) {
  const accent = ACCENTS[i % ACCENTS.length]
  const isActive = selected?.id === ch.id
  return (
    <div onClick={() => onSelect(ch)}
      className="bg-white rounded-xl overflow-hidden border cursor-pointer transition-all hover:-translate-y-1"
      style={{
        borderColor: isActive ? accent : '#eee',
        borderWidth: isActive ? 2 : 1,
        boxShadow: isActive ? `0 6px 20px ${accent}30` : '0 1px 4px rgba(0,0,0,0.04)',
      }}>
      <div className="h-1" style={{ background: accent }} />
      <div className="p-4">
        {isActive && <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse-dot float-right mt-1" />}
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-3"
          style={{ background: accent + '14' }}>
          {ch.logo_url ? <img src={ch.logo_url} alt="" className="w-7 h-7 object-contain" /> : '📺'}
        </div>
        <div className="font-semibold text-sm text-gray-800 leading-tight">{ch.nombre}</div>
        {ch.categoria && <div className="text-[10px] text-gray-400 mt-1">{ch.categoria}</div>}
      </div>
    </div>
  )
}
