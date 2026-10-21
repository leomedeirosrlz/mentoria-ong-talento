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
    // o checklist/autoavaliação sem destino fecham no grupo apagado
    // "A caminho" com o estado legítimo "em breve" no badge (REALIZA-162)
    await expect(acervo.getByText("Links")).toBeVisible();
    await expect(acervo.getByText("A caminho")).toBeVisible();
    await expect(acervo.getByText("Guias")).toHaveCount(0);
    await expect(acervo.getByText("em breve").first()).toBeVisible();
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
    // conteúdo" (rótulo staff; pro jovem o mesmo estado diz "em breve")
    await expect(page.getByRole("heading", { name: "Guias" })).toBeVisible();
    await expect(page.getByText("sem conteúdo").first()).toBeVisible();
  });
});
