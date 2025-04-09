// =====================================================================
// Agape Worship App - script.js (Реорганизованная и исправленная версия)
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
    apiKey: "AIzaSyBlkjVQFtFpMRFexAi6nBqEkIfjFlU5cDo", // ОСТОРОЖНО: Ключ в клиентском коде!
    authDomain: "song-archive-389a6.firebaseapp.com",
    projectId: "song-archive-389a6",
    storageBucket: "song-archive-389a6.firebasestorage.app",
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
const MAX_SHARED_SONGS = 8;

// --- FIREBASE INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const sharedListCollection = collection(db, "sharedList"); // Reference to the shared list collection

// --- GLOBAL STATE ---
let currentRepertoireUnsubscribe = null; // <--- ДОБАВИТЬ ЭТУ ПЕРЕМЕННУЮ
let cachedData = {}; // Кэш данных из Google Sheets ({ sheetName: [rows...] })
let favorites = JSON.parse(localStorage.getItem('favorites')) || []; // Избранные песни
let currentVocalistId = null; // ID выбранного вокалиста
let currentVocalistName = null; // Имя выбранного вокалиста
let allSheetsData = []; // Данные всех листов для поиска
let searchIndex = []; // Индекс для поиска (пока не используется эффективно)
let currentFontSize = DEFAULT_FONT_SIZE; // Текущий размер шрифта
let currentSharedListData = []; // Для режима презентации

// Metronome State
let audioContext;
let audioBuffer;
let metronomeInterval = null;
let isMetronomeActive = false;
let currentBeat = 0;


// --- DOM ELEMENT REFERENCES (Исправлено от дубликатов) ---
const sheetSelect = document.getElementById('sheet-select');
const songSelect = document.getElementById('song-select');
const keySelect = document.getElementById('key-select');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const loadingIndicator = document.getElementById('loading-indicator');
const vocalistSelect = document.getElementById('vocalist-select');
const songContent = document.getElementById('song-content');
const favoriteButton = document.getElementById('favorite-button');
const addToListButton = document.getElementById('add-to-list-button');
const addToRepertoireButton = document.getElementById('add-to-repertoire-button');
const splitTextButton = document.getElementById('split-text-button');
const toggleFavoritesButton = document.getElementById('toggle-favorites'); // Кнопка Списки (слева)
const favoritesPanel = document.getElementById('favorites-panel');        // Панель Списки (слева)
const favoritesList = document.getElementById('favorites-list');
const sharedSongsList = document.getElementById('shared-songs-list');
const toggleRepertoireButton = document.getElementById('toggle-repertoire'); // Кнопка Репертуар (справа)
const repertoirePanel = document.getElementById('repertoire-panel');          // Панель Репертуар (справа)
const repertoirePanelVocalistName = document.getElementById('repertoire-panel-vocalist-name');
const repertoirePanelList = document.getElementById('repertoire-panel-list');
const repertoirePanelTitle = document.getElementById('repertoire-panel-title'); // Можно удалить, если не используется
const bpmDisplay = document.getElementById('bpm-display');
const holychordsButton = document.getElementById('holychords-button');
const timeSignatureSelect = document.getElementById('time-signature');
const metronomeButton = document.getElementById('metronome-button');
const zoomInButton = document.getElementById('zoom-in');
const zoomOutButton = document.getElementById('zoom-out');
const playerContainer = document.getElementById('youtube-player-container');
const playerSection = document.getElementById('youtube-player-section');
const presentationOverlay = document.getElementById('presentation-overlay');
const presentationContent = document.getElementById('presentation-content');
const presentationCloseBtn = document.getElementById('presentation-close-btn');
const sharedListHeading = document.getElementById('shared-list-heading'); // ID добавлен в HTML




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
            currentSharedListData = []; // Очищаем данные, если список пуст
            return;
        }

       currentSharedListData = snapshot.docs.map(doc => ({
            id: doc.id, // Сохраняем ID документа Firestore
            ...doc.data() // Сохраняем остальные данные (name, key, sheet, index, timestamp)
       }));

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
                 if (repertoirePanel) repertoirePanel.classList.remove('open'); // Закрываем и репертуар
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
        currentSharedListData = []; // Очищаем данные при ошибке
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

