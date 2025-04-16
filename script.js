// =====================================================================
// Agape Worship App - script.js (Реорганизованная и исправленная версия)
// =====================================================================

// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
    getFirestore, collection, addDoc, query,
    onSnapshot, updateDoc, deleteDoc, setDoc, doc,
    orderBy, getDocs, where // serverTimestamp убран, т.к. не используется напрямую здесь
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// --- CONFIGURATION ---
// Firebase - ВАЖНО: В реальном приложении эти данные лучше получать с сервера или из переменных окружения
const firebaseConfig = {
    apiKey: "AIzaSyBlkjVQFtFpMRFexAi6nBqEkIfjFlU5cDo", // ОСТОРОЖНО: Ключ в клиентском коде!
    authDomain: "song-archive-389a6.firebaseapp.com",
    projectId: "song-archive-389a6",
    storageBucket: "song-archive-389a6.appspot.com", // Исправлено на стандартный формат .appspot.com
    messagingSenderId: "619735277668",
    appId: "1:619735277668:web:51d2684bd8d4444eaf3f71",
    measurementId: "G-Z6QYH5YD2E"
};

// Google Sheets - ВАЖНО: API_KEY очень уязвим в клиентском коде!
const API_KEY = 'AIzaSyDO2gwifAnZzC3ooJ0A_4vAD76iYakwzlk'; // ОСТОРОЖНО: Ключ в клиентском коде!
const SHEET_ID = '1C3gFjj9LAub_Nk9ogqKp3LKpdAxq6j8xlPAsc8OmM5s';
const SHEETS = {
    'Быстрые (вертикаль)': 'Быстрые (вертикаль)',
    'Быстрые (горизонталь)': 'Быстрые (горизонталь)',
    'Поклонение (вертикаль)': 'Поклонение (вертикаль)',
    'Поклонение (горизонталь)': 'Поклонение (горизонталь)'
};

const structureMarkers = [
    "куплет", "припев", "бридж", "мостик", // Мостик = Бридж
    "проигрыш", "интро", "вступление", // Интро = Вступление
    "аутро", "окончание", "кода", // Аутро = Окончание
    "запев", "соло", "куплет 1", "куплет 2", "куплет 3", "куплет 4",
    "припев 1", "припев 2", "предприпев", "прехорус" // Добавим еще варианты
    // Можно добавить любые другие нужные маркеры
];
// Добавим варианты с двоеточием в конце
const structureMarkersWithColon = structureMarkers.map(m => m + ':');
const allMarkers = [...structureMarkers, ...structureMarkersWithColon];

// Music Constants
const chords = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "H"];
const DEFAULT_FONT_SIZE = 10;
const MIN_FONT_SIZE = 8;
const MAX_SHARED_SONGS = 8; // Эта константа используется? Если нет, можно удалить.

// --- FIREBASE INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const setlistsCollection = collection(db, "setlists");

// --- GLOBAL STATE ---
let currentRepertoireUnsubscribe = null; // Для отписки от слушателя репертуара
let cachedData = {}; // Кэш данных из Google Sheets ({ sheetName: [rows...] })
let favorites = JSON.parse(localStorage.getItem('favorites')) || []; // Избранные песни
let currentVocalistId = null; // ID выбранного вокалиста
let currentVocalistName = null; // Имя выбранного вокалиста
let allSheetsData = []; // Данные всех листов для поиска
let currentFontSize = DEFAULT_FONT_SIZE; // Текущий размер шрифта
let areChordsVisible = true; // <<< НОВОЕ: Состояние видимости аккордов

// --- СОСТОЯНИЕ СЕТ-ЛИСТОВ ---
let currentSetlistId = null; // ID текущего выбранного сет-листа
let currentSetlistName = null; // Имя текущего выбранного сет-листа (для заголовка)
let currentSetlistSongs = []; // Массив объектов песен ТЕКУЩЕГО выбранного сет-листа (поля: id, sheet, index, name, preferredKey, order, ...)
let currentSetlistSongsUnsubscribe = null; // Для отписки от слушателя песен ТЕКУЩЕГО сет-листа

// --- СОСТОЯНИЕ ПРЕЗЕНТАЦИИ ---
let presentationSongs = []; // Список песен для текущей презентации (раскомментировано и используется)
let currentPresentationIndex = 0; // Индекс текущей отображаемой песни
let controlsHideTimeout = null; // ID таймера для автоскрытия панели управления
let isPresentationSplit = false; // Состояние разделения текста в презентации

// --- СОСТОЯНИЕ МЕТРОНОМА ---
let audioContext;
let audioBuffer;
let metronomeInterval = null;
let isMetronomeActive = false;
let currentBeat = 0;

// --- DOM ELEMENT REFERENCES ---
// Основные элементы управления
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
const themeToggleButton = document.getElementById('theme-toggle-button'); // Кнопка темы
const toggleChordsButton = document.getElementById('toggle-chords-button'); // <<< НОВОЕ: Кнопка Аккорды
const copyTextButton = document.getElementById('copy-text-button'); // <<< НОВОЕ: Кнопка Копировать

// Кнопки действий с песней
const favoriteButton = document.getElementById('favorite-button'); // Добавить в Мой список
const addToSetlistButton = document.getElementById('add-to-setlist-button'); // Добавить В СЕТ-ЛИСТ
const addToRepertoireButton = document.getElementById('add-to-repertoire-button'); // Добавить в репертуар

// --- Элементы боковых панелей и их кнопки (ИЗМЕНЕНО) ---
const toggleFavoritesButton = document.getElementById('toggle-favorites'); // Кнопка "Сет-листы" (ID остался старый)
const setlistsPanel = document.getElementById('setlists-panel');       // Панель Сет-листов (бывшая favoritesPanel)

const toggleMyListButton = document.getElementById('toggle-my-list');  // !!! НОВАЯ КНОПКА "Мой список" !!!
const myListPanel = document.getElementById('my-list-panel');         // !!! НОВАЯ ПАНЕЛЬ "Мой список" !!!

const toggleRepertoireButton = document.getElementById('toggle-repertoire'); // Кнопка "Репертуар"
const repertoirePanel = document.getElementById('repertoire-panel');        // Панель "Репертуар"
// --- Конец изменений в ссылках на панели ---

// Элементы внутри панелей
const favoritesList = document.getElementById('favorites-list'); // Внутри myListPanel
const newSetlistNameInput = document.getElementById('new-setlist-name-input'); // Внутри setlistsPanel
const createSetlistButton = document.getElementById('create-setlist-button'); // Внутри setlistsPanel
const setlistsListContainer = document.getElementById('setlists-list-container'); // Внутри setlistsPanel
const currentSetlistTitle = document.getElementById('current-setlist-title'); // Внутри setlistsPanel
const currentSetlistControls = document.querySelector('.current-setlist-controls'); // Внутри setlistsPanel
const startPresentationButton = document.getElementById('start-presentation-button'); // Внутри setlistsPanel
const deleteSetlistButton = document.getElementById('delete-setlist-button'); // Внутри setlistsPanel
const currentSetlistSongsContainer = document.getElementById('current-setlist-songs-container'); // Внутри setlistsPanel
const vocalistSelect = document.getElementById('vocalist-select'); // Внутри repertoirePanel
const repertoirePanelList = document.getElementById('repertoire-panel-list'); // Внутри repertoirePanel

// Элементы режима Презентации
const presentationOverlay = document.getElementById('presentation-overlay');
const presentationContent = document.getElementById('presentation-content');
const presentationCloseBtn = document.getElementById('presentation-close-btn');
const presSplitTextBtn = document.getElementById('pres-split-text-btn');
const presentationControls = document.querySelector('.presentation-controls');
const presPrevBtn = document.getElementById('pres-prev-btn');
const presNextBtn = document.getElementById('pres-next-btn');
const presCounter = document.getElementById('pres-counter');

// Элементы модального окна заметок (Добавлено ранее)
const notesModal = document.getElementById('notes-modal');
const noteEditTextarea = document.getElementById('note-edit-textarea');
const saveNoteButton = document.getElementById('save-note-button');
const cancelNoteButton = document.getElementById('cancel-note-button');
const closeNoteModalX = document.getElementById('close-note-modal-x');

// --- API FUNCTIONS (Sheets, Firestore) ---

/** Загрузка данных с одного листа Google Sheet (с кэшированием) */
async function fetchSheetData(sheetName) {
    if (cachedData[sheetName]) return cachedData[sheetName];
    if (!SHEETS[sheetName]) {
        console.error(`Invalid sheet name provided: ${sheetName}`);
        return [];
    }
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    try {
        const range = `${SHEETS[sheetName]}!A2:G`; // Загружаем A-G
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) {
            // Попытка извлечь сообщение об ошибке из ответа API
            let errorBody = null;
            try { errorBody = await response.json(); } catch (e) { /* ignore json parsing error */ }
            const errorMessage = errorBody?.error?.message || `${response.status} ${response.statusText}`;
            console.error(`Google Sheets API error for sheet "${sheetName}": ${errorMessage}`, errorBody);
            throw new Error(`Google Sheets API error: ${errorMessage}`);
        }
        const data = await response.json();
        cachedData[sheetName] = data.values || [];
        return cachedData[sheetName];
    } catch (error) {
        console.error(`Ошибка загрузки данных из Google Sheets (${sheetName}):`, error);
        alert(`Не удалось загрузить данные листа "${sheetName}". Ошибка: ${error.message}. Проверьте консоль.`);
        return []; // Возвращаем пустой массив при ошибке
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/** Загрузка данных со ВСЕХ листов (для поиска и инициализации) */
async function loadAllSheetsData() {
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    allSheetsData = []; // Очищаем перед загрузкой
    try {
        const sheetNames = Object.keys(SHEETS);
        // Используем Promise.allSettled для загрузки, даже если некоторые листы не загрузятся
        const results = await Promise.allSettled(sheetNames.map(name => fetchSheetData(name)));

        allSheetsData = results.map((result, index) => {
            const sheetName = sheetNames[index];
            if (result.status === 'fulfilled') {
                return { sheetName: sheetName, data: result.value };
            } else {
                console.warn(`Не удалось загрузить данные для листа "${sheetName}": ${result.reason}`);
                // Можно добавить пустые данные или специальный флаг ошибки
                return { sheetName: sheetName, data: [], error: true };
            }
        });
        console.log("All sheets data load attempted. Check warnings for failed sheets.");
        //createSearchIndex(); // Создаем индекс (если он будет использоваться)
    } catch (error) {
        // Эта ошибка маловероятна с Promise.allSettled, но оставим на всякий случай
        console.error('Критическая ошибка при загрузке данных со всех листов:', error);
        alert("Произошла критическая ошибка при начальной загрузке данных песен.");
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/** Загрузка списка вокалистов в dropdown */
async function loadVocalists() {
    if (!vocalistSelect) return;
    vocalistSelect.innerHTML = '<option value="">Загрузка...</option>'; // Индикатор загрузки
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
                option.textContent = vocalist.name || doc.id; // Используем имя, если есть
                vocalistSelect.appendChild(option);
            });
            console.log("Список вокалистов успешно загружен.");
        }
    } catch (error) {
        console.error("Ошибка при загрузке вокалистов:", error);
        vocalistSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
        alert("Не удалось загрузить список вокалистов.");
    }
}

/** Выделение маркеров структуры песни (Куплет, Припев и т.д.) */
function highlightStructure(lyrics) {
    if (!lyrics) return '';

    // Список маркеров (можно вынести в глобальные константы, если хотите)
    const markers = [
        "куплет", "припев", "бридж", "мостик", "проигрыш", "интро",
        "вступление", "аутро", "окончание", "кода", "запев", "соло",
         "предприпев", "прехорус", "outro" // Добавил outro на всякий случай
    ];

    // --- ИСПРАВЛЕННОЕ РЕГУЛЯРНОЕ ВЫРАЖЕНИЕ ---
    // Создаем шаблон: начало строки, необязательные пробелы,
    // (один из маркеров),
    // необязательные пробелы, необязательные цифры, необязательные пробелы,
    // необязательное двоеточие или точка, необязательные пробелы, конец строки.
    // Флаг 'i' делает поиск нечувствительным к регистру.
    const markerPattern = `^\\s*(${markers.join('|')})\\s*\\d*\\s*[:.]?\\s*$`;
    const markerRegex = new RegExp(markerPattern, 'i');
    // --- КОНЕЦ ИСПРАВЛЕНИЯ РЕГУЛЯРКИ ---

    return lyrics.split('\n').map(line => {
        const trimmedLine = line.trim();
        // Проверяем, соответствует ли вся строка (после обрезки пробелов) нашему шаблону маркера
        if (markerRegex.test(trimmedLine)) {
            // Если да, оборачиваем в span с классом
            // Используем trimmedLine, чтобы сохранить оригинальное написание и регистр
            return `<span class="song-structure">${trimmedLine}</span>`;
        } else {
            // Если нет, возвращаем строку как есть (для последующей обработки аккордов)
            return line;
        }
    }).join('\n'); // Собираем строки обратно
}

