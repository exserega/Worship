// Agape Worship App - songParser.js
// Интеллектуальный парсер структуры песен

import { structureMarkers } from '../utils/constants.js';

// Глобальное хранилище для машинного обучения
let songParserData = {
    learnedTerms: new Map(),
    patternHistory: new Map(),
    userCorrections: new Map(),
    confidence: new Map()
};

// Инициализация из localStorage
function initializeParserData() {
    try {
        const stored = localStorage.getItem('songParserData');
        if (stored) {
            const parsed = JSON.parse(stored);
            songParserData.learnedTerms = new Map(parsed.learnedTerms || []);
            songParserData.patternHistory = new Map(parsed.patternHistory || []);
            songParserData.userCorrections = new Map(parsed.userCorrections || []);
            songParserData.confidence = new Map(parsed.confidence || []);
        }
    } catch (e) {
        console.warn('Failed to load parser data:', e);
    }
}

// Сохранение данных обучения
function saveParserData() {
    try {
        const toSave = {
            learnedTerms: Array.from(songParserData.learnedTerms.entries()),
            patternHistory: Array.from(songParserData.patternHistory.entries()),
            userCorrections: Array.from(songParserData.userCorrections.entries()),
            confidence: Array.from(songParserData.confidence.entries())
        };
        localStorage.setItem('songParserData', JSON.stringify(toSave));
    } catch (e) {
        console.warn('Failed to save parser data:', e);
    }
}

// Адаптивный многоязычный словарь
const ADAPTIVE_DICTIONARY = {
    verse: {
        primary: ['куплет', 'verse', 'строфа', 'запев', 'строка'],
        variations: ['к', 'v', 'стих', 'куп'],
        patterns: [/^(\d+\s*)?(куплет|verse|строфа|запев|к|v)(\s*\d*)?/i]
    },
    chorus: {
        primary: ['припев', 'chorus', 'рефрен', 'хор', 'хорус'],
        variations: ['пр', 'п', 'c', 'ch'],
        patterns: [/^(\d+\s*)?(припев|chorus|рефрен|хор|пр|п|c|ch)(\s*\d*)?/i]
    },
    bridge: {
        primary: ['бридж', 'bridge', 'мостик', 'мост', 'переход', 'связка'],
        variations: ['бр', 'b', 'br'],
        patterns: [/^(\d+\s*)?(бридж|bridge|мостик|мост|переход|бр|b|br)(\s*\d*)?/i]
    },
    intro: {
        primary: ['интро', 'intro', 'вступление', 'начало', 'открытие', 'вставка'],
        variations: ['ин', 'i', 'вст'],
        patterns: [/^(\d+\s*)?(интро|intro|вступление|начало|ин|i|вст|вставка)(\s*\d*)?/i]
    },
    outro: {
        primary: ['аутро', 'outro', 'окончание', 'финал', 'концовка', 'завершение'],
        variations: ['ау', 'o', 'out'],
        patterns: [/^(\d+\s*)?(аутро|outro|окончание|финал|концовка|ау|o|out)(\s*\d*)?/i]
    },
    solo: {
        primary: ['соло', 'solo', 'инструментал', 'проигрыш', 'инстр'],
        variations: ['с', 's'],
        patterns: [/^(\d+\s*)?(соло|solo|инструментал|проигрыш|с|s|инстр)(\s*\d*)?/i]
    },
    pre: {
        primary: ['предприпев', 'pre-chorus', 'прехорус', 'подготовка', 'пред припев', 'пред-припев'],
        variations: ['пред', 'pre'],
        patterns: [/^(\d+\s*)?(предприпев|pre-chorus|прехорус|пред\s*припев|пред-припев|пред|pre)(\s*\d*)?/i]
    },
    tag: {
        primary: ['тег', 'tag', 'кода', 'повтор', 'эхо'],
        variations: ['т', 'повт'],
        patterns: [/^(\d+\s*)?(тег|tag|кода|повтор|т|повт)(\s*\d*)?/i]
    },
    interlude: {
        primary: ['интерлюдия', 'interlude', 'пауза', 'промежуток'],
        variations: ['инт', 'inter'],
        patterns: [/^(\d+\s*)?(интерлюдия|interlude|пауза|инт|inter)(\s*\d*)?/i]
    }
};

