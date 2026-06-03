import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Lo que el usuario podrá ver — íconos en cuadritos de color rotando la paleta Metepec
const VALUE_PROPS = [
  { icon: '📺', text: 'Más de 60 canales en vivo', color: '#2D4F9F' },
  { icon: '📰', text: 'Noticias y servicios del municipio', color: '#5BC0C4' },
  { icon: '🎬', text: 'Películas y series', color: '#F08A2E' },
  { icon: '🎵', text: 'Música y entretenimiento', color: '#9B6BAE' },
  { icon: '⚽', text: 'Deportes en vivo', color: '#ACCA14' },
  { icon: '🎭', text: 'Cultura y contenido local de Metepec', color: '#EF9FC5' },
]

export default function LoginView({ onLogin }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (pin.length < 4) {
      setError('Ingresa tu PIN de acceso')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data, error: dbError } = await supabase
        .from('usuarios')
        .select('id, telefono, nombre, pin, minutos_consumidos, minutos_limite, activo, session_token, tipo_tiempo, ultimo_acceso')
        .eq('pin', pin)
        .single()

      if (dbError || !data) {
        setError('PIN no valido. Contacta al administrador.')
        setLoading(false)
        return
      }

      if (!data.activo) {
        setError('Tu cuenta esta desactivada.')
        setLoading(false)
        return
      }

      const tipoTiempo = data.tipo_tiempo || 'fijo'

      if (tipoTiempo !== 'ilimitado') {
        // Reset mensual si es nuevo mes
        if (tipoTiempo === 'mensual' && data.ultimo_acceso) {
          const last = new Date(data.ultimo_acceso)
          const now = new Date()
          if (last.getMonth() !== now.getMonth() || last.getFullYear() !== now.getFullYear()) {
            await supabase.from('usuarios').update({ minutos_consumidos: 0 }).eq('id', data.id)
            data.minutos_consumidos = 0
          }
        }
        if (data.minutos_consumidos >= data.minutos_limite) {
          setError('Has alcanzado tu limite de ' + data.minutos_limite + ' minutos.')
          setLoading(false)
          return
        }
      }

      const token = Math.random().toString(36).substring(2) + Date.now().toString(36)
      await supabase
        .from('usuarios')
        .update({ session_token: token, ultimo_acceso: new Date().toISOString() })
        .eq('id', data.id)

      onLogin({ ...data, tipo_tiempo: tipoTiempo, session_token: token })
    } catch (err) {
      setError('Error de conexion. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #2D4F9F 0%, #3A6BB0 35%, #5BC0C4 78%, #92D3F3 100%)',
        paddingTop: 'max(env(safe-area-inset-top), 2rem)',
      }}>

      {/* Blobs decorativos (paleta arcoíris, blur, baja opacidad) */}
      <div className="absolute pointer-events-none rounded-full" style={{ top: '-90px', left: '-80px', width: '300px', height: '300px', background: '#F5D623', opacity: 0.18, filter: 'blur(70px)' }} />
      <div className="absolute pointer-events-none rounded-full" style={{ top: '30%', right: '-70px', width: '340px', height: '340px', background: '#EF9FC5', opacity: 0.20, filter: 'blur(85px)' }} />
      <div className="absolute pointer-events-none rounded-full" style={{ bottom: '-110px', left: '20%', width: '380px', height: '380px', background: '#92D3F3', opacity: 0.22, filter: 'blur(90px)' }} />
      <div className="absolute pointer-events-none rounded-full" style={{ top: '8%', right: '28%', width: '220px', height: '220px', background: '#ACCA14', opacity: 0.14, filter: 'blur(65px)' }} />
      <div className="absolute pointer-events-none rounded-full" style={{ bottom: '15%', right: '12%', width: '200px', height: '200px', background: '#F08A2E', opacity: 0.14, filter: 'blur(60px)' }} />

      {/* Tarjeta */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden">
        {/* Línea arcoíris */}
        <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #F5D623, #EF9FC5, #2D4F9F, #5BC0C4, #F08A2E, #9B6BAE, #ACCA14, #92D3F3)' }} />

        <div className="flex flex-col md:flex-row">

          {/* ─── BIENVENIDA (izquierda / arriba en móvil) ─── */}
          <div className="md:w-1/2 p-7 sm:p-9" style={{ background: 'linear-gradient(160deg, #F4F8FD 0%, #EAF4F6 100%)' }}>
            <img src="/logos/metepec-ruta.png" alt="Estamos en la Ruta" className="h-11 sm:h-12 object-contain mb-5" />

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight mb-2" style={{ color: '#2D4F9F' }}>
              Bienvenido a tu <span style={{ color: '#F08A2E' }}>televisión municipal</span>
            </h1>
            <p className="text-sm leading-relaxed mb-6" style={{ color: '#8D96A5' }}>
              Disfruta todo el contenido de Metepec en un solo lugar.
            </p>

            <div className="flex flex-col gap-2.5">
              {VALUE_PROPS.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: p.color + '1A', border: `1px solid ${p.color}26` }}>
                    {p.icon}
                  </div>
                  <span className="text-sm font-medium" style={{ color: '#2A3240' }}>{p.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── PIN (derecha / abajo en móvil) ─── */}
          <div className="md:w-1/2 p-7 sm:p-9 flex flex-col items-center text-center">
            <img src="/logos/escudo.png" alt="Escudo Metepec" className="h-16 object-contain mb-3" />
            <h2 className="text-xl font-black tracking-tight mb-1">
              <span style={{ color: '#E9AF25' }}>Metepec</span>{' '}
              <span style={{ color: '#2D4F9F' }}>Funciona TV</span>
            </h2>
            <p className="text-2xs mb-6 uppercase tracking-widest" style={{ color: '#B0B8C5' }}>
              Ciudad que Funciona • 2025-2027
            </p>

            <label className="text-sm font-semibold self-start" style={{ color: '#5A6577' }}>Ingresa tu PIN de acceso</label>

            <div className="flex justify-center gap-3 mb-5 mt-3">
              {[0,1,2,3].map(i => (
                <div key={i}
                  className="w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold transition"
                  style={{
                    borderColor: pin.length > i ? '#2D4F9F' : '#e5e7eb',
                    background: pin.length > i ? '#2D4F9F0D' : 'white',
                    color: '#2D4F9F',
                  }}>
                  {pin[i] ? '•' : ''}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2.5 mb-4 w-full max-w-[260px] mx-auto">
              {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((n, i) => (
                n === '' ? <div key={i} /> :
                <button key={i}
                  onClick={() => {
                    if (n === '⌫') { setPin(p => p.slice(0, -1)) }
                    else if (pin.length < 6) { setPin(p => p + n) }
                    setError('')
                  }}
                  className="h-14 rounded-2xl text-lg font-bold transition active:scale-95"
                  style={{
                    background: n === '⌫' ? '#fee2e2' : '#F1F4F9',
                    color: n === '⌫' ? '#dc2626' : '#2A3240',
                  }}>
                  {n}
                </button>
              ))}
            </div>

            {error && (
              <div className="text-red-500 text-xs mb-3 bg-red-50 p-2 rounded-lg w-full max-w-[260px] mx-auto">{error}</div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || pin.length < 4}
              className="w-full max-w-[260px] mx-auto py-3 rounded-2xl text-white font-bold text-sm transition disabled:opacity-50 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #2D4F9F, #5BC0C4)' }}
            >
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </div>
        </div>

        {/* Powered by Shark Broadcast — muy discreto */}
        <div className="text-center pb-3 pt-1">
          <span style={{ fontSize: '9px', color: '#C2C9D4', fontWeight: 400, letterSpacing: '0.3px' }}>Powered by Shark Broadcast</span>
        </div>
      </div>
    </div>
  )
}
