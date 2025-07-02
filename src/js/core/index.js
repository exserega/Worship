// Agape Worship App - core/index.js
// Основной модуль core, объединяющий все подмодули

// Импортируем все функции из подмодулей
import { getTransposition, transposeLyrics, processLyrics, highlightChords } from './transposition.js';

export { 
    setupAudioContext, 
    resumeAudioContext, 
    toggleMetronome, 
    getMetronomeState,
    audioContext, 
    audioBuffer, 
    metronomeInterval, 
    isMetronomeActive, 
    currentBeat 
} from './metronome.js';

export { 
    wrapSongBlocks, 
    correctBlockType, 
    demonstrateParser, 
    resetParserLearning 
} from './songParser.js';

// Дополнительные функции из оригинального core.js
import { wrapSongBlocks } from './songParser.js';

/** Выделение структуры песни */
export function highlightStructure(lyrics) {
    if (!lyrics) return '';
    return wrapSongBlocks(lyrics);
}

/** Получение обработанного текста песни */
export function getRenderedSongText(originalLyrics, originalKey, targetKey) {
    if (!originalLyrics) return '';
    
    const transposition = getTransposition(originalKey, targetKey);
    const transposedLyrics = transposeLyrics(originalLyrics, transposition);
    const processedLyrics = processLyrics(transposedLyrics);
    const highlightedLyrics = highlightChords(processedLyrics);
    const structuredLyrics = highlightStructure(highlightedLyrics);
    
    return structuredLyrics;
}

/** Извлечение ID видео YouTube из URL */
export function extractYouTubeVideoId(url) {
    if (!url) return null;
    
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/v\/([^&\n?#]+)/,
        /youtube\.com\/watch\?.*&v=([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    
    return null;
}

/** Проверка мобильного представления */
export function isMobileView() {
    return window.innerWidth <= 768;
}

/** Распределение блоков песни по колонкам */
export function distributeSongBlocksToColumns(processedHTML) {
    if (!processedHTML) return processedHTML;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = processedHTML;
    
    const blocks = tempDiv.querySelectorAll('.song-block');
    if (blocks.length === 0) return processedHTML;
    
    const column1 = document.createElement('div');
    column1.className = 'column-1';
    const column2 = document.createElement('div');
    column2.className = 'column-2';
    
    blocks.forEach((block, index) => {
        if (index % 2 === 0) {
            column1.appendChild(block.cloneNode(true));
        } else {
            column2.appendChild(block.cloneNode(true));
        }
    });
    
    tempDiv.innerHTML = '';
    tempDiv.appendChild(column1);
    tempDiv.appendChild(column2);
    
    return tempDiv.innerHTML;
} 