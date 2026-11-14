import { apiGetApp, entrarNaDemo, expect, test } from "../helpers";

// Paridade demo dos 6 exports + hub (REALIZA-178): os mesmos CSVs saem do
// dataset em memória pra coordenação — outros papéis seguem com 403.
const TIPOS: { tipo: string; header: string }[] = [
  { tipo: "aderencia", header: "encontros_esperados" },
  { tipo: "assinaturas-pendentes", header: "documento" },
  { tipo: "interacoes", header: "nota" },
  { tipo: "solicitacoes", header: "latencia_dias" },
  { tipo: "encerramento", header: "checklist" },
  { tipo: "forms-taxa", header: "respostas" },
];

test.describe("demo — /api/export paridade", () => {
  for (const { tipo, header } of TIPOS) {
    test(`tipo=${tipo} devolve CSV do dataset demo`, async ({ page }) => {
      await entrarNaDemo(page, "coordenacao");
      const r = await apiGetApp(page, `/api/export?tipo=${tipo}`);
      expect(r.status()).toBe(200);
      expect(r.headers()["content-type"]).toContain("text/csv");
      const body = await r.text();
      expect(body.charCodeAt(0)).toBe(0xfeff);
      expect(body).toContain(header);
    });
  }

  test("mentor na demo recebe 403", async ({ page }) => {
    await entrarNaDemo(page, "mentor_dpp");
    const r = await apiGetApp(page, "/api/export?tipo=aderencia");
    expect(r.status()).toBe(403);
  });
});

test.describe("demo — hub /relatorios", () => {
  test("abas renderizam com prévias do dataset", async ({ page }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/relatorios/operacionais?aba=interacoes");
    await expect(
      page.getByRole("heading", { name: "Interações" })
    ).toBeVisible();
    const csv = page.getByRole("link", { name: "Baixar CSV completo" });
    expect(await csv.getAttribute("href")).toContain("tipo=interacoes");
    // a aba Saúde mostra o estado de acumulação (demo não tem snapshots)
    await page.goto("/relatorios/operacionais?aba=visao");
    await expect(page.getByText("Acumulando histórico")).toBeVisible();
  });

  test("digest: disparo manual volta com DEMO_MSG", async ({ page }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/relatorios/operacionais?aba=visao");
    const botao = page.getByRole("button", { name: /Enviar digest agora/ });
    // click antes da hidratação cai no vazio — tenta de novo até o feedback
    // da action aparecer (o disparo é idempotente: sempre DEMO_MSG na demo)
    await expect(async () => {
      await botao.click();
      await expect(
        page.getByText("Modo demonstração. Nada é gravado de verdade.")
      ).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 15_000 });
  });
});

// Seções acionáveis (REALIZA-389): aderência e encerramento viram resumo +
// fila de DuplaLinha com ação; a tabela do export segue embaixo, colapsada.
test.describe("demo — seções acionáveis", () => {
  test("aderência: resumo, fila com Lembrar e prévia colapsada", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/relatorios/operacionais?aba=aderencia");

    await expect(
      page.getByRole("heading", { name: "Aderência ao ciclo" })
    ).toBeVisible();
    // o resumo: saúde canônica + régua do calendário + registros
    await expect(
      page.getByRole("heading", { name: "Situação das duplas" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Encontros devidos" })
    ).toBeVisible();
    await expect(page.getByText(/de \d+ até hoje/)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Registros" })
    ).toBeVisible();

    // a fila: a d-risco (Fernanda × Dandara) lidera com apoio aberto; a
    // Dandara também aparece na prévia colapsada — o .first pega a fila
    await expect(page.getByText(/Precisa de ação \(\d+\)/)).toBeVisible();
    await expect(page.getByText("Apoio pedido").first()).toBeVisible();
    await expect(page.getByText("Dandara").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Lembrar|Chamar/ }).first()
    ).toBeVisible();
    const ficha = page
      .getByRole("link", { name: /Ver ficha da dupla/ })
      .first();
    expect(await ficha.getAttribute("href")).toMatch(/^\/duplas\//);

    // a tabela do CSV fica embaixo, colapsada — o download segue direto
    const csv = page.getByRole("link", { name: "Baixar CSV completo" });
    expect(await csv.getAttribute("href")).toContain("tipo=aderencia");
    await expect(
      page.getByText(/Prévia do export \(\d+ linhas\)/)
    ).toBeVisible();
  });

  test("aderência com ?turma=: recorte filtra a fila e o CSV", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    const t2 = encodeURIComponent("T2 · 2026/2027");
    await page.goto(`/relatorios/operacionais?aba=aderencia&turma=${t2}`);
    // d-t2c (Ricardo × Matheus) é a pendência da T2 — visível na fila
    await expect(page.getByText("Matheus").first()).toBeVisible();
    // a d-risco é T1: fica fora do recorte inteiro (fila, massa e prévia)
    await expect(page.getByText("Fernanda")).toHaveCount(0);
    const csv = page.getByRole("link", { name: "Baixar CSV completo" });
    const href = await csv.getAttribute("href");
    expect(href).toContain("tipo=aderencia");
    expect(href).toContain("turma=T2");
  });

  test("encerramento: ritos pendentes com ação direta pra ficha", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/relatorios/operacionais?aba=encerramento");

    await expect(
      page.getByRole("heading", { name: "Encerramentos" })
    ).toBeVisible();
    // o resumo: decisão do ciclo + a pendência da coordenação
    await expect(
      page.getByRole("heading", { name: "Decisão do rito" })
    ).toBeVisible();
    await expect(page.getByText("2 ritos sem decisão")).toBeVisible();
    await expect(
      page.getByText(/o mais antigo espera há \d+ dias/)
    ).toBeVisible();
    await expect(
      page.getByText("itens do checklist em aberto")
    ).toBeVisible();

    // a fila: mais antigo primeiro — a d-rito (~24d) antes da d-ok (~6d)
    await expect(page.getByText("A concluir (2)")).toBeVisible();
    const acoes = page.getByRole("link", { name: "Concluir rito" });
    await expect(acoes).toHaveCount(2);
    // a d-rito já é concluída: o rito mora na aba Agora da ficha — o uid
    // da fixture renderiza em decimal (0x060e → 1550)
    expect(await acoes.nth(0).getAttribute("href")).toBe(
      "/duplas/de000000-0000-4000-8000-000000001550"
    );
    // a d-ok é ativa: o rito mora na aba Encontros (0x0601 → 1537)
    expect(await acoes.nth(1).getAttribute("href")).toBe(
      "/duplas/de000000-0000-4000-8000-000000001537?aba=encontros"
    );

    // decididos ficam no histórico colapsado
    await expect(page.getByText("Decididos (1)")).toBeVisible();
    const csv = page.getByRole("link", { name: "Baixar CSV completo" });
    expect(await csv.getAttribute("href")).toContain("tipo=encerramento");
  });

  test("encerramento com ?turma=: o rito histórico sai do recorte", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    const t1 = encodeURIComponent("T1 · 2026/2027");
    await page.goto(`/relatorios/operacionais?aba=encerramento&turma=${t1}`);
    // só a d-ok (T1) tem rito aberto; a d-rito é do ciclo 2025/2026 e a
    // d-fim decidida também sai do recorte
    await expect(page.getByText("A concluir (1)")).toBeVisible();
    await expect(page.getByText("1 rito sem decisão")).toBeVisible();
    await expect(page.getByText("Gustavo")).toHaveCount(0);
    const csv = page.getByRole("link", { name: "Baixar CSV completo" });
    expect(await csv.getAttribute("href")).toContain("turma=T1");
  });
});
