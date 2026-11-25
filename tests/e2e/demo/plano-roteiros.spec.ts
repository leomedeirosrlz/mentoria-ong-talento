import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-521 (020) — os documentos do plano na demo: leitura segura,
// sem escrita (as actions devolvem { demo: true } sem tocar banco).
// A síntese espelha a régua real: semanas devidas nascem "publicadas" e
// a seguinte fica "rascunho", com conteúdo montado do corpus de verdade.
//   · /jovem/combinado renderiza o documento do escopo (ritmo, encontros,
//     como vale) — a mesma peça que o aceite assina;
//   · a agenda lista "Roteiros do plano" com o status de cada semana;
//   · /jovem/roteiro/N abre a leitura do vigente;
//   · o plano demo da Bia/Ana (d-ok) tem numeros [5,6,7]: 5 e 6 já
//     marcados (devidos) e o 7º vira a próxima semana em RASCUNHO.

const D_OK = "de000000-0000-4000-8000-000000001537";

test.describe("documentos do plano na demo (521)", () => {
  test("jovem lê o combinado, a lista de roteiros e a semana vigente", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");

    // o documento do combinado — mesma render determinística do app
    await page.goto("/jovem/combinado");
    await expect(page.getByText("Combinado da dupla")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: "O ritmo" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Os encontros" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Como vale" })
    ).toBeVisible();

    // a agenda traz a lista — o 6º marcado nasce vigente
    await page.goto("/jovem/agenda");
    const lista = page.locator("section[aria-label='Roteiros do plano']");
    await expect(lista).toBeVisible({ timeout: 15_000 });
    const link6 = lista.getByRole("link", {
      name: "Roteiro do 6º encontro",
    });
    await expect(link6).toBeVisible();
    // a próxima semana do combinado está materializada como rascunho —
    // não é semana realizada, é o 7º encontro ainda por vir
    const link7 = lista.getByRole("link", {
      name: "Roteiro do 7º encontro",
    });
    await expect(link7).toBeVisible();
    await expect(
      lista.locator("li").filter({ hasText: "Roteiro do 7º encontro" })
    ).toContainText("Rascunho");

    // a rota da semana abre a leitura — conteúdo montado do corpus +
    // o contexto do plano ("Do plano de vocês")
    await link6.click();
    await expect(page).toHaveURL(/\/jovem\/roteiro\/6/);
    await expect(
      page.getByText(/Do plano de vocês/).first()
    ).toBeVisible({ timeout: 15_000 });
    // publicado na demo é leitura — nada de editor nem botão de salvar
    await expect(
      page.getByRole("button", { name: /Salvar|Publicar/ })
    ).toHaveCount(0);

    // o rascunho do 7º tem conteúdo montado de verdade (corpus + plano)
    // e abre no editor — é a próxima semana, não uma realizada
    await page.goto("/jovem/roteiro/7");
    await expect(
      page.getByRole("heading", { name: /Roteiro do 7º encontro/ })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: "Editar rascunho" })
    ).toBeVisible();
  });

  test("equipe lê o combinado e a lista de roteiros na ficha da dupla", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    // ficha da d-ok (Ricardo × Ana Beatriz): central de acordos traz a
    // lista; o doc do combinado abre pela rota da dupla
    await page.goto(`/duplas/${D_OK}`);
    const lista = page.locator("section[aria-label='Roteiros do plano']");
    await expect(lista).toBeVisible({ timeout: 15_000 });
    await expect(
      lista.getByRole("link", { name: /Roteiro do \d+º encontro/ }).first()
    ).toBeVisible();
    const link7 = lista.getByRole("link", {
      name: "Roteiro do 7º encontro",
    });
    await expect(link7).toBeVisible();
    await expect(
      lista.locator("li").filter({ hasText: "Roteiro do 7º encontro" })
    ).toContainText("Rascunho");

    await page.goto(`/duplas/${D_OK}/combinado`);
    await expect(
      page.getByRole("heading", { name: "O ritmo" })
    ).toBeVisible({ timeout: 15_000 });
  });
});
