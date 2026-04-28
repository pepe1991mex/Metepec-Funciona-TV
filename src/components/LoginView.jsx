import { useState } from 'react'
import { supabase } from '../lib/supabase'

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
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #2D4F9F 0%, #5BC0C4 50%, #92D3F3 100%)', paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
        <div className="h-1 rounded-full mb-6 -mt-1"
          style={{ background: 'linear-gradient(90deg, #F5D623, #EF9FC5, #2D4F9F, #5BC0C4, #F08A2E, #9B6BAE, #ACCA14, #92D3F3)' }} />

        <img src="/logos/escudo.png" alt="Escudo Metepec" className="h-16 mx-auto mb-3 object-contain" />
        <h1 className="text-xl font-bold text-gray-800 mb-1">
          <span style={{ color: '#E9AF25' }}>Metepec</span> Funciona TV
        </h1>
        <p className="text-xs text-gray-400 mb-6 uppercase tracking-wider">Ciudad que Funciona • 2025-2027</p>

        <div className="text-left mb-1">
          <label className="text-sm text-gray-500">PIN de acceso</label>
        </div>

        <div className="flex justify-center gap-3 mb-5">
          {[0,1,2,3].map(i => (
            <div key={i}
              className="w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold"
              style={{
                borderColor: pin.length > i ? '#2D4F9F' : '#e5e7eb',
                background: pin.length > i ? '#2D4F9F08' : 'white',
                color: '#2D4F9F',
              }}>
              {pin[i] ? '•' : ''}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4 max-w-[240px] mx-auto">
          {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((n, i) => (
            n === '' ? <div key={i} /> :
            <button key={i}
              onClick={() => {
                if (n === '⌫') { setPin(p => p.slice(0, -1)) }
                else if (pin.length < 6) { setPin(p => p + n) }
                setError('')
              }}
              className="h-12 rounded-xl text-lg font-semibold transition active:scale-95"
              style={{
                background: n === '⌫' ? '#fee2e2' : '#f3f4f6',
                color: n === '⌫' ? '#dc2626' : '#374151',
              }}>
              {n}
            </button>
          ))}
        </div>

        {error && (
          <div className="text-red-500 text-xs mb-3 bg-red-50 p-2 rounded">{error}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || pin.length < 4}
          className="w-full py-3 rounded-lg text-white font-semibold text-sm transition disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #2D4F9F, #5BC0C4)' }}
        >
          {loading ? 'Verificando...' : 'Ingresar'}
        </button>

        <img src="/logos/metepec-ruta.jpg" alt="Estamos en la Ruta" className="h-8 mx-auto mt-4 object-contain opacity-40" />
        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ padding: '6px 16px', background: '#2A3240', borderRadius: '6px', display: 'inline-block' }}>
            <span style={{ color: '#FFFFFF', fontSize: '12px', fontWeight: '600', letterSpacing: '0.5px' }}>Powered by Shark Broadcast</span>
          </div>
        </div>
      </div>
    </div>
  )
}
