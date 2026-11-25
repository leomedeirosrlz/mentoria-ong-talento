import {
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  expect,
  inserirViaServiceRole,
  jwtDoUsuario,
  limparViaServiceRole,
  loginComSenha,
  relogar,
  restComoUsuario,
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
// run (e no afterAll) — spec idempotente, o cap total de 9 não acumula.

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
  // Vínculo é o Select do kit (REALIZA-208), não <select> nativo
  await page.locator("#novo-vinculo").click();
  await page.getByRole("option", { name: /^amigo/i }).click();
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

// REALIZA-449/463 (0216) — resposta colhida por fora (telefone, presencial,
// papel) entra pelo mentor/coord com a proveniência declarada. O fluxo
// cobre a ponta a ponta (UI → RPC → carimbo no banco → selo na ficha); o
// segundo teste fica na borda do PostgREST pra provar que a autorização e
// as réguas moram na RPC, não na tela.

const CONTATO_MANUAL = "Tia Dalva E2E";

test("registro manual: mentor lança a resposta e a proveniência aparece na ficha", async ({
  page,
}) => {
  const contato = await inserirViaServiceRole("terceiros_contatos", {
    dupla_id: DUPLA_ID,
    nome: CONTATO_MANUAL,
    vinculo: "familiar",
  });

  await loginComSenha(page, MENTOR_EMAIL, SENHA);
  await page.goto(`/duplas/${DUPLA_ID}?aba=instrumentos`);

  // o menu do convite pendente ganhou o gesto novo
  await page
    .getByRole("button", { name: `Ações do contato ${CONTATO_MANUAL}` })
    .click();
  await page
    .getByRole("menuitem", { name: "Registrar resposta" })
    .click();

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Registrar resposta de Tia" })
  ).toBeVisible();
  await dialog.locator("#manual-fortes").fill("Persistente, não larga fácil.");
  await dialog
    .locator("#manual-melhorar")
    .fill("Some quando a rotina aperta.");
  // via default "telefone" — o cenário real do contato. O submit só
  // destrava com o consentimento declarado
  const submit = dialog.getByRole("button", {
    name: "Registrar resposta",
    exact: true,
  });
  await expect(submit).toBeDisabled();
  await dialog
    .getByText("A pessoa autorizou o registro desta resposta")
    .click();
  await expect(submit).toBeEnabled();
  await submit.click();

  // a linha vira respondida com o selo de origem — registrante, via e
  // consentimento visíveis sem abrir o detalhe
  const linha = page.locator("li", { hasText: CONTATO_MANUAL });
  await expect(linha.getByText("respondeu", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(linha.getByText(/registro manual/)).toBeVisible();
  await linha.getByText("Ver resposta de Tia").click();
  await expect(linha.getByText(/Registrada por/)).toBeVisible();
  await expect(linha.getByText(/coleta por telefone/)).toBeVisible();
  await expect(linha.getByText(/consentimento declarado/)).toBeVisible();

  // o carimbo no banco fecha a história: origem, registrante, via,
  // consentimento — e o contato saiu de 'pendente'
  const [resp] = await buscarViaServiceRole<
    {
      origem: string;
      registrado_por: string | null;
      coletado_via: string | null;
      consentimento_declarado: boolean;
    }[]
  >(
    "terceiros_respostas",
    `select=origem,registrado_por,coletado_via,consentimento_declarado&contato_id=eq.${contato.id}`
  );
  expect(resp.origem).toBe("manual");
  expect(resp.registrado_por).not.toBeNull();
  expect(resp.coletado_via).toBe("telefone");
  expect(resp.consentimento_declarado).toBe(true);
  const [cont] = await buscarViaServiceRole<{ status: string }[]>(
    "terceiros_contatos",
    `select=status&id=eq.${contato.id}`
  );
  expect(cont.status).toBe("respondido");
});

test("registro manual de pessoa nova: cria o contato e grava a resposta na mesma ação", async ({
  page,
}) => {
  await loginComSenha(page, MENTOR_EMAIL, SENHA);
  await page.goto(`/duplas/${DUPLA_ID}?aba=instrumentos`);

  await page
    .getByRole("button", { name: "Registrar resposta", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", {
      name: "Registrar resposta de pessoa nova",
    })
  ).toBeVisible();
  await dialog.locator("#manual-nome").fill("Vizinha Dona Rute");
  await dialog.locator("#manual-vinculo").click();
  await page.getByRole("option", { name: /^outro/i }).click();
  await dialog.locator("#manual-fortes").fill("Cuida dos irmãos menor.");
  await dialog.locator("#manual-melhorar").fill("Fala pouco de si.");
  await dialog.locator("#manual-via").click();
  await page.getByRole("option", { name: "presencial" }).click();
  await dialog
    .getByText("A pessoa autorizou o registro desta resposta")
    .click();
  await dialog
    .getByRole("button", { name: "Registrar resposta", exact: true })
    .click();

  const linha = page.locator("li", { hasText: "Vizinha Dona Rute" });
  await expect(linha.getByText("respondeu", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(linha.getByText(/registro manual/)).toBeVisible();

  // o contato nasceu já respondido, sem token de link nem convite pendente
  const [contato] = await buscarViaServiceRole<
    { id: string; status: string }[]
  >(
    "terceiros_contatos",
    `select=id,status&dupla_id=eq.${DUPLA_ID}&nome=eq.${encodeURIComponent("Vizinha Dona Rute")}`
  );
  expect(contato?.status).toBe("respondido");
  const [resp] = await buscarViaServiceRole<
    { origem: string; coletado_via: string | null }[]
  >(
    "terceiros_respostas",
    `select=origem,coletado_via&contato_id=eq.${contato.id}`
  );
  expect(resp?.origem).toBe("manual");
  expect(resp?.coletado_via).toBe("presencial");
});

// Réguas da RPC na borda — a tela esconde, o PostgREST tem que barrar:
// sem consentimento não registra, via fora do vocabulário não registra,
// respondido não regrava (imutável) e quem não é da dupla nem enxerga.
test("RPC manual: consentimento, via, imutabilidade e escopo barrados", async () => {
  const jwt = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
  const corpo = (over: Record<string, unknown>) => ({
    p_contato_id: null,
    p_pontos_fortes: "Persistente.",
    p_a_melhorar: "Some quando aperta.",
    p_coletado_via: "telefone",
    p_consentimento: true,
    ...over,
  });

  const alvo = await inserirViaServiceRole("terceiros_contatos", {
    dupla_id: DUPLA_ID,
    nome: "Guard Régua E2E",
    vinculo: "amigo",
  });

  // sem consentimento declarado → não registra
  let res = await restComoUsuario(
    "rpc/registrar_resposta_terceiro_manual",
    jwt,
    { method: "POST", body: corpo({ p_contato_id: alvo.id, p_consentimento: false }) }
  );
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(await res.text()).toContain("autorizou");

  // via fora do vocabulário → não registra
  res = await restComoUsuario(
    "rpc/registrar_resposta_terceiro_manual",
    jwt,
    {
      method: "POST",
      body: corpo({ p_contato_id: alvo.id, p_coletado_via: "sinal de fumaça" }),
    }
  );
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(await res.text()).toContain("coletada");

  // feliz → grava (e o contato vira respondido)
  res = await restComoUsuario(
    "rpc/registrar_resposta_terceiro_manual",
    jwt,
    { method: "POST", body: corpo({ p_contato_id: alvo.id }) }
  );
  expect(res.ok).toBe(true);

  // replay → imutável: a resposta não pode ser alterada nem regrava
  res = await restComoUsuario(
    "rpc/registrar_resposta_terceiro_manual",
    jwt,
    {
      method: "POST",
      body: corpo({ p_contato_id: alvo.id, p_pontos_fortes: "Reescrito." }),
    }
  );
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(await res.text()).toContain("não pode ser alterada");

  // escopo: o jovem não é mentor nem coord da dupla → 'dupla não
  // encontrada' (a RPC esconde a existência, como no resto do sistema)
  const jwtJovem = await jwtDoUsuario(JOVEM_EMAIL, SENHA);
  const alvo2 = await inserirViaServiceRole("terceiros_contatos", {
    dupla_id: DUPLA_ID,
    nome: "Guard Escopo E2E",
    vinculo: "amigo",
  });
  res = await restComoUsuario(
    "rpc/registrar_resposta_terceiro_manual",
    jwtJovem,
    { method: "POST", body: corpo({ p_contato_id: alvo2.id }) }
  );
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(await res.text()).toContain("não encontrada");
});
