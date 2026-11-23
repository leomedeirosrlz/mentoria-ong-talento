import {
  agirComConfirma,
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  convergirDuplaAtiva,
  expect,
  inserirViaServiceRole,
  jwtDoUsuario,
  limparEncontrosDaDupla,
  limparViaServiceRole,
  loginComSenha,
  relogar,
  restComoUsuario,
  test,
} from "../helpers";

// Trilha de especialista — registro, devolutiva e encerramento (US3 da
// revisão REALIZA-510 / spec 015) contra backend real. Cobre o que os specs
// de pedido não cobriam:
//   1) o especialista registra a sessão realizada pela rota dedicada
//      (/duplas/[id]/registrar/[encontroId] com rótulos de "sessão") e a
//      linha de privacidade diz o que o mentor DPP lê — enquanto o jovem
//      nunca lê registro (RLS);
//   2) "Encerrar trilha" pela ficha (menu Mais do dono): motivo + devolutiva
//      pro PDM gravam na dupla esp, e o mentor DPP lê a devolutiva na ficha
//      DELE (DevolutivaEspecialista — sol.dupla_id → duplas.devolutiva_pdm
//      na view do mural);
//   3) quem não é da trilha não abre a ficha esp: o mentor DPP leva 404
//      (RLS esconde a row), o jovem volta pra /jovem, e na borda do PostgREST
//      a RPC de encerrar nega quem não é dono/coord.
//
// Personagens (mesmos do jovem-especialista*.spec.ts):
//   Mentor E2E (…0010) → dupla DPP ativa …0030 com o mentorado …0020
//   Jovem E2E (…00b0)  → mentorado …0020, trilha esp fixture …00e0 com
//                        Esp E2E (…0060)
const ESP_EMAIL = process.env.E2E_ESP_EMAIL ?? "esp-e2e@realiza.test";
const MENTOR_EMAIL = process.env.E2E_MENTOR_EMAIL ?? "mentor-e2e@realiza.test";
const JOVEM_EMAIL = process.env.E2E_JOVEM_EMAIL ?? "jovem-e2e@realiza.test";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";

const IDS = {
  jovemProfile: "e2e00000-0000-4000-8000-0000000000b0",
  mentorado: "e2e00000-0000-4000-8000-000000000020",
  duplaDpp: "e2e00000-0000-4000-8000-000000000030",
  duplaEsp: "e2e00000-0000-4000-8000-0000000000e0",
  mentorProfile: "e2e00000-0000-4000-8000-000000000010",
  espProfile: "e2e00000-0000-4000-8000-000000000060",
} as const;

const TEMA = "E2E-510: portfolio de design — primeira peça publicada";
const DEVOLUTIVA =
  "E2E-510: metas alcançadas — a Bia publicou a primeira peça e segue com o plano de estudos do PDM. Recomendação: revisar o portfólio a cada ciclo.";
const MOTIVO = "E2E-510: objetivos alcançados na 4ª sessão";

// sinos do fechamento (trilha_encerrada, 0104) e do feed (devolutiva_especialista)
const TIPOS_TRILHA = ["trilha_encerrada", "devolutiva_especialista"].join(",");
const PERFIS_SINO = `${IDS.jovemProfile},${IDS.mentorProfile},${IDS.espProfile}`;

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

/** Piso: trilha esp aberta e limpa — sem sols do mentorado, sem devolutivas,
 *  sem encontros do spec, sinos zerados e a dupla desfechada (um run morto
 *  no meio do encerramento não pode deixar a fixture encerrada pros demais
 *  specs que assumem ela ativa). */
async function convergirTrilha() {
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
  await limparViaServiceRole("devolutivas", `dupla_id=eq.${IDS.duplaEsp}`);
  await limparEncontrosDaDupla(IDS.duplaEsp);
  await limparViaServiceRole(
    "avaliacao_links",
    `dupla_id=eq.${IDS.duplaEsp}`
  );
  await limparViaServiceRole(
    "notificacoes",
    `profile_id=in.(${PERFIS_SINO})&tipo=in.(${TIPOS_TRILHA})`
  );
  // desfaz o carimbo do fechamento — o convergirDuplaAtiva comum não zera
  // devolutiva_pdm, então a trilha volta ao estado "aberta" completo
  await atualizarViaServiceRole("duplas", `id=eq.${IDS.duplaEsp}`, {
    status: "ativa",
    encerrada_em: null,
    motivo_encerramento: null,
    devolutiva_pdm: null,
  });
  await convergirDuplaAtiva(IDS.duplaDpp);
}

