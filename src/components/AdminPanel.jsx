import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ADMIN_PW = import.meta.env.VITE_ADMIN_PASSWORD || 'metepec2026'

export default function AdminPanel() {
  const [auth, setAuth] = useState(false)
  const [pw, setPw] = useState('')
  const [tab, setTab] = useState('usuarios')
  const [usuarios, setUsuarios] = useState([])
  const [canales, setCanales] = useState([])
  const [adding, setAdding] = useState(false)
  const [addingUser, setAddingUser] = useState(false)
  const [newCh, setNewCh] = useState({ nombre: '', slug: '', url_hls: '', logo_url: '', categoria: 'Municipal', orden: 0 })
  const [banners, setBanners] = useState([])
  const [addingBanner, setAddingBanner] = useState(false)
  const [newBanner, setNewBanner] = useState({ titulo: '', imagen_url: '', enlace: '', posicion: 'hero', orden: 0 })
  const [newPhone, setNewPhone] = useState('')
  const [newName, setNewName] = useState('')
  const [newPin, setNewPin] = useState('')

  useEffect(() => { if (auth) { loadUsuarios(); loadCanales(); loadBanners() } }, [auth])
  useEffect(() => {
    if (!auth) return
    const iv = setInterval(() => { loadUsuarios() }, 30000)
    return () => clearInterval(iv)
  }, [auth])

  async function loadUsuarios() {
    const { data } = await supabase
      .from('usuarios')
      .select('id, telefono, nombre, pin, minutos_consumidos, minutos_limite, activo, ultimo_acceso')
      .order('created_at', { ascending: false })
    if (data) setUsuarios(data)
  }

  async function loadCanales() {
    const { data } = await supabase
      .from('canales')
      .select('id, nombre, slug, url_hls, logo_url, categoria, orden, activo')
      .order('orden', { ascending: true })
    if (data) setCanales(data)
  }

  async function loadBanners() {
    const { data } = await supabase
      .from('banners')
      .select('id, titulo, imagen_url, enlace, posicion, orden, activo')
      .order('orden', { ascending: true })
    if (data) setBanners(data)
  }

  async function toggleBanner(id, activo) {
    await supabase.from('banners').update({ activo: !activo }).eq('id', id)
    loadBanners()
  }

  async function deleteBanner(id) {
    await supabase.from('banners').delete().eq('id', id)
    loadBanners()
  }

  async function addBanner() {
    if (!newBanner.titulo || !newBanner.imagen_url) return
    await supabase.from('banners').insert({ ...newBanner, activo: true })
    setNewBanner({ titulo: '', imagen_url: '', enlace: '', posicion: 'hero', orden: 0 })
    setAddingBanner(false); loadBanners()
  }

  async function toggleUsuario(id, activo) {
    await supabase.from('usuarios').update({ activo: !activo }).eq('id', id)
    loadUsuarios()
  }

  async function resetMinutos(id) {
    await supabase.from('usuarios').update({ minutos_consumidos: 0 }).eq('id', id)
    loadUsuarios()
  }

  async function addUsuario() {
    if (newPhone.length !== 10) return
    const tel = '+52' + newPhone
    const pin = newPin || String(Math.floor(1000 + Math.random() * 9000))
    await supabase.from('usuarios').insert({ telefono: tel, nombre: newName || null, pin: pin, minutos_limite: 1800, activo: true })
    setNewPhone(''); setNewName(''); setNewPin(''); setAddingUser(false); loadUsuarios()
  }

  async function toggleCanal(id, activo) {
    await supabase.from('canales').update({ activo: !activo }).eq('id', id)
    loadCanales()
  }

  async function deleteCanal(id) {
    await supabase.from('canales').delete().eq('id', id)
    loadCanales()
  }

  async function addCanal() {
    if (!newCh.nombre || !newCh.url_hls || !newCh.slug) return
    await supabase.from('canales').insert({ ...newCh, activo: true })
    setNewCh({ nombre: '', slug: '', url_hls: '', logo_url: '', categoria: 'Municipal', orden: 0 })
    setAdding(false); loadCanales()
  }

  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 mb-2"

  if (!auth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
          <img src="/logos/escudo.png" alt="Escudo" className="h-16 mx-auto mb-3 object-contain" />
          <h2 className="text-lg font-bold text-gray-800 mb-1">Panel Administrativo</h2>
          <p className="text-xs text-gray-400 mb-6">Metepec Funciona TV</p>
          <input type="password" placeholder="Contraseña" value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && pw === ADMIN_PW && setAuth(true)}
            className={inp + ' mb-4'} />
          <button onClick={() => pw === ADMIN_PW && setAuth(true)}
            className="w-full py-2.5 rounded-lg text-white font-semibold text-sm"
            style={{ background: '#2D4F9F' }}>
            Ingresar
          </button>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'usuarios', label: 'Usuarios', icon: '👥' },
    { id: 'canales', label: 'Canales', icon: '📺' },
    { id: 'publicidad', label: 'Publicidad', icon: '📢' },
    { id: 'reportes', label: 'Reportes', icon: '📊' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logos/escudo.png" alt="Escudo" className="h-8 object-contain" />
          <div>
            <div className="font-bold text-sm text-gray-800">Admin — Metepec Funciona TV</div>
            <div className="text-[10px] text-gray-400">Panel de administración</div>
          </div>
        </div>
        <a href="/" className="text-xs text-gray-400 hover:text-gray-600">← Volver a la app</a>
      </div>

      <div className="bg-white border-b border-gray-100 px-4 py-2 flex gap-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-1.5 rounded-lg text-xs font-medium transition"
            style={{
              background: tab === t.id ? '#2D4F9F' : 'transparent',
              color: tab === t.id ? 'white' : '#999'
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* USUARIOS */}
        {tab === 'usuarios' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">Usuarios ({usuarios.length})</h3>
              <button onClick={() => setAddingUser(!addingUser)}
                className="px-4 py-1.5 rounded-lg text-white text-xs font-semibold"
                style={{ background: '#2D4F9F' }}>
                {addingUser ? '✕ Cancelar' : '+ Agregar'}
              </button>
            </div>

            {addingUser && (
              <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 shadow-sm">
                <div className="text-sm font-semibold text-gray-700 mb-3">Nuevo Usuario</div>
                <input placeholder="Nombre (opcional)" value={newName}
                  onChange={e => setNewName(e.target.value)} className={inp} />
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden mb-2">
                  <span className="bg-gray-50 px-3 py-2 text-sm text-gray-400 border-r">+52</span>
                  <input placeholder="10 digitos" value={newPhone} maxLength={10}
                    onChange={e => setNewPhone(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 px-3 py-2 text-sm outline-none" />
                </div>
                <input placeholder="PIN (4 digitos, auto si vacio)" value={newPin} maxLength={6}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className={inp} />
                <button onClick={addUsuario}
                  className="w-full py-2 rounded-lg text-white text-sm font-semibold bg-green-500">
                  Guardar Usuario
                </button>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              {usuarios.map((u, i) => (
                <div key={u.id} className="px-4 py-3 flex items-center justify-between text-sm"
                  style={{ borderBottom: i < usuarios.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <div>
                    <div className="font-medium text-gray-800">{u.nombre || 'Sin nombre'}</div>
                    <div className="text-xs text-gray-400">{u.telefono} • PIN: <span className="font-mono font-bold" style={{color:'#2D4F9F'}}>{u.pin || '—'}</span> • {u.minutos_consumidos}/{u.minutos_limite} min</div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button onClick={() => resetMinutos(u.id)}
                      className="px-2 py-1 rounded text-[10px] bg-blue-50 text-blue-500 font-medium">
                      Reset
                    </button>
                    <button onClick={() => toggleUsuario(u.id, u.activo)}
                      className="px-2 py-1 rounded text-[10px] font-semibold"
                      style={{
                        background: u.activo ? '#dcfce7' : '#fee2e2',
                        color: u.activo ? '#16a34a' : '#dc2626'
                      }}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </div>
                </div>
              ))}
              {usuarios.length === 0 && (
                <div className="py-8 text-center text-gray-400 text-sm">No hay usuarios registrados</div>
              )}
            </div>
          </div>
        )}

        {/* CANALES */}
        {tab === 'canales' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">Canales ({canales.length})</h3>
              <button onClick={() => setAdding(!adding)}
                className="px-4 py-1.5 rounded-lg text-white text-xs font-semibold"
                style={{ background: '#2D4F9F' }}>
                {adding ? '✕ Cancelar' : '+ Agregar Canal'}
              </button>
            </div>

            {adding && (
              <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 shadow-sm">
                <div className="text-sm font-semibold text-gray-700 mb-3">Nuevo Canal</div>
                <input placeholder="Nombre del canal" value={newCh.nombre}
                  onChange={e => setNewCh(p => ({ ...p, nombre: e.target.value }))} className={inp} />
                <input placeholder="Slug (ej: mi-canal)" value={newCh.slug}
                  onChange={e => setNewCh(p => ({ ...p, slug: e.target.value }))} className={inp} />
                <input placeholder="URL HLS (m3u8)" value={newCh.url_hls}
                  onChange={e => setNewCh(p => ({ ...p, url_hls: e.target.value }))} className={inp} />
                <input placeholder="URL Logo (opcional)" value={newCh.logo_url}
                  onChange={e => setNewCh(p => ({ ...p, logo_url: e.target.value }))} className={inp} />
                <input placeholder="Categoría" value={newCh.categoria}
                  onChange={e => setNewCh(p => ({ ...p, categoria: e.target.value }))} className={inp} />
                <input placeholder="Orden (número)" type="number" value={newCh.orden}
                  onChange={e => setNewCh(p => ({ ...p, orden: parseInt(e.target.value) || 0 }))} className={inp} />
                <button onClick={addCanal}
                  className="w-full py-2 rounded-lg text-white text-sm font-semibold bg-green-500">
                  Guardar Canal
                </button>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              {canales.map((ch, i) => (
                <div key={ch.id} className="px-4 py-3 flex items-center justify-between text-sm"
                  style={{ borderBottom: i < canales.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{ch.logo_url ? '🔗' : '📺'}</span>
                    <div>
                      <div className="font-medium text-gray-800">{ch.nombre}</div>
                      <div className="text-xs text-gray-400">{ch.slug} • {ch.categoria} • Orden: {ch.orden}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button onClick={() => toggleCanal(ch.id, ch.activo)}
                      className="px-2 py-1 rounded text-[10px] font-semibold"
                      style={{
                        background: ch.activo ? '#dcfce7' : '#fee2e2',
                        color: ch.activo ? '#16a34a' : '#dc2626'
                      }}>
                      {ch.activo ? 'Activo' : 'Inactivo'}
                    </button>
                    <button onClick={() => deleteCanal(ch.id)}
                      className="px-2 py-1 rounded text-[10px] border border-gray-200 text-gray-400">
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
              {canales.length === 0 && (
                <div className="py-8 text-center text-gray-400 text-sm">No hay canales</div>
              )}
            </div>
          </div>
        )}

        {/* PUBLICIDAD / BANNERS */}
        {tab === 'publicidad' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">Banners ({banners.length})</h3>
              <button onClick={() => setAddingBanner(!addingBanner)}
                className="px-4 py-1.5 rounded-lg text-white text-xs font-semibold"
                style={{ background: '#2D4F9F' }}>
                {addingBanner ? '✕ Cancelar' : '+ Agregar Banner'}
              </button>
            </div>

            {/* Position guide */}
            <div className="bg-blue-50 rounded-xl p-4 mb-4 text-xs text-blue-700 leading-relaxed">
              <div className="font-semibold mb-2">📐 Posiciones de banners:</div>
              <div className="space-y-1">
                <div><span className="font-mono bg-blue-100 px-1.5 py-0.5 rounded">hero</span> — Banner principal arriba (1200x300px recomendado)</div>
                <div><span className="font-mono bg-blue-100 px-1.5 py-0.5 rounded">intermedio</span> — Entre filas de canales (600x200px recomendado)</div>
                <div><span className="font-mono bg-blue-100 px-1.5 py-0.5 rounded">player</span> — Debajo del reproductor (728x90px recomendado)</div>
              </div>
              <div className="mt-2 text-blue-500">Las imagenes se suben a <span className="font-mono">public/banners/</span> o usa URLs externas.</div>
            </div>

            {addingBanner && (
              <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 shadow-sm">
                <div className="text-sm font-semibold text-gray-700 mb-3">Nuevo Banner</div>
                <input placeholder="Titulo del banner" value={newBanner.titulo}
                  onChange={e => setNewBanner(p => ({ ...p, titulo: e.target.value }))} className={inp} />
                <input placeholder="URL de imagen (ej: /banners/mi-banner.jpg)" value={newBanner.imagen_url}
                  onChange={e => setNewBanner(p => ({ ...p, imagen_url: e.target.value }))} className={inp} />
                <input placeholder="Enlace al dar clic (opcional)" value={newBanner.enlace}
                  onChange={e => setNewBanner(p => ({ ...p, enlace: e.target.value }))} className={inp} />
                <select value={newBanner.posicion}
                  onChange={e => setNewBanner(p => ({ ...p, posicion: e.target.value }))}
                  className={inp}>
                  <option value="hero">Hero (arriba, grande)</option>
                  <option value="intermedio">Intermedio (entre canales)</option>
                  <option value="player">Player (debajo del reproductor)</option>
                </select>
                <input placeholder="Orden (numero)" type="number" value={newBanner.orden}
                  onChange={e => setNewBanner(p => ({ ...p, orden: parseInt(e.target.value) || 0 }))} className={inp} />
                <button onClick={addBanner}
                  className="w-full py-2 rounded-lg text-white text-sm font-semibold bg-green-500">
                  Guardar Banner
                </button>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              {banners.map((b, i) => (
                <div key={b.id} className="px-4 py-3 flex items-center justify-between text-sm"
                  style={{ borderBottom: i < banners.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <div className="flex items-center gap-3">
                    <img src={b.imagen_url} alt="" className="w-16 h-10 object-cover rounded border border-gray-100" />
                    <div>
                      <div className="font-medium text-gray-800">{b.titulo}</div>
                      <div className="text-xs text-gray-400">
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{b.posicion}</span>
                        {' '}• Orden: {b.orden}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button onClick={() => toggleBanner(b.id, b.activo)}
                      className="px-2 py-1 rounded text-[10px] font-semibold"
                      style={{
                        background: b.activo ? '#dcfce7' : '#fee2e2',
                        color: b.activo ? '#16a34a' : '#dc2626'
                      }}>
                      {b.activo ? 'Activo' : 'Inactivo'}
                    </button>
                    <button onClick={() => deleteBanner(b.id)}
                      className="px-2 py-1 rounded text-[10px] border border-gray-200 text-gray-400">
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
              {banners.length === 0 && (
                <div className="py-8 text-center text-gray-400 text-sm">No hay banners. Agrega uno.</div>
              )}
            </div>
          </div>
        )}

        {/* REPORTES */}
        {tab === 'reportes' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Usuarios', value: usuarios.length, icon: '👥', color: '#2D4F9F' },
              { label: 'Activos', value: usuarios.filter(u => u.activo).length, icon: '✅', color: '#22C55E' },
              { label: 'Canales', value: canales.filter(c => c.activo).length, icon: '📺', color: '#F08A2E' },
              { label: 'Bloqueados', value: usuarios.filter(u => u.minutos_consumidos >= u.minutos_limite).length, icon: '⏱️', color: '#E2646B' },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg mb-2"
                  style={{ background: s.color + '12' }}>{s.icon}</div>
                <div className="text-2xl font-bold text-gray-800">{s.value}</div>
                <div className="text-xs text-gray-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
