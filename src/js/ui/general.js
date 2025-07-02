// Agape Worship App - general.js

import { 
    setlistsPanel, 
    myListPanel, 
    repertoirePanel, 
    toggleFavoritesButton, 
    toggleMyListButton, 
    toggleRepertoireButton,
    themeToggleButton,
    songContent,
    toggleChordsButton,
    chordsOnlyButton,
    splitTextButton,
    metronomeButton,
    bpmDisplay,
    songSelect
} from './domReferences.js';
import * as state from '../../state.js';
import { isMobileView } from '../../core.js';

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
    // Всегда используем музыкальную ноту
    const icon = '<i class="fas fa-guitar"></i>';
    const textShow = '<span class="button-text">Аккорды</span>';
    
    const currentTitle = state.areChordsVisible ? 'Скрыть аккорды' : 'Показать аккорды';

    toggleChordsButton.innerHTML = icon + (isMobileView() ? '' : textShow);
    toggleChordsButton.title = currentTitle;
    toggleChordsButton.disabled = !songSelect || !songSelect.value;
    
    // Меняем цвет кнопки в зависимости от состояния
    toggleChordsButton.classList.toggle('chords-hidden-active', !state.areChordsVisible);
}

/** Обновление кнопки "только аккорды" */
export function updateChordsOnlyButton() {
    // Используем букву T
    const icon = '<span class="text-icon">T</span>';
    const textShow = state.isChordsOnlyMode ? 
        '<span class="button-text">Полный текст</span>' : 
        '<span class="button-text">Только аккорды</span>';
    
    const currentTitle = state.isChordsOnlyMode ? 'Показать полный текст' : 'Показать только аккорды';

    chordsOnlyButton.innerHTML = icon + (isMobileView() ? '' : textShow);
    chordsOnlyButton.title = currentTitle;
    chordsOnlyButton.disabled = !songSelect || !songSelect.value;
    
    // Меняем цвет кнопки в зависимости от состояния
    chordsOnlyButton.classList.toggle('chords-only-active', state.isChordsOnlyMode);
}

/** Обновление кнопки разделения текста */
export function updateSplitButton() {
    const isSplit = songContent.classList.contains('split-columns');
    // Поменяли логику: теперь по умолчанию двухколоночный режим
    const icon = isSplit ? '<i class="fas fa-columns"></i>' : '<i class="fas fa-align-justify"></i>';
    const text = isSplit ? '<span class="button-text">2 колонки</span>' : '<span class="button-text">1 колонка</span>';
    splitTextButton.innerHTML = icon + (isMobileView() ? '' : text);
    splitTextButton.setAttribute('aria-label', isSplit ? 'Режим: 2 колонки' : 'Режим: 1 колонка');
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