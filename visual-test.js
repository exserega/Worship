const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const url = 'http://localhost:3000';
  const outDir = path.join(__dirname, 'visual-test-results');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 2000)); // Ждём полной отрисовки

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshotPath = path.join(outDir, `test-${timestamp}.png`);
  
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await browser.close();
  
  console.log('✅ Визуальный тест завершён!');
  console.log(`📸 Скриншот сохранён: ${screenshotPath}`);
  console.log('🔍 Откройте файл и сравните с оригинальным дизайном');
})(); 