import {
  agirComConfirma,
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  convergirDuplaAtiva,
  expect,
  inserirViaServiceRole,
  limparViaServiceRole,
  loginComSenha,
  test,
} from "../helpers";

// Shell do mentorado (REALIZA-108) contra backend real. Fixtures do
// scripts/seed-e2e-staging.mjs: profile jovem com senha, a ficha da
// mentorada da dupla …0030 vinculada a ele, um combinado pendente (e um do
// mentor, que a view jovem_encaminhamentos não expõe), um encontro futuro e
// as assinaturas pendentes (termo do mentorado + autorização do responsável).
// Specs escrevem de verdade — o piso re-converge a fixture antes de cada um
// e o afterAll sai do mapa pro próximo arquivo da suíte.
const JOVEM_EMAIL = process.env.E2E_JOVEM_EMAIL ?? "jovem-e2e@realiza.test";
// mesmo segredo compartilhado do mentor — um secret a menos no CI
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";

const IDS = {
  jovemProfile: "e2e00000-0000-4000-8000-0000000000b0",
  combinado: "e2e00000-0000-4000-8000-0000000000c1",
  encontro: "e2e00000-0000-4000-8000-0000000000d1",
  // WP7 — o encontro realizado da fixture de avaliação (REALIZA-109): é a
  // âncora da jornada (encontro corrente 16, "falta avaliar"). Fixture
  // compartilhada com avaliacao.spec — convergida, nunca deletada aqui.
  encontroRealizado: "e2e00000-0000-4000-8000-0000000000d2",
  mentorProfile: "e2e00000-0000-4000-8000-000000000010",
  coordProfile: "e2e00000-0000-4000-8000-000000000040",
  // a ficha da mentorada da dupla …0030 — destino dos links de instrumento
  mentorado: "e2e00000-0000-4000-8000-000000000020",
} as const;
const DUPLA_ID =
  process.env.E2E_DUPLA_ID ?? "e2e00000-0000-4000-8000-000000000030";

// as descrições moram no seed — se mudarem lá, mudam aqui
const COMBINADO_JOVEM = "Ler o capítulo 3 do guia até o próximo encontro";
const COMBINADO_MENTOR = "Mentor prepara material de revisão";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

/** Combinado do jovem volta a "pendente" — insert quando a row sumiu (a
 *  dupla caindo em cascade de um cleanup de run morto a leva junta; PATCH
 *  em row ausente é no-op silencioso e a home listava vazia). O prazo é
 *  re-carimbado como no seed: vencido renderiza "passou do prazo" na home. */
async function convergirCombinadoJovem() {
  const [c1] = await buscarViaServiceRole<{ id: string }[]>(
    "encaminhamentos",
    `select=id&id=eq.${IDS.combinado}`
  );
  const prazo = new Date(Date.now() + 10 * 86400e3).toISOString().slice(0, 10);
  if (c1) {
    await atualizarViaServiceRole(
      "encaminhamentos",
      `id=eq.${IDS.combinado}`,
      { status: "pendente", prazo }
    );
  } else {
    await inserirViaServiceRole("encaminhamentos", {
      id: IDS.combinado,
      dupla_id: DUPLA_ID,
      descricao: COMBINADO_JOVEM,
      responsavel: "mentorado",
      prazo,
      status: "pendente",
    });
  }
}

/** Piso entre specs (e retries): combinado pendente e encontro com data
 *  futura. Tudo patch-ou-insert — este arquivo deleta a d1 no afterAll e
 *  retries do Playwright rodam depois dele, então PATCH-only morria no
 *  retry (e um cleanup de run morto que derrubou a dupla leva o c1 junto). */
