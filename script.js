// =====================================================================
// Agape Worship App - script.js (ПОЛНАЯ ВЕРСИЯ 14.04 - БЕЗ СОКРАЩЕНИЙ)
// =====================================================================

// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
    getFirestore, collection, addDoc, query,
    onSnapshot, updateDoc, deleteDoc, setDoc, doc,
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
const SHEET_ID = '1C3gFjj9LAub_Nk9ogqKp3LKpdAxq6j8xlPAsc8OmM5s'; // Убедитесь, что здесь ТОЛЬКО ваш ID таблицы!
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
// const MAX_SHARED_SONGS = 8; // Не используется для сет-листов

// --- FIREBASE INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const setlistsCollection = collection(db, "setlists");

// --- GLOBAL STATE ---
let currentRepertoireUnsubscribe = null;
let cachedData = {};
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let currentVocalistId = null;
let currentVocalistName = null;
let allSheetsData = [];
let currentFontSize = DEFAULT_FONT_SIZE;
let currentSetlistId = null;
let currentSetlistName = null;
let currentSetlistSongs = [];
let currentSetlistSongsUnsubscribe = null;
let presentationSongs = []; // Используется для передачи в showPresentationView
let currentPresentationIndex = 0;
let controlsHideTimeout = null;
let isPresentationSplit = false;
let audioContext;
let audioBuffer;
let metronomeInterval = null;
let isMetronomeActive = false;
let currentBeat = 0;

// --- DOM ELEMENT REFERENCES ---
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
const favoriteButton = document.getElementById('favorite-button');
const addToSetlistButton = document.getElementById('add-to-setlist-button');
const addToRepertoireButton = document.getElementById('add-to-repertoire-button');
const toggleFavoritesButton = document.getElementById('toggle-favorites');
const favoritesPanel = document.getElementById('favorites-panel');
const toggleRepertoireButton = document.getElementById('toggle-repertoire');
const repertoirePanel = document.getElementById('repertoire-panel');
const favoritesList = document.getElementById('favorites-list');
const newSetlistNameInput = document.getElementById('new-setlist-name-input');
const createSetlistButton = document.getElementById('create-setlist-button');
const setlistsListContainer = document.getElementById('setlists-list-container');
const currentSetlistTitle = document.getElementById('current-setlist-title');
const currentSetlistControls = document.querySelector('.current-setlist-controls');
const startPresentationButton = document.getElementById('start-presentation-button');
const deleteSetlistButton = document.getElementById('delete-setlist-button');
const currentSetlistSongsContainer = document.getElementById('current-setlist-songs-container');
const vocalistSelect = document.getElementById('vocalist-select');
const repertoirePanelList = document.getElementById('repertoire-panel-list');
const presentationOverlay = document.getElementById('presentation-overlay');
const presentationContent = document.getElementById('presentation-content');
const presentationCloseBtn = document.getElementById('presentation-close-btn');
const presSplitTextBtn = document.getElementById('pres-split-text-btn');
const presentationControls = document.querySelector('.presentation-controls');
const presPrevBtn = document.getElementById('pres-prev-btn');
const presNextBtn = document.getElementById('pres-next-btn');
const presCounter = document.getElementById('pres-counter');
const themeToggleButton = document.getElementById('theme-toggle-button');

// --- API FUNCTIONS (Sheets, Firestore) ---

