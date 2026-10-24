import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-197 — visão geral de duplas no desenho v6a ("linha densa
// evoluída"): linhas de ~1-2 linhas com WhatsApp sempre visível (o
// "Lembrar" de pendência vira nudge notificação+wa.me com cap de 48h; a
// dupla em dia ganha "Chamar" direto), progresso em segmentos 1–N com o
// traço do esperado, resumo agregado do semáforo no topo e cards mobile
// com as ações no TOPO — nunca num rodapé de faixa solta. Read-only —
// seguro em qualquer deploy, produção inclusa.

const LINHAS_COORD = 'section[aria-label="Lista de duplas"] .divide-y > div';
const LINHAS_SUP = 'section[aria-label="Duplas supervisionadas"] .divide-y > div';
const RESUMO = 'section[aria-label="Resumo do semáforo e do cronograma"]';

test.describe("demo — /duplas (REALIZA-197 · v6a)", () => {
  test("coordenação: linhas densas com WA em toda dupla, segmentos e resumo", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/duplas");

    await expect(
      page.getByRole("heading", { name: "Duplas", level: 1 })
    ).toBeVisible();

    // o .sum do v6a: barra proporcional do semáforo + posição das turmas
    // no cronograma — espelha os chips de categoria (clique filtra)
    const resumo = page.locator(RESUMO);
    await expect(resumo).toBeVisible();
    // a barra é interativa (os segmentos filtram a lista): o resumo
    // agregado sai de um role="img" que podava os controles da árvore e
    // vira texto sr-only + botões nomeados — a legenda segue visível
    expect(
      await resumo.locator(".sr-only").first().textContent()
    ).toMatch(/\d+ duplas?: .+em risco/);
    await expect(
      resumo.getByRole("button", {
        name: /\d+ em risco — filtrar a lista/,
      })
    ).toBeVisible();
    await expect(
      resumo.getByRole("button", {
        name: /\d+ em andamento — filtrar a lista/,
      })
    ).toBeVisible();
    await expect(
      resumo.getByText(/encontro \d+ de \d+/).first()
    ).toBeVisible();

    const linhas = page.locator(LINHAS_COORD);
    const n = await linhas.count();
    expect(n).toBeGreaterThan(3);

    // altura de linha: nada de card alto nem linha espremida demais. A
    // régua é a MEDIANA — nomes longos e a 2ª pill "Apoio" quebram pra
    // ~70px e ainda são densos; a banda absoluta pega regressão pra
    // card-alto sem depender da composição do fixture.
    const alturas: number[] = [];
    for (let i = 0; i < n; i++) {
      const box = await linhas.nth(i).boundingBox();
      if (!box) throw new Error("linha sem bounding box");
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeLessThanOrEqual(80);
      alturas.push(box.height);
    }
    alturas.sort((a, b) => a - b);
    const mediana = alturas[Math.floor(alturas.length / 2)];
    expect(mediana).toBeLessThanOrEqual(72);

    for (let i = 0; i < n; i++) {
      const linha = linhas.nth(i);
      // WhatsApp sempre visível (decisão travada): o split do desktop é
      // [Lembrar|Chamar] + ▾ "Opções da mensagem" — um por linha
      await expect(
        linha.getByRole("button", { name: "Opções da mensagem" })
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
    // — nem "Lembrar" nem "Lembrada" — e a linha de sinais repete o
    // rótulo do status ("Dupla pausada"), nunca um "em dia" que mentisse
    const pausada = page.locator(LINHAS_COORD).filter({ hasText: "Pausada" });
    await expect(pausada).toHaveCount(1);
    await expect(pausada.getByText(/^Lembra/)).toHaveCount(0);
    await expect(
      pausada.getByRole("link", { name: /Chamar .+ no WhatsApp/ })
    ).toHaveCount(1);
    // exact: a versão sr-only do title ("Dupla pausada · último…") também
    // casa por substring — o texto visível é exatamente "Dupla pausada"
    await expect(
      pausada.getByText("Dupla pausada", { exact: true })
    ).toBeVisible();
    const concluidas = page
      .locator(LINHAS_COORD)
      .filter({ hasText: "Concluída" });
    const nConcluidas = await concluidas.count();
    expect(nConcluidas).toBeGreaterThan(0);
    for (let i = 0; i < nConcluidas; i++) {
      await expect(concluidas.nth(i).getByText(/^Lembra/)).toHaveCount(0);
    }

    // sinais: 1 linha truncada com o texto completo no title — a linha
    // nunca quebra a altura da tabela (a ficha tem o detalhe)
    for (let i = 0; i < Math.min(n, 6); i++) {
      const sinais = linhas.nth(i).locator("p.truncate[title]");
      await expect(sinais).toHaveCount(1);
      expect((await sinais.getAttribute("title"))?.length).toBeGreaterThan(0);
    }

    // a massa saudável colapsa num <details> — aberto, LinhaMini ainda mais
    // baixa e MANTÉM o WhatsApp da dupla (contato em 1 toque mesmo
    // colapsada)
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
          minis.nth(i).getByRole("button", { name: "Opções da mensagem" })
        ).toHaveCount(1);
      }
    }

    // "Ver texto da mensagem" abre o dialog com o corpo que sai nas três
    // saídas (wa.me, cópia, notificação) — a linha inteira compartilha o
    // mesmo texto
    await linhas
      .first()
      .getByRole("button", { name: "Opções da mensagem" })
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

    const primeiro = cards.first();
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

      // as ações moram na 2ª célula do card (order-2 — topo à direita,
      // ao lado das pílulas): quadrado WhatsApp verde + ficha 44px
      const celulaAcoes = card.locator(":scope > div").nth(1);
      const wa = celulaAcoes.getByRole("button", {
        name: /Lembrar|Chamar/,
      });
      await expect(wa).toHaveCount(1);
      const waBox = await wa.boundingBox();
      expect(waBox?.width).toBeGreaterThanOrEqual(44);
      expect(waBox?.height).toBeGreaterThanOrEqual(44);
      const ficha = celulaAcoes.getByRole("link", { name: /Ver ficha/ });
      const fichaBox = await ficha.boundingBox();
      expect(fichaBox?.height).toBeGreaterThanOrEqual(44);

      // a faixa-footer morta não volta: o último bloco do card é a
      // avaliação do mentor, não uma célula de ações solta
      await expect(
        card.locator(":scope > div").last().getByRole("link", {
          name: /Ver ficha/,
        })
      ).toHaveCount(0);
    }

    // o quadrado verde abre o menu com a ação dele — "Abrir wa.me",
    // "Copiar mensagem" e "Ver texto" são o contrato do ▾
    const wa = cards
      .first()
      .getByRole("button", { name: /Lembrar|Chamar/ });
    await wa.click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
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

    // resumo agregado também na auxiliar — informativo (ela não tem chips)
    await expect(page.locator(RESUMO)).toBeVisible();

    // sub-headers de turma sobrevivem ao template de linha (dentro dos
    // grupos re-keyed da busca)
    const subs = page.locator(
      'section[aria-label="Duplas supervisionadas"] div.bg-muted'
    );
    expect(await subs.count()).toBeGreaterThan(0);

    const linhas = page.locator(LINHAS_SUP);
    const n = await linhas.count();
    expect(n).toBeGreaterThan(1);
    for (let i = 0; i < n; i++) {
      const linha = linhas.nth(i);
      const box = await linha.boundingBox();
      if (!box) throw new Error("linha sem bounding box");
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeLessThanOrEqual(80);
      // WhatsApp por linha supervisionada + um único "Ver ficha"
      await expect(
        linha.getByRole("button", { name: "Opções da mensagem" })
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
    // menu mobile carrega "— opções da mensagem" no mesmo rótulo
    const linhaCaio = page.locator(LINHAS_SUP).filter({ hasText: "Caio" });
    await expect(
      linhaCaio.getByRole("button", {
        name: /^Chamar Caio — notificação \+ WhatsApp$/,
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
      .getByRole("button", { name: "Opções da mensagem" })
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