async function restaurarJovem() {
  await convergirCombinadoJovem();
  const futura3d = new Date(Date.now() + 3 * 86400e3).toISOString();
  const [d1] = await buscarViaServiceRole<{ id: string }[]>(
    "encontros",
    `select=id&id=eq.${IDS.encontro}`
  );
  if (d1) {
    await atualizarViaServiceRole("encontros", `id=eq.${IDS.encontro}`, {
      data_hora: futura3d,
      status: "agendado",
    });
  } else {
    await inserirViaServiceRole("encontros", {
      id: IDS.encontro,
      dupla_id: DUPLA_ID,
      numero: 8,
      data_hora: futura3d,
      status: "agendado",
    });
  }
  // WP7 — "Minha jornada" precisa de um realizado de âncora: sem ele o
  // encontro corrente cai pra 1 e as estações tardias trancam (o mentor.spec
  // varre os encontros da dupla — se o d2 sumiu, a trilha muda inteira).
  // Recria a fixture do seed (o insert dispara o trigger que minta o link).
  const [d2] = await buscarViaServiceRole<{ id: string }[]>(
    "encontros",
    `select=id&id=eq.${IDS.encontroRealizado}`
  );
  if (!d2) {
    const ha2d = new Date(Date.now() - 2 * 86400e3).toISOString();
    await inserirViaServiceRole("encontros", {
      id: IDS.encontroRealizado,
      dupla_id: DUPLA_ID,
      numero: 16,
      data_hora: ha2d,
      realizado_em: ha2d,
      status: "realizado",
    });
  }
  // a âncora é o ÚLTIMO encontro do cronograma: re-criá-la (ou um spec
  // vizinho que recriou) dispara o auto-encerramento da 0102 e a dupla
  // acorda 'concluida' — a home troca o hero e a jornada muda. O piso da
  // fixture é dupla ativa: desfaz o que o trigger mintou.
  await convergirDuplaAtiva(DUPLA_ID);
}