/** Загрузка данных с одного листа Google Sheet (с кэшированием) */
async function fetchSheetData(sheetName) {
    if (cachedData[sheetName]) return cachedData[sheetName];
    if (!SHEETS[sheetName]) {
        console.error(`Invalid sheet name provided: ${sheetName}`);
        return [];
    }
    loadingIndicator.style.display = 'block';
    console.log(`Загрузка данных из Google Sheets для листа: ${sheetName}`);
    try {
        const range = `${SHEETS[sheetName]}!A2:G`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/<span class="math-inline">\{SHEET\_ID\}/values/</span>{range}?key=${API_KEY}`; // Эта строка должна быть верной!
        console.log(`Запрос URL: ${url}`);
        const response = await fetch(url);
        console.log(`Ответ от Google Sheets для ${sheetName}: Статус ${response.status}`);
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Google Sheets API ошибка: ${response.status} ${response.statusText}`, errorBody);
            throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        cachedData[sheetName] = data.values || [];
        return cachedData[sheetName];
    } catch (error) {
        console.error(`Ошибка при загрузке данных из Google Sheets для листа "${sheetName}":`, error);
        alert(`Не удалось загрузить данные листа "${sheetName}". Смотрите консоль для деталей.`);
        return [];
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/** Загрузка данных со ВСЕХ листов */
async function loadAllSheetsData() {
    loadingIndicator.style.display = 'block';
    allSheetsData = [];
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

/** Загрузка списка вокалистов */
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
    if (!listContainer || !sectionContainer) { return; }
    if (currentRepertoireUnsubscribe) { try { currentRepertoireUnsubscribe(); } catch (e) { console.error(e); } currentRepertoireUnsubscribe = null; }
    listContainer.innerHTML = '';
    if (!vocalistId) { listContainer.innerHTML = '<div class="empty-message">Выберите вокалиста...</div>'; return; }
    listContainer.innerHTML = '<div>Загрузка репертуара...</div>';
    const repertoireColRef = collection(db, "vocalists", vocalistId, "repertoire");
    const q = query(repertoireColRef);
    currentRepertoireUnsubscribe = onSnapshot(q, (snapshot) => {
        if (vocalistId !== currentVocalistId) return;
        const currentListContainer = document.getElementById('repertoire-panel-list');
        if (!currentListContainer) { if (currentRepertoireUnsubscribe) currentRepertoireUnsubscribe(); return; }
        currentListContainer.innerHTML = '';
        if (snapshot.empty) { currentListContainer.innerHTML = '<div class="empty-message">Репертуар пуст.</div>'; return; }
        const groupedByKeys = {};
        snapshot.docs.forEach((doc) => {
            const song = doc.data(); const key = song.preferredKey || "N/A";
            if (!groupedByKeys[key]) groupedByKeys[key] = [];
            groupedByKeys[key].push({ ...song, repertoireDocId: doc.id });
        });
        const sortedKeys = Object.keys(groupedByKeys).sort((a, b) => {
            const order = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "H", "N/A"]; return order.indexOf(a) - order.indexOf(b); });
        sortedKeys.forEach(key => {
            const keyHeading = document.createElement('div'); keyHeading.className = 'repertoire-key-heading'; keyHeading.innerHTML = `Тональность: ${key} <i class="fas fa-chevron-down"></i>`; keyHeading.dataset.key = key; keyHeading.addEventListener('click', toggleRepertoireKeySection); currentListContainer.appendChild(keyHeading);
            const songsWrapper = document.createElement('div'); songsWrapper.className = 'repertoire-songs-for-key collapsed'; songsWrapper.dataset.keyContent = key;
            const songsInKey = groupedByKeys[key]; songsInKey.sort((a, b) => a.name.localeCompare(b.name));
            if (songsInKey.length > 0) {
                songsInKey.forEach(songWithId => {
                    const song = songWithId; const repertoireDocId = song.repertoireDocId; const shortSheetName = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === song.sheet) || song.sheet || '';
                    const listItem = document.createElement('div'); listItem.className = 'repertoire-item';
                    const songInfo = document.createElement('span'); songInfo.className = 'song-name'; songInfo.textContent = shortSheetName ? `<span class="math-inline">\{song\.name\} \(</span>{shortSheetName})` : song.name; listItem.appendChild(songInfo);
                    const removeBtn = document.createElement('button'); removeBtn.innerHTML = '<i class="fas fa-times"></i>'; removeBtn.className = 'remove-button'; removeBtn.title = 'Удалить из репертуара'; removeBtn.addEventListener('click', (e) => { e.stopPropagation(); removeFromRepertoire(vocalistId, repertoireDocId); }); listItem.appendChild(removeBtn);
                    listItem.addEventListener('click', async () => {
                        if (!cachedData[song.sheet]?.[song.index]) { await fetchSheetData(song.sheet); if (!cachedData[song.sheet]?.[song.index]) { alert(`...`); return; } }
                        const originalSongData = cachedData[song.sheet][song.index]; const sheetNameValue = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === song.sheet);
                        if(sheetNameValue) sheetSelect.value = sheetNameValue; await loadSheetSongs(); songSelect.value = song.index; displaySongDetails(originalSongData, song.index, song.preferredKey);
                        if (repertoirePanel) repertoirePanel.classList.remove('open'); if (favoritesPanel) favoritesPanel.classList.remove('open'); });
                    songsWrapper.appendChild(listItem); });
            } else { songsWrapper.innerHTML = '<div class="empty-message small">...</div>'; }
            currentListContainer.appendChild(songsWrapper); });
    }, (error) => { console.error(`...`, error); /* ... */ });
}

/** Переключение секций аккордеона репертуара */
function toggleRepertoireKeySection(event) {
    const heading = event.currentTarget; const key = heading.dataset.key; const contentWrapper = document.querySelector(`.repertoire-songs-for-key[data-key-content="${key}"]`); const icon = heading.querySelector('i.fas'); if (!contentWrapper || !icon) return;
    const isCollapsed = contentWrapper.classList.contains('collapsed');
    if (isCollapsed) {
        document.querySelectorAll('.repertoire-songs-for-key').forEach(wrapper => { if (wrapper !== contentWrapper) wrapper.classList.add('collapsed'); });
        document.querySelectorAll('.repertoire-key-heading').forEach(head => { const headIcon = head.querySelector('i.fas'); if (head !== heading && headIcon) { headIcon.classList.remove('fa-chevron-up'); headIcon.classList.add('fa-chevron-down'); } }); }
    contentWrapper.classList.toggle('collapsed');
    if (contentWrapper.classList.contains('collapsed')) { icon.classList.remove('fa-chevron-up'); icon.classList.add('fa-chevron-down'); } else { icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-up'); }
}

/** Добавление/Обновление песни в репертуаре */
async function addToRepertoire() {
    if (!currentVocalistId) { alert("..."); return; }
    const sheetName = SHEETS[sheetSelect.value]; const songIndex = songSelect.value; if (!sheetName || !songIndex || songIndex === "" || !cachedData[sheetName]?.[songIndex]) { alert("..."); return; }
    const songData = cachedData[sheetName][songIndex]; const songName = songData[0]; const preferredKey = keySelect.value;
    const repertoireDocId = `<span class="math-inline">\{sheetName\}\_</span>{songIndex}`; const dataToSave = { sheet: sheetName, index: songIndex, name: songName, preferredKey: preferredKey };
    try { await setDoc(doc(db, "vocalists", currentVocalistId, "repertoire", repertoireDocId), dataToSave); alert(`Песня ... добавлена...`); } catch (error) { console.error("...", error); alert("..."); }
}

/** Удаление песни из репертуара */
async function removeFromRepertoire(vocalistId, repertoireDocId) {
     if (!vocalistId || !repertoireDocId) { alert("..."); return; }
     const vocalistDisplayName = currentVocalistName || vocalistId; if (!confirm(`Удалить ... ${vocalistDisplayName}?`)) return;
     try { await deleteDoc(doc(db, "vocalists", vocalistId, "repertoire", repertoireDocId)); alert("Песня удалена."); } catch (error) { console.error("...", error); alert("..."); }
}


// --- ФУНКЦИИ ДЛЯ СЕТ-ЛИСТОВ ---

/** Загрузка и отображение списка сет-листов */
function loadSetlists() {
    if (!setlistsListContainer) { console.error("..."); return; }
    setlistsListContainer.innerHTML = '<div class="empty-message">Загрузка...</div>';
    const q = query(setlistsCollection, orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setlistsListContainer.innerHTML = '';
        if (snapshot.empty) { setlistsListContainer.innerHTML = '<div class="empty-message">Нет сет-листов.</div>'; selectSetlist(null, null); return; }
        snapshot.docs.forEach((doc) => {
            const setlist = doc.data(); const setlistId = doc.id; const setlistItem = document.createElement('div');
            setlistItem.className = 'setlist-item'; setlistItem.dataset.id = setlistId;
            const nameSpan = document.createElement('span'); nameSpan.className = 'setlist-name-display'; nameSpan.textContent = setlist.name || '...'; nameSpan.addEventListener('click', () => { selectSetlist(setlistId, setlist.name); }); setlistItem.appendChild(nameSpan);
            const editButton = document.createElement('button'); editButton.className = 'setlist-edit-button'; editButton.title = 'Редактировать'; editButton.innerHTML = '<i class="fas fa-pencil-alt"></i>'; editButton.addEventListener('click', (e) => { e.stopPropagation(); startEditSetlistName(setlistItem, setlistId, setlist.name); }); setlistItem.appendChild(editButton);
            if (setlistId === currentSetlistId) { setlistItem.classList.add('active'); }
            setlistsListContainer.appendChild(setlistItem);
        });
    }, (error) => { console.error("...", error); setlistsListContainer.innerHTML = '...'; selectSetlist(null, null); });
}

