// Agape Worship App - core.js

import { chords, structureMarkers } from './constants.js';

// --- REGEX & DERIVED CONSTANTS ---
const chordRegex = /([A-H][#b]?(?:maj7|maj9|m7|m9|m11|7sus4|sus4|sus2|add9|dim7|dim|aug7|aug|7|m|6|9|11|13|sus)?(?:\s*\/\s*[A-H][#b]?)?)/g;
const structureMarkersWithColon = structureMarkers.map(m => m + ':');
const allMarkers = [...structureMarkers, ...structureMarkersWithColon];


// --- TEXT PROCESSING & TRANSPOSITION ---

/** Расчет смещения для транспонирования */
function getTransposition(originalKey, newKey) {
    if (!originalKey || !newKey) {
        return 0;
    }
    const originalIndex = chords.indexOf(originalKey);
    const newIndex = chords.indexOf(newKey);
    if (originalIndex === -1 || newIndex === -1) {
        console.warn(`Invalid key(s) for transposition: ${originalKey} -> ${newKey}. Using 0 shift.`);
        return 0;
    }
    return newIndex - originalIndex;
}

/** Транспонирование одного аккорда */
function transposeChord(chord, transposition) {
    if (transposition === 0 || !chord) return chord;

    let chordType = '';
    let baseChord = chord;
    let bassNote = '';
    const suffixes = ['maj7', 'maj9', 'm7', 'm9', 'm11', '7sus4', 'sus4', 'sus2', 'add9', 'dim7', 'dim', 'aug7', 'aug', '7', 'm', '6', '9', '11', '13', 'sus'];

    if (chord.includes('/')) {
        const parts = chord.split('/');
        if (parts.length === 2) {
             baseChord = parts[0];
             bassNote = parts[1];
        } else {
            console.warn("Malformed chord with '/':", chord);
            return chord;
        }
    }

    for (let suffix of suffixes) {
        if (baseChord.endsWith(suffix)) {
            baseChord = baseChord.slice(0, -suffix.length);
            chordType = suffix;
            break;
        }
    }

    const baseChordIndex = chords.indexOf(baseChord);
    if (baseChordIndex === -1) {
        return chord;
    }
    const newBaseChordIndex = (baseChordIndex + transposition + chords.length) % chords.length;
    const transposedBaseChord = chords[newBaseChordIndex] + chordType;

    if (bassNote) {
        const bassNoteIndex = chords.indexOf(bassNote);
        if (bassNoteIndex !== -1) {
            const newBassNoteIndex = (bassNoteIndex + transposition + chords.length) % chords.length;
            return `${transposedBaseChord}/${chords[newBassNoteIndex]}`;
        } else {
            return `${transposedBaseChord}/${bassNote}`;
        }
    }

    return transposedBaseChord;
}

/** Транспонирование всего текста с аккордами */
function transposeLyrics(lyrics, transposition) {
    if (transposition === 0 || !lyrics) return lyrics;
    try {
        return lyrics.replace(chordRegex, (match) => {
            const cleanedMatch = match.replace(/\s*\/\s*/, '/');
            return transposeChord(cleanedMatch, transposition);
        });
    } catch (error) {
        console.error("Ошибка при транспонировании текста:", error, "Текст:", lyrics.substring(0, 100) + "...");
        return lyrics;
    }
}

/** Обработка строк текста - сокращаем пробелы в строках с аккордами в 2 раза */
function processLyrics(lyrics) {
    if (!lyrics) return '';
    
    // СОКРАЩАЕМ ПРОБЕЛЫ В СТРОКАХ С АККОРДАМИ В 2 РАЗА
    // Ищем строки которые содержат аккорды (много пробелов + латинские буквы + символы аккордов)
    return lyrics.split('\n').map(line => {
        // Если строка содержит аккорды (много пробелов и характерные символы аккордов)
        if (line.includes('  ') && /[A-H][#b]?/.test(line) && !/[а-яё]/i.test(line)) {
            // Сокращаем ВСЕ пробелы в 2 раза в строках с аккордами
            return line.replace(/ {2,}/g, match => ' '.repeat(Math.max(1, Math.ceil(match.length / 2))));
        }
        return line; // Оставляем строки текста без изменений
    }).join('\n');
}

/** Выделение аккордов тегами span для стилизации */
function highlightChords(lyrics) {
    if (!lyrics) return '';
    try {
        const result = lyrics.replace(chordRegex, '<span class="chord">$1</span>');
        
        
        
        return result;
    } catch (error) {
        console.error("Ошибка при выделении аккордов:", error, "Текст:", lyrics.substring(0, 100) + "...");
        return lyrics;
    }
}

/** РЕВОЛЮЦИОННЫЙ ИНТЕЛЛЕКТУАЛЬНЫЙ ПАРСЕР БЛОКОВ ПЕСЕН */

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
    
    // НОВЫЕ РАСШИРЕННЫЕ ПАТТЕРНЫ для сложных случаев
    const extendedPatterns = [
        // Паттерн: "Припев x2:", "Вставка x2:", "Куплет: x2", "Куплет2: x2" и т.д.
        {
            regex: /^(припев|chorus|мост|bridge|куплет|verse|бридж|соло|solo|интро|intro|аутро|outro|вставка|предприпев|pre-chorus|пред\s*припев|пред-припев)(\d+)?\s*[:.]?\s*[xх×]\s*(\d+)\s*[:.]?\s*$/i,
            getType: (match) => {
                const base = match[1].toLowerCase().replace(/\s+/g, ' ');
                if (['припев', 'chorus'].includes(base)) return 'chorus';
                if (['мост', 'bridge', 'бридж'].includes(base)) return 'bridge';
                if (['куплет', 'verse'].includes(base)) return 'verse';
                if (['соло', 'solo'].includes(base)) return 'solo';
                if (['интро', 'intro'].includes(base)) return 'intro';
                if (['аутро', 'outro'].includes(base)) return 'outro';
                if (['вставка'].includes(base)) return 'intro';
                if (['предприпев', 'pre-chorus', 'пред припев', 'пред-припев'].includes(base)) return 'pre';
                return 'unknown';
            },
            confidence: 0.95
        },
        
        // Паттерн: "Припев (повтор)", "Куплет (повтор)", "Мост (повтор)" и т.д.
        {
            regex: /^(припев|chorus|мост|bridge|куплет|verse|бридж|соло|solo|интро|intro|аутро|outro|вставка|предприпев|pre-chorus|пред\s*припев|пред-припев)(\d+)?\s*\(\s*(повтор|repeat|снова|again)\s*\)\s*[:.]?\s*$/i,
            getType: (match) => {
                const base = match[1].toLowerCase().replace(/\s+/g, ' ');
                if (['припев', 'chorus'].includes(base)) return 'chorus';
                if (['мост', 'bridge', 'бридж'].includes(base)) return 'bridge';
                if (['куплет', 'verse'].includes(base)) return 'verse';
                if (['соло', 'solo'].includes(base)) return 'solo';
                if (['интро', 'intro'].includes(base)) return 'intro';
                if (['аутро', 'outro'].includes(base)) return 'outro';
                if (['вставка'].includes(base)) return 'intro';
                if (['предприпев', 'pre-chorus', 'пред припев', 'пред-припев'].includes(base)) return 'pre';
                return 'unknown';
            },
            confidence: 0.95
        },
        
        // Паттерн: "1 Мост: x2", "2 Куплет: x3" и т.д.
        {
            regex: /^(\d+)\s+(мост|bridge|куплет|verse|припев|chorus|бридж|соло|solo|интро|intro|аутро|outro|вставка|предприпев|pre-chorus|пред\s*припев|пред-припев)\s*[:.]?\s*[xх×]?\s*(\d+)?\s*[:.]?\s*$/i,
            getType: (match) => {
                const base = match[2].toLowerCase().replace(/\s+/g, ' ');
                if (['припев', 'chorus'].includes(base)) return 'chorus';
                if (['мост', 'bridge', 'бридж'].includes(base)) return 'bridge';
                if (['куплет', 'verse'].includes(base)) return 'verse';
                if (['соло', 'solo'].includes(base)) return 'solo';
                if (['интро', 'intro'].includes(base)) return 'intro';
                if (['аутро', 'outro'].includes(base)) return 'outro';
                if (['вставка'].includes(base)) return 'intro';
                if (['предприпев', 'pre-chorus', 'пред припев', 'пред-припев'].includes(base)) return 'pre';
                return 'unknown';
            },
            confidence: 0.95
        },
        
        // Паттерн: "Припев 2 вариант", "2 вариант моста:" и т.д.
        {
            regex: /^(\d+\s*)?(припев|chorus|мост|bridge|куплет|verse|бридж|соло|solo|интро|intro|аутро|outro|вставка|предприпев|pre-chorus|пред\s*припев|пред-припев)\s+(\d+\s*)?(вариант|variant)\s*[:.]?\s*$/i,
            getType: (match) => {
                const base = match[2].toLowerCase().replace(/\s+/g, ' ');
                if (['припев', 'chorus'].includes(base)) return 'chorus';
                if (['мост', 'bridge', 'бридж'].includes(base)) return 'bridge';
                if (['куплет', 'verse'].includes(base)) return 'verse';
                if (['соло', 'solo'].includes(base)) return 'solo';
                if (['интро', 'intro'].includes(base)) return 'intro';
                if (['аутро', 'outro'].includes(base)) return 'outro';
                if (['вставка'].includes(base)) return 'intro';
                if (['предприпев', 'pre-chorus', 'пред припев', 'пред-припев'].includes(base)) return 'pre';
                return 'unknown';
            },
            confidence: 0.95
        },
        
        // Паттерн: "2 вариант моста:", "3 вариант припева" и т.д.
        {
            regex: /^(\d+\s*)?(вариант|variant)\s+(моста|bridge|припева|chorus|куплета|verse|бриджа|соло|solo|интро|intro|аутро|outro|вставки|предприпева|pre-chorus)\s*[:.]?\s*$/i,
            getType: (match) => {
                const base = match[3].toLowerCase();
                if (['припева', 'chorus'].includes(base)) return 'chorus';
                if (['моста', 'bridge', 'бриджа'].includes(base)) return 'bridge';
                if (['куплета', 'verse'].includes(base)) return 'verse';
                if (['соло', 'solo'].includes(base)) return 'solo';
                if (['интро', 'intro'].includes(base)) return 'intro';
                if (['аутро', 'outro'].includes(base)) return 'outro';
                if (['вставки'].includes(base)) return 'intro';
                if (['предприпева', 'pre-chorus'].includes(base)) return 'pre';
                return 'unknown';
            },
            confidence: 0.95
        }
    ];
    
    // Проверяем расширенные паттерны
    for (const pattern of extendedPatterns) {
        const match = trimmed.match(pattern.regex);
        if (match) {
            const type = pattern.getType(match);
            if (type !== 'unknown' && pattern.confidence > highestConfidence) {
                highestConfidence = pattern.confidence;
                bestMatch = { 
                    type, 
                    confidence: pattern.confidence, 
                    method: 'extended_pattern', 
                    term: match[0] 
                };
            }
        }
    }
    
    // Обычные паттерны (если расширенные не сработали)
    if (!bestMatch) {
        for (const [blockType, data] of Object.entries(ADAPTIVE_DICTIONARY)) {
            // Проверяем основные термины - ТОЛЬКО точные совпадения
            for (const term of data.primary) {
                // Экранируем специальные символы в термине для регулярного выражения
                const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const regex = new RegExp(`^(\\d+\\s*)?(${escapedTerm})(\\s*\\d*)?\\s*[:.]?\\s*$`, 'i');
                if (regex.test(trimmed)) {
                    const confidence = 0.95; // Высокая уверенность для точных совпадений
                    if (confidence > highestConfidence) {
                        highestConfidence = confidence;
                        bestMatch = { type: blockType, confidence, method: 'explicit', term };
                    }
                }
            }
            
            // Проверяем вариации - только короткие
            for (const variation of data.variations) {
                if (variation.length < 4) { // Только короткие сокращения
                    // Экранируем специальные символы в вариации для регулярного выражения
                    const escapedVariation = variation.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    const regex = new RegExp(`^(\\d+\\s*)?(${escapedVariation})(\\s*\\d*)?\\s*[:.]?\\s*$`, 'i');
                    if (regex.test(trimmed)) {
                        const confidence = 0.9;
                        if (confidence > highestConfidence) {
                            highestConfidence = confidence;
                            bestMatch = { type: blockType, confidence, method: 'variation', term: variation };
                        }
                    }
                }
            }
        }
        
        // ОТКЛЮЧЕНО: изученные термины создают ложные срабатывания
        // Используем только явные маркеры из словаря
    }
    
    
    
    return bestMatch;
}

/** СТРАТЕГИЯ 2: Распознавание структурных паттернов */
function detectStructuralPatterns(lines, lineIndex, context) {
    const line = lines[lineIndex];
    const trimmed = line.trim();
    
    if (!trimmed) return null;
    
    // ЗАЩИТА ОТ АККОРДОВ - если это аккорд, не обрабатываем
    if (isChordLine(trimmed)) return null;
    
    const results = [];
    
    // ТОЛЬКО очень строгие паттерны!
    
    // Паттерн: строка в скобках или кавычках И короткая
    if (/^[\[\("].*[\]\)"]$/.test(trimmed) && trimmed.length < 20) {
        results.push({ type: 'unknown', confidence: 0.7, method: 'structural_bracketed' });
    }
    
    // ОТКЛЮЧЕНО: слишком много ложных срабатываний
    // Паттерн: строка в верхнем регистре И очень короткая И изолированная
    // if (trimmed === trimmed.toUpperCase() && trimmed.length < 15 && trimmed.length > 2 &&
    //     lineIndex > 0 && !lines[lineIndex - 1].trim() &&
    //     lineIndex < lines.length - 1 && !lines[lineIndex + 1].trim()) {
    //     results.push({ type: 'unknown', confidence: 0.6, method: 'structural_uppercase' });
    // }
    
    return results.length > 0 ? results.reduce((best, curr) => 
        curr.confidence > best.confidence ? curr : best
    ) : null;
}

/** СТРАТЕГИЯ 3: Семантический анализ */
function detectSemanticMarkers(line, context) {
    // ОТКЛЮЧЕНО для предотвращения ложных срабатываний
    return null;
}

/** СТРАТЕГИЯ 4: Анализ музыкальных паттернов */
function detectMusicalPatterns(lines, lineIndex, context) {
    // ОТКЛЮЧЕНО для предотвращения ложных срабатываний
    return null;
}

/** ОСНОВНАЯ ФУНКЦИЯ: Интеллектуальное распознавание блоков */
function intelligentBlockDetection(lines, lineIndex, context) {
    const line = lines[lineIndex];
    const strategies = [
        () => detectExplicitMarkers(line, context),
        () => detectStructuralPatterns(lines, lineIndex, context),
        () => detectSemanticMarkers(line, context),
        () => detectMusicalPatterns(lines, lineIndex, context)
    ];
    
    const results = [];
    
    for (const strategy of strategies) {
        const result = strategy();
        if (result) {
            results.push(result);
        }
    }
    
    if (results.length === 0) return null;
    
    // Выбираем результат с наивысшей уверенностью
    const bestResult = results.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
    );
    
    // Обучение: сохраняем успешные распознавания
    if (bestResult.confidence > 0.7) {
        const key = line.trim().toLowerCase();
        const existing = songParserData.confidence.get(key) || 0;
        songParserData.confidence.set(key, Math.max(existing, bestResult.confidence));
        
        if (bestResult.method === 'explicit' || bestResult.method === 'pattern') {
            songParserData.patternHistory.set(key, bestResult.type);
        }
    }
    
    return bestResult;
}

/** РЕВОЛЮЦИОННАЯ ЗАМЕНА wrapSongBlocks */
function wrapSongBlocks(lyrics) {
    if (!lyrics) return '';
    
    // ОЧИЩАЕМ данные обучения для исправления проблем с ложными срабатываниями
    songParserData.learnedTerms.clear();
    songParserData.patternHistory.clear();
    songParserData.userCorrections.clear();
    songParserData.confidence.clear();
    
    // Также очищаем localStorage
    try {
        localStorage.removeItem('songParserData');
    } catch (e) {
        console.warn('Could not clear localStorage:', e);
    }
    
    // Инициализируем данные обучения
    initializeParserData();
    
    const lines = lyrics.split('\n');
    const blocks = [];
    let currentBlock = { legend: '', content: [], confidence: 0, type: null };
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // Контекст для анализа
        const context = {
            prevLines: lines.slice(Math.max(0, i - 3), i),
            nextLines: lines.slice(i + 1, Math.min(lines.length, i + 4)),
            blockIndex: blocks.length,
            lineIndex: i
        };
        
        // Интеллектуальное распознавание
        const detection = intelligentBlockDetection(lines, i, context);
        
        if (detection && detection.confidence > 0.92) {
            // Найден новый блок
            if (currentBlock.content.length > 0) {
                // Сохраняем предыдущий блок
                blocks.push(currentBlock);
            }
            
            // Начинаем новый блок
            currentBlock = {
                legend: trimmed,
                content: [],
                confidence: detection.confidence,
                type: detection.type,
                method: detection.method
            };
            
            
            
            // ОТКЛЮЧЕНО: не изучаем новые термины для предотвращения ложных срабатываний
            // if (detection.confidence > 0.7) {
            //     songParserData.learnedTerms.set(trimmed.toLowerCase(), detection.type);
            // }
        } else {
            // Добавляем строку в текущий блок
            currentBlock.content.push(line);
        }
    }
    
    // Добавляем последний блок
    if (currentBlock.legend || currentBlock.content.length > 0) {
        blocks.push(currentBlock);
    }
    
    // Пост-обработка: улучшение распознавания на основе контекста
    blocks.forEach((block, index) => {
        if (!block.type || block.confidence < 0.5) {
            // Пытаемся угадать тип по позиции и контексту
            if (index === 0 && !block.legend) {
                block.type = 'intro';
                block.legend = block.legend || 'Интро';
            } else if (index === blocks.length - 1 && block.content.length < 3) {
                block.type = 'outro';
                block.legend = block.legend || 'Аутро';
            } else if (!block.legend) {
                // Пытаемся определить по содержимому
                const content = block.content.join(' ').toLowerCase();
                if (content.includes('припев') || content.includes('chorus')) {
                    block.type = 'chorus';
                    block.legend = 'Припев';
                } else {
                    block.type = 'verse';
                    block.legend = `Куплет ${Math.floor(index / 2) + 1}`;
                }
            }
        }
    });
    
    // Сохраняем данные обучения
    saveParserData();
    
    // Формируем HTML с улучшенной структурой
    
    const htmlBlocks = blocks.map((block, index) => {
        const content = block.content.join('\n');
        const confidenceClass = block.confidence > 0.8 ? 'high-confidence' : 
                               block.confidence > 0.5 ? 'medium-confidence' : 'low-confidence';
        
        // ДОПОЛНИТЕЛЬНАЯ ЗАЩИТА: проверяем и очищаем все данные блока
        const safeType = String(block.type || 'unknown');
        const safeMethod = String(block.method || 'unknown');
        const safeConfidence = typeof block.confidence === 'number' ? block.confidence : 0;
        const safeLegend = String(block.legend || '');
        
        // Очищаем данные от спецсимволов для HTML-атрибутов
        const cleanType = safeType.replace(/[^a-zA-Z0-9]/g, '');
        const cleanMethod = safeMethod.replace(/[^a-zA-Z0-9_]/g, '');
        const cleanConfidence = safeConfidence.toFixed(2);
        const cleanLegend = safeLegend.replace(/[<>"'&]/g, '').replace(/"/g, '').replace(/data-/g, '');
        
        
        
        
        
        if (block.legend) {
            // ДОПОЛНИТЕЛЬНАЯ ЗАЩИТА: проверяем что все переменные безопасны
            const safeConfidenceClass = String(confidenceClass).replace(/[^a-zA-Z0-9-]/g, '');
            const safeTitle = `Уверенность: ${Math.round(safeConfidence * 100)}% (${cleanMethod})`;
            
            const generatedHTML = `<fieldset class="song-block ${safeConfidenceClass}" data-type="${cleanType}" data-confidence="${cleanConfidence}" data-method="${cleanMethod}">
<legend class="song-block-legend" title="${safeTitle}">${cleanLegend}</legend>
<div class="song-block-content">${content}</div>
</fieldset>`;
            
            


            
            return generatedHTML;
        } else {
            const safeConfidenceClass = String(confidenceClass).replace(/[^a-zA-Z0-9-]/g, '');
            
            return `<fieldset class="song-block ${safeConfidenceClass}" data-type="${cleanType}" data-confidence="${cleanConfidence}">
<div class="song-block-content">${content}</div>
</fieldset>`;
        }
    });
    

    
    const result = htmlBlocks.join('\n');
    

    
    return result;
}

/** Функция для ручной корректировки пользователем */
function correctBlockType(blockElement, newType, newLabel) {
    const originalText = blockElement.querySelector('.song-block-legend')?.textContent || '';
    
    // Сохраняем корректировку для обучения
    songParserData.userCorrections.set(originalText.toLowerCase(), {
        type: newType,
        label: newLabel,
        timestamp: Date.now()
    });
    
    // Обновляем изученные термины
    songParserData.learnedTerms.set(originalText.toLowerCase(), newType);
    
    saveParserData();
    
    console.log(`Обучение: "${originalText}" теперь распознается как "${newType}"`);
}

/** Экспорт функции корректировки для использования в UI */
window.correctSongBlockType = correctBlockType;

/** Функция демонстрации возможностей парсера */
function demonstrateParser() {
    console.log('🎵 ДЕМОНСТРАЦИЯ ИНТЕЛЛЕКТУАЛЬНОГО ПАРСЕРА БЛОКОВ ПЕСЕН 🎵');
    console.log('============================================================');
    
    const testSongs = [
        {
            title: 'Тест русских маркеров',
            lyrics: `Куплет 1
Славлю Бога я всегда
Припев
Аллилуйя, аллилуйя
Бридж
Святой, святой, святой`
        },
        {
            title: 'Тест английских маркеров',
            lyrics: `Verse 1
Amazing grace how sweet the sound
Chorus
How great is our God
Bridge
Holy, holy, holy`
        },
        {
            title: 'Тест сокращений',
            lyrics: `К1
Первый куплет
Пр
Припев песни
Бр
Переходная часть`
        },
        {
            title: 'Тест структурных паттернов',
            lyrics: `ВСТУПЛЕНИЕ
Инструментальная часть
1
Первая строфа
[ПРИПЕВ]
Основная мелодия`
        }
    ];
    
    testSongs.forEach((song, index) => {
        console.log(`\n--- ТЕСТ ${index + 1}: ${song.title} ---`);
        const result = wrapSongBlocks(song.lyrics);
        console.log('Результат парсинга:', result);
    });
    
    // Статистика обучения
    console.log('\n--- СТАТИСТИКА ОБУЧЕНИЯ ---');
    console.log('Изученные термины:', songParserData.learnedTerms.size);
    console.log('Паттерны в истории:', songParserData.patternHistory.size);
    console.log('Пользовательские корректировки:', songParserData.userCorrections.size);
    console.log('Записи уверенности:', songParserData.confidence.size);
    
    if (songParserData.learnedTerms.size > 0) {
        console.log('\nИзученные термины:');
        for (const [term, type] of songParserData.learnedTerms) {
            console.log(`  "${term}" → ${type}`);
        }
    }
}

/** Функция сброса данных обучения (для отладки) */
function resetParserLearning() {
    songParserData.learnedTerms.clear();
    songParserData.patternHistory.clear();
    songParserData.userCorrections.clear();
    songParserData.confidence.clear();
    
    try {
        localStorage.removeItem('songParserData');
        console.log('✅ Данные обучения парсера сброшены');
    } catch (e) {
        console.warn('Ошибка сброса данных:', e);
    }
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

let audioContext;
let audioBuffer;
let metronomeInterval = null;
let isMetronomeActive = false;
let currentBeat = 0;

/** Настройка AudioContext */
function setupAudioContext() {
    if (audioContext) return;
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("AudioContext успешно создан. State:", audioContext.state);
        resumeAudioContext();
    } catch(e) {
        console.error("Не удалось создать AudioContext:", e);
        alert("Ошибка: Ваш браузер не поддерживает Web Audio API, метроном не будет работать.");
        audioContext = null;
    }
}

/** Возобновление AudioContext */
function resumeAudioContext() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log('AudioContext успешно возобновлен.');
        }).catch((error) => {
            console.error('Ошибка возобновления AudioContext:', error);
        });
    }
}

