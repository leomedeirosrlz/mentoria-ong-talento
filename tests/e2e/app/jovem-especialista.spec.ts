import {
  agirComConfirma,
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  convergirDuplaAtiva,
  expect,
  inserirViaServiceRole,
  isoDoRotulo,
  limparDuplas,
  limparEncontrosDaDupla,
  limparViaServiceRole,
  loginComSenha,
  relogar,
  rpcViaServiceRole,
  test,
} from "../helpers";
import type { Page } from "@playwright/test";

// O lado JOVEM do pedido de especialista (REALIZA-112 PR2 / migrations
// 0073–0075) contra backend real — a vertical inteira pela UI. WP6-R2
// (REALIZA-139/146) mudou o endereço: a home /jovem ficou só com o
// card-CTA vivo e a mesa de pedidos + o cardápio foram pra
// /jovem/especialistas — os asserts de pedido leem a seção #pedidos de lá:
//   1) home /jovem: o card-CTA — trilha sem horário pro jovem com trilha,
//      seção ausente pra quem não tem nada (o convite quieto saiu);
//   2) pedido DIRIGIDO com slot da grade real — par novo, então a demanda
//      rica é exigida (o gate é por PAR: a trilha ativa do jovem é com OUTRO
//      especialista, não libera motivo-curto pro alvo novo — bug que este
//      spec pegou e o fix do PR cobre);
//   3) dedup por par — a RPC segura o segundo pedido pro mesmo especialista
//      e a UI devolve a mensagem dela como veio;
//   4) broadcast "qualquer especialista" — nasce no mural e o especialista
//      vê o pedido com o nome do jovem;
//   5) negociação no rail do jovem — a contra-proposta do especialista é
//      aceita pelo jovem e a sessão nasce na dupla criada na hora;
//   6) jovem sem DPP: demanda obrigatória + pedido cai 'aguardando_coord'
//      (triagem da coordenação) em vez do mural;
//   7) cancelamento — o autor cancela, o registro fica 'cancelada' e o
//      especialista procurado é avisado.
//
// Personagens do seed e2e:
//   Jovem E2E (…00b0) → mentorado …0020, dupla DPP …0030, trilha esp
//                       fixture …00e0 com Esp E2E (…0060);
//   Esp Dois E2E (…00c0) → o par NOVO — grade própria (quinta 19–21, id
//                       fixture …00e1) pros slots do pedido/contra-proposta;
//   Jovem E2E Sem DPP (…00f0) → mentorado …00d0, sem dupla DPP ATIVA — a
//                       dupla pausada dele (fixture do diretório, 0076) não
//                       conta pra triagem nem pro gate de demanda.

const JOVEM_EMAIL = process.env.E2E_JOVEM_EMAIL ?? "jovem-e2e@realiza.test";
const JOVEM2_EMAIL = process.env.E2E_JOVEM2_EMAIL ?? "jovem2-e2e@realiza.test";
const ESP_EMAIL = process.env.E2E_ESP_EMAIL ?? "esp-e2e@realiza.test";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";

const IDS = {
  jovemProfile: "e2e00000-0000-4000-8000-0000000000b0",
  jovem2Profile: "e2e00000-0000-4000-8000-0000000000f0",
  mentorado: "e2e00000-0000-4000-8000-000000000020", // a ficha do jovem
  mentoradoSemDpp: "e2e00000-0000-4000-8000-0000000000d0", // a do jovem2
  duplaDpp: "e2e00000-0000-4000-8000-000000000030",
  // a trilha fixture (esp 0060 × 0020) — o "já tenho especialista" do jovem;
  // o cleanup NUNCA mexe nela (só nos encontros que os testes nela criam)
  duplaEsp: "e2e00000-0000-4000-8000-0000000000e0",
  espProfile: "e2e00000-0000-4000-8000-000000000060",
  esp2Profile: "e2e00000-0000-4000-8000-0000000000c0",
  gradeEsp2: "e2e00000-0000-4000-8000-0000000000e1",
  mentorProfile: "e2e00000-0000-4000-8000-000000000010",
  coordProfile: "e2e00000-0000-4000-8000-000000000040",
  // sols semeadas pelo spec (dedup, negociação, cancelamento)
  solDedup: "e2e00000-0000-4000-8000-0000000001d1",
  solContra: "e2e00000-0000-4000-8000-0000000001d2",
  solCancela: "e2e00000-0000-4000-8000-0000000001d3",
} as const;
const MENTORADOS_JOVEM = `${IDS.mentorado},${IDS.mentoradoSemDpp}`;
// todos os tipos de sino que a máquina de solicitação dispara — o cleanup
// zera nos profiles e2e pra assert de notificação contar só o teste
const TIPOS_SOL = [
  "solicitacao_recusada",
  "solicitacao_proposta",
  "especialista_aceitou",
  "demanda_especialista",
  "solicitacao_registrada",
  "solicitacao_cancelada",
  "solicitacao_triagem",
].join(",");
// demandas/motivos com prefixo único — o escopo dos asserts é o próprio texto
const DEMANDA_DIRIGIDA =
  "E2E-112J: preciso de ajuda pra montar meu primeiro currículo — nunca fiz um.";
