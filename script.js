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
// let searchIndex = []; // Индекс для поиска (пока не используется)
let currentFontSize = DEFAULT_FONT_SIZE; // Текущий размер шрифта

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

// Кнопки действий с песней
const favoriteButton = document.getElementById('favorite-button'); // Добавить в Мой список
const addToSetlistButton = document.getElementById('add-to-setlist-button'); // Добавить В СЕТ-ЛИСТ
const addToRepertoireButton = document.getElementById('add-to-repertoire-button'); // Добавить в репертуар вокалиста

// Элементы боковых панелей
const toggleFavoritesButton = document.getElementById('toggle-favorites'); // Кнопка откр/закр Левой панели (Списки)
const favoritesPanel = document.getElementById('favorites-panel');       // Сама Левая панель (Списки)
const toggleRepertoireButton = document.getElementById('toggle-repertoire'); // Кнопка откр/закр Правой панели (Репертуар)
const repertoirePanel = document.getElementById('repertoire-panel');       // Сама Правая панель (Репертуар)

// Элементы панели "Мой список" (внутри Левой панели)
const favoritesList = document.getElementById('favorites-list'); // Контейнер для песен "Моего списка"

// Элементы панели "Сет-листы" (внутри Левой панели)
const newSetlistNameInput = document.getElementById('new-setlist-name-input'); // Поле ввода имени нового сет-листа
const createSetlistButton = document.getElementById('create-setlist-button'); // Кнопка "Создать" сет-лист
const setlistsListContainer = document.getElementById('setlists-list-container'); // Контейнер для списка всех сет-листов

// Элементы панели "Текущий сет-лист" (внутри Левой панели)
const currentSetlistTitle = document.getElementById('current-setlist-title'); // Заголовок с именем выбранного сет-листа
const currentSetlistControls = document.querySelector('.current-setlist-controls'); // Блок кнопок "Презентация" и "Удалить сет-лист"
const startPresentationButton = document.getElementById('start-presentation-button'); // Кнопка "Презентация" для сет-листа
const deleteSetlistButton = document.getElementById('delete-setlist-button'); // Кнопка "Удалить" сет-лист
const currentSetlistSongsContainer = document.getElementById('current-setlist-songs-container'); // Контейнер для песен ВНУТРИ выбранного сет-листа

// Элементы панели "Репертуар" (внутри Правой панели)
const vocalistSelect = document.getElementById('vocalist-select');
const repertoirePanelList = document.getElementById('repertoire-panel-list'); // Контейнер для аккордеона репертуара

// Элементы режима Презентации
const presentationOverlay = document.getElementById('presentation-overlay');
const presentationContent = document.getElementById('presentation-content');
const presentationCloseBtn = document.getElementById('presentation-close-btn');
const presSplitTextBtn = document.getElementById('pres-split-text-btn'); // Кнопка разделения в презентации
const presentationControls = document.querySelector('.presentation-controls'); // Нижняя панель в презентации
const presPrevBtn = document.getElementById('pres-prev-btn');
const presNextBtn = document.getElementById('pres-next-btn');
const presCounter = document.getElementById('pres-counter');

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

/** Загрузка песен для ТЕКУЩЕГО сет-листа */
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
            console.warn(`Получен снимок песен для ${setlistId}, но текущий сет-лист уже ${currentSetlistId}. Игнорируем.`);
            return;
        }

        console.log(`Слушатель песен для ${setlistId} сработал. Документов: ${snapshot.size}`);
        currentSetlistSongsContainer.innerHTML = ''; // Очистка контейнера
        currentSetlistSongs = []; // Очистка массива

        if (snapshot.empty) {
            currentSetlistSongsContainer.innerHTML = '<div class="empty-message">В этом сет-листе пока нет песен.</div>';
            return;
        }

        // 6. Обработка и отображение песен
        snapshot.docs.forEach((songDoc) => {
            const songData = songDoc.data();
            const songDocId = songDoc.id;

            // Сохраняем данные песни в глобальный массив
            currentSetlistSongs.push({ id: songDocId, ...songData });

            // Создаем элемент для списка
            const songItem = document.createElement('div');
            songItem.className = 'setlist-song-item';
            songItem.dataset.id = songDocId;
            songItem.dataset.sheet = songData.sheet;
            songItem.dataset.index = songData.index;
            songItem.draggable = true; // Для drag-n-drop (если будет реализован)
            songItem.dataset.order = songData.order; // Сохраняем порядок

            // Информация о песне
            const songInfo = document.createElement('span');
            songInfo.className = 'song-name';
            songInfo.textContent = `${songData.name || 'Без названия'} — ${songData.preferredKey || 'N/A'}`;
            songItem.appendChild(songInfo);

            // Кнопка удаления
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.className = 'delete-button delete-song-from-setlist-button';
            deleteBtn.title = 'Удалить песню из сет-листа';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteSongFromSetlist(songDocId);
            });
            songItem.appendChild(deleteBtn);

            // Клик по элементу
            songItem.addEventListener('click', async () => {
                console.log(`Клик по песне "${songData.name}" в сет-листе.`);
                if (!cachedData[songData.sheet]?.[songData.index]) {
                    console.log(`Данные для ${songData.name} (${songData.sheet}) не найдены в кэше, загружаем...`);
                    await fetchSheetData(songData.sheet);
                    if (!cachedData[songData.sheet]?.[songData.index]) {
                        alert(`Не удалось найти или загрузить данные песни "${songData.name}". Возможно, она была удалена из исходного листа.`);
                        return;
                    }
                }
                const originalSongData = cachedData[songData.sheet][songData.index];
                const sheetNameValue = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === songData.sheet);

                if(sheetSelect && sheetNameValue) sheetSelect.value = sheetNameValue;
                await loadSheetSongs();
                if(songSelect) songSelect.value = songData.index;
                displaySongDetails(originalSongData, songData.index, songData.preferredKey);

                if (favoritesPanel) favoritesPanel.classList.remove('open');
                if (repertoirePanel) repertoirePanel.classList.remove('open');
            });

            currentSetlistSongsContainer.appendChild(songItem);
        });
        // Здесь можно инициализировать Drag-and-Drop
        // initSetlistDragDrop(currentSetlistSongsContainer);

    }, (error) => {
        // Обработка ошибок слушателя песен
        if (setlistId !== currentSetlistId) {
            console.warn(`Получена ошибка для ${setlistId}, но текущий сет-лист уже ${currentSetlistId}. Игнорируем.`);
            return;
        }
        console.error(`Ошибка при загрузке песен для сет-листа ${setlistId}:`, error);
        currentSetlistSongsContainer.innerHTML = '<div class="empty-message">Ошибка загрузки песен.</div>';
        currentSetlistSongs = [];
        // Отписка при ошибке
        if (currentSetlistSongsUnsubscribe) {
            currentSetlistSongsUnsubscribe();
            currentSetlistSongsUnsubscribe = null;
        }
    });
}

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
        clearTimeout(blurTimeout); // Очищаем предыдущий таймаут, если есть
        blurTimeout = setTimeout(() => {
             // Проверяем, что элемент еще в фокусе (возможно, сработал Escape)
             // и что он все еще часть DOM
             if (document.activeElement !== input && itemElement.contains(input)) {
                 saveHandler();
             }
        }, 150); // Немного увеличим задержку
    });

    input.addEventListener('keydown', keydownHandler);

    // Сохраняем обработчики для последующего удаления
    itemElement.dataset.keydownHandler = keydownHandler; // Сохраняем ссылку
}

