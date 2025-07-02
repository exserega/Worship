// Agape Worship App - state/metronomeState.js
// Состояние метронома

// --- METRONOME STATE ---
export let audioContext;
export let audioBuffer;
export let metronomeInterval = null;
export let isMetronomeActive = false;
export let currentBeat = 0;

// Functions to update metronome state
export function setAudioContext(context) { audioContext = context; }
export function setAudioBuffer(buffer) { audioBuffer = buffer; }
export function setMetronomeInterval(interval) { metronomeInterval = interval; }
export function setIsMetronomeActive(active) { isMetronomeActive = active; }
export function setCurrentBeat(beat) { currentBeat = beat; } 