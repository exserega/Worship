// Agape Worship App - songEditor.js

import { 
    editStatusInfo,
    songEditorOverlay,
    songEditTextarea,
    revertToOriginalButton
} from './domReferences.js';

/** Обновляет статус редактирования песни */
export function updateEditStatus(songData) {
    if (!songData || !editStatusInfo) return;
    
    if (songData.hasWebEdits) {
        const editDate = songData.lastEditedInApp?.toDate ? 
            songData.lastEditedInApp.toDate().toLocaleDateString() : 
            'недавно';
        editStatusInfo.textContent = `✏️ Отредактировано ${editDate}`;
        editStatusInfo.style.color = 'var(--accent-color)';
        if (revertToOriginalButton) revertToOriginalButton.style.display = 'inline-flex';
    } else {
        editStatusInfo.textContent = '📄 Оригинал из Google Таблицы';
        editStatusInfo.style.color = 'var(--label-color)';
        if (revertToOriginalButton) revertToOriginalButton.style.display = 'none';
    }
}

/** Открывает редактор песни */
export function openSongEditor(songData) {
    if (!songData || !songEditorOverlay || !songEditTextarea) return;
    
    // Устанавливаем заголовок
    const editorTitle = document.getElementById('song-editor-title');
    if (editorTitle) {
        const cleanTitle = songData.name?.includes('(') ? 
            songData.name.split('(')[0].trim() : 
            (songData.name || 'Без названия');
        editorTitle.textContent = `Редактирование: ${cleanTitle}`;
    }
    
    // Загружаем текст в textarea
    const originalLyrics = songData.hasWebEdits 
        ? (songData['Текст и аккорды (edited)'] || '') 
        : (songData['Текст и аккорды'] || '');
    songEditTextarea.value = originalLyrics;
    
    // Обновляем статус
    updateEditStatus(songData);
    
    // Показываем модальное окно
    songEditorOverlay.classList.add('visible');
    
    // Фокусируемся на textarea
    setTimeout(() => {
        songEditTextarea.focus();
        songEditTextarea.setSelectionRange(0, 0);
    }, 100);
}

/** Закрывает редактор песни */
export function closeSongEditor() {
    if (!songEditorOverlay) return;
    
    songEditorOverlay.classList.remove('visible');
    
    // Очищаем textarea
    if (songEditTextarea) {
        songEditTextarea.value = '';
    }
}

/** Получает текущие данные песни */
export function getCurrentSongData() {
    // Получаем ID текущей выбранной песни из селекта
    const songSelect = document.getElementById('song-select');
    if (!songSelect || !songSelect.value) return null;
    
    // Находим песню в состоянии приложения
    const songId = songSelect.value;
    // Временно используем глобальный state, позже заменим на импорт
    return window.state?.allSongs?.find(s => s.id === songId) || null;
} 