import { chromium } from "@playwright/test";
import sharp from "sharp";

// Prints do passo "O que você pode fazer aqui" do onboarding (public/onboarding).
// Um print por item de RECURSOS (onboarding-flow.tsx), desktop e mobile.
// Roda contra um build de PRODUÇÃO em modo demo — `pnpm dev` deixa o
// indicador do Next no canto e a captura sai com a bolinha "N".
//
//   pnpm build && pnpm start -p 3100
//   node scripts/capturar-onboarding.mjs [papel...]
//
// Desktop: só a coluna de conteúdo (sem sidebar) numa janela de 1100×720 @2x —
// no painel do onboarding o print aparece perto de 90% do tamanho real; a
// tela inteira com sidebar, reduzida a 60%, ficava ilegível. Mobile: a tela do celular (não a página inteira — o fullPage
// congelava a bottom nav no meio da imagem), recortada no topo em 3:4.
// Elementos flutuantes (pill da demo, bolha da Liza, toasts) e o rodapé do
// site saem da foto. Saída em WebP (PNG sem perda → sharp).

const base = process.env.CAPTURE_BASE ?? "http://127.0.0.1:3100";
const OUT = new URL("../public/onboarding/", import.meta.url).pathname;

const dupla = (n) => `/duplas/de000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const D_OK = 0x0601; // Ricardo × Ana — encontro 5 da semana
const D_RISCO = 0x0603; // pedido de apoio aberto
const D_ESP3 = 0x0608; // Sofia × Eduardo — trilha de especialista em curso

/** papel → shots. `arquivo` é o nome usado em RECURSOS, com sufixo -m na
 *  variante mobile. `foco` (seletor CSS) ou `texto` rolam a página até o
 *  ponto que ilustra o item — no celular o recorte de 3:4 só pega o topo;
 *  <details> no caminho abre (mural e avisos moram recolhidos na home). */
const SHOTS = {
  coordenacao: [
    { arquivo: "coordenacao-home", rota: "/" },
    { arquivo: "coordenacao-dupla", rota: dupla(D_RISCO) },
    { arquivo: "coordenacao-duplas", rota: "/duplas" },
    { arquivo: "coordenacao-pessoas", rota: "/pessoas" },
    { arquivo: "coordenacao-comunicados", rota: "/", foco: "#avisos" },
    { arquivo: "coordenacao-relatorios", rota: "/relatorios" },
  ],
  supervisor: [
    { arquivo: "supervisor-duplas", rota: "/duplas" },
    { arquivo: "supervisor-dupla", rota: dupla(D_OK) },
    { arquivo: "supervisor-home", rota: "/" },
    { arquivo: "supervisor-materiais", rota: "/materiais" },
  ],
  mentor_dpp: [
    { arquivo: "mentor_dpp-dupla", rota: dupla(D_OK) },
    { arquivo: "mentor_dpp-duplas", rota: "/duplas" },
    { arquivo: "mentor_dpp-home", rota: "/" },
    { arquivo: "mentor_dpp-apoio", rota: "/chamados" },
    { arquivo: "mentor_dpp-especialista", rota: "/agenda?aba=por-mentorado", texto: "Especialista solicitado" },
    { arquivo: "mentor_dpp-materiais", rota: "/materiais" },
  ],
  mentor_especialista: [
    { arquivo: "mentor_especialista-home", rota: "/", foco: "#mural-especialista" },
    { arquivo: "mentor_especialista-trilha", rota: dupla(D_ESP3) },
    { arquivo: "mentor_especialista-registro", rota: `${dupla(D_ESP3)}?aba=encontros`, foco: '[role="tabpanel"]' },
    { arquivo: "mentor_especialista-materiais", rota: "/materiais" },
  ],
};

const VIEWS = {
  desktop: {
    ctx: { viewport: { width: 1100, height: 720 }, deviceScaleFactor: 2 },
    sufixo: "",
  },
  mobile: {
    ctx: {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
    sufixo: "-m",
  },
};

async function limpar(page) {
  await page.addStyleTag({
    content: "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }",
  });
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("body *")) {
      if (getComputedStyle(el).position !== "fixed") continue;
      // cabeçalho e navegação são a tela; o resto flutua por cima dela
      if (el.closest("header, nav, aside") || el.querySelector("nav")) continue;
      el.style.setProperty("display", "none", "important");
    }
    document.querySelector("[data-sonner-toaster]")?.remove();
    // rodapé do site: em página curta ele subia pro meio do print
    for (const f of document.querySelectorAll("footer")) f.style.setProperty("display", "none", "important");
    // no mobile a pill da demo mora dentro do header
    for (const b of document.querySelectorAll("header button")) {
      if (b.textContent?.trim().startsWith("Demo")) b.style.setProperty("visibility", "hidden", "important");
    }
  });
}

const papeis = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS);
const browser = await chromium.launch();
for (const [view, { ctx: opts, sufixo }] of Object.entries(VIEWS)) {
  for (const papel of papeis) {
    const ctx = await browser.newContext(opts);
    await ctx.addCookies([
      { name: "demo_role", value: papel, url: base },
      { name: `demo_onboarded_${papel}`, value: "1", url: base },
    ]);
    const page = await ctx.newPage();
    for (const { arquivo, rota, foco, texto } of SHOTS[papel]) {
      await page.goto(base + rota, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);
      await limpar(page);
      if (foco || texto) {
        await page.evaluate(({ foco, texto }) => {
          const el = foco
            ? document.querySelector(foco)
            : [...document.querySelectorAll("#conteudo *")].find(
                (n) => n.children.length === 0 && n.textContent?.includes(texto)
              )?.closest("section, article, li, div");
          if (!el) throw new Error(`${foco ?? texto} não achado`);
          for (let d = el; d; d = d.parentElement?.closest("details")) {
            if (d instanceof HTMLDetailsElement) d.open = true;
          }
          // o header fixo do mobile cobriria o topo do alvo
          const header = document.querySelector("header");
          const fixo = header && ["fixed", "sticky"].includes(getComputedStyle(header).position);
          const topo = el.getBoundingClientRect().top + window.scrollY;
          window.scrollTo(0, topo - (fixo ? header.getBoundingClientRect().height : 0) - 12);
        }, { foco, texto });
        await page.waitForTimeout(400);
      }
      let clip = { x: 0, y: 0, width: 390, height: 520 };
      if (view === "desktop") {
        const box = await page.locator("#conteudo").boundingBox();
        if (!box) throw new Error(`${rota}: #conteudo não achado`);
        clip = { x: box.x, y: 0, width: Math.min(box.width, 1100 - box.x), height: 720 };
      }
      const png = await page.screenshot({ type: "png", clip });
      const path = `${OUT}${arquivo}${sufixo}.webp`;
      await sharp(png).webp({ quality: 80 }).toFile(path);
      console.log(view, papel, rota, "→", path.replace(OUT, ""));
    }
    await ctx.close();
  }
}
await browser.close();
