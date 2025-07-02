// Agape Worship App - transposition.js
// Модуль для транспонирования аккордов

import { chords } from '../utils/constants.js';

// --- REGEX & DERIVED CONSTANTS ---
const chordRegex = /([A-H][#b]?(?:maj7|maj9|m7|m9|m11|7sus4|sus4|sus2|add9|dim7|dim|aug7|aug|7|m|6|9|11|13|sus)?(?:\s*\/\s*[A-H][#b]?)?)/g;

// --- TEXT PROCESSING & TRANSPOSITION ---

/** Расчет смещения для транспонирования */
export function getTransposition(originalKey, newKey) {
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
export function transposeLyrics(lyrics, transposition) {
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
export function processLyrics(lyrics) {
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
export function highlightChords(lyrics) {
    if (!lyrics) return '';
    try {
        const result = lyrics.replace(chordRegex, '<span class="chord">$1</span>');
        return result;
    } catch (error) {
        console.error("Ошибка при выделении аккордов:", error, "Текст:", lyrics.substring(0, 100) + "...");
        return lyrics;
    }
} 