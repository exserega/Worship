// =====================================================================
// Agape Worship App - script.js (Реорганизованная и исправленная версия)
// =====================================================================

// --- IMPORTS ---
import { db, storage } from './firebase-config.js';
import {
    SONG_CATEGORIES_ORDER, structureMarkers, chords,
    DEFAULT_FONT_SIZE, MIN_FONT_SIZE,
    CONTROLS_HIDE_DELAY, SWIPE_THRESHOLD, SWIPE_VERTICAL_LIMIT
} from './constants.js';
import * as state from './state.js';
import {
    collection, addDoc, query,
    onSnapshot, updateDoc, deleteDoc, setDoc, doc,
    orderBy, getDocs, where
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// --- DERIVED CONSTANTS ---
// Добавим варианты с двоеточием в конце
const structureMarkersWithColon = structureMarkers.map(m => m + ':');
const allMarkers = [...structureMarkers, ...structureMarkersWithColon];

// --- FIREBASE INITIALIZATION ---
const setlistsCollection = collection(db, "setlists");
const songsCollection = collection(db, "songs"); // Ссылка на коллекцию песен

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

// Элементы управления видом репертуара (Добавлено)
const repertoireViewKeyBtn = document.getElementById('repertoire-view-key');
const repertoireViewSheetBtn = document.getElementById('repertoire-view-sheet');
const repertoireViewAllBtn = document.getElementById('repertoire-view-all');

// --- METRONOME STATE ---
let audioContext;
let audioBuffer;
let metronomeInterval = null;
let isMetronomeActive = false;
let currentBeat = 0;

// --- API FUNCTIONS (Firestore) ---

/** Загрузка данных со ВСЕХ песен из Firestore */
async function loadAllSongsFromFirestore() {
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    state.setAllSongs([]);
    state.setSongsBySheet({});

    try {
        console.log("Загрузка всех песен из Firestore...");
        const querySnapshot = await getDocs(songsCollection);

        let newAllSongs = [];
        let newSongsBySheet = {};

        querySnapshot.forEach(doc => {
            const songData = doc.data();
            const songId = doc.id;
            const song = { id: songId, name: songId, ...songData };

            newAllSongs.push(song);

            const sheetName = song.sheet;
            if (sheetName) {
                if (!newSongsBySheet[sheetName]) {
                    newSongsBySheet[sheetName] = [];
                }
                newSongsBySheet[sheetName].push(song);
            } else {
                console.warn(`Песня "${song.name}" (${songId}) не имеет поля 'sheet' (категории).`);
            }
        });

        newAllSongs.sort((a, b) => a.name.localeCompare(b.name));
        for (const category in newSongsBySheet) {
            newSongsBySheet[category].sort((a, b) => a.name.localeCompare(b.name));
        }
        
        state.setAllSongs(newAllSongs);
        state.setSongsBySheet(newSongsBySheet);

        console.log(`Загружено state.allSongs.length} песен.`);
        populateSheetSelect();

    } catch (error) {
        console.error('Критическая ошибка при загрузке песен из Firestore:', error);
        alert("Произошла критическая ошибка при загрузке песен из базы данных. Проверьте консоль (F12).");
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/** Заполняет выпадающий список категорий (листов) */
function populateSheetSelect() {
    if (!sheetSelect) return;

    sheetSelect.innerHTML = '<option value="">-- Выберите категорию --</option>';

    // Используем SONG_CATEGORIES_ORDER для определения порядка
    SONG_CATEGORIES_ORDER.forEach(categoryName => {
        // Добавляем категорию в список, только если для нее есть песни
        if (state.songsBySheet[categoryName] && state.songsBySheet[categoryName].length > 0) {
            const option = document.createElement('option');
            option.value = categoryName;
            option.textContent = categoryName;
            sheetSelect.appendChild(option);
        }
    });

    // Добавляем категории, которых нет в `SONG_CATEGORIES_ORDER`, но есть в базе
    Object.keys(state.songsBySheet).forEach(categoryName => {
        if (!SONG_CATEGORIES_ORDER.includes(categoryName)) {
            const option = document.createElement('option');
            option.value = categoryName;
            option.textContent = categoryName;
            sheetSelect.appendChild(option);
            console.warn(`Категория "${categoryName}" была найдена в базе, но отсутствует в константе SONG_CATEGORIES_ORDER. Она добавлена в конец списка.`);
        }
    });
}


/**
 * Создает DOM-элемент для одной песни в списке репертуара.
 * @param {object} song - Объект песни (из currentRepertoireSongsData)
 * @param {string} vocalistId - ID текущего вокалиста
 * @returns {HTMLElement} - Готовый div элемент песни
 */
function createRepertoireSongElement(song, vocalistId) {
    const listItem = document.createElement('div');
    listItem.className = 'repertoire-item'; // Используем тот же класс, что и раньше

    const songInfo = document.createElement('span');
    songInfo.className = 'song-name';

    // *** НАЧАЛО ИЗМЕНЕНИЯ: Универсальное получение имени песни ***
    // Старый формат: song.name
    // Новый формат (когда в репертуаре будет ссылка на песню): song.id 
    const songName = song.name || song.id; 
    // *** КОНЕЦ ИЗМЕНЕНИЯ ***

    // Показываем имя, тональность и короткое имя листа
    const shortSheetName = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === song.sheet) || song.sheet || '';
    songInfo.textContent = `${songName} (${song.preferredKey || 'N/A'}${shortSheetName ? ', ' + shortSheetName : ''})`;
    listItem.appendChild(songInfo);

    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.className = 'remove-button';
    removeBtn.title = 'Удалить из репертуара';
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Остановить всплытие, чтобы не сработал клик по listItem
        // Функция removeFromRepertoire уже должна существовать
        removeFromRepertoire(vocalistId, song.repertoireDocId);
    });
    listItem.appendChild(removeBtn);

    // Клик по элементу для перехода к песне
    listItem.addEventListener('click', async () => {
        // Эта логика перехода к песне уже была в старой loadRepertoire, переносим сюда
        console.log(`Клик по песне "${songName}" в репертуаре.`);
        
        // *** НАЧАЛО ИЗМЕНЕНИЯ: Универсальное получение ID песни ***
        // Старый формат: song.id (если мы его там хранили) или ищем по имени.
        // Новый формат: song.id (ID документа из коллекции songs)
        // Мы будем искать в allSongs по имени, если ID не найден.
        const songId = song.id || song.songId; // Предпочитаем прямой ID
        let songData = state.allSongs.find(s => s.id === songId);

        // Если по ID не нашли (старый формат), ищем по имени
        if (!songData && songName) {
            songData = state.allSongs.find(s => s.id.toLowerCase() === songName.toLowerCase());
        }
        // *** КОНЕЦ ИЗМЕНЕНИЯ ***

        if (!songData) {
            alert(`Не удалось найти данные песни "${songName}". Возможно, она была удалена из общей базы.`);
            return;
        }

        // Устанавливаем значения в select'ах и отображаем песню
        if (sheetSelect && songData.sheet) sheetSelect.value = songData.sheet;
        loadSheetSongs(); // Загружаем песни нужного листа
        if (songSelect) songSelect.value = songId; // Выбираем нужную песню по ID
        
        // Отображаем с тональностью, сохраненной в репертуаре
        displaySongDetails(songData, song.preferredKey); 

        closeAllSidePanels(); // Закрываем панель после выбора
    });

    return listItem;
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

/** Выделение маркеров структуры песни (Куплет, Припев и т.д.) - ОБНОВЛЕННАЯ ВЕРСИЯ */
function highlightStructure(lyrics) {
    if (!lyrics) return '';

    // --- ОБНОВЛЕННЫЙ СПИСОК МАРКЕРОВ ---
    // Добавлены основные английские варианты + instrumental
    const markers = [
        "куплет", "припев", "бридж", "мостик", "мост", "проигрыш", "интро",
        "вступление", "аутро", "окончание", "кода", "запев", "соло",
        "предприпев", "прехорус",
        // Английские варианты (некоторые могли дублироваться с русскими - уберем дубликаты ниже)
        "verse", "chorus", "bridge", "pre-chorus", "intro", "outro", "solo", "instrumental", "interlude", "tag", "vamp"
        // Можно добавить еще по необходимости
    ];
    // Убираем дубликаты и приводим к нижнему регистру для надежности регулярного выражения
    const uniqueMarkers = [...new Set(markers.map(m => m.toLowerCase()))];
    // --- КОНЕЦ ОБНОВЛЕНИЯ СПИСКА ---


    // --- ОБНОВЛЕННОЕ РЕГУЛЯРНОЕ ВЫРАЖЕНИЕ ---
    // Позволяет: [Цифра][Пробел](Маркер)[Пробел][Цифра][:]/[.] в начале строки
    // ^\s* - Начало строки, необязательные пробелы
    // (\d+\s+)?                        - НЕОБЯЗАТЕЛЬНАЯ группа: 1+ цифр (\d+), 1+ пробелов (\s+)
    // (marker1|marker2|...)            - ОДИН из маркеров (захватывается)
    // (\s*\d*)?                        - НЕОБЯЗАТЕЛЬНАЯ группа: необязательные пробелы (\s*), необязательные цифры (\d*)
    // \s* - Необязательные пробелы
    // [:.]?                            - Необязательный символ : или .
    // \s*$                             - Необязательные пробелы, конец строки
    const markerPattern = `^\\s*(\\d+\\s+)?(${uniqueMarkers.join('|')})(\\s*\\d*)?\\s*[:.]?\\s*$`;
    const markerRegex = new RegExp(markerPattern, 'i'); // Флаг 'i' для нечувствительности к регистру
    // --- КОНЕЦ ОБНОВЛЕНИЯ РЕГУЛЯРКИ ---

    // Логика обработки строк остается прежней
    return lyrics.split('\n').map(line => {
        const trimmedLine = line.trim();
        // Проверяем, соответствует ли вся строка (после обрезки пробелов) нашему шаблону маркера
        if (markerRegex.test(trimmedLine)) {
            // Если да, оборачиваем в span с классом
            // Используем исходную строку line, чтобы сохранить отступы, если они важны,
            // но можно использовать и trimmedLine, если отступы не нужны.
            // Используем line, чтобы подсветка применилась к строке с исходными пробелами.
            // Заменяем сам найденный маркер (trimmedLine) на обернутый в span
             return line.replace(trimmedLine, `<span class="song-structure">${trimmedLine}</span>`);
           // return `<span class="song-structure">${line}</span>`; // Вариант: обернуть всю строку, включая пробелы
        } else {
            // Если нет, возвращаем строку как есть (для последующей обработки аккордов)
            return line;
        }
    }).join('\n'); // Собираем строки обратно
}

/** Загрузка репертуара вокалиста (ОБНОВЛЕННАЯ ВЕРСИЯ) */
function loadRepertoire(vocalistId) {
    const listContainer = repertoirePanelList;
    const sectionContainer = repertoirePanel; // Для возможного использования

    if (!listContainer || !sectionContainer) {
        console.error("Не найдены UI элементы для панели репертуара.");
        return;
    }

    // 1. Отписка от предыдущего слушателя Firestore
    if (state.currentRepertoireUnsubscribe) {
        state.currentRepertoireUnsubscribe();
        state.setCurrentRepertoireUnsubscribe(null);
    }

    state.setCurrentRepertoireSongsData([]);
    listContainer.innerHTML = ''; // Очищаем контейнер

    if (!vocalistId) {
        listContainer.innerHTML = '<div class="empty-message">Выберите вокалиста для просмотра репертуара.</div>';
        return;
    }

    listContainer.innerHTML = '<div class="empty-message">Загрузка репертуара...</div>';

    const repertoireColRef = collection(db, "vocalists", vocalistId, "repertoire");
    const q = query(repertoireColRef); // Можно добавить orderBy, если нужно (например, по имени?)

    console.log(`loadRepertoire: Установка НОВОГО слушателя для ${vocalistId}`);

    // 2. Устанавливаем НОВЫЙ слушатель Firestore
    const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log(`>>> Firestore onSnapshot для репертуара ${vocalistId} СРАБОТАЛ. Документов: ${snapshot.size}`);

        // Проверяем, актуален ли еще этот вокалист (на случай быстрой смены)
        if (vocalistId !== state.currentVocalistId) return;

        const songsData = snapshot.docs.map(doc => ({ ...doc.data(), repertoireDocId: doc.id }));
        state.setCurrentRepertoireSongsData(songsData);
        
        // Вызываем функцию для отрисовки репертуара на основе текущего режима
        renderRepertoire();

    }, (error) => {
        // Обработка ошибок слушателя
        console.error(`!!! ОШИБКА Firestore onSnapshot для репертуара ${vocalistId}:`, error);
        if (vocalistId === state.currentVocalistId) { // Показываем ошибку только если вокалист все еще выбран
            state.setCurrentRepertoireSongsData([]);
        } else {
            console.warn(`Ошибка onSnapshot для ${vocalistId} проигнорирована, т.к. текущий вокалист ${state.currentVocalistId}.`);
        }
        // Отписываемся при ошибке, если это был слушатель для текущего вокалиста
        if (vocalistId === state.currentVocalistId && state.currentRepertoireUnsubscribe) {
            state.currentRepertoireUnsubscribe();
            state.setCurrentRepertoireUnsubscribe(null);
        }
    });
    state.setCurrentRepertoireUnsubscribe(unsubscribe);
}


