import * as state from '../../state/index.js';
import { 
    favoritesList, 
    currentSetlistSongsContainer, 
    currentSetlistTitle, 
    currentSetlistControls, 
    setlistsListContainer 
} from '../dom.js';

/** Отрисовывает список избранных песен */
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

/** Очищает выбор сет-листа */
export function clearSetlistSelection() {
    if (currentSetlistTitle) currentSetlistTitle.textContent = 'Выберите сет-лист';
    if (currentSetlistSongsContainer) currentSetlistSongsContainer.innerHTML = '<div class="empty-message">Сначала выберите или создайте сет-лист.</div>';
    if (currentSetlistControls) currentSetlistControls.style.display = 'none';
    if (setlistsListContainer) {
        const items = setlistsListContainer.querySelectorAll('.setlist-item');
        items.forEach(item => item.classList.remove('selected'));
    }
}

/** Отображает выбранный сет-лист */
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