// Agape Worship App - API: Favorites Module

import { db } from '../../../firebase-config.js';
import {
    doc, runTransaction
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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
    addToFavorites,
    removeFromFavorites
}; 