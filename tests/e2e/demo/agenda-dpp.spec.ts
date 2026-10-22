import { entrarNaDemo, expect, test } from "../helpers";

// WP3 (REALIZA-134/135) — a agenda do mentor DPP em três modos via ?aba=:
// Minha agenda (cronológica, o default), Por mentorado (um card por jovem com
// a trilha de especialista em modo "acompanha, não participa" — registro,
// sessões e ★ completos, sem link de entrar) e Calendário (o AgendaCalendario
// de sempre, intacto).
//
// Dataset: o Ricardo (mentor_dpp — híbrido, então a page também renderiza o
// nav "Visão da agenda") tem DUAS duplas DPP:
//   · Ana Beatriz · T1 (d-ok) — com duas trilhas de especialista: Sofia ×
//     matemática ativa (sessão 4 agendada pro próximo sábado 10:00 — dentro
//     da janela de sábado da grade, WP4) e Helena ×
//     oratória concluída; a sessão futura entra na Minha agenda como item
//     guest "você não participa" — sem link de chamada (a projeção da
//     trilha_do_jovem nem carrega `link`)
//   · Matheus Gonçalves · T2 (d-t2c) — registro do encontro 2 pendente
//     (warnrow deep-linkável), encontro 3 em limbo e o pedido de especialista
//     aberto no mural (stepper Pedido → Mural → Aceite → Trilha)
//   · Gustavo Batista · 2025/2026 (d-rito) — a concluída do Ricardo com o
//     rito de encerramento aberto: o card sinaliza a peça que falta (a
//     autoavaliação dele) e aponta pra ficha (REALIZA-172)
// Público, sem writes: vale em qualquer deploy, produção inclusive.

// a dupla D.t2c (0x060d) — id estável do dataset demo
const DUPLA_T2C = "de000000-0000-4000-8000-000000001549";
// uid(0x060e) — a concluída do Ricardo com o rito de encerramento aberto
const DUPLA_RITO = "de000000-0000-4000-8000-000000001550";

