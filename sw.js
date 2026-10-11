/* 한끼채널 서비스 워커: 앱 파일을 기기에 저장해서 오프라인에서도 열리게 함.
   앱을 새로 올릴 때마다 아래 VER 숫자를 올려야 사용자 기기가 새 파일로 교체함. */
const VER = 'hankki-v3';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'privacy.html',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VER)
      .then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const same = u.origin === location.origin;
  const font = u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
  if (!same && !font) return; // 지도 등 다른 사이트 요청은 건드리지 않음

  e.respondWith((async () => {
    const cache = await caches.open(VER);
    const hit = await cache.match(r, { ignoreSearch: same });
    // 저장본을 먼저 보여주고, 뒤에서 최신본을 받아 두는 방식(다음 실행 때 반영)
    const net = fetch(r).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(r, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (r.mode === 'navigate') {
      const fb = await cache.match('index.html');
      if (fb) return fb;
    }
    return new Response('오프라인 상태예요', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