/** ЗАЩИТА ОТ АККОРДОВ: Проверяем, является ли строка аккордом */
function isChordLine(line) {
    const trimmed = line.trim();
    
    // Список популярных аккордов
    const commonChords = [
        'C', 'D', 'E', 'F', 'G', 'A', 'B', 'H',
        'Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm', 'Hm',
        'C7', 'D7', 'E7', 'F7', 'G7', 'A7', 'B7', 'H7',
        'Cmaj7', 'Dmaj7', 'Emaj7', 'Fmaj7', 'Gmaj7', 'Amaj7', 'Bmaj7',
        'Csus4', 'Dsus4', 'Esus4', 'Fsus4', 'Gsus4', 'Asus4', 'Bsus4',
        'C#', 'D#', 'F#', 'G#', 'A#', 'C#m', 'D#m', 'F#m', 'G#m', 'A#m'
    ];
    
    // Проверяем точное совпадение с аккордом
    if (commonChords.includes(trimmed)) return true;
    
    // Проверяем паттерн аккордов с модификаторами
    const chordPattern = /^[A-H][#b]?(m|maj|min|dim|aug|sus[24]?|add[0-9]|[0-9]+)?(\s*\/\s*[A-H][#b]?)?$/;
    if (chordPattern.test(trimmed)) return true;
    
    // Проверяем строку из нескольких аккордов
    const words = trimmed.split(/\s+/);
    if (words.length <= 6 && words.every(word => chordPattern.test(word))) return true;
    
    return false;
}

/** СТРАТЕГИЯ 1: Распознавание явных маркеров */
function detectExplicitMarkers(line, context) {
    const trimmed = line.trim();
    if (!trimmed) return null;
    
    // ЗАЩИТА ОТ АККОРДОВ - если это аккорд, не обрабатываем
    if (isChordLine(trimmed)) return null;
    
    // СТРОГАЯ проверка: строка должна быть ТОЛЬКО маркером или почти только маркером
    if (trimmed.length > 40) return null; // Увеличиваем лимит для сложных случаев
    
    // ДОПОЛНИТЕЛЬНАЯ ЗАЩИТА: если строка содержит много текста, это не заголовок
    const words = trimmed.split(/\s+/);
    if (words.length > 6) return null; // Заголовки обычно короткие
    
    // ЗАЩИТА ОТ ОБЫЧНОГО ТЕКСТА: если есть знаки препинания в середине, это не заголовок
    if (/[,;!?]\s+\w/.test(trimmed)) return null;
    
    let bestMatch = null;
    let highestConfidence = 0;
    
    // Проверяем все типы блоков
    for (const [blockType, config] of Object.entries(ADAPTIVE_DICTIONARY)) {
        for (const pattern of config.patterns) {
            const match = trimmed.match(pattern);
            if (match) {
                const confidence = 0.9; // Высокая уверенность для явных маркеров
                if (confidence > highestConfidence) {
                    highestConfidence = confidence;
                    bestMatch = {
                        type: blockType,
                        label: match[0],
                        confidence: confidence,
                        method: 'explicit'
                    };
                }
            }
        }
    }
    
    return bestMatch;
}

/** СТРАТЕГИЯ 2: Структурные паттерны */
function detectStructuralPatterns(lines, lineIndex, context) {
    const line = lines[lineIndex];
    const trimmed = line.trim();
    
    if (!trimmed || isChordLine(trimmed)) return null;
    
    // Анализируем контекст вокруг строки
    const prevLines = lines.slice(Math.max(0, lineIndex - 3), lineIndex);
    const nextLines = lines.slice(lineIndex + 1, lineIndex + 4);
    
    // Паттерны для определения структуры
    const patterns = [
        // Пустая строка + короткий текст + пустая строка = возможный заголовок
        {
            condition: () => {
                const prevEmpty = prevLines.some(l => !l.trim());
                const nextEmpty = nextLines.some(l => !l.trim());
                const isShort = trimmed.length < 30;
                return prevEmpty && nextEmpty && isShort;
            },
            confidence: 0.6,
            type: 'verse' // По умолчанию
        }
    ];
    
    for (const pattern of patterns) {
        if (pattern.condition()) {
            return {
                type: pattern.type,
                label: trimmed,
                confidence: pattern.confidence,
                method: 'structural'
            };
        }
    }
    
    return null;
}

/** СТРАТЕГИЯ 3: Семантический анализ */
function detectSemanticMarkers(line, context) {
    // Простая семантическая проверка
    const trimmed = line.trim().toLowerCase();
    
    // Проверяем наличие ключевых слов
    const keywords = {
        'verse': ['куплет', 'verse', 'строфа'],
        'chorus': ['припев', 'chorus', 'рефрен'],
        'bridge': ['бридж', 'bridge', 'мост'],
        'intro': ['интро', 'intro', 'вступление'],
        'outro': ['аутро', 'outro', 'конец']
    };
    
    for (const [type, words] of Object.entries(keywords)) {
        if (words.some(word => trimmed.includes(word))) {
            return {
                type: type,
                label: line.trim(),
                confidence: 0.7,
                method: 'semantic'
            };
        }
    }
    
    return null;
}

/** СТРАТЕГИЯ 4: Музыкальные паттерны */
function detectMusicalPatterns(lines, lineIndex, context) {
    // Анализ музыкальных паттернов
    return null; // Упрощенная версия
}

/** ИНТЕЛЛЕКТУАЛЬНОЕ ОПРЕДЕЛЕНИЕ БЛОКОВ */
function intelligentBlockDetection(lines, lineIndex, context) {
    const line = lines[lineIndex];
    
    // СТРАТЕГИЯ 1: Явные маркеры (высший приоритет)
    let detection = detectExplicitMarkers(line, context);
    if (detection) return detection;
    
    // СТРАТЕГИЯ 2: Структурные паттерны
    detection = detectStructuralPatterns(lines, lineIndex, context);
    if (detection) return detection;
    
    // СТРАТЕГИЯ 3: Семантический анализ
    detection = detectSemanticMarkers(line, context);
    if (detection) return detection;
    
    // СТРАТЕГИЯ 4: Музыкальные паттерны
    detection = detectMusicalPatterns(lines, lineIndex, context);
    if (detection) return detection;
    
    return null;
}

/** ОБЕРТКА ПЕСНИ В БЛОКИ */
export function wrapSongBlocks(lyrics) {
    if (!lyrics) return '';
    
    // Инициализируем данные парсера
    initializeParserData();
    
    const lines = lyrics.split('\n');
    let result = '';
    let currentBlock = null;
    let blockContent = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // Пропускаем пустые строки в начале
        if (!trimmed && !currentBlock && blockContent.length === 0) {
            result += line + '\n';
            continue;
        }
        
        // Проверяем, является ли эта строка заголовком блока
        const blockDetection = intelligentBlockDetection(lines, i, {});
        
        if (blockDetection) {
            // Сохраняем предыдущий блок
            if (currentBlock && blockContent.length > 0) {
                result += createBlockHTML(currentBlock, blockContent.join('\n'));
            }
            
            // Начинаем новый блок
            currentBlock = blockDetection;
            blockContent = [];
        } else {
            // Добавляем строку к текущему блоку
            if (currentBlock) {
                blockContent.push(line);
            } else {
                // Если нет блока, добавляем как обычный текст
                result += line + '\n';
            }
        }
    }
    
    // Сохраняем последний блок
    if (currentBlock && blockContent.length > 0) {
        result += createBlockHTML(currentBlock, blockContent.join('\n'));
    }
    
    // Сохраняем данные обучения
    saveParserData();
    
    return result;
}