test.describe("mentorado — shell /jovem", () => {
  test.beforeEach(async ({ page }) => {
    await restaurarJovem();
    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    // o login despeja em "/" (grupo app), que devolve o mentorado pro shell
    // dele — esperar o destino fixa o ponto de partida de cada spec. O
    // redirect /→/jovem em preview frio passa dos 15s (mesma régua dos 30s
    // do loginComSenha)
    await page.waitForURL((u) => u.pathname === "/jovem", { timeout: 30_000 });
  });

  test.afterAll(async () => {
    // a home do mentor olha a MESMA dupla: um agendado fixture pendurado
    // trocaria o CTA "Agendar encontro" por "Agendar próximo encontro" e quebraria o
    // spec dele — os encontros da dupla voltam a zero (o seed recria o d1)
    // Filhos da 0071 primeiro: se o d1 passou por 'realizado' o trigger
    // mintou avaliacao_links (e o spec pode ter avaliado) — apagar o pai
    // direto dá 409 na FK.
    await limparViaServiceRole(
      "avaliacoes_encontro",
      `encontro_id=eq.${IDS.encontro}`
    );
    await limparViaServiceRole(
      "avaliacao_links",
      `encontro_id=eq.${IDS.encontro}`
    );
    await limparViaServiceRole("encontros", `id=eq.${IDS.encontro}`);
    await convergirCombinadoJovem();
    // pedidos de ajuda do spec — cada destinatário (incl. coords reais do
    // staging) sai junto pelo created_by; o chamado aberto pelo dialog e
    // a trilha pública dele vão em cascata
    await limparViaServiceRole(
      "notificacoes",
      `created_by=eq.${IDS.jovemProfile}`
    );
    await limparViaServiceRole(
      "chamados",
      `autor_id=eq.${IDS.jovemProfile}`
    );
  });

  test("login cai na home do jovem e rotas de staff devolvem pra ela", async ({
    page,
  }) => {
    // o beforeEach já pousou em /jovem — a home apresenta a dupla dele
    await expect(
      page.getByRole("heading", { name: /Olá, Mentorada/ })
    ).toBeVisible();
    const mentoria = page.locator('section[aria-labelledby="dupla-titulo"]');
    await expect(mentoria.getByText("Mentor E2E")).toBeVisible();
    await expect(mentoria.getByText("Seu mentor")).toBeVisible();

    // qualquer rota do grupo (app) devolve o mentorado pro shell próprio —
    // incluindo a home de staff
    for (const rota of ["/", "/pessoas", "/agenda", "/duplas"]) {
      await page.goto(rota);
      await page.waitForURL((u) => u.pathname === "/jovem", {
        timeout: 15_000,
      });
    }
  });

  test("home lista o combinado do jovem e esconde o do mentor", async ({
    page,
  }) => {
    // a seção nasce recolhida — a âncora abre ao hidratar (mesmo caminho
    // das pendências do "Para fazer agora")
    await page.goto("/jovem#combinados-titulo");
    const combinados = page.locator(
      'section[aria-labelledby="combinados-titulo"]'
    );
    // a seção nasce recolhida (hash abre; se o roteador reescrever antes da
    // hidratação, o trigger é o caminho)
    const itemCombinado = combinados.getByText(COMBINADO_JOVEM);
    // o hash abre a seção; só clica no trigger se ela estiver FECHADA
    // (clicar numa seção aberta pelo hash fecha)
    const gatilhoCombinados = combinados.getByRole("button", {
      name: /Meus combinados/,
    });
    if ((await gatilhoCombinados.getAttribute("aria-expanded")) === "false") {
      await gatilhoCombinados.click();
    }
    await expect(itemCombinado).toBeVisible({ timeout: 15_000 });
    await expect(combinados.getByText(COMBINADO_JOVEM)).toBeVisible();
    // o filtro é da view (responsavel='mentorado'): nem no DOM entra
    await expect(combinados.getByText(COMBINADO_MENTOR)).toHaveCount(0);
  });

  test("home mostra o próximo encontro e os documentos pendentes", async ({
    page,
  }) => {
    await page.goto("/jovem#docs-titulo");
    // o hero "Seu próximo encontro" (redesign) é o card de abertura — a
    // home mostra só o PRÓXIMO encontro (futuros[0]); em run paralelo a
    // trilha esp ou outro spec pode pôr um mais perto, então o assert é
    // "o card de próximo existe", não "é o nº 8"
    const encontros = page.locator(
      'section[aria-labelledby="proximo-titulo"]'
    );
    // o hero "Nº encontro com {nome}" e os links de roteiro ("Roteiro do
    // Nº encontro") casam o mesmo padrão — o primeiro match é o hero
    await expect(encontros.getByText(/\d+º encontro/).first()).toBeVisible();

    const docs = page.locator('section[aria-labelledby="docs-titulo"]');
    await expect(
      docs.getByText(
        "Termo de Adesão e Participação no Programa de Mentoria Social"
      )
    ).toBeVisible();
    await expect(docs.getByRole("link", { name: "Assinar" })).toBeVisible();
    await expect(docs.getByText("Autorização do Responsável")).toBeVisible();
    await expect(
      docs.getByRole("link", { name: /Encaminhar para o responsável/ })
    ).toBeVisible();
  });

  test("marcar combinado persiste via RPC marcar_combinado", async ({
    page,
  }) => {
    // âncora abre a seção recolhida (o reload adiante mantém o hash e
    // reabre sozinha — prova o caminho que uma pendência usa)
    await page.goto("/jovem#combinados-titulo");
    const combinados = page.locator(
      'section[aria-labelledby="combinados-titulo"]'
    );
    // o input é sr-only — o clique honesto é no label que o embrulha.
    // Checkbox é controlado: um clique pré-hidratação fica só no DOM e o
    // React desfaz ao ligar — repete até a action disparar o toast. O
    // click tem teto: o input desabilita enquanto a action roda
    await agirComConfirma(
      () =>
        combinados
          .locator("label", { hasText: COMBINADO_JOVEM })
          .click({ timeout: 5_000 }),
      () => page.getByText("Combinado marcado como feito.").isVisible()
    );
    await expect(
      page.getByText("Combinado marcado como feito.")
    ).toBeVisible({ timeout: 15_000 });
    // checked vem do server (RPC + router.refresh) — preview frio leva
    // mais que os 5s default; a suite já usa 15s pra roundtrip assim.
    // Redesign: o item sai da lista de abertos e recolhe em "Ver N feitos"
    // (o painel fica desmontado até abrir) — é lá que o checked mora agora
    const checkboxFeito = combinados
      .locator("label", { hasText: COMBINADO_JOVEM })
      .getByRole("checkbox");
    await agirComConfirma(
      () =>
        combinados
          .getByRole("button", { name: /Ver \d+ feito/ })
          .click({ timeout: 5_000 }),
      () => checkboxFeito.isVisible()
    );
    await expect(checkboxFeito).toBeChecked({ timeout: 15_000 });
    // o router.refresh re-renderizou — e o estado sobrevive a um reload de
    // verdade (write passou pelo banco, não por estado local)
    await page.reload();
    const recarregados = page.locator(
      'section[aria-labelledby="combinados-titulo"]'
    );
    const checkboxReload = recarregados
      .locator("label", { hasText: COMBINADO_JOVEM })
      .getByRole("checkbox");
    await agirComConfirma(
      () =>
        recarregados
          .getByRole("button", { name: /Ver \d+ feito/ })
          .click({ timeout: 5_000 }),
      () => checkboxReload.isVisible()
    );
    await expect(checkboxReload).toBeChecked({ timeout: 15_000 });
  });

  test("pedir ajuda abre chamado e avisa a equipe — nunca o mentor", async ({
    page,
  }) => {
    await page.goto("/jovem");
    // o botão solto virou a linha discreta de ajuda — sem pedido vivo o
    // trigger cheio é "Pedir ajuda / Precisa de ajuda? Fale com a equipe";
    // com pedido em curso (o teste pode herdar um de runs anteriores) o
    // gesto encolhe no ghost "Pedir ajuda". Os dois abrem o mesmo chamado.
    const dialog = page.getByRole("dialog");
    await agirComConfirma(
      () =>
        page
          .getByRole("button", { name: /Pedir ajuda|Precisa de ajuda/ })
          .click(),
      () => dialog.isVisible()
    );
    // 0084: o canal de segurança é um chamado — opção na linguagem dele
    // (o chip vira aria-pressed; o clique pode cair pré-hidratação)
    const chipMentor = dialog.getByRole("button", { name: /Com meu mentor/ });
    await agirComConfirma(
      () => chipMentor.click(),
      async () =>
        (await chipMentor.getAttribute("aria-pressed")) === "true"
    );
    await dialog
      .locator("#chamado-assunto")
      .fill("E2E: preciso falar com alguém da equipe");
    await dialog
      .locator("#chamado-mensagem")
      .fill("E2E: preciso falar com meu mentor");
    await dialog.getByRole("button", { name: "Enviar pedido" }).click();

    await expect(page.getByText(/equipe foi avisada/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });

    // write real: o chamado existe com o jovem como autor (a equipe vê
    // quem pediu — é canal de segurança, não anônimo)
    const [chamado] = await buscarViaServiceRole<
      { id: string; numero: string; autor_id: string }[]
    >(
      "chamados",
      `select=id,numero,autor_id&autor_id=eq.${IDS.jovemProfile}&order=created_at.desc&limit=1`
    );
    expect(chamado.numero).toMatch(/^CHA-\d{6}$/);

    // a equipe foi avisada no sino — o mentor da dupla NÃO entra na lista:
    // o pedido pode ser justamente sobre ele (privacidade do canal)
    const rows = await buscarViaServiceRole<{ profile_id: string }[]>(
      "notificacoes",
      `select=profile_id&tipo=eq.chamado_aberto&href=eq./chamados%3Fc%3D${chamado.id}`
    );
    const destinos = rows.map((r) => r.profile_id);
    expect(destinos).toContain(IDS.coordProfile);
    expect(destinos).not.toContain(IDS.mentorProfile);
  });

  test("agenda lista o encontro futuro", async ({ page }) => {
    await page.goto("/jovem/agenda");
    await expect(
      page.getByRole("heading", { name: "Agenda", level: 1 })
    ).toBeVisible();
    const proximos = page.locator('section[aria-labelledby="agenda-proximos"]');
    await expect(proximos.getByText("8º encontro")).toBeVisible({
      timeout: 15_000,
    });
    // .first: a trilha esp (e specs paralelos) põe outro "Agendado" na
    // mesma lista — o assert é "o encontro existe com o badge", não "1 só"
    await expect(
      proximos.getByText("Agendado").filter({ visible: true }).first()
    ).toBeVisible();
  });

  // WP7 (REALIZA-140) + FR-007 (010) — /jovem/materiais é o hub de
  // Materiais: as 7
  // estações canônicas do guia com datas da turma dela (RPC jovem_jornada,
  // 0096) + a biblioteca de sempre como "Acervo". Sem dupla/cronograma a
  // página cai no fallback da biblioteca (mesma h1 "Materiais") — a
  // fixture …0030 tem os dois.
  test("materiais é o hub de materiais — estante dos instrumentos + acervo", async ({
    page,
  }) => {
    await page.goto("/jovem/materiais");
    await expect(
      page.getByRole("heading", { name: "Materiais", level: 1 })
    ).toBeVisible();
    // hero — posição no ciclo + progresso de entregas. O d2 convergido no
    // piso dá "encontro 16 de 16"; a regex tolera um sweep paralelo que
    // apague a âncora (a trilha tranca, mas o hub continua de pé)
    await expect(page.getByText(/encontro \d+ de 16/)).toBeVisible();
    await expect(
      page.getByRole("img", { name: /\d+ de 7 entregas feitas/ })
    ).toBeVisible();

    // a estante "Meus instrumentos" (v6a) — os 6 instrumentos de entrega
    // única sempre na ordem narrativa do guia; a recorrente saiu da
    // grade: pendente vira banner, em dia vira o acesso ao histórico.
    // Com o realizado no lugar (enc. corrente 16) todos estão visíveis.
    const trilha = page.locator(
      'section[aria-labelledby="meus-instrumentos-titulo"]'
    );
    for (const titulo of [
      "Roda da Vida · leitura inicial",
      "Construindo a sua Visão",
      "Definindo minhas metas",
      "PDM · Plano de Desenvolvimento",
      "Roda da Vida · aplicação formal",
      "Avaliação final",
    ]) {
      await expect(
        trilha.getByRole("heading", { name: titulo })
      ).toBeVisible();
    }
    // sem link emitido: o pill "A fazer" vem com quem envia — a jornada
    // nunca empurra link que não existe (emissor mentor × coord no 360º).
    // .first: a frase aparece em cada estação pendente da estante — o
    // contrato é "existe a instrução", não a estação exata
    await expect(
      trilha
        .getByText(
          /o instrumento já devia estar liberado: fala com teu mentor|a coordenação libera quando chegar a hora/
        )
        .first()
    ).toBeVisible();
    // a recorrente: a fixture deixa o enc. 16 realizado sem a estrela — a
    // pendência vira banner no topo da estante (ou "Suas avaliações" se
    // um spec paralelo já avaliou — os dois são o estado honesto).
    // .first: o texto pode sair no banner e no rótulo da estação — vale
    // qualquer um dos dois visível
    await expect(
      trilha
        .getByText(/Falta a nota do encontro \d+|Suas avaliações/)
        .first()
    ).toBeVisible();

    // sub-nav de página + o acervo — a biblioteca de sempre continua embaixo
    const nav = page.getByRole("navigation", { name: "Nesta página" });
    await expect(
      nav.getByRole("link", { name: "Meus instrumentos" })
    ).toBeVisible();
    await expect(
      page.locator("section#acervo").getByRole("heading", { name: "Acervo" })
    ).toBeVisible();
  });

  test("instrumento com link pendente vira card-link /f/ — e 'Em andamento' com rascunho local", async ({
    page,
  }) => {
    // O recorte "a_fazer + token → link /f/<token>" + o overlay do pill
    // (rascunho no localStorage DESTE aparelho, mesma chave do form público).
    // O link é semeado via service role e sai junto no fim — o seed não
    // cria entrega nenhuma pra essa dupla.
    const [form] = await buscarViaServiceRole<{ id: string }[]>(
      "formularios",
      "select=id&sistema=eq.visao&ativo=eq.true&limit=1"
    );
    test.skip(!form, "sem instrumento oficial de visão ativo no ambiente");
    const token = crypto.randomUUID().replaceAll("-", "");
    try {
      // piso cirúrgico: uma entrega respondida esconderia a pendente (a
      // resposta vence na derivação) — links visão↔mentorada da dupla são
      // leftover de run morto, nunca fixture do seed
      await limparViaServiceRole(
        "formulario_links",
        `dupla_id=eq.${DUPLA_ID}&formulario_id=eq.${form.id}&dest_mentorado_id=eq.${IDS.mentorado}`
      );
      await inserirViaServiceRole("formulario_links", {
        formulario_id: form.id,
        token,
        dest_mentorado_id: IDS.mentorado,
        dupla_id: DUPLA_ID,
        contexto: { origem: "instrumentos" },
        created_by: IDS.mentorProfile,
      });
      // o rascunho é conhecimento local — o JornadaRascunho lê a chave uma
      // vez no mount; plantar antes da navegação simula a volta do /f/token
      await page.addInitScript(
        (k) => {
          localStorage.setItem(k, JSON.stringify({ filme: "rascunho e2e" }));
        },
        `rascunho:/f/${token}`
      );
      await page.goto("/jovem/materiais");

      const trilha = page.locator(
        'section[aria-labelledby="meus-instrumentos-titulo"]'
      );
      // v5c — o card aberto É o link pro /f/<token> (gesto único, sem
      // botão "Continuar" redundante dentro). :is() cobre os dois formatos
      // honestos: âncora inteira quando não há resposta anterior, article
      // com os gestos listados quando há (re-emissão). O pill vira "Em
      // andamento" com o rascunho local deste aparelho
      // .first: o nome aparece no título do card e pode reaparecer dentro
      // dos gestos dele — ancora no bloco de cima, que é o card em si
      const visao = trilha
        .locator(":is(article, a)", {
          hasText: "Construindo a sua Visão",
        })
        .first();
      await expect(visao).toBeVisible();
      await expect(
        trilha.locator(`a[href="/f/${token}"]`)
      ).toBeVisible();
      await expect(visao.getByText("Em andamento")).toBeVisible();
      await expect(
        visao.getByText("rascunho salvo neste aparelho")
      ).toBeVisible();

      // e não há bloco duplicado: o instrumento aberto mora só na estante
      // (o "A fazer agora" da REALIZA-162 foi aposentado pelo v5c)
      await expect(
        page.getByRole("heading", { name: "A fazer agora" })
      ).toHaveCount(0);
    } finally {
      await limparViaServiceRole("formulario_links", `token=eq.${token}`);
    }
  });

  test("re-emissão decidida lê 'a dupla decidiu refazer' — nunca 'o mentor enviou' (515)", async ({
    page,
  }) => {
    // REALIZA-515 — só a emissão DEPOIS de uma resposta e fora do origem
    // 'auto' é re-emissão real: o detalhe vira "a dupla decidiu refazer"
    // e o Rever ganha o CTA "Responder a nova rodada"
    const [form] = await buscarViaServiceRole<{ id: string }[]>(
      "formularios",
      "select=id&sistema=eq.roda_vida&ativo=eq.true&limit=1"
    );
    test.skip(!form, "sem instrumento oficial de roda_vida ativo");
    const tokenVelho = crypto.randomUUID().replaceAll("-", "");
    const tokenNovo = crypto.randomUUID().replaceAll("-", "");
    try {
      // piso cirúrgico: links roda_vida↔mentorada da dupla são leftover
      // de run morto — a fixture não semeia entrega de instrumento
      await limparViaServiceRole(
        "formulario_links",
        `dupla_id=eq.${DUPLA_ID}&formulario_id=eq.${form.id}&dest_mentorado_id=eq.${IDS.mentorado}`
      );
      // a 1ª rodada respondida (a que a auto-emissão minta na criação da
      // dupla) e a emitida depois pela dupla — origem 'instrumentos' é o
      // gesto decidido de refazer
      const respondida = await inserirViaServiceRole("formulario_links", {
        formulario_id: form.id,
        token: tokenVelho,
        dest_mentorado_id: IDS.mentorado,
        dupla_id: DUPLA_ID,
        contexto: { origem: "auto", momento: "inicial" },
        created_at: new Date(Date.now() - 6 * 86400e3).toISOString(),
        usado_em: new Date(Date.now() - 5 * 86400e3).toISOString(),
      });
      await inserirViaServiceRole("formulario_respostas", {
        link_id: respondida.id,
        respostas: { reflexao: "resposta da primeira roda" },
        respondido_em: new Date(Date.now() - 5 * 86400e3).toISOString(),
      });
      await inserirViaServiceRole("formulario_links", {
        formulario_id: form.id,
        token: tokenNovo,
        dest_mentorado_id: IDS.mentorado,
        dupla_id: DUPLA_ID,
        contexto: { origem: "instrumentos", momento: "inicial" },
        created_by: IDS.mentorProfile,
      });

      await page.goto("/jovem/materiais");
      const trilha = page.locator(
        'section[aria-labelledby="meus-instrumentos-titulo"]'
      );
      const card = trilha.locator("article", {
        hasText: "Roda da Vida · leitura inicial",
      });
      await expect(
        card.getByText(
          "a dupla decidiu refazer: a resposta anterior segue salva"
        )
      ).toBeVisible();
      // a copy antiga fingia certeza que o gesto não tinha
      await expect(
        page.getByText(/o mentor enviou uma nova rodada/)
      ).toHaveCount(0);

      // o gesto abre o Rever — a ação secundária aponta pro link novo
      // (Button render={<Link/>} da kit: na árvore lê button, no DOM é <a>)
      await card.click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("button", { name: "Responder a nova rodada" })
      ).toBeVisible();
      await expect(
        dialog.locator(`a[href="/f/${tokenNovo}"]`)
      ).toBeAttached();
      await page.keyboard.press("Escape");
    } finally {
      // as respostas caem em cascata com os links — a fixture volta a
      // "sem entregas"
      await limparViaServiceRole(
        "formulario_links",
        `token=in.(${tokenVelho},${tokenNovo})`
      );
    }
  });

  test("perfil mostra a ficha do programa e os dados de contato", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    await expect(
      page.getByRole("heading", { name: "Mentorada E2E", level: 1 })
    ).toBeVisible();
    // o desenho é o do perfil de todo mundo: badge de papel no header,
    // ficha como gaveta (summary), dados como seção e conta no fim
    // .first: "Mentorado" sai no badge do header e no papel da ficha —
    // vale o badge, que é o primeiro da página
    await expect(page.getByText("Mentorado").first()).toBeVisible();
    await expect(
      page.locator("summary").getByText("Sua ficha no programa")
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Seus dados" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Conta" })
    ).toBeVisible();
    await expect(page.getByText(/jovem-e2e@realiza\.test/)).toBeVisible();
    // opt-in colega↔colega (0076): a ficha do jovem não tem WhatsApp — o
    // controle aparece desligado e explicado, nunca escondido
    await expect(
      page.getByRole("heading", { name: "Privacidade" })
    ).toBeVisible();
    await expect(
      page.getByRole("switch", { name: /Compartilhar meu WhatsApp/ })
    ).toBeDisabled();
  });

  test("perfil: a faixa nova avisa uma vez — o toast de level-up (024)", async ({
    page,
  }) => {
    // baseline local abaixo da faixa real: o caminho do encontro
    // retroativo ou da correção da coordenação (FR-012). A chave é por
    // ficha (mentorado.id) e só se semeia quando ausente — senão o init
    // script re-zeraria a baseline na segunda navegação do teste
    await page.addInitScript((id) => {
      const k = `realiza:nivel:${id}`;
      if (localStorage.getItem(k) === null) localStorage.setItem(k, "-1");
    }, IDS.mentorado);
    await page.goto("/jovem/perfil");
    await expect(page.getByText(/^Subiu de nível: /)).toBeVisible();
    // a baseline gravada segura a próxima visita: um toast por faixa nova.
    // O assert negativo pede a página hidratada + um respiro — o efeito
    // do notifier roda no mount, contagem 0 imediata seria falso passe
    await page.goto("/jovem/perfil");
    await expect(
      page.getByRole("heading", { name: "Mentorada E2E", level: 1 })
    ).toBeVisible();
    await page.waitForTimeout(1200);
    await expect(page.getByText(/^Subiu de nível: /)).toHaveCount(0);
  });

  test("perfil edita os dados dele pelo lápis — o gesto do perfil de todos", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    const dialog = page.getByRole("dialog");
    await agirComConfirma(
      () => page.getByRole("button", { name: "Editar seus dados" }).click(),
      () => dialog.isVisible()
    );
    await expect(
      dialog.getByRole("heading", { name: "Seus dados" })
    ).toBeVisible();
    await dialog
      .getByLabel("Seu WhatsApp")
      .fill("(11) 98888-7777");
    await dialog.getByRole("button", { name: /Salvar/i }).click();
    await expect(page.getByText("(11) 98888-7777")).toBeVisible({
      timeout: 15_000,
    });
    // reverte — o spec é rerodável e o número não é fixture de ninguém
    await page.getByRole("button", { name: "Editar seus dados" }).click();
    await page.getByRole("dialog").getByLabel("Seu WhatsApp").fill("");
    await page.getByRole("dialog").getByRole("button", { name: /Salvar/i }).click();
  });

  test("pessoas lista a equipe das duplas e o diretório de colegas", async ({
    page,
  }) => {
    await page.goto("/jovem/pessoas");
    await expect(
      page.getByRole("heading", { name: "Pessoas", level: 1 })
    ).toBeVisible();
    // 023: o diretório único substituiu as seções por cargo. O mentor e o
    // especialista da dupla continuam entrando pela rede, e os jovens com
    // conta aparecem como "Jovem do programa".
    await expect(
      page.getByRole("link", { name: "Abrir perfil de Mentor E2E", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Abrir perfil de Esp E2E", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Abrir perfil de Ana Beatriz Souza" })
    ).toBeVisible();
    await expect(page.getByText("Sua rede").first()).toBeVisible();
  });
});
