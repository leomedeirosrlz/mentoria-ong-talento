import type { Locator, Page } from "@playwright/test";
import {
  appEnvOk,
  convergirDuplaAtiva,
  expect,
  limparViaServiceRole,
  loginComSenha,
  test,
} from "../helpers";

// Combinados do encontro (0157: os afazeres viraram combinados), contra o
// backend real: criar no card persiste após reload; marcar risca e
// persiste. A lista fica no card do passo do guia na ficha da dupla
// (#combinados-<nº>), logo abaixo do registro.
const EMAIL = process.env.E2E_MENTOR_EMAIL ?? "";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const DUPLA_ID = process.env.E2E_DUPLA_ID ?? "";

// nº arbitrário dentro do teto do cronograma — o combinado nasce na âncora
// do passo mesmo sem encontro agendado (a chave é o nº do guia)
const NUMERO = 10;
const TEXTO = "E2E — enviar material de apoio depois do encontro";
// só as rows deste spec: os combinados dos registros são de outros specs
const FILTRO = `dupla_id=eq.${DUPLA_ID}&numero=eq.${NUMERO}&registro_id=is.null`;

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

/** Card do passo N pode dormir no collapsible "Próximos N encontros" —
 *  lá dentro o painel desmonta e a âncora some do DOM; um clique no
 *  trigger monta. No-op quando o card já está fora. */
async function montarCardDoPasso(page: Page, numero: number) {
  const bloco = page.locator(`#combinados-${numero}`);
  if (await bloco.count()) return bloco;
  await page
    .getByText(/^Próximos \d+ encontros$/)
    .click()
    .catch(() => {});
  await expect(bloco).toHaveCount(1, { timeout: 15_000 });
  return bloco;
}

/** Garante o painel aberto — ele nasce aberto quando há itens (pendente
 *  de antes conta), fechado quando vazio; clicar às cegas fecharia. */
async function abrirCombinados(bloco: Locator) {
  const input = bloco.getByRole("textbox", { name: /Novo combinado/ });
  if (!(await input.isVisible())) {
    await bloco.getByRole("button", { name: /^Combinados/ }).click();
  }
  await expect(input).toBeVisible();
}

test.describe("mentor DPP — combinados do encontro (0157)", () => {
  test.beforeEach(async ({ page }) => {
    if (DUPLA_ID) {
      await limparViaServiceRole("encaminhamentos", FILTRO);
      // mesmo piso do mentor.spec: spec que recria o encontro 16 realizado
      // dispara a 0102 e deixa a dupla 'concluida' — a action exige ativa
      await convergirDuplaAtiva(DUPLA_ID);
    }
    await loginComSenha(page, EMAIL, SENHA);
  });

  test.afterEach(async () => {
    if (DUPLA_ID) await limparViaServiceRole("encaminhamentos", FILTRO);
  });

  test("criar → persistir no reload → marcar → persistir de novo", async ({
    page,
  }) => {
    await page.goto(`/duplas/${DUPLA_ID}?aba=encontros`);

    let bloco = await montarCardDoPasso(page, NUMERO);
    await abrirCombinados(bloco);

    await bloco
      .getByRole("textbox", { name: `Novo combinado do ${NUMERO}º encontro` })
      .fill(TEXTO);
    // o padrão é o mentor como responsável (o antigo afazer)
    await expect(bloco.getByRole("button", { name: "Você", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await bloco.getByRole("button", { name: "Adicionar" }).click();

    // o item aparece desmarcado com o responsável — checked vem do server
    // (action + router.refresh): 15s como a suite
    const item = bloco.locator("label", { hasText: TEXTO });
    await expect(item).toBeVisible({ timeout: 15_000 });
    await expect(item).toContainText("Você");
    await expect(item.getByRole("checkbox")).not.toBeChecked();

    // reload de verdade: a row existe no banco, não em estado local
    await page.reload();
    bloco = await montarCardDoPasso(page, NUMERO);
    await abrirCombinados(bloco);
    await expect(bloco.getByText(TEXTO)).toBeVisible();

    // marcar: clique honesto no label (o checkbox é sr-only)
    await bloco.locator("label", { hasText: TEXTO }).click();
    await expect(
      bloco.locator("label", { hasText: TEXTO }).getByRole("checkbox")
    ).toBeChecked({ timeout: 15_000 });

    await page.reload();
    bloco = await montarCardDoPasso(page, NUMERO);
    await abrirCombinados(bloco);
    await expect(
      bloco.locator("label", { hasText: TEXTO }).getByRole("checkbox")
    ).toBeChecked();
  });
});
