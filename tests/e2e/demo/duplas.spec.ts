import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-174 — densidade da visão geral /duplas nos 4 papéis: linhas de
// ~1 linha (banda de segurança 44-80px; o típico ~58px do aceite 52-60px
// varia uns px entre browsers), sinais truncados com title, cards sem
// footer morto (ação única mora no header). Read-only — seguro em
// qualquer deploy, produção inclusa.

const LINHAS_COORD = 'section[aria-label="Lista de duplas"] .divide-y > div';
const LINHAS_SUP = 'section[aria-label="Duplas supervisionadas"] .divide-y > div';

test.describe("demo — /duplas (REALIZA-174)", () => {
  test("coordenação: linhas densas com header de coluna e sinais em 1 linha", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/duplas");

    await expect(
      page.getByRole("heading", { name: "Duplas", level: 1 })
    ).toBeVisible();

    const linhas = page.locator(LINHAS_COORD);
    const n = await linhas.count();
    expect(n).toBeGreaterThan(3);

    // altura de linha: nada de card alto nem linha espremida demais — e a
    // maioria fica na banda densa (linhas com a 2ª pill "Apoio" passam um
    // pouco dos ~58-64px típicos)
    let densas = 0;
    for (let i = 0; i < n; i++) {
      const box = await linhas.nth(i).boundingBox();
      if (!box) throw new Error("linha sem bounding box");
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeLessThanOrEqual(80);
      if (box.height <= 64) densas++;
    }
    expect(densas).toBeGreaterThan(n / 2);

    // sinais: 1 linha truncada com o texto completo no title — a linha
    // nunca quebra a altura da tabela (a ficha tem o detalhe)
    for (let i = 0; i < Math.min(n, 6); i++) {
      const sinais = linhas.nth(i).locator("p.truncate[title]");
      await expect(sinais).toHaveCount(1);
      expect((await sinais.getAttribute("title"))?.length).toBeGreaterThan(0);
    }

    // a massa saudável colapsa num <details> — aberto, LinhaMini ainda mais
    // baixa (depende do dataset: só afere quando a massa existe)
    const massa = page.locator("summary", {
      hasText: "Mostrar as outras",
    });
    if ((await massa.count()) > 0) {
      await massa.first().click();
      const minis = page.locator(
        'section[aria-label="Lista de duplas"] details > div > div'
      );
      const m = await minis.count();
      expect(m).toBeGreaterThan(0);
      for (let i = 0; i < m; i++) {
        const box = await minis.nth(i).boundingBox();
        if (!box) throw new Error("mini-linha sem bounding box");
        expect(box.height).toBeLessThanOrEqual(52);
        await expect(
          minis.nth(i).getByRole("link", { name: "Ver ficha" })
        ).toHaveCount(1);
      }
    }
  });

  test("coordenação mobile: cards p-3/gap-2 sem rodapé morto", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/duplas");

    const cards = page.locator(LINHAS_COORD);
    const n = await cards.count();
    expect(n).toBeGreaterThan(3);

    const primeiro = cards.first();
    await expect(primeiro).toHaveCSS("padding-left", "12px");
    await expect(primeiro).toHaveCSS("row-gap", "8px");

    for (let i = 0; i < n; i++) {
      const card = cards.nth(i);
      // exatamente um "Ver ficha" por card — nunca duplicado topo+rodapé
      await expect(
        card.getByRole("link", { name: "Ver ficha" })
      ).toHaveCount(1);
      const temAcao =
        (await card
          .getByRole("button", {
            name: /Lembrar|Lembrada|Registrar supervisão/,
          })
          .count()) > 0;
      if (!temAcao) {
        // sem ação o "Ver ficha" sobe pro topo do card — o último bloco não
        // é um rodapé com um link solto
        const topo = card.locator(":scope > div").first();
        await expect(
          topo.getByRole("link", { name: "Ver ficha" })
        ).toHaveCount(1);
      }
    }
  });

  test("supervisor: mesmo padrão denso da coord, agrupado por turma", async ({
    page,
  }) => {
    await entrarNaDemo(page, "supervisor");
    await page.goto("/duplas");

    await expect(
      page.getByRole("heading", { name: "Duplas que você supervisiona" })
    ).toBeVisible();
    await expect(page.getByText(/agrupadas por turma/)).toBeVisible();

    // sub-headers de turma sobrevivem ao template de linha
    const subs = page.locator(
      'section[aria-label="Duplas supervisionadas"] > div > div.bg-muted'
    );
    expect(await subs.count()).toBeGreaterThan(0);

    const linhas = page.locator(LINHAS_SUP);
    const n = await linhas.count();
    expect(n).toBeGreaterThan(1);
    for (let i = 0; i < n; i++) {
      const box = await linhas.nth(i).boundingBox();
      if (!box) throw new Error("linha sem bounding box");
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeLessThanOrEqual(80);
    }
  });

  test("mentor: ação única inline no header — footer só com par de ações", async ({
    page,
  }) => {
    // Ricardo é híbrido — a seção "Minhas duplas" é a régua DPP dele
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/duplas");

    await expect(
      page.getByRole("heading", { name: "Minhas duplas" })
    ).toBeVisible();

    const cards = page
      .locator("article")
      .filter({ has: page.getByRole("link", { name: "Abrir ficha" }) });
    const n = await cards.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const card = cards.nth(i);
      await expect(
        card.getByRole("link", { name: "Abrir ficha" })
      ).toHaveCount(1);
      // o border-t tracejado só existe quando o "Registrar encontro" faz
      // par com o "Abrir ficha" — nunca footer de um botão só
      const footer = card.locator("div.border-dashed");
      if ((await footer.count()) > 0) {
        await expect(footer.getByRole("link")).toHaveCount(2);
        await expect(
          footer.getByRole("link", { name: /Registrar encontro/ })
        ).toHaveCount(1);
      }
    }
  });

  test("especialista: 'Abrir trilha' no header, sem footer no card", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_especialista");
    await page.goto("/duplas");

    await expect(
      page.getByRole("heading", { name: "Minhas trilhas" })
    ).toBeVisible();

    const cards = page
      .locator("article")
      .filter({ has: page.getByRole("link", { name: "Abrir trilha" }) });
    const n = await cards.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const card = cards.nth(i);
      await expect(
        card.locator("header").getByRole("link", { name: "Abrir trilha" })
      ).toHaveCount(1);
      await expect(card.locator("div.border-dashed")).toHaveCount(0);
    }
  });
});
