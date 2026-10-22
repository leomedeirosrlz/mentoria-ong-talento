import { entrarNaDemo, expect, test } from "../helpers";

// WP7 (REALIZA-140) — "Minha jornada" em /jovem/materiais, espelhada no
// modo demo (specs demo não escrevem em backend nenhum).
//
// A fixture da persona mentorado (Ana × Ricardo, dupla d-ok na T1) tem a
// jornada da janela aberta INTEIRA feita: roda inicial, visão, metas e PDM
// respondidos e a avaliação de encontro em dia (4 dos 4 realizados). O que
// sobra são as duas estações futuras — roda formal (abre no enc. 12) e
// 360º (enc. 16) — recolhidas no <details> "Daqui pra frente".
//
// O recorte "estação a_fazer com token → CTA Continuar → /f/<token> +
// pill Em andamento (rascunho localStorage)" NÃO existe nessa fixture — a
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
    await expect(page.getByText(/T1 · 2026\/2027/)).toBeVisible();
    await expect(page.getByText(/Fase · /)).toBeVisible();
    await expect(
      page.getByRole("img", { name: "5 de 7 entregas feitas" })
    ).toBeVisible();
    // próxima parada = primeira estação trancada (nenhuma a_fazer na
    // fixture): a aplicação formal da roda, que abre no enc. 12
    await expect(
      page.getByText(
        /Próxima parada: Roda da Vida · aplicação formal — libera no enc\. 12/
      )
    ).toBeVisible();

    // trilha — as 5 estações visíveis, todas feitas
    const trilha = page.locator('section[aria-label="Sua jornada"]');
    for (const titulo of [
      "Roda da Vida · leitura inicial",
      "Construindo a sua Visão",
      "Definindo minhas metas",
      "PDM · Plano de Desenvolvimento",
      "Avaliação do encontro",
    ]) {
      await expect(
        trilha.getByRole("heading", { name: titulo })
      ).toBeVisible();
    }
    await expect(trilha.getByText(/Estação 1/)).toBeVisible();
    await expect(trilha.getByText("Feito", { exact: true })).toHaveCount(5);
    await expect(trilha.getByText(/Respondido em /).first()).toBeVisible();

    // as feitas são recibos fechados por padrão na trilha compacta
    // (REALIZA-162): o conteúdo só aparece ao expandir
    await expect(trilha.getByText("Você escreveu")).toBeHidden();
    await expect(
      trilha.getByRole("button", { name: "Rever última avaliação" })
    ).toBeHidden();
    for (const summary of await trilha.locator("article summary").all()) {
      await summary.click();
    }

    // o "Você escreveu…" da visão — a declaração real da resposta demo
    await expect(trilha.getByText("Você escreveu")).toBeVisible();
    await expect(
      trilha.getByText(/Em até 3 anos, serei uma profissional formada/)
    ).toBeVisible();
    // a recorrente nunca "fecha": em dia conta X de Y, com rever última
    await expect(trilha.getByText("em dia · 4 de 4")).toBeVisible();
    await expect(
      trilha.getByRole("button", { name: "Rever última avaliação" })
    ).toBeVisible();

    // a bandeira terminal fecha a trilha com a data do enc. 16 da turma
    await expect(trilha.getByText("Celebração da jornada")).toBeVisible();
    await expect(trilha.getByText(/Encontro 16 · /)).toBeVisible();
  });

  test("rever resposta abre a leitura da resposta enviada", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/materiais");

    // qualquer estação feita com resposta+campos ganha o botão — a primeira
    // da trilha é a leitura inicial da roda. No layout compacto o botão
    // mora dentro do recibo fechado: abre a linha primeiro (REALIZA-162)
    const trilha = page.locator('section[aria-label="Sua jornada"]');
    await trilha.locator("article summary").first().click();
    await trilha
      .getByRole("button", { name: "Rever resposta" })
      .first()
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

  test("estações trancadas ficam recolhidas, sem CTA", async ({ page }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/materiais");

    // <details> "Daqui pra frente" — as duas estações futuras da Ana
    const det = page.locator("details", { hasText: "Daqui pra frente" });
    await expect(
      det.getByText(/Daqui pra frente · 2 estações/)
    ).toBeVisible();
    // o summary já dá nome + janela de cada uma, sem abrir
    await expect(
      det.getByText(/Cada uma abre sozinha no encontro certo\./)
    ).toBeVisible();

    await det.locator("summary").click();
    await expect(det.getByText("Estação 6")).toBeVisible();
    await expect(
      det.getByText("Roda da Vida · aplicação formal").first()
    ).toBeVisible();
    await expect(det.getByText("Estação 7")).toBeVisible();
    await expect(det.getByText("Avaliação 360º").first()).toBeVisible();
    await expect(det.getByText(/libera no enc\. \d+/)).toHaveCount(2);

    // trancada nunca tem CTA — nem link /f/, nem botão dentro do details
    await expect(det.locator('a[href^="/f/"]')).toHaveCount(0);
    await expect(det.getByRole("link", { name: /Continuar/ })).toHaveCount(
      0
    );
    await expect(det.getByRole("button")).toHaveCount(0);
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

  // REALIZA-162 — a ordem física da página (hero → ação → trilha → acervo)
  // e a trilha como histórico+futuro: a estação aberta NÃO se repete nela
  // (decisão registrada em page.tsx). Com a janela da Ana toda feita o
  // "A fazer agora" some de verdade — a prova do bloco com estação aberta
  // fica no spec app (a fixture com link pendente é de lá).
  test("ordem da página e trilha sem repetição", async ({ page }) => {
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

    // "A fazer agora" é condicional: sem estação aberta a seção não
    // renderiza — nem heading vazio, nem placeholder
    await expect(
      page.getByRole("heading", { name: "A fazer agora" })
    ).toHaveCount(0);

    // a trilha (o <ol> com recibos feitos + trancadas + a bandeira) nunca
    // carrega estação aberta: sem pill "A fazer" e sem link de formulário
    const listaTrilha = jornada.locator("ol");
    await expect(listaTrilha).toHaveCount(1);
    await expect(
      listaTrilha.getByText("A fazer", { exact: true })
    ).toHaveCount(0);
    await expect(listaTrilha.locator('a[href^="/f/"]')).toHaveCount(0);
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
    const grade = grupoLinks.locator("div.grid");
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
  test("coordenação vê KPIs, stackbars, fora-da-janela e Lembrar demo", async ({
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
    // o disclaimer honesto do recorte (sem respostas e sem links aqui)
    await expect(painel.getByText(/Você vê:/)).toBeVisible();

    // KPIs — o 4º rótulo ("fora da janela do guia") repete no heading da
    // lista de ação e na legenda; a prova do KPI fica pelos três únicos +
    // o heading da lista, que também é assertado abaixo
    for (const label of [
      "duplas no painel",
      "estações respondidas",
      "pendências na janela",
    ]) {
      await expect(painel.getByText(label)).toBeVisible();
    }

    // barras empilhadas por instrumento — rótulo acessível com as contagens
    await expect(
      painel.getByRole("heading", { name: "Por instrumento" })
    ).toBeVisible();
    await expect(
      painel.getByText("Roda da Vida · leitura inicial").first()
    ).toBeVisible();
    await expect(
      painel.locator('[role="img"][aria-label*="feitos"]').first()
    ).toBeVisible();
    await expect(
      painel.getByText(/avaliações de encontro respondidas — recorrente/)
    ).toBeVisible();

    // a lista de ação — a fixture demo tem duplas com instrumento fora da
    // janela do guia de propósito (Dandara, Eduardo, a pausada do Pedro)
    await expect(
      painel.getByRole("heading", { name: "Fora da janela do guia" })
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

    // agrupamento por turma com o encontro vigente do calendário oficial
    await expect(
      painel.getByText(/· encontro \d+ do calendário/).first()
    ).toBeVisible();
    // células das estações na linha da dupla — rótulo curto por estação
    for (const celula of [
      "Roda inicial",
      "Visão",
      "Metas",
      "PDM",
      "Roda formal",
      "360º",
    ]) {
      await expect(
        painel.getByText(celula, { exact: true }).first()
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
        page.getByText("Modo demo — nada é enviado de verdade.")
      ).toBeVisible();
    }

    // a biblioteca continua abaixo do painel — grupos + badge "sem
    // conteúdo" (rótulo staff; pro jovem o mesmo estado diz "em breve").
    // Com o hub por encontro (REALIZA-173) parte desses badges mora em
    // <details> fechados — o primeiro match no DOM pode estar oculto; o
    // filtro garante um visível (os transversais seguem abertos)
    await expect(page.getByRole("heading", { name: "Guias" })).toBeVisible();
    await expect(
      page.getByText("sem conteúdo").filter({ visible: true }).first()
    ).toBeVisible();
  });
});
