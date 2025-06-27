// Agape Worship App - ui.js

import { SONG_CATEGORIES_ORDER, MIN_FONT_SIZE, chords } from './constants.js';
import * as state from './state.js';
import { getRenderedSongText, extractYouTubeVideoId, isMobileView } from './core.js';
import * as api from './api.js';


// --- DOM ELEMENT REFERENCES ---
export const sheetSelect = document.getElementById('sheet-select');
export const songSelect = document.getElementById('song-select');
export const keySelect = document.getElementById('key-select');
export const searchInput = document.getElementById('search-input');
export const searchResults = document.getElementById('search-results');
export const loadingIndicator = document.getElementById('loading-indicator');
export const songContent = document.getElementById('song-content');
export const splitTextButton = document.getElementById('split-text-button');
export const zoomInButton = document.getElementById('zoom-in');
export const zoomOutButton = document.getElementById('zoom-out');
export const bpmDisplay = document.getElementById('bpm-display');
export const holychordsButton = document.getElementById('holychords-button');
export const timeSignatureSelect = document.getElementById('time-signature');
export const metronomeButton = document.getElementById('metronome-button');
export const playerContainer = document.getElementById('youtube-player-container');
export const playerSection = document.getElementById('youtube-player-section');
export const themeToggleButton = document.getElementById('theme-toggle-button');
export const toggleChordsButton = document.getElementById('toggle-chords-button');
export const favoriteButton = document.getElementById('favorite-button');
export const addToSetlistButton = document.getElementById('add-to-setlist-button');
export const addToRepertoireButton = document.getElementById('add-to-repertoire-button');
export const toggleFavoritesButton = document.getElementById('toggle-favorites');
export const setlistsPanel = document.getElementById('setlists-panel');
export const toggleMyListButton = document.getElementById('toggle-my-list');
export const myListPanel = document.getElementById('my-list-panel');
export const toggleRepertoireButton = document.getElementById('toggle-repertoire');
export const repertoirePanel = document.getElementById('repertoire-panel');
export const favoritesList = document.getElementById('favorites-list');
export const newSetlistNameInput = document.getElementById('new-setlist-name-input');
export const createSetlistButton = document.getElementById('create-setlist-button');
export const setlistsListContainer = document.getElementById('setlists-list-container');
export const currentSetlistTitle = document.getElementById('current-setlist-title');
export const currentSetlistControls = document.querySelector('.current-setlist-controls');
export const startPresentationButton = document.getElementById('start-presentation-button');
export const deleteSetlistButton = document.getElementById('delete-setlist-button');
export const currentSetlistSongsContainer = document.getElementById('current-setlist-songs-container');
export const vocalistSelect = document.getElementById('vocalist-select');
export const repertoirePanelList = document.getElementById('repertoire-panel-list');
export const presentationOverlay = document.getElementById('presentation-overlay');
export const presentationContent = document.getElementById('presentation-content');
export const presentationCloseBtn = document.getElementById('presentation-close-btn');
export const presSplitTextBtn = document.getElementById('pres-split-text-btn');
export const presentationControls = document.querySelector('.presentation-controls');
export const presPrevBtn = document.getElementById('pres-prev-btn');
export const presNextBtn = document.getElementById('pres-next-btn');
export const presCounter = document.getElementById('pres-counter');
export const notesModal = document.getElementById('notes-modal');
export const noteEditTextarea = document.getElementById('note-edit-textarea');
export const saveNoteButton = document.getElementById('save-note-button');
export const cancelNoteButton = document.getElementById('cancel-note-button');
export const closeNoteModalX = document.getElementById('close-note-modal-x');
export const repertoireViewKeyBtn = document.getElementById('repertoire-view-key');
export const repertoireViewSheetBtn = document.getElementById('repertoire-view-sheet');
export const repertoireViewAllBtn = document.getElementById('repertoire-view-all');


// --- UI GENERAL ---

