import { entrarNaDemo, expect, test } from "../helpers";

// WP5 — a agenda do auxiliar executivo (role "supervisor") no dataset demo:
// "Por turma" agrupa as supervisionadas pelo calendário delas (a coord
// monitora tudo; o supervisor só as dele — duplas.supervisor_id é a aresta)
// e "Consolidada" vira a agenda única da pessoa — encontros das duplas,
// supervisões dela, eventos oficiais e sessões de especialista em modo
// convidado ("só acompanhamento"). Ele supervisiona e registra supervisão —
// nunca agenda por dupla.
//
// Dataset demo (src/lib/demo/data.ts) — o Paulo supervisiona 7 duplas:
//   · d-ok (Bia · Ricardo) e d-pend (Caio · Carlos) na T1 — a do Caio é a
//     única supervisionada sem row do vigente (enc. 5) → card com contexto
//     de problema + warnbox "Sem encontro agendado (1)" + item "a agendar"
//     na consolidada
//   · d-t2b (Laura · Luiza) e d-t2c (Matheus · Ricardo) na T2
//   · d-esp1 (Bia × Sofia) — trilha de especialista supervisionada: cai no
//     grupo "Trilhas de especialista" (sem cronograma; o componente relata
//     o tipo em vez de "Sem turma") e na consolidada entra como convidado
//     âmbar
//   · d-fim (concluída) e d-esp4 (concluída) — contam no total do header,
//     não no "Por turma" (que só lista ativa/pausada)
// A Beatriz supervisiona a d-risco/d-atraso/d-esp2/d-esp3 — nenhuma delas
// pode aparecer na agenda do Paulo (checagem negativa de escopo).
// Público, sem writes: Lembrar e o dialog de supervisão respondem o modo
// demo sem gravar nada.

// uid(0x0602) — dupla do Caio, id estável do dataset demo
const DUPLA_PEND = "de000000-0000-4000-8000-000000001538";
// uid(0x0606) — trilha Sofia × Bia supervisionada pelo Paulo
const DUPLA_ESP1 = "de000000-0000-4000-8000-000000001542";

