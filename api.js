// Agape Worship App - api.js

import { db } from './firebase-config.js';
import {
    collection, addDoc, query, onSnapshot, updateDoc, deleteDoc, setDoc, doc,
    orderBy, getDocs, where, getDoc, runTransaction
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import * as state from './state.js';

const songsCollection = collection(db, "songs");
const setlistsCollection = collection(db, "setlists");
const vocalistsCollection = collection(db, "vocalists");

// --- SONGS ---

/** Загрузка данных со ВСЕХ песен из Firestore */
async function loadAllSongsFromFirestore() {
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
    console.log(`Загружено ${state.allSongs.length} песен.`);
}


// --- VOCALISTS & REPERTOIRE ---

/** Загрузка списка вокалистов */
async function loadVocalists() {
    console.log("Загрузка списка вокалистов...");
    const querySnapshot = await getDocs(vocalistsCollection);
    const vocalists = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log("Список вокалистов успешно загружен.");
    return vocalists;
}

/** Загрузка репертуара вокалиста с использованием callback для обновления UI */
function loadRepertoire(vocalistId, onRepertoireUpdate) {
    if (state.currentRepertoireUnsubscribe) {
        state.currentRepertoireUnsubscribe();
    }
    if (!vocalistId) {
        onRepertoireUpdate({ data: [], error: null });
        return;
    }
    const repertoireColRef = collection(db, "vocalists", vocalistId, "repertoire");
    const q = query(repertoireColRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (vocalistId !== state.currentVocalistId) return;
        const songsData = snapshot.docs.map(doc => ({ ...doc.data(), repertoireDocId: doc.id }));
        onRepertoireUpdate({ data: songsData, error: null });
    }, (error) => {
        console.error(`!!! ОШИБКА Firestore onSnapshot для репертуара ${vocalistId}:`, error);
        onRepertoireUpdate({ data: [], error });
    });
    state.setCurrentRepertoireUnsubscribe(unsubscribe);
}

/** Добавление/Обновление песни в репертуаре вокалиста */
async function addToRepertoire(vocalistId, songId, preferredKey) {
    const repertoireDocId = songId; 
    const dataToSave = {
        preferredKey: preferredKey,
        addedAt: new Date()
    };
    const docRef = doc(db, "vocalists", vocalistId, "repertoire", repertoireDocId);
    await setDoc(docRef, dataToSave);
}

/** Удаление песни из репертуара вокалиста */
async function removeFromRepertoire(vocalistId, repertoireDocId) {
    await deleteDoc(doc(db, "vocalists", vocalistId, "repertoire", repertoireDocId));
}

// --- SETLISTS ---

/** Загрузка списка сет-листов с callback */
function loadSetlists(onSetlistsUpdate) {
    const q = query(setlistsCollection, orderBy("name", "asc"));
    return onSnapshot(q, (snapshot) => {
        const setlists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        onSetlistsUpdate({ data: setlists, error: null });
    }, (error) => {
        console.error("Ошибка при загрузке списка сет-листов:", error);
        onSetlistsUpdate({ data: [], error });
    });
}

/** Создание нового сет-листа */
async function createSetlist(setlistName) {
    const dataToSave = {
        name: setlistName,
        createdAt: new Date()
    };
    return await addDoc(setlistsCollection, dataToSave);
}

/** Обновление имени сет-листа */
async function updateSetlistName(setlistId, newName) {
    const setlistDocRef = doc(db, "setlists", setlistId);
    await updateDoc(setlistDocRef, { name: newName });
}

/** Удаление ВСЕГО сет-листа */
async function deleteCurrentSetlist(setlistId) {
    if (state.currentSetlistSongsUnsubscribe) {
        state.currentSetlistSongsUnsubscribe();
        state.setCurrentSetlistSongsUnsubscribe(null);
    }
    const setlistDocRef = doc(db, "setlists", setlistId);
    await deleteDoc(setlistDocRef);
}


// --- SONGS IN SETLIST ---