/** Рендерит список репертуара на основе текущего режима (currentRepertoireViewMode) */
function renderRepertoire() {
    const listContainer = repertoirePanelList;
    if (!listContainer) {
        console.error("renderRepertoire: Контейнер #repertoire-panel-list не найден.");
        return;
    }
    if (!state.currentVocalistId) { // Доп. проверка, если вдруг вызвали без вокалиста
         listContainer.innerHTML = '<div class="empty-message">Выберите вокалиста.</div>';
         return;
    }

    listContainer.innerHTML = ''; // Очищаем перед отрисовкой

    if (state.currentRepertoireSongsData.length === 0) {
        listContainer.innerHTML = '<div class="empty-message">Репертуар пуст.</div>';
        return;
    }

    console.log(`Рендеринг репертуара в режиме: ${state.currentRepertoireViewMode}`);

    // Выбираем нужный способ отрисовки
    switch (state.currentRepertoireViewMode) {
        case 'bySheet':
            renderRepertoireBySheet(state.currentRepertoireSongsData, listContainer, state.currentVocalistId);
            break;
        case 'allAlphabetical':
            renderRepertoireAlphabetical(state.currentRepertoireSongsData, listContainer, state.currentVocalistId);
            break;
        case 'byKey':
        default: // По умолчанию или если режим неизвестен - группируем по ключу
            renderRepertoireByKey(state.currentRepertoireSongsData, listContainer, state.currentVocalistId);
            break;
    }
     // Сбрасываем прокрутку контейнера вверх после рендеринга
     listContainer.scrollTop = 0;
}