/** Сохранение нового имени сет-листа */
async function saveSetlistName(id, inputElement, itemElement) {
    if (!inputElement || !itemElement.contains(inputElement)) {
        return; // Элемент уже удален (возможно, через Escape)
    }

    const newName = inputElement.value.trim();
    const originalName = inputElement.dataset.originalName;

    // Убираем поле ввода *до* асинхронной операции, чтобы избежать двойного сохранения
    const tempName = newName || originalName; // Используем новое имя или старое, если новое пустое
    cancelEditSetlistName(itemElement, tempName); // Передаем имя для немедленного отображения

    // Если имя пустое или не изменилось, просто выходим после cancelEditSetlistName
    if (!newName || newName === originalName) {
        console.log("Редактирование имени отменено (имя не изменилось или пустое).");
        return;
    }

    console.log(`Сохранение нового имени "${newName}" для сет-листа ${id}`);
    try {
        const setlistDocRef = doc(db, "setlists", id);
        await updateDoc(setlistDocRef, { name: newName });
        console.log("Имя сет-листа успешно обновлено в Firestore.");

        // Обновляем имя в заголовке текущего сетлиста, если редактировали его
        if(id === currentSetlistId && currentSetlistTitle){
            currentSetlistTitle.textContent = newName;
            currentSetlistName = newName; // Обновляем и глобальное состояние
        }
        // Имя в списке уже обновлено в cancelEditSetlistName
    } catch (error) {
        console.error("Ошибка при обновлении имени сет-листа:", error);
        alert("Не удалось обновить имя сет-листа.");
        // Возвращаем старое имя в UI, если сохранение не удалось
        const nameSpan = itemElement.querySelector('span.setlist-name-display');
        if (nameSpan) {
            nameSpan.textContent = originalName; // Возвращаем старое имя
        }
        // Если редактировали текущий, вернем старое имя и в заголовок
         if(id === currentSetlistId && currentSetlistTitle){
            currentSetlistTitle.textContent = originalName;
            currentSetlistName = originalName;
        }
    }
}

/** Отмена режима редактирования имени сет-листа */
function cancelEditSetlistName(itemElement, nameToShow) {
    if (!itemElement || !itemElement.classList.contains('is-editing')) {
        return;
    }

    const input = itemElement.querySelector('input.edit-setlist-input');
    if (input) {
        // Удаляем слушатели перед удалением элемента
        input.removeEventListener('blur', () => {}); // Удаление пустого обработчика не сработает, нужно сохранять ссылки
        input.removeEventListener('keydown', itemElement.dataset.keydownHandler); // Используем сохраненную ссылку
        delete itemElement.dataset.keydownHandler; // Удаляем сохраненную ссылку

        itemElement.removeChild(input);
    }

    // Обновляем текст в span, если передано имя
    if (nameToShow !== undefined) {
        const nameSpan = itemElement.querySelector('span.setlist-name-display');
        if (nameSpan) {
            nameSpan.textContent = nameToShow;
        }
    }

    itemElement.classList.remove('is-editing');
    // Не фокусируем элемент здесь, чтобы избежать конфликта с blur
    // itemElement.focus();
}

// --- КОНЕЦ НОВЫХ ФУНКЦИЙ ДЛЯ СЕТ-ЛИСТОВ ---
