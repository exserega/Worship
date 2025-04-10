// =====================================================================
// Agape Worship App - script.js (ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ v4)
// =====================================================================

// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
    getFirestore, collection, addDoc, query,
    onSnapshot, deleteDoc, setDoc, doc,
    orderBy, getDocs, where
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBlkjVQFtFpMRFexAi6nBqEkIfjFlU5cDo", // ОСТОРОЖНО: Ключ в клиентском коде!
    authDomain: "song-archive-389a6.firebaseapp.com",
    projectId: "song-archive-389a6",
    storageBucket: "song-archive-389a6.firebasestorage.app",
    messagingSenderId: "619735277668",
    appId: "1:619735277668:web:51d2684bd8d4444eaf3f71",
    measurementId: "G-Z6QYH5YD2E"
};
const API_KEY = 'AIzaSyDO2gwifAnZzC3ooJ0A_4vAD76iYakwzlk'; // ОСТОРОЖНО: Ключ!
const SHEET_ID = '1C3gFjj9LAub_Nk9ogqKp3LKpdAxq6j8xlPAsc8OmM5s';
const SHEETS = {
    'Быстрые (вертикаль)': 'Быстрые (вертикаль)',
    'Быстрые (горизонталь)': 'Быстрые (горизонталь)',
    'Поклонение (вертикаль)': 'Поклонение (вертикаль)',
    'Поклонение (горизонталь)': 'Поклонение (горизонталь)'
};
const chords = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "H"];
const DEFAULT_FONT_SIZE = 10; const MIN_FONT_SIZE = 8; const MAX_SHARED_SONGS = 8;

// --- FIREBASE INITIALIZATION ---
const app = initializeApp(firebaseConfig); const db = getFirestore(app); const storage = getStorage(app); const sharedListCollection = collection(db, "sharedList");

// --- GLOBAL STATE ---
let currentRepertoireUnsubscribe = null;
let cachedData = {}; let favorites = JSON.parse(localStorage.getItem('favorites')) || []; let currentVocalistId = null; let currentVocalistName = null; let allSheetsData = []; let searchIndex = []; let currentFontSize = DEFAULT_FONT_SIZE; let currentSharedListData = []; let audioContext; let audioBuffer; let metronomeInterval = null; let isMetronomeActive = false; let currentBeat = 0;

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
const favoritesPanel = document.getElementById('favorites-panel');       // Панель Списки (слева)
const favoritesList = document.getElementById('favorites-list');
const sharedSongsList = document.getElementById('shared-songs-list');
const toggleRepertoireButton = document.getElementById('toggle-repertoire'); // Кнопка Репертуар (справа)
const repertoirePanel = document.getElementById('repertoire-panel');         // Панель Репертуар (справа)
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
const sharedListHeading = document.getElementById('shared-list-heading');

