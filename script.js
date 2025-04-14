// =====================================================================
// Agape Worship App - script.js (Проанализированная и исправленная версия)
// Важное примечание: Этот код содержит API-ключи Firebase и Google Sheets
// в клиентской части. Это СЕРЬЕЗНАЯ УЯЗВИМОСТЬ БЕЗОПАСНОСТИ.
// В реальном приложении ключи должны быть защищены (например, через бэкэнд).
// =====================================================================

// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
    getFirestore, collection, addDoc, query,
    onSnapshot, updateDoc, deleteDoc, setDoc, doc,
    orderBy, getDocs, where // serverTimestamp не импортируется, так как не используется
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// --- CONFIGURATION ---
// Firebase - ВАЖНО: В реальном приложении эти данные лучше получать с сервера или из переменных окружения
const firebaseConfig = {
    apiKey: "AIzaSyBlkjVQFtFpMRFexAi6nBqEkIfjFlU5cDo", // !!! ОСТОРОЖНО: API Ключ в клиентском коде! Небезопасно!
    authDomain: "song-archive-389a6.firebaseapp.com",
    projectId: "song-archive-389a6",
    storageBucket: "song-archive-389a6.firebasestorage.app", // ИСПРАВЛЕНО: .app вместо .com в конце storageBucket
    messagingSenderId: "619735277668",
    appId: "1:619735277668:web:51d2684bd8d4444eaf3f71",
    measurementId: "G-Z6QYH5YD2E"
};

// Google Sheets - ВАЖНО: API_KEY очень уязвим в клиентском коде!
const API_KEY = 'AIzaSyDO2gwifAnZzC3ooJ0A_4vAD76iYakwzlk'; // !!! ОСТОРОЖНО: API Ключ в клиентском коде! Небезопасно!
const SHEET_ID = '1C3gFjj9LAub_Nk9ogqKp3LKpdAxq6j8xlPAsc8OmM5s';
const SHEETS = {
    'Быстрые (вертикаль)': 'Быстрые (вертикаль)',
    'Быстрые (горизонталь)': 'Быстрые (горизонталь)',
    'Поклонение (вертикаль)': 'Поклонение (вертикаль)',
    'Поклонение (горизонталь)': 'Поклонение (горизонталь)'
};

// Music Constants
const chords = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "H"];
const DEFAULT_FONT_SIZE = 10;
const MIN_FONT_SIZE = 8;
// const MAX_SHARED_SONGS = 8; // Не используется, можно удалить

// --- FIREBASE INITIALIZATION ---
let app;
let db;
let storage;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    storage = getStorage(app);
    console.log("Firebase initialized successfully.");
} catch (error) {
    console.error("CRITICAL: Firebase initialization failed!", error);
    alert("Критическая ошибка: не удалось инициализировать Firebase. Приложение не будет работать корректно.");
    // Прекращаем дальнейшее выполнение, так как без Firebase приложение бесполезно
    throw new Error("Firebase initialization failed");
}


// --- GLOBAL STATE ---
let currentRepertoireUnsubscribe = null; // Для отписки от слушателя репертуара
let cachedData = {}; // Кэш данных из Google Sheets ({ sheetName: [rows...] })
let favorites = JSON.parse(localStorage.getItem('favorites')) || []; // Избранные песни
let currentVocalistId = null; // ID выбранного вокалиста
let currentVocalistName = null; // Имя выбранного вокалиста
let allSheetsData = []; // Данные всех листов для поиска (заполняется в loadAllSheetsData)
let currentFontSize = DEFAULT_FONT_SIZE; // Текущий размер шрифта

// Состояние сет-листов
let currentSetlistId = null; // ID текущего выбранного сет-листа
let currentSetlistName = null; // Имя текущего выбранного сет-листа
let currentSetlistSongs = []; // Массив объектов песен ТЕКУЩЕГО выбранного сет-листа
let currentSetlistSongsUnsubscribe = null; // Для отписки от слушателя песен ТЕКУЩЕГО сет-листа

// Состояние презентации
let presentationSongs = []; // Песни для ТЕКУЩЕЙ презентации (копия currentSetlistSongs)
let currentPresentationIndex = 0; // Индекс текущей отображаемой песни
let controlsHideTimeout = null; // ID таймера для автоскрытия панели управления
let isPresentationSplit = false; // Состояние разделения текста в презентации

// Состояние метронома
let audioContext;
let audioBuffer;
let metronomeInterval = null;
let isMetronomeActive = false;
let currentBeat = 0;


// --- DOM ELEMENT REFERENCES ---
// Получаем ссылки один раз при загрузке
const sheetSelect = document.getElementById('sheet-select');
const songSelect = document.getElementById('song-select');
const keySelect = document.getElementById('key-select');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const loadingIndicator = document.getElementById('loading-indicator');
const songContent = document.getElementById('song-content');
const splitTextButton = document.getElementById('split-text-button');
const zoomInButton = document.getElementById('zoom-in');
const zoomOutButton = document.getElementById('zoom-out');
const bpmDisplay = document.getElementById('bpm-display');
const holychordsButton = document.getElementById('holychords-button');
const timeSignatureSelect = document.getElementById('time-signature');
const metronomeButton = document.getElementById('metronome-button');
const playerContainer = document.getElementById('youtube-player-container');
const playerSection = document.getElementById('youtube-player-section');
const youtubeVideoKeyDisplay = document.getElementById('youtube-video-key-display'); // Добавлено для ясности

// Кнопки действий с песней
const favoriteButton = document.getElementById('favorite-button');
const addToSetlistButton = document.getElementById('add-to-setlist-button');
const addToRepertoireButton = document.getElementById('add-to-repertoire-button');

// Элементы боковых панелей
const toggleFavoritesButton = document.getElementById('toggle-favorites');
const favoritesPanel = document.getElementById('favorites-panel');
const toggleRepertoireButton = document.getElementById('toggle-repertoire');
const repertoirePanel = document.getElementById('repertoire-panel');

// Элементы панели "Мой список" (внутри Левой панели)
const favoritesList = document.getElementById('favorites-list');

// Элементы панели "Сет-листы" (внутри Левой панели)
const newSetlistNameInput = document.getElementById('new-setlist-name-input');
const createSetlistButton = document.getElementById('create-setlist-button');
const setlistsListContainer = document.getElementById('setlists-list-container');

// Элементы панели "Текущий сет-лист" (внутри Левой панели)
const currentSetlistTitle = document.getElementById('current-setlist-title');
const currentSetlistControls = document.querySelector('.current-setlist-controls'); // Используем querySelector для класса
const startPresentationButton = document.getElementById('start-presentation-button');
const deleteSetlistButton = document.getElementById('delete-setlist-button');
const currentSetlistSongsContainer = document.getElementById('current-setlist-songs-container');

// Элементы панели "Репертуар" (внутри Правой панели)
const vocalistSelect = document.getElementById('vocalist-select');
const repertoirePanelList = document.getElementById('repertoire-panel-list');

// Элементы режима Презентации
const presentationOverlay = document.getElementById('presentation-overlay');
const presentationContent = document.getElementById('presentation-content');
const presentationCloseBtn = document.getElementById('presentation-close-btn');
const presSplitTextBtn = document.getElementById('pres-split-text-btn');
const presentationControls = document.querySelector('.presentation-controls'); // Используем querySelector для класса
const presPrevBtn = document.getElementById('pres-prev-btn');
const presNextBtn = document.getElementById('pres-next-btn');
const presCounter = document.getElementById('pres-counter');

// Элементы управления темой
const themeToggleButton = document.getElementById('theme-toggle-button');

// --- API FUNCTIONS (Sheets, Firestore) ---

