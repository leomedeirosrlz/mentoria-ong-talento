import {
  agirComConfirma,
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  convergirDuplaAtiva,
  expect,
  inserirViaServiceRole,
  limparDuplas,
  limparEncontrosDaDupla,
  limparViaServiceRole,
  loginComSenha,
  rpcViaServiceRole,
  test,
} from "../helpers";
import type { Page } from "@playwright/test";

// WP6-R2 (REALIZA-139/146) — coberturas novas do recorte do especialista
// contra backend real:
//   1) "encaixa com você" — o destaque âmbar que marca os slots da grade do
//      especialista compatíveis com a disponibilidade do jovem
//      (slotCompativel: dia ∈ dias, período ∈ periodos). Duas superfícies:
//      os chips "Pedir sessão" da trilha em /jovem/agenda e a grade de dias
//      (radios) da mesa de negociação em /jovem/especialistas. A grade do
//      esp2 ganha uma janela EXTRA de sábado de manhã — fora da grade do
//      jovem (ter/qui à noite) — pra garantir slot SEM o destaque;
//   2) sugestão com AUTOR visível — a fixture demo do staging
//      (de000000-…-1004, origem mentor, created_by Otávio Martins) é o
//      caso do RLS: o jovem não lê profiles alheios, então a projeção
//      costura o nome via jovem_contatos. Sem o stitch cai "Seu mentor
//      sugeriu…" — a Ana tem que ler "Otávio Martins sugeriu…";
//   3) card-CTA da home no estado "triagem" — pedido aguardando_coord do
//      jovem sem DPP ganha o badge "com a coordenação".
//
// Fixture de* é compartilhada e read-only aqui: nada clica em
// confirmar/dispensar — a sugestão …1004 tem que continuar 'sugerida'.

const JOVEM_EMAIL = process.env.E2E_JOVEM_EMAIL ?? "jovem-e2e@realiza.test";
const JOVEM2_EMAIL = process.env.E2E_JOVEM2_EMAIL ?? "jovem2-e2e@realiza.test";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const DEMO_SENHA = process.env.DEMO_PASSWORD ?? "realiza123";
const ANA_EMAIL = "jovem@realiza.test";

const IDS = {
  mentorado: "e2e00000-0000-4000-8000-000000000020",
  mentoradoSemDpp: "e2e00000-0000-4000-8000-0000000000d0",
  jovemProfile: "e2e00000-0000-4000-8000-0000000000b0",
  jovem2Profile: "e2e00000-0000-4000-8000-0000000000f0",
  espProfile: "e2e00000-0000-4000-8000-000000000060",
  esp2Profile: "e2e00000-0000-4000-8000-0000000000c0",
  duplaDpp: "e2e00000-0000-4000-8000-000000000030",
  duplaEsp: "e2e00000-0000-4000-8000-0000000000e0",
  /** janela EXTRA de sábado de manhã na grade do esp2 — criada por este
   *  spec pra dar slot fora da grade do jovem (fora do "encaixa"). */
  gradeEsp2Sab: "e2e00000-0000-4000-8000-0000000000e5",
} as const;

const MENTORADOS_JOVEM = `${IDS.mentorado},${IDS.mentoradoSemDpp}`;

const cardHome = (page: Page) =>
  page.locator('section[aria-labelledby="esp-titulo"]');
const secaoPedidos = (page: Page) => page.locator("section#pedidos");

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

/** Piso: zera sols/demandas dos mentorados e2e e devolve a grade do esp2 ao
 *  fixture + a janela de sábado deste spec. Não toca nas fixtures de*. */
async function convergirWp6R2() {
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
  const espExtras = await buscarViaServiceRole<{ id: string }[]>(
    "duplas",
    `select=id&mentorado_id=in.(${MENTORADOS_JOVEM})&trilha=eq.especialista&id=not.eq.${IDS.duplaEsp}`
  );
  // limparDuplas cobre os filhos NO ACTION novos (formulario_links 0099,
  // encerramentos da 0102, remanejada_de) que o delete direto 409ava
  await limparDuplas(espExtras.map((d) => d.id));
  await limparEncontrosDaDupla(IDS.duplaEsp);

  // grade do esp2: fixture de quinta à noite (compat) + sábado de manhã
  // (fora da grade do jovem — prova que o destaque não pinta tudo)
  const grade = await buscarViaServiceRole<{ id: string }[]>(
    "especialista_grade",
    `select=id&profile_id=eq.${IDS.esp2Profile}&limit=1`
  );
  if (!grade.length) {
    await inserirViaServiceRole("especialista_grade", {
      id: "e2e00000-0000-4000-8000-0000000000e1",
      profile_id: IDS.esp2Profile,
      dia_semana: 4,
      hora_inicio: "19:00",
      hora_fim: "21:00",
    });
  }
  await limparViaServiceRole(
    "especialista_grade",
    `id=eq.${IDS.gradeEsp2Sab}`
  );
  await inserirViaServiceRole("especialista_grade", {
    id: IDS.gradeEsp2Sab,
    profile_id: IDS.esp2Profile,
    dia_semana: 6, // sábado de manhã — fora de {ter,qui}×{noite}
    hora_inicio: "09:00",
    hora_fim: "11:00",
  });
  // a dupla DPP hospedeira da contra-proposta tem que estar ativa — um
  // spec vizinho que recriou a âncora 16 a deixou 'concluida' (0102)
  await convergirDuplaAtiva(IDS.duplaDpp);
}

