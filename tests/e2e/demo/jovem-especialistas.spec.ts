import { entrarNaDemo, expect, test } from "../helpers";

// WP6-R2 — especialista no /jovem/especialistas + superfícies vizinhas.
// A persona mentorado (login Ana, social Bia) cobre todos os cenários do
// dataset evergreen:
//   · sugestão pendente do mentor (origem mentor, autor Ricardo, alvo Marcos)
//   · trilha ATIVA com a Sofia (matemática) — stepper dos 5 passos do guia
//   · trilha CONCLUÍDA com a Helena (oratória) — feed de devolutivas datado
//   · negociação viva (contra-proposta da Helena na mesa, com radios da
//     grade real — os slots de ter/qui à noite "encaixam" na grade dela)
//   · cardápio com todos os estados de card (vagas, agenda fechada,
//     preferência) + rodapé "Falar com a coordenação (abre um chamado)"
// A persona mentor_especialista (Sofia) cobre o mural: busca acento-
// insensível, chips de filtro, "Direcionada a você". A persona coordenacao
// cobre o painel somente-leitura de trilhas + "Pedidos parados" (o pedido
// do Wendel está parado na triagem há 6 dias — acima do limiar de 5).

const secaoPedidos = (page: import("@playwright/test").Page) =>
  page.locator("section#pedidos");
const secaoTrilhas = (page: import("@playwright/test").Page) =>
  page.locator("section#trilhas");
const cardHome = (page: import("@playwright/test").Page) =>
  page.locator('section[aria-labelledby="esp-titulo"]');
const mural = (page: import("@playwright/test").Page) =>
  page.locator('section[aria-label="Pedidos de mentoria especializada"]');

