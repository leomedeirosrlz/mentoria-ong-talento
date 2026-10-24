import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-203 — /turmas no desenho v1a (card = perfil da turma): banner
// ink com a sigla ghost + linha de dados, nome canônico + SiglaTurma +
// StatusBadge, meta "Ciclo … · início → fim", bloco funcional "Semana do
// encontro N" tintado na cor da turma e a faixa de stats
// (duplas | mentores | jovens). O card inteiro é link pra
// /turmas/<id> — a interação honesta é abrir a T1 e ler a régua lá.
// Read-only — seguro em qualquer deploy, produção inclusa.

test.describe("demo — /turmas (REALIZA-203 · card v1a)", () => {
  test("renderiza os cards com banner, bloco funcional e stats; card abre a turma", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/turmas");

    await expect(
      page.getByRole("heading", { name: "Turmas e cronogramas", level: 1 })
    ).toBeVisible();

    // modo demo: aviso de só-leitura no lugar do CTA "Novo cronograma"
    await expect(
      page.getByText(/Modo demonstração — os cronogramas de exemplo/)
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Novo cronograma/ })
    ).toHaveCount(0);

    // as duas turmas do dataset demo — o card é um <a> inteiro cujo nome
    // acessível vem do heading canônico "Turma N" (a sigla "T1" é
    // aria-hidden; "Calendário oficial" é o nome do cronograma, só vai à
    // meta do detalhe)
    const cards = page.locator('ul.grid a[href^="/turmas/"]');
    await expect(cards).toHaveCount(2);

    const t1 = cards.filter({ hasText: "Turma 1" });
    const t2 = cards.filter({ hasText: "Turma 2" });
    await expect(t1).toBeVisible();
    await expect(t2).toBeVisible();

    for (const card of [t1, t2]) {
      // bloco funcional tintado — "Semana do encontro N — <quando>"
      await expect(card.getByText(/Semana do encontro \d+/)).toBeVisible();
      // badge de estado do cronograma
      await expect(card.getByText(/^Ativ/)).toBeVisible();
      // faixa de stats — as três legendas do rodapé
      for (const rotulo of [/duplas?$/, /mentores?$/, /jovens?$/]) {
        await expect(card.getByText(rotulo).first()).toBeVisible();
      }
    }

    // a interação real: o card inteiro é o link — clicar abre o perfil da
    // turma com a régua de eventos oficiais
    await t1.click();
    await page.waitForURL("**/turmas/de000000-*");
    await expect(
      page.getByRole("heading", { name: /Turma 1/, level: 1 })
    ).toBeVisible();
    await expect(page.getByText(/encontros oficiais/)).toBeVisible();
    await expect(page.getByText(/Modo demonstração/)).toBeVisible();
  });
});
