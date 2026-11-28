import { agirComConfirma, entrarNaDemo, expect, test } from "../helpers";

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
    const semTurma = pills.getByRole("button", { name: /Sem turma/ });
    // clique pré-hidratação é no-op: repete até o estado do chip confirmar
    await agirComConfirma(
      () => semTurma.click(),
      async () => (await semTurma.getAttribute("aria-pressed")) === "true"
    );
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

  test("o filtro de trilha saiu de vez; busca e categoria seguem como compensação", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/pessoas");

    // nem régua na barra nem fieldset escondido no modal — o recorte de
    // trilha não tem segunda via (onda 4)
    await expect(
      page.getByRole("group", { name: "Filtrar por trilha de mentor" })
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Filtros", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("fieldset", { hasText: "Trilha" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // a compensação é a busca: a coordenação ainda acha a especialista
    // pelo nome sem precisar de um eixo redundante de filtro
    await page.getByRole("searchbox", { name: "Buscar pessoa" }).fill("Sofia");
    await expect(
      page.getByRole("link", { name: "Abrir perfil de Sofia Nogueira" })
    ).toBeVisible();
    await expect(page).toHaveURL(/busca=Sofia/);
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

  test("fora da coordenação: diretório com facetas próprias, sem gestão", async ({
    page,
  }) => {
    await entrarNaDemo(page, "supervisor");
    await page.goto("/pessoas");

    // gestão segue coord-only: sem pills de turma, sem botão do modal,
    // sem seleção em lote nem status operacional
    await expect(
      page.getByRole("group", { name: "Filtrar por turma" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /^Filtros/ })
    ).toHaveCount(0);
    await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
    await expect(page.getByText("não acessou", { exact: true })).toHaveCount(0);

    // a categoria virou linha de pills (023) — o Select saiu e as facetas
    // do diretório ganharam contagem própria; o híbrido conta nos dois
    // lados de mentor
    const cats = page.getByRole("group", { name: "Filtrar por categoria" });
    await expect(
      cats.getByRole("button", { name: "Todos", exact: true })
    ).toHaveAttribute("aria-pressed", "true");
    for (const rotulo of [
      /Coordenação e equipe/,
      /Auxiliares executivos/,
      /Mentores DPP/,
      /Especialistas/,
      /Mentorados/,
    ]) {
      await expect(
        cats.getByRole("button", { name: rotulo })
      ).toBeVisible();
    }

    // a régua de trilha saiu de vez — os chips de tema seguem faceta do
    // staff todo
    await expect(
      page.getByRole("group", { name: "Filtrar por trilha de mentor" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("group", { name: "Filtrar por área" })
    ).toBeVisible();

    // ordem de uso: Especialistas (o catálogo) antes de Mentores DPP
    const rotulos = await cats.getByRole("button").allTextContents();
    const iEsp = rotulos.findIndex((t) => t.includes("Especialistas"));
    const iDpp = rotulos.findIndex((t) => t.includes("Mentores DPP"));
    expect(iEsp).toBeGreaterThanOrEqual(0);
    expect(iEsp).toBeLessThan(iDpp);
  });

  test("faceta Especialistas do diretório abre o catálogo rico", async ({
    page,
  }) => {
    await entrarNaDemo(page, "supervisor");
    // deep-link já abre na faceta (SC-004)
    await page.goto("/pessoas?cat=especialistas");

    const cats = page.getByRole("group", { name: "Filtrar por categoria" });
    await expect(
      cats.getByRole("button", { name: /Especialistas/ })
    ).toHaveAttribute("aria-pressed", "true");

    // cards completos no lugar das linhas — as 4 especialistas puras e
    // os 2 híbridos (Ricardo, André) da projeção staff
    const sec = page.locator("section", {
      has: page.getByRole("heading", { name: /Especialistas/ }),
    });
    for (const nome of [
      "Sofia Nogueira",
      "Helena Prado",
      "Marcos Vinícius",
      "Camila Ferraz",
      "Ricardo Tavares",
      "André Rocha",
    ]) {
      await expect(
        sec.getByRole("link", { name: `Abrir perfil de ${nome}` })
      ).toBeVisible();
    }
    // a projeção rica traz o "Atende:" que a linha não tem
    await expect(sec.getByText(/Atende:/).first()).toBeVisible();
    // Camila tem a capacidade zerada no ciclo — o selo honesto aparece
    // nela (Helena e Sofia também estão sem vaga na fixture — escopo no card)
    await expect(
      sec
        .getByRole("link", { name: "Abrir perfil de Camila Ferraz" })
        .getByText("Sem vagas")
    ).toBeVisible();
    // quem não é especialista some da faceta
    await expect(
      page.getByRole("link", { name: "Abrir perfil de Fernanda Alves" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", {
        name: "Abrir perfil de Caio Henrique Oliveira",
      })
    ).toHaveCount(0);
  });

  test("faceta Especialistas compõe com o chip de tema", async ({
    page,
  }) => {
    await entrarNaDemo(page, "supervisor");
    await page.goto("/pessoas?cat=especialistas");

    const sec = page.locator("section", {
      has: page.getByRole("heading", { name: /Especialistas/ }),
    });
    // o chip de tema recorta pelo que o card oferece — Ricardo não tem
    // areas cadastradas e sai do recorte de "finanças"
    await page
      .getByRole("group", { name: "Filtrar por área" })
      .getByRole("button", { name: /finanças/ })
      .click();
    await expect(page).toHaveURL(/area=finan/);
    await expect(
      sec.getByRole("link", { name: "Abrir perfil de André Rocha" })
    ).toBeVisible();
    await expect(
      sec.getByRole("link", { name: "Abrir perfil de Ricardo Tavares" })
    ).toHaveCount(0);
  });

  test("deep-link antigo ?trilha= mapeia pra faceta equivalente", async ({
    page,
  }) => {
    await entrarNaDemo(page, "supervisor");

    // trilha=dpp → Mentores DPP: quem tem o papel DPP (os híbridos
    // Ricardo e André incluídos), as especialistas puras fora
    await page.goto("/pessoas?trilha=dpp");
    const cats = page.getByRole("group", { name: "Filtrar por categoria" });
    await expect(
      cats.getByRole("button", { name: /Mentores DPP/ })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/cat=mentores_dpp/);
    await expect(page).not.toHaveURL(/trilha=/);
    await expect(
      page.getByRole("link", { name: "Abrir perfil de Ricardo Tavares" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Abrir perfil de Fernanda Alves" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Abrir perfil de Sofia Nogueira" })
    ).toHaveCount(0);

    // trilha=especialista → a faceta do catálogo; e ?trilha= com um cat
    // explícito deixa a faceta vencer (o recorte degrada seguro)
    await page.goto("/pessoas?cat=especialistas&trilha=dpp");
    await expect(
      cats.getByRole("button", { name: /Especialistas/ })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("link", { name: "Abrir perfil de Sofia Nogueira" })
    ).toBeVisible();
  });
});
