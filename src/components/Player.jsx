import { useRef, useEffect, useState } from 'react'
import Hls from 'hls.js'

export default function Player({ channel, onBack }) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const containerRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFSChange)
    document.addEventListener('webkitfullscreenchange', handleFSChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFSChange)
      document.removeEventListener('webkitfullscreenchange', handleFSChange)
    }
  }, [])

  function toggleFullscreen() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (isIOS) {
      const video = videoRef.current
      if (video && video.webkitEnterFullscreen) video.webkitEnterFullscreen()
      return
    }
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (el.requestFullscreen) el.requestFullscreen()
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
    } else {
      if (document.exitFullscreen) document.exitFullscreen()
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen()
    }
  }

  useEffect(() => {
    if (!channel || !videoRef.current) return

    const video = videoRef.current
    setError(false)
    setPlaying(false)

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const url = channel.url_hls

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      })
      hlsRef.current = hls
      hls.loadSource(url)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
      })
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('HLS fatal error:', data)
          setError(true)
          hls.destroy()
        }
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url
      video.addEventListener('loadedmetadata', () => {
        video.play().then(() => setPlaying(true)).catch(() => {})
      })
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [channel])

  if (!channel) return null

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={onBack}
          className="bg-white border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition">
          ← Volver
        </button>
        <span className="text-gray-400 text-sm">{channel.nombre}</span>
      </div>

      <div
        ref={containerRef}
        className="relative bg-black rounded-2xl overflow-hidden shadow-lg"
        style={{ aspectRatio: isFullscreen ? undefined : '16/9', height: isFullscreen ? '100vh' : undefined }}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
          autoPlay
          controls
        />

        {/* Fullscreen toggle */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-3 right-3 bg-black/60 text-white text-xs px-3 py-1 rounded-lg hover:bg-black/80 transition z-10"
        >
          {/iPad|iPhone|iPod/.test(navigator.userAgent) ? '⛶ Ampliar' : isFullscreen ? '⊡ Reducir' : '⛶ Ampliar'}
        </button>

        {/* Live badge */}
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 px-3 py-1 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse-dot" />
          <span className="text-white text-xs font-bold tracking-wide">EN VIVO</span>
          <span className="text-white/70 text-xs ml-1">{channel.nombre}</span>
        </div>

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center text-white">
              <div className="text-4xl mb-2">⚠️</div>
              <p className="text-sm">Error al cargar el canal</p>
              <button onClick={() => { setError(false); if (hlsRef.current) hlsRef.current.destroy() }}
                className="mt-3 px-4 py-1.5 bg-white/20 rounded text-xs">
                Reintentar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
