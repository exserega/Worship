// Agape Worship App - metronome.js
// Модуль для работы с метрономом и аудио

// --- AUDIO CONTEXT & METRONOME ---

let audioContext;
let audioBuffer;
let metronomeInterval = null;
let isMetronomeActive = false;
let currentBeat = 0;

/** Настройка аудио контекста */
export function setupAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

/** Возобновление аудио контекста */
export function resumeAudioContext() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

/** Загрузка аудио файла для метронома */
async function loadAudioFile() {
    if (audioBuffer) return audioBuffer;
    
    try {
        const response = await fetch('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return audioBuffer;
    } catch (error) {
        console.error('Ошибка загрузки аудио файла:', error);
        return null;
    }
}

/** Воспроизведение клика метронома */
function playClick(beatsPerMeasure = 4) {
    if (!audioContext || !audioBuffer) return;
    
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    
    source.buffer = audioBuffer;
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Увеличиваем громкость для первого удара
    if (currentBeat % beatsPerMeasure === 0) {
        gainNode.gain.value = 0.8;
    } else {
        gainNode.gain.value = 0.4;
    }
    
    source.start();
}

/** Переключение метронома */
export async function toggleMetronome(bpm, beatsPerMeasure) {
    if (isMetronomeActive) {
        // Остановка метронома
        if (metronomeInterval) {
            clearInterval(metronomeInterval);
            metronomeInterval = null;
        }
        isMetronomeActive = false;
        currentBeat = 0;
        return false;
    } else {
        // Запуск метронома
        if (!audioContext) {
            setupAudioContext();
        }
        
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        
        await loadAudioFile();
        
        if (!audioBuffer) {
            console.error('Не удалось загрузить аудио файл для метронома');
            return false;
        }
        
        const interval = (60 / bpm) * 1000; // Интервал в миллисекундах
        
        metronomeInterval = setInterval(() => {
            playClick(beatsPerMeasure);
            currentBeat++;
        }, interval);
        
        isMetronomeActive = true;
        return true;
    }
}

/** Получение состояния метронома */
export function getMetronomeState() {
    return {
        isActive: isMetronomeActive,
        currentBeat: currentBeat,
        interval: metronomeInterval
    };
}

// Экспортируем переменные состояния для совместимости
export { audioContext, audioBuffer, metronomeInterval, isMetronomeActive, currentBeat }; 