/** Encontro da trilha esp agendado pra ontem — o registro abre em limbo
 *  ("falta o registro"). `numero` na trilha esp é o passo, não a tentativa. */
async function criarSessaoVencida() {
  const ontem = new Date(Date.now() - 86400e3);
  ontem.setHours(19, 0, 0, 0);
  const enc = await inserirViaServiceRole("encontros", {
    dupla_id: IDS.duplaEsp,
    numero: 1,
    data_hora: ontem.toISOString(),
    status: "agendado",
    created_by: IDS.espProfile,
  });
  return String(enc.id);
}

test.describe("trilha de especialista — registro, devolutiva e encerramento", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(convergirTrilha);
  test.afterAll(convergirTrilha);

  test("especialista registra a sessão pela rota dedicada — e o jovem não lê registro", async ({
    page,
  }) => {
    const enc = await criarSessaoVencida();
    await loginComSenha(page, ESP_EMAIL, SENHA);
    await page.goto(`/duplas/${IDS.duplaEsp}/registrar/${enc}`);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Registrar sessão de especialista",
      })
    ).toBeVisible();
    // quem lê, honesto (K6/0092): equipe + mentor DPP leem; o jovem não vê
    await expect(
      page.getByText(
        "A equipe do programa e o mentor DPP do jovem leem este registro."
      )
    ).toBeVisible();

    const form = page.getByTestId("registro-form");
    // o radio é sr-only — clica no rótulo visível (mesma régua do spec DPP)
    await form.getByText("Sim", { exact: true }).click();
    const opcao60 = page.getByRole("option", { name: "1h", exact: true });
    await agirComConfirma(
      () => form.locator("#duracao-select").click(),
      () => opcao60.isVisible()
    );
    await opcao60.click();
    await agirComConfirma(
      () => form.getByRole("button", { name: "Avançar" }).click(),
      () => form.getByRole("heading", { name: /Passo 2 de 3/ }).isVisible()
    );
    await form.locator("#tema").fill(TEMA);
    await agirComConfirma(
      () => form.getByRole("button", { name: "Avançar" }).click(),
      () => form.getByRole("heading", { name: /Passo 3 de 3/ }).isVisible()
    );
    await agirComConfirma(
      () => form.getByRole("button", { name: "Salvar registro" }).click(),
      () => page.getByText(/Registro salvo/).first().isVisible()
    );

    const [salvo] = await buscarViaServiceRole<
      { status: string; duracao_min: number }[]
    >("encontros", `select=status,duracao_min&id=eq.${enc}`);
    expect(salvo.status).toBe("realizado");
    expect(salvo.duracao_min).toBe(60);
    const registros = await buscarViaServiceRole<{ id: string }[]>(
      "registros",
      `select=id&encontro_id=eq.${enc}`
    );
    expect(registros).toHaveLength(1);

    // o "privado" do fluxo: registro não é do jovem — a RLS devolve vazio
    // com o token dele (registros_select não inclui mentorado)
    const jwtJovem = await jwtDoUsuario(JOVEM_EMAIL, SENHA);
    const res = await restComoUsuario(
      `registros?encontro_id=eq.${enc}&select=id`,
      jwtJovem
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test("encerrar a trilha pela ficha — a devolutiva pro PDM chega ao mentor DPP", async ({
    page,
  }) => {
    // a sol que fundou a trilha (o mural projeta devolutiva_pdm por ela:
    // sol.dupla_id → duplas.devolutiva_pdm). O mentor DPP a lê na ficha
    // da dupla DELE — a ficha esp não é do escopo dele.
    await inserirViaServiceRole("solicitacoes_especialista", {
      mentorado_id: IDS.mentorado,
      dupla_dpp_id: IDS.duplaDpp,
      dupla_id: IDS.duplaEsp,
      especialista_id: IDS.espProfile,
      status: "aceita",
      origem: "mentor",
      created_by: IDS.mentorProfile,
    });

    await loginComSenha(page, ESP_EMAIL, SENHA);
    await page.goto(`/duplas/${IDS.duplaEsp}`);
    await page
      .getByRole("button", { name: "Mais ações da dupla" })
      .click();
    await page.getByRole("menuitem", { name: "Encerrar trilha" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", {
        name: "Encerrar a trilha de especialista",
      })
    ).toBeVisible();
    // decisão default é concluir; motivo e devolutiva são exigidos
    await expect(
      dialog.getByRole("radio", { name: /Concluir a trilha/ })
    ).toBeChecked();
    await dialog.locator("#trilha-motivo").fill(MOTIVO);
    await dialog.locator("#trilha-devolutiva").fill(DEVOLUTIVA);
    await agirComConfirma(
      () =>
        dialog
          .getByRole("button", { name: "Concluir a trilha" })
          .click(),
      () => page.getByText(/Trilha concluída/).first().isVisible()
    );

    // carimbo completo na dupla esp — o rito grava tudo num commit
    const [fechada] = await buscarViaServiceRole<
      {
        status: string;
        encerrada_em: string | null;
        motivo_encerramento: string | null;
        devolutiva_pdm: string | null;
      }[]
    >(
      "duplas",
      `select=status,encerrada_em,motivo_encerramento,devolutiva_pdm&id=eq.${IDS.duplaEsp}`
    );
    expect(fechada.status).toBe("concluida");
    expect(fechada.encerrada_em).not.toBeNull();
    expect(fechada.motivo_encerramento).toBe(MOTIVO);
    expect(fechada.devolutiva_pdm).toBe(DEVOLUTIVA);

    // quem pediu é avisado — o href leva pra ficha DPP, não pra ficha esp
    const sino = await buscarViaServiceRole<
      { tipo: string; href: string }[]
    >(
      "notificacoes",
      `select=tipo,href&profile_id=eq.${IDS.mentorProfile}&tipo=eq.trilha_encerrada`
    );
    expect(sino.length).toBe(1);
    expect(sino[0].href).toBe(`/duplas/${IDS.duplaDpp}`);

    // o mentor DPP lê a devolutiva na ficha da dupla dele — o card mora na
    // aba Pessoas (o sino aponta pra ficha sem aba; a leitura é por ali)
    await relogar(page, MENTOR_EMAIL, SENHA);
    await page.goto(`/duplas/${IDS.duplaDpp}?aba=pessoas`);
    await expect(
      page.getByRole("heading", { name: "Devolutiva do especialista" })
    ).toBeVisible();
    await expect(page.getByText(/Esp E2E fechou a trilha/)).toBeVisible();
    await expect(page.getByText(DEVOLUTIVA)).toBeVisible();
  });

  test("ficha da trilha esp não abre pra quem não é dela — UI nega e a RLS não vaza", async ({
    page,
  }) => {
    // mentor DPP: a ficha existe, mas a row é fora do escopo dele — a RLS
    // devolve vazio e a rota responde 404 (não vaza nem a existência)
    await loginComSenha(page, MENTOR_EMAIL, SENHA);
    await page.goto(`/duplas/${IDS.duplaEsp}`);
    await expect(page.getByText("Página não encontrada")).toBeVisible();

    // o jovem nem entra no grupo (app): o layout devolve ele pra home dele
    await relogar(page, JOVEM_EMAIL, SENHA);
    await page.goto(`/duplas/${IDS.duplaEsp}`);
    await page.waitForURL((u) => u.pathname === "/jovem", {
      timeout: 15_000,
    });

    // a mesma negação na borda PostgREST — dupla e feed invisíveis pro
    // mentor, e a RPC de fechamento recusa quem não é dono/coord
    const jwtMentor = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    const resDupla = await restComoUsuario(
      `duplas?id=eq.${IDS.duplaEsp}&select=id`,
      jwtMentor
    );
    expect(await resDupla.json()).toEqual([]);
    const resFeed = await restComoUsuario(
      `devolutivas?dupla_id=eq.${IDS.duplaEsp}&select=id`,
      jwtMentor
    );
    expect(await resFeed.json()).toEqual([]);
    const resEncerrar = await restComoUsuario(
      "rpc/encerrar_trilha_especialista",
      jwtMentor,
      {
        method: "POST",
        body: {
          p_dupla: IDS.duplaEsp,
          p_tipo: "encerrada",
          p_motivo: "tentativa de fora",
          p_devolutiva: "tentativa de fora da trilha",
        },
      }
    );
    expect(resEncerrar.status).toBe(400);
    expect(await resEncerrar.text()).toContain(
      "especialista da dupla ou a coordenação"
    );
  });
});