/** Загрузка аудиофайла для метронома */
async function loadAudioFile() {
    if (!audioContext) {
         setupAudioContext();
         if (!audioContext) return;
    }
    if (audioBuffer) return;

    const fileUrl = 'https://firebasestorage.googleapis.com/v0/b/song-archive-389a6.firebasestorage.app/o/metronome-85688%20(mp3cut.net).mp3?alt=media&token=97b66349-7568-43eb-80c3-c2278ff38c10';
    try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        console.log("Аудиофайл метронома успешно загружен и декодирован.");
    } catch (error) {
        console.error('Ошибка загрузки или декодирования аудиофайла:', error);
        alert("Не удалось загрузить звук метронома. Метроном может не работать.");
        audioBuffer = null;
    }
}

/** Воспроизведение одного клика метронома */
function playClick(beatsPerMeasure = 4) {
    if (!audioContext || !audioBuffer || audioContext.state !== 'running') {
         if (audioContext?.state === 'suspended') resumeAudioContext();
         if (isMetronomeActive) toggleMetronome(0); // Stop
         return;
    }

    try {
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime((currentBeat % beatsPerMeasure === 0) ? 1.0 : 0.6, audioContext.currentTime);
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        source.start(audioContext.currentTime);
        currentBeat = (currentBeat + 1) % beatsPerMeasure;
    } catch (error) {
        console.error("!!! Error during playClick execution:", error);
        if(isMetronomeActive) toggleMetronome(0); // Stop
    }
}