test.describe("agenda demo do supervisor — Por turma / Consolidada (WP5)", () => {
  test.use({ timezoneId: "America/Sao_Paulo" });

  test("por turma — escopo das supervisionadas, cards e warnbox", async ({
    page,
  }) => {
    await entrarNaDemo(page, "supervisor");
    await page.goto("/agenda");

    await expect(
      page.getByRole("heading", { name: "Agenda das minhas duplas" })
    ).toBeVisible();
    // correndo = ativa/pausada: ok, pend, esp1, t2b, t2c — fim e esp4 são
    // concluídas e entram no contador de encerradas do cabeçalho
    await expect(
      page.getByText(/5 duplas supervisionadas · 2 encerradas/)
    ).toBeVisible();

    // as abas do auxiliar: "Por turma" é o default, "Consolidada" vive em
    // ?aba=consolidada — links com role=tab, como no resto da agenda
    const abas = page.getByRole("tablist", { name: "Modos da agenda" });
    await expect(
      abas.getByRole("tab", { name: "Por turma" })
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      abas.getByRole("tab", { name: "Consolidada" })
    ).toHaveAttribute("aria-selected", "false");

    // o desencontro das turmas — 3 grupos (T1, T2 e "Trilhas de
    // especialista", o rótulo honesto do grupo sem cronograma)
    await expect(
      page.getByText(/As turmas não começaram juntas/)
    ).toBeVisible();

    // grupos por cronograma: T1 com Bia e Caio, T2 com Laura e Matheus, e
    // o grupo sem cronograma da trilha esp supervisionada
    const t1 = page.locator('section[aria-label="Duplas da T1 · 2026/2027"]');
    const t2 = page.locator('section[aria-label="Duplas da T2 · 2026/2027"]');
    await expect(t1).toBeVisible();
    await expect(t1.getByRole("heading", { name: /Turma 1/ })).toBeVisible();
    await expect(t2).toBeVisible();
    // o grupo sem cronograma é toda trilha esp → o componente nomeia o tipo
    // em vez de "Sem turma" (que mentiria)
    const semTurma = page.locator(
      'section[aria-label="Duplas da trilha de especialista"]'
    );
    await expect(semTurma).toBeVisible();
    await expect(
      semTurma.getByRole("heading", { name: "Trilhas de especialista" })
    ).toBeVisible();

    // card da Bia (d-ok) — nome_social no título, o mentor no contexto
    const cardBia = t1.locator("article", { hasText: "Bia" });
    await expect(cardBia.getByText("mentor: Ricardo Tavares")).toBeVisible();
    await expect(
      cardBia.getByRole("link", { name: "Ver ficha ›" })
    ).toBeVisible();

    // card do Caio (d-pend) — o contexto drifta com o relógio do enc. 4:
    // "sem encontro agendado" quando o vigente não tem row (seg/ter de
    // semanas com enc.5), "realizado"/"Registro … pendente" nas semanas em
    // que o enc. 4 já rolou. A família inteira é válida — o que importa é
    // que um contexto exista e as ações do supervisor estejam lá.
    const cardCaio = t1.locator("article", { hasText: "Caio Henrique Oliveira" });
    await expect(cardCaio.getByText("mentor: Carlos Menezes")).toBeVisible();
    const caioSemData = (await cardCaio.getByText(/sem encontro agendado/).count()) > 0;
    if (!caioSemData) {
      await expect(
        cardCaio.getByText(/realizado|agendado já passou|pendente|atrasado/)
      ).toBeVisible();
    }
    await expect(
      cardCaio.getByRole("button", { name: "Registrar supervisão" })
    ).toBeEnabled();
    // o Lembrar só renderiza quando há pendência apontável (sinais > 0) —
    // Caio em-dia não leva nudge; quando existe, está livre ("Lembrar") ou
    // travada no cap ("Lembrada dd/mm")
    const lembrarCaio = cardCaio.getByRole("button", { name: /^Lembrar/ });
    if ((await lembrarCaio.count()) > 0) {
      await expect(lembrarCaio.first()).toBeEnabled();
    } else {
      test.info().annotations.push({
        type: "dataset",
        description: "Caio em-dia hoje — sem sinal, sem botão Lembrar",
      });
    }
    await expect(
      cardCaio.getByRole("link", { name: "Ver ficha ›" })
    ).toHaveAttribute("href", `/duplas/${DUPLA_PEND}`);

    // trilha esp supervisionada — sessão é "Sessão", não "Encontro"; a
    // supervisora é a mesma pessoa, o mentor é a especialista
    const cardEsp = semTurma.locator("article", { hasText: "Bia" });
    await expect(cardEsp.getByText("mentor: Sofia Nogueira")).toBeVisible();
    await expect(
      cardEsp.getByRole("link", { name: "Ver ficha ›" })
    ).toHaveAttribute("href", `/duplas/${DUPLA_ESP1}`);

    // o warnbox da coorte sem data — só existe quando o Caio está na
    // coorte (enc. vigente sem row); fora disso não há warnbox pra ele
    if (caioSemData) {
      await expect(
        page.getByText("Sem encontro agendado (1)")
      ).toBeVisible();
      await expect(
        page.getByText(/Caio \(T1 · 2026\/2027\).*Use/)
      ).toBeVisible();
    } else {
      test.info().annotations.push({
        type: "dataset",
        description: "Caio fora da coorte sem-data hoje (enc. 4 já rolou)",
      });
    }

    // escopo: nenhuma dupla da Beatriz (nem jovem sem par) aparece — os 5
    // cards são ok+pend na T1, t2b+t2c na T2 e a trilha esp1
    const grupos = page.locator('section[aria-label^="Duplas da"]');
    await expect(grupos.locator("article")).toHaveCount(5);
    await expect(
      grupos.locator("article", {
        hasText: /Dandara|Eduardo Lima|Kauã|Pedro|Rafael|Wendel/,
      })
    ).toHaveCount(0);

    // supervisor não agenda por dupla — nenhuma superfície de agendamento
    await expect(
      page.getByRole("button", {
        name: /agendar encontro|marcar encontro|remarcar/i,
      })
    ).toHaveCount(0);
  });

  test("consolidada — itens por dia, convidado âmbar, supervisão e Lembrar", async ({
    page,
  }) => {
    await entrarNaDemo(page, "supervisor");
    await page.goto("/agenda?aba=consolidada");

    const abas = page.getByRole("tablist", { name: "Modos da agenda" });
    await expect(
      abas.getByRole("tab", { name: "Consolidada" })
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText(/Uma só lista, em ordem de data/)).toBeVisible();

    // dias viram sections nomeadas — "Hoje · …", "Amanhã · …" ou o dia da
    // semana por extenso; sempre há itens (a_agendar + supervisão + oficial)
    const dias = page.locator("section[aria-label]");
    await expect(dias.first()).toBeVisible();

    // o item sintético do Caio — vigente sem row: "enc. N a agendar" com
    // o detalhe da dupla e Lembrar livre. O N drifta com a semana (enc. 5
    // na semana do vigente sem row; nas semanas em que o enc. 4 já rolou
    // o item some da lista) — o assert casa qualquer número de encontro.
    const aAgendar = page
      .locator("article")
      .filter({ hasText: /enc\. \d+ a agendar/ })
      .filter({ hasText: /Caio com Carlos Menezes/ });
    if ((await aAgendar.count()) > 0) {
      await expect(
        aAgendar.getByRole("heading", { name: /enc\. \d+ a agendar/ })
      ).toBeVisible();
      await expect(aAgendar).toContainText("A agendar");
      await expect(
        aAgendar.getByText(/Caio com Carlos Menezes · T1 · 2026\/2027/)
      ).toBeVisible();
      await aAgendar
        .getByRole("button", { name: "Lembrar", exact: true })
        .click();
      await expect(
        page.getByText("Modo demo — nada é enviado de verdade.")
      ).toBeVisible();
    } else {
      test.info().annotations.push({
        type: "dataset",
        description: "Caio sem item 'a agendar' hoje (enc. vigente já tem row)",
      });
    }

    // a supervisão do domingo entra como item próprio — pill "Você" e o
    // dialog de supervisão no contexto da dupla (d-ok)
    const sup = page
      .locator("article")
      .filter({ hasText: "Supervisão · Paulo Serra × Ricardo Tavares" });
    await expect(
      sup.getByRole("heading", {
        name: "Supervisão · Paulo Serra × Ricardo Tavares",
      })
    ).toBeVisible();
    await expect(sup.getByText("Você", { exact: true })).toBeVisible();
    await sup
      .getByRole("button", { name: "Registrar supervisão" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Registrar supervisão" })
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // sessão da trilha supervisionada (Sofia × Bia, sábado) — convidado:
    // a tag âmbar marca e o item não tem nenhuma ação pro supervisor
    const convidado = page
      .locator("article")
      .filter({ hasText: /Bia × Sofia Nogueira/ });
    await expect(convidado.getByText("só acompanhamento")).toBeVisible();
    await expect(
      convidado.getByText(/Trilha de especialista · sessão \d de 5/)
    ).toBeVisible();
    await expect(convidado.getByRole("button")).toHaveCount(0);
    await expect(convidado.getByRole("link")).toHaveCount(0);

    // evento oficial entra como convidado também — a roda de casos do
    // domingo (formação continuada da T1)
    const oficial = page
      .locator("article")
      .filter({ hasText: "Roda de casos — formação continuada de mentores" });
    await expect(oficial.getByText("Evento oficial")).toBeVisible();
    await expect(oficial.getByText("só acompanhamento")).toBeVisible();

    // nem na consolidada há superfície de agendamento
    await expect(
      page.getByRole("button", {
        name: /agendar encontro|marcar encontro|remarcar/i,
      })
    ).toHaveCount(0);
  });
});
