// Agape Worship App - api.js

// Import from new modular API structure
import * as api from './src/js/api/index.js';

// Legacy imports for backward compatibility
import { db } from './firebase-config.js';
import {
    collection, addDoc, query, onSnapshot, updateDoc, deleteDoc, setDoc, doc,
    orderBy, getDocs, where, getDoc, runTransaction, serverTimestamp, deleteField
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import * as state from './state.js';

const songsCollection = collection(db, "songs");
const setlistsCollection = collection(db, "setlists");
const vocalistsCollection = collection(db, "vocalists");

// --- SONGS ---

/** Загрузка данных со ВСЕХ песен из Firestore */
const loadAllSongsFromFirestore = api.loadAllSongsFromFirestore;


// --- VOCALISTS & REPERTOIRE ---

/** Загрузка списка вокалистов */
const loadVocalists = api.loadVocalists;

/** Загрузка репертуара вокалиста с использованием callback для обновления UI */
const loadRepertoire = api.loadRepertoire;

/**
 * Добавляет или обновляет песню в репертуаре вокалиста.
 * Проверяет наличие по имени песни, чтобы избежать дубликатов.
 * @param {string} vocalistId
 * @param {object} song - Объект песни.
 * @param {string} preferredKey - Выбранная тональность.
 * @returns {Promise<{status: string, key: string}>}
 */
const addToRepertoire = api.addToRepertoire;

/** Удаление песни из репертуара вокалиста */
const removeFromRepertoire = api.removeFromRepertoire;

// --- SETLISTS ---

/**
 * Загружает все сетлисты из Firestore.
 * @returns {Promise<Array>} Массив объектов сетлистов.
 */
const loadSetlists = api.loadSetlists;

/**
 * Создает новый сетлист в Firestore.
 * @param {string} name - Название нового сетлиста.
 * @returns {Promise<DocumentReference>} Ссылка на созданный документ.
 */
const createSetlist = api.createSetlist;

/**
 * Удаляет сетлист из Firestore.
 * @param {string} setlistId - ID удаляемого сетлиста.
 */
const deleteSetlist = api.deleteSetlist;

/**
 * Добавляет песню в массив `songs` документа сетлиста или предлагает обновить ключ.
 * @param {string} setlistId
 * @param {string} songId
 * @param {string} preferredKey
 * @returns {Promise<{status: string, existingKey?: string, message?: string}>}
 */
const addSongToSetlist = api.addSongToSetlist;

/**
 * Обновляет тональность существующей песни в сетлисте.
 * @param {string} setlistId
 * @param {string} songId
 * @param {string} newKey
 */
const updateSongKeyInSetlist = api.updateSongKeyInSetlist;

/**
 * Удаляет песню из массива `songs` в документе сетлиста.
 * @param {string} setlistId
 * @param {string} songIdToRemove
 */
const removeSongFromSetlist = api.removeSongFromSetlist;


// --- FAVORITES (MY LIST) ---

/** Добавляет или обновляет песню в "Моем списке" */
const addToFavorites = api.addToFavorites;

/** Удаление песни из избранного */
const removeFromFavorites = api.removeFromFavorites;


// --- SONG EDITING ---

/**
 * Сохраняет отредактированный контент песни в Firebase
 * @param {string} songId - ID песни
 * @param {string} editedContent - Отредактированный текст с аккордами
 * @returns {Promise<void>}
 */
const saveSongEdit = api.saveSongEdit;

/**
 * Откатывает песню к оригинальному тексту из Google Таблицы
 * @param {string} songId - ID песни
 * @returns {Promise<void>}
 */
const revertToOriginal = api.revertToOriginal;

/**
 * Получает статус редактирования песни
 * @param {string} songId - ID песни
 * @returns {Promise<{hasWebEdits: boolean, lastEditedInApp: any, editedBy: string}>}
 */
const getSongEditStatus = api.getSongEditStatus;


export {
    loadAllSongsFromFirestore,
    loadVocalists,
    loadRepertoire,
    addToRepertoire,
    removeFromRepertoire,
    loadSetlists,
    createSetlist,
    deleteSetlist,
    addSongToSetlist,
    updateSongKeyInSetlist,
    removeSongFromSetlist,
    addToFavorites,
    removeFromFavorites,
    saveSongEdit,
    revertToOriginal,
    getSongEditStatus
}; 