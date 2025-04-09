// =====================================================================
// Agape Worship App - script.js (Реорганизованная версия)
// =====================================================================

// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
    getFirestore, collection, addDoc, query,
    onSnapshot, deleteDoc, setDoc, doc,
    orderBy, getDocs, where // serverTimestamp убран, т.к. не используется
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// --- CONFIGURATION ---
// Firebase - ВАЖНО: В реальном приложении эти данные лучше получать с сервера или из переменных окружения
const firebaseConfig = {
    apiKey: "AIzaSyBlkjVQFtFpMRFexAi6nBqEkIfjFlU5cDo",
    authDomain: "song-archive-389a6.firebaseapp.com",
    projectId: "song-archive-389a6",
    storageBucket: "song-archive-389a6.firebasestorage.app",
    messagingSenderId: "619735277668",
    appId: "1:619735277668:web:51d2684bd8d4444eaf3f71",
    measurementId: "G-Z6QYH5YD2E"
};

// Google Sheets - ВАЖНО: API_KEY очень уязвим в клиентском коде!
const API_KEY = 'AIzaSyDO2gwifAnZzC3ooJ0A_4vAD76iYakwzlk';
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
const MAX_SHARED_SONGS = 8;

// --- FIREBASE INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const sharedListCollection = collection(db, "sharedList"); // Reference to the shared list collection

// --- GLOBAL STATE ---
let cachedData = {}; // Кэш данных из Google Sheets ({ sheetName: [rows...] })
let favorites = JSON.parse(localStorage.getItem('favorites')) || []; // Избранные песни
let currentVocalistId = null; // ID выбранного вокалиста
let currentVocalistName = null; // Имя выбранного вокалиста
let allSheetsData = []; // Данные всех листов для поиска
let searchIndex = []; // Индекс для поиска (пока не используется эффективно)
let currentFontSize = DEFAULT_FONT_SIZE; // Текущий размер шрифта

// Metronome State
let audioContext;
let audioBuffer;
let metronomeInterval = null;
let isMetronomeActive = false;
let currentBeat = 0;

// --- DOM ELEMENT REFERENCES (Исправлено) ---
// Main Controls
const sheetSelect = document.getElementById('sheet-select');
const songSelect = document.getElementById('song-select');
const keySelect = document.getElementById('key-select');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const loadingIndicator = document.getElementById('loading-indicator');
const vocalistSelect = document.getElementById('vocalist-select');

// Song Display Area
const songContent = document.getElementById('song-content');

// Action Buttons
const favoriteButton = document.getElementById('favorite-button');
const addToListButton = document.getElementById('add-to-list-button');
const addToRepertoireButton = document.getElementById('add-to-repertoire-button');
const splitTextButton = document.getElementById('split-text-button');

// Panel Toggle Buttons
const toggleFavoritesButton = document.getElementById('toggle-favorites'); // Кнопка Списки (слева)
const toggleRepertoireButton = document.getElementById('toggle-repertoire'); // Кнопка Репертуар (справа)

// Favorites Panel ("Lists") Elements
const favoritesPanel = document.getElementById('favorites-panel');       // Сама панель Списки (слева)
const favoritesList = document.getElementById('favorites-list');
const sharedSongsList = document.getElementById('shared-songs-list');

// Repertoire Panel Elements
const repertoirePanel = document.getElementById('repertoire-panel');         // Сама панель Репертуар (справа)
const repertoirePanelVocalistName = document.getElementById('repertoire-panel-vocalist-name');
const repertoirePanelList = document.getElementById('repertoire-panel-list');
const repertoirePanelTitle = document.getElementById('repertoire-panel-title'); // Можно удалить, если не используется

// Footer Controls
const bpmDisplay = document.getElementById('bpm-display');
const holychordsButton = document.getElementById('holychords-button');
const timeSignatureSelect = document.getElementById('time-signature');
const metronomeButton = document.getElementById('metronome-button');
const zoomInButton = document.getElementById('zoom-in');
const zoomOutButton = document.getElementById('zoom-out');

// YouTube Player
const playerContainer = document.getElementById('youtube-player-container');
const playerSection = document.getElementById('youtube-player-section');



// --- API FUNCTIONS (Sheets, Firestore) ---

