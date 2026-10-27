import { entrarNaDemo, expect, test } from "../helpers";

// WP5 → REALIZA-161 → REALIZA-176 → REALIZA-195 (v8b) — a agenda da
// coordenação no modo "Monitoramento": faixa de síntese no topo (a leitura
// de 2s), 1º "Semana do programa" (os oficiais do seg–dom em cards de
// scroll lateral — tema, instrumentos e "o que cobre" atrás de <details>),
// 2º "Números da semana" (cobertura honesta por turma — denominador
// literal com "sem data" visível — "Situação das duplas" (o SaudePrograma
// de /duplas: apoio em pill à parte, regras no popover "Como calculamos")
// e o pulso de registro com a ★ do jovem; o recorte T1/T2/Todas é estado
// próprio da seção), e por último o "Painel da semana" — a fila "Para
// acompanhar" na linha canônica DuplaLinha (pill de situação + pill de
// apoio + motivo em texto — o vermelho mora no risco, não num badge —,
// chips com contador que filtram de verdade, agrupamento Urgentes × Demais
// e o Lembrar universal com o cap D5 de 48h). A coordenação NÃO agenda por
// ninguém: a única ação sobre dupla aqui é o nudge.
//
// Dataset demo (src/lib/demo/data.ts):
//   · vigentes da semana: enc. 5 da T1 e enc. 1 da T2 — as duas turmas rolam
//     a mesma terça, a T2 começou agora (o desencontro é o caso que a tela
//     foi desenhada pra explicar)
//   · d-risco (Fernanda Alves e Dandara Souza): pedido de apoio → pill
//     "Apoio pedido" (danger, origem no title) + lead de atraso no motivo
//     ("N encontros atrasados" — 2 na maior parte da semana, 3 na terça
//     antes das 19h quando o enc. 5 entra na conta); nudge da Marina há
//     ~20h → cap D5 ativo: meta "aguardando a dupla" + botão BLOQUEADO
//     "Lembrada dd/mm"
//   · d-pend (Carlos Menezes e Caio Henrique Oliveira): sem row do enc. 5
//     + registro do 4 pendente → motivo "Encontro 5 ... ainda sem data"
//     (até seg) / "1 encontro atrasado" (de terça em diante o vigente já
//     vencido conta) + "Registro do Nº encontro pendente"; "Chamar" livre
//     (o pedido de apoio é do jovem → o nudge vai pro mentorado)
//   · d-atraso (João Pedro Vital e Eduardo Lima): 1 atraso + enc. 5 em
//     limbo; d-t2c (Ricardo Tavares e Matheus Gonçalves): limbo + registro
//     do 2 pendente → "Lembrar registro" livre
//   · d-esp3 (Sofia Nogueira e Eduardo Lima): trilha de especialista com
//     registro do 1º passo pendente — entra na fila como "Lembrar
//     registro"; depois das 19h30 o 2º passo cai em limbo e o rótulo vira
//     "Lembrar" (a regex cobre os dois)
//   · d-rito (Ricardo Tavares e Gustavo Batista): a concluída com o rito
//     de encerramento aberto — pendência da coordenação, CTA "Concluir
//     rito" linkando a ficha (REALIZA-172)
// Público, sem writes: o LembreteButton do modo demo responde o toast
// "Modo demo: nada é enviado de verdade." — a superfície vale em qualquer
// deploy, produção inclusive.

// uid(0x0602) — dupla do Caio, id estável do dataset demo
const DUPLA_PEND = "de000000-0000-4000-8000-000000001538";
// uid(0x060e) — a concluída do Ricardo com o rito de encerramento aberto
const DUPLA_RITO = "de000000-0000-4000-8000-000000001550";

const TZ = "America/Sao_Paulo";
/** "YYYY-MM-DD" de hoje em São Paulo — mesma régua do `hoje` da page. */
const hojeSP = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: TZ });

