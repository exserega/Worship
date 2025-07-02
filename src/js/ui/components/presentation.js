import * as state from '../../state/index.js';
import { getRenderedSongText, distributeSongBlocksToColumns } from '../../core/index.js';
import { toggleChordOnlyBlocks } from './chordBlocks.js';
import { 
    presentationOverlay, 
    presentationContent, 
    presentationControls,
    presCounter,
    presPrevBtn,
    presNextBtn,
    presSplitTextBtn
} from '../dom.js';

let controlsHideTimeout;

/** Показывает режим презентации */
export function showPresentationView(onSongChange) {
    const songsToShow = state.currentSetlistSongs;
    if (!songsToShow || songsToShow.length === 0) {
         alert("Нет песен для показа в презентации.");
         return;
    }
    state.setPresentationSongs([...songsToShow]);
    state.setCurrentPresentationIndex(0);
    state.setIsPresentationSplit(false);
    updatePresentationSplitButtonState();
    
    onSongChange(); // Display first song

    presentationOverlay.classList.add('visible');
    presentationOverlay.scrollTop = 0;
    showPresentationControls();
}

/** Отображает текущую песню в презентации */
export function displayCurrentPresentationSong() {
    if (state.presentationSongs.length === 0) return;

    state.setCurrentPresentationIndex(Math.max(0, Math.min(state.currentPresentationIndex, state.presentationSongs.length - 1)));
    const songRef = state.presentationSongs[state.currentPresentationIndex];
    presentationContent.innerHTML = `<div class="presentation-loading">Загрузка...</div>`;

    const song = state.allSongs.find(s => s.id === songRef.songId);
    if (!song) {
        presentationContent.innerHTML = `<div class="presentation-song error"><h2>Ошибка загрузки песни</h2><p>Не найдены данные для песни.</p></div>`;
        return;
    }

    const songTitle = song.name;
    const originalLyrics = song['Текст и аккорды'] || '';
    const originalKey = song['Оригинальная тональность'] || "C";
    const targetKey = songRef.preferredKey || originalKey;
    const songNote = songRef.notes || '';

    let finalHighlightedLyrics = getRenderedSongText(originalLyrics, originalKey, targetKey);
    
    // Если включен двухколоночный режим в презентации, распределяем блоки
    if (state.isPresentationSplit) {
        finalHighlightedLyrics = distributeSongBlocksToColumns(finalHighlightedLyrics);
    }

    const songHtml = `
        <div class="presentation-song">
            <h2>${songTitle} — ${targetKey}</h2>
            ${songNote ? `<div class="presentation-notes"><i class="fas fa-info-circle"></i> ${songNote.replace(/\n/g, '<br>')}</div>` : ''}
            <pre>${finalHighlightedLyrics}</pre> 
        </div>
    `;
    presentationContent.innerHTML = songHtml;
    presentationContent.classList.toggle('split-columns', state.isPresentationSplit);
    presentationContent.classList.toggle('chords-hidden', !state.areChordsVisible);
    presentationContent.classList.toggle('chords-only-mode', state.isChordsOnlyMode);
    
    // Применяем скрытие блоков с только аккордами в режиме презентации
    toggleChordOnlyBlocks(!state.areChordsVisible);

    presCounter.textContent = `${state.currentPresentationIndex + 1} / ${state.presentationSongs.length}`;
    presPrevBtn.disabled = (state.currentPresentationIndex === 0);
    presNextBtn.disabled = (state.currentPresentationIndex >= state.presentationSongs.length - 1);
}

/** Показывает элементы управления презентацией */
export function showPresentationControls() {
    presentationControls.classList.remove('controls-hidden');
    clearTimeout(controlsHideTimeout);
    controlsHideTimeout = setTimeout(hidePresentationControls, 3000); // CONTROLS_HIDE_DELAY
}

/** Скрывает элементы управления презентацией */
export function hidePresentationControls() {
    presentationControls.classList.add('controls-hidden');
}

/** Обновляет состояние кнопки разделения текста в презентации */
export function updatePresentationSplitButtonState() {
    const iconElement = presSplitTextBtn.querySelector('i');
    if (state.isPresentationSplit) {
        iconElement.className = 'fas fa-align-justify';
        presSplitTextBtn.title = 'Объединить колонки';
    } else {
        iconElement.className = 'fas fa-columns';
        presSplitTextBtn.title = 'Разделить текст';
    }
} 