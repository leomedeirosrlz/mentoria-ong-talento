import {
  agirComConfirma,
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  convergirDuplaAtiva,
  expect,
  inserirViaServiceRole,
  isoDoRotulo,
  jwtDoUsuario,
  limparDuplas,
  limparEncontrosDaDupla,
  limparViaServiceRole,
  loginComSenha,
  relogar,
  restComoUsuario,
  rpcViaServiceRole,
  test,
} from "../helpers";
import type { Page } from "@playwright/test";

// Máquina de solicitação de especialista v2 (REALIZA-112 / migration 0074)
// contra backend real — o lado STAFF do fluxo, inteiro pela UI:
//   1) mentor DPP abre pedido dirigido pela ficha da dupla (dialog real);
//   2) o pedido staff nasce SEM slot — o especialista escolhe o horário da
//      própria agenda no aceite; o banco efetiva dupla+encontro numa transação;
//   3) contra-proposta do especialista → o autor (coord) aceita na ficha;
//   4) recusa dirigida com justificativa → notificação solicitacao_recusada;
//   5) regressão: sessão de especialista não nasce pela agenda comum;
//   6) expiração lazy: proposta com slot vencido lê 'expirada' sem writer.
//
// Fixtures do seed: dupla DPP …0030 (mentor …0010 × mentorada …0020), a
// trilha especialista …00e0 do MESMO par (esp …0060 — o aceite reusa essa
// dupla por (mentor, mentorado) e o encontro nasce numero=max+1) e a dupla
// DPP …0070 (mentor reserva × mentorada …0060, sem trilha esp — o aceite lá
// CRIA a dupla de especialista). Sols/encontros/duplas do spec morrem na
// convergência; as fixtures do seed ficam.
const MENTOR_EMAIL = process.env.E2E_MENTOR_EMAIL ?? "e2e-mentor@realiza.test";
const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const ESP_EMAIL = process.env.E2E_ESP_EMAIL ?? "esp-e2e@realiza.test";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const SENHA_COORD = process.env.E2E_COORD_PASSWORD || SENHA;

const IDS = {
  mentorProfile: "e2e00000-0000-4000-8000-000000000010",
  mentorado: "e2e00000-0000-4000-8000-000000000020",
  dupla: "e2e00000-0000-4000-8000-000000000030",
  coordProfile: "e2e00000-0000-4000-8000-000000000040",
  espProfile: "e2e00000-0000-4000-8000-000000000060",
  mentorado2: "e2e00000-0000-4000-8000-000000000060", // mentorados.id ≠ profiles.id
  dupla2: "e2e00000-0000-4000-8000-000000000070",
  duplaEsp: "e2e00000-0000-4000-8000-0000000000e0", // trilha esp do par 0060×0020
  // sols semeadas pelo spec (a do teste de aceite nasce pela UI, sem id fixo)
  solContra: "e2e00000-0000-4000-8000-0000000001c1",
  solRecusa: "e2e00000-0000-4000-8000-0000000001c2",
  solExpirada: "e2e00000-0000-4000-8000-0000000001c3",
} as const;
const MENTORADOS_E2E = `${IDS.mentorado},${IDS.mentorado2}`;
// demandas com prefixo único — o escopo dos asserts é o próprio texto
const DEMANDA_ACEITE =
  "E2E-112: jovem precisa de reforço em inglês instrumental pra entrevista de emprego.";
const DEMANDA_CONTRA =
  "E2E-112: rotina de estudos pro vestibular — precisa de acompanhamento semanal.";
const DEMANDA_RECUSA =
  "E2E-112: preparação pra processo seletivo de estágio (caso da recusa).";
const DEMANDA_EXPIRADA =
  "E2E-112: pedido com horário vencido — não pode renderizar como ação.";
const JUSTIFICATIVA = "Agenda lotada neste ciclo — não consigo assumir o caso.";
const MSG_CONTRA = "Nesse dia só consigo mais cedo — esse horário funciona?";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

/** epoch fecha a conta sem depender do formato — PostgREST devolve
 *  timestamptz em +00:00, o slot da RPC idem. */
const ms = (iso: string) => new Date(iso).getTime();

/** Piso do spec: nem uma solicitação viva nos mentorados e2e, a duplaEsp
 *  sem tentativas (o numero=1 do 1º aceite fica determinístico) e nenhuma
 *  dupla esp além da fixture. Ordem FK-safe: zera a aresta dupla→sol antes,
 *  mata a thread, mata a sol, mata filhos da dupla, mata a dupla. Roda em
 *  beforeEach E afterAll — um run morto no meio não deixa resíduo pro
 *  próximo (e o retry do CI também converge). */
