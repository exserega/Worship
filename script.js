// =====================================================================
// Agape Worship App - script.js (Включая Сет-листы и Редактирование)
// =====================================================================

// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
    getFirestore, collection, addDoc, query,
    onSnapshot, updateDoc, deleteDoc, setDoc, doc, // Добавили updateDoc
    orderBy, getDocs, where
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// --- CONFIGURATION ---
// Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBlkjVQFtFpMRFexAi6nBqEkIfjFlU5cDo", // ОСТОРОЖНО: Ключ в клиентском коде!
    authDomain: "song-archive-389a6.firebaseapp.com",
    projectId: "song-archive-389a6",
    storageBucket: "song-archive-389a6.firebasestorage.app",
    messagingSenderId: "619735277668",
    appId: "1:619735277668:web:51d2684bd8d4444eaf3f71",
    measurementId: "G-Z6QYH5YD2E"
};

// Google Sheets
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
// const MAX_SHARED_SONGS = 8; // Больше не используется

// --- FIREBASE INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const setlistsCollection = collection(db, "setlists"); // Ссылка на коллекцию сет-листов

// --- GLOBAL STATE ---
let currentRepertoireUnsubscribe = null;
let cachedData = {};
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let currentVocalistId = null;
let currentVocalistName = null;
let allSheetsData = [];
let currentFontSize = DEFAULT_FONT_SIZE;

// Состояние Сет-листов
let currentSetlistId = null;
let currentSetlistName = null;
let currentSetlistSongs = [];
let currentSetlistSongsUnsubscribe = null;

// Состояние Презентации
let currentPresentationIndex = 0;
let controlsHideTimeout = null;
let isPresentationSplit = false;

// Состояние Метронома
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

// Кнопки действий с песней
const favoriteButton = document.getElementById('favorite-button');
const addToSetlistButton = document.getElementById('add-to-setlist-button');
const addToRepertoireButton = document.getElementById('add-to-repertoire-button');

// Элементы боковых панелей
const toggleFavoritesButton = document.getElementById('toggle-favorites');
const favoritesPanel = document.getElementById('favorites-panel');
const toggleRepertoireButton = document.getElementById('toggle-repertoire');
const repertoirePanel = document.getElementById('repertoire-panel');

// Элементы панели "Мой список"
const favoritesList = document.getElementById('favorites-list');

// Элементы панели "Сет-листы"
const newSetlistNameInput = document.getElementById('new-setlist-name-input');
const createSetlistButton = document.getElementById('create-setlist-button');
const setlistsListContainer = document.getElementById('setlists-list-container');

// Элементы панели "Текущий сет-лист"
const currentSetlistTitle = document.getElementById('current-setlist-title');
const currentSetlistControls = document.querySelector('.current-setlist-controls');
const startPresentationButton = document.getElementById('start-presentation-button');
const deleteSetlistButton = document.getElementById('delete-setlist-button');
const currentSetlistSongsContainer = document.getElementById('current-setlist-songs-container');

// Элементы панели "Репертуар"
const vocalistSelect = document.getElementById('vocalist-select');
const repertoirePanelList = document.getElementById('repertoire-panel-list');

