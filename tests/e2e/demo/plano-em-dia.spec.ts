// Card "Para ficar em dia" (REALIZA-397/513/518) na aba Agora da ficha.
// 518: o card é LEITURA pra todo mundo — o gesto inteiro (ritmo, recesso,
// grade, confirmar) mora na superfície "Combinar o plano", uma pergunta
// por tela. Staff abre a superfície mas o recesso lá dentro é só leitura:
// a decisão é da dupla. No dataset demo de hoje a d-risco (Fernanda ×
// Dandara) já acumula devidos demais — nem 1 por dia fecha antes do
// encerramento e o recesso segue pendente ("a dupla ainda não decidiu"),
// então o card cai no estado "conversa" com a saída honesta: seguir se
// encontrando no recesso fecha o plano. A d-ok é a paridade do recesso
// DECIDIDO: a dupla marcou "vamos pausar os encontros" e os oficiais dentro
// da janela viram devidos — o card aparece mesmo na dupla saudável.

import { agirComConfirma, entrarNaDemo, expect, test } from "../helpers";

const D_RISCO = "de000000-0000-4000-8000-000000001539"; // Fernanda × Dandara
const D_ATRASO = "de000000-0000-4000-8000-000000001540"; // João Pedro × Eduardo
const D_OK = "de000000-0000-4000-8000-000000001537"; // Ricardo × Ana
const D_PEND = "de000000-0000-4000-8000-000000001538"; // Carlos × Caio