/** Включение/выключение метронома. Возвращает новое состояние. */
async function toggleMetronome(bpm, beatsPerMeasure) {
    if (!audioContext) setupAudioContext();
    if (!audioContext) return { isActive: false, error: "AudioContext not available" };
    
    resumeAudioContext();

    if (isMetronomeActive) {
        clearInterval(metronomeInterval);
        metronomeInterval = null;
        isMetronomeActive = false;
        currentBeat = 0;
        console.log("Metronome: Stopped.");
        return { isActive: false };
    } else if (bpm > 0) {
        if (!audioBuffer) await loadAudioFile();
        if (!audioBuffer || audioContext.state !== 'running') {
            const error = "Metronome audio not ready or context not running.";
            console.warn(error);
            return { isActive: false, error };
        }

        const intervalMilliseconds = 60000 / bpm;
        if (intervalMilliseconds <= 0 || !isFinite(intervalMilliseconds)) {
             console.error("Metronome: Invalid interval calculated.");
             return { isActive: false, error: "Invalid BPM" };
        }

        currentBeat = 0;
        isMetronomeActive = true;
        metronomeInterval = setInterval(() => playClick(beatsPerMeasure), intervalMilliseconds);
        playClick(beatsPerMeasure); // First click
        console.log("Metronome: Started.");
        return { isActive: true };
    }
    return { isActive: false }; // No action taken
}

function getMetronomeState() {
    return {
        isActive: isMetronomeActive,
        audioBuffer: audioBuffer,
        audioContext: audioContext,
    };
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
    
    // ПОСЛЕДОВАТЕЛЬНОЕ распределение: первый блок в левую колонку, второй в правую, третий опять в левую и т.д.
    const column1 = [];
    const column2 = [];
    
    blocks.forEach((block, index) => {
        const html = block.outerHTML;
        if (index % 2 === 0) {
            // Четные индексы (0, 2, 4...) идут в левую колонку
            column1.push(html);
        } else {
            // Нечетные индексы (1, 3, 5...) идут в правую колонку
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