/** Закрывает все боковые панели и деактивирует кнопки в футере */
export function closeAllSidePanels() {
    if (setlistsPanel) setlistsPanel.classList.remove('open');
    if (myListPanel) myListPanel.classList.remove('open');
    if (repertoirePanel) repertoirePanel.classList.remove('open');

    // Также убираем класс active у всех кнопок мобильной навигации
    if (toggleFavoritesButton) toggleFavoritesButton.classList.remove('active');
    if (toggleMyListButton) toggleMyListButton.classList.remove('active');
    if (toggleRepertoireButton) toggleRepertoireButton.classList.remove('active');
}

/**
 * Переключает видимость боковой панели.
 * @param {HTMLElement} panel - Элемент панели для переключения.
 * @param {Function} [onOpenCallback] - Функция, которая будет вызвана, если панель открывается.
 */
export function togglePanel(panel, onOpenCallback) {
    if (!panel) return;

    const isAlreadyOpen = panel.classList.contains('open');

    // Сначала всегда закрываем все панели
    closeAllSidePanels();

    // Если панель не была открыта, открываем ее и выполняем колбэк
    if (!isAlreadyOpen) {
        panel.classList.add('open');
        
        // Активируем соответствующую кнопку в мобильной навигации
        let mobileButton;
        if (panel.id === 'setlists-panel') {
            mobileButton = toggleFavoritesButton;
        } else if (panel.id === 'my-list-panel') {
            mobileButton = toggleMyListButton;
        } else if (panel.id === 'repertoire-panel') {
            mobileButton = toggleRepertoireButton;
        }
        if (mobileButton) {
            mobileButton.classList.add('active');
        }

        if (onOpenCallback && typeof onOpenCallback === 'function') {
            onOpenCallback();
        }
    }
}

/** Применяет указанную тему (light/dark) */
export function applyTheme(themeName) {
    const newTheme = (themeName === 'light' || themeName === 'dark') ? themeName : 'dark';
    document.body.dataset.theme = newTheme;

    if (themeToggleButton) {
        const sliderIcon = themeToggleButton.querySelector('.theme-toggle-slider i');
        if (sliderIcon) {
            if (newTheme === 'light') {
                sliderIcon.className = 'fas fa-sun';
                themeToggleButton.title = "Переключить на темную тему";
            } else {
                sliderIcon.className = 'fas fa-moon';
                themeToggleButton.title = "Переключить на светлую тему";
            }
        }
    }
    try {
        localStorage.setItem('theme', newTheme);
    } catch (e) {
        console.error("Ошибка сохранения темы в localStorage:", e);
    }
}

