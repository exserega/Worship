function updateThemeToggleIcon() {
  const slider = document.querySelector('.theme-toggle-slider');
  if (!slider) return;
  slider.innerHTML = '';
  const icon = document.createElement('i');
  if (document.body.getAttribute('data-theme') === 'light') {
    icon.className = 'fas fa-sun';
  } else {
    icon.className = 'fas fa-moon';
  }
  slider.appendChild(icon);
}

document.addEventListener('DOMContentLoaded', updateThemeToggleIcon);

const themeToggleButton = document.getElementById('theme-toggle-button');
if (themeToggleButton) {
  themeToggleButton.addEventListener('click', function() {
    const current = document.body.getAttribute('data-theme');
    document.body.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
    updateThemeToggleIcon();
  });
} 