/** Загрузка репертуара вокалиста с аккордеоном */
function loadRepertoire(vocalistId) {
    const listContainer = repertoirePanelList;
    const sectionContainer = repertoirePanel;

    if (!listContainer || !sectionContainer) {
        console.error("Не найдены UI элементы для панели репертуара.");
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

    if (!vocalistId) {
        listContainer.innerHTML = '<div class="empty-message">Выберите вокалиста для просмотра репертуара.</div>';
        return;
    }

    listContainer.innerHTML = '<div>Загрузка репертуара...</div>';

    const repertoireColRef = collection(db, "vocalists", vocalistId, "repertoire");
    const q = query(repertoireColRef); // Можно добавить orderBy, если нужно

    console.log(`loadRepertoire: Установка НОВОГО слушателя для ${vocalistId}`);

    // 2. Устанавливаем НОВЫЙ слушатель
    currentRepertoireUnsubscribe = onSnapshot(q, (snapshot) => {
        console.log(`>>> Firestore onSnapshot для репертуара ${vocalistId} СРАБОТАЛ. Получено документов: ${snapshot.size}`);

        // Проверяем, актуален ли еще этот вокалист
        if (vocalistId !== currentVocalistId) {
            console.warn(`onSnapshot: Получен снимок для ${vocalistId}, но текущий вокалист уже ${currentVocalistId}. Игнорируем.`);
            return;
        }

        const currentListContainer = document.getElementById('repertoire-panel-list'); // Получаем контейнер снова
        if (!currentListContainer) {
            console.error("!!! Контейнер #repertoire-panel-list исчез во время работы onSnapshot!");
            if (currentRepertoireUnsubscribe) {
                 currentRepertoireUnsubscribe();
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

        console.log("  Начинаем группировку по ТОНАЛЬНОСТИ...");
        const groupedByKeys = {};
        snapshot.docs.forEach((doc) => {
            const song = doc.data();
            const key = song.preferredKey || "N/A";
            if (!groupedByKeys[key]) {
                groupedByKeys[key] = [];
            }
            groupedByKeys[key].push({ ...song, repertoireDocId: doc.id });
        });

        // Сортировка тональностей
        const sortedKeys = Object.keys(groupedByKeys).sort((a, b) => {
            const order = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "H", "N/A"];
            return order.indexOf(a) - order.indexOf(b);
        });

        console.log("  Начинаем отрисовку аккордеона...");

        // Отрисовка аккордеона
        sortedKeys.forEach(key => {
            const keyHeading = document.createElement('div');
            keyHeading.className = 'repertoire-key-heading';
            keyHeading.innerHTML = `Тональность: ${key} <i class="fas fa-chevron-down"></i>`;
            keyHeading.dataset.key = key;
            keyHeading.addEventListener('click', toggleRepertoireKeySection);
            currentListContainer.appendChild(keyHeading);

            const songsWrapper = document.createElement('div');
            songsWrapper.className = 'repertoire-songs-for-key collapsed';
            songsWrapper.dataset.keyContent = key;

            const songsInKey = groupedByKeys[key];
            songsInKey.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            if (songsInKey.length > 0) {
                songsInKey.forEach(songWithId => {
                    const song = songWithId;
                    const repertoireDocId = song.repertoireDocId;
                    const shortSheetName = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === song.sheet) || song.sheet || '';

                    const listItem = document.createElement('div');
                    listItem.className = 'repertoire-item';

                    const songInfo = document.createElement('span');
                    songInfo.className = 'song-name';
                    songInfo.textContent = shortSheetName ? `${song.name} (${shortSheetName})` : song.name;
                    listItem.appendChild(songInfo);

                    const removeBtn = document.createElement('button');
                    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
                    removeBtn.className = 'remove-button';
                    removeBtn.title = 'Удалить из репертуара';
                    removeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        removeFromRepertoire(vocalistId, repertoireDocId);
                    });
                    listItem.appendChild(removeBtn);

                    listItem.addEventListener('click', async () => {
                        if (!cachedData[song.sheet]?.[song.index]) {
                            console.log(`Загрузка данных для ${song.name} (${song.sheet}) при клике в репертуаре`);
                            await fetchSheetData(song.sheet);
                            if (!cachedData[song.sheet]?.[song.index]) {
                                alert(`Не удалось найти или загрузить данные песни "${song.name}".`);
                                return;
                            }
                        }
                        const originalSongData = cachedData[song.sheet][song.index];
                        const sheetNameValue = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === song.sheet);
                        if(sheetSelect && sheetNameValue) sheetSelect.value = sheetNameValue;
                        await loadSheetSongs();
                        if(songSelect) songSelect.value = song.index;
                        displaySongDetails(originalSongData, song.index, song.preferredKey);
                        if (repertoirePanel) repertoirePanel.classList.remove('open');
                        if (favoritesPanel) favoritesPanel.classList.remove('open');
                    });

                    songsWrapper.appendChild(listItem);
                });
            } else {
                songsWrapper.innerHTML = '<div class="empty-message small">Нет песен в этой тональности</div>';
            }
            currentListContainer.appendChild(songsWrapper);
        }); // Конец forEach sortedKeys

        console.log("  Отрисовка аккордеона ЗАВЕРШЕНА.");

    }, (error) => {
        // Обработка ошибок слушателя
        console.error(`!!! ОШИБКА Firestore onSnapshot для репертуара ${vocalistId}:`, error);
        if (vocalistId === currentVocalistId) { // Показываем ошибку только если вокалист все еще выбран
            const currentListContainer = document.getElementById('repertoire-panel-list');
            if (currentListContainer) {
                currentListContainer.innerHTML = '<div class="empty-message">Ошибка загрузки репертуара.</div>';
            }
        } else {
            console.warn(`Ошибка onSnapshot для ${vocalistId} проигнорирована, т.к. текущий вокалист ${currentVocalistId}.`);
        }
        // Отписываемся при ошибке, если это был слушатель для текущего вокалиста
        if (vocalistId === currentVocalistId && currentRepertoireUnsubscribe) {
             console.log("Отписка из-за ошибки onSnapshot.");
             currentRepertoireUnsubscribe();
             currentRepertoireUnsubscribe = null;
        }
    });
}

/** Переключение секций аккордеона в репертуаре */
function toggleRepertoireKeySection(event) {
    const heading = event.currentTarget;
    const key = heading.dataset.key;
    const contentWrapper = document.querySelector(`.repertoire-songs-for-key[data-key-content="${key}"]`);
    const icon = heading.querySelector('i.fas');

    if (!contentWrapper || !icon) {
        console.error("Не найден контент или иконка для секции репертуара:", key);
        return;
    }

    const isCollapsed = contentWrapper.classList.contains('collapsed');

    // Свернуть все остальные секции, если нужно
    if (isCollapsed) { // Если собираемся открыть эту
        const allHeadings = document.querySelectorAll('.repertoire-key-heading');
        const allWrappers = document.querySelectorAll('.repertoire-songs-for-key');

        allWrappers.forEach(wrapper => {
            if (wrapper !== contentWrapper) {
                wrapper.classList.add('collapsed');
            }
        });
        allHeadings.forEach(head => {
            const headIcon = head.querySelector('i.fas');
            if (head !== heading && headIcon) {
                headIcon.classList.remove('fa-chevron-up');
                headIcon.classList.add('fa-chevron-down');
            }
        });
    }

    // Переключить текущую секцию
    contentWrapper.classList.toggle('collapsed');

    // Обновить иконку текущей секции
    if (contentWrapper.classList.contains('collapsed')) {
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    } else {
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    }
}

/** Добавление/Обновление песни в репертуаре вокалиста */
async function addToRepertoire() {
    console.log("Вызвана функция addToRepertoire");
    if (!currentVocalistId) {
        alert("Пожалуйста, сначала выберите вокалиста из списка."); return;
    }
    if (!sheetSelect || !songSelect || !keySelect) {
         console.error("addToRepertoire: Отсутствуют элементы sheetSelect, songSelect или keySelect."); return;
    }

    const selectedSheetKey = sheetSelect.value;
    const sheetName = SHEETS[selectedSheetKey];
    const songIndex = songSelect.value;

    if (!sheetName || !songIndex || songIndex === "" || !cachedData[sheetName]?.[songIndex]) {
         alert("Пожалуйста, сначала выберите песню для добавления в репертуар."); return;
    }
    const songData = cachedData[sheetName][songIndex];
    const songName = songData[0];
    const preferredKey = keySelect.value;
    console.log(`Добавляем в репертуар для ${currentVocalistName || currentVocalistId}: Песня "${songName}", Тональность: ${preferredKey}`);

    const repertoireDocId = `${sheetName}_${songIndex}`; // Кастомный ID документа
    const dataToSave = {
        sheet: sheetName,
        index: songIndex, // Сохраняем как строку (индекс из select)
        name: songName,
        preferredKey: preferredKey
        // addedAt: serverTimestamp() // Можно добавить, если нужен импорт
    };
    console.log("Данные для сохранения:", dataToSave);

    try {
        const docRef = doc(db, "vocalists", currentVocalistId, "repertoire", repertoireDocId);
        await setDoc(docRef, dataToSave); // setDoc перезапишет или создаст документ
        console.log(`Песня "${songName}" успешно добавлена/обновлена в репертуаре ${currentVocalistName || currentVocalistId}.`);
        alert(`Песня "${songName}" (${preferredKey}) добавлена/обновлена в репертуаре ${currentVocalistName || currentVocalistId}.`);
    } catch (error) {
        console.error("Ошибка при добавлении/обновлении песни в репертуаре:", error);
        alert("Произошла ошибка при сохранении песни в репертуар.");
    }
}

/** Удаление песни из репертуара вокалиста */
async function removeFromRepertoire(vocalistId, repertoireDocId) {
     console.log(`Попытка удалить песню ${repertoireDocId} из репертуара ${vocalistId}`);
     if (!vocalistId || !repertoireDocId) {
         console.error("removeFromRepertoire: Не переданы ID вокалиста или документа песни.");
         alert("Ошибка: Не удалось определить, что удалять.");
         return;
     }
     const vocalistDisplayName = currentVocalistName || vocalistId; // Отображаемое имя
     if (!confirm(`Удалить эту песню из репертуара ${vocalistDisplayName}?`)) {
         return; // Пользователь отменил
     }
     try {
         await deleteDoc(doc(db, "vocalists", vocalistId, "repertoire", repertoireDocId));
         console.log(`Песня ${repertoireDocId} успешно удалена из репертуара ${vocalistId}.`);
         alert("Песня удалена из репертуара.");
         // UI обновится через onSnapshot
     } catch (error) {
         console.error("Ошибка при удалении песни из репертуара:", error);
         alert("Произошла ошибка при удалении песни.");
     }
}

// --- НОВЫЕ ФУНКЦИИ ДЛЯ СЕТ-ЛИСТОВ ---

/** Загрузка и отображение списка сет-листов */
function loadSetlists() {
    if (!setlistsListContainer) {
        console.error("Контейнер для списка сет-листов (#setlists-list-container) не найден.");
        return;
    }
    setlistsListContainer.innerHTML = '<div class="empty-message">Загрузка сет-листов...</div>';

    const q = query(setlistsCollection, orderBy("name", "asc"));

    // Слушаем изменения
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setlistsListContainer.innerHTML = ''; // Очищаем
        if (snapshot.empty) {
            setlistsListContainer.innerHTML = '<div class="empty-message">Нет созданных сет-листов.</div>';
            selectSetlist(null, null); // Сброс текущего, если список опустел
            return;
        }

        snapshot.docs.forEach((doc) => {
            const setlist = doc.data();
            const setlistId = doc.id;
            const setlistItem = document.createElement('div');
            setlistItem.className = 'setlist-item';
            setlistItem.dataset.id = setlistId;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'setlist-name-display';
            nameSpan.textContent = setlist.name || 'Без названия';
            nameSpan.addEventListener('click', () => {
                selectSetlist(setlistId, setlist.name);
            });
            setlistItem.appendChild(nameSpan);

            const editButton = document.createElement('button');
            editButton.className = 'setlist-edit-button';
            editButton.title = 'Редактировать название';
            editButton.innerHTML = '<i class="fas fa-pencil-alt"></i>';
            editButton.addEventListener('click', (e) => {
                e.stopPropagation();
                startEditSetlistName(setlistItem, setlistId, setlist.name);
            });
            setlistItem.appendChild(editButton);

            // Подсветка активного
            if (setlistId === currentSetlistId) {
                setlistItem.classList.add('active');
            }

            setlistsListContainer.appendChild(setlistItem);
        });

        // Проверяем, существует ли еще текущий выбранный сет-лист
        if (currentSetlistId && !snapshot.docs.some(doc => doc.id === currentSetlistId)) {
             console.log(`Текущий сет-лист ${currentSetlistId} больше не существует, сбрасываем выбор.`);
             selectSetlist(null, null);
        }

    }, (error) => {
         console.error("Ошибка при загрузке списка сет-листов:", error);
         setlistsListContainer.innerHTML = '<div class="empty-message">Ошибка загрузки сет-листов.</div>';
         selectSetlist(null, null); // Сброс при ошибке
    });
    // Можно сохранить функцию отписки `unsubscribe`, если потребуется отписываться вручную
}

/** Обработка выбора сет-листа (ВЫНЕСЕНА ИЗ onSnapshot) */
function selectSetlist(setlistId, setlistName) {
    console.log(`Выбран сет-лист: ID=${setlistId || 'null'}, Имя=${setlistName || 'null'}`);
    currentSetlistId = setlistId;
    currentSetlistName = setlistName;

    // Обновляем подсветку в списке
    if (setlistsListContainer) {
        const items = setlistsListContainer.querySelectorAll('.setlist-item');
        items.forEach(item => {
            item.classList.toggle('active', item.dataset.id === setlistId);
        });
    }

    // Обновляем заголовок текущего сет-листа и кнопки
    if (currentSetlistTitle && currentSetlistControls) {
        if (setlistId) {
            currentSetlistTitle.textContent = setlistName || 'Сет-лист без названия';
            currentSetlistControls.style.display = 'flex';
        } else {
            currentSetlistTitle.textContent = 'Выберите сет-лист';
            currentSetlistControls.style.display = 'none';
            currentSetlistSongs = []; // Очищаем песни при сбросе
            if (currentSetlistSongsContainer) {
                currentSetlistSongsContainer.innerHTML = '<div class="empty-message">Сначала выберите сет-лист</div>';
            }
        }
    }

    // Загружаем песни для выбранного сет-листа
    loadCurrentSetlistSongs(setlistId);
}

/** Создание нового сет-листа */
async function createSetlist() {
    if (!newSetlistNameInput || !createSetlistButton) {
        console.error("Не найдены элементы для создания сет-листа."); return;
    }

    const setlistName = newSetlistNameInput.value.trim();
    if (!setlistName) {
        alert("Пожалуйста, введите название сет-листа.");
        newSetlistNameInput.focus();
        return;
    }

    createSetlistButton.disabled = true;
    createSetlistButton.textContent = 'Создание...';

    const dataToSave = {
        name: setlistName,
        createdAt: new Date() // Просто дата создания на клиенте
        // Или использовать: createdAt: serverTimestamp() // Требует импорта
    };

    try {
        const docRef = await addDoc(setlistsCollection, dataToSave);
        console.log("Новый сет-лист создан с ID:", docRef.id);
        newSetlistNameInput.value = '';
        // Список обновится сам через onSnapshot
        alert(`Сет-лист "${setlistName}" создан!`);
        // Автоматически выбираем созданный сет-лист
        selectSetlist(docRef.id, setlistName);
    } catch (error) {
        console.error("Ошибка при создании сет-листа:", error);
        alert("Не удалось создать сет-лист. Попробуйте еще раз.");
    } finally {
        createSetlistButton.disabled = false;
        createSetlistButton.textContent = 'Создать';
    }
}

