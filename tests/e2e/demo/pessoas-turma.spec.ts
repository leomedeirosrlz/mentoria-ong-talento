import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-376 em modo demo — /pessoas volta ao modelo de produção:
// agrupamento por CARGO como padrão, turma como pill primária na barra
// (Todas, Turma 2, Turma 1, 2025/2026, Sem turma) e o agrupamento por
// ciclo como alternativa dentro do modal de filtros. A filiação segue
// derivada de duplas (turmaDaDupla) + turma_inscricoes + escopo_turma;
// sem evidência → "Sem turma". O dataset tem multi-turma (Ricardo: T1 +
// T2 + 2025/2026), gente sem ciclo (Marina, Renata) e todo status
// operacional. Spec de leitura.

test.describe("demo — /pessoas por cargo + pills de turma", () => {
  test("padrão é cargo: seções por papel, trilho de pills de turma", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/pessoas");

    // grupos globais por papel — sem seção de turma no agrupamento padrão
    await expect(
      page.getByRole("heading", { name: /Coordenação e equipe/ })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Mentores/ })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Sem turma/ })
    ).toHaveCount(0);

    // as pills de turma num trilho só — "Todas" ligada por padrão e cada
    // ciclo com a contagem de pessoas filiadas
    const pills = page.getByRole("group", { name: "Filtrar por turma" });
    await expect(
      pills.getByRole("button", { name: "Todas" })
    ).toHaveAttribute("aria-pressed", "true");
    for (const rotulo of [/Turma 2/, /Turma 1/, /2025\/2026/, /Sem turma/]) {
      await expect(
        pills.getByRole("button", { name: rotulo })
      ).toBeVisible();
    }
  });

  test("pill de turma recorta a lista e persiste na URL", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/pessoas");

    const pills = page.getByRole("group", { name: "Filtrar por turma" });
    const mentorados = page.locator("section", {
      has: page.getByRole("heading", { name: /^Mentorados/ }),
    });

    // T2: os mentorados dela ficam; o Caio (dupla só na T1) some
    await pills.getByRole("button", { name: /Turma 2/ }).click();
    await expect(
      pills.getByRole("button", { name: /Turma 2/ })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/turma=T2/);
    for (const nome of [
      "Kauã Rodrigues",
      "Matheus Gonçalves",
      "Rafael Nunes",
      "Wendel Ferreira",
    ]) {
      await expect(mentorados.getByText(nome)).toBeVisible();
    }
    await expect(
      page.getByRole("link", {
        name: "Abrir perfil de Caio Henrique Oliveira",
      })
    ).toHaveCount(0);

    // toggle off volta pro conjunto inteiro
    await pills.getByRole("button", { name: "Todas" }).click();
    await expect(
      mentorados.getByText("Caio Henrique Oliveira")
    ).toBeVisible();
  });

  test("'Sem turma' junta quem não tem evidência de ciclo", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/pessoas");

    const pills = page.getByRole("group", { name: "Filtrar por turma" });
    await pills.getByRole("button", { name: /Sem turma/ }).click();
    await expect(page).toHaveURL(/turma=sem-turma/);

    // Marina (coordenação global) e Renata (pré-cadastro sem papel) não
    // têm dupla, inscrição nem grant de turma — o Ricardo, que está nas
    // três turmas, sai de cena
    await expect(
      page.getByRole("link", { name: "Abrir perfil de Marina Duarte" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Abrir perfil de Renata Costa" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Sem papel/ })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Abrir perfil de Ricardo Tavares" })
    ).toHaveCount(0);
  });

  test("modal troca o agrupamento: por turma agrupa por ciclo", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/pessoas");

    // o toggle de agrupamento mora no modal — abre, escolhe, aplica
    await page.getByRole("button", { name: "Filtros", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("label", { hasText: "Por turma" }).click();
    await dialog.getByRole("button", { name: /^Aplicar/ }).click();

    await expect(page).toHaveURL(/agrupar=turma/);
    const headings = page.locator("h2", {
      has: page.locator("span.font-normal"),
    });
    const texts = await headings.allTextContents();
    const turmas = texts.filter((t) => /\(\d+\)$/.test(t.trim()));
    // turmas mais novas primeiro; 2025/2026 é o ciclo histórico
    expect(turmas[0]).toContain("Turma 2 · 2026/2027");
    expect(turmas[1]).toContain("Turma 1 · 2026/2027");
    expect(turmas[2]).toContain("2025/2026");
    expect(turmas[turmas.length - 1]).toContain("Sem turma");
  });

  test("?agrupar=turma de entrada: pessoa em várias turmas aparece em todas", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/pessoas?agrupar=turma");

    // Ricardo mentora na T1 (d-ok) e na T2 (d-t2c) e tem duplas
    // históricas no 2025/2026 — uma linha em cada grupo
    const sec = (nome: string) =>
      page.locator("section", {
        has: page.locator("h2", { hasText: nome }),
      });
    await expect(
      sec("Turma 2 · 2026/2027").getByText("Ricardo Tavares").first()
    ).toBeVisible();
    await expect(
      sec("Turma 1 · 2026/2027").getByText("Ricardo Tavares").first()
    ).toBeVisible();
    await expect(
      sec("2025/2026").getByText("Ricardo Tavares").first()
    ).toBeVisible();
  });

  test("status operacionais visíveis nas linhas", async ({ page }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/pessoas");
    for (const s of [
      "convidado",
      "não acessou",
      "termo pendente",
      "documentos pendentes",
      "ativo",
    ]) {
      await expect(
        page.getByText(s, { exact: true }).first()
      ).toBeVisible();
    }
    // "inativo" só existe no arquivo colapsável do fim — abre pra conferir
    await page.getByRole("button", { name: /Inativos/ }).click();
    await expect(
      page.getByText("inativo", { exact: true }).first()
    ).toBeVisible();
  });

  test("filtros do modal aplicam juntos (categoria + trilha)", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/pessoas");

    await page.getByRole("button", { name: "Filtros", exact: true }).click();
    const dialog = page.getByRole("dialog");
    // o radio fica sr-only — quem recebe o clique é a label que o envolve
    await dialog.locator("label", { hasText: "Mentores" }).click();
    await dialog.locator("label", { hasText: "Especialista" }).click();
    await dialog.getByRole("button", { name: /^Aplicar/ }).click();

    await expect(page).toHaveURL(/cat=mentores/);
    await expect(page).toHaveURL(/trilha=especialista/);
    // o selo conta os dois filtros — turma e agrupar não entram
    await expect(
      page.getByRole("button", { name: /Filtros, 2 ativos/ })
    ).toBeVisible();
    // especialista pura fica, DPP puro some
    await expect(
      page.getByRole("link", { name: "Abrir perfil de Sofia Nogueira" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Abrir perfil de Fernanda Alves" })
    ).toHaveCount(0);
    // e nenhum grupo de outro papel sobra
    await expect(
      page.getByRole("heading", { name: /Mentorados/ })
    ).toHaveCount(0);
  });

  test("fila e arquivo existem, mas não são chips de filtro; linhas sem seleção", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/pessoas");

    // o card "Aguardando par" fica — o que saiu foi o chip da barra
    await expect(
      page.locator('section[aria-labelledby="fila-espera-titulo"]')
    ).toBeVisible();
    // idem o arquivo "Fora do programa" no fim — segue sendo seção
    // colapsável, não filtro
    await expect(
      page.getByRole("button", { name: /Fora do programa/ })
    ).toBeVisible();
    await expect(
      page.locator("[aria-pressed]", { hasText: "Aguardando par" })
    ).toHaveCount(0);
    await expect(
      page.locator("[aria-pressed]", { hasText: "Fora do programa" })
    ).toHaveCount(0);

    // sem multiseleção: nenhum checkbox de linha nem barra de lote
    await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
    await expect(page.getByText(/selecionadas?/)).toHaveCount(0);
  });

  test("fora da coordenação: diretório limpo, sem gestão", async ({
    page,
  }) => {
    await entrarNaDemo(page, "supervisor");
    await page.goto("/pessoas");

    // sem pills de turma, sem botão do modal nem seleção em lote
    await expect(
      page.getByRole("group", { name: "Filtrar por turma" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /^Filtros/ })
    ).toHaveCount(0);
    await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
    // nem status operacional — os badges de gestão são coord-only
    await expect(page.getByText("não acessou", { exact: true })).toHaveCount(0);
    // o recorte que o diretório tem é a categoria, em select
    await expect(
      page.getByRole("combobox", { name: "Filtrar por categoria" })
    ).toBeVisible();
  });
});