// --- API FUNCTIONS (Sheets, Firestore) ---
async function fetchSheetData(sheetName) {
    if (cachedData[sheetName]) return cachedData[sheetName]; if (!SHEETS[sheetName]) { console.error(`Invalid sheet name: ${sheetName}`); return []; } loadingIndicator.style.display = 'block'; try { const range = `${SHEETS[sheetName]}!A2:F`; const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`; const response = await fetch(url); if (!response.ok) { throw new Error(`Sheets API error: ${response.status}`); } const data = await response.json(); cachedData[sheetName] = data.values || []; return cachedData[sheetName]; } catch (error) { console.error('Sheets fetch error:', error); alert(`Failed to load: ${sheetName}`); return []; } finally { loadingIndicator.style.display = 'none'; }
}
async function loadAllSheetsData() {
    loadingIndicator.style.display = 'block'; allSheetsData = []; try { const sheetNames = Object.keys(SHEETS); const sheetPromises = sheetNames.map(name => fetchSheetData(name)); const results = await Promise.all(sheetPromises); allSheetsData = results.map((data, index) => ({ sheetName: sheetNames[index], data: data })); console.log("All sheets loaded."); } catch (error) { console.error('Error loading all sheets:', error); alert("Error loading song data."); } finally { loadingIndicator.style.display = 'none'; }
}
async function loadVocalists() {
    if (!vocalistSelect) return; try { console.log("Loading vocalists..."); const querySnapshot = await getDocs(collection(db, "vocalists")); vocalistSelect.innerHTML = '<option value="">-- Выберите вокалиста --</option>'; if (querySnapshot.empty) { console.warn("No vocalists found."); } else { querySnapshot.forEach((doc) => { const vocalist = doc.data(); const option = document.createElement('option'); option.value = doc.id; option.textContent = vocalist.name || doc.id; vocalistSelect.appendChild(option); }); console.log("Vocalists loaded."); } } catch (error) { console.error("Error loading vocalists:", error); alert("Failed to load vocalists."); }
}
function loadSharedList(container = sharedSongsList) {
     if (!container) { console.error("Shared list container not found."); return; } container.innerHTML = '<div>Загрузка общего списка...</div>'; const q = query(sharedListCollection, orderBy("timestamp", "asc")); const unsubscribe = onSnapshot(q, (snapshot) => { container.innerHTML = ''; if (snapshot.empty) { container.innerHTML = '<div class="empty-message">Нет песен в общем списке</div>'; currentSharedListData = []; return; } currentSharedListData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); snapshot.docs.forEach((doc) => { const song = doc.data(); const docId = doc.id; const listItem = document.createElement('div'); listItem.className = 'shared-item'; const songNameElement = document.createElement('span'); songNameElement.textContent = `${song.name} — ${song.key}`; songNameElement.className = 'song-name'; songNameElement.addEventListener('click', async () => { const sheetNameValue = Object.keys(SHEETS).find(key => SHEETS[key] === song.sheet); if(sheetNameValue) sheetSelect.value = sheetNameValue; if (!cachedData[song.sheet]) await fetchSheetData(song.sheet); await loadSheetSongs(); songSelect.value = song.index; displaySongDetails(cachedData[song.sheet]?.[song.index], song.index, song.key); if (favoritesPanel) favoritesPanel.classList.remove('open'); if (repertoirePanel) repertoirePanel.classList.remove('open'); }); const deleteButton = document.createElement('button'); deleteButton.innerHTML = '<i class="fas fa-times"></i>'; /* Иконка */ deleteButton.className = 'delete-button'; deleteButton.addEventListener('click', () => { if (confirm(`Удалить "${song.name}"?`)) { deleteFromSharedList(docId); } }); listItem.appendChild(songNameElement); listItem.appendChild(deleteButton); container.appendChild(listItem); }); }, (error) => { console.error("Error fetching shared list:", error); container.innerHTML = '<div class="empty-message">Failed list load.</div>'; currentSharedListData = []; });
}
async function addToSharedList(songData) {
     const sheetName = SHEETS[sheetSelect.value]; const songIndex = songSelect.value; if (!sheetName || !songIndex || !songData || !songData[0]) { alert("Выберите песню."); return; } const song = { name: songData[0], sheet: sheetName, index: songIndex, key: keySelect.value, timestamp: new Date().toISOString() }; try { const countSnapshot = await getDocs(query(sharedListCollection)); if (countSnapshot.size >= MAX_SHARED_SONGS) { alert(`Лимит (${MAX_SHARED_SONGS}).`); return; } const duplicateQuery = query(sharedListCollection, where("sheet", "==", song.sheet), where("index", "==", song.index)); const duplicateSnapshot = await getDocs(duplicateQuery); if (!duplicateSnapshot.empty) { alert(`"${song.name}" уже в списке.`); return; } await addDoc(sharedListCollection, song); alert(`"${song.name}" добавлена.`); } catch (error) { console.error("Error adding to shared list:", error); alert("Ошибка добавления."); }
}
async function deleteFromSharedList(docId) {
     if (!docId) return; try { await deleteDoc(doc(db, "sharedList", docId)); } catch (error) { console.error("Error deleting from shared list:", error); alert("Ошибка удаления."); }
}
function loadRepertoire(vocalistId) {
     if (currentRepertoireUnsubscribe) { currentRepertoireUnsubscribe(); currentRepertoireUnsubscribe = null; } const listContainer = repertoirePanelList; const sectionContainer = repertoirePanel; const nameSpan = repertoirePanelVocalistName; if (!listContainer || !sectionContainer || !nameSpan) { console.error("Repertoire UI elements missing."); return; } listContainer.innerHTML = ''; if (!vocalistId) { nameSpan.textContent = '-- Выберите вокалиста --'; listContainer.innerHTML = '<div class="empty-message">Выберите вокалиста...</div>'; /* sectionContainer.style.display = 'none'; - управляем классом open */ return; } nameSpan.textContent = currentVocalistName || vocalistId; listContainer.innerHTML = '<div>Загрузка...</div>'; /* sectionContainer.style.display = 'block'; */ const repertoireColRef = collection(db, "vocalists", vocalistId, "repertoire"); const q = query(repertoireColRef); currentRepertoireUnsubscribe = onSnapshot(q, (snapshot) => { const currentListContainer = document.getElementById('repertoire-panel-list'); if (!currentListContainer) return; currentListContainer.innerHTML = ''; if (snapshot.empty) { currentListContainer.innerHTML = '<div class="empty-message">Репертуар пуст.</div>'; return; } const groupedByKeys = {}; snapshot.docs.forEach((doc) => { const song = doc.data(); const key = song.preferredKey || "N/A"; const sheet = song.sheet || "Unknown"; if (!groupedByKeys[key]) groupedByKeys[key] = {}; if (!groupedByKeys[key][sheet]) groupedByKeys[key][sheet] = []; groupedByKeys[key][sheet].push({ ...song, repertoireDocId: doc.id }); }); const sortedKeys = Object.keys(groupedByKeys).sort((a, b) => { const iA = chords.indexOf(a), iB = chords.indexOf(b); if (iA === -1) return 1; if (iB === -1) return -1; return iA - iB; }); sortedKeys.forEach(key => { const keyHeading = document.createElement('div'); keyHeading.className = 'repertoire-key-heading clickable'; keyHeading.innerHTML = `Тональность: ${key} <i class="fas fa-chevron-right key-toggle-icon"></i>`; currentListContainer.appendChild(keyHeading); const keyContent = document.createElement('div'); keyContent.className = 'repertoire-key-content'; currentListContainer.appendChild(keyContent); const sheetsInKey = groupedByKeys[key]; const sortedSheets = Object.keys(sheetsInKey).sort((a, b) => a.localeCompare(b)); sortedSheets.forEach(sheet => { const sheetHeading = document.createElement('div'); sheetHeading.className = 'repertoire-sheet-heading'; const shortSheetName = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === sheet) || sheet; sheetHeading.textContent = shortSheetName; keyContent.appendChild(sheetHeading); const songsInSheet = sheetsInKey[sheet]; songsInSheet.sort((a, b) => a.name.localeCompare(b.name)); songsInSheet.forEach(songWithId => { const song = songWithId; const repertoireDocId = song.repertoireDocId; const listItem = document.createElement('div'); listItem.className = 'repertoire-item'; const songInfo = document.createElement('span'); songInfo.className = 'song-name'; songInfo.textContent = song.name; listItem.appendChild(songInfo); const removeBtn = document.createElement('button'); removeBtn.innerHTML = '<i class="fas fa-times"></i>'; removeBtn.className = 'remove-button'; removeBtn.title = 'Удалить'; removeBtn.addEventListener('click', (e) => { e.stopPropagation(); removeFromRepertoire(vocalistId, repertoireDocId); }); listItem.appendChild(removeBtn); listItem.addEventListener('click', async () => { if (!cachedData[song.sheet]?.[song.index]) { await fetchSheetData(song.sheet); if (!cachedData[song.sheet]?.[song.index]) { alert('Нет данных песни.'); return; } } const originalSongData = cachedData[song.sheet][song.index]; const sheetNameValue = Object.keys(SHEETS).find(sKey => SHEETS[sKey] === song.sheet); if(sheetNameValue) sheetSelect.value = sheetNameValue; await loadSheetSongs(); songSelect.value = song.index; displaySongDetails(originalSongData, song.index, song.preferredKey); if (repertoirePanel) repertoirePanel.classList.remove('open'); }); keyContent.appendChild(listItem); }); }); }); }, (error) => { const cl = document.getElementById('repertoire-panel-list'); if (cl) { cl.innerHTML = '<div class="empty-message">Error</div>'; } console.error(`Error listening:`, error); });
}
// ---> ВОССТАНОВЛЕННАЯ И ИСПРАВЛЕННАЯ ФУНКЦИЯ <---
async function addToRepertoire() {
    console.log("Adding to repertoire..."); if (!currentVocalistId) { alert("Выберите вокалиста"); return; } const sheetName = SHEETS[sheetSelect.value]; const songIndex = songSelect.value; if (!sheetName || !songIndex || songIndex === "" || !cachedData[sheetName]?.[songIndex]) { alert("Выберите песню"); return; } const songData = cachedData[sheetName][songIndex]; const songName = songData[0]; const preferredKey = keySelect.value;
    // ИСПРАВЛЕНО:
    console.log(`Adding to repertoire for ${currentVocalistName || currentVocalistId}: Song "${songName}", Key: ${preferredKey}`);
    const repertoireDocId = `${sheetName}_${songIndex}`; // Используем ` без {} если это просто строка
    const dataToSave = { sheet: sheetName, index: songIndex, name: songName, preferredKey: preferredKey }; console.log("Data to save:", dataToSave);
    try { await setDoc(doc(db, "vocalists", currentVocalistId, "repertoire", repertoireDocId), dataToSave);
    // ИСПРАВЛЕНО:
    alert(`"${songName}" (${preferredKey}) added/updated in repertoire for ${currentVocalistName || currentVocalistId}.`);
    } catch (error) { console.error("Error adding to repertoire:", error); alert("Ошибка сохранения."); }
}
async function removeFromRepertoire(vocalistId, repertoireDocId) {
     if (!vocalistId || !repertoireDocId) { console.error("Missing IDs"); alert("Ошибка удаления."); return; } const vocalistDisplayName = currentVocalistName || vocalistId; if (!confirm(`Удалить из репертуара ${vocalistDisplayName}?`)) { return; } try { await deleteDoc(doc(db, "vocalists", vocalistId, "repertoire", repertoireDocId)); alert("Песня удалена."); } catch (error) { console.error("Error removing from repertoire:", error); alert("Ошибка удаления."); }
}

// --- CORE LOGIC / UTILITIES ---
function getTransposition(originalKey, newKey) { const oI=chords.indexOf(originalKey),nI=chords.indexOf(newKey);return(oI===-1||nI===-1)?0:nI-oI; }
function transposeChord(chord, transposition) { let ct='',bc=chord,bn='';const sfx=['maj7','m7','7','m','dim','aug','sus2','sus4','add9','dim7','aug7','sus'];if(bc.includes('/'))[bc,bn]=bc.split('/');for(let s of sfx)if(bc.endsWith(s)){bc=bc.slice(0,-s.length);ct=s;break;}const ci=chords.indexOf(bc);if(ci===-1)return chord;const ni=(ci+transposition+12)%12;const tbc=chords[ni]+ct;if(bn){const bi=chords.indexOf(bn);if(bi!==-1){const nbi=(bi+transposition+12)%12;return`${tbc}/${chords[nbi]}`}else return`${tbc}/${bn}`}return tbc;}
function cleanChord(chord) { return chord.replace(/\s+/g, ''); }
function transposeLyrics(lyrics, transposition) { if(transposition===0)return lyrics; const rg=/([A-H][#b]?(?:maj7|m7|7|m|dim|aug|sus4|sus2|add9|dim7|aug7|sus)?(?:\/[A-H][#b]?)?)/g; return lyrics.replace(rg,(m)=>transposeChord(cleanChord(m),transposition));}
function processLyrics(lyrics) { if(!lyrics)return''; return lyrics.split('\n').map(l=>l.replace(/ {2,}/g,m=>' '.repeat(Math.ceil(m.length/2)))).join('\n');}
function highlightChords(lyrics) { if(!lyrics)return''; const rg=/([A-H][#b]?(?:maj7|m7|7|m|dim|aug|sus4|sus2|add9|dim7|aug7|sus)?(?:\/[A-H][#b]?)?)/g; return lyrics.replace(rg,'<span class="chord">$1</span>');}
async function searchSongs(query) { const lq=query.trim().toLowerCase();searchResults.innerHTML='';if(!lq)return;const ar=Object.values(cachedData).flat();const ms=ar.filter(r=>{const n=r?.[0]?.trim().toLowerCase();return n&&n.includes(lq);});if(ms.length===0){searchResults.innerHTML='<div>Ничего не найдено</div>';return;}ms.forEach(s=>{const ri=document.createElement('div');ri.textContent=s[0];ri.className='search-result';ri.addEventListener('click',async()=>{let fsn=null,oi=-1;for(const sk in SHEETS){const snm=SHEETS[sk];if(cachedData[snm]){oi=cachedData[snm].findIndex(r=>r?.[0]===s[0]);if(oi!==-1){fsn=sk;break;}}} if(fsn&&oi!==-1){sheetSelect.value=fsn;await loadSheetSongs();songSelect.value=oi;displaySongDetails(cachedData[SHEETS[fsn]][oi],oi);searchResults.innerHTML='';searchInput.value=s[0];}else{console.error("Search select error",s);alert("Search select error.")}});searchResults.appendChild(ri);});}
function extractYouTubeVideoId(url) { if(!url)return null;let vId=null;try{const rg=/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;const m=url.match(rg);if(m&&m[1])vId=m[1];}catch(e){return null;}return vId;}
function isMobileView() { return window.innerWidth <= 480; }

// --- UI UPDATE FUNCTIONS ---
/** Отображает песни из переданного списка в режиме презентации - ИСПРАВЛЕН СИНТАКСИС */
async function showPresentationView(songsToShow) {
    if (!presentationOverlay || !presentationContent) return; presentationContent.innerHTML = '<div>Загрузка песен... <span id="presentation-loading-count"></span></div>'; let loadedCount = 0; const totalCount = songsToShow.length; const loadingCountSpan = document.getElementById('presentation-loading-count'); if (loadingCountSpan) loadingCountSpan.textContent = `(0/${totalCount})`; let contentHtml = ''; for (const song of songsToShow) { if (!cachedData[song.sheet]?.[song.index]) { console.log(`Presentation: Fetching data for ${song.name} (${song.sheet})`); await fetchSheetData(song.sheet); } const originalSongData = cachedData[song.sheet]?.[song.index]; if (!originalSongData) { console.error(`Presentation: Failed data for ${song.name}`); contentHtml += `<div class="presentation-song"><h2>${song.name} - ОШИБКА</h2></div>`; continue; } const songTitle = originalSongData[0]; const originalLyrics = originalSongData[1] || ''; const originalKey = originalSongData[2] || chords[0]; const targetKey = song.key; const transposition = getTransposition(originalKey, targetKey); const transposedLyrics = transposeLyrics(originalLyrics, transposition); const processedLyrics = processLyrics(transposedLyrics); const highlightedLyrics = highlightChords(processedLyrics);
    // ИСПРАВЛЕННЫЙ HTML:
    contentHtml += `<div class="presentation-song"><h2>${songTitle} — ${targetKey}</h2><pre>${highlightedLyrics}</pre></div>`;
    loadedCount++; if (loadingCountSpan) loadingCountSpan.textContent = `(${loadedCount}/${totalCount})`; } presentationContent.innerHTML = contentHtml; presentationOverlay.classList.add('visible'); presentationOverlay.scrollTop = 0;
}
/** Отображение деталей песни (текст, ключ, BPM, плеер) - ИСПРАВЛЕН СИНТАКСИС */
function displaySongDetails(songData, index, key) {
    if(!playerContainer||!playerSection||!songContent){console.error("Missing DOM elements");return;} if(!songData){songContent.innerHTML='<h2>Выберите песню</h2><pre></pre>';playerContainer.innerHTML='';playerSection.style.display='none';if(bpmDisplay)bpmDisplay.textContent='N/A';if(holychordsButton){holychordsButton.style.display='none';holychordsButton.href='#';}if(keySelect){keySelect.value=chords[0];keySelect.dataset.index='';}return;} const cK=key||songData[2]||chords[0];const bpm=songData[4]||'N/A';const lyrics=songData[1]||'';const srcUrl=songData[3]||'#';const title=songData[0]||'Без названия';const ytLink=songData[5]; if(bpmDisplay){updateBPM(bpm);bpmDisplay.textContent=bpm;} if(holychordsButton){if(srcUrl&&srcUrl.trim()!==''&&srcUrl.trim()!=='#'){holychordsButton.href=srcUrl;holychordsButton.style.display='inline-block';}else{holychordsButton.href='#';holychordsButton.style.display='none';}} const pLyrics=processLyrics(lyrics);const hLyrics=highlightChords(pLyrics);
    // ИСПРАВЛЕННАЯ СТРОКА:
    songContent.innerHTML = `<h2>${title} — ${cK}</h2><pre>${hLyrics}</pre>`;
    if(keySelect){keySelect.value=cK;keySelect.dataset.index=index;} updateTransposedLyrics(); const vId=extractYouTubeVideoId(ytLink);if(vId&&playerContainer&&playerSection){
        // ИСПРАВЛЕН URL YOUTUBE (убран /7):
        playerContainer.innerHTML=`<iframe width="100%" height="315" src="https://www.youtube.com/embed/${vId}?autoplay=0&modestbranding=1&rel=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;playerSection.style.display='block';}else if(playerContainer&&playerSection){playerContainer.innerHTML='';playerSection.style.display='none';}
}
function updateTransposedLyrics() { if (!keySelect || !songContent) return; const indexStr = keySelect.dataset.index; const newKey = keySelect.value; if (indexStr === null || indexStr === undefined || indexStr === "") { return; } const sheetName = SHEETS[sheetSelect.value]; if (!sheetName || !cachedData[sheetName] || !cachedData[sheetName][indexStr]) { console.error("Data missing for transpose.", sheetName, indexStr); return; } const songData = cachedData[sheetName][indexStr]; const originalKey = songData[2]; const lyrics = songData[1] || ''; const preElement = songContent.querySelector('pre'); const h2Element = songContent.querySelector('h2'); if (!preElement || !h2Element) { console.error("H2 or PRE not found."); return; } const transposition = getTransposition(originalKey, newKey); const transposedLyrics = transposeLyrics(lyrics, transposition); const processedTransposedLyrics = processLyrics(transposedLyrics); const highlightedTransposedLyrics = highlightChords(processedTransposedLyrics); preElement.innerHTML = highlightedTransposedLyrics; h2Element.innerHTML = `${songData[0]} — ${newKey}`; }
async function loadSheetSongs() { const sNV=SHEETS[sheetSelect.value];songSelect.innerHTML='<option value="">-- Выберите песню --</option>';songSelect.disabled=true;if(!sNV)return;const rows=await fetchSheetData(sNV);if(rows?.length>0){rows.forEach((r,i)=>{if(r?.[0]){const o=document.createElement('option');o.value=i;o.textContent=r[0];songSelect.appendChild(o);}});songSelect.disabled=false;}else{songSelect.innerHTML='<option value="">-- Нет песен --</option>';}}
function updateFontSize() { const el=songContent?.querySelector('pre');if(el)el.style.fontSize=`${currentFontSize}px`;}
function resetFontSize() { currentFontSize=DEFAULT_FONT_SIZE;updateFontSize();}
function loadFavorites(container = favoritesList) { if(!container)return;container.innerHTML='';favorites=JSON.parse(localStorage.getItem('favorites'))||[];if(favorites.length===0){container.innerHTML='<div class="empty-message">Нет избранных</div>';return;}favorites.forEach(fav=>{const li=document.createElement('div');li.className='favorite-item';const si=document.createElement('span');si.className='song-name';si.textContent=`${fav.name} — ${fav.key}`;li.appendChild(si);const rb=document.createElement('button');rb.innerHTML='<i class="fas fa-times"></i>';rb.className='remove-button';rb.addEventListener('click',(e)=>{e.stopPropagation();removeFromFavorites(fav);});li.appendChild(rb);li.addEventListener('click',async()=>{const snv=Object.keys(SHEETS).find(k=>SHEETS[k]===fav.sheet);if(snv)sheetSelect.value=snv;if(!cachedData[fav.sheet])await fetchSheetData(fav.sheet);await loadSheetSongs();songSelect.value=fav.index;displaySongDetails(cachedData[fav.sheet]?.[fav.index],fav.index,fav.key);if(favoritesPanel)favoritesPanel.classList.remove('open');if(repertoirePanel)repertoirePanel.classList.remove('open');});container.appendChild(li);});}
function removeFromFavorites(fav) { console.log("Removing favorite:",fav);const i=favorites.findIndex(it=>it.name===fav.name&&it.sheet===fav.sheet&&it.index===fav.index&&it.key===fav.key);if(i!==-1){favorites.splice(i,1);localStorage.setItem('favorites',JSON.stringify(favorites));if(favoritesPanel?.classList.contains('open')&&favoritesList)loadFavorites(favoritesList);alert("Удалено.");}else{console.warn("Favorite not found");alert("Не удалось удалить.");}}
function loadGroupPanel() { console.log("Loading lists panel...");if(!favoritesPanel||!favoritesPanel.classList.contains('open'))return;if(favoritesList)loadFavorites(favoritesList);if(sharedSongsList)loadSharedList(sharedSongsList);}
function updateBPM(newBPM) { if (!bpmDisplay) return; bpmDisplay.textContent=newBPM||'N/A';if(isMetronomeActive){const bv=parseInt(newBPM,10);if(!isNaN(bv)&&bv>0){toggleMetronome(0);toggleMetronome(bv);}else{toggleMetronome(0);}}}

// --- METRONOME FUNCTIONS ---
function setupAudioContext() { if(!audioContext){try{audioContext=new(window.AudioContext||window.webkitAudioContext)();}catch(e){console.error("AudioContext fail");alert("No Web Audio.");}}}
function resumeAudioContext() { if(audioContext&&audioContext.state==='suspended'){audioContext.resume().catch(e=>console.error('Resume fail:',e));}}
async function loadAudioFile() { if(!audioContext)setupAudioContext();if(!audioContext||audioBuffer)return;const url='https://firebasestorage.googleapis.com/v0/b/song-archive-389a6.firebasestorage.app/o/metronome-85688%20(mp3cut.net).mp3?alt=media&token=97b66349-7568-43eb-80c3-c2278ff38c10';try{const r=await fetch(url);if(!r.ok)throw new Error(`HTTP ${r.status}`);const ab=await r.arrayBuffer();audioBuffer=await audioContext.decodeAudioData(ab);}catch(e){console.error('Audio load fail:',e);alert("Metronome sound fail.");audioBuffer=null;}}
function playClick() { if(!audioContext||!audioBuffer){if(isMetronomeActive)toggleMetronome(0);return;}resumeAudioContext();const bpm=parseInt(timeSignatureSelect.value,10)||4;const src=audioContext.createBufferSource();src.buffer=audioBuffer;const gn=audioContext.createGain();gn.gain.setValueAtTime(currentBeat%bpm===0?1.0:0.6,audioContext.currentTime);src.connect(gn);gn.connect(audioContext.destination);src.start(audioContext.currentTime);currentBeat=(currentBeat+1)%bpm;}
function toggleMetronome(bpm) { if(!metronomeButton)return; const playIcon='<i class="fas fa-play"></i>';const stopIcon='<i class="fas fa-stop"></i>';const playText='<span class="button-text">Вкл. метроном</span>';const stopText='<span class="button-text">Выкл. метроном</span>';if(isMetronomeActive){clearInterval(metronomeInterval);metronomeInterval=null;isMetronomeActive=false;currentBeat=0;metronomeButton.innerHTML=playIcon+(isMobileView()?'':playText);metronomeButton.setAttribute('aria-label','Включить метроном');}else if(bpm>0){if(!audioContext||!audioBuffer){alert("Загрузка звука...");loadAudioFile();return;}const intMs=60000/bpm;if(intMs<=0||!isFinite(intMs))return;currentBeat=0;metronomeInterval=setInterval(playClick,intMs);isMetronomeActive=true;metronomeButton.innerHTML=stopIcon+(isMobileView()?'':stopText);metronomeButton.setAttribute('aria-label','Выключить метроном');playClick();}}

// --- EVENT LISTENER SETUP (Исправлено) ---
function setupEventListeners() {
    console.log("Setting up listeners...");
    if(sheetSelect) sheetSelect.addEventListener('change', async () => { console.log("Sheet selected:", sheetSelect.value); if(searchInput) searchInput.value = ''; if(searchResults) searchResults.innerHTML = ''; await loadSheetSongs(); displaySongDetails(null); });
    if(songSelect) songSelect.addEventListener('change', () => { const sn = SHEETS[sheetSelect.value]; const si = songSelect.value; console.log(`Song selected: ${si} in ${sn}`); if (!sn || si === "" || !cachedData[sn]?.[si]) { displaySongDetails(null); return; } displaySongDetails(cachedData[sn][si], si); });
    if(searchInput) { searchInput.addEventListener('input', () => searchSongs(searchInput.value)); searchInput.addEventListener('blur', () => { setTimeout(() => { if(searchResults) searchResults.innerHTML = ''; }, 200); }); }
    if(keySelect) keySelect.addEventListener('change', updateTransposedLyrics);
    if(zoomInButton) zoomInButton.addEventListener('click', () => { currentFontSize += 2; updateFontSize(); });
    if(zoomOutButton) zoomOutButton.addEventListener('click', () => { if (currentFontSize > MIN_FONT_SIZE) { currentFontSize -= 2; updateFontSize(); } });
    if(splitTextButton && songContent) { const splitIcon = '<i class="fas fa-columns"></i>'; const mergeIcon = '<i class="fas fa-align-justify"></i>'; const splitText = '<span class="button-text">Разделить</span>'; const mergeText = '<span class="button-text">Объединить</span>'; const updateSplitButton = () => { const isSplit = songContent.classList.contains('split-columns'); const currentIcon = isSplit ? mergeIcon : splitIcon; const currentTextSpan = isSplit ? mergeText : splitText; splitTextButton.innerHTML = currentIcon + (isMobileView() ? '' : currentTextSpan); splitTextButton.setAttribute('aria-label', isSplit ? 'Объединить' : 'Разделить'); }; splitTextButton.addEventListener('click', () => { const lyricsElement = songContent.querySelector('pre'); if (!lyricsElement || !lyricsElement.textContent?.trim()) { alert('Нет текста.'); return; } songContent.classList.toggle('split-columns'); updateSplitButton(); }); updateSplitButton(); let resizeTimer; window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(updateSplitButton, 150); }); }
    if(favoriteButton) { favoriteButton.addEventListener('click', () => { const sn = SHEETS[sheetSelect.value]; const si = songSelect.value; if (!sn || si === "") { alert("Выберите песню."); return; } const sd = cachedData[sn]?.[si]; if (!sd) { alert("Нет данных."); return; } const song = { name: sd[0], sheet: sn, index: si, key: keySelect.value }; if (!favorites.some(f => f.sheet === song.sheet && f.index === song.index)) { favorites.push(song); localStorage.setItem('favorites', JSON.stringify(favorites)); if (favoritesPanel?.classList.contains('open')) loadFavorites(); alert(`"${song.name}" (${song.key}) добавлена.`); } else { alert('Уже в избранном!'); } }); }
    if(addToListButton) { addToListButton.addEventListener('click', () => { const sn = SHEETS[sheetSelect.value]; const si = songSelect.value; if (!sn || si === "" || !cachedData[sn]?.[si]) { alert("Выберите песню."); return; } const sd = cachedData[sn][si]; addToSharedList(sd); }); }
    if(addToRepertoireButton) addToRepertoireButton.addEventListener('click', addToRepertoire);
    if(vocalistSelect) vocalistSelect.addEventListener('change', (e) => { currentVocalistId = e.target.value; const idx = e.target.selectedIndex; currentVocalistName = idx > 0 ? e.target.options[idx].text : null; console.log(`Vocalist selected: ${currentVocalistName || 'none'} (ID: ${currentVocalistId || 'none'})`); loadRepertoire(currentVocalistId); });

    // --- ЕДИНСТВЕННЫЕ ОБРАБОТЧИКИ ДЛЯ КНОПОК ПАНЕЛЕЙ ---
    if (toggleFavoritesButton && favoritesPanel) {
        toggleFavoritesButton.addEventListener('click', () => {
            console.log("--- КЛИК: Кнопка 'Списки' ---");
            const isOpen = favoritesPanel.classList.toggle('open');
            console.log("Панель 'Списки' открыта:", isOpen);
            if (isOpen) {
                if (repertoirePanel?.classList.contains('open')) repertoirePanel.classList.remove('open');
                loadGroupPanel();
            } else { console.log("Списки закрыты"); }
        });
        console.log("Listener for 'Списки' ADDED ONCE");
    } else { console.error("Could not find elements for 'Списки' toggle"); }

    if (toggleRepertoireButton && repertoirePanel) {
        toggleRepertoireButton.addEventListener('click', () => {
            console.log("--- КЛИК: Кнопка 'Репертуар' ---");
            const isOpen = repertoirePanel.classList.toggle('open');
            console.log("Панель 'Репертуар' открыта:", isOpen);
            if (isOpen) {
                if (favoritesPanel?.classList.contains('open')) favoritesPanel.classList.remove('open');
                loadRepertoire(currentVocalistId);
            } else { console.log("Репертуар закрыт"); }
        });
        console.log("Listener for 'Репертуар' ADDED ONCE");
    } else { console.error("Could not find elements for 'Репертуар' toggle"); }
    // --- КОНЕЦ ОБРАБОТЧИКОВ ДЛЯ КНОПОК ПАНЕЛЕЙ ---

     // Клик по заголовку "Общий список" для режима презентации
     if (sharedListHeading) {
        sharedListHeading.addEventListener('click', () => {
             console.log("Клик по заголовку Общий список");
             if (currentSharedListData && currentSharedListData.length > 0) {
                  if (favoritesPanel?.classList.contains('open')) favoritesPanel.classList.remove('open');
                  if (repertoirePanel?.classList.contains('open')) repertoirePanel.classList.remove('open');
                  showPresentationView(currentSharedListData);
             } else { alert("Общий список пуст."); }
        });
    } else { console.warn("shared-list-heading not found."); }

    // Клик по кнопке закрытия презентации
    if (presentationCloseBtn && presentationOverlay) {
         presentationCloseBtn.addEventListener('click', () => {
              presentationOverlay.classList.remove('visible');
              if (document.fullscreenElement) { document.exitFullscreen().catch(err => console.error(`Exit fullscreen error: ${err.message}`)); }
         });
    }

     // Обработчик для аккордеона репертуара
     if (repertoirePanelList) {
         repertoirePanelList.addEventListener('click', (event) => {
             const heading = event.target.closest('.repertoire-key-heading.clickable'); if (!heading) return;
             const content = heading.nextElementSibling; const icon = heading.querySelector('.key-toggle-icon');
             if (content && content.classList.contains('repertoire-key-content')) {
                 const isVisible = content.style.display === 'block'; content.style.display = isVisible ? 'none' : 'block';
                 if (icon) { icon.classList.toggle('fa-chevron-right', isVisible); icon.classList.toggle('fa-chevron-down', !isVisible); }
             }
         });
     }

    // Метроном
    if(metronomeButton){ metronomeButton.addEventListener('click', async () => { if (!audioContext) setupAudioContext(); if (!audioContext) return; resumeAudioContext(); if (!audioBuffer) await loadAudioFile(); const bpmText = bpmDisplay?.textContent; const bpmValue = parseInt(bpmText, 10); if (!isNaN(bpmValue) && bpmValue > 0) { toggleMetronome(bpmValue); } else { alert('Некорректный BPM.'); if (isMetronomeActive) toggleMetronome(0); } }); }
    // Редактирование BPM
    if(bpmDisplay) { bpmDisplay.addEventListener('blur', () => { const newText = bpmDisplay.textContent; const newBpm = parseInt(newText, 10); if (!isNaN(newBpm) && newBpm > 0) { updateBPM(newBpm); } else { alert('Введите число BPM.'); /* updateBPM(null); */ } }); bpmDisplay.addEventListener('input', () => { bpmDisplay.textContent = bpmDisplay.textContent.replace(/[^0-9]/g, ''); }); }
    // Ссылка Holychords
    if(holychordsButton) holychordsButton.addEventListener('click', (e) => { if (!holychordsButton.href || holychordsButton.href.endsWith('#')) { e.preventDefault(); alert('Нет ссылки Holychords.'); } });

    console.log("Event listeners setup complete.");
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM loaded.");
     if (!favoritesPanel || !repertoirePanel || !songContent || !sheetSelect || !songSelect || !keySelect || !vocalistSelect) {
          console.error("КРИТИЧЕСКИЕ ЭЛЕМЕНТЫ ИНТЕРФЕЙСА НЕ НАЙДЕНЫ В HTML!");
          alert("Ошибка инициализации интерфейса! Проверьте HTML.");
          return;
     }

    setupEventListeners(); // <-- ВЫЗЫВАЕМ НАСТРОЙКУ СЛУШАТЕЛЕЙ ЗДЕСЬ ОДИН РАЗ

    await loadAllSheetsData();
    // await loadSheetSongs(); // Загружаем песни только при выборе листа
    await loadVocalists();
    // await loadAudioFile(); // Предзагрузка звука?

    // Загружаем начальное состояние интерфейса
    displaySongDetails(null);
    // Не нужно вызывать loadGroupPanel/loadRepertoire здесь, панели закрыты

    console.log("App initialization complete.");
}); // <-- Конец файла
