// =====================================================================
// Agape Worship App - script.js (Главный файл - точка входа)
// =====================================================================

import * as state from './state.js';
import { MIN_FONT_SIZE } from './constants.js';
import * as api from './api.js';
import * as core from './core.js';
import * as ui from './ui.js';

// --- HANDLERS ---

/** Обработчик выбора песни из репертуара или "Моего списка" */
function handleFavoriteOrRepertoireSelect(song) {
    if (!song || !song.id) return;
    ui.sheetSelect.value = song.sheet;
    ui.populateSongSelect();
    ui.songSelect.value = song.id;
    ui.displaySongDetails(song, song.preferredKey);
    ui.closeAllSidePanels();
}

/** Обработчик загрузки репертуара */
function handleRepertoireUpdate({ data, error }) {
    if (error) {
        state.setCurrentRepertoireSongsData([]);
    } else {
        state.setCurrentRepertoireSongsData(data);
    }
    ui.renderRepertoire(handleFavoriteOrRepertoireSelect);
}

/** Обработчик сохранения заметки */
async function handleSaveNote() {
    const songDocId = ui.notesModal.dataset.songdocid;
    const newNoteText = ui.noteEditTextarea.value.trim();

    if (!state.currentSetlistId || !songDocId) {
        alert("Ошибка: Не удалось определить сет-лист или песню для сохранения заметки.");
        return;
    }

    ui.saveNoteButton.disabled = true;
    ui.saveNoteButton.textContent = 'Сохранение...';
    try {
        await api.saveNoteForSongInSetlist(state.currentSetlistId, songDocId, newNoteText);
        closeNotesModal();
    } catch (error) {
        alert("Не удалось сохранить заметку. Попробуйте еще раз.");
    } finally {
        if(ui.saveNoteButton) { // Check if element still exists
            ui.saveNoteButton.disabled = false;
            ui.saveNoteButton.textContent = 'Сохранить';
        }
    }
}

function closeNotesModal() {
    ui.notesModal.classList.remove('visible');
    setTimeout(() => {
        ui.notesModal.style.display = 'none';
        if (ui.noteEditTextarea) ui.noteEditTextarea.value = '';
        if (ui.notesModal) delete ui.notesModal.dataset.songdocid;
    }, 300);
}

// --- SETLIST HANDLERS ---

async function handleCreateSetlist() {
    const name = ui.newSetlistNameInput.value.trim();
    if (!name) {
        alert("Название сет-листа не может быть пустым.");
        return;
    }
    try {
        ui.createSetlistButton.disabled = true;
        await api.createSetlist(name);
        ui.newSetlistNameInput.value = '';
        await refreshSetlists();
    } catch (error) {
        console.error("Ошибка при создании сет-листа:", error);
        alert("Не удалось создать сет-лист.");
    } finally {
        ui.createSetlistButton.disabled = false;
    }
}

function handleSetlistSelect(setlist) {
    state.setCurrentSetlistId(setlist.id);
    ui.displaySelectedSetlist(setlist, handleFavoriteOrRepertoireSelect, handleRemoveSongFromSetlist);
}

async function handleSetlistDelete(setlistId, setlistName) {
    if (confirm(`Вы уверены, что хотите удалить сет-лист "${setlistName}"?`)) {
        try {
            const wasSelected = state.currentSetlistId === setlistId;

            await api.deleteSetlist(setlistId);
            await refreshSetlists(); // This re-renders the list

            if (wasSelected) {
                state.setCurrentSetlistId(null);
                ui.clearSetlistSelection();
            }
        } catch (error) {
            console.error("Ошибка при удалении сет-листа:", error);
            alert("Не удалось удалить сет-лист.");
        }
    }
}

async function handleAddSongToSetlist() {
    const songId = ui.songSelect.value;
    const key = ui.keySelect.value;
    const setlistId = state.currentSetlistId;

    if (!songId) {
        alert("Сначала выберите песню.");
        return;
    }
    if (!setlistId) {
        alert("Сначала выберите сет-лист.");
        return;
    }

    try {
        const result = await api.addSongToSetlist(setlistId, songId, key);

        if (result.status === 'duplicate_key') {
            if (confirm(`Эта песня уже есть в сет-листе в тональности ${result.existingKey}. Заменить на ${key}?`)) {
                await api.updateSongKeyInSetlist(setlistId, songId, key);
                alert("Тональность песни обновлена.");
            }
        } else if (result.status === 'duplicate_same') {
            alert("Эта песня уже есть в сет-листе с такой же тональностью.");
        } else if (result.status === 'added') {
            alert("Песня добавлена в сет-лист.");
        }

        // Refresh view
        const updatedSetlists = await api.loadSetlists();
        state.setSetlists(updatedSetlists);
        const updatedCurrentSetlist = updatedSetlists.find(s => s.id === setlistId);
        if (updatedCurrentSetlist) {
            state.setCurrentSetlistId(updatedCurrentSetlist.id); // Re-set state
            ui.displaySelectedSetlist(updatedCurrentSetlist, handleFavoriteOrRepertoireSelect, handleRemoveSongFromSetlist);
        }

    } catch (error) {
        console.error("Ошибка при добавлении песни:", error);
        alert("Не удалось добавить песню в сет-лист.");
    }
}