// Элементы режима Презентации
const presentationOverlay = document.getElementById('presentation-overlay');
const presentationContent = document.getElementById('presentation-content');
const presentationCloseBtn = document.getElementById('presentation-close-btn');
const presSplitTextBtn = document.getElementById('pres-split-text-btn');
const presentationControls = document.querySelector('.presentation-controls');
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
    loadingIndicator.style.display = 'block';
    try {
        const range = `${SHEETS[sheetName]}!A2:G`; // Загружаем A-G
        const url = `https://sheets.googleapis.com/v4/spreadsheets/<span class="math-inline">\{SHEET\_ID\}/values/</span>{range}?key=${API_KEY}`;
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
        const sheetNames = Object.keys(SHEETS);
        const sheetPromises = sheetNames.map(name => fetchSheetData(name));
        const results = await Promise.all(sheetPromises);

        allSheetsData = results.map((data, index) => ({
            sheetName: sheetNames[index],
            data: data
        }));
        console.log("All sheets data loaded.");
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
        vocalistSelect.innerHTML = '<option value="">-- Выберите вокалиста --</option>';

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

/** Загрузка и отображение репертуара вокалиста */
function loadRepertoire(vocalistId) {
    const listContainer = repertoirePanelList;
    const sectionContainer = repertoirePanel;

    if (!listContainer || !sectionContainer) {
        console.error("Не найдены UI элементы для панели репертуара...");
        return;
    }

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

    listContainer.innerHTML = '';

    if (!vocalistId) {
        listContainer.innerHTML = '<div class="empty-message">Выберите вокалиста для просмотра репертуара.</div>';
        return;
    }

    listContainer.innerHTML = '<div>Загрузка репертуара...</div>';

    const repertoireColRef = collection(db, "vocalists", vocalistId, "repertoire");
    const q = query(repertoireColRef);

    console.log(`loadRepertoire: Установка НОВОГО слушателя для ${vocalistId} (с аккордеоном)`);

    currentRepertoireUnsubscribe = onSnapshot(q, (snapshot) => {
        console.log(`>>> Firestore onSnapshot для ${vocalistId} СРАБОТАЛ. Получено документов: ${snapshot.size}`);

        if (vocalistId !== currentVocalistId) {
            console.warn(`onSnapshot: Получен снимок для ${vocalistId}, но текущий вокалист уже ${currentVocalistId}. Игнорируем.`);
            return;
        }

        const currentListContainer = document.getElementById('repertoire-panel-list');
        if (!currentListContainer) {
            console.error("!!! Контейнер #repertoire-panel-list исчез во время работы onSnapshot!");
            if (currentRepertoireUnsubscribe) {
                currentRepertoireUnsubscribe();
                currentRepertoireUnsubscribe = null;
            }
            return;
        }

        currentListContainer.innerHTML = '';

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

        const sortedKeys = Object.keys(groupedByKeys).sort((a, b) => {
            const order = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "H", "N/A"];
            return order.indexOf(a) - order.indexOf(b);
        });

        console.log("  Начинаем отрисовку аккордеона...");
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
            songsInKey.sort((a, b) => a.name.localeCompare(b.name));

            if (songsInKey.length > 0) {
                songsInKey.forEach(songWithId => {
                    const song = songWithId;
                    const repertoireDocId = song.repertoireDocId;
                    const shortSheetName = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === song.sheet) || song.sheet || '';

                    const listItem = document.createElement('div');
                    listItem.className = 'repertoire-item';

                    const songInfo = document.createElement('span');
                    songInfo.className = 'song-name';
                    songInfo.textContent = shortSheetName ? `<span class="math-inline">\{song\.name\} \(</span>{shortSheetName})` : song.name;
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
                            console.log(`Загрузка данных для <span class="math-inline">\{song\.name\} \(</span>{song.sheet}) при клике в репертуаре`);
                            await fetchSheetData(song.sheet);
                            if (!cachedData[song.sheet]?.[song.index]) {
                                alert(`Не удалось найти или загрузить данные песни "${song.name}".`);
                                return;
                            }
                        }
                        const originalSongData = cachedData[song.sheet][song.index];
                        const sheetNameValue = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === song.sheet);
                        if(sheetNameValue) sheetSelect.value = sheetNameValue;
                        await loadSheetSongs();
                        songSelect.value = song.index;
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
        });
        console.log("  Отрисовка аккордеона ЗАВЕРШЕНА.");

    }, (error) => {
        console.error(`!!! ОШИБКА Firestore onSnapshot для репертуара ${vocalistId}:`, error);
        if (vocalistId === currentVocalistId) {
            const currentListContainer = document.getElementById('repertoire-panel-list');
            if (currentListContainer) {
                currentListContainer.innerHTML = '<div class="empty-message">Ошибка загрузки репертуара.</div>';
            }
        } else {
            console.warn(`Ошибка onSnapshot для ${vocalistId} проигнорирована, т.к. текущий вокалист ${currentVocalistId}.`);
        }
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

    if (isCollapsed) {
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

    contentWrapper.classList.toggle('collapsed');

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
    const sheetName = SHEETS[sheetSelect.value];
    const songIndex = songSelect.value;
    if (!sheetName || !songIndex || songIndex === "" || !cachedData[sheetName] || !cachedData[sheetName][songIndex]) {
         alert("Пожалуйста, сначала выберите песню для добавления в репертуар."); return;
    }
    const songData = cachedData[sheetName][songIndex];
    const songName = songData[0];
    const preferredKey = keySelect.value;
    console.log(`Добавляем в репертуар для ${currentVocalistName} (ID: <span class="math-inline">\{currentVocalistId\}\)\: Песня "</span>{songName}", Тональность: ${preferredKey}`);

    const repertoireDocId = `<span class="math-inline">\{sheetName\}\_</span>{songIndex}`;
    const dataToSave = {
        sheet: sheetName,
        index: songIndex,
        name: songName,
        preferredKey: preferredKey
    };
    console.log("Данные для сохранения:", dataToSave);

    try {
        await setDoc(doc(db, "vocalists", currentVocalistId, "repertoire", repertoireDocId), dataToSave);
        console.log(`Песня "${songName}" успешно добавлена/обновлена в репертуаре ${currentVocalistName}.`);
        alert(`Песня "<span class="math-inline">\{songName\}" \(</span>{preferredKey}) добавлена/обновлена в репертуаре ${currentVocalistName}.`);
    } catch (error) {
        console.error("Ошибка при добавлении/обновлении песни в репертуаре:", error);
        alert("Произошла ошибка при сохранении песни в репертуар.");
    }
}

/** Удаление песни из репертуара вокалиста */
async function removeFromRepertoire(vocalistId, repertoireDocId) {
     console.log(`Попытка удалить песню ${repertoireDocId} из репертуара ${vocalistId}`);
     if (!vocalistId || !repertoireDocId) {
         console.error("removeFromRepertoire: Не переданы ID."); alert("Ошибка удаления."); return;
     }
     const vocalistDisplayName = currentVocalistName || vocalistId;
     if (!confirm(`Удалить эту песню из репертуара ${vocalistDisplayName}?`)) {
         return;
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

// --- НОВЫЕ ФУНКЦИИ ДЛЯ СЕТ-ЛИСТОВ ---

/** Загрузка и отображение списка сет-листов */
function loadSetlists() {
    if (!setlistsListContainer) {
        console.error("Контейнер для списка сет-листов (#setlists-list-container) не найден.");
        return;
    }
    setlistsListContainer.innerHTML = '<div class="empty-message">Загрузка сет-листов...</div>';

    const q = query(setlistsCollection, orderBy("name", "asc")); // Сортируем по имени

    // Слушаем изменения в коллекции сет-листов
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setlistsListContainer.innerHTML = ''; // Очищаем контейнер
        if (snapshot.empty) {
            setlistsListContainer.innerHTML = '<div class="empty-message">Нет созданных сет-листов.</div>';
            selectSetlist(null, null);
            return;
        }

        snapshot.docs.forEach((doc) => {
            const setlist = doc.data();
            const setlistId = doc.id;
            const setlistItem = document.createElement('div');
            setlistItem.className = 'setlist-item';
            setlistItem.dataset.id = setlistId; // Сохраняем ID

            // 1. Создаем SPAN для отображения имени
            const nameSpan = document.createElement('span');
            nameSpan.className = 'setlist-name-display';
            nameSpan.textContent = setlist.name || 'Без названия';
            nameSpan.addEventListener('click', () => {
                selectSetlist(setlistId, setlist.name);
            });
            setlistItem.appendChild(nameSpan);

            // 2. Создаем кнопку Редактировать
            const editButton = document.createElement('button');
            editButton.className = 'setlist-edit-button';
            editButton.title = 'Редактировать название';
            editButton.innerHTML = '<i class="fas fa-pencil-alt"></i>';
            editButton.addEventListener('click', (e) => {
                e.stopPropagation();
                startEditSetlistName(setlistItem, setlistId, setlist.name);
            });
            setlistItem.appendChild(editButton);

            if (setlistId === currentSetlistId) {
                setlistItem.classList.add('active');
            }
            setlistsListContainer.appendChild(setlistItem);
        });
    }, (error) => {
        console.error("Ошибка при загрузке списка сет-листов:", error);
        setlistsListContainer.innerHTML = '<div class="empty-message">Не удалось загрузить сет-листы.</div>';
        selectSetlist(null, null);
    });
}

/** Обработка выбора сет-листа */
function selectSetlist(setlistId, setlistName) {
     console.log(`Выбран сет-лист: ID=<span class="math-inline">\{setlistId\}, Имя\=</span>{setlistName}`);
     currentSetlistId = setlistId;
     currentSetlistName = setlistName;

     if (setlistsListContainer) {
         const items = setlistsListContainer.querySelectorAll('.setlist-item');
         items.forEach(item => {
             item.classList.toggle('active', item.dataset.id === setlistId);
         });
     }

     if (currentSetlistTitle && currentSetlistControls) {
         if (setlistId) {
             currentSetlistTitle.textContent = setlistName || 'Сет-лист без названия';
             currentSetlistControls.style.display = 'flex';
         } else {
             currentSetlistTitle.textContent = 'Выберите сет-лист';
             currentSetlistControls.style.display = 'none';
             currentSetlistSongs = [];
             if (currentSetlistSongsContainer) {
                  currentSetlistSongsContainer.innerHTML = '<div class="empty-message">Сначала выберите сет-лист</div>';
             }
         }
     }
     loadCurrentSetlistSongs(setlistId);
}


/** Создание нового сет-листа */
async function createSetlist() {
    if (!newSetlistNameInput || !createSetlistButton) return;

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
        createdAt: new Date()
    };

    try {
        const docRef = await addDoc(setlistsCollection, dataToSave);
        console.log("Новый сет-лист создан с ID:", docRef.id);
        newSetlistNameInput.value = '';
        alert(`Сет-лист "${setlistName}" создан!`);
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
        console.error("Контейнер для песен текущего сет-листа (#current-setlist-songs-container) не найден.");
        return;
    }

    if (currentSetlistSongsUnsubscribe) {
        console.log("Отписка от предыдущего слушателя песен сет-листа.");
        currentSetlistSongsUnsubscribe();
        currentSetlistSongsUnsubscribe = null;
    }

    if (!setlistId) {
        currentSetlistSongsContainer.innerHTML = '<div class="empty-message">Сначала выберите сет-лист</div>';
        currentSetlistSongs = [];
        return;
    }

    currentSetlistSongsContainer.innerHTML = '<div>Загрузка песен сет-листа...</div>';
    currentSetlistSongs = [];

    const songsCollectionRef = collection(db, "setlists", setlistId, "songs");
    const q = query(songsCollectionRef, orderBy("order", "asc"));

    console.log(`Установка слушателя для песен сет-листа ${setlistId}`);

    currentSetlistSongsUnsubscribe = onSnapshot(q, (snapshot) => {
          if (setlistId !== currentSetlistId) {
              console.warn(`Получен снимок песен для ${setlistId}, но текущий сет-лист уже ${currentSetlistId}. Игнорируем.`);
              return;
          }

         console.log(`Слушатель песен для ${setlistId} сработал. Документов: ${snapshot.size}`);
         currentSetlistSongsContainer.innerHTML = '';
         currentSetlistSongs = [];

         if (snapshot.empty) {
             currentSetlistSongsContainer.innerHTML = '<div class="empty-message">В этом сет-листе пока нет песен.</div>';
             return;
         }

         snapshot.docs.forEach((songDoc) => {
             const songData = songDoc.data();
             const songDocId = songDoc.id;

             currentSetlistSongs.push({ id: songDocId, ...songData });

             const songItem = document.createElement('div');
             songItem.className = 'setlist-song-item';
             songItem.dataset.id = songDocId;
             songItem.dataset.sheet = songData.sheet;
             songItem.dataset.index = songData.index;

              // Добавляем "ручку" (если она нужна позже)
             // const dragHandle = document.createElement('span');
             // dragHandle.className = 'drag-handle';
             // dragHandle.innerHTML = '&#9776;';
             // songItem.appendChild(dragHandle);

             const songInfo = document.createElement('span');
             songInfo.className = 'song-name';
             songInfo.textContent = `${songData.name || 'Без названия'} — ${songData.preferredKey || 'N/A'}`;
             songItem.appendChild(songInfo);

             const deleteBtn = document.createElement('button');
             deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
             deleteBtn.className = 'delete-button delete-song-from-setlist-button';
             deleteBtn.title = 'Удалить песню из сет-листа';
             deleteBtn.addEventListener('click', (e) => {
                 e.stopPropagation();
                 deleteSongFromSetlist(songDocId);
             });
             songItem.appendChild(deleteBtn);

              songItem.addEventListener('click', async () => {
                 console.log(`Клик по песне "${songData.name}" в сет-листе.`);
                 if (!cachedData[songData.sheet]?.[songData.index]) {
                     console.log(`Данные для <span class="math-inline">\{songData\.name\} \(</span>{songData.sheet}) не найдены в кэше, загружаем...`);
                     await fetchSheetData(songData.sheet);
                      if (!cachedData[songData.sheet]?.[songData.index]) {
                          alert(`Не удалось найти или загрузить данные песни "${songData.name}". Возможно, она была удалена из исходного листа.`);
                          return;
                      }
                 }
                 const originalSongData = cachedData[songData.sheet][songData.index];
                 const sheetNameValue = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === songData.sheet);

                 if(sheetNameValue) sheetSelect.value = sheetNameValue;
                 await loadSheetSongs();
                 songSelect.value = songData.index;
                 displaySongDetails(originalSongData, songData.index, songData.preferredKey);

                 if (favoritesPanel) favoritesPanel.classList.remove('open');
                 if (repertoirePanel) repertoirePanel.classList.remove('open');
              });

             currentSetlistSongsContainer.appendChild(songItem);
         });

     }, (error) => {
           if (setlistId !== currentSetlistId) {
               console.warn(`Получена ошибка для ${setlistId}, но текущий сет-лист уже ${currentSetlistId}. Игнорируем.`);
               return;
           }
         console.error(`Ошибка при загрузке песен для сет-листа ${setlistId}:`, error);
         currentSetlistSongsContainer.innerHTML = '<div class="empty-message">Ошибка загрузки песен.</div>';
         currentSetlistSongs = [];
         if (currentSetlistSongsUnsubscribe) {
             currentSetlistSongsUnsubscribe();
             currentSetlistSongsUnsubscribe = null;
         }
     });
 }


