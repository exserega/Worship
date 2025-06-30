// --- GLOBAL STATE ---
export let allSongs = [];
export let songsBySheet = {};
export let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
export let currentVocalistId = null;
export let currentVocalistName = null;
export let currentFontSize = 10; // DEFAULT_FONT_SIZE
export let areChordsVisible = true;
export let isChordsOnlyMode = false;
export let currentRepertoireSongsData = [];
export let currentRepertoireViewMode = 'byKey';

// --- SETLIST STATE ---
export let currentSetlistId = null;
export let currentSetlistName = null;
export let currentSetlistSongs = [];
export let currentSetlistSongsUnsubscribe = null;

// --- PRESENTATION STATE ---
export let presentationSongs = [];
export let currentPresentationIndex = 0;
export let controlsHideTimeout = null;
export let isPresentationSplit = false;

// --- METRONOME STATE ---
export let audioContext;
export let audioBuffer;
export let metronomeInterval = null;
export let isMetronomeActive = false;
export let currentBeat = 0;

// --- REPERTOIRE STATE ---
export let currentRepertoireUnsubscribe = null;

export let setlists = [];

// Functions to update state
export function setAllSongs(newSongs) { allSongs = newSongs; }
export function setSongsBySheet(newSongsBySheet) { songsBySheet = newSongsBySheet; }
export function setFavorites(newFavorites) { favorites = newFavorites; }
export function setCurrentVocalistId(id) { currentVocalistId = id; }
export function setCurrentVocalistName(name) { currentVocalistName = name; }
export function setCurrentFontSize(size) { currentFontSize = size; }
export function setAreChordsVisible(visible) {
    areChordsVisible = visible;
    isPresentationSplit = visible;
}
export function setIsChordsOnlyMode(onlyMode) {
    isChordsOnlyMode = onlyMode;
    // При включении режима "только аккорды" отключаем скрытие аккордов
    if (onlyMode) {
        areChordsVisible = true;
    }
}
export function setCurrentRepertoireSongsData(data) { currentRepertoireSongsData = data; }
export function setCurrentRepertoireViewMode(mode) { currentRepertoireViewMode = mode; }
export function setCurrentSetlistId(id) {
    currentSetlistId = id;
    const selectedSetlist = setlists.find(s => s.id === id);
    currentSetlistSongs = selectedSetlist ? selectedSetlist.songs : [];
}
export function setCurrentSetlistName(name) { currentSetlistName = name; }
export function setCurrentSetlistSongs(songs) { currentSetlistSongs = songs; }
export function setCurrentSetlistSongsUnsubscribe(unsubscribe) { currentSetlistSongsUnsubscribe = unsubscribe; }
export function setPresentationSongs(songs) { presentationSongs = songs; }
export function setCurrentPresentationIndex(index) { currentPresentationIndex = index; }
export function setControlsHideTimeout(timeout) { controlsHideTimeout = timeout; }
export function setIsPresentationSplit(split) { isPresentationSplit = split; }
export function setAudioContext(context) { audioContext = context; }
export function setAudioBuffer(buffer) { audioBuffer = buffer; }
export function setMetronomeInterval(interval) { metronomeInterval = interval; }
export function setIsMetronomeActive(active) { isMetronomeActive = active; }
export function setCurrentBeat(beat) { currentBeat = beat; }
export function setCurrentRepertoireUnsubscribe(unsubscribe) { currentRepertoireUnsubscribe = unsubscribe; }
export function setSetlists(newSetlists) {
    setlists = newSetlists;
} 