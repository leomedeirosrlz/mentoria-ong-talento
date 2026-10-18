// Captura screenshots dos mockups standalone em docs/mockups/<tela>/v*.html
// Uso: node scripts/mockup-shots.mjs
// Gera v<N>-desktop.png (1280) e v<N>-mobile.png (390) ao lado de cada HTML.
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = new URL('../docs/mockups', import.meta.url).pathname;
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch();
try {
  for (const dir of await readdir(ROOT, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const dirPath = join(ROOT, dir.name);
    const files = (await readdir(dirPath)).filter((f) => /^v\d+\.html$/.test(f));
    for (const file of files) {
      const base = file.replace('.html', '');
      const url = `file://${join(dirPath, file)}`;
      for (const vp of VIEWPORTS) {
        const page = await browser.newPage({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: vp.name === 'mobile' ? 2 : 1,
        });
        try {
          await page.goto(url);
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(300);
          await page.screenshot({
            path: join(dirPath, `${base}-${vp.name}.png`),
            fullPage: true,
          });
          console.log(`✓ ${dir.name}/${base}-${vp.name}.png`);
        } finally {
          await page.close();
        }
      }
    }
  }
} finally {
  await browser.close();
}
