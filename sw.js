const CACHE_NAME = 'srs-flashcard-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './decks.js',
  './quiz.js',
  './search.js',
  './autoplay.js',
  './reverse.js',
  './gamification.js',
  './analytics.js',
  'manifest.json'
];

// Cài đặt Service Worker và lưu các file vào bộ nhớ đệm (Cache)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Kích hoạt và dọn dẹp cache cũ nếu có nâng cấp
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Trả về dữ liệu từ bộ nhớ đệm khi mất mạng (Offline Mode)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});