/** Загрузка данных с одного листа Google Sheet (с кэшированием) */
async function fetchSheetData(sheetName) {
    // Используем полное имя листа для ключа кэша и URL
    const fullSheetName = SHEETS[sheetName] || sheetName; // Если передано короткое, ищем полное, иначе используем как есть

    if (cachedData[fullSheetName]) {
        console.log(`Using cached data for sheet: ${fullSheetName}`);
        return cachedData[fullSheetName];
    }

    if (!fullSheetName || !Object.values(SHEETS).includes(fullSheetName)) {
        console.error(`Invalid or unknown sheet name provided: ${fullSheetName}`);
        return [];
    }

    if (loadingIndicator) loadingIndicator.style.display = 'block';
    console.log(`Workspaceing data for sheet: ${fullSheetName}...`);

    try {
        // Загружаем столбцы A-G (Название, Текст, Тональность, HolyChords, BPM, YouTube, ТональностьВидео)
        const range = `${encodeURIComponent(fullSheetName)}!A2:G`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/<span class="math-inline">\{SHEET\_ID\}/values/</span>{range}?key=${API_KEY}`;
        const response = await fetch(url);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); // Попытка получить тело ошибки
            console.error(`Google Sheets API error for sheet "${fullSheetName}": ${response.status} ${response.statusText}`, errorData);
            throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        cachedData[fullSheetName] = data.values || []; // Сохраняем в кэш по полному имени
        console.log(`Successfully fetched and cached data for sheet: ${fullSheetName}, Rows: ${cachedData[fullSheetName].length}`);
        return cachedData[fullSheetName];
    } catch (error) {
        console.error(`Ошибка загрузки данных из Google Sheets для листа "${fullSheetName}":`, error);
        alert(`Не удалось загрузить данные листа "${fullSheetName}". Проверьте консоль на наличие ошибок API.`);
        return []; // Возвращаем пустой массив в случае ошибки
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/** Загрузка данных со ВСЕХ листов (для поиска и инициализации) */
async function loadAllSheetsData() {
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    allSheetsData = []; // Очищаем перед загрузкой
    cachedData = {}; // Очищаем кэш перед полной загрузкой
    console.log("Loading data from all sheets...");
    try {
        const sheetKeys = Object.keys(SHEETS); // Получаем КЛЮЧИ (короткие имена) из конфига
        const sheetPromises = sheetKeys.map(key => fetchSheetData(key)); // Передаем ключи в fetchSheetData
        const results = await Promise.allSettled(sheetPromises); // Используем allSettled для обработки частичных сбоев

        // Сохраняем данные в allSheetsData и проверяем ошибки
        allSheetsData = results.map((result, index) => {
            const sheetKey = sheetKeys[index];
            const fullSheetName = SHEETS[sheetKey];
            if (result.status === 'fulfilled') {
                console.log(`Sheet "${fullSheetName}" loaded successfully.`);
                return {
                    sheetName: fullSheetName, // Сохраняем ПОЛНОЕ имя
                    data: result.value
                };
            } else {
                console.error(`Failed to load sheet "${fullSheetName}":`, result.reason);
                // Возвращаем структуру с пустыми данными при ошибке
                return {
                    sheetName: fullSheetName,
                    data: []
                };
            }
        });

        console.log("Finished loading all sheets data (check logs for potential errors).");
        // createSearchIndex(); // Индексация поиска пока не используется
    } catch (error) {
        // Эта ошибка маловероятна с Promise.allSettled, но оставим на всякий случай
        console.error('Критическая ошибка во время загрузки данных со всех листов:', error);
        alert("Произошла критическая ошибка при начальной загрузке данных песен. Попробуйте обновить страницу.");
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/** Загрузка списка вокалистов в dropdown */
async function loadVocalists() {
    if (!vocalistSelect) {
        console.warn("Vocalist select dropdown not found.");
        return;
    }
    try {
        console.log("Загрузка списка вокалистов...");
        const querySnapshot = await getDocs(collection(db, "vocalists"));
        vocalistSelect.innerHTML = '<option value="">-- Выберите вокалиста --</option>'; // Сброс

        if (querySnapshot.empty) {
            console.warn("В коллекции 'vocalists' не найдено ни одного документа.");
        } else {
            querySnapshot.forEach((doc) => {
                const vocalist = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                // Используем имя, если оно есть, иначе ID как запасной вариант
                option.textContent = vocalist.name || `ID: ${doc.id}`;
                vocalistSelect.appendChild(option);
            });
            console.log("Список вокалистов успешно загружен.");
        }
    } catch (error) {
        console.error("Ошибка при загрузке вокалистов:", error);
        vocalistSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
        alert("Не удалось загрузить список вокалистов. Проверьте консоль.");
    }
}

/** Загрузка репертуара выбранного вокалиста (с аккордеоном по тональностям) */
function loadRepertoire(vocalistId) {
    const listContainer = repertoirePanelList;
    if (!listContainer) {
        console.error("UI элемент #repertoire-panel-list для панели репертуара не найден.");
        return;
    }

    // 1. Отписка от предыдущего слушателя
    if (currentRepertoireUnsubscribe) {
        console.log("loadRepertoire: Отписка от предыдущего слушателя репертуара.");
        try {
            currentRepertoireUnsubscribe();
        } catch (unsubError) {
            console.error("Ошибка при отписке от слушателя репертуара:", unsubError);
        } finally {
            currentRepertoireUnsubscribe = null;
        }
    }

    listContainer.innerHTML = ''; // Очищаем в любом случае

    // Если вокалист не выбран, показываем сообщение и выходим
    if (!vocalistId) {
        listContainer.innerHTML = '<div class="empty-message">Выберите вокалиста для просмотра репертуара.</div>';
        return;
    }

    listContainer.innerHTML = '<div class="loading-message">Загрузка репертуара...</div>'; // Индикатор загрузки

    const repertoireColRef = collection(db, "vocalists", vocalistId, "repertoire");
    const q = query(repertoireColRef); // Без сортировки Firestore, сортируем на клиенте

    console.log(`loadRepertoire: Установка НОВОГО слушателя для вокалиста ID: ${vocalistId} (с аккордеоном)`);

    // 2. Устанавливаем НОВЫЙ слушатель и сохраняем функцию отписки
    currentRepertoireUnsubscribe = onSnapshot(q, (snapshot) => {
        console.log(`>>> Firestore onSnapshot для репертуара ${vocalistId} сработал. Получено документов: ${snapshot.size}`);

        // Проверяем, актуален ли еще этот слушатель (не сменился ли вокалист)
        if (vocalistId !== currentVocalistId) {
            console.warn(`onSnapshot: Получен снимок для ${vocalistId}, но текущий вокалист уже ${currentVocalistId}. Игнорируем.`);
            return;
        }

        // Перепроверяем наличие контейнера на случай асинхронных проблем
        const currentListContainer = document.getElementById('repertoire-panel-list');
        if (!currentListContainer) {
            console.error("!!! Контейнер #repertoire-panel-list исчез во время работы onSnapshot!");
            if (currentRepertoireUnsubscribe) {
                currentRepertoireUnsubscribe(); // Отписываемся, если контейнера нет
                currentRepertoireUnsubscribe = null;
            }
            return;
        }

        currentListContainer.innerHTML = ''; // Очищаем контейнер перед отрисовкой

        if (snapshot.empty) {
            console.log("  Снимок пуст, репертуар не найден.");
            currentListContainer.innerHTML = '<div class="empty-message">Репертуар пуст.</div>';
            return;
        }

        console.log("  Начинаем группировку по тональности...");

        // --- Группировка по тональности ---
        const groupedByKeys = {};
        snapshot.docs.forEach((doc) => {
            const song = doc.data();
            const key = song.preferredKey || "N/A"; // Ключ тональности

            if (!groupedByKeys[key]) {
                groupedByKeys[key] = []; // Создаем массив для этого ключа
            }
            // Добавляем объект песни с ID документа Firestore
            groupedByKeys[key].push({ ...song, repertoireDocId: doc.id });
        });

        // --- Сортировка тональностей по музыкальному порядку ---
        const sortedKeys = Object.keys(groupedByKeys).sort((a, b) => {
            const order = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "H", "N/A"];
            // Не найденные ключи (-1) будут в конце
            return order.indexOf(a) - order.indexOf(b);
        });

        console.log("  Начинаем отрисовку аккордеона...");

        // --- Отрисовка аккордеона ---
        sortedKeys.forEach(key => {
            // 1. Создаем заголовок тональности
            const keyHeading = document.createElement('div');
            keyHeading.className = 'repertoire-key-heading';
            keyHeading.innerHTML = `Тональность: ${key} <i class="fas fa-chevron-down"></i>`; // Иконка Font Awesome
            keyHeading.dataset.key = key; // Сохраняем ключ для обработчика клика
            keyHeading.addEventListener('click', toggleRepertoireKeySection); // Добавляем обработчик клика
            currentListContainer.appendChild(keyHeading);

            // 2. Создаем контейнер для песен этой тональности (по умолчанию скрыт)
            const songsWrapper = document.createElement('div');
            songsWrapper.className = 'repertoire-songs-for-key collapsed'; // Сразу добавляем класс collapsed
            songsWrapper.dataset.keyContent = key; // Связываем с заголовком

            // 3. Сортируем песни внутри тональности по названию (локализованная сортировка)
            const songsInKey = groupedByKeys[key];
            songsInKey.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            // 4. Создаем элементы для каждой песни
            if (songsInKey.length > 0) {
                songsInKey.forEach(songWithId => {
                    const song = songWithId; // Просто переименование для ясности
                    const repertoireDocId = song.repertoireDocId; // ID для удаления

                    // Поиск короткого имени листа (ключа из SHEETS) по полному имени листа
                    const shortSheetName = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === song.sheet);
                    const displayName = shortSheetName ? `<span class="math-inline">\{song\.name\} \(</span>{shortSheetName})` : song.name;

                    const listItem = document.createElement('div');
                    listItem.className = 'repertoire-item';

                    // Название песни (и лист)
                    const songInfo = document.createElement('span');
                    songInfo.className = 'song-name';
                    songInfo.textContent = displayName || 'Песня без названия';
                    listItem.appendChild(songInfo);

                    // Кнопка удаления
                    const removeBtn = document.createElement('button');
                    removeBtn.innerHTML = '<i class="fas fa-times"></i>'; // Иконка Font Awesome
                    removeBtn.className = 'remove-button';
                    removeBtn.title = 'Удалить из репертуара';
                    removeBtn.addEventListener('click', (e) => {
                        e.stopPropagation(); // Остановить всплытие, чтобы не сработал клик по listItem
                        removeFromRepertoire(vocalistId, repertoireDocId); // Передаем ID вокалиста и ID документа репертуара
                    });
                    listItem.appendChild(removeBtn);

                    // Обработчик клика по самой песне (для отображения в основном окне)
                    listItem.addEventListener('click', async () => {
                         // Используем полное имя листа для работы с кэшем
                         const fullSheetName = song.sheet;
                         if (!fullSheetName || !cachedData[fullSheetName]?.[song.index]) {
                            // Попытка загрузить данные, если их нет в кэше
                            console.log(`Загрузка данных для <span class="math-inline">\{song\.name\} \(</span>{fullSheetName}) при клике в репертуаре`);
                            // Находим ключ листа для fetchSheetData
                            const sheetKey = Object.keys(SHEETS).find(key => SHEETS[key] === fullSheetName);
                            if (sheetKey) {
                                await fetchSheetData(sheetKey);
                            } else {
                                console.error(`Не удалось найти ключ для листа: ${fullSheetName}`);
                                alert(`Ошибка: Неизвестный лист "<span class="math-inline">\{fullSheetName\}" для песни "</span>{song.name}".`);
                                return;
                            }

                            // Повторная проверка после загрузки
                            if (!cachedData[fullSheetName]?.[song.index]) {
                                alert(`Не удалось найти или загрузить данные песни "${song.name}". Возможно, она была удалена из таблицы.`);
                                return;
                            }
                        }
                        // Данные найдены (или загружены)
                        const originalSongData = cachedData[fullSheetName][song.index];
                        const shortSheetKey = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === fullSheetName); // Находим ключ для select

                        if (sheetSelect && shortSheetKey) {
                            sheetSelect.value = shortSheetKey; // Выбираем лист в select
                            await loadSheetSongs(); // Перезагружаем список песен для выбранного листа
                        } else {
                            console.warn(`Не удалось найти select листа или ключ для "${fullSheetName}"`);
                        }

                        if (songSelect) {
                           songSelect.value = song.index; // Выбираем нужную песню в select
                        }

                        // Отображаем песню с предпочитаемой тональностью из репертуара
                        displaySongDetails(originalSongData, song.index, song.preferredKey);

                        // Закрываем боковые панели
                        if (repertoirePanel) repertoirePanel.classList.remove('open');
                        if (favoritesPanel) favoritesPanel.classList.remove('open');
                    });

                    songsWrapper.appendChild(listItem); // Добавляем песню в контейнер этой тональности
                });
            } else {
                // Если для ключа нет песен (маловероятно, но возможно)
                songsWrapper.innerHTML = '<div class="empty-message small">Нет песен в этой тональности</div>';
            }

            // 5. Добавляем контейнер с песнями после заголовка тональности
            currentListContainer.appendChild(songsWrapper);
        }); // Конец цикла по sortedKeys

        console.log("  Отрисовка аккордеона репертуара ЗАВЕРШЕНА.");

    }, (error) => {
        // Обработка ошибок Firestore onSnapshot
        console.error(`!!! ОШИБКА Firestore onSnapshot для репертуара ${vocalistId}:`, error);

        // Проверяем, актуален ли слушатель перед показом ошибки пользователю
        if (vocalistId === currentVocalistId) {
            const currentListContainer = document.getElementById('repertoire-panel-list');
            if (currentListContainer) {
                currentListContainer.innerHTML = '<div class="empty-message error-message">Ошибка загрузки репертуара.</div>';
            }
            alert("Произошла ошибка при обновлении репертуара. Попробуйте выбрать вокалиста снова.");
        } else {
            console.warn(`Ошибка onSnapshot для ${vocalistId} проигнорирована, т.к. текущий вокалист ${currentVocalistId}.`);
        }

        // Отписываемся от слушателя в случае ошибки, если он еще актуален
        if (vocalistId === currentVocalistId && currentRepertoireUnsubscribe) {
            console.log("Отписка от слушателя репертуара из-за ошибки onSnapshot.");
            currentRepertoireUnsubscribe();
            currentRepertoireUnsubscribe = null;
        }
    });
}

/** Переключает видимость секции песен для конкретной тональности в аккордеоне репертуара */
function toggleRepertoireKeySection(event) {
    const heading = event.currentTarget; // Элемент div.repertoire-key-heading, по которому кликнули
    const key = heading.dataset.key; // Получаем ключ тональности из data-атрибута

    // Ищем соответствующий контейнер с песнями по data-атрибуту
    const contentWrapper = document.querySelector(`.repertoire-songs-for-key[data-key-content="${key}"]`);
    const icon = heading.querySelector('i.fas'); // Иконка-стрелка внутри заголовка

    if (!contentWrapper || !icon) {
        console.error("Не найден контент или иконка для секции репертуара:", key);
        return;
    }

    const isCurrentlyCollapsed = contentWrapper.classList.contains('collapsed');

    // --- Логика "Только одна секция открыта" ---
    if (isCurrentlyCollapsed) { // Если кликнули по свернутой секции (собираемся открыть)
        // Находим ВСЕ заголовки и контейнеры в репертуаре
        const allHeadings = document.querySelectorAll('.repertoire-key-heading');
        const allWrappers = document.querySelectorAll('.repertoire-songs-for-key');

        // Сворачиваем все ДРУГИЕ секции
        allWrappers.forEach(wrapper => {
            if (wrapper !== contentWrapper) { // Не трогаем ту, по которой кликнули
                wrapper.classList.add('collapsed');
            }
        });
        // Обновляем иконки для всех ДРУГИХ заголовков (поворачиваем вниз)
        allHeadings.forEach(head => {
            const headIcon = head.querySelector('i.fas');
            if (head !== heading && headIcon) { // Не трогаем текущий заголовок
                headIcon.classList.remove('fa-chevron-up');
                headIcon.classList.add('fa-chevron-down');
            }
        });
    }
    // --- Конец логики "Только одна секция открыта" ---

    // Переключаем класс collapsed для ТЕКУЩЕЙ секции (открываем или закрываем)
    contentWrapper.classList.toggle('collapsed');

    // Обновляем иконку для ТЕКУЩЕЙ секции
    if (contentWrapper.classList.contains('collapsed')) { // Если секция теперь свернута
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    } else { // Если секция теперь развернута
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    }
}

/** Добавление или обновление песни в репертуаре вокалиста (Firestore) */
async function addToRepertoire() {
    console.log("Вызвана функция addToRepertoire");

    // 1. Проверка выбора вокалиста
    if (!currentVocalistId) {
        alert("Пожалуйста, сначала выберите вокалиста из списка.");
        // Попытка открыть панель репертуара, если закрыта
        if (repertoirePanel && !repertoirePanel.classList.contains('open') && toggleRepertoireButton) {
             toggleRepertoireButton.click();
        }
        if (vocalistSelect) vocalistSelect.focus();
        return;
    }

    // 2. Проверка выбора песни
    const sheetKey = sheetSelect?.value; // Короткое имя (ключ)
    const fullSheetName = SHEETS[sheetKey]; // Полное имя листа
    const songIndexStr = songSelect?.value;

    if (!sheetKey || !fullSheetName || songIndexStr === null || songIndexStr === "" || !cachedData[fullSheetName] || !cachedData[fullSheetName][songIndexStr]) {
        alert("Пожалуйста, сначала выберите песню для добавления в репертуар.");
        if(songSelect) songSelect.focus();
        return;
    }
    const songIndex = parseInt(songIndexStr, 10); // Индекс должен быть числом, если используется как индекс массива
    const songData = cachedData[fullSheetName][songIndex];
    const songName = songData?.[0]; // Название песни (индекс 0)
    const preferredKey = keySelect?.value; // Тональность из селектора

    if (!songName || !preferredKey) {
         alert("Не удалось получить данные песни или тональность. Попробуйте выбрать песню снова.");
         return;
    }

    console.log(`Добавляем в репертуар для <span class="math-inline">\{currentVocalistName \|\| 'ID\: '\+currentVocalistId\}\: Песня "</span>{songName}", Лист: "${fullSheetName}", Индекс: ${songIndex}, Тональность: ${preferredKey}`);

    // 3. Создание кастомного ID для документа в Firestore
    // Используем комбинацию имени листа и индекса для уникальности и предсказуемости ID
    const repertoireDocId = `<span class="math-inline">\{encodeURIComponent\(fullSheetName\)\}\_</span>{songIndex}`;

    // 4. Подготовка данных для сохранения
    const dataToSave = {
        sheet: fullSheetName, // Сохраняем полное имя листа
        index: songIndex, // Сохраняем числовой индекс
        name: songName,
        preferredKey: preferredKey
        // 'addedAt' не используется, поэтому serverTimestamp() не нужен
    };
    console.log("Данные для сохранения в репертуар:", dataToSave, "с ID:", repertoireDocId);

    // 5. Сохранение в Firestore (используем setDoc с кастомным ID для перезаписи/обновления)
    try {
        const docRef = doc(db, "vocalists", currentVocalistId, "repertoire", repertoireDocId);
        await setDoc(docRef, dataToSave);
        console.log(`Песня "${songName}" успешно добавлена/обновлена в репертуаре ${currentVocalistName || 'ID: '+currentVocalistId}.`);
        alert(`Песня "<span class="math-inline">\{songName\}" \(</span>{preferredKey}) добавлена/обновлена в репертуаре ${currentVocalistName || 'выбранного вокалиста'}.`);
    } catch (error) {
        console.error("Ошибка при добавлении/обновлении песни в репертуаре:", error);
        alert("Произошла ошибка при сохранении песни в репертуар. Проверьте консоль.");
    }
}

/** Удаление песни из репертуара вокалиста (Firestore) */
async function removeFromRepertoire(vocalistId, repertoireDocId) {
    console.log(`Попытка удалить песню ${repertoireDocId} из репертуара вокалиста ${vocalistId}`);

    // Проверка наличия ID
    if (!vocalistId || !repertoireDocId) {
        console.error("removeFromRepertoire: Не переданы ID вокалиста или документа песни.");
        alert("Ошибка: Невозможно удалить песню (отсутствуют необходимые идентификаторы).");
        return;
    }

    // Получаем имя вокалиста для подтверждения (если доступно)
    const vocalistDisplayName = currentVocalistName === vocalistSelect?.options[vocalistSelect.selectedIndex]?.text
                               ? currentVocalistName
                               : `вокалиста с ID ${vocalistId}`;

    // Запрос подтверждения у пользователя
    if (!confirm(`Удалить эту песню из репертуара ${vocalistDisplayName}?`)) {
        console.log("Удаление отменено пользователем.");
        return; // Пользователь нажал "Отмена"
    }

    // Удаление документа из Firestore
    try {
        const docRef = doc(db, "vocalists", vocalistId, "repertoire", repertoireDocId);
        await deleteDoc(docRef);
        console.log(`Песня ${repertoireDocId} успешно удалена из репертуара ${vocalistId}.`);
        alert("Песня удалена из репертуара.");
        // UI обновится автоматически благодаря onSnapshot в loadRepertoire
    } catch (error) {
        console.error("Ошибка при удалении песни из репертуара:", error);
        alert("Произошла ошибка при удалении песни из репертуара. Проверьте консоль.");
    }
}


// --- ФУНКЦИИ ДЛЯ СЕТ-ЛИСТОВ ---

/** Загрузка и отображение списка всех сет-листов */
function loadSetlists() {
    if (!setlistsListContainer) {
        console.error("Контейнер для списка сет-листов (#setlists-list-container) не найден.");
        return;
    }
    setlistsListContainer.innerHTML = '<div class="loading-message">Загрузка сет-листов...</div>';

    const q = query(setlistsCollection, orderBy("name", "asc")); // Сортируем по имени А-Я

    // Используем onSnapshot для автоматического обновления списка
    const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log(`onSnapshot для списка сет-листов сработал. Документов: ${snapshot.size}`);
        setlistsListContainer.innerHTML = ''; // Очищаем контейнер перед отрисовкой

        if (snapshot.empty) {
            setlistsListContainer.innerHTML = '<div class="empty-message">Нет созданных сет-листов.</div>';
            // Если список пуст, и текущий выбранный сет-лист был удален, сбрасываем выбор
            if (currentSetlistId && !snapshot.docs.some(doc => doc.id === currentSetlistId)) {
                 console.log("Текущий сет-лист был удален, сбрасываем выбор.");
                 selectSetlist(null, null); // Сброс
            }
            return;
        }

        snapshot.docs.forEach((doc) => {
            const setlist = doc.data();
            const setlistId = doc.id;
            const setlistItem = document.createElement('div');
            setlistItem.className = 'setlist-item';
            setlistItem.dataset.id = setlistId; // Сохраняем ID в data-атрибут

            // 1. Span для имени (кликабельный для выбора)
            const nameSpan = document.createElement('span');
            nameSpan.className = 'setlist-name-display';
            nameSpan.textContent = setlist.name || 'Без названия';
            nameSpan.title = `Выбрать сет-лист: ${setlist.name || 'Без названия'}`;
            nameSpan.addEventListener('click', () => {
                selectSetlist(setlistId, setlist.name);
            });
            setlistItem.appendChild(nameSpan);

            // 2. Кнопка Редактировать (карандаш)
            const editButton = document.createElement('button');
            editButton.className = 'setlist-edit-button';
            editButton.title = 'Редактировать название сет-листа';
            editButton.innerHTML = '<i class="fas fa-pencil-alt"></i>';
            editButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Предотвращаем выбор сет-листа при клике на карандаш
                startEditSetlistName(setlistItem, setlistId, setlist.name);
            });
            setlistItem.appendChild(editButton);

            // Подсветка активного (выбранного) сет-листа
            if (setlistId === currentSetlistId) {
                setlistItem.classList.add('active');
            }

            setlistsListContainer.appendChild(setlistItem); // Добавляем элемент в контейнер
        });
    }, (error) => {
        console.error("Ошибка Firestore onSnapshot при загрузке сет-листов:", error);
        setlistsListContainer.innerHTML = '<div class="empty-message error-message">Ошибка загрузки списка сет-листов.</div>';
        alert("Не удалось загрузить или обновить список сет-листов.");
        // Здесь можно было бы отписаться, но слушатель может быть полезен для автоматического восстановления
    });
    // Возвращаем функцию отписки, хотя она здесь не используется напрямую
    // return unsubscribe;
}

/** Обработка выбора сет-листа из списка */
function selectSetlist(setlistId, setlistName) {
    console.log(`Выбран сет-лист: ID=<span class="math-inline">\{setlistId\}, Имя\=</span>{setlistName}`);

    // Если кликнули по уже выбранному, ничего не делаем (опционально)
    // if (setlistId === currentSetlistId) {
    //     console.log("Этот сет-лист уже выбран.");
    //     return;
    // }

    currentSetlistId = setlistId; // Обновляем глобальное состояние
    currentSetlistName = setlistName;

    // Обновляем подсветку ('active' класс) в списке сет-листов
    if (setlistsListContainer) {
        const items = setlistsListContainer.querySelectorAll('.setlist-item');
        items.forEach(item => {
            item.classList.toggle('active', item.dataset.id === setlistId);
        });
    } else {
        console.warn("Не найден контейнер setlistsListContainer для обновления подсветки.");
    }

    // Обновляем заголовок текущего сет-листа и видимость кнопок управления им
    if (currentSetlistTitle && currentSetlistControls) {
        if (setlistId) { // Если сет-лист выбран
            currentSetlistTitle.textContent = setlistName || 'Сет-лист без названия';
            currentSetlistControls.style.display = 'flex'; // Показываем кнопки "Презентация" / "Удалить"
        } else { // Если выбор сброшен (setlistId is null)
            currentSetlistTitle.textContent = 'Выберите сет-лист';
            currentSetlistControls.style.display = 'none'; // Скрываем кнопки
            currentSetlistSongs = []; // Очищаем массив песен при сбросе
            if (currentSetlistSongsContainer) {
                currentSetlistSongsContainer.innerHTML = '<div class="empty-message">Сначала выберите сет-лист</div>';
            }
        }
    } else {
        console.warn("Не найдены элементы currentSetlistTitle или currentSetlistControls.");
    }

    // Загружаем (или очищаем) список песен для выбранного сет-листа
    loadCurrentSetlistSongs(setlistId);
}

/** Создание нового сет-листа в Firestore */
async function createSetlist() {
    if (!newSetlistNameInput || !createSetlistButton) {
         console.error("Не найдены элементы для создания сет-листа (input или button).");
         return;
    }

    const setlistName = newSetlistNameInput.value.trim();
    if (!setlistName) {
        alert("Пожалуйста, введите название для нового сет-листа.");
        newSetlistNameInput.focus();
        return;
    }

    // Блокируем кнопку и показываем состояние "Создание..."
    createSetlistButton.disabled = true;
    createSetlistButton.textContent = 'Создание...';

    const dataToSave = {
        name: setlistName,
        createdAt: new Date() // Используем клиентское время создания для простоты
        // Можно использовать serverTimestamp() из Firestore, если нужно точное серверное время:
        // import { serverTimestamp } from "firebase/firestore";
        // createdAt: serverTimestamp()
    };

    try {
        const docRef = await addDoc(setlistsCollection, dataToSave);
        console.log("Новый сет-лист успешно создан с ID:", docRef.id);
        newSetlistNameInput.value = ''; // Очищаем поле ввода
        alert(`Сет-лист "${setlistName}" успешно создан!`);
        // Список обновится автоматически благодаря onSnapshot в loadSetlists()
        // Можно опционально сразу выбрать созданный сет-лист:
        // selectSetlist(docRef.id, setlistName);
    } catch (error) {
        console.error("Ошибка при создании сет-листа:", error);
        alert("Не удалось создать сет-лист. Попробуйте еще раз или проверьте консоль.");
    } finally {
        // Разблокируем кнопку и возвращаем исходный текст
        createSetlistButton.disabled = false;
        createSetlistButton.textContent = 'Создать';
    }
}

/** Загрузка и отображение песен для ТЕКУЩЕГО выбранного сет-листа */
function loadCurrentSetlistSongs(setlistId) {
    if (!currentSetlistSongsContainer) {
        console.error("Контейнер для песен текущего сет-листа (#current-setlist-songs-container) не найден.");
        return;
    }

    // 1. Отписываемся от предыдущего слушателя песен (если он был)
    if (currentSetlistSongsUnsubscribe) {
        console.log("Отписка от предыдущего слушателя песен сет-листа.");
        try {
            currentSetlistSongsUnsubscribe();
        } catch (unsubError) {
             console.error("Ошибка при отписке от слушателя песен:", unsubError);
        } finally {
            currentSetlistSongsUnsubscribe = null;
        }
    }

    // 2. Если сет-лист не выбран (или выбор сброшен), очищаем контейнер и массив песен
    if (!setlistId) {
        currentSetlistSongsContainer.innerHTML = '<div class="empty-message">Сначала выберите сет-лист</div>';
        currentSetlistSongs = []; // Очищаем массив
        // Отключаем кнопку презентации, если сет-лист сброшен
        if (startPresentationButton) startPresentationButton.disabled = true;
        return;
    }

    // 3. Показываем индикатор загрузки и очищаем массив песен
    currentSetlistSongsContainer.innerHTML = '<div class="loading-message">Загрузка песен сет-листа...</div>';
    currentSetlistSongs = [];
    // Временно отключаем кнопку презентации во время загрузки
    if (startPresentationButton) startPresentationButton.disabled = true;


    // 4. Создаем путь к подколлекции песен и запрос с сортировкой по полю 'order'
    const songsCollectionRef = collection(db, "setlists", setlistId, "songs");
    const q = query(songsCollectionRef, orderBy("order", "asc")); // Сортируем по порядку

    console.log(`Установка слушателя для песен сет-листа ID: ${setlistId}`);

    // 5. Устанавливаем нового слушателя (onSnapshot) для песен
    currentSetlistSongsUnsubscribe = onSnapshot(q, (snapshot) => {
        // Проверяем, что ID сет-листа не изменился, пока мы ждали ответ
        if (setlistId !== currentSetlistId) {
            console.warn(`Получен снимок песен для ${setlistId}, но текущий сет-лист уже ${currentSetlistId}. Игнорируем.`);
            return;
        }

        console.log(`Слушатель песен для ${setlistId} сработал. Документов: ${snapshot.size}`);

        // Перепроверяем контейнер
        const container = document.getElementById('current-setlist-songs-container');
         if (!container) {
             console.error("!!! Контейнер #current-setlist-songs-container исчез во время работы onSnapshot песен!");
             if (currentSetlistSongsUnsubscribe) {
                 currentSetlistSongsUnsubscribe();
                 currentSetlistSongsUnsubscribe = null;
             }
             return;
         }

        container.innerHTML = ''; // Очищаем контейнер перед отрисовкой
        currentSetlistSongs = []; // Очищаем массив перед заполнением

        if (snapshot.empty) {
            container.innerHTML = '<div class="empty-message">В этом сет-листе пока нет песен.</div>';
             // Отключаем кнопку презентации, если песен нет
            if (startPresentationButton) startPresentationButton.disabled = true;
            return;
        }

        // 6. Обрабатываем и отображаем каждую песню
        snapshot.docs.forEach((songDoc) => {
            const songData = songDoc.data();
            const songDocId = songDoc.id; // ID документа песни ВНУТРИ сет-листа

            // Сохраняем данные песни в глобальный массив (для презентации и других нужд)
            // Добавляем ID документа Firestore к данным песни
            currentSetlistSongs.push({ firestoreDocId: songDocId, ...songData });

            // Создаем элемент для отображения в списке
            const songItem = document.createElement('div');
            songItem.className = 'setlist-song-item';
            songItem.dataset.id = songDocId; // Сохраняем ID документа песни
            // Добавляем data-атрибуты оригинальной песни для возможности быстрого перехода
            songItem.dataset.sheet = songData.sheet; // Полное имя листа
            songItem.dataset.index = songData.index;
            songItem.dataset.key = songData.preferredKey; // Сохраняем тональность

            // Информация о песне (название и тональность)
            const songInfo = document.createElement('span');
            songInfo.className = 'song-name';
            songInfo.textContent = `${songData.name || 'Без названия'} — ${songData.preferredKey || 'N/A'}`;
            songItem.appendChild(songInfo);

            // Кнопка удаления песни ИЗ СЕТ-ЛИСТА
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.className = 'delete-button delete-song-from-setlist-button';
            deleteBtn.title = 'Удалить песню из этого сет-листа';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Остановить всплытие, чтобы не сработал клик по songItem
                deleteSongFromSetlist(songDocId); // Вызываем функцию удаления
            });
            songItem.appendChild(deleteBtn);

            // Обработчик клика по элементу песни (для перехода к ней в основном окне)
            songItem.addEventListener('click', async () => {
                console.log(`Клик по песне "${songData.name}" в сет-листе.`);
                 const fullSheetName = songItem.dataset.sheet;
                 const songIndex = parseInt(songItem.dataset.index, 10);
                 const preferredKey = songItem.dataset.key;

                // Проверяем, есть ли данные песни в кэше
                if (!fullSheetName || isNaN(songIndex) || !cachedData[fullSheetName]?.[songIndex]) {
                    console.log(`Данные для <span class="math-inline">\{songData\.name\} \(</span>{fullSheetName}) не найдены в кэше, загружаем...`);
                    const sheetKey = Object.keys(SHEETS).find(key => SHEETS[key] === fullSheetName);
                    if (sheetKey) {
                         await fetchSheetData(sheetKey); // Загружаем лист по ключу
                    } else {
                         console.error(`Не найден ключ для листа ${fullSheetName}`);
                         alert(`Ошибка: Неизвестный лист "${fullSheetName}" для песни.`);
                         return;
                    }

                    // Повторная проверка
                    if (!cachedData[fullSheetName]?.[songIndex]) {
                        alert(`Не удалось найти или загрузить данные песни "${songData.name}". Возможно, она была удалена из исходной таблицы.`);
                        return;
                    }
                }
                // Данные найдены
                const originalSongData = cachedData[fullSheetName][songIndex];
                const shortSheetKey = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === fullSheetName);

                if (sheetSelect && shortSheetKey) {
                    sheetSelect.value = shortSheetKey; // Выбираем нужный лист в select
                    await loadSheetSongs(); // Перезагружаем список песен для этого листа
                }

                if (songSelect) {
                    songSelect.value = songIndex; // Выбираем нужную песню в select
                }

                // Отображаем песню с тональностью из сет-листа
                displaySongDetails(originalSongData, songIndex, preferredKey);

                // Закрываем боковые панели
                if (favoritesPanel) favoritesPanel.classList.remove('open');
                if (repertoirePanel) repertoirePanel.classList.remove('open');
            });

            container.appendChild(songItem); // Добавляем элемент песни в контейнер
        });

        // Включаем кнопку презентации, если песни загружены
        if (startPresentationButton) startPresentationButton.disabled = false;

        // Здесь можно будет инициализировать Drag-and-Drop, если потребуется

    }, (error) => {
        // Проверяем, что ID сет-листа не изменился, пока мы ждали ошибку
        if (setlistId !== currentSetlistId) {
            console.warn(`Получена ошибка для песен ${setlistId}, но текущий сет-лист уже ${currentSetlistId}. Игнорируем.`);
            return;
        }
        console.error(`Ошибка при загрузке песен для сет-листа ${setlistId}:`, error);

        const container = document.getElementById('current-setlist-songs-container');
         if(container) {
            container.innerHTML = '<div class="empty-message error-message">Ошибка загрузки песен сет-листа.</div>';
         }
        currentSetlistSongs = []; // Очищаем массив при ошибке

         // Отключаем кнопку презентации при ошибке
         if (startPresentationButton) startPresentationButton.disabled = true;

        // Отписываемся при ошибке, чтобы не пытаться слушать дальше
        if (currentSetlistSongsUnsubscribe) {
            console.log("Отписка от слушателя песен из-за ошибки.");
            currentSetlistSongsUnsubscribe();
            currentSetlistSongsUnsubscribe = null;
        }
        alert("Произошла ошибка при загрузке песен сет-листа.");
    });
}


/** Добавляет текущую выбранную песню в ТЕКУЩИЙ выбранный сет-лист */
async function addToCurrentSetlist() {
    console.log("Попытка добавить песню в текущий сет-лист...");

    // 1. Проверяем, выбран ли сет-лист
    if (!currentSetlistId) {
        alert("Пожалуйста, сначала выберите или создайте сет-лист в панели слева, куда нужно добавить песню.");
        // Попытаемся открыть левую панель, если она закрыта
        if (favoritesPanel && !favoritesPanel.classList.contains('open') && toggleFavoritesButton) {
            toggleFavoritesButton.click(); // Открываем панель со списками
        }
        return;
    }

    // 2. Получаем данные текущей выбранной песни из интерфейса
    const sheetKey = sheetSelect?.value;
    const fullSheetName = SHEETS[sheetKey];
    const songIndexStr = songSelect?.value;

    if (!sheetKey || !fullSheetName || songIndexStr === null || songIndexStr === "" || !cachedData[fullSheetName]?.[songIndexStr]) {
        alert("Пожалуйста, сначала выберите песню, которую хотите добавить в сет-лист.");
        if (songSelect) songSelect.focus();
        return;
    }
    const songIndex = parseInt(songIndexStr, 10);
    const songData = cachedData[fullSheetName][songIndex];
    const songName = songData?.[0]; // Название
    const preferredKey = keySelect?.value; // Тональность из селектора

    if (!songName || !preferredKey) {
         alert("Не удалось получить данные песни или тональность для добавления в сет-лист.");
         return;
    }

    console.log(`Добавляем: Песня="<span class="math-inline">\{songName\}", Тональность\=</span>{preferredKey}, Лист=<span class="math-inline">\{fullSheetName\}, Индекс\=</span>{songIndex} в Сет-лист ID=<span class="math-inline">\{currentSetlistId\} \(</span>{currentSetlistName || ''})`);

    // 3. (Опционально) Проверка на дубликаты ВНУТРИ этого сет-листа
    // Ищем песню с таким же листом и индексом в текущем массиве песен сет-листа
    const existingSong = currentSetlistSongs.find(song => song.sheet === fullSheetName && song.index === songIndex);

    if (existingSong) {
        // Песня уже есть, спросим, не обновить ли тональность?
        if (existingSong.preferredKey !== preferredKey) {
            if (confirm(`Песня "<span class="math-inline">\{songName\}" уже есть в сет\-листе "</span>{currentSetlistName}".\nОбновить ее тональность на ${preferredKey}?`)) {
                try {
                    // Обновляем только тональность существующего документа
                    const songDocRef = doc(db, "setlists", currentSetlistId, "songs", existingSong.firestoreDocId);
                    await updateDoc(songDocRef, { preferredKey: preferredKey });
                    alert(`Тональность песни "${songName}" в сет-листе обновлена на ${preferredKey}.`);
                    // UI обновится через onSnapshot
                } catch (error) {
                     console.error("Ошибка при обновлении тональности песни в сет-листе:", error);
                     alert("Не удалось обновить тональность песни.");
                }
            }
        } else {
            // Тональность совпадает, просто сообщаем
            alert(`Песня "<span class="math-inline">\{songName\}" уже есть в сет\-листе "</span>{currentSetlistName}" с той же тональностью (${preferredKey}).`);
        }
        return; // Выходим, не добавляем заново
    }

    // 4. Определяем порядок (order) для новой песни
    // Находим максимальный 'order' среди уже существующих песен + 1
    // Если песен нет, order = 0
    const nextOrder = currentSetlistSongs.length > 0
        ? Math.max(...currentSetlistSongs.map(song => song.order ?? -1)) + 1
        : 0;
    console.log("Следующий порядок (order) для новой песни:", nextOrder);

    // 5. Готовим данные для сохранения нового документа в Firestore
    const songEntryData = {
        sheet: fullSheetName,       // Полное имя листа
        index: songIndex,           // Индекс песни на листе (число)
        name: songName,             // Название песни (дублируем для удобства)
        preferredKey: preferredKey, // Выбранная тональность
        order: nextOrder            // Порядковый номер в сет-листе
        // createdAt: new Date() // Можно добавить время добавления
    };

    // 6. Добавляем песню в подколлекцию 'songs' текущего сет-листа
    try {
        const songsCollectionRef = collection(db, "setlists", currentSetlistId, "songs");
        const docRef = await addDoc(songsCollectionRef, songEntryData);
        console.log(`Песня успешно добавлена в сет-лист ${currentSetlistId} с ID документа: ${docRef.id}`);
        alert(`Песня "<span class="math-inline">\{songName\}" \(</span>{preferredKey}) добавлена в сет-лист "${currentSetlistName}".`);
        // Список песен обновится автоматически через onSnapshot в loadCurrentSetlistSongs
    } catch (error) {
        console.error("Ошибка при добавлении песни в сет-лист:", error);
        alert("Произошла ошибка при добавлении песни в сет-лист. Проверьте консоль.");
    }
}

/** Удаление ОДНОЙ песни из ТЕКУЩЕГО сет-листа */
async function deleteSongFromSetlist(songDocId) {
    // Проверяем, выбран ли сет-лист и есть ли ID песни
    if (!currentSetlistId || !songDocId) {
        console.error("deleteSongFromSetlist: Не выбран сет-лист или не передан ID песни.");
        alert("Произошла ошибка: невозможно удалить песню (отсутствуют идентификаторы).");
        return;
    }

    // Находим данные песни в текущем массиве, чтобы показать имя в подтверждении
    const songToDelete = currentSetlistSongs.find(song => song.firestoreDocId === songDocId);
    const songNameToConfirm = songToDelete ? `"${songToDelete.name}"` : "эту песню";
    const setlistNameToConfirm = currentSetlistName || 'текущего сет-листа';

    // Запрашиваем подтверждение
    if (confirm(`Вы уверены, что хотите удалить <span class="math-inline">\{songNameToConfirm\} из сет\-листа "</span>{setlistNameToConfirm}"?`)) {
        console.log(`Попытка удаления песни ${songDocId} из сет-листа ${currentSetlistId}`);
        try {
            // Получаем ссылку на документ песни в подколлекции
            const songDocRef = doc(db, "setlists", currentSetlistId, "songs", songDocId);
            // Удаляем документ
            await deleteDoc(songDocRef);
            console.log("Песня успешно удалена из сет-листа.");
            alert("Песня удалена из сет-листа.");
            // UI обновится автоматически через onSnapshot в loadCurrentSetlistSongs
        } catch (error) {
            console.error("Ошибка при удалении песни из сет-листа:", error);
            alert("Не удалось удалить песню из сет-листа. Проверьте консоль.");
        }
    } else {
         console.log("Удаление песни из сет-листа отменено пользователем.");
    }
}

/** Удаление ВСЕГО ТЕКУЩЕГО сет-листа */
async function deleteCurrentSetlist() {
    // Проверяем, выбран ли сет-лист
    if (!currentSetlistId || !currentSetlistName) {
        alert("Сначала выберите сет-лист, который хотите удалить.");
        return;
    }

    // Запрашиваем подтверждение (более строгое)
    if (confirm(`ВЫ УВЕРЕНЫ, что хотите ПОЛНОСТЬЮ удалить сет-лист "${currentSetlistName}"?\n\nЭто действие НЕОБРАТИМО и удалит сам сет-лист и все добавленные в него песни (из этого сет-листа).\nСами песни в общих таблицах останутся.`)) {
        console.log(`Попытка удаления сет-листа ID: <span class="math-inline">\{currentSetlistId\}, Имя\: "</span>{currentSetlistName}"`);

        // Блокируем кнопку удаления на время операции
        if(deleteSetlistButton) deleteSetlistButton.disabled = true;

        try {
            // --- Удаление подколлекции песен (рекомендуется делать через Cloud Functions для надежности, но попробуем на клиенте) ---
            console.log(`Удаление песен из подколлекции setlists/${currentSetlistId}/songs...`);
            const songsCollectionRef = collection(db, "setlists", currentSetlistId, "songs");
            const songsSnapshot = await getDocs(songsCollectionRef);
            const deletePromises = [];
            songsSnapshot.forEach((songDoc) => {
                console.log(`  - Планируем удаление песни ID: ${songDoc.id}`);
                deletePromises.push(deleteDoc(doc(db, "setlists", currentSetlistId, "songs", songDoc.id)));
            });
            // Ожидаем завершения всех удалений песен
            await Promise.all(deletePromises);
            console.log(`Все песни (${deletePromises.length} шт.) из подколлекции удалены.`);
            // --- Конец удаления подколлекции ---

            // Теперь удаляем сам документ сет-листа
            console.log(`Удаление документа сет-листа ID: ${currentSetlistId}`);
            const setlistDocRef = doc(db, "setlists", currentSetlistId);
            await deleteDoc(setlistDocRef);

            console.log("Сет-лист и его песни успешно удалены.");
            alert(`Сет-лист "${currentSetlistName}" и все его песни были удалены.`);

            // Сбрасываем выбор текущего сет-листа в интерфейсе
            selectSetlist(null, null);
            // Список сет-листов обновится автоматически через onSnapshot в loadSetlists

        } catch (error) {
            console.error("Ошибка при удалении сет-листа или его песен:", error);
            alert("Произошла ошибка при удалении сет-листа. Возможно, удалилась только часть данных. Проверьте консоль.");
        } finally {
             // Разблокируем кнопку в любом случае
             if(deleteSetlistButton) deleteSetlistButton.disabled = false;
        }
    } else {
         console.log("Удаление сет-листа отменено пользователем.");
    }
}

/** Вход в режим редактирования имени сет-листа */
function startEditSetlistName(itemElement, id, currentName) {
    // Если уже редактируем другой элемент, отменяем его
    const currentlyEditing = document.querySelector('.setlist-item.is-editing');
    if (currentlyEditing && currentlyEditing !== itemElement) {
        cancelEditSetlistName(currentlyEditing);
    }

    // Если кликнули по уже редактируемому - ничего не делаем
    if (itemElement.classList.contains('is-editing')) {
        return;
    }

    itemElement.classList.add('is-editing'); // Добавляем класс для скрытия span/кнопки через CSS

    // Находим элементы внутри itemElement
    const nameSpan = itemElement.querySelector('span.setlist-name-display');
    const editButton = itemElement.querySelector('.setlist-edit-button');

    // Создаем поле ввода
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-setlist-input';
    input.value = currentName || ''; // Используем текущее имя
    input.dataset.originalName = currentName || ''; // Сохраняем оригинальное имя для сравнения
    input.required = true; // Делаем поле обязательным (для UI)

    // Вставляем поле ввода ПЕРЕД кнопкой редактирования (которая теперь скрыта CSS)
    if (editButton) {
        itemElement.insertBefore(input, editButton);
    } else if (nameSpan) { // Если кнопки нет, вставляем после span
        nameSpan.after(input);
    } else { // Совсем крайний случай
        itemElement.prepend(input);
    }

    input.focus(); // Ставим фокус на поле ввода
    input.select(); // Выделяем текст для удобства редактирования

    // --- Обработчики для сохранения/отмены ---
    // Сохранение по потере фокуса (blur)
    input.addEventListener('blur', () => {
        // Небольшая задержка нужна, чтобы дать время сработать keydown Enter или Escape
        setTimeout(() => {
             // Проверяем, что элемент все еще в DOM и в режиме редактирования
             if (document.body.contains(input) && itemElement.classList.contains('is-editing')) {
                 saveSetlistName(id, input, itemElement);
             }
        }, 150); // Немного увеличил задержку
    });

    // Сохранение по Enter, отмена по Escape
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Предотвращаем стандартное поведение (отправку формы, если она есть)
            saveSetlistName(id, input, itemElement);
        } else if (e.key === 'Escape') {
            e.preventDefault(); // Предотвращаем стандартное поведение (например, закрытие модального окна)
            cancelEditSetlistName(itemElement);
        }
    });
}

/** Сохранение нового имени сет-листа в Firestore */
async function saveSetlistName(id, inputElement, itemElement) {
    // Проверяем, существует ли еще элемент ввода и режим редактирования
    if (!inputElement || !itemElement.classList.contains('is-editing')) {
        return; // Возможно, редактирование уже было отменено (например, по Escape)
    }

    const newName = inputElement.value.trim();
    const originalName = inputElement.dataset.originalName;

    // Если имя пустое, сообщаем пользователю и НЕ сохраняем
    if (!newName) {
        alert("Название сет-листа не может быть пустым.");
        inputElement.focus(); // Возвращаем фокус на поле
        // Не отменяем редактирование здесь, даем шанс исправить
        return;
    }

    // Если имя не изменилось, просто отменяем режим редактирования
    if (newName === originalName) {
        console.log("Имя сет-листа не изменилось, отмена редактирования.");
        cancelEditSetlistName(itemElement);
        return;
    }

    console.log(`Сохранение нового имени "${newName}" для сет-листа ID: ${id}`);
    // Опционально: Показать индикатор сохранения
    inputElement.disabled = true; // Блокируем поле на время сохранения

    try {
        const setlistDocRef = doc(db, "setlists", id);
        // Обновляем только поле 'name'
        await updateDoc(setlistDocRef, { name: newName });
        console.log("Имя сет-листа успешно обновлено в Firestore.");

        // Обновляем имя в span перед тем, как его показать
        const nameSpan = itemElement.querySelector('span.setlist-name-display');
        if (nameSpan) {
            nameSpan.textContent = newName;
        }

        // Обновляем имя в заголовке текущего сет-листа, если редактировали именно его
        if (id === currentSetlistId && currentSetlistTitle) {
            currentSetlistTitle.textContent = newName;
            currentSetlistName = newName; // Обновляем и глобальное состояние имени
        }

        cancelEditSetlistName(itemElement); // Завершаем режим редактирования
        // alert("Имя сет-листа успешно обновлено!"); // Можно добавить уведомление, если нужно

    } catch (error) {
        console.error("Ошибка при обновлении имени сет-листа:", error);
        alert("Не удалось обновить имя сет-листа. Проверьте консоль.");
        // Разблокируем поле ввода в случае ошибки
        inputElement.disabled = false;
        inputElement.focus(); // Возвращаем фокус
        // Не отменяем редактирование, даем шанс попробовать снова
    }
}

/** Отмена режима редактирования имени сет-листа */
function cancelEditSetlistName(itemElement) {
    if (!itemElement || !itemElement.classList.contains('is-editing')) {
        return; // Если элемент не найден или не в режиме редактирования, выходим
    }

    const input = itemElement.querySelector('input.edit-setlist-input');
    if (input) {
        // Убираем обработчики, чтобы избежать утечек памяти и случайных срабатываний
        input.removeEventListener('blur', saveSetlistName); // Нужно передавать ту же функцию, но без параметров это сложно
        // Проще просто удалить элемент
        itemElement.removeChild(input); // Удаляем поле ввода
        console.log("Режим редактирования имени отменен, поле ввода удалено.");
    }
    itemElement.classList.remove('is-editing'); // Убираем класс (CSS снова покажет span и кнопку)
    // Фокус можно вернуть на сам элемент списка для доступности
    // itemElement.focus(); // Раскомментировать, если нужно
}

// --- КОНЕЦ ФУНКЦИЙ ДЛЯ СЕТ-ЛИСТОВ ---


// --- CORE LOGIC / UTILITIES ---

/** Расчет смещения (количества полутонов) для транспонирования */
function getTransposition(originalKey, newKey) {
    const originalIndex = chords.indexOf(originalKey);
    const newIndex = chords.indexOf(newKey);

    // Если одна из тональностей не найдена в массиве chords
    if (originalIndex === -1 || newIndex === -1) {
        console.warn(`Неверная тональность(ти) для транспонирования: ${originalKey} -> ${newKey}. Транспонирование не будет выполнено.`);
        return 0; // Возвращаем 0, чтобы текст остался без изменений
    }

    // Рассчитываем смещение, учитывая цикличность (12 полутонов)
    let transposition = newIndex - originalIndex;
    // Можно оставить и без этого, так как % 12 сделает то же самое в transposeChord
    // if (transposition > 6) transposition -= 12;
    // if (transposition <= -6) transposition += 12;
    return transposition;
}

/** Транспонирование одного аккорда с учетом суффиксов и басовой ноты */
function transposeChord(chord, transposition) {
    // Если смещение 0, возвращаем оригинальный аккорд
    if (transposition === 0) return chord;

    // Регулярное выражение для разбора аккорда:
    // Группа 1: Основная нота ([A-H])
    // Группа 2: Знак альтерации (# или b) - необязательно
    // Группа 3: Суффикс аккорда (типа m, 7, maj7, sus4, dim, aug и т.д.) - необязательно
    // Группа 4: Слэш и басовая нота (включая ее знак альтерации) - необязательно
    const chordRegex = /^([A-H])([#b]?)((?:maj|min|m|sus|dim|aug|add|°|ø)?[0-9]*(?:sus|add)?[0-9]*)?(\/[A-H][#b]?)?$/;
    const match = chord.match(chordRegex);

    // Если аккорд не соответствует формату, возвращаем как есть
    if (!match) {
        // console.warn(`Не удалось распознать аккорд для транспонирования: "${chord}"`);
        return chord;
    }

    const baseNote = match[1]; // C, D, E...
    const accidental = match[2] || ''; // #, b или ''
    const suffix = match[3] || ''; // m, 7, maj7...
    const bassPart = match[4] || ''; // /G, /F#...

    const originalChordRoot = baseNote + accidental; // C#, Db, G...
    const originalIndex = chords.indexOf(originalChordRoot);

    // Если основная нота не найдена в нашем массиве chords
    if (originalIndex === -1) {
        // console.warn(`Не найдена основная нота "${originalChordRoot}" в массиве аккордов.`);
        return chord; // Возвращаем без изменений
    }

    // Вычисляем новый индекс с учетом смещения и цикличности
    // Добавляем chords.length, чтобы избежать отрицательных результатов перед взятием остатка
    const newIndex = (originalIndex + transposition + chords.length) % chords.length;
    const transposedRoot = chords[newIndex]; // Новая основная нота (с диезом/бемолем, если нужно)

    // Транспонируем басовую ноту, если она есть
    let transposedBassPart = '';
    if (bassPart) {
        const bassNoteMatch = bassPart.match(/^\/([A-H][#b]?)$/);
        if (bassNoteMatch) {
            const originalBassRoot = bassNoteMatch[1];
            const originalBassIndex = chords.indexOf(originalBassRoot);
            if (originalBassIndex !== -1) {
                const newBassIndex = (originalBassIndex + transposition + chords.length) % chords.length;
                transposedBassPart = '/' + chords[newBassIndex];
            } else {
                // Если басовая нота не найдена, оставляем ее как есть
                transposedBassPart = bassPart;
            }
        } else {
             // Если не удалось разобрать басовую часть, оставляем как есть
            transposedBassPart = bassPart;
        }
    }

    // Собираем транспонированный аккорд
    return transposedRoot + suffix + transposedBassPart;
}

/** Очистка строки с аккордом от лишних пробелов (используется перед транспонированием) */
function cleanChord(chord) {
    // Удаляем пробелы в начале и конце, а также множественные пробелы внутри
    return chord.trim().replace(/\s+/g, '');
}


/** Транспонирование всего текста песни с аккордами */
function transposeLyrics(lyrics, transposition) {
    if (!lyrics) return ''; // Если текста нет, возвращаем пустую строку
    if (transposition === 0) return lyrics; // Если смещение 0, транспонировать не нужно

    // Регулярное выражение для поиска аккордов в тексте.
    // Оно должно находить аккорды, окруженные пробелами или стоящие в начале/конце строки,
    // или перед/после знаков препинания, чтобы не трогать слова, похожие на аккорды.
    // (?:^|\s|\[|\(|>|\|) - начало строки, пробел, или скобки/разделители до аккорда
    // ([A-H][#b]?(?:(?:maj|min|m|sus|dim|aug|add|°|ø)?[0-9]*(?:sus|add)?[0-9]*)?(?:\/[A-H][#b]?)?) - сам аккорд (как в transposeChord)
    // (?=\s|$|\]|\)|<|\||,) - пробел, конец строки, скобки/разделители или запятая после аккорда
    const chordRegex = /(?:^|\s|\[|\(|>|\|)([A-H][#b]?(?:(?:maj|min|m|sus|dim|aug|add|°|ø)?[0-9]*(?:sus|add)?[0-9]*)?(?:\/[A-H][#b]?))(?=\s|$|\]|\)|<|\||,)/g;

    return lyrics.replace(chordRegex, (match, chordToTranspose) => {
        // match содержит пробел/скобку ДО аккорда + сам аккорд
        // chordToTranspose - это только сам аккорд (захваченная группа 1)

        // Транспонируем найденный аккорд
        const transposed = transposeChord(chordToTranspose, transposition);

        // Возвращаем пробел/скобку + транспонированный аккорд
        // Нужно извлечь символ(ы) перед аккордом из `match`
        const prefix = match.substring(0, match.indexOf(chordToTranspose));
        return prefix + transposed;
    });
}

/**
 * Обработка строк текста песни:
 * 1. Заменяет множественные пробелы (>1) на один пробел.
 * (Убрана логика сокращения до половины - она могла ломать выравнивание).
 */
function processLyrics(lyrics) {
    if (!lyrics) return '';
    return lyrics.split('\n').map(line => {
        // Заменяем 2 и более пробелов на один пробел
        return line.replace(/ {2,}/g, ' ');
    }).join('\n');
}

/** Выделение аккордов в тексте тегами <span class="chord"> для стилизации */
function highlightChords(lyrics) {
    if (!lyrics) return '';
    // Используем то же регулярное выражение, что и в transposeLyrics, но для замены
    const chordRegex = /(?:^|\s|\[|\(|>|\|)([A-H][#b]?(?:(?:maj|min|m|sus|dim|aug|add|°|ø)?[0-9]*(?:sus|add)?[0-9]*)?(?:\/[A-H][#b]?))(?=\s|$|\]|\)|<|\||,)/g;

    return lyrics.replace(chordRegex, (match, chordToHighlight) => {
        // Извлекаем префикс (пробел/скобку)
        const prefix = match.substring(0, match.indexOf(chordToHighlight));
        // Оборачиваем аккорд в span
        return `<span class="math-inline">\{prefix\}<span class\="chord"\></span>{chordToHighlight}</span>`;
    });
}


/** Поиск песен по названию во всех загруженных листах */
async function searchSongs(query) {
    const lowerQuery = query.trim().toLowerCase();

    if (!searchResults) return; // Если элемента для результатов нет, выходим

    searchResults.innerHTML = ''; // Очищаем предыдущие результаты

    if (!lowerQuery) {
        return; // Если запрос пустой, просто очищаем и выходим
    }

    console.log(`Поиск по запросу: "${query}"`);
    searchResults.innerHTML = '<div class="search-result loading">Идет поиск...</div>';

    // Собираем все песни из кэша (cachedData)
    const matchingSongs = [];
    for (const fullSheetName in cachedData) {
        if (cachedData.hasOwnProperty(fullSheetName)) {
            cachedData[fullSheetName].forEach((row, index) => {
                const songName = row?.[0]?.trim().toLowerCase(); // Название песни (столбец A)
                if (songName && songName.includes(lowerQuery)) {
                    // Нашли совпадение, добавляем информацию
                    matchingSongs.push({
                        name: row[0], // Оригинальное название
                        sheet: fullSheetName, // Полное имя листа
                        index: index, // Индекс строки
                        originalData: row // Полные данные строки (для displaySongDetails)
                    });
                }
            });
        }
    }

    // --- Отображение результатов ---
    searchResults.innerHTML = ''; // Очищаем "Идет поиск..."

    if (matchingSongs.length === 0) {
        searchResults.innerHTML = '<div class="search-result empty">Ничего не найдено по запросу "' + query + '"</div>';
        return;
    }

    // Сортируем найденные песни по названию
    matchingSongs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    matchingSongs.forEach((songInfo) => {
        const resultItem = document.createElement('div');
        // Отображаем название и лист (короткое имя)
        const shortSheetKey = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === songInfo.sheet);
        const displaySheetName = shortSheetKey ? `(${shortSheetKey})` : '';
        resultItem.textContent = `${songInfo.name} ${displaySheetName}`;
        resultItem.className = 'search-result';
        resultItem.title = `Выбрать: ${songInfo.name} из листа ${songInfo.sheet}`;

        // Обработчик клика по результату поиска
        resultItem.addEventListener('click', async () => {
            console.log(`Выбрана песня из поиска: ${songInfo.name}, Лист: ${songInfo.sheet}, Индекс: ${songInfo.index}`);

            const sheetKey = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === songInfo.sheet);

            if (sheetSelect && sheetKey) {
                sheetSelect.value = sheetKey; // Выбираем нужный лист
                await loadSheetSongs(); // Перезагружаем select песен
            } else {
                console.warn("Не удалось найти select листа или ключ для:", songInfo.sheet);
            }

            if (songSelect) {
                songSelect.value = songInfo.index; // Выбираем песню по индексу
            }

            // Отображаем детали песни (передаем полные данные и индекс)
            // Тональность по умолчанию берется из таблицы (третий аргумент не передаем)
            displaySongDetails(songInfo.originalData, songInfo.index);

            searchResults.innerHTML = ''; // Скрываем результаты поиска
            if (searchInput) {
                searchInput.value = songInfo.name; // Показываем полное имя в поле поиска
                searchInput.blur(); // Убираем фокус с поля поиска
            }
            // Закрываем боковые панели, если открыты
            if (favoritesPanel) favoritesPanel.classList.remove('open');
            if (repertoirePanel) repertoirePanel.classList.remove('open');

        });
        searchResults.appendChild(resultItem);
    });
}

/** Извлечение ID видео YouTube из URL (улучшенная версия) */
function extractYouTubeVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    let videoId = null;
    try {
        // Регулярное выражение для обработки разных форматов URL YouTube
        const patterns = [
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,           // Standard URL
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/,            // Embed URL
            /(?:https?:\/\/)?youtu\.be\/([^?]+)/,                                // Shortened URL
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([^?]+)/,                 // V URL
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/user\/.+\/([^/]+)$/,          // User channel URL (last part might be ID) - less reliable
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/.*?v=([\w-]{11})/,             // More generic find v= parameter
             /^([\w-]{11})$/                                                       // Plain 11-character ID
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1] && match[1].length === 11) { // ID должен быть 11 символов
                 // Дополнительная проверка, чтобы исключить явно невалидные ID
                if (/^[a-zA-Z0-9_-]+$/.test(match[1])) {
                    videoId = match[1];
                    break; // Нашли валидный ID, выходим из цикла
                 }
            }
        }
    } catch (e) {
        console.error("Ошибка при извлечении YouTube video ID:", e);
        return null;
    }
    // console.log(`Extracted video ID from "${url}": ${videoId}`); // Отладка
    return videoId; // Вернет ID или null
}

/** Проверяет, активен ли мобильный вид (ширина окна <= 480px) */
function isMobileView() {
    // Используем ту же точку останова (breakpoint), что и в CSS (@media (max-width: 480px))
    // window.innerWidth может быть не самым надежным способом, но для простоты подойдет
    return window.innerWidth <= 480;
}

// --- UI UPDATE FUNCTIONS ---

/** Запускает режим презентации с переданным списком песен */
async function showPresentationView(songsToShow) {
    // Проверяем наличие необходимых элементов DOM и данных
    if (!presentationOverlay || !presentationContent || !songsToShow || songsToShow.length === 0) {
        console.error("Невозможно показать презентацию: отсутствует оверлей, контейнер контента или список песен пуст.");
        alert("Не удалось запустить режим презентации. Нет данных для отображения.");
        return;
    }
    console.log(`Запуск режима презентации с ${songsToShow.length} песнями.`);

    // Копируем песни в локальную переменную для презентации (во избежание модификации оригинала)
    presentationSongs = [...songsToShow]; // Используем spread для создания неглубокой копии
    currentPresentationIndex = 0;       // Начинаем с первой песни (индекс 0)
    isPresentationSplit = false;        // Сброс состояния разделения при каждом входе
    updatePresentationSplitButtonState(); // Обновить вид кнопки разделения

    // Опционально: Скрываем скролл основной страницы, пока открыт оверлей
    // document.body.style.overflow = 'hidden'; // Может вызвать скачок контента

    // Отображаем первую песню (асинхронно, т.к. может потребоваться загрузка из кэша/сети)
    await displayCurrentPresentationSong();

    presentationOverlay.classList.add('visible'); // Показываем сам оверлей
    presentationOverlay.scrollTop = 0;            // Прокручиваем оверлей наверх на всякий случай

    showPresentationControls(); // Показываем панель управления (и запускаем таймер автоскрытия)

    // Попытка включить полноэкранный режим (опционально, может не работать на всех устройствах/браузерах)
    /*
    try {
        if (presentationOverlay.requestFullscreen) {
            await presentationOverlay.requestFullscreen();
        } else if (presentationOverlay.webkitRequestFullscreen) { // Safari
            await presentationOverlay.webkitRequestFullscreen();
        } else if (presentationOverlay.msRequestFullscreen) { // IE11
            await presentationOverlay.msRequestFullscreen();
        }
    } catch (err) {
        console.warn(`Не удалось войти в полноэкранный режим: <span class="math-inline">\{err\.message\} \(</span>{err.name})`);
    }
    */
}

/** Отображает ТЕКУЩУЮ песню (по currentPresentationIndex) в режиме презентации */
async function displayCurrentPresentationSong() {
    if (presentationSongs.length === 0 || !presentationContent) {
        console.warn("Нет песен для отображения в презентации или отсутствует контейнер.");
         if(presentationContent) presentationContent.innerHTML = '<div class="presentation-song error">Нет данных для отображения.</div>';
        return;
    }

    // Убедимся, что индекс находится в допустимых границах
    if (currentPresentationIndex < 0) currentPresentationIndex = 0;
    if (currentPresentationIndex >= presentationSongs.length) currentPresentationIndex = presentationSongs.length - 1;

    const song = presentationSongs[currentPresentationIndex]; // Получаем данные текущей песни из массива presentationSongs
    console.log(`Презентация: Показываем песню <span class="math-inline">\{currentPresentationIndex \+ 1\}/</span>{presentationSongs.length}: "${song.name}", Лист: ${song.sheet}, Индекс: ${song.index}, Тональность: ${song.preferredKey}`);

    // Временно показываем индикатор загрузки внутри контейнера
    presentationContent.innerHTML = `<div class="presentation-loading">Загрузка песни "${song.name}"...</div>`;

    try {
        // --- Получение и подготовка данных песни ---
        const fullSheetName = song.sheet; // Полное имя листа из данных песни
        const songIndex = song.index;
        const targetKey = song.preferredKey; // Целевая тональность из данных песни

        // Проверяем наличие данных в кэше, если нет - загружаем
        if (!cachedData[fullSheetName]?.[songIndex]) {
            console.log(`Presentation: Загрузка данных для <span class="math-inline">\{song\.name\} \(</span>{fullSheetName})`);
            const sheetKey = Object.keys(SHEETS).find(key => SHEETS[key] === fullSheetName);
            if (sheetKey) {
                 await fetchSheetData(sheetKey); // Загружаем по ключу
            } else {
                 throw new Error(`Не найден ключ для листа "${fullSheetName}"`);
            }
        }

        // Получаем оригинальные данные песни из кэша (после возможной загрузки)
        const originalSongData = cachedData[fullSheetName]?.[songIndex];
        if (!originalSongData) {
             throw new Error(`Не удалось найти или загрузить данные для песни "<span class="math-inline">\{song\.name\}" с листа "</span>{fullSheetName}", индекс ${songIndex}.`);
        }

        // Извлекаем нужные поля из оригинальных данных
        const songTitle = originalSongData[0] || song.name || 'Без названия'; // Название
        const originalLyrics = originalSongData[1] || ''; // Оригинальный текст
        const originalKeyFromSheet = originalSongData[2]; // Оригинальная тональность из таблицы

        // Выполняем транспонирование, если тональности отличаются
        const transposition = getTransposition(originalKeyFromSheet, targetKey);
        const transposedLyrics = transposeLyrics(originalLyrics, transposition);

        // Обрабатываем пробелы и подсвечиваем аккорды
        const processedLyrics = processLyrics(transposedLyrics);
        const highlightedLyrics = highlightChords(processedLyrics);

        // --- Формирование HTML для ОДНОЙ песни ---
        const songHtml = `
            <div class="presentation-song">
                <h2>${songTitle} — <span class="math-inline">\{targetKey \|\| 'N/A'\}</h2\>
<pre\></span>{highlightedLyrics || 'Нет текста песни.'}</pre>
            </div>
        `;
        // Вставляем готовый HTML в контейнер
        presentationContent.innerHTML = songHtml;

        // Применяем класс разделения колонок, если он активен
        presentationContent.classList.toggle('split-columns', isPresentationSplit);

        // Прокрутка содержимого конкретно этой песни наверх (если контент длинный)
        const songElement = presentationContent.querySelector('.presentation-song pre');
        if (songElement) songElement.scrollTop = 0;

    } catch (error) {
        console.error("Ошибка при отображении песни в презентации:", error);
        // Показываем сообщение об ошибке вместо песни
        presentationContent.innerHTML = `
            <div class="presentation-song error">
                <h2>Ошибка загрузки песни "<span class="math-inline">\{song\.name \|\| 'N/A'\}"</h2\>
<p\></span>{error.message}</p>
                <p>Попробуйте перейти к другой песне или закрыть презентацию.</p>
            </div>`;
    }

    // --- Обновление счетчика песен ---
    if (presCounter) {
        presCounter.textContent = `${currentPresentationIndex + 1} / ${presentationSongs.length}`;
    }

    // --- Обновление состояния кнопок "Назад" / "Вперед" ---
    if (presPrevBtn) presPrevBtn.disabled = (currentPresentationIndex === 0);
    if (presNextBtn) presNextBtn.disabled = (currentPresentationIndex >= presentationSongs.length - 1);
}

/** Переключает на СЛЕДУЮЩУЮ песню в презентации */
function nextPresentationSong() {
    if (currentPresentationIndex < presentationSongs.length - 1) { // Если это не последняя песня
        currentPresentationIndex++; // Увеличиваем индекс
        displayCurrentPresentationSong(); // Показываем песню с новым индексом
    } else {
        console.log("Презентация: Достигнут конец списка песен.");
        // Можно добавить визуальную обратную связь (например, мигание кнопки)
    }
}

/** Переключает на ПРЕДЫДУЩУЮ песню в презентации */
function prevPresentationSong() {
    if (currentPresentationIndex > 0) { // Если это не первая песня
        currentPresentationIndex--; // Уменьшаем индекс
        displayCurrentPresentationSong(); // Показываем песню с новым индексом
    } else {
         console.log("Презентация: Достигнуто начало списка песен.");
         // Можно добавить визуальную обратную связь
    }
}

// --- Функции для автоскрытия панели управления в презентации ---

const CONTROLS_HIDE_DELAY = 3000; // Время бездействия в миллисекундах (3 секунды)

/** Показывает панель управления презентацией и запускает таймер для ее скрытия */
function showPresentationControls() {
    if (!presentationControls) return; // Если панели нет, выходим

    // 1. Показываем панель (убираем класс, отвечающий за скрытие)
    presentationControls.classList.remove('controls-hidden');

    // 2. Отменяем предыдущий таймер скрытия (если он был запущен)
    clearTimeout(controlsHideTimeout);

    // 3. Запускаем новый таймер, который скроет панель через N секунд бездействия
    controlsHideTimeout = setTimeout(hidePresentationControls, CONTROLS_HIDE_DELAY);
    // console.log("Таймер автоскрытия контролов презентации запущен:", controlsHideTimeout);
}

/** Скрывает панель управления презентацией */
function hidePresentationControls() {
    if (presentationControls) {
        presentationControls.classList.add('controls-hidden'); // Добавляем класс для скрытия
        // console.log("Панель управления презентацией скрыта по таймеру.");
    }
}

/** Переключает режим разделения текста на две колонки в презентации */
function togglePresentationSplit() {
    isPresentationSplit = !isPresentationSplit; // Инвертируем состояние (true/false)
    console.log(`Режим разделения колонок в презентации: ${isPresentationSplit ? 'Включен' : 'Выключен'}`);

    // Применяем или убираем класс к контейнеру контента презентации
    if (presentationContent) {
        presentationContent.classList.toggle('split-columns', isPresentationSplit);
    }
    updatePresentationSplitButtonState(); // Обновляем вид кнопки (иконку и title)
}

/** Обновляет иконку и title кнопки разделения текста в презентации */
function updatePresentationSplitButtonState() {
    if (!presSplitTextBtn) return; // Если кнопки нет, выходим

    const iconElement = presSplitTextBtn.querySelector('i.fas'); // Находим иконку внутри кнопки
    if (!iconElement) return;

    const splitIconClass = 'fa-columns';       // Класс иконки для режима "Разделить"
    const mergeIconClass = 'fa-align-justify'; // Класс иконки для режима "Объединить"
    const splitTitle = 'Разделить текст на две колонки';
    const mergeTitle = 'Объединить колонки текста';

    // Устанавливаем нужную иконку и title в зависимости от текущего состояния isPresentationSplit
    if (isPresentationSplit) { // Если сейчас разделено
        iconElement.classList.remove(splitIconClass);
        iconElement.classList.add(mergeIconClass);
        presSplitTextBtn.title = mergeTitle;
    } else { // Если сейчас не разделено
        iconElement.classList.remove(mergeIconClass);
        iconElement.classList.add(splitIconClass);
        presSplitTextBtn.title = splitTitle;
    }
}
// --- Конец функций для автоскрытия и разделения ---

// --- Логика для Свайпов в режиме презентации ---
let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0; // Для определения, не вертикальный ли свайп
let touchEndY = 0;

// Функция определяет, был ли свайп влево или вправо, и вызывает нужную функцию
function handleSwipeGesture() {
    const swipeThreshold = 50;   // Минимальная длина свайпа по горизонтали в пикселях
    const verticalThreshold = 75; // Максимальное смещение по вертикали, чтобы не считать скролл за свайп

    const horizontalDiff = touchEndX - touchStartX; // Разница по горизонтали (<0 - влево, >0 - вправо)
    const verticalDiff = Math.abs(touchEndY - touchStartY); // Абсолютная разница по вертикали

    // Игнорируем жест, если он был больше вертикальным (похож на скролл)
    if (verticalDiff > verticalThreshold && verticalDiff > Math.abs(horizontalDiff)) {
        // console.log("Вертикальный свайп или недостаточный горизонтальный, игнорируем.");
        return;
    }

    // Свайп ВЛЕВО (палец двигался справа налево)
    if (horizontalDiff < -swipeThreshold) {
        console.log('Свайп влево -> следующая песня');
        nextPresentationSong();
    }
    // Свайп ВПРАВО (палец двигался слева направо)
    else if (horizontalDiff > swipeThreshold) {
        console.log('Свайп вправо -> предыдущая песня');
        prevPresentationSong();
    } else {
        // Слишком короткий свайп, ничего не делаем
        // console.log("Свайп слишком короткий.");
    }
}

// Функция для установки слушателей событий касания на оверлей презентации
function setupSwipeListeners() {
    if (!presentationOverlay) {
         console.warn("Не найден оверлей презентации для установки слушателей свайпов.");
         return;
    }

    // Когда пользователь касается экрана (начало свайпа)
    presentationOverlay.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX; // Запоминаем X начала касания
        touchStartY = e.changedTouches[0].screenY; // Запоминаем Y начала касания
        // Также показываем контролы при касании
        showPresentationControls();
    }, { passive: true }); // passive: true для лучшей производительности скролла

    // Когда пользователь отпускает палец (конец свайпа)
    presentationOverlay.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX; // Запоминаем X конца касания
        touchEndY = e.changedTouches[0].screenY; // Запоминаем Y конца касания
        handleSwipeGesture(); // Анализируем жест (свайп)
    }, { passive: true });

    console.log("Слушатели свайпов для презентации установлены.");
}
// --- Конец логики свайпов ---


/** Отображает детали выбранной песни в основной части страницы */
function displaySongDetails(songData, songIndex, preferredKey = null) {
    // Проверка наличия основных DOM элементов
    if (!songContent || !keySelect || !playerContainer || !playerSection) {
        console.error("displaySongDetails: Отсутствуют критически важные DOM элементы (songContent, keySelect, playerContainer, playerSection).");
        // Показываем ошибку пользователю, если основной контент недоступен
        if(songContent) songContent.innerHTML = '<h2>Ошибка интерфейса!</h2><p>Не удалось отобразить песню.</p>';
        return;
    }

    // --- СЛУЧАЙ, КОГДА ПЕСНЯ НЕ ВЫБРАНА (СБРОС ИНТЕРФЕЙСА) ---
    if (!songData || songIndex === null || songIndex === undefined || songIndex === "") {
        console.log("Сброс отображения деталей песни.");
        songContent.innerHTML = '<h2>Выберите песню</h2><pre></pre>'; // Сброс текста и заголовка
        keySelect.value = chords[0]; // Сброс тональности на "C"
        keySelect.dataset.index = ""; // Очищаем сохраненный индекс

        playerContainer.innerHTML = '';          // Очистка плеера
        playerSection.style.display = 'none';    // Скрытие секции плеера
        if (youtubeVideoKeyDisplay) {            // Скрытие тональности видео
            youtubeVideoKeyDisplay.textContent = '';
            youtubeVideoKeyDisplay.style.display = 'none';
        }
        if (bpmDisplay) bpmDisplay.textContent = 'N/A'; // Сброс BPM
        if (holychordsButton) {                   // Скрытие кнопки Holychords
            holychordsButton.style.display = 'none';
            holychordsButton.href = '#';
        }
        // Отключаем кнопки действий
        if(favoriteButton) favoriteButton.disabled = true;
        if(addToSetlistButton) addToSetlistButton.disabled = true;
        if(addToRepertoireButton) addToRepertoireButton.disabled = true;
        if(splitTextButton) splitTextButton.disabled = true; // Отключаем и разделение

        return; // Выход из функции
    }

    // --- СЛУЧАЙ, КОГДА ПЕСНЯ ВЫБРАНА ---
    console.log(`Отображение деталей песни: Индекс=<span class="math-inline">\{songIndex\}, Предпочт\. тональность\=</span>{preferredKey}`);

    // Извлекаем данные песни из массива songData (столбцы A-G)
    const title = songData[0] || 'Без названия';
    const lyrics = songData[1] || '';
    const originalKeyFromSheet = songData[2] || chords[0]; // Ориг. тональность из таблицы (столбец C)
    const srcUrl = songData[3] || ''; // Ссылка на Holychords (столбец D)
    const bpm = songData[4] || 'N/A'; // BPM (столбец E)
    const ytLink = songData[5] || ''; // Ссылка на YouTube (столбец F)
    const videoKey = songData[6] ? songData[6].trim() : null; // Тональность видео (столбец G)

    // Определяем ТЕКУЩУЮ тональность для отображения:
    // 1. Приоритет у preferredKey (если передан, например, из репертуара или сет-листа)
    // 2. Иначе используем тональность из таблицы
    const currentSelectedKey = preferredKey || originalKeyFromSheet;

    // --- Обновление основной информации о песне ---
    if (bpmDisplay) {
         bpmDisplay.textContent = bpm; // Отображаем BPM
         updateBPM(bpm); // Обновляем состояние метронома, если он активен
    }

    if (holychordsButton) { // Обновляем кнопку Holychords
        if (srcUrl && srcUrl.startsWith('http')) { // Проверяем, что ссылка есть и похожа на URL
            holychordsButton.href = srcUrl;
            holychordsButton.target = '_blank'; // Открывать в новой вкладке
            holychordsButton.style.display = 'inline-block';
        } else {
            holychordsButton.href = '#';
            holychordsButton.style.display = 'none';
        }
    }

    // Установка текущей тональности в select и сохранение индекса песни
    keySelect.value = currentSelectedKey;
    keySelect.dataset.index = songIndex; // Сохраняем индекс для транспонирования

    // Обновляем текст песни (транспонирование будет применено внутри)
    updateTransposedLyrics(); // Эта функция теперь берет текст из кэша и транспонирует

    // --- Обновление секции YouTube плеера ---
    const videoId = extractYouTubeVideoId(ytLink); // Получаем ID видео

    if (videoId && playerContainer && playerSection) { // Если есть ID видео и элементы на месте
        console.log(`Найдено YouTube видео ID: ${videoId}`);
        // Вставляем iframe плеера (используем стандартный URL)
        // Добавляем параметры для контроля: ?rel=0 (не показывать похожие), &modestbranding=1 (уменьшить лого)
        playerContainer.innerHTML = `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
        playerSection.style.display = 'block'; // Показываем секцию

        // Показываем или скрываем тональность видео
        if (youtubeVideoKeyDisplay) {
            if (videoKey && chords.includes(videoKey)) { // Показываем, если тональность есть и валидна
                youtubeVideoKeyDisplay.textContent = `Ориг. тональность видео: ${videoKey}`;
                youtubeVideoKeyDisplay.style.display = 'block';
            } else { // Скрываем, если тональности нет или она неверная
                 if (videoKey) console.warn(`Неверная тональность видео указана в таблице: ${videoKey}`);
                youtubeVideoKeyDisplay.textContent = '';
                youtubeVideoKeyDisplay.style.display = 'none';
            }
        }
    } else { // Если нет ID видео или элементов плеера
        if(ytLink) console.log("Не найдено валидное YouTube видео ID в ссылке:", ytLink);
        playerContainer.innerHTML = '';        // Очищаем контейнер плеера
        playerSection.style.display = 'none';  // Скрываем всю секцию
        // Также скрываем отображение тональности видео
        if (youtubeVideoKeyDisplay) {
            youtubeVideoKeyDisplay.textContent = '';
            youtubeVideoKeyDisplay.style.display = 'none';
        }
    }

    // Включаем кнопки действий, так как песня выбрана
    if(favoriteButton) favoriteButton.disabled = false;
    if(addToSetlistButton) addToSetlistButton.disabled = false;
    if(addToRepertoireButton) addToRepertoireButton.disabled = false;
    if(splitTextButton) splitTextButton.disabled = false;
}

