// =====================================================================
// Agape Worship App - script.js (Главный файл - точка входа)
// =====================================================================

import * as state from './state.js';
import { MIN_FONT_SIZE, SWIPE_THRESHOLD, SWIPE_VERTICAL_LIMIT } from './constants.js';
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

// --- SWIPE TO CLOSE SETUP ---
function setupSwipeToClose() {
    const panels = document.querySelectorAll('.side-panel');
    let touchStartX = 0;
    let touchStartY = 0;
    
    panels.forEach(panel => {
        panel.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        panel.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;
            
            if (Math.abs(diffY) > SWIPE_VERTICAL_LIMIT) return;
            
            const isLeftPanel = panel.id === 'setlists-panel' || panel.id === 'my-list-panel';
            const isRightPanel = panel.id === 'repertoire-panel';
            const swipedLeft = diffX < -SWIPE_THRESHOLD;
            const swipedRight = diffX > SWIPE_THRESHOLD;
            
            if ((isLeftPanel && swipedLeft) || (isRightPanel && swipedRight)) {
                ui.closeAllSidePanels();
            }
        }, { passive: true });
    });
}

// --- Утилиты ---

/** Показывает уведомление пользователю */
function showNotification(message, type = 'info') {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Стили для уведомления
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--container-background-color);
        color: var(--text-color);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 12px 20px;
        font-size: 0.9rem;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    // Добавляем в DOM
    document.body.appendChild(notification);
    
    // Показываем с анимацией
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Скрываем через 3 секунды
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
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
            let finalHtml = core.getRenderedSongText(songData['Текст и аккорды'], originalKey, newKey);
            
            // Если включен двухколоночный режим, распределяем блоки по колонкам
            if (ui.songContent.classList.contains('split-columns')) {
                finalHtml = core.distributeSongBlocksToColumns(finalHtml);
            }
            
            const preElement = ui.songContent.querySelector('#song-display');
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
        const lyricsElement = ui.songContent.querySelector('#song-display');
        if (lyricsElement && lyricsElement.textContent?.trim()) {
            // Переключаем класс двухколоночного режима
            ui.songContent.classList.toggle('split-columns');
            
            // Перерендериваем текущую песню с учетом нового режима
            const songId = ui.songSelect.value;
            const songData = songId ? state.allSongs.find(s => s.id === songId) : null;
            if (songData) {
                const currentKey = ui.keySelect.value;
                const originalKey = songData['Оригинальная тональность'];
                let finalHtml = core.getRenderedSongText(songData['Текст и аккорды'], originalKey, currentKey);
                
                // Если теперь включен двухколоночный режим, распределяем блоки
                if (ui.songContent.classList.contains('split-columns')) {
                    finalHtml = core.distributeSongBlocksToColumns(finalHtml);
                }
                
                lyricsElement.innerHTML = finalHtml;
            }
            
            ui.updateSplitButton();
        } else {
            alert('Нет текста песни для разделения.');
        }
    });

    ui.toggleChordsButton.addEventListener('click', () => {
        if (!ui.songSelect.value) return;
        state.setAreChordsVisible(!state.areChordsVisible);
        ui.songContent.classList.toggle('chords-hidden', !state.areChordsVisible);
        
        // Скрываем/показываем блоки с только аккордами
        ui.toggleChordOnlyBlocks(!state.areChordsVisible);
        
        ui.updateToggleChordsButton();
    });

    ui.chordsOnlyButton.addEventListener('click', () => {
        if (!ui.songSelect.value) return;
        
        // Переключаем режим "только аккорды"
        state.setIsChordsOnlyMode(!state.isChordsOnlyMode);
        
        // Применяем CSS класс для основного контента
        ui.songContent.classList.toggle('chords-only-mode', state.isChordsOnlyMode);
        
        // Применяем CSS класс для презентации
        const presentationContent = document.querySelector('.presentation-content');
        if (presentationContent) {
            presentationContent.classList.toggle('chords-only-mode', state.isChordsOnlyMode);
        }
        
        // Обновляем обе кнопки
        ui.updateChordsOnlyButton();
        ui.updateToggleChordsButton();
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
        
        // Перерендериваем текущую песню в презентации с учетом нового режима
        ui.displayCurrentPresentationSong();
        
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

    // --- Редактор песен ---
    ui.editSongButton.addEventListener('click', () => {
        const songData = ui.getCurrentSongData();
        if (songData) {
            ui.openSongEditor(songData);
        }
    });

    ui.saveEditButton.addEventListener('click', async () => {
        const songData = ui.getCurrentSongData();
        const newContent = ui.songEditTextarea.value.trim();
        
        if (!songData || !newContent) {
            alert('Выберите песню и введите текст');
            return;
        }
        
        try {
            await api.saveSongEdit(songData.id, newContent);
            
            // Обновляем данные песни в локальном состоянии
            songData['Текст и аккорды (edited)'] = newContent;
            songData.hasWebEdits = true;
            songData.lastEditedInApp = new Date();
            
            // Обновляем отображение песни
            displaySongDetails(songData);
            
            // Закрываем редактор
            ui.closeSongEditor();
            
            // Показываем уведомление
            showNotification('✅ Песня успешно сохранена!', 'success');
            
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            alert('Ошибка при сохранении: ' + error.message);
        }
    });

    ui.cancelEditButton.addEventListener('click', () => {
        ui.closeSongEditor();
    });

    ui.closeEditorButton.addEventListener('click', () => {
        ui.closeSongEditor();
    });

    // Закрытие редактора при клике на оверлей
    ui.songEditorOverlay.addEventListener('click', (e) => {
        if (e.target === ui.songEditorOverlay) {
            ui.closeSongEditor();
        }
    });

    // Закрытие редактора по клавише Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && ui.songEditorOverlay.classList.contains('visible')) {
            ui.closeSongEditor();
        }
    });

    ui.revertToOriginalButton.addEventListener('click', async () => {
        const songData = ui.getCurrentSongData();
        if (!songData) return;
        
        if (!confirm('Вы уверены, что хотите вернуть оригинальный текст из Google Таблицы? Все ваши изменения будут потеряны.')) {
            return;
        }
        
        try {
            await api.revertToOriginal(songData.id);
            
            // Обновляем данные песни
            delete songData['Текст и аккорды (edited)'];
            songData.hasWebEdits = false;
            delete songData.lastEditedInApp;
            delete songData.editedBy;
            
            // Обновляем отображение
            displaySongDetails(songData);
            
            // Закрываем редактор
            ui.closeSongEditor();
            
            showNotification('🔄 Песня возвращена к оригиналу', 'info');
            
        } catch (error) {
            console.error('Ошибка отката:', error);
            alert('Ошибка при возврате к оригиналу: ' + error.message);
        }
    });

    // --- Централизованная обработка кликов ---
    document.addEventListener('click', (e) => {
        // Очистка результатов поиска при клике вне поля поиска
        if (e.target.id !== 'search-input') {
            if(ui.searchResults) ui.searchResults.innerHTML = '';
        }
        
        // Клик по аккорду в тексте песни для быстрой смены тональности
        // НЕ работает в режиме "только аккорды"
        if (e.target.closest('#song-content #song-display') && !state.isChordsOnlyMode) {
            const chordEl = e.target.closest('.chord');
            if (chordEl) {
                ui.keySelect.value = chordEl.textContent;
                ui.keySelect.dispatchEvent(new Event('change'));
            }
        }
        
        // Кнопка копирования текста
        if(e.target.closest('#copy-text-button')) {
            const preElement = ui.songContent.querySelector('#song-display');
            if (preElement) {
                navigator.clipboard.writeText(preElement.innerText).then(() => {
                    const copyButton = e.target.closest('#copy-text-button');
                    if (copyButton) {
                        copyButton.innerHTML = '<i class="fas fa-check"></i>';
                        setTimeout(() => {
                            if (copyButton) {
                                copyButton.innerHTML = '<i class="far fa-copy"></i>';
                            }
                        }, 1500);
                    }
                });
            }
        }
        
        // Закрытие панелей по кнопке-стрелке
        const closeButton = e.target.closest('.side-panel-close-btn');
        if (closeButton) {
            ui.closeAllSidePanels();
            return;
        }
        
        // Закрытие панели при клике вне ее области
        const openPanel = document.querySelector('.side-panel.open');
        if (openPanel && !openPanel.contains(e.target) && !e.target.closest('.mobile-nav-button')) {
            ui.closeAllSidePanels();
        }
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
    setupSwipeToClose();
    ui.updateFontSize();
    
    // Устанавливаем двухколоночный режим по умолчанию
    ui.songContent.classList.add('split-columns');
    ui.updateSplitButton();

    try {
        await api.loadAllSongsFromFirestore();
        ui.populateSheetSelect();
        ui.populateSongSelect();

        const vocalists = await api.loadVocalists();
        ui.populateVocalistSelect(vocalists);
        
        // core.loadAudioFile(); // ВРЕМЕННО ОТКЛЮЧЕНО - вызывает CORS ошибки и может ломать layout

    } catch (error) {
        console.error("Критическая ошибка во время инициализации:", error);
        document.body.innerHTML = `<div style="color: red; padding: 20px;">Критическая ошибка инициализации.</div>`;
    } finally {
        if(ui.loadingIndicator) ui.loadingIndicator.style.display = 'none';
    }

    console.log("Инициализация приложения завершена.");
    
    // КРИТИЧЕСКАЯ ЗАЩИТА: принудительно исправляем размеры панелей на мобильных
    if (window.innerWidth <= 480) {
        const observer = new MutationObserver(() => {
            document.querySelectorAll('.side-panel').forEach(panel => {
                if (panel.classList.contains('open')) {
                    // ПРИНУДИТЕЛЬНЫЕ РАЗМЕРЫ
                    const maxWidth = Math.min(280, window.innerWidth * 0.85);
                    panel.style.width = maxWidth + 'px';
                    panel.style.maxWidth = maxWidth + 'px';
                    
                    // ПРИНУДИТЕЛЬНОЕ ПОЗИЦИОНИРОВАНИЕ
                    panel.style.position = 'fixed';
                    panel.style.left = '0';
                    panel.style.right = 'auto';
                    panel.style.top = '0';
                    panel.style.bottom = '0';
                    panel.style.height = '100vh';
                    panel.style.transform = 'translateX(0)';
                    panel.style.zIndex = '1000';
                    
                    // ПРИНУДИТЕЛЬНОЕ ПЕРЕПОЛНЕНИЕ
                    panel.style.overflow = 'hidden';
                    panel.style.boxSizing = 'border-box';
                }
            });
        });
        observer.observe(document.body, { 
            attributes: true, 
            subtree: true, 
            attributeFilter: ['class'] 
        });
    }
});