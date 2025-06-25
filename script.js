// =====================================================================
// Agape Worship App - script.js (Главный файл - точка входа)
// =====================================================================

import * as state from './state.js';
import { SONG_CATEGORIES_ORDER, DEFAULT_FONT_SIZE, MIN_FONT_SIZE } from './constants.js';
import * as api from './api.js';
import * as core from './core.js';
import * as ui from './ui.js';

// --- HANDLERS ---

/** Обработчик выбора песни из репертуара или "Моего списка" */
function handleFavoriteOrRepertoireSelect(song) {
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
        ui.saveNoteButton.disabled = false;
        ui.saveNoteButton.textContent = 'Сохранить';
    }
}

function closeNotesModal() {
    ui.notesModal.classList.remove('visible');
    setTimeout(() => {
        ui.notesModal.style.display = 'none';
        ui.noteEditTextarea.value = '';
        delete ui.notesModal.dataset.songdocid;
    }, 300);
}


// --- EVENT LISTENER SETUP ---
function setupEventListeners() {
    // --- Основные элементы управления ---
    ui.sheetSelect.addEventListener('change', () => {
        ui.searchInput.value = '';
        ui.searchResults.innerHTML = '';
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
            ui.songContent.querySelector('pre').innerHTML = finalHtml;
            ui.songContent.querySelector('h2').textContent = `${title} — ${newKey}`;
        }
    });

    ui.searchInput.addEventListener('input', () => {
        const query = ui.searchInput.value.trim().toLowerCase();
        if(!query) {
            ui.searchResults.innerHTML = '';
            return;
        }
        const matchingSongs = state.allSongs.filter(song => 
            song.name && song.name.toLowerCase().includes(query)
        );
        ui.displaySearchResults(matchingSongs, (songMatch) => {
            ui.searchInput.value = songMatch.name;
            ui.searchResults.innerHTML = '';
            handleFavoriteOrRepertoireSelect(songMatch);
        });
    });
    
    ui.searchInput.addEventListener('blur', () => setTimeout(() => { ui.searchResults.innerHTML = '' }, 200));

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
         if (event.target.closest('#copy-text-button')) {
            const preElement = ui.songContent.querySelector('pre');
            const copyBtn = event.target.closest('#copy-text-button');
            if (!preElement || !copyBtn) return;
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
        // ... (This now toggles Setlists panel)
    });
    ui.toggleMyListButton.addEventListener('click', () => {
        const isOpen = ui.myListPanel.classList.toggle('open');
        if (isOpen) {
            ui.closeAllSidePanels();
            ui.myListPanel.classList.add('open');
            // Logic to load and render favorites
        }
    });
    ui.toggleRepertoireButton.addEventListener('click', () => {
        const isOpen = ui.repertoirePanel.classList.toggle('open');
        if (isOpen) {
            ui.closeAllSidePanels();
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
            // Re-render
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
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNotesModal(); });
}


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM loaded.");
    ui.loadingIndicator.style.display = 'block';

    let initialTheme = 'dark';
    try {
        const savedTheme = localStorage.getItem('theme');
        initialTheme = (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : (window.matchMedia?.('(prefers-color-scheme: light)')?.matches ? 'light' : 'dark');
    } catch (e) { console.error(e); }
    ui.applyTheme(initialTheme);
    
    setupEventListeners();

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
        ui.loadingIndicator.style.display = 'none';
    }

    console.log("Инициализация приложения завершена.");
});

   