/** Обновление текста песни при смене тональности в keySelect */
function updateTransposedLyrics() {
    if (!keySelect || !songContent) {
         console.warn("updateTransposedLyrics: Отсутствует keySelect или songContent.");
         return;
    }

    const indexStr = keySelect.dataset.index; // Получаем индекс текущей песни из data-атрибута
    const newKey = keySelect.value;           // Новая выбранная тональность из select

    // Если индекс не установлен (песня не выбрана), ничего не делаем
    if (indexStr === null || indexStr === undefined || indexStr === "") {
        // console.log("updateTransposedLyrics: Индекс песни не установлен, транспонирование не выполняется.");
        return;
    }
    const songIndex = parseInt(indexStr, 10);

    // Получаем имя текущего листа из sheetSelect
    const sheetKey = sheetSelect?.value;
    const fullSheetName = SHEETS[sheetKey];

    if (!sheetKey || !fullSheetName || !cachedData[fullSheetName] || !cachedData[fullSheetName][songIndex]) {
        console.error("updateTransposedLyrics: Не найдены данные песни в кэше для транспонирования.", {sheetKey, fullSheetName, songIndex});
         // Показать ошибку в UI?
         const preElement = songContent.querySelector('pre');
         const h2Element = songContent.querySelector('h2');
         if(preElement) preElement.innerHTML = 'Ошибка: не найдены данные песни для отображения.';
         if(h2Element) h2Element.textContent = 'Ошибка';
        return;
    }

    // Получаем оригинальные данные песни из кэша
    const songData = cachedData[fullSheetName][songIndex];
    const originalKey = songData[2]; // Оригинальная тональность из таблицы (столбец C)
    const lyrics = songData[1] || ''; // Оригинальный текст (столбец B)
    const title = songData[0] || 'Без названия'; // Название (столбец A)

    // Находим элементы для обновления в DOM
    const preElement = songContent.querySelector('pre');
    const h2Element = songContent.querySelector('h2');
    if (!preElement || !h2Element) {
        console.error("updateTransposedLyrics: Элементы H2 или PRE не найдены внутри songContent.");
        return;
    }

    // Вычисляем необходимое смещение
    const transposition = getTransposition(originalKey, newKey);
    console.log(`Транспонирование из ${originalKey} в ${newKey}, смещение: ${transposition}`);

    // Транспонируем оригинальный текст
    const transposedLyrics = transposeLyrics(lyrics, transposition);
    // Обрабатываем пробелы и подсвечиваем аккорды в транспонированном тексте
    const processedTransposedLyrics = processLyrics(transposedLyrics);
    const highlightedTransposedLyrics = highlightChords(processedTransposedLyrics);

    // Обновляем текст в элементе <pre>
    preElement.innerHTML = highlightedTransposedLyrics || 'Нет текста песни.';
    // Обновляем тональность в заголовке H2
    h2Element.textContent = `${title} — ${newKey}`; // Используем textContent для безопасности

    // Обновляем размер шрифта, если он был изменен
    updateFontSize();
}

