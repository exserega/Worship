// Agape Worship App - API: Songs Module

import { db } from '../../../firebase-config.js';
import {
    collection, getDocs, updateDoc, doc, setDoc, deleteField, getDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import * as state from '../../../state.js';

const songsCollection = collection(db, "songs");

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

/** Сохранение отредактированного текста песни */
export async function saveSongEdit(songId, editedContent) {
    if (!songId || !editedContent) {
        throw new Error("Song ID and edited content are required");
    }

    const songRef = doc(db, "songs", songId);
    
    try {
        await updateDoc(songRef, {
            'Текст и аккорды (edited)': editedContent,
            hasWebEdits: true,
            lastEdited: new Date().toISOString()
        });
        
        console.log(`Песня ${songId} успешно отредактирована`);
        return { success: true };
    } catch (error) {
        console.error("Ошибка при сохранении редактирования песни:", error);
        throw error;
    }
}

/** Возврат к оригинальному тексту песни */
export async function revertToOriginal(songId) {
    if (!songId) {
        throw new Error("Song ID is required");
    }

    const songRef = doc(db, "songs", songId);
    
    try {
        await updateDoc(songRef, {
            'Текст и аккорды (edited)': deleteField(),
            hasWebEdits: false,
            lastEdited: deleteField()
        });
        
        console.log(`Песня ${songId} возвращена к оригиналу`);
        return { success: true };
    } catch (error) {
        console.error("Ошибка при возврате к оригиналу:", error);
        throw error;
    }
}

/** Получение статуса редактирования песни */
export async function getSongEditStatus(songId) {
    if (!songId) {
        throw new Error("Song ID is required");
    }

    const songRef = doc(db, "songs", songId);
    
    try {
        const songDoc = await getDoc(songRef);
        if (songDoc.exists()) {
            const songData = songDoc.data();
            return {
                hasWebEdits: songData.hasWebEdits || false,
                lastEdited: songData.lastEdited || null,
                editedContent: songData['Текст и аккорды (edited)'] || null
            };
        } else {
            throw new Error("Song not found");
        }
    } catch (error) {
        console.error("Ошибка при получении статуса редактирования:", error);
        throw error;
    }
}

export {
    loadAllSongsFromFirestore
}; 