async function convergirSolicitacoes() {
  // aresta circular dupla↔solicitação (0028) nos dois sentidos: a dupla esp
  // guarda solicitacao_id de origem e a sol guarda dupla_id no aceite
  await atualizarViaServiceRole(
    "duplas",
    `mentorado_id=in.(${MENTORADOS_E2E})&solicitacao_id=not.is.null`,
    { solicitacao_id: null }
  );
  const sols = await buscarViaServiceRole<{ id: string }[]>(
    "solicitacoes_especialista",
    `select=id&mentorado_id=in.(${MENTORADOS_E2E})`
  );
  if (sols.length) {
    const csv = sols.map((s) => s.id).join(",");
    await limparViaServiceRole(
      "solicitacao_propostas",
      `solicitacao_id=in.(${csv})`
    );
    await limparViaServiceRole("solicitacoes_especialista", `id=in.(${csv})`);
  }
  // duplas esp fora da fixture — a que o aceite criou (mentorado2) e restos
  // de runs mortos; a fixture …00e0 NUNCA entra aqui. limparDuplas cobre
  // os filhos NO ACTION novos (formulario_links 0099, encerramentos da
  // 0102, remanejada_de) que o delete direto agarrava em 409.
  const espExtras = await buscarViaServiceRole<{ id: string }[]>(
    "duplas",
    `select=id&mentorado_id=in.(${MENTORADOS_E2E})&trilha=eq.especialista&id=not.eq.${IDS.duplaEsp}`
  );
  await limparDuplas(espExtras.map((d) => d.id));
  // a trilha fixture volta ao estado do seed — sem tentativa nenhuma
  await limparEncontrosDaDupla(IDS.duplaEsp);
  // sino limpo: a assert de recusa conta exatamente a notificação do teste
  await limparViaServiceRole(
    "notificacoes",
    `profile_id=in.(${IDS.mentorProfile},${IDS.coordProfile},${IDS.espProfile})&tipo=in.(solicitacao_recusada,solicitacao_proposta,especialista_aceitou,demanda_especialista,solicitacao_registrada)`
  );
  // a dupla DPP hospedeira do pedido precisa estar ativa — um spec vizinho
  // que recriou o encontro 16 a deixou 'concluida' e a ficha vira
  // read-only (o "Mais" some, o menuitem de solicitar nem monta)
  await convergirDuplaAtiva(IDS.dupla);
}

/** Mural do especialista — section rotulada da home. */
const mural = (page: Page) =>
  page.locator('section[aria-label="Pedidos de mentoria especializada"]');

/** A turma real da dupla — o sol semeado carrega a da dupla DPP, como o
 *  insert do app faz. */
async function turmaDa(duplaId: string): Promise<string | null> {
  const [d] = await buscarViaServiceRole<{ turma: string | null }[]>(
    "duplas",
    `select=turma&id=eq.${duplaId}`
  );
  return d?.turma ?? null;
}