/** Загрузка списка песен в select#song-select для выбранного листа */
async function loadSheetSongs() {
    if (!sheetSelect || !songSelect) {
         console.warn("loadSheetSongs: Не найдены элементы sheetSelect или songSelect.");
         return;
    }
    const sheetKey = sheetSelect.value; // Короткое имя листа (ключ)

    // Если лист не выбран
    if (!sheetKey) {
        songSelect.innerHTML = '<option value="">-- Сначала выберите лист --</option>';
        songSelect.disabled = true;
        displaySongDetails(null); // Сбрасываем отображение песни
        return;
    }

    const fullSheetName = SHEETS[sheetKey]; // Получаем полное имя листа

    // Получаем данные для этого листа (из кэша или загружаем)
    const rows = await fetchSheetData(sheetKey); // Передаем ключ в fetchSheetData

    // Очищаем select песен
    songSelect.innerHTML = '<option value="">-- Выберите песню --</option>';

    if (rows && rows.length > 0) {
        // Заполняем select песнями из загруженных данных
        rows.forEach((row, index) => {
            // Проверяем, что строка существует и содержит название (столбец A)
            if (row && row[0]) {
                const option = document.createElement('option');
                option.value = index; // Значение = индекс строки (как строка)
                option.textContent = row[0]; // Текст = название песни
                songSelect.appendChild(option);
            } else {
                 // console.log(`Пропуск строки <span class="math-inline">\{index \+ 2\} на листе "</span>{fullSheetName}" из-за отсутствия названия.`);
            }
        });
        songSelect.disabled = false; // Включаем select
    } else {
        // Если данных нет или произошла ошибка при загрузке
        songSelect.innerHTML = `<option value="">-- Нет песен на листе "${sheetKey}" --</option>`;
        songSelect.disabled = true;
    }
     // Сбрасываем отображение песни при смене листа (пока песня не выбрана)
     displaySongDetails(null);
}

