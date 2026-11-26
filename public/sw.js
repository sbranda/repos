// Service worker de "Mis repos".
// - La página (index.html) va primero a la red, así siempre ves la última versión;
//   si no hay conexión, usa la copia guardada.
// - Los archivos de /assets/ llevan un hash en el nombre, así que se guardan para siempre.
// - Los pedidos a api.github.com NUNCA se guardan: los datos y el token no quedan en caché.

const CACHE = 'mis-repos-v1'
const SCOPE = self.registration.scope // termina en /repos/
const SHELL = ['', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'].map(
  (p) => SCOPE + p,
)

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(SCOPE, copy))
          return res
        })
        .catch(() => caches.match(SCOPE)),
    )
    return
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && url.pathname.includes('/assets/')) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})