// === ИЗМЕНЕНИЯ В script.js ===

// --- GLOBAL STATE ---


// --- Функция загрузки репертуара (с отпиской от предыдущего слушателя) ---
function loadRepertoire(vocalistId) {
    const listContainer = repertoirePanelList;
    const sectionContainer = repertoirePanel;

    if (!listContainer || !sectionContainer) {
        console.error("Не найдены UI элементы для панели репертуара...");
        return;
    }

    // ---> 1. ОТПИСКА ОТ ПРЕДЫДУЩЕГО СЛУШАТЕЛЯ <---
    if (currentRepertoireUnsubscribe) {
        console.log("loadRepertoire: Отписка от предыдущего слушателя репертуара.");
        try {
            currentRepertoireUnsubscribe(); // Вызываем функцию отписки
        } catch (unsubError) {
            console.error("Ошибка при отписке от слушателя репертуара:", unsubError);
        } finally {
             currentRepertoireUnsubscribe = null; // Сбрасываем в любом случае
        }
    }
    // ---> КОНЕЦ ОТПИСКИ <---

    listContainer.innerHTML = ''; // Очищаем в любом случае

    if (!vocalistId) {
        listContainer.innerHTML = '<div class="empty-message">Выберите вокалиста для просмотра репертуара.</div>';
        return; // Выходим, новый слушатель не нужен
    }

    // Показываем сообщение "Загрузка..." только если есть ID вокалиста
    listContainer.innerHTML = '<div>Загрузка репертуара...</div>';

    // Проверка существования контейнера (на всякий случай)
    console.log("loadRepertoire: listContainer exists:", !!listContainer, "is in document:", document.body.contains(listContainer));

    const repertoireColRef = collection(db, "vocalists", vocalistId, "repertoire");
    const q = query(repertoireColRef);

    console.log(`loadRepertoire: Установка НОВОГО слушателя для ${vocalistId} (с группировкой)`);

    // ---> 2. УСТАНАВЛИВАЕМ НОВЫЙ СЛУШАТЕЛЬ И СОХРАНЯЕМ ОТПИСКУ <---
    currentRepertoireUnsubscribe = onSnapshot(q, (snapshot) => {
        // Оставляем логи для проверки
        console.log(`>>> Firestore onSnapshot для ${vocalistId} СРАБОТАЛ. Получено документов: ${snapshot.size}`);

        // Важно! Проверяем, относится ли этот колбэк к ТЕКУЩЕМУ выбранному вокалисту
        // Это может предотвратить обновление старыми данными, если пользователь быстро переключает вокалистов
        if (vocalistId !== currentVocalistId) {
            console.warn(`onSnapshot: Получен снимок для ${vocalistId}, но текущий вокалист уже ${currentVocalistId}. Игнорируем.`);
            return;
        }

        const currentListContainer = document.getElementById('repertoire-panel-list');
        if (!currentListContainer) {
            console.error("!!! Контейнер #repertoire-panel-list исчез во время работы onSnapshot!");
            // Отписываемся, если контейнер пропал
             if (currentRepertoireUnsubscribe) {
                 currentRepertoireUnsubscribe();
                 currentRepertoireUnsubscribe = null;
             }
            return;
        }
        console.log("   Очистка контейнера перед отрисовкой...");
        currentListContainer.innerHTML = '';

        if (snapshot.empty) {
            console.log("   Снимок пуст, репертуар не найден.");
            currentListContainer.innerHTML = '<div class="empty-message">Репертуар пуст.</div>';
            return;
        }
        console.log("   Начинаем группировку и отрисовку песен...");
        // --- ЛОГИКА ГРУППИРОВКИ И ВЫВОДА --- (Остается БЕЗ ИЗМЕНЕНИЙ)
        const groupedByKeys = {};
        snapshot.docs.forEach((doc) => {
             const song = doc.data();
             const key = song.preferredKey || "N/A";
             const sheet = song.sheet || "Unknown Sheet";
             if (!groupedByKeys[key]) groupedByKeys[key] = {};
             if (!groupedByKeys[key][sheet]) groupedByKeys[key][sheet] = [];
             groupedByKeys[key][sheet].push({ ...song, repertoireDocId: doc.id }); // Сохраняем ID для удаления
        });

        const sortedKeys = Object.keys(groupedByKeys).sort((a, b) => { /*...*/ }); // Сортировка тональностей
        sortedKeys.forEach(key => {
             const keyHeading = document.createElement('div');
             keyHeading.className = 'repertoire-key-heading';
             keyHeading.textContent = `Тональность: ${key}`;
             currentListContainer.appendChild(keyHeading);
             const sheetsInKey = groupedByKeys[key];
             const sortedSheets = Object.keys(sheetsInKey).sort((a, b) => a.localeCompare(b)); // Сортировка листов
             sortedSheets.forEach(sheet => {
                 const sheetHeading = document.createElement('div');
                 sheetHeading.className = 'repertoire-sheet-heading';
                 const shortSheetName = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === sheet) || sheet;
                 sheetHeading.textContent = shortSheetName;
                 currentListContainer.appendChild(sheetHeading);
                 const songsInSheet = sheetsInKey[sheet];
                 songsInSheet.sort((a, b) => a.name.localeCompare(b.name)); // Сортировка песен
                 songsInSheet.forEach(songWithId => {
                     const song = songWithId;
                     const repertoireDocId = song.repertoireDocId; // ID для удаления
                     const listItem = document.createElement('div');
                     listItem.className = 'repertoire-item';
                     const songInfo = document.createElement('span');
                     songInfo.className = 'song-name';
                     songInfo.textContent = song.name;
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
                         // ... (загрузка песни при клике) ...
                         if (!cachedData[song.sheet]?.[song.index]) await fetchSheetData(song.sheet);
                         if (!cachedData[song.sheet]?.[song.index]) { alert('Не удалось найти данные песни.'); return; }
                         const originalSongData = cachedData[song.sheet][song.index];
                         const sheetNameValue = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === song.sheet);
                         if(sheetNameValue) sheetSelect.value = sheetNameValue;
                         await loadSheetSongs();
                         songSelect.value = song.index;
                         displaySongDetails(originalSongData, song.index, song.preferredKey);
                         if (repertoirePanel) repertoirePanel.classList.remove('open');
                         if (favoritesPanel) favoritesPanel.classList.remove('open');
                     });
                     currentListContainer.appendChild(listItem);
                 });
             });
        });
        console.log("   Отрисовка песен ЗАВЕРШЕНА.");

    }, (error) => {
        // ---> ОБРАБОТЧИК ОШИБОК <---
        console.error(`!!! ОШИБКА Firestore onSnapshot для репертуара ${vocalistId}:`, error);
        // Проверяем, актуальна ли ошибка для текущего вокалиста
        if (vocalistId === currentVocalistId) {
            const currentListContainer = document.getElementById('repertoire-panel-list');
            if (currentListContainer) {
                currentListContainer.innerHTML = '<div class="empty-message">Ошибка загрузки репертуара.</div>';
            }
        } else {
            console.warn(`Ошибка onSnapshot для ${vocalistId} проигнорирована, т.к. текущий вокалист ${currentVocalistId}.`);
        }
        // Отписываемся при ошибке, только если это ошибка текущего слушателя
        if (vocalistId === currentVocalistId && currentRepertoireUnsubscribe) {
             console.log("Отписка из-за ошибки onSnapshot.");
             currentRepertoireUnsubscribe();
             currentRepertoireUnsubscribe = null;
        }
    });
}

