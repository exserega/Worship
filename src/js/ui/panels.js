// Agape Worship App - ui/panels.js
// Управление боковыми панелями

import { 
    setlistsPanel, 
    myListPanel, 
    repertoirePanel, 
    toggleFavoritesButton, 
    toggleMyListButton, 
    toggleRepertoireButton 
} from './dom.js';

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