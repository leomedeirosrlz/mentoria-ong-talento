// Card "Para ficar em dia" (REALIZA-397) na aba Agora da ficha — a leitura
// de equipe (coordenação/supervisão) é sem CTA: quem agenda é a dupla, a
// equipe usa o plano como contexto pra lembrar e chamar. d-risco (Fernanda
// × Dandara) deve os encontros 3 e 4 e tem o 5º marcado; d-atraso traz um
// "não aconteceu" cuja remarcação entra no plano. No dataset da demo nenhuma
// dupla supervisionada pelo Paulo está atrasada o suficiente pro card — a
// d-pend só carrega pendência de registro, que a superfície própria já cobre.

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
    // os passos devidos entram com data sugerida; o 5º marcado aparece como
    // tal — .first() porque em seg/ter o aviso de ordem repete a expressão
    await expect(card.getByText(/sugestão/)).toHaveCount(2);
    await expect(card.getByText(/marcado pra/).first()).toBeVisible();
    // leitura de equipe: nenhum botão de agir — quem agenda é a dupla
    await expect(
      card.getByRole("button", { name: /Agendar|Remarcar/ })
    ).toHaveCount(0);
  });

  test("coordenação na d-atraso (1 remarcação + limbo): sem card", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${D_ATRASO}?aba=agora`);

    // o 4º virou 'não aconteceu' (1 passo de remarcação) e o 5º vencido caiu
    // em limbo — com menos de 2 passos agendáveis as pendências já cobrem o caso
    await expect(
      page.getByRole("region", { name: "Para ficar em dia" })
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
