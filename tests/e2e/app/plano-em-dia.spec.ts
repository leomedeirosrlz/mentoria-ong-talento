import {
  appEnvOk,
  convergirDuplaAtiva,
  expect,
  inserirViaServiceRole,
  limparEncontrosDaDupla,
  loginComSenha,
  test,
} from "../helpers";

// REALIZA-397 — "Para ficar em dia" na ficha + pós-save "registrar o próximo
// também". O piso é a dupla fixture e2e…00d1: o card nasce quando 2+ passos
// devidos cabem agendamento/remarcação; o chaining encadeia registros de
// encontros realizado-sem-registro pelo rascunho local + âncora #registrar-id.

const EMAIL = process.env.E2E_MENTOR_EMAIL ?? "";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const DUPLA_ID = process.env.E2E_DUPLA_ID ?? "";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

/** Encontro atrás no tempo no status pedido — data_hora no passado, sem
 *  registro: `nao_aconteceu` alimenta os passos "remarcar" do plano e
 *  `realizado` sem registro é a pendência que o chaining encadeia. */
function criarEncontro(numero: number, status: string, emDiasAtras: number) {
  const quando = new Date(Date.now() + emDiasAtras * 86400e3).toISOString();
  return inserirViaServiceRole("encontros", {
    dupla_id: DUPLA_ID,
    numero,
    data_hora: quando,
    status,
    ...(status === "realizado" ? { realizado_em: quando } : {}),
  });
}

test.describe("plano pra ficar em dia + registro encadeado (REALIZA-397)", () => {
  test.beforeEach(async ({ page }) => {
    if (DUPLA_ID) await limparEncontrosDaDupla(DUPLA_ID);
    if (DUPLA_ID) await convergirDuplaAtiva(DUPLA_ID);
    await loginComSenha(page, EMAIL, SENHA);
  });

  test.afterEach(async () => {
    if (DUPLA_ID) await limparEncontrosDaDupla(DUPLA_ID);
  });

  test("mentor vê o card com CTA e a remarcação abre com a data proposta", async ({
    page,
  }) => {
    // 2 'não aconteceu' = 2 passos remarcáveis → o card cruza a régua de 2+
    await criarEncontro(3, "nao_aconteceu", -7);
    await criarEncontro(4, "nao_aconteceu", -5);
    await page.goto(`/duplas/${DUPLA_ID}?aba=agora`);

    const card = page.getByRole("region", { name: "Para ficar em dia" });
    await expect(card).toBeVisible();
    // mentor age: cada passo remarcável expõe o botão "Remarcar"
    const remarcar = card.getByRole("button", { name: "Remarcar" });
    await expect(remarcar.first()).toBeVisible();
    await remarcar.first().click();

    // o dialog abre em modo remarcação com a data do plano já proposta —
    // dataMudou nasce true, então o motivo já está sendo cobrado
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/motivo/i).first()
    ).toBeVisible();
  });

  test("pós-save oferece 'registrar o próximo também' e preenche o rascunho", async ({
    page,
  }) => {
    const e3 = await criarEncontro(3, "realizado", -3);
    const e4 = await criarEncontro(4, "realizado", -1);
    await page.goto(`/duplas/${DUPLA_ID}?aba=encontros`);

    // abre o form do 3º pela âncora própria — a linha realizado-sem-registro
    // nasce com o trigger "Registrar" (um <a> apesar do visual de botão)
    const linha3 = page.locator(`#registrar-${String(e3.id)}`);
    await linha3.getByRole("link", { name: "Registrar" }).click();

    const form3 = linha3.locator("form");
    await expect(form3).toBeVisible();
    // avaliacao é o único campo com portão — fica na etapa 1 ("Como foi");
    // o input é sr-only, clica no rótulo visível
    await form3.getByText("Boa", { exact: true }).click();
    // duração não-default: é o campo compartilhado que o rascunho do 4º herda
    await form3.locator("#duracao-select").click();
    await page.getByRole("option", { name: "1h30" }).click();

    await form3.getByRole("button", { name: "Avançar" }).click();
    await form3.getByRole("button", { name: "Avançar" }).click();
    await form3.getByRole("button", { name: "Salvar registro" }).click();

    // pós-save: a oferta aponta o 4º (menor nº devendo registro na dupla)
    await expect(
      linha3.getByRole("button", { name: "Registrar o 4º também" })
    ).toBeVisible({ timeout: 15_000 });
    await linha3
      .getByRole("button", { name: "Registrar o 4º também" })
      .click();

    // a âncora troca pro 4º e o form dele abre já hidratado pelo rascunho
    await expect(page).toHaveURL(new RegExp(`#registrar-${String(e4.id)}`), {
      timeout: 15_000,
    });
    const linha4 = page.locator(`#registrar-${String(e4.id)}`);
    const form4 = linha4.locator("form");
    await expect(form4).toBeVisible({ timeout: 15_000 });
    await expect(
      form4.getByText(/Rascunho de .* restaurado/)
    ).toBeVisible();
    // campos compartilhados vieram no rascunho
    await expect(
      form4.locator('input[name="avaliacao"][value="boa"]')
    ).toBeChecked();
    await expect(form4.locator("#duracao-select")).toContainText("1h30");
  });
});