/** Рендеринг репертуара с группировкой ПО ТОНАЛЬНОСТИ (Аккордеон) */
function renderRepertoireByKey(songsData, container, vocalistId) {
    console.log("  Рендеринг по тональности...");
    const groupedByKeys = {};
    songsData.forEach((song) => {
        const key = song.preferredKey || "N/A";
        if (!groupedByKeys[key]) {
            groupedByKeys[key] = [];
        }
        groupedByKeys[key].push(song);
    });

    // Сортировка тональностей
    const sortedKeys = Object.keys(groupedByKeys).sort((a, b) => {
        const order = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "H", "N/A"];
        return order.indexOf(a) - order.indexOf(b);
    });

    // Отрисовка аккордеона
    sortedKeys.forEach(key => {
        const keyHeading = document.createElement('div');
        keyHeading.className = 'repertoire-key-heading'; // Используем старый класс для стилей
        keyHeading.innerHTML = `Тональность: ${key} <i class="fas fa-chevron-down"></i>`;
        keyHeading.dataset.key = key;
        // Обработчик для сворачивания/разворачивания (функция toggleRepertoireKeySection должна уже существовать)
        keyHeading.addEventListener('click', toggleRepertoireKeySection);
        container.appendChild(keyHeading);

        const songsWrapper = document.createElement('div');
        songsWrapper.className = 'repertoire-songs-for-key collapsed'; // По умолчанию свернуты
        songsWrapper.dataset.keyContent = key;

        const songsInKey = groupedByKeys[key];
        // Сортируем песни внутри тональности по алфавиту
        songsInKey.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        if (songsInKey.length > 0) {
            songsInKey.forEach(song => {
                // Используем вспомогательную функцию для создания элемента песни
                const songElement = createRepertoireSongElement(song, vocalistId);
                songsWrapper.appendChild(songElement);
            });
        } else {
             // Этого не должно быть, если ключ существует, но на всякий случай
            songsWrapper.innerHTML = '<div class="empty-message small">Нет песен в этой тональности</div>';
        }
        container.appendChild(songsWrapper);
    });
    console.log("  Рендеринг по тональности завершен.");
}