/** Обновление CSS стиля font-size для текста песни */
function updateFontSize() {
    // Используем опциональную цепочку для безопасности
    const lyricsElement = songContent?.querySelector('pre');
    if (lyricsElement) {
        lyricsElement.style.fontSize = `${currentFontSize}px`;
        console.log(`Размер шрифта текста установлен на ${currentFontSize}px`);
    }
}

/** Сброс размера шрифта к значению по умолчанию */
function resetFontSize() {
    currentFontSize = DEFAULT_FONT_SIZE;
    updateFontSize();
    console.log("Размер шрифта сброшен на по умолчанию.");
}

/** Загрузка избранных песен из localStorage в указанный контейнер */
function loadFavorites(container = favoritesList) {
    if (!container) {
        console.error("Контейнер для избранных песен не найден."); return;
    }
    container.innerHTML = ''; // Очищаем

    // Обновляем данные из localStorage на всякий случай
    favorites = JSON.parse(localStorage.getItem('favorites')) || [];

    if (favorites.length === 0) {
        container.innerHTML = '<div class="empty-message">Нет избранных песен</div>';
        return;
    }

    favorites.forEach(fav => {
        const favoriteItem = document.createElement('div');
        favoriteItem.className = 'favorite-item';
        // Имя и сохраненная тональность
        const songInfo = document.createElement('span');
        songInfo.className = 'song-name';
        songInfo.textContent = `${fav.name} — ${fav.key}`;
        favoriteItem.appendChild(songInfo);
        // Кнопка удаления
        const removeBtn = document.createElement('button');
        // Используем иконку Font Awesome вместо текста
        removeBtn.innerHTML = '<i class="fas fa-times"></i>'; // Иконка крестика
        removeBtn.className = 'remove-button';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeFromFavorites(fav); // Вызываем удаление
        });
        favoriteItem.appendChild(removeBtn);





        // Клик по элементу
        favoriteItem.addEventListener('click', async () => {
           // Логика клика по песне в избранном... (оставлена как есть)
           const sheetNameValue = Object.keys(SHEETS).find(key => SHEETS[key] === fav.sheet);
           if(sheetNameValue) sheetSelect.value = sheetNameValue;
           if (!cachedData[fav.sheet]) await fetchSheetData(fav.sheet);
           await loadSheetSongs();
           songSelect.value = fav.index;
           displaySongDetails(cachedData[fav.sheet]?.[fav.index], fav.index, fav.key);
           if (favoritesPanel) favoritesPanel.classList.remove('open');
           if (repertoirePanel) repertoirePanel.classList.remove('open'); // Закрываем и репертуар
        });
        container.appendChild(favoriteItem);
    });
}

