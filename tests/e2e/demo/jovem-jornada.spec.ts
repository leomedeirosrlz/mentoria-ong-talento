import { entrarNaDemo, expect, test } from "../helpers";

// WP7 (REALIZA-140) — "Minha jornada" em /jovem/materiais, espelhada no
// modo demo (specs demo não escrevem em backend nenhum). REALIZA-194
// (v5c→v6a): a trilha é a estante "Meus instrumentos" — um card-produto
// por instrumento da régua (capa desenhada, uma linha de estado, UM gesto
// por card) + a devolutiva de terceiros; trancados seguem visíveis com a
// data de liberação em texto, sem cadeado. A avaliação de encontro não é
// card: pendente vira banner no topo da seção, em dia vira o acesso
// quieto ao histórico ("Suas avaliações"). Snippets de resposta saíram
// dos cards por desenho: a resposta mora no "Rever resposta".
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

    // a estante — os 4 instrumentos de entrega única da janela como
    // cards-produto, todos com a tag "Feito · <data>" na linha de estado
    const trilha = page.locator(
      'section[aria-labelledby="meus-instrumentos-titulo"]'
    );
    for (const titulo of [
      "Roda da Vida · leitura inicial",
      "Construindo a sua Visão",
      "Definindo minhas metas",
      "PDM · Plano de Desenvolvimento",
    ]) {
      await expect(
        trilha.getByRole("heading", { name: titulo })
      ).toBeVisible();
    }
    await expect(trilha.getByText(/^Feito · /)).toHaveCount(4);

    // snippets de resposta saíram da estante por desenho: o texto
    // da visão NÃO aparece no card — a resposta vive no "Rever resposta"
    await expect(trilha.getByText("Você escreveu")).toHaveCount(0);
    await expect(
      trilha.getByText(/Em até 3 anos, serei uma profissional formada/)
    ).toHaveCount(0);
    // a recorrente saiu da estante (v6a): sem pendência ela não é card
    // nem banner — vira o acesso quieto ao histórico na linha do título,
    // e cada registro abre o dialog de leitura de sempre
    await expect(
      trilha.getByRole("heading", { name: "Avaliação do encontro" })
    ).toHaveCount(0);
    await trilha
      .getByRole("button", { name: /Suas avaliações/ })
      .click();
    const hist = page.getByRole("dialog");
    await expect(
      hist.getByRole("heading", { name: "Suas avaliações dos encontros" })
    ).toBeVisible();
    await expect(
      hist.getByRole("button", { name: "Ver resposta", exact: true })
    ).toHaveCount(4);
    await page.keyboard.press("Escape");

    // a bandeira terminal fecha a estante com a data do enc. 16 da turma
    await expect(trilha.getByText("Celebração da jornada")).toBeVisible();
    await expect(trilha.getByText(/Encontro 16 · /)).toBeVisible();
  });

  test("rever resposta abre a leitura da resposta enviada", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/materiais");

    // qualquer instrumento feito com resposta+campos é o gatilho — na
    // estante o card feito inteiro é o gesto único (render prop com
    // role=button), sem recibo fechado nem botão separado
    const trilha = page.locator(
      'section[aria-labelledby="meus-instrumentos-titulo"]'
    );
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

    // v6a — os dois instrumentos futuros da Ana são cards trancados na
    // própria estante: nome + sub + a liberação em texto, sem cadeado
    // nem tag "fechado" — a data é a resposta
    const trilha = page.locator(
      'section[aria-labelledby="meus-instrumentos-titulo"]'
    );
    for (const titulo of [
      "Roda da Vida · aplicação formal",
      "Avaliação final",
    ]) {
      const card = trilha.locator("article", { hasText: titulo });
      await expect(card).toBeVisible();
      await expect(card.getByText(/libera no encontro/)).toBeVisible();
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
    // os Guias dos mentores não aparecem — os links prontos viram grid e o
    // doc "Feedback Construtivo" abre nativo no grupo "Conteúdos" (o
    // checklist de autoavaliação saiu do catálogo — REALIZA-236)
    await expect(acervo.getByText("Links")).toBeVisible();
    await expect(acervo.getByText("Conteúdos")).toBeVisible();
    await expect(acervo.getByText("Modelos")).toHaveCount(0);
    const docJovem = acervo.getByRole("link", {
      name: /Feedback Construtivo/,
    });
    await expect(docJovem).toHaveAttribute(
      "href",
      "/jovem/materiais/documento/feedback-construtivo"
    );
    // a rota nativa do jovem renderiza o documento de verdade e volta pro
    // acervo — não pode vazar pra /materiais (layout app redireciona o papel)
    await docJovem.click();
    await expect(page).toHaveURL(
      "/jovem/materiais/documento/feedback-construtivo"
    );
    await expect(
      page.getByRole("heading", {
        name: "Feedback Construtivo",
        level: 1,
      })
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Acervo de materiais" })
      .click();
    await expect(page).toHaveURL(/\/jovem\/materiais#acervo/);
    await expect(acervo.getByText("Guias")).toHaveCount(0);
    // catálogo todo acionável: sem linha apagada nem badge "em breve"
    await expect(acervo.getByText("A caminho")).toHaveCount(0);
    await expect(acervo.getByText("em breve")).toHaveCount(0);

    // REALIZA-236/237: a "Autoavaliação do mentor" saiu do programa — sem
    // material de encontro futuro na audiência do mentorado, o recap "Mais
    // adiante na jornada" não renderiza (a régua segue coberta em
    // tests/ciclo-jornada.test.ts)
    await expect(acervo.getByText(/Autoavaliação do mentor/)).toHaveCount(0);
    await expect(
      acervo.getByText("Mais adiante na jornada")
    ).toHaveCount(0);
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

    // "em breve" nunca entra na vitrine — e o catálogo atual não tem
    // material sem destino: nada apagado nem no grupo "A caminho"
    await expect(
      acervo.locator("div.grid").getByText("em breve")
    ).toHaveCount(0);
    await expect(acervo.getByText("A caminho")).toHaveCount(0);
    await expect(acervo.getByText("em breve")).toHaveCount(0);
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

test.describe("demo — instrumentos da jornada (staff)", () => {
  test("coordenação: 2 abas, 3 estados por instrumento, atrasados e Lembrar o jovem", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/materiais");

    // REALIZA-209: só Instrumentos e Biblioteca — a coord abre em
    // Instrumentos; a antiga aba Jornada (matriz, 6 estados) saiu
    const abas = page.getByRole("tablist", { name: "Seções de materiais" });
    await expect(abas.getByRole("tab")).toHaveCount(2);
    await expect(
      abas.getByRole("tab", { name: "Instrumentos" })
    ).toHaveAttribute("aria-selected", "true");
    await expect(abas.getByRole("tab", { name: "Biblioteca" })).toBeVisible();
    await expect(page.getByText("Progresso da jornada")).toHaveCount(0);

    const inst = page.locator('section[aria-labelledby="instrumentos-titulo"]');
    // cada instrumento liberado resume a coorte em 3 estados
    const roda = inst.locator("article", { hasText: "Roda da Vida · leitura inicial" });
    await expect(roda.getByText(/responderam/)).toBeVisible();
    await expect(roda.getByText(/aguardando/)).toBeVisible();
    // a recorrente lê avaliações sobre encontros realizados
    await expect(
      inst.locator("article", { hasText: "Avaliação do encontro" }).getByText(/de \d+ avaliados/)
    ).toBeVisible();

    // a fila de atrasados: o lembrete vai direto pro jovem (o link já está
    // na jornada dele), e a ficha guarda o detalhe
    const fila = page.locator('section[aria-labelledby="atrasados-titulo"]');
    await expect(fila.getByRole("heading", { name: /Atrasados no prazo do guia/ })).toBeVisible();
    await expect(
      fila.getByRole("link", { name: "Ver ficha" }).first()
    ).toHaveAttribute("href", /^\/duplas\/.+#instrumentos$/);
    const lembrar = fila.getByRole("button", { name: /^Lembrar / });
    await expect(
      lembrar
        .or(fila.getByRole("button", { name: /Lembrada / }))
        .or(fila.getByText("dupla pausada"))
        .first()
    ).toBeVisible();
    // o lembrete não é mais pro mentor: nenhum "Lembrar <mentor>"
    await expect(fila.getByRole("button", { name: /Lembrar (Carlos|João|Ricardo)/ })).toHaveCount(0);
    if (await lembrar.first().isVisible().catch(() => false)) {
      // o botão abre o preview — o lembrete sai do "Lembrar pelo app"
      await lembrar.first().click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Lembrar pelo app" })
        .click();
      await expect(
        page.getByText("Modo demo: nada é enviado de verdade.")
      ).toBeVisible();
    }

    // a régua oficial separada da biblioteca (v5c), agora na própria aba:
    // os instrumentos do programa em cards — nunca material solto de
    // acervo
    await page.goto("/materiais?aba=instrumentos");
    const instrumentos = page.locator(
      'section[aria-labelledby="instrumentos-titulo"]'
    );
    await expect(instrumentos).toBeVisible();
    for (const titulo of [
      "Roda da Vida · leitura inicial",
      "Avaliação Geral - 360º · mentorado(a)",
      "Avaliação Geral - 360º · mentor(a)",
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
    // ...e lê as respostas na página do instrumento — REALIZA-331: o
    // card inteiro abre /materiais/instrumentos/<chave> com as duplas do
    // escopo e a resposta por linha (o /formularios/<id> fica pros forms
    // de bordo)
    const abrir = instrumentos
      .getByRole("link", { name: /^Abrir / })
      .first();
    await expect(abrir).toBeVisible();
    await expect(abrir).toHaveAttribute(
      "href",
      /^\/materiais\/instrumentos\//
    );
    await abrir.click();
    await expect(page).toHaveURL(/\/materiais\/instrumentos\/[^/]+/);
    // seletor no topo troca de instrumento sem sair da leitura + uma
    // linha por dupla do escopo (o mentor lê as próprias aqui também)
    await expect(
      page.getByRole("navigation", { name: "Trocar de instrumento" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ficha" }).first()
    ).toBeVisible();
    await page.goBack();

    // REALIZA-257: a janela do guia é indicador pra coordenação, não trava —
    // o card do 360º (enc. 16) está fora da janela na demo e mesmo assim
    // abre as respostas; o indicador diz quando a janela abre, sem cadeado
    const cardForaDaJanela = instrumentos.locator("article", {
      hasText: "Avaliação Geral - 360º · mentorado(a)",
    });
    await expect(
      cardForaDaJanela.getByText("janela não aberta")
    ).toBeVisible();
    await expect(
      cardForaDaJanela.getByText(/abre no encontro 16/)
    ).toBeVisible();
    // o cadeado é do papel que a janela segura — não da coord
    await expect(cardForaDaJanela.getByText("ainda não abriu")).toHaveCount(0);
    await expect(
      cardForaDaJanela.getByRole("link", { name: /^Abrir / })
    ).toHaveAttribute("href", /^\/materiais\/instrumentos\//);
    // e nada de cópia de lote que minta ("já receberam ou já responderam")
    await expect(
      cardForaDaJanela.getByText(/Nada a enviar agora/)
    ).toHaveCount(0);

    // rodapé coord-only: os forms de bordo apontam pra /formularios
    await expect(
      instrumentos.getByRole("link", { name: "Formulários" })
    ).toBeVisible();

    // a biblioteca mora na aba própria — REALIZA-210: lista única com
    // busca, depois 250 agrupada por categoria; "sem conteúdo" é o rótulo
    // staff do "em breve" e hoje não aparece: o catálogo é todo acionável
    // (arquivo, link externo ou documento nativo doc:)
    await page.goto("/materiais?aba=biblioteca");
    const bib = page.locator('section[aria-labelledby="biblioteca-titulo"]');
    await expect(bib.getByRole("heading", { name: /Todos os materiais/ })).toBeVisible();
    await expect(bib.getByText("sem conteúdo")).toHaveCount(0);
    await expect(page.locator("details")).toHaveCount(0);
    await bib.getByRole("searchbox", { name: "Buscar material de apoio" }).fill("guia do mentor");
    await expect(bib.getByText("Guia do Mentor DPP")).toBeVisible();
    await expect(bib.getByText("Plataforma de mentoria")).toHaveCount(0);
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

    // o supervisor também abre em Instrumentos, com a fila de atrasados
    // das duplas dele e o Lembrar direto pro jovem
    const fila = page.locator('section[aria-labelledby="atrasados-titulo"]');
    await expect(
      fila
        .getByRole("button", { name: /^Lembrar / })
        .or(fila.getByRole("button", { name: /Lembrada / }))
        .or(fila.getByText("dupla pausada"))
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
    // card fora da janela: a janela é o estado dele (cadeado + data) e ele
    // segue sem ação — a trava de janela vale pro supervisor, só a
    // coordenação consulta/emite fora dela (REALIZA-257). O único link é
    // o de navegação pra página do instrumento (leitura pura por lá).
    const trancado = instrumentos.locator("article", {
      hasText: "Avaliação Geral - 360º · mentorado(a)",
    });
    await expect(trancado.getByText("ainda não abriu")).toBeVisible();
    await expect(trancado.getByText(/libera no encontro 16/)).toBeVisible();
    const linksTrancado = trancado.getByRole("link");
    await expect(linksTrancado).toHaveCount(1);
    await expect(linksTrancado.first()).toHaveAttribute(
      "href",
      /^\/materiais\/instrumentos\//
    );
    await expect(trancado.getByRole("button")).toHaveCount(0);
    // o rodapé "Intakes… → Formulários" é coord-only
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
      page.locator('section[aria-labelledby="atrasados-titulo"]')
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
