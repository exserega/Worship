// Agape Worship App - api.js

import { db } from './firebase-config.js';
import {
    collection, addDoc, query, onSnapshot, updateDoc, deleteDoc, setDoc, doc,
    orderBy, getDocs, where, getDoc, runTransaction, serverTimestamp
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
    if (!vocalistId || !repertoireDocId) return;
    const docRef = doc(db, 'vocalists', vocalistId, 'repertoire', repertoireDocId);
    await deleteDoc(docRef);
}

// --- SETLISTS ---

/**
 * Загружает все сетлисты из Firestore.
 * @returns {Promise<Array>} Массив объектов сетлистов.
 */
async function loadSetlists() {
    const setlistsCol = collection(db, "worship_setlists");
    const q = query(setlistsCol, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        console.log("No setlists found.");
        return [];
    }
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Создает новый сетлист в Firestore.
 * @param {string} name - Название нового сетлиста.
 * @returns {Promise<DocumentReference>} Ссылка на созданный документ.
 */
async function createSetlist(name) {
    if (!name || name.trim() === '') {
        throw new Error("Setlist name cannot be empty.");
    }
    const setlistsCol = collection(db, "worship_setlists");
    return await addDoc(setlistsCol, {
        name: name.trim(),
        createdAt: serverTimestamp(),
        songs: [] // Инициализируем пустым массивом песен
    });
}

/**
 * Удаляет сетлист из Firestore.
 * @param {string} setlistId - ID удаляемого сетлиста.
 */
async function deleteSetlist(setlistId) {
    if (!setlistId) return;
    const docRef = doc(db, 'worship_setlists', setlistId);
    await deleteDoc(docRef);
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

/** Сохранение заметки для песни в сет-листе */
async function saveNoteForSongInSetlist(setlistId, songDocId, newNoteText) {
    const songDocRef = doc(db, "setlists", setlistId, "songs", songDocId);
    await updateDoc(songDocRef, { notes: newNoteText });
}

/**
 * Добавляет песню в массив `songs` документа сетлиста или предлагает обновить ключ.
 * @param {string} setlistId
 * @param {string} songId
 * @param {string} preferredKey
 * @returns {Promise<{status: string, existingKey?: string, message?: string}>}
 */
export async function addSongToSetlist(setlistId, songId, preferredKey) {
    const setlistRef = doc(db, "worship_setlists", setlistId);
    let result = {};
    await runTransaction(db, async (transaction) => {
        const setlistDoc = await transaction.get(setlistRef);
        if (!setlistDoc.exists()) throw new Error("Setlist does not exist!");

        const songs = setlistDoc.data().songs || [];
        const existingSongIndex = songs.findIndex(s => s.songId === songId);

        if (existingSongIndex > -1) {
            const existingSong = songs[existingSongIndex];
            if (existingSong.preferredKey !== preferredKey) {
                result = { status: 'duplicate_key', existingKey: existingSong.preferredKey };
            } else {
                result = { status: 'duplicate_same' };
            }
        } else {
            songs.push({ songId, preferredKey, order: songs.length });
            transaction.update(setlistRef, { songs });
            result = { status: 'added' };
        }
    });
    return result;
}

/**
 * Обновляет тональность существующей песни в сетлисте.
 * @param {string} setlistId
 * @param {string} songId
 * @param {string} newKey
 */
async function updateSongKeyInSetlist(setlistId, songId, newKey) {
    const setlistRef = doc(db, "worship_setlists", setlistId);
     return await runTransaction(db, async (transaction) => {
        const setlistDoc = await transaction.get(setlistRef);
        if (!setlistDoc.exists()) throw new Error("Setlist does not exist!");
        const songs = setlistDoc.data().songs || [];
        const songIndex = songs.findIndex(s => s.songId === songId);
        if (songIndex > -1) {
            songs[songIndex].preferredKey = newKey;
            transaction.update(setlistRef, { songs });
        }
    });
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
    deleteSetlist,
    updateSetlistName,
    deleteCurrentSetlist,
    loadCurrentSetlistSongs,
    addToCurrentSetlist,
    saveNoteForSongInSetlist,
    addSongToSetlist,
    updateSongKeyInSetlist,
    addToFavorites,
    removeFromFavorites
}; 