/** Добавляет текущую песню в ВЫБРАННЫЙ сет-лист */
async function addToCurrentSetlist() {
    console.log("Попытка добавить песню в текущий сет-лист...");

    if (!currentSetlistId) {
        alert("Пожалуйста, сначала выберите сет-лист в панели слева, куда нужно добавить песню.");
        if (favoritesPanel && !favoritesPanel.classList.contains('open')) {
            favoritesPanel.classList.add('open');
            if (repertoirePanel) repertoirePanel.classList.remove('open');
            loadSetlists();
        }
        return;
    }

    const sheetName = SHEETS[sheetSelect.value];
    const songIndex = songSelect.value;
    if (!sheetName || songIndex === "" || !cachedData[sheetName]?.[songIndex]) {
        alert("Пожалуйста, сначала выберите песню, которую хотите добавить.");
        return;
    }
    const songData = cachedData[sheetName][songIndex];
    const songName = songData[0];
    const preferredKey = keySelect.value;

    console.log(`Добавляем: Песня="<span class="math-inline">\{songName\}", Тональность\=</span>{preferredKey} в Сет-лист ID=<span class="math-inline">\{currentSetlistId\} \(</span>{currentSetlistName || ''})`);

    const nextOrder = currentSetlistSongs.length > 0
        ? Math.max(...currentSetlistSongs.map(song => song.order ?? -1)) + 1
        : 0;
    console.log("Следующий порядок (order):", nextOrder);

    const songEntryData = {
        sheet: sheetName,
        index: songIndex,
        name: songName,
        preferredKey: preferredKey,
        order: nextOrder
    };

    try {
        const songsCollectionRef = collection(db, "setlists", currentSetlistId, "songs");
        const q = query(songsCollectionRef, where("sheet", "==", sheetName), where("index", "==", songIndex));
        const duplicateSnapshot = await getDocs(q);
        if (!duplicateSnapshot.empty) {
             const existingDoc = duplicateSnapshot.docs[0];
             if (existingDoc.data().preferredKey !== preferredKey) {
                 if (confirm(`Песня "<span class="math-inline">\{songName\}" уже есть в сет\-листе "</span>{currentSetlistName}". Обновить тональность на ${preferredKey}?`)) {
                     await setDoc(doc(db, "setlists", currentSetlistId, "songs", existingDoc.id), { preferredKey: preferredKey }, { merge: true });
                     alert(`Тональность песни "${songName}" в сет-листе обновлена на ${preferredKey}.`);
                 }
             } else {
                 alert(`Песня "<span class="math-inline">\{songName\}" уже есть в сет\-листе "</span>{currentSetlistName}" с той же тональностью.`);
             }
             return;
        }

        const docRef = await addDoc(songsCollectionRef, songEntryData);
        console.log(`Песня добавлена в сет-лист ${currentSetlistId} с ID документа: ${docRef.id}`);
        alert(`Песня "<span class="math-inline">\{songName\}" \(</span>{preferredKey}) добавлена в сет-лист "${currentSetlistName}".`);

    } catch (error) {
        console.error("Ошибка при добавлении/обновлении песни в сет-лист:", error);
        alert("Произошла ошибка при добавлении/обновлении песни в сет-лист.");
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

    if (confirm(`Вы уверены, что хотите удалить <span class="math-inline">\{songNameToConfirm\} из сет\-листа "</span>{currentSetlistName || 'текущего'}"?`)) {
        console.log(`Попытка удаления песни ${songDocId} из сет-листа ${currentSetlistId}`);
        try {
            const songDocRef = doc(db, "setlists", currentSetlistId, "songs", songDocId);
            await deleteDoc(songDocRef);
            console.log("Песня успешно удалена из сет-листа.");
            alert("Песня удалена из сет-листа.");
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

    if (confirm(`ВЫ УВЕРЕНЫ, что хотите ПОЛНОСТЬЮ удалить сет-лист "${currentSetlistName}"?\n\nЭто действие необратимо и удалит сам сет-лист.`)) {
         console.log(`Попытка удаления сет-листа ${currentSetlistId}`);
         try {
             const setlistDocRef = doc(db, "setlists", currentSetlistId);
             await deleteDoc(setlistDocRef);
             console.log("Сет-лист успешно удален.");
             alert(`Сет-лист "${currentSetlistName}" удален.`);
             selectSetlist(null, null);
             // ВАЖНО: Удаление документа НЕ удаляет его подколлекции (песни внутри).
             // Для полного удаления нужен более сложный код (Firebase Functions).
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
    if (itemElement.classList.contains('is-editing')) {
        return;
    }

    itemElement.classList.add('is-editing');

    const nameSpan = itemElement.querySelector('span.setlist-name-display');

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-setlist-input';
    input.value = currentName || '';
    input.dataset.originalName = currentName || '';

    const editButtonRef = itemElement.querySelector('.setlist-edit-button');
    if (editButtonRef) {
          itemElement.insertBefore(input, editButtonRef);
    } else {
        itemElement.prepend(input);
    }

    input.focus();
    input.select();

    input.addEventListener('blur', () => {
        setTimeout(() => saveSetlistName(id, input, itemElement), 100);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveSetlistName(id, input, itemElement);
        } else if (e.key === 'Escape') {
            cancelEditSetlistName(itemElement);
        }
    });
} // <--- Эта скобка была на месте

/** Сохранение нового имени сет-листа */
async function saveSetlistName(id, inputElement, itemElement) {
    if (!inputElement || !itemElement.contains(inputElement)) {
        return;
    }

    const newName = inputElement.value.trim();
    const originalName = inputElement.dataset.originalName;

    if (!newName || newName === originalName) {
        cancelEditSetlistName(itemElement);
        return;
    }

    console.log(`Сохранение нового имени "${newName}" для сет-листа ${id}`);
    try {
        const setlistDocRef = doc(db, "setlists", id);
        await updateDoc(setlistDocRef, { name: newName });
        console.log("Имя сет-листа успешно обновлено.");

        const nameSpan = itemElement.querySelector('span.setlist-name-display');
        if (nameSpan) {
            nameSpan.textContent = newName;
        }
        if(id === currentSetlistId && currentSetlistTitle){
            currentSetlistTitle.textContent = newName;
            currentSetlistName = newName;
        }

        cancelEditSetlistName(itemElement);
    } catch (error) {
        console.error("Ошибка при обновлении имени сет-листа:", error);
        alert("Не удалось обновить имя сет-листа.");
        cancelEditSetlistName(itemElement);
    }
} // <--- Эта скобка была на месте

/** Отмена режима редактирования имени сет-листа */
function cancelEditSetlistName(itemElement) {
    if (!itemElement || !itemElement.classList.contains('is-editing')) {
        return;
    }

    const input = itemElement.querySelector('input.edit-setlist-input');
    if (input) {
        itemElement.removeChild(input);
    }
    itemElement.classList.remove('is-editing');
    // itemElement.focus(); // Можно раскомментировать если нужно
} // <--- И эта скобка была на месте

// --- КОНЕЦ НОВЫХ ФУНКЦИЙ ДЛЯ СЕТ-ЛИСТОВ ---



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
    const suffixes = ['maj7', 'm7', '7', 'm', 'dim', 'aug', 'sus2', 'sus4', 'add9', 'dim7', 'aug7', 'sus'];

    if (chord.includes('/')) {
        [baseChord, bassNote] = chord.split('/');
    }
    for (let suffix of suffixes) {
        if (baseChord.endsWith(suffix)) {
            baseChord = baseChord.slice(0, -suffix.length);
            chordType = suffix;
            break;
        }
    }
    const currentIndex = chords.indexOf(baseChord);
    if (currentIndex === -1) return chord;

    const newIndex = (currentIndex + transposition + chords.length) % chords.length;
    const transposedBaseChord = chords[newIndex] + chordType;

    if (bassNote) {
        const bassIndex = chords.indexOf(bassNote);
        if (bassIndex !== -1) {
            const newBassIndex = (bassIndex + transposition + chords.length) % chords.length;
            return `<span class="math-inline">\{transposedBaseChord\}/</span>{chords[newBassIndex]}`;
        } else {
            return `<span class="math-inline">\{transposedBaseChord\}/</span>{bassNote}`;
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
   if (transposition === 0) return lyrics;
   const chordRegex = /([A-H][#b]?(?:maj7|m7|7|m|dim|aug|sus4|sus2|add9|dim7|aug7|sus)?(?:\/[A-H][#b]?)?)/g;
   return lyrics.replace(chordRegex, (match) => {
       return transposeChord(cleanChord(match), transposition);
   });
}

/** Обработка строк текста для уменьшения пробелов */
function processLyrics(lyrics) {
    if (!lyrics) return '';
    return lyrics.split('\n').map(line => {
        return line.replace(/ {2,}/g, match => ' '.repeat(Math.ceil(match.length / 2)));
    }).join('\n');
}

/** Выделение аккордов тегами span для стилизации */
function highlightChords(lyrics) {
    if (!lyrics) return '';
   const chordRegex = /([A-H][#b]?(?:maj7|m7|7|m|dim|aug|sus4|sus2|add9|dim7|aug7|sus)?(?:\/[A-H][#b]?)?)/g;
   return lyrics.replace(chordRegex, '<span class="chord">$1</span>');
}

/** Поиск песен */
async function searchSongs(query) {
    const lowerQuery = query.trim().toLowerCase();
    if (!lowerQuery) {
        searchResults.innerHTML = ''; return;
    }
    const allRows = Object.values(cachedData).flat();

    const matchingSongs = allRows.filter(row => {
        const name = row?.[0]?.trim().toLowerCase();
        return name && name.includes(lowerQuery);
    });

    searchResults.innerHTML = '';
    if (matchingSongs.length === 0) {
        searchResults.innerHTML = '<div class="search-result">Ничего не найдено</div>'; return;
    }

    matchingSongs.forEach((song) => {
        const resultItem = document.createElement('div');
        resultItem.textContent = song[0];
        resultItem.className = 'search-result';
        resultItem.addEventListener('click', async () => {
            let foundSheetName = null;
            let originalIndex = -1;
            for (const sheetKey in SHEETS) {
                 const sheetNameFromMap = SHEETS[sheetKey];
                 if (cachedData[sheetNameFromMap]) {
                       originalIndex = cachedData[sheetNameFromMap].findIndex(row => row?.[0] === song[0]);
                       if(originalIndex !== -1) {
                           foundSheetName = sheetKey;
                           break;
                       }
                 }
            }

            if (foundSheetName && originalIndex !== -1) {
                sheetSelect.value = foundSheetName;
                await loadSheetSongs();
                songSelect.value = originalIndex;
                displaySongDetails(cachedData[SHEETS[foundSheetName]][originalIndex], originalIndex);
                searchResults.innerHTML = '';
                searchInput.value = song[0];
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
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = url.match(regex);
        if (match && match[1]) {
            videoId = match[1];
        }
    } catch (e) {
        console.error("Error extracting YouTube video ID:", e);
        return null;
    }
    return videoId;
}

/** Проверка мобильного вида */
function isMobileView() {
    return window.innerWidth <= 480;
}


// --- UI UPDATE FUNCTIONS ---

/** Запуск режима презентации */
async function showPresentationView(songsToShow) {
    if (!presentationOverlay || !presentationContent || !songsToShow || songsToShow.length === 0) {
        console.error("Не могу показать презентацию: нет оверлея/контента или нет песен.");
        return;
    }
    console.log(`Запуск режима презентации с ${songsToShow.length} песнями.`);

    // ВАЖНО: presentationSongs теперь берется из songsToShow (currentSetlistSongs)
    presentationSongs = songsToShow; // Запоминаем песни для презентации
    currentPresentationIndex = 0;
    isPresentationSplit = false;
    updatePresentationSplitButtonState();

    await displayCurrentPresentationSong(); // Отображаем первую песню

    presentationOverlay.classList.add('visible');
    presentationOverlay.scrollTop = 0;
    showPresentationControls();
}

/** Отображение ТЕКУЩЕЙ песни в режиме презентации */
async function displayCurrentPresentationSong() {
    // Убедимся, что presentationSongs содержит актуальные данные
    if (!presentationSongs || presentationSongs.length === 0 || !presentationContent) return;

    if (currentPresentationIndex < 0) currentPresentationIndex = 0;
    if (currentPresentationIndex >= presentationSongs.length) currentPresentationIndex = presentationSongs.length - 1;

    const song = presentationSongs[currentPresentationIndex];
    console.log(`Презентация: Показываем песню <span class="math-inline">\{currentPresentationIndex \+ 1\}/</span>{presentationSongs.length}: ${song.name}`);

    presentationContent.innerHTML = `<div class="presentation-loading">Загрузка "${song.name}"...</div>`;

    try {
        if (!cachedData[song.sheet]?.[song.index]) {
            console.log(`Presentation: Загрузка данных для <span class="math-inline">\{song\.name\} \(</span>{song.sheet})`);
            await fetchSheetData(song.sheet);
        }
        const originalSongData = cachedData[song.sheet]?.[song.index];
        if (!originalSongData) throw new Error(`Не найдены данные для ${song.name}`);

        const songTitle = originalSongData[0];
        const originalLyrics = originalSongData[1] || '';
        const originalKey = originalSongData[2] || chords[0];
        const targetKey = song.preferredKey; // Используем preferredKey из сет-листа

        const transposition = getTransposition(originalKey, targetKey);
        const transposedLyrics = transposeLyrics(originalLyrics, transposition);
        const processedLyrics = processLyrics(transposedLyrics);
        const highlightedLyrics = highlightChords(processedLyrics);

        const songHtml = `
            <div class="presentation-song">
                <h2>${songTitle} — <span class="math-inline">\{targetKey\}</h2\>
<pre\></span>{highlightedLyrics}</pre>
            </div>
        `;
        presentationContent.innerHTML = songHtml;

        if (presentationContent) {
             presentationContent.classList.toggle('split-columns', isPresentationSplit);
        }

         const songElement = presentationContent.querySelector('.presentation-song');
         if (songElement) songElement.scrollTop = 0;

    } catch (error) {
        console.error("Ошибка при отображении песни в презентации:", error);
        presentationContent.innerHTML = `<div class="presentation-song error"><h2>Ошибка загрузки песни</h2><p>${error.message}</p></div>`;
    }

    const counterElement = document.getElementById('pres-counter');
    if (counterElement) {
        counterElement.textContent = `${currentPresentationIndex + 1} / ${presentationSongs.length}`;
    }

    const prevBtn = document.getElementById('pres-prev-btn');
    const nextBtn = document.getElementById('pres-next-btn');
    if (prevBtn) prevBtn.disabled = (currentPresentationIndex === 0);
    if (nextBtn) nextBtn.disabled = (currentPresentationIndex === presentationSongs.length - 1);
}

/** Следующая песня в презентации */
function nextPresentationSong() {
    if (currentPresentationIndex < presentationSongs.length - 1) {
        currentPresentationIndex++;
        displayCurrentPresentationSong();
    }
}

/** Предыдущая песня в презентации */
function prevPresentationSong() {
    if (currentPresentationIndex > 0) {
        currentPresentationIndex--;
        displayCurrentPresentationSong();
    }
}

/** Показ контролов презентации */
function showPresentationControls() {
    const controls = document.querySelector('.presentation-controls');
    if (!controls) return;
    controls.classList.remove('controls-hidden');
    clearTimeout(controlsHideTimeout);
    controlsHideTimeout = setTimeout(hidePresentationControls, CONTROLS_HIDE_DELAY);
}

/** Скрытие контролов презентации */
function hidePresentationControls() {
    const controls = document.querySelector('.presentation-controls');
    if (controls) {
        controls.classList.add('controls-hidden');
    }
}

/** Переключение разделения текста в презентации */
function togglePresentationSplit() {
    isPresentationSplit = !isPresentationSplit;
    if (presentationContent) {
         presentationContent.classList.toggle('split-columns', isPresentationSplit);
    }
    updatePresentationSplitButtonState();
}

/** Обновление кнопки разделения текста в презентации */
function updatePresentationSplitButtonState() {
     const presSplitBtn = document.getElementById('pres-split-text-btn');
     if (!presSplitBtn) return;
     const splitIcon = 'fa-columns';
     const mergeIcon = 'fa-align-justify';
     const splitTitle = 'Разделить текст';
     const mergeTitle = 'Объединить колонки';
     const iconElement = presSplitBtn.querySelector('i');
     if (!iconElement) return;

     if (isPresentationSplit) {
         iconElement.classList.remove(splitIcon);
         iconElement.classList.add(mergeIcon);
         presSplitBtn.title = mergeTitle;
     } else {
         iconElement.classList.remove(mergeIcon);
         iconElement.classList.add(splitIcon);
         presSplitBtn.title = splitTitle;
     }
}

/** Обработка свайпов в презентации */
function handleGesture() {
    const threshold = 50;
    const yThreshold = 75;
    const horizontalDiff = touchendX - touchstartX;
    const verticalDiff = Math.abs(touchendY - touchstartY);

    if (verticalDiff > yThreshold) {
         console.log("Вертикальный свайп, игнорируем.");
         return;
    }
    if (horizontalDiff < -threshold) {
         console.log('Свайп влево -> следующая песня');
         nextPresentationSong();
    }
    if (horizontalDiff > threshold) {
         console.log('Свайп вправо -> предыдущая песня');
         prevPresentationSong();
    }
}

/** Установка слушателей свайпов */
function setupSwipeListeners() {
     if (!presentationOverlay) return;
     presentationOverlay.addEventListener('touchstart', e => {
         touchstartX = e.changedTouches[0].screenX;
         touchstartY = e.changedTouches[0].screenY;
     }, { passive: true });
     presentationOverlay.addEventListener('touchend', e => {
         touchendX = e.changedTouches[0].screenX;
         touchendY = e.changedTouches[0].screenY;
         handleGesture();
     });
     console.log("Слушатели свайпов для презентации установлены.");
}

/** Отображение деталей песни */
function displaySongDetails(songData, index, key) {
    if (!playerContainer || !playerSection || !songContent) {
        console.error("displaySongDetails: Отсутствуют необходимые DOM элементы.");
        return;
    }
    const keyDisplay = document.getElementById('youtube-video-key-display');

    if (!songData) {
        songContent.innerHTML = '<h2>Выберите песню</h2><pre></pre>';
        playerContainer.innerHTML = '';
        playerSection.style.display = 'none';
        if (bpmDisplay) bpmDisplay.textContent = 'N/A';
        if (holychordsButton) {
            holychordsButton.style.display = 'none';
            holychordsButton.href = '#';
        }
        if (keySelect) {
             keySelect.value = chords[0];
             keySelect.dataset.index = '';
        }
        if (keyDisplay) {
            keyDisplay.textContent = '';
            keyDisplay.style.display = 'none';
        }
        return;
    }

    const title = songData[0] || 'Без названия';
    const lyrics = songData[1] || '';
    const originalKeyFromSheet = songData[2] || chords[0];
    const srcUrl = songData[3] || '#';
    const bpm = songData[4] || 'N/A';
    const ytLink = songData[5];
    const videoKey = songData[6] ? songData[6].trim() : null;

    const currentSelectedKey = key || originalKeyFromSheet;

    if (bpmDisplay) { updateBPM(bpm); bpmDisplay.textContent = bpm; }

    if (holychordsButton) {
        if (srcUrl && srcUrl.trim() !== '' && srcUrl.trim() !== '#') {
            holychordsButton.href = srcUrl;
            holychordsButton.style.display = 'inline-block';
        } else {
            holychordsButton.href = '#';
            holychordsButton.style.display = 'none';
        }
    }

    const pLyrics = processLyrics(lyrics);
    const hLyrics = highlightChords(pLyrics);
    songContent.innerHTML = `<h2>${title} — <span class="math-inline">\{currentSelectedKey\}</h2\><pre\></span>{hLyrics}</pre>`;

    if (keySelect) {
        keySelect.value = currentSelectedKey;
        keySelect.dataset.index = index;
    }
    updateTransposedLyrics();

    const vId = extractYouTubeVideoId(ytLink);
    if (vId && playerContainer && playerSection) {
        playerContainer.innerHTML = `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${vId}?autoplay=0&modestbranding=1&rel=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        playerSection.style.display = 'block';
        if (keyDisplay) {
            if (videoKey) {
                keyDisplay.textContent = `Ориг. тональность видео: ${videoKey}`;
                keyDisplay.style.display = 'block';
            } else {
                keyDisplay.textContent = '';
                keyDisplay.style.display = 'none';
            }
        }
    } else {
        playerContainer.innerHTML = '';
        playerSection.style.display = 'none';
        if (keyDisplay) {
            keyDisplay.textContent = '';
            keyDisplay.style.display = 'none';
        }
    }
}


/** Обновление транспонирования */
function updateTransposedLyrics() {
    if (!keySelect || !songContent) return;

    const indexStr = keySelect.dataset.index;
    const newKey = keySelect.value;

    if (indexStr === null || indexStr === undefined || indexStr === "") {
         return;
    }

    const sheetName = SHEETS[sheetSelect.value];
    if (!sheetName || !cachedData[sheetName] || !cachedData[sheetName][indexStr]) {
         console.error("updateTransposedLyrics: Не найдены данные песни для транспонирования.", sheetName, indexStr);
         return;
    }

    const songData = cachedData[sheetName][indexStr];
    const originalKey = songData[2];
    const lyrics = songData[1] || '';

    const preElement = songContent.querySelector('pre');
    const h2Element = songContent.querySelector('h2');
    if (!preElement || !h2Element) {
         console.error("updateTransposedLyrics: Элементы H2 или PRE не найдены внутри songContent.");
         return;
    }

    const transposition = getTransposition(originalKey, newKey);
    const transposedLyrics = transposeLyrics(lyrics, transposition);
    const processedTransposedLyrics = processLyrics(transposedLyrics);
    const highlightedTransposedLyrics = highlightChords(processedTransposedLyrics);

    preElement.innerHTML = highlightedTransposedLyrics;
    h2Element.innerHTML = `${songData[0]} — ${newKey}`;
}


/** Загрузка песен листа в select */
async function loadSheetSongs() {
    const sheetNameValue = SHEETS[sheetSelect.value];
    if (!sheetNameValue) {
        songSelect.innerHTML = '<option value="">-- Сначала выберите лист --</option>';
        songSelect.disabled = true;
        return;
    }
    const rows = await fetchSheetData(sheetNameValue);

    songSelect.innerHTML = '<option value="">-- Выберите песню --</option>';
    if (rows && rows.length > 0) {
        rows.forEach((row, index) => {
            if (row && row[0]) {
                const option = document.createElement('option');
                option.value = index;
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

/** Обновление размера шрифта */
function updateFontSize() {
    const lyricsElement = songContent?.querySelector('pre');
    if (lyricsElement) {
        lyricsElement.style.fontSize = `${currentFontSize}px`;
    }
}

/** Сброс размера шрифта */
function resetFontSize() {
    currentFontSize = DEFAULT_FONT_SIZE;
    updateFontSize();
}

/** Загрузка избранного */
function loadFavorites(container = favoritesList) {
    if (!container) {
        console.error("Контейнер для избранных песен не найден."); return;
    }
    container.innerHTML = '';

    favorites = JSON.parse(localStorage.getItem('favorites')) || [];

    if (favorites.length === 0) {
        container.innerHTML = '<div class="empty-message">Нет избранных песен</div>';
        return;
    }

    favorites.forEach(fav => {
        const favoriteItem = document.createElement('div');
        favoriteItem.className = 'favorite-item';

        const songInfo = document.createElement('span');
        songInfo.className = 'song-name';
        songInfo.textContent = `${fav.name} — ${fav.key}`;
        favoriteItem.appendChild(songInfo);

        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.className = 'remove-button';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeFromFavorites(fav);
        });
        favoriteItem.appendChild(removeBtn);

        favoriteItem.addEventListener('click', async () => {
           const sheetNameValue = Object.keys(SHEETS).find(key => SHEETS[key] === fav.sheet);
           if(sheetNameValue) sheetSelect.value = sheetNameValue;
           if (!cachedData[fav.sheet]) await fetchSheetData(fav.sheet);
           await loadSheetSongs();
           songSelect.value = fav.index;
           displaySongDetails(cachedData[fav.sheet]?.[fav.index], fav.index, fav.key);
           if (favoritesPanel) favoritesPanel.classList.remove('open');
           if (repertoirePanel) repertoirePanel.classList.remove('open');
        });
        container.appendChild(favoriteItem);
    });
}

/** Удаление из избранного */
function removeFromFavorites(fav) {
    console.log("Попытка удаления из избранного:", fav);
    const index = favorites.findIndex(item =>
        item.name === fav.name &&
        item.sheet === fav.sheet &&
        item.index === fav.index &&
        item.key === fav.key
    );
    console.log("Найденный индекс для удаления:", index);

    if (index !== -1) {
        favorites.splice(index, 1);
        localStorage.setItem('favorites', JSON.stringify(favorites));
        console.log("Элемент удален, localStorage обновлен.");
        if (favoritesPanel?.classList.contains('open') && favoritesList) {
             loadFavorites(favoritesList);
        }
        alert("Песня удалена из 'Моего списка'.");
    } else {
        console.warn("Не удалось найти песню для удаления в массиве favorites.");
        alert("Не удалось удалить песню из 'Моего списка'.");
    }
}


/** Обновление BPM */
function updateBPM(newBPM) {
    if (!bpmDisplay) return;
    bpmDisplay.textContent = newBPM || 'N/A';
    if (isMetronomeActive) {
        const bpmValue = parseInt(newBPM, 10);
        if (!isNaN(bpmValue) && bpmValue > 0) {
            toggleMetronome(0);
            toggleMetronome(bpmValue);
        } else {
             toggleMetronome(0);
        }
    }
}

// --- METRONOME FUNCTIONS ---
function setupAudioContext() { /* ... без изменений ... */ }
function resumeAudioContext() { /* ... без изменений ... */ }
async function loadAudioFile() { /* ... без изменений ... */ }
function toggleMetronome(bpm) { /* ... без изменений ... */ }
function playClick() { /* ... без изменений ... */ }

// --- THEME FUNCTIONS ---
function applyTheme(themeName) { /* ... без изменений ... */ }
function toggleTheme() { /* ... без изменений ... */ }


// --- EVENT LISTENER SETUP ---
function setupEventListeners() {
    console.log("Настройка слушателей событий...");

    if(sheetSelect) sheetSelect.addEventListener('change', async () => {
        console.log("Sheet selected:", sheetSelect.value);
        if(searchInput) searchInput.value = '';
        if(searchResults) searchResults.innerHTML = '';
        await loadSheetSongs();
        displaySongDetails(null);
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
        const mergeIcon = '<i class="fas fa-align-justify"></i>';
        const splitText = '<span class="button-text">Разделить текст</span>';
        const mergeText = '<span class="button-text">Объединить колонки</span>';

        const updateSplitButton = () => {
            const isSplit = songContent.classList.contains('split-columns');
            const currentIcon = isSplit ? mergeIcon : splitIcon;
            const currentTextSpan = isSplit ? mergeText : splitText;
            const content = currentIcon + (isMobileView() ? '' : currentTextSpan);
            splitTextButton.innerHTML = content;
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
        updateSplitButton();

        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(updateSplitButton, 150);
        });
    }

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

    if (addToSetlistButton) {
        addToSetlistButton.addEventListener('click', addToCurrentSetlist);
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

    if (toggleFavoritesButton && favoritesPanel) {
        toggleFavoritesButton.addEventListener('click', () => {
            const isOpen = favoritesPanel.classList.toggle('open');
            if (isOpen) {
                if (repertoirePanel?.classList.contains('open')) repertoirePanel.classList.remove('open');
                // Загружаем и мой список и сет-листы при открытии панели
                loadFavorites();
                loadSetlists();
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


    if (startPresentationButton) {
        startPresentationButton.addEventListener('click', () => {
            console.log("Клик по кнопке 'Презентация' для сет-листа ID:", currentSetlistId);
            if (currentSetlistId && currentSetlistSongs && currentSetlistSongs.length > 0) {
                if (favoritesPanel?.classList.contains('open')) favoritesPanel.classList.remove('open');
                if (repertoirePanel?.classList.contains('open')) repertoirePanel.classList.remove('open');
                showPresentationView(currentSetlistSongs);
            } else {
                alert("Сет-лист не выбран или в нем нет песен для презентации.");
            }
        });
    } else { console.warn("Кнопка #start-presentation-button не найдена."); }

    if (deleteSetlistButton) {
        deleteSetlistButton.addEventListener('click', deleteCurrentSetlist);
    } else {
        console.warn("Кнопка #delete-setlist-button не найдена.");
    }


    if (presentationCloseBtn && presentationOverlay) {
        presentationCloseBtn.addEventListener('click', () => {
            presentationOverlay.classList.remove('visible');
            document.body.style.overflow = '';
            clearTimeout(controlsHideTimeout);
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.error(`Error attempting to exit fullscreen: <span class="math-inline">\{err\.message\} \(</span>{err.name})`));
            }
        });
    } // <--- Вот эта скобка ТОЧНО ЕСТЬ

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

    if(bpmDisplay) {
        bpmDisplay.addEventListener('blur', () => {
             const newText = bpmDisplay.textContent;
             const newBpm = parseInt(newText, 10);
             if (!isNaN(newBpm) && newBpm > 0) {
                 updateBPM(newBpm);
             } else {
                 // Может быть просто сбросить на старое значение?
                 alert('Пожалуйста, введите корректное числовое значение BPM.');
             }
        });
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

    console.log("Настройка слушателей презентации...");
    const prevBtn = document.getElementById('pres-prev-btn');
    const nextBtn = document.getElementById('pres-next-btn');
    const presSplitBtn = document.getElementById('pres-split-text-btn');

    if(prevBtn) { prevBtn.addEventListener('click', prevPresentationSong); }
    if(nextBtn) { nextBtn.addEventListener('click', nextPresentationSong); }
    if (presSplitBtn) {
         presSplitBtn.addEventListener('click', togglePresentationSplit);
         console.log("Слушатель для кнопки разделения текста в презентации добавлен.");
    }

    setupSwipeListeners();

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
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM loaded.");
    if (!favoritesPanel || !repertoirePanel || !songContent || !sheetSelect || !songSelect || !keySelect) {
        console.error("Критически важные элементы интерфейса не найдены в HTML!");
        alert("Ошибка инициализации интерфейса! Проверьте HTML структуру и ID элементов.");
        return;
    }

    let initialTheme = localStorage.getItem('theme');
    if (!initialTheme) {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            initialTheme = 'light';
        } else {
            initialTheme = 'dark';
        }
        console.log("Сохраненная тема не найдена, используется системная/умолчание:", initialTheme);
    } else {
         console.log("Найдена сохраненная тема:", initialTheme);
    }
    applyTheme(initialTheme);

    setupEventListeners(); // <--- Вызов настройки слушателей

    await loadAllSheetsData();
    await loadSheetSongs();
    await loadVocalists();
    // await loadAudioFile(); // Можно загружать по первому клику

    displaySongDetails(null);
    loadSetlists(); // Загружаем список сет-листов
    loadRepertoire(null); // Загрузка репертуара (если вокалист не выбран, покажет сообщение)

    console.log("App initialization complete.");
}); // <--- Конец DOMContentLoaded listener