/** Отображает детали выбранной песни */
export function displaySongDetails(songData, keyToSelect) {
    const keyDisplay = document.getElementById('youtube-video-key-display');

    if (!songData) {
        // Обновляем legend и pre, сохраняя fieldset структуру
        const songTitle = songContent.querySelector('#song-title');
        const songPre = songContent.querySelector('pre');
        if (songTitle) songTitle.textContent = 'Выберите песню';
        if (songPre) songPre.textContent = '';
        
        playerContainer.innerHTML = '';
        playerSection.style.display = 'none';
        if (bpmDisplay) bpmDisplay.textContent = 'N/A';
        if (holychordsButton) holychordsButton.style.display = 'none';
        keySelect.value = "C";
        keySelect.dataset.songId = '';
        if (keyDisplay) keyDisplay.style.display = 'none';
        favoriteButton.disabled = true;
        addToSetlistButton.disabled = true;
        addToRepertoireButton.disabled = true;
        toggleChordsButton.disabled = true;
        songContent.classList.remove('chords-hidden');
        const copyBtn = songContent.querySelector('#copy-text-button');
        if (copyBtn) copyBtn.style.display = 'none';
        return;
    }

    const title = songData.name || 'Без названия';
    const originalLyrics = songData['Текст и аккорды'] || '';
    const originalKeyFromSheet = songData['Оригинальная тональность'] || "C";
    const srcUrl = songData.Holychords || '#';
    const bpm = songData.BPM || 'N/A';
    const ytLink = songData['YouTube Link'];
    const videoKey = songData.videoKey ? String(songData.videoKey).trim() : null;

    const currentSelectedKey = keyToSelect || originalKeyFromSheet;
    keySelect.value = currentSelectedKey;
    keySelect.dataset.songId = songData.id;

    if (bpmDisplay) updateBPM(bpm);
    if (holychordsButton) {
        if (srcUrl && srcUrl.trim() !== '' && srcUrl.trim() !== '#') {
            holychordsButton.href = srcUrl;
            holychordsButton.style.display = 'inline-block';
        } else {
            holychordsButton.style.display = 'none';
        }
    }

    const finalHighlightedLyrics = getRenderedSongText(originalLyrics, originalKeyFromSheet, currentSelectedKey);
    
    // Обновляем legend и pre, сохраняя fieldset структуру
    const songTitle = songContent.querySelector('#song-title');
    const songPre = songContent.querySelector('pre');
    const copyBtn = songContent.querySelector('#copy-text-button');
    
    // Убираем из заголовка всё что идет после скобок (строчки для поиска)
    const cleanTitle = title.includes('(') ? title.split('(')[0].trim() : title;
    if (songTitle) songTitle.textContent = cleanTitle;
    if (songPre) songPre.innerHTML = finalHighlightedLyrics;
    if (copyBtn) copyBtn.style.display = 'block';
    
    updateFontSize();
    songContent.classList.toggle('chords-hidden', !state.areChordsVisible);

    const vId = extractYouTubeVideoId(ytLink);
    if (vId) {
        const embedUrl = `https://www.youtube.com/embed/${vId}`;
        playerContainer.innerHTML = `<iframe width="100%" height="315" src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
        playerSection.style.display = 'block';
        if (keyDisplay) {
            if (videoKey) {
                keyDisplay.textContent = `Тональность в видео: ${videoKey}`;
                keyDisplay.style.display = 'block';
            } else {
                keyDisplay.style.display = 'none';
            }
        }
    } else {
        playerContainer.innerHTML = '';
        playerSection.style.display = 'none';
        if (keyDisplay) keyDisplay.style.display = 'none';
    }

    favoriteButton.disabled = false;
    addToSetlistButton.disabled = false;
    addToRepertoireButton.disabled = false;
    toggleChordsButton.disabled = false;
    updateToggleChordsButton();
}

/** Обновление размера шрифта текста песни */
export function updateFontSize() {
    document.documentElement.style.setProperty('--lyrics-font-size', `${state.currentFontSize}px`);
}

/** Обновление отображения и логики BPM */
export function updateBPM(newBPM) {
    if (bpmDisplay) bpmDisplay.textContent = newBPM;
}

/** Обновление кнопки скрытия/показа аккордов */
export function updateToggleChordsButton() {
    const iconGuitar = '<i class="fas fa-guitar"></i>';
    const iconMusic = '<i class="fas fa-music"></i>';
    const textShow = '<span class="button-text">Аккорды</span>';
    
    const currentIcon = state.areChordsVisible ? iconGuitar : iconMusic;
    const currentTitle = state.areChordsVisible ? 'Скрыть аккорды' : 'Показать аккорды';

    toggleChordsButton.innerHTML = currentIcon + (isMobileView() ? '' : textShow);
    toggleChordsButton.title = currentTitle;
    toggleChordsButton.disabled = !songSelect || !songSelect.value;
}

/** Обновление кнопки разделения текста */
export function updateSplitButton() {
    const isSplit = songContent.classList.contains('split-columns');
    const icon = isSplit ? '<i class="fas fa-align-justify"></i>' : '<i class="fas fa-columns"></i>';
    const text = isSplit ? '<span class="button-text">Объединить</span>' : '<span class="button-text">Разделить</span>';
    splitTextButton.innerHTML = icon + (isMobileView() ? '' : text);
    splitTextButton.setAttribute('aria-label', isSplit ? 'Объединить колонки' : 'Разделить текст');
}

/** Обновление кнопки метронома */
export function updateMetronomeButton(isActive) {
    const playIcon = '<i class="fas fa-play"></i>';
    const stopIcon = '<i class="fas fa-stop"></i>';
    const text = '<span class="button-text">Метроном</span>';

    metronomeButton.innerHTML = (isActive ? stopIcon : playIcon) + (isMobileView() ? '' : text);
    metronomeButton.setAttribute('aria-label', isActive ? 'Выключить метроном' : 'Включить метроном');
    metronomeButton.classList.toggle('active', isActive);
}

// --- SONG/SHEET SELECTS ---

/** Заполняет выпадающий список категорий (листов) */
export function populateSheetSelect() {
    sheetSelect.innerHTML = '<option value="">-- Категория --</option>';
    SONG_CATEGORIES_ORDER.forEach(categoryName => {
        if (state.songsBySheet[categoryName] && state.songsBySheet[categoryName].length > 0) {
            const option = document.createElement('option');
            option.value = categoryName;
            option.textContent = categoryName;
            sheetSelect.appendChild(option);
        }
    });
    Object.keys(state.songsBySheet).forEach(categoryName => {
        if (!SONG_CATEGORIES_ORDER.includes(categoryName)) {
            const option = document.createElement('option');
            option.value = categoryName;
            option.textContent = categoryName;
            sheetSelect.appendChild(option);
        }
    });
}

/** Загрузка песен в select#song-select для выбранной категории или всех песен */
export function populateSongSelect() {
    const sheetName = sheetSelect.value;
    songSelect.innerHTML = '<option value="">-- Песня --</option>';

    if (sheetName) {
        // Показываем песни выбранной категории
        const songs = state.songsBySheet[sheetName];
        if (songs && songs.length > 0) {
            songs.forEach(song => {
                const option = document.createElement('option');
                option.value = song.id;
                option.textContent = song.name;
                songSelect.appendChild(option);
            });
            songSelect.disabled = false;
        } else {
            songSelect.innerHTML = '<option value="">-- Нет песен в категории --</option>';
            songSelect.disabled = true;
        }
    } else {
        // Показываем все песни в алфавитном порядке
        const allSongs = state.allSongs || [];
        if (allSongs.length > 0) {
            // Сортируем все песни по алфавиту
            const sortedSongs = [...allSongs].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            sortedSongs.forEach(song => {
                const option = document.createElement('option');
                option.value = song.id;
                // Показываем название песни и категорию для удобства
                option.textContent = `${song.name}${song.sheet ? ` (${song.sheet})` : ''}`;
                songSelect.appendChild(option);
            });
            songSelect.disabled = false;
        } else {
            songSelect.innerHTML = '<option value="">-- Песни не загружены --</option>';
            songSelect.disabled = true;
        }
    }
    displaySongDetails(null);
}

// --- SEARCH ---

/** Отображение результатов поиска */
export function displaySearchResults(matchingSongs, onSelect) {
    searchResults.innerHTML = '';
    if (matchingSongs.length === 0) {
        searchResults.innerHTML = '<div class="search-result">Ничего не найдено</div>';
        return;
    }
    matchingSongs.forEach((songMatch) => {
        const resultItem = document.createElement('div');
        resultItem.textContent = `${songMatch.name} (${songMatch.sheet || 'Без категории'})`;
        resultItem.className = 'search-result';
        resultItem.addEventListener('click', () => onSelect(songMatch));
        searchResults.appendChild(resultItem);
    });
}

// --- REPERTOIRE PANEL ---

/** Загрузка списка вокалистов в dropdown */
export function populateVocalistSelect(vocalists) {
    vocalistSelect.innerHTML = '<option value="">-- Выберите вокалиста --</option>';
    if (vocalists.length === 0) {
        console.warn("В коллекции 'vocalists' не найдено ни одного документа.");
    } else {
        vocalists.forEach((vocalist) => {
            const option = document.createElement('option');
            option.value = vocalist.id;
            option.textContent = vocalist.name || vocalist.id;
            vocalistSelect.appendChild(option);
        });
    }
}

function createRepertoireSongElement(song, vocalistId, onClick) {
    const listItem = document.createElement('div');
    listItem.className = 'repertoire-item';
    const songName = song.name || song.id; 
    const shortSheetName = song.sheet || '';
    
    const songInfo = document.createElement('span');
    songInfo.className = 'song-name';
    songInfo.textContent = `${songName} (${song.preferredKey || 'N/A'}${shortSheetName ? ', ' + shortSheetName : ''})`;
    listItem.appendChild(songInfo);

    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.className = 'remove-button';
    removeBtn.title = 'Удалить из репертуара';
    removeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Удалить песню "${songName}" из репертуара?`)) {
            await api.removeFromRepertoire(vocalistId, song.repertoireDocId);
        }
    });
    listItem.appendChild(removeBtn);

    listItem.addEventListener('click', () => onClick(song));

    return listItem;
}

