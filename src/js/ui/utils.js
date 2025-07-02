// Agape Worship App - utils.js

import { songContent } from './domReferences.js';

/** Позиционирование кнопки копирования относительно #song-content */
export function positionCopyButton() {
    const copyBtn = document.getElementById('copy-text-button');
    const songContent = document.getElementById('song-content');
    
    if (!copyBtn || !songContent) return;
    
    const rect = songContent.getBoundingClientRect();
    
    // Позиционируем кнопку в правом верхнем углу контейнера с отступом
    copyBtn.style.left = `${rect.right - 30}px`; // 30px слева от правого края
    copyBtn.style.top = `${rect.top}px`;         // На уровне верхнего края (было -12px)
}

// Обновляем позицию при изменении размера окна и прокрутке
window.addEventListener('resize', positionCopyButton);
window.addEventListener('scroll', positionCopyButton); 