/** Загрузка данных с одного листа Google Sheet (с кэшированием) */
async function fetchSheetData(sheetName) {
    if (cachedData[sheetName]) return cachedData[sheetName];
    if (!SHEETS[sheetName]) {
        console.error(`Invalid sheet name provided: ${sheetName}`);
        return [];
    }
    loadingIndicator.style.display = 'block';
    try {
        const range = `${SHEETS[sheetName]}!A2:F`; // Загружаем A-F
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        cachedData[sheetName] = data.values || [];
        return cachedData[sheetName];
    } catch (error) {
        console.error('Ошибка загрузки данных из Google Sheets:', error);
        alert(`Не удалось загрузить данные листа "${sheetName}". Проверьте консоль.`);
        return [];
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/** Загрузка данных со ВСЕХ листов (для поиска и инициализации) */
async function loadAllSheetsData() {
    loadingIndicator.style.display = 'block';
    allSheetsData = []; // Очищаем перед загрузкой
    try {
        const sheetNames = Object.keys(SHEETS); // Получаем имена листов из конфига
        const sheetPromises = sheetNames.map(name => fetchSheetData(name)); // Создаем промисы
        const results = await Promise.all(sheetPromises); // Загружаем параллельно

        // Сохраняем данные в allSheetsData
        allSheetsData = results.map((data, index) => ({
            sheetName: sheetNames[index], // Используем имя из sheetNames
            data: data
        }));
        console.log("All sheets data loaded.");
        //createSearchIndex(); // Создаем индекс (если он будет использоваться)
    } catch (error) {
        console.error('Ошибка загрузки данных со всех листов:', error);
        alert("Произошла ошибка при начальной загрузке данных песен.");
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/** Загрузка списка вокалистов в dropdown */
async function loadVocalists() {
    if (!vocalistSelect) return;
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
                option.textContent = vocalist.name || doc.id;
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

/** Загрузка и отображение общего списка песен (Firestore) */
function loadSharedList(container = sharedSongsList) {
    if (!container) {
        console.error("Контейнер для общего списка песен не найден.");
        return;
    }
    container.innerHTML = '<div>Загрузка общего списка...</div>'; // Начальное состояние

    const q = query(sharedListCollection, orderBy("timestamp", "asc")); // Сортировка по времени добавления

    // Устанавливаем слушатель (onSnapshot)
    const unsubscribe = onSnapshot(q, (snapshot) => {
        container.innerHTML = ''; // Очищаем перед обновлением
        if (snapshot.empty) {
            container.innerHTML = '<div class="empty-message">Нет песен в общем списке</div>';
            return;
        }
        snapshot.docs.forEach((doc) => {
            const song = doc.data();
            const docId = doc.id;
            // Создаем элемент списка (listItem)
            const listItem = document.createElement('div');
            listItem.className = 'shared-item';
            // Имя песни и тональность
            const songNameElement = document.createElement('span');
            songNameElement.textContent = `${song.name} — ${song.key}`;
            songNameElement.className = 'song-name';
            songNameElement.addEventListener('click', async () => {
                // Логика клика по песне в общем списке... (оставлена как есть)
                 const sheetNameValue = Object.keys(SHEETS).find(key => SHEETS[key] === song.sheet);
                 if(sheetNameValue) sheetSelect.value = sheetNameValue;
                 if (!cachedData[song.sheet]) await fetchSheetData(song.sheet);
                 await loadSheetSongs();
                 songSelect.value = song.index;
                 displaySongDetails(cachedData[song.sheet]?.[song.index], song.index, song.key);
                 if (favoritesPanel) favoritesPanel.classList.remove('open');
            });
            // Кнопка удаления
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '❌';
            deleteButton.className = 'delete-button';
            deleteButton.addEventListener('click', () => {
                if (confirm(`Удалить песню "${song.name}" из общего списка?`)) {
                    deleteFromSharedList(docId);
                }
            });

            listItem.appendChild(songNameElement);
            listItem.appendChild(deleteButton);
            container.appendChild(listItem);
        });
    }, (error) => {
        console.error("Ошибка при получении данных общего списка:", error);
        container.innerHTML = '<div class="empty-message">Не удалось загрузить общий список.</div>';
    });
    // Примечание: unsubscribe можно сохранить, если нужно будет отключать слушатель
}

/** Добавление песни в общий список (Firestore) */
async function addToSharedList(songData) {
    const sheetName = SHEETS[sheetSelect.value];
    const songIndex = songSelect.value;

    if (!sheetName || !songIndex || !songData || !songData[0]) {
        console.error("addToSharedList: Данные для добавления песни отсутствуют или некорректны.");
        alert("Не удалось добавить песню: недостаточно данных. Выберите песню.");
        return;
    }
    const song = {
        name: songData[0],
        sheet: sheetName,
        index: songIndex,
        key: keySelect.value,
        timestamp: new Date().toISOString() // Используем ISO строку для простоты
    };
    console.log("addToSharedList: Попытка добавить песню:", song);

    try {
        // Проверка лимита
        const countSnapshot = await getDocs(query(sharedListCollection));
        console.log(`addToSharedList: Текущий размер списка: ${countSnapshot.size}`);
        if (countSnapshot.size >= MAX_SHARED_SONGS) {
            alert(`В общем списке уже ${countSnapshot.size} песен. Достигнут лимит (${MAX_SHARED_SONGS}).`);
            return;
        }
        // Проверка дубликатов
        const duplicateQuery = query(sharedListCollection, where("sheet", "==", song.sheet), where("index", "==", song.index));
        const duplicateSnapshot = await getDocs(duplicateQuery);
        console.log(`addToSharedList: Найдено дубликатов: ${duplicateSnapshot.size}`);
        if (!duplicateSnapshot.empty) {
            alert(`Песня "${song.name}" уже есть в общем списке.`);
            return;
        }
        // Добавление
        await addDoc(sharedListCollection, song);
        console.log(`addToSharedList: Песня "${song.name}" успешно добавлена.`);
        alert(`Песня "${song.name}" добавлена в общий список.`);
    } catch (error) {
        console.error("addToSharedList: Ошибка при проверке или добавлении:", error);
        alert("Произошла ошибка при добавлении песни в общий список.");
    }
}

/** Удаление песни из общего списка (Firestore) */
async function deleteFromSharedList(docId) {
    console.log(`Попытка удалить из общего списка: ${docId}`);
    if (!docId) return;
    try {
        await deleteDoc(doc(db, "sharedList", docId));
        console.log("Песня удалена из общего списка.");
        // Список обновится через onSnapshot, но можно вызвать loadGroupPanel для немедленной реакции, если нужно
        // loadGroupPanel(); // Можно раскомментировать, если обновление onSnapshot медленное
    } catch (error) {
        console.error("Ошибка при удалении песни из общего списка:", error);
        alert("Не удалось удалить песню из общего списка.");
    }
}

// --- Функция загрузки и ДВОЙНОЙ ГРУППИРОВКИ репертуара вокалиста ---
function loadRepertoire(vocalistId) {
    // Используем новые ID элементов панели репертуара
    const listContainer = repertoirePanelList; // Должна быть глобальная переменная или получена здесь
    const sectionContainer = repertoirePanel; // Должна быть глобальная переменная или получена здесь
    const nameSpan = repertoirePanelVocalistName; // Должна быть глобальная переменная или получена здесь

    if (!listContainer || !sectionContainer || !nameSpan) {
         console.error("Не найдены UI элементы для панели репертуара.");
         // Убедитесь, что переменные repertoirePanelList, repertoirePanel, repertoirePanelVocalistName
         // объявлены глобально или передаются в функцию, если они не найдены.
         // Проверьте ID элементов в HTML и в объявлении переменных JS.
         return;
    }

    listContainer.innerHTML = ''; // Очищаем

    if (!vocalistId) {
        nameSpan.textContent = '-- Выберите вокалиста --';
        listContainer.innerHTML = '<div class="empty-message">Выберите вокалиста для просмотра репертуара.</div>';
        sectionContainer.style.display = 'none'; // Скрываем секцию, если вокалист не выбран
        return;
    }

    // Показываем панель (если она была скрыта) и имя вокалиста
    sectionContainer.style.display = 'block'; // Показываем секцию
    nameSpan.textContent = currentVocalistName || vocalistId; // Обновляем имя в заголовке панели
    listContainer.innerHTML = '<div>Загрузка репертуара...</div>';

    const repertoireColRef = collection(db, "vocalists", vocalistId, "repertoire");
    const q = query(repertoireColRef); // Запрос без сортировки здесь

    console.log(`loadRepertoire: Установка слушателя для ${vocalistId} (с группировкой)`);

    const unsubscribe = onSnapshot(q, (snapshot) => {
        // Перестраховка: получаем контейнер снова на случай, если DOM изменился
        const currentListContainer = document.getElementById('repertoire-panel-list');
        if (!currentListContainer) {
            console.error("Контейнер #repertoire-panel-list исчез во время работы onSnapshot!");
            return;
        }
        currentListContainer.innerHTML = ''; // Очищаем перед отрисовкой

        if (snapshot.empty) {
            currentListContainer.innerHTML = '<div class="empty-message">Репертуар пуст.</div>';
            return;
        }

        // --- ЛОГИКА ГРУППИРОВКИ ---
        const groupedByKeys = {};
        snapshot.docs.forEach((doc) => {
            const song = doc.data();
            const key = song.preferredKey || "N/A";
            const sheet = song.sheet || "Unknown Sheet";
            if (!groupedByKeys[key]) groupedByKeys[key] = {};
            if (!groupedByKeys[key][sheet]) groupedByKeys[key][sheet] = [];
            groupedByKeys[key][sheet].push({ ...song, repertoireDocId: doc.id });
        });
        // --- КОНЕЦ ГРУППИРОВКИ ---

        // --- СОРТИРОВКА И ВЫВОД ---
        const sortedKeys = Object.keys(groupedByKeys).sort((a, b) => {
            const indexA = chords.indexOf(a);
            const indexB = chords.indexOf(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        sortedKeys.forEach(key => {
            const keyHeading = document.createElement('div');
            keyHeading.className = 'repertoire-key-heading';
            keyHeading.textContent = `Тональность: ${key}`;
            currentListContainer.appendChild(keyHeading);

            const sheetsInKey = groupedByKeys[key];
            const sortedSheets = Object.keys(sheetsInKey).sort((a, b) => a.localeCompare(b));

            sortedSheets.forEach(sheet => {
                const sheetHeading = document.createElement('div');
                sheetHeading.className = 'repertoire-sheet-heading';
                const shortSheetName = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === sheet) || sheet;
                sheetHeading.textContent = shortSheetName;
                currentListContainer.appendChild(sheetHeading);

                const songsInSheet = sheetsInKey[sheet];
                songsInSheet.sort((a, b) => a.name.localeCompare(b.name));

                songsInSheet.forEach(songWithId => {
                    const song = songWithId;
                    const repertoireDocId = song.repertoireDocId;
                    const listItem = document.createElement('div');
                    listItem.className = 'repertoire-item';

                    const songInfo = document.createElement('span');
                    songInfo.className = 'song-name';
                    songInfo.textContent = song.name;
                    listItem.appendChild(songInfo);

                    const removeBtn = document.createElement('button');
                 // Используем иконку Font Awesome вместо текста
removeBtn.innerHTML = '<i class="fas fa-times"></i>'; // Иконка крестика
                    removeBtn.className = 'remove-button';
                    removeBtn.title = 'Удалить из репертуара';
                    removeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        removeFromRepertoire(vocalistId, repertoireDocId);
                    });
                    listItem.appendChild(removeBtn);

                    listItem.addEventListener('click', async () => {
                         if (!cachedData[song.sheet]?.[song.index]) {
                             await fetchSheetData(song.sheet);
                             if (!cachedData[song.sheet]?.[song.index]) {
                                 alert('Не удалось найти исходные данные песни.'); return;
                             }
                         }
                         const originalSongData = cachedData[song.sheet][song.index];
                         const sheetNameValue = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === song.sheet);
                         if(sheetNameValue) sheetSelect.value = sheetNameValue;
                         await loadSheetSongs();
                         songSelect.value = song.index;
                         displaySongDetails(originalSongData, song.index, song.preferredKey);
                         if (repertoirePanel) repertoirePanel.classList.remove('open'); // Закрываем панель репертуара
                    });
                    currentListContainer.appendChild(listItem);
                }); // Конец песен
            }); // Конец листов
        }); // Конец тональностей

    }, (error) => { // Обработчик ошибок onSnapshot
        const currentListContainer = document.getElementById('repertoire-panel-list');
        if (currentListContainer) {
             currentListContainer.innerHTML = '<div class="empty-message">Ошибка загрузки репертуара.</div>';
        }
        console.error(`Ошибка при прослушивании репертуара для ${vocalistId}:`, error);
    });

    // Здесь можно сохранить функцию отписки, если она понадобится
    // Пример: sectionContainer.dataset.unsubscribe = unsubscribe;
} // <--- ВОТ ЗДЕСЬ ЗАКАНЧИВАЕТСЯ ФУНКЦИЯ loadRepertoire

/** Добавление/Обновление песни в репертуаре вокалиста (Firestore) */
async function addToRepertoire() {
    console.log("Вызвана функция addToRepertoire");
    if (!currentVocalistId) {
        alert("Пожалуйста, сначала выберите вокалиста из списка."); return;
    }
    const sheetName = SHEETS[sheetSelect.value];
    const songIndex = songSelect.value;
    if (!sheetName || !songIndex || songIndex === "" || !cachedData[sheetName] || !cachedData[sheetName][songIndex]) {
         alert("Пожалуйста, сначала выберите песню для добавления в репертуар."); return;
    }
    const songData = cachedData[sheetName][songIndex];
    const songName = songData[0];
    const preferredKey = keySelect.value;
    console.log(`Добавляем в репертуар для ${currentVocalistName} (ID: ${currentVocalistId}): Песня "${songName}", Тональность: ${preferredKey}`);

    const repertoireDocId = `${sheetName}_${songIndex}`; // Кастомный ID
    const dataToSave = {
        sheet: sheetName,
        index: songIndex,
        name: songName,
        preferredKey: preferredKey
        // addedAt: serverTimestamp() // Убрано по желанию
    };
    console.log("Данные для сохранения:", dataToSave);

    try {
        await setDoc(doc(db, "vocalists", currentVocalistId, "repertoire", repertoireDocId), dataToSave);
        console.log(`Песня "${songName}" успешно добавлена/обновлена в репертуаре ${currentVocalistName}.`);
        alert(`Песня "${songName}" (${preferredKey}) добавлена/обновлена в репертуаре ${currentVocalistName}.`);
    } catch (error) {
        console.error("Ошибка при добавлении/обновлении песни в репертуаре:", error);
        alert("Произошла ошибка при сохранении песни в репертуар.");
    }
}

/** Удаление песни из репертуара вокалиста (Firestore) */
async function removeFromRepertoire(vocalistId, repertoireDocId) {
     console.log(`Попытка удалить песню ${repertoireDocId} из репертуара ${vocalistId}`);
     if (!vocalistId || !repertoireDocId) {
         console.error("removeFromRepertoire: Не переданы ID."); alert("Ошибка удаления."); return;
     }
     const vocalistDisplayName = currentVocalistName || vocalistId;
     if (!confirm(`Удалить эту песню из репертуара ${vocalistDisplayName}?`)) {
         return; // Отмена
     }
     try {
         await deleteDoc(doc(db, "vocalists", vocalistId, "repertoire", repertoireDocId));
         console.log(`Песня ${repertoireDocId} успешно удалена.`);
         alert("Песня удалена из репертуара.");
     } catch (error) {
         console.error("Ошибка при удалении песни из репертуара:", error);
         alert("Произошла ошибка при удалении песни.");
     }
}

// --- CORE LOGIC / UTILITIES ---

/** Расчет смещения для транспонирования */
function getTransposition(originalKey, newKey) {
    const originalIndex = chords.indexOf(originalKey);
    const newIndex = chords.indexOf(newKey);
    if (originalIndex === -1 || newIndex === -1) {
        console.warn(`Invalid key(s) for transposition: ${originalKey} -> ${newKey}`);
        return 0;
    }
    return newIndex - originalIndex;
}

/** Транспонирование одного аккорда */
function transposeChord(chord, transposition) {
    let chordType = '';
    let baseChord = chord;
    let bassNote = '';
    const suffixes = ['maj7', 'm7', '7', 'm', 'dim', 'aug', 'sus2', 'sus4', 'add9', 'dim7', 'aug7', 'sus']; // Длинные суффиксы первыми

    if (chord.includes('/')) {
        [baseChord, bassNote] = chord.split('/');
    }
    // Ищем самый длинный совпадающий суффикс
    for (let suffix of suffixes) {
        if (baseChord.endsWith(suffix)) {
            baseChord = baseChord.slice(0, -suffix.length);
            chordType = suffix;
            break;
        }
    }
    const currentIndex = chords.indexOf(baseChord);
    if (currentIndex === -1) return chord; // Неизвестный аккорд

    const newIndex = (currentIndex + transposition + chords.length) % chords.length;
    const transposedBaseChord = chords[newIndex] + chordType;

    if (bassNote) {
        const bassIndex = chords.indexOf(bassNote);
        if (bassIndex !== -1) {
            const newBassIndex = (bassIndex + transposition + chords.length) % chords.length;
            return `${transposedBaseChord}/${chords[newBassIndex]}`;
        } else {
            return `${transposedBaseChord}/${bassNote}`; // Бас-нота не найдена, оставляем как есть
        }
    }
    return transposedBaseChord;
}

/** Очистка аккорда от лишних пробелов */
function cleanChord(chord) {
    return chord.replace(/\s+/g, '');
}

/** Транспонирование всего текста с аккордами */
function transposeLyrics(lyrics, transposition) {
     if (transposition === 0) return lyrics; // Нет смысла транспонировать, если смещение 0
     // Регулярное выражение для поиска аккордов (включая сложные и с басом)
     // [A-H] - основная нота (включая H)
     // [#b]? - диез или бемоль (необязательно)
     // (?:maj7|m7|sus4|...) - необязательная группа суффиксов
     // (?:\/[A-H][#b]?)? - необязательная группа басовой ноты
     const chordRegex = /([A-H][#b]?(?:maj7|m7|7|m|dim|aug|sus4|sus2|add9|dim7|aug7|sus)?(?:\/[A-H][#b]?)?)/g;

     return lyrics.replace(chordRegex, (match) => {
         // Убираем пробелы только для транспонирования, чтобы не ломать форматирование
         return transposeChord(cleanChord(match), transposition);
     });
 }

/** Обработка строк текста для уменьшения пробелов */
// Функция для обработки строк с аккордами и уменьшения пробелов (ВОССТАНОВЛЕНА)
function processLyrics(lyrics) {
    if (!lyrics) return '';
    return lyrics.split('\n').map(line => {
        // Заменяем 2+ пробела на округленную половину их количества
        return line.replace(/ {2,}/g, match => ' '.repeat(Math.ceil(match.length / 2)));
    }).join('\n');
}

/** Выделение аккордов тегами span для стилизации */
function highlightChords(lyrics) {
    if (!lyrics) return '';
     // Используем то же регулярное выражение, что и в transposeLyrics
     const chordRegex = /([A-H][#b]?(?:maj7|m7|7|m|dim|aug|sus4|sus2|add9|dim7|aug7|sus)?(?:\/[A-H][#b]?)?)/g;
     return lyrics.replace(chordRegex, '<span class="chord">$1</span>');
 }

/** Поиск песен (текущая реализация, можно улучшить) */
async function searchSongs(query) {
    const lowerQuery = query.trim().toLowerCase();
    if (!lowerQuery) {
        searchResults.innerHTML = ''; return;
    }
    // Собираем все строки из кэша всех листов
    const allRows = Object.values(cachedData).flat(); // Простой способ собрать все строки
    // const allRows = allSheetsData.flatMap(sheet => sheet.data); // Альтернатива, если allSheetsData актуальна

    const matchingSongs = allRows.filter(row => {
        const name = row?.[0]?.trim().toLowerCase();
        return name && name.includes(lowerQuery);
    });

    searchResults.innerHTML = ''; // Очищаем
    if (matchingSongs.length === 0) {
        searchResults.innerHTML = '<div class="search-result">Ничего не найдено</div>'; return;
    }

    matchingSongs.forEach((song) => {
        const resultItem = document.createElement('div');
        resultItem.textContent = song[0];
        resultItem.className = 'search-result';
        resultItem.addEventListener('click', async () => {
            // Находим лист, к которому относится песня (нужно для выбора в select)
            let foundSheetName = null;
            let originalIndex = -1;
            // Ищем в кэше
            for (const sheetKey in SHEETS) {
                 const sheetNameFromMap = SHEETS[sheetKey];
                 if (cachedData[sheetNameFromMap]) {
                      originalIndex = cachedData[sheetNameFromMap].findIndex(row => row?.[0] === song[0]); // Находим индекс
                      if(originalIndex !== -1) {
                           foundSheetName = sheetKey; // Нашли имя для Select
                           break;
                      }
                 }
            }

            if (foundSheetName && originalIndex !== -1) {
                sheetSelect.value = foundSheetName;
                await loadSheetSongs(); // Загружаем песни для этого листа
                songSelect.value = originalIndex; // Выбираем песню по найденному индексу
                // Передаем полные данные и индекс
                 displaySongDetails(cachedData[SHEETS[foundSheetName]][originalIndex], originalIndex);
                 searchResults.innerHTML = ''; // Скрываем результаты
                 searchInput.value = song[0]; // Показываем полное имя в поиске
            } else {
                 console.error("Не удалось найти песню в кэше после поиска", song);
                 alert("Ошибка при выборе песни из поиска.");
            }
        });
        searchResults.appendChild(resultItem);
    });
}

/** Извлечение ID видео YouTube из URL */
function extractYouTubeVideoId(url) {
    if (!url) return null;
    let videoId = null;
    try {
        // Упрощенное регулярное выражение для большинства ссылок
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = url.match(regex);
        if (match && match[1]) {
            videoId = match[1];
        }
    } catch (e) {
        console.error("Error extracting YouTube video ID:", e);
        return null;
    }
    return videoId; // Вернет ID или null
}


// --- UI UPDATE FUNCTIONS ---

/** Отображение деталей песни (текст, ключ, BPM, плеер) */
function displaySongDetails(songData, index, key) {
    if (!playerContainer || !playerSection || !songContent) {
        console.error("Отсутствуют необходимые DOM элементы для displaySongDetails."); return;
    }
    if (!songData) {
        console.warn("Нет данных песни для отображения.");
        playerContainer.innerHTML = '';
        playerSection.style.display = 'none';
        songContent.innerHTML = '<h2>Выберите песню</h2><pre></pre>';
        // Сбросить BPM, Holychords и т.д.
        bpmDisplay.textContent = 'N/A';
        holychordsButton.style.display = 'none';
        holychordsButton.href = '#';
        keySelect.value = chords[0]; // Сброс на C
        keySelect.dataset.index = '';
        return;
    }

    // Получаем данные
    const currentKey = key || songData[2] || chords[0]; // Тек. ключ (переданный или из данных, или C)
    const bpm = songData[4] || 'N/A';
    const lyrics = songData[1] || '';
    const sourceUrl = songData[3] || '#';
    const songTitle = songData[0] || 'Без названия';
    const youtubeLink = songData[5]; // Ссылка YouTube

    // Обновляем BPM
    updateBPM(bpm); // Вызываем функцию обновления (если она влияет на метроном)
    bpmDisplay.textContent = bpm;

    // Обновляем Holychords
    if (sourceUrl && sourceUrl.trim() !== '' && sourceUrl.trim() !== '#') {
        holychordsButton.href = sourceUrl;
        holychordsButton.style.display = 'inline-block';
    } else {
        holychordsButton.href = '#';
        holychordsButton.style.display = 'none';
    }

// --- Обрабатываем и подсвечиваем текст ---
   const processedOriginalLyrics = processLyrics(lyrics); // <--- ВОССТАНОВИЛИ ВЫЗОВ
const highlightedOriginalLyrics = highlightChords(processedOriginalLyrics); // Используем обработанный текст

   // --- Обновляем ОСНОВНОЕ содержимое (Название + Текст) ---
songContent.innerHTML = `
    <h2>${songTitle} — <span class="math-inline">\{currentKey\}</h2\>
        <pre>${highlightedOriginalLyrics}</pre>
    `;

    // Устанавливаем селектор тональности и индекс для транспонирования
    keySelect.value = currentKey;
    keySelect.dataset.index = index; // Важно для updateTransposedLyrics

    // Применяем транспонирование, если нужно
    updateTransposedLyrics();

    // Обновляем YouTube плеер
    const videoId = extractYouTubeVideoId(youtubeLink);
    if (videoId) {
        console.log("Найден YouTube Video ID:", videoId);
        playerContainer.innerHTML = `
            <iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}?autoplay=0&modestbranding=1&rel=0"
                    frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen>
            </iframe>`;
        playerSection.style.display = 'block';
    } else {
        playerContainer.innerHTML = '';
        playerSection.style.display = 'none';
    }
}

/** Обновление текста песни при смене тональности в keySelect */
function updateTransposedLyrics() {
    const indexStr = keySelect.dataset.index; // Получаем индекс текущей песни из data-атрибута
    const newKey = keySelect.value; // Новая тональность из select

    if (indexStr === null || indexStr === undefined || indexStr === "") {
         console.warn("updateTransposedLyrics: Индекс песни не установлен.");
         return; // Нет индекса - нечего транспонировать
    }
    const index = parseInt(indexStr, 10); // Преобразуем в число, если нужно (но работаем со строкой)

    const sheetName = SHEETS[sheetSelect.value]; // Текущий выбранный лист
    if (!sheetName || !cachedData[sheetName] || !cachedData[sheetName][indexStr]) {
         console.error("updateTransposedLyrics: Не найдены данные песни для транспонирования.", sheetName, indexStr);
         return;
    }

    const songData = cachedData[sheetName][indexStr]; // Получаем оригинальные данные песни
    const originalKey = songData[2]; // Оригинальная тональность из данных
    const lyrics = songData[1] || ''; // Оригинальный текст

    // Находим элемент <pre> внутри songContent
    const preElement = songContent.querySelector('pre');
    const h2Element = songContent.querySelector('h2');
    if (!preElement || !h2Element) {
         console.error("updateTransposedLyrics: Элементы H2 или PRE не найдены внутри songContent.");
         return;
    }

    // Вычисляем транспозицию
    const transposition = getTransposition(originalKey, newKey);
    console.log(`Transposing from ${originalKey} to ${newKey}, shift: ${transposition}`);

    // Транспонируем оригинальный текст
    const transposedLyrics = transposeLyrics(lyrics, transposition);
    // Обрабатываем пробелы и подсвечиваем аккорды в транспонированном тексте
  const processedTransposedLyrics = processLyrics(transposedLyrics); // <--- ВОССТАНОВИЛИ ВЫЗОВ
    const highlightedTransposedLyrics = highlightChords(processedTransposedLyrics); // Используем обработанный текст


    // Обновляем текст в <pre>
    preElement.innerHTML = highlightedTransposedLyrics;
    // Обновляем тональность в заголовке H2
    h2Element.textContent = `${songData[0]} — ${newKey}`;
}


/** Загрузка песен в select#song-select для выбранного листа */
async function loadSheetSongs() {
    const sheetNameValue = SHEETS[sheetSelect.value];
    if (!sheetNameValue) {
        songSelect.innerHTML = '<option value="">-- Сначала выберите лист --</option>';
        songSelect.disabled = true;
        return;
    }
    // Получаем данные (из кэша или загружаем)
    const rows = await fetchSheetData(sheetNameValue); // Используем fetchSheetData для кэширования

    // Очищаем и заполняем songSelect
    songSelect.innerHTML = '<option value="">-- Выберите песню --</option>';
    if (rows && rows.length > 0) {
        rows.forEach((row, index) => {
            if (row && row[0]) { // Проверяем, что есть название
                const option = document.createElement('option');
                option.value = index; // Значение = индекс строки (число или строка?) -> СТРОКА!
                option.textContent = row[0];
                songSelect.appendChild(option);
            }
        });
        songSelect.disabled = false;
    } else {
        songSelect.innerHTML = '<option value="">-- Нет песен в листе --</option>';
        songSelect.disabled = true;
    }
}

/** Обновление размера шрифта текста песни */
function updateFontSize() {
    const lyricsElement = songContent.querySelector('pre');
    if (lyricsElement) {
        lyricsElement.style.fontSize = `${currentFontSize}px`;
    }
}

/** Сброс размера шрифта к значению по умолчанию */
function resetFontSize() {
    currentFontSize = DEFAULT_FONT_SIZE;
    updateFontSize();
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
        if (favoritesPanel.classList.contains('open') && favoritesList) {
             loadFavorites(favoritesList); // Перерисовываем список избранного
        }
        // loadGroupPanel(); // Убрали вызов полной перезагрузки панели
        alert("Песня удалена из 'Моего списка'."); // Добавим подтверждение
    } else {
        console.warn("Не удалось найти песню для удаления в массиве favorites.");
        alert("Не удалось удалить песню из 'Моего списка'.");
    }
}


function loadGroupPanel() {
    console.log("Загрузка панели 'Списки'");
    // Проверяем, открыта ли панель СПИСКОВ
    if (!favoritesPanel || !favoritesPanel.classList.contains('open')) {
        // console.log("Панель 'Списки' закрыта, загрузка не требуется.");
        return;
    }

    // Загружаем "Мой список" (Избранное)
    if(favoritesList) loadFavorites(favoritesList);

    // Загружаем "Общий список" (Firestore)
    if(sharedSongsList) loadSharedList(sharedSongsList);

    // Репертуар больше здесь НЕ загружаем
    // if(repertoireList) loadRepertoire(currentVocalistId);
}


// --- Настройка слушателей событий (дополнения) ---



// Слушатель для НОВОЙ кнопки "Репертуар" (#toggle-repertoire)
 if (toggleRepertoireButton && repertoirePanel) {
     toggleRepertoireButton.addEventListener('click', () => {
         console.log("--- КЛИК: Кнопка 'Репертуар' ---"); // <-- ДОБАВИТЬ ЛОГ
         console.log("Панель 'Репертуар' ДО:", repertoirePanel.classList.contains('open')); // <-- ДОБАВИТЬ ЛОГ
         const isOpen = repertoirePanel.classList.toggle('open');
         console.log("Панель 'Репертуар' ПОСЛЕ:", isOpen); // <-- ДОБАВИТЬ ЛОГ
         if (isOpen) {
              if (favoritesPanel && favoritesPanel.classList.contains('open')) {
                  favoritesPanel.classList.remove('open');
                  console.log("Панель 'Списки' принудительно закрыта.");
              }
              loadRepertoire(currentVocalistId);
         }
     });
     console.log("Слушатель для кнопки 'Репертуар' добавлен.");
 } else {
      console.error("Не найдены элементы для кнопки 'Репертуар'");
 }

 // В слушателе для vocalistSelect ничего менять не нужно,
 // он по-прежнему должен вызывать loadRepertoire(currentVocalistId),
 // чтобы данные в панели репертуара были актуальными, даже если она закрыта.

 // ВАЖНО: Убедитесь, что слушатели на toggleFavoritesButton и toggleRepertoireButton
 // добавляются только ОДИН РАЗ (например, внутри setupEventListeners или DOMContentLoaded).

 // --- Обновляем слушатель клика по песне в РЕПЕРТУАРЕ ---
 // Эта логика теперь находится внутри обновленной функции loadRepertoire.
 // Главное, чтобы там было закрытие ПРАВИЛЬНОЙ панели:
 // if (repertoirePanel) repertoirePanel.classList.remove('open'); // <-- Проверьте это в loadRepertoire

/** Обновление отображения BPM */
function updateBPM(newBPM) {
    bpmDisplay.textContent = newBPM || 'N/A'; // Отображаем N/A если BPM нет
    // Если метроном активен, перезапускаем его с новым BPM
    if (isMetronomeActive) {
        const bpmValue = parseInt(newBPM, 10);
        if (!isNaN(bpmValue) && bpmValue > 0) {
            toggleMetronome(bpmValue); // Переключаем (остановит и запустит с новым BPM)
            toggleMetronome(bpmValue); //
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

/** Воспроизведение одного щелчка метронома */
function playClick() {
    if (!audioContext || !audioBuffer) {
        console.error("Невозможно воспроизвести щелчок: AudioContext или аудио буфер не готовы.");
        // Попробовать загрузить снова? Или просто остановить метроном?
        if(isMetronomeActive) toggleMetronome(0); // Останавливаем
        return;
    }
    resumeAudioContext(); // Важно перед каждым воспроизведением

    const beatsPerMeasure = parseInt(timeSignatureSelect.value, 10) || 4; // Значение из select (4/4, 3/4 и т.д.)

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    const gainNode = audioContext.createGain();

    // Акцент на первую долю
    gainNode.gain.setValueAtTime(currentBeat % beatsPerMeasure === 0 ? 1.0 : 0.6, audioContext.currentTime);

    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    source.start(audioContext.currentTime);

    // Обновляем счетчик долей
    currentBeat = (currentBeat + 1) % beatsPerMeasure;
}

/** Включение/выключение метронома */
function toggleMetronome(bpm) {
    if (isMetronomeActive) {
        // Выключение
        clearInterval(metronomeInterval);
        metronomeInterval = null;
        isMetronomeActive = false;
        currentBeat = 0; // Сбрасываем счетчик долей
        if(metronomeButton) metronomeButton.textContent = '▶️ Включить метроном';
        console.log("Метроном выключен.");
    } else if (bpm > 0) {
        // Включение
        if (!audioContext || !audioBuffer) {
             console.warn("Метроном не может быть запущен: аудио не готово.");
             alert("Звук метронома еще не загружен, подождите.");
             // Попытка загрузить асинхронно и запустить позже? Проще попросить пользователя нажать еще раз.
             loadAudioFile(); // Запускаем загрузку на всякий случай
             return;
        }
        const intervalMilliseconds = 60000 / bpm;
        if (intervalMilliseconds <= 0 || !isFinite(intervalMilliseconds)) {
             console.error("Неверный интервал метронома:", intervalMilliseconds);
             return;
        }
        currentBeat = 0; // Начинаем с первой доли
        metronomeInterval = setInterval(playClick, intervalMilliseconds);
        isMetronomeActive = true;
        if(metronomeButton) metronomeButton.textContent = '⏹️ Выключить метроном';
        console.log(`Метроном включен: ${bpm} BPM`);
        playClick(); // Сразу играем первый удар
    }
}


// --- EVENT LISTENER SETUP ---

/** Инициализация всех слушателей событий */
function setupEventListeners() {
    console.log("Настройка слушателей событий...");

    // Выбор листа
    if (sheetSelect) {
        sheetSelect.addEventListener('change', async () => {
             console.log("Выбран лист:", sheetSelect.value);
             searchInput.value = ''; // Сбрасываем поиск
             searchResults.innerHTML = ''; // Очищаем результаты поиска
             await loadSheetSongs(); // Загружаем песни для листа
             // Сбрасываем отображение песни? Или отображаем первую? Пока сбрасываем.
             displaySongDetails(null); // Очищаем детали песни
        });
    }

    // Выбор песни
    if (songSelect) {
        songSelect.addEventListener('change', () => {
             const sheetName = SHEETS[sheetSelect.value];
             const songIndex = songSelect.value; // Индекс все еще строка
             console.log(`Выбрана песня: индекс ${songIndex} в листе ${sheetName}`);
             if (!sheetName || !songIndex || songIndex === "" || !cachedData[sheetName] || !cachedData[sheetName][songIndex]) {
                  displaySongDetails(null); // Очищаем, если что-то не так
                  return;
             }
             displaySongDetails(cachedData[sheetName][songIndex], songIndex); // Отображаем выбранную песню
        });
    }

    // Поиск песни
    if (searchInput) {
        // Используем 'input' для реакции на каждое изменение
        searchInput.addEventListener('input', () => searchSongs(searchInput.value));
        // Скрытие результатов поиска при потере фокуса (опционально)
         searchInput.addEventListener('blur', () => {
             // Небольшая задержка, чтобы успел сработать клик по результату
             setTimeout(() => {
                  if (searchResults) searchResults.innerHTML = '';
             }, 200);
         });
    }

    // Изменение тональности
    if (keySelect) {
        keySelect.addEventListener('change', updateTransposedLyrics);
    }

    // Масштабирование текста
    if (zoomInButton) zoomInButton.addEventListener('click', () => { currentFontSize += 2; updateFontSize(); });
    if (zoomOutButton) zoomOutButton.addEventListener('click', () => { if (currentFontSize > MIN_FONT_SIZE) { currentFontSize -= 2; updateFontSize(); }});

    // Кнопка "Разделить текст"
    if (splitTextButton && songContent) {
        splitTextButton.addEventListener('click', () => {
            const lyricsElement = songContent.querySelector('pre');
            if (!lyricsElement || !lyricsElement.textContent?.trim()) {
                alert('Текст песни отсутствует или пуст.'); return;
            }
            songContent.classList.toggle('split-columns');
            splitTextButton.textContent = songContent.classList.contains('split-columns') ? 'Объединить текст' : 'Разделить текст';
        });
    } else {
         console.warn("Элементы 'split-text-button' или 'song-content' не найдены.");
    }

    // Кнопка "В избранное" (локальное)
    if (favoriteButton) {
        favoriteButton.addEventListener('click', () => {
             const sheetName = SHEETS[sheetSelect.value];
             const songIndex = songSelect.value;
             if (!sheetName || !songIndex || songIndex === "") { alert("Сначала выберите песню."); return; }
             const songData = cachedData[sheetName]?.[songIndex];
             if (!songData) { alert("Ошибка: данные песни не найдены."); return; }

             const song = {
                 name: songData[0], sheet: sheetName, index: songIndex, key: keySelect.value // Сохраняем текущую тональность
             };
             // favorites = JSON.parse(localStorage.getItem('favorites')) || []; // Обновляем перед проверкой
             if (!favorites.some(fav => fav.sheet === song.sheet && fav.index === song.index)) {
                 favorites.push(song);
                 localStorage.setItem('favorites', JSON.stringify(favorites));
                 console.log("Добавлено в избранное:", song);
                 if (favoritesPanel.classList.contains('open')) loadFavorites(); // Обновляем список, если панель открыта
                 alert(`Песня "${song.name}" (${song.key}) добавлена в избранное.`);
             } else {
                 alert('Эта песня уже в избранном!');
             }
        });
    }

    // Кнопка "В общий список" (Firestore)
    if (addToListButton) {
        addToListButton.addEventListener('click', () => {
            const sheetName = SHEETS[sheetSelect.value];
            const songIndex = songSelect.value;
            if (!sheetName || !songIndex || songIndex === "" || !cachedData[sheetName] || !cachedData[sheetName][songIndex]) {
                 alert("Сначала выберите песню для добавления."); return;
            }
            const songData = cachedData[sheetName][songIndex];
            addToSharedList(songData); // Вызываем async функцию
        });
    }

    // Кнопка "В мой репертуар" (Firestore)
    if (addToRepertoireButton) {
        addToRepertoireButton.addEventListener('click', addToRepertoire);
    }

    // Выбор вокалиста
    if (vocalistSelect) {
        vocalistSelect.addEventListener('change', (event) => {
            currentVocalistId = event.target.value;
            const selectedIndex = event.target.selectedIndex;
            currentVocalistName = selectedIndex > 0 ? event.target.options[selectedIndex].text : null;
            console.log(`Выбран вокалист: ${currentVocalistName || 'никто'} (ID: ${currentVocalistId})`);
            loadRepertoire(currentVocalistId); // Загружаем репертуар при выборе
        });
    }

   // Кнопка открытия/закрытия панели "Списки" (ИСПРАВЛЕННЫЙ обработчик)
    if (toggleFavoritesButton && favoritesPanel) {
        toggleFavoritesButton.addEventListener('click', () => {
            console.log("--- КЛИК: Кнопка 'Списки' (Правильный обработчик) ---"); // Обновленный лог
            const isOpen = favoritesPanel.classList.toggle('open');
            console.log("Панель 'Списки' .open:", favoritesPanel.classList.contains('open')); // Проверка класса

            if (isOpen) { // Если панель открылась
                // Закрываем панель репертуара, если она была открыта
                if (repertoirePanel && repertoirePanel.classList.contains('open')) {
                    repertoirePanel.classList.remove('open');
                    console.log("Панель 'Репертуар' принудительно закрыта.");
                }
                loadGroupPanel(); // Загружаем содержимое этой панели
            } else { // Если панель закрылась
                console.log("Панель 'Списки' была закрыта этим кликом.");
            }
        });
        console.log("Правильный слушатель для кнопки 'Списки' добавлен.");
    } else {
        console.error("Не найдены элементы для кнопки 'Списки' (toggleFavoritesButton или favoritesPanel)");
    }

    // Кнопка метронома
    if (metronomeButton) {
         metronomeButton.addEventListener('click', async () => {
             // Гарантируем инициализацию и загрузку аудио
              if (!audioContext) setupAudioContext();
              if (!audioContext) return; // Если создать не удалось
              resumeAudioContext(); // Возобновляем перед действием
              if (!audioBuffer) await loadAudioFile(); // Ждем загрузки файла, если его нет

              const bpmText = bpmDisplay.textContent;
              const bpm = parseInt(bpmText, 10);

              if (!isNaN(bpm) && bpm > 0) {
                  toggleMetronome(bpm); // Включаем/выключаем
              } else {
                  alert('BPM не указан или некорректен.');
                  if(isMetronomeActive) toggleMetronome(0); // Выключаем, если был включен с неверным BPM
              }
         });
     } else {
          console.warn("Кнопка метронома не найдена.");
     }

    // Редактирование BPM
    if (bpmDisplay) {
        bpmDisplay.addEventListener('blur', () => { // При потере фокуса после редактирования
            const newBPMText = bpmDisplay.textContent;
            const newBPM = parseInt(newBPMText, 10);

            if (!isNaN(newBPM) && newBPM > 0) {
                updateBPM(newBPM); // Обновляем значение и, возможно, метроном
            } else {
                alert('Введите корректное числовое значение BPM.');
                 // Восстанавливаем предыдущее значение или ставим 'N/A'? Зависит от UX.
                 // Пока просто оставим некорректное или N/A.
                 updateBPM(null); // Устанавливаем N/A
            }
        });
    }

    // Клик по ссылке Holychords (для предотвращения перехода по пустой ссылке)
    if (holychordsButton) {
         holychordsButton.addEventListener('click', (event) => {
             if (!holychordsButton.href || holychordsButton.href.endsWith('#')) {
                 event.preventDefault();
                 alert('Ссылка на Holychords отсутствует для этой песни.');
             }
         });
     }

     // Дополнительные слушатели, если нужны...
     console.log("Настройка слушателей событий завершена.");
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM полностью загружен и разобран.");

    // Проверяем наличие основных контейнеров
    if (!favoritesList || !sharedSongsList || !repertoirePanelList || !vocalistSelect || !repertoirePanel) {
         console.error("Один или несколько ключевых контейнеров для списков не найдены! Проверьте HTML.");
         // Возможно, стоит показать сообщение пользователю
         return; // Прерываем инициализацию, если нет ключевых элементов
    }

    // Настраиваем слушатели событий
    setupEventListeners();

    // Первоначальная загрузка данных
    await loadAllSheetsData(); // Ждем загрузки всех данных перед дальнейшими действиями
    await loadVocalists();     // Загружаем вокалистов

    console.log("Инициализация приложения завершена.");
});