const DEMANDA_DEDUP =
  "E2E-112J: dedup — quero treinar entrevista de emprego com o especialista.";
const DEMANDA_DEDUP_2 =
  "E2E-112J: dedup — segundo pedido pro mesmo especialista, tem que barrar.";
const MOTIVO_MURAL = "E2E-112J: quero treinar pra entrevista com qualquer especialista.";
const MOTIVO_CONTRA = "E2E-112J: revisar meu projeto de vida — qualquer horário serve.";
const DEMANDA_SEM_DPP =
  "E2E-112J: quero apoio pra decidir o curso técnico — ainda não tenho mentor.";
const DEMANDA_CANCELA =
  "E2E-112J: cancelamento — mudei de ideia sobre a sessão de planejamento.";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

/** epoch fecha a conta sem depender do formato — PostgREST devolve
 *  timestamptz em +00:00, o slot da RPC idem. */
const ms = (iso: string) => new Date(iso).getTime();

/** Seção Especialistas da home do jovem — o card-CTA vivo (sugestão >
 *  trilha > pedido > convite) que linka pra /jovem/especialistas. */
const secaoEsp = (page: Page) =>
  page.locator('section[aria-labelledby="esp-titulo"]');

/** A mesa de pedidos do jovem — seção "Pedidos em aberto" da página
 *  /jovem/especialistas (só renderiza quando há pedido visível; os asserts
 *  de contagem-zero leem o locator vazio igual). */
const secaoPedidos = (page: Page) => page.locator("section#pedidos");

/** Mural do especialista — section rotulada da home staff. */
const mural = (page: Page) =>
  page.locator('section[aria-label="Pedidos de mentoria especializada"]');

/** A lista do mural mora num <details> fechado por padrão (rodada
 *  out/2026) — abre antes de ler os cards. Idempotente. */
async function abrirMural(page: Page) {
  const det = page.locator("details#mural-especialista");
  await det.locator("summary").waitFor({ state: "visible", timeout: 15_000 });
  if (!(await det.evaluate((el) => el.hasAttribute("open")))) {
    await det.locator("summary").click();
  }
}

/** A turma real da dupla — o sol semeado carrega a da dupla DPP, como o
 *  insert da RPC faz (sol_efetivar usa a turma da sol pro par). */
async function turmaDa(duplaId: string): Promise<string | null> {
  const [d] = await buscarViaServiceRole<{ turma: string | null }[]>(
    "duplas",
    `select=turma&id=eq.${duplaId}`
  );
  return d?.turma ?? null;
}

/** Slots livres REAIS do especialista, direto da RPC do banco — os mesmos
 *  que a agenda e o dialog mostram. Janela de 21 dias, datas no fuso do
 *  app (a RPC interpreta date no calendário local). */
async function slotsLivresDe(espId: string): Promise<string[]> {
  const dia = (offsetDias: number) => {
    const d = new Date(Date.now() + offsetDias * 86_400_000);
    return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  };
  const rows = await rpcViaServiceRole<{ inicio: string }[]>(
    "especialista_slots_livres",
    { p_especialista: espId, p_desde: dia(0), p_ate: dia(21) }
  );
  return rows.map((r) => r.inicio);
}

/** Compromissos vivos do jovem (todas as trilhas) — a efetivação recusa
 *  slot que bate num encontro dele, mesmo em dupla que o esp não vê. */
async function encontrosVivosJovem(): Promise<
  { data_hora: string; duracao_min: number | null }[]
> {
  const duplas = await buscarViaServiceRole<{ id: string }[]>(
    "duplas",
    `select=id&mentorado_id=eq.${IDS.mentorado}`
  );
  if (!duplas.length) return [];
  return buscarViaServiceRole(
    "encontros",
    `select=data_hora,duracao_min&dupla_id=in.(${duplas
      .map((d) => d.id)
      .join(",")})&status=in.(agendado,remarcado)&data_hora=not.is.null`
  );
}