/** СОЗДАНИЕ HTML БЛОКА */
function createBlockHTML(block, content) {
    const confidenceClass = block.confidence > 0.8 ? 'high-confidence' : 
                           block.confidence > 0.6 ? 'medium-confidence' : 'low-confidence';
    
    return `<div class="song-block ${confidenceClass}" data-type="${block.type}" data-confidence="${block.confidence}" data-method="${block.method}">
        <div class="song-block-legend">${block.label}</div>
        <div class="song-block-content">${content}</div>
    </div>`;
}

/** ИСПРАВЛЕНИЕ ТИПА БЛОКА */
export function correctBlockType(blockElement, newType, newLabel) {
    if (!blockElement) return;
    
    // Обновляем данные элемента
    blockElement.dataset.type = newType;
    blockElement.dataset.confidence = '1.0';
    blockElement.dataset.method = 'user_corrected';
    
    // Обновляем заголовок
    const legend = blockElement.querySelector('.song-block-legend');
    if (legend) {
        legend.textContent = newLabel || newType;
    }
    
    // Сохраняем исправление для обучения
    const oldLabel = blockElement.querySelector('.song-block-legend')?.textContent;
    if (oldLabel) {
        songParserData.userCorrections.set(oldLabel, { type: newType, label: newLabel });
        saveParserData();
    }
}

/** ДЕМОНСТРАЦИЯ ПАРСЕРА */
export function demonstrateParser() {
    const testLyrics = `Куплет 1:
Am    Dm    G    C
Текст первой строки
Текст второй строки

Припев:
F    C    G    Am
Текст припева
Еще текст припева

Куплет 2:
Am    Dm    G    C
Текст третьей строки
Текст четвертой строки`;

    console.log('Демонстрация парсера:');
    console.log('Исходный текст:', testLyrics);
    console.log('Результат парсинга:', wrapSongBlocks(testLyrics));
}

/** СБРОС ОБУЧЕНИЯ ПАРСЕРА */
export function resetParserLearning() {
    songParserData = {
        learnedTerms: new Map(),
        patternHistory: new Map(),
        userCorrections: new Map(),
        confidence: new Map()
    };
    localStorage.removeItem('songParserData');
    console.log('Обучение парсера сброшено');
}

// Инициализация при загрузке модуля
initializeParserData(); 