// Agape Worship App - core.js

import { chords, structureMarkers } from './constants.js';

// Импорт функций из новых модулей
import { 
    getTransposition as getTranspositionNew, 
    transposeLyrics as transposeLyricsNew, 
    processLyrics as processLyricsNew, 
    highlightChords as highlightChordsNew,
    setupAudioContext as setupAudioContextNew,
    resumeAudioContext as resumeAudioContextNew,
    loadAudioFile as loadAudioFileNew,
    playClick as playClickNew,
    toggleMetronome as toggleMetronomeNew,
    getMetronomeState as getMetronomeStateNew,
    wrapSongBlocks as wrapSongBlocksNew,
    correctBlockType as correctBlockTypeNew,
    demonstrateParser as demonstrateParserNew,
    resetParserLearning as resetParserLearningNew
} from './src/js/core/index.js';

// --- REGEX & DERIVED CONSTANTS ---
const chordRegex = /([A-H][#b]?(?:maj7|maj9|m7|m9|m11|7sus4|sus4|sus2|add9|dim7|dim|aug7|aug|7|m|6|9|11|13|sus)?(?:\s*\/\s*[A-H][#b]?)?)/g;
const structureMarkersWithColon = structureMarkers.map(m => m + ':');
const allMarkers = [...structureMarkers, ...structureMarkersWithColon];


// --- TEXT PROCESSING & TRANSPOSITION ---

/** Расчет смещения для транспонирования */
function getTransposition(originalKey, newKey) {
    return getTranspositionNew(originalKey, newKey);
}

/** Транспонирование всего текста с аккордами */
function transposeLyrics(lyrics, transposition) {
    return transposeLyricsNew(lyrics, transposition);
}

/** Обработка строк текста - сокращаем пробелы в строках с аккордами в 2 раза */
function processLyrics(lyrics) {
    return processLyricsNew(lyrics);
}

/** Выделение аккордов тегами span для стилизации */
function highlightChords(lyrics) {
    return highlightChordsNew(lyrics);
}

// --- SONG PARSING ---
// Все функции парсинга теперь находятся в модуле songParser.js

/** РЕВОЛЮЦИОННАЯ ЗАМЕНА wrapSongBlocks */
function wrapSongBlocks(lyrics) {
    return wrapSongBlocksNew(lyrics);
}

/** Функция для ручной корректировки пользователем */
function correctBlockType(blockElement, newType, newLabel) {
    return correctBlockTypeNew(blockElement, newType, newLabel);
}

/** Экспорт функции корректировки для использования в UI */
window.correctSongBlockType = correctBlockType;

/** Функция демонстрации возможностей парсера */
function demonstrateParser() {
    return demonstrateParserNew();
}

/** Функция сброса данных обучения (для отладки) */
function resetParserLearning() {
    return resetParserLearningNew();
}

/** Экспорт функций для использования в консоли */
window.demonstrateParser = demonstrateParser;
window.resetParserLearning = resetParserLearning;

/** Выделение аккордов в уже обработанном тексте (устарело - заменено на wrapSongBlocks) */
function highlightStructure(lyrics) {
    // Теперь эта функция не нужна, так как структура обрабатывается в wrapSongBlocks
    return lyrics;
}

/** Комплексная обработка текста песни: обработка пробелов, транспонирование и подсветка. */
function getRenderedSongText(originalLyrics, originalKey, targetKey) {
    if (!originalLyrics) return '';
    const processedLyrics = processLyrics(originalLyrics);
    const transposition = getTransposition(originalKey, targetKey);
    const transposedLyrics = transposeLyrics(processedLyrics, transposition);
    const blocksWrappedLyrics = wrapSongBlocks(transposedLyrics);
    const finalHighlightedLyrics = highlightChords(blocksWrappedLyrics);
    
    return finalHighlightedLyrics;
}


// --- UTILITIES ---

/** Извлечение ID видео YouTube из URL */
function extractYouTubeVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    let videoId = null;
    try {
        const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        if (match && match[1]) {
            videoId = match[1];
        } else {
            if (url.length === 11 && /^[a-zA-Z0-9_-]+$/.test(url)) {
                videoId = url;
            }
        }
    } catch (e) {
        console.error("Error extracting YouTube video ID:", e, "URL:", url);
        return null;
    }
    return videoId;
}

/** Проверка, является ли текущий вид мобильным */
function isMobileView() {
    return window.innerWidth <= 768;
}


// --- METRONOME ---
// Переменные метронома теперь управляются в модуле metronome.js

/** Настройка AudioContext */
function setupAudioContext() {
    return setupAudioContextNew();
}

/** Возобновление AudioContext */
function resumeAudioContext() {
    return resumeAudioContextNew();
}

/** Загрузка аудиофайла для метронома */
async function loadAudioFile() {
    return loadAudioFileNew();
}

/** Воспроизведение одного клика метронома */
function playClick(beatsPerMeasure = 4) {
    return playClickNew(beatsPerMeasure);
}

/** Включение/выключение метронома. Возвращает новое состояние. */
async function toggleMetronome(bpm, beatsPerMeasure) {
    return toggleMetronomeNew(bpm, beatsPerMeasure);
}

function getMetronomeState() {
    return getMetronomeStateNew();
}

/** Правильное распределение блоков по колонкам С СОХРАНЕНИЕМ ПОРЯДКА */
function distributeSongBlocksToColumns(processedHTML) {
    if (!processedHTML) return processedHTML;
    
    // Создаем временный элемент для парсинга HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = processedHTML;
    
    // Находим все fieldset элементы (блоки песни)
    const blocks = Array.from(tempDiv.querySelectorAll('.song-block'));
    
    if (blocks.length <= 1) {
        return processedHTML; // Нет смысла делить одну песню
    }
    
    // ВЕРТИКАЛЬНОЕ распределение: сначала заполняем первую колонку до половины, потом вторую
    const column1 = [];
    const column2 = [];
    
    // Вычисляем середину для разделения
    const halfPoint = Math.ceil(blocks.length / 2);
    
    blocks.forEach((block, index) => {
        const html = block.outerHTML;
        if (index < halfPoint) {
            // Первая половина блоков идет в левую колонку
            column1.push(html);
        } else {
            // Вторая половина блоков идет в правую колонку
            column2.push(html);
        }
    });
    
    // Также собираем весь текст, который НЕ в блоках (если есть)
    const nonBlockContent = Array.from(tempDiv.childNodes).filter(node => {
        return node.nodeType === Node.TEXT_NODE || 
               (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('song-block'));
    });
    
    let additionalContent = '';
    if (nonBlockContent.length > 0) {
        additionalContent = nonBlockContent.map(node => 
            node.nodeType === Node.TEXT_NODE ? node.textContent : node.outerHTML
        ).join('');
    }
    
    // Создаем HTML для двух колонок
    const column1HTML = `<div class="column-1">${additionalContent}${column1.join('\n')}</div>`;
    const column2HTML = `<div class="column-2">${column2.join('\n')}</div>`;
    
    return column1HTML + column2HTML;
}

export {
    getTransposition,
    transposeLyrics,
    processLyrics,
    highlightChords,
    highlightStructure,
    wrapSongBlocks,
    correctBlockType,
    demonstrateParser,
    resetParserLearning,
    getRenderedSongText,
    extractYouTubeVideoId,
    isMobileView,
    setupAudioContext,
    resumeAudioContext,
    loadAudioFile,
    toggleMetronome,
    getMetronomeState,
    distributeSongBlocksToColumns
}; 