// --- (Остальной код script.js без изменений) ---

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


function isMobileView() {
    // Используем ту же точку останова (breakpoint), что и в CSS (@media (max-width: 480px))
    return window.innerWidth <= 480;
}


// --- UI UPDATE FUNCTIONS ---


/** Отображает песни из переданного списка в режиме презентации */
async function showPresentationView(songsToShow) {
    if (!presentationOverlay || !presentationContent) return;

    presentationContent.innerHTML = '<div>Загрузка песен... <span id="presentation-loading-count"></span></div>';
    let loadedCount = 0;
    const totalCount = songsToShow.length;
    const loadingCountSpan = document.getElementById('presentation-loading-count');
    // ИСПРАВЛЕНО: Правильная интерполяция и текст
    if(loadingCountSpan) loadingCountSpan.textContent = `(0/${totalCount})`;

    let contentHtml = ''; // Собираем весь HTML здесь

    for (const song of songsToShow) {
        // Проверяем наличие данных в кэше
        if (!cachedData[song.sheet]?.[song.index]) {
            // ИСПРАВЛЕНО: Правильная интерполяция
            console.log(`Presentation: Fetching data for ${song.name} (${song.sheet})`);
            await fetchSheetData(song.sheet); // Дозагружаем, если нет
        }

        const originalSongData = cachedData[song.sheet]?.[song.index];
        if (!originalSongData) {
            console.error(`Presentation: Failed to get original data for ${song.name}`);
            contentHtml += `<div class="presentation-song"><h2>${song.name} - ОШИБКА ЗАГРУЗКИ</h2></div>`;
            continue; // Пропускаем песню, если данных нет
        }

        const songTitle = originalSongData[0];
        const originalLyrics = originalSongData[1] || '';
        const originalKey = originalSongData[2] || chords[0]; // Оригинальный ключ
        const targetKey = song.key; // Ключ из общего списка

        // Транспонирование
        const transposition = getTransposition(originalKey, targetKey);
        const transposedLyrics = transposeLyrics(originalLyrics, transposition);

        // Обработка и подсветка
        const processedLyrics = processLyrics(transposedLyrics);
        const highlightedLyrics = highlightChords(processedLyrics);

        // ИСПРАВЛЕНО: Добавляем HTML для песни с правильной интерполяцией и тегами
        contentHtml += `
            <div class="presentation-song">
                <h2>${songTitle} — ${targetKey}</h2>
                <pre>${highlightedLyrics}</pre>
            </div>
        `;

        // Обновляем счетчик загрузки
        loadedCount++;
        // ИСПРАВЛЕНО: Правильная интерполяция
        if(loadingCountSpan) loadingCountSpan.textContent = `(${loadedCount}/${totalCount})`;
    }

    presentationContent.innerHTML = contentHtml; // Вставляем весь готовый HTML
    presentationOverlay.classList.add('visible'); // Показываем оверлей
    presentationOverlay.scrollTop = 0; // Прокручиваем наверх при открытии
}