test.describe("mentorado — home, página e ciclo de vida", () => {
  test("card-CTA da home prioriza a sugestão do mentor e ancora na página", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem");

    const card = cardHome(page);
    await expect(
      card.getByRole("heading", { name: "Especialistas" })
    ).toBeVisible();
    // sugestão > trilha > pedido > convite: a do Ricardo está esperando
    // resposta — ganha do "em andamento" da Sofia. O card inteiro é o
    // link (uma ação por contexto): o título conta o N e o corpo diz quem
    const link = card.getByRole("link", {
      name: /1 sugestão esperando você/,
    });
    await expect(link).toBeVisible();
    await expect(
      card.getByText(/Ricardo sugeriu um especialista pra você/)
    ).toBeVisible();
    await expect(link).toHaveAttribute("href", "/jovem/especialistas");

    // o clique leva pra página — a sugestão aparece na seção própria
    await link.click();
    await page.waitForURL("**/jovem/especialistas");
    await expect(
      page.getByRole("heading", { name: "Especialistas" })
    ).toBeVisible();
    const sugestoes = page.locator(
      'section[aria-label="Sugestões do seu mentor"]'
    );
    await expect(
      sugestoes.getByText("Ricardo Tavares sugeriu um especialista pra você")
    ).toBeVisible();
    await expect(sugestoes.getByText(/Pensando em:/)).toBeVisible();
    await expect(sugestoes.getByText(/Marcos/)).toBeVisible();
    await expect(
      sugestoes.getByRole("button", { name: "Quero seguir" })
    ).toBeVisible();
    await expect(
      sugestoes.getByRole("button", { name: "Agora não" })
    ).toBeVisible();
  });

  test("trilhas: stepper dos 5 passos na ativa + feed datado na concluída", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/especialistas");

    const trilhas = secaoTrilhas(page);
    await expect(
      trilhas.getByRole("heading", { name: "Suas trilhas" })
    ).toBeVisible();

    // rodada out/2026: a trilha virou cartão compacto — progresso "N de 5
    // sessões" com barra, "Próximo passo" e a devolutiva mais recente em
    // prévia ficam à vista. O ciclo de vida, a linha do tempo das sessões
    // e o feed completo moram no <details> "Ver trilha completa" (fechado
    // por padrão) — abre os dois antes de conferir o recolhível.
    await expect(trilhas.getByRole("progressbar")).toHaveCount(2);
    // exact: uma devolutiva da Helena traz "Próximo passo —" no corpo —
    // getByText casa texto dentro do <details> fechado também
    await expect(
      trilhas.getByText("Próximo passo", { exact: true })
    ).toHaveCount(2);
    await expect(
      trilhas.getByText("Última devolutiva", { exact: true })
    ).toHaveCount(2);
    await expect(trilhas.getByText(/Trilha concluída em/)).toBeVisible();

    const completas = trilhas.getByText("Ver trilha completa");
    await expect(completas).toHaveCount(2);
    for (const summary of await completas.all()) {
      await summary.click();
    }

    // as duas trilhas (Sofia ativa + Helena concluída) trazem o ciclo de
    // vida em 5 passos e o stepper do guia — dois lists por card
    const ciclos = trilhas.getByRole("list", {
      name: "Ciclo de vida da trilha",
    });
    await expect(ciclos).toHaveCount(2);
    await expect(ciclos.first().locator("li")).toHaveCount(5);
    // na trilha concluída todos os passos fecham — o último é a devolutiva
    const cicloHelena = ciclos.nth(1);
    await expect(
      cicloHelena.getByText("Concluída + devolutiva").first()
    ).toBeVisible();
    await expect(
      cicloHelena.getByText("Helena aceitou", { exact: true })
    ).toBeVisible();

    const passos = trilhas.locator('ol[aria-label="Passos da trilha"]');
    await expect(passos).toHaveCount(2);
    await expect(passos.first().locator("li")).toHaveCount(5);

    // feed datado: as duas devolutivas da Helena, assinadas com nome + data
    await expect(
      trilhas.getByText("Devolutivas da trilha")
    ).toHaveCount(2);
    const feedHelena = trilhas.locator("ul", { hasText: "Helena Prado ·" });
    await expect(feedHelena.locator("li")).toHaveCount(2);
    await expect(
      trilhas.getByText(
        "Trilha concluída — os 5 encontros aconteceram e a meta da solicitação foi batida."
      )
    ).toBeVisible();
  });

  test("mesa de negociação: contra-proposta da Helena com radios encaixáveis", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/especialistas");

    const pedidos = secaoPedidos(page);
    await expect(
      pedidos.getByRole("heading", { name: "Pedidos em aberto" })
    ).toBeVisible();
    const item = pedidos.locator("li", { hasText: "Sessão com Helena" });
    await expect(
      item.getByText(/Negociando horário com Helena/)
    ).toBeVisible();

    // abrir a contra-proposta → grade de dias, radios (input sr-only no
    // label) — a grade da Helena é ter/qui à noite e a da Bia cobre os
    // dois dias no mesmo período: todos os slots "encaixam"
    // (REALIZA-186: o gesto saiu do botão solto pro ⋯ "Ações do pedido")
    await item
      .getByRole("button", { name: /Ações do pedido de / })
      .click();
    await page
      .getByRole("menuitem", { name: "Propor outro horário" })
      .click();
    const grupo = item.getByRole("radiogroup", {
      name: "Horários livres do especialista",
    });
    await expect(grupo).toBeVisible();
    const radios = grupo.getByRole("radio", { name: / às \d{2}:\d{2}/ });
    expect(await radios.count()).toBeGreaterThan(0);
    const encaixados = grupo.getByRole("radio", {
      name: /· encaixa com você/,
    });
    expect(await encaixados.count()).toBe(await radios.count());
    // selecionar um ativa o botão Propor — estado da escolha fica no radio
    await radios.first().locator("xpath=..").click();
    await expect(radios.first()).toBeChecked();
    await expect(
      item.getByRole("button", { name: "Propor", exact: true })
    ).toBeEnabled();
  });

  test("cardápio: estados de card, preferência e chamado da coordenação", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/especialistas");

    const catalogo = page.getByRole("region", {
      name: "Quem pode te ajudar",
    });
    await expect(
      catalogo.getByRole("heading", { name: "Quem pode te ajudar" })
    ).toBeVisible();

    // Camila — capacidade_especialista 0 → trava "Sem vagas" + explicação
    await expect(catalogo.getByText("Camila Ferraz")).toBeVisible();
    await expect(catalogo.getByText("Sem vagas")).toBeVisible();
    await expect(
      catalogo.getByText("Agenda cheia no momento. Seu pedido vai pro mural.")
    ).toBeVisible();
    // Marcos — alvo da sugestão; nunca abriu grade → "Agenda não aberta"
    await expect(catalogo.getByText("Marcos Vinícius")).toBeVisible();
    await expect(catalogo.getByText("Agenda não aberta")).toBeVisible();
    await expect(
      catalogo.getByText(
        "Ainda não liberou horários. Seu pedido vai pro mural."
      )
    ).toBeVisible();
    // Sofia — a especialista da Bia: variante "sua" com os dois gestos
    await expect(catalogo.getByText("Sua especialista")).toBeVisible();
    await expect(
      catalogo.getByRole("button", { name: "Pedir próxima sessão" })
    ).toBeVisible();
    // André — card normal: o gesto de preferência aparece pra quem não é
    // sua especialista nem tem pedido travando
    await expect(
      catalogo.getByRole("button", { name: "Prefiro esta pessoa" })
    ).toBeVisible();
    await expect(
      catalogo.getByRole("button", { name: "Pedir pro mural" }).first()
    ).toBeVisible();

    // o gesto da Sofia abre o dialog compartilhado de pedido — a escolha de
    // alvo é o primeiro passo
    await catalogo.getByRole("button", { name: "Pedir trilha" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Pedir apoio de um especialista" })
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /Um especialista específico/ })
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /Qualquer especialista/ })
    ).toBeVisible();
    // caminho dirigido: escolhe a Sofia — o passo de horário oferece
    // "Deixar Sofia propor" + chips dos slots reais da grade dela
    await dialog
      .getByRole("button", { name: /Um especialista específico/ })
      .click();
    await dialog
      .getByRole("button", { name: /Sofia Nogueira/ })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Deixar Sofia propor" })
    ).toBeVisible();
    await expect(
      dialog
        .getByRole("button", { name: /(terça|quinta|sábado|domingo) \d{2}\/\d{2} às \d{2}:\d{2}/ })
        .first()
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Enviar pedido" })
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // rodapé do catálogo — trava de agenda/método vira CHAMADO, outro
    // sistema: o botão abre o dialog "Pedir ajuda" do jovem
    await page
      .getByRole("button", { name: "Falar com a coordenação (abre um chamado)" })
      .click();
    const chamado = page.getByRole("dialog");
    await expect(
      chamado.getByRole("heading", { name: "Pedir ajuda" })
    ).toBeVisible();
    await expect(
      chamado.getByText("Resumindo, o que aconteceu?")
    ).toBeVisible();
    await expect(
      chamado.getByRole("button", { name: "Enviar pedido" })
    ).toBeVisible();
  });
});