function renderRepertoireView(songs, vocalistId, mode, container, onSongSelect) {
    container.innerHTML = '';
    if (songs.length === 0) {
        container.innerHTML = '<div class="empty-message">Репертуар пуст.</div>';
        return;
    }

    const createGroup = (title, songList) => {
        const heading = document.createElement('div');
        heading.className = 'repertoire-key-heading';
        heading.innerHTML = `${title} <i class="fas fa-chevron-down"></i>`;
        container.appendChild(heading);

        const songsWrapper = document.createElement('div');
        songsWrapper.className = 'repertoire-songs-for-key collapsed';
        songList.sort((a,b) => (a.name || '').localeCompare(b.name || ''));
        songList.forEach(song => {
            const songElement = createRepertoireSongElement(song, vocalistId, onSongSelect);
            songsWrapper.appendChild(songElement);
        });
        container.appendChild(songsWrapper);

        heading.addEventListener('click', () => {
            const isCollapsed = songsWrapper.classList.contains('collapsed');
            document.querySelectorAll('.repertoire-songs-for-key').forEach(el => el.classList.add('collapsed'));
            document.querySelectorAll('.repertoire-key-heading i').forEach(i => i.className = 'fas fa-chevron-down');
            if(isCollapsed) {
                songsWrapper.classList.remove('collapsed');
                heading.querySelector('i').className = 'fas fa-chevron-up';
            }
        });
    };

    if (mode === 'byKey') {
        const grouped = songs.reduce((acc, song) => {
            const key = song.preferredKey || "N/A";
            if (!acc[key]) acc[key] = [];
            acc[key].push(song);
            return acc;
        }, {});
        Object.keys(grouped).sort((a,b) => (chords.indexOf(a) - chords.indexOf(b))).forEach(key => createGroup(`Тональность: ${key}`, grouped[key]));
    } else if (mode === 'bySheet') {
        const grouped = songs.reduce((acc, song) => {
            const sheet = song.sheet || "N/A";
            if (!acc[sheet]) acc[sheet] = [];
            acc[sheet].push(song);
            return acc;
        }, {});
        Object.keys(grouped).sort().forEach(sheet => createGroup(sheet, grouped[sheet]));
    } else { // allAlphabetical
        songs.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(song => {
            const songElement = createRepertoireSongElement(song, vocalistId, onSongSelect);
            container.appendChild(songElement);
        });
    }
}

