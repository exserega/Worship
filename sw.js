// Имя для нашего кэша (памяти)
const CACHE_NAME = 'agape-worship-cache-v1';

// Список файлов, которые нужно сохранить для работы оффлайн
const URLS_TO_CACHE = [
  '/',
  'index.html',
  'script.js',
  'styles.css',
  'manifest.json',
  // Внешние ресурсы, которые тоже нужно сохранить
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js',
  'https://firebasestorage.googleapis.com/v0/b/song-archive-389a6.firebasestorage.app/o/metronome-85688%20(mp3cut.net).mp3?alt=media&token=97b66349-7568-43eb-80c3-c2278ff38c10'
];

// Событие 'install' (установка): открываем кэш и добавляем в него все наши файлы
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Кэшируем основные файлы приложения');
        return cache.addAll(URLS_TO_CACHE);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Событие 'activate' (активация): удаляем старые кэши, если они есть
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Событие 'fetch' (запрос): перехватываем все запросы с сайта
self.addEventListener('fetch', (event) => {
  event.respondWith(
    // Сначала ищем ответ в кэше
    caches.match(event.request)
      .then((response) => {
        // Если ответ найден в кэше, отдаем его
        if (response) {
          return response;
        }
        // Если в кэше ничего нет, идем в интернет
        return fetch(event.request);
      })
  );
});