async function handleRemoveSongFromSetlist(songId, songName) {
    const setlistId = state.currentSetlistId;
    if (!setlistId) return;

    if (confirm(`Удалить песню "${songName}" из текущего сет-листа?`)) {
        try {
            await api.removeSongFromSetlist(setlistId, songId);

            // Refresh view
            const updatedSetlists = await api.loadSetlists();
            state.setSetlists(updatedSetlists);
            const updatedCurrentSetlist = updatedSetlists.find(s => s.id === setlistId);
            if (updatedCurrentSetlist) {
                 state.setCurrentSetlistId(updatedCurrentSetlist.id); // Re-set state
                 ui.displaySelectedSetlist(updatedCurrentSetlist, handleFavoriteOrRepertoireSelect, handleRemoveSongFromSetlist);
            } else {
                // This case handles if the setlist was somehow deleted in the process
                state.setCurrentSetlistId(null);
                ui.clearSetlistSelection();
            }
        } catch (error) {
            console.error("Ошибка при удалении песни из сет-листа:", error);
            alert("Не удалось удалить песню.");
        }
    }
}

async function handleAddToRepertoire() {
    const vocalistId = state.currentVocalistId;
    const songId = ui.songSelect.value;
    const key = ui.keySelect.value;

    if (!vocalistId) {
        alert("Пожалуйста, сначала выберите вокалиста.");
        return;
    }
    if (!songId) {
        alert("Пожалуйста, сначала выберите песню.");
        return;
    }

    const song = state.allSongs.find(s => s.id === songId);
    if (!song) {
        alert("Произошла ошибка: не удалось найти данные песни.");
        return;
    }

    try {
        const vocalistName = state.currentVocalistName || 'выбранного вокалиста';
        const result = await api.addToRepertoire(vocalistId, song, key);

        if (result.status === 'added') {
            alert(`Песня "${song.name}" добавлена в репертуар для "${vocalistName}".`);
        } else if (result.status === 'updated') {
            alert(`Тональность песни "${song.name}" в репертуаре для "${vocalistName}" обновлена на ${key}.`);
        } else if (result.status === 'exists') {
            alert(`Песня "${song.name}" уже есть в репертуаре для "${vocalistName}" с той же тональностью.`);
        }
    } catch (error) {
        console.error("Ошибка при добавлении в репертуар:", error);
        alert("Не удалось добавить песню в репертуар.");
    }
}

async function refreshSetlists() {
    try {
        const setlists = await api.loadSetlists();
        state.setSetlists(setlists);
        ui.renderSetlists(setlists, handleSetlistSelect, handleSetlistDelete);
    } catch (error) {
        console.error("Ошибка при загрузке сет-листов:", error);
        ui.renderSetlists([], handleSetlistSelect, handleSetlistDelete); // Render empty list on error
    }
}

