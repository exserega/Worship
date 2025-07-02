// Agape Worship App - metronome.js
// Модуль для работы с метрономом и аудио

// --- AUDIO CONTEXT & METRONOME ---

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
    setupAudioContext,
    resumeAudioContext,
    loadAudioFile,
    playClick,
    toggleMetronome,
    getMetronomeState
};

// Экспортируем переменные состояния для совместимости
export { audioContext, audioBuffer, metronomeInterval, isMetronomeActive, currentBeat }; 