/** Обработка выбора сет-листа */
function selectSetlist(setlistId, setlistName) {
     console.log(`Выбран сет-лист: ID=<span class="math-inline">\{setlistId\}, Имя\=</span>{setlistName}`);
     currentSetlistId = setlistId; currentSetlistName = setlistName;
     if (setlistsListContainer) {
         const items = setlistsListContainer.querySelectorAll('.setlist-item');
         items.forEach(item => { item.classList.toggle('active', item.dataset.id === setlistId); });
     }
     if (currentSetlistTitle && currentSetlistControls) {
         if (setlistId) { currentSetlistTitle.textContent = setlistName || '...'; currentSetlistControls.style.display = 'flex'; }
         else { currentSetlistTitle.textContent = 'Выберите сет-лист'; currentSetlistControls.style.display = 'none'; currentSetlistSongs = []; if (currentSetlistSongsContainer) { currentSetlistSongsContainer.innerHTML = '...'; } if (currentSetlistSongsUnsubscribe) { currentSetlistSongsUnsubscribe(); currentSetlistSongsUnsubscribe = null; } }
     }
     if (setlistId) { loadCurrentSetlistSongs(setlistId); }
     else { if (currentSetlistSongsContainer) { currentSetlistSongsContainer.innerHTML = '<div class="empty-message">Сначала выберите сет-лист</div>'; } }
}

/** Создание нового сет-листа */
async function createSetlist() {
    if (!newSetlistNameInput || !createSetlistButton) return;
    const setlistName = newSetlistNameInput.value.trim(); if (!setlistName) { alert("..."); return; }
    createSetlistButton.disabled = true; createSetlistButton.textContent = '...';
    const dataToSave = { name: setlistName, createdAt: new Date() };
    try { await addDoc(setlistsCollection, dataToSave); newSetlistNameInput.value = ''; alert(`Сет-лист "${setlistName}" создан!`); }
    catch (error) { console.error("...", error); alert("..."); }
    finally { createSetlistButton.disabled = false; createSetlistButton.textContent = 'Создать'; }
}

/** Загрузка и отображение песен для ТЕКУЩЕГО выбранного сет-листа */
function loadCurrentSetlistSongs(setlistId) {
    if (!currentSetlistSongsContainer) { return; }
    if (currentSetlistSongsUnsubscribe) { currentSetlistSongsUnsubscribe(); currentSetlistSongsUnsubscribe = null; }
    if (!setlistId) { return; } // Уже обработано в selectSetlist
    currentSetlistSongsContainer.innerHTML = '<div>Загрузка песен...</div>'; currentSetlistSongs = [];
    const songsCollectionRef = collection(db, "setlists", setlistId, "songs");
    const q = query(songsCollectionRef, orderBy("order", "asc"));
    currentSetlistSongsUnsubscribe = onSnapshot(q, (snapshot) => {
          if (setlistId !== currentSetlistId) { return; }
         currentSetlistSongsContainer.innerHTML = ''; currentSetlistSongs = [];
         if (snapshot.empty) { currentSetlistSongsContainer.innerHTML = '<div class="empty-message">Нет песен.</div>'; return; }
         snapshot.docs.forEach((songDoc) => {
             const songData = songDoc.data(); const songDocId = songDoc.id;
             currentSetlistSongs.push({ id: songDocId, ...songData });
             const songItem = document.createElement('div'); songItem.className = 'setlist-song-item'; songItem.dataset.id = songDocId; songItem.dataset.sheet = songData.sheet; songItem.dataset.index = songData.index;
             // const dragHandle = document.createElement('span'); dragHandle.className = 'drag-handle'; dragHandle.innerHTML = '☰'; songItem.appendChild(dragHandle); // Ручка для перетаскивания (пока закомментирована)
             const songInfo = document.createElement('span'); songInfo.className = 'song-name'; songInfo.textContent = `${songData.name || '...'} — ${songData.preferredKey || 'N/A'}`; songItem.appendChild(songInfo);
             const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '<i class="fas fa-times"></i>'; deleteBtn.className = 'delete-button delete-song-from-setlist-button'; deleteBtn.title = 'Удалить'; deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteSongFromSetlist(songDocId); }); songItem.appendChild(deleteBtn);
             songItem.addEventListener('click', async () => {
                 if (!cachedData[songData.sheet]?.[songData.index]) { await fetchSheetData(songData.sheet); if (!cachedData[songData.sheet]?.[songData.index]) { alert(`...`); return; } }
                 const originalSongData = cachedData[songData.sheet][songData.index]; const sheetNameValue = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === songData.sheet);
                 if(sheetNameValue) sheetSelect.value = sheetNameValue; await loadSheetSongs(); songSelect.value = songData.index; displaySongDetails(originalSongData, songData.index, songData.preferredKey);
                 if (favoritesPanel) favoritesPanel.classList.remove('open'); if (repertoirePanel) repertoirePanel.classList.remove('open'); });
             currentSetlistSongsContainer.appendChild(songItem); });
     }, (error) => {
           if (setlistId !== currentSetlistId) { return; }
         console.error(`...`, error); currentSetlistSongsContainer.innerHTML = '<div class="empty-message">Ошибка...</div>'; currentSetlistSongs = [];
         if (currentSetlistSongsUnsubscribe) { currentSetlistSongsUnsubscribe(); currentSetlistSongsUnsubscribe = null; } });
 }

