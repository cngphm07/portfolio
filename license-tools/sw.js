// Service worker — cache shell để app mở nhanh và cài được lên màn hình chính.
// API Supabase luôn đi thẳng mạng, không cache.
'use strict';
const VERSION = 'lt-v7';
const CORE = [
  './',
  './index.html',
  './app.js',
  './config.js',
  './mock-supabase.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.allSettled(CORE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')) return; // luôn đi mạng
  if (url.origin === location.origin
    || url.hostname.includes('jsdelivr')
    || url.hostname.endsWith('fonts.googleapis.com')
    || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(staleWhileRevalidate(e.request));
  }
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);           // ưu tiên mạng — cập nhật luôn tới tay
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(req);  // offline: dùng bản cache
    if (cached) return cached;
    throw err;
  }
}