test.describe("solicitação de especialista v2 — fluxo staff (REALIZA-112)", () => {
  test.describe.configure({ mode: "serial" }); // os sols encadeiam estado
  test.beforeEach(convergirSolicitacoes);
  test.afterAll(convergirSolicitacoes);

  test("sessão de especialista não nasce pela agenda comum", async ({
    page,
  }) => {
    // regressão 0074: agendarEncontro cria encontro do zero — pra trilha esp
    // a action recusa ("sessões nascem dos pedidos aceitos"). A agenda e a
    // home NÃO podem oferecer o CTA que leva ao erro garantido.
    await loginComSenha(page, ESP_EMAIL, SENHA);
    await page.goto("/agenda");
    await expect(
      page.getByRole("button", { name: "Agendar encontro", exact: true })
    ).toHaveCount(0);
    // dupla sem tentativa aberta explica a regra em vez de esconder
    await expect(
      page.getByText(/Sessão nova nasce de um pedido aceito/).first()
    ).toBeVisible();

    await page.goto("/");
    // home do especialista: o card "O que fazer agora" da trilha também não
    // pode vender um agendamento que o banco vai recusar
    await expect(
      page.getByRole("button", { name: "Agendar encontro", exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Agendar próximo", exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByText(/Sessão nova nasce de um pedido aceito/).first()
    ).toBeVisible();
  });

  test("pedido com horário vencido lê expirado e não oferece ação", async ({
    page,
  }) => {
    // lazy expiry (0074): status segue 'contra_proposta' no banco, o slot
    // vencido faz a view ler 'expirada' — some do mural do especialista e
    // vira chip honesto na ficha, sem CTA de aceite em nenhum dos lados.
    const passado = new Date(Date.now() - 2 * 86400e3).toISOString();
    await inserirViaServiceRole("solicitacoes_especialista", {
      id: IDS.solExpirada,
      mentorado_id: IDS.mentorado,
      dupla_dpp_id: IDS.dupla,
      demanda: DEMANDA_EXPIRADA,
      especialista_desejado_id: IDS.espProfile,
      especialista_id: IDS.espProfile,
      slot_proposto: passado,
      origem: "staff",
      status: "contra_proposta",
      turma: await turmaDa(IDS.dupla),
      created_by: IDS.mentorProfile,
    });
    await inserirViaServiceRole("solicitacao_propostas", {
      solicitacao_id: IDS.solExpirada,
      autor_id: IDS.espProfile,
      slot_proposto: passado,
      mensagem: "E2E: proposta que ficou pra trás no tempo.",
    });

    // mural do especialista: o pedido expirado nem renderiza como card
    await loginComSenha(page, ESP_EMAIL, SENHA);
    await page.goto("/");
    await expect(
      mural(page).getByRole("heading", { name: "Pedidos de especialista" })
    ).toBeVisible();
    await expect(mural(page).getByText(DEMANDA_EXPIRADA)).toHaveCount(0);

    // ficha DPP do autor: o chip conta o que houve (header, toda aba), sem
    // rail de negociação — o card "Mentor especialista" só nasce com
    // pedido em aberto dentro de "Pedidos em aberto"
    await relogar(page, MENTOR_EMAIL, SENHA);
    await page.goto(`/duplas/${IDS.dupla}`);
    await expect(page.getByText("Horário expirado")).toBeVisible();
    await expect(page.getByText("Mentor especialista")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /^Aceitar / })
    ).toHaveCount(0);
  });

  test("mentor pede especialista dirigido; especialista escolhe o slot e aceita", async ({
    page,
  }) => {
    // 2 logins + 2 server actions + polls service-role — o teto global de
    // 30s estoura no preview frio (a run 39388319471 morreu no waitForURL
    // do aceite, com a sol já 'aceita' no banco)
    test.setTimeout(90_000);
    // ---- lado staff: o pedido nasce pela UI da ficha (a superfície real)
    await loginComSenha(page, MENTOR_EMAIL, SENHA);
    await page.goto(`/duplas/${IDS.dupla}`);
    const item = page.getByRole("menuitem", {
      name: "Solicitar mentor especialista",
    });
    await agirComConfirma(
      () =>
        page.getByRole("button", { name: "Mais ações da dupla" }).click(),
      () => item.isVisible()
    );
    const dialog = page.getByRole("dialog");
    await agirComConfirma(
      () => item.click(),
      () => dialog.isVisible()
    );
    await dialog.locator("#demanda").fill(DEMANDA_ACEITE);
    await agirComConfirma(
      () => dialog.locator("#especialista-select").click(),
      () =>
        page.getByRole("option", { name: "Esp E2E", exact: true }).isVisible()
    );
    await agirComConfirma(
      () =>
        page.getByRole("option", { name: "Esp E2E", exact: true }).click(),
      async () =>
        (await dialog.locator("#especialista-select").textContent())?.includes(
          "Esp E2E"
        ) ?? false
    );
    await agirComConfirma(
      () =>
        dialog.getByRole("button", { name: "Enviar solicitação" }).click(),
      async () => {
        const rows = await buscarViaServiceRole<{ id: string }[]>(
          "solicitacoes_especialista",
          `select=id&dupla_dpp_id=eq.${IDS.dupla}&limit=1`
        );
        return rows.length > 0;
      }
    );
    await expect(dialog).toBeHidden();

    // pedido staff: 'aberta', sem slot, dirigido, origem staff, autor=mentor
    const [sol] = await buscarViaServiceRole<
      {
        id: string;
        status: string;
        origem: string;
        slot_proposto: string | null;
        especialista_desejado_id: string | null;
        created_by: string;
        mentorado_id: string;
      }[]
    >(
      "solicitacoes_especialista",
      `select=id,status,origem,slot_proposto,especialista_desejado_id,created_by,mentorado_id&dupla_dpp_id=eq.${IDS.dupla}&order=created_at.desc&limit=1`
    );
    expect(sol?.status).toBe("aberta");
    expect(sol?.origem).toBe("staff");
    expect(sol?.slot_proposto).toBeNull();
    expect(sol?.especialista_desejado_id).toBe(IDS.espProfile);
    expect(sol?.created_by).toBe(IDS.mentorProfile);
    expect(sol?.mentorado_id).toBe(IDS.mentorado);

    // ---- lado especialista: o mural mostra o dirigido; aceitar pede slot
    await relogar(page, ESP_EMAIL, SENHA);
    await page.goto("/");
    const card = mural(page).locator("li", { hasText: DEMANDA_ACEITE });
    await expect(card.getByText("Direcionada a você")).toBeVisible();

    // pedido staff não traz horário — o aceite abre o picker da própria
    // agenda. Pega o 2º slot livre (o 1º fica pro spec de agenda paralelo).
    await agirComConfirma(
      () => card.getByLabel("Horário da sessão").click(),
      () => page.getByRole("option").first().isVisible()
    );
    const options = page.getByRole("option");
    const textos = await options.allTextContents();
    const idx = Math.min(1, textos.length - 1);
    await agirComConfirma(
      () => options.nth(idx).click(),
      async () =>
        (await card.getByLabel("Horário da sessão").textContent())?.includes(
          "às"
        ) ?? false
    );
    // lê o rótulo que ficou no gatilho — o valor realmente escolhido
    const rotuloEscolhido = (
      await card.getByLabel("Horário da sessão").textContent()
    )!.trim();
    const isoEscolhido = isoDoRotulo(rotuloEscolhido);
    await agirComConfirma(
      () => card.getByRole("button", { name: "Aceitar", exact: true }).click(),
      async () => {
        const [s] = await buscarViaServiceRole<{ status: string }[]>(
          "solicitacoes_especialista",
          `select=status&id=eq.${sol!.id}`
        );
        return s?.status === "aceita";
      }
    );
    // o aceite navega pra ficha da dupla de especialista efetivada
    await page.waitForURL(`**/duplas/${IDS.duplaEsp}`, { timeout: 30_000 });

    // efetivação atômica: sol aceita apontando pra trilha existente do par
    // + encontro numero=1 no slot escolhido (a fixture …00e0 é reusada —
    // a unique é por (mentor, mentorado) na trilha)
    const [depois] = await buscarViaServiceRole<
      {
        status: string;
        slot_proposto: string | null;
        especialista_id: string | null;
        dupla_id: string | null;
      }[]
    >(
      "solicitacoes_especialista",
      `select=status,slot_proposto,especialista_id,dupla_id&id=eq.${sol!.id}`
    );
    expect(depois?.status).toBe("aceita");
    expect(depois?.especialista_id).toBe(IDS.espProfile);
    expect(depois?.dupla_id).toBe(IDS.duplaEsp);
    expect(depois?.slot_proposto).toBeTruthy();
    expect(ms(depois!.slot_proposto!)).toBe(ms(isoEscolhido));
    const encs = await buscarViaServiceRole<
      {
        numero: number;
        data_hora: string;
        status: string;
        duracao_min: number | null;
      }[]
    >(
      "encontros",
      `select=numero,data_hora,status,duracao_min&dupla_id=eq.${IDS.duplaEsp}`
    );
    expect(encs).toHaveLength(1);
    expect(encs[0].numero).toBe(1); // 1ª tentativa da trilha
    expect(encs[0].status).toBe("agendado");
    expect(encs[0].duracao_min).toBe(60);
    expect(ms(encs[0].data_hora)).toBe(ms(isoEscolhido));
  });

  test("contra-proposta do especialista é aceita pelo autor", async ({
    page,
  }) => {
    // mesmo peso do irmão acima: login + ação + relogin + ação no mural
    test.setTimeout(90_000);
    // sol staff dirigida ao esp, dessa vez na dupla2 — a mentorada ainda não
    // tem trilha esp, então o aceite prova a CRIAÇÃO da dupla (não a reusa)
    await inserirViaServiceRole("solicitacoes_especialista", {
      id: IDS.solContra,
      mentorado_id: IDS.mentorado2,
      dupla_dpp_id: IDS.dupla2,
      demanda: DEMANDA_CONTRA,
      especialista_desejado_id: IDS.espProfile,
      origem: "staff",
      status: "aberta",
      turma: await turmaDa(IDS.dupla2),
      created_by: IDS.coordProfile,
    });

    // o especialista vê o dirigido e responde com outro horário + recado
    await loginComSenha(page, ESP_EMAIL, SENHA);
    await page.goto("/");
    const card = mural(page).locator("li", { hasText: DEMANDA_CONTRA });
    await expect(card.getByText("Direcionada a você")).toBeVisible();
    // a contra-proposta não é mais um Select: é a grade de dias do mock v6 —
    // cada horário livre do especialista vira um radio (input sr-only, o
    // <label> pai recebe o clique e ativa a escolha).
    // REALIZA-186: o gesto saiu do botão solto pro ⋯ "Ações do pedido de …"
    await agirComConfirma(
      () =>
        card.getByRole("button", { name: /Ações do pedido de / }).click(),
      () =>
        page
          .getByRole("menuitem", { name: "Propor outro horário" })
          .isVisible()
    );
    await agirComConfirma(
      () =>
        page
          .getByRole("menuitem", { name: "Propor outro horário" })
          .click(),
      () =>
        card
          .getByRole("radiogroup", { name: "Horários livres do especialista" })
          .isVisible()
    );
    const radios = card.getByRole("radio", { name: / às \d{2}:\d{2}/ });
    await expect(radios.first()).toHaveCount(1, { timeout: 15_000 });
    const rotuloProposto = (
      await radios.first().getAttribute("aria-label")
    )!.trim();
    const isoProposto = isoDoRotulo(rotuloProposto);
    await agirComConfirma(
      () => radios.first().locator("xpath=..").click(),
      async () => radios.first().isChecked()
    );
    await card.getByLabel("Mensagem da contra-proposta").fill(MSG_CONTRA);
    await agirComConfirma(
      () => card.getByRole("button", { name: "Propor", exact: true }).click(),
      async () => {
        const [s] = await buscarViaServiceRole<{ status: string }[]>(
          "solicitacoes_especialista",
          `select=status&id=eq.${IDS.solContra}`
        );
        return s?.status === "contra_proposta";
      }
    );

    // a negociação vive na thread + no slot_proposto da sol
    const [contra] = await buscarViaServiceRole<
      {
        status: string;
        slot_proposto: string | null;
        especialista_id: string | null;
      }[]
    >(
      "solicitacoes_especialista",
      `select=status,slot_proposto,especialista_id&id=eq.${IDS.solContra}`
    );
    expect(contra?.status).toBe("contra_proposta");
    expect(contra?.especialista_id).toBe(IDS.espProfile);
    expect(contra?.slot_proposto).toBeTruthy();
    expect(ms(contra!.slot_proposto!)).toBe(ms(isoProposto));
    const props = await buscarViaServiceRole<
      {
        autor_id: string;
        slot_proposto: string;
        mensagem: string | null;
      }[]
    >(
      "solicitacao_propostas",
      `select=autor_id,slot_proposto,mensagem&solicitacao_id=eq.${IDS.solContra}`
    );
    expect(props).toHaveLength(1);
    expect(props[0].autor_id).toBe(IDS.espProfile);
    expect(props[0].mensagem).toBe(MSG_CONTRA);
    expect(ms(props[0].slot_proposto)).toBe(ms(isoProposto));

    // o autor (coord) responde da ficha da dupla DPP — a vez é dele porque
    // a última proposta da mesa é do especialista
    await relogar(page, COORD_EMAIL, SENHA_COORD);
    await page.goto(`/duplas/${IDS.dupla2}`);
    // o rail virou o card "Mentor especialista" dentro de "Pedidos em
    // aberto" (aba Agora) — mesma mesa de propostas, outra moldura
    const rail = page.locator('section[aria-labelledby="pedidos-abertos"]');
    await expect(rail).toBeVisible();
    await expect(rail.getByText("Mentor especialista")).toBeVisible();
    await agirComConfirma(
      () => rail.getByRole("button", { name: /^Aceitar / }).click(),
      async () => {
        const [s] = await buscarViaServiceRole<{ status: string }[]>(
          "solicitacoes_especialista",
          `select=status&id=eq.${IDS.solContra}`
        );
        return s?.status === "aceita";
      }
    );

    // aceite do autor → efetivação com o slot do especialista; a dupla esp
    // do par é CRIADA (mentorado2 não tinha trilha) e o encontro nasce nº1
    const [aceita] = await buscarViaServiceRole<
      { status: string; dupla_id: string | null }[]
    >(
      "solicitacoes_especialista",
      `select=status,dupla_id&id=eq.${IDS.solContra}`
    );
    expect(aceita?.status).toBe("aceita");
    expect(aceita?.dupla_id).toBeTruthy();
    const [duplaNova] = await buscarViaServiceRole<
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
      `select=id,trilha,mentor_id,mentorado_id,solicitacao_id,status&id=eq.${aceita!.dupla_id}`
    );
    expect(duplaNova?.trilha).toBe("especialista");
    expect(duplaNova?.status).toBe("ativa");
    expect(duplaNova?.mentor_id).toBe(IDS.espProfile);
    expect(duplaNova?.mentorado_id).toBe(IDS.mentorado2);
    expect(duplaNova?.solicitacao_id).toBe(IDS.solContra);
    const encs = await buscarViaServiceRole<
      { numero: number; data_hora: string; status: string }[]
    >(
      "encontros",
      `select=numero,data_hora,status&dupla_id=eq.${duplaNova!.id}`
    );
    expect(encs).toHaveLength(1);
    expect(encs[0].numero).toBe(1);
    expect(encs[0].status).toBe("agendado");
    expect(ms(encs[0].data_hora)).toBe(ms(isoProposto));
  });

  test("recusa dirigida exige justificativa e avisa o autor", async ({
    page,
  }) => {
    // sol staff dirigida, autoria do mentor DPP — a recusa pinga created_by.
    // O sino desse tipo é zerado aqui (não só na convergência) pro assert
    // sobreviver a um retry do mesmo teste.
    await limparViaServiceRole(
      "notificacoes",
      `profile_id=eq.${IDS.mentorProfile}&tipo=eq.solicitacao_recusada`
    );
    await inserirViaServiceRole("solicitacoes_especialista", {
      id: IDS.solRecusa,
      mentorado_id: IDS.mentorado,
      dupla_dpp_id: IDS.dupla,
      demanda: DEMANDA_RECUSA,
      especialista_desejado_id: IDS.espProfile,
      origem: "staff",
      status: "aberta",
      turma: await turmaDa(IDS.dupla),
      created_by: IDS.mentorProfile,
    });

    await loginComSenha(page, ESP_EMAIL, SENHA);
    await page.goto("/");
    const card = mural(page).locator("li", { hasText: DEMANDA_RECUSA });
    await expect(card.getByText("Direcionada a você")).toBeVisible();
    // a recusa saiu do botão solto pro ⋯ "Ações do pedido" (REALIZA-186,
    // mesmo gesto do demo): o menuitem "Recusar pedido" abre o form inline
    // que pede a justificativa — o botão destrava com ≥3 chars
    await agirComConfirma(
      async () => {
        // retry-safe: form já aberto → não repete o gesto (o menuitem é um
        // toggle e fecharia o form de novo); menu aberto → não reclica o
        // gatilho (toggle também)
        if (await card.getByLabel("Motivo da recusa").isVisible().catch(() => false))
          return;
        const item = page.getByRole("menuitem", { name: "Recusar pedido" });
        if (!(await item.isVisible().catch(() => false))) {
          await card
            .getByRole("button", { name: /Ações do pedido de / })
            .click();
        }
        await item.click();
      },
      () => card.getByLabel("Motivo da recusa").isVisible()
    );
    const confirma = card.getByRole("button", { name: "Recusar pedido" });
    await expect(confirma).toBeDisabled();
    await card.getByLabel("Motivo da recusa").fill(JUSTIFICATIVA);
    await expect(confirma).toBeEnabled();
    await agirComConfirma(
      () => confirma.click(),
      async () => {
        const [s] = await buscarViaServiceRole<{ status: string }[]>(
          "solicitacoes_especialista",
          `select=status&id=eq.${IDS.solRecusa}`
        );
        return s?.status === "recusada";
      }
    );

    const [recusada] = await buscarViaServiceRole<
      {
        status: string;
        justificativa_recusa: string | null;
        especialista_id: string | null;
        respondida_em: string | null;
      }[]
    >(
      "solicitacoes_especialista",
      `select=status,justificativa_recusa,especialista_id,respondida_em&id=eq.${IDS.solRecusa}`
    );
    expect(recusada?.status).toBe("recusada");
    expect(recusada?.justificativa_recusa).toBe(JUSTIFICATIVA);
    expect(recusada?.especialista_id).toBe(IDS.espProfile);
    expect(recusada?.respondida_em).toBeTruthy();
    // a notificação do autor é o contrato da recusa (sol_notificar da RPC)
    const notifs = await buscarViaServiceRole<
      { tipo: string; href: string | null }[]
    >(
      "notificacoes",
      `select=tipo,href&profile_id=eq.${IDS.mentorProfile}&tipo=eq.solicitacao_recusada`
    );
    expect(notifs).toHaveLength(1);
  });
});

