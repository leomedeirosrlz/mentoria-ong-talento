import type { Page } from "@playwright/test";
import { entrarNaDemo, expect, test } from "../helpers";

// 016 + 024 + REALIZA-529 — "Suas conquistas" no perfil do jovem: nível
// por tempo de programa, estante earned-only, famílias com tiers e a área
// "Ainda por vir" apagada e sem cadeado, tudo atrás de expansões (a página
// não cresce com a coleção). Os selos são cenas isométricas em canvas
// (src/lib/selos); o jovem escolhe até 3 pra mostrar ao lado da foto, sem
// caixa em volta. Toda peça abre o detalhe.
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

  /** Abre uma expansão do card pelo título (fechadas por padrão). */
  async function abrir(page: Page, titulo: string) {
    const card = page.locator("section#conquistas");
    const gatilho = card.getByRole("button", { name: new RegExp(`^${titulo}`) });
    if ((await gatilho.getAttribute("aria-expanded")) !== "true")
      await gatilho.click();
    return card;
  }

  test("nível: Constância, régua das 4 faixas e o que falta em contagem", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    const card = page.locator("section#conquistas");
    await expect(
      card.getByRole("button", { name: /^Seu nível Constância Desde/ })
    ).toBeVisible();
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
    await expect(card.getByText(/^Faltam 4 encontros e \d+ dias$/)).toBeVisible();

    await abrir(page, "Faixas de nível");
    const faixas = card
      .getByRole("list", { name: "Faixas de nível" })
      .getByRole("listitem");
    await expect(faixas).toHaveCount(4);
    for (const [i, titulo] of FAIXAS.entries())
      await expect(faixas.nth(i)).toContainText(titulo);
    // estado sempre em texto, nunca só pela cor
    await expect(faixas.nth(0)).toContainText("Alcançada");
    await expect(faixas.nth(1)).toContainText("Seu nível");
    await expect(faixas.nth(2)).toContainText("Próxima");
    await expect(faixas.nth(3)).toContainText("Ainda por vir");

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

  test("a lista não toma scroll: estante e futuras nascem fechadas e abrem sob demanda", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    const card = page.locator("section#conquistas");
    await expect(card.getByRole("list", { name: "Estante" })).toHaveCount(0);
    await expect(card.getByRole("list", { name: "Ainda por vir" })).toHaveCount(0);

    const fechado = (await card.boundingBox())!.height;
    await abrir(page, "Estante");
    const estante = card.getByRole("list", { name: "Estante" });
    await expect(estante.getByText("Primeiro encontro")).toBeVisible();
    await expect(estante.getByText("Metade do caminho")).toHaveCount(0);

    await abrir(page, "Ainda por vir");
    const futuras = card.getByRole("list", { name: "Ainda por vir" });
    await expect(futuras.getByText("Metade do caminho")).toBeVisible();
    await expect(futuras.getByText("Reta final")).toBeVisible();
    await expect(futuras.getByText("Primeiro encontro")).toHaveCount(0);
    expect((await card.boundingBox())!.height).toBeGreaterThan(fechado + 200);
    await expect(card.getByText(/cadeado|bloquead/i)).toHaveCount(0);
  });

  test("selos são canvas locais: ganho em cor, futuro apagado e parado", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    const card = await abrir(page, "Estante");
    await abrir(page, "Ainda por vir");
    const estante = card.getByRole("list", { name: "Estante" });
    const futuras = card.getByRole("list", { name: "Ainda por vir" });

    // nenhum <img> externo: o desenho nasce no canvas, sem CDN
    await expect(card.locator("img")).toHaveCount(0);
    expect(await estante.locator("canvas").count()).toBeGreaterThan(3);
    await expect(futuras.locator("canvas").first()).toHaveClass(/grayscale/);
    await expect(estante.locator("canvas").first()).not.toHaveClass(/grayscale/);

    // o canvas pintou de verdade (não ficou em branco)
    const pintou = await estante.locator("canvas").first().evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
      return false;
    });
    expect(pintou).toBe(true);
  });

  test("detalhe da peça: data, critério e estado; futura sem data", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    const card = await abrir(page, "Estante");
    await abrir(page, "Ainda por vir");

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
    const card = await abrir(page, "Estante");
    await abrir(page, "Ainda por vir");
    await expect(
      card.getByRole("button", { name: /^Primeiro encontro Conquistada em \d{2} de / })
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: /^Metade do caminho Ainda por vir\. Faltam 4/ })
    ).toBeVisible();
    // o desenho é decorativo e fica fora da árvore de acessibilidade
    for (const oculto of await card.locator("canvas").evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-hidden"))
    ))
      expect(oculto).toBe("true");
  });

  test("selos do perfil: sem caixa, até 3, um por vez abre o detalhe", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    const grupo = page.locator("header").getByRole("group", { name: "Selos do perfil" });
    // padrão da casa: a faixa atual e as 2 conquistas mais recentes
    const selos = grupo.locator("button[aria-label$='Abrir detalhe']");
    await expect(selos).toHaveCount(3);
    await expect(selos.first()).toHaveAttribute("aria-label", /^Constância\./);
    // minimalista: nenhuma borda nem fundo em volta da peça
    const estilo = await selos.first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return [cs.borderTopWidth, cs.backgroundColor, cs.boxShadow];
    });
    expect(estilo).toEqual(["0px", "rgba(0, 0, 0, 0)", "none"]);

    await selos.first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Constância" })).toBeVisible();
    await expect(dialog.getByText(/^Seu nível desde \d{2} de /)).toBeVisible();
    await expect(
      dialog.getByText("1 mês de programa e 4 encontros com seu mentor")
    ).toBeVisible();
  });

  test("escolher até 3: limite, ordem, persistência no reload e sugestão da casa", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    await page.getByRole("button", { name: "Escolher os selos do perfil" }).click();
    const dialog = page.getByRole("dialog", { name: "Selos do perfil" });
    const opcoes = dialog.getByRole("list", { name: "Selos que você já tem" });
    await expect(dialog.getByText("3 de 3. Solte um para trocar.")).toBeVisible();

    // solta os 3 e escolhe em outra ordem
    const marcadas = opcoes.getByRole("button", { pressed: true });
    while ((await marcadas.count()) > 0) await marcadas.first().click();
    await expect(dialog.getByText("0 de 3 escolhidos")).toBeVisible();
    await opcoes.getByRole("button", { name: /^Construindo a sua Visão/ }).click();
    await opcoes.getByRole("button", { name: /^Constância/ }).click();
    await opcoes.getByRole("button", { name: /^Primeiro encontro/ }).click();
    // com 3 marcadas as outras travam
    const quarta = opcoes.getByRole("button", { name: /^Início/ });
    await expect(quarta).toHaveAttribute("aria-disabled", "true");
    await quarta.click({ force: true });
    await expect(quarta).toHaveAttribute("aria-pressed", "false");
    await expect(opcoes.getByRole("button", { pressed: true })).toHaveCount(3);

    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(dialog).toHaveCount(0);

    const selos = page
      .locator("header")
      .getByRole("group", { name: "Selos do perfil" })
      .locator("button[aria-label$='Abrir detalhe']");
    const nomes = () =>
      selos.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    await expect.poll(nomes).toEqual([
      "Construindo a sua Visão. Abrir detalhe",
      "Constância. Abrir detalhe",
      "Primeiro encontro. Abrir detalhe",
    ]);
    // persiste: vem do cookie, sem piscar no reload
    await page.goto("/jovem/perfil");
    await expect.poll(nomes).toEqual([
      "Construindo a sua Visão. Abrir detalhe",
      "Constância. Abrir detalhe",
      "Primeiro encontro. Abrir detalhe",
    ]);

    // volta à sugestão da casa
    await page.getByRole("button", { name: "Escolher os selos do perfil" }).click();
    await page.getByRole("button", { name: "Usar sugestão" }).click();
    await expect.poll(async () => (await nomes())[0]).toBe("Constância. Abrir detalhe");
  });

  test("escolha vazia é respeitada: perfil sem selos, só o lápis", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    await page.getByRole("button", { name: "Escolher os selos do perfil" }).click();
    const dialog = page.getByRole("dialog", { name: "Selos do perfil" });
    const marcadas = dialog
      .getByRole("list", { name: "Selos que você já tem" })
      .getByRole("button", { pressed: true });
    while ((await marcadas.count()) > 0) await marcadas.first().click();
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.locator("header").locator("button[aria-label$='Abrir detalhe']")
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Escolher os selos do perfil" })
    ).toBeVisible();
  });

  test("mobile 390: header alinhado e a página sem rolagem lateral", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/jovem/perfil");
    const selos = page
      .locator("header")
      .getByRole("group", { name: "Selos do perfil" });
    await expect(selos).toBeVisible();
    const caixa = (await selos.boundingBox())!;
    expect(caixa.x).toBeGreaterThanOrEqual(0);
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(390);
    const sobra = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(sobra).toBe(0);
    // visual: o header do perfil em reduced-motion fica no quadro de repouso
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(400);
    await page.locator("header").last().screenshot({
      path: "test-results/selos-header-390.png",
    });
  });

  test("demo: nenhum toast de level-up, mesmo com a baseline zerada", async ({
    page,
  }) => {
    // a baseline local persistiria entre visitantes da mesma máquina — o
    // notifier sai antes de ler/escrever qualquer coisa em modo demo
    await page.addInitScript(() => {
      try {
        for (const k of Object.keys(localStorage))
          if (k.startsWith("realiza:nivel:")) localStorage.setItem(k, "-1");
      } catch {
        /* storage fora continua fora */
      }
    });
    await page.goto("/jovem/perfil");
    await expect(
      page.locator("header").getByRole("button", { name: /^Constância\./ })
    ).toBeVisible();
    // o efeito do notifier roda no mount — assert negativo pede um
    // respiro pra não passar antes da hidratação
    await page.waitForTimeout(1200);
    await expect(page.getByText(/Subiu de nível/)).toHaveCount(0);
  });

  test("famílias com tiers: maior degrau na estante, escada no detalhe", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    const card = await abrir(page, "Estante");
    await abrir(page, "Ainda por vir");
    const estante = card.getByRole("list", { name: "Estante" });

    // tiers ganhos da Bia: presença 1 (4 seguidos) e perfil (ficha cheia)
    await expect(estante.getByText("Não faltou")).toBeVisible();
    await expect(estante.getByText("Cara do lugar")).toBeVisible();

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

    // futura da família mostra o PRÓXIMO tier com o progresso honesto
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

  test("movimento: o selo do detalhe repinta em loop e reduced-motion congela", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    const selo = page
      .locator("header")
      .locator("button[aria-label^='Constância']");
    await selo.click();
    const canvas = page.getByRole("dialog").locator("canvas").first();
    const hash = () =>
      canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL().length + ":" + c.toDataURL().slice(-80));
    const amostras = new Set<string>();
    for (let i = 0; i < 8; i++) {
      amostras.add(await hash());
      await page.waitForTimeout(180);
    }
    // a cena anda (salto e brilhos) — pelo menos dois quadros distintos
    expect(amostras.size).toBeGreaterThan(1);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await selo.click();
    const parado = page.getByRole("dialog").locator("canvas").first();
    const h = () => parado.evaluate((c: HTMLCanvasElement) => c.toDataURL());
    const a = await h();
    await page.waitForTimeout(700);
    expect(await h()).toBe(a);
  });
});