// --- UI UPDATE FUNCTIONS ---
function displaySongDetails(songData, index, key) {
    // ---> ИСПРАВЛЕНА ОШИБКА СИНТАКСИСА ВНУТРИ ЭТОЙ ФУНКЦИИ <---
    if(!playerContainer||!playerSection||!songContent){console.error("Missing DOM elements");return;}
    if(!songData){
        songContent.innerHTML='<h2>Выберите песню</h2><pre></pre>';
        playerContainer.innerHTML='';
        playerSection.style.display='none';
        if(bpmDisplay) bpmDisplay.textContent='N/A';
        if(holychordsButton) { holychordsButton.style.display='none'; holychordsButton.href='#'; }
        if(keySelect) { keySelect.value=chords[0]; keySelect.dataset.index=''; }
        return;
    }
    const cK = key || songData[2] || chords[0];
    const bpm = songData[4] || 'N/A';
    const lyrics = songData[1] || '';
    const srcUrl = songData[3] || '#';
    const title = songData[0] || 'Без названия';
    const ytLink = songData[5];

    if(bpmDisplay) { updateBPM(bpm); bpmDisplay.textContent = bpm; }

    if(holychordsButton) {
        if(srcUrl && srcUrl.trim() !== '' && srcUrl.trim() !== '#'){
            holychordsButton.href = srcUrl;
            holychordsButton.style.display = 'inline-block';
        } else {
            holychordsButton.href = '#';
            holychordsButton.style.display = 'none';
        }
    }

    const pLyrics = processLyrics(lyrics);
    const hLyrics = highlightChords(pLyrics);

    // ИСПРАВЛЕННАЯ СТРОКА: Правильная интерполяция и HTML
    songContent.innerHTML = `<h2>${title} — ${cK}</h2><pre>${hLyrics}</pre>`;

    if(keySelect) { keySelect.value = cK; keySelect.dataset.index = index; }
    updateTransposedLyrics(); // Обновляем текст с учетом новой/оригинальной тональности

    const vId = extractYouTubeVideoId(ytLink);
    if(vId && playerContainer && playerSection){
        // ИСПРАВЛЕННАЯ СТРОКА: Правильная интерполяция и URL YouTube
        playerContainer.innerHTML = `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${vId}?autoplay=0&modestbranding=1&rel=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        playerSection.style.display = 'block';
    } else if (playerContainer && playerSection) {
        playerContainer.innerHTML = '';
        playerSection.style.display = 'none';
    }
}


/** Обновление текста песни при смене тональности в keySelect */
function updateTransposedLyrics() {
    if (!keySelect || !songContent) return; // Проверка наличия элементов

    const indexStr = keySelect.dataset.index; // Получаем индекс текущей песни из data-атрибута
    const newKey = keySelect.value; // Новая тональность из select

    if (indexStr === null || indexStr === undefined || indexStr === "") {
         // console.warn("updateTransposedLyrics: Индекс песни не установлен."); // Можно раскомментировать для отладки
         return; // Нет индекса - нечего транспонировать
    }

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
    // console.log(`Transposing from ${originalKey} to ${newKey}, shift: ${transposition}`); // Можно раскомментировать для отладки

    // Транспонируем оригинальный текст
    const transposedLyrics = transposeLyrics(lyrics, transposition);
    // Обрабатываем пробелы и подсвечиваем аккорды в транспонированном тексте
    const processedTransposedLyrics = processLyrics(transposedLyrics); // <--- ВЫЗОВ processLyrics ВОССТАНОВЛЕН
    const highlightedTransposedLyrics = highlightChords(processedTransposedLyrics); // Используем обработанный текст


    // Обновляем текст в <pre>
    preElement.innerHTML = highlightedTransposedLyrics;
    // Обновляем тональность в заголовке H2
    // Используем textContent для безопасности и простоты, если в h2 нет другого HTML
    // h2Element.textContent = `${songData[0]} — ${newKey}`;
    // Или innerHTML, если нужен span или что-то еще (как было изначально)
    h2Element.innerHTML = `${songData[0]} — ${newKey}`; // Оставим как было, предполагая что стили могут быть на ключе

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
                option.value = index; // Значение = индекс строки (СТРОКА!)
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
    const lyricsElement = songContent?.querySelector('pre'); // Добавлена проверка songContent
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
// Этот слушатель уже находится внутри setupEventListeners ниже, здесь оставлять не нужно.

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
        // Текстовые части для десктопа
        const splitText = '<span class="button-text">Разделить текст</span>';
        const mergeText = '<span class="button-text">Объединить колонки</span>';

        // Функция для обновления кнопки
        const updateSplitButton = () => {
            const isSplit = songContent.classList.contains('split-columns');
            const currentIcon = isSplit ? mergeIcon : splitIcon;
            const currentTextSpan = isSplit ? mergeText : splitText;
            // Устанавливаем контент В ЗАВИСИМОСТИ от ширины экрана
            const content = currentIcon + (isMobileView() ? '' : currentTextSpan);
            splitTextButton.innerHTML = content;
            splitTextButton.setAttribute('aria-label', isSplit ? 'Объединить колонки' : 'Разделить текст');
        };

        // Обработчик клика
        splitTextButton.addEventListener('click', () => {
            const lyricsElement = songContent.querySelector('pre');
            if (!lyricsElement || !lyricsElement.textContent?.trim()) {
                alert('Нет текста песни для разделения.');
                return;
            }
            songContent.classList.toggle('split-columns');
            updateSplitButton(); // Обновляем кнопку
        });

        // Установим начальное состояние кнопки при загрузке
        updateSplitButton();

        // Добавим слушатель на изменение размера окна, чтобы кнопка обновлялась
        // (опционально, но улучшает UX если пользователь меняет размер окна)
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(updateSplitButton, 150); // Обновляем с небольшой задержкой
        });
    }

    if(favoriteButton) {
        favoriteButton.addEventListener('click', () => {
            const sheetName = SHEETS[sheetSelect.value];
            const songIndex = songSelect.value;
            if (!sheetName || songIndex === "") {
                alert("Пожалуйста, сначала выберите песню.");
                return;
            }
            const songData = cachedData[sheetName]?.[songIndex];
            if (!songData) {
                alert("Не найдены данные для выбранной песни.");
                return;
            }
            const song = { name: songData[0], sheet: sheetName, index: songIndex, key: keySelect.value };
            if (!favorites.some(f => f.sheet === song.sheet && f.index === song.index)) {
                favorites.push(song);
                localStorage.setItem('favorites', JSON.stringify(favorites));
                if (favoritesPanel?.classList.contains('open')) { // Проверка favoritesPanel
                    loadFavorites(); // Обновляем список, если панель открыта
                }
                // ИСПРАВЛЕНО: Правильная интерполяция в alert
                alert(`"${song.name}" (${song.key}) добавлена в 'Мой список'.`);
            } else {
                alert(`Песня "${song.name}" уже есть в 'Моем списке'.`);
            }
        });
    }

    if(addToListButton) {
        addToListButton.addEventListener('click', () => {
            const sheetName = SHEETS[sheetSelect.value];
            const songIndex = songSelect.value;
            if (!sheetName || songIndex === "" || !cachedData[sheetName]?.[songIndex]) {
                alert("Пожалуйста, сначала выберите песню.");
                return;
            }
            const songData = cachedData[sheetName][songIndex];
            addToSharedList(songData);
        });
    }

    if(addToRepertoireButton) addToRepertoireButton.addEventListener('click', addToRepertoire);

    if(vocalistSelect) vocalistSelect.addEventListener('change', (e) => {
        currentVocalistId = e.target.value;
        const selectedIndex = e.target.selectedIndex;
        currentVocalistName = selectedIndex > 0 ? e.target.options[selectedIndex].text : null;
        // ИСПРАВЛЕНО: Правильная интерполяция в console.log
        console.log(`Vocalist selected: ${currentVocalistName || 'none'} (ID: ${currentVocalistId || 'none'})`);
        // Загружаем репертуар ВНЕ зависимости от того, открыта ли панель,
        // чтобы данные были готовы, если пользователь ее откроет.
        loadRepertoire(currentVocalistId);
        // Если панель репертуара была открыта, она обновится через onSnapshot.
        // Если была закрыта, она просто загрузит данные в фоне.
    });

    // --- ЕДИНСТВЕННЫЕ ОБРАБОТЧИКИ ДЛЯ КНОПОК ПАНЕЛЕЙ ---
    if (toggleFavoritesButton && favoritesPanel) {
        toggleFavoritesButton.addEventListener('click', () => {
            console.log("--- КЛИК: Кнопка 'Списки' ---");
            const isOpen = favoritesPanel.classList.toggle('open');
            console.log("Панель 'Списки' открыта:", isOpen);
            if (isOpen) {
                if (repertoirePanel?.classList.contains('open')) repertoirePanel.classList.remove('open'); // Закрываем другую панель
                loadGroupPanel(); // Загружаем содержимое (Мой список + Общий список)
            }
        });
        console.log("Listener for 'Списки' ADDED ONCE");
    } else {
        console.error("Could not find elements for 'Списки' toggle button or panel");
    }

    if (toggleRepertoireButton && repertoirePanel) {
        toggleRepertoireButton.addEventListener('click', () => {
            console.log("--- КЛИК: Кнопка 'Репертуар' ---");
            const isOpen = repertoirePanel.classList.toggle('open');
            console.log("Панель 'Репертуар' открыта:", isOpen);
            if (isOpen) {
                if (favoritesPanel?.classList.contains('open')) favoritesPanel.classList.remove('open'); // Закрываем другую панель
                // Загрузка репертуара уже вызывается при смене вокалиста,
                // но вызовем и здесь, чтобы обновить, если были изменения пока панель была закрыта
                 loadRepertoire(currentVocalistId);
            }
        });
        console.log("Listener for 'Репертуар' ADDED ONCE");
    } else {
        console.error("Could not find elements for 'Репертуар' toggle button or panel");
    }
    // --- КОНЕЦ ОБРАБОТЧИКОВ ДЛЯ КНОПОК ПАНЕЛЕЙ ---

     // Клик по заголовку "Общий список" для входа в режим презентации
     if (sharedListHeading) {
         sharedListHeading.addEventListener('click', () => {
             console.log("Клик по заголовку Общий список");
             if (currentSharedListData && currentSharedListData.length > 0) {
                 // Закрываем боковые панели, если открыты
                 if (favoritesPanel?.classList.contains('open')) favoritesPanel.classList.remove('open');
                 if (repertoirePanel?.classList.contains('open')) repertoirePanel.classList.remove('open');
                 // Показываем презентацию
                 showPresentationView(currentSharedListData);
             } else {
                 alert("Общий список пуст. Добавьте песни для презентации.");
             }
         });
    } else {
        console.warn("Заголовок shared-list-heading не найден.");
    }

    // Клик по кнопке закрытия презентации
    if (presentationCloseBtn && presentationOverlay) {
         presentationCloseBtn.addEventListener('click', () => {
             presentationOverlay.classList.remove('visible');
             // Выход из полноэкранного режима, если он был включен
             if (document.fullscreenElement) {
                 document.exitFullscreen().catch(err => console.error(`Error attempting to exit fullscreen: ${err.message} (${err.name})`));
             }
         });
    }

    // ИСПРАВЛЕНО: Убрана лишняя фигурная скобка в конце обработчика
    if(metronomeButton){
        metronomeButton.addEventListener('click', async () => {
            if (!audioContext) setupAudioContext();
            if (!audioContext) return; // Если не удалось создать контекст
            resumeAudioContext(); // Пытаемся возобновить перед использованием
            if (!audioBuffer) await loadAudioFile(); // Ждем загрузки, если буфера нет
            const bpmText = bpmDisplay?.textContent; // Проверка bpmDisplay
            const bpmValue = parseInt(bpmText, 10);
            if (!isNaN(bpmValue) && bpmValue > 0) {
                toggleMetronome(bpmValue); // Переключаем с текущим BPM
            } else {
                alert('Не указан или некорректный BPM для запуска метронома.');
                if (isMetronomeActive) toggleMetronome(0); // Остановить, если был активен
            }
        }); // <-- Здесь была лишняя скобка
    }

    // Редактирование BPM вручную (пример)
    if(bpmDisplay) {
        bpmDisplay.addEventListener('blur', () => { // Используем blur вместо keypress для простоты
            const newText = bpmDisplay.textContent;
            const newBpm = parseInt(newText, 10);
            if (!isNaN(newBpm) && newBpm > 0) {
                updateBPM(newBpm); // Обновляем BPM (и метроном, если активен)
            } else {
                alert('Пожалуйста, введите корректное числовое значение BPM.');
                // Можно вернуть предыдущее значение или сбросить
                // Для простоты пока оставим как есть или сбросим
                // updateBPM(null); // Сбросить на N/A
            }
        });
        // Предотвращение ввода нечисловых символов (базовый пример)
        bpmDisplay.addEventListener('input', () => {
             bpmDisplay.textContent = bpmDisplay.textContent.replace(/[^0-9]/g, '');
        });

    }

    if(holychordsButton) holychordsButton.addEventListener('click', (e) => {
        if (!holychordsButton.href || holychordsButton.href.endsWith('#')) {
            e.preventDefault();
            alert('Ссылка на Holychords для этой песни отсутствует.');
        }
    });

    console.log("Event listeners setup complete.");
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM loaded.");
    if (!favoritesPanel || !repertoirePanel || !songContent || !sheetSelect || !songSelect || !keySelect) { // Проверка ключевых элементов
        console.error("Критически важные элементы интерфейса не найдены в HTML!");
        alert("Ошибка инициализации интерфейса! Проверьте HTML структуру и ID элементов.");
        return;
    }

    setupEventListeners(); // <-- ВЫЗЫВАЕМ НАСТРОЙКУ СЛУШАТЕЛЕЙ ЗДЕСЬ ОДИН РАЗ

    await loadAllSheetsData(); // Загружаем все данные для поиска и кэша
    await loadSheetSongs();    // Загружаем песни для листа по умолчанию (если он выбран)
    await loadVocalists();     // Загружаем список вокалистов
    // await loadAudioFile();  // Можно предзагрузить звук метронома здесь, если нужно

    // Загружаем начальное состояние интерфейса
    displaySongDetails(null); // Показываем заглушку для песни
    loadGroupPanel();         // Загружаем данные для панели списков (если она вдруг будет открыта по умолчанию)
    loadRepertoire(null);     // Загружаем "пустой" репертуар

    // Панели скрыты через CSS transform/opacity, нет нужды менять display

    console.log("App initialization complete.");
});