// --- EVENT LISTENER SETUP ---
function setupEventListeners() {
    // --- Основные элементы управления ---
    ui.sheetSelect.addEventListener('change', () => {
        ui.searchInput.value = '';
        if(ui.searchResults) ui.searchResults.innerHTML = '';
        ui.populateSongSelect();
    });

    ui.songSelect.addEventListener('change', () => {
        const songId = ui.songSelect.value;
        const songData = songId ? state.allSongs.find(s => s.id === songId) : null;
        ui.displaySongDetails(songData);
    });

    ui.keySelect.addEventListener('change', () => {
        const songId = ui.keySelect.dataset.songId;
        const songData = songId ? state.allSongs.find(s => s.id === songId) : null;
        if(songData) {
            const newKey = ui.keySelect.value;
            const originalKey = songData['Оригинальная тональность'];
            const title = songData.name;
            const finalHtml = core.getRenderedSongText(songData['Текст и аккорды'], originalKey, newKey);
            const preElement = ui.songContent.querySelector('pre');
            const h2Element = ui.songContent.querySelector('h2');
            if (preElement) preElement.innerHTML = finalHtml;
            if (h2Element) h2Element.textContent = `${title} — ${newKey}`;
        }
    });

    ui.searchInput.addEventListener('input', () => {
        const query = ui.searchInput.value.trim().toLowerCase();
        if(!query) {
            if(ui.searchResults) ui.searchResults.innerHTML = '';
            return;
        }
        const matchingSongs = state.allSongs.filter(song =>
            song.name && song.name.toLowerCase().includes(query)
        );
        ui.displaySearchResults(matchingSongs, (songMatch) => {
            ui.searchInput.value = songMatch.name;
            if(ui.searchResults) ui.searchResults.innerHTML = '';
            handleFavoriteOrRepertoireSelect(songMatch);
        });
    });
    
    ui.searchInput.addEventListener('blur', () => setTimeout(() => { if(ui.searchResults) ui.searchResults.innerHTML = '' }, 200));

    // --- Кнопки действий над песней ---
    ui.zoomInButton.addEventListener('click', () => {
        state.setCurrentFontSize(Math.min(state.currentFontSize + 2, 30));
        ui.updateFontSize();
    });
    ui.zoomOutButton.addEventListener('click', () => {
        state.setCurrentFontSize(Math.max(MIN_FONT_SIZE, state.currentFontSize - 2));
        ui.updateFontSize();
    });

    ui.splitTextButton.addEventListener('click', () => {
        const lyricsElement = ui.songContent.querySelector('pre');
        if (lyricsElement && lyricsElement.textContent?.trim()) {
            ui.songContent.classList.toggle('split-columns');
            ui.updateSplitButton();
        } else {
            alert('Нет текста песни для разделения.');
        }
    });

    ui.toggleChordsButton.addEventListener('click', () => {
        if (!ui.songSelect.value) return;
        state.setAreChordsVisible(!state.areChordsVisible);
        ui.songContent.classList.toggle('chords-hidden', !state.areChordsVisible);
        ui.updateToggleChordsButton();
    });

    ui.songContent.addEventListener('click', (event) => {
         const copyBtn = event.target.closest('#copy-text-button');
         if (copyBtn) {
            const preElement = ui.songContent.querySelector('pre');
            if (!preElement) return;
            navigator.clipboard.writeText(preElement.innerText).then(() => {
                copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => { copyBtn.innerHTML = '<i class="far fa-copy"></i>'; }, 1500);
            });
         }
     });

    ui.favoriteButton.addEventListener('click', async () => {
        const songId = ui.songSelect.value;
        const key = ui.keySelect.value;
        const songName = state.allSongs.find(s=>s.id === songId)?.name || 'Эту песню';
        if (!songId) { alert("Пожалуйста, выберите песню."); return; }

        const result = await api.addToFavorites(songId, key);
        
        if (result.status === 'added') {
            alert(`Песня "${songName}" (${result.key}) добавлена в 'Мой список'.`);
        } else if (result.status === 'updated') {
            alert(`Тональность песни "${songName}" в 'Моем списке' обновлена на ${result.key}.`);
        } else if (result.status === 'exists') {
            alert(`Песня "${songName}" уже есть в 'Моем списке' с той же тональностью.`);
        }
    });

    ui.addToSetlistButton.addEventListener('click', handleAddSongToSetlist);

    ui.addToRepertoireButton.addEventListener('click', handleAddToRepertoire);

    // --- Переключение темы ---
    ui.themeToggleButton.addEventListener('click', () => {
        const currentTheme = document.body.dataset.theme;
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        ui.applyTheme(newTheme);
    });

    // --- Метроном ---
    ui.metronomeButton.addEventListener('click', async () => {
        const bpmText = ui.bpmDisplay?.textContent;
        const bpmValue = parseInt(bpmText, 10);
        const beats = parseInt(ui.timeSignatureSelect.value, 10);
        
        const metronomeState = core.getMetronomeState();
        
        if (metronomeState.isActive || (bpmValue > 0)) {
            const { isActive, error } = await core.toggleMetronome(bpmValue, beats);
            if(error) alert(error);
            ui.updateMetronomeButton(isActive);
        } else {
            alert('Не указан или некорректный BPM для запуска метронома.');
        }
    });


    // --- Боковые панели ---
    ui.toggleFavoritesButton.addEventListener('click', () => {
        const isAlreadyOpen = ui.setlistsPanel.classList.contains('open');
        ui.closeAllSidePanels();
        if (!isAlreadyOpen) {
            ui.setlistsPanel.classList.add('open');
            refreshSetlists();
        }
    });

    ui.toggleMyListButton.addEventListener('click', () => {
        const isAlreadyOpen = ui.myListPanel.classList.contains('open');
        ui.closeAllSidePanels();
        if (!isAlreadyOpen) {
            ui.myListPanel.classList.add('open');
            // Logic to load and render favorites
            const favoriteSongs = state.allSongs.filter(song => 
                state.favorites.some(fav => fav.songId === song.id)
            ).map(song => {
                const fav = state.favorites.find(f => f.songId === song.id);
                return { ...song, preferredKey: fav.preferredKey };
            });
            ui.renderFavorites(favoriteSongs, handleFavoriteOrRepertoireSelect, async (songId) => {
                if(confirm("Удалить песню из 'Моего списка'?")) {
                    await api.removeFromFavorites(songId);
                    // Manually refresh list after deletion
                    ui.toggleMyListButton.click(); 
                    ui.toggleMyListButton.click();
                }
            });
        }
    });

    ui.toggleRepertoireButton.addEventListener('click', () => {
        const isAlreadyOpen = ui.repertoirePanel.classList.contains('open');
        ui.closeAllSidePanels();
        if (!isAlreadyOpen) {
            ui.repertoirePanel.classList.add('open');
            api.loadRepertoire(state.currentVocalistId, handleRepertoireUpdate);
        }
    });

    ui.vocalistSelect.addEventListener('change', (e) => {
        state.setCurrentVocalistId(e.target.value);
        const selectedOption = e.target.options[e.target.selectedIndex];
        state.setCurrentVocalistName(selectedOption.value ? selectedOption.text : null);
        api.loadRepertoire(state.currentVocalistId, handleRepertoireUpdate);
    });

    [ui.repertoireViewKeyBtn, ui.repertoireViewSheetBtn, ui.repertoireViewAllBtn].forEach(button => {
        button.addEventListener('click', () => {
            const newMode = button.id.includes('key') ? 'byKey' : button.id.includes('sheet') ? 'bySheet' : 'allAlphabetical';
            state.setCurrentRepertoireViewMode(newMode);
            ui.renderRepertoire(handleFavoriteOrRepertoireSelect);
        });
    });

    // --- Презентация ---
    ui.presentationCloseBtn.addEventListener('click', () => {
        ui.presentationOverlay.classList.remove('visible');
    });
    ui.presPrevBtn.addEventListener('click', () => {
        state.setCurrentPresentationIndex(state.currentPresentationIndex - 1);
        ui.displayCurrentPresentationSong();
    });
    ui.presNextBtn.addEventListener('click', () => {
        state.setCurrentPresentationIndex(state.currentPresentationIndex + 1);
        ui.displayCurrentPresentationSong();
    });
    ui.presSplitTextBtn.addEventListener('click', () => {
        state.setIsPresentationSplit(!state.isPresentationSplit);
        ui.presentationContent.classList.toggle('split-columns', state.isPresentationSplit);
        ui.updatePresentationSplitButtonState();
    });
    
    // --- Модальное окно заметок ---
    ui.saveNoteButton.addEventListener('click', handleSaveNote);
    ui.cancelNoteButton.addEventListener('click', closeNotesModal);
    ui.closeNoteModalX.addEventListener('click', closeNotesModal);
    ui.notesModal.addEventListener('click', (e) => { if (e.target === ui.notesModal) closeNotesModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.notesModal.classList.contains('visible')) closeNotesModal(); });

    // --- Сет-листы ---
    ui.createSetlistButton.addEventListener('click', handleCreateSetlist);

    // --- Кнопки закрытия боковых панелей ---
    document.querySelectorAll('.side-panel-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            ui.closeAllSidePanels();
        });
    });
}


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM loaded.");
    if(ui.loadingIndicator) ui.loadingIndicator.style.display = 'block';

    let initialTheme = 'dark';
    try {
        const savedTheme = localStorage.getItem('theme');
        initialTheme = (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : (window.matchMedia?.('(prefers-color-scheme: light)')?.matches ? 'light' : 'dark');
    } catch (e) { console.error(e); }
    ui.applyTheme(initialTheme);
    
    setupEventListeners();
    ui.updateFontSize();

    try {
        await api.loadAllSongsFromFirestore();
        ui.populateSheetSelect();
        ui.populateSongSelect();

        const vocalists = await api.loadVocalists();
        ui.populateVocalistSelect(vocalists);
        
        core.loadAudioFile(); // Pre-load

    } catch (error) {
        console.error("Критическая ошибка во время инициализации:", error);
        document.body.innerHTML = `<div style="color: red; padding: 20px;">Критическая ошибка инициализации.</div>`;
    } finally {
        if(ui.loadingIndicator) ui.loadingIndicator.style.display = 'none';
    }

    console.log("Инициализация приложения завершена.");
});