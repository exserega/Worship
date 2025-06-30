// Имя для нашего кэша (памяти)
const CACHE_NAME = 'agape-worship-cache-v4'; // v4, исправлены ошибки fetch

// Список файлов, которые нужно сохранить для работы оффлайн (С ИСПРАВЛЕННЫМИ ПУТЯМИ)
const URLS_TO_CACHE = [
  './', // Главная страница
  './index.html',
  './script.js',
  './styles.css',
  './manifest.json',
  './api.js',
  './ui.js',
  './core.js',
  './state.js',
  './constants.js',
  './firebase-config.js',
  './images/Icon-192.png', // Добавим иконки для PWA
  './images/Icon-512.png',
  // Внешние ресурсы, их пути не меняются
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js'
  // Аудио файл метронома убран из кэша - токен может быть недействительным
];

// Событие 'install' (установка): открываем кэш и добавляем в него все наши файлы
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        console.log('Service Worker: Кэшируем основные файлы приложения');
        
        // Кэшируем файлы по одному, пропуская те, которые не удается загрузить
        const cachePromises = URLS_TO_CACHE.map(async (url) => {
          try {
            await cache.add(url);
            console.log(`Service Worker: Успешно кэширован ${url}`);
          } catch (error) {
            console.warn(`Service Worker: Не удалось кэшировать ${url}:`, error);
          }
        });
        
        await Promise.all(cachePromises);
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
        return fetch(event.request).catch((error) => {
          console.warn('Service Worker: Ошибка fetch для', event.request.url, error);
          // Возвращаем fallback-ответ для критически важных ресурсов
          if (event.request.url.includes('index.html') || event.request.url.endsWith('/')) {
            return caches.match('./index.html');
          }
          throw error;
        });
      })
  );
});
