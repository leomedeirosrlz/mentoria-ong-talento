// Card "Para ficar em dia" (REALIZA-397+513) na aba Agora da ficha — a
// leitura de equipe não agenda/remarca (quem agenda é a dupla), mas pode
// PROPOR o combinado: o 0224 deixa coord, supervisor da dupla e mentor
// abrirem a proposta bilateral. d-risco (Fernanda × Dandara) deve os
// encontros 3 e 4 e tem o 5º marcado; d-atraso (513) tem três devidos —
// 3º e 4º "não aconteceram" e o 5º venceu em limbo — e acende a
// recuperação com proposta. No dataset da demo nenhuma dupla
// supervisionada pelo Paulo está atrasada o suficiente pro card — a
// d-pend só carrega pendência de registro, que a superfície própria já
// cobre (e o combinado dela, proposto pelo Paulo, aparece no card de
// acordos, não aqui).

import { expect, test } from "../helpers";
import { entrarNaDemo } from "../helpers";

const D_RISCO = "de000000-0000-4000-8000-000000001539"; // Fernanda × Dandara
const D_ATRASO = "de000000-0000-4000-8000-000000001540"; // João Pedro × Eduardo
const D_OK = "de000000-0000-4000-8000-000000001537"; // Ricardo × Ana (em dia)
const D_PEND = "de000000-0000-4000-8000-000000001538"; // Carlos × Caio (só pendência)

test.describe("demo — plano pra ficar em dia (REALIZA-397)", () => {
  test("coordenação na d-risco: card com os passos e sem CTA de agendar", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${D_RISCO}?aba=agora`);

    const card = page.getByRole("region", { name: "Para ficar em dia" });
    await expect(card).toBeVisible();
    // a projeção honesta é o número principal — a data "em dia" já conta
    // os encontros oficiais que vencem no caminho da recuperação
    await expect(card.getByText(/Em dia em/)).toBeVisible();
    await expect(card.getByText(/\d+ encontros? pra repor/)).toBeVisible();
    // os passos devidos abrem a lista: sugestão com a oficial passada ao
    // lado ("oficial era …"); os oficiais que vencem no caminho entram em
    // sequência (a jornada inteira aparece); o 5º marcado lê "marcado pra"
    const itens = card.locator("ol li");
    await expect(itens.nth(0)).toContainText(/sugestão.*oficial era/);
    await expect(itens.nth(1)).toContainText(/sugestão.*oficial era/);
    await expect(
      itens.filter({ hasText: /vence no caminho/ }).first()
    ).toBeVisible();
    await expect(card.getByText(/marcado pra/).first()).toBeVisible();
    // a decisão de recesso mora dentro do card — a coordenação declara aqui
    await expect(card.getByText("Recesso no caminho")).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Vamos seguir nos encontrando" })
    ).toBeVisible();
    // e não sobra card de recesso separado na página (exact: o aviso dos
    // passos empurrados menciona "recesso do programa" como substring)
    await expect(
      page.getByText("Recesso do programa", { exact: true })
    ).toHaveCount(0);
    // leitura de equipe: não agenda nem remarca — quem agenda é a dupla.
    // Mas o 0224 deixa a coordenação PROPOR o combinado
    await expect(
      card.getByRole("button", { name: /Agendar|Remarcar/ })
    ).toHaveCount(0);
    await expect(
      card.getByRole("button", { name: /Propor o plano/i })
    ).toBeVisible();
  });

  test("coordenação na d-atraso (3 devidos): recuperação com proposta", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${D_ATRASO}?aba=agora`);

    // 513: 3º e 4º "não aconteceram" e o 5º venceu em limbo — os três
    // devidos acendem a recuperação possível, com CTA de proposta
    const card = page.getByRole("region", { name: "Para ficar em dia" });
    await expect(card).toBeVisible();
    await expect(card.getByText(/Em dia em/)).toBeVisible();
    await expect(card.getByText(/\d+ encontros? pra repor/)).toBeVisible();
    await expect(
      card.getByRole("button", { name: /Propor o plano/i })
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: /Agendar|Remarcar/ })
    ).toHaveCount(0);
  });

  test("supervisão na d-pend (só pendência): sem card", async ({ page }) => {
    await entrarNaDemo(page, "supervisor");
    await page.goto(`/duplas/${D_PEND}?aba=agora`);

    // a pendência de registro já tem superfície própria — o plano só aparece
    // quando há 2+ encontros devidos pra agendar
    await expect(
      page.getByRole("region", { name: "Para ficar em dia" })
    ).toHaveCount(0);
  });

  test("mentor na d-ok (em dia): sem card", async ({ page }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/duplas/${D_OK}?aba=agora`);

    await expect(
      page.getByRole("region", { name: "Para ficar em dia" })
    ).toHaveCount(0);
  });
});
