self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('supabase.co')) return;
  event.respondWith(fetch(event.request));
});