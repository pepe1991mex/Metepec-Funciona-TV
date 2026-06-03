import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ADMIN_PW = import.meta.env.VITE_ADMIN_PASSWORD || 'metepec2026'
const inp = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 mb-3 bg-white"
const btn = "px-4 py-2 rounded-lg text-white text-sm font-semibold transition hover:opacity-90"

const TIPO_LABELS = {
  fijo:      { label: 'Fijo',      color: '#2D4F9F', bg: '#eff6ff' },
  mensual:   { label: 'Mensual',   color: '#9B6BAE', bg: '#faf5ff' },
  ilimitado: { label: 'Ilimitado', color: '#16a34a', bg: '#dcfce7' },
}

export default function AdminPanel() {
  const [auth, setAuth] = useState(false)
  const [pw, setPw] = useState('')
  const [tab, setTab] = useState('metricas')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)

  const [usuarios, setUsuarios] = useState([])
  const [canales, setCanales] = useState([])
  const [banners, setBanners] = useState([])
  const [prerolls, setPrerolls] = useState([])
  const [sesiones, setSesiones] = useState([])
  const [topCanales, setTopCanales] = useState([])
  const [liveViewers, setLiveViewers] = useState([])

  // ── Métricas vía RPCs (nivel BAIT TV) ──
  const [metricas, setMetricas] = useState(null)
  const [canalesPopulares, setCanalesPopulares] = useState([])
  const [horarioPico, setHorarioPico] = useState([])
  const [bannerStats, setBannerStats] = useState([])
  const [prerollStats, setPrerollStats] = useState([])
  const [loadingMetrics, setLoadingMetrics] = useState(true)

  const [search, setSearch] = useState('')
  const [editingUser, setEditingUser] = useState(null)
  const [editingCanal, setEditingCanal] = useState(null)
  const [editingBanner, setEditingBanner] = useState(null)
  const [editingPreroll, setEditingPreroll] = useState(null)
  const [addingUser, setAddingUser] = useState(false)
  const [addingCanal, setAddingCanal] = useState(false)
  const [addingBanner, setAddingBanner] = useState(false)
  const [addingPreroll, setAddingPreroll] = useState(false)

  const [newUser, setNewUser] = useState({ nombre: '', phone: '', pin: '', minutos_limite: 1800, tipo_tiempo: 'fijo' })
  const [newCanal, setNewCanal] = useState({ nombre: '', slug: '', url_hls: '', logo_url: '', categoria: 'Municipal', orden: 0 })
  const [newBanner, setNewBanner] = useState({ titulo: '', imagen_url: '', enlace: '', posicion: 'hero', orden: 0 })
  const [newPreroll, setNewPreroll] = useState({ titulo: '', video_url: '', duracion: 15, orden: 0, tipo: 'video' })
  const [prerollCanalesMap, setPrerollCanalesMap] = useState({})
  const [canalesDisponibles, setCanalesDisponibles] = useState([])
  const [canalesSeleccionados, setCanalesSeleccionados] = useState([])

  useEffect(() => {
    if (!auth) return
    loadAll()
    const iv = setInterval(() => { loadDashboard(); loadMetricas() }, 30000)
    return () => clearInterval(iv)
  }, [auth])

  useEffect(() => {
    if (!auth) return
    if (tab === 'metricas') loadSesiones()
    if (tab === 'preroll') loadCanalesDisponibles()
  }, [auth, tab])

  async function loadAll() {
    await Promise.all([loadUsuarios(), loadCanales(), loadBanners(), loadPrerolls(), loadPrerollCanales(), loadDashboard(), loadMetricas()])
  }

  // Carga las métricas agregadas desde los RPCs de Supabase
  async function loadMetricas() {
    setLoadingMetrics(true)
    try {
      const [m, cp, hp, bs, ps] = await Promise.all([
        supabase.rpc('admin_get_metricas'),
        supabase.rpc('admin_get_canales_populares', { p_limit: 10 }),
        supabase.rpc('admin_get_horario_pico'),
        supabase.rpc('admin_get_banner_stats'),
        supabase.rpc('admin_get_preroll_stats'),
      ])
      if (m.data && m.data[0]) setMetricas(m.data[0])
      if (cp.data) setCanalesPopulares(cp.data)
      if (hp.data) setHorarioPico(hp.data)
      if (bs.data) setBannerStats(bs.data)
      if (ps.data) setPrerollStats(ps.data)
      setLastRefresh(new Date())
    } catch (e) {
      console.error('Error cargando métricas:', e)
    } finally {
      setLoadingMetrics(false)
    }
  }

  async function loadUsuarios() {
    const { data } = await supabase.from('usuarios')
      .select('id, telefono, nombre, pin, minutos_consumidos, minutos_limite, activo, ultimo_acceso, tipo_tiempo')
      .order('created_at', { ascending: false })
    if (data) setUsuarios(data)
  }

  async function loadCanales() {
    const { data } = await supabase.from('canales')
      .select('id, nombre, slug, url_hls, logo_url, categoria, orden, activo')
      .order('orden', { ascending: true })
    if (data) setCanales(data)
  }

  async function loadBanners() {
    const { data } = await supabase.from('banners')
      .select('id, titulo, imagen_url, enlace, posicion, orden, activo')
      .order('orden', { ascending: true })
    if (data) setBanners(data)
  }

  async function loadPrerolls() {
    const { data } = await supabase.from('preroll_videos')
      .select('id, titulo, video_url, duracion, activo, orden, tipo')
      .order('orden', { ascending: true })
    if (data) setPrerolls(data)
  }

  async function loadPrerollCanales() {
    const { data } = await supabase.from('preroll_canales')
      .select('preroll_id, canal_id, canales(nombre)')
      .eq('activo', true)
    if (data) {
      const grouped = {}
      data.forEach(pc => {
        if (!grouped[pc.preroll_id]) grouped[pc.preroll_id] = []
        grouped[pc.preroll_id].push({ canal_id: pc.canal_id, nombre: pc.canales?.nombre })
      })
      setPrerollCanalesMap(grouped)
    }
  }

  async function loadCanalesDisponibles() {
    const { data } = await supabase.from('canales')
      .select('id, nombre, slug, activo')
      .eq('activo', true)
      .order('orden', { ascending: true })
    if (data) setCanalesDisponibles(data)
  }

  async function loadDashboard() {
    const { data: all } = await supabase.from('sesiones').select('canal, minutos')
    if (all) {
      const grouped = {}
      all.forEach(s => { if (s.canal) grouped[s.canal] = (grouped[s.canal] || 0) + (s.minutos || 0) })
      setTopCanales(Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 10))
    }
    const { data: live } = await supabase.from('sesiones')
      .select('id, canal, inicio, usuario_id, usuarios(nombre, telefono)')
      .is('fin', null)
      .not('inicio', 'is', null)
      .order('inicio', { ascending: false })
    if (live) {
      const seen = new Set()
      const unique = live.filter(s => {
        if (seen.has(s.usuario_id)) return false
        seen.add(s.usuario_id)
        return true
      })
      setLiveViewers(unique)
    }
  }

  async function loadSesiones() {
    const { data } = await supabase.from('sesiones')
      .select('id, canal, inicio, fin, minutos, usuarios(nombre, telefono)')
      .not('inicio', 'is', null)
      .order('inicio', { ascending: false })
      .limit(50)
    if (data) setSesiones(data)
  }

  // ── Usuarios CRUD ──
  async function addUsuario() {
    if (newUser.phone.length !== 10) return
    const pin = newUser.pin || String(Math.floor(1000 + Math.random() * 9000))
    await supabase.from('usuarios').insert({
      telefono: '+52' + newUser.phone, nombre: newUser.nombre || null,
      pin, minutos_limite: newUser.minutos_limite, activo: true,
      tipo_tiempo: newUser.tipo_tiempo
    })
    setNewUser({ nombre: '', phone: '', pin: '', minutos_limite: 1800, tipo_tiempo: 'fijo' })
    setAddingUser(false); loadUsuarios()
  }

  async function saveEditUser() {
    await supabase.from('usuarios').update({
      nombre: editingUser.nombre, pin: editingUser.pin,
      minutos_limite: Number(editingUser.minutos_limite),
      tipo_tiempo: editingUser.tipo_tiempo
    }).eq('id', editingUser.id)
    setEditingUser(null); loadUsuarios()
  }

  async function toggleUsuario(id, activo) {
    await supabase.from('usuarios').update({ activo: !activo }).eq('id', id)
    loadUsuarios()
  }

  async function resetMinutos(id) {
    await supabase.from('usuarios').update({ minutos_consumidos: 0 }).eq('id', id)
    loadUsuarios()
  }

  // ── Canales CRUD ──
  async function addCanal() {
    if (!newCanal.nombre || !newCanal.url_hls || !newCanal.slug) return
    await supabase.from('canales').insert({ ...newCanal, activo: true })
    setNewCanal({ nombre: '', slug: '', url_hls: '', logo_url: '', categoria: 'Municipal', orden: 0 })
    setAddingCanal(false); loadCanales()
  }

  async function saveEditCanal() {
    await supabase.from('canales').update({
      nombre: editingCanal.nombre, slug: editingCanal.slug, url_hls: editingCanal.url_hls,
      logo_url: editingCanal.logo_url, categoria: editingCanal.categoria, orden: Number(editingCanal.orden)
    }).eq('id', editingCanal.id)
    setEditingCanal(null); loadCanales()
  }

  async function toggleCanal(id, activo) {
    await supabase.from('canales').update({ activo: !activo }).eq('id', id)
    loadCanales()
  }

  async function deleteCanal(id) {
    if (!window.confirm('¿Eliminar este canal?')) return
    await supabase.from('canales').delete().eq('id', id)
    loadCanales()
  }

  // ── Banners CRUD ──
  async function addBanner() {
    if (!newBanner.titulo || !newBanner.imagen_url) return
    await supabase.from('banners').insert({ ...newBanner, activo: true })
    setNewBanner({ titulo: '', imagen_url: '', enlace: '', posicion: 'hero', orden: 0 })
    setAddingBanner(false); loadBanners()
  }

  async function saveEditBanner() {
    await supabase.from('banners').update({
      titulo: editingBanner.titulo, imagen_url: editingBanner.imagen_url,
      enlace: editingBanner.enlace, posicion: editingBanner.posicion, orden: Number(editingBanner.orden)
    }).eq('id', editingBanner.id)
    setEditingBanner(null); loadBanners()
  }

  async function toggleBanner(id, activo) {
    await supabase.from('banners').update({ activo: !activo }).eq('id', id)
    loadBanners()
  }

  async function deleteBanner(id) {
    if (!window.confirm('¿Eliminar este banner?')) return
    await supabase.from('banners').delete().eq('id', id)
    loadBanners()
  }

  // ── Preroll CRUD ──
  async function addPreroll() {
    if (!newPreroll.titulo || !newPreroll.video_url) return
    const { data: inserted } = await supabase.from('preroll_videos')
      .insert({ ...newPreroll, activo: true })
      .select('id').single()
    if (inserted && canalesSeleccionados.length > 0) {
      await supabase.from('preroll_canales').insert(
        canalesSeleccionados.map(canal_id => ({ preroll_id: inserted.id, canal_id, activo: true }))
      )
    }
    setNewPreroll({ titulo: '', video_url: '', duracion: 15, orden: 0, tipo: 'video' })
    setCanalesSeleccionados([])
    setAddingPreroll(false)
    loadPrerolls(); loadPrerollCanales()
  }

  async function saveEditPreroll() {
    await supabase.from('preroll_videos').update({
      titulo: editingPreroll.titulo, video_url: editingPreroll.video_url,
      duracion: Number(editingPreroll.duracion), orden: Number(editingPreroll.orden),
      tipo: editingPreroll.tipo || 'video'
    }).eq('id', editingPreroll.id)
    await supabase.from('preroll_canales').delete().eq('preroll_id', editingPreroll.id)
    if (canalesSeleccionados.length > 0) {
      await supabase.from('preroll_canales').insert(
        canalesSeleccionados.map(canal_id => ({ preroll_id: editingPreroll.id, canal_id, activo: true }))
      )
    }
    setEditingPreroll(null)
    setCanalesSeleccionados([])
    loadPrerolls(); loadPrerollCanales()
  }

  async function togglePreroll(id, activo) {
    await supabase.from('preroll_videos').update({ activo: !activo }).eq('id', id)
    loadPrerolls()
  }

  async function deletePreroll(id) {
    if (!window.confirm('¿Eliminar este video preroll?')) return
    await supabase.from('preroll_videos').delete().eq('id', id)
    loadPrerolls(); loadPrerollCanales()
  }

  if (!auth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
          <img src="/logos/escudo.png" alt="Escudo" className="h-16 mx-auto mb-3 object-contain" />
          <h2 className="text-xl font-bold text-gray-800 mb-1">Panel Administrativo</h2>
          <p className="text-sm text-gray-400 mb-6">Metepec Funciona TV</p>
          <input type="password" placeholder="Contraseña" value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && pw === ADMIN_PW && setAuth(true)}
            className={inp + ' mb-4'} />
          <button onClick={() => pw === ADMIN_PW && setAuth(true)}
            className={btn + ' w-full py-3'} style={{ background: '#2D4F9F' }}>
            Ingresar
          </button>
        </div>
      </div>
    )
  }

  const TABS = [
    { id: 'canales',   label: 'Canales',  icon: '📺' },
    { id: 'publicidad',label: 'Banners',  icon: '🖼️' },
    { id: 'preroll',   label: 'Pre-Roll', icon: '🎬' },
    { id: 'usuarios',  label: 'Usuarios', icon: '👥' },
    { id: 'metricas',  label: 'Métricas', icon: '📊' },
  ]
  function handleTabClick(id) { setTab(id); setSidebarOpen(false) }

  const filteredUsers = search
    ? usuarios.filter(u => (u.nombre || '').toLowerCase().includes(search.toLowerCase()) || u.telefono.includes(search))
    : usuarios

  const maxTop = topCanales.length > 0 ? topCanales[0][1] : 1

  // ── Transforms para el dashboard de métricas (RPCs) ──
  const M = metricas || {}
  const metricCards = [
    { label: 'Total usuarios', value: M.total_usuarios, icon: '👥', color: '#2D4F9F' },
    { label: 'Usuarios activos', value: M.usuarios_activos, icon: '✅', color: '#16a34a' },
    { label: 'Bloqueados', value: M.usuarios_bloqueados, icon: '⏱️', color: '#EF4444' },
    { label: 'Canales activos', value: M.canales_activos, icon: '📺', color: '#F08A2E' },
    { label: 'Sesiones hoy', value: M.sesiones_hoy, icon: '📊', color: '#9B6BAE' },
    { label: 'Minutos vistos hoy', value: M.minutos_hoy, icon: '⏳', color: '#5BC0C4' },
    { label: 'Viendo ahora', value: M.viendo_ahora, icon: '🔴', color: '#E9AF25' },
  ]
  const maxVistas = canalesPopulares.length > 0 ? Math.max(...canalesPopulares.map(c => c.total_vistas || 0), 1) : 1
  const horasArr = Array.from({ length: 24 }, (_, h) => {
    const f = horarioPico.find(x => x.hora === h)
    return { hora: h, minutos: f ? (f.total_minutos || 0) : 0 }
  })
  const maxHora = Math.max(...horasArr.map(h => h.minutos), 1)

  // Totales para las stats rápidas del sidebar y el resumen de publicidad
  const totalBannerViews = bannerStats.reduce((s, b) => s + (b.view_count || 0), 0)
  const totalBannerClicks = bannerStats.reduce((s, b) => s + (b.click_count || 0), 0)
  const totalPrerollViews = prerollStats.reduce((s, p) => s + (p.view_count || 0), 0)
  const totalPrerollComplete = prerollStats.reduce((s, p) => s + (p.complete_count || 0), 0)
  const bannersActivos = banners.filter(b => b.activo).length
  const prerollsActivos = prerolls.filter(p => p.activo).length

  return (
    <div className="min-h-screen" style={{ background: '#F4F8FD', color: '#2A3240' }}>
      {/* Header móvil */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b flex items-center px-4 gap-3 z-30" style={{ borderColor: '#E4E9F0' }}>
        <button onClick={() => setSidebarOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100" style={{ color: '#2A3240' }} aria-label="Abrir menú">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <img src="/logos/escudo.png" alt="Metepec" className="h-8 object-contain" />
        <span className="font-black text-sm tracking-tight" style={{ color: '#2A3240' }}>Panel Admin</span>
      </header>

      {/* Overlay del drawer en móvil */}
      {sidebarOpen && <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r flex flex-col transition-transform duration-300 md:translate-x-0 ' + (sidebarOpen ? 'translate-x-0' : '-translate-x-full')} style={{ borderColor: '#E4E9F0' }}>
        {/* Logo + título */}
        <div className="p-4 border-b" style={{ borderColor: '#E4E9F0' }}>
          <div className="flex items-center gap-2.5">
            <img src="/logos/escudo.png" alt="Metepec" className="h-10 object-contain" />
            <div>
              <div className="font-black text-sm tracking-tight leading-tight" style={{ color: '#2A3240' }}>Metepec Funciona TV</div>
              <div className="text-2xs uppercase tracking-wider font-semibold" style={{ color: '#8D96A5' }}>Panel Admin</div>
            </div>
          </div>
        </div>

        {/* Stats rápidas 2x2 */}
        <div className="p-4 border-b" style={{ borderColor: '#E4E9F0' }}>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg p-2 text-center" style={{ background: '#F4F8FD' }}>
              <p className="text-lg font-bold" style={{ color: '#2A3240' }}>{Number(M.total_usuarios || 0).toLocaleString('es-MX')}</p>
              <p className="text-2xs" style={{ color: '#8D96A5' }}>Usuarios</p>
              <p className="text-2xs font-semibold" style={{ color: '#E9AF25' }}>{M.usuarios_activos || 0} activos</p>
            </div>
            <div className="rounded-lg p-2 text-center" style={{ background: '#F4F8FD' }}>
              <p className="text-lg font-bold" style={{ color: '#2A3240' }}>{M.canales_activos || 0}</p>
              <p className="text-2xs" style={{ color: '#8D96A5' }}>Canales</p>
            </div>
            <div className="rounded-lg p-2 text-center" style={{ background: '#F4F8FD' }}>
              <p className="text-lg font-bold" style={{ color: '#2A3240' }}>{bannersActivos}</p>
              <p className="text-2xs" style={{ color: '#8D96A5' }}>Banners</p>
              <p className="text-2xs font-semibold" style={{ color: '#2D4F9F' }}>{totalBannerViews.toLocaleString('es-MX')} views</p>
            </div>
            <div className="rounded-lg p-2 text-center" style={{ background: '#F4F8FD' }}>
              <p className="text-lg font-bold" style={{ color: '#2A3240' }}>{prerollsActivos}</p>
              <p className="text-2xs" style={{ color: '#8D96A5' }}>Pre-Rolls</p>
              <p className="text-2xs font-semibold" style={{ color: '#2D4F9F' }}>{totalPrerollViews.toLocaleString('es-MX')} views</p>
            </div>
          </div>
          <p className="text-2xs text-center mt-2" style={{ color: '#B6BECB' }}>
            {lastRefresh ? ('Actualizado: ' + lastRefresh.toLocaleTimeString('es-MX')) : 'Cargando…'}
          </p>
        </div>

        {/* Navegación */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => handleTabClick(t.id)}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 border"
              style={tab === t.id
                ? { background: 'rgba(45,79,159,0.10)', color: '#2D4F9F', borderColor: 'rgba(45,79,159,0.22)' }
                : { background: 'transparent', color: '#8D96A5', borderColor: 'transparent' }}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t space-y-1" style={{ borderColor: '#E4E9F0' }}>
          <a href="/" className="block w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition" style={{ color: '#8D96A5' }}>← Ver App</a>
          <button onClick={() => { setAuth(false); setSidebarOpen(false) }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition">Cerrar sesión</button>
        </div>
      </aside>

      {/* Main */}
      <main className="md:ml-64 px-4 pb-10 pt-16 md:p-8">
        <div className="max-w-5xl mx-auto">

        {/* ═══ MÉTRICAS (RPCs) ═══ */}
        {tab === 'metricas' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-black text-2xl tracking-tight" style={{ color: '#2A3240' }}>Métricas</h2>
                <p className="text-xs" style={{ color: '#8D96A5' }}>{loadingMetrics ? 'Cargando…' : 'En vivo desde Supabase · auto cada 30s'}</p>
              </div>
              <button onClick={loadMetricas} className="text-sm font-bold transition hover:opacity-70" style={{ color: '#2D4F9F' }}>↻ Actualizar</button>
            </div>

            {/* Cards generales — admin_get_metricas() */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {metricCards.map((s, i) => (
                <div key={i} className="bg-white rounded-2xl border p-5 shadow-sm" style={{ borderColor: '#E4E9F0' }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-3" style={{ background: s.color + '15' }}>{s.icon}</div>
                  <div className="text-3xl font-black" style={{ color: s.color }}>{Number(s.value || 0).toLocaleString('es-MX')}</div>
                  <div className="text-sm mt-1" style={{ color: '#8D96A5' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {/* 🏆 Canales más vistos — admin_get_canales_populares(10) */}
              <div className="bg-white rounded-2xl border shadow-sm p-5" style={{ borderColor: '#E4E9F0' }}>
                <div className="font-black text-base mb-4" style={{ color: '#2A3240' }}>🏆 Canales más vistos</div>
                {canalesPopulares.length === 0
                  ? <div className="text-sm py-6 text-center" style={{ color: '#8D96A5' }}>Sin datos aún</div>
                  : <div className="space-y-3">
                    {canalesPopulares.map((c, i) => {
                      const medal = i === 0 ? '#E9AF25' : i === 1 ? '#9CA3AF' : i === 2 ? '#F08A2E' : null
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                            style={medal ? { background: medal, color: 'white' } : { background: '#F4F8FD', color: '#8D96A5' }}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between text-sm mb-1 gap-2">
                              <span className="font-semibold truncate" style={{ color: '#2A3240' }}>{c.nombre || c.canal}</span>
                              <span className="shrink-0 text-2xs" style={{ color: '#8D96A5' }}>
                                {Number(c.total_vistas || 0).toLocaleString('es-MX')} vistas · {c.total_minutos || 0} min · {c.usuarios_unicos || 0}👤
                              </span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F4F8FD' }}>
                              <div className="h-2 rounded-full transition-all" style={{ width: `${((c.total_vistas || 0) / maxVistas) * 100}%`, background: medal || '#2D4F9F' }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                }
              </div>

              {/* Viendo ahora (lista en vivo) */}
              <div className="bg-white rounded-2xl border shadow-sm p-5" style={{ borderColor: '#E4E9F0' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="font-black text-base" style={{ color: '#2A3240' }}>Viendo ahora</div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: '#E9AF2518' }}>
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#E9AF25' }} />
                    <span className="text-xs font-bold" style={{ color: '#E9AF25' }}>{liveViewers.length} activos</span>
                  </div>
                </div>
                {liveViewers.length === 0
                  ? <div className="text-sm py-6 text-center" style={{ color: '#8D96A5' }}>Ningún usuario conectado</div>
                  : <div className="space-y-1 max-h-72 overflow-y-auto">
                    {liveViewers.map(s => (
                      <div key={s.id} className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: '#F4F8FD' }}>
                        <div>
                          <div className="text-sm font-medium" style={{ color: '#2A3240' }}>{s.usuarios?.nombre || 'Sin nombre'}</div>
                          <div className="text-xs" style={{ color: '#8D96A5' }}>{s.usuarios?.telefono}</div>
                        </div>
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(45,79,159,0.10)', color: '#2D4F9F' }}>{s.canal}</span>
                      </div>
                    ))}
                  </div>
                }
              </div>
            </div>

            {/* ⏰ Horario de audiencia — admin_get_horario_pico() (barras horizontales) */}
            <div className="bg-white rounded-2xl border shadow-sm p-5" style={{ borderColor: '#E4E9F0' }}>
              <div className="font-black text-base" style={{ color: '#2A3240' }}>⏰ Horario de audiencia</div>
              <div className="text-xs mb-4" style={{ color: '#8D96A5' }}>Minutos vistos por hora del día (últimos 7 días)</div>
              <div className="space-y-1">
                {horasArr.map(h => {
                  const isPeak = h.minutos === maxHora && maxHora > 1
                  return (
                    <div key={h.hora} className="flex items-center gap-2">
                      <span className="text-2xs font-mono w-10 text-right shrink-0" style={{ color: isPeak ? '#E9AF25' : '#8D96A5' }}>
                        {String(h.hora).padStart(2, '0')}:00
                      </span>
                      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: '#F4F8FD' }}>
                        <div className="h-3 rounded-full transition-all" style={{ width: `${(h.minutos / maxHora) * 100}%`, minWidth: h.minutos > 0 ? 6 : 0, background: isPeak ? '#E9AF25' : '#2D4F9F' }} />
                      </div>
                      <span className="text-2xs w-14 shrink-0 text-right" style={{ color: isPeak ? '#E9AF25' : '#8D96A5', fontWeight: isPeak ? 700 : 400 }}>{h.minutos} min</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 📢 Resumen de Publicidad — admin_get_banner_stats() / admin_get_preroll_stats() */}
            <div>
              <div className="font-black text-base mb-3" style={{ color: '#2A3240' }}>📢 Resumen de Publicidad</div>
              <div className="grid md:grid-cols-2 gap-5">
                {/* Banners */}
                <div className="bg-white rounded-2xl border shadow-sm p-5" style={{ borderColor: '#E4E9F0' }}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-bold text-sm" style={{ color: '#2A3240' }}>🖼️ Banners</span>
                    <span className="text-2xs" style={{ color: '#8D96A5' }}>{bannerStats.length} registrados</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-xl p-3 text-center" style={{ background: '#F4F8FD' }}>
                      <div className="text-2xl font-black" style={{ color: '#2D4F9F' }}>{totalBannerViews.toLocaleString('es-MX')}</div>
                      <div className="text-2xs" style={{ color: '#8D96A5' }}>👁️ Impresiones</div>
                    </div>
                    <div className="rounded-xl p-3 text-center" style={{ background: '#F4F8FD' }}>
                      <div className="text-2xl font-black" style={{ color: '#E9AF25' }}>{totalBannerClicks.toLocaleString('es-MX')}</div>
                      <div className="text-2xs" style={{ color: '#8D96A5' }}>🖱️ Clics</div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {bannerStats.map(b => {
                      const v = b.view_count || 0, c = b.click_count || 0
                      const ctr = v > 0 ? (c / v * 100).toFixed(1) : '0.0'
                      return (
                        <div key={b.id} className="flex items-center justify-between text-xs gap-2">
                          <span className="truncate" style={{ color: '#2A3240' }}>{b.titulo || 'Sin título'} <span style={{ color: '#B6BECB' }}>· {b.posicion}</span></span>
                          <span className="shrink-0" style={{ color: '#8D96A5' }}>{v.toLocaleString('es-MX')}👁 · {c}🖱 · <span style={{ color: '#2D4F9F', fontWeight: 600 }}>{ctr}%</span></span>
                        </div>
                      )
                    })}
                    {bannerStats.length === 0 && <div className="text-2xs text-center py-2" style={{ color: '#8D96A5' }}>Sin datos</div>}
                  </div>
                </div>

                {/* Preroll */}
                <div className="bg-white rounded-2xl border shadow-sm p-5" style={{ borderColor: '#E4E9F0' }}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-bold text-sm" style={{ color: '#2A3240' }}>🎬 Pre-Roll</span>
                    <span className="text-2xs" style={{ color: '#8D96A5' }}>{prerollStats.length} registrados</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-xl p-3 text-center" style={{ background: '#F4F8FD' }}>
                      <div className="text-2xl font-black" style={{ color: '#2D4F9F' }}>{totalPrerollViews.toLocaleString('es-MX')}</div>
                      <div className="text-2xs" style={{ color: '#8D96A5' }}>▶️ Reproducciones</div>
                    </div>
                    <div className="rounded-xl p-3 text-center" style={{ background: '#F4F8FD' }}>
                      <div className="text-2xl font-black" style={{ color: '#16a34a' }}>{totalPrerollComplete.toLocaleString('es-MX')}</div>
                      <div className="text-2xs" style={{ color: '#8D96A5' }}>✅ Completados</div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {prerollStats.map(p => {
                      const v = p.view_count || 0, comp = p.complete_count || 0, sk = p.skip_count || 0
                      const rate = v > 0 ? (comp / v * 100).toFixed(1) : '0.0'
                      return (
                        <div key={p.id} className="flex items-center justify-between text-xs gap-2">
                          <span className="truncate" style={{ color: '#2A3240' }}>{p.titulo || 'Sin título'}</span>
                          <span className="shrink-0" style={{ color: '#8D96A5' }}>{v.toLocaleString('es-MX')}▶ · {sk}⏭ · <span style={{ color: '#16a34a', fontWeight: 600 }}>{rate}%</span></span>
                        </div>
                      )
                    })}
                    {prerollStats.length === 0 && <div className="text-2xs text-center py-2" style={{ color: '#8D96A5' }}>Sin datos</div>}
                  </div>
                </div>
              </div>
            </div>

            {/* Sesiones recientes (últimas 50) */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: '#E4E9F0' }}>
              <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E9F0' }}>
                <div className="font-black text-base" style={{ color: '#2A3240' }}>Sesiones recientes</div>
                <button onClick={loadSesiones} className="text-sm font-semibold transition hover:opacity-70" style={{ color: '#2D4F9F' }}>↻ Actualizar</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b font-semibold" style={{ background: '#F4F8FD', borderColor: '#E4E9F0', color: '#8D96A5' }}>
                      <th className="text-left px-4 py-3">Usuario</th>
                      <th className="text-left px-4 py-3">Canal</th>
                      <th className="text-left px-4 py-3">Inicio</th>
                      <th className="text-left px-4 py-3">Fin</th>
                      <th className="text-left px-4 py-3">Min</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sesiones.map(s => (
                      <tr key={s.id} className="border-b last:border-0" style={{ borderColor: '#F4F8FD' }}>
                        <td className="px-4 py-4">
                          <div className="font-medium" style={{ color: '#2A3240' }}>{s.usuarios?.nombre || 'Sin nombre'}</div>
                          <div className="text-xs" style={{ color: '#8D96A5' }}>{s.usuarios?.telefono}</div>
                        </td>
                        <td className="px-4 py-4" style={{ color: '#5A6577' }}>{s.canal}</td>
                        <td className="px-4 py-4 text-xs" style={{ color: '#8D96A5' }}>
                          {s.inicio ? new Date(s.inicio).toLocaleString('es-MX') : '—'}
                        </td>
                        <td className="px-4 py-4 text-xs">
                          {s.fin
                            ? <span style={{ color: '#8D96A5' }}>{new Date(s.fin).toLocaleString('es-MX')}</span>
                            : <span className="font-semibold" style={{ color: '#16a34a' }}>En vivo</span>}
                        </td>
                        <td className="px-4 py-4" style={{ color: '#5A6577' }}>{s.minutos}</td>
                      </tr>
                    ))}
                    {sesiones.length === 0 && (
                      <tr><td colSpan={5} className="py-10 text-center" style={{ color: '#8D96A5' }}>Sin sesiones registradas</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══ USUARIOS ═══ */}
        {tab === 'usuarios' && (
          <div>
            <div className="flex flex-col sm:flex-row gap-3 mb-4 justify-between items-start sm:items-center">
              <h3 className="font-bold text-lg">Usuarios ({usuarios.length})</h3>
              <div className="flex gap-2 w-full sm:w-auto">
                <input placeholder="Buscar nombre o teléfono..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="flex-1 sm:w-60 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
                <button onClick={() => { setAddingUser(!addingUser); setEditingUser(null) }}
                  className={btn} style={{ background: '#2D4F9F' }}>
                  {addingUser ? '✕ Cancelar' : '+ Agregar'}
                </button>
              </div>
            </div>

            {addingUser && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 shadow-sm">
                <div className="font-semibold text-base mb-4">Nuevo Usuario</div>
                <div className="grid sm:grid-cols-2 gap-x-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Nombre</label>
                    <input placeholder="Nombre completo (opcional)" value={newUser.nombre}
                      onChange={e => setNewUser(p => ({ ...p, nombre: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Teléfono</label>
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden mb-3">
                      <span className="bg-gray-50 px-3 py-2.5 text-sm text-gray-400 border-r">+52</span>
                      <input placeholder="10 dígitos" value={newUser.phone} maxLength={10}
                        onChange={e => setNewUser(p => ({ ...p, phone: e.target.value.replace(/\D/g, '') }))}
                        className="flex-1 px-3 py-2.5 text-sm outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">PIN</label>
                    <input placeholder="4 dígitos (auto si vacío)" value={newUser.pin} maxLength={6}
                      onChange={e => setNewUser(p => ({ ...p, pin: e.target.value.replace(/\D/g, '') }))} className={inp} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Tipo de tiempo</label>
                    <select value={newUser.tipo_tiempo}
                      onChange={e => setNewUser(p => ({ ...p, tipo_tiempo: e.target.value }))} className={inp}>
                      <option value="fijo">Fijo (minutos fijos)</option>
                      <option value="mensual">Mensual (se reinicia cada mes)</option>
                      <option value="ilimitado">Ilimitado</option>
                    </select>
                  </div>
                  {newUser.tipo_tiempo !== 'ilimitado' && (
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Minutos límite</label>
                      <input type="number" value={newUser.minutos_limite}
                        onChange={e => setNewUser(p => ({ ...p, minutos_limite: parseInt(e.target.value) || 1800 }))} className={inp} />
                    </div>
                  )}
                </div>
                <button onClick={addUsuario} className={btn} style={{ background: '#16a34a' }}>Guardar Usuario</button>
              </div>
            )}

            {editingUser && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                  <div className="font-bold text-lg mb-4">Editar Usuario</div>
                  <label className="block text-sm text-gray-500 mb-1">Nombre</label>
                  <input value={editingUser.nombre || ''} onChange={e => setEditingUser(p => ({ ...p, nombre: e.target.value }))} className={inp} />
                  <label className="block text-sm text-gray-500 mb-1">PIN</label>
                  <input value={editingUser.pin || ''} maxLength={6}
                    onChange={e => setEditingUser(p => ({ ...p, pin: e.target.value.replace(/\D/g, '') }))} className={inp} />
                  <label className="block text-sm text-gray-500 mb-1">Tipo de tiempo</label>
                  <select value={editingUser.tipo_tiempo || 'fijo'}
                    onChange={e => setEditingUser(p => ({ ...p, tipo_tiempo: e.target.value }))} className={inp}>
                    <option value="fijo">Fijo</option>
                    <option value="mensual">Mensual</option>
                    <option value="ilimitado">Ilimitado</option>
                  </select>
                  {(editingUser.tipo_tiempo || 'fijo') !== 'ilimitado' && (
                    <>
                      <label className="block text-sm text-gray-500 mb-1">Minutos límite</label>
                      <input type="number" value={editingUser.minutos_limite}
                        onChange={e => setEditingUser(p => ({ ...p, minutos_limite: e.target.value }))} className={inp} />
                    </>
                  )}
                  <div className="flex gap-3 mt-1">
                    <button onClick={saveEditUser} className={btn + ' flex-1'} style={{ background: '#2D4F9F' }}>Guardar</button>
                    <button onClick={() => setEditingUser(null)} className="flex-1 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600">Cancelar</button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold">
                    <th className="text-left px-4 py-3">Nombre</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Teléfono</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">PIN</th>
                    <th className="text-left px-4 py-3">Tiempo</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Tipo</th>
                    <th className="text-left px-4 py-3">Estado</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Último acceso</th>
                    <th className="text-left px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => {
                    const tipo = TIPO_LABELS[u.tipo_tiempo || 'fijo'] || TIPO_LABELS.fijo
                    return (
                      <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                        <td className="px-4 py-4 font-medium">{u.nombre || 'Sin nombre'}</td>
                        <td className="px-4 py-4 text-gray-500 hidden sm:table-cell">{u.telefono}</td>
                        <td className="px-4 py-4 hidden md:table-cell">
                          <span className="font-mono font-bold" style={{ color: '#2D4F9F' }}>{u.pin || '—'}</span>
                        </td>
                        <td className="px-4 py-4">
                          {u.tipo_tiempo === 'ilimitado' ? (
                            <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>∞</span>
                          ) : (
                            <>
                              <div className="text-sm text-gray-700">{u.minutos_consumidos}/{u.minutos_limite}</div>
                              <div className="w-20 h-1.5 bg-gray-100 rounded-full mt-1">
                                <div className="h-1.5 rounded-full" style={{
                                  width: `${Math.min(100, (u.minutos_consumidos / (u.minutos_limite || 1)) * 100)}%`,
                                  background: u.minutos_consumidos >= u.minutos_limite ? '#EF4444' : '#2D4F9F'
                                }} />
                              </div>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-4 hidden lg:table-cell">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: tipo.bg, color: tipo.color }}>
                            {tipo.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-2 py-1 rounded-full text-xs font-semibold"
                            style={{ background: u.activo ? '#dcfce7' : '#fee2e2', color: u.activo ? '#16a34a' : '#dc2626' }}>
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-400 hidden lg:table-cell">
                          {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString('es-MX') : '—'}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex gap-1.5 flex-wrap">
                            <button onClick={() => { setEditingUser({ ...u }); setAddingUser(false) }}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100">Editar</button>
                            <button onClick={() => resetMinutos(u.id)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-orange-50 text-orange-500 hover:bg-orange-100">Reset</button>
                            <button onClick={() => toggleUsuario(u.id, u.activo)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                              style={{ background: u.activo ? '#fee2e2' : '#dcfce7', color: u.activo ? '#dc2626' : '#16a34a' }}>
                              {u.activo ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={8} className="py-10 text-center text-gray-400">No se encontraron usuarios</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ CANALES ═══ */}
        {tab === 'canales' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Canales ({canales.length})</h3>
              <button onClick={() => { setAddingCanal(!addingCanal); setEditingCanal(null) }}
                className={btn} style={{ background: '#2D4F9F' }}>
                {addingCanal ? '✕ Cancelar' : '+ Agregar Canal'}
              </button>
            </div>

            {addingCanal && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 shadow-sm">
                <div className="font-semibold text-base mb-4">Nuevo Canal</div>
                <div className="grid sm:grid-cols-2 gap-x-4">
                  <div><label className="block text-sm text-gray-500 mb-1">Nombre *</label>
                    <input placeholder="Nombre del canal" value={newCanal.nombre}
                      onChange={e => setNewCanal(p => ({ ...p, nombre: e.target.value }))} className={inp} /></div>
                  <div><label className="block text-sm text-gray-500 mb-1">Slug *</label>
                    <input placeholder="ej: mi-canal" value={newCanal.slug}
                      onChange={e => setNewCanal(p => ({ ...p, slug: e.target.value }))} className={inp} /></div>
                  <div className="sm:col-span-2"><label className="block text-sm text-gray-500 mb-1">URL HLS *</label>
                    <input placeholder="https://... .m3u8" value={newCanal.url_hls}
                      onChange={e => setNewCanal(p => ({ ...p, url_hls: e.target.value }))} className={inp} /></div>
                  <div><label className="block text-sm text-gray-500 mb-1">URL Logo</label>
                    <input placeholder="https://... (opcional)" value={newCanal.logo_url}
                      onChange={e => setNewCanal(p => ({ ...p, logo_url: e.target.value }))} className={inp} /></div>
                  <div><label className="block text-sm text-gray-500 mb-1">Categoría</label>
                    <input placeholder="Municipal" value={newCanal.categoria}
                      onChange={e => setNewCanal(p => ({ ...p, categoria: e.target.value }))} className={inp} /></div>
                  <div><label className="block text-sm text-gray-500 mb-1">Orden</label>
                    <input type="number" value={newCanal.orden}
                      onChange={e => setNewCanal(p => ({ ...p, orden: parseInt(e.target.value) || 0 }))} className={inp} /></div>
                </div>
                <button onClick={addCanal} className={btn} style={{ background: '#16a34a' }}>Guardar Canal</button>
              </div>
            )}

            {editingCanal && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
                  <div className="font-bold text-lg mb-4">Editar Canal</div>
                  <div className="grid sm:grid-cols-2 gap-x-4">
                    <div><label className="block text-sm text-gray-500 mb-1">Nombre</label>
                      <input value={editingCanal.nombre} onChange={e => setEditingCanal(p => ({ ...p, nombre: e.target.value }))} className={inp} /></div>
                    <div><label className="block text-sm text-gray-500 mb-1">Slug</label>
                      <input value={editingCanal.slug} onChange={e => setEditingCanal(p => ({ ...p, slug: e.target.value }))} className={inp} /></div>
                    <div className="sm:col-span-2"><label className="block text-sm text-gray-500 mb-1">URL HLS</label>
                      <input value={editingCanal.url_hls} onChange={e => setEditingCanal(p => ({ ...p, url_hls: e.target.value }))} className={inp} /></div>
                    <div><label className="block text-sm text-gray-500 mb-1">URL Logo</label>
                      <input value={editingCanal.logo_url || ''} onChange={e => setEditingCanal(p => ({ ...p, logo_url: e.target.value }))} className={inp} /></div>
                    <div><label className="block text-sm text-gray-500 mb-1">Categoría</label>
                      <input value={editingCanal.categoria || ''} onChange={e => setEditingCanal(p => ({ ...p, categoria: e.target.value }))} className={inp} /></div>
                    <div><label className="block text-sm text-gray-500 mb-1">Orden</label>
                      <input type="number" value={editingCanal.orden} onChange={e => setEditingCanal(p => ({ ...p, orden: e.target.value }))} className={inp} /></div>
                  </div>
                  <div className="flex gap-3 mt-1">
                    <button onClick={saveEditCanal} className={btn + ' flex-1'} style={{ background: '#2D4F9F' }}>Guardar</button>
                    <button onClick={() => setEditingCanal(null)} className="flex-1 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600">Cancelar</button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold">
                    <th className="text-left px-4 py-3">Nombre</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Slug</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Categoría</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Orden</th>
                    <th className="text-left px-4 py-3">Estado</th>
                    <th className="text-left px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {canales.map(ch => (
                    <tr key={ch.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {ch.logo_url
                            ? <img src={ch.logo_url} alt="" className="w-7 h-7 object-contain rounded" />
                            : <span className="text-lg">📺</span>}
                          <span className="font-medium">{ch.nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-400 font-mono text-xs hidden sm:table-cell">{ch.slug}</td>
                      <td className="px-4 py-4 text-gray-500 hidden md:table-cell">{ch.categoria}</td>
                      <td className="px-4 py-4 text-gray-500 hidden md:table-cell">{ch.orden}</td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 rounded-full text-xs font-semibold"
                          style={{ background: ch.activo ? '#dcfce7' : '#fee2e2', color: ch.activo ? '#16a34a' : '#dc2626' }}>
                          {ch.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-1.5">
                          <button onClick={() => { setEditingCanal({ ...ch }); setAddingCanal(false) }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100">Editar</button>
                          <button onClick={() => toggleCanal(ch.id, ch.activo)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: ch.activo ? '#fee2e2' : '#dcfce7', color: ch.activo ? '#dc2626' : '#16a34a' }}>
                            {ch.activo ? 'Desactivar' : 'Activar'}
                          </button>
                          <button onClick={() => deleteCanal(ch.id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {canales.length === 0 && (
                    <tr><td colSpan={6} className="py-10 text-center text-gray-400">No hay canales</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ PUBLICIDAD ═══ */}
        {tab === 'publicidad' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Banners ({banners.length})</h3>
              <button onClick={() => { setAddingBanner(!addingBanner); setEditingBanner(null) }}
                className={btn} style={{ background: '#2D4F9F' }}>
                {addingBanner ? '✕ Cancelar' : '+ Agregar Banner'}
              </button>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 mb-4 text-sm text-blue-700 leading-relaxed">
              <div className="font-semibold mb-2">📐 Posiciones y tamaños recomendados:</div>
              <div className="space-y-1.5">
                <div><span className="font-mono bg-blue-100 px-1.5 py-0.5 rounded text-xs">hero</span> — Banner principal arriba del home <span className="text-blue-400">(1200×300 px)</span></div>
                <div><span className="font-mono bg-blue-100 px-1.5 py-0.5 rounded text-xs">intermedio</span> — Entre filas de canales <span className="text-blue-400">(600×200 px)</span></div>
                <div><span className="font-mono bg-blue-100 px-1.5 py-0.5 rounded text-xs">player</span> — Debajo del reproductor <span className="text-blue-400">(728×90 px)</span></div>
              </div>
            </div>

            {addingBanner && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 shadow-sm">
                <div className="font-semibold text-base mb-4">Nuevo Banner</div>
                <div className="grid sm:grid-cols-2 gap-x-4">
                  <div className="sm:col-span-2"><label className="block text-sm text-gray-500 mb-1">Título</label>
                    <input placeholder="Nombre del banner" value={newBanner.titulo}
                      onChange={e => setNewBanner(p => ({ ...p, titulo: e.target.value }))} className={inp} /></div>
                  <div className="sm:col-span-2"><label className="block text-sm text-gray-500 mb-1">URL Imagen *</label>
                    <input placeholder="/banners/mi-banner.jpg o https://..." value={newBanner.imagen_url}
                      onChange={e => setNewBanner(p => ({ ...p, imagen_url: e.target.value }))} className={inp} /></div>
                  <div className="sm:col-span-2"><label className="block text-sm text-gray-500 mb-1">Enlace al clic</label>
                    <input placeholder="https://... (opcional)" value={newBanner.enlace}
                      onChange={e => setNewBanner(p => ({ ...p, enlace: e.target.value }))} className={inp} /></div>
                  <div><label className="block text-sm text-gray-500 mb-1">Posición</label>
                    <select value={newBanner.posicion} onChange={e => setNewBanner(p => ({ ...p, posicion: e.target.value }))} className={inp}>
                      <option value="hero">Hero (arriba)</option>
                      <option value="intermedio">Intermedio (entre canales)</option>
                      <option value="player">Player (debajo del reproductor)</option>
                    </select></div>
                  <div><label className="block text-sm text-gray-500 mb-1">Orden</label>
                    <input type="number" value={newBanner.orden}
                      onChange={e => setNewBanner(p => ({ ...p, orden: parseInt(e.target.value) || 0 }))} className={inp} /></div>
                </div>
                <button onClick={addBanner} className={btn} style={{ background: '#16a34a' }}>Guardar Banner</button>
              </div>
            )}

            {editingBanner && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
                  <div className="font-bold text-lg mb-4">Editar Banner</div>
                  <div className="grid sm:grid-cols-2 gap-x-4">
                    <div className="sm:col-span-2"><label className="block text-sm text-gray-500 mb-1">Título</label>
                      <input value={editingBanner.titulo} onChange={e => setEditingBanner(p => ({ ...p, titulo: e.target.value }))} className={inp} /></div>
                    <div className="sm:col-span-2"><label className="block text-sm text-gray-500 mb-1">URL Imagen</label>
                      <input value={editingBanner.imagen_url} onChange={e => setEditingBanner(p => ({ ...p, imagen_url: e.target.value }))} className={inp} /></div>
                    <div className="sm:col-span-2"><label className="block text-sm text-gray-500 mb-1">Enlace al clic</label>
                      <input value={editingBanner.enlace || ''} onChange={e => setEditingBanner(p => ({ ...p, enlace: e.target.value }))} className={inp} /></div>
                    <div><label className="block text-sm text-gray-500 mb-1">Posición</label>
                      <select value={editingBanner.posicion} onChange={e => setEditingBanner(p => ({ ...p, posicion: e.target.value }))} className={inp}>
                        <option value="hero">Hero</option>
                        <option value="intermedio">Intermedio</option>
                        <option value="player">Player</option>
                      </select></div>
                    <div><label className="block text-sm text-gray-500 mb-1">Orden</label>
                      <input type="number" value={editingBanner.orden} onChange={e => setEditingBanner(p => ({ ...p, orden: e.target.value }))} className={inp} /></div>
                  </div>
                  <div className="flex gap-3 mt-1">
                    <button onClick={saveEditBanner} className={btn + ' flex-1'} style={{ background: '#2D4F9F' }}>Guardar</button>
                    <button onClick={() => setEditingBanner(null)} className="flex-1 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600">Cancelar</button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold">
                    <th className="text-left px-4 py-3">Preview</th>
                    <th className="text-left px-4 py-3">Título</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Posición</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Orden</th>
                    <th className="text-left px-4 py-3">Estado</th>
                    <th className="text-left px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {banners.map(b => (
                    <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-4">
                        <img src={b.imagen_url} alt="" className="w-20 h-12 object-cover rounded-lg border border-gray-100" />
                      </td>
                      <td className="px-4 py-4 font-medium">{b.titulo}</td>
                      <td className="px-4 py-4 hidden sm:table-cell">
                        <span className="font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-xs">{b.posicion}</span>
                      </td>
                      <td className="px-4 py-4 text-gray-500 hidden md:table-cell">{b.orden}</td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 rounded-full text-xs font-semibold"
                          style={{ background: b.activo ? '#dcfce7' : '#fee2e2', color: b.activo ? '#16a34a' : '#dc2626' }}>
                          {b.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-1.5">
                          <button onClick={() => { setEditingBanner({ ...b }); setAddingBanner(false) }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100">Editar</button>
                          <button onClick={() => toggleBanner(b.id, b.activo)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: b.activo ? '#fee2e2' : '#dcfce7', color: b.activo ? '#dc2626' : '#16a34a' }}>
                            {b.activo ? 'Desactivar' : 'Activar'}
                          </button>
                          <button onClick={() => deleteBanner(b.id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {banners.length === 0 && (
                    <tr><td colSpan={6} className="py-10 text-center text-gray-400">No hay banners</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ PREROLL ═══ */}
        {tab === 'preroll' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Videos Preroll ({prerolls.length})</h3>
              <button onClick={() => { setCanalesSeleccionados([]); setAddingPreroll(!addingPreroll); setEditingPreroll(null) }}
                className={btn} style={{ background: '#2D4F9F' }}>
                {addingPreroll ? '✕ Cancelar' : '+ Agregar Video'}
              </button>
            </div>

            <div className="bg-yellow-50 rounded-xl p-4 mb-4 text-sm text-yellow-700 leading-relaxed">
              <div className="font-semibold mb-1">🎬 Videos Preroll</div>
              <div>Se muestran automáticamente al seleccionar un canal. El usuario puede saltarlos después de 5 segundos. El video se elige al azar entre los activos.</div>
            </div>

            {addingPreroll && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 shadow-sm">
                <div className="font-semibold text-base mb-4">Nuevo Video Preroll</div>
                <div className="grid sm:grid-cols-2 gap-x-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm text-gray-500 mb-1">Título *</label>
                    <input placeholder="Nombre del anuncio" value={newPreroll.titulo}
                      onChange={e => setNewPreroll(p => ({ ...p, titulo: e.target.value }))} className={inp} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm text-gray-500 mb-1">Tipo</label>
                    <select value={newPreroll.tipo || 'video'}
                      onChange={e => setNewPreroll(p => ({ ...p, tipo: e.target.value, duracion: e.target.value === 'imagen' ? 5 : 15 }))}
                      className={inp}>
                      <option value="video">Video (MP4)</option>
                      <option value="imagen">Imagen (JPG/PNG)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm text-gray-500 mb-1">
                      {newPreroll.tipo === 'imagen' ? 'URL de la Imagen *' : 'URL del Video *'}
                    </label>
                    <input
                      placeholder={newPreroll.tipo === 'imagen' ? 'https://... .jpg / .png' : 'https://... .mp4'}
                      value={newPreroll.video_url}
                      onChange={e => setNewPreroll(p => ({ ...p, video_url: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">
                      {newPreroll.tipo === 'imagen' ? 'Tiempo de visualización (s)' : 'Duración (segundos)'}
                    </label>
                    <input type="number" value={newPreroll.duracion}
                      onChange={e => setNewPreroll(p => ({ ...p, duracion: parseInt(e.target.value) || (newPreroll.tipo === 'imagen' ? 5 : 15) }))} className={inp} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Orden</label>
                    <input type="number" value={newPreroll.orden}
                      onChange={e => setNewPreroll(p => ({ ...p, orden: parseInt(e.target.value) || 0 }))} className={inp} />
                  </div>
                  <div className="sm:col-span-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm text-gray-500 font-medium">Asignar a canales:</label>
                      <button type="button" onClick={() => setCanalesSeleccionados(
                        canalesSeleccionados.length === canalesDisponibles.length ? [] : canalesDisponibles.map(c => c.id)
                      )} className="text-xs text-blue-500 hover:text-blue-700">
                        {canalesSeleccionados.length === canalesDisponibles.length ? 'Ninguno' : 'Todos los canales'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                      {canalesDisponibles.map(c => (
                        <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={canalesSeleccionados.includes(c.id)}
                            onChange={() => setCanalesSeleccionados(prev =>
                              prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                            )} />
                          <span className="text-gray-700 truncate">{c.nombre}</span>
                        </label>
                      ))}
                      {canalesDisponibles.length === 0 && <span className="text-gray-400 text-xs col-span-2">No hay canales disponibles</span>}
                    </div>
                  </div>
                </div>
                <button onClick={addPreroll} className={btn} style={{ background: '#16a34a' }}>Guardar Video</button>
              </div>
            )}

            {editingPreroll && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
                  <div className="font-bold text-lg mb-4">Editar Video Preroll</div>
                  <label className="block text-sm text-gray-500 mb-1">Título</label>
                  <input value={editingPreroll.titulo} onChange={e => setEditingPreroll(p => ({ ...p, titulo: e.target.value }))} className={inp} />
                  <label className="block text-sm text-gray-500 mb-1">URL del Video</label>
                  <input value={editingPreroll.video_url} onChange={e => setEditingPreroll(p => ({ ...p, video_url: e.target.value }))} className={inp} />
                  {editingPreroll.video_url && (
                    <video src={editingPreroll.video_url} controls className="w-full rounded-lg mb-3" style={{ maxHeight: 160 }} />
                  )}
                  <div className="grid grid-cols-2 gap-x-4">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Duración (s)</label>
                      <input type="number" value={editingPreroll.duracion} onChange={e => setEditingPreroll(p => ({ ...p, duracion: e.target.value }))} className={inp} />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Orden</label>
                      <input type="number" value={editingPreroll.orden} onChange={e => setEditingPreroll(p => ({ ...p, orden: e.target.value }))} className={inp} />
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm text-gray-500 font-medium">Asignar a canales:</label>
                      <button type="button" onClick={() => setCanalesSeleccionados(
                        canalesSeleccionados.length === canalesDisponibles.length ? [] : canalesDisponibles.map(c => c.id)
                      )} className="text-xs text-blue-500 hover:text-blue-700">
                        {canalesSeleccionados.length === canalesDisponibles.length ? 'Ninguno' : 'Todos los canales'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                      {canalesDisponibles.map(c => (
                        <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={canalesSeleccionados.includes(c.id)}
                            onChange={() => setCanalesSeleccionados(prev =>
                              prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                            )} />
                          <span className="text-gray-700 truncate">{c.nombre}</span>
                        </label>
                      ))}
                      {canalesDisponibles.length === 0 && <span className="text-gray-400 text-xs col-span-2">No hay canales disponibles</span>}
                    </div>
                  </div>
                  <div className="flex gap-3 mt-1">
                    <button onClick={saveEditPreroll} className={btn + ' flex-1'} style={{ background: '#2D4F9F' }}>Guardar</button>
                    <button onClick={() => { setEditingPreroll(null); setCanalesSeleccionados([]) }} className="flex-1 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600">Cancelar</button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {prerolls.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
                  No hay videos preroll. Agrega uno para que aparezca antes de los canales.
                </div>
              )}
              {prerolls.map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-4">
                  <video src={p.video_url} className="w-40 h-24 object-cover rounded-lg bg-black flex-shrink-0" muted />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-800 mb-1">{p.titulo}</div>
                    <div className="text-xs text-gray-400 truncate mb-2">{p.video_url}</div>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">⏱ {p.duracion}s</span>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Orden: {p.orden}</span>
                      <span className="text-xs px-2 py-0.5 rounded font-semibold"
                        style={{ background: p.activo ? '#dcfce7' : '#fee2e2', color: p.activo ? '#16a34a' : '#dc2626' }}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <div className="mt-2">
                      {(prerollCanalesMap[p.id] || []).length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {(prerollCanalesMap[p.id] || []).map(pc => (
                            <span key={pc.canal_id} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{pc.nombre}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-red-500 font-medium">⚠ Sin canales asignados</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button onClick={async () => {
                        setEditingPreroll({ ...p })
                        setAddingPreroll(false)
                        const { data } = await supabase.from('preroll_canales').select('canal_id').eq('preroll_id', p.id)
                        setCanalesSeleccionados(data ? data.map(r => r.canal_id) : [])
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100">Editar</button>
                    <button onClick={() => togglePreroll(p.id, p.activo)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: p.activo ? '#fee2e2' : '#dcfce7', color: p.activo ? '#dc2626' : '#16a34a' }}>
                      {p.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => deletePreroll(p.id)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        </div>
      </main>
    </div>
  )
}
