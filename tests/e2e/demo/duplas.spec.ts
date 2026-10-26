import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-197 — visão geral de duplas, agora no desenho da rodada
// out/2026: resumo único SaudePrograma ("Situação das duplas" — o mesmo
// da agenda e da home) + chips de filtro com contador (o clique filtra —
// herda o papel que os segmentos da barra tinham), a régua de cálculo no
// popover "Como calculamos" e a linha canônica DuplaLinha (situação +
// apoio, nomes que não truncam, motivo em até 2 linhas, encontros n/total
// com o traço do esperado, nota "Nº enc.", UMA ação contextual + ⋯ +
// Ver ficha). WhatsApp sempre visível: "Lembrar" onde há pendência
// apontável (nudge notificação+wa.me, cap 48h), "Chamar" direto nas demais.
// Read-only — seguro em qualquer deploy, produção inclusa.

// a linha canônica é um div.@container dentro do corpo @4xl:divide-y —
// espelha o ".divide-y > div" do desenho anterior (filhos diretos do
// corpo dividido; a massa saudável do <details> não entra)
const LINHAS_COORD =
  'section[aria-label="Lista de duplas"] [class*="@4xl:divide-y"] > div';
const LINHAS_SUP =
  'section[aria-label="Duplas supervisionadas"] [class*="@4xl:divide-y"] > div';
const RESUMO = 'section[aria-label="Situação das duplas"]';

