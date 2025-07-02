import * as state from '../../state/index.js';
import * as api from '../../api/index.js';
import { vocalistSelect, repertoirePanelList } from '../dom.js';
import { chords } from '../../utils/constants.js';

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