/** Mesma regra do sol_efetivar: o encontro existente se sobrepõe ao slot
 *  proposto ([início, início+duração) × [slot, slot+1h)). */
function conflita(
  slot: string,
  encontros: { data_hora: string; duracao_min: number | null }[]
): boolean {
  const t = ms(slot);
  return encontros.some((e) => {
    const ini = ms(e.data_hora);
    const fim = ini + (e.duracao_min ?? 60) * 60_000;
    return ini < t + 3_600_000 && fim > t;
  });
}

/** Piso do spec: nem uma solicitação viva nos mentorados e2e (dos dois
 *  jovens), nenhuma dupla esp além da fixture …00e0 e a grade do esp2 de
 *  pé (os slots dos testes saem dela). Ordem FK-safe: zera a aresta
 *  dupla→sol antes, mata a thread, mata a sol, mata filhos da dupla, mata
 *  a dupla. Roda em beforeEach E afterAll — run morto no meio não deixa
 *  resíduo pro próximo (e o retry do CI converge). */
async function convergirSolicitacoes() {
  // aresta circular dupla↔solicitação (0028) nos dois sentidos
  await atualizarViaServiceRole(
    "duplas",
    `mentorado_id=in.(${MENTORADOS_JOVEM})&solicitacao_id=not.is.null`,
    { solicitacao_id: null }
  );
  const sols = await buscarViaServiceRole<{ id: string }[]>(
    "solicitacoes_especialista",
    `select=id&mentorado_id=in.(${MENTORADOS_JOVEM})`
  );
  if (sols.length) {
    const csv = sols.map((s) => s.id).join(",");
    await limparViaServiceRole(
      "solicitacao_propostas",
      `solicitacao_id=in.(${csv})`
    );
    await limparViaServiceRole("solicitacoes_especialista", `id=in.(${csv})`);
  }
  // duplas esp fora da fixture — a que o aceite do teste criou (esp2 ×
  // 0020) e restos de runs mortos; a fixture …00e0 NUNCA entra aqui.
  // limparDuplas cobre os filhos NO ACTION novos (formulario_links 0099,
  // encerramentos da 0102, remanejada_de) que o delete direto 409ava.
  const espExtras = await buscarViaServiceRole<{ id: string }[]>(
    "duplas",
    `select=id&mentorado_id=in.(${MENTORADOS_JOVEM})&trilha=eq.especialista&id=not.eq.${IDS.duplaEsp}`
  );
  await limparDuplas(espExtras.map((d) => d.id));
  // a trilha fixture volta ao estado do seed — sem tentativa nenhuma
  await limparEncontrosDaDupla(IDS.duplaEsp);
  // sino limpo: as asserts de notificação contam só o que o teste disparou
  await limparViaServiceRole(
    "notificacoes",
    `profile_id=in.(${IDS.jovemProfile},${IDS.jovem2Profile},${IDS.espProfile},${IDS.esp2Profile},${IDS.mentorProfile},${IDS.coordProfile})&tipo=in.(${TIPOS_SOL})`
  );
  // a grade do esp2 é fixture do seed — se alguém rodou o spec sem seeder
  // ela é recriada aqui (o slot do pedido sai da agenda REAL dele)
  const grade = await buscarViaServiceRole<{ id: string }[]>(
    "especialista_grade",
    `select=id&profile_id=eq.${IDS.esp2Profile}&limit=1`
  );
  if (!grade.length) {
    await inserirViaServiceRole("especialista_grade", {
      id: IDS.gradeEsp2,
      profile_id: IDS.esp2Profile,
      dia_semana: 4, // quinta — dia diferente do esp1 (terça), sem colisão
      hora_inicio: "19:00",
      hora_fim: "21:00",
    });
  }
  // a dupla DPP do jovem é a hospedeira dos pedidos — se um spec vizinho a
  // deixou 'concluida' (trigger da âncora 16), a home e os gates mudam
  await convergirDuplaAtiva(IDS.duplaDpp);
}