// ── REALIZA-158 / migration 0101 — pool global de especialistas ─────────
// Os gates de atuação já eram globais desde a 0087; a 0101 tirou os restos
// (catálogo do jovem, rematch, triagem com turma obrigatória, budget por
// par+turma). O spec visual cobre o catálogo (jovem-pessoas); aqui ficam
// os dois caminhos que só o banco enxerga, na borda do PostgREST com o JWT
// real de cada papel — a mesma camada que o app chama.
const JOVEM2_PROFILE = "e2e00000-0000-4000-8000-0000000000f0";
const MENTORADO_SEM_DPP = "e2e00000-0000-4000-8000-0000000000d0";
const ESP2_PROFILE = "e2e00000-0000-4000-8000-0000000000c0"; // escopo "Turma E2E"
const ESP2_EMAIL = process.env.E2E_ESP2_EMAIL ?? "esp2-e2e@realiza.test";
const DEMANDA_158 = "E2E-158: triagem libera sem turma e o aceite é global.";

/** Limpa tudo que o bloco 158 semeia: sols com a demanda do teste, a dupla
 *  esp criada no aceite (e o remanejo encadeado), encontros e o sino. */
async function limpar158() {
  const sols = await buscarViaServiceRole<{ id: string }[]>(
    "solicitacoes_especialista",
    `select=id&demanda=like.E2E-158:*`
  );
  const duplas = await buscarViaServiceRole<{ id: string }[]>(
    "duplas",
    `select=id&mentorado_id=eq.${MENTORADO_SEM_DPP}&trilha=eq.especialista`
  );
  // aresta circular dupla↔sol (0028): zera as duas pontas antes de deletar
  if (duplas.length) {
    await atualizarViaServiceRole(
      "duplas",
      `id=in.(${duplas.map((d) => d.id).join(",")})`,
      { solicitacao_id: null }
    );
  }
  if (sols.length) {
    await atualizarViaServiceRole(
      "solicitacoes_especialista",
      `id=in.(${sols.map((s) => s.id).join(",")})`,
      { dupla_id: null }
    );
    await limparViaServiceRole(
      "solicitacao_propostas",
      `solicitacao_id=in.(${sols.map((s) => s.id).join(",")})`
    );
    await limparViaServiceRole(
      "solicitacoes_especialista",
      `id=in.(${sols.map((s) => s.id).join(",")})`
    );
  }
  // a dupla fechada do rematch carrega encerramentos + a sucessora aponta
  // remanejada_de — limparDuplas solta a linhagem e varre todos os filhos
  // NO ACTION (era só encontros aqui e o delete batia 409)
  await limparDuplas(duplas.map((d) => d.id));
  await limparViaServiceRole(
    "notificacoes",
    `profile_id=eq.${JOVEM2_PROFILE}&tipo=in.(solicitacao_registrada,solicitacao_triagem)`
  );
}

