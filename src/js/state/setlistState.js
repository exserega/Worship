// Agape Worship App - state/setlistState.js
// Состояние сет-листов

// --- SETLIST STATE ---
export let currentSetlistId = null;
export let currentSetlistName = null;
export let currentSetlistSongs = [];
export let currentSetlistSongsUnsubscribe = null;
export let setlists = [];

// Functions to update setlist state
export function setCurrentSetlistId(id) {
    currentSetlistId = id;
    const selectedSetlist = setlists.find(s => s.id === id);
    currentSetlistSongs = selectedSetlist ? selectedSetlist.songs : [];
}
export function setCurrentSetlistName(name) { currentSetlistName = name; }
export function setCurrentSetlistSongs(songs) { currentSetlistSongs = songs; }
export function setCurrentSetlistSongsUnsubscribe(unsubscribe) { currentSetlistSongsUnsubscribe = unsubscribe; }
export function setSetlists(newSetlists) {
    setlists = newSetlists;
} 