// Функция для удаления песни из избранного (localStorage)
function removeFromFavorites(fav) {
    console.log("Попытка удаления из избранного:", fav); // Лог 1: Что удаляем
    // Находим индекс элемента в текущем массиве favorites
    const index = favorites.findIndex(item =>
        item.name === fav.name &&
        item.sheet === fav.sheet &&
        item.index === fav.index &&
        item.key === fav.key // Добавим проверку ключа на всякий случай
    );
    console.log("Найденный индекс для удаления:", index); // Лог 2: Результат поиска

    if (index !== -1) {
        favorites.splice(index, 1); // Удаляем из массива в памяти
        localStorage.setItem('favorites', JSON.stringify(favorites)); // Обновляем localStorage
        console.log("Элемент удален, localStorage обновлен.");

        // *** ИЗМЕНЕНИЕ: Обновляем ТОЛЬКО список избранного, а не всю панель ***
        if (favoritesPanel?.classList.contains('open') && favoritesList) { // Добавлена проверка favoritesPanel
             loadFavorites(favoritesList); // Перерисовываем список избранного
        }
        // loadGroupPanel(); // Убрали вызов полной перезагрузки панели
        alert("Песня удалена из 'Моего списка'."); // Добавим подтверждение
    } else {
        console.warn("Не удалось найти песню для удаления в массиве favorites.");
        alert("Не удалось удалить песню из 'Моего списка'.");
    }
}




