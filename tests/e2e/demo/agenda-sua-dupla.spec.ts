import { entrarNaDemo, expect, test } from "../helpers";

// Feedback da mentora (nov/2026): o quadro "Sua dupla" do painel do dia
// listava só quem já tinha encontro do nº da semana — no dia livre de uma
// mentorada aparecia só a outra, e as ações (Agendar/Remarcar) ficavam num
// rodapé separado. Agora: uma linha por dupla ativa, sempre, com a ação
// da dupla logo abaixo do nome. O Ricardo da demo tem duas duplas DPP
// ativas (Ana na Turma 1, Matheus na Turma 2). Read-only de backend.

test.describe("demo — Sua dupla no painel do dia", () => {
  test("as duas duplas aparecem, cada uma com a própria ação", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/agenda?aba=calendario");

    const quadro = page.locator("div.rounded-xl", {
      has: page.getByRole("heading", { name: "Suas duplas" }),
    });
    await expect(quadro).toBeVisible({ timeout: 15_000 });
    const grupos = quadro.locator(":scope > div > div");
    await expect(grupos).toHaveCount(2);
    await expect(grupos.nth(0)).toContainText("Ana Beatriz Silva");
    await expect(grupos.nth(1)).toContainText("Matheus Gonçalves");
    // a linha do Matheus traz o encontro dele mesmo com a Turma 1 exibida
    await expect(grupos.nth(1)).toContainText(/\dº encontro · agendado/);
  });
});