test.describe("WP6-R2 — encaixa, autor da sugestão e CTA de triagem", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(convergirWp6R2);
  test.afterAll(convergirWp6R2);

  test("'encaixa com você' destaca os slots na grade do jovem — agenda e mesa", async ({
    page,
  }) => {
    await loginComSenha(page, JOVEM_EMAIL, SENHA);

    // superfície 1 — /jovem/agenda: os chips "Pedir sessão" da trilha com
    // o Esp E2E (grade de terça à noite ⊂ grade do jovem) trazem o título
    // "… — encaixa com você"
    await page.goto("/jovem/agenda");
    const chips = page.getByTitle(/Pedir sessão .*— encaixa com você/);
    await expect(chips.first()).toBeVisible({ timeout: 15_000 });

    // superfície 2 — mesa de negociação em /jovem/especialistas: semeia
    // uma contra-proposta do esp2 e abre "Propor outro horário" — a grade
    // dele tem quinta à noite (encaixa) e sábado de manhã (não encaixa)
    const dia = (offsetDias: number) => {
      const d = new Date(Date.now() + offsetDias * 86_400_000);
      return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    };
    const slots = await rpcViaServiceRole<{ inicio: string }[]>(
      "especialista_slots_livres",
      { p_especialista: IDS.esp2Profile, p_desde: dia(0), p_ate: dia(21) }
    );
    const slotLivre = slots[0];
    const sol = await inserirViaServiceRole("solicitacoes_especialista", {
      mentorado_id: IDS.mentorado,
      dupla_dpp_id: IDS.duplaDpp,
      demanda:
        "E2E-146: horário do pedido — a grade do especialista não bate com a do jovem",
      motivo: null,
      origem: "jovem",
      status: "contra_proposta",
      turma: "T1 · E2E",
      especialista_desejado_id: IDS.esp2Profile,
      // em contra_proposta o especialista já está ENGAJADO — sem
      // especialista_id a mesa não mostra "Propor outro horário" pro jovem
      especialista_id: IDS.esp2Profile,
      slot_proposto: slotLivre!.inicio,
      created_by: IDS.jovemProfile,
    });
    await inserirViaServiceRole("solicitacao_propostas", {
      solicitacao_id: (sol as { id: string }).id,
      autor_id: IDS.esp2Profile,
      slot_proposto: slotLivre!.inicio,
      mensagem: "E2E: consigo nesse horário — serve?",
    });

    await page.goto("/jovem/especialistas");
    const item = secaoPedidos(page).locator("li", {
      hasText: "Sessão com Esp",
    });
    await expect(
      item.getByText(/Negociando horário com Esp/)
    ).toBeVisible();
    // REALIZA-186: "Propor outro horário" saiu do botão solto pro ⋯
    // "Ações do pedido de …" — abre o menu, o item vem dele
    await agirComConfirma(
      () =>
        item.getByRole("button", { name: /Ações do pedido de / }).click(),
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
        item
          .getByRole("radiogroup", {
            name: "Horários livres do especialista",
          })
          .isVisible()
    );

    const radios = item.getByRole("radio", { name: / às \d{2}:\d{2}/ });
    const encaixados = item.getByRole("radio", {
      name: /— encaixa com você/,
    });
    await expect(encaixados.first()).toBeVisible();
    const total = await radios.count();
    const dentro = await encaixados.count();
    expect(dentro).toBeGreaterThan(0); // quinta à noite encaixa
    expect(dentro).toBeLessThan(total); // sábado de manhã fica de fora
  });

  test("sugestão do mentor mostra o nome dele — Ana lê 'Otávio Martins sugeriu'", async ({
    page,
  }) => {
    // fixture de* do staging: sol …1004 'sugerida', origem mentor, autor
    // Otávio Martins — read-only pra não consumir a fixture compartilhada
    await loginComSenha(page, ANA_EMAIL, DEMO_SENHA);

    await page.goto("/jovem");
    const card = cardHome(page);
    // o card inteiro é o link — título "1 sugestão esperando você", sub
    // com o primeiro nome do autor resolvido via jovem_contatos
    await expect(
      card.getByText("1 sugestão esperando você")
    ).toBeVisible();
    await expect(
      card.getByText(/Otávio sugeriu um especialista pra você/)
    ).toBeVisible();

    await page.goto("/jovem/especialistas");
    const sugestoes = page.locator(
      'section[aria-label="Sugestões do seu mentor"]'
    );
    // o stitch via jovem_contatos resolve o autor — sem ele o jovem leria
    // o fallback genérico "Seu mentor sugeriu…"
    await expect(
      sugestoes.getByText("Otávio Martins sugeriu um especialista pra você")
    ).toBeVisible();
    await expect(sugestoes.getByText(/Pensando em:/)).toBeVisible();
    await expect(sugestoes.getByText(/Luísa/)).toBeVisible();
  });

  test("home do jovem sem DPP: pedido em triagem ganha 'com a coordenação'", async ({
    page,
  }) => {
    await inserirViaServiceRole("solicitacoes_especialista", {
      mentorado_id: IDS.mentoradoSemDpp,
      demanda:
        "E2E-146: primeiro pedido sem dupla — a coordenação precisa olhar antes",
      motivo: null,
      origem: "jovem",
      status: "aguardando_coord",
      turma: "T1 · E2E",
      created_by: IDS.jovem2Profile,
    });

    await loginComSenha(page, JOVEM2_EMAIL, SENHA);
    // home: a seção de especialistas só abre com ação — pedido em triagem
    // não gera card; a linha honesta "com a coordenação" mora na mesa de
    // pedidos da página
    await page.goto("/jovem");
    await expect(cardHome(page)).toHaveCount(0);
    await page.goto("/jovem/especialistas");
    const item = secaoPedidos(page).locator("li").first();
    await expect(
      item.getByText("A coordenação tá olhando seu pedido antes de liberar.")
    ).toBeVisible();
    await expect(
      item.getByText(
        "A coordenação libera o pedido pra ele chegar aos especialistas."
      )
    ).toBeVisible();
  });
});