/** Загрузка и отображение песен для ТЕКУЩЕГО выбранного сет-листа */
function loadCurrentSetlistSongs(setlistId) {
    if (!currentSetlistSongsContainer) {
        console.error("Контейнер #current-setlist-songs-container не найден.");
        return;
    }

    // 1. Отписка от предыдущего слушателя
    if (currentSetlistSongsUnsubscribe) {
        console.log("Отписка от предыдущего слушателя песен сет-листа.");
        currentSetlistSongsUnsubscribe();
        currentSetlistSongsUnsubscribe = null;
    }

    // 2. Очистка, если сет-лист не выбран
    if (!setlistId) {
        currentSetlistSongsContainer.innerHTML = '<div class="empty-message">Сначала выберите сет-лист</div>';
        currentSetlistSongs = [];
        return;
    }

    // 3. Индикатор загрузки
    currentSetlistSongsContainer.innerHTML = '<div>Загрузка песен сет-листа...</div>';
    currentSetlistSongs = [];

    // 4. Путь и запрос
    const songsCollectionRef = collection(db, "setlists", setlistId, "songs");
    const q = query(songsCollectionRef, orderBy("order", "asc"));

    console.log(`Установка слушателя для песен сет-листа ${setlistId}`);

    // 5. Установка нового слушателя
    currentSetlistSongsUnsubscribe = onSnapshot(q, (snapshot) => {
        // Проверка актуальности
        if (setlistId !== currentSetlistId) {
            console.warn(`Получен снимок песен для ${setlistId}, но текущий ${currentSetlistId}. Игнор.`);
            return;
        }

        console.log(`Слушатель песен ${setlistId} сработал. Документов: ${snapshot.size}`);
        currentSetlistSongsContainer.innerHTML = ''; currentSetlistSongs = []; // Очищаем перед отрисовкой

        if (snapshot.empty) {
            currentSetlistSongsContainer.innerHTML = '<div class="empty-message">Нет песен в сет-листе.</div>';
            return;
        }

        // 6. Обработка и отображение песен
        snapshot.docs.forEach((songDoc) => {
            const songData = songDoc.data();
            const songDocId = songDoc.id;

            currentSetlistSongs.push({ id: songDocId, ...songData }); // Сохраняем в массив

            const songItem = document.createElement('div');
            songItem.className = 'setlist-song-item';
            songItem.dataset.id = songDocId;
            songItem.dataset.sheet = songData.sheet;
            songItem.dataset.index = songData.index;

            // Элемент с названием песни
            const songInfo = document.createElement('span');
            songInfo.className = 'song-name';
            songInfo.textContent = `${songData.name || '...'} — ${songData.preferredKey || 'N/A'}`;
            songItem.appendChild(songInfo);

            // --- Кнопка Заметки (ОДИН БЛОК!) ---
            const noteBtn = document.createElement('button');
            noteBtn.innerHTML = '<i class="far fa-sticky-note"></i>'; // Иконка по умолчанию (пустая заметка)
            noteBtn.className = 'edit-setlist-song-note-button icon-button simple'; // Стили как у других иконок
            noteBtn.title = 'Добавить/Редактировать заметку';
            noteBtn.dataset.songdocid = songDocId; // Сохраняем ID документа песни из Firestore

            // Проверяем, есть ли заметка, и меняем иконку/title, если есть
            if (songData.notes && songData.notes.trim() !== '') {
                noteBtn.innerHTML = '<i class="fas fa-sticky-note"></i>'; // Закрашенная иконка
                noteBtn.classList.add('has-note'); // Добавляем класс для возможной доп. стилизации
                noteBtn.title = 'Посмотреть/Редактировать заметку';
            }
            // --- Конец блока кнопки Заметки ---

            // --- Кнопка Удаления ---
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.className = 'delete-button delete-song-from-setlist-button';
            deleteBtn.title = 'Удалить из сет-листа';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Остановить всплытие, чтобы не сработал клик по songItem
                deleteSongFromSetlist(songDocId);
            });
            // --- Конец блока кнопки Удаления ---


            // --- Добавляем кнопки в элемент песни В ПРАВИЛЬНОМ ПОРЯДКЕ ---
            songItem.appendChild(noteBtn);   // Сначала кнопка Заметки
            songItem.appendChild(deleteBtn); // Затем кнопка Удаления

            // Клик по всей строке песни (кроме кнопок)
            songItem.addEventListener('click', async (e) => {
                 // Игнорируем клик, если он был по одной из кнопок внутри строки
                 if (e.target.closest('button')) {
                     return;
                 }

                console.log(`Клик по песне "${songData.name}" в сет-листе.`);
                if (!cachedData[songData.sheet]?.[songData.index]) {
                    console.log(`Загрузка листа "${songData.sheet}"...`);
                    await fetchSheetData(songData.sheet);
                    if (!cachedData[songData.sheet]?.[songData.index]) {
                        alert(`Не удалось загрузить/найти данные песни "${songData.name}".`);
                        return;
                    }
                }
                const originalSongData = cachedData[songData.sheet][songData.index];
                const sheetNameValue = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === songData.sheet);

                if(sheetSelect && sheetNameValue) sheetSelect.value = sheetNameValue;
                await loadSheetSongs();
                if(songSelect) songSelect.value = songData.index;
                displaySongDetails(originalSongData, songData.index, songData.preferredKey);

                // !!! ЗАКРЫВАЕМ ПАНЕЛИ ПОСЛЕ КЛИКА !!!
                closeAllSidePanels();
            }); // Конец обработчика клика по songItem

            currentSetlistSongsContainer.appendChild(songItem); // Добавляем готовую строку песни в контейнер
        }); // Конец forEach songDoc

        // Тут можно инициализировать drag-n-drop, если он будет
        // initSortable();

    }, (error) => { // Обработка ошибок onSnapshot
        if (setlistId !== currentSetlistId) { return; } // Игнорируем ошибку, если сет-лист уже сменился
        console.error(`Ошибка загрузки песен для ${setlistId}:`, error);
        currentSetlistSongsContainer.innerHTML = '<div class="empty-message">Ошибка загрузки песен.</div>';
        currentSetlistSongs = [];
        // Отписываемся при ошибке слушателя
        if (currentSetlistSongsUnsubscribe) {
            currentSetlistSongsUnsubscribe();
            currentSetlistSongsUnsubscribe = null;
        }
    });
} // Конец функции loadCurrentSetlistSongs


/** Добавляет текущую песню в ВЫБРАННЫЙ сет-лист */
async function addToCurrentSetlist() {
    console.log("Попытка добавить песню в текущий сет-лист...");

    // 1. Проверка выбора сет-листа
    if (!currentSetlistId) {
        alert("Пожалуйста, сначала выберите сет-лист в панели слева, куда нужно добавить песню.");
        if (favoritesPanel && !favoritesPanel.classList.contains('open')) {
            favoritesPanel.classList.add('open');
            if (repertoirePanel) repertoirePanel.classList.remove('open');
            // loadFavorites(); // Обновлять избранное не обязательно
            loadSetlists(); // Обновить список сет-листов
        }
        return;
    }

    // 2. Получение данных текущей песни
    if (!sheetSelect || !songSelect || !keySelect) {
         console.error("addToCurrentSetlist: Отсутствуют sheetSelect, songSelect или keySelect."); return;
    }
    const sheetNameKey = sheetSelect.value;
    const sheetName = SHEETS[sheetNameKey];
    const songIndex = songSelect.value;

    if (!sheetName || songIndex === "" || !cachedData[sheetName]?.[songIndex]) {
        alert("Пожалуйста, сначала выберите песню, которую хотите добавить.");
        return;
    }
    const songData = cachedData[sheetName][songIndex];
    const songName = songData[0];
    const preferredKey = keySelect.value;

    console.log(`Добавляем: Песня="${songName}", Тональность=${preferredKey} в Сет-лист ID=${currentSetlistId} (${currentSetlistName || ''})`);

    // 3. Определение порядка (order)
    const nextOrder = currentSetlistSongs.length > 0
        ? Math.max(...currentSetlistSongs.map(song => song.order ?? -1)) + 1
        : 0;
    console.log("Следующий порядок (order):", nextOrder);

    // 4. Данные для сохранения
    const songEntryData = {
        sheet: sheetName,
        index: songIndex, // Сохраняем индекс как строку
        name: songName,
        preferredKey: preferredKey,
        order: nextOrder
        // createdAt: new Date() // Можно добавить
    };

    // 5. Добавление в Firestore (с проверкой на дубликат)
    try {
        const songsCollectionRef = collection(db, "setlists", currentSetlistId, "songs");
        const q = query(songsCollectionRef, where("sheet", "==", sheetName), where("index", "==", songIndex));
        const duplicateSnapshot = await getDocs(q);

        if (!duplicateSnapshot.empty) {
            const existingDoc = duplicateSnapshot.docs[0];
            const existingData = existingDoc.data();
            if (existingData.preferredKey !== preferredKey) {
                if (confirm(`Песня "${songName}" уже есть в сет-листе "${currentSetlistName}". Обновить тональность на ${preferredKey}?`)) {
                    await setDoc(doc(db, "setlists", currentSetlistId, "songs", existingDoc.id), { preferredKey: preferredKey }, { merge: true });
                    alert(`Тональность песни "${songName}" в сет-листе обновлена на ${preferredKey}.`);
                }
            } else {
                alert(`Песня "${songName}" уже есть в сет-листе "${currentSetlistName}" с той же тональностью.`);
            }
            return; // Выходим
        }

        // Дубликатов нет, добавляем
        const docRef = await addDoc(songsCollectionRef, songEntryData);
        console.log(`Песня добавлена в сет-лист ${currentSetlistId} с ID документа: ${docRef.id}`);
        alert(`Песня "${songName}" (${preferredKey}) добавлена в сет-лист "${currentSetlistName}".`);
        // Список обновится через onSnapshot

    } catch (error) {
        console.error("Ошибка при добавлении песни в сет-лист:", error);
        alert("Произошла ошибка при добавлении песни в сет-лист.");
    }
}

/** Удаление ОДНОЙ песни из ТЕКУЩЕГО сет-листа */
async function deleteSongFromSetlist(songDocId) {
    if (!currentSetlistId) {
        console.error("Не выбран сет-лист для удаления песни.");
        alert("Произошла ошибка: не выбран сет-лист.");
        return;
    }

    const songToDelete = currentSetlistSongs.find(song => song.id === songDocId);
    const songNameToConfirm = songToDelete ? `"${songToDelete.name}"` : "эту песню";
    const setlistNameToConfirm = currentSetlistName || 'текущего';

    if (confirm(`Вы уверены, что хотите удалить ${songNameToConfirm} из сет-листа "${setlistNameToConfirm}"?`)) {
        console.log(`Попытка удаления песни ${songDocId} из сет-листа ${currentSetlistId}`);
        try {
            const songDocRef = doc(db, "setlists", currentSetlistId, "songs", songDocId);
            await deleteDoc(songDocRef);
            console.log("Песня успешно удалена из сет-листа.");
            alert("Песня удалена из сет-листа.");
            // UI обновится через onSnapshot
        } catch (error) {
            console.error("Ошибка при удалении песни из сет-листа:", error);
            alert("Не удалось удалить песню из сет-листа.");
        }
    }
}

/** Удаление ВСЕГО ТЕКУЩЕГО сет-листа */
async function deleteCurrentSetlist() {
    if (!currentSetlistId || !currentSetlistName) {
        alert("Сначала выберите сет-лист, который хотите удалить.");
        return;
    }

    if (confirm(`ВЫ УВЕРЕНЫ, что хотите ПОЛНОСТЬЮ удалить сет-лист "${currentSetlistName}"?\n\nЭто действие необратимо и удалит сам сет-лист (но не сами песни из общих таблиц).`)) {
        console.log(`Попытка удаления сет-листа ${currentSetlistId}`);
        // Сначала отпишемся от песен удаляемого сет-листа, если есть подписка
        if (currentSetlistSongsUnsubscribe) {
            currentSetlistSongsUnsubscribe();
            currentSetlistSongsUnsubscribe = null;
        }
        try {
            const setlistDocRef = doc(db, "setlists", currentSetlistId);
            await deleteDoc(setlistDocRef);
            console.log("Сет-лист успешно удален.");
            alert(`Сет-лист "${currentSetlistName}" удален.`);

            // Сбрасываем выбор текущего сет-листа
            selectSetlist(null, null);
            // Список сет-листов обновится через onSnapshot
            // ВАЖНО: Песни в подколлекции 'songs' остаются "осиротевшими". Для полного удаления нужна Firebase Function.

        } catch (error) {
            console.error("Ошибка при удалении сет-листа:", error);
            alert("Не удалось удалить сет-лист.");
        }
    }
}

/** Вход в режим редактирования имени сет-листа */
function startEditSetlistName(itemElement, id, currentName) {
    const currentlyEditing = document.querySelector('.setlist-item.is-editing');
    if (currentlyEditing && currentlyEditing !== itemElement) {
        cancelEditSetlistName(currentlyEditing);
    }
    if (itemElement.classList.contains('is-editing')) return;

    itemElement.classList.add('is-editing');

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-setlist-input';
    input.value = currentName || '';
    input.dataset.originalName = currentName || '';

    const editButtonRef = itemElement.querySelector('.setlist-edit-button');
    if (editButtonRef) {
        itemElement.insertBefore(input, editButtonRef);
    } else {
        itemElement.prepend(input); // Fallback
    }

    input.focus();
    input.select();

    const saveHandler = () => {
        // Проверяем, что input все еще существует в DOM перед сохранением
        if (itemElement.contains(input)) {
            saveSetlistName(id, input, itemElement);
        }
    };

    const keydownHandler = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveHandler();
        } else if (e.key === 'Escape') {
            cancelEditSetlistName(itemElement);
        }
    };

    // Используем 'blur' для сохранения, но с небольшой задержкой,
    // чтобы позволить Enter сработать первым и избежать двойного сохранения.
    let blurTimeout;
    input.addEventListener('blur', () => {
       // Сразу вызываем сохранение при потере фокуса
       saveSetlistName(id, input, itemElement);
   });

    input.addEventListener('keydown', keydownHandler);

    // Сохраняем обработчики для последующего удаления
    itemElement.dataset.keydownHandler = keydownHandler; // Сохраняем ссылку
}

