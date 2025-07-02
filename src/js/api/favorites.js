// Agape Worship App - api/favorites.js
// API для работы с избранным

import * as state from '../state/index.js';

// --- FAVORITES ---

/**
 * Добавляет песню в избранное.
 * @param {string} songId - ID песни.
 * @param {string} preferredKey - Предпочитаемая тональность.
 * @returns {Promise<{status: string}>}
 */
export async function addToFavorites(songId, preferredKey) {
    try {
        const song = state.allSongs.find(s => s.id === songId);
        if (!song) {
            throw new Error("Song not found");
        }

        const existingIndex = state.favorites.findIndex(f => f.songId === songId);
        
        if (existingIndex > -1) {
            // Песня уже в избранном, обновляем тональность
            state.favorites[existingIndex].preferredKey = preferredKey;
            state.setFavorites([...state.favorites]);
            return { status: 'updated' };
        } else {
            // Добавляем новую песню в избранное
            const newFavorite = {
                songId: songId,
                name: song.name,
                sheet: song.sheet,
                preferredKey: preferredKey,
                addedAt: new Date().toISOString()
            };
            
            const newFavorites = [...state.favorites, newFavorite];
            state.setFavorites(newFavorites);
            return { status: 'added' };
        }
    } catch (error) {
        console.error("Ошибка при добавлении в избранное:", error);
        throw error;
    }
}

/**
 * Удаляет песню из избранного.
 * @param {string} songIdToRemove - ID песни для удаления.
 * @returns {Promise<{status: string}>}
 */
export async function removeFromFavorites(songIdToRemove) {
    try {
        const newFavorites = state.favorites.filter(f => f.songId !== songIdToRemove);
        state.setFavorites(newFavorites);
        return { status: 'removed' };
    } catch (error) {
        console.error("Ошибка при удалении из избранного:", error);
        throw error;
    }
} 