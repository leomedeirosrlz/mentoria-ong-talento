import { entrarNaDemo, expect, test } from "../helpers";

// WP7 (REALIZA-140) — "Minha jornada" em /jovem/materiais, espelhada no
// modo demo (specs demo não escrevem em backend nenhum). REALIZA-194
// (v5c): a trilha virou a estante "Meus instrumentos" — um card-produto
// por instrumento da régua + a devolutiva de terceiros; trancados ficam
// visíveis dessaturados com a data de liberação (não há mais <details>
// "Daqui pra frente" nem bloco "A fazer agora" — a ação é o próprio
// card). Snippets de resposta saíram dos cards por desenho: a resposta
// mora no "Rever resposta", não na estante.
//
// A fixture da persona mentorado (Ana × Ricardo, dupla d-ok na T1) tem a
// jornada da janela aberta INTEIRA feita: roda inicial, visão, metas e PDM
// respondidos e a avaliação de encontro em dia (4 dos 4 realizados). O que
// sobra são os dois instrumentos futuros — roda formal (abre no enc. 12) e
// 360º (enc. 16) — como cards trancados.
//
// O recorte "a_fazer com token → card inteiro link /f/<token> +
// tag Em andamento (rascunho localStorage)" NÃO existe nessa fixture — a
// jornada da Ana está completa dentro da janela por desenho. A cobertura
// desse estado fica no spec app (jovem.spec.ts), onde o link pendente é
// semeado via service role. Registrado aqui pra não parecer esquecimento.
//
// Segundo bloco: o mesmo WP7 do lado staff — o painel "Progresso da
// jornada" do /materiais da coordenação, no dataset demo variado (dupla
// saudável feita na janela, T2 começando, links pendentes e um expirado
// fora da janela, uma dupla pausada).