test.describe("agenda demo da coordenação — Monitoramento (WP5)", () => {
  test.use({ timezoneId: "America/Sao_Paulo" });
  test.beforeEach(async ({ page }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/agenda");
  });

  test("monitoramento é a aterrissagem — heading, postura e abas", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Agenda do programa" })
    ).toBeVisible();
    // a etiqueta de postura saiu com o polimento (a UI não se explica em
    // parágrafo) — a leitura do topo virou a semana corrente + a faixa de
    // síntese, e o contrato "a dupla agenda, a coordenação faz nudge" é
    // coberto pelo teste "coordenação não agenda" abaixo
    await expect(
      page.getByText(/Semana \d+ · \d+ a \d+ de \w+ · hoje,/)
    ).toBeVisible();
    await expect(
      page.getByRole("note", { name: "Síntese do monitoramento" })
    ).toBeVisible();

    // as abas são links com role=tab + aria-selected — deep-link por ?aba=
    const abas = page.getByRole("tablist", { name: "Modos da agenda" });
    await expect(abas).toBeVisible();
    const monitoramento = abas.getByRole("tab", { name: "Monitoramento" });
    const calendario = abas.getByRole("tab", { name: "Calendário" });
    await expect(monitoramento).toHaveAttribute("aria-selected", "true");
    await expect(monitoramento).toHaveAttribute("href", "/agenda");
    await expect(calendario).toHaveAttribute("aria-selected", "false");
    await expect(calendario).toHaveAttribute(
      "href",
      "/agenda?aba=calendario"
    );

    // as seções do modo na ordem do v8b (REALIZA-195): orientação do
    // programa ANTES do detalhe operacional — 1º "Semana do programa",
    // 2º "Números da semana", por último o "Painel da semana" que abriga a
    // fila "Duplas para acompanhar" (role=group, a resposta dos 5s)
    await expect(page.locator("section[aria-label]").first()).toHaveAttribute(
      "aria-label",
      "Semana do programa"
    );
    for (const label of [
      "Semana do programa",
      "Números da semana",
      "Painel da semana",
    ])
      await expect(
        page.locator(`section[aria-label="${label}"]`)
      ).toBeVisible();
    await expect(
      page.locator('[role="group"][aria-label="Duplas para acompanhar"]')
    ).toBeVisible();
  });

  test("números da semana — cobertura honesta por turma, semáforo e recorte", async ({
    page,
  }) => {
    const sec = page.locator('section[aria-label="Números da semana"]');
    await expect(
      sec.getByRole("heading", { name: "Números da semana" })
    ).toBeVisible();

    // os três eixos do mock: cobertura do vigente por turma, situação das
    // duplas (o SaudePrograma de /duplas) e pulso de registro
    await expect(
      sec.getByRole("heading", { name: "Cobertura do encontro da semana" })
    ).toBeVisible();
    await expect(
      sec.getByRole("heading", { name: "Situação das duplas" })
    ).toBeVisible();
    await expect(
      sec.getByRole("heading", { name: "Pulso da semana" })
    ).toBeVisible();

    // (a) cobertura — uma linha por cronograma ativo: pill da turma, link
    // pro dia oficial, "N de M com registro" e a barra honesta (role=img,
    // denominador literal — "sem data" é fatia nomeada, nunca omissão)
    const linhaT1 = sec.locator("li", { hasText: "Turma 1" }).first();
    const linhaT2 = sec.locator("li", { hasText: "Turma 2" }).first();
    await expect(linhaT1).toBeVisible();
    await expect(linhaT2).toBeVisible();

    // o vigente da T1 anda com o dia da semana: seg/ter é o enc. 5 (a âncora
    // do dataset mira a terça que vem); de qua a dom o 5 já saltou pra
    // semana seguinte e o vigente é o 4 — a T2 é estável no enc. 1
    const linkT1 = linhaT1.getByRole("link", { name: /^Encontro [45]$/ });
    await expect(linkT1).toBeVisible();
    await expect(linkT1).toHaveAttribute(
      "href",
      /^\/agenda\?aba=calendario&dia=\d{4}-\d{2}-\d{2}$/
    );
    await expect(
      linhaT2.getByRole("link", { name: "Encontro 1" })
    ).toBeVisible();

    // "N de M com registro" — denominador das ATIVAS da turma. T1: enc. 5
    // futuro (0) ou enc. 4 passado (1: Caio realizou sem registro, Eduardo
    // não-aconteceu, Dandara sem row); T2: o Matheus entregou o do enc. 1.
    // O vigente é lido da própria linha — a semana em que a âncora cai
    // depende de quando o dataset demo foi gerado (rebuild do servidor
    // re-ancora o "hoje"), então prever pelo dia da semana aqui mentia.
    const t1Vigente5 = (await linhaT1.getByRole("link", { name: "Encontro 5" }).count()) > 0;
    await expect(linhaT1).toContainText(
      t1Vigente5 ? "0 de 4 com registro" : "1 de 4 com registro"
    );

    // T2 idem: enc. 1 pode estar futuro (só o registro antecipado do
    // Matheus) ou já realizado (2 com registro, 1 aguardando). O "N de 3"
    // é o mesmo N que a barra segmentada declara — lê o aria-label dela
    // em vez de chumbar o número da semana.
    const barraT2Label =
      (await linhaT2.getByRole("img").getAttribute("aria-label")) ?? "";
    const mT2 = barraT2Label.match(/(\d) com registro.*· total (\d)/);
    await expect(linhaT2).toContainText(
      `${mT2?.[1] ?? "?"} de ${mT2?.[2] ?? "?"} com registro`
    );

    // a barra segmentada lê o MESMO denominador do "N de M" ao lado:
    // seg–ter<19h "3 agendadas, 1 sem data" (Caio sem row); depois das 19h
    // os agendados caem em limbo ("aguardando registro"); qua–dom o
    // vigente é o enc. 4: 1 com registro, 1 aguardando (Caio), 1 não
    // aconteceu (Eduardo), 1 sem data (Dandara)
    const barraT1 = linhaT1.getByRole("img");
    if (t1Vigente5) {
      // os 3 agendados passam a "aguardando registro" um a um, conforme o
      // horário de cada encontro passa — a soma é que é fixa
      await expect(barraT1).toHaveAttribute(
        "aria-label",
        /, 1 sem data · total 4$/
      );
      const rotulo = (await barraT1.getAttribute("aria-label")) ?? "";
      const n = (re: RegExp) => Number(rotulo.match(re)?.[1] ?? 0);
      expect(
        n(/(\d) agendadas?/) + n(/(\d) aguardando registro/),
        rotulo
      ).toBe(3);
    } else {
      await expect(barraT1).toHaveAttribute(
        "aria-label",
        "1 com registro, 1 aguardando registro, 1 não aconteceu, 1 sem data · total 4"
      );
    }
    await expect(linhaT2.getByRole("img")).toHaveAttribute(
      "aria-label",
      /\d com registro, \d (agendadas|aguardando registro)/
    );

    // a intro explicativa do Painel saiu com o polimento — o desencontro
    // das turmas é dito pela própria cobertura (uma linha por turma, cada
    // uma com o vigente dela: os links "Encontro [45]" × "Encontro 1"
    // acima já cobrem o contrato "por turma, nunca misturado")

    // (b) situação das duplas — o apoio é pill à parte (trabalho a fazer,
    // não estado da dupla) e as regras da leitura vivem no popover "Como
    // calculamos", nunca fixas na tela. O link pra fila do apoio mudou de
    // lugar: agora é o "N pedidos de apoio" da síntese (assert do teste da
    // fila), não mais um "Chamados →" dentro do card
    const saude = sec.locator('section[aria-label="Situação das duplas"]');
    await expect(saude.getByText(/com apoio aberto/)).toBeVisible();
    await saude
      .getByRole("button", { name: /Como calculamos/ })
      .click();
    await expect(
      page.getByText(
        /Pedido de apoio do mentor ou do jovem\. Não muda a situação da dupla/
      )
    ).toBeVisible();
    // o popover mora num portal fora da seção — fecha antes de seguir pra
    // não segurar o clique do recorte mais abaixo
    await page.keyboard.press("Escape");

    // cada fatia com chip na /duplas é atalho pra lista já filtrada — o
    // resumo é o "ver todas" por situação e pousa com o recorte nomeado
    await expect(
      saude.getByRole("link", { name: /em risco/ })
    ).toHaveAttribute("href", "/duplas?recorte=risco");
    await expect(
      saude.getByRole("link", { name: /em atenção/ })
    ).toHaveAttribute("href", "/duplas?recorte=atencao");
    await expect(
      saude.getByRole("link", { name: /com apoio aberto/ })
    ).toHaveAttribute("href", "/duplas?recorte=apoio");

    // (c) pulso — "N de M registros entregues" + a média ★ do jovem +
    // lembretes nas últimas 48h (o do Dandara foi há ~20h — é ele que
    // trava o botão dela; a métrica conta enviados na janela, não "presos")
    await expect(sec.getByText(/registros entregues/)).toBeVisible();
    // o contador do pulso — "N aguardando" (a barra de cobertura também
    // tem "aguardando registro" na legenda; o dígito desambigua)
    await expect(sec.getByText(/\d+ aguardando$/)).toBeVisible();
    await expect(
      sec.getByText(/média das avaliações dos jovens/)
    ).toBeVisible();
    await expect(
      sec.getByText(/1 lembrete enviado nas últimas 48h/)
    ).toBeVisible();

    // o recorte T1/T2/Todas é estado próprio da seção — clicar "Turma 2"
    // reduz a cobertura a uma linha sem trocar de página nem de ?visao=
    const recorte = sec.getByRole("group", {
      name: "Recortar os números por turma",
    });
    await expect(
      recorte.getByRole("button", { name: "Todas as turmas" })
    ).toHaveAttribute("aria-pressed", "true");
    const chipT2 = recorte.getByRole("button", { name: "Turma 2" });
    await chipT2.click();
    await expect(chipT2).toHaveAttribute("aria-pressed", "true");
    await expect(linhaT1).toHaveCount(0);
    await expect(linhaT2).toBeVisible();
    await recorte.getByRole("button", { name: "Todas as turmas" }).click();
    await expect(linhaT1).toBeVisible();
  });

  test("para acompanhar — síntese, dimensões por linha, filtros e cap 48h", async ({
    page,
  }) => {
    // a fila mora dentro do "Painel da semana" como role=group nomeado
    // (REALIZA-195): o heading leva a contagem viva "Para acompanhar · N";
    // a frase de escopo saiu da tela pro title do grupo (o polimento tirou
    // os parágrafos explicativos — o domínio segue acessível ali)
    const fila = page.locator(
      '[role="group"][aria-label="Duplas para acompanhar"]'
    );
    await expect(
      fila.getByRole("heading", { name: /^Para acompanhar/ })
    ).toBeVisible();
    await expect(fila).toHaveAttribute(
      "title",
      /Sem agendamento ou atrasadas/
    );

    // a faixa de síntese no topo — leitura de 2s: total casa com as linhas
    // renderizadas e 1 lembrete preso no cap. Sem seleção a fila se divide
    // em "Urgentes" (a dimensão acompanhamento em danger: apoio aberto ou
    // avaliação baixa com dificuldade) × "Demais duplas" — a conta honesta
    // sai do grupo renderizado, porque nem toda urgente carrega a pill de
    // apoio. Número chumbado quebraria seg/ter com o relógio do enc. 4
    const sintese = page.getByRole("note", {
      name: "Síntese do monitoramento",
    });
    await expect(sintese).toBeVisible();
    const nLinhas = await fila.locator("li").count();
    const cabUrgentes = fila.getByRole("heading", {
      name: /^Urgentes \(\d+\)$/,
    });
    await expect(cabUrgentes).toBeVisible();
    const nUrgentes = await cabUrgentes
      .locator("xpath=..")
      .locator("li")
      .count();
    await expect(sintese).toContainText(`${nLinhas} para acompanhar`);
    await expect(sintese).toContainText(
      `${nUrgentes} ${nUrgentes === 1 ? "urgente" : "urgentes"}`
    );
    await expect(sintese).toContainText(/\d+ sem agendamento/);
    // o badge "registro pendente" virou texto do motivo — a linha lê
    // "Registro d@ Nº encontro/sessão pendente" direto (a pendência é o
    // que encabeça o motivo; o limbo diz "...agendado já passou. Falta o
    // registro" e conta no sem agendamento, não aqui — mesmo predicado da
    // síntese)
    const nRegistros = await fila
      .locator("li")
      .filter({
        hasText: /Registro d[oa] \d+[ºª] (encontro|sessão) pendente/,
      })
      .count();
    await expect(sintese).toContainText(
      `${nRegistros} ${nRegistros === 1 ? "registro pendente" : "registros pendentes"}`
    );
    await expect(sintese).toContainText("1 lembrete em 48h");
    // apoio aberto conta TODAS as duplas vivas e aponta pra /chamados —
    // Dandara (pedido do mentor) + Caio (pedido do jovem) no dataset
    const linkApoio = sintese.getByRole("link", {
      name: /pedidos? de apoio/,
    });
    await expect(linkApoio).toBeVisible();
    await expect(linkApoio).toHaveAttribute("href", "/chamados");

    // o segundo grupo fecha a conta com o total de linhas
    await expect(
      fila.getByRole("heading", {
        name: `Demais duplas (${nLinhas - nUrgentes})`,
      })
    ).toBeVisible();

    // d-risco — a linha canônica: a pill "Apoio pedido" é o único danger
    // (a origem mentor sai no title); o atraso vem no motivo, nunca em
    // badge vermelho; o combinado vencido saiu da linha (dimensão
    // operacional não é motivo — mora na ficha)
    const risco = fila.locator("li", { hasText: "Dandara Souza" });
    const apoio = risco.locator('span[title="pedido do mentor"]');
    await expect(apoio).toBeVisible();
    await expect(apoio).toContainText("Apoio pedido");
    // 2 atrasados na maior parte da semana — na terça o vigente já conta:
    // 3 antes das 19h (agendado por vir) e 2 depois (o agendado cai em
    // limbo e cobre o esperado)
    await expect(
      risco.getByText(/[23] encontros atrasados/).first()
    ).toBeVisible();

    // o nudge de ~20h atrás dispara o cap D5: a meta da linha diz
    // "lembrete enviado dd/mm, aguardando a dupla" e, dentro do preview,
    // o Lembrar-app vem "Lembrada dd/mm" desabilitado com a razão no title
    await expect(
      risco.getByText(/lembrete enviado \d{2}\/\d{2}/)
    ).toBeVisible();
    await expect(risco.getByText(/aguardando a dupla/)).toBeVisible();
    await risco
      .getByRole("button", { name: /ver a mensagem antes de enviar/ })
      .click();
    const bloqueada = page
      .getByRole("dialog")
      .getByRole("button", { name: /^Lembrada \d{2}\/\d{2}$/ });
    await expect(bloqueada).toBeVisible();
    await expect(bloqueada).toBeDisabled();
    await expect(bloqueada).toHaveAttribute(
      "title",
      /^1 lembrete a cada 48h por dupla\. Destrava \d{2}\/\d{2}$/
    );
    await page.keyboard.press("Escape");

    // d-pend — entra e sai da fila com o relógio do enc. 4: registro vira
    // pendente só 24h depois do encontro (quarta de dia ela some; quarta à
    // noite em diante volta), e "sem data"/"1 atrasado" só quando o enc. 5
    // é o vigente (seg/ter). Na linha canônica as dimensões viraram motivo
    // em texto — o que era badge segue dito, sem chip por dimensão
    const pend = fila.locator("li", { hasText: "Caio Henrique Oliveira" });
    const dowHoje = new Date(`${hojeSP()}T12:00:00Z`).getUTCDay();
    if ((await pend.count()) > 0) {
      // a pendência encabeça o motivo — a forma é a do estado da row
      // ("Registro do Nº ... pendente" quando realizado; "...agendado já
      // passou. Falta o registro" quando cai em limbo)
      await expect(
        pend.getByText(
          /Registro do \d+º encontro pendente|encontro agendado já passou\. Falta o registro/
        )
      ).toBeVisible();
      // o pedido de apoio do Caio partiu do JOVEM — o domínio diz "chamar
      // o jovem, nunca o mentor": a pill "Apoio pedido" leva a origem no
      // title e o botão vira "Chamar" (destino mentorado, texto que acolhe
      // sem expor o teor)
      await expect(
        pend.locator('span[title="pedido do jovem"]')
      ).toBeVisible();
      await expect(
        pend.getByRole("button", { name: /^Chamar/ })
      ).toBeVisible();
      if (dowHoje === 1) {
        await expect(
          pend.getByText(/Encontro \d+ da Turma 1 ainda sem data/)
        ).toBeVisible();
      }
      if (dowHoje === 2) {
        await expect(
          pend.getByText(/1 encontro atrasado/)
        ).toBeVisible();
        await expect(pend).toContainText(/ainda sem data/);
      }
      // "Ver ficha" aponta pra ficha da dupla — o nome acessível leva o
      // primeiro nome do mentorado; id estável do dataset
      await expect(
        pend.getByRole("link", { name: "Ver ficha da dupla de Caio" })
      ).toHaveAttribute("href", `/duplas/${DUPLA_PEND}`);
    } else {
      // quarta de dia o relógio do enc. 4 ainda não fez o registro vencer —
      // registra pra o skip não morrer silencioso num relatório de run
      test.info().annotations.push({
        type: "dataset",
        description: "Caio · Carlos fora da fila hoje (registro do enc. 4 ainda não venceu)",
      });
    }

    // o Lembrar livre da trilha Sofia × Eduardo (nudge dela não preenche
    // o cap) — linha de trilha lê "sessão", e o rótulo segue o caso
    // dominante ("Lembrar registro" enquanto a pendência é a sessão 1;
    // pode virar "Lembrar" depois das 19h30 quando o passo 2 entra em
    // limbo). O clique no demo só simula: toast, sem wa.me
    const sofia = fila
      .locator("li", { hasText: "Sofia Nogueira" })
      .filter({ hasText: "Eduardo Lima" });
    await expect(
      sofia.getByText(/sessão pendente|sessão agendada já passou/)
    ).toBeVisible();
    // o botão da linha abre o preview — o lembrete sai do "Lembrar pelo
    // app" lá dentro (o WhatsApp é o outro botão do mesmo dialog)
    const lembrarSofia = sofia.getByRole("button", {
      name: /^Lembrar( registro)? .*ver a mensagem/,
    });
    await expect(lembrarSofia).toBeEnabled();
    await lembrarSofia.click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Lembrar pelo app" })
      .click();
    await expect(
      page.getByText("Modo demo: nada é enviado de verdade.")
    ).toBeVisible();

    // as outras duplas da fila com o Lembrar livre — o rótulo segue o caso
    // dominante: "Lembrar registro" quando a única pendência é o registro
    // (t2c e esp3), "Lembrar" quando há limbo/atraso junto (d-atraso)
    for (const nomes of ["João Pedro Vital", "Matheus Gonçalves"])
      await expect(
        fila
          .locator("li", { hasText: nomes })
          .getByRole("button", { name: /^Lembrar( .*)?ver a mensagem/ })
      ).toBeEnabled();

    // d-rito (Ricardo × Gustavo) — a concluída com o rito de encerramento
    // aberto (REALIZA-172): pendência da coordenação, não da dupla — a
    // linha lê pill "Concluída" + legenda "jornada fechada" e o motivo
    // aponta a ficha; o CTA é link, sem Lembrar
    const rito = fila.locator("li", { hasText: "Gustavo Batista" });
    await expect(rito).toBeVisible();
    await expect(
      rito.getByText("Concluída", { exact: true })
    ).toBeVisible();
    await expect(
      rito.getByText("jornada fechada", { exact: true })
    ).toBeVisible();
    await expect(
      rito.getByText("Rito de encerramento pendente. Concluir na ficha")
    ).toBeVisible();
    await expect(
      rito.getByRole("link", { name: "Concluir rito" })
    ).toHaveAttribute("href", `/duplas/${DUPLA_RITO}`);
    await expect(
      rito.getByRole("button", { name: /^Lembrar/ })
    ).toHaveCount(0);

    // chips de filtro — cada um conta o recorte no próprio rótulo
    // ("Todas5"/"Urgentes2": o número é span sem separador); clicar isola
    // as linhas e desliga o agrupamento. A conta casa com a síntese
    // calculada acima (mesma derivação de motivos)
    const chips = fila.getByRole("group", {
      name: "Filtrar a fila de acompanhamento",
    });
    await expect(
      chips.getByRole("button", { name: /^Todas\s?\d+$/ })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      chips.getByRole("button", {
        name: new RegExp(`^Urgentes\\s?${nUrgentes}$`),
      })
    ).toBeVisible();
    const chipRegistro = chips.getByRole("button", {
      name: new RegExp(`^Registro pendente\\s?${nRegistros}$`),
    });
    await expect(chipRegistro).toBeVisible();
    await chipRegistro.click();
    await expect(chipRegistro).toHaveAttribute("aria-pressed", "true");
    // o filtro isola exatamente as linhas com a pendência — a trilha da
    // Sofia e a dupla do Matheus são as estáveis; a do Caio oscila (bloco
    // acima cobre quando existe)
    await expect(fila.locator("li")).toHaveCount(nRegistros);
    await expect(
      fila.locator("li", { hasText: "Matheus Gonçalves" })
    ).toBeVisible();
    await expect(
      fila
        .locator("li", { hasText: "Sofia Nogueira" })
        .filter({ hasText: "Eduardo Lima" })
    ).toBeVisible();
    await expect(
      fila.locator("li", { hasText: "Dandara Souza" })
    ).toHaveCount(0);
    // com filtro ativo a lista não agrupa — os cabeçalhos somem
    await expect(
      fila.getByRole("heading", { name: /^Urgentes \(/ })
    ).toHaveCount(0);
    await chips.getByRole("button", { name: /^Todas\s?\d+$/ }).click();
    await expect(
      fila.getByRole("heading", { name: `Urgentes (${nUrgentes})` })
    ).toBeVisible();
  });

  test("semana do programa — oficiais em cards, supervisão e 'Abrir chamada' só no dia", async ({
    page,
  }) => {
    const sec = page.locator('section[aria-label="Semana do programa"]');

    // os oficiais datados do seg–dom em cards com tag de tipo + pill de
    // turma. A terça-âncora carrega o enc. 5 da T1 E o enc. 1 da T2 (mesma
    // data); quando a semana mostrada já passou dela, a faixa cai pro
    // enc. 4 da T1 e nenhum evento da T2. O ramo é lido do DOM — o "hoje"
    // do dataset depende de quando o servidor demo subiu (rebuild
    // re-ancora), não só do dia da semana do relógio do teste.
    const ancoraNaSemana =
      (await sec.getByRole("link", { name: "Encontro 5 · Turma 1" }).count()) > 0;
    await expect(
      sec.getByRole("link", {
        name: `Encontro ${ancoraNaSemana ? 5 : 4} · Turma 1`,
      })
    ).toBeVisible();
    if (ancoraNaSemana)
      await expect(
        sec.getByRole("link", { name: "Encontro 1 · Turma 2" })
      ).toBeVisible();
    await expect(
      sec.getByRole("link", {
        name: "Roda de casos — formação continuada de mentores",
      })
    ).toBeVisible();
    await expect(
      sec.getByRole("link", {
        name: "Supervisão · Paulo Serra × Ricardo Tavares",
      })
    ).toBeVisible();
    // a pill de turma marca o card do encontro E o da formação da mesma
    // turma — a faixa tem os dois, então a asserção ancora no primeiro
    await expect(
      sec.getByText("Turma 1", { exact: true }).first()
    ).toBeVisible();
    if (ancoraNaSemana)
      await expect(
        sec.getByText("Turma 2", { exact: true }).first()
      ).toBeVisible();

    // os cards carregam o "O que cobre" do guia num popover — a voz da
    // coordenação (o mentor lê "Como conduzir" na dele). O gatilho é alvo
    // de toque de verdade (min-h-11 no mobile) e o texto do guia abre fora
    // do card, que não muda de altura
    const guia = sec.getByRole("button", { name: /O que cobre/ }).first();
    await expect(guia).toBeVisible();
    const card = guia.locator("xpath=ancestor::li[1]");
    const altura = (await card.boundingBox())!.height;
    await guia.click();
    const pop = page.getByRole("dialog", { name: "O que cobre" });
    await expect(pop).toBeVisible();
    await expect(pop.locator("p", { hasText: /[a-zá-ú]{4}/ }).last()).toBeVisible();
    expect((await card.boundingBox())!.height).toBe(altura);
    await page.keyboard.press("Escape");
    await expect(pop).toBeHidden();

    // o encontro oficial carrega o meta da coorte no detalhe — "N duplas,
    // cada uma marca o seu" (a coordenação nunca agenda pela dupla)
    const cardEncontro = sec.locator("li", {
      hasText: `Encontro ${ancoraNaSemana ? 5 : 4} · Turma 1`,
    });
    await expect(
      cardEncontro.getByText(/\d+ duplas?, cada uma marca o seu/)
    ).toBeVisible();

    // "Abrir chamada" só existe quando um evento tipo 'formacao' é HOJE.
    // Na semana corrente o dataset sempre tem três candidatos: a roda de
    // casos (domingo) e, quando a terça-âncora roda pra semana que vem
    // (de quarta em diante), os dois encontros de formação da T2 — a
    // inicial na quinta e a final na sexta da semana corrente. Nos outros
    // dias os cards levam só a tag do tipo (Formação/Encontro/…)
    const dow = new Date(`${hojeSP()}T12:00:00Z`).getUTCDay();
    const chamadaHoje =
      dow === 0 || (!ancoraNaSemana && (dow === 4 || dow === 5));
    const chamada = sec.getByRole("link", { name: "Abrir chamada" });
    if (chamadaHoje) {
      await expect(chamada).toHaveAttribute(
        "href",
        `/agenda?aba=calendario&dia=${hojeSP()}`
      );
    } else {
      await expect(chamada).toHaveCount(0);
      await expect(
        sec.getByText("Formação", { exact: true }).first()
      ).toBeVisible();
    }
  });

  test("coordenação não agenda — nenhum controle de agendamento na vista", async ({
    page,
  }) => {
    // a postura da coordenação: monitora e nudges — não há botão/link de
    // agendar, remarcar ou marcar encontro em lugar nenhum do monitoramento
    for (const role of ["button", "link"] as const)
      await expect(
        page.getByRole(role, {
          name: /agendar encontro|marcar encontro|remarcar/i,
        })
      ).toHaveCount(0);

    // a aba Calendário é a porta pro board oficial — navega e renderiza o
    // acompanhamento por encontro da jornada (a grade de horários é só do
    // mentor — a coord vê Dia/Semana/Mês/Ciclo, coberto no agenda-views.spec)
    await page.getByRole("tab", { name: "Calendário" }).click();
    await page.waitForURL(/aba=calendario/);
    await expect(
      page.getByRole("tablist", { name: "Modos da agenda" })
        .getByRole("tab", { name: "Calendário" })
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("navigation", { name: "Encontros da jornada" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Semana do \d+º encontro/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Agendar encontro na / })
    ).toHaveCount(0);
  });
});
