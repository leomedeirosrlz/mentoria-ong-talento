import {
  appEnvOk,
  buscarViaServiceRole,
  convergirDuplaAtiva,
  expect,
  limparViaServiceRole,
  loginComSenha,
  relogar,
  test,
} from "../helpers";

// WP6 — especialista do lado do jovem, contra backend real:
//   1) o mentor DPP SUGERE um especialista na ficha da dupla — nasce
//      'sugerida' (origem mentor), fora dos tetos e fora do mural da
//      coordenação, esperando a resposta do jovem;
//   2) o jovem CONFIRMA na página /jovem/especialistas — a sol vira
//      'aberta' dirigida, o especialista e o mentor autor são avisados;
//   3) caminho alternativo: o jovem DISPENSA — vira 'cancelada' e some;
//   4) devolutivas datadas: o especialista posta na ficha da trilha esp,
//      o jovem lê o feed na página dele e recebe o sino;
//   5) o catálogo do jovem inclui o mentor HÍBRIDO (papel primário
//      mentor_dpp + mentor_especialista em profile_papeis) — a view filtra
//      por has_papel, não pelo role primário.
//
// Personagens do seed e2e (mesmos do jovem-especialista.spec.ts):
//   Mentor E2E (…0010) → dupla DPP ativa …0030 com o mentorado …0020
//   Jovem E2E (…00b0)  → mentorado …0020, trilha esp fixture …00e0 com
//                        Esp E2E (…0060, ativa — o seed reativa)
//   Esp Dois E2E (…00c0) → alvo da sugestão dirigida
//   Mentor E2E Híbrido (…0110) → role mentor_dpp + papel mentor_especialista

const MENTOR_EMAIL = process.env.E2E_MENTOR_EMAIL ?? "mentor-e2e@realiza.test";
const JOVEM_EMAIL = process.env.E2E_JOVEM_EMAIL ?? "jovem-e2e@realiza.test";
const ESP_EMAIL = process.env.E2E_ESP_EMAIL ?? "esp-e2e@realiza.test";
const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "coord-e2e@realiza.test";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";

const IDS = {
  jovemProfile: "e2e00000-0000-4000-8000-0000000000b0",
  mentorado: "e2e00000-0000-4000-8000-000000000020",
  duplaDpp: "e2e00000-0000-4000-8000-000000000030",
  duplaEsp: "e2e00000-0000-4000-8000-0000000000e0",
  mentorProfile: "e2e00000-0000-4000-8000-000000000010",
  espProfile: "e2e00000-0000-4000-8000-000000000060",
  esp2Profile: "e2e00000-0000-4000-8000-0000000000c0",
  coordProfile: "e2e00000-0000-4000-8000-000000000040",
} as const;

const DEMANDA_SUG =
  "E2E-139: a Bia quer montar um portfólio de design — alguém de produto destrava.";
const DEMANDA_DISP =
  "E2E-139: sugestão dispensada — a Bia decidiu que não é prioridade agora.";
const TEXTO_DEVOLUTIVA =
  "E2E-146: devolutiva da sessão — a Bia destravou o cronograma de estudos e combinou o plano da próxima semana.";

// tipos de sino que o fluxo WP6 dispara — limpeza conta só com eles
const TIPOS_WP6 = [
  "sugestao_especialista",
  "devolutiva_especialista",
  "solicitacao_registrada",
  "demanda_especialista",
].join(",");
const PERFIS_SINO = `${IDS.jovemProfile},${IDS.mentorProfile},${IDS.espProfile},${IDS.esp2Profile},${IDS.coordProfile}`;

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

/** Piso do spec: sem sols do mentorado …0020, sem devolutivas da trilha
 *  fixture, sinos zerados. Run morta no meio não deixa resíduo. */
async function convergirWp6() {
  const sols = await buscarViaServiceRole<{ id: string }[]>(
    "solicitacoes_especialista",
    `select=id&mentorado_id=eq.${IDS.mentorado}`
  );
  if (sols.length) {
    const csv = sols.map((s) => s.id).join(",");
    await limparViaServiceRole(
      "solicitacao_propostas",
      `solicitacao_id=in.(${csv})`
    );
    await limparViaServiceRole("solicitacoes_especialista", `id=in.(${csv})`);
  }
  await limparViaServiceRole(
    "devolutivas",
    `dupla_id=eq.${IDS.duplaEsp}`
  );
  await limparViaServiceRole(
    "notificacoes",
    `profile_id=in.(${PERFIS_SINO})&tipo=in.(${TIPOS_WP6})`
  );
  // a ficha da dupla DPP hospedeira tem que estar ativa — 'concluida' ela
  // fica read-only e o botão "Mais" (que abre a sugestão) nem renderiza
  await convergirDuplaAtiva(IDS.duplaDpp);
}