test.describe("demo — Minha jornada do mentorado", () => {
  test("hero, trilha e estações feitas da Ana", async ({ page }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/materiais");

    // hero slim — título, posição no ciclo e progresso de entregas
    await expect(
      page.getByRole("heading", { name: "Minha jornada", level: 1 })
    ).toBeVisible();
    await expect(page.getByText(/encontro 5 de 16/)).toBeVisible();
    // a turma entra na forma narrativa ("Turma 1"), nunca o cru "T1 · 2026/2027"
    await expect(page.getByText(/Turma 1 · encontro 5 de 16/)).toBeVisible();
    await expect(page.getByText(/Fase · /)).toBeVisible();
    await expect(
      page.getByRole("img", { name: "5 de 7 entregas feitas" })
    ).toBeVisible();
    // próxima parada = primeira estação trancada (nenhuma a_fazer na
    // fixture): a aplicação formal da roda, que abre no encontro 12
    await expect(
      page.getByText(
        /Próxima parada: Roda da Vida · aplicação formal · libera no encontro 12/
      )
    ).toBeVisible();

    // a estante — os 5 instrumentos da janela como cards-produto, todos
    // com a tag "Feito" + a data; a devolutiva de terceiros mora entre eles
    const trilha = page.locator(
      'section[aria-labelledby="meus-instrumentos-titulo"]'
    );
    for (const titulo of [
      "Roda da Vida · leitura inicial",
      "Construindo a sua Visão",
      "Definindo minhas metas",
      "PDM · Plano de Desenvolvimento",
      "Avaliação do encontro",
      "Avaliação por terceiros",
    ]) {
      await expect(
        trilha.getByRole("heading", { name: titulo })
      ).toBeVisible();
    }
    // o chip da janela do guia mora em cada card — a régua 1–7 segue na
    // ordem do guia, sem numeração "Estação N" (v5c tirou o termo)
    await expect(trilha.getByText("Enc. 1–4").first()).toBeVisible();
    await expect(trilha.getByText("Feito", { exact: true })).toHaveCount(5);
    await expect(trilha.getByText(/Respondido em /).first()).toBeVisible();

    // snippets de resposta saíram da estante por desenho (v5c): o texto
    // da visão NÃO aparece no card — a resposta vive no "Rever resposta"
    await expect(trilha.getByText("Você escreveu")).toHaveCount(0);
    await expect(
      trilha.getByText(/Em até 3 anos, serei uma profissional formada/)
    ).toHaveCount(0);
    // a recorrente nunca "fecha": em dia conta X de Y, com "Ver resposta"
    // (exact — os cards feitos respondem como "Rever resposta — <título>")
    await expect(trilha.getByText("em dia · 4 de 4")).toBeVisible();
    await expect(
      trilha.getByRole("button", { name: "Ver resposta", exact: true })
    ).toBeVisible();

    // a bandeira terminal fecha a estante com a data do enc. 16 da turma
    await expect(trilha.getByText("Celebração da jornada")).toBeVisible();
    await expect(trilha.getByText(/Encontro 16 · /)).toBeVisible();
  });

  test("rever resposta abre a leitura da resposta enviada", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/materiais");

    // qualquer instrumento feito com resposta+campos ganha o botão — na
    // estante v5c ele mora direto no card feito, sem recibo fechado
    const trilha = page.locator(
      'section[aria-labelledby="meus-instrumentos-titulo"]'
    );
    // o card feito inteiro é o gatilho do Rever (v5c — render prop com
    // role=button): clicar no card da roda inicial abre o dialog
    await trilha
      .getByRole("button", { name: /Roda da Vida · leitura inicial/ })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Sua resposta/)).toBeVisible();
    await expect(dialog.getByText(/enviada em /)).toBeVisible();
    // o resultado estruturado da roda mostra os quadrantes/áreas marcados
    await expect(dialog.getByText(/Roda da Vida/).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("instrumentos trancados ficam visíveis, dessaturados e sem CTA", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/materiais");

    // v5c — os dois instrumentos futuros da Ana são cards trancados na
    // própria estante: nome + janela + data de liberação, nunca card mudo
    const trilha = page.locator(
      'section[aria-labelledby="meus-instrumentos-titulo"]'
    );
    for (const titulo of [
      "Roda da Vida · aplicação formal",
      "Avaliação 360º",
    ]) {
      const card = trilha.locator("article", { hasText: titulo });
      await expect(card).toBeVisible();
      await expect(card.getByText("Ainda não liberado")).toBeVisible();
    }
    await expect(trilha.getByText(/libera no encontro \d+/)).toHaveCount(2);

    // trancado nunca tem gesto — nem link /f/, nem botão nesses cards
    await expect(trilha.locator('a[href^="/f/"]')).toHaveCount(0);
    const rodaFormal = trilha.locator("article", {
      hasText: "Roda da Vida · aplicação formal",
    });
    await expect(rodaFormal.getByRole("button")).toHaveCount(0);
    await expect(rodaFormal.getByRole("link")).toHaveCount(0);
  });

  test("sub-nav Jornada → Acervo e o acervo com 'em breve'", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/materiais");

    const nav = page.getByRole("navigation", { name: "Nesta página" });
    await expect(nav.getByRole("link", { name: "Jornada" })).toHaveAttribute(
      "href",
      "#jornada"
    );
    await nav.getByRole("link", { name: "Acervo" }).click();
    await expect(page).toHaveURL(/#acervo$/);

    const acervo = page.locator("section#acervo");
    await expect(
      acervo.getByRole("heading", { name: "Acervo" })
    ).toBeVisible();
    await expect(
      acervo.getByText(/Para ler e consultar quando quiser/)
    ).toBeVisible();
    // o acervo do mentorado é só audiencia='todos' (a policy do 0065):
    // os Guias dos mentores não aparecem — os links prontos viram grid e
    // o checklist sem destino fecha no grupo apagado "A caminho" com o
    // estado legítimo "em breve" no badge (REALIZA-162)
    await expect(acervo.getByText("Links")).toBeVisible();
    await expect(acervo.getByText("A caminho")).toBeVisible();
    await expect(acervo.getByText("Guias")).toHaveCount(0);
    await expect(acervo.getByText("em breve").first()).toBeVisible();

    // acervo progressivo (REALIZA-160): a Ana está no enc. 5 — o material
    // marcado pro enc. 16 sai da vitrine e recolhe no <details> apagado
    const trancados = acervo.locator("details", {
      hasText: "Mais adiante na jornada",
    });
    await expect(trancados).toBeVisible();
    await expect(
      trancados.getByText("Autoavaliação do mentor (enc. 16)")
    ).toBeVisible();
    // recolhido por padrão — o item não é clicável nem aparece na grid
    await expect(
      acervo.getByRole("link", { name: /Autoavaliação do mentor/ })
    ).toHaveCount(0);
    await trancados.locator("summary").click();
    await expect(
      trancados.getByText(/Libera no encontro 16/)
    ).toBeVisible();
  });

  // REALIZA-162/194 — a ordem física da página (hero → sub-nav → estante
  // → acervo). O v5c aposentou o bloco "A fazer agora": o instrumento
  // aberto é um card-link na própria estante, sem seção extra. Com a
  // janela da Ana toda feita não há link /f/ nenhum — a prova do card
  // aberto fica no spec app (a fixture com link pendente é de lá).
  test("ordem da página e estante sem bloco duplicado", async ({ page }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/materiais");

    const nav = page.getByRole("navigation", { name: "Nesta página" });
    const jornada = page.locator("section#jornada");
    const acervo = page.locator("section#acervo");
    const yHero = (
      await page
        .getByRole("heading", { name: "Minha jornada", level: 1 })
        .boundingBox()
    )?.y;
    const yNav = (await nav.boundingBox())?.y;
    const yJornada = (await jornada.boundingBox())?.y;
    const yAcervo = (await acervo.boundingBox())?.y;
    if (
      yHero == null ||
      yNav == null ||
      yJornada == null ||
      yAcervo == null
    ) {
      throw new Error("bloco da página sem bounding box");
    }
    expect(yHero).toBeLessThan(yNav);
    expect(yNav).toBeLessThan(yJornada);
    expect(yJornada).toBeLessThan(yAcervo);

    // "A fazer agora" não existe mais (v5c): o instrumento aberto seria
    // um card-link na estante — sem janela aberta, nenhum link /f/ e
    // nenhuma tag "A fazer" aparece
    await expect(
      page.getByRole("heading", { name: "A fazer agora" })
    ).toHaveCount(0);
    await expect(
      jornada.getByText("A fazer", { exact: true })
    ).toHaveCount(0);
    await expect(jornada.locator('a[href^="/f/"]')).toHaveCount(0);
  });

  test("acervo em grade: 1 coluna no celular, 2 no tablet, 3 no desktop", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/materiais");

    // a grade dos prontos — no dataset demo o grupo visível é "Links"
    // (2 materiais); os demais entram nos mesmos contêineres de grid
    const acervo = page.locator("section#acervo");
    const grupoLinks = acervo.locator("section", {
      has: page.getByRole("heading", { name: "Links", exact: true }),
    });
    // :scope > — a capa do card de link (PreviewLink) também é div.grid;
    // sem o filho direto o locator conta as 2 capas junto da grade
    const grade = grupoLinks.locator(":scope > div.grid");
    await expect(grade).toHaveCount(1);
    const trilhos = () =>
      grade.evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length
      );

    // o jovem usa celular — a coluna única é o estado base, nunca regrediu
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(trilhos).toBe(1);
    // o meio da faixa sm–xl (640–1279px): duas colunas com folga — o
    // ~900px do "não fica apertado" da spec
    await page.setViewportSize({ width: 900, height: 800 });
    await expect.poll(trilhos).toBe(2);
    // ≥1280px: três colunas — a densidade desktop da issue
    await page.setViewportSize({ width: 1366, height: 900 });
    await expect.poll(trilhos).toBe(3);

    // prova de layout honesta: os dois cards dividem a mesma linha no
    // desktop e voltam a empilhar no celular
    const cards = grade.locator(":scope > *");
    await expect(cards).toHaveCount(2);
    const b1 = await cards.nth(0).boundingBox();
    const b2 = await cards.nth(1).boundingBox();
    if (!b1 || !b2) throw new Error("card do acervo sem bounding box");
    expect(b1.x).toBeLessThan(b2.x);
    expect(Math.abs(b1.y - b2.y)).toBeLessThan(4);

    await page.setViewportSize({ width: 390, height: 844 });
    const m1 = await cards.nth(0).boundingBox();
    const m2 = await cards.nth(1).boundingBox();
    if (!m1 || !m2) throw new Error("card do acervo sem bounding box");
    expect(m1.y).toBeLessThan(m2.y);

    // "em breve" nunca entra na vitrine: mora no grupo apagado "A caminho"
    await expect(
      acervo.locator("div.grid").getByText("em breve")
    ).toHaveCount(0);
    await expect(acervo.getByText("A caminho")).toBeVisible();
    await expect(acervo.getByText("em breve").first()).toBeVisible();
  });

  test("prefers-reduced-motion: a entrada não bloqueia a leitura", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/jovem/materiais");

    // o guard global de globals.css zera duração e delay do stagger — os
    // cards pintam direto, sem janela de opacidade zero (o computed vem
    // serializado em segundos: 0.01ms → "1e-05s")
    const { dur, delay } = await page
      .locator(".animate-enter")
      .first()
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return { dur: cs.animationDuration, delay: cs.animationDelay };
      });
    expect(parseFloat(dur)).toBeLessThan(0.05);
    expect(parseFloat(delay)).toBeLessThan(0.05);
    await expect(
      page.getByRole("heading", { name: "Minha jornada", level: 1 })
    ).toBeVisible();
    await expect(
      page.locator("section#acervo").getByRole("heading", { name: "Links" })
    ).toBeVisible();
  });
});

