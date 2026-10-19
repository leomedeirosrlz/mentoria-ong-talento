import { entrarNaDemo, expect, test } from "../helpers";

// WP5 — a agenda da coordenação no modo "Monitoramento" (mock v6, DOM real):
// três seções — "Semana do encontro, por cronograma" (um card por turma,
// nunca misturado), "Para acompanhar" (a fila de sinais com o Lembrar
// universal — o cap D5 de 48h por dupla já chega computado) e "Semana no
// programa" (os oficiais do seg–dom + supervisões da equipe). A coordenação
// NÃO agenda por ninguém: a única ação sobre dupla aqui é o nudge.
//
// Dataset demo (src/lib/demo/data.ts):
//   · vigentes da semana: enc. 5 da T1 e enc. 1 da T2 — as duas turmas rolam
//     a mesma terça, a T2 começou agora (o desencontro é o caso que a tela
//     foi desenhada pra explicar)
//   · d-risco (Dandara · Fernanda): 2 encontros em atraso + pedido de apoio
//     → tag "Risco"; nudge da Marina há ~20h → botão BLOQUEADO "Lembrada
//     dd/mm" com title "1 lembrete a cada 48h por dupla"
//   · d-pend (Caio · Carlos): sem row do enc. 5 + registro do 4 pendente →
//     "Lembrar" livre (o nudge dela tem 5 dias)
//   · d-atraso (Eduardo · João) e d-t2c (Matheus · Ricardo): limbo →
//     "Lembrar" livre
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

    // as três seções do modo — as labels acessíveis são o contrato
    for (const label of [
      "Semana do encontro por cronograma",
      "Duplas para acompanhar",
      "Semana no programa",
    ])
      await expect(
        page.locator(`section[aria-label="${label}"]`)
      ).toBeVisible();
  });

  test("semana do encontro por cronograma — T1 no enc. 5, T2 no enc. 1", async ({
    page,
  }) => {
    const sec = page.locator(
      'section[aria-label="Semana do encontro por cronograma"]'
    );

    // um card por cronograma ativo — o heading carrega o nº vigente + turma
    await expect(
      sec.getByRole("heading", { name: "Encontro 5 · T1 · 2026/2027" })
    ).toBeVisible();
    await expect(
      sec.getByRole("heading", { name: "Encontro 1 · T2 · 2026/2027" })
    ).toBeVisible();

    // o hint do desencontro — as turmas não começaram juntas
    await expect(
      sec.getByText(/As turmas não começaram juntas/)
    ).toBeVisible();
    await expect(
      sec.getByText(/T1 · 2026\/2027 está no encontro 5/)
    ).toBeVisible();
    await expect(
      sec.getByText(/T2 · 2026\/2027 está no encontro 1/)
    ).toBeVisible();

    // barra de 3 segmentos por turma — a T1 tem 4 ativas: ninguém realizou
    // o enc. 5 ainda (é a terça da semana), 3 marcaram e o Caio não tem row
    await expect(
      sec.getByRole("img", {
        name: /realizaram, \d+ agendadas, \d+ sem agendamento/,
      })
    ).toHaveCount(2);
    await expect(
      sec.getByRole("img", {
        name: "0 realizaram, 3 agendadas, 1 sem agendamento",
      })
    ).toBeVisible();

    // a régua oficial do card — 16 círculos numerados
    await expect(
      sec.locator(
        'ol[aria-label="Calendário oficial T1 · 2026/2027: 16 encontros"]'
      )
    ).toBeVisible();
    await expect(
      sec
        .locator(
          'ol[aria-label="Calendário oficial T1 · 2026/2027: 16 encontros"]'
        )
        .locator("li")
    ).toHaveCount(16);
  });

  test("para acompanhar — fila com semáforo, Lembrar livre/bloqueado e Ver ficha", async ({
    page,
  }) => {
    const fila = page.locator('section[aria-label="Duplas para acompanhar"]');
    await expect(
      fila.getByRole("heading", { name: "Para acompanhar" })
    ).toBeVisible();
    await expect(fila.getByText(/Sem agendamento ou atrasadas/)).toBeVisible();

    // d-risco encabeça a fila (ORDEM_SEMAFORO: risco → atenção) — o nudge de
    // ~20h atrás dispara o cap de 48h: botão desabilitado, razão no texto
    const risco = fila.locator("li", { hasText: "Dandara · Fernanda" });
    await expect(risco.getByText("Risco")).toBeVisible();
    const bloqueada = risco.getByRole("button", {
      name: /^Lembrada \d{2}\/\d{2}$/,
    });
    await expect(bloqueada).toBeVisible();
    await expect(bloqueada).toBeDisabled();
    await expect(bloqueada).toHaveAttribute(
      "title",
      /^1 lembrete a cada 48h por dupla — destrava \d{2}\/\d{2}$/
    );

    // d-pend — sem row do enc. 5 + registro do 4 pendente: o lembrete dela
    // tem 5 dias, então o botão fica livre; o caso dominante é o registro,
    // então o rótulo é "Lembrar registro"; o clique no demo só simula
    const pend = fila.locator("li", { hasText: "Caio · Carlos" });
    await expect(pend.getByText("Atenção")).toBeVisible();
    await expect(pend).toContainText(/ainda sem data/);
    const lembrar = pend.getByRole("button", {
      name: "Lembrar registro",
      exact: true,
    });
    await expect(lembrar).toBeEnabled();
    await lembrar.click();
    await expect(
      page.getByText("Modo demo — nada é enviado de verdade.")
    ).toBeVisible();

    // "Ver ficha ›" aponta pra ficha da dupla — id estável do dataset
    await expect(pend.getByRole("link", { name: "Ver ficha ›" })).toHaveAttribute(
      "href",
      `/duplas/${DUPLA_PEND}`
    );

    // as outras duplas da fila com o Lembrar livre — o rótulo segue o caso
    // dominante: "Lembrar registro" quando a única pendência é o registro
    // (t2c e esp3), "Lembrar" quando há limbo/atraso junto (d-atraso)
    for (const nomes of [
      "Eduardo · João",
      "Eduardo · Sofia",
      "Matheus · Ricardo",
    ])
      await expect(
        fila
          .locator("li", { hasText: nomes })
          .getByRole("button", { name: /^Lembrar( .*)?$/ })
      ).toBeEnabled();
  });

  test("semana no programa — oficiais, supervisão e 'Abrir chamada' só no dia", async ({
    page,
  }) => {
    const sec = page.locator('section[aria-label="Semana no programa"]');

    // os oficiais datados do seg–dom — enc. 5 da T1 e enc. 1 da T2 na terça,
    // a roda de casos no domingo e a supervisão do Ricardo no domingo
    await expect(sec.getByText("Encontro 5 · T1")).toBeVisible();
    await expect(sec.getByText("Encontro 1 · T2")).toBeVisible();
    await expect(
      sec.getByText("Roda de casos — formação continuada de mentores")
    ).toBeVisible();
    await expect(
      sec.getByText("Supervisão · Paulo Serra × Ricardo Tavares")
    ).toBeVisible();
    await expect(sec.getByText("turma 1", { exact: true })).toBeVisible();
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