test.describe("especialista global — turma não restringe (REALIZA-158)", () => {
  test.beforeEach(limpar158);
  test.afterAll(limpar158);

  test("triagem libera sem turma; esp de outro escopo aceita e coord remaneja cross-turma", async () => {
    // pedido do jovem sem DPP ativa entra na triagem (aguardando_coord)
    const sol = await inserirViaServiceRole("solicitacoes_especialista", {
      mentorado_id: MENTORADO_SEM_DPP,
      origem: "jovem",
      status: "aguardando_coord",
      demanda: DEMANDA_158,
      motivo: "E2E-158 motivo",
      especialista_desejado_id: ESP2_PROFILE,
      created_by: JOVEM2_PROFILE,
    });
    const solId = sol.id as string;

    // 1) a coord libera SEM escolher turma — antes da 0101 a RPC exigia
    const jwtCoord = await jwtDoUsuario(COORD_EMAIL, SENHA_COORD);
    const lib = await restComoUsuario("rpc/reconhecer_solicitacao", jwtCoord, {
      method: "POST",
      body: { p_id: solId },
    });
    const libText = await lib.text();
    expect(lib.ok, `reconhecer sem turma → ${libText}`).toBeTruthy();
    const [aberta] = await buscarViaServiceRole<
      { status: string; turma: string | null }[]
    >("solicitacoes_especialista", `select=status,turma&id=eq.${solId}`);
    expect(aberta?.status).toBe("aberta");
    expect(aberta?.turma).toBeNull();

    // 2) o pedido mira a turma do jovem quando o efetivar roda — aqui o
    // mentorado é da Turma E2E, então marcamos T1 pra forçar o cenário
    // "esp escopado noutra turma aceita" (o papel do esp2 é Turma E2E).
    await atualizarViaServiceRole(
      "solicitacoes_especialista",
      `id=eq.${solId}`,
      { turma: "T1 · 2026/2027" }
    );

    // slot livre real do esp2 (grade qui 19–21)
    const desde = new Date().toISOString().slice(0, 10);
    const ate = new Date(Date.now() + 14 * 86400e3).toISOString().slice(0, 10);
    const slots = await rpcViaServiceRole<{ inicio: string }[]>(
      "especialista_slots_livres",
      { p_especialista: ESP2_PROFILE, p_desde: desde, p_ate: ate }
    );
    expect(slots.length).toBeGreaterThan(0);

    const jwtEsp2 = await jwtDoUsuario(ESP2_EMAIL, SENHA);
    const aceite = await restComoUsuario("rpc/aceitar_solicitacao", jwtEsp2, {
      method: "POST",
      body: { p_id: solId, p_slot: slots[0].inicio },
    });
    const aceiteText = await aceite.text();
    expect(aceite.ok, `aceite cross-escopo → ${aceiteText}`).toBeTruthy();
    const duplaId = JSON.parse(aceiteText) as string;

    const [dupla] = await buscarViaServiceRole<
      { trilha: string; turma: string; mentor_id: string; status: string }[]
    >(
      "duplas",
      `select=trilha,turma,mentor_id,status&id=eq.${duplaId}`
    );
    expect(dupla?.trilha).toBe("especialista");
    expect(dupla?.mentor_id).toBe(ESP2_PROFILE);
    expect(dupla?.turma).toBe("T1 · 2026/2027");

    // 3) rematch cross-turma: o mentor principal (esp …0060, papel escopo
    // "Turma E2E") assume a dupla carimbada T1 — antes da 0101 a RPC barrava
    const rem = await restComoUsuario("rpc/rematch_dupla", jwtCoord, {
      method: "POST",
      body: {
        p_dupla_id: duplaId,
        p_lado: "mentor",
        p_novo_id: IDS.espProfile,
        p_motivo: "E2E-158: rematch cross-turma",
        p_registrar_nota: false,
        // 0117: rematch esp exige a devolutiva pro PDM de quem sai — sem ela
        // a RPC aborta (a dupla fechada não aceita o campo por nenhuma via)
        p_devolutiva:
          "E2E-171: sessões de escrita destravadas; manter o exercício semanal no PDM.",
      },
    });
    const remText = await rem.text();
    expect(rem.ok, `rematch cross-turma → ${remText}`).toBeTruthy();
    const novaId = JSON.parse(remText) as string;
    const [nova] = await buscarViaServiceRole<
      { mentor_id: string; trilha: string; status: string }[]
    >("duplas", `select=mentor_id,trilha,status&id=eq.${novaId}`);
    expect(nova?.mentor_id).toBe(IDS.espProfile);
    expect(nova?.trilha).toBe("especialista");
    expect(nova?.status).toBe("ativa");

    // a trilha encerrada carrega o rito completo: carimbo + devolutiva
    const [fechada] = await buscarViaServiceRole<
      { status: string; encerrada_em: string | null; devolutiva_pdm: string | null }[]
    >("duplas", `select=status,encerrada_em,devolutiva_pdm&id=eq.${duplaId}`);
    expect(fechada?.status).toBe("encerrada");
    expect(fechada?.encerrada_em).toBeTruthy();
    expect(fechada?.devolutiva_pdm).toContain("E2E-171");
  });
});