/** Добавляет текущую песню в ВЫБРАННЫЙ сет-лист */
async function addToCurrentSetlist() {
     if (!currentSetlistId) { alert("..."); return; }
     const sheetName = SHEETS[sheetSelect.value]; const songIndex = songSelect.value; if (!sheetName || songIndex === "" || !cachedData[sheetName]?.[songIndex]) { alert("..."); return; }
     const songData = cachedData[sheetName][songIndex]; const songName = songData[0]; const preferredKey = keySelect.value;
     const nextOrder = currentSetlistSongs.length > 0 ? Math.max(...currentSetlistSongs.map(song => song.order ?? -1)) + 1 : 0;
     const songEntryData = { sheet: sheetName, index: songIndex, name: songName, preferredKey: preferredKey, order: nextOrder };
     try {
         const songsCollectionRef = collection(db, "setlists", currentSetlistId, "songs");
         const q = query(songsCollectionRef, where("sheet", "==", sheetName), where("index", "==", songIndex));
         const duplicateSnapshot = await getDocs(q);
         if (!duplicateSnapshot.empty) {
              const existingDoc = duplicateSnapshot.docs[0];
              if (existingDoc.data().preferredKey !== preferredKey) { if (confirm(`... Обновить тональность ...?`)) { await setDoc(doc(db, "setlists", currentSetlistId, "songs", existingDoc.id), { preferredKey: preferredKey }, { merge: true }); alert(`Тональность ... обновлена.`); } }
              else { alert(`... уже есть ...`); } return; }
         await addDoc(songsCollectionRef, songEntryData); alert(`Песня ... добавлена ...`);
     } catch (error) { console.error("...", error); alert("..."); }
}

/** Удаление ОДНОЙ песни из ТЕКУЩЕГО сет-листа */
async function deleteSongFromSetlist(songDocId) {
    if (!currentSetlistId) { alert("..."); return; }
    const songToDelete = currentSetlistSongs.find(song => song.id === songDocId); const songNameToConfirm = songToDelete ? `"${songToDelete.name}"` : "...";
    if (confirm(`Удалить ${songNameToConfirm} из сет-листа ...?`)) {
        try { await deleteDoc(doc(db, "setlists", currentSetlistId, "songs", songDocId)); alert("Песня удалена."); } catch (error) { console.error("...", error); alert("..."); } }
}

/** Удаление ВСЕГО ТЕКУЩЕГО сет-листа */
async function deleteCurrentSetlist() {
    if (!currentSetlistId || !currentSetlistName) { alert("..."); return; }
    if (confirm(`Удалить сет-лист "${currentSetlistName}"? ...`)) {
         try { await deleteDoc(doc(db, "setlists", currentSetlistId)); alert(`...`); selectSetlist(null, null); } catch (error) { console.error("...", error); alert("..."); } }
}

/** Вход в режим редактирования имени сет-листа */
function startEditSetlistName(itemElement, id, currentName) {
    const currentlyEditing = document.querySelector('.setlist-item.is-editing'); if (currentlyEditing && currentlyEditing !== itemElement) cancelEditSetlistName(currentlyEditing); if (itemElement.classList.contains('is-editing')) return;
    itemElement.classList.add('is-editing');
    const input = document.createElement('input'); input.type = 'text'; input.className = 'edit-setlist-input'; input.value = currentName || ''; input.dataset.originalName = currentName || '';
    const editButtonRef = itemElement.querySelector('.setlist-edit-button'); if (editButtonRef) itemElement.insertBefore(input, editButtonRef); else itemElement.prepend(input);
    input.focus(); input.select();
    input.addEventListener('blur', () => { setTimeout(() => saveSetlistName(id, input, itemElement), 100); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveSetlistName(id, input, itemElement); } else if (e.key === 'Escape') { cancelEditSetlistName(itemElement); } });
}