/** Рендеринг репертуара с группировкой ПО ЛИСТАМ (Аккордеон) */
function renderRepertoireBySheet(songsData, container, vocalistId) {
    console.log("  Рендеринг по листам...");
    const groupedBySheet = {};
    const sheetOrder = Object.keys(SHEETS); // Получаем порядок листов из константы

    songsData.forEach((song) => {
        const sheetName = song.sheet || "N/A"; // Используем внутреннее имя листа
        if (!groupedBySheet[sheetName]) {
            groupedBySheet[sheetName] = [];
        }
        groupedBySheet[sheetName].push(song);
    });

     // Сортируем ключи (внутренние имена листов) в соответствии с порядком в SHEETS
    const sortedSheetNames = Object.keys(groupedBySheet).sort((a, b) => {
        const indexA = sheetOrder.findIndex(key => SHEETS[key] === a);
        const indexB = sheetOrder.findIndex(key => SHEETS[key] === b);
        // Если лист не найден в SHEETS (например, "N/A"), отправляем его в конец
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    // Отрисовка (используем те же классы для аккордеона, но с другим текстом)
    sortedSheetNames.forEach(sheetName => {
        // Получаем отображаемое имя листа
        const displaySheetName = Object.keys(SHEETS).find(key => SHEETS[key] === sheetName) || sheetName;

        const sheetHeading = document.createElement('div');
        sheetHeading.className = 'repertoire-key-heading'; // Переиспользуем стиль заголовка
        sheetHeading.innerHTML = `${displaySheetName} <i class="fas fa-chevron-down"></i>`;
        sheetHeading.dataset.key = sheetName; // Используем sheetName как ключ для dataset
        sheetHeading.addEventListener('click', toggleRepertoireKeySection); // Переиспользуем обработчик
        container.appendChild(sheetHeading);

        const songsWrapper = document.createElement('div');
        songsWrapper.className = 'repertoire-songs-for-key collapsed'; // По умолчанию свернуты
        songsWrapper.dataset.keyContent = sheetName; // Используем sheetName

        const songsInSheet = groupedBySheet[sheetName];
        // Сортируем песни внутри листа по алфавиту
        songsInSheet.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        if (songsInSheet.length > 0) {
            songsInSheet.forEach(song => {
                const songElement = createRepertoireSongElement(song, vocalistId);
                songsWrapper.appendChild(songElement);
            });
        } else {
            songsWrapper.innerHTML = '<div class="empty-message small">Нет песен в этом листе</div>';
        }
        container.appendChild(songsWrapper);
    });
     console.log("  Рендеринг по листам завершен.");
}

/** Рендеринг репертуара плоским списком ПО АЛФАВИТУ */
function renderRepertoireAlphabetical(songsData, container, vocalistId) {
     console.log("  Рендеринг по алфавиту...");
    // Сортируем весь массив песен по имени
    const sortedSongs = [...songsData].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (sortedSongs.length > 0) {
        sortedSongs.forEach(song => {
            const songElement = createRepertoireSongElement(song, vocalistId);
            // Просто добавляем элементы в контейнер без группировки
            container.appendChild(songElement);
        });
    } else {
        // Это сообщение уже обрабатывается в renderRepertoire, но на всякий случай
        container.innerHTML = '<div class="empty-message">Репертуар пуст.</div>';
    }
    console.log("  Рендеринг по алфавиту завершен.");
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
    if (!state.currentVocalistId) {
        alert("Пожалуйста, сначала выберите вокалиста из списка."); return;
    }
    if (!sheetSelect || !songSelect || !keySelect) {
         console.error("addToRepertoire: Отсутствуют элементы sheetSelect, songSelect или keySelect."); return;
    }

    const songId = songSelect.value;
    const songData = state.allSongs.find(s => s.id === songId);

    if (!songData) {
         alert("Пожалуйста, сначала выберите песню для добавления в репертуар."); return;
    }

    const songName = songData.name;
    const preferredKey = keySelect.value;
    console.log(`Добавляем в репертуар для ${state.currentVocalistName || state.currentVocalistId}: Песня "${songName}", Тональность: ${preferredKey}`);

    // Используем ID песни из Firestore как ID документа в подколлекции
    const repertoireDocId = songId; 
    const dataToSave = {
        songId: songId, // Сохраняем ID для связи
        sheet: songData.sheet,
        name: songName,
        preferredKey: preferredKey
    };
    console.log("Данные для сохранения:", dataToSave);

    try {
        const docRef = doc(db, "vocalists", state.currentVocalistId, "repertoire", repertoireDocId);
        await setDoc(docRef, dataToSave); // setDoc перезапишет или создаст документ
        console.log(`Песня "${songName}" успешно добавлена/обновлена в репертуаре ${state.currentVocalistName || state.currentVocalistId}.`);
        alert(`Песня "${songName}" (${preferredKey}) добавлена/обновлена в репертуаре ${state.currentVocalistName || state.currentVocalistId}.`);
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
     const vocalistDisplayName = state.currentVocalistName || vocalistId; // Отображаемое имя
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
            if (setlistId === state.currentSetlistId) {
                setlistItem.classList.add('active');
            }

            setlistsListContainer.appendChild(setlistItem);
        });

        // Проверяем, существует ли еще текущий выбранный сет-лист
        if (state.currentSetlistId && !snapshot.docs.some(doc => doc.id === state.currentSetlistId)) {
             console.log(`Текущий сет-лист ${state.currentSetlistId} больше не существует, сбрасываем выбор.`);
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
    state.setCurrentSetlistId(setlistId);
    state.setCurrentSetlistName(setlistName);

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
            state.setCurrentSetlistSongs([]); // Очищаем песни при сбросе
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
    if (state.currentSetlistSongsUnsubscribe) {
        state.currentSetlistSongsUnsubscribe();
        state.setCurrentSetlistSongsUnsubscribe(null);
    }

    // 2. Очистка, если сет-лист не выбран
    if (!setlistId) {
        state.setCurrentSetlistSongs([]);
        currentSetlistSongs = [];
        return;
    }

    // 3. Индикатор загрузки
    currentSetlistSongsContainer.innerHTML = '<div>Загрузка песен сет-листа...</div>';
    state.setCurrentSetlistSongs([]);

    // 4. Путь и запрос
    const songsCollectionRef = collection(db, "setlists", setlistId, "songs");
    const q = query(songsCollectionRef, orderBy("order", "asc"));

    console.log(`Установка слушателя для песен сет-листа ${setlistId}`);

    // 5. Установка нового слушателя
    const unsubscribe = onSnapshot(q, (snapshot) => {
        // Проверка актуальности
        if (setlistId !== state.currentSetlistId) {
            console.warn(`Получен снимок песен для ${setlistId}, но текущий ${state.currentSetlistId}. Игнор.`);
            return;
        }

        console.log(`Слушатель песен ${setlistId} сработал. Документов: ${snapshot.size}`);
        currentSetlistSongsContainer.innerHTML = '';
        const newSongs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.setCurrentSetlistSongs(newSongs);

        if (snapshot.empty) {
            currentSetlistSongsContainer.innerHTML = '<div class="empty-message">Нет песен в сет-листе.</div>';
            return;
        }

        // 6. Обработка и отображение песен
        state.currentSetlistSongs.forEach((songData) => {
            const songDocId = songData.id;

            const songItem = document.createElement('div');
            songItem.className = 'setlist-song-item';
            songItem.dataset.id = songDocId;
            songItem.dataset.songId = songData.songId; // Сохраняем ID основной песни

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
                
                const songId = e.currentTarget.dataset.songId;
                console.log(`Клик по песне с ID "${songId}" в сет-листе.`);
                const songToDisplay = state.allSongs.find(s => s.id === songId);

                if (!songToDisplay) {
                    alert(`Не удалось найти данные песни "${songData.name}". Возможно, она была удалена.`);
                    return;
                }

                if (sheetSelect && songToDisplay.sheet) sheetSelect.value = songToDisplay.sheet;
                loadSheetSongs();
                if (songSelect) songSelect.value = songId;
                displaySongDetails(songToDisplay, songData.preferredKey);

                // !!! ЗАКРЫВАЕМ ПАНЕЛИ ПОСЛЕ КЛИКА !!!
                closeAllSidePanels();
            }); // Конец обработчика клика по songItem

            currentSetlistSongsContainer.appendChild(songItem); // Добавляем готовую строку песни в контейнер
        }); // Конец forEach

        // Тут можно инициализировать drag-n-drop, если он будет
        // initSortable();

    }, (error) => { // Обработка ошибок onSnapshot
        if (setlistId !== state.currentSetlistId) { return; } // Игнорируем ошибку, если сет-лист уже сменился
        console.error(`Ошибка загрузки песен для ${setlistId}:`, error);
        currentSetlistSongsContainer.innerHTML = '<div class="empty-message">Ошибка загрузки песен.</div>';
        state.setCurrentSetlistSongs([]);
        // Отписываемся при ошибке слушателя
        if (state.currentSetlistSongsUnsubscribe) {
            state.currentSetlistSongsUnsubscribe();
            state.setCurrentSetlistSongsUnsubscribe(null);
        }
    });
    state.setCurrentSetlistSongsUnsubscribe(unsubscribe);
} // Конец функции loadCurrentSetlistSongs


