import { entrarNaDemo, expect, test } from "../helpers";

// 016 (REALIZA-516) — "Suas conquistas" no perfil do jovem: nível por
// tempo de programa (régua das 4 faixas), estante earned-only com as
// ilustrações isométricas de public/badges e a área "Ainda por vir"
// separada, apagada e sem cadeado. Toda peça abre o detalhe.
//
// Fixture da persona mentorado (Bia, dupla DPP com o Ricardo): a dupla
// começou uma semana antes do 1º encontro e o 5º cai nesta semana — entre
// 34 e 40 dias de programa com 4 encontros realizados, em qualquer dia em
// que o spec rode. Isso a põe em Constância, com a Veterania pedindo mais
// 4 encontros e os dias que faltam pros 90. Instrumentos da janela
// aberta todos feitos; roda formal e 360º ainda vêm.

const FAIXAS = ["Início", "Constância", "Veterania", "Jornada completa"];

test.describe("demo — conquistas do jovem", () => {
  test.beforeEach(async ({ page }) => {
    await entrarNaDemo(page, "mentorado");
  });

  test("nível: Constância, régua das 4 faixas e o que falta em contagem", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    const card = page.locator("section#conquistas");
    await expect(
      card.getByRole("button", { name: /^Seu nível Constância Desde/ })
    ).toBeVisible();

    const regua = card.getByRole("list", { name: "Faixas de nível" });
    const faixas = regua.getByRole("listitem");
    await expect(faixas).toHaveCount(4);
    for (const [i, titulo] of FAIXAS.entries())
      await expect(faixas.nth(i)).toContainText(titulo);
    // estado sempre em texto, nunca só pela cor
    await expect(faixas.nth(0)).toContainText("Alcançada");
    await expect(faixas.nth(1)).toContainText("Seu nível");
    await expect(faixas.nth(2)).toContainText("Próxima");
    await expect(faixas.nth(3)).toContainText("Ainda por vir");

    await expect(card.getByText("Próximo nível: Veterania")).toBeVisible();
    await expect(
      card.getByText("3 meses de programa e 8 encontros com seu mentor")
    ).toBeVisible();
    await expect(
      card.getByRole("progressbar", { name: "Encontros: 4 de 8" })
    ).toBeVisible();
    await expect(
      card.getByRole("progressbar", { name: /^Tempo de programa: \d+ de 90 dias$/ })
    ).toBeVisible();
    // o que falta é contagem — nenhuma data projetada
    await expect(
      card.getByText(/^Faltam 4 encontros e \d+ dias$/)
    ).toBeVisible();

    // cada faixa abre o detalhe com critério e estado
    await faixas.nth(3).getByRole("button").click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Jornada completa" })
    ).toBeVisible();
    await expect(dialog.getByText("Ainda por vir")).toBeVisible();
    await expect(
      dialog.getByText("Completar os 16 encontros com seu mentor")
    ).toBeVisible();
  });

  test("estante earned-only e futuras separadas, apagadas e sem cadeado", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    const card = page.locator("section#conquistas");

    const estante = card.getByRole("list", { name: "Estante" });
    await expect(estante.getByText("Primeiro encontro")).toBeVisible();
    await expect(estante.getByText("Metade do caminho")).toHaveCount(0);

    const futuras = card.getByRole("list", { name: "Ainda por vir" });
    await expect(futuras.getByText("Metade do caminho")).toBeVisible();
    await expect(futuras.getByText("Reta final")).toBeVisible();
    await expect(futuras.getByText("Primeiro encontro")).toHaveCount(0);

    // ilustração local (public/badges), nada de CDN
    const imgs = card.locator("img");
    expect(await imgs.count()).toBeGreaterThan(0);
    for (const src of await imgs.evaluateAll((els) =>
      els.map((e) => e.getAttribute("src") ?? "")
    ))
      expect(src).toMatch(/^\/badges\/[a-z0-9-]+\.svg$/);

    // futura apagada (filtro), estante em cor
    await expect(futuras.locator("img").first()).toHaveClass(/grayscale/);
    await expect(estante.locator("img").first()).not.toHaveClass(/grayscale/);
    await expect(card.getByText(/cadeado|bloquead/i)).toHaveCount(0);
  });

  test("detalhe da peça: data, critério e estado; futura sem data", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    const card = page.locator("section#conquistas");

    await card.getByRole("button", { name: /^Primeiro encontro/ }).click();
    let dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Primeiro encontro" })).toBeVisible();
    await expect(dialog.getByText(/^Conquistada em \d{2} de /)).toBeVisible();
    await expect(dialog.getByText("Ter o 1º encontro com seu mentor")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    await card.getByRole("button", { name: /^Metade do caminho/ }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByText("A próxima da sua jornada")).toBeVisible();
    await expect(dialog.getByText("Chegar a 8 encontros com seu mentor")).toBeVisible();
    await expect(dialog.getByText("Faltam 4 encontros com seu mentor")).toBeVisible();
    await expect(
      dialog.getByRole("progressbar", { name: "Progresso: 4 de 8" })
    ).toBeVisible();
    await expect(dialog.getByText(/Conquistada/)).toHaveCount(0);
  });

  test("leitor de tela ouve nome, estado e data, não o desenho", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    const card = page.locator("section#conquistas");
    await expect(
      card.getByRole("button", { name: /^Primeiro encontro Conquistada em \d{2} de / })
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: /^Metade do caminho Ainda por vir\. Faltam 4/ })
    ).toBeVisible();
    // o desenho é decorativo: alt vazio e fora da árvore de acessibilidade
    for (const alt of await card.locator("img").evaluateAll((els) =>
      els.map((e) => [e.getAttribute("alt"), e.getAttribute("aria-hidden")])
    ))
      expect(alt).toEqual(["", "true"]);
  });

  test("arquivo que falta cai no emblema de antes, sem quebrar a estante", async ({
    page,
  }) => {
    await page.route("**/badges/marco-primeiro.svg", (route) =>
      route.fulfill({ status: 404, body: "" })
    );
    await page.goto("/jovem/perfil");
    const peca = page
      .locator("section#conquistas")
      .getByRole("button", { name: /^Primeiro encontro/ });
    await expect(peca.locator('img[src="/badges/marco-primeiro.svg"]')).toHaveCount(0);
    // o squircle do glifo Phosphor assume no mesmo box
    await expect(peca.locator("span[aria-hidden] svg").first()).toBeVisible();
    await expect(peca).toContainText("Primeiro encontro");
  });

  test("movimento: salto curto no detalhe e nada com reduced-motion", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    const card = page.locator("section#conquistas");
    await card.getByRole("button", { name: /^Primeiro encontro/ }).click();
    const salto = page.getByRole("dialog").locator(".badge-salta").first();
    const anim = await salto.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { nome: cs.animationName, dur: cs.animationDuration };
    });
    expect(anim.nome).toContain("badge-salto-p");
    expect(parseFloat(anim.dur)).toBeLessThan(2);

    await page.keyboard.press("Escape");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await page
      .locator("section#conquistas")
      .getByRole("button", { name: /^Primeiro encontro/ })
      .click();
    const dur = await page
      .getByRole("dialog")
      .locator(".badge-salta")
      .first()
      .evaluate((el) => getComputedStyle(el).animationDuration);
    // o guard global zera (serializado em segundos: 0.01ms → "1e-05s")
    expect(parseFloat(dur)).toBeLessThan(0.05);
  });
});
