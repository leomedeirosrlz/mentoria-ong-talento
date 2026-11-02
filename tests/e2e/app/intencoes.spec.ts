import type { Locator, Page } from "@playwright/test";
import {
  appEnvOk,
  convergirDuplaAtiva,
  expect,
  limparViaServiceRole,
  loginComSenha,
  test,
} from "../helpers";

// REALIZA-21 — checklist de intenções do mentor por encontro, contra o
// backend real. Critérios 12–13 do acceptance: criar persiste após
// reload; marcar risca e persiste. O checklist fica no card do passo do
// guia na ficha da dupla (#intencoes-<nº>).
const EMAIL = process.env.E2E_MENTOR_EMAIL ?? "";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const DUPLA_ID = process.env.E2E_DUPLA_ID ?? "";

// nº arbitrário dentro do teto do cronograma — o item nasce na âncora do
// passo mesmo sem encontro agendado (a chave é o nº do guia)
const NUMERO = 10;
const TEXTO = "E2E — enviar material de apoio depois do encontro";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

/** Card do passo N pode dormir no collapsible "Próximos N encontros" —
 *  lá dentro o painel desmonta e a âncora some do DOM; um clique no
 *  trigger monta. No-op quando o card já está fora (≤ semana ou com
 *  pendência — o passo com intenção pendente nunca entra no collapsible). */
async function montarCardDoPasso(page: Page, numero: number) {
  const bloco = page.locator(`#intencoes-${numero}`);
  if (await bloco.count()) return bloco;
  await page
    .getByText(/^Próximos \d+ encontros$/)
    .click()
    .catch(() => {});
  await expect(bloco).toHaveCount(1, { timeout: 15_000 });
  return bloco;
}

/** Trigger "Afazeres · …" do bloco + painel aberto (o Collapsible nasce
 *  fechado; reabrir cobre o estado pós-reload). */
async function abrirIntencoes(bloco: Locator) {
  const trigger = bloco.getByRole("button", { name: /Afazeres/ });
  await trigger.click();
  await expect(
    bloco.getByRole("textbox", { name: /Novo afazer/ })
  ).toBeVisible();
  return trigger;
}

test.describe("mentor DPP — intenções do encontro (REALIZA-21)", () => {
  test.beforeEach(async ({ page }) => {
    if (DUPLA_ID) {
      await limparViaServiceRole(
        "encontro_intencoes",
        `dupla_id=eq.${DUPLA_ID}`
      );
      // mesmo piso do mentor.spec: spec que recria o encontro 16 realizado
      // dispara a 0102 e deixa a dupla 'concluida' — a action exige ativa
      await convergirDuplaAtiva(DUPLA_ID);
    }
    await loginComSenha(page, EMAIL, SENHA);
  });

  test.afterEach(async () => {
    if (DUPLA_ID) {
      await limparViaServiceRole(
        "encontro_intencoes",
        `dupla_id=eq.${DUPLA_ID}`
      );
    }
  });

  test("criar → persistir no reload → marcar → persistir de novo", async ({
    page,
  }) => {
    await page.goto(`/duplas/${DUPLA_ID}?aba=encontros`);

    // bloco vazio abre com a copy de vazio + o input
    let bloco = await montarCardDoPasso(page, NUMERO);
    await abrirIntencoes(bloco);
    await expect(
      bloco.getByText(/Coisas que precisam acontecer neste encontro/)
    ).toBeVisible();

    await bloco
      .getByRole("textbox", { name: `Novo afazer do ${NUMERO}º encontro` })
      .fill(TEXTO);
    await page.keyboard.press("Enter");

    // o item aparece desmarcado e o trigger passa a "· 1 pendente" —
    // checked vem do server (action + router.refresh): 15s como a suite
    const item = bloco.locator("label", { hasText: TEXTO });
    await expect(item).toBeVisible({ timeout: 15_000 });
    await expect(item.getByRole("checkbox")).not.toBeChecked();
    await expect(bloco.getByText("· 1 pendente")).toBeVisible();

    // reload de verdade: a row existe no banco, não em estado local
    await page.reload();
    bloco = await montarCardDoPasso(page, NUMERO);
    await abrirIntencoes(bloco);
    await expect(bloco.getByText(TEXTO)).toBeVisible();

    // marcar: clique honesto no label (o checkbox é sr-only); riscado e
    // o trigger lê "tudo feito" quando não sobra pendente
    await bloco.locator("label", { hasText: TEXTO }).click();
    await expect(
      bloco.locator("label", { hasText: TEXTO }).getByRole("checkbox")
    ).toBeChecked({ timeout: 15_000 });
    await expect(bloco.getByText("· tudo feito")).toBeVisible();

    await page.reload();
    bloco = await montarCardDoPasso(page, NUMERO);
    await abrirIntencoes(bloco);
    await expect(
      bloco.locator("label", { hasText: TEXTO }).getByRole("checkbox")
    ).toBeChecked();
  });
});
