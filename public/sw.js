/* Pendientes Mini — service worker
 *
 * Estrategias:
 *  - Precache del shell en install (caché versionada).
 *  - config.js: network-first (rotar la clave VAPID no exige bump de versión).
 *  - Navegaciones: caché → red → index.html cacheado (offline).
 *  - Resto same-origin GET: cache-first.
 *  - push: muestra notificación con payload validado. NUNCA toca tareas ni badge.
 *  - notificationclick: enfoca una ventana dentro del scope o abre la app
 *    validando la URL contra el scope (sin open redirects).
 *
 * Actualización: incrementa VERSION cuando cambie cualquier archivo precacheado.
 */

'use strict';

const VERSION = 'v1';
const CACHE = `pendientes-mini-${VERSION}`;

/* Relativas: se resuelven contra la URL de este SW (correcto bajo subruta). */
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './config.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
];

const NOTIFICACION_TAG = 'pendientes-mini';
const LONGITUD_MAXIMA = 200;

/* ---------- install / activate ---------- */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

/* ---------- utilidades de payload ---------- */

function textoSeguro(valor, predeterminado) {
  if (typeof valor !== 'string') return predeterminado;
  const limpio = valor.trim();
  if (!limpio) return predeterminado;
  return limpio.slice(0, LONGITUD_MAXIMA);
}

/* Valida que `destino` quede dentro del scope del SW; si no, raíz del scope. */
function urlDentroDelScope(destino) {
  const raiz = new URL(self.registration.scope);
  if (typeof destino !== 'string' || !destino) return raiz.href;
  try {
    const url = new URL(destino, raiz);
    if (url.origin !== raiz.origin) return raiz.href;
    if (!url.href.startsWith(raiz.href)) return raiz.href;
    return url.href;
  } catch {
    return raiz.href;
  }
}

/* ---------- push (solo muestra; jamás modifica tareas ni badge) ---------- */

self.addEventListener('push', (event) => {
  let datos = {};
  try {
    if (event.data) datos = event.data.json();
  } catch {
    datos = {};
  }

  const titulo = textoSeguro(datos.title, 'Pendientes Mini');
  const cuerpo = textoSeguro(datos.body, 'Notificación de prueba.');
  const destino = urlDentroDelScope(datos.url);

  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: cuerpo,
      tag: NOTIFICACION_TAG,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: { url: destino },
    })
  );
});

/* ---------- notificationclick ---------- */

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const destino = urlDentroDelScope(
    event.notification.data && event.notification.data.url
  );

  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      /* Enfoca la primera ventana que ya esté dentro del scope. */
      const existente = ventanas.find((cliente) => {
        try {
          return cliente.url.startsWith(self.registration.scope);
        } catch {
          return false;
        }
      });
      if (existente) {
        await existente.focus();
        return;
      }

      await self.clients.openWindow(destino);
    })()
  );
});

/* ---------- fetch ---------- */

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  /* config.js: network-first con respaldo en caché. */
  if (url.pathname.endsWith('/config.js')) {
    event.respondWith(
      (async () => {
        try {
          const respuesta = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put(request, respuesta.clone());
          return respuesta;
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match(request)) || Response.error();
        }
      })()
    );
    return;
  }

  /* Navegaciones: caché, luego red, luego index.html cacheado. */
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cacheada = await cache.match('./', { ignoreSearch: true });
        if (cacheada) return cacheada;
        try {
          return await fetch(request);
        } catch {
          return (await cache.match('./index.html')) || Response.error();
        }
      })()
    );
    return;
  }

  /* Resto same-origin GET: cache-first. */
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cacheada = await cache.match(request);
      if (cacheada) return cacheada;
      try {
        const respuesta = await fetch(request);
        if (respuesta.ok) cache.put(request, respuesta.clone());
        return respuesta;
      } catch {
        return Response.error();
      }
    })()
  );
});
