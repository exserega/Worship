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
        return lyrics.replace(chordRegex, '<span class="chord">$1</span>');
    } catch (error) {
        console.error("Ошибка при выделении аккордов:", error, "Текст:", lyrics.substring(0, 100) + "...");
        return lyrics;
    }
}

/** Оборачивание блоков песни в fieldset с legend */
function wrapSongBlocks(lyrics) {
    if (!lyrics) return '';

    const markers = [
        "куплет", "припев", "бридж", "мостик", "мост", "проигрыш", "интро",
        "вступление", "аутро", "окончание", "кода", "запев", "соло",
        "предприпев", "прехорус",
        "verse", "chorus", "bridge", "pre-chorus", "intro", "outro", "solo", "instrumental", "interlude", "tag", "vamp"
    ];
    const uniqueMarkers = [...new Set(markers.map(m => m.toLowerCase()))];
    const markerPattern = `^\\s*(\\d+\\s+)?(${uniqueMarkers.join('|')})(\\s*\\d*)?\\s*[:.]?\\s*$`;
    const markerRegex = new RegExp(markerPattern, 'i');

    const lines = lyrics.split('\n');
    const blocks = [];
    let currentBlock = { legend: '', content: [] };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        if (markerRegex.test(trimmedLine)) {
            // Если это структурный маркер
            if (currentBlock.content.length > 0) {
                // Сохраняем предыдущий блок
                blocks.push(currentBlock);
            }
            // Начинаем новый блок
            currentBlock = { 
                legend: trimmedLine, 
                content: [] 
            };
        } else {
            // Добавляем строку в текущий блок
            currentBlock.content.push(line);
        }
    }
    
    // Добавляем последний блок
    if (currentBlock.legend || currentBlock.content.length > 0) {
        blocks.push(currentBlock);
    }

    // Формируем HTML с fieldset
    return blocks.map(block => {
        if (block.legend) {
            const content = block.content.join('\n');
            return `<fieldset class="song-block">
<legend class="song-block-legend">${block.legend}</legend>
<div class="song-block-content">${content}</div>
</fieldset>`;
        } else {
            // Блок без заголовка (начало песни до первого маркера)
            return block.content.join('\n');
        }
    }).join('\n');
}

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


export {
    getTransposition,
    transposeLyrics,
    processLyrics,
    highlightChords,
    highlightStructure,
    wrapSongBlocks,
    getRenderedSongText,
    extractYouTubeVideoId,
    isMobileView,
    setupAudioContext,
    resumeAudioContext,
    loadAudioFile,
    toggleMetronome,
    getMetronomeState
}; 