test.describe("agenda demo do mentor DPP — Minha agenda / Por mentorado / Calendário (WP3)", () => {
  test("Minha agenda é o default: tablist, chips de escopo e os dois jovens", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/agenda");

    // a tablist dos modos do mentor (page.tsx: role=tablist, aria-label
    // "Modos da agenda") — "Minha agenda" é a aba selecionada do default
    const abas = page.getByRole("tablist", { name: "Modos da agenda" });
    await expect(abas).toBeVisible();
    await expect(
      abas.getByRole("tab", { name: "Minha agenda" })
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      abas.getByRole("tab", { name: "Por mentorado" })
    ).toBeVisible();
    await expect(
      abas.getByRole("tab", { name: "Calendário" })
    ).toBeVisible();

    // o grupo de escopo (mockup v6: role=group aria-label="Escopo da agenda")
    // — um chip por mentorado + Eu + Tudo. O rótulo carrega a turma cheia
    // ("T1 · 2026/2027"), mais honesto que o "T1" solto do mock
    const escopo = page.getByRole("group", { name: "Escopo da agenda" });
    await expect(escopo).toBeVisible();
    for (const chip of [
      "Bia · T1 · 2026/2027",
      "Matheus · T2 · 2026/2027",
      // a concluída também tem chip — o escopo da agenda cobre a jornada
      // inteira do mentor, não só o que corre
      "Gustavo · 2025/2026",
      "Eu",
      "Tudo",
    ])
      await expect(escopo.getByText(chip, { exact: true })).toBeVisible();
  });

  test("sessão de especialista da Ana entra como guest — sem link de entrar", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/agenda");

    // a sessão 4 da trilha Sofia × Ana (agendada pro próximo sábado) aparece
    // nos Próximos como item guest — o DPP acompanha, não participa: a
    // sinalização "acompanha, não participa" (ou a tag "só acompanhamento" do
    // mockup) vem no lugar do botão de chamada — a projeção sequer carrega
    // `link`, então o item não pode ter link nem botão de entrar
    const guest = page
      .locator("article, li")
      .filter({ hasText: /não participa|só acompanhamento/i })
      .filter({ hasText: /Sofia|especialista/i })
      .first();
    await expect(guest).toBeVisible();
    await expect(
      guest.getByRole("link", { name: /entrar|meet|chamada/i })
    ).toHaveCount(0);
    await expect(
      guest.getByRole("button", { name: /entrar|meet|chamada/i })
    ).toHaveCount(0);
  });

  test("warnrow 'Registro do encontro' é deep-linkável pra ficha da dupla", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/agenda");

    // o 2º encontro da dupla do Matheus aconteceu sem registro — a pendência
    // vira warnrow na Minha agenda e o CTA abre a ficha da dupla no âncora
    // do registro do encontro (#registrar-<id>, mesmo formato das linhas
    // retroativas do calendário)
    await expect(
      page.getByText(/Registro do encontro 2 · Matheus/)
    ).toBeVisible();
    const link = page
      .locator(`a[href*="${DUPLA_T2C}"][href*="#registrar-"]`)
      .first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute(
      "href",
      new RegExp(`^/duplas/${DUPLA_T2C}#registrar-`)
    );
  });

  test("Por mentorado: card da Ana com as trilhas e card do Matheus com o pedido no mural", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/agenda?aba=por-mentorado");

    // um card por jovem — o header usa nome_social || nome ("Bia"/"Matheus")
    // + o badge da turma
    await expect(page.getByText("Bia").first()).toBeVisible();
    await expect(page.getByText(/Matheus Gonçalves/).first()).toBeVisible();

    // Ana: a trilha ativa da Sofia acompanhada de dentro do card — modo
    // "acompanha, não participa", com sessões marcadas "registro entregue"
    // e a ★ que a jovem deu (projeção completa da trilha_do_jovem)
    const trilhaSofia = page.locator(
      'section[aria-label="Trilha de especialista — Sofia Nogueira"]'
    );
    await expect(trilhaSofia).toBeVisible();
    await expect(
      trilhaSofia.getByText(/acompanha, não participa/i)
    ).toBeVisible();
    await expect(
      trilhaSofia.getByText(/registro entregue/i).first()
    ).toBeVisible();
    await expect(
      trilhaSofia.locator('[aria-label*="estrela"]').first()
    ).toBeVisible();
    // e a trilha concluída da Helena fica no histórico do card
    const historico = page.locator("details", {
      has: page.getByText(/Trilhas anteriores/),
    });
    await expect(historico.getByText(/Trilhas anteriores/)).toBeVisible();
    await historico.locator("summary").click();
    await expect(historico.getByText(/Helena Prado/)).toBeVisible();

    // Matheus: sem trilha ainda — o card mostra o stepper do pedido de
    // especialista no mural (Pedido → Mural → Aceite → Trilha), sem aceite.
    // O scoping pelo article é necessário: a Bia também tem uma solicitação
    // em voo (a sugestão pendente do dataset) e a section aparece nos 2 cards
    const cardMatheus = page
      .locator("article")
      .filter({ hasText: /Matheus Gonçalves/ });
    const pedido = cardMatheus.locator(
      'section[aria-label="Pedido de especialista em andamento"]'
    );
    await expect(pedido).toBeVisible();
    for (const passo of ["Pedido", "Mural", "Aceite", "Trilha"])
      await expect(pedido.getByText(passo, { exact: true })).toBeVisible();
    await expect(
      pedido.getByText(/no mural há \d+ dias?/i)
    ).toBeVisible();
    await expect(
      pedido.getByText(/nenhum especialista aceitou/i)
    ).toBeVisible();

    // a pendência da dupla do Matheus — registro do encontro 2 em aberto,
    // com o CTA apontando direto pro âncora do registro na ficha
    const pendenciaRegistro = page
      .locator('section[aria-label="Pendências da dupla"]')
      .filter({ hasText: /Registro do encontro 2/ });
    await expect(pendenciaRegistro).toBeVisible();
    const link = pendenciaRegistro
      .locator(`a[href*="${DUPLA_T2C}"][href*="#registrar-"]`)
      .first();
    await expect(link).toHaveAttribute(
      "href",
      new RegExp(`^/duplas/${DUPLA_T2C}#registrar-`)
    );

    // d-rito (Gustavo) — a concluída do Ricardo com o rito de encerramento
    // aberto (REALIZA-172): a pendência sinaliza a peça que falta — a
    // autoavaliação dele — e o CTA abre a ficha, onde o checklist vive
    const cardGustavo = page
      .locator("article")
      .filter({ hasText: "Gustavo Batista" });
    // o badge "concluída" do header (exact: "Jornada concluída" também
    // carrega a palavra) + o rótulo do status — a mesma string é o título
    // do bloco de próximo encontro (a dupla rende a legenda duas vezes),
    // então o locator usa .first() como nas outras linhas do card
    await expect(
      cardGustavo.getByText("concluída", { exact: true })
    ).toBeVisible();
    await expect(cardGustavo.getByText("Jornada concluída").first()).toBeVisible();
    const pendRito = cardGustavo.locator(
      'section[aria-label="Pendências da dupla"]'
    );
    await expect(
      pendRito.getByText("Rito de encerramento pendente")
    ).toBeVisible();
    await expect(
      pendRito.getByText(/falta sua autoavaliação/)
    ).toBeVisible();
    await expect(
      pendRito.getByRole("link", { name: "Abrir ficha" })
    ).toHaveAttribute("href", `/duplas/${DUPLA_RITO}`);
    // jornada fechada: sem Lembrar o jovem e sem "sugerir especialista" —
    // o card não convida ação que a conclusão já tornou sem sentido
    await expect(
      cardGustavo.getByRole("button", { name: /^Lembrar/ })
    ).toHaveCount(0);
    await expect(
      cardGustavo.getByRole("button", { name: /Sugerir especialista/ })
    ).toHaveCount(0);
  });

  test("Calendário renderiza o AgendaCalendario de sempre", async ({ page }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/agenda?aba=calendario");

    // a aba marca a escolha e a superfície é a conhecida: chips de visão +
    // a grade de dias
    const abas = page.getByRole("tablist", { name: "Modos da agenda" });
    await expect(
      abas.getByRole("tab", { name: "Calendário" })
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.locator('input[name="agenda-visao"][value="mes"]')
    ).toBeAttached();
    await expect(page.locator('div[role="grid"]').first()).toBeVisible();
  });
});