/** Обновление отображения BPM */
function updateBPM(newBPM) {
    if (!bpmDisplay) return; // Проверка элемента
    bpmDisplay.textContent = newBPM || 'N/A'; // Отображаем N/A если BPM нет
    // Если метроном активен, перезапускаем его с новым BPM
    if (isMetronomeActive) {
        const bpmValue = parseInt(newBPM, 10);
        if (!isNaN(bpmValue) && bpmValue > 0) {
            // Перезапуск: остановить и запустить с новым BPM
            toggleMetronome(0); // Остановить
            toggleMetronome(bpmValue); // Запустить с новым BPM
        } else {
             toggleMetronome(0); // Останавливаем, если BPM некорректен
        }
    }
}

// --- METRONOME FUNCTIONS ---

/** Настройка AudioContext */
function setupAudioContext() {
    if (!audioContext) {
        try {
             audioContext = new (window.AudioContext || window.webkitAudioContext)();
             console.log("AudioContext успешно создан.");
        } catch(e) {
             console.error("Не удалось создать AudioContext:", e);
             alert("Ошибка: Ваш браузер не поддерживает Web Audio API, метроном не будет работать.");
        }
    }
}

/** Возобновление AudioContext (если был приостановлен браузером) */
function resumeAudioContext() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log('AudioContext успешно возобновлен.');
        }).catch((error) => {
            console.error('Ошибка возобновления AudioContext:', error);
        });
    }
}

/** Загрузка аудиофайла для метронома */
async function loadAudioFile() {
    if (!audioContext) setupAudioContext(); // Создаем контекст, если его нет
    if (!audioContext || audioBuffer) return; // Не грузим, если нет контекста или уже загружено

    const fileUrl = 'https://firebasestorage.googleapis.com/v0/b/song-archive-389a6.firebasestorage.app/o/metronome-85688%20(mp3cut.net).mp3?alt=media&token=97b66349-7568-43eb-80c3-c2278ff38c10';
    console.log("Загрузка аудиофайла метронома...");
    try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        // Используем промис для decodeAudioData для лучшей обработки ошибок
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        console.log("Аудиофайл метронома успешно загружен и декодирован.");
    } catch (error) {
        console.error('Ошибка загрузки или декодирования аудиофайла:', error);
        alert("Не удалось загрузить звук метронома. Метроном может не работать.");
        audioBuffer = null; // Сбрасываем буфер при ошибке
    }
}



// --- Обновленная функция toggleMetronome (с логами) ---
function toggleMetronome(bpm) {
    const playIcon = '<i class="fas fa-play"></i>';
    const stopIcon = '<i class="fas fa-stop"></i>';
    const playText = '<span class="button-text">Включить метроном</span>';
    const stopText = '<span class="button-text">Выключить метроном</span>';

    if (!metronomeButton) return;

    if (isMetronomeActive) {
        // --- Выключение ---
        console.log("Metronome: Stopping. Interval ID:", metronomeInterval); // ЛОГ
        clearInterval(metronomeInterval);
        metronomeInterval = null;
        isMetronomeActive = false;
        currentBeat = 0;
        metronomeButton.innerHTML = playIcon + (isMobileView() ? '' : playText);
        metronomeButton.setAttribute('aria-label', 'Включить метроном');
        console.log("Metronome: Stopped."); // ЛОГ
    } else if (bpm > 0) {
        // --- Включение ---
        console.log("Metronome: Attempting to start with BPM:", bpm); // ЛОГ
        if (!audioContext || !audioBuffer) {
            console.warn("Metronome: Cannot start, audio not ready."); // ЛОГ
            alert("Звук метронома еще не загружен, подождите.");
            loadAudioFile();
            return;
        }
        const intervalMilliseconds = 60000 / bpm;
        if (intervalMilliseconds <= 0 || !isFinite(intervalMilliseconds)) {
            console.error("Metronome: Invalid interval calculated:", intervalMilliseconds); // ЛОГ
            return;
        }
        currentBeat = 0;


// --- Обновленная функция playClick (с логами и try-catch) ---
function playClick() {
    console.log("--> playClick called. Beat:", currentBeat, "Context state:", audioContext?.state); // ЛОГ ВХОДА

    if (!audioContext || !audioBuffer) {
        console.error("!!! playClick stopping: AudioContext or audio buffer not ready."); // ЛОГ ОШИБКИ
        if(isMetronomeActive) toggleMetronome(0); // Останавливаем
        return;
    }

    if (audioContext.state === 'suspended') {
        console.warn("playClick: AudioContext is suspended, attempting to resume..."); // ЛОГ ПРИОСТАНОВКИ
        resumeAudioContext(); // Пытаемся возобновить
        // Может потребоваться небольшая задержка перед воспроизведением после resume,
        // но сначала попробуем без нее.
    }

    const beatsPerMeasure = parseInt(timeSignatureSelect.value, 10) || 4;

    try {
        console.log("   playClick: Creating BufferSource..."); // ЛОГ
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(currentBeat % beatsPerMeasure === 0 ? 1.0 : 0.6, audioContext.currentTime);

        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        console.log("   playClick: Calling source.start()..."); // ЛОГ
        source.start(audioContext.currentTime);
        source.onended = () => { // Добавим для информации
             console.log("   playClick: source ended.");
        };

        currentBeat = (currentBeat + 1) % beatsPerMeasure;
        console.log("   playClick finished. Next beat:", currentBeat); // ЛОГ УСПЕХА

    } catch (error) {
        console.error("!!! Error during playClick execution:", error); // ЛОГ ИСКЛЮЧЕНИЯ
        if(isMetronomeActive) toggleMetronome(0); // Останавливаем при ошибке
    }
}



        // --- ЗАПУСК ИНТЕРВАЛА ---
        metronomeInterval = setInterval(playClick, intervalMilliseconds);
        isMetronomeActive = true;
        console.log("Metronome: Started. Interval ID:", metronomeInterval, "Interval (ms):", intervalMilliseconds); // ЛОГ
        metronomeButton.innerHTML = stopIcon + (isMobileView() ? '' : stopText);
        metronomeButton.setAttribute('aria-label', 'Выключить метроном');
        console.log("Metronome: Playing first click manually..."); // ЛОГ
        playClick(); // Сразу играем первый удар
        console.log("Metronome: First click function call finished.");// ЛОГ
    } else {
         console.log("Metronome: Start requested with invalid BPM:", bpm); // ЛОГ
    }
}




