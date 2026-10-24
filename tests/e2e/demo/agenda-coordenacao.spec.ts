import { entrarNaDemo, expect, test } from "../helpers";

// WP5 → REALIZA-161 → REALIZA-176 → REALIZA-195 (v8b) — a agenda da
// coordenação no modo "Monitoramento": faixa de síntese no topo (a leitura
// de 2s), 1º "Semana do programa" (os oficiais do seg–dom em cards de
// scroll lateral — tema, instrumentos e "o que cobre" atrás de <details>),
// 2º "Números da semana" (cobertura honesta por turma — denominador
// literal com "sem data" visível — semáforo com o eixo azul do apoio e o
// pulso de registro com a ★ do jovem; o recorte T1/T2/Todas é estado
// próprio da seção), e por último o "Painel da semana" — a fila "Para
// acompanhar" (badges por dimensão — vermelho só no acompanhamento —,
// chips que filtram de verdade, agrupamento críticas × demais e o Lembrar
// universal com o cap D5 de 48h). A coordenação NÃO agenda por ninguém:
// a única ação sobre dupla aqui é o nudge.
//
// Dataset demo (src/lib/demo/data.ts):
//   · vigentes da semana: enc. 5 da T1 e enc. 1 da T2 — as duas turmas rolam
//     a mesma terça, a T2 começou agora (o desencontro é o caso que a tela
//     foi desenhada pra explicar)
//   · d-risco (Dandara · Fernanda): pedido de apoio → badge danger "Apoio
//     pedido" + atraso warn ("N encontros atrasados" — 2 na maior parte da
//     semana, 3 na terça antes das 19h quando o enc. 5 entra na conta) +
//     combinado vencido; nudge da Marina há ~20h → cap D5 ativo: linha
//     esmaecida "aguardando a dupla" + botão BLOQUEADO "Lembrada dd/mm"
//   · d-pend (Caio · Carlos): sem row do enc. 5 + registro do 4 pendente →
//     badges "sem data" (até seg) / "1 encontro atrasado" (de terça em
//     diante o vigente já vencido conta) + "registro pendente"; "Lembrar
//     registro" livre (o nudge dela tem 5 dias)
//   · d-atraso (Eduardo · João): 1 atraso + enc. 5 em limbo; d-t2c (Matheus
//     · Ricardo): limbo + registro do 2 pendente → "Lembrar" livre
//   · d-esp3 (Eduardo · Sofia): trilha de especialista com registro do 1º
//     passo pendente — entra na fila como "Lembrar registro"; depois das
//     19h30 o 2º passo cai em limbo e o rótulo vira "Lembrar" (a regex cobre
//     os dois)
//   · d-rito (Gustavo · Ricardo): a concluída com o rito de encerramento
//     aberto — pendência da coordenação, CTA "Concluir rito" linkando a
//     ficha (REALIZA-172)
// Público, sem writes: o LembreteButton do modo demo responde o toast
// "Modo demo — nada é enviado de verdade." — a superfície vale em qualquer
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
    // a etiqueta da postura — monitora e faz nudge, nunca agenda pela dupla
    await expect(
      page.getByText("Monitoramento — a agenda de cada dupla é da dupla")
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

    // os três eixos do mock: cobertura do vigente por turma, semáforo das
    // duplas (rosca) e pulso de registro
    await expect(
      sec.getByRole("heading", { name: "Cobertura do encontro da semana" })
    ).toBeVisible();
    await expect(
      sec.getByRole("heading", { name: "Semáforo das duplas" })
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
    // não-aconteceu, Dandara sem row); T2: o Matheus entregou o do enc. 1
    const dowHoje = new Date(`${hojeSP()}T12:00:00Z`).getUTCDay();
    const ancoraNaSemana = dowHoje === 1 || dowHoje === 2;
    await expect(linhaT1).toContainText(
      ancoraNaSemana ? "0 de 4 com registro" : "1 de 4 com registro"
    );
    await expect(linhaT2).toContainText("1 de 3 com registro");

    // a barra segmentada lê o MESMO denominador do "N de M" ao lado:
    // seg–ter<19h "3 agendadas, 1 sem data" (Caio sem row); depois das 19h
    // os agendados caem em limbo ("aguardando registro"); qua–dom o
    // vigente é o enc. 4: 1 com registro, 1 aguardando (Caio), 1 não
    // aconteceu (Eduardo), 1 sem data (Dandara)
    const barraT1 = linhaT1.getByRole("img");
    if (ancoraNaSemana) {
      await expect(barraT1).toHaveAttribute(
        "aria-label",
        /3 (agendadas|aguardando registro), 1 sem data — total 4/
      );
    } else {
      await expect(barraT1).toHaveAttribute(
        "aria-label",
        "1 com registro, 1 aguardando registro, 1 não aconteceu, 1 sem data — total 4"
      );
    }
    await expect(linhaT2.getByRole("img")).toHaveAttribute(
      "aria-label",
      /1 com registro, 2 agendadas|1 com registro, 2 aguardando registro/
    );

    // o hint do desencontro vive na intro do Painel da semana — "por
    // turma, nunca misturado" continua sendo o contrato
    const painel = page.locator('section[aria-label="Painel da semana"]');
    await expect(
      painel.getByText(/As turmas não começaram juntas/)
    ).toBeVisible();
    await expect(
      painel.getByText(/Turma 1 está no encontro [45]/)
    ).toBeVisible();
    await expect(
      painel.getByText(/Turma 2 está no encontro 1/)
    ).toBeVisible();

    // (b) semáforo — a rosca inclui o eixo azul do apoio (trabalho a
    // fazer, não estado) e a nota aponta a fila certa (/chamados)
    await expect(sec.getByText(/com apoio aberto/)).toBeVisible();
    await expect(
      sec.getByText(/Apoio aberto é trabalho, não estado da dupla/)
    ).toBeVisible();
    await expect(
      sec.getByRole("link", { name: "Chamados →" })
    ).toHaveAttribute("href", "/chamados");

    // (c) pulso — "N de M registros entregues" + a média ★ do jovem +
    // lembretes nas últimas 48h (o do Dandara foi há ~20h — é ele que
    // trava o botão dela; a métrica conta enviados na janela, não "presos")
    await expect(sec.getByText(/registros entregues/)).toBeVisible();
    // o contador do pulso — "N aguardando" (a barra de cobertura também
    // tem "aguardando registro" na legenda; o dígito desambigua)
    await expect(sec.getByText(/\d+ aguardando$/)).toBeVisible();
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
    // (REALIZA-195): o heading leva a contagem viva "Para acompanhar · N"
    const fila = page.locator(
      '[role="group"][aria-label="Duplas para acompanhar"]'
    );
    await expect(
      fila.getByRole("heading", { name: /^Para acompanhar/ })
    ).toBeVisible();
    await expect(fila.getByText(/Sem agendamento ou atrasadas/)).toBeVisible();

    // a faixa de síntese no topo — leitura de 2s: total casa com as linhas
    // renderizadas e 1 lembrete preso no cap. As críticas saem do DOM —
    // a Dandara é a estável, mas o Caio também traz "Apoio pedido" (o
    // pedido é do JOVEM dele) quando a linha dele entra com o relógio
    // do enc. 4 — número fixo aqui quebraria seg/ter
    const sintese = page.locator('p[aria-label="Síntese do monitoramento"]');
    await expect(sintese).toBeVisible();
    const nLinhas = await fila.locator("li").count();
    const nCriticas =
      (await fila.locator('li span[title^="pedido"]').count()) +
      (await fila
        .getByText("Acompanhamento crítico", { exact: true })
        .count());
    await expect(sintese).toContainText(`${nLinhas} para acompanhar`);
    await expect(sintese).toContainText(
      `${nCriticas} ${nCriticas === 1 ? "crítica" : "críticas"}`
    );
    await expect(sintese).toContainText(`${nLinhas - nCriticas} atenção`);
    await expect(sintese).toContainText(/\d+ sem agendamento/);
    const nRegistros = await fila
      .locator("li")
      .getByText("registro pendente", { exact: true })
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

    // sem seleção a fila se divide: "Precisam de intervenção" (danger no
    // acompanhamento) encabeça, o resto cai em "Demais duplas"
    await expect(
      fila.getByRole("heading", {
        name: `Precisam de intervenção (${nCriticas})`,
      })
    ).toBeVisible();
    await expect(
      fila.getByRole("heading", {
        name: `Demais duplas (${nLinhas - nCriticas})`,
      })
    ).toBeVisible();

    // d-risco — badges por dimensão: "Apoio pedido" é o ÚNICO danger (a
    // origem mentor sai no title); o atraso sai warn, nunca vermelho; o
    // combinado vencido é operacional
    const risco = fila.locator("li", { hasText: "Dandara · Fernanda" });
    const apoio = risco.locator('span[title="pedido do mentor"]');
    await expect(apoio).toBeVisible();
    await expect(apoio).toContainText("Apoio pedido");
    // 2 atrasados na maior parte da semana — na terça o vigente já conta:
    // 3 antes das 19h (agendado por vir) e 2 depois (o agendado cai em
    // limbo e cobre o esperado). O .first() cobre a terça à noite, quando
    // o headline vira exatamente "2 encontros atrasados" sem parentético
    await expect(
      risco.getByText(/^[23] encontros atrasados$/).first()
    ).toBeVisible();
    await expect(
      risco.getByText("encaminhamento vencido", { exact: true })
    ).toBeVisible();

    // o nudge de ~20h atrás dispara o cap D5: a linha esmaece ("aguardando
    // a dupla", com a data de envio) e o botão vem desabilitado
    await expect(risco.locator(".opacity-60")).toBeVisible();
    await expect(
      risco.getByText(/lembrete enviado \d{2}\/\d{2}/)
    ).toBeVisible();
    await expect(risco.getByText(/aguardando a dupla/)).toBeVisible();
    const bloqueada = risco.getByRole("button", {
      name: /^Lembrada \d{2}\/\d{2}$/,
    });
    await expect(bloqueada).toBeVisible();
    await expect(bloqueada).toBeDisabled();
    await expect(bloqueada).toHaveAttribute(
      "title",
      /^1 lembrete a cada 48h por dupla — destrava \d{2}\/\d{2}$/
    );

    // d-pend — entra e sai da fila com o relógio do enc. 4: registro vira
    // pendente só 24h depois do encontro (quarta de dia ela some; quarta à
    // noite em diante volta), e "sem data"/"1 atrasado" só quando o enc. 5
    // é o vigente (seg/ter). Os estáveis com registro_pendente são a trilha
    // da Sofia × Eduardo e o Matheus · Ricardo — a Sofia sempre assina
    // "Lembrar registro" (o motivo está sempre na lista dela)
    const pend = fila.locator("li", { hasText: "Caio · Carlos" });
    const dowHoje = new Date(`${hojeSP()}T12:00:00Z`).getUTCDay();
    if ((await pend.count()) > 0) {
      await expect(
        pend.getByText("registro pendente", { exact: true })
      ).toBeVisible();
      // o pedido de apoio do Caio partiu do JOVEM — o domínio diz "chamar
      // o jovem, nunca o mentor": o badge diz a origem e o botão vira
      // "Chamar" (destino mentorado, texto que acolhe sem expor o teor)
      await expect(
        pend.locator('span[title="pedido do jovem"]')
      ).toBeVisible();
      await expect(
        pend.getByRole("button", { name: /^Chamar/ })
      ).toBeVisible();
      if (dowHoje === 1) {
        await expect(
          pend.getByText("sem data", { exact: true })
        ).toBeVisible();
        await expect(pend).toContainText(/ainda sem data/);
      }
      if (dowHoje === 2) {
        await expect(
          pend.getByText("1 encontro atrasado", { exact: true })
        ).toBeVisible();
        await expect(pend).toContainText(/ainda sem data/);
      }
      // "Ver ficha ›" aponta pra ficha da dupla — id estável do dataset
      await expect(
        pend.getByRole("link", { name: "Ver ficha ›" })
      ).toHaveAttribute("href", `/duplas/${DUPLA_PEND}`);
    } else {
      // quarta de dia o relógio do enc. 4 ainda não fez o registro vencer —
      // registra pra o skip não morrer silencioso num relatório de run
      test.info().annotations.push({
        type: "dataset",
        description: "Caio · Carlos fora da fila hoje (registro do enc. 4 ainda não venceu)",
      });
    }

    // o Lembrar livre da Sofia (nudge dela não preenche o cap) — o clique
    // no demo só simula: toast, sem wa.me
    const sofia = fila.locator("li", { hasText: "Eduardo · Sofia" });
    const lembrarSofia = sofia.getByRole("button", {
      name: "Lembrar registro",
      exact: true,
    });
    await expect(lembrarSofia).toBeEnabled();
    await lembrarSofia.click();
    await expect(
      page.getByText("Modo demo — nada é enviado de verdade.")
    ).toBeVisible();

    // as outras duplas da fila com o Lembrar livre — o rótulo segue o caso
    // dominante: "Lembrar registro" quando a única pendência é o registro
    // (t2c e esp3), "Lembrar" quando há limbo/atraso junto (d-atraso)
    for (const nomes of ["Eduardo · João", "Matheus · Ricardo"])
      await expect(
        fila
          .locator("li", { hasText: nomes })
          .getByRole("button", { name: /^Lembrar( .*)?$/ })
      ).toBeEnabled();

    // d-rito (Gustavo · Ricardo) — a concluída com o rito de encerramento
    // aberto (REALIZA-172): pendência da coordenação, não da dupla — a
    // linha leva o badge operacional e o CTA é link pra ficha, sem Lembrar
    const rito = fila.locator("li", { hasText: "Gustavo · Ricardo" });
    await expect(rito).toBeVisible();
    await expect(
      rito.getByText("Rito de encerramento pendente — concluir na ficha")
    ).toBeVisible();
    await expect(
      rito.getByText("encerramento pendente", { exact: true })
    ).toBeVisible();
    await expect(
      rito.getByRole("link", { name: "Concluir rito" })
    ).toHaveAttribute("href", `/duplas/${DUPLA_RITO}`);
    await expect(
      rito.getByRole("button", { name: /^Lembrar/ })
    ).toHaveCount(0);

    // chips de filtro — cada um conta o recorte; clicar isola as linhas e
    // desliga o agrupamento. A conta do chip casa com a síntese calculada
    // acima (mesma derivacao dos badges)
    const chips = fila.getByRole("group", {
      name: "Filtrar a fila de acompanhamento",
    });
    await expect(
      chips.getByRole("button", { name: /^Todas · \d+$/ })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      chips.getByRole("button", { name: new RegExp(`^Críticas · ${nCriticas}$`) })
    ).toBeVisible();
    const chipRegistro = chips.getByRole("button", {
      name: new RegExp(`^Registro pendente · ${nRegistros}$`),
    });
    await expect(chipRegistro).toBeVisible();
    await chipRegistro.click();
    await expect(chipRegistro).toHaveAttribute("aria-pressed", "true");
    // o filtro isola exatamente as linhas com o badge — Sofia e Matheus
    // são as estáveis; a do Caio oscila (bloco acima cobre quando existe)
    await expect(fila.locator("li")).toHaveCount(nRegistros);
    await expect(fila.getByText("Matheus · Ricardo")).toBeVisible();
    await expect(fila.getByText("Eduardo · Sofia")).toBeVisible();
    await expect(fila.getByText("Dandara · Fernanda")).toHaveCount(0);
    // com filtro ativo a lista não agrupa — os cabeçalhos somem
    await expect(
      fila.getByRole("heading", { name: /Precisam de intervenção/ })
    ).toHaveCount(0);
    await chips.getByRole("button", { name: /^Todas ·/ }).click();
    await expect(
      fila.getByRole("heading", {
        name: `Precisam de intervenção (${nCriticas})`,
      })
    ).toBeVisible();
  });

  test("semana do programa — oficiais em cards, supervisão e 'Abrir chamada' só no dia", async ({
    page,
  }) => {
    const sec = page.locator('section[aria-label="Semana do programa"]');

    // os oficiais datados do seg–dom em cards com tag de tipo + pill de
    // turma. A terça-âncora carrega o enc. 5 da T1 E o enc. 1 da T2 (mesma
    // data) — seg/ter eles caem NA semana corrente; de quarta em diante a
    // âncora roda pra próxima terça e a semana mostra o enc. 4 da T1 e
    // nenhum evento da T2
    const dow = new Date(`${hojeSP()}T12:00:00Z`).getUTCDay();
    const ancoraNaSemana = dow === 1 || dow === 2;
    await expect(
      sec.getByRole("link", {
        name: `Encontro ${ancoraNaSemana ? 5 : 4} · T1`,
      })
    ).toBeVisible();
    if (ancoraNaSemana)
      await expect(
        sec.getByRole("link", { name: "Encontro 1 · T2" })
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

    // os cards carregam o "O que cobre" do guia atrás de <details> nativo
    // — a voz da coordenação (o mentor lê "Como conduzir" na dele). O
    // summary é alvo de toque de verdade (min-h-11 no mobile) e abre de
    // verdade: o texto do guia aparece depois do clique
    const guia = sec
      .locator("summary", { hasText: "O que cobre" })
      .first();
    await expect(guia).toBeVisible();
    const details = guia.locator("xpath=..");
    await expect(details).not.toHaveJSProperty("open", true);
    await guia.click();
    await expect(details).toHaveJSProperty("open", true);
    await expect(
      details.locator("p", { hasText: /[a-zá-ú]{4}/ }).last()
    ).toBeVisible();

    // o encontro oficial carrega o meta da coorte no detalhe — "N duplas
    // — cada uma marca a sua" (a coordenação nunca agenda pela dupla)
    const cardEncontro = sec.locator("li", {
      hasText: `Encontro ${ancoraNaSemana ? 5 : 4} · T1`,
    });
    await expect(
      cardEncontro.getByText(/\d+ duplas — cada uma marca a sua/)
    ).toBeVisible();

    // "Abrir chamada" só existe quando um evento tipo 'formacao' é HOJE.
    // Na semana corrente o dataset sempre tem três candidatos: a roda de
    // casos (domingo) e, quando a terça-âncora roda pra semana que vem
    // (de quarta em diante), os dois encontros de formação da T2 — a
    // inicial na quinta e a final na sexta da semana corrente. Nos outros
    // dias os cards levam só a tag do tipo (Formação/Encontro/…)
    const chamadaHoje = dow === 0 || dow === 4 || dow === 5;
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
