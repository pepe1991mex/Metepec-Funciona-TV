import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function BannerCarousel({ banners, height = 'auto', className = '' }) {
  const [current, setCurrent] = useState(0)
  // IDs de banners cuya impresión ya se contó en esta sesión de vista (evita duplicados por render)
  const viewedRef = useRef(new Set())

  useEffect(() => {
    if (banners.length <= 1) return
    const iv = setInterval(() => {
      setCurrent(prev => (prev + 1) % banners.length)
    }, 5000)
    return () => clearInterval(iv)
  }, [banners.length])

  // Métrica: registrar impresión del banner visible (una vez por banner por sesión de vista)
  const currentBannerId = (banners && banners.length > 0 && banners[current]) ? banners[current].id : null
  useEffect(() => {
    if (!currentBannerId) return
    if (viewedRef.current.has(currentBannerId)) return
    viewedRef.current.add(currentBannerId)
    supabase.rpc('registrar_vista_banner', { p_banner_id: currentBannerId }).then(() => {}).catch(() => {})
  }, [currentBannerId])

  if (!banners || banners.length === 0) return null

  const banner = banners[current]

  // Métrica: registrar clic del banner (fire-and-forget, antes de abrir el enlace)
  function handleBannerClick() {
    if (banner.id) {
      supabase.rpc('registrar_click_banner', { p_banner_id: banner.id }).then(() => {}).catch(() => {})
    }
  }

  const content = (
    <div className={`relative overflow-hidden rounded-xl ${className}`}
      style={{ height }}>
      <img
        src={banner.imagen_url}
        alt={banner.titulo || 'Banner'}
        className="w-full h-full object-cover transition-opacity duration-500"
        style={{ opacity: 1 }}
      />

      {/* Dots indicator */}
      {banners.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {banners.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className="w-2 h-2 rounded-full transition-all"
              style={{
                background: i === current ? 'white' : 'rgba(255,255,255,0.4)',
                transform: i === current ? 'scale(1.3)' : 'scale(1)',
              }} />
          ))}
        </div>
      )}

      {/* Subtle overlay for text readability */}
      {banner.titulo && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/30 to-transparent p-3">
          <span className="text-white text-xs font-medium opacity-80">{banner.titulo}</span>
        </div>
      )}
    </div>
  )

  if (banner.enlace) {
    return (
      <a href={banner.enlace} target="_blank" rel="noopener noreferrer" className="block" onClick={handleBannerClick}>
        {content}
      </a>
    )
  }

  return content
}