test.describe("demo — /duplas (REALIZA-197 · v6a)", () => {
  test("coordenação: linhas densas com WA em toda dupla, segmentos e resumo", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/duplas");

    await expect(
      page.getByRole("heading", { name: "Duplas", level: 1 })
    ).toBeVisible();

    // o resumo único: SaudePrograma (mesmos números da agenda e da home).
    // A barra segmentada leva o texto agregado no aria-label; a legenda
    // repete os números como texto. Apoio é pill à parte, nunca fatia.
    const resumo = page.locator(RESUMO);
    await expect(resumo).toBeVisible();
    await expect(
      resumo.getByRole("heading", { name: "Situação das duplas" })
    ).toBeVisible();
    await expect(
      resumo.getByRole("img", {
        name: /\d+ em andamento: \d+ em risco, \d+ em atenção, \d+ em dia\. \d+ pausadas ou concluídas\. \d+ com apoio aberto\./,
      })
    ).toBeVisible();
    const legenda = resumo.getByRole("listitem");
    await expect(legenda).toHaveCount(4);
    await expect(legenda.nth(0)).toContainText("em risco");
    await expect(legenda.nth(1)).toContainText("em atenção");
    await expect(legenda.nth(2)).toContainText("em dia");
    await expect(legenda.nth(3)).toContainText("pausadas ou concluídas");
    await expect(resumo.getByText(/com apoio aberto/)).toBeVisible();
    // a definição da régua não fica na tela — mora no popover "Como
    // calculamos" (convenção: a interface não explica a si mesma)
    await resumo
      .getByRole("button", { name: "Como calculamos" })
      .click();
    await expect(
      page.getByText(/2 ou mais encontros atrasados/)
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // chips de situação com contador — clicar filtra a lista (o gesto que
    // os segmentos da barra faziam antes); "Todas" vem pressionada
    const chips = page.getByRole("group", { name: "Filtrar por situação" });
    await expect(
      chips.getByRole("button", { name: /Todas \d+/ })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      chips.getByRole("button", { name: /Em risco \d+/ })
    ).toBeVisible();
    await expect(
      chips.getByRole("button", { name: /Atenção \d+/ })
    ).toBeVisible();
    await expect(
      chips.getByRole("button", { name: /Em andamento \d+/ })
    ).toBeVisible();
    await expect(
      chips.getByRole("button", { name: /Pausadas \d+/ })
    ).toBeVisible();
    await expect(
      chips.getByRole("button", { name: /Concluídas \d+/ })
    ).toBeVisible();
    await expect(
      chips.getByRole("button", { name: /Apoio \d+/ })
    ).toBeVisible();
    // a posição das turmas vive nos chips de turma, com contador também
    await expect(
      page.getByRole("button", { name: /Turma 1 \d+/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Turma 2 \d+/ })
    ).toBeVisible();

    const linhas = page.locator(LINHAS_COORD);
    const n = await linhas.count();
    expect(n).toBeGreaterThan(3);

    // o chip filtra de verdade: "Em risco N" reduz a lista às duplas em
    // risco do recorte (o dataset tem 1 — a Fernanda × Dandara)
    await chips.getByRole("button", { name: /Em risco \d+/ }).click();
    await expect(page.locator(LINHAS_COORD)).toHaveCount(1);
    await expect(
      page.locator(LINHAS_COORD).first()
    ).toContainText("Dandara");
    await chips.getByRole("button", { name: /Todas \d+/ }).click();
    await expect(linhas).toHaveCount(n);

    // altura de linha: nada de card alto nem linha espremida demais. A
    // régua é a MEDIANA — nomes longos e a 2ª pill "Apoio" quebram pra
    // mais alto e ainda são densos; a banda absoluta pega regressão pra
    // card-alto (o desenho atual mede ~97-133px; 150 pega o salto pra
    // card empilhado sem depender da composição do fixture).
    const alturas: number[] = [];
    for (let i = 0; i < n; i++) {
      const box = await linhas.nth(i).boundingBox();
      if (!box) throw new Error("linha sem bounding box");
      alturas.push(box.height);
    }
    alturas.sort((a, b) => a - b);
    const mediana = alturas[Math.floor(alturas.length / 2)];
    for (const h of alturas) {
      expect(h).toBeGreaterThanOrEqual(44);
      expect(h).toBeLessThanOrEqual(150);
    }
    expect(mediana).toBeLessThanOrEqual(135);

    for (let i = 0; i < n; i++) {
      const linha = linhas.nth(i);
      // WhatsApp sempre visível (decisão travada): o split do desktop é
      // [Lembrar|Chamar] + ▾ "Opções da mensagem" — um por linha. O
      // trigger combinado do mobile também existe no DOM (escondido por
      // md:) e o rótulo dele termina em ": opções da mensagem": só o
      // match EXATO separa o ▾ do quadrado verde.
      await expect(
        linha.getByRole("button", { name: "Opções da mensagem", exact: true })
      ).toHaveCount(1);
      // exatamente um "Ver ficha" por linha — nunca duplicado
      await expect(
        linha.getByRole("link", { name: /Ver ficha/ })
      ).toHaveCount(1);
      // progresso em segmentos, com aria-label "N de M encontros"
      await expect(
        linha.locator('[role="img"][aria-label*="encontros realizados"]')
      ).toHaveCount(1);
    }

    // a primária do split muda com o estado: "Lembrar" nas ativas com
    // pendência, "Chamar" (wa.me direto, sem cap) nas fora da régua — e
    // onde o demo já nudgeou <48h, "Lembrada dd/mm" desabilitado. O
    // dataset cobre os três estados.
    await expect(
      page.locator(LINHAS_COORD).getByText(/^Lembrar/).first()
    ).toBeVisible();
    await expect(
      page.locator(LINHAS_COORD).getByText(/^Chamar/).first()
    ).toBeVisible();
    await expect(
      page.locator(LINHAS_COORD).getByText(/^Lembrada/).first()
    ).toBeVisible();

    // o "Chamar" é contato direto wa.me via /api/nudge — o flag
    // `t=contato` é o que mantém o clique fora do cap de 48h (o cap é
    // dos nudges); sem ele registrar contato bloquearia o Lembrar
    const chamar = page
      .locator(LINHAS_COORD)
      .getByRole("link", { name: /Chamar .+ no WhatsApp/ });
    await expect(chamar.first()).toHaveAttribute("href", /t=contato/);

    // fora da régua nunca vira nudge: pausada e concluída só têm "Chamar"
    // — nem "Lembrar" nem "Lembrada" — e a pill repete o rótulo do status
    // ("Pausada"), nunca um "em dia" que mentisse
    const pausada = page.locator(LINHAS_COORD).filter({ hasText: "Pausada" });
    await expect(pausada).toHaveCount(1);
    await expect(pausada.getByText(/^Lembra/)).toHaveCount(0);
    await expect(
      pausada.getByRole("link", { name: /Chamar .+ no WhatsApp/ })
    ).toHaveCount(1);
    // exact: a pill de situação é exatamente "Pausada" e o motivo diz a
    // jornada congelada — não há "Em dia" escondido na linha
    await expect(
      pausada.getByText("Pausada", { exact: true })
    ).toBeVisible();
    await expect(
      pausada.getByText(/Jornada congelada, sem cobrança/)
    ).toBeVisible();
    await expect(
      pausada.getByText("Em dia", { exact: true })
    ).toHaveCount(0);
    const concluidas = page
      .locator(LINHAS_COORD)
      .filter({ hasText: "Concluída" });
    const nConcluidas = await concluidas.count();
    expect(nConcluidas).toBeGreaterThan(0);
    for (let i = 0; i < nConcluidas; i++) {
      await expect(concluidas.nth(i).getByText(/^Lembra/)).toHaveCount(0);
    }

    // o motivo vai em até 2 linhas com o texto íntegro no title — a
    // linha nunca quebra a altura da tabela (a ficha tem o detalhe).
    // Dupla em dia sem motivo mostra "Sem pendências" e não leva title;
    // quantas linhas em dia caem entre as 6 primeiras depende do dia da
    // semana (seg de madrugada o enc. vigente ainda não venceu).
    for (let i = 0; i < Math.min(n, 6); i++) {
      const linha = linhas.nth(i);
      const comMotivo = linha.locator("p.line-clamp-2[title]");
      if (await linha.getByText("Sem pendências", { exact: true }).count()) {
        await expect(comMotivo).toHaveCount(0);
        continue;
      }
      await expect(comMotivo).toHaveCount(1);
      expect((await comMotivo.getAttribute("title"))?.length).toBeGreaterThan(0);
    }

    // a massa saudável colapsa num <details> quando passa de 5 — aberto,
    // LinhaMini ainda mais baixa e MANTÉM o WhatsApp da dupla (contato em
    // 1 toque mesmo colapsada)
    const massa = page.locator("summary", {
      hasText: "Mostrar as outras",
    });
    if ((await massa.count()) > 0) {
      await massa.first().click();
      const minis = page.locator(
        'section[aria-label="Lista de duplas"] details > div > div'
      );
      const m = await minis.count();
      expect(m).toBeGreaterThan(0);
      for (let i = 0; i < m; i++) {
        const box = await minis.nth(i).boundingBox();
        if (!box) throw new Error("mini-linha sem bounding box");
        expect(box.height).toBeLessThanOrEqual(52);
        await expect(
          minis.nth(i).getByRole("link", { name: /Ver ficha/ })
        ).toHaveCount(1);
        await expect(
          minis
            .nth(i)
            .getByRole("button", { name: "Opções da mensagem", exact: true })
        ).toHaveCount(1);
      }
    }

    // "Ver texto da mensagem" abre o dialog com o corpo que sai nas três
    // saídas (wa.me, cópia, notificação) — a linha inteira compartilha o
    // mesmo texto
    await linhas
      .first()
      .getByRole("button", { name: "Opções da mensagem", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Ver texto da mensagem" })
      .click();
    const dlg = page.getByRole("dialog");
    await expect(
      dlg.getByRole("heading", { name: "Texto da mensagem" })
    ).toBeVisible();
    const corpo = dlg.locator("p.whitespace-pre-wrap");
    await expect(corpo).toBeVisible();
    expect((await corpo.textContent())?.trim().length).toBeGreaterThan(0);
    await page.keyboard.press("Escape");
  });

  test("coordenação mobile: cards p-3/gap-2, ações no topo, toques ≥44px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/duplas");

    const cards = page.locator(LINHAS_COORD);
    const n = await cards.count();
    expect(n).toBeGreaterThan(3);

    // o div interno da linha é quem recebe o padding e a gap (o root é
    // só o @container)
    const primeiro = cards.first().locator(":scope > div");
    await expect(primeiro).toHaveCSS("padding-left", "12px");
    await expect(primeiro).toHaveCSS("row-gap", "8px");

    // nada de overflow horizontal a 390px
    const scrollW = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    expect(scrollW).toBeLessThanOrEqual(390);

    for (let i = 0; i < n; i++) {
      const card = cards.nth(i);
      // exatamente um "Ver ficha" por card — nunca duplicado topo+rodapé
      await expect(
        card.getByRole("link", { name: /Ver ficha/ })
      ).toHaveCount(1);

      // as ações moram na célula order-2 (topo à direita, ao lado das
      // pílulas): quadrado verde combinado (ação + opções num trigger só)
      // 44px + ficha 44px
      const celulaAcoes = card.locator(":scope > div > div.order-2");
      const wa = celulaAcoes.getByRole("button", {
        name: /: opções da mensagem$/,
      });
      await expect(wa).toHaveCount(1);
      const waBox = await wa.boundingBox();
      expect(waBox?.width).toBeGreaterThanOrEqual(44);
      expect(waBox?.height).toBeGreaterThanOrEqual(44);
      const ficha = celulaAcoes.getByRole("link", { name: /Ver ficha/ });
      await expect(ficha).toHaveCount(1);
      const fichaBox = await ficha.boundingBox();
      expect(fichaBox?.height).toBeGreaterThanOrEqual(44);

      // a faixa-footer morta não volta: fora da célula de ações não há
      // link de ficha solto no card
      await expect(
        card
          .locator(":scope > div > div:not(.order-2)")
          .getByRole("link", { name: /Ver ficha/ })
      ).toHaveCount(0);
    }

    // o quadrado verde abre o menu com a ação como 1º item — "Abrir
    // wa.me", "Copiar mensagem" e "Ver texto" são o contrato do menu
    const wa = cards
      .first()
      .locator(":scope > div > div.order-2")
      .getByRole("button", { name: /: opções da mensagem$/ });
    await wa.click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    // o 1º card é o do Caio (apoio do mentorado — "Chamar", não Lembrar):
    // a ação mora dentro do menu do quadrado
    await expect(
      menu.getByRole("menuitem", { name: /^Chamar Caio/ })
    ).toBeVisible();
    await expect(
      menu.getByRole("menuitem", { name: /Abrir wa\.me/ })
    ).toBeVisible();
    await expect(
      menu.getByRole("menuitem", { name: "Copiar mensagem" })
    ).toBeVisible();
    await expect(
      menu.getByRole("menuitem", { name: "Ver texto da mensagem" })
    ).toBeVisible();
  });

  test("supervisor: mesmo padrão denso, WA no escopo e ⋮ de supervisão", async ({
    page,
  }) => {
    await entrarNaDemo(page, "supervisor");
    await page.goto("/duplas");

    await expect(
      page.getByRole("heading", { name: "Duplas que você supervisiona" })
    ).toBeVisible();
    await expect(page.getByText(/agrupadas por turma/)).toBeVisible();

    // o mesmo SaudePrograma da coordenação — informativo (o auxiliar não
    // tem chips de filtro; a régua segue no "Como calculamos")
    const resumo = page.locator(RESUMO);
    await expect(resumo).toBeVisible();
    await expect(
      resumo.getByRole("img", { name: /\d+ em andamento:/ })
    ).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Filtrar por situação" })
    ).toHaveCount(0);

    // sub-headers de turma sobrevivem ao template de linha — trazem o
    // próximo encontro oficial da turma ("encontro 5 terça-feira…")
    const subs = page.locator(
      'section[aria-label="Duplas supervisionadas"] div.bg-muted'
    );
    expect(await subs.count()).toBeGreaterThan(0);
    expect(
      await subs.filter({ hasText: /encontro \d+/ }).count()
    ).toBeGreaterThan(0);

    const linhas = page.locator(LINHAS_SUP);
    const n = await linhas.count();
    expect(n).toBeGreaterThan(1);
    for (let i = 0; i < n; i++) {
      const linha = linhas.nth(i);
      const box = await linha.boundingBox();
      if (!box) throw new Error("linha sem bounding box");
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeLessThanOrEqual(150);
      // WhatsApp por linha supervisionada + um único "Ver ficha" (o ▾
      // pede exact: o trigger combinado do mobile tem o mesmo sufixo)
      await expect(
        linha.getByRole("button", { name: "Opções da mensagem", exact: true })
      ).toHaveCount(1);
      await expect(
        linha.getByRole("link", { name: /Ver ficha/ })
      ).toHaveCount(1);
    }

    // o Lembrar chega às supervisionadas com pendência (a RPC autoriza o
    // supervisor da dupla) — o Matheus tem registro pendente + limbo na T2
    await expect(
      page
        .locator(LINHAS_SUP)
        .getByText(/^Lembrar/)
        .first()
    ).toBeVisible();
    // a supervisionada em dia recebe o "Chamar" direto
    await expect(
      page
        .locator(LINHAS_SUP)
        .getByText(/^Chamar/)
        .first()
    ).toBeVisible();

    // pedido de apoio do JOVEM: a linha do Caio troca a ponta inteira —
    // "Chamar" o mentorado (pode ser sobre o próprio mentor), nunca um
    // "Lembrar" cobrando o mentor. O $ ancora na primária — o trigger do
    // menu mobile carrega ": opções da mensagem" no mesmo rótulo
    const linhaCaio = page.locator(LINHAS_SUP).filter({ hasText: "Caio" });
    await expect(
      linhaCaio.getByRole("button", {
        name: /^Chamar Caio: notificação \+ WhatsApp$/,
      })
    ).toBeVisible();

    // concluída supervisionada: sem "Lembrar" (fora da régua) e o mentor
    // fora do escopo de contato (a view só expõe ativa/pausada) — a linha
    // da Helena cai no estado "sem WhatsApp cadastrado"
    const linhaHelena = page
      .locator(LINHAS_SUP)
      .filter({ hasText: "Helena" });
    await expect(linhaHelena.getByText(/^Lembra/)).toHaveCount(0);
    await expect(
      linhaHelena.locator('[title="Sem WhatsApp cadastrado"]')
    ).toHaveCount(1);
    // o ▾ explica o motivo no item desabilitado
    await linhaHelena
      .getByRole("button", { name: "Opções da mensagem", exact: true })
      .click();
    await expect(
      page
        .getByRole("menuitem", { name: /sem WhatsApp cadastrado/ })
        .first()
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // a supervisão recolhe no ⋮ "Mais ações da dupla de <nome>" — abre e
    // aponta o dialog de supervisão no alvo certo
    const maisAcoes = page
      .locator(LINHAS_SUP)
      .getByRole("button", { name: /Mais ações da dupla/ })
      .first();
    await expect(maisAcoes).toBeVisible();
    await maisAcoes.click();
    const menu = page.getByRole("menu");
    await expect(
      menu.getByRole("menuitem", { name: "Registrar supervisão" })
    ).toBeVisible();
    await menu
      .getByRole("menuitem", { name: "Registrar supervisão" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Registrar supervisão" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("coordenação: ?recorte= pousa com a fatia ativa — chip + lista", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");

    const chips = page.getByRole("group", { name: "Filtrar por situação" });
    const linhas = page.locator(LINHAS_COORD);
    // o número do chip é a promessa da régua — a contagem de linhas é
    // conferida contra ele, não contra um número chumbado do fixture
    const nDoChip = async (nome: RegExp) => {
      const txt =
        (await chips.getByRole("button", { name: nome }).textContent()) ?? "";
      return Number(txt.match(/(\d+)/)?.[1] ?? -1);
    };

    // ?recorte=risco — a dupla em risco do fixture é a única linha
    await page.goto("/duplas?recorte=risco");
    await expect(
      chips.getByRole("button", { name: /Em risco \d+/ })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(linhas).toHaveCount(await nDoChip(/Em risco \d+/));
    await expect(linhas.first()).toContainText("Dandara");

    // ?recorte=atencao — outra fatia, mesmo contrato
    await page.goto("/duplas?recorte=atencao");
    await expect(
      chips.getByRole("button", { name: /Atenção \d+/ })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(linhas).toHaveCount(await nDoChip(/Atenção \d+/));

    // ?recorte=apoio — sobreposição: toda linha do recorte traz a pill
    // "Apoio pedido" (a dupla segue na situação dela e está no apoio).
    // a pill carrega a origem do pedido no sr-only ("Apoio pedido, <origem>"),
    // então o match é substring, nunca exact
    await page.goto("/duplas?recorte=apoio");
    await expect(
      chips.getByRole("button", { name: /Apoio \d+/ })
    ).toHaveAttribute("aria-pressed", "true");
    const nApoio = await nDoChip(/Apoio \d+/);
    await expect(linhas).toHaveCount(nApoio);
    for (let i = 0; i < nApoio; i++)
      await expect(linhas.nth(i).getByText("Apoio pedido")).toBeVisible();

    // recorte desconhecido não vira chip fantasma — cai em "Todas"
    await page.goto("/duplas?recorte=bogus");
    await expect(
      chips.getByRole("button", { name: /Todas \d+/ })
    ).toHaveAttribute("aria-pressed", "true");

    // na própria /duplas a fatia do resumo é botão, não link — ativa o
    // chip equivalente sem recarregar a página
    await page
      .locator(RESUMO)
      .getByRole("button", { name: /em risco/ })
      .click();
    await expect(
      chips.getByRole("button", { name: /Em risco \d+/ })
    ).toHaveAttribute("aria-pressed", "true");
    // a troca de recorte remonta as linhas com a entrada escalonada —
    // re-key no container e o animate-enter re-roda (convenção de filtro).
    // LINHAS_* mira o wrapper @container; a classe mora no filho da linha
    await expect(
      linhas.first().locator(":scope > .animate-enter")
    ).toHaveCount(1);
  });

  test("supervisor: ?recorte= abre a linha de chips só enquanto há recorte", async ({
    page,
  }) => {
    await entrarNaDemo(page, "supervisor");

    // o default segue sem linha de filtro (desenho enxuto do auxiliar)
    await page.goto("/duplas");
    await expect(
      page.getByRole("group", { name: "Filtrar por situação" })
    ).toHaveCount(0);

    // com ?recorte= a fatia chega ativa e os chips aparecem pra devolver
    // o controle — o apoio supervisionado do fixture é o do Caio (1)
    await page.goto("/duplas?recorte=apoio");
    const chips = page.getByRole("group", { name: "Filtrar por situação" });
    await expect(chips).toBeVisible();
    await expect(
      chips.getByRole("button", { name: /Apoio \d+/ })
    ).toHaveAttribute("aria-pressed", "true");
    const linhas = page.locator(LINHAS_SUP);
    await expect(linhas).toHaveCount(1);
    await expect(linhas.first()).toContainText("Caio");

    // "Todas" desfaz o recorte — a linha de chips volta a sumir
    await chips.getByRole("button", { name: /Todas \d+/ }).click();
    await expect(
      page.getByRole("group", { name: "Filtrar por situação" })
    ).toHaveCount(0);
    expect(await linhas.count()).toBeGreaterThan(1);
  });

  test("mentor: ação única no header, registrar no 'Próximo passo', sem footer", async ({
    page,
  }) => {
    // Ricardo é híbrido — a seção "Minhas duplas" é a régua DPP dele
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/duplas");

    await expect(
      page.getByRole("heading", { name: "Minhas duplas" })
    ).toBeVisible();

    const cards = page
      .locator("article")
      .filter({ has: page.getByRole("link", { name: "Abrir ficha" }) });
    const n = await cards.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const card = cards.nth(i);
      // "Abrir ficha" único e sempre no header — a faixa-footer morreu
      // de vez na v6a (nem quando há par de ações)
      await expect(
        card.locator("header").getByRole("link", { name: "Abrir ficha" })
      ).toHaveCount(1);
      await expect(card.getByRole("link", { name: "Abrir ficha" })).toHaveCount(
        1
      );
      await expect(card.locator("div.border-dashed")).toHaveCount(0);

      // havendo pendência de registro, o botão "Registrar encontro N"
      // mora DENTRO do bloco "Próximo passo" (a ação do passo descrito)
      const proximoPasso = card.locator("div.bg-muted", {
        hasText: "Próximo passo",
      });
      if (
        (await proximoPasso.getByText(/Registrar o \d+º encontro/).count()) > 0
      ) {
        await expect(
          proximoPasso.getByRole("link", { name: /Registrar encontro \d+/ })
        ).toHaveCount(1);
      }
    }
  });

  test("especialista: 'Abrir trilha' no header, sem footer no card", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_especialista");
    await page.goto("/duplas");

    await expect(
      page.getByRole("heading", { name: "Minhas trilhas" })
    ).toBeVisible();

    const cards = page
      .locator("article")
      .filter({ has: page.getByRole("link", { name: "Abrir trilha" }) });
    const n = await cards.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const card = cards.nth(i);
      await expect(
        card.locator("header").getByRole("link", { name: "Abrir trilha" })
      ).toHaveCount(1);
      await expect(card.locator("div.border-dashed")).toHaveCount(0);
    }
  });
});