test.describe("especialista — mural com busca e filtros", () => {
  test("mural: busca acento-insensível, chips de área e direcionada", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_especialista");
    await page.goto("/");

    const secao = mural(page);
    await expect(
      secao.getByRole("heading", { name: "Pedidos de especialista" })
    ).toBeVisible();
    // o mural fica recolhido com o contador no título — a lista de
    // trabalho abre sob gesto (home enxuta por desenho)
    await secao.locator("summary").click();
    // a lista de pedidos é a primeira da região (a segunda é "Sessões
    // confirmadas" — fora do filtro)
    const lista = secao.getByRole("list").first();
    const filtros = secao.getByRole("group", { name: "Filtrar pedidos" });
    const totalItens = await lista.getByRole("listitem").count();
    expect(totalItens).toBeGreaterThan(0);

    // busca — o pedido do Caio fala de "inglês"; digitar sem acento acha
    const busca = secao.getByRole("textbox", { name: "Buscar pedidos" });
    await busca.fill("ingles");
    await expect(
      lista.getByRole("listitem").filter({ hasText: /inglês/i })
    ).not.toHaveCount(0);
    // termo sem correspondência → lista esvazia + empty state honesto
    // (a <ul> desmonta — confere o texto, não o container)
    await busca.fill("zzzzqx");
    await expect(
      secao.getByText(/Nenhum pedido bate com a busca/)
    ).toBeVisible();
    await busca.fill("");
    await expect(lista.getByRole("listitem")).toHaveCount(totalItens);

    // chips de filtro — as áreas da Sofia alimentam a fileira
    await filtros.getByRole("button", { name: "inglês", exact: true }).click();
    const filtrados = lista.getByRole("listitem");
    expect(await filtrados.count()).toBeGreaterThan(0);
    expect(await filtrados.count()).toBeLessThan(totalItens);
    await filtros.getByRole("button", { name: "Todos", exact: true }).click();

    // o chip "Combina com você" cruza o texto do pedido com as áreas dela
    await filtros.getByRole("button", { name: "Combina com você" }).click();
    expect(await lista.getByRole("listitem").count()).toBeGreaterThan(0);
    await filtros.getByRole("button", { name: "Todos", exact: true }).click();

    // pedido direcionado à Sofia — o Caio pediu ela pelo mentor (o filho
    // direto evita os <li> aninhados da thread de propostas)
    const dirigido = lista.locator("> li", {
      hasText: "Direcionada a você",
    });
    await expect(dirigido).toHaveCount(1);
    await expect(
      dirigido.getByText("Solicitado por Carlos Menezes")
    ).toBeVisible();
    // o pedido aberto da própria Bia traz o selo "pedido do jovem"
    const daBia = lista.locator("> li", { hasText: "pedido do jovem" });
    await expect(daBia).toHaveCount(1);
    await expect(
      daBia.getByText("Solicitado por Bia")
    ).toBeVisible();
  });
});