/** Добавляет текущую песню в ВЫБРАННЫЙ сет-лист */
async function addToCurrentSetlist() {
    console.log("Попытка добавить песню в текущий сет-лист...");

    // 1. Проверка выбора сет-листа
    if (!state.currentSetlistId) {
        alert("Пожалуйста, сначала выберите сет-лист в панели слева, куда нужно добавить песню.");
        if (setlistsPanel && !setlistsPanel.classList.contains('open')) {
            setlistsPanel.classList.add('open');
            if (repertoirePanel) repertoirePanel.classList.remove('open');
            loadSetlists(); 
        }
        return;
    }

    // 2. Получение данных текущей песни
    if (!songSelect || !keySelect) {
         console.error("addToCurrentSetlist: Отсутствуют songSelect или keySelect."); return;
    }
    
    const songId = songSelect.value;
    const songData = state.allSongs.find(s => s.id === songId);

    if (!songData) {
        alert("Пожалуйста, сначала выберите песню, которую хотите добавить.");
        return;
    }
    const songName = songData.name;
    const preferredKey = keySelect.value;

    console.log(`Добавляем: Песня="${songName}", Тональность=${preferredKey} в Сет-лист ID=${state.currentSetlistId} (${state.currentSetlistName || ''})`);

    // 3. Определение порядка (order)
    const nextOrder = state.currentSetlistSongs.length > 0
        ? Math.max(...state.currentSetlistSongs.map(song => song.order ?? -1)) + 1
        : 0;
    console.log("Следующий порядок (order):", nextOrder);

    // 4. Данные для сохранения
    const songEntryData = {
        songId: songId, // ID из основной коллекции songs
        sheet: songData.sheet,
        name: songName,
        preferredKey: preferredKey,
        order: nextOrder
    };

    // 5. Добавление в Firestore (с проверкой на дубликат)
    try {
        const songsCollectionRef = collection(db, "setlists", state.currentSetlistId, "songs");
        // Проверяем дубликат по songId
        const q = query(songsCollectionRef, where("songId", "==", songId));
        const duplicateSnapshot = await getDocs(q);

        if (!duplicateSnapshot.empty) {
            const existingDoc = duplicateSnapshot.docs[0];
            const existingData = existingDoc.data();
            if (existingData.preferredKey !== preferredKey) {
                if (confirm(`Песня "${songName}" уже есть в сет-листе "${state.currentSetlistName}". Обновить тональность на ${preferredKey}?`)) {
                    await setDoc(doc(db, "setlists", state.currentSetlistId, "songs", existingDoc.id), { preferredKey: preferredKey }, { merge: true });
                    alert(`Тональность песни "${songName}" в сет-листе обновлена на ${preferredKey}.`);
                }
            } else {
                alert(`Песня "${songName}" уже есть в сет-листе "${state.currentSetlistName}" с той же тональностью.`);
            }
            return; // Выходим
        }

        // Дубликатов нет, добавляем
        const docRef = await addDoc(songsCollectionRef, songEntryData);
        console.log(`Песня добавлена в сет-лист ${state.currentSetlistId} с ID документа: ${docRef.id}`);
        alert(`Песня "${songName}" (${preferredKey}) добавлена в сет-лист "${state.currentSetlistName}".`);
        // Список обновится через onSnapshot

    } catch (error) {
        console.error("Ошибка при добавлении песни в сет-лист:", error);
        alert("Произошла ошибка при добавлении песни в сет-лист.");
    }
}