/** Сохранение нового имени сет-листа (ИСПРАВЛЕНО) */
async function saveSetlistName(id, inputElement, itemElement) {
    // Проверяем, существует ли еще элемент ввода
    // (важно, т.к. blur может сработать после Escape или Enter)
    if (!inputElement || !itemElement || !itemElement.contains(inputElement)) {
        // console.log("saveSetlistName: Input element no longer exists or not in itemElement.");
        return;
    }
    // Добавим проверку, не в процессе ли уже сохранение (на всякий случай)
    if (itemElement.dataset.isSaving === 'true') {
        // console.log("saveSetlistName: Already saving...");
        return;
    }

    const newName = inputElement.value.trim();
    const originalName = inputElement.dataset.originalName;

    // Если имя пустое или не изменилось, просто отменяем редактирование
    if (!newName || newName === originalName) {
        cancelEditSetlistName(itemElement); // Возвращаем старый вид
        return;
    }

    // Помечаем, что началось сохранение
    itemElement.dataset.isSaving = 'true';
    inputElement.disabled = true; // Блокируем поле ввода

    console.log(`Сохранение нового имени "${newName}" для сет-листа ${id}`);
    try {
        const setlistDocRef = doc(db, "setlists", id);
        // --- СНАЧАЛА СОХРАНЯЕМ В FIRESTORE ---
        await updateDoc(setlistDocRef, { name: newName });
        console.log("Имя сет-листа успешно обновлено в Firestore.");

        // --- ПОТОМ ОБНОВЛЯЕМ UI УСПЕШНО ---
        // Обновляем имя в заголовке текущего сетлиста, если редактировали его
        if(id === currentSetlistId && currentSetlistTitle){
            currentSetlistTitle.textContent = newName;
            currentSetlistName = newName; // Обновляем и глобальное состояние
        }
        // Убираем поле ввода и показываем НОВОЕ имя
        cancelEditSetlistName(itemElement, newName);
        // alert("Имя сет-листа обновлено!"); // Можно раскомментировать

    } catch (error) {
        console.error("Ошибка при обновлении имени сет-листа:", error);
        alert("Не удалось обновить имя сет-листа. Попробуйте еще раз.");
        // --- ОБНОВЛЯЕМ UI ПРИ ОШИБКЕ (возвращаем старое имя) ---
        cancelEditSetlistName(itemElement, originalName); // Убираем поле, показываем СТАРОЕ имя

    } finally {
        // Снимаем флаг сохранения в любом случае
         if (itemElement) { // Элемент мог быть удален
             delete itemElement.dataset.isSaving;
         }
        // Разблокируем поле ввода (хотя оно уже должно быть удалено)
        // if (inputElement) inputElement.disabled = false; // Не нужно, т.к. удаляем через cancel
    }
} // Конец saveSetlistName

/** Отмена режима редактирования имени сет-листа (ИСПРАВЛЕНО) */
function cancelEditSetlistName(itemElement, nameToShow) { // Добавлен второй аргумент
    if (!itemElement || !itemElement.classList.contains('is-editing')) {
        return;
    }

    const input = itemElement.querySelector('input.edit-setlist-input');
    if (input) {
        // Удаляем слушатели перед удалением элемента (хотя это может быть излишним)
        input.removeEventListener('blur', () => {}); // Простая заглушка, т.к. ссылки нет
        const keydownHandlerRef = itemElement.dataset.keydownHandler; // Пытаемся получить ссылку (не очень надежно)
        if (keydownHandlerRef) {
            // input.removeEventListener('keydown', keydownHandlerRef); // Удаление по ссылке не всегда работает
            delete itemElement.dataset.keydownHandler; // Удаляем атрибут
        }
        itemElement.removeChild(input);
    }

    // Обновляем текст в span ПЕРЕД тем, как сделать его видимым
    const nameSpan = itemElement.querySelector('span.setlist-name-display');
    if (nameSpan) {
        // Используем переданное имя (новое или старое) или оригинальное из data-атрибута
         const originalNameFromData = input?.dataset?.originalName; // Пытаемся получить из удаленного инпута
        nameSpan.textContent = nameToShow !== undefined ? nameToShow : (originalNameFromData || 'Без названия');
    }

    itemElement.classList.remove('is-editing'); // Убираем класс (показывает span/кнопку)
    // itemElement.focus(); // Не фокусируем здесь, чтобы blur успел отработать
} // Конец cancelEditSetlistName

// --- КОНЕЦ НОВЫХ ФУНКЦИЙ ДЛЯ СЕТ-ЛИСТОВ ---

// --- CORE LOGIC / UTILITIES ---

/** Расчет смещения для транспонирования */
function getTransposition(originalKey, newKey) {
    // Проверка на пустые или некорректные ключи
    if (!originalKey || !newKey) {
        // console.warn(`getTransposition: One or both keys are missing. Original: ${originalKey}, New: ${newKey}`);
        return 0;
    }
    const originalIndex = chords.indexOf(originalKey);
    const newIndex = chords.indexOf(newKey);
    if (originalIndex === -1 || newIndex === -1) {
        console.warn(`Invalid key(s) for transposition: ${originalKey} -> ${newKey}. Using 0 shift.`);
        return 0; // Возвращаем 0, если ключ не найден в массиве chords
    }
    // Расчет смещения с учетом "закольцованности" массива аккордов
    let transposition = newIndex - originalIndex;
    // // Обработка перехода через конец массива (не обязательна с modulo ниже, но для ясности)
    // if (transposition > 6) transposition -= 12;
    // if (transposition < -6) transposition += 12;
    return transposition; // Возвращаем разницу индексов
}

/** Транспонирование одного аккорда */
function transposeChord(chord, transposition) {
    if (transposition === 0 || !chord) return chord; // Не транспонируем, если нет смещения или аккорда

    let chordType = '';
    let baseChord = chord;
    let bassNote = '';
    // Список суффиксов аккордов, от длинных к коротким, для корректного парсинга
    const suffixes = ['maj7', 'maj9', 'm7', 'm9', 'm11', '7sus4', 'sus4', 'sus2', 'add9', 'dim7', 'dim', 'aug7', 'aug', '7', 'm', '6', '9', '11', '13', 'sus'];

    // 1. Разделение на основной аккорд и басовую ноту (если есть)
    if (chord.includes('/')) {
        const parts = chord.split('/');
        if (parts.length === 2) {
             baseChord = parts[0];
             bassNote = parts[1];
        } else {
            console.warn("Malformed chord with '/':", chord); // Некорректный формат
            return chord; // Возвращаем как есть
        }
    }

    // 2. Определение типа аккорда (суффикса)
    for (let suffix of suffixes) {
        if (baseChord.endsWith(suffix)) {
            baseChord = baseChord.slice(0, -suffix.length); // Убираем суффикс из базового аккорда
            chordType = suffix; // Сохраняем суффикс
            break; // Нашли самый длинный подходящий суффикс, выходим
        }
    }

    // 3. Транспонирование основной ноты аккорда
    const baseChordIndex = chords.indexOf(baseChord);
    if (baseChordIndex === -1) {
        // console.warn(`Unknown base chord for transposition: ${baseChord} in ${chord}`);
        return chord; // Неизвестный базовый аккорд, возвращаем как есть
    }
    const newBaseChordIndex = (baseChordIndex + transposition + chords.length) % chords.length;
    const transposedBaseChord = chords[newBaseChordIndex] + chordType; // Собираем новую базу с типом

    // 4. Транспонирование басовой ноты (если была)
    if (bassNote) {
        const bassNoteIndex = chords.indexOf(bassNote);
        if (bassNoteIndex !== -1) {
            const newBassNoteIndex = (bassNoteIndex + transposition + chords.length) % chords.length;
            return `${transposedBaseChord}/${chords[newBassNoteIndex]}`; // Возвращаем с транспонированным басом
        } else {
            // console.warn(`Unknown bass note: ${bassNote} in ${chord}`);
            return `${transposedBaseChord}/${bassNote}`; // Бас-нота не найдена, оставляем как есть
        }
    }

    // 5. Возвращаем транспонированный аккорд без баса
    return transposedBaseChord;
}

/** Очистка аккорда от лишних пробелов (если они влияют на парсинг) */
// function cleanChord(chord) {
//     return chord.replace(/\s+/g, ''); // Может быть не нужна, если regex обрабатывает пробелы
// }