/** Única sol do mentorado, na forma que os asserts esperam. */
async function solDoJovem() {
  const rows = await buscarViaServiceRole<
    {
      id: string;
      status: string;
      origem: string;
      demanda: string | null;
      motivo: string | null;
      especialista_desejado_id: string | null;
      created_by: string | null;
      dupla_dpp_id: string | null;
    }[]
  >(
    "solicitacoes_especialista",
    `select=id,status,origem,demanda,motivo,especialista_desejado_id,created_by,dupla_dpp_id&mentorado_id=eq.${IDS.mentorado}&order=created_at.desc&limit=1`
  );
  return rows[0] ?? null;
}

test.describe("WP6 — especialista do lado do jovem", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(convergirWp6);
  test.afterAll(convergirWp6);

  test("mentor sugere → jovem confirma → pedido dirigido nasce 'aberta'", async ({
    page,
  }) => {
    // 3 logins + 4 server actions + queries service-role — o teto global de
    // 30s estoura no preview frio (a run 39386682715 morreu no 2º relogar)
    test.setTimeout(90_000);
    // --- o mentor DPP registra a sugestão na ficha da dupla ---
    await loginComSenha(page, MENTOR_EMAIL, SENHA);
    await page.goto(`/duplas/${IDS.duplaDpp}`);
    await page
      .getByRole("button", { name: "Mais ações da dupla" })
      .click();
    await page
      .getByRole("menuitem", { name: /Sugerir especialista pro jovem/ })
      .click();
    await page.locator("#sug-mentor-demanda").fill(DEMANDA_SUG);
    await page
      .locator("#sug-mentor-objetivo")
      .fill("Destravar a entrega do projeto");
    await page.locator("#sug-mentor-esp").click();
    await page.getByRole("option", { name: /Esp Dois E2E/ }).click();
    await page
      .getByRole("button", { name: /Registrar sugestão/ })
      .click();
    await expect(
      page.getByText(/confirma ou ajusta na página de especialistas/i)
    ).toBeVisible({ timeout: 15_000 });

    // nasceu 'sugerida', origem mentor, autor o mentor — fora dos tetos
    let sol = await solDoJovem();
    expect(sol).not.toBeNull();
    expect(sol!.status).toBe("sugerida");
    expect(sol!.origem).toBe("mentor");
    expect(sol!.created_by).toBe(IDS.mentorProfile);
    expect(sol!.dupla_dpp_id).toBe(IDS.duplaDpp);
    expect(sol!.especialista_desejado_id).toBe(IDS.esp2Profile);

    // o sino chegou pro jovem
    const sinoJovem = await buscarViaServiceRole<{ tipo: string }[]>(
      "notificacoes",
      `select=tipo&profile_id=eq.${IDS.jovemProfile}&tipo=eq.sugestao_especialista`
    );
    expect(sinoJovem.length).toBe(1);

    // fora do mural da coordenação: a home staff lista 'aberta' e
    // 'contra_proposta' — 'sugerida' não pode aparecer lá
    await relogar(page, COORD_EMAIL, SENHA);
    await page.goto("/");
    await expect(
      page
        .locator('section[aria-label="Pedidos de mentoria especializada"]')
        .getByText(DEMANDA_SUG)
    ).toHaveCount(0);

    // --- o jovem vê a sugestão COM O NOME DO AUTOR, não "Seu mentor" ---
    // RLS impede o jovem de ler profiles do autor: a query costura o nome
    // via jovem_contatos (o mentor dele já é contato). Sem o stitch cai no
    // fallback "Seu mentor sugeriu…" — este assert trava o bug.
    await relogar(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem");
    const cardHome = page.locator('section[aria-labelledby="esp-titulo"]');
    // o card inteiro é o link — título "1 sugestão esperando você", sub
    // com o primeiro nome do autor ("Mentor sugeriu…", o stitch do RLS)
    await expect(
      cardHome.getByText("1 sugestão esperando você")
    ).toBeVisible();
    await expect(
      cardHome.getByText(/Mentor sugeriu um especialista pra você/)
    ).toBeVisible();
    await expect(cardHome.getByRole("link")).toHaveAttribute(
      "href",
      "/jovem/especialistas"
    );

    await page.goto("/jovem/especialistas");
    await expect(
      page.getByText("Mentor E2E sugeriu um especialista pra você")
    ).toBeVisible();
    await expect(page.getByText(/Pensando em:/)).toBeVisible();
    await expect(page.getByText("Esp Dois E2E").first()).toBeVisible();
    await expect(page.getByText(DEMANDA_SUG)).toBeVisible();
    await page.getByRole("button", { name: /Quero seguir/ }).click();
    await page
      .getByRole("button", { name: /Enviar pedido/ })
      .click();
    await expect(
      page.getByText(/Pedido enviado/i)
    ).toBeVisible({ timeout: 15_000 });

    // virou pedido real: 'aberta' e dirigida ao esp2
    sol = await solDoJovem();
    expect(sol!.status).toBe("aberta");
    expect(sol!.especialista_desejado_id).toBe(IDS.esp2Profile);

    // o card-CTA da home troca de estado: a sugestão saiu e a prioridade
    // cai pra trilha em andamento sem horário (pedido dirigido aberto
    // apareceria na negociação, mas a trilha viva com o Esp E2E ganha)
    await page.goto("/jovem");
    await expect(
      cardHome.getByText(/A sessão \d ainda precisa de horário/)
    ).toBeVisible();
    await expect(cardHome.getByRole("link")).toHaveAttribute(
      "href",
      "/jovem/especialistas#trilhas"
    );

    // o especialista foi avisado; o mentor autor também
    const sinos = await buscarViaServiceRole<
      { profile_id: string; tipo: string }[]
    >(
      "notificacoes",
      `select=profile_id,tipo&profile_id=in.(${IDS.esp2Profile},${IDS.mentorProfile})&tipo=in.(demanda_especialista,solicitacao_registrada)`
    );
    expect(
      sinos.some(
        (n) =>
          n.profile_id === IDS.esp2Profile && n.tipo === "demanda_especialista"
      )
    ).toBe(true);
    expect(
      sinos.some(
        (n) =>
          n.profile_id === IDS.mentorProfile &&
          n.tipo === "solicitacao_registrada"
      )
    ).toBe(true);
  });

  test("sugestão pendente única + jovem dispensa → 'cancelada'", async ({
    page,
  }) => {
    await loginComSenha(page, MENTOR_EMAIL, SENHA);
    await page.goto(`/duplas/${IDS.duplaDpp}`);
    await page
      .getByRole("button", { name: "Mais ações da dupla" })
      .click();
    await page
      .getByRole("menuitem", { name: /Sugerir especialista pro jovem/ })
      .click();
    await page.locator("#sug-mentor-demanda").fill(DEMANDA_DISP);
    await page
      .getByRole("button", { name: /Registrar sugestão/ })
      .click();
    await expect(
      page.getByText(/confirma ou ajusta na página de especialistas/i)
    ).toBeVisible({ timeout: 15_000 });

    // com a sugestão pendente, o gesto some do menu (a RPC também deduplica)
    await page.reload();
    await page
      .getByRole("button", { name: "Mais ações da dupla" })
      .click();
    await expect(
      page.getByRole("menuitem", { name: /Sugerir especialista pro jovem/ })
    ).toHaveCount(0);
    await page.keyboard.press("Escape");

    // o jovem dispensa — a sol vira 'cancelada' e sai de vista
    await relogar(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem/especialistas");
    await expect(
      page.getByText(/sugeriu um especialista pra você/i)
    ).toBeVisible();
    await page.getByRole("button", { name: /Agora não/ }).click();
    await expect(
      page.getByText(/Sugestão dispensada/i)
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/sugeriu um especialista pra você/i)
    ).toHaveCount(0);

    const sol = await solDoJovem();
    expect(sol!.status).toBe("cancelada");
  });

  test("especialista posta devolutiva → jovem lê o feed datado", async ({
    page,
  }) => {
    await loginComSenha(page, ESP_EMAIL, SENHA);
    // o feed mora na aba Encontros da ficha da trilha
    await page.goto(`/duplas/${IDS.duplaEsp}?aba=encontros`);
    await expect(
      page.getByRole("heading", { name: /Devolutivas da trilha/i })
    ).toBeVisible();
    await page.getByLabel("Nova devolutiva").fill(TEXTO_DEVOLUTIVA);
    await page
      .getByRole("button", { name: /Postar devolutiva/ })
      .click();
    await expect(
      page.getByText(/Devolutiva registrada/i)
    ).toBeVisible({ timeout: 15_000 });

    // gravou com o autor certo
    const feed = await buscarViaServiceRole<
      { autor_id: string; texto: string }[]
    >(
      "devolutivas",
      `select=autor_id,texto&dupla_id=eq.${IDS.duplaEsp}&order=created_at.desc&limit=1`
    );
    expect(feed[0]?.autor_id).toBe(IDS.espProfile);
    expect(feed[0]?.texto).toBe(TEXTO_DEVOLUTIVA);

    // o jovem recebeu o sino e lê a devolutiva na página dele
    const sino = await buscarViaServiceRole<{ tipo: string }[]>(
      "notificacoes",
      `select=tipo&profile_id=eq.${IDS.jovemProfile}&tipo=eq.devolutiva_especialista`
    );
    expect(sino.length).toBe(1);

    await relogar(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem/especialistas");
    // feed datado dentro do card da trilha — stepper de 5 passos + feed
    const trilha = page.locator("section#trilhas");
    await expect(
      trilha.locator('ol[aria-label="Passos da trilha"] li')
    ).toHaveCount(5);
    await expect(trilha.getByText("Devolutivas da trilha")).toBeVisible();
    await expect(trilha.getByText(TEXTO_DEVOLUTIVA)).toBeVisible();
    // autor assinado — o jovem lê quem escreveu
    await expect(trilha.getByText(/Esp E2E ·/)).toBeVisible();
  });

  test("mentor híbrido aparece no catálogo do jovem (has_papel)", async ({
    page,
  }) => {
    // role primário mentor_dpp — antes da 0087 o catálogo pulava ele
    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem/especialistas");
    await expect(
      page.getByText("Mentor E2E Híbrido").first()
    ).toBeVisible();
  });
});
