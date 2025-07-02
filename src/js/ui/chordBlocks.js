// Agape Worship App - chordBlocks.js

import { songContent } from './domReferences.js';

// Переменные для хранения оригинального HTML
let originalMainContentHTML = null;
let originalPresentationContentHTML = null;

/** Функция для скрытия/показа блоков содержащих только аккорды */
export function toggleChordOnlyBlocks(shouldHide) {
    // Находим все блоки песни в основном контенте
    const songBlocks = songContent.querySelectorAll('.song-block');
    
    songBlocks.forEach(block => {
        if (shouldHide) {
            // Проверяем, содержит ли блок только аккорды
            if (isChordOnlyBlock(block)) {
                block.style.display = 'none';
                block.classList.add('chord-only-hidden');
            }
        } else {
            // Показываем все ранее скрытые блоки с только аккордами
            if (block.classList.contains('chord-only-hidden')) {
                block.style.display = '';
                block.classList.remove('chord-only-hidden');
            }
        }
    });
    
    // Также обрабатываем блоки в режиме презентации
    const presentationBlocks = document.querySelectorAll('.presentation-content .song-block');
    presentationBlocks.forEach(block => {
        if (shouldHide) {
            if (isChordOnlyBlock(block)) {
                block.style.display = 'none';
                block.classList.add('chord-only-hidden');
            }
        } else {
            if (block.classList.contains('chord-only-hidden')) {
                block.style.display = '';
                block.classList.remove('chord-only-hidden');
            }
        }
    });
    
    // ВРЕМЕННО ОТКЛЮЧЕНО: Обработка пустых строк
    // if (shouldHide) {
    //     removeEmptyLinesAfterChordHiding();
    // } else {
    //     restoreOriginalHTML();
    // }
}

/** Функция для проверки, содержит ли блок только аккорды */
function isChordOnlyBlock(block) {
    const content = block.querySelector('.song-block-content');
    if (!content) return false;
    
    // Клонируем контент для анализа
    const contentClone = content.cloneNode(true);
    
    // Убираем все элементы с классом chord
    const chordElements = contentClone.querySelectorAll('.chord');
    chordElements.forEach(chord => chord.remove());
    
    // Проверяем, остался ли какой-то значимый текст
    const remainingText = contentClone.textContent.trim();
    
    // Если остался только пробелы, переносы строк и знаки препинания - считаем блок содержащим только аккорды
    const onlyWhitespaceAndPunctuation = /^[\s\n\r\t.,;:!?\-()[\]{}|/\\]*$/;
    
    return remainingText === '' || onlyWhitespaceAndPunctuation.test(remainingText);
}

/** Удаляет пустые строки после скрытия аккордов */
function removeEmptyLinesAfterChordHiding() {
    // Сохраняем оригинальный HTML основного контента
    const mainPre = songContent.querySelector('#song-display');
    if (mainPre && !originalMainContentHTML) {
        originalMainContentHTML = mainPre.innerHTML;
    }
    
    // Сохраняем оригинальный HTML презентации
    const presentationPre = document.querySelector('.presentation-content pre');
    if (presentationPre && !originalPresentationContentHTML) {
        originalPresentationContentHTML = presentationPre.innerHTML;
    }
    
    // Обрабатываем основной контент
    if (mainPre) {
        setTimeout(() => {
            processElementTextContent(mainPre);
        }, 150); // Еще больше времени для CSS
    }
    
    // Обрабатываем презентацию
    if (presentationPre) {
        setTimeout(() => {
            processElementTextContent(presentationPre);
        }, 150);
    }
}

/** Обрабатывает DOM, удаляя пустые строки из текстовых узлов */
function processElementTextContent(element) {
    // Получаем все текстовые узлы в элементе
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
        textNodes.push(node);
    }
    
    // Обрабатываем каждый текстовый узел
    textNodes.forEach(textNode => {
        if (textNode.nodeValue) {
            // Удаляем пустые строки из текстового узла
            const cleanedText = textNode.nodeValue
                .replace(/\n\s*\n+/g, '\n') // Убираем множественные переносы
                .replace(/^\s*\n+/, '') // Убираем переносы в начале
                .replace(/\n+\s*$/, ''); // Убираем переносы в конце
            
            textNode.nodeValue = cleanedText;
        }
    });
}

/** Восстанавливает оригинальный HTML при показе аккордов */
function restoreOriginalHTML() {
    // Восстанавливаем основной контент
    const mainPre = songContent.querySelector('#song-display');
    if (mainPre && originalMainContentHTML) {
        mainPre.innerHTML = originalMainContentHTML;
        originalMainContentHTML = null;
    }
    
    // Восстанавливаем презентацию
    const presentationPre = document.querySelector('.presentation-content pre');
    if (presentationPre && originalPresentationContentHTML) {
        presentationPre.innerHTML = originalPresentationContentHTML;
        originalPresentationContentHTML = null;
    }
} 