/** Удаление ОДНОЙ песни из ТЕКУЩЕГО сет-листа */
async function deleteSongFromSetlist(songDocId) {
    if (!state.currentSetlistId) {
        console.error("Не выбран сет-лист для удаления песни.");
        alert("Произошла ошибка: не выбран сет-лист.");
        return;
    }

    const songToDelete = state.currentSetlistSongs.find(song => song.id === songDocId);
    const songNameToConfirm = songToDelete ? `"${songToDelete.name}"` : "эту песню";
    const setlistNameToConfirm = state.currentSetlistName || 'текущего';

    if (confirm(`Вы уверены, что хотите удалить ${songNameToConfirm} из сет-листа "${setlistNameToConfirm}"?`)) {
        console.log(`Попытка удаления песни ${songDocId} из сет-листа ${state.currentSetlistId}`);
        try {
            const songDocRef = doc(db, "setlists", state.currentSetlistId, "songs", songDocId);
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
    if (!state.currentSetlistId || !state.currentSetlistName) {
        alert("Сначала выберите сет-лист, который хотите удалить.");
        return;
    }

    if (confirm(`ВЫ УВЕРЕНЫ, что хотите ПОЛНОСТЬЮ удалить сет-лист "${state.currentSetlistName}"?\n\nЭто действие необратимо и удалит сам сет-лист (но не сами песни из общих таблиц).`)) {
        console.log(`Попытка удаления сет-листа ${state.currentSetlistId}`);
        // Сначала отпишемся от песен удаляемого сет-листа, если есть подписка
        if (state.currentSetlistSongsUnsubscribe) {
            state.currentSetlistSongsUnsubscribe();
            state.setCurrentSetlistSongsUnsubscribe(null);
        }
        try {
            const setlistDocRef = doc(db, "setlists", state.currentSetlistId);
            await deleteDoc(setlistDocRef);
            console.log("Сет-лист успешно удален.");
            alert(`Сет-лист "${state.currentSetlistName}" удален.`);

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
        if(id === state.currentSetlistId && currentSetlistTitle){
            currentSetlistTitle.textContent = newName;
            state.setCurrentSetlistName(newName); // Обновляем и глобальное состояние
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

/** Обработка строк текста для коррекции выравнивания пробелов */
function processLyrics(lyrics) {
    if (!lyrics) return '';
    return lyrics.split('\n').map(line => {
        // Заменяем 2+ пробела на округленную половину их количества (минимум 1 пробел)
        return line.replace(/ {2,}/g, match => ' '.repeat(Math.max(1, Math.ceil(match.length / 2))));
    }).join('\n');
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

    if (state.allSongs.length === 0) {
        searchResults.innerHTML = '<div class="search-result">База песен пуста или не загружена.</div>';
        return;
    }

    const matchingSongs = state.allSongs.filter(song => 
        song.name && song.name.toLowerCase().includes(lowerQuery)
    );

    if (matchingSongs.length === 0) {
        searchResults.innerHTML = '<div class="search-result">Ничего не найдено</div>';
        return;
    }

    // Отображаем найденные песни
    matchingSongs.forEach((songMatch) => {
        const resultItem = document.createElement('div');
        resultItem.textContent = `${songMatch.name} (${songMatch.sheet || 'Без категории'})`; // Показываем название и категорию
        resultItem.className = 'search-result';
        resultItem.addEventListener('click', async () => {
            
            // Обновляем интерфейс
            if (sheetSelect && songMatch.sheet) sheetSelect.value = songMatch.sheet;
            loadSheetSongs(); // Загружаем песни для выбранного листа
            if (songSelect) songSelect.value = songMatch.id; // Выбираем песню по ID

            displaySongDetails(songMatch); // Отображаем детали

            // Очищаем поиск и инпут
            if (searchResults) searchResults.innerHTML = '';
            if (searchInput) searchInput.value = songMatch.name; 
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

    state.setPresentationSongs([...songsToShow]);
    state.setCurrentPresentationIndex(0);
    state.setIsPresentationSplit(false);
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
    if (!presentationContent || state.presentationSongs.length === 0) return;

    // Коррекция индекса, если он вышел за пределы
    state.setCurrentPresentationIndex(Math.max(0, Math.min(state.currentPresentationIndex, state.presentationSongs.length - 1)));

    const songRef = state.presentationSongs[state.currentPresentationIndex];
    console.log(`Презентация: Показываем песню ${state.currentPresentationIndex + 1}/${state.presentationSongs.length}: ${songRef.name}`);

    presentationContent.innerHTML = `<div class="presentation-loading">Загрузка "${songRef.name}"...</div>`;

    try {
        // Получение данных песни из allSongs
        const song = state.allSongs.find(s => s.id === songRef.songId);
        if (!song) {
            throw new Error(`Не найдены данные для песни "${songRef.name}" (ID: ${songRef.songId})`);
        }

        // Подготовка текста
        const songTitle = song.name;
        const originalLyrics = song['Текст и аккорды'] || '';
        const originalKey = song['Оригинальная тональность'] || chords[0];
        const targetKey = songRef.preferredKey || originalKey;
        const songNote = songRef.notes || '';

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

        presentationContent.classList.toggle('split-columns', state.isPresentationSplit);

        const songElement = presentationContent.querySelector('.presentation-song pre');
        if (songElement) songElement.scrollTop = 0;

    } catch (error) {
        console.error("Ошибка при отображении песни в презентации:", error);
        presentationContent.innerHTML = `<div class="presentation-song error"><h2>Ошибка загрузки песни</h2><p>${error.message || 'Неизвестная ошибка'}</p></div>`;
    }

    // Обновление счетчика и кнопок навигации
    if (presCounter) {
        presCounter.textContent = `${state.currentPresentationIndex + 1} / ${state.presentationSongs.length}`;
    }
    if (presPrevBtn) presPrevBtn.disabled = (state.currentPresentationIndex === 0);
    if (presNextBtn) presNextBtn.disabled = (state.currentPresentationIndex >= state.presentationSongs.length - 1);
} // Конец функции displayCurrentPresentationSong

/** Переключает на СЛЕДУЮЩУЮ песню в презентации */
function nextPresentationSong() {
    if (state.currentPresentationIndex < state.presentationSongs.length - 1) {
        state.setCurrentPresentationIndex(state.currentPresentationIndex + 1);
        displayCurrentPresentationSong();
        showPresentationControls(); // Показать контролы при смене песни
    }
}

/** Переключает на ПРЕДЫДУЩУЮ песню в презентации */
function prevPresentationSong() {
    if (state.currentPresentationIndex > 0) {
        state.setCurrentPresentationIndex(state.currentPresentationIndex - 1);
        displayCurrentPresentationSong();
        showPresentationControls(); // Показать контролы при смене песни
    }
}

// --- Функции для автоскрытия панели управления в презентации ---

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
    state.setIsPresentationSplit(!state.isPresentationSplit);
    presentationContent.classList.toggle('split-columns', state.isPresentationSplit);
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

    if (state.isPresentationSplit) { // Если разделено
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
function displaySongDetails(songData, keyToSelect) {
    // Проверки на наличие элементов
    if (!songContent || !keySelect || !playerContainer || !playerSection) {
        console.error("displaySongDetails: Отсутствуют критически важные DOM элементы.");
        return;
    }
    const keyDisplay = document.getElementById('youtube-video-key-display');

    // --- СБРОС, ЕСЛИ ПЕСНЯ НЕ ВЫБРАНА ---
    if (!songData) {
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
        keySelect.dataset.songId = ''; // Очистка ID для транспонирования
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
    // Новая логика: работаем с объектом songData из Firestore
    const title = songData.name || 'Без названия';
    const originalLyrics = songData['Текст и аккорды'] || '';
    const originalKeyFromSheet = songData['Оригинальная тональность'] || chords[0];
    const srcUrl = songData.Holychords || '#';
    const bpm = songData.BPM || 'N/A';
    const ytLink = songData['YouTube Link'];
    // Поле для тональности в видео может называться 'videoKey' или иначе. Проверьте вашу структуру Firestore.
    const videoKey = songData.videoKey ? String(songData.videoKey).trim() : null;

    const currentSelectedKey = keyToSelect || originalKeyFromSheet;
    keySelect.value = currentSelectedKey;
    keySelect.dataset.songId = songData.id;

    if (bpmDisplay) {
        updateBPM(bpm); // Обновляем BPM (функция сама ставит текст в bpmDisplay)
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
    // 0. Обрабатываем пробелы для корректного отображения (ВСТАВЛЕНО!)
    const processedLyrics = processLyrics(originalLyrics);

    // 1. Транспонируем (теперь используем processedLyrics)
    const transposition = getTransposition(originalKeyFromSheet, currentSelectedKey);
    const transposedLyrics = transposeLyrics(processedLyrics, transposition);

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
        <pre>${finalHighlightedLyrics}</pre> `; // Используем finalHighlightedLyrics
    updateFontSize(); // Применяем текущий размер шрифта

    // Применяем класс скрытия аккордов, если он был включен
    if (songContent) {
        songContent.classList.toggle('chords-hidden', !state.areChordsVisible);
    }

   // Обновляем YouTube плеер
   const vId = extractYouTubeVideoId(ytLink);
if (vId && playerContainer && playerSection) {
    // Используем правильный URL для встраивания
    const embedUrl = `https://www.youtube.com/embed/${vId}`;
    playerContainer.innerHTML = `<iframe width="100%" height="315" src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`; // Добавил 'web-share' в allow для современных браузеров
    playerSection.style.display = 'block';
         if (keyDisplay) {
        if (videoKey) {
            keyDisplay.textContent = `Тональность в видео: ${videoKey}`;
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
        // (Предполагается, что handleCopyClick добавлена в window в setupEventListeners)
        if (typeof window.handleCopyClick === 'function') {
             // Удаляем старый слушатель на всякий случай (если он был)
             // currentCopyButton.removeEventListener('click', window.handleCopyClick); // Это может не сработать, если ссылка на функцию изменилась
             // Проще не удалять, а просто добавить новый или использовать делегирование, как было сделано в setupEventListeners
             // Оставим добавление слушателя в setupEventListeners через делегирование, здесь только показываем кнопку.
        } else {
             console.warn("Функция window.handleCopyClick не найдена. Слушатель для кнопки копирования не будет (пере)назначен здесь.");
        }

    } else {
        // Этого не должно происходить, если HTML вставлен правильно
        console.warn("Кнопка копирования #copy-text-button не найдена после обновления innerHTML в displaySongDetails.");
    }
} // Конец функции displaySongDetails

/** Обновление текста песни при смене тональности в keySelect */
function updateTransposedLyrics() {
    if (!keySelect || !songContent) return;

    const songId = keySelect.dataset.songId;
    const newKey = keySelect.value;
    
    if (!songId) {
        return; // Нет ID песни - нечего транспонировать
    }

    const songData = state.allSongs.find(s => s.id === songId);

    if (!songData) {
        console.error("updateTransposedLyrics: Не найдены данные песни для транспонирования в allSongs.", songId);
        return;
    }

    const originalKey = songData['Оригинальная тональность'];
    const originalLyrics = songData['Текст и аккорды'] || '';
    const title = songData.name || 'Без названия';

    const preElement = songContent.querySelector('pre');
    const h2Element = songContent.querySelector('h2');

    if (!preElement || !h2Element) {
        console.error("updateTransposedLyrics: Элементы H2 или PRE не найдены внутри songContent.");
        return;
    }

    // --- НАЧАЛО ИСПРАВЛЕНИЯ ---
    // 0. Обрабатываем пробелы ПЕРЕД транспонированием
    const processedLyrics = processLyrics(originalLyrics);

    // 1. Вычисляем транспозицию
    const transposition = getTransposition(originalKey, newKey);

    // 2. Транспонируем обработанный текст (processedLyrics)
    const transposedLyrics = transposeLyrics(processedLyrics, transposition);

    // 3. Выделяем структуру
    const structureHighlightedLyrics = highlightStructure(transposedLyrics);

     // 4. Выделяем аккорды
    const finalHighlightedLyrics = highlightChords(structureHighlightedLyrics);
    // --- КОНЕЦ ИСПРАВЛЕНИЯ ---


    // Обновляем текст в <pre>
    preElement.innerHTML = finalHighlightedLyrics; // Используем finalHighlightedLyrics
    // Обновляем заголовок
    h2Element.textContent = `${title} — ${newKey}`;

    // Применяем текущий размер шрифта к обновленному <pre>
    updateFontSize();

    // Применяем класс скрытия аккордов, если нужно
    if (songContent) {
        songContent.classList.toggle('chords-hidden', !state.areChordsVisible);
    }
} // Конец функции updateTransposedLyrics


/** Загрузка песен в select#song-select для выбранной категории */
function loadSheetSongs() {
    if (!sheetSelect || !songSelect) {
        console.error("loadSheetSongs: sheetSelect или songSelect не найдены.");
        return;
    }
    const sheetName = sheetSelect.value; // value теперь - само имя категории

    // Сброс и блокировка songSelect, если категория не выбрана
    if (!sheetName) {
        songSelect.innerHTML = '<option value="">-- Сначала выберите категорию --</option>';
        songSelect.disabled = true;
        displaySongDetails(null); // Сбрасываем отображение песни
        return;
    }

    songSelect.innerHTML = '<option value="">-- Выберите песню --</option>';
    songSelect.disabled = true;

    const songs = state.songsBySheet[sheetName];

    if (songs && songs.length > 0) {
        // Песни в `songsBySheet` уже отсортированы по имени
        songs.forEach(song => {
            const option = document.createElement('option');
            option.value = song.id; // Используем ID документа Firestore
            option.textContent = song.name;
            songSelect.appendChild(option);
        });
        songSelect.disabled = false;
    } else {
        songSelect.innerHTML = '<option value="">-- Нет песен в категории --</option>';
        songSelect.disabled = true;
    }

    displaySongDetails(null);
}

/** Обновление размера шрифта текста песни */
function updateFontSize() {
    const lyricsElement = songContent?.querySelector('pre');
    if (lyricsElement) {
        lyricsElement.style.fontSize = `${state.currentFontSize}px`;
        // Можно сохранить в localStorage, если нужно запоминать размер шрифта
        // localStorage.setItem('preferredFontSize', state.currentFontSize);
    }
}

/** Сброс размера шрифта к значению по умолчанию */
// function resetFontSize() {
//     state.currentFontSize = DEFAULT_FONT_SIZE;
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
        state.favorites = JSON.parse(localStorage.getItem('favorites')) || [];
    } catch (e) {
        console.error("Ошибка парсинга избранного из localStorage:", e);
        state.favorites = [];
        localStorage.removeItem('favorites');
    }

    if (state.favorites.length === 0) {
        container.innerHTML = '<div class="empty-message">Нет избранных песен</div>';
        return;
    }

    // Сортировка избранного по имени песни
    state.favorites.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    state.favorites.forEach(fav => {
        // Проверяем валидность записи в избранном
        if (!fav || !fav.name || !fav.songId || !fav.key) {
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

            const songDataFromCache = state.allSongs.find(s => s.id === fav.songId);
            if (!songDataFromCache) {
                alert(`Данные для песни "${fav.name}" не найдены в кэше. Возможно, она была удалена. Удалите ее из избранного.`);
                return;
            }

            if(sheetSelect && songDataFromCache.sheet) sheetSelect.value = songDataFromCache.sheet;
            loadSheetSongs(); // Перезагружаем список песен листа
            if(songSelect) songSelect.value = fav.songId; // Выбираем песню
            // Отображаем детали с ключом из избранного
            displaySongDetails(songDataFromCache, fav.key);

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
    state.favorites = state.favorites.filter(item => {
        const match = item.songId === favToRemove.songId;
        if (match) found = true;
        return !match; // Оставляем элемент, если он НЕ совпадает
    });

    if (found) {
        try {
            localStorage.setItem('favorites', JSON.stringify(state.favorites));
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
            state.favorites = JSON.parse(localStorage.getItem('favorites')) || [];
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
        loadSheetSongs(); // Загрузка песен и сброс отображения
    });

    // Выбор песни
    if(songSelect) songSelect.addEventListener('change', () => {
        const songId = songSelect.value;
        console.log(`Song selected: ID ${songId}`);
        if (!songId) {
            displaySongDetails(null); // Сброс, если ничего не выбрано
            return;
        }
        const songData = state.allSongs.find(s => s.id === songId);
        if (!songData) {
            console.error(`Песня с ID ${songId} не найдена в allSongs.`);
            displaySongDetails(null);
            return;
        }
        displaySongDetails(songData); // Отображаем выбранную
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
        state.currentFontSize = Math.min(state.currentFontSize + 2, 30); // Ограничение максимального размера
        updateFontSize();
    });
    if(zoomOutButton) zoomOutButton.addEventListener('click', () => {
        state.currentFontSize = Math.max(MIN_FONT_SIZE, state.currentFontSize - 2); // Используем MIN_FONT_SIZE
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


// --- Слушатели для кнопок вида репертуара (ДОБАВЛЕНО) ---
    const repertoireViewButtons = [repertoireViewKeyBtn, repertoireViewSheetBtn, repertoireViewAllBtn];

    repertoireViewButtons.forEach(button => {
        if (button) {
            button.addEventListener('click', () => {
                const newMode = button.id.split('-').pop(); // Получаем 'key', 'sheet' или 'all' из ID кнопки

                 // Преобразуем 'all' в 'allAlphabetical' для соответствия состоянию
                 const targetMode = (newMode === 'all') ? 'allAlphabetical' : `by${newMode.charAt(0).toUpperCase() + newMode.slice(1)}`; // 'byKey' или 'bySheet'

                if (targetMode === state.currentRepertoireViewMode) {
                    console.log(`Режим репертуара уже ${targetMode}, ничего не делаем.`);
                    return; // Ничего не делаем, если режим уже выбран
                }

                console.log(`Смена режима репертуара на: ${targetMode}`);
                state.setCurrentRepertoireViewMode(targetMode); // Обновляем состояние

                // Обновляем активную кнопку
                repertoireViewButtons.forEach(btn => {
                    if(btn) btn.classList.remove('active');
                });
                button.classList.add('active');

                // Перерисовываем список репертуара с ТЕКУЩИМИ данными, но в НОВОМ режиме
                renderRepertoire();
            });
        } else {
             console.warn(`Одна из кнопок вида репертуара не найдена (ID мог измениться?).`);
        }
    });
    // --- Конец слушателей для кнопок вида репертуара ---



// Переключение видимости аккордов
if (toggleChordsButton && songContent && songSelect) { // Добавили songSelect в проверку
    const iconGuitar = '<i class="fas fa-guitar"></i>';
    const iconMusic = '<i class="fas fa-music"></i>';
    const textShow = '<span class="button-text">Аккорды</span>'; // Текст "Показать"
    const textHide = '<span class="button-text">Аккорды</span>'; // Текст "Скрыть" (одинаковый, меняем иконку)

    // Объявляем функцию обновления кнопки в области видимости setupEventListeners
    const updateToggleButton = () => {
        if (!toggleChordsButton) return; // Доп. проверка
        const currentIcon = state.areChordsVisible ? iconGuitar : iconMusic;
        const currentText = state.areChordsVisible ? textHide : textShow;
        const currentTitle = state.areChordsVisible ? 'Скрыть аккорды' : 'Показать аккорды';

        toggleChordsButton.innerHTML = currentIcon + (isMobileView() ? '' : currentText);
        toggleChordsButton.title = currentTitle;
        // Блокируем, если песня не выбрана в songSelect
        toggleChordsButton.disabled = !songSelect || songSelect.value === "";
    };
    // Сохраняем ссылку на функцию, чтобы использовать ее в displaySongDetails
    window.updateToggleButton = updateToggleButton;


    toggleChordsButton.addEventListener('click', () => {
        if (!songSelect || songSelect.value === "") return; // Не делаем ничего, если песня не выбрана

        state.setAreChordsVisible(!state.areChordsVisible); // Инвертируем состояние
        songContent.classList.toggle('chords-hidden', !state.areChordsVisible); // Добавляем/убираем класс
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
        if (!state.currentSetlistId || !songDocId) {
            console.error("Не найден ID сет-листа или песни для заметки.");
            return;
        }

        // Находим данные песни в текущем массиве (чтобы взять заметку)
        const songData = state.currentSetlistSongs.find(song => song.id === songDocId);
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

        if (!state.currentSetlistId || !songDocId) {
            alert("Ошибка: Не удалось определить сет-лист или песню для сохранения заметки.");
            return;
        }

        saveNoteButton.disabled = true; saveNoteButton.textContent = 'Сохранение...';

        try {
            const songDocRef = doc(db, "setlists", state.currentSetlistId, "songs", songDocId);
            await updateDoc(songDocRef, {
                notes: newNoteText // Обновляем только поле notes
            });
            console.log(`Заметка для песни ${songDocId} в сет-листе ${state.currentSetlistId} сохранена.`);
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
            if (!songSelect || !keySelect) return;
            const songId = songSelect.value;
            const selectedKey = keySelect.value;

            if (!songId) {
                alert("Пожалуйста, сначала выберите песню."); return;
            }
            const songData = state.allSongs.find(s => s.id === songId);
            if (!songData) {
                alert("Не найдены данные для выбранной песни."); return;
            }

            const song = {
                songId: songId, // Сохраняем ID из Firestore
                name: songData.name,
                key: selectedKey
            };

            // Проверка на существование по songId
            const existingFavIndex = state.favorites.findIndex(f => f.songId === song.songId);

            if (existingFavIndex === -1) {
                state.favorites.push(song);
                try {
                    localStorage.setItem('favorites', JSON.stringify(state.favorites));
                    if (myListPanel?.classList.contains('open') && favoritesList) {
                        loadFavorites(favoritesList);
                    }
                    alert(`"${song.name}" (${song.key}) добавлена в 'Мой список'.`);
                } catch (e) {
                    console.error("Ошибка сохранения избранного:", e);
                    alert("Не удалось сохранить песню в избранное.");
                    state.favorites.pop();
                }
            } else {
                // Песня уже есть
                if (state.favorites[existingFavIndex].key !== song.key) {
                    if (confirm(`Песня "${song.name}" уже есть в 'Моем списке' с тональностью ${state.favorites[existingFavIndex].key}. Обновить на ${song.key}?`)) {
                        state.favorites[existingFavIndex].key = song.key; // Обновляем ключ
                        try {
                            localStorage.setItem('favorites', JSON.stringify(state.favorites));
                            if (myListPanel?.classList.contains('open') && favoritesList) {
                                loadFavorites(favoritesList);
                            }
                            alert(`Тональность песни "${song.name}" в 'Моем списке' обновлена на ${song.key}.`);
                        } catch (e) {
                            console.error("Ошибка обновления ключа в избранном:", e);
                            alert("Не удалось обновить тональность в избранном.");
                            // Можно вернуть старый ключ при ошибке
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
        state.setCurrentVocalistId(e.target.value);
        const selectedOption = e.target.options[e.target.selectedIndex];
        state.setCurrentVocalistName(selectedOption.value ? selectedOption.text : null); // Имя только если выбран не пустой option
        console.log(`Vocalist selected: ${state.currentVocalistName || 'none'} (ID: ${state.currentVocalistId || 'none'})`);
        loadRepertoire(state.currentVocalistId); // Загрузка репертуара для выбранного
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
            selectSetlist(state.currentSetlistId, state.currentSetlistName);
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
             if (state.currentVocalistId) {
                loadRepertoire(state.currentVocalistId);
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
             console.log("Клик по кнопке 'Презентация' для сет-листа ID:", state.currentSetlistId);
             if (state.currentSetlistId && state.currentSetlistSongs && state.currentSetlistSongs.length > 0) {
                closeAllSidePanels();
                 showPresentationView(state.currentSetlistSongs);
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
            state.setPresentationSongs([]);
            state.setCurrentPresentationIndex(0);
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
               loadAllSongsFromFirestore(), // Загрузка всех песен из Firestore
               loadVocalists(),
               loadAudioFile() // Предзагрузка метронома
         ]);
         console.log("Songs, Vocalists, Audio pre-loaded.");

         // Загрузка песен для первой категории (если она есть) не требуется,
         // т.к. loadAllSongsFromFirestore уже заполнил select, а пользователь выберет сам.
         loadSheetSongs(); // Вызовем для инициализации songSelect в состояние "-- Сначала выберите категорию --"
         

         // Загрузка списков (вызываем после загрузки данных песен)
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
