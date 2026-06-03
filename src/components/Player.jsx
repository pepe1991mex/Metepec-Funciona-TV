import { useRef, useEffect, useState } from 'react'
import Hls from 'hls.js'

// ─────────────────────────────────────────────────────────────────────────────
// Player de Metepec Funciona TV
// Motor de reproducción portado de BAIT TV (robusto: recuperación de red, stall
// detection, hlsConfig completo, HLS nativo iOS con reintento), CONSERVANDO:
//   - el preroll de Metepec (usePreroll vía prop getRandomVideo, video por canal)
//   - la tokenización VPS (prop url tokenizada como fuente del HLS)
//   - la prop onBack y los colores municipales (navy/dorado; badge EN VIVO rojo)
// El tracking de minutos lo hace HomeView (incrementar_segundos), no este Player.
// ─────────────────────────────────────────────────────────────────────────────
export default function Player({ channel, url, onBack, getRandomVideo }) {
  const videoRef = useRef(null)
  const adVideoRef = useRef(null)
  const hlsRef = useRef(null)
  const containerRef = useRef(null)
  const streamActiveRef = useRef(false)
  const streamCleanupRef = useRef(null)
  const startTimerRef = useRef(null)
  const controlsTimer = useRef(null)

  // Estado del motor / controles (estilo BAIT)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)

  // Estado del preroll (Metepec)
  const [showingPreroll, setShowingPreroll] = useState(false)
  const [prerollVideo, setPrerollVideo] = useState(null)
  const [prerollSkippable, setPrerollSkippable] = useState(false)
  const [prerollCountdown, setPrerollCountdown] = useState(5)
  const [adBlocked, setAdBlocked] = useState(false)

  // ── Detección de plataforma (portado verbatim de BAIT TV) ──
  var ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
  var isNativeHLS = (typeof document !== 'undefined') &&
    document.createElement('video').canPlayType('application/vnd.apple.mpegurl') !== ''
  var isWebView = /wv/.test(ua) ||
    (/Android/.test(ua) && /Version\/\d/.test(ua)) ||
    (typeof Android !== 'undefined')
  var isSlowConnection = (typeof navigator !== 'undefined' &&
    navigator.connection &&
    navigator.connection.effectiveType &&
    (navigator.connection.effectiveType === '2g' ||
     navigator.connection.effectiveType === 'slow-2g' ||
     navigator.connection.effectiveType === '3g'))

  // Destruye limpiamente el stream activo (listeners, intervalos de stall, hls)
  function cleanupStream() {
    if (streamCleanupRef.current) {
      try { streamCleanupRef.current() } catch (e) {}
      streamCleanupRef.current = null
    }
    if (hlsRef.current) {
      try { hlsRef.current.destroy() } catch (e) {}
      hlsRef.current = null
    }
  }

  // ── Motor de reproducción (portado de BAIT TV) ──
  // Fuente: la URL tokenizada (prop url) si viene, si no la del canal directo.
  function initStream() {
    setError('')
    var video = videoRef.current
    var src = url || (channel && channel.url_hls)
    if (!video || !src) return
    setIsLoading(true)

    cleanupStream()
    streamActiveRef.current = true

    // ── RUTA A: iOS Safari — HLS nativo (igual que Roku), con reintento a los 15s ──
    if (isNativeHLS && (typeof Hls === 'undefined' || !Hls.isSupported())) {
      video.src = src
      video.load()

      var onMeta = function () {
        video.removeEventListener('loadedmetadata', onMeta)
        setIsLoading(false)
        var p = video.play()
        if (p && p.catch) p.catch(function () {})
      }
      var onErr = function () {
        video.removeEventListener('error', onErr)
        setError('Error al cargar el canal')
        setIsLoading(false)
      }
      video.addEventListener('loadedmetadata', onMeta)
      video.addEventListener('error', onErr)

      var nativeRetry = setTimeout(function () {
        if (video.readyState < 2) {
          video.src = src
          video.load()
          var p2 = video.play()
          if (p2 && p2.catch) p2.catch(function () {})
        }
      }, 15000)

      streamCleanupRef.current = function () {
        clearTimeout(nativeRetry)
        video.removeEventListener('loadedmetadata', onMeta)
        video.removeEventListener('error', onErr)
      }
      return
    }

    // ── RUTAS B y C: HLS.js ──
    if (typeof Hls === 'undefined' || !Hls.isSupported()) {
      video.src = src
      video.load()
      var p3 = video.play()
      if (p3 && p3.catch) p3.catch(function () {
        setError('Tu dispositivo no soporta este formato de video')
      })
      setIsLoading(false)
      return
    }

    var hlsConfig = {
      enableWorker: true,
      lowLatencyMode: false,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      maxBufferSize: 30 * 1000 * 1000,
      maxBufferHole: 0.5,
      backBufferLength: 15,
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 8,
      liveDurationInfinity: true,
      levelLoadingTimeOut: 15000,
      manifestLoadingTimeOut: 15000,
      fragLoadingTimeOut: 25000,
      manifestLoadingMaxRetry: 6,
      fragLoadingMaxRetry: 6,
      fragLoadingRetryDelay: 1000,
      levelLoadingMaxRetry: 6,
      highBufferWatchdogPeriod: 3,
      nudgeOffset: 0.1,
      nudgeMaxRetry: 5,
      maxFragLookUpTolerance: 0.25,
      startLevel: -1,
      abrEwmaDefaultEstimate: 800000,
      abrBandWidthUpFactor: 0.7,
      abrBandWidthFactor: 0.95,
      testBandwidth: true,
    }

    if (isSlowConnection) {
      hlsConfig.maxBufferLength = 20
      hlsConfig.maxMaxBufferLength = 40
      hlsConfig.liveSyncDurationCount = 3
    }

    var hls = new Hls(hlsConfig)
    hls.loadSource(src)
    hls.attachMedia(video)

    hls.on(Hls.Events.MANIFEST_PARSED, function () {
      setIsLoading(false)
      var playPromise = video.play()
      if (playPromise && playPromise.catch) {
        playPromise.catch(function () {})
      }
    })

    // setIsLoading(false) se activa SOLO cuando el video realmente empieza a reproducir
    var hasStartedPlaying = false
    var onPlaying = function () {
      video.removeEventListener('playing', onPlaying)
      hasStartedPlaying = true
      setIsLoading(false)
    }
    video.addEventListener('playing', onPlaying)

    hls.on(Hls.Events.ERROR, function (event, data) {
      if (!data.fatal) return
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        setTimeout(function () { if (hlsRef.current) hlsRef.current.startLoad() }, 2000)
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError()
      } else {
        hls.destroy()
        setTimeout(function () {
          var newHls = new Hls(hlsConfig)
          hlsRef.current = newHls
          newHls.loadSource(src)
          newHls.attachMedia(video)
        }, 3000)
      }
    })

    // Stall detection: solo corre después de que el video haya empezado a reproducir.
    // Tras 15 stalls salta al final del buffer y reanuda la carga.
    var lastPlayPos = 0
    var stallCount = 0
    var stallCheckInterval = setInterval(function () {
      if (!hasStartedPlaying) return
      if (!video || video.paused || video.ended) return
      var currentPos = video.currentTime
      if (currentPos === lastPlayPos && !video.paused) {
        stallCount++
        if (stallCount >= 15) {
          stallCount = 0
          try {
            if (video.buffered && video.buffered.length > 0) {
              var bufferedEnd = video.buffered.end(video.buffered.length - 1)
              if (bufferedEnd > currentPos + 1) {
                video.currentTime = bufferedEnd - 0.5
              }
            }
          } catch (e) {}
          if (hlsRef.current) hlsRef.current.startLoad()
        }
      } else {
        stallCount = 0
      }
      lastPlayPos = currentPos
    }, 1000)

    hlsRef.current = hls

    streamCleanupRef.current = function () {
      video.removeEventListener('playing', onPlaying)
      clearInterval(stallCheckInterval)
    }
  }

  // ── Preroll de Metepec (autoplay Safari/iOS-safe: arranca mudo, desmutea a los 300ms) ──
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

  // Decisión de preroll + reset al cambiar de canal (preroll por-canal vía getRandomVideo)
  useEffect(() => {
    if (!channel) return
    streamActiveRef.current = false
    setError('')
    setIsLoading(true)
    setIsPlaying(false)
    setPrerollSkippable(false)
    setPrerollCountdown(5)
    setAdBlocked(false)
    cleanupStream()
    if (startTimerRef.current) { clearTimeout(startTimerRef.current); startTimerRef.current = null }

    const ad = getRandomVideo ? getRandomVideo(channel.id) : null
    if (ad) {
      setPrerollVideo(ad)
      setShowingPreroll(true)
    } else {
      setShowingPreroll(false)
      setPrerollVideo(null)
      startTimerRef.current = setTimeout(() => initStream(), 50)
    }

    return () => {
      if (startTimerRef.current) { clearTimeout(startTimerRef.current); startTimerRef.current = null }
      cleanupStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel])

  // Recarga el stream cuando cambia la URL tokenizada (llega/renueva el token),
  // solo si ya estamos reproduciendo (no durante el preroll ni antes del 1er play).
  // Para canales abiertos url es constante por canal, así que no dispara recargas extra.
  useEffect(() => {
    if (!channel || showingPreroll) return
    if (!streamActiveRef.current) return
    initStream()
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
    startTimerRef.current = setTimeout(() => initStream(), 200)
  }

  function onPrerollEnded() {
    setShowingPreroll(false)
    setPrerollVideo(null)
    setAdBlocked(false)
    startTimerRef.current = setTimeout(() => initStream(), 200)
  }

  // ── Recuperación de errores manual + limpieza global al desmontar ──
  useEffect(() => {
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current)
      if (startTimerRef.current) clearTimeout(startTimerRef.current)
      cleanupStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Controles custom (portados de BAIT TV) ──
  function handlePlaying() { setIsPlaying(true); setIsLoading(false) }
  function handlePause() { setIsPlaying(false) }
  function handleCanPlay() { setIsLoading(false) }

  function showControlsTemporarily() {
    setShowControls(true)
    if (controlsTimer.current) clearTimeout(controlsTimer.current)
    controlsTimer.current = setTimeout(() => { if (isPlaying) setShowControls(false) }, 3500)
  }

  function togglePlay(e) {
    if (e) e.stopPropagation()
    const video = videoRef.current
    if (!video) return
    if (video.paused) { const p = video.play(); if (p && p.catch) p.catch(() => {}) }
    else video.pause()
  }

  function toggleMute(e) {
    if (e) e.stopPropagation()
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  // Fullscreen con soporte iOS: video.webkitEnterFullscreen primero, luego requestFullscreen
  function toggleFullscreen() {
    const video = videoRef.current
    if (!video) return
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) { document.exitFullscreen() }
      else if (document.webkitExitFullscreen) { document.webkitExitFullscreen() }
    } else {
      if (video.webkitEnterFullscreen) { video.webkitEnterFullscreen() }
      else if (video.requestFullscreen) { video.requestFullscreen() }
    }
  }

  // Listeners de fullscreen (desktop + iOS webkitbegin/endfullscreen)
  useEffect(() => {
    const onChange = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement ||
                   document.mozFullScreenElement || document.msFullscreenElement
      setIsFullscreen(!!fsEl)
    }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    document.addEventListener('mozfullscreenchange', onChange)
    document.addEventListener('MSFullscreenChange', onChange)

    const v = videoRef.current
    const onIOSStart = () => setIsFullscreen(true)
    const onIOSEnd = () => setIsFullscreen(false)
    if (v) {
      v.addEventListener('webkitbeginfullscreen', onIOSStart)
      v.addEventListener('webkitendfullscreen', onIOSEnd)
    }

    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
      document.removeEventListener('mozfullscreenchange', onChange)
      document.removeEventListener('MSFullscreenChange', onChange)
      if (v) {
        v.removeEventListener('webkitbeginfullscreen', onIOSStart)
        v.removeEventListener('webkitendfullscreen', onIOSEnd)
      }
    }
  }, [])

  if (!channel) return null

  return (
    <div className="w-full">
      {/* Barra superior: volver + nombre del canal */}
      <div className="flex items-center gap-2 mb-3">
        <button onClick={onBack}
          className="bg-white border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition press-scale">
          ← Volver
        </button>
        <span className="text-gray-400 text-sm truncate">{channel.nombre}</span>
      </div>

      <div
        ref={containerRef}
        className="relative bg-black rounded-2xl overflow-hidden shadow-lg group select-none"
        style={{ aspectRatio: '16/9' }}
        onMouseMove={showControlsTemporarily}
        onTouchStart={showControlsTemporarily}
        onClick={showControlsTemporarily}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain bg-black"
          style={{ display: showingPreroll ? 'none' : 'block' }}
          playsInline
          webkit-playsinline="true"
          x5-playsinline="true"
          x5-video-player-type="h5"
          x5-video-player-fullscreen="true"
          preload="auto"
          onPlaying={handlePlaying}
          onPause={handlePause}
          onCanPlay={handleCanPlay}
        />

        {/* ── Preroll de Metepec (anuncio por canal) ── */}
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

            {/* Fallback para bloqueo de autoplay en Safari */}
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

        {/* Loading (spinner navy Metepec) */}
        {isLoading && !showingPreroll && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
            <div className="w-12 h-12 border-[3px] border-white/20 rounded-full animate-spin" style={{ borderTopColor: '#2D4F9F' }}></div>
            <p className="text-white/80 text-xs mt-3 font-medium">Cargando...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-30">
            <div className="text-center px-6 max-w-xs">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(255,59,48,0.2)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p className="text-white font-bold mb-1">Algo salió mal</p>
              <p className="text-white/60 text-sm mb-4">{error}</p>
              <button onClick={() => { setError(''); initStream() }}
                className="px-6 py-2.5 text-sm rounded-lg text-white font-semibold press-scale"
                style={{ background: '#2D4F9F' }}>
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* ── Controles custom (portados de BAIT, colores Metepec) ── */}
        {!showingPreroll && !error && (
          <div className={'absolute inset-0 transition-opacity duration-300 ' + (showControls ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
            {/* Top gradient + badge EN VIVO */}
            <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/70 to-transparent"></div>
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 bg-red-500 text-white px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse-live"></span>
                <span className="text-2xs font-bold uppercase tracking-wider">EN VIVO</span>
              </div>
              <span className="text-sm text-white/90 font-semibold drop-shadow truncate max-w-[60%]">{channel.nombre}</span>
            </div>

            {/* Center play */}
            <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center" aria-label="Play/Pause">
              {!isPlaying && !isLoading && (
                <div className="w-20 h-20 bg-white/95 rounded-full flex items-center justify-center shadow-2xl press-scale">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="#2A3240">
                    <polygon points="6 4 20 12 6 20 6 4" />
                  </svg>
                </div>
              )}
            </button>

            {/* Bottom controls */}
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/80 to-transparent"></div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 transition-colors flex items-center justify-center press-scale">
                  {isPlaying ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" rx="1.5" /><rect x="14" y="4" width="4" height="16" rx="1.5" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="6 4 20 12 6 20 6 4" /></svg>
                  )}
                </button>
                <button onClick={toggleMute} className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 transition-colors flex items-center justify-center press-scale">
                  {isMuted ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                  )}
                </button>
              </div>

              <button onClick={toggleFullscreen} className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 transition-colors flex items-center justify-center press-scale">
                {isFullscreen ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" /></svg>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
