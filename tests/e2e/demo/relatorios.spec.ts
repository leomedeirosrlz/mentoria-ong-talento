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
    await page.goto("/relatorios?aba=interacoes");
    await expect(
      page.getByRole("heading", { name: "Interações" })
    ).toBeVisible();
    const csv = page.getByRole("link", { name: "Baixar CSV completo" });
    expect(await csv.getAttribute("href")).toContain("tipo=interacoes");
    // a aba Saúde mostra o estado de acumulação (demo não tem snapshots)
    await page.goto("/relatorios?aba=visao");
    await expect(page.getByText("Acumulando histórico")).toBeVisible();
  });

  test("digest: disparo manual volta com DEMO_MSG", async ({ page }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/relatorios?aba=visao");
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
