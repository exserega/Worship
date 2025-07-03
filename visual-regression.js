const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const url = 'http://localhost:3000'; // Измени на свой порт, если другой
  const outDir = path.join(__dirname, 'directory_contains_actual_images');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 1500)); // Ждём полной отрисовки

  await page.screenshot({ path: path.join(outDir, 'main.png'), fullPage: true });
  await browser.close();
  console.log('Скриншот сохранён: directory_contains_actual_images/main.png');
})(); 