test.describe("pedido de especialista pelo jovem (REALIZA-112 PR2)", () => {
  test.describe.configure({ mode: "serial" }); // os sols encadeiam estado
  test.beforeEach(convergirSolicitacoes);
  test.afterAll(convergirSolicitacoes);

  test("home /jovem: o card-CTA — trilha em andamento × convite quieto", async ({
    page,
  }) => {
    // piso garantido pela convergência: nenhum pedido do jovem no banco —
    // pra ele o card mais urgente é a trilha esp fixture (…00e0, ativa)
    const sols = await buscarViaServiceRole(
      "solicitacoes_especialista",
      `select=id&mentorado_id=eq.${IDS.mentorado}`
    );
    expect(sols).toHaveLength(0);

    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem");

    const secao = secaoEsp(page);
    await expect(
      secao.getByRole("heading", { name: "Especialistas" })
    ).toBeVisible();
    // estado "trilha em andamento sem horário": o card inteiro é o gesto —
    // título "A sessão N ainda precisa de horário", sub com tema do pedido
    // + esp (o cleanup zera os encontros dela)
    await expect(
      secao.getByText(/A sessão \d ainda precisa de horário/)
    ).toBeVisible();
    await expect(
      secao.getByText(/mentoria especializada \(vestibular e rotina de estudos\)\.? com Esp/i)
    ).toBeVisible();
    // o gesto é ir pra página — o card é o link e ancora nas trilhas
    const link = secao.getByRole("link");
    await expect(link).toHaveAttribute(
      "href",
      "/jovem/especialistas#trilhas"
    );

    // jovem2 — sem trilha nem pedido: a seção some da home (ela só aparece
    // com ação; o convite quieto saiu no redesign) e a página de
    // especialistas segue aberta direto, com o cardápio pra ele
    await relogar(page, JOVEM2_EMAIL, SENHA);
    await page.goto("/jovem");
    await expect(secaoEsp(page)).toHaveCount(0);
    await page.goto("/jovem/especialistas");
    await expect(
      page.getByRole("heading", { name: "Especialistas" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Pedir trilha" })
    ).toBeVisible();
  });

  test("pedido dirigido com slot da grade grava de verdade", async ({
    page,
  }) => {
    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem/especialistas");
    const secao = secaoPedidos(page);
    const dialog = page.getByRole("dialog");

    // o gesto "pedir" mora no cardápio — um dialog compartilhado pra página
    await agirComConfirma(
      () => page.getByRole("button", { name: "Pedir trilha" }).click(),
      () => dialog.isVisible()
    );

    // dirigido — e o alvo é um par NOVO (a trilha viva do jovem é com o
    // outro especialista): o gate por par exige a demanda rica
    await agirComConfirma(
      () =>
        dialog
          .getByRole("button", { name: "Um especialista específico" })
          .click(),
      async () =>
        (await dialog
          .getByRole("button", { name: "Um especialista específico" })
          .getAttribute("aria-pressed")) === "true"
    );
    await agirComConfirma(
      () => dialog.getByRole("button", { name: "Esp Dois E2E" }).click(),
      async () =>
        (await dialog
          .getByRole("button", { name: "Esp Dois E2E" })
          .getAttribute("aria-pressed")) === "true"
    );

    // os chips são os horários livres reais da grade do esp2 (carregados
    // on-demand pela action) — o "Deixar Esp propor" não conta
    const chips = dialog.getByRole("button", { name: / às \d{2}:\d{2}/ });
    await expect(chips.first()).toBeVisible({ timeout: 15_000 });
    const qtd = await chips.count();
    const chip = chips.nth(qtd > 1 ? 1 : 0);
    const rotulo = (await chip.textContent())!.trim();
    const isoEscolhido = isoDoRotulo(rotulo);
    await agirComConfirma(
      () => chip.click(),
      async () => (await chip.getAttribute("aria-pressed")) === "true"
    );

    // par novo ⇒ a pergunta é a demanda (mínimo 10), não o motivo-curto
    await expect(
      dialog.getByText("Por que você quer esse apoio?")
    ).toBeVisible();
    await dialog.locator("#pedido-texto").fill(DEMANDA_DIRIGIDA);
    await agirComConfirma(
      () => dialog.getByRole("button", { name: "Enviar pedido" }).click(),
      async () =>
        (
          await buscarViaServiceRole(
            "solicitacoes_especialista",
            `select=id&mentorado_id=eq.${IDS.mentorado}&especialista_desejado_id=eq.${IDS.esp2Profile}`
          )
        ).length > 0
    );
    await expect(dialog).toBeHidden();

    // o pedido nasceu exatamente como a RPC promete: jovem, dirigido,
    // aberto (tem DPP), com o slot escolhido
    const [sol] = await buscarViaServiceRole<
      {
        id: string;
        status: string;
        origem: string;
        mentorado_id: string;
        dupla_dpp_id: string | null;
        especialista_desejado_id: string | null;
        especialista_id: string | null;
        slot_proposto: string | null;
        demanda: string | null;
        motivo: string | null;
        created_by: string | null;
        dupla_id: string | null;
      }[]
    >(
      "solicitacoes_especialista",
      `select=id,status,origem,mentorado_id,dupla_dpp_id,especialista_desejado_id,especialista_id,slot_proposto,demanda,motivo,created_by,dupla_id&mentorado_id=eq.${IDS.mentorado}&order=created_at.desc&limit=1`
    );
    expect(sol.status).toBe("aberta");
    expect(sol.origem).toBe("jovem");
    expect(sol.mentorado_id).toBe(IDS.mentorado);
    expect(sol.dupla_dpp_id).toBe(IDS.duplaDpp);
    expect(sol.especialista_desejado_id).toBe(IDS.esp2Profile);
    expect(sol.especialista_id).toBeNull();
    expect(sol.dupla_id).toBeNull();
    expect(sol.demanda).toBe(DEMANDA_DIRIGIDA);
    expect(sol.motivo).toBeNull();
    expect(sol.created_by).toBe(IDS.jovemProfile);
    expect(ms(sol.slot_proposto!)).toBe(ms(isoEscolhido));

    // quem recebe o sino: o especialista procurado (demanda_especialista)
    // e o mentor DPP do jovem (solicitacao_registrada)
    const notifs = await buscarViaServiceRole<{ tipo: string }[]>(
      "notificacoes",
      `select=tipo&profile_id=in.(${IDS.esp2Profile},${IDS.mentorProfile})&tipo=in.(${TIPOS_SOL})`
    );
    expect(notifs.map((n) => n.tipo).sort()).toEqual(
      ["demanda_especialista", "solicitacao_registrada"].sort()
    );

    // e a página do jovem conta o estado na voz dele — sem refresh manual:
    // a action já rodou router.refresh()
    const item = secao.locator("li", { hasText: "Sessão com Esp" });
    await expect(
      item.getByText("Esperando Esp responder.")
    ).toBeVisible();
    await expect(item.getByText(/Horário na mesa:/)).toBeVisible();
    await expect(
      item.getByText("Aguardando Esp Dois E2E responder.")
    ).toBeVisible();
  });

  test("dedup por par: o segundo pedido pro mesmo especialista é recusado", async ({
    page,
  }) => {
    // bloqueio semeado: pedido aberto do jovem dirigido ao esp2
    await inserirViaServiceRole("solicitacoes_especialista", {
      id: IDS.solDedup,
      mentorado_id: IDS.mentorado,
      dupla_dpp_id: IDS.duplaDpp,
      demanda: DEMANDA_DEDUP,
      especialista_desejado_id: IDS.esp2Profile,
      origem: "jovem",
      status: "aberta",
      turma: await turmaDa(IDS.duplaDpp),
      created_by: IDS.jovemProfile,
    });

    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem/especialistas");
    const secao = secaoPedidos(page);
    // o pedido em aberto já aparece na lista — o gesto segue o mesmo dialog
    await expect(
      secao.getByText("Esperando Esp responder.")
    ).toBeVisible();
    const dialog = page.getByRole("dialog");
    await agirComConfirma(
      () => page.getByRole("button", { name: "Pedir trilha" }).click(),
      () => dialog.isVisible()
    );
    await agirComConfirma(
      () =>
        dialog
          .getByRole("button", { name: "Um especialista específico" })
          .click(),
      async () =>
        (await dialog
          .getByRole("button", { name: "Um especialista específico" })
          .getAttribute("aria-pressed")) === "true"
    );
    await agirComConfirma(
      () => dialog.getByRole("button", { name: "Esp Dois E2E" }).click(),
      async () =>
        (await dialog
          .getByRole("button", { name: "Esp Dois E2E" })
          .getAttribute("aria-pressed")) === "true"
    );
    await dialog.locator("#pedido-texto").fill(DEMANDA_DEDUP_2);

    // a RPC recusa com a regra do banco — a mensagem sobe como veio e o
    // dialog segue aberto (nada foi gravado)
    await agirComConfirma(
      () => dialog.getByRole("button", { name: "Enviar pedido" }).click(),
      () =>
        page
          .getByText("Você já tem um pedido em aberto com esse especialista")
          .isVisible()
    );
    await expect(dialog).toBeVisible();
    const sols = await buscarViaServiceRole(
      "solicitacoes_especialista",
      `select=id&mentorado_id=eq.${IDS.mentorado}`
    );
    expect(sols).toHaveLength(1);
  });

  test("broadcast: o pedido vai pro mural com o nome do jovem", async ({
    page,
  }) => {
    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem/especialistas");
    const secao = secaoPedidos(page);
    const dialog = page.getByRole("dialog");

    await agirComConfirma(
      () => page.getByRole("button", { name: "Pedir trilha" }).click(),
      () => dialog.isVisible()
    );
    await agirComConfirma(
      () => dialog.getByRole("button", { name: "Qualquer especialista" }).click(),
      async () =>
        (await dialog
          .getByRole("button", { name: "Qualquer especialista" })
          .getAttribute("aria-pressed")) === "true"
    );
    // tem trilha ⇒ broadcast não pede demanda — o motivo-curto é opcional
    await expect(dialog.getByText(/Pra que é a sessão\?/)).toBeVisible();
    await dialog.locator("#pedido-texto").fill(MOTIVO_MURAL);
    await agirComConfirma(
      () => dialog.getByRole("button", { name: "Enviar pedido" }).click(),
      async () =>
        (
          await buscarViaServiceRole(
            "solicitacoes_especialista",
            `select=id&mentorado_id=eq.${IDS.mentorado}`
          )
        ).length > 0
    );
    await expect(dialog).toBeHidden();

    const [sol] = await buscarViaServiceRole<
      {
        status: string;
        origem: string;
        especialista_desejado_id: string | null;
        motivo: string | null;
        demanda: string | null;
        dupla_dpp_id: string | null;
        created_by: string | null;
      }[]
    >(
      "solicitacoes_especialista",
      `select=status,origem,especialista_desejado_id,motivo,demanda,dupla_dpp_id,created_by&mentorado_id=eq.${IDS.mentorado}&order=created_at.desc&limit=1`
    );
    expect(sol.status).toBe("aberta");
    expect(sol.origem).toBe("jovem");
    expect(sol.especialista_desejado_id).toBeNull(); // broadcast de verdade
    expect(sol.demanda).toBeNull();
    expect(sol.motivo).toBe(MOTIVO_MURAL);
    expect(sol.dupla_dpp_id).toBe(IDS.duplaDpp);
    expect(sol.created_by).toBe(IDS.jovemProfile);

    // a página conta onde o pedido está — "no mural", não com um nome
    await expect(secao.getByText("Pedido no mural")).toBeVisible();
    await expect(
      secao.getByText("Seu pedido tá no mural dos especialistas.")
    ).toBeVisible();

    // ---- lado especialista: o broadcast chega ao mural com o nome do
    // jovem e o selo de origem — a leitura é a do staff, não a do autor
    await relogar(page, ESP_EMAIL, SENHA);
    await page.goto("/");
    await abrirMural(page);
    const card = mural(page).locator("li", { hasText: MOTIVO_MURAL });
    await expect(card.getByText("Mentorada E2E")).toBeVisible();
    await expect(card.getByText("pedido do jovem")).toBeVisible();
    await expect(card.getByText(/Solicitado por Jovem E2E/)).toBeVisible();
  });

  test("jovem aceita a contra-proposta — a sessão nasce na agenda", async ({
    page,
  }) => {
    // slot livre real do esp2 que não bate em nenhum compromisso do jovem
    // (a efetivação recusa conflito em TODAS as duplas dele)
    const encontros = await encontrosVivosJovem();
    const slots = (await slotsLivresDe(IDS.esp2Profile)).filter(
      (s) => !conflita(s, encontros)
    );
    expect(slots.length).toBeGreaterThan(0);
    const slot = slots[0];

    // negociação semeada no estado "vez do jovem": o esp2 engajou num
    // broadcast dele e contra-propos — a última proposta da mesa é do esp
    await inserirViaServiceRole("solicitacoes_especialista", {
      id: IDS.solContra,
      mentorado_id: IDS.mentorado,
      dupla_dpp_id: IDS.duplaDpp,
      motivo: MOTIVO_CONTRA,
      especialista_id: IDS.esp2Profile,
      slot_proposto: slot,
      origem: "jovem",
      status: "contra_proposta",
      turma: await turmaDa(IDS.duplaDpp),
      created_by: IDS.jovemProfile,
    });
    await inserirViaServiceRole("solicitacao_propostas", {
      solicitacao_id: IDS.solContra,
      autor_id: IDS.esp2Profile,
      slot_proposto: slot,
      mensagem: "E2E: nesse horário consigo — fecha?",
    });

    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem/especialistas");
    const secao = secaoPedidos(page);
    const item = secao.locator("li", { hasText: "Sessão com Esp" });
    await expect(
      item.getByText("Negociando horário com Esp.")
    ).toBeVisible();
    await expect(item.getByText(/Horário na mesa:/)).toBeVisible();
    // a thread conta quem propôs — o especialista, não "Você"
    await expect(item.getByText(/Esp Dois E2E propôs/)).toBeVisible();

    await agirComConfirma(
      () => item.getByRole("button", { name: /^Aceitar / }).click(),
      async () => {
        const [s] = await buscarViaServiceRole<{ status: string }[]>(
          "solicitacoes_especialista",
          `select=status&id=eq.${IDS.solContra}`
        );
        return s?.status === "aceita";
      }
    );

    // efetivação atômica: sol aceita apontando pra dupla nova do par
    const [aceita] = await buscarViaServiceRole<
      {
        status: string;
        dupla_id: string | null;
        especialista_id: string | null;
        slot_proposto: string | null;
      }[]
    >(
      "solicitacoes_especialista",
      `select=status,dupla_id,especialista_id,slot_proposto&id=eq.${IDS.solContra}`
    );
    expect(aceita.status).toBe("aceita");
    expect(aceita.especialista_id).toBe(IDS.esp2Profile);
    expect(aceita.dupla_id).toBeTruthy();
    expect(ms(aceita.slot_proposto!)).toBe(ms(slot));

    // a dupla esp do par é CRIADA na hora (esp2 ainda não tinha trilha com
    // o jovem — a fixture …00e0 é do OUTRO especialista)
    const [dupla] = await buscarViaServiceRole<
      {
        id: string;
        trilha: string;
        mentor_id: string;
        mentorado_id: string;
        solicitacao_id: string | null;
        status: string;
      }[]
    >(
      "duplas",
      `select=id,trilha,mentor_id,mentorado_id,solicitacao_id,status&id=eq.${aceita.dupla_id}`
    );
    expect(dupla.trilha).toBe("especialista");
    expect(dupla.status).toBe("ativa");
    expect(dupla.mentor_id).toBe(IDS.esp2Profile);
    expect(dupla.mentorado_id).toBe(IDS.mentorado);
    expect(dupla.solicitacao_id).toBe(IDS.solContra);

    // e a sessão nasce nº1, de 1h, no slot aceito — na agenda real
    const encs = await buscarViaServiceRole<
      {
        numero: number;
        data_hora: string;
        status: string;
        duracao_min: number | null;
      }[]
    >(
      "encontros",
      `select=numero,data_hora,status,duracao_min&dupla_id=eq.${dupla.id}`
    );
    expect(encs).toHaveLength(1);
    expect(encs[0].numero).toBe(1);
    expect(encs[0].status).toBe("agendado");
    expect(encs[0].duracao_min).toBe(60);
    expect(ms(encs[0].data_hora)).toBe(ms(slot));

    // quem negociava é avisado: "especialista_aceitou" pra ele
    const notifs = await buscarViaServiceRole(
      "notificacoes",
      `select=id&profile_id=eq.${IDS.esp2Profile}&tipo=eq.especialista_aceitou`
    );
    expect(notifs).toHaveLength(1);

    // a página solta o item — pedido aceito vira sessão (mora na agenda)
    await expect(secao.getByText("Sessão com Esp")).toHaveCount(0);
  });

  test("jovem sem DPP: demanda obrigatória e pedido cai na triagem", async ({
    page,
  }) => {
    await loginComSenha(page, JOVEM2_EMAIL, SENHA);
    await page.goto("/jovem/especialistas");
    const secao = secaoPedidos(page);
    await expect(
      page.getByRole("heading", { name: "Especialistas" })
    ).toBeVisible();

    const dialog = page.getByRole("dialog");
    await agirComConfirma(
      () => page.getByRole("button", { name: "Pedir trilha" }).click(),
      () => dialog.isVisible()
    );
    await agirComConfirma(
      () => dialog.getByRole("button", { name: "Qualquer especialista" }).click(),
      async () =>
        (await dialog
          .getByRole("button", { name: "Qualquer especialista" })
          .getAttribute("aria-pressed")) === "true"
    );

    // sem trilha E sem DPP: a demanda rica é exigida (mínimo 10) e o aviso
    // de triagem aparece — quem libera o pedido é a coordenação
    await expect(
      dialog.getByText("Por que você quer esse apoio?")
    ).toBeVisible();
    await expect(
      dialog.getByText(/coordenação dá uma olhada no pedido/)
    ).toBeVisible();
    const enviar = dialog.getByRole("button", { name: "Enviar pedido" });
    await dialog.locator("#pedido-texto").fill("curto");
    await expect(enviar).toBeDisabled();
    await dialog.locator("#pedido-texto").fill(DEMANDA_SEM_DPP);
    await agirComConfirma(
      () => enviar.click(),
      async () =>
        (
          await buscarViaServiceRole(
            "solicitacoes_especialista",
            `select=id&mentorado_id=eq.${IDS.mentoradoSemDpp}`
          )
        ).length > 0
    );
    await expect(dialog).toBeHidden();

    // sem dupla DPP o pedido NÃO vai pro mural — entra na fila da coord
    const [sol] = await buscarViaServiceRole<
      {
        status: string;
        origem: string;
        dupla_dpp_id: string | null;
        especialista_desejado_id: string | null;
        demanda: string | null;
        created_by: string | null;
      }[]
    >(
      "solicitacoes_especialista",
      `select=status,origem,dupla_dpp_id,especialista_desejado_id,demanda,created_by&mentorado_id=eq.${IDS.mentoradoSemDpp}&limit=1`
    );
    expect(sol.status).toBe("aguardando_coord");
    expect(sol.origem).toBe("jovem");
    expect(sol.dupla_dpp_id).toBeNull();
    expect(sol.demanda).toBe(DEMANDA_SEM_DPP);
    expect(sol.created_by).toBe(IDS.jovem2Profile);

    // a página conta o estado na voz dele — e quem tira da fila é a coord
    await expect(
      secao.getByText("A coordenação tá olhando seu pedido antes de liberar.")
    ).toBeVisible();
    await expect(
      secao.getByText(
        "A coordenação libera o pedido pra ele chegar aos especialistas."
      )
    ).toBeVisible();

    // radar da coordenação: o sino de triagem tocou de verdade
    const notifs = await buscarViaServiceRole(
      "notificacoes",
      `select=id&profile_id=eq.${IDS.coordProfile}&tipo=eq.solicitacao_triagem`
    );
    expect(notifs.length).toBeGreaterThanOrEqual(1);
  });

  test("jovem cancela o próprio pedido — o alvo é avisado", async ({
    page,
  }) => {
    // pedido aberto semeado, dirigido ao esp2 — o cancelamento é do AUTOR
    await inserirViaServiceRole("solicitacoes_especialista", {
      id: IDS.solCancela,
      mentorado_id: IDS.mentorado,
      dupla_dpp_id: IDS.duplaDpp,
      demanda: DEMANDA_CANCELA,
      especialista_desejado_id: IDS.esp2Profile,
      origem: "jovem",
      status: "aberta",
      turma: await turmaDa(IDS.duplaDpp),
      created_by: IDS.jovemProfile,
    });

    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem/especialistas");
    const secao = secaoPedidos(page);
    const item = secao.locator("li", { hasText: "Sessão com Esp" });
    await expect(
      item.getByText("Esperando Esp responder.")
    ).toBeVisible();

    const dialog = page.getByRole("dialog");
    await agirComConfirma(
      () => item.getByRole("button", { name: "Cancelar pedido" }).click(),
      () => dialog.isVisible()
    );
    await expect(
      dialog.getByRole("heading", { name: "Cancelar pedido?" })
    ).toBeVisible();
    await agirComConfirma(
      () =>
        dialog.getByRole("button", { name: "Cancelar pedido" }).click(),
      async () => {
        const [s] = await buscarViaServiceRole<{ status: string }[]>(
          "solicitacoes_especialista",
          `select=status&id=eq.${IDS.solCancela}`
        );
        return s?.status === "cancelada";
      }
    );

    // cancelada de verdade: status + carimbo de resposta, e o pedido sai
    // da lista do jovem (cancelada não é em-aberto)
    const [sol] = await buscarViaServiceRole<
      { status: string; respondida_em: string | null }[]
    >(
      "solicitacoes_especialista",
      `select=status,respondida_em&id=eq.${IDS.solCancela}`
    );
    expect(sol.status).toBe("cancelada");
    expect(sol.respondida_em).toBeTruthy();
    await expect(secao.getByText("Sessão com Esp")).toHaveCount(0);

    // o especialista procurado é avisado (contrato da RPC cancelar_solicitacao)
    const notifs = await buscarViaServiceRole(
      "notificacoes",
      `select=id&profile_id=eq.${IDS.esp2Profile}&tipo=eq.solicitacao_cancelada`
    );
    expect(notifs).toHaveLength(1);
  });
});