/** Загрузка песен для ТЕКУЩЕГО сет-листа с callback */
function loadCurrentSetlistSongs(setlistId, onSongsUpdate) {
    if (state.currentSetlistSongsUnsubscribe) {
        state.currentSetlistSongsUnsubscribe();
    }
    if (!setlistId) {
        onSongsUpdate({ data: [], error: null });
        return;
    }
    const songsCollectionRef = collection(db, "setlists", setlistId, "songs");
    const q = query(songsCollectionRef, orderBy("order", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (setlistId !== state.currentSetlistId) return;
        const newSongs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        onSongsUpdate({ data: newSongs, error: null });
    }, (error) => {
        console.error(`Ошибка загрузки песен для ${setlistId}:`, error);
        onSongsUpdate({ data: [], error });
    });
    state.setCurrentSetlistSongsUnsubscribe(unsubscribe);
}

/** Добавляет песню в ВЫБРАННЫЙ сет-лист */
async function addToCurrentSetlist(setlistId, songId, preferredKey, order) {
    const songsCollectionRef = collection(db, "setlists", setlistId, "songs");
    
    // Проверка на дубликат
    const q = query(songsCollectionRef, where("songId", "==", songId));
    const duplicateSnapshot = await getDocs(q);

    if (!duplicateSnapshot.empty) {
        const existingDoc = duplicateSnapshot.docs[0];
        // Возвращаем информацию о дубликате
        return { duplicate: true, docId: existingDoc.id, data: existingDoc.data() };
    }

    const songEntryData = {
        songId: songId,
        preferredKey: preferredKey,
        order: order
    };
    const docRef = await addDoc(songsCollectionRef, songEntryData);
    return { duplicate: false, docId: docRef.id };
}

/** Обновление тональности песни в сет-листе */
async function updateSongKeyInSetlist(setlistId, docId, newKey) {
    const docRef = doc(db, "setlists", setlistId, "songs", docId);
    await setDoc(docRef, { preferredKey: newKey }, { merge: true });
}

/** Удаление ОДНОЙ песни из сет-листа */
async function deleteSongFromSetlist(setlistId, songDocId) {
    const songDocRef = doc(db, "setlists", setlistId, "songs", songDocId);
    await deleteDoc(songDocRef);
}

/** Сохранение заметки для песни в сет-листе */
async function saveNoteForSongInSetlist(setlistId, songDocId, newNoteText) {
    const songDocRef = doc(db, "setlists", setlistId, "songs", songDocId);
    await updateDoc(songDocRef, { notes: newNoteText });
}


// --- FAVORITES (MY LIST) ---

/** Добавляет или обновляет песню в "Моем списке" */
async function addToFavorites(songId, preferredKey) {
    const favoritesDocRef = doc(db, "favorites", "main_list");
    let result = { status: 'no-change' };

    await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(favoritesDocRef);
        const existingSongs = docSnap.exists() ? (docSnap.data().songs || []) : [];
        const existingSongIndex = existingSongs.findIndex(s => s.songId === songId);

        if (existingSongIndex > -1) {
            const existingEntry = existingSongs[existingSongIndex];
            if (existingEntry.preferredKey !== preferredKey) {
                existingSongs[existingSongIndex].preferredKey = preferredKey;
                result = { status: 'updated', key: preferredKey };
            } else {
                result = { status: 'exists', key: preferredKey };
            }
        } else {
            existingSongs.push({ songId, preferredKey });
            result = { status: 'added', key: preferredKey };
        }
        transaction.set(favoritesDocRef, { songs: existingSongs }, { merge: true });
    });
    return result;
}

/** Удаление песни из избранного */
async function removeFromFavorites(songIdToRemove) {
    const favoritesDocRef = doc(db, "favorites", "main_list");
    await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(favoritesDocRef);
        if (!docSnap.exists()) return;

        const existingSongs = docSnap.data().songs || [];
        const updatedSongs = existingSongs.filter(song => song.songId !== songIdToRemove);
        
        transaction.set(favoritesDocRef, { songs: updatedSongs }, { merge: true });
    });
}


export {
    loadAllSongsFromFirestore,
    loadVocalists,
    loadRepertoire,
    addToRepertoire,
    removeFromRepertoire,
    loadSetlists,
    createSetlist,
    updateSetlistName,
    deleteCurrentSetlist,
    loadCurrentSetlistSongs,
    addToCurrentSetlist,
    updateSongKeyInSetlist,
    deleteSongFromSetlist,
    saveNoteForSongInSetlist,
    addToFavorites,
    removeFromFavorites
}; 