/** Транспонирование всего текста с аккордами */
function transposeLyrics(lyrics, transposition) {
    if (transposition === 0 || !lyrics) return lyrics;

    // Улучшенное регулярное выражение:
    // - Учитывает необязательные пробелы вокруг /
    // - Обрабатывает b (бемоль) как часть ноты
    // - Более точно определяет границы аккорда
    const chordRegex = /([A-H][#b]?(?:maj7|maj9|m7|m9|m11|7sus4|sus4|sus2|add9|dim7|dim|aug7|aug|7|m|6|9|11|13|sus)?(?:\s*\/\s*[A-H][#b]?)?)/g;

    try {
        return lyrics.replace(chordRegex, (match) => {
            // Убираем пробелы вокруг слэша перед транспонированием, если они есть
            const cleanedMatch = match.replace(/\s*\/\s*/, '/');
            return transposeChord(cleanedMatch, transposition);
        });
    } catch (error) {
        console.error("Ошибка при транспонировании текста:", error, "Текст:", lyrics.substring(0, 100) + "...");
        return lyrics; // Возвращаем оригинальный текст при ошибке
    }
}

/** Обработка строк текста для уменьшения пробелов МЕЖДУ словами/аккордами */
function processLyrics(lyrics) {
    if (!lyrics) return '';
    // Разделяем на строки
    return lyrics.split('\n').map(line => {
        // Заменяем 2+ пробела на округленную половину их количества ИЛИ просто один пробел
        // return line.replace(/ {2,}/g, match => ' '.repeat(Math.max(1, Math.ceil(match.length / 2))));
        // Или более простой вариант: заменять 2+ пробела на один пробел
        return line.replace(/ {2,}/g, ' ');
    }).join('\n'); // Собираем обратно
}

/** Выделение аккордов тегами span для стилизации */
function highlightChords(lyrics) {
    if (!lyrics) return '';
    // Используем то же улучшенное регулярное выражение, что и в transposeLyrics
    const chordRegex = /([A-H][#b]?(?:maj7|maj9|m7|m9|m11|7sus4|sus4|sus2|add9|dim7|dim|aug7|aug|7|m|6|9|11|13|sus)?(?:\s*\/\s*[A-H][#b]?)?)/g;
    try {
        // Заменяем найденные аккорды на <span class="chord">аккорд</span>
        return lyrics.replace(chordRegex, '<span class="chord">$1</span>');
    } catch (error) {
        console.error("Ошибка при выделении аккордов:", error, "Текст:", lyrics.substring(0, 100) + "...");
        return lyrics; // Возвращаем оригинальный текст при ошибке
    }
}

/** Поиск песен */
async function searchSongs(query) {
    const lowerQuery = query.trim().toLowerCase();
    if (!searchResults) return; // Если элемента нет, выходим

    searchResults.innerHTML = ''; // Очищаем результаты
    if (!lowerQuery) return; // Если запрос пуст, выходим

    // Убедимся, что данные всех листов загружены (или попытаемся загрузить, если нужно)
    // В данном сценарии предполагаем, что loadAllSheetsData уже была вызвана при инициализации.
    if (allSheetsData.length === 0) {
         console.warn("searchSongs: Нет данных для поиска (allSheetsData пуст). Попытка загрузить...");
         // Можно добавить вызов loadAllSheetsData(), но это может быть медленно
         searchResults.innerHTML = '<div class="search-result">Данные для поиска не загружены.</div>';
         return;
    }

    const matchingSongs = [];
    // Ищем по всем загруженным листам
    allSheetsData.forEach(sheetInfo => {
        // Пропускаем листы, которые не загрузились (если используем allSettled)
        if (sheetInfo.error || !sheetInfo.data) return;

        sheetInfo.data.forEach((row, index) => {
            // Проверяем, что строка существует и содержит название песни (в первой колонке)
            if (row && row[0]) {
                const name = row[0].trim().toLowerCase();
                // Ищем вхождение запроса в название
                if (name.includes(lowerQuery)) {
                    // Добавляем найденную песню с информацией о ее расположении
                    matchingSongs.push({
                        name: row[0], // Оригинальное название
                        sheetKey: Object.keys(SHEETS).find(key => SHEETS[key] === sheetInfo.sheetName), // Ключ листа для select
                        sheetName: sheetInfo.sheetName, // Полное имя листа
                        index: index // Индекс строки на листе
                    });
                }
            }
        });
    });

    if (matchingSongs.length === 0) {
        searchResults.innerHTML = '<div class="search-result">Ничего не найдено</div>';
        return;
    }

    // Отображаем найденные песни
    matchingSongs.forEach((songMatch) => {
        const resultItem = document.createElement('div');
        resultItem.textContent = `${songMatch.name} (${songMatch.sheetKey || songMatch.sheetName})`; // Показываем название и лист
        resultItem.className = 'search-result';
        resultItem.addEventListener('click', async () => {
            if (!songMatch.sheetKey || !cachedData[songMatch.sheetName]) {
                 console.warn("Не найден ключ листа или данные в кэше для:", songMatch);
                 // Попытка догрузить данные листа, если их нет
                 if (songMatch.sheetName) await fetchSheetData(songMatch.sheetName);
                 if (!cachedData[songMatch.sheetName]) {
                     alert("Не удалось загрузить данные для выбранной песни.");
                     return;
                 }
            }

            const originalSongData = cachedData[songMatch.sheetName]?.[songMatch.index];
            if (!originalSongData) {
                 console.error("Данные песни не найдены в кэше после поиска:", songMatch);
                 alert("Ошибка при выборе песни из поиска: данные не найдены.");
                 return;
            }

            // Обновляем интерфейс
            if (sheetSelect && songMatch.sheetKey) sheetSelect.value = songMatch.sheetKey;
            await loadSheetSongs(); // Загружаем песни для выбранного листа
            if (songSelect) songSelect.value = songMatch.index; // Выбираем песню

            displaySongDetails(originalSongData, songMatch.index); // Отображаем детали

            // Очищаем поиск и инпут
            if (searchResults) searchResults.innerHTML = '';
            if (searchInput) searchInput.value = songMatch.name; // Показываем полное имя в инпуте
        });
        searchResults.appendChild(resultItem);
    });
}

/** Извлечение ID видео YouTube из URL */
function extractYouTubeVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    let videoId = null;
    try {
        // Регулярное выражение для различных форматов ссылок YouTube
        const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        if (match && match[1]) {
            videoId = match[1];
        } else {
            // Дополнительная проверка, если URL - это просто ID
            if (url.length === 11 && /^[a-zA-Z0-9_-]+$/.test(url)) {
                videoId = url;
            }
        }
    } catch (e) {
        console.error("Error extracting YouTube video ID:", e, "URL:", url);
        return null;
    }
    // console.log(`Extracted Video ID: ${videoId} from URL: ${url}`); // Отладка
    return videoId;
}

/** Проверка, является ли текущий вид мобильным */
function isMobileView() {
    // Используем стандартную точку останова для мобильных устройств
    return window.innerWidth <= 768; // Или 480, если дизайн очень компактный
}


// --- UI UPDATE FUNCTIONS ---

/** Запускает режим презентации */
async function showPresentationView(songsToShow) {
    if (!presentationOverlay || !presentationContent) {
        console.error("Не могу показать презентацию: нет оверлея или контента.");
        return;
    }
    if (!songsToShow || songsToShow.length === 0) {
         alert("Нет песен для показа в презентации.");
         console.warn("showPresentationView вызван без песен.");
         return;
    }
    console.log(`Запуск режима презентации с ${songsToShow.length} песнями.`);

    presentationSongs = [...songsToShow]; // Копируем массив песен
    currentPresentationIndex = 0;
    isPresentationSplit = false; // Сброс разделения
    updatePresentationSplitButtonState();

    // document.body.style.overflow = 'hidden'; // Скрыть скролл основной страницы

    await displayCurrentPresentationSong(); // Отобразить первую песню

    presentationOverlay.classList.add('visible');
    presentationOverlay.scrollTop = 0; // Прокрутка оверлея вверх
    showPresentationControls(); // Показать панель управления
}

/** Отображает ТЕКУЩУЮ песню в режиме презентации */
/** Отображает ТЕКУЩУЮ песню в режиме презентации */
async function displayCurrentPresentationSong() {
    if (!presentationContent || presentationSongs.length === 0) return;

    // Коррекция индекса, если он вышел за пределы
    currentPresentationIndex = Math.max(0, Math.min(currentPresentationIndex, presentationSongs.length - 1));

    const song = presentationSongs[currentPresentationIndex];
    console.log(`Презентация: Показываем песню ${currentPresentationIndex + 1}/${presentationSongs.length}: ${song.name}`);

    presentationContent.innerHTML = `<div class="presentation-loading">Загрузка "${song.name}"...</div>`;

    try {
        // Получение данных
        if (!cachedData[song.sheet]?.[song.index]) {
            console.log(`Presentation: Загрузка данных для ${song.name} (${song.sheet})`);
            await fetchSheetData(song.sheet);
        }
        const originalSongData = cachedData[song.sheet]?.[song.index];
        if (!originalSongData) {
            throw new Error(`Не найдены данные для песни "${song.name}" (${song.sheet}, индекс ${song.index})`);
        }

        // Подготовка текста
        const songTitle = originalSongData[0];
        const originalLyrics = originalSongData[1] || '';
        const originalKey = originalSongData[2] || chords[0];
        const targetKey = song.preferredKey || originalKey;
        const songNote = song.notes || '';

        // --- ИСПРАВЛЕНИЕ: Добавлен вызов highlightStructure ---
        const transposition = getTransposition(originalKey, targetKey);
        const transposedLyrics = transposeLyrics(originalLyrics, transposition);
        // 1. Выделяем структуру
        const structureHighlightedLyrics = highlightStructure(transposedLyrics);
        // 2. Выделяем аккорды
        const finalHighlightedLyrics = highlightChords(structureHighlightedLyrics);
        // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

        // Формирование HTML
        const songHtml = `
            <div class="presentation-song">
                <h2>${songTitle} — ${targetKey}</h2>
                ${songNote ? `<div class="presentation-notes"><i class="fas fa-info-circle"></i> ${songNote.replace(/\n/g, '<br>')}</div>` : ''}
                <pre>${finalHighlightedLyrics}</pre> 
            </div>
        `;
        presentationContent.innerHTML = songHtml;

        presentationContent.classList.toggle('split-columns', isPresentationSplit);

        const songElement = presentationContent.querySelector('.presentation-song pre');
        if (songElement) songElement.scrollTop = 0;

    } catch (error) {
        console.error("Ошибка при отображении песни в презентации:", error);
        presentationContent.innerHTML = `<div class="presentation-song error"><h2>Ошибка загрузки песни</h2><p>${error.message || 'Неизвестная ошибка'}</p></div>`;
    }

    // Обновление счетчика и кнопок навигации
    if (presCounter) {
        presCounter.textContent = `${currentPresentationIndex + 1} / ${presentationSongs.length}`;
    }
    if (presPrevBtn) presPrevBtn.disabled = (currentPresentationIndex === 0);
    if (presNextBtn) presNextBtn.disabled = (currentPresentationIndex >= presentationSongs.length - 1);
} // Конец функции displayCurrentPresentationSong

/** Переключает на СЛЕДУЮЩУЮ песню в презентации */
function nextPresentationSong() {
    if (currentPresentationIndex < presentationSongs.length - 1) {
        currentPresentationIndex++;
        displayCurrentPresentationSong();
        showPresentationControls(); // Показать контролы при смене песни
    }
}

/** Переключает на ПРЕДЫДУЩУЮ песню в презентации */
function prevPresentationSong() {
    if (currentPresentationIndex > 0) {
        currentPresentationIndex--;
        displayCurrentPresentationSong();
        showPresentationControls(); // Показать контролы при смене песни
    }
}

// --- Функции для автоскрытия панели управления в презентации ---
const CONTROLS_HIDE_DELAY = 3000; // 3 секунды

/** Показывает панель управления и запускает таймер для скрытия */
function showPresentationControls() {
    if (!presentationControls) return;
    presentationControls.classList.remove('controls-hidden');
    clearTimeout(controlsHideTimeout); // Отменяем предыдущий таймер
    // Запускаем новый таймер только если панель управления существует
    controlsHideTimeout = setTimeout(hidePresentationControls, CONTROLS_HIDE_DELAY);
}

/** Скрывает панель управления */
function hidePresentationControls() {
    if (presentationControls) {
        presentationControls.classList.add('controls-hidden');
    }
}

/** Переключает режим разделения текста в презентации */
function togglePresentationSplit() {
    if (!presentationContent) return;
    isPresentationSplit = !isPresentationSplit;
    presentationContent.classList.toggle('split-columns', isPresentationSplit);
    updatePresentationSplitButtonState();
    showPresentationControls(); // Показать контролы при переключении
}

/** Обновляет иконку и title кнопки разделения в презентации */
function updatePresentationSplitButtonState() {
    if (!presSplitTextBtn) return;

    const splitIconClass = 'fa-columns';
    const mergeIconClass = 'fa-align-justify';
    const splitTitle = 'Разделить текст';
    const mergeTitle = 'Объединить колонки';

    const iconElement = presSplitTextBtn.querySelector('i');
    if (!iconElement) return;

    if (isPresentationSplit) { // Если разделено
        iconElement.classList.remove(splitIconClass);
        iconElement.classList.add(mergeIconClass);
        presSplitTextBtn.title = mergeTitle;
    } else { // Если объединено
        iconElement.classList.remove(mergeIconClass);
        iconElement.classList.add(splitIconClass);
        presSplitTextBtn.title = splitTitle;
    }
}

// --- Логика для Свайпов в режиме презентации ---
let touchstartX = 0;
let touchendX = 0;
let touchstartY = 0;
let touchendY = 0;
const SWIPE_THRESHOLD = 50; // Минимальная длина свайпа
const SWIPE_VERTICAL_LIMIT = 75; // Макс. отклонение по вертикали

function handleGesture() {
    const horizontalDiff = touchendX - touchstartX;
    const verticalDiff = Math.abs(touchendY - touchstartY);

    // Игнорируем, если свайп был больше вертикальным или слишком коротким
    if (verticalDiff > SWIPE_VERTICAL_LIMIT || Math.abs(horizontalDiff) < SWIPE_THRESHOLD) {
        // console.log("Swipe ignored (vertical or too short)");
        return;
    }

    if (horizontalDiff < 0) { // Свайп влево
        console.log('Swipe Left -> Next Song');
        nextPresentationSong();
    } else { // Свайп вправо
        console.log('Swipe Right -> Previous Song');
        prevPresentationSong();
    }
}

function setupSwipeListeners() {
    if (!presentationOverlay) return;

    presentationOverlay.addEventListener('touchstart', e => {
        // Проверяем, что касание не на панели управления
        if (e.target.closest('.presentation-controls')) return;
        touchstartX = e.changedTouches[0].screenX;
        touchstartY = e.changedTouches[0].screenY;
    }, { passive: true });

    presentationOverlay.addEventListener('touchend', e => {
        // Проверяем, что касание не на панели управления
         if (e.target.closest('.presentation-controls')) return;
        touchendX = e.changedTouches[0].screenX;
        touchendY = e.changedTouches[0].screenY;
        handleGesture();
    }, { passive: true }); // Используем passive: true для лучшей производительности

     // Также добавим показ контролов при простом тапе (не свайпе)
     presentationOverlay.addEventListener('click', (e) => {
          // Показываем контролы только если клик не был по самой панели
         if (!e.target.closest('.presentation-controls')) {
              showPresentationControls();
         }
     });

    console.log("Слушатели свайпов и кликов для презентации установлены.");
}


// --- UI UPDATE FUNCTIONS (Continued) ---

/** Отображает детали выбранной песни */
function displaySongDetails(songData, index, keyToSelect) {
    // Проверки на наличие элементов
    if (!songContent || !keySelect || !playerContainer || !playerSection) {
        console.error("displaySongDetails: Отсутствуют критически важные DOM элементы.");
        return;
    }
    const keyDisplay = document.getElementById('youtube-video-key-display');

    // --- СБРОС, ЕСЛИ ПЕСНЯ НЕ ВЫБРАНА ---
    if (!songData || index === undefined || index === null || index === "") {
        // Находим кнопку копирования ПЕРЕД очисткой, если она есть
        const existingCopyButton = songContent.querySelector('#copy-text-button');
        if (existingCopyButton) existingCopyButton.style.display = 'none'; // Скрываем

        songContent.innerHTML = '<h2>Выберите песню</h2><pre></pre>'; // Очищаем контент
        playerContainer.innerHTML = '';
        playerSection.style.display = 'none';
        if (bpmDisplay) bpmDisplay.textContent = 'N/A';
        if (holychordsButton) {
            holychordsButton.style.display = 'none';
            holychordsButton.href = '#';
        }
        keySelect.value = chords[0]; // Сброс на C
        keySelect.dataset.index = ''; // Очистка индекса для транспонирования
        if (keyDisplay) keyDisplay.style.display = 'none';

        // Блокируем кнопки действий
        if (favoriteButton) favoriteButton.disabled = true;
        if (addToSetlistButton) addToSetlistButton.disabled = true;
        if (addToRepertoireButton) addToRepertoireButton.disabled = true;
        if (toggleChordsButton) {
            toggleChordsButton.disabled = true; // Блокируем кнопку Аккорды
            // Обновляем ее вид на заблокированный (если функция доступна)
            if (typeof window.updateToggleButton === 'function') {
                 window.updateToggleButton();
            }
        }
        // Кнопка копирования уже скрыта выше

        // Убираем класс скрытия аккордов, если он был
         if (songContent) songContent.classList.remove('chords-hidden');

        return;
    }

    // --- ОТОБРАЖЕНИЕ ВЫБРАННОЙ ПЕСНИ ---
    const title = songData[0] || 'Без названия';
    const lyrics = songData[1] || '';
    const originalKeyFromSheet = songData[2] || chords[0];
    const srcUrl = songData[3] || '#';
    const bpm = songData[4] || 'N/A';
    const ytLink = songData[5];
    const videoKey = songData[6] ? songData[6].trim() : null;

    const currentSelectedKey = keyToSelect || originalKeyFromSheet;
    keySelect.value = currentSelectedKey;
    keySelect.dataset.index = index;

    if (bpmDisplay) {
        updateBPM(bpm);
        bpmDisplay.textContent = bpm;
    }
    if (holychordsButton) {
        if (srcUrl && srcUrl.trim() !== '' && srcUrl.trim() !== '#') {
            holychordsButton.href = srcUrl;
            holychordsButton.style.display = 'inline-block';
        } else {
            holychordsButton.href = '#';
            holychordsButton.style.display = 'none';
        }
    }

    // --- ОБРАБОТКА ТЕКСТА ПЕСНИ ---
    // 1. Транспонируем
    const transposition = getTransposition(originalKeyFromSheet, currentSelectedKey);
    const transposedLyrics = transposeLyrics(lyrics, transposition);
    // 2. Выделяем структуру (Куплет, Припев и т.д.)
    const structureHighlightedLyrics = highlightStructure(transposedLyrics);
    // 3. Выделяем аккорды
    const finalHighlightedLyrics = highlightChords(structureHighlightedLyrics);
    // --- КОНЕЦ ОБРАБОТКИ ТЕКСТА ---

    // Вставляем итоговый HTML
    songContent.innerHTML = `
        <button id="copy-text-button" class="icon-button simple" title="Копировать текст песни">
            <i class="far fa-copy"></i>
        </button>
        <h2>${title} — ${currentSelectedKey}</h2>
        <pre>${finalHighlightedLyrics}</pre> `;
    updateFontSize(); // Применяем текущий размер шрифта

    // Применяем класс скрытия аккордов, если он был включен
    if (songContent) {
        songContent.classList.toggle('chords-hidden', !areChordsVisible);
    }

    // Обновляем YouTube плеер
    const vId = extractYouTubeVideoId(ytLink);
    if (vId && playerContainer && playerSection) {
        playerContainer.innerHTML = `<iframe width="100%" height="315" src="https://www.youtube.com/embed/..." frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`; // Используем стандартный embed URL
        playerSection.style.display = 'block';
        if (keyDisplay) {
            if (videoKey) {
                keyDisplay.textContent = `Ориг. видео: ${videoKey}`;
                keyDisplay.style.display = 'block';
            } else {
                keyDisplay.style.display = 'none';
            }
        }
    } else {
        playerContainer.innerHTML = '';
        playerSection.style.display = 'none';
        if (keyDisplay) keyDisplay.style.display = 'none';
    }

    // Разблокируем кнопки действий
    if (favoriteButton) favoriteButton.disabled = false;
    if (addToSetlistButton) addToSetlistButton.disabled = false;
    if (addToRepertoireButton) addToRepertoireButton.disabled = false;
    if (toggleChordsButton) {
         toggleChordsButton.disabled = false;
         // Обновляем вид кнопки Аккорды
         if (typeof window.updateToggleButton === 'function') {
              window.updateToggleButton();
         }
    }

    // Находим кнопку копирования ВНУТРИ обновленного songContent и делаем видимой
     const currentCopyButton = songContent.querySelector('#copy-text-button');
     if (currentCopyButton) {
         currentCopyButton.style.display = 'block'; // Показываем кнопку Копировать
         // Переназначаем слушатель, используя функцию из window
         currentCopyButton.addEventListener('click', window.handleCopyClick);
     } else {
         // Этого не должно происходить, если HTML вставлен правильно
         console.warn("Кнопка копирования #copy-text-button не найдена после обновления innerHTML в displaySongDetails.");
     }
} // Конец функции displaySongDetails

/** Обновление текста песни при смене тональности в keySelect */
function updateTransposedLyrics() {
    if (!keySelect || !songContent || !sheetSelect) return;

    const indexStr = keySelect.dataset.index;
    const newKey = keySelect.value;
    const sheetNameKey = sheetSelect.value; // Ключ выбранного листа
    const sheetName = SHEETS[sheetNameKey];

    if (indexStr === null || indexStr === undefined || indexStr === "" || !sheetName) {
        return; // Нет индекса или листа - нечего транспонировать
    }

    if (!cachedData[sheetName]?.[indexStr]) {
         console.error("updateTransposedLyrics: Не найдены данные песни для транспонирования в кэше.", sheetName, indexStr);
         return;
    }

    const songData = cachedData[sheetName][indexStr];
    const originalKey = songData[2]; // Оригинальная тональность из таблицы
    const lyrics = songData[1] || '';
    const title = songData[0] || 'Без названия';

    const preElement = songContent.querySelector('pre');
    const h2Element = songContent.querySelector('h2');
    // Находим кнопку копирования, если она уже есть
    const copyBtn = songContent.querySelector('#copy-text-button');

    if (!preElement || !h2Element) {
        console.error("updateTransposedLyrics: Элементы H2 или PRE не найдены внутри songContent.");
        return;
    }

    // Вычисляем транспозицию от оригинального ключа (из таблицы) к новому (из select)
    const transposition = getTransposition(originalKey, newKey);
    const transposedLyrics = transposeLyrics(lyrics, transposition);
    const highlightedTransposedLyrics = highlightChords(transposedLyrics);

    // Обновляем только текст, сохраняя кнопку копирования, если она была
    preElement.innerHTML = highlightedTransposedLyrics;
    h2Element.textContent = `${title} — ${newKey}`;

    // Применяем текущий размер шрифта к обновленному <pre>
    updateFontSize();

    // <<< НОВОЕ: Применяем класс скрытия аккордов, если нужно
    if (songContent) {
        songContent.classList.toggle('chords-hidden', !areChordsVisible);
    }
} // Конец функции updateTransposedLyrics


/** Загрузка песен в select#song-select для выбранного листа */
async function loadSheetSongs() {
    if (!sheetSelect || !songSelect) {
        console.error("loadSheetSongs: sheetSelect или songSelect не найдены.");
        return;
    }
    const sheetNameKey = sheetSelect.value; // Ключ выбранного листа
    const sheetName = SHEETS[sheetNameKey];

    // Сброс и блокировка songSelect, если лист не выбран
    if (!sheetNameKey || !sheetName) {
        songSelect.innerHTML = '<option value="">-- Сначала выберите лист --</option>';
        songSelect.disabled = true;
        displaySongDetails(null); // Сбрасываем отображение песни
        return;
    }

    songSelect.innerHTML = '<option value="">Загрузка песен...</option>';
    songSelect.disabled = true;

    try {
        const rows = await fetchSheetData(sheetName); // Используем функцию с кэшированием

        songSelect.innerHTML = '<option value="">-- Выберите песню --</option>';
        if (rows && rows.length > 0) {
            rows.forEach((row, index) => {
                // Добавляем песню, только если есть название (первая колонка)
                if (row && row[0] && String(row[0]).trim() !== '') {
                    const option = document.createElement('option');
                    option.value = index; // Используем индекс строки как значение
                    option.textContent = row[0].trim(); // Убираем лишние пробелы из названия
                    songSelect.appendChild(option);
                }
            });
            songSelect.disabled = false;
        } else {
            songSelect.innerHTML = '<option value="">-- Нет песен в листе --</option>';
            songSelect.disabled = true; // Оставляем заблокированным, если песен нет
        }
    } catch (error) {
        console.error(`Ошибка при загрузке песен для листа "${sheetName}":`, error);
        songSelect.innerHTML = '<option value="">Ошибка загрузки песен</option>';
        songSelect.disabled = true;
    } finally {
         // Сбрасываем отображение песни после загрузки списка (даже если выбрана та же песня)
         // Это нужно, чтобы при смене листа всегда отображалось "Выберите песню"
         displaySongDetails(null);
    }
}

/** Обновление размера шрифта текста песни */
function updateFontSize() {
    const lyricsElement = songContent?.querySelector('pre');
    if (lyricsElement) {
        lyricsElement.style.fontSize = `${currentFontSize}px`;
        // Можно сохранить в localStorage, если нужно запоминать размер шрифта
        // localStorage.setItem('preferredFontSize', currentFontSize);
    }
}

/** Сброс размера шрифта к значению по умолчанию */
// function resetFontSize() {
//     currentFontSize = DEFAULT_FONT_SIZE;
//     updateFontSize();
//     // localStorage.removeItem('preferredFontSize'); // Удалить из localStorage
// }

/** Загрузка избранных песен из localStorage */
/** Загрузка избранных песен из localStorage */
function loadFavorites(container = favoritesList) {
    if (!container) {
        console.error("Контейнер для избранных песен не найден."); return;
    }
    container.innerHTML = ''; // Очищаем

    try {
        favorites = JSON.parse(localStorage.getItem('favorites')) || [];
    } catch (e) {
        console.error("Ошибка парсинга избранного из localStorage:", e);
        favorites = [];
        localStorage.removeItem('favorites');
    }

    if (favorites.length === 0) {
        container.innerHTML = '<div class="empty-message">Нет избранных песен</div>';
        return;
    }

    // Сортировка избранного по имени песни
    favorites.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    favorites.forEach(fav => {
        // Проверяем валидность записи в избранном
        if (!fav || !fav.name || !fav.sheet || fav.index === undefined || !fav.key) {
            console.warn("Пропуск некорректной записи в избранном:", fav);
            return; // Пропускаем эту запись
        }

        const favoriteItem = document.createElement('div');
        favoriteItem.className = 'favorite-item';

        const songInfo = document.createElement('span');
        songInfo.className = 'song-name';
        songInfo.textContent = `${fav.name} — ${fav.key}`;
        favoriteItem.appendChild(songInfo);

        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.className = 'remove-button';
        removeBtn.title = 'Удалить из Моего списка';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeFromFavorites(fav);
        });
        favoriteItem.appendChild(removeBtn);

        // Клик по элементу избранного
        favoriteItem.addEventListener('click', async () => {
            console.log("Клик по избранной песне:", fav);
            const sheetNameValue = Object.keys(SHEETS).find(key => SHEETS[key] === fav.sheet);
            if(!sheetNameValue) {
                alert(`Ошибка: Лист "${fav.sheet}" для избранной песни не найден.`);
                return;
            }
            // Убедимся, что данные для листа загружены
            if (!cachedData[fav.sheet]) {
                console.log(`Загрузка листа "${fav.sheet}" для избранного...`);
                await fetchSheetData(fav.sheet);
                if (!cachedData[fav.sheet]) {
                    alert(`Не удалось загрузить данные листа "${fav.sheet}".`);
                    return;
                }
            }
            const songDataFromCache = cachedData[fav.sheet]?.[fav.index];
            if (!songDataFromCache) {
                alert(`Данные для песни "${fav.name}" (индекс ${fav.index}) не найдены. Удалите ее из избранного.`);
                return;
            }

            if(sheetSelect) sheetSelect.value = sheetNameValue;
            await loadSheetSongs(); // Перезагружаем список песен листа
            if(songSelect) songSelect.value = fav.index; // Выбираем песню
            // Отображаем детали с ключом из избранного
            displaySongDetails(songDataFromCache, fav.index, fav.key);

            // !!! ЗАКРЫВАЕМ ПАНЕЛИ ПОСЛЕ КЛИКА !!!
            closeAllSidePanels();
        }); // Конец обработчика клика по favoriteItem

        container.appendChild(favoriteItem);
    }); // Конец forEach
} // Конец loadFavorites

/** Удаление песни из избранного */
function removeFromFavorites(favToRemove) {
    console.log("Попытка удаления из избранного:", favToRemove);
    let found = false;
    // Фильтруем массив, оставляя все, КРОМЕ удаляемого элемента
    favorites = favorites.filter(item => {
        const match = item.sheet === favToRemove.sheet && String(item.index) === String(favToRemove.index); // Сравниваем как строки на всякий случай
        if (match) found = true;
        return !match; // Оставляем элемент, если он НЕ совпадает
    });

    if (found) {
        try {
            localStorage.setItem('favorites', JSON.stringify(favorites));
            console.log("Элемент удален, localStorage обновлен.");
             // Обновляем отображение списка избранного, если панель открыта
             if (favoritesPanel?.classList.contains('open') && favoritesList) {
                  loadFavorites(favoritesList);
             } else {
                  // Если панель закрыта, просто уменьшаем счетчик или удаляем элемент из DOM,
                  // но проще перерисовать при следующем открытии.
             }
            alert(`Песня "${favToRemove.name}" удалена из 'Моего списка'.`);
        } catch (e) {
            console.error("Ошибка сохранения избранного в localStorage после удаления:", e);
            alert("Ошибка при сохранении изменений в избранном.");
            // Возможно, стоит перезагрузить 'favorites' из localStorage, чтобы отменить изменения в памяти
            favorites = JSON.parse(localStorage.getItem('favorites')) || [];
        }
    } else {
        console.warn("Не удалось найти песню для удаления в массиве favorites:", favToRemove);
        alert("Не удалось удалить песню из 'Моего списка'. Возможно, она уже была удалена.");
        // На всякий случай обновим UI, если вдруг была рассинхронизация
        if (favoritesPanel?.classList.contains('open') && favoritesList) {
             loadFavorites(favoritesList);
        }
    }
}

/** Обновление отображения и логики BPM */
function updateBPM(newBPM) {
    if (!bpmDisplay) return;
    const bpmValue = parseInt(newBPM, 10);
    const displayValue = (!isNaN(bpmValue) && bpmValue > 0) ? bpmValue : 'N/A';
    bpmDisplay.textContent = displayValue;

    if (isMetronomeActive) {
        if (displayValue !== 'N/A') {
            // Перезапуск метронома с новым BPM
            console.log("Metronome: Restarting with new BPM:", bpmValue);
            toggleMetronome(0); // Остановить
            toggleMetronome(bpmValue); // Запустить с новым BPM
        } else {
             // Останавливаем, если BPM стал некорректным
             console.log("Metronome: Stopping due to invalid BPM.");
             toggleMetronome(0);
        }
    }
}

// --- METRONOME FUNCTIONS ---

/** Настройка AudioContext */
function setupAudioContext() {
    if (audioContext) return; // Уже создан
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("AudioContext успешно создан. State:", audioContext.state);
        // Возобновляем контекст сразу после создания, если он в suspended
        resumeAudioContext();
    } catch(e) {
        console.error("Не удалось создать AudioContext:", e);
        alert("Ошибка: Ваш браузер не поддерживает Web Audio API, метроном не будет работать.");
        audioContext = null; // Убедимся, что он null при ошибке
    }
}