export function renderRepertoire(onSongSelect) {
    const vocalistId = state.currentVocalistId;
    if (!vocalistId) {
        repertoirePanelList.innerHTML = '<div class="empty-message">Выберите вокалиста.</div>';
        return;
    }
    
    const songsData = state.currentRepertoireSongsData;
    const fullSongsData = songsData.map(repertoireSong => {
        const songDetails = state.allSongs.find(s => s.name === repertoireSong.name) || {};
        return { ...songDetails, ...repertoireSong };
    }).filter(s => s.id); // Убираем песни, которых нет в allSongs

    renderRepertoireView(fullSongsData, vocalistId, state.currentRepertoireViewMode, repertoirePanelList, onSongSelect);
}


// --- PRESENTATION VIEW ---
let controlsHideTimeout;

export function showPresentationView(onSongChange) {
    const songsToShow = state.currentSetlistSongs;
    if (!songsToShow || songsToShow.length === 0) {
         alert("Нет песен для показа в презентации.");
         return;
    }
    state.setPresentationSongs([...songsToShow]);
    state.setCurrentPresentationIndex(0);
    state.setIsPresentationSplit(false);
    updatePresentationSplitButtonState();
    
    onSongChange(); // Display first song

    presentationOverlay.classList.add('visible');
    presentationOverlay.scrollTop = 0;
    showPresentationControls();
}

