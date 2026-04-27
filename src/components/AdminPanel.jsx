import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ADMIN_PW = import.meta.env.VITE_ADMIN_PASSWORD || 'metepec2026'
const inp = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 mb-3 bg-white"
const btn = "px-4 py-2 rounded-lg text-white text-sm font-semibold transition hover:opacity-90"

export default function AdminPanel() {
  const [auth, setAuth] = useState(false)
  const [pw, setPw] = useState('')
  const [tab, setTab] = useState('dashboard')

  const [usuarios, setUsuarios] = useState([])
  const [canales, setCanales] = useState([])
  const [banners, setBanners] = useState([])
  const [sesiones, setSesiones] = useState([])
  const [topCanales, setTopCanales] = useState([])
  const [liveViewers, setLiveViewers] = useState([])

  const [search, setSearch] = useState('')
  const [editingUser, setEditingUser] = useState(null)
  const [editingCanal, setEditingCanal] = useState(null)
  const [editingBanner, setEditingBanner] = useState(null)
  const [addingUser, setAddingUser] = useState(false)
  const [addingCanal, setAddingCanal] = useState(false)
  const [addingBanner, setAddingBanner] = useState(false)

  const [newUser, setNewUser] = useState({ nombre: '', phone: '', pin: '', minutos_limite: 1800 })
  const [newCanal, setNewCanal] = useState({ nombre: '', slug: '', url_hls: '', logo_url: '', categoria: 'Municipal', orden: 0 })
  const [newBanner, setNewBanner] = useState({ titulo: '', imagen_url: '', enlace: '', posicion: 'hero', orden: 0 })

  useEffect(() => {
    if (!auth) return
    loadAll()
    const iv = setInterval(loadDashboard, 30000)
    return () => clearInterval(iv)
  }, [auth])

  useEffect(() => {
    if (auth && tab === 'reportes') loadSesiones()
  }, [auth, tab])

  async function loadAll() {
    await Promise.all([loadUsuarios(), loadCanales(), loadBanners(), loadDashboard()])
  }

  async function loadUsuarios() {
    const { data } = await supabase.from('usuarios')
      .select('id, telefono, nombre, pin, minutos_consumidos, minutos_limite, activo, ultimo_acceso')
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

  async function loadDashboard() {
    const { data: all } = await supabase.from('sesiones').select('canal, minutos')
    if (all) {
      const grouped = {}
      all.forEach(s => { if (s.canal) grouped[s.canal] = (grouped[s.canal] || 0) + (s.minutos || 0) })
      setTopCanales(Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 10))
    }
    const { data: live } = await supabase.from('sesiones')
      .select('id, canal, inicio, usuarios(nombre, telefono)')
      .is('fin', null)
      .not('inicio', 'is', null)
      .order('inicio', { ascending: false })
    if (live) setLiveViewers(live)
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
      pin, minutos_limite: newUser.minutos_limite, activo: true
    })
    setNewUser({ nombre: '', phone: '', pin: '', minutos_limite: 1800 })
    setAddingUser(false); loadUsuarios()
  }

  async function saveEditUser() {
    await supabase.from('usuarios').update({
      nombre: editingUser.nombre, pin: editingUser.pin,
      minutos_limite: Number(editingUser.minutos_limite)
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
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'usuarios', label: 'Usuarios', icon: '👥' },
    { id: 'canales', label: 'Canales', icon: '📺' },
    { id: 'publicidad', label: 'Publicidad', icon: '📢' },
    { id: 'reportes', label: 'Reportes', icon: '📊' },
  ]

  const filteredUsers = search
    ? usuarios.filter(u => (u.nombre || '').toLowerCase().includes(search.toLowerCase()) || u.telefono.includes(search))
    : usuarios

  const maxTop = topCanales.length > 0 ? topCanales[0][1] : 1

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-3">
          <img src="/logos/escudo.png" alt="Escudo" className="h-9 object-contain" />
          <div>
            <div className="font-bold text-base text-gray-800">Admin — Metepec Funciona TV</div>
            <div className="text-xs text-gray-400">Panel de administración</div>
          </div>
        </div>
        <a href="/" className="text-sm text-gray-400 hover:text-gray-600 transition">← Volver a la app</a>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 flex gap-0 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-5 py-3 text-sm font-medium whitespace-nowrap transition border-b-2 -mb-px"
            style={{ borderColor: tab === t.id ? '#2D4F9F' : 'transparent', color: tab === t.id ? '#2D4F9F' : '#9ca3af' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-5xl mx-auto p-5">

        {/* ═══ DASHBOARD ═══ */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total usuarios', value: usuarios.length, icon: '👥', color: '#2D4F9F' },
                { label: 'Usuarios activos', value: usuarios.filter(u => u.activo).length, icon: '✅', color: '#22C55E' },
                { label: 'Canales activos', value: canales.filter(c => c.activo).length, icon: '📺', color: '#F08A2E' },
                { label: 'Bloqueados', value: usuarios.filter(u => u.minutos_consumidos >= u.minutos_limite).length, icon: '⏱️', color: '#EF4444' },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-3" style={{ background: s.color + '15' }}>{s.icon}</div>
                  <div className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-sm text-gray-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Top 10 canales */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="font-bold text-base mb-4">Top 10 Canales más vistos</div>
                {topCanales.length === 0
                  ? <div className="text-sm text-gray-400 py-6 text-center">Sin datos aún</div>
                  : <div className="space-y-3">
                    {topCanales.map(([canal, mins], i) => (
                      <div key={canal}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700 truncate mr-2">{i + 1}. {canal}</span>
                          <span className="text-gray-400 shrink-0">{mins} min</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-2 rounded-full transition-all" style={{ width: `${(mins / maxTop) * 100}%`, background: '#2D4F9F' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                }
              </div>

              {/* Viendo ahora */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-bold text-base">Viendo ahora</div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm text-gray-400">{liveViewers.length} activos</span>
                  </div>
                </div>
                {liveViewers.length === 0
                  ? <div className="text-sm text-gray-400 py-6 text-center">Ningún usuario conectado</div>
                  : <div className="space-y-1">
                    {liveViewers.map(s => (
                      <div key={s.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                        <div>
                          <div className="text-sm font-medium">{s.usuarios?.nombre || 'Sin nombre'}</div>
                          <div className="text-xs text-gray-400">{s.usuarios?.telefono}</div>
                        </div>
                        <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-medium">{s.canal}</span>
                      </div>
                    ))}
                  </div>
                }
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
                    <label className="block text-sm text-gray-500 mb-1">Minutos límite</label>
                    <input type="number" value={newUser.minutos_limite}
                      onChange={e => setNewUser(p => ({ ...p, minutos_limite: parseInt(e.target.value) || 1800 }))} className={inp} />
                  </div>
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
                  <label className="block text-sm text-gray-500 mb-1">Minutos límite</label>
                  <input type="number" value={editingUser.minutos_limite}
                    onChange={e => setEditingUser(p => ({ ...p, minutos_limite: e.target.value }))} className={inp} />
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
                    <th className="text-left px-4 py-3">Minutos</th>
                    <th className="text-left px-4 py-3">Estado</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Último acceso</th>
                    <th className="text-left px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-4 font-medium">{u.nombre || 'Sin nombre'}</td>
                      <td className="px-4 py-4 text-gray-500 hidden sm:table-cell">{u.telefono}</td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <span className="font-mono font-bold" style={{ color: '#2D4F9F' }}>{u.pin || '—'}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-700">{u.minutos_consumidos}/{u.minutos_limite}</div>
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full mt-1">
                          <div className="h-1.5 rounded-full" style={{
                            width: `${Math.min(100, (u.minutos_consumidos / u.minutos_limite) * 100)}%`,
                            background: u.minutos_consumidos >= u.minutos_limite ? '#EF4444' : '#2D4F9F'
                          }} />
                        </div>
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
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={7} className="py-10 text-center text-gray-400">No se encontraron usuarios</td></tr>
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

        {/* ═══ REPORTES ═══ */}
        {tab === 'reportes' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total usuarios', value: usuarios.length, icon: '👥', color: '#2D4F9F' },
                { label: 'Usuarios activos', value: usuarios.filter(u => u.activo).length, icon: '✅', color: '#22C55E' },
                { label: 'Canales activos', value: canales.filter(c => c.activo).length, icon: '📺', color: '#F08A2E' },
                { label: 'Bloqueados', value: usuarios.filter(u => u.minutos_consumidos >= u.minutos_limite).length, icon: '⏱️', color: '#EF4444' },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-3" style={{ background: s.color + '15' }}>{s.icon}</div>
                  <div className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-sm text-gray-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="font-bold text-base">Sesiones recientes (últimas 50)</div>
                <button onClick={loadSesiones} className="text-sm text-blue-500 hover:text-blue-700 transition">↻ Actualizar</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold">
                      <th className="text-left px-4 py-3">Usuario</th>
                      <th className="text-left px-4 py-3">Canal</th>
                      <th className="text-left px-4 py-3">Inicio</th>
                      <th className="text-left px-4 py-3">Fin</th>
                      <th className="text-left px-4 py-3">Min</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sesiones.map(s => (
                      <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                        <td className="px-4 py-4">
                          <div className="font-medium">{s.usuarios?.nombre || 'Sin nombre'}</div>
                          <div className="text-xs text-gray-400">{s.usuarios?.telefono}</div>
                        </td>
                        <td className="px-4 py-4 text-gray-600">{s.canal}</td>
                        <td className="px-4 py-4 text-xs text-gray-400">
                          {s.inicio ? new Date(s.inicio).toLocaleString('es-MX') : '—'}
                        </td>
                        <td className="px-4 py-4 text-xs">
                          {s.fin
                            ? <span className="text-gray-400">{new Date(s.fin).toLocaleString('es-MX')}</span>
                            : <span className="text-green-500 font-semibold">En vivo</span>}
                        </td>
                        <td className="px-4 py-4 text-gray-600">{s.minutos}</td>
                      </tr>
                    ))}
                    {sesiones.length === 0 && (
                      <tr><td colSpan={5} className="py-10 text-center text-gray-400">Sin sesiones registradas</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
