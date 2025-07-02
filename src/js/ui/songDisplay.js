// Agape Worship App - songDisplay.js

import { 
    songContent,
    playerContainer,
    playerSection,
    bpmDisplay,
    holychordsButton,
    keySelect,
    favoriteButton,
    addToSetlistButton,
    addToRepertoireButton,
    toggleChordsButton,
    chordsOnlyButton,
    searchResults
} from './domReferences.js';
import * as state from '../../state.js';
import { 
    getRenderedSongText, 
    extractYouTubeVideoId, 
    distributeSongBlocksToColumns,
    isMobileView 
} from '../../core.js';
import { 
    updateBPM, 
    updateToggleChordsButton, 
    updateChordsOnlyButton, 
    updateFontSize 
} from './general.js';
import { toggleChordOnlyBlocks } from './chordBlocks.js';
import { positionCopyButton } from './utils.js';
import { updateEditStatus } from './songEditor.js';

/** Отображает детали выбранной песни */
export function displaySongDetails(songData, keyToSelect) {
    const keyDisplay = document.getElementById('youtube-video-key-display');

    if (!songData) {
        // Обновляем legend и pre, сохраняя fieldset структуру
        const songTitle = songContent.querySelector('#song-title');
        const songTitleText = songContent.querySelector('.song-title-text');
        const songPre = songContent.querySelector('#song-display');
        if (songTitleText) songTitleText.textContent = 'Выберите песню';
        if (songPre) songPre.textContent = '';
        
        playerContainer.innerHTML = '';
        playerSection.style.display = 'none';
        if (bpmDisplay) bpmDisplay.textContent = 'N/A';
        if (holychordsButton) holychordsButton.style.display = 'none';
        keySelect.value = "C";
        keySelect.dataset.songId = '';
        if (keyDisplay) keyDisplay.style.display = 'none';
        favoriteButton.disabled = true;
        addToSetlistButton.disabled = true;
        addToRepertoireButton.disabled = true;
        toggleChordsButton.disabled = true;
        songContent.classList.remove('chords-hidden');
        const copyBtn = songContent.querySelector('#copy-text-button');
        const editBtn = songContent.querySelector('#edit-song-button');
        if (copyBtn) copyBtn.style.display = 'none';
        if (editBtn) editBtn.style.display = 'none';
        return;
    }

    const title = songData.name || 'Без названия';
    // 🔥 ПРИОРИТЕТ: Используем отредактированный текст, если есть
    const originalLyrics = songData.hasWebEdits 
        ? (songData['Текст и аккорды (edited)'] || '') 
        : (songData['Текст и аккорды'] || '');
    const originalKeyFromSheet = songData['Оригинальная тональность'] || "C";
    const srcUrl = songData.Holychords || '#';
    const bpm = songData.BPM || 'N/A';
    const ytLink = songData['YouTube Link'];
    const videoKey = songData.videoKey ? String(songData.videoKey).trim() : null;

    const currentSelectedKey = keyToSelect || originalKeyFromSheet;
    keySelect.value = currentSelectedKey;
    keySelect.dataset.songId = songData.id;

    if (bpmDisplay) updateBPM(bpm);
    if (holychordsButton) {
        if (srcUrl && srcUrl.trim() !== '' && srcUrl.trim() !== '#') {
            holychordsButton.href = srcUrl;
            holychordsButton.style.display = 'inline-block';
        } else {
            holychordsButton.style.display = 'none';
        }
    }

    let finalHighlightedLyrics = getRenderedSongText(originalLyrics, originalKeyFromSheet, currentSelectedKey);
    
    // Если включен двухколоночный режим, распределяем блоки по колонкам
    if (songContent.classList.contains('split-columns')) {
        finalHighlightedLyrics = distributeSongBlocksToColumns(finalHighlightedLyrics);
    }
    
    // Обновляем legend и pre, сохраняя fieldset структуру
    const songTitle = songContent.querySelector('#song-title');
    const songTitleText = songContent.querySelector('.song-title-text');
    const songPre = songContent.querySelector('#song-display');
    const copyBtn = songContent.querySelector('#copy-text-button');
    const editBtn = songContent.querySelector('#edit-song-button');
    
    // Убираем из заголовка всё что идет после скобок (строчки для поиска)
    const cleanTitle = title.includes('(') ? title.split('(')[0].trim() : title;
    if (songTitleText) songTitleText.textContent = cleanTitle;
    if (songPre) songPre.innerHTML = finalHighlightedLyrics;
    if (copyBtn) {
        copyBtn.style.display = 'block';
        positionCopyButton(); // Позиционируем кнопку относительно #song-content
    }
    if (editBtn) {
        editBtn.style.display = 'block';
    }
    
    // Обновляем статус редактирования
    updateEditStatus(songData);
    
    updateFontSize();
    songContent.classList.toggle('chords-hidden', !state.areChordsVisible);
    songContent.classList.toggle('chords-only-mode', state.isChordsOnlyMode);
    
    // Скрываем блоки с только аккордами если аккорды скрыты
    toggleChordOnlyBlocks(!state.areChordsVisible);

    const vId = extractYouTubeVideoId(ytLink);
    if (vId) {
        const embedUrl = `https://www.youtube.com/embed/${vId}`;
        playerContainer.innerHTML = `<iframe width="100%" height="315" src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
        playerSection.style.display = 'block';
        if (keyDisplay) {
            if (videoKey) {
                keyDisplay.textContent = `Тональность в видео: ${videoKey}`;
                keyDisplay.style.display = 'block';
            } else {
                keyDisplay.style.display = 'none';
            }
        }
    } else {
        playerContainer.innerHTML = '';
        playerSection.style.display = 'none';
        if (keyDisplay) keyDisplay.style.display = 'none';
    }

    favoriteButton.disabled = false;
    addToSetlistButton.disabled = false;
    addToRepertoireButton.disabled = false;
    toggleChordsButton.disabled = false;
    chordsOnlyButton.disabled = false;
    updateToggleChordsButton();
    updateChordsOnlyButton();
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