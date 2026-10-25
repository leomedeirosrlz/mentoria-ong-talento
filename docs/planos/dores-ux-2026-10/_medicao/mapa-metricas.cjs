// Mapeamento read-only: screenshots + métricas de DOM por papel e viewport.
// Não clica em nada que grave dados; só navega e lê.
const { createRequire } = require("module");
const fs = require("fs");
const OUT = process.env.OUT || "/tmp/realiza-mapa"; // uso: OUT=<pasta> node mapa-metricas.cjs (app em :3100)
const req = createRequire(require("path").resolve(__dirname, "../../../../package.json"));
const { chromium } = req("@playwright/test");
fs.mkdirSync(OUT, { recursive: true });

const BASE = "http://localhost:3100";
const VIEWPORTS = {
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true },
  desktop: { width: 1280, height: 800 },
};
const ROTAS = {
  coordenacao: ["/", "/agenda", "/duplas", "/registros", "/materiais", "/pessoas", "/formularios", "/chamados", "/turmas", "/relatorios", "/perfil"],
  supervisor: ["/", "/agenda", "/duplas", "/registros", "/materiais", "/pessoas", "/chamados"],
  mentor_dpp: ["/", "/agenda", "/duplas", "/materiais", "/chamados"],
  mentor_especialista: ["/", "/agenda", "/duplas", "/materiais"],
  mentorado: ["/jovem", "/jovem/agenda", "/jovem/especialistas", "/jovem/pessoas", "/jovem/materiais", "/jovem/perfil"],
  publico: ["/login", "/demo", "/privacidade"],
};

// Lê o DOM da página atual e devolve métricas objetivas.
function medir() {
  const visivel = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };
  const textoDe = (el) => (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 60);

  const pequenos = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!visivel(el)) continue;
    const tem = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!tem) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 12) pequenos.push({ fs, t: textoDe(el) });
  }

  const alvos = [];
  for (const el of document.querySelectorAll("a, button, input, select, textarea, [role=button]")) {
    if (!visivel(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) alvos.push({ w: Math.round(r.width), h: Math.round(r.height), t: textoDe(el) || el.tagName });
  }

  return {
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    textoAbaixo12px: pequenos.length,
    exemplosPequenos: pequenos.slice(0, 3),
    alvosAbaixo44: alvos.length,
    exemplosAlvos: alvos.slice(0, 4),
    h1: (document.querySelector("h1")?.innerText || "").trim().slice(0, 80),
    titulo: document.title,
  };
}

(async () => {
  const browser = await chromium.launch();
  const resultados = [];
  for (const [papel, rotas] of Object.entries(ROTAS)) {
    for (const [vp, cfg] of Object.entries(VIEWPORTS)) {
      const { width, height, ...resto } = cfg;
      const ctx = await browser.newContext({ viewport: { width, height }, ...resto, deviceScaleFactor: 1 });
      if (papel !== "publico") {
        await ctx.addCookies([
          { name: "demo_role", value: papel, url: BASE },
          { name: `demo_onboarded_${papel}`, value: "1", url: BASE },
        ]);
      }
      const page = await ctx.newPage();
      for (const rota of rotas) {
        const nome = `${papel}_${vp}_${rota === "/" ? "home" : rota.slice(1).replace(/\//g, "-")}`;
        try {
          const resp = await page.goto(`${BASE}${rota}`, { waitUntil: "networkidle", timeout: 60000 });
          await page.screenshot({ path: `${OUT}/${nome}.png`, fullPage: true });
          const m = await page.evaluate(medir);
          resultados.push({ papel, vp, rota, status: resp?.status(), url: page.url().replace(BASE, ""), ...m });
        } catch (e) {
          resultados.push({ papel, vp, rota, erro: String(e).slice(0, 160) });
        }
      }
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync(`${OUT}/metricas.json`, JSON.stringify(resultados, null, 2));
  console.log(`ok: ${resultados.length} páginas -> ${OUT}/metricas.json`);
})().catch((e) => {
  console.error("FALHOU:", e);
  process.exit(1);
});
