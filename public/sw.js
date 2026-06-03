const CACHE = 'metepec-tv-v4'
const PRECACHE = ['/', '/logos/escudo.png', '/logos/metepec-ruta.png', '/logos/metepec-funciona.jpg']
const NO_CACHE = ['supabase.co', '.m3u8', '.ts', 'b-cdn.net']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = e.request.url
  if (NO_CACHE.some(s => url.includes(s))) return

  // Navegación (HTML): network-first. Así cada deploy nuevo se ve de inmediato cuando hay red,
  // y si no hay red cae al index.html cacheado (offline).
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put('/', clone))
          }
          return res
        })
        .catch(() => caches.match('/'))
    )
    return
  }

  // Resto (assets con hash inmutable, logos): cache-first.
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      }).catch(() => caches.match('/'))
    })
  )
})
