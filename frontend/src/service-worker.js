/* eslint-disable no-restricted-globals */
// src/service-worker.js
// react-scripts (CRA 5) otomatis mendeteksi file ini saat build dan memakai
// Workbox InjectManifest untuk membangun service worker sungguhan — tidak
// perlu install workbox-* apapun secara manual, sudah dibawa oleh react-scripts.

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst } from 'workbox-strategies';

clientsClaim();

// Precache semua file hasil build (JS, CSS, ikon, manifest) — daftar filenya
// di-generate otomatis oleh Workbox saat `npm run build`, jangan diedit manual.
precacheAndRoute(self.__WB_MANIFEST);

// App shell routing: request navigasi (buka halaman/route apapun di app,
// termasuk saat offline) tetap dilayani index.html, biar React Router yang
// urus routing di sisi client. Tanpa ini, refresh di /driver/p2h saat offline
// akan gagal karena server tidak punya file fisik di path itu.
const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$');
registerRoute(
  ({ request, url }) => {
    if (request.mode !== 'navigate') return false;
    if (url.pathname.startsWith('/_')) return false;
    if (url.pathname.match(fileExtensionRegexp)) return false;
    return true;
  },
  createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html')
);

// Aset statis (gambar, font) — StaleWhileRevalidate: tampilkan versi cache
// dulu (cepat), sambil update cache di background.
registerRoute(
  ({ request }) => request.destination === 'image' || request.destination === 'font',
  new StaleWhileRevalidate({
    cacheName: 'mms-fleetcare-assets',
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 })],
  })
);

// Data Supabase (P2H, unit, dsb) — NetworkFirst: SELALU coba jaringan dulu
// dulu supaya driver tidak pernah lihat data basi/salah. Cache cuma dipakai
// sebagai fallback kalau sinyal benar-benar putus (bukan sumber utama).
registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co'),
  new NetworkFirst({
    cacheName: 'mms-fleetcare-api',
    networkTimeoutSeconds: 8,
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 5 * 60 })],
  })
);

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
