import { useRef, useEffect, useState } from 'react'
import Hls from 'hls.js'

export default function Player({ channel, url, onBack, getRandomVideo }) {
  const videoRef = useRef(null)
  const adVideoRef = useRef(null)
  const hlsRef = useRef(null)
  const containerRef = useRef(null)
  const streamActiveRef = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showingPreroll, setShowingPreroll] = useState(false)
  const [prerollVideo, setPrerollVideo] = useState(null)
  const [prerollSkippable, setPrerollSkippable] = useState(false)
  const [prerollCountdown, setPrerollCountdown] = useState(5)
  const [adBlocked, setAdBlocked] = useState(false)

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

  function startHLS() {
    const video = videoRef.current
    if (!video || !channel) return
    setError(false)
    setPlaying(false)
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    // Usa la URL tokenizada (prop url) si viene; si no, la URL directa del canal.
    // El query string (?token=...&expires=...) no afecta la detección/carga de HLS.
    const src = url || channel.url_hls
    if (!src) return
    streamActiveRef.current = true
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 30, maxMaxBufferLength: 60 })
      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
      })
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) { setError(true); hls.destroy() }
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      video.addEventListener('loadedmetadata', () => {
        video.play().then(() => setPlaying(true)).catch(() => {})
      })
    }
  }

  // Safari/iOS-safe preroll playback: start muted, unmute after 300ms
  function playPreroll() {
    const ad = adVideoRef.current
    if (!ad) return
    setAdBlocked(false)
    ad.muted = true
    ad.play().then(() => {
      setTimeout(() => { ad.muted = false }, 300)
    }).catch(() => {
      setAdBlocked(true)
    })
  }

  useEffect(() => {
    if (!channel) return
    streamActiveRef.current = false
    setError(false)
    setPlaying(false)
    setPrerollSkippable(false)
    setPrerollCountdown(5)
    setAdBlocked(false)
    // Destroy any existing HLS before showing preroll
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }

    const ad = getRandomVideo ? getRandomVideo(channel.id) : null
    if (ad) {
      setPrerollVideo(ad)
      setShowingPreroll(true)
    } else {
      setShowingPreroll(false)
      setPrerollVideo(null)
      setTimeout(() => startHLS(), 50)
    }

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    }
  }, [channel])

  // Recarga el stream cuando cambia la URL tokenizada (llega el token o se renueva),
  // pero solo si ya estamos reproduciendo el canal (no durante el preroll ni antes del 1er play).
  // Para canales abiertos url es constante por canal, así que esto nunca dispara recargas extra.
  useEffect(() => {
    if (!channel || showingPreroll) return
    if (!streamActiveRef.current) return
    startHLS()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  useEffect(() => {
    if (showingPreroll && adVideoRef.current) {
      playPreroll()
    }
  }, [showingPreroll])

  useEffect(() => {
    if (!showingPreroll) return
    setPrerollCountdown(5)
    setPrerollSkippable(false)
    const iv = setInterval(() => {
      setPrerollCountdown(c => {
        if (c <= 1) { setPrerollSkippable(true); clearInterval(iv); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [showingPreroll])

  function skipPreroll() {
    if (!prerollSkippable) return
    if (adVideoRef.current) { adVideoRef.current.pause(); adVideoRef.current.src = '' }
    setShowingPreroll(false)
    setPrerollVideo(null)
    setAdBlocked(false)
    setTimeout(() => {
      startHLS()
      if (videoRef.current) videoRef.current.play().catch(() => {})
    }, 200)
  }

  function onPrerollEnded() {
    setShowingPreroll(false)
    setPrerollVideo(null)
    setAdBlocked(false)
    setTimeout(() => {
      startHLS()
      if (videoRef.current) videoRef.current.play().catch(() => {})
    }, 200)
  }

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
          style={{ display: showingPreroll ? 'none' : 'block' }}
          playsInline
          autoPlay
          controls
        />

        {showingPreroll && prerollVideo && (
          <div className="absolute inset-0 bg-black z-20">
            <video
              ref={adVideoRef}
              className="w-full h-full object-contain"
              src={prerollVideo.video_url}
              playsInline
              webkit-playsinline="true"
              muted
              onEnded={onPrerollEnded}
            />

            {/* Fallback for Safari autoplay block */}
            {adBlocked && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-40">
                <button onClick={playPreroll}
                  className="bg-white text-gray-800 font-bold text-base px-8 py-4 rounded-2xl shadow-xl active:scale-95 transition">
                  ▶ Ver anuncio
                </button>
              </div>
            )}

            <div className="absolute top-3 left-3 bg-black/70 text-yellow-400 text-xs font-bold px-2.5 py-1 rounded z-30">
              PUBLICIDAD
            </div>
            <div className="absolute bottom-4 right-4 z-30">
              {prerollSkippable
                ? <button onClick={skipPreroll}
                    className="bg-white/90 text-gray-800 text-xs font-semibold px-4 py-2 rounded-lg hover:bg-white transition">
                    Saltar anuncio ›
                  </button>
                : <div className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-lg">
                    Saltar en {prerollCountdown}s
                  </div>
              }
            </div>
          </div>
        )}

        {!showingPreroll && (
          <button
            onClick={toggleFullscreen}
            className="absolute top-3 right-3 bg-black/60 text-white text-xs px-3 py-1 rounded-lg hover:bg-black/80 transition z-10"
          >
            {/iPad|iPhone|iPod/.test(navigator.userAgent) ? '⛶ Ampliar' : isFullscreen ? '⊡ Reducir' : '⛶ Ampliar'}
          </button>
        )}

        {!showingPreroll && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 px-3 py-1 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse-dot" />
            <span className="text-white text-xs font-bold tracking-wide">EN VIVO</span>
            <span className="text-white/70 text-xs ml-1">{channel.nombre}</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center text-white">
              <div className="text-4xl mb-2">⚠️</div>
              <p className="text-sm">Error al cargar el canal</p>
              <button onClick={() => { setError(false); startHLS() }}
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
