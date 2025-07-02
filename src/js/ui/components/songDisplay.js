// Agape Worship App - ui/components/songDisplay.js
// Компонент отображения песен

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
    splitTextButton,
    metronomeButton
} from '../dom.js';
import { 
    getRenderedSongText, 
    extractYouTubeVideoId 
} from '../../core/index.js';
import * as state from '../../state/index.js';

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
    const bpm = songData['BPM'] || 'N/A';
    const youtubeUrl = songData['YouTube URL'] || '';

    // Обновляем заголовок песни
    const songTitleText = songContent.querySelector('.song-title-text');
    if (songTitleText) songTitleText.textContent = title;

    // Устанавливаем тональность
    const targetKey = keyToSelect || originalKeyFromSheet;
    keySelect.value = targetKey;
    keySelect.dataset.songId = songData.id;

    // Обрабатываем и отображаем текст песни
    const processedText = getRenderedSongText(originalLyrics, originalKeyFromSheet, targetKey);
    const songPre = songContent.querySelector('#song-display');
    if (songPre) songPre.innerHTML = processedText;

    // Обновляем BPM
    if (bpmDisplay) bpmDisplay.textContent = bpm;

    // Обрабатываем YouTube видео
    if (youtubeUrl && youtubeUrl.trim()) {
        const videoId = extractYouTubeVideoId(youtubeUrl);
        if (videoId) {
            const embedUrl = `https://www.youtube.com/embed/${videoId}`;
            playerContainer.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`;
            playerSection.style.display = 'block';
            
            if (keyDisplay) {
                keyDisplay.textContent = `Тональность: ${targetKey}`;
                keyDisplay.style.display = 'block';
            }
        } else {
            playerContainer.innerHTML = '';
            playerSection.style.display = 'none';
            if (keyDisplay) keyDisplay.style.display = 'none';
        }
    } else {
        playerContainer.innerHTML = '';
        playerSection.style.display = 'none';
        if (keyDisplay) keyDisplay.style.display = 'none';
    }

    // Обновляем кнопку Holychords
    if (holychordsButton) {
        if (youtubeUrl && youtubeUrl.trim()) {
            holychordsButton.href = `https://holychords.com/song/${extractYouTubeVideoId(youtubeUrl)}`;
            holychordsButton.style.display = 'inline-flex';
        } else {
            holychordsButton.style.display = 'none';
        }
    }

    // Активируем кнопки
    favoriteButton.disabled = false;
    addToSetlistButton.disabled = false;
    addToRepertoireButton.disabled = false;
    toggleChordsButton.disabled = false;

    // Показываем кнопки копирования и редактирования
    const copyBtn = songContent.querySelector('#copy-text-button');
    const editBtn = songContent.querySelector('#edit-song-button');
    if (copyBtn) copyBtn.style.display = 'inline-flex';
    if (editBtn) editBtn.style.display = 'inline-flex';

    // Позиционируем кнопку копирования
    positionCopyButton();
}

/** Позиционирует кнопку копирования */
export function positionCopyButton() {
    const copyBtn = songContent.querySelector('#copy-text-button');
    if (!copyBtn) return;

    const songTitle = songContent.querySelector('#song-title');
    if (songTitle) {
        const titleRect = songTitle.getBoundingClientRect();
        const containerRect = songContent.getBoundingClientRect();
        
        copyBtn.style.position = 'absolute';
        copyBtn.style.right = '10px';
        copyBtn.style.top = `${titleRect.top - containerRect.top + 5}px`;
    }
}

/** Обновляет размер шрифта */
export function updateFontSize() {
    const songPre = songContent.querySelector('#song-display');
    if (songPre) {
        songPre.style.fontSize = `${state.currentFontSize}px`;
    }
}

/** Обновляет BPM */
export function updateBPM(newBPM) {
    if (bpmDisplay) {
        bpmDisplay.textContent = newBPM || 'N/A';
    }
}

/** Обновляет состояние кнопки переключения аккордов */
export function updateToggleChordsButton() {
    if (!toggleChordsButton) return;
    
    if (state.areChordsVisible) {
        toggleChordsButton.classList.remove('chords-hidden-active');
        toggleChordsButton.title = 'Скрыть аккорды';
        const icon = toggleChordsButton.querySelector('i');
        if (icon) icon.className = 'fas fa-guitar';
    } else {
        toggleChordsButton.classList.add('chords-hidden-active');
        toggleChordsButton.title = 'Показать аккорды';
        const icon = toggleChordsButton.querySelector('i');
        if (icon) icon.className = 'fas fa-eye-slash';
    }
}

/** Обновляет состояние кнопки "только аккорды" */
export function updateChordsOnlyButton() {
    if (!chordsOnlyButton) return;
    
    if (state.isChordsOnlyMode) {
        chordsOnlyButton.classList.add('chords-only-active');
        chordsOnlyButton.title = 'Показать текст и аккорды';
        const textIcon = chordsOnlyButton.querySelector('.text-icon');
        if (textIcon) textIcon.textContent = 'T+A';
    } else {
        chordsOnlyButton.classList.remove('chords-only-active');
        chordsOnlyButton.title = 'Показать только аккорды';
        const textIcon = chordsOnlyButton.querySelector('.text-icon');
        if (textIcon) textIcon.textContent = 'T';
    }
}

/** Обновляет состояние кнопки разделения текста */
export function updateSplitButton() {
    if (!splitTextButton) return;
    
    const isSplit = songContent.classList.contains('split-columns');
    if (isSplit) {
        splitTextButton.classList.add('split-active');
        splitTextButton.title = 'Объединить текст';
    } else {
        splitTextButton.classList.remove('split-active');
        splitTextButton.title = 'Разделить текст';
    }
}

/** Обновляет состояние кнопки метронома */
export function updateMetronomeButton(isActive) {
    if (!metronomeButton) return;
    
    const icon = metronomeButton.querySelector('i');
    const text = metronomeButton.querySelector('.button-text');
    
    if (isActive) {
        if (icon) icon.className = 'fas fa-stop';
        if (text) text.textContent = 'Стоп';
        metronomeButton.title = 'Остановить метроном';
    } else {
        if (icon) icon.className = 'fas fa-play';
        if (text) text.textContent = 'Метроном';
        metronomeButton.title = 'Включить метроном';
    }
} 