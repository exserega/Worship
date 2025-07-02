// Agape Worship App - State: Presentation State Module

// --- PRESENTATION STATE ---
export let presentationSongs = [];
export let currentPresentationIndex = 0;
export let controlsHideTimeout = null;
export let isPresentationSplit = false;

// Functions to update state
export function setPresentationSongs(songs) { presentationSongs = songs; }
export function setCurrentPresentationIndex(index) { currentPresentationIndex = index; }
export function setControlsHideTimeout(timeout) { controlsHideTimeout = timeout; }
export function setIsPresentationSplit(split) { isPresentationSplit = split; } 