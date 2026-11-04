import { entrarNaDemo, expect, test } from "../helpers";

// Feedback da mentora (nov/2026): o quadro do painel do dia misturava o que
// é DO DIA com o que é só da semana, agrupado por dupla — e a ação embaixo
// podia ser de outro encontro ("8º · a agendar" com Remarcar do 7º). Agora
// são dois blocos: "Neste dia" (plano, por horário) e "Também nesta semana"
// (por dupla, cada linha com a ação do encontro que ela nomeia). O Ricardo
// da demo tem duas duplas DPP ativas (Ana na Turma 1, Matheus na Turma 2).
// Read-only de backend.

test.describe("demo — quadro de duplas no painel do dia", () => {
  test("'Também nesta semana' agrupa as duas duplas, linha por nº", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    // quarta da semana corrente — nunca é o dia oficial de nenhuma das duas
    // turmas (ambas marcam na terça), então os encontros da semana das duas
    // duplas caem sempre em "Também nesta semana"
    const hoje = new Date();
    const dow = (hoje.getDay() + 6) % 7; // seg = 0
    const qua = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate() - dow + 2
    );
    const p = (n: number) => String(n).padStart(2, "0");
    const dia = `${qua.getFullYear()}-${p(qua.getMonth() + 1)}-${p(qua.getDate())}`;
    await page.goto(`/agenda?aba=calendario&dia=${dia}`);

    const tituloSemana = page.getByRole("heading", {
      name: "Também nesta semana",
    });
    await expect(tituloSemana).toBeVisible({ timeout: 15_000 });
    // os grupos por dupla moram no container dividido logo abaixo do título
    const grupos = tituloSemana
      .locator("xpath=..")
      .locator("> .divide-y > div");
    await expect(grupos).toHaveCount(2);
    await expect(grupos.nth(0)).toContainText("Ana Beatriz Silva");
    await expect(grupos.nth(1)).toContainText("Matheus Gonçalves");
    // a linha da Ana traz o 5º oficial da semana marcado na terça; a do
    // Matheus o 1º da Turma 2 (realizado antes do prazo oficial) — a linha
    // é do encontro dela mesmo com a Turma 1 exibida na tela
    await expect(grupos.nth(0)).toContainText(/\dº encontro · agendado/);
    await expect(grupos.nth(1)).toContainText(/\dº encontro · realizado/);
  });
});
