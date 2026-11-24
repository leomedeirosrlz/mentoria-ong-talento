import { entrarNaDemo, expect, test } from "../helpers";

// 016 (REALIZA-516) + 024 — "Suas conquistas" no perfil do jovem: nível
// por tempo de programa (régua das 4 faixas + selo no header), estante
// earned-only com as ilustrações isométricas de public/badges, famílias
// com tiers (o maior degrau na estante, a escada no detalhe) e a área
// "Ainda por vir" separada, apagada e sem cadeado. Toda peça abre o
// detalhe.
//
// Fixture da persona mentorado (Bia, dupla DPP com o Ricardo): a dupla
// começou uma semana antes do 1º encontro e o 5º cai nesta semana — entre
// 34 e 40 dias de programa com 4 encontros realizados, em qualquer dia em
// que o spec rode. Isso a põe em Constância, com a Veterania pedindo mais
// 4 encontros e os dias que faltam pros 90. Instrumentos da janela
// aberta todos feitos; roda formal e 360º ainda vêm. Nas famílias: 4
// encontros seguidos ganham o tier 1 da presença ("Não faltou") e a ficha
// completa ganha "Cara do lugar"; avaliações (5 de 15), horas (5h de 7h),
// submetas (2 de 3) e combinados (2 de 5) ficam como futuras com
// progresso — e o termo dela segue pendente.

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

  test("selo 'Seu nível' no header abre o mesmo detalhe da faixa", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    const selo = page
      .locator("header")
      .getByRole("button", { name: /^Seu nível: Constância/ });
    await expect(selo).toBeVisible();
    // a peça da faixa é a ilustração local do raio (public/badges)
    await expect(selo.locator('img[src="/badges/nivel-constancia.svg"]')).toBeVisible();

    await selo.click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Constância" })
    ).toBeVisible();
    await expect(dialog.getByText(/^Seu nível desde \d{2} de /)).toBeVisible();
    await expect(
      dialog.getByText("1 mês de programa e 4 encontros com seu mentor")
    ).toBeVisible();
  });

  test("famílias com tiers: maior degrau na estante, escada no detalhe", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    const card = page.locator("section#conquistas");
    const estante = card.getByRole("list", { name: "Estante" });

    // tiers ganhos da Bia: presença 1 (4 seguidos) e perfil (ficha cheia)
    await expect(estante.getByText("Não faltou")).toBeVisible();
    await expect(estante.getByText("Cara do lugar")).toBeVisible();
    // as ilustrações das famílias são as arte fam-*-<tier> geradas
    await expect(estante.locator('img[src="/badges/fam-presenca-1.svg"]')).toBeVisible();
    await expect(estante.locator('img[src="/badges/fam-perfil-1.svg"]')).toBeVisible();

    // o detalhe mostra a escada inteira: ganho carimbado, próximo com a
    // linha honesta e o topo só com o critério
    await estante.getByRole("button", { name: /^Não faltou/ }).click();
    const dialog = page.getByRole("dialog");
    const escada = dialog.getByRole("list", { name: "Degraus da conquista" });
    await expect(escada.getByRole("listitem")).toHaveCount(3);
    await expect(escada.getByText("Não faltou")).toBeVisible();
    await expect(escada.getByText("Presença limpa")).toBeVisible();
    await expect(escada.getByText("Ciclo inteiro")).toBeVisible();
    await expect(escada.getByText(/^Conquistado em \d{2} de /)).toBeVisible();
    await expect(
      escada.getByText("Faltam 4 encontros seguidos sem faltar")
    ).toBeVisible();
    await expect(
      escada.getByText("Realizar 16 encontros seguidos sem faltar")
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // futura da família mostra o PRÓXIMO tier com o progresso honesto —
    // a Bia já tem as 5 do primeiro degrau, então a promessa é o tier 2
    const futuras = card.getByRole("list", { name: "Ainda por vir" });
    await futuras.getByRole("button", { name: /^Voz constante/ }).click();
    const d2 = page.getByRole("dialog");
    await expect(d2.getByText("Enviar 15 avaliações de encontro")).toBeVisible();
    await expect(
      d2.getByText("Faltam 10 avaliações enviadas", { exact: true })
    ).toBeVisible();
    await expect(
      d2.getByRole("progressbar", { name: "Progresso: 5 de 15" })
    ).toBeVisible();
    await expect(d2.getByRole("list", { name: "Degraus da conquista" })).toBeVisible();
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
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // a media query é viva: emulateMedia já re-avalia os estilos — não
    // precisa navegar (o reload em dev caía na race ERR_ABORTED do stream)
    await page.emulateMedia({ reducedMotion: "reduce" });
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

  test("movimento: a faixa tem assinatura própria; reduced-motion troca por fade", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    const card = page.locator("section#conquistas");
    // a Constância abre com o pulso duplo (024) — nunca o salto da estante
    await card
      .getByRole("list", { name: "Faixas de nível" })
      .getByRole("listitem")
      .nth(1)
      .getByRole("button")
      .click();
    const peca = page.getByRole("dialog").locator(".nivel-constancia").first();
    const anim = await peca.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { nome: cs.animationName, dur: cs.animationDuration };
    });
    expect(anim.nome).toContain("nivel-constancia-pulso");
    expect(parseFloat(anim.dur)).toBeLessThan(0.8);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page
      .locator("section#conquistas")
      .getByRole("list", { name: "Faixas de nível" })
      .getByRole("listitem")
      .nth(1)
      .getByRole("button")
      .click();
    const reduzida = await page
      .getByRole("dialog")
      .locator(".nivel-constancia")
      .first()
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return { nome: cs.animationName, dur: cs.animationDuration };
      });
    // Tier 2 da acessibilidade: o pulso vira o fade compartilhado ≤200ms
    expect(reduzida.nome).toBe("nivel-fade");
    expect(parseFloat(reduzida.dur)).toBeLessThan(0.25);
  });
});