test.describe("demo — painel Progresso da jornada (staff)", () => {
  test("coordenação vê KPIs, stackbars, fora-do-prazo e Lembrar demo", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/materiais");

    const painel = page.locator("section", {
      has: page.getByRole("heading", {
        name: "Progresso da jornada",
        level: 2,
      }),
    });
    await expect(painel).toBeVisible();
    // a página virou abas (Jornada/Instrumentos/Biblioteca) — a caixa de
    // escopo "Você vê / não faz" saiu de propósito (plano 03-C): a
    // estrutura por papel é a própria aba, e a coord abre na Jornada
    const abas = page.getByRole("tablist", { name: "Seções de materiais" });
    await expect(
      abas.getByRole("tab", { name: "Jornada" })
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      abas.getByRole("tab", { name: "Instrumentos" })
    ).toBeVisible();
    await expect(
      abas.getByRole("tab", { name: "Biblioteca" })
    ).toBeVisible();

    // a faixa segmentada (v5c) — um segmento por instrumento com as
    // mini-barras por turma; denominadores honestos, nunca "x de 26"
    // agregado (o KPI quadrado virou esta faixa rolável)
    // a faixa é região focável (scroll por teclado, v5c) — o nome vem do
    // aria-label e os segmentos continuam filhos dela
    await expect(
      painel.getByRole("region", { name: "Cobertura por instrumento" })
    ).toBeVisible();
    await expect(
      painel.getByText("Roda da Vida · leitura inicial").first()
    ).toBeVisible();
    // fração honesta por turma — "feitos/duplas da turma" com a sigla
    await expect(
      painel.getByText(/T1|T2/).first()
    ).toBeVisible();
    await expect(
      painel.getByText(/\d+\/\d+/).first()
    ).toBeVisible();
    await expect(
      painel.locator('[role="img"][aria-label*="feitos"]').first()
    ).toBeVisible();
    // a recorrente conta feitas/realizados por turma, sem "fechar"
    await expect(
      painel
        .locator('[role="img"][aria-label*="avaliações de encontro"]')
        .first()
    ).toBeVisible();

    // a lista de ação — a fixture demo tem duplas com instrumento fora
    // do prazo do guia de propósito (Dandara, Eduardo, a pausada do Pedro)
    await expect(
      painel.getByRole("heading", { name: "Duplas fora do prazo" })
    ).toBeVisible();
    const verFicha = painel.getByRole("link", { name: "Ver ficha" }).first();
    await expect(verFicha).toBeVisible();
    await expect(verFicha).toHaveAttribute("href", /^\/duplas\//);
    // Lembrar só vale pra dupla ativa — a pausada exibe o badge em vez do
    // botão; um lembrete recente vira o botão desabilitado "Lembrada dd/mm".
    // No dataset demo os três estados coexistem — a união com .first() no
    // fim prova "há affordance de lembrete" sem violar o strict mode.
    const lembrarLivre = painel.getByRole("button", { name: /^Lembrar / });
    const lembreteOuPausa = lembrarLivre
      .or(painel.getByRole("button", { name: /Lembrada / }))
      .or(painel.getByText("dupla pausada"))
      .first();
    await expect(lembreteOuPausa).toBeVisible();

    // a matriz por dupla ficou atrás de gesto (v5c) — abre o <details>
    // agrupado por turma antes de conferir células
    await painel.getByText("Ver a matriz por dupla").click();

    // agrupamento por turma com o encontro vigente do calendário oficial
    await expect(
      painel.getByText(/encontro \d+ do calendário/).first()
    ).toBeVisible();
    // células das estações na linha da dupla — cada <span> leva o rótulo
    // curto + um sufixo sr-only com o estado (" · respondido", " · abre no
    // enc. N"), então o texto normalizado da célula não é mais só o nome
    // da estação (o exact:true que lia "Roda inicial" parou de casar). O
    // title é o contrato "<rótulo> · <detalhe>" (CelulaEstacao em
    // painel-jornada.tsx) — o prefixo ancora no label e tolera o estado.
    for (const celula of [
      "Roda inicial",
      "Visão",
      "Metas",
      "PDM",
      "Roda formal",
      "360º",
    ]) {
      await expect(
        painel.getByTitle(new RegExp(`^${celula} ·`)).first()
      ).toBeVisible();
    }

    // o Lembrar do demo toca a action — que responde o modo demo, sem
    // mandar nada de verdade (read-only como todo spec demo)
    if (await lembrarLivre
      .first()
      .isVisible()
      .catch(() => false)) {
      await lembrarLivre.first().click();
      await expect(
        page.getByText("Modo demo: nada é enviado de verdade.")
      ).toBeVisible();
    }

    // a régua oficial separada da biblioteca (v5c), agora na própria aba:
    // os 8 instrumentos do programa em cards — a devolutiva de terceiros
    // entre eles, nunca material solto de acervo
    await page.goto("/materiais?aba=instrumentos");
    const instrumentos = page.locator(
      'section[aria-labelledby="instrumentos-titulo"]'
    );
    await expect(instrumentos).toBeVisible();
    for (const titulo of [
      "Roda da Vida · leitura inicial",
      "Avaliação por terceiros",
      "Avaliação 360º e autoavaliação",
    ]) {
      await expect(
        instrumentos.getByRole("heading", { name: titulo })
      ).toBeVisible();
    }
    // coord tem ação onde há o que emitir — o lote abre o dialog; o 360º
    // (emissão manual de encerramento) nunca é lote
    await expect(
      instrumentos.getByRole("button", { name: /Enviar em lote/ }).first()
    ).toBeVisible();
    // ...e lê as respostas no formulário oficial — o link navega pra
    // /formularios/<id> (coord-only; supervisor nem vê)
    const verRespostas = instrumentos
      .getByRole("link", { name: "Ver respostas" })
      .first();
    await expect(verRespostas).toBeVisible();
    await expect(verRespostas).toHaveAttribute(
      "href",
      /^\/formularios\//
    );
    await verRespostas.click();
    await expect(page).toHaveURL(/\/formularios\/[^/]+/);
    await page.goBack();

    // card trancado é leitura pura pra TODO staff — o pill de liberação
    // não é gesto: zero link, zero botão dentro dele
    const cardTrancado = instrumentos.locator("article", {
      hasText: "Avaliação 360º",
    });
    await expect(cardTrancado.getByText("ainda não abriu")).toBeVisible();
    await expect(cardTrancado.getByRole("link")).toHaveCount(0);
    await expect(cardTrancado.getByRole("button")).toHaveCount(0);

    // rodapé coord-only: os forms de bordo apontam pra /formularios
    await expect(
      instrumentos.getByRole("link", { name: "Formulários" })
    ).toBeVisible();

    // a biblioteca mora na aba própria — grupos + badge "sem conteúdo"
    // (rótulo staff; pro jovem o mesmo estado diz "em breve"). Com o hub
    // por encontro (REALIZA-173) parte desses badges mora em <details>
    // fechados — o primeiro match no DOM pode estar oculto; o filtro
    // garante um visível (os transversais seguem abertos)
    await page.goto("/materiais?aba=biblioteca");
    await expect(page.getByRole("heading", { name: "Guias" })).toBeVisible();
    await expect(
      page.getByText("sem conteúdo").filter({ visible: true }).first()
    ).toBeVisible();
  });

  // REALIZA-194 — fronteira de papel: o supervisor lê a régua escopada
  // (e a data de liberação dos trancados, que é leitura do programa) sem
  // herdar ação nenhuma da coord — Lembrar nas duplas dele segue, que é
  // a ação do auxiliar decidida no plano.
  test("supervisor vê a régua escopada sem emitir nem ler respostas", async ({
    page,
  }) => {
    await entrarNaDemo(page, "supervisor");
    await page.goto("/materiais");

    const painel = page.locator("section", {
      has: page.getByRole("heading", {
        name: "Progresso da jornada",
        level: 2,
      }),
    });
    await expect(painel).toBeVisible();
    // Lembrar fica — supervisor nudge nas duplas que supervisiona
    // (decisão mantida do v5c: é a ação do auxiliar, não da coord)
    await expect(
      painel
        .getByRole("button", { name: /^Lembrar / })
        .or(painel.getByRole("button", { name: /Lembrada / }))
        .or(painel.getByText("dupla pausada"))
        .first()
    ).toBeVisible();

    // a régua oficial mora na aba "Instrumentos" — a leitura escopada é
    // a mesma pra ele (estado e envio por dupla ficam na ficha)
    await page.goto("/materiais?aba=instrumentos");
    const instrumentos = page.locator(
      'section[aria-labelledby="instrumentos-titulo"]'
    );
    await expect(instrumentos).toBeVisible();
    // a data de liberação é leitura de todo staff — o pill trancado
    // aparece pro supervisor igual
    await expect(
      instrumentos.getByText(/libera/).first()
    ).toBeVisible();
    // ...mas emitir e ler respostas são coord-only: nenhum dos dois
    // gestos pode existir na régua dele
    await expect(
      instrumentos.getByRole("button", { name: /Enviar em lote/ })
    ).toHaveCount(0);
    await expect(
      instrumentos.getByRole("link", { name: "Ver respostas" })
    ).toHaveCount(0);
    // card trancado: zero gesto dentro (pill informativo, não link/botão)
    const trancado = instrumentos.locator("article", {
      hasText: "Avaliação 360º",
    });
    await expect(trancado.getByRole("link")).toHaveCount(0);
    await expect(trancado.getByRole("button")).toHaveCount(0);
    // o rodapé "Anamnese… → Formulários" é coord-only
    await expect(
      instrumentos.getByRole("link", { name: "Formulários" })
    ).toHaveCount(0);
  });

  // REALIZA-194 — o mentor lê catálogo + deep link, não espelho da ficha:
  // os cards linkam pra seção de instrumentos da ficha de cada dupla dele.
  // Com as abas (Jornada/Instrumentos/Biblioteca) o "acervo primeiro" do
  // v5c virou a aba PADRÃO dele: sem painel staff, /materiais abre na
  // Biblioteca — o conteúdo útil é o primeiro eixo, o catálogo é a aba
  // ao lado.
  test("mentor vê acervo primeiro, catálogo com links pra ficha depois", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/materiais");

    // o painel staff-only não renderiza pro mentor — a régua dele é o
    // catálogo "Instrumentos do programa" na aba própria
    await expect(
      page.getByRole("heading", { name: "Progresso da jornada" })
    ).toHaveCount(0);

    // a aba padrão do mentor é a Biblioteca — o equivalente em abas do
    // "acervo antes do catálogo" (o Resumo é o primeiro bloco útil)
    const abas = page.getByRole("tablist", { name: "Seções de materiais" });
    await expect(
      abas.getByRole("tab", { name: "Biblioteca" })
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("region", { name: "Resumo da biblioteca" })
    ).toBeVisible();

    // o catálogo mora na aba "Instrumentos"
    await page.goto("/materiais?aba=instrumentos");
    const instrumentos = page.locator(
      'section[aria-labelledby="instrumentos-titulo"]'
    );
    await expect(instrumentos).toBeVisible();

    // cada card linka a ficha específica (âncora #instrumentos) — a
    // fixture do Ricardo tem 2 duplas DPP vivas (Bia e Matheus), então
    // cada card carrega um link por jovem, rotulado pelo nome social
    await expect(
      instrumentos
        .locator('a[href^="/duplas/"][href$="#instrumentos"]')
        .first()
    ).toHaveAttribute("href", /^\/duplas\/.+#instrumentos$/);
    for (const jovem of ["Bia", "Matheus Gonçalves"]) {
      await expect(
        instrumentos
          .locator("article")
          .first()
          .getByRole("link", { name: jovem })
      ).toBeVisible();
    }
    // o rodapé lista a ficha de cada dupla dele
    await expect(
      instrumentos.getByText(/Estado e envio por dupla na ficha:/)
    ).toBeVisible();
    // mentor nunca vê gesto de coord
    await expect(
      instrumentos.getByRole("button", { name: /Enviar em lote/ })
    ).toHaveCount(0);
    await expect(
      instrumentos.getByRole("link", { name: "Ver respostas" })
    ).toHaveCount(0);
  });
});
