import { entrarNaDemo, expect, test } from "../helpers";

// WP5 → REALIZA-161 → REALIZA-176 — a agenda da coordenação no modo
// "Monitoramento" virou dashboard operacional (DOM real): faixa de síntese
// no topo (a leitura de 2s) e depois a ordem operacional — 1º "Para
// acompanhar" (a fila com badges por dimensão — vermelho só no
// acompanhamento — filtros em chips, agrupamento críticas × demais e o
// Lembrar universal; o cap D5 de 48h por dupla já chega computado), 2º
// "Semana no programa" (os oficiais do seg–dom + supervisões da equipe) e
// 3º "Semana do encontro, por cronograma" (uma linha por turma — nunca
// misturado — com o deep-link pro dia oficial e a barra única lime/muted;
// sem barra segmentada nem número gigante). A coordenação NÃO agenda por
// ninguém: a única ação sobre dupla aqui é o nudge.
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
// Público, sem writes: o LembreteButton do modo demo responde o toast
// "Modo demo — nada é enviado de verdade." — a superfície vale em qualquer
// deploy, produção inclusive.

// uid(0x0602) — dupla do Caio, id estável do dataset demo
const DUPLA_PEND = "de000000-0000-4000-8000-000000001538";

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

    // as três seções do modo — as labels acessíveis são o contrato, e a
    // primeira é a fila operacional (REALIZA-176: a resposta dos 5s no topo)
    await expect(page.locator("section[aria-label]").first()).toHaveAttribute(
      "aria-label",
      "Duplas para acompanhar"
    );
    for (const label of [
      "Semana do encontro por cronograma",
      "Duplas para acompanhar",
      "Semana no programa",
    ])
      await expect(
        page.locator(`section[aria-label="${label}"]`)
      ).toBeVisible();
  });

  test("semana do encontro por cronograma — uma linha por turma", async ({
    page,
  }) => {
    const sec = page.locator(
      'section[aria-label="Semana do encontro por cronograma"]'
    );

    // REALIZA-176 — a seção compactou: uma linha por cronograma ativo (não
    // cards 2×n), todas com a mesma anatomia — pill da turma, título com o
    // deep-link pro dia oficial, sublinha de contagem e a barra única
    const linhas = sec.getByRole("listitem");
    await expect(linhas).toHaveCount(2);

    // o vigente da T1 anda com o dia da semana: seg/ter é o enc. 5 (a âncora
    // do dataset mira a terça que vem); de qua a dom o 5 já saltou pra
    // semana seguinte e o vigente é o 4 — a história é a mesma
    const linkT1 = sec.getByRole("link", {
      name: /Encontro [45] · T1 · 2026\/2027 — abrir o dia no calendário/,
    });
    await expect(linkT1).toBeVisible();
    await expect(linkT1).toHaveAttribute(
      "href",
      /^\/agenda\?aba=calendario&dia=\d{4}-\d{2}-\d{2}$/
    );
    await expect(
      sec.getByRole("link", {
        name: "Encontro 1 · T2 · 2026/2027 — abrir o dia no calendário",
      })
    ).toBeVisible();

    // "X de Y realizaram" em texto corrido — sem número gigante. T1: 0 ou 2
    // de 4 conforme o vigente; T2 estável em 1 de 3 (só o Matheus realizou)
    const linhaT1 = linhas.filter({ hasText: "Turma 1" });
    await expect(linhaT1).toContainText(/[02] de 4/);
    await expect(linhaT1).toContainText("realizaram");
    await expect(
      linhas.filter({ hasText: "Turma 2" })
    ).toContainText(/1 de 3/);

    // o hint do desencontro — as turmas não começaram juntas (a nota "por
    // turma" vive dentro da seção, não ao lado do título)
    await expect(
      sec.getByText(/As turmas não começaram juntas/)
    ).toBeVisible();
    await expect(
      sec.getByText(/T1 · 2026\/2027 está no encontro [45]/)
    ).toBeVisible();
    await expect(
      sec.getByText(/T2 · 2026\/2027 está no encontro 1/)
    ).toBeVisible();

    // a barra única por turma — progressbar lime/muted (a gramática dos
    // outros painéis), com o detalhe completo no aria-label. Seg/ter (enc.
    // 5 vigente): "0 realizaram, 3 agendadas, 1 sem agendamento" (o Caio
    // não tem row); qua–dom (enc. 4 vigente): "2 realizaram, 0 agendadas,
    // 2 sem agendamento" (Dandara sem row do 4, Eduardo marcou
    // não-aconteceu). A T2 é estável: só o Matheus realizou o enc. 1
    await expect(
      sec.getByRole("progressbar", {
        name: /realizaram, \d+ agendadas, \d+ sem agendamento/,
      })
    ).toHaveCount(2);
    await expect(
      sec.getByRole("progressbar", {
        name: /0 realizaram, 3 agendadas, 1 sem agendamento|2 realizaram, 0 agendadas, 2 sem agendamento/,
      })
    ).toBeVisible();
    await expect(
      sec.getByRole("progressbar", {
        name: /1 realizaram, 2 agendadas, 0 sem agendamento/,
      })
    ).toBeVisible();
  });

  test("para acompanhar — síntese, dimensões por linha, filtros e cap 48h", async ({
    page,
  }) => {
    const fila = page.locator('section[aria-label="Duplas para acompanhar"]');
    await expect(
      fila.getByRole("heading", { name: "Para acompanhar" })
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
      chips.getByRole("button", { name: /^Críticas · 1$/ })
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
      fila.getByRole("heading", { name: "Precisam de intervenção (1)" })
    ).toBeVisible();
  });

  test("semana no programa — oficiais, supervisão e 'Abrir chamada' só no dia", async ({
    page,
  }) => {
    const sec = page.locator('section[aria-label="Semana no programa"]');

    // os oficiais datados do seg–dom. A terça-âncora carrega o enc. 5 da
    // T1 E o enc. 1 da T2 (mesma data) — seg/ter eles caem NA semana
    // corrente; de quarta em diante a âncora roda pra próxima terça e a
    // semana mostra o enc. 4 da T1 e nenhum evento da T2
    const dow = new Date(`${hojeSP()}T12:00:00Z`).getUTCDay();
    const ancoraNaSemana = dow === 1 || dow === 2;
    await expect(
      sec.getByText(`Encontro ${ancoraNaSemana ? 5 : 4} · T1`)
    ).toBeVisible();
    if (ancoraNaSemana)
      await expect(sec.getByText("Encontro 1 · T2")).toBeVisible();
    await expect(
      sec.getByText("Roda de casos — formação continuada de mentores")
    ).toBeVisible();
    await expect(
      sec.getByText("Supervisão · Paulo Serra × Ricardo Tavares")
    ).toBeVisible();
    await expect(sec.getByText("turma 1", { exact: true })).toBeVisible();
    if (ancoraNaSemana)
      await expect(sec.getByText("turma 2", { exact: true })).toBeVisible();

    // "Abrir chamada" só existe quando o evento de formação é HOJE (a roda
    // de casos mora no domingo da semana corrente) — nos outros dias a
    // linha leva só a etiqueta "oficial"
    const ehDomingo = new Date(`${hojeSP()}T12:00:00`).getDay() === 0;
    const chamada = sec.getByRole("link", { name: "Abrir chamada" });
    if (ehDomingo) {
      await expect(chamada).toHaveAttribute(
        "href",
        `/agenda?aba=calendario&dia=${hojeSP()}`
      );
    } else {
      await expect(chamada).toHaveCount(0);
      await expect(sec.getByText("oficial", { exact: true }).first()).toBeVisible();
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
    // mentor — a coord vê Semana/Mês/Lista, coberto no agenda-views.spec)
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