test.describe("coordenação — painel de trilhas e pedidos parados", () => {
  test("home da coord: trilhas somente-leitura + alerta de triagem parada", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/");

    await expect(
      page.getByText("Trilhas de especialista").first()
    ).toBeVisible();
    // painel somente-leitura recolhido com contador (a home virou fila
    // de trabalho: "Precisa de você hoje") — abre sob gesto
    await page
      .locator("#trilhas-especialista")
      .locator("summary")
      .click();
    await expect(page.getByText("Somente leitura").first()).toBeVisible();

    // alerta operacional — o pedido do Wendel espera triagem há 6 dias
    // (limiar configurado: 5) e tem que aparecer em "Pedidos parados"
    const parados = page.locator('section[aria-label="Pedidos parados"]');
    await expect(parados).toBeVisible();
    await expect(
      parados.getByRole("heading", { name: "Pedidos parados" })
    ).toBeVisible();
    await expect(parados.locator("li").first()).toBeVisible();

    // e o quadro de trilhas em andamento lista as vivas (Bia × Sofia etc.)
    const emAndamento = page.locator(
      'section[aria-label="Trilhas de especialista em andamento"]'
    );
    await expect(emAndamento).toBeVisible();
    await expect(emAndamento.locator("li").first()).toBeVisible();
  });
});

test("nav do jovem tem o item Especialistas", async ({ page }) => {
  await entrarNaDemo(page, "mentorado");
  await page.goto("/jovem");
  await expect(
    page.getByRole("link", { name: /Especialistas/i }).first()
  ).toBeVisible();
});