/** Возобновление AudioContext */
function resumeAudioContext() {
    if (audioContext && audioContext.state === 'suspended') {
        console.log("Attempting to resume AudioContext...");
        audioContext.resume().then(() => {
            console.log('AudioContext успешно возобновлен.');
        }).catch((error) => {
            console.error('Ошибка возобновления AudioContext:', error);
            // Можно показать сообщение пользователю, что нужно взаимодействие
            // alert("Не удалось активировать звук. Пожалуйста, кликните где-нибудь на странице.");
        });
    }
}

/** Загрузка аудиофайла для метронома */
async function loadAudioFile() {
    if (!audioContext) {
         console.warn("loadAudioFile: AudioContext not ready, attempting setup.");
         setupAudioContext();
         if (!audioContext) {
              console.error("loadAudioFile: Failed to setup AudioContext.");
              return; // Не можем грузить без контекста
         }
    }
    if (audioBuffer) return; // Уже загружено

    // URL может быть вынесен в константы
    const fileUrl = 'https://firebasestorage.googleapis.com/v0/b/song-archive-389a6.firebasestorage.app/o/metronome-85688%20(mp3cut.net).mp3?alt=media&token=97b66349-7568-43eb-80c3-c2278ff38c10';
    console.log("Загрузка аудиофайла метронома...");
    try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        // Используем async/await с decodeAudioData для чистоты кода
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        console.log("Аудиофайл метронома успешно загружен и декодирован.");
    } catch (error) {
        console.error('Ошибка загрузки или декодирования аудиофайла:', error);
        alert("Не удалось загрузить звук метронома. Метроном может не работать.");
        audioBuffer = null;
    }
}

/** Воспроизведение одного клика метронома */
function playClick() {
    // Проверки перед воспроизведением
    if (!audioContext || !audioBuffer || audioContext.state !== 'running') {
         console.warn(`playClick stopped: Context state: ${audioContext?.state}, Buffer ready: ${!!audioBuffer}`);
         // Попытка возобновить контекст, если он suspended
         if (audioContext?.state === 'suspended') resumeAudioContext();
         // Если метроном должен быть активен, но не может играть - останавливаем его
         if (isMetronomeActive) toggleMetronome(0);
         return;
    }

    if (!timeSignatureSelect) {
        console.error("playClick: timeSignatureSelect not found.");
        if (isMetronomeActive) toggleMetronome(0);
        return;
    }

    const beatsPerMeasure = parseInt(timeSignatureSelect.value, 10) || 4;

    try {
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        const gainNode = audioContext.createGain();

        // Громкость первого удара выше
        const gainValue = (currentBeat % beatsPerMeasure === 0) ? 1.0 : 0.6;
        gainNode.gain.setValueAtTime(gainValue, audioContext.currentTime);

        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        source.start(audioContext.currentTime); // Воспроизводим немедленно

        // source.onended = () => { console.log("Metronome click source ended."); }; // Для отладки

        currentBeat = (currentBeat + 1) % beatsPerMeasure; // Обновляем счетчик ударов

    } catch (error) {
        console.error("!!! Error during playClick execution:", error);
        if(isMetronomeActive) toggleMetronome(0); // Останавливаем при ошибке
    }
}

/** Включение/выключение метронома */
function toggleMetronome(bpm) {
    const playIcon = '<i class="fas fa-play"></i>';
    const stopIcon = '<i class="fas fa-stop"></i>';
    const playText = '<span class="button-text">Метроном</span>'; // Упростил текст
    const stopText = '<span class="button-text">Метроном</span>'; // Текст одинаковый

    if (!metronomeButton) return;

    // Перед любым действием убедимся, что AudioContext в рабочем состоянии
    resumeAudioContext();

    if (isMetronomeActive) {
        // --- ВЫКЛЮЧЕНИЕ ---
        console.log("Metronome: Stopping. Interval ID:", metronomeInterval);
        clearInterval(metronomeInterval);
        metronomeInterval = null;
        isMetronomeActive = false;
        currentBeat = 0; // Сброс счетчика
        metronomeButton.innerHTML = playIcon + (isMobileView() ? '' : playText);
        metronomeButton.setAttribute('aria-label', 'Включить метроном');
        metronomeButton.classList.remove('active'); // Убираем класс активности
        console.log("Metronome: Stopped.");
    } else if (bpm > 0) {
        // --- ВКЛЮЧЕНИЕ ---
        console.log("Metronome: Attempting to start with BPM:", bpm);
        if (!audioContext || !audioBuffer) {
            console.warn("Metronome: Cannot start, audio not ready.");
             alert("Звук метронома еще не загружен или аудиосистема не готова. Попробуйте еще раз.");
             // Попытка загрузить снова, если буфера нет
             if (!audioBuffer) loadAudioFile();
             return;
        }
        // Убедимся, что контекст запущен перед стартом интервала
        if (audioContext.state !== 'running') {
             console.warn("Metronome: AudioContext not running. Attempting resume.");
             resumeAudioContext();
             // Можно добавить задержку и повторную попытку или просто выйти
             alert("Не удалось запустить метроном. Аудиосистема не активна. Попробуйте кликнуть на странице.");
             return;
        }

        const intervalMilliseconds = 60000 / bpm;
        if (intervalMilliseconds <= 0 || !isFinite(intervalMilliseconds)) {
            console.error("Metronome: Invalid interval calculated:", intervalMilliseconds);
            alert("Некорректный BPM для запуска метронома.");
            return;
        }

        currentBeat = 0; // Сброс счетчика перед запуском

        // --- ЗАПУСК ИНТЕРВАЛА ---
        isMetronomeActive = true; // Ставим флаг ДО первого вызова playClick
        metronomeInterval = setInterval(playClick, intervalMilliseconds);
        console.log("Metronome: Started. Interval ID:", metronomeInterval, "Interval (ms):", intervalMilliseconds);
        metronomeButton.innerHTML = stopIcon + (isMobileView() ? '' : stopText);
        metronomeButton.setAttribute('aria-label', 'Выключить метроном');
        metronomeButton.classList.add('active'); // Добавляем класс активности
        console.log("Metronome: Playing first click...");
        playClick(); // Сразу играем первый удар
        console.log("Metronome: First click function call finished.");
    } else {
         console.log("Metronome: Start requested with invalid BPM:", bpm);
         alert("Не указан или некорректный BPM для запуска метронома.");
    }
}


