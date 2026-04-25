import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Fallback banners when Supabase has none
const FALLBACK = [
  { id: 'fb-1', titulo: 'Publicidad Municipal', imagen_url: '/banners/ejemplo-hero.jpg', enlace: '', posicion: 'hero', orden: 1, activo: true },
  { id: 'fb-2', titulo: 'Servicios', imagen_url: '/banners/ejemplo-intermedio.jpg', enlace: '', posicion: 'intermedio', orden: 1, activo: true },
  { id: 'fb-3', titulo: 'Anuncio', imagen_url: '/banners/ejemplo-player.jpg', enlace: '', posicion: 'player', orden: 1, activo: true },
]

export function useBanners() {
  const [banners, setBanners] = useState([])

  useEffect(() => { loadBanners() }, [])

  async function loadBanners() {
    try {
      const { data, error } = await supabase
        .from('banners')
        .select('id, titulo, imagen_url, enlace, posicion, orden, activo')
        .eq('activo', true)
        .order('orden', { ascending: true })

      if (error) throw error
      setBanners(data && data.length > 0 ? data : FALLBACK)
    } catch {
      setBanners(FALLBACK)
    }
  }

  const hero = banners.filter(b => b.posicion === 'hero')
  const intermedio = banners.filter(b => b.posicion === 'intermedio')
  const player = banners.filter(b => b.posicion === 'player')

  return { banners, hero, intermedio, player, reload: loadBanners }
}
