import {
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  expect,
  limparViaServiceRole,
  loginComSenha,
  relogar,
  test,
} from "../helpers";

// REALIZA-165 (0103) — avaliação por terceiros ponta a ponta no staging:
// mentor indica a pessoa na ficha da dupla → o convite /t/<token> abre sem
// login e grava as 2 respostas → o mentor lê identificado e publica a
// síntese → o JOVEM vê só o consolidado na home dele (é a asserção que o
// REST não cobre: mentorado não tem SELECT em `duplas`, a leitura vai por
// jovem_duplas — um embed errado aqui morria silencioso).
//
// Piso: o sweep zera os convites/consolidado da dupla …0030 antes de cada
// run (e no afterAll) — spec idempotente, o cap 3-por-vínculo não acumula.

const MENTOR_EMAIL = process.env.E2E_MENTOR_EMAIL ?? "e2e-mentor@realiza.test";
const JOVEM_EMAIL = process.env.E2E_JOVEM_EMAIL ?? "jovem-e2e@realiza.test";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const DUPLA_ID =
  process.env.E2E_DUPLA_ID ?? "e2e00000-0000-4000-8000-000000000030";

const CONVIDADO = "Pessoa Indicada E2E";
const RESPOSTA_FORTES = "Persistente e criativa, resolve do jeito dela.";
const RESPOSTA_MELHORAR = "Às vezes some quando está atolada.";
const CONSOLIDADO =
  "O que mais apareceu: persistência e criatividade. A olhar: avisar quando some.";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

async function limparTerceiros() {
  // service role ignora RLS — cleanup real do que o spec criou. As FKs
  // cascateiam a resposta; o consolidado sai junto (notificação fica —
  // não pertence à row do contato). A dupla …0030 precisa estar ativa
  // (dupla encerrada é read-only) — converge o piso, idempotente.
  await limparViaServiceRole(
    "terceiros_contatos",
    `dupla_id=eq.${DUPLA_ID}`
  );
  await limparViaServiceRole(
    "terceiros_consolidacao",
    `dupla_id=eq.${DUPLA_ID}`
  );
  await atualizarViaServiceRole(
    "duplas",
    `id=eq.${DUPLA_ID}`,
    { status: "ativa" }
  );
}

test.beforeEach(limparTerceiros);
test.afterAll(limparTerceiros);

test("fluxo completo: convite → resposta pública → consolidado pro jovem", async ({
  page,
}) => {
  // ── mentor abre a ficha e indica a pessoa ──────────────────────────
  await loginComSenha(page, MENTOR_EMAIL, SENHA);
  await page.goto(`/duplas/${DUPLA_ID}?aba=instrumentos`);
  const secao = page.getByRole("heading", {
    name: "Avaliação por terceiros",
  });
  await expect(secao).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Indicar pessoa" }).click();
  await page.locator("#novo-nome").fill(CONVIDADO);
  await page.locator("#novo-vinculo").selectOption("amigo");
  await page.getByRole("button", { name: "Criar convite" }).click();

  // a linha do convite aparece com o token mintado no banco
  await expect(page.getByText(CONVIDADO)).toBeVisible({ timeout: 15_000 });
  const [convite] = await buscarViaServiceRole<{ token: string }[]>(
    "terceiros_contatos",
    `select=token&dupla_id=eq.${DUPLA_ID}&nome=eq.${encodeURIComponent(CONVIDADO)}`
  );
  expect(convite?.token).toBeTruthy();

  // ── a pessoa indicada responde pelo link público (sem login) ───────
  await page.goto(`/t/${convite.token}`);
  await expect(
    page.getByRole("heading", { name: /Como você vê/ })
  ).toBeVisible({ timeout: 15_000 });
  await page.locator("#fortes").fill(RESPOSTA_FORTES);
  await page.locator("#melhorar").fill(RESPOSTA_MELHORAR);
  await page.getByRole("button", { name: "Enviar resposta" }).click();
  await expect(
    page.getByRole("heading", { name: "Resposta enviada!" })
  ).toBeVisible({ timeout: 15_000 });

  // replay no mesmo link cai no estado "já registrada" — não regrava
  await page.goto(`/t/${convite.token}`);
  await expect(page.getByText("Resposta já registrada")).toBeVisible({
    timeout: 15_000,
  });

  // ── de volta à ficha: resposta identificada + consolidado ──────────
  await page.goto(`/duplas/${DUPLA_ID}?aba=instrumentos`);
  await expect(page.getByText("respondeu", { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByText(`Ver resposta de ${CONVIDADO.split(" ")[0]}`).click();
  await expect(page.getByText(RESPOSTA_FORTES)).toBeVisible();

  await page
    .getByPlaceholder(/O que mais apareceu foi/)
    .fill(CONSOLIDADO);
  await page
    .getByRole("button", { name: "Publicar pro jovem" })
    .click();
  await expect(page.getByText("publicada")).toBeVisible({ timeout: 15_000 });

  // ── o jovem lê SÓ a síntese — nome da pessoa indicada nunca aparece ─
  // (o consolidado saiu da home e mora em /jovem/materiais, junto da
  // devolutiva de terceiros que o origina)
  await relogar(page, JOVEM_EMAIL, SENHA);
  await page.goto("/jovem/materiais");
  await expect(
    page.getByRole("heading", { name: "Como as pessoas próximas te veem" })
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(CONSOLIDADO)).toBeVisible();
  await expect(page.getByText(CONVIDADO)).toHaveCount(0);
});
