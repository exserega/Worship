// Agape Worship App - API: Setlists Module

import { db } from '../../../firebase-config.js';
import {
    collection, addDoc, query, orderBy, getDocs, deleteDoc, doc, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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

/**
 * Добавляет песню в массив `songs` документа сетлиста или предлагает обновить ключ.
 * @param {string} setlistId
 * @param {string} songId
 * @param {string} preferredKey
 * @returns {Promise<{status: string, existingKey?: string, message?: string}>}
 */
async function addSongToSetlist(setlistId, songId, preferredKey) {
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

/**
 * Удаляет песню из массива `songs` в документе сетлиста.
 * @param {string} setlistId
 * @param {string} songIdToRemove
 */
async function removeSongFromSetlist(setlistId, songIdToRemove) {
    const setlistRef = doc(db, "worship_setlists", setlistId);
    return await runTransaction(db, async (transaction) => {
        const setlistDoc = await transaction.get(setlistRef);
        if (!setlistDoc.exists()) throw new Error("Setlist does not exist!");

        const songs = setlistDoc.data().songs || [];
        const updatedSongs = songs.filter(song => song.songId !== songIdToRemove);

        // Пересчитываем `order` для оставшихся песен
        const reorderedSongs = updatedSongs.map((song, index) => ({ ...song, order: index }));

        transaction.update(setlistRef, { songs: reorderedSongs });
    });
}

export {
    loadSetlists,
    createSetlist,
    deleteSetlist,
    addSongToSetlist,
    updateSongKeyInSetlist,
    removeSongFromSetlist
}; 