export function displayCurrentPresentationSong() {
    if (state.presentationSongs.length === 0) return;

    state.setCurrentPresentationIndex(Math.max(0, Math.min(state.currentPresentationIndex, state.presentationSongs.length - 1)));
    const songRef = state.presentationSongs[state.currentPresentationIndex];
    presentationContent.innerHTML = `<div class="presentation-loading">Загрузка...</div>`;

    const song = state.allSongs.find(s => s.id === songRef.songId);
    if (!song) {
        presentationContent.innerHTML = `<div class="presentation-song error"><h2>Ошибка загрузки песни</h2><p>Не найдены данные для песни.</p></div>`;
        return;
    }

    const songTitle = song.name;
    const originalLyrics = song['Текст и аккорды'] || '';
    const originalKey = song['Оригинальная тональность'] || "C";
    const targetKey = songRef.preferredKey || originalKey;
    const songNote = songRef.notes || '';

    const finalHighlightedLyrics = getRenderedSongText(originalLyrics, originalKey, targetKey);

    const songHtml = `
        <div class="presentation-song">
            <h2>${songTitle} — ${targetKey}</h2>
            ${songNote ? `<div class="presentation-notes"><i class="fas fa-info-circle"></i> ${songNote.replace(/\n/g, '<br>')}</div>` : ''}
            <pre>${finalHighlightedLyrics}</pre> 
        </div>
    `;
    presentationContent.innerHTML = songHtml;
    presentationContent.classList.toggle('split-columns', state.isPresentationSplit);

    presCounter.textContent = `${state.currentPresentationIndex + 1} / ${state.presentationSongs.length}`;
    presPrevBtn.disabled = (state.currentPresentationIndex === 0);
    presNextBtn.disabled = (state.currentPresentationIndex >= state.presentationSongs.length - 1);
}

export function showPresentationControls() {
    presentationControls.classList.remove('controls-hidden');
    clearTimeout(controlsHideTimeout);
    controlsHideTimeout = setTimeout(hidePresentationControls, 3000); // CONTROLS_HIDE_DELAY
}

export function hidePresentationControls() {
    presentationControls.classList.add('controls-hidden');
}

export function updatePresentationSplitButtonState() {
    const iconElement = presSplitTextBtn.querySelector('i');
    if (state.isPresentationSplit) {
        iconElement.className = 'fas fa-align-justify';
        presSplitTextBtn.title = 'Объединить колонки';
    } else {
        iconElement.className = 'fas fa-columns';
        presSplitTextBtn.title = 'Разделить текст';
    }
}


// --- FAVORITES PANEL ---
export function renderFavorites(onSelect, onRemove) {
    favoritesList.innerHTML = '';
    const favorites = state.favorites;

    if (favorites.length === 0) {
        favoritesList.innerHTML = '<div class="empty-message">В "Моем списке" пока нет песен.</div>';
        return;
    }
    
    favorites.sort((a,b) => (a.name || '').localeCompare(b.name || ''));
    favorites.forEach(favSong => {
        const listItem = document.createElement('div');
        listItem.className = 'favorite-item';
        
        const songInfo = document.createElement('span');
        songInfo.textContent = `${favSong.name} (${favSong.preferredKey})`;
        listItem.appendChild(songInfo);

        listItem.addEventListener('click', () => onSelect(favSong));

        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.className = 'remove-button';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onRemove(favSong.id);
        });
        listItem.appendChild(removeBtn);
        
        favoritesList.appendChild(listItem);
    });
}