test.describe("demo — plano pra ficar em dia (REALIZA-397)", () => {
  test("coordenação na d-risco: conversa honesta, recesso pendente e CTA", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${D_RISCO}?aba=agora`);

    const card = page.getByRole("region", { name: "Para ficar em dia" });
    await expect(card).toBeVisible();
    // a projeção honesta quando nem o teto diário fecha: o card diz que
    // não fecha em vez de prometer data, e aponta a conversa com a coord
    await expect(
      card.getByText("Não fecha até o encerramento", { exact: true })
    ).toBeVisible();
    await expect(
      card.getByText("Nem com 1 encontro por dia fecha", { exact: true })
    ).toBeVisible();
    await expect(card.getByText(/\d+ encontros? pra repor/)).toBeVisible();
    // seguir no recesso é a alavanca que fecha — sugestão, nunca decisão
    await expect(
      card.getByText(/Se a dupla seguir se encontrando no recesso/)
    ).toBeVisible();
    // os passos devidos abrem a lista: sugestão com a oficial passada ao
    // lado ("oficial era …"); os oficiais que vencem no caminho entram em
    // sequência (a jornada inteira aparece); o marcado lê "marcado pra"
    const itens = card.locator("ol li");
    await expect(itens.nth(0)).toContainText(/sugestão.*oficial era/);
    await expect(
      itens.filter({ hasText: /vence no caminho/ }).first()
    ).toBeVisible();
    await expect(card.getByText(/marcado pra/).first()).toBeVisible();
    // 518: o recesso no caminho aparece no card só leitura — pendente
    // é "a dupla ainda não decidiu"; a decisão mora na superfície e é
    // só da dupla (a coordenação acompanha e cobra, não responde)
    await expect(card.getByText("Recesso no caminho")).toBeVisible();
    await expect(card.getByText("A decisão é da dupla.")).toBeVisible();
    await expect(card.getByText("a dupla ainda não decidiu")).toBeVisible();
    await expect(
      card.getByText("Falta a decisão do recesso pra fechar a proposta.")
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: /Vamos (pausar|seguir)/ })
    ).toHaveCount(0);
    // e não sobra card de recesso separado na página (exact: o aviso dos
    // passos empurrados menciona "recesso do programa" como substring)
    await expect(
      page.getByText("Recesso do programa", { exact: true })
    ).toHaveCount(0);
    // o gesto é um só: "Combinar o plano" abre a superfície; no estado
    // conversa a saída é falar com a coordenação
    await expect(
      card.getByRole("button", { name: /Agendar|Remarcar/ })
    ).toHaveCount(0);
    await expect(
      card.getByRole("button", { name: "Combinar o plano" })
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Falar com a coordenação" })
    ).toBeVisible();
  });

  test("staff abre a superfície mas o recesso lá dentro é só leitura", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${D_RISCO}?aba=agora`);

    const card = page.getByRole("region", { name: "Para ficar em dia" });
    // desktop → dialog; a superfície pode demorar a hidratar — repete o
    // gesto até o dialog abrir (mesmo padrão do agendar)
    const dialog = page.getByRole("dialog", { name: "Combinar o plano" });
    await agirComConfirma(
      () => card.getByRole("button", { name: "Combinar o plano" }).click(),
      () => dialog.isVisible()
    );
    await expect(
      dialog.getByText("Quantos encontros por semana")
    ).toBeVisible({ timeout: 15_000 });
    // o input é sr-only — clica o label pai (padrão do login por senha)
    await dialog
      .locator("label", {
        has: page.locator('input[name="ritmo"][value="2"]'),
      })
      .click();
    const avancar = dialog.getByRole("button", { name: "Avançar" });
    await expect(avancar).toBeEnabled({ timeout: 15_000 });
    await avancar.click();

    // recesso no caminho: staff lê o estado e a régua "a decisão é da
    // dupla" — sem radio pra responder por eles
    await expect(dialog.getByText(/recesso no caminho/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      dialog.getByText(/A decisão é da dupla/)
    ).toBeVisible();
    await expect(
      dialog.getByRole("radio", { name: /Vamos (usar|seguir)/ })
    ).toHaveCount(0);
  });

  test("coordenação na d-atraso (3 devidos): recuperação com proposta", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${D_ATRASO}?aba=agora`);

    // 513: 3º e 4º "não aconteceram" e o 5º venceu em limbo — os três
    // devidos acendem a recuperação possível, com CTA do combinado
    const card = page.getByRole("region", { name: "Para ficar em dia" });
    await expect(card).toBeVisible();
    await expect(card.getByText(/Em dia em/)).toBeVisible();
    await expect(card.getByText(/\d+ encontros? pra repor/)).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Combinar o plano" })
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: /Agendar|Remarcar/ })
    ).toHaveCount(0);
  });

  test("supervisão na d-pend: staff lê o card inteiro com o mesmo CTA", async ({
    page,
  }) => {
    await entrarNaDemo(page, "supervisor");
    await page.goto(`/duplas/${D_PEND}?aba=agora`);

    // 518: auxiliar de turma é staff da dupla (supervisiona_dupla) — lê a
    // projeção inteira. A d-pend já tem combinado aberto (proposto pelo
    // Paulo): o CTA cede lugar ao "Ver o combinado" da central
    const card = page.getByRole("region", { name: "Para ficar em dia" });
    await expect(card).toBeVisible();
    await expect(card.getByText(/\d+ encontros? pra repor/)).toBeVisible();
    await expect(
      card.getByRole("link", { name: "Ver o plano" })
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: /Vamos (pausar|seguir)/ })
    ).toHaveCount(0);
  });

  test("mentor na d-ok: recesso decidido vira devido — 'vão pausar' lê autoria", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/duplas/${D_OK}?aba=agora`);

    // paridade demo do tri-estado: a dupla decidiu "vamos pausar os encontros"
    // — os oficiais dentro da janela viram devidos e o card aparece até
    // na dupla que estava em dia. A decisão mostra quem e quando
    const card = page.getByRole("region", { name: "Para ficar em dia" });
    await expect(card).toBeVisible();
    await expect(card.getByText(/\d+ encontros? pra repor/)).toBeVisible();
    await expect(card.getByText("Recesso no caminho")).toBeVisible();
    await expect(card.getByText("vão pausar os encontros")).toBeVisible();
    await expect(card.getByText(/decidido por .+ em /)).toBeVisible();
    // decidido não é pendência: nada de "falta decisão" no card
    await expect(card.getByText(/Falta \d+ decis/)).toHaveCount(0);
  });
});
