import {
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  expect,
  inserirViaServiceRole,
  limparViaServiceRole,
  loginComSenha,
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
const TZ = "America/Sao_Paulo"; // fuso do app e da RPC de slots
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

/** "terça 14/10 às 19:30" (o texto do option da agenda) → ISO do slot. O
 *  ano não viaja no rótulo — o slot é sempre futuro, então a data montada
 *  no ano corrente serve; se já passou (cruzar dezembro→janeiro), +1 ano. */
function isoDoRotulo(rotulo: string): string {
  const m = rotulo.match(/(\d{2})\/(\d{2}) às (\d{2}):(\d{2})/);
  if (!m) throw new Error(`rótulo de slot inesperado: ${rotulo}`);
  const [, dd, mm, hh, mi] = m;
  const ano = Number(
    new Date().toLocaleDateString("en-CA", { timeZone: TZ, year: "numeric" })
  );
  let iso = `${ano}-${mm}-${dd}T${hh}:${mi}:00-03:00`;
  if (new Date(iso).getTime() <= Date.now()) {
    iso = `${ano + 1}-${mm}-${dd}T${hh}:${mi}:00-03:00`;
  }
  return iso;
}

/** epoch fecha a conta sem depender do formato — PostgREST devolve
 *  timestamptz em +00:00, o slot da RPC idem. */
const ms = (iso: string) => new Date(iso).getTime();

/** Troca de papel dentro do mesmo teste: a sessão mora em cookie — limpa e
 *  loga de novo (sem clearCookies o /login desvia pra home da sessão viva). */
async function relogar(page: Page, email: string, senha: string) {
  await page.context().clearCookies();
  await loginComSenha(page, email, senha);
}

/** Clique + confirmação no banco: se o primeiro clique caiu pré-hidratação
 *  (RSC demora a ligar handlers em dev/preview frio), o laço repete o gesto
 *  até o estado confirmar — o mesmo padrão do pularOnboarding dos helpers. */
async function agirComConfirma(
  agir: () => Promise<void>,
  confirmou: () => Promise<boolean>,
  timeoutMs = 20_000
) {
  const t0 = Date.now();
  for (;;) {
    // o click é seguro de repetir: o botão desabilita enquanto a action
    // roda e some depois do sucesso; se o locator já morreu, engole
    await agir().catch(() => {});
    for (let i = 0; i < 10; i++) {
      if (await confirmou()) return;
      if (Date.now() - t0 > timeoutMs) {
        throw new Error("ação não confirmou no tempo — estado não mudou");
      }
      await new Promise((r) => setTimeout(r, 600));
    }
  }
}

/** Filhos da 0071 primeiro — avaliacoes_encontro e avaliacao_links têm FK
 *  NO ACTION pra encontros; apagar o pai antes dá 409. */
async function apagarEncontrosDeDupla(duplaId: string) {
  const encs = await buscarViaServiceRole<{ id: string }[]>(
    "encontros",
    `select=id&dupla_id=eq.${duplaId}`
  );
  if (!encs.length) return;
  const csv = encs.map((e) => e.id).join(",");
  await limparViaServiceRole("avaliacoes_encontro", `encontro_id=in.(${csv})`);
  await limparViaServiceRole("avaliacao_links", `encontro_id=in.(${csv})`);
  await limparViaServiceRole("encontros", `id=in.(${csv})`);
}

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
  // de runs mortos; a fixture …00e0 NUNCA entra aqui
  const espExtras = await buscarViaServiceRole<{ id: string }[]>(
    "duplas",
    `select=id&mentorado_id=in.(${MENTORADOS_E2E})&trilha=eq.especialista&id=not.eq.${IDS.duplaEsp}`
  );
  for (const d of espExtras) await apagarEncontrosDeDupla(d.id);
  if (espExtras.length) {
    await limparViaServiceRole(
      "duplas",
      `id=in.(${espExtras.map((d) => d.id).join(",")})`
    );
  }
  // a trilha fixture volta ao estado do seed — sem tentativa nenhuma
  await apagarEncontrosDeDupla(IDS.duplaEsp);
  // sino limpo: a assert de recusa conta exatamente a notificação do teste
  await limparViaServiceRole(
    "notificacoes",
    `profile_id=in.(${IDS.mentorProfile},${IDS.coordProfile},${IDS.espProfile})&tipo=in.(solicitacao_recusada,solicitacao_proposta,especialista_aceitou,demanda_especialista,solicitacao_registrada)`
  );
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

    // ficha DPP do autor: o chip conta o que houve, sem rail de negociação
    await relogar(page, MENTOR_EMAIL, SENHA);
    await page.goto(`/duplas/${IDS.dupla}`);
    await expect(page.getByText("Horário expirado")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Pedido de especialista", exact: true })
    ).toHaveCount(0);
  });

  test("mentor pede especialista dirigido; especialista escolhe o slot e aceita", async ({
    page,
  }) => {
    // ---- lado staff: o pedido nasce pela UI da ficha (a superfície real)
    await loginComSenha(page, MENTOR_EMAIL, SENHA);
    await page.goto(`/duplas/${IDS.dupla}`);
    const item = page.getByRole("menuitem", {
      name: "Solicitar mentor especialista",
    });
    await agirComConfirma(
      () => page.getByRole("button", { name: "Mais" }).click(),
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
    await page.waitForURL(`**/duplas/${IDS.duplaEsp}`, { timeout: 15_000 });

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
    await agirComConfirma(
      () =>
        card.getByRole("button", { name: "Propor outro horário" }).click(),
      () => card.getByLabel("Novo horário").isVisible()
    );
    await agirComConfirma(
      () => card.getByLabel("Novo horário").click(),
      () => page.getByRole("option").first().isVisible()
    );
    const options = page.getByRole("option");
    await agirComConfirma(
      () => options.first().click(),
      async () =>
        (await card.getByLabel("Novo horário").textContent())?.includes("às") ??
        false
    );
    const rotuloProposto = (
      await card.getByLabel("Novo horário").textContent()
    )!.trim();
    const isoProposto = isoDoRotulo(rotuloProposto);
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
    const rail = page.locator("section", {
      has: page.getByRole("heading", {
        name: "Pedido de especialista",
        exact: true,
      }),
    });
    await expect(rail).toBeVisible();
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
    // o form de recusa pede a justificativa — o botão destrava com ≥3 chars
    await agirComConfirma(
      () => card.getByRole("button", { name: "Recusar", exact: true }).click(),
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