// --- THEME FUNCTIONS ---

/** Применяет указанную тему (light/dark) */
function applyTheme(themeName) {
    const newTheme = (themeName === 'light' || themeName === 'dark') ? themeName : 'dark'; // Валидация
    console.log("Применяется тема:", newTheme);
    document.body.dataset.theme = newTheme; // Устанавливаем атрибут data-theme

    if (themeToggleButton) {
        const icon = themeToggleButton.querySelector('i');
        if (icon) {
            if (newTheme === 'light') {
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon');
                themeToggleButton.title = "Переключить на темную тему";
            } else {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
                themeToggleButton.title = "Переключить на светлую тему";
            }
        }
    }
    try {
        localStorage.setItem('theme', newTheme); // Сохраняем валидную тему
    } catch (e) {
        console.error("Ошибка сохранения темы в localStorage:", e);
    }
}

/** Переключает между светлой и темной темой */
function toggleTheme() {
    const currentTheme = document.body.dataset.theme || 'dark'; // Получаем текущую
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark'; // Определяем новую
    applyTheme(newTheme); // Применяем
}



// --- Вспомогательная функция для панелей ---
/** Закрывает все боковые панели */
function closeAllSidePanels() {
    if (setlistsPanel) setlistsPanel.classList.remove('open'); // Используем новое имя
    if (myListPanel) myListPanel.classList.remove('open');     // Добавляем новую панель
    if (repertoirePanel) repertoirePanel.classList.remove('open');
    console.log("Все боковые панели закрыты."); // Лог для отладки
}

// --- EVENT LISTENER SETUP ---
function setupEventListeners() {
    console.log("Настройка слушателей событий...");

    // Выбор листа
    if(sheetSelect) sheetSelect.addEventListener('change', async () => {
        console.log("Sheet selected:", sheetSelect.value);
        if(searchInput) searchInput.value = ''; // Очистка поиска
        if(searchResults) searchResults.innerHTML = ''; // Очистка результатов поиска
        await loadSheetSongs(); // Загрузка песен и сброс отображения
    });

    // Выбор песни
    if(songSelect) songSelect.addEventListener('change', () => {
        if (!sheetSelect) return; // Нужен выбранный лист
        const sheetNameKey = sheetSelect.value;
        const sheetName = SHEETS[sheetNameKey];
        const songIndex = songSelect.value;
        console.log(`Song selected: Index ${songIndex} in Sheet ${sheetName}`);
        if (!sheetName || songIndex === "" || !cachedData[sheetName]?.[songIndex]) {
            displaySongDetails(null); // Сброс, если что-то не так
            return;
        }
        displaySongDetails(cachedData[sheetName][songIndex], songIndex); // Отображаем выбранную
    });

    // Поиск песни
    if(searchInput) {
        searchInput.addEventListener('input', () => searchSongs(searchInput.value));
        // Скрытие результатов при потере фокуса (с задержкой)
        searchInput.addEventListener('blur', () => {
            setTimeout(() => {
                if(searchResults) searchResults.innerHTML = '';
            }, 200); // Задержка, чтобы успел сработать click на результате
        });
    }

    // Выбор тональности
    if(keySelect) keySelect.addEventListener('change', updateTransposedLyrics);

    // Увеличение/уменьшение шрифта
    if(zoomInButton) zoomInButton.addEventListener('click', () => {
        currentFontSize = Math.min(currentFontSize + 2, 30); // Ограничение максимального размера
        updateFontSize();
    });
    if(zoomOutButton) zoomOutButton.addEventListener('click', () => {
        currentFontSize = Math.max(MIN_FONT_SIZE, currentFontSize - 2); // Используем MIN_FONT_SIZE
        updateFontSize();
    });

    // Разделение текста (основное окно)
    if(splitTextButton && songContent) {
        const splitIcon = '<i class="fas fa-columns"></i>';
        const mergeIcon = '<i class="fas fa-align-justify"></i>';
        const splitText = '<span class="button-text">Разделить</span>'; // Короче
        const mergeText = '<span class="button-text">Объединить</span>'; // Короче

        const updateSplitButton = () => {
            const isSplit = songContent.classList.contains('split-columns');
            const currentIcon = isSplit ? mergeIcon : splitIcon;
            const currentTextSpan = isSplit ? mergeText : splitText;
            splitTextButton.innerHTML = currentIcon + (isMobileView() ? '' : currentTextSpan);
            splitTextButton.setAttribute('aria-label', isSplit ? 'Объединить колонки' : 'Разделить текст');
        };

        splitTextButton.addEventListener('click', () => {
            const lyricsElement = songContent.querySelector('pre');
            if (!lyricsElement || !lyricsElement.textContent?.trim()) {
                alert('Нет текста песни для разделения.'); return;
            }
            songContent.classList.toggle('split-columns');
            updateSplitButton();
        });

        updateSplitButton(); // Начальное состояние

        // Обновление кнопки при ресайзе
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(updateSplitButton, 150);
        });
    }


// Переключение видимости аккордов
if (toggleChordsButton && songContent && songSelect) { // Добавили songSelect в проверку
    const iconGuitar = '<i class="fas fa-guitar"></i>';
    const iconMusic = '<i class="fas fa-music"></i>';
    const textShow = '<span class="button-text">Аккорды</span>'; // Текст "Показать"
    const textHide = '<span class="button-text">Аккорды</span>'; // Текст "Скрыть" (одинаковый, меняем иконку)

    // Объявляем функцию обновления кнопки в области видимости setupEventListeners
    const updateToggleButton = () => {
        if (!toggleChordsButton) return; // Доп. проверка
        const currentIcon = areChordsVisible ? iconGuitar : iconMusic;
        const currentText = areChordsVisible ? textHide : textShow;
        const currentTitle = areChordsVisible ? 'Скрыть аккорды' : 'Показать аккорды';

        toggleChordsButton.innerHTML = currentIcon + (isMobileView() ? '' : currentText);
        toggleChordsButton.title = currentTitle;
        // Блокируем, если песня не выбрана в songSelect
        toggleChordsButton.disabled = !songSelect || songSelect.value === "";
    };
    // Сохраняем ссылку на функцию, чтобы использовать ее в displaySongDetails
    window.updateToggleButton = updateToggleButton;


    toggleChordsButton.addEventListener('click', () => {
        if (!songSelect || songSelect.value === "") return; // Не делаем ничего, если песня не выбрана

        areChordsVisible = !areChordsVisible; // Инвертируем состояние
        songContent.classList.toggle('chords-hidden', !areChordsVisible); // Добавляем/убираем класс
        updateToggleButton(); // Обновляем вид кнопки
    });

    // Обновляем кнопку при ресайзе (чтобы убрать/показать текст)
    let resizeTimerChords;
     window.addEventListener('resize', () => {
         clearTimeout(resizeTimerChords);
         resizeTimerChords = setTimeout(updateToggleButton, 150);
     });

     // Инициализация состояния кнопки при загрузке
     updateToggleButton();

} else { console.warn("Кнопка #toggle-chords-button, #song-content или #songSelect не найдены."); }


if (songContent) {
    // Объявляем функцию-обработчик отдельно
    window.handleCopyClick = () => {
        const preElement = songContent.querySelector('pre');
        const copyBtn = songContent.querySelector('#copy-text-button'); // Находим кнопку каждый раз
        if (!preElement || !copyBtn) return;

        // Используем innerText, т.к. он не копирует скрытые элементы (аккорды)
        const textToCopy = preElement.innerText;

        if (!textToCopy || textToCopy.trim() === '') {
            alert('Нет текста для копирования.');
            return;
        }

        navigator.clipboard.writeText(textToCopy).then(() => {
            // Успешно скопировано - меняем иконку и стиль
            const originalIconHTML = '<i class="far fa-copy"></i>'; // Сохраняем HTML иконки
            copyBtn.innerHTML = '<i class="fas fa-check"></i>';
            copyBtn.classList.add('copied');
            copyBtn.title = 'Скопировано!';
            copyBtn.disabled = true; // Блокируем на время

            // Возвращаем иконку и стиль через 1.5 секунды
            setTimeout(() => {
                copyBtn.innerHTML = originalIconHTML;
                copyBtn.classList.remove('copied');
                copyBtn.title = 'Копировать текст песни';
                copyBtn.disabled = false; // Разблокируем
            }, 1500);

        }).catch(err => {
            console.error('Ошибка копирования в буфер обмена:', err);
            alert('Не удалось скопировать текст. Проверьте разрешения браузера или попробуйте вручную.');
        });
    };

     // Начальное скрытие кнопки (перенесено в displaySongDetails)
     const initialCopyBtn = songContent.querySelector('#copy-text-button');
     if (initialCopyBtn) initialCopyBtn.style.display = 'none';

     // Привязываем слушатель к КОНТЕЙНЕРУ один раз
     songContent.addEventListener('click', (event) => {
         // Проверяем, был ли клик именно по кнопке копирования
         if (event.target.closest('#copy-text-button')) {
            handleCopyClick(); // Вызываем наш обработчик
         }
     });

} else { console.warn("#song-content не найден для кнопки Копировать."); }



// Открытие модалки по клику на иконку заметки (используем делегирование)
if (currentSetlistSongsContainer) {
    currentSetlistSongsContainer.addEventListener('click', (e) => {
        const noteButton = e.target.closest('.edit-setlist-song-note-button');
        if (!noteButton) return; // Клик был не по кнопке заметок

        const songDocId = noteButton.dataset.songdocid;
        if (!currentSetlistId || !songDocId) {
            console.error("Не найден ID сет-листа или песни для заметки.");
            return;
        }

        // Находим данные песни в текущем массиве (чтобы взять заметку)
        const songData = currentSetlistSongs.find(song => song.id === songDocId);
        const currentNote = songData ? (songData.notes || '') : '';

        if (noteEditTextarea) noteEditTextarea.value = currentNote; // Помещаем текущую заметку в textarea
        if (notesModal) {
            notesModal.dataset.songdocid = songDocId; // Сохраняем ID песни на модалке
            notesModal.style.display = 'flex'; // Показываем оверлей
            setTimeout(() => notesModal.classList.add('visible'), 10); // Запускаем анимацию появления
            if(noteEditTextarea) noteEditTextarea.focus(); // Фокус на поле ввода
        }
    });
}

// Функция для закрытия модального окна
const closeNotesModal = () => {
    if (notesModal) {
        notesModal.classList.remove('visible');
        // Ждем окончания анимации перед скрытием
        setTimeout(() => {
            notesModal.style.display = 'none';
            if(noteEditTextarea) noteEditTextarea.value = ''; // Очищаем поле
            delete notesModal.dataset.songdocid; // Удаляем ID песни
        }, 300); // Время должно совпадать с transition в CSS
    }
};

// Кнопка "Сохранить"
if (saveNoteButton && notesModal) {
    saveNoteButton.addEventListener('click', async () => {
        const songDocId = notesModal.dataset.songdocid;
        const newNoteText = noteEditTextarea ? noteEditTextarea.value.trim() : '';

        if (!currentSetlistId || !songDocId) {
            alert("Ошибка: Не удалось определить сет-лист или песню для сохранения заметки.");
            return;
        }

        saveNoteButton.disabled = true; saveNoteButton.textContent = 'Сохранение...';

        try {
            const songDocRef = doc(db, "setlists", currentSetlistId, "songs", songDocId);
            await updateDoc(songDocRef, {
                notes: newNoteText // Обновляем только поле notes
            });
            console.log(`Заметка для песни ${songDocId} в сет-листе ${currentSetlistId} сохранена.`);
            // UI обновится сам через onSnapshot, но можно добавить визуальное подтверждение
            closeNotesModal(); // Закрываем окно после успеха
        } catch (error) {
            console.error("Ошибка сохранения заметки:", error);
            alert("Не удалось сохранить заметку. Попробуйте еще раз.");
        } finally {
             if(saveNoteButton) {
                saveNoteButton.disabled = false; saveNoteButton.textContent = 'Сохранить';
             }
        }
    });
}

// Кнопка "Отмена" и крестик для закрытия
if (cancelNoteButton) cancelNoteButton.addEventListener('click', closeNotesModal);
if (closeNoteModalX) closeNoteModalX.addEventListener('click', closeNotesModal);

// Закрытие модалки по клику на оверлей
if (notesModal) {
    notesModal.addEventListener('click', (e) => {
        // Закрываем, только если клик был по самому оверлею (notes-modal), а не по контенту внутри (.modal-content)
        if (e.target === notesModal) {
            closeNotesModal();
        }
    });
}

