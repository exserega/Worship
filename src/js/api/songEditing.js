// Agape Worship App - API: Song Editing Module

import { db } from '../../../firebase-config.js';
import {
    updateDoc, doc, deleteField, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/**
 * Сохраняет отредактированный контент песни в Firebase
 * @param {string} songId - ID песни
 * @param {string} editedContent - Отредактированный текст с аккордами
 * @returns {Promise<void>}
 */
async function saveSongEdit(songId, editedContent) {
    if (!songId || !editedContent) {
        throw new Error('songId и editedContent обязательны');
    }
    
    const songRef = doc(db, 'songs', songId);
    
    try {
        await updateDoc(songRef, {
            'Текст и аккорды (edited)': editedContent,
            'hasWebEdits': true,
            'lastEditedInApp': serverTimestamp(),
            'editedBy': 'web-user' // TODO: добавить ID пользователя при авторизации
        });
        console.log(`✅ Песня "${songId}" успешно отредактирована`);
    } catch (error) {
        console.error(`❌ Ошибка сохранения изменений для "${songId}":`, error);
        throw error;
    }
}

/**
 * Откатывает песню к оригинальному тексту из Google Таблицы
 * @param {string} songId - ID песни
 * @returns {Promise<void>}
 */
async function revertToOriginal(songId) {
    if (!songId) {
        throw new Error('songId обязателен');
    }
    
    const songRef = doc(db, 'songs', songId);
    
    try {
        await updateDoc(songRef, {
            'hasWebEdits': false,
            'Текст и аккорды (edited)': deleteField(),
            'lastEditedInApp': deleteField(),
            'editedBy': deleteField()
        });
        console.log(`🔄 Песня "${songId}" возвращена к оригиналу`);
    } catch (error) {
        console.error(`❌ Ошибка отката для "${songId}":`, error);
        throw error;
    }
}

/**
 * Получает статус редактирования песни
 * @param {string} songId - ID песни
 * @returns {Promise<{hasWebEdits: boolean, lastEditedInApp: any, editedBy: string}>}
 */
async function getSongEditStatus(songId) {
    if (!songId) {
        throw new Error('songId обязателен');
    }
    
    const songRef = doc(db, 'songs', songId);
    
    try {
        const docSnap = await getDoc(songRef);
        if (!docSnap.exists()) {
            throw new Error(`Песня "${songId}" не найдена`);
        }
        
        const data = docSnap.data();
        return {
            hasWebEdits: data.hasWebEdits || false,
            lastEditedInApp: data.lastEditedInApp || null,
            editedBy: data.editedBy || null,
            editedContent: data['Текст и аккорды (edited)'] || null,
            originalContent: data['Текст и аккорды'] || ''
        };
    } catch (error) {
        console.error(`❌ Ошибка получения статуса для "${songId}":`, error);
        throw error;
    }
}

export {
    saveSongEdit,
    revertToOriginal,
    getSongEditStatus
}; 