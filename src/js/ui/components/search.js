import * as state from '../../state/index.js';
import { SONG_CATEGORIES_ORDER } from '../../utils/constants.js';
import { 
    sheetSelect, 
    songSelect, 
    searchResults 
} from '../dom.js';
import { displaySongDetails } from './songDisplay.js';

/** Заполняет выпадающий список категорий (листов) */
export function populateSheetSelect() {
    sheetSelect.innerHTML = '<option value="">-- Выберите категорию --</option>';
    SONG_CATEGORIES_ORDER.forEach(categoryName => {
        if (state.songsBySheet[categoryName] && state.songsBySheet[categoryName].length > 0) {
            const option = document.createElement('option');
            option.value = categoryName;
            option.textContent = categoryName;
            sheetSelect.appendChild(option);
        }
    });
    Object.keys(state.songsBySheet).forEach(categoryName => {
        if (!SONG_CATEGORIES_ORDER.includes(categoryName)) {
            const option = document.createElement('option');
            option.value = categoryName;
            option.textContent = categoryName;
            sheetSelect.appendChild(option);
        }
    });
}

/** Загрузка песен в select#song-select для выбранной категории или всех песен */
export function populateSongSelect() {
    const sheetName = sheetSelect.value;
    songSelect.innerHTML = '<option value="">-- Песня --</option>';

    if (sheetName) {
        // Показываем песни выбранной категории
        const songs = state.songsBySheet[sheetName];
        if (songs && songs.length > 0) {
            songs.forEach(song => {
                const option = document.createElement('option');
                option.value = song.id;
                option.textContent = song.name;
                songSelect.appendChild(option);
            });
            songSelect.disabled = false;
        } else {
            songSelect.innerHTML = '<option value="">-- Нет песен в категории --</option>';
            songSelect.disabled = true;
        }
    } else {
        // Показываем все песни в алфавитном порядке
        const allSongs = state.allSongs || [];
        if (allSongs.length > 0) {
            // Сортируем все песни по алфавиту
            const sortedSongs = [...allSongs].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            sortedSongs.forEach(song => {
                const option = document.createElement('option');
                option.value = song.id;
                // Показываем название песни и категорию для удобства
                option.textContent = `${song.name}${song.sheet ? ` (${song.sheet})` : ''}`;
                songSelect.appendChild(option);
            });
            songSelect.disabled = false;
        } else {
            songSelect.innerHTML = '<option value="">-- Песни не загружены --</option>';
            songSelect.disabled = true;
        }
    }
    displaySongDetails(null);
}

/** Отображение результатов поиска */
export function displaySearchResults(matchingSongs, onSelect) {
    searchResults.innerHTML = '';
    if (matchingSongs.length === 0) {
        searchResults.innerHTML = '<div class="search-result">Ничего не найдено</div>';
        return;
    }
    matchingSongs.forEach((songMatch) => {
        const resultItem = document.createElement('div');
        resultItem.textContent = `${songMatch.name} (${songMatch.sheet || 'Без категории'})`;
        resultItem.className = 'search-result';
        resultItem.addEventListener('click', () => onSelect(songMatch));
        searchResults.appendChild(resultItem);
    });
} 