// --- SETLIST PANEL ---

function renderCurrentSetlistSongs(songs, onSongSelect, onSongRemove) {
    if (!currentSetlistSongsContainer) return;
    currentSetlistSongsContainer.innerHTML = '';

    if (!songs || songs.length === 0) {
        currentSetlistSongsContainer.innerHTML = '<div class="empty-message">В этом сет-листе пока нет песен.</div>';
        return;
    }

    const fullSongsData = songs
        .map(setlistSong => {
            const songDetails = state.allSongs.find(s => s.id === setlistSong.songId) || {};
            return { ...songDetails, ...setlistSong };
        })
        .filter(s => s.id)
        .sort((a,b) => a.order - b.order);


    fullSongsData.forEach(song => {
        const songItem = document.createElement('div');
        songItem.className = 'setlist-song-item';
        
        const songNameSpan = document.createElement('span');
        songNameSpan.textContent = `${song.name} (${song.preferredKey})`;
        songNameSpan.addEventListener('click', () => onSongSelect(song));
        songItem.appendChild(songNameSpan);

        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.className = 'remove-button';
        removeBtn.title = 'Удалить из сет-листа';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onSongRemove(song.id, song.name);
        });
        songItem.appendChild(removeBtn);

        currentSetlistSongsContainer.appendChild(songItem);
    });
}

export function clearSetlistSelection() {
    if (currentSetlistTitle) currentSetlistTitle.textContent = 'Выберите сет-лист';
    if (currentSetlistSongsContainer) currentSetlistSongsContainer.innerHTML = '<div class="empty-message">Сначала выберите или создайте сет-лист.</div>';
    if (currentSetlistControls) currentSetlistControls.style.display = 'none';
    if (setlistsListContainer) {
        const items = setlistsListContainer.querySelectorAll('.setlist-item');
        items.forEach(item => item.classList.remove('selected'));
    }
}


export function displaySelectedSetlist(setlist, onSongSelect, onSongRemove) {
    if (!setlist || !setlist.id) {
        clearSetlistSelection();
        return;
    }

    if (currentSetlistTitle) currentSetlistTitle.textContent = setlist.name;
    if (currentSetlistControls) currentSetlistControls.style.display = 'flex';

    if (setlistsListContainer) {
        const items = setlistsListContainer.querySelectorAll('.setlist-item');
        items.forEach(item => {
            item.classList.toggle('selected', item.dataset.setlistId === setlist.id);
        });
    }

    renderCurrentSetlistSongs(setlist.songs || [], onSongSelect, onSongRemove);
}


/**
 * Отрисовывает список сетлистов.
 * @param {Array} setlists - Массив объектов сетлистов.
 * @param {function} onSelect - Функция обратного вызова при выборе сетлиста.
 * @param {function} onDelete - Функция обратного вызова при удалении сетлиста.
 */
export function renderSetlists(setlists, onSelect, onDelete) {
    if (!setlistsListContainer) return;
    setlistsListContainer.innerHTML = '';

    if (!setlists || setlists.length === 0) {
        setlistsListContainer.innerHTML = '<div class="empty-message">Сет-листов пока нет. Создайте новый!</div>';
        return;
    }

    setlists.forEach(setlist => {
        const item = document.createElement('div');
        item.className = 'setlist-item';
        item.dataset.setlistId = setlist.id;
        item.addEventListener('click', () => onSelect(setlist));

        const nameSpan = document.createElement('span');
        nameSpan.textContent = setlist.name;
        item.appendChild(nameSpan);

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.className = 'remove-button';
        deleteBtn.title = 'Удалить сет-лист';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onDelete(setlist.id, setlist.name);
        });
        item.appendChild(deleteBtn);

        setlistsListContainer.appendChild(item);
    });
} 