import { chromium } from "@playwright/test";

// Captura screenshot de uma rota em modo demo.
// Uso: node scripts/capture-page.mjs <papel> <rota> <saida.png>
// Ex.: node scripts/capture-page.mjs coordenacao /agenda /tmp/agenda.png
const papel = process.argv[2] ?? "mentorado";
const rota = process.argv[3] ?? "/";
const out = process.argv[4] ?? "/tmp/shot.png";
const base = process.env.CAPTURE_BASE ?? "http://127.0.0.1:3100";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(`${base}/demo`);
await ctx.addCookies([
  { name: "demo_role", value: papel, url: base },
  { name: `demo_onboarded_${papel}`, value: "1", url: base },
]);
await page.goto(base + rota, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage: true });
console.log("saved", out);
await browser.close();
