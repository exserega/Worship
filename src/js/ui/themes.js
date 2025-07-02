// Agape Worship App - ui/themes.js
// Управление темами

import { themeToggleButton } from './dom.js';

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

/** Получает текущую тему из localStorage */
export function getCurrentTheme() {
    try {
        return localStorage.getItem('theme') || 'dark';
    } catch (e) {
        console.error("Ошибка получения темы из localStorage:", e);
        return 'dark';
    }
}

/** Инициализирует тему при загрузке страницы */
export function initializeTheme() {
    const savedTheme = getCurrentTheme();
    applyTheme(savedTheme);
} 