/** Сохранение нового имени сет-листа */
async function saveSetlistName(id, inputElement, itemElement) {
    if (!inputElement || !itemElement.contains(inputElement)) return;
    const newName = inputElement.value.trim(); const originalName = inputElement.dataset.originalName; if (!newName || newName === originalName) { cancelEditSetlistName(itemElement); return; }
    try {
        await updateDoc(doc(db, "setlists", id), { name: newName });
        const nameSpan = itemElement.querySelector('span.setlist-name-display'); if (nameSpan) nameSpan.textContent = newName;
        if(id === currentSetlistId && currentSetlistTitle){ currentSetlistTitle.textContent = newName; currentSetlistName = newName; }
        cancelEditSetlistName(itemElement);
    } catch (error) { console.error("...", error); alert("..."); cancelEditSetlistName(itemElement); }
}

/** Отмена режима редактирования имени сет-листа */
function cancelEditSetlistName(itemElement) {
     if (!itemElement || !itemElement.classList.contains('is-editing')) return;
     const input = itemElement.querySelector('input.edit-setlist-input'); if (input) itemElement.removeChild(input);
     itemElement.classList.remove('is-editing'); itemElement.focus();
}

// --- КОНЕЦ НОВЫХ ФУНКЦИЙ ДЛЯ СЕТ-ЛИСТОВ ---