/** Применяет указанную тему (light/dark) */
function applyTheme(themeName) {
    console.log("Применяется тема:", themeName);
    document.body.dataset.theme = themeName; // Устанавливаем атрибут data-theme

    // Обновляем иконку на кнопке переключения
    const toggleButton = document.getElementById('theme-toggle-button');
    if (toggleButton) {
        const icon = toggleButton.querySelector('i');
        if (icon) {
            if (themeName === 'light') {
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon'); // Показываем луну для светлой темы
                toggleButton.title = "Переключить на темную тему";
            } else {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');  // Показываем солнце для темной темы
                toggleButton.title = "Переключить на светлую тему";
            }
        }
    }
    // Сохраняем выбор в localStorage
    localStorage.setItem('theme', themeName);
}

/** Переключает между светлой и темной темой */
function toggleTheme() {
    // Проверяем текущую тему по атрибуту body
    const currentTheme = document.body.dataset.theme || 'dark'; // Если атрибута нет, считаем что тема темная
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark'; // Определяем новую тему
    applyTheme(newTheme); // Применяем новую тему
}




// --- EVENT LISTENER SETUP ---
function setupEventListeners() {
    console.log("Настройка слушателей событий...");

    if(sheetSelect) sheetSelect.addEventListener('change', async () => {
        console.log("Sheet selected:", sheetSelect.value);
        if(searchInput) searchInput.value = '';
        if(searchResults) searchResults.innerHTML = '';
        await loadSheetSongs();
        displaySongDetails(null); // Сброс отображения песни
    });



    if(songSelect) songSelect.addEventListener('change', () => {
        const sheetName = SHEETS[sheetSelect.value];
        const songIndex = songSelect.value;
        console.log(`Song selected: ${songIndex} in ${sheetName}`);
        if (!sheetName || songIndex === "" || !cachedData[sheetName]?.[songIndex]) {
             displaySongDetails(null);
             return;
        }
        displaySongDetails(cachedData[sheetName][songIndex], songIndex);
    });

    if(searchInput) {
        searchInput.addEventListener('input', () => searchSongs(searchInput.value));
        searchInput.addEventListener('blur', () => {
            // Небольшая задержка, чтобы успел сработать клик по результату
            setTimeout(() => {
                if(searchResults) searchResults.innerHTML = '';
            }, 200);
        });
    }

    if(keySelect) keySelect.addEventListener('change', updateTransposedLyrics);

    if(zoomInButton) zoomInButton.addEventListener('click', () => {
        currentFontSize += 2;
        updateFontSize();
    });

    if(zoomOutButton) zoomOutButton.addEventListener('click', () => {
        if (currentFontSize > MIN_FONT_SIZE) {
            currentFontSize -= 2;
            updateFontSize();
        }
    });



    if(splitTextButton && songContent) {
        const splitIcon = '<i class="fas fa-columns"></i>';
        const mergeIcon = '<i class="fas fa-align-justify"></i>'; // Иконка для "Объединить"
        const splitText = '<span class="button-text">Разделить текст</span>';
        const mergeText = '<span class="button-text">Объединить колонки</span>';

        const updateSplitButton = () => { // Функция обновления основной кнопки разделения
            const isSplit = songContent.classList.contains('split-columns');
            const currentIcon = isSplit ? mergeIcon : splitIcon;
            const currentTextSpan = isSplit ? mergeText : splitText;
            const content = currentIcon + (isMobileView() ? '' : currentTextSpan);
            splitTextButton.innerHTML = content;
            splitTextButton.setAttribute('aria-label', isSplit ? 'Объединить колонки' : 'Разделить текст');
        };
if (createSetlistButton) {
    createSetlistButton.addEventListener('click', createSetlist);
} else {
    console.warn("Кнопка #create-setlist-button не найдена.");
}

        splitTextButton.addEventListener('click', () => { // Обработчик основной кнопки
            const lyricsElement = songContent.querySelector('pre');
            if (!lyricsElement || !lyricsElement.textContent?.trim()) {
                alert('Нет текста песни для разделения.'); return;
            }
            songContent.classList.toggle('split-columns');
            updateSplitButton();
        });
        updateSplitButton(); // Установить начальное состояние

        let resizeTimer; // Обновление при ресайзе
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(updateSplitButton, 150);
        });
    } // Конец if(splitTextButton && songContent)

    if(favoriteButton) {
        favoriteButton.addEventListener('click', () => {
            const sheetName = SHEETS[sheetSelect.value];
            const songIndex = songSelect.value;
            if (!sheetName || songIndex === "") { alert("Пожалуйста, сначала выберите песню."); return; }
            const songData = cachedData[sheetName]?.[songIndex];
            if (!songData) { alert("Не найдены данные для выбранной песни."); return; }
            const song = { name: songData[0], sheet: sheetName, index: songIndex, key: keySelect.value };
            if (!favorites.some(f => f.sheet === song.sheet && f.index === song.index)) {
                favorites.push(song);
                localStorage.setItem('favorites', JSON.stringify(favorites));
                if (favoritesPanel?.classList.contains('open')) { loadFavorites(); }
                alert(`"<span class="math-inline">\{song\.name\}" \(</span>{song.key}) добавлена в 'Мой список'.`);
            } else {
                alert(`Песня "${song.name}" уже есть в 'Моем списке'.`);
            }
        });
    }

   // !!! ИЗМЕНЕНИЕ: Обработчик для кнопки "В сет-лист" !!!
if (addToSetlistButton) { // Используем новую переменную кнопки
    addToSetlistButton.addEventListener('click', addToCurrentSetlist); // Вызываем новую функцию
} else {
    console.warn("Кнопка #add-to-setlist-button не найдена.");
}

    if(addToRepertoireButton) addToRepertoireButton.addEventListener('click', addToRepertoire);

    if(vocalistSelect) vocalistSelect.addEventListener('change', (e) => {
        currentVocalistId = e.target.value;
        const selectedIndex = e.target.selectedIndex;
        currentVocalistName = selectedIndex > 0 ? e.target.options[selectedIndex].text : null;
        console.log(`Vocalist selected: ${currentVocalistName || 'none'} (ID: ${currentVocalistId || 'none'})`);
        loadRepertoire(currentVocalistId);
    });

    // --- Слушатели для кнопок открытия/закрытия панелей ---
    if (toggleFavoritesButton && favoritesPanel) {
        toggleFavoritesButton.addEventListener('click', () => {
            const isOpen = favoritesPanel.classList.toggle('open');
            if (isOpen) {
                if (repertoirePanel?.classList.contains('open')) repertoirePanel.classList.remove('open');
                loadGroupPanel();
            }
        });
    } else { console.error("Elements for 'Списки' toggle not found"); }

    if (toggleRepertoireButton && repertoirePanel) {
        toggleRepertoireButton.addEventListener('click', () => {
            const isOpen = repertoirePanel.classList.toggle('open');
            if (isOpen) {
                if (favoritesPanel?.classList.contains('open')) favoritesPanel.classList.remove('open');
                 loadRepertoire(currentVocalistId);
             }
         });
     } else { console.error("Elements for 'Репертуар' toggle not found"); }


// !!! ДОБАВИТЬ НОВЫЙ обработчик для кнопки "Презентация" сет-листа !!!
if (startPresentationButton) {
    startPresentationButton.addEventListener('click', () => {
        console.log("Клик по кнопке 'Презентация' для сет-листа ID:", currentSetlistId);
        // Проверяем, выбран ли сет-лист и есть ли в нем песни
        if (currentSetlistId && currentSetlistSongs && currentSetlistSongs.length > 0) {
            // Закрываем панели перед показом презентации
            if (favoritesPanel?.classList.contains('open')) favoritesPanel.classList.remove('open');
            if (repertoirePanel?.classList.contains('open')) repertoirePanel.classList.remove('open');

            // Запускаем презентацию с песнями ТЕКУЩЕГО сет-листа
            // Массив currentSetlistSongs уже отсортирован по 'order' функцией loadCurrentSetlistSongs
            showPresentationView(currentSetlistSongs);
        } else {
            alert("Сет-лист не выбран или в нем нет песен для презентации.");
        }
    });
} else { console.warn("Кнопка #start-presentation-button не найдена."); }


if (presentationCloseBtn && presentationOverlay) { // Кнопка закрытия презентации
     // ... остальной код обработчика закрытия без изменений ...
}


    
     if (presentationCloseBtn && presentationOverlay) { // Кнопка закрытия презентации
         presentationCloseBtn.addEventListener('click', () => {
             presentationOverlay.classList.remove('visible');
             document.body.style.overflow = ''; // Восстанавливаем скролл body
             clearTimeout(controlsHideTimeout); // Отменяем таймер скрытия контролов
             if (document.fullscreenElement) { // Выход из полноэкранного режима
                 document.exitFullscreen().catch(err => console.error(`Error attempting to exit fullscreen: <span class="math-inline">\{err\.message\} \(</span>{err.name})`));
             }
         });
     }

     // --- Слушатели для метронома и BPM ---
     if(metronomeButton){
         metronomeButton.addEventListener('click', async () => {
             if (!audioContext) setupAudioContext();
             if (!audioContext) return;
             resumeAudioContext();
             if (!audioBuffer) await loadAudioFile();
             const bpmText = bpmDisplay?.textContent;
             const bpmValue = parseInt(bpmText, 10);
             if (!isNaN(bpmValue) && bpmValue > 0) {
                 toggleMetronome(bpmValue);
             } else {
                 alert('Не указан или некорректный BPM для запуска метронома.');
                 if (isMetronomeActive) toggleMetronome(0);
             }
         });
     }

     if(bpmDisplay) { // Редактирование BPM
         bpmDisplay.addEventListener('blur', () => {
             const newText = bpmDisplay.textContent;
             const newBpm = parseInt(newText, 10);
             if (!isNaN(newBpm) && newBpm > 0) {
                 updateBPM(newBpm);
             } else {
                 alert('Пожалуйста, введите корректное числовое значение BPM.');
             }
         });
         bpmDisplay.addEventListener('input', () => { // Запрет ввода не цифр
             bpmDisplay.textContent = bpmDisplay.textContent.replace(/[^0-9]/g, '');
         });
     }

     // --- Слушатель для Holychords ---
     if(holychordsButton) holychordsButton.addEventListener('click', (e) => {
         if (!holychordsButton.href || holychordsButton.href.endsWith('#')) {
             e.preventDefault();
             alert('Ссылка на Holychords для этой песни отсутствует.');
         }
     });

     console.log("Event listeners setup complete (v2)."); // Обновил лог для ясности




     // --- Слушатели для НОВЫХ кнопок презентации и свайпов ---
     const prevBtn = document.getElementById('pres-prev-btn');
     const nextBtn = document.getElementById('pres-next-btn');
     const presSplitBtn = document.getElementById('pres-split-text-btn'); // Получаем новую кнопку

     if(prevBtn) { prevBtn.addEventListener('click', prevPresentationSong); }
     if(nextBtn) { nextBtn.addEventListener('click', nextPresentationSong); }
     if (presSplitBtn) { // Добавляем слушатель для кнопки разделения в презентации
          presSplitBtn.addEventListener('click', togglePresentationSplit);
          console.log("Слушатель для кнопки разделения текста в презентации добавлен.");
      }

     // Устанавливаем слушатели для свайпов
     setupSwipeListeners();

      // Добавляем слушатель на весь оверлей для показа контролов при касании
     if (presentationOverlay) {
          presentationOverlay.addEventListener('touchstart', showPresentationControls, { passive: true });
          console.log("Слушатель касания для показа контролов добавлен.");
      }

     console.log("Слушатели для презентации и свайпов добавлены.");

    
const themeToggleButton = document.getElementById('theme-toggle-button');
    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', toggleTheme);
        console.log("Слушатель для кнопки переключения темы добавлен.");
    }

 } // <--- Конец функции setupEventListeners


// --- INITIALIZATION ---
// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM loaded.");
    if (!favoritesPanel || !repertoirePanel || !songContent || !sheetSelect || !songSelect || !keySelect) {
        console.error("Критически важные элементы интерфейса не найдены в HTML!");
        alert("Ошибка инициализации интерфейса! Проверьте HTML структуру и ID элементов.");
        return;
    }

    // --- Определение и применение начальной темы ---
    let initialTheme = localStorage.getItem('theme'); // 1. Проверяем сохраненную тему
    if (!initialTheme) {
        // 2. Если не сохранена, проверяем системные настройки
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            initialTheme = 'light'; // Предпочитает светлую
        } else {
            initialTheme = 'dark'; // По умолчанию или предпочитает темную
        }
        console.log("Сохраненная тема не найдена, используется системная/умолчание:", initialTheme);
    } else {
         console.log("Найдена сохраненная тема:", initialTheme);
    }
    applyTheme(initialTheme); // Применяем найденную или дефолтную тему
    // --- Конец определения темы ---

    // Настраиваем слушатели событий ПОСЛЕ применения темы
    setupEventListeners();

    // --- Остальная инициализация (как было) ---
    await loadAllSheetsData();
    await loadSheetSongs();
    await loadVocalists();
    // await loadAudioFile();

    displaySongDetails(null);
    loadSetlists(); // <-- НОВАЯ СТРОКА (Загружаем список сет-листов)
    loadRepertoire(null);

    console.log("App initialization complete.");
});