// Закрытие модалки по Esc
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && notesModal && notesModal.classList.contains('visible')) {
        closeNotesModal();
    }
});

    // Добавление в избранное
    if(favoriteButton) {
        favoriteButton.addEventListener('click', () => {
            if (!sheetSelect || !songSelect || !keySelect) return;
            const sheetNameKey = sheetSelect.value;
            const sheetName = SHEETS[sheetNameKey];
            const songIndex = songSelect.value;
            const selectedKey = keySelect.value;

            if (!sheetName || songIndex === "") {
                alert("Пожалуйста, сначала выберите песню."); return;
            }
            const songData = cachedData[sheetName]?.[songIndex];
            if (!songData) {
                alert("Не найдены данные для выбранной песни."); return;
            }

            const song = {
                name: songData[0],
                sheet: sheetName,
                index: songIndex, // Сохраняем как строку (из select)
                key: selectedKey
            };

            // Проверка на существование (сравнение sheet и index)
            if (!favorites.some(f => f.sheet === song.sheet && String(f.index) === song.index)) {
                favorites.push(song);
                 try {
                      localStorage.setItem('favorites', JSON.stringify(favorites));
                      // Обновляем UI избранного, если панель открыта
                      if (favoritesPanel?.classList.contains('open') && favoritesList) {
                           loadFavorites(favoritesList);
                      }
                      alert(`"${song.name}" (${song.key}) добавлена в 'Мой список'.`);
                 } catch (e) {
                     console.error("Ошибка сохранения избранного:", e);
                     alert("Не удалось сохранить песню в избранное.");
                     // Удаляем только что добавленную песню из массива в памяти, если сохранение не удалось
                     favorites.pop();
                 }
            } else {
                 // Песня уже есть, спросим об обновлении ключа?
                 const existingFavIndex = favorites.findIndex(f => f.sheet === song.sheet && String(f.index) === song.index);
                 if (existingFavIndex !== -1 && favorites[existingFavIndex].key !== song.key) {
                      if (confirm(`Песня "${song.name}" уже есть в 'Моем списке' с тональностью ${favorites[existingFavIndex].key}. Обновить на ${song.key}?`)) {
                          favorites[existingFavIndex].key = song.key; // Обновляем ключ
                          try {
                              localStorage.setItem('favorites', JSON.stringify(favorites));
                              if (favoritesPanel?.classList.contains('open') && favoritesList) {
                                   loadFavorites(favoritesList);
                              }
                              alert(`Тональность песни "${song.name}" в 'Моем списке' обновлена на ${song.key}.`);
                          } catch (e) {
                               console.error("Ошибка обновления ключа в избранном:", e);
                               alert("Не удалось обновить тональность в избранном.");
                               // Возвращаем старый ключ при ошибке
                               favorites[existingFavIndex].key = songData[2] || chords[0]; // Или какой был до этого
                          }
                      }
                 } else {
                     alert(`Песня "${song.name}" уже есть в 'Моем списке'.`);
                 }
            }
        });
    }

    // Добавление в СЕТ-ЛИСТ
    if (addToSetlistButton) {
        addToSetlistButton.addEventListener('click', addToCurrentSetlist);
    } else { console.warn("Кнопка #add-to-setlist-button не найдена."); }

    // Добавление в РЕПЕРТУАР
    if(addToRepertoireButton) {
         addToRepertoireButton.addEventListener('click', addToRepertoire);
    } else { console.warn("Кнопка #add-to-repertoire-button не найдена."); }

    // Выбор вокалиста
    if(vocalistSelect) vocalistSelect.addEventListener('change', (e) => {
        currentVocalistId = e.target.value;
        const selectedOption = e.target.options[e.target.selectedIndex];
        currentVocalistName = selectedOption.value ? selectedOption.text : null; // Имя только если выбран не пустой option
        console.log(`Vocalist selected: ${currentVocalistName || 'none'} (ID: ${currentVocalistId || 'none'})`);
        loadRepertoire(currentVocalistId); // Загрузка репертуара для выбранного
    });

    // 1. Кнопка "Сет-листы" (бывшая toggle-favorites)
if (toggleFavoritesButton && setlistsPanel) {
    toggleFavoritesButton.addEventListener('click', () => {
        const isAlreadyOpen = setlistsPanel.classList.contains('open');
        closeAllSidePanels(); // Закрываем все
        if (!isAlreadyOpen) { // Если была закрыта, открываем эту
            setlistsPanel.classList.add('open');
            console.log("Открываем панель Сет-листов...");
            // Загружаем актуальный список сет-листов
            loadSetlists();
            // Обновляем отображение песен текущего сет-листа (если он был выбран)
            selectSetlist(currentSetlistId, currentSetlistName);
        }
        // Если была открыта, она уже закрылась через closeAllSidePanels()
    });
} else { console.error("Элементы для 'Сет-листы' не найдены (#toggle-favorites / #setlists-panel)"); }



// 2. НОВЫЙ слушатель для кнопки "Мой список"
if (toggleMyListButton && myListPanel) {
    toggleMyListButton.addEventListener('click', () => {
        const isAlreadyOpen = myListPanel.classList.contains('open');
        closeAllSidePanels(); // Закрываем все
        if (!isAlreadyOpen) { // Если была закрыта, открываем эту
            myListPanel.classList.add('open');
            console.log("Открываем панель 'Мой список'...");
            loadFavorites(); // Загружаем избранное
        }
        // Если была открыта, она уже закрылась через closeAllSidePanels()
    });
} else { console.error("Элементы для 'Мой список' не найдены (#toggle-my-list / #my-list-panel)"); }



    // 3. Кнопка "Репертуар" (обновлена логика закрытия других панелей)
if (toggleRepertoireButton && repertoirePanel) {
    toggleRepertoireButton.addEventListener('click', () => {
         const isAlreadyOpen = repertoirePanel.classList.contains('open');
         closeAllSidePanels(); // Закрываем все
         if (!isAlreadyOpen) { // Если была закрыта, открываем эту
             repertoirePanel.classList.add('open');
             console.log("Открываем панель 'Репертуар'...");
             // Загружаем репертуар, только если вокалист выбран
             if (currentVocalistId) {
                loadRepertoire(currentVocalistId);
             } else {
                if(repertoirePanelList) repertoirePanelList.innerHTML = '<div class="empty-message">Выберите вокалиста...</div>';
             }
         }
          // Если была открыта, она уже закрылась через closeAllSidePanels()
    });
  } else { console.error("Элементы для 'Репертуар' не найдены (#toggle-repertoire / #repertoire-panel)"); }


     // Создание нового сет-листа
     if (createSetlistButton) {
         createSetlistButton.addEventListener('click', createSetlist);
     } else { console.warn("Кнопка #create-setlist-button не найдена."); }

     // Запуск презентации для текущего сет-листа
     if (startPresentationButton) {
         startPresentationButton.addEventListener('click', () => {
             console.log("Клик по кнопке 'Презентация' для сет-листа ID:", currentSetlistId);
             if (currentSetlistId && currentSetlistSongs && currentSetlistSongs.length > 0) {
                closeAllSidePanels();
                 showPresentationView(currentSetlistSongs);
             } else {
                 alert("Сет-лист не выбран или в нем нет песен для презентации.");
             }
         });
     } else { console.warn("Кнопка #start-presentation-button не найдена."); }

     // Удаление текущего сет-листа
     if (deleteSetlistButton) {
         deleteSetlistButton.addEventListener('click', deleteCurrentSetlist);
     } else { console.warn("Кнопка #delete-setlist-button не найдена."); }


    // --- Слушатели для режима Презентации ---
    if (presentationCloseBtn && presentationOverlay) { // Закрытие презентации
        presentationCloseBtn.addEventListener('click', () => {
            presentationOverlay.classList.remove('visible');
            document.body.style.overflow = ''; // Восстанавливаем скролл body
            clearTimeout(controlsHideTimeout); // Отменяем таймер скрытия
            // Выход из полноэкранного режима, если он активен
            if (document.fullscreenElement) {
                 document.exitFullscreen().catch(err => console.error(`Error attempting to exit fullscreen: ${err.message} (${err.name})`));
            }
            // Останавливаем метроном, если он был активен
             if (isMetronomeActive) {
                  toggleMetronome(0); // Выключаем
             }
            // Сбрасываем список песен презентации
            presentationSongs = [];
            currentPresentationIndex = 0;
        });
    }
    if (presPrevBtn) { presPrevBtn.addEventListener('click', prevPresentationSong); }
    if (presNextBtn) { presNextBtn.addEventListener('click', nextPresentationSong); }
    if (presSplitTextBtn) { // Кнопка разделения в презентации
          presSplitTextBtn.addEventListener('click', togglePresentationSplit);
    }
    // Настройка свайпов и кликов для показа контролов
    setupSwipeListeners();


     // --- Слушатели для Метронома ---
     if(metronomeButton){
         metronomeButton.addEventListener('click', async () => {
             // Инициализация AudioContext при первом клике, если еще не создан
              if (!audioContext) setupAudioContext();
              if (!audioContext) {
                  alert("Не удалось инициализировать аудиосистему.");
                  return;
              }
              // Попытка возобновить контекст при клике
              resumeAudioContext();
             // Предзагрузка файла, если еще не загружен
              if (!audioBuffer) await loadAudioFile();
              // Проверка готовности после попытки загрузки/возобновления
              if (!audioBuffer || audioContext.state !== 'running') {
                  alert("Аудиосистема не готова. Попробуйте кликнуть еще раз или обновить страницу.");
                  return;
              }

              const bpmText = bpmDisplay?.textContent;
              const bpmValue = parseInt(bpmText, 10);

             // Переключаем метроном только если BPM корректный
             if (!isNaN(bpmValue) && bpmValue > 0) {
                  toggleMetronome(bpmValue);
             } else if (isMetronomeActive) {
                  // Если метроном активен, но BPM некорректный, выключаем его
                  toggleMetronome(0);
             } else {
                  // Если не активен и BPM некорректный
                  alert('Не указан или некорректный BPM для запуска метронома.');
             }
         });
     }

     // Редактирование BPM (опционально)
     if(bpmDisplay && bpmDisplay.isContentEditable) { // Проверка, можно ли редактировать
         bpmDisplay.addEventListener('blur', () => {
             const newText = bpmDisplay.textContent || '';
             updateBPM(newText.trim()); // Обновляем BPM после потери фокуса
         });
         // Предотвращение ввода не-цифр (простой вариант)
         bpmDisplay.addEventListener('input', () => {
             const currentText = bpmDisplay.textContent || '';
             // Оставляем только цифры, но позволяем временно быть пустым
             const digitsOnly = currentText.replace(/[^0-9]/g, '');
             // Чтобы избежать мерцания курсора, обновляем только если текст изменился
             if (bpmDisplay.textContent !== digitsOnly) {
                 // Сохраняем позицию курсора (если возможно)
                 const selection = window.getSelection();
                 const range = selection?.rangeCount > 0 ? selection.getRangeAt(0) : null;
                 const startOffset = range?.startOffset || 0;

                 bpmDisplay.textContent = digitsOnly;

                 // Восстанавливаем позицию курсора
                 if (range && bpmDisplay.firstChild) {
                     const newOffset = Math.min(startOffset, digitsOnly.length);
                     const newRange = document.createRange();
                     newRange.setStart(bpmDisplay.firstChild, newOffset);
                     newRange.collapse(true);
                     selection.removeAllRanges();
                     selection.addRange(newRange);
                 }
             }
         });
         // Обработка Enter для завершения редактирования
         bpmDisplay.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') {
                  e.preventDefault(); // Предотвращаем перенос строки
                  bpmDisplay.blur(); // Завершаем редактирование (вызовет событие blur)
              }
         });
     }

     // Клик по ссылке Holychords
     if(holychordsButton) holychordsButton.addEventListener('click', (e) => {
         if (!holychordsButton.href || holychordsButton.getAttribute('href') === '#') {
             e.preventDefault();
             alert('Ссылка на Holychords для этой песни отсутствует.');
         }
         // Дополнительно: можно открывать в новой вкладке
         // holychordsButton.target = "_blank";
     });


    // --- Переключение темы ---
    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', toggleTheme);
    }

    console.log("Настройка слушателей событий завершена.");
} // <--- КОНЕЦ setupEventListeners


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM loaded.");
    // Проверка наличия ключевых элементов интерфейса (ИСПРАВЛЕНО)
    const criticalElements = [
        setlistsPanel,          // <--- ИСПРАВЛЕНО
        myListPanel,            // <--- ДОБАВЛЕНО
        repertoirePanel,
        songContent,
        sheetSelect,
        songSelect,
        keySelect,
        favoritesList,          // Для панели "Мой список"
        setlistsListContainer,  // Для панели "Сет-листы"
        currentSetlistSongsContainer, // Для панели "Сет-листы"
        repertoirePanelList     // Для панели "Репертуар"
        // Добавьте другие критические элементы, если нужно
    ];
    if (criticalElements.some(el => !el)) {
        // Находим, какой именно элемент отсутствует для более точной отладки
        const missingElement = criticalElements.findIndex(el => !el);
        const elementNames = [ 'setlistsPanel', 'myListPanel', 'repertoirePanel', 'songContent', 'sheetSelect', 'songSelect', 'keySelect', 'favoritesList', 'setlistsListContainer', 'currentSetlistSongsContainer', 'repertoirePanelList'];
        const missingElementName = elementNames[missingElement] || 'Неизвестный элемент';
        console.error(`Критически важный элемент интерфейса не найден в HTML! Отсутствует: ${missingElementName}. Проверьте ID элемента в HTML.`);
        // Показываем сообщение пользователю
        document.body.innerHTML = `<div style="padding: 20px; text-align: center; color: red; font-size: 1.2em;">Ошибка инициализации интерфейса (отсутствует ${missingElementName}). Пожалуйста, проверьте консоль разработчика (F12) или свяжитесь с администратором.</div>`;
        return; // Прерываем дальнейшую инициализацию
    }

    // Определение и применение начальной темы
    let initialTheme = 'dark'; // По умолчанию темная
    try {
         const savedTheme = localStorage.getItem('theme');
         if (!savedTheme) {
              if (window.matchMedia?.('(prefers-color-scheme: light)')?.matches) {
                   initialTheme = 'light';
              }
              console.log("Сохраненная тема не найдена, используется системная/умолчание:", initialTheme);
         } else if (savedTheme === 'light' || savedTheme === 'dark') {
               initialTheme = savedTheme;
               console.log("Найдена сохраненная тема:", initialTheme);
         } else {
               console.warn("Некорректное значение темы в localStorage, используется тема по умолчанию.");
               localStorage.removeItem('theme');
         }
    } catch (e) {
         console.error("Ошибка доступа к localStorage для темы:", e);
    }
    applyTheme(initialTheme);

    // Настройка слушателей событий (после применения темы)
    setupEventListeners();

    // Загрузка начальных данных
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    try {
         await Promise.all([
               loadAllSheetsData(),
               loadVocalists(),
               loadAudioFile() // Предзагрузка метронома
         ]);
         console.log("Sheets, Vocalists, Audio pre-loaded.");

         // Загрузка песен для первого листа (если он есть)
         if (sheetSelect?.options.length > 0) {
              await loadSheetSongs();
         } else {
              displaySongDetails(null);
         }

         // Загрузка списков (вызываем после загрузки данных таблиц)
         loadSetlists();     // Загрузка списка сет-листов
         loadRepertoire(null); // Инициализация репертуара
         loadFavorites();      // Загрузка избранного

    } catch (error) {
         console.error("Критическая ошибка во время инициализации:", error);
         alert("Произошла ошибка при загрузке данных приложения. Попробуйте обновить страницу.");
    } finally {
         if (loadingIndicator) loadingIndicator.style.display = 'none';
    }

    console.log("Инициализация приложения завершена.");
}); // <--- Конец DOMContentLoaded listener