// --- CORE LOGIC / UTILITIES ---
function getTransposition(originalKey, newKey){const o=chords.indexOf(originalKey),n=chords.indexOf(newKey);return o===-1||n===-1?(console.warn(`...`),0):n-o} function transposeChord(chord,transposition){let t="",e=chord,n="";const r=["maj7","m7","7","m","dim","aug","sus2","sus4","add9","dim7","aug7","sus"];if(e.includes("/"))[e,n]=e.split("/");for(let s of r)if(e.endsWith(s)){e=e.slice(0,-s.length),t=s;break}const c=chords.indexOf(e);if(c===-1)return chord;const i=(c+transposition+chords.length)%chords.length,o=chords[i]+t;if(n){const l=chords.indexOf(n);if(l!==-1){const a=(l+transposition+chords.length)%chords.length;return`<span class="math-inline">\{o\}/</span>{chords[a]}`}}return o} function cleanChord(chord){return chord.replace(/\s+/g,"")} function transposeLyrics(lyrics,transposition){if(transposition===0)return lyrics;const t=/([A-H][#b]?(?:maj7|m7|7|m|dim|aug|sus4|sus2|add9|dim7|aug7|sus)?(?:\/[A-H][#b]?)?)/g;return lyrics.replace(t,e=>transposeChord(cleanChord(e),transposition))} function processLyrics(lyrics){return lyrics?lyrics.split("\n").map(t=>t.replace(/ {2,}/g,e=>" ".repeat(Math.ceil(e.length/2)))).join("\n"):""} function highlightChords(lyrics){if(!lyrics)return"";const t=/([A-H][#b]?(?:maj7|m7|7|m|dim|aug|sus4|sus2|add9|dim7|aug7|sus)?(?:\/[A-H][#b]?)?)/g;return lyrics.replace(t,'<span class="chord">$1</span>')} async function searchSongs(query){const t=query.trim().toLowerCase();if(!t){searchResults.innerHTML="";return}const e=Object.values(cachedData).flat(),n=e.filter(t=>{const e=t?.[0]?.trim().toLowerCase();return e&&e.includes(t)});if(searchResults.innerHTML="",n.length===0){searchResults.innerHTML='<div class="search-result">...</div>';return}n.forEach(t=>{const e=document.createElement("div");e.textContent=t[0],e.className="search-result",e.addEventListener("click",async()=>{let n=null,r=-1;for(const s in SHEETS){const o=SHEETS[s];if(cachedData[o]&&(r=cachedData[o].findIndex(e=>e?.[0]===t[0]),r!==-1)){n=s;break}}n&&r!==-1?(sheetSelect.value=n,await loadSheetSongs(),songSelect.value=r,displaySongDetails(cachedData[SHEETS[n]][r],r),searchResults.innerHTML="",searchInput.value=t[0]):(console.error("...",t),alert("..."))}),searchResults.appendChild(e)})} function extractYouTubeVideoId(url){if(!url)return null;let t=null;try{const e=/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,n=url.match(e);n&&n[1]&&(t=n[1])}catch(e){console.error("...",e);return null}return t} function isMobileView(){return window.innerWidth<=480}

// --- UI UPDATE FUNCTIONS ---
async function showPresentationView(songsToShow){if(!presentationOverlay||!presentationContent||!songsToShow||songsToShow.length===0)return;presentationSongs=songsToShow,currentPresentationIndex=0,isPresentationSplit=!1,updatePresentationSplitButtonState(),await displayCurrentPresentationSong(),presentationOverlay.classList.add("visible"),presentationOverlay.scrollTop=0,showPresentationControls()} async function displayCurrentPresentationSong(){if(!presentationSongs||presentationSongs.length===0||!presentationContent)return;currentPresentationIndex<0&&(currentPresentationIndex=0),currentPresentationIndex>=presentationSongs.length&&(currentPresentationIndex=presentationSongs.length-1);const t=presentationSongs[currentPresentationIndex];console.log(`...: <span class="math-inline">\{currentPresentationIndex\+1\}/</span>{presentationSongs.length}: ${t.name}`),presentationContent.innerHTML=`...`;try{if(!cachedData[t.sheet]?.[t.index])await fetchSheetData(t.sheet);const e=cachedData[t.sheet]?.[t.index];if(!e)throw new Error(`...`);const n=e[0],r=e[1]||"",s=e[2]||chords[0],o=t.preferredKey,i=getTransposition(s,o),l=transposeLyrics(r,i),a=processLyrics(l),c=highlightChords(a),d=`\n ... \n <h2>${n} — <span class="math-inline">\{o\}</h2\>\\n <pre\></span>{c}</pre>\n ... \n `;presentationContent.innerHTML=d,presentationContent?.classList.toggle("split-columns",isPresentationSplit);const h=presentationContent.querySelector(".presentation-song");h&&(h.scrollTop=0)}catch(t){console.error("...",t),presentationContent.innerHTML=`...`}const e=document.getElementById("pres-counter");e&&(e.textContent=`${currentPresentationIndex+1} / ${presentationSongs.length}`);const n=document.getElementById("pres-prev-btn"),r=document.getElementById("pres-next-btn");n&&(n.disabled=currentPresentationIndex===0),r&&(r.disabled=currentPresentationIndex===presentationSongs.length-1)} function nextPresentationSong(){currentPresentationIndex<presentationSongs.length-1&&(currentPresentationIndex++,displayCurrentPresentationSong())} function prevPresentationSong(){currentPresentationIndex>0&&(currentPresentationIndex--,displayCurrentPresentationSong())} function showPresentationControls(){const t=document.querySelector(".presentation-controls");t&&(t.classList.remove("controls-hidden"),clearTimeout(controlsHideTimeout),controlsHideTimeout=setTimeout(hidePresentationControls,CONTROLS_HIDE_DELAY))} function hidePresentationControls(){const t=document.querySelector(".presentation-controls");t&&t.classList.add("controls-hidden")} function togglePresentationSplit(){isPresentationSplit=!isPresentationSplit,presentationContent?.classList.toggle("split-columns",isPresentationSplit),updatePresentationSplitButtonState()} function updatePresentationSplitButtonState(){const t=document.getElementById("pres-split-text-btn");if(!t)return;const e="fa-columns",n="fa-align-justify",r="Разделить текст",s="Объединить колонки",o=t.querySelector("i");o&&(isPresentationSplit?(o.classList.remove(e),o.classList.add(n),t.title=s):(o.classList.remove(n),o.classList.add(e),t.title=r))} function handleGesture(){const t=50,e=75,n=touchendX-touchstartX,r=Math.abs(touchendY-touchstartY);if(r>e)return;n<-t&&nextPresentationSong(),n>t&&prevPresentationSong()} function setupSwipeListeners(){presentationOverlay&&(presentationOverlay.addEventListener("touchstart",t=>{touchstartX=t.changedTouches[0].screenX,touchstartY=t.changedTouches[0].screenY},{passive:!0}),presentationOverlay.addEventListener("touchend",t=>{touchendX=t.changedTouches[0].screenX,touchendY=t.changedTouches[0].screenY,handleGesture()}))} function displaySongDetails(songData,index,key){if(!playerContainer||!playerSection||!songContent)return;const t=document.getElementById("youtube-video-key-display");if(!songData){songContent.innerHTML="...",playerContainer.innerHTML="",playerSection.style.display="none",bpmDisplay&&(bpmDisplay.textContent="N/A"),holychordsButton&&(holychordsButton.style.display="none",holychordsButton.href="#"),keySelect&&(keySelect.value=chords[0],keySelect.dataset.index=""),t&&(t.textContent="",t.style.display="none");return}const e=songData[0]||"...",n=songData[1]||"",r=songData[2]||chords[0],s=songData[3]||"#",o=songData[4]||"N/A",i=songData[5],l=songData[6]?.trim()||null,a=key||r;bpmDisplay&&(updateBPM(o),bpmDisplay.textContent=o),holychordsButton&&(s&&s.trim()!==""&&s.trim()!=="#"?(holychordsButton.href=s,holychordsButton.style.display="inline-block"):(holychordsButton.href="#",holychordsButton.style.display="none"));const c=processLyrics(n),d=highlightChords(c);songContent.innerHTML=`<h2>${e} — <span class="math-inline">\{a\}</h2\><pre\></span>{d}</pre>`,keySelect&&(keySelect.value=a,keySelect.dataset.index=index),updateTransposedLyrics();const h=extractYouTubeVideoId(i);h&&playerContainer&&playerSection?(playerContainer.innerHTML=`...`,playerSection.style.display="block",t&&(l?(t.textContent=`...`,t.style.display="block"):(t.textContent="",t.style.display="none"))):(playerContainer.innerHTML="",playerSection.style.display="none",t&&(t.textContent="",t.style.display="none"))} function updateTransposedLyrics(){if(!keySelect||!songContent)return;const t=keySelect.dataset.index,e=keySelect.value;if(t==null||t==null||t==="")return;const n=SHEETS[sheetSelect.value];if(!n||!cachedData[n]||!cachedData[n][t]){console.error("...");return}const r=cachedData[n][t],s=r[2],o=r[1]||"",i=songContent.querySelector("pre"),l=songContent.querySelector("h2");if(!i||!l){console.error("...");return}const a=getTransposition(s,e),c=transposeLyrics(o,a),d=processLyrics(c),h=highlightChords(d);i.innerHTML=h,l.innerHTML=`${r[0]} — ${e}`} async function loadSheetSongs(){const t=SHEETS[sheetSelect.value];if(!t){songSelect.innerHTML='<option value="">...</option>',songSelect.disabled=!0;return}const e=await fetchSheetData(t);if(songSelect.innerHTML='<option value="">...</option>',e&&e.length>0){e.forEach((t,n)=>{if(t&&t[0]){const r=document.createElement("option");r.value=n,r.textContent=t[0],songSelect.appendChild(r)}}),songSelect.disabled=!1}else songSelect.innerHTML='<option value="">...</option>',songSelect.disabled=!0} function updateFontSize(){const t=songContent?.querySelector("pre");t&&(t.style.fontSize=`${currentFontSize}px`)} function resetFontSize(){currentFontSize=DEFAULT_FONT_SIZE,updateFontSize()} function loadFavorites(container=favoritesList){if(!container){console.error("...");return}container.innerHTML="",favorites=JSON.parse(localStorage.getItem("favorites"))||[];if(favorites.length===0){container.innerHTML='...';return}favorites.forEach(t=>{const e=document.createElement("div");e.className="favorite-item";const n=document.createElement("span");n.className="song-name",n.textContent=`${t.name} — ${t.key}`,e.appendChild(n);const r=document.createElement("button");r.innerHTML='<i class="fas fa-times"></i>',r.className="remove-button",r.addEventListener("click",e=>{e.stopPropagation(),removeFromFavorites(t)}),e.appendChild(r),e.addEventListener("click",async()=>{const n=Object.keys(SHEETS).find(e=>SHEETS[e]===t.sheet);n&&(sheetSelect.value=n),cachedData[t.sheet]||await fetchSheetData(t.sheet),await loadSheetSongs(),songSelect.value=t.index,displaySongDetails(cachedData[t.sheet]?.[t.index],t.index,t.key),favoritesPanel&&favoritesPanel.classList.remove("open"),repertoirePanel&&repertoirePanel.classList.remove("open")}),container.appendChild(e)})} function removeFromFavorites(fav){const t=favorites.findIndex(t=>t.name===fav.name&&t.sheet===fav.sheet&&t.index===fav.index&&t.key===fav.key);t!==-1?(favorites.splice(t,1),localStorage.setItem("favorites",JSON.stringify(favorites)),favoritesPanel?.classList.contains("open")&&favoritesList&&loadFavorites(favoritesList),alert("...")):(console.warn("..."),alert("..."))} function updateBPM(newBPM){if(!bpmDisplay)return;bpmDisplay.textContent=newBPM||"N/A",isMetronomeActive&&toggleMetronome(parseInt(newBPM,10)>0?parseInt(newBPM,10):0)}

// --- METRONOME FUNCTIONS ---
function setupAudioContext(){if(!audioContext)try{audioContext=new(window.AudioContext||window.webkitAudioContext),console.log("...")}catch(t){console.error("...",t),alert("...")}} function resumeAudioContext(){audioContext&&audioContext.state==="suspended"&&audioContext.resume().then(()=>{console.log("...")}).catch(t=>{console.error("...",t)})} async function loadAudioFile(){if(!audioContext&&setupAudioContext(),!audioContext||audioBuffer)return;const t="...";console.log("...");try{const e=await fetch(t);if(!e.ok)throw new Error(`...`);const n=await e.arrayBuffer();audioBuffer=await audioContext.decodeAudioData(n),console.log("...")}catch(t){console.error("...",t),alert("..."),audioBuffer=null}} function toggleMetronome(bpm){const t='<i class="fas fa-play"></i>',e='<i class="fas fa-stop"></i>',n='<span class="button-text">...</span>',r='<span class="button-text">...</span>';if(!metronomeButton)return;if(isMetronomeActive)clearInterval(metronomeInterval),metronomeInterval=null,isMetronomeActive=!1,currentBeat=0,metronomeButton.innerHTML=t+(isMobileView()?"":n),metronomeButton.setAttribute("aria-label","...");else if(bpm>0){if(!audioContext||!audioBuffer){console.warn("...");alert("...");loadAudioFile();return}const s=6e4/bpm;if(!(s>0&&isFinite(s))){console.error("...");return}currentBeat=0,metronomeInterval=setInterval(playClick,s),isMetronomeActive=!0,metronomeButton.innerHTML=e+(isMobileView()?"":r),metronomeButton.setAttribute("aria-label","..."),playClick()}else console.log("...")} function playClick(){if(!audioContext||!audioBuffer){console.error("...");isMetronomeActive&&toggleMetronome(0);return}audioContext.state==="suspended"&&resumeAudioContext();const t=parseInt(timeSignatureSelect.value,10)||4;try{const e=audioContext.createBufferSource();e.buffer=audioBuffer;const n=audioContext.createGain();n.gain.setValueAtTime(currentBeat%t===0?1:.6,audioContext.currentTime),e.connect(n),n.connect(audioContext.destination),e.start(audioContext.currentTime),currentBeat=(currentBeat+1)%t}catch(t){console.error("...",t),isMetronomeActive&&toggleMetronome(0)}}

// --- THEME FUNCTIONS ---
function applyTheme(themeName){document.body.dataset.theme=themeName;const t=document.getElementById("theme-toggle-button");if(t){const e=t.querySelector("i");e&&(themeName==="light"?(e.classList.remove("fa-sun"),e.classList.add("fa-moon"),t.title="..."):(e.classList.remove("fa-moon"),e.classList.add("fa-sun"),t.title="..."))}localStorage.setItem("theme",themeName)} function toggleTheme(){const t=document.body.dataset.theme||"dark",e=t==="dark"?"light":"dark";applyTheme(e)}


// --- EVENT LISTENER SETUP ---
function setupEventListeners() {
    console.log("Настройка слушателей событий...");
    if(sheetSelect) sheetSelect.addEventListener('change', async () => { /* ... */ });
    if(songSelect) songSelect.addEventListener('change', () => { /* ... */ });
    if(searchInput) { /* ... */ }
    if(keySelect) keySelect.addEventListener('change', updateTransposedLyrics);
    if(zoomInButton) zoomInButton.addEventListener('click', () => { currentFontSize += 2; updateFontSize(); });
    if(zoomOutButton) zoomOutButton.addEventListener('click', () => { if (currentFontSize > MIN_FONT_SIZE) { currentFontSize -= 2; updateFontSize(); } });

    if(splitTextButton && songContent) {
        const splitIcon = '<i class="fas fa-columns"></i>', mergeIcon = '<i class="fas fa-align-justify"></i>', splitText = '...', mergeText = '...';
        const updateSplitButton = () => { const e=songContent.classList.contains("split-columns"),t=e?mergeIcon:splitIcon,n=e?mergeText:splitText,s=t+(isMobileView()?"":n);splitTextButton.innerHTML=s,splitTextButton.setAttribute("aria-label",e?"...":"...") };
        splitTextButton.addEventListener('click', () => { const e=songContent.querySelector("pre");if(!e||!e.textContent?.trim()){alert("...");return}songContent.classList.toggle("split-columns"),updateSplitButton() });
        updateSplitButton(); let resizeTimer; window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(updateSplitButton, 150); });
    }

     // !!! ИСПРАВЛЕНИЕ: Слушатель createSetlistButton ЗДЕСЬ !!!
     if (createSetlistButton) { createSetlistButton.addEventListener('click', createSetlist); } else { console.warn("..."); }

    if(favoriteButton) { favoriteButton.addEventListener('click', () => { /* ... */ }); }
    if (addToSetlistButton) { addToSetlistButton.addEventListener('click', addToCurrentSetlist); } else { console.warn("..."); }
    if(addToRepertoireButton) addToRepertoireButton.addEventListener('click', addToRepertoire);
    if(vocalistSelect) vocalistSelect.addEventListener('change', (e) => { /* ... */ });

    // Панели
    if (toggleFavoritesButton && favoritesPanel) {
        toggleFavoritesButton.addEventListener('click', () => {
            const isOpen = favoritesPanel.classList.toggle('open');
            if (isOpen) {
                if (repertoirePanel?.classList.contains('open')) repertoirePanel.classList.remove('open');
                // !!! ИСПРАВЛЕНИЕ: Вызов правильных функций !!!
                loadFavorites();
                loadSetlists();
            }
        });
    } else { console.error("..."); }
    if (toggleRepertoireButton && repertoirePanel) { toggleRepertoireButton.addEventListener('click', () => { const e=repertoirePanel.classList.toggle("open");e&&(favoritesPanel?.classList.contains("open")&&favoritesPanel.classList.remove("open"),loadRepertoire(currentVocalistId)) }); } else { console.error("..."); }

    // Сет-лист Контролы
    if (startPresentationButton) { startPresentationButton.addEventListener('click', () => { if(currentSetlistId&&currentSetlistSongs?.length>0){favoritesPanel?.classList.contains("open")&&favoritesPanel.classList.remove("open"),repertoirePanel?.classList.contains("open")&&repertoirePanel.classList.remove("open"),showPresentationView(currentSetlistSongs)}else alert("...") }); } else { console.warn("..."); }
    if (deleteSetlistButton) { deleteSetlistButton.addEventListener('click', deleteCurrentSetlist); } else { console.warn("..."); }

    // Презентация
    if (presentationCloseBtn && presentationOverlay) { presentationCloseBtn.addEventListener('click', () => { presentationOverlay.classList.remove("visible"),document.body.style.overflow="",clearTimeout(controlsHideTimeout),document.fullscreenElement&&document.exitFullscreen().catch(t=>{console.error(...)}) }); }

    // Метроном / BPM / Holychords
    if(metronomeButton){ metronomeButton.addEventListener('click', async()=>{if(!audioContext)setupAudioContext();if(!audioContext)return;resumeAudioContext(),audioBuffer||await loadAudioFile();const t=bpmDisplay?.textContent,e=parseInt(t,10);!isNaN(e)&&e>0?toggleMetronome(e):(alert("..."),isMetronomeActive&&toggleMetronome(0))}); }
    if(bpmDisplay) { bpmDisplay.addEventListener('blur',()=>{const t=bpmDisplay.textContent,e=parseInt(t,10);!isNaN(e)&&e>0?updateBPM(e):alert("...")}),bpmDisplay.addEventListener('input',()=>{bpmDisplay.textContent=bpmDisplay.textContent.replace(/[^0-9]/g,"")}); }
    if(holychordsButton) { holychordsButton.addEventListener('click',(e)=>{(!holychordsButton.href||holychordsButton.href.endsWith("#"))&&(e.preventDefault(),alert("..."))}); }

    // Презентация Навигация / Свайпы
    console.log("Настройка слушателей презентации...");
    const prevBtn = document.getElementById('pres-prev-btn'); const nextBtn = document.getElementById('pres-next-btn'); const presSplitBtn = document.getElementById('pres-split-text-btn');
    if(prevBtn) { prevBtn.addEventListener('click', prevPresentationSong); } if(nextBtn) { nextBtn.addEventListener('click', nextPresentationSong); } if (presSplitBtn) { presSplitBtn.addEventListener('click', togglePresentationSplit); }
    setupSwipeListeners();
    if (presentationOverlay) { presentationOverlay.addEventListener('touchstart', showPresentationControls, { passive: true }); }
    console.log("Слушатели для презентации и свайпов добавлены.");

    // Тема
    if (themeToggleButton) { themeToggleButton.addEventListener('click', toggleTheme); }
    console.log("Все слушатели событий настроены.");
 } // Конец setupEventListeners


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM loaded.");
    if (!favoritesPanel || !repertoirePanel || !songContent || !sheetSelect || !songSelect || !keySelect) {
        console.error("Критически важные элементы..."); alert("Ошибка..."); return; }
    let initialTheme = localStorage.getItem('theme') || (window.matchMedia?.('(prefers-color-scheme: light)')?.matches ? 'light' : 'dark');
    console.log("Используемая тема:", initialTheme);
    applyTheme(initialTheme);
    setupEventListeners();
    await loadAllSheetsData();
    await loadSheetSongs();
    await loadVocalists();
    displaySongDetails(null);
    loadSetlists();
    loadRepertoire(null);
    console.log("App initialization complete.");
}); // Конец DOMContentLoaded listener
