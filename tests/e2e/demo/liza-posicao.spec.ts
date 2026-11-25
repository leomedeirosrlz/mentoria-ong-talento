import type { Page } from "@playwright/test";
import { agirComConfirma, entrarNaDemo, expect, test } from "../helpers";

// REALIZA-505 — a Liza fora da zona de ação a 390px: no celular o FAB
// flutua colado logo ACIMA da bottom-nav (530 tirou o encaixe de dentro
// da faixa e devolveu o padding dela) e o balão de fala não abre sozinho
// (a apresentação/dica viram o ponto de atenção no FAB; o "Respondi" vira
// ponto + status sr-only). Antes, o FAB flutuava sobre a banda de
// conteúdo e o balão cobria CTA, aba, aviso e rodapé sticky.
// Público, sem writes.

const FAB = '[aria-controls="painel-assistente"]';
// d-T2c (Ricardo × Matheus): a ficha tem a tablist do print e o CTA de
// registrar — mesma fixture do registro-rota
const DUPLA_T2C = "de000000-0000-4000-8000-000000001549";

/** Retângulo do FAB × alvos que NÃO podem sair debaixo dele rolando:
 *  itens das navs, rodapés e qualquer elemento dentro de um ancestral
 *  fixed/sticky (rodapé do wizard, barra de ação, header colado). O
 *  esperado é sempre [] — conteúdo de main que rola com o documento
 *  passa por baixo do disco e sempre pode ser trazido de volta ao
 *  scroll, como qualquer FAB flutuante; o que não rola é o que ele não
 *  pode cobrir em nenhum momento. */
function colisoesDoFab(page: Page) {
  return page.evaluate((sel) => {
    const fab = document.querySelector(sel);
    if (!fab) return ["<sem FAB na página>"];
    const f = fab.getBoundingClientRect();
    const toca = (r: DOMRect) =>
      r.left < f.right &&
      r.right > f.left &&
      r.top < f.bottom &&
      r.bottom > f.top;
    const alvos = document.querySelectorAll<HTMLElement>(
      [
        "main a[href], main button, main input, main select, main textarea, main summary",
        'main [role="tab"], main [role="tablist"], main [role="status"], main [role="alert"]',
        "nav a[href], nav button",
        "footer a[href], footer button",
      ].join(",")
    );
    // não escapa rolando: o próprio elemento ou um ancestral é
    // fixed/sticky (a bottom-nav, o rodapé do wizard, barras de ação)
    const preso = (el: HTMLElement) => {
      for (let n: HTMLElement | null = el; n; n = n.parentElement) {
        const p = getComputedStyle(n).position;
        if (p === "fixed" || p === "sticky") return true;
      }
      return false;
    };
    // O FAB flutua logo acima da bottom-nav: alvo que já nasce abaixo do
    // topo da nav está coberto pela nav (e só aparece ao rolar), não pelo
    // FAB — o filtro pelo navTop segue valendo com o dock flutuante.
    // `.fixed.bottom-0` distingue a bottom-nav da sidebar desktop, que
    // divide o mesmo aria-label e mora antes no DOM.
    const nav = document.querySelector<HTMLElement>(
      'nav[aria-label="Navegação principal"].fixed.bottom-0'
    );
    const navTop = nav?.getBoundingClientRect().top ?? Infinity;
    return [...alvos]
      .filter((el) => !fab.contains(el) && !el.contains(fab))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(
        ({ el, r }) =>
          r.width > 0 &&
          r.height > 0 &&
          r.top < navTop &&
          toca(r) &&
          preso(el)
      )
      .map(({ el }) =>
        (el.getAttribute("aria-label") ?? el.textContent ?? el.tagName)
          .trim()
          .slice(0, 60)
      );
  }, FAB);
}

/** o balão inteiro some da árvore no mobile — o "Dispensar" é o único
 *  controle que ele sempre renderiza (apresentação, dica ou pronto) */
function semBalao(page: Page) {
  return expect(
    page.getByRole("button", { name: "Dispensar mensagem da Liza" })
  ).toHaveCount(0);
}

test.describe("liza — fora da zona de ação (390px)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("agenda do jovem: sem balão auto e o FAB não cobre nada", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/agenda");
    const fab = page.locator(FAB);
    await expect(fab).toBeVisible();

    // primeira visita na sessão: onde a apresentação abriria sozinha —
    // no mobile ela vira o ponto no FAB, nunca um balão sobre a página
    await page.waitForTimeout(2300); // > FALA_ATRASO_MS (1,8s)
    await semBalao(page);

    // o FAB flutua colado ACIMA da nav (530): a base dele não passa do
    // topo da nav — antes ele morava dentro da faixa dela
    const nav = page.locator(
      'nav[aria-label="Navegação principal"].fixed.bottom-0'
    );
    const [fabBox, navBox] = await Promise.all([
      fab.boundingBox(),
      nav.boundingBox(),
    ]);
    expect(fabBox && navBox && fabBox.y + fabBox.height <= navBox.y + 2)
      .toBeTruthy();

    // o print do 505: o FAB não toca o "Não aconteceu" nem nada clicável
    expect(await colisoesDoFab(page)).toEqual([]);
    // idem no fim da página — o dock flutua preso à nav, não ao conteúdo
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    expect(await colisoesDoFab(page)).toEqual([]);

    // abre por toque e por teclado, fecha por Esc — painel por intenção
    await fab.click();
    const painel = page.locator("#painel-assistente");
    await expect(painel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(painel).toBeHidden();
    // o foco volta pro gatilho (contrato do dialog) e Enter reabre
    await expect(fab).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(painel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(painel).toBeHidden();
  });

  test("ficha da dupla: tablist livre; rota de registro: CTA livre", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/duplas/${DUPLA_T2C}?aba=encontros`);
    const fab = page.locator(FAB);
    await expect(fab).toBeVisible();

    await page.waitForTimeout(2300);
    await semBalao(page);
    // print "mentor-ficha-ok-mobile": balão sobre a tablist e a Jornada —
    // agora nem o FAB chega nelas
    await expect(page.getByRole("tablist")).toBeVisible();
    expect(await colisoesDoFab(page)).toEqual([]);

    // print "registrar-passo2-mobile": o rodapé sticky do wizard
    await page.getByRole("link", { name: "Registrar 2º encontro" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Registrar o 2º encontro" })
    ).toBeVisible();
    const form = page.getByTestId("registro-form");
    await form.getByText("Sim", { exact: true }).click();
    expect(await colisoesDoFab(page)).toEqual([]);
    await agirComConfirma(
      () => form.getByRole("button", { name: "Avançar" }).click(),
      () => form.getByRole("heading", { name: /Passo 2 de 3/ }).isVisible()
    );
    expect(await colisoesDoFab(page)).toEqual([]);
    // e o próprio Avançar ainda clica até o fim — sem elemento por cima
    await agirComConfirma(
      () => form.getByRole("button", { name: "Avançar" }).click(),
      () => form.getByRole("heading", { name: /Passo 3 de 3/ }).isVisible()
    );
  });
});

test("desktop: o balão continua abrindo sozinho como sempre", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await entrarNaDemo(page, "mentorado");
  await page.goto("/jovem");

  // a apresentação da 1ª visita abre ancorada no FAB, ~1,8s depois
  const dispensar = page.getByRole("button", {
    name: "Dispensar mensagem da Liza",
  });
  await expect(dispensar).toBeVisible({ timeout: 10_000 });
  await dispensar.click();
  await expect(dispensar).toHaveCount(0);
});
