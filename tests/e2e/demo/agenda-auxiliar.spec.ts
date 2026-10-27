import { agirComConfirma, entrarNaDemo, expect, test } from "../helpers";

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
//   · d-fim (concluída) e d-esp4 (concluída) — contam no resumo "Situação
//     das duplas", não no "Por turma" (que só lista ativa/pausada)
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
    // o cabeçalho abriu espaço pra semana; os números do escopo moram no
    // resumo "Situação das duplas" (o mesmo SaudePrograma de /duplas e da
    // agenda da coordenação): 5 correndo (ok, pend, esp1, t2b, t2c) + 2
    // concluídas (fim, esp4) — e o apoio lê como pill à parte, nunca como
    // situação da dupla
    await expect(
      page.getByText(/Turma 1 e Turma 2 · semana \d+, \d+ a \d+ de \w+/)
    ).toBeVisible();
    const saude = page.locator('section[aria-label="Situação das duplas"]');
    await expect(saude).toBeVisible();
    await expect(
      saude.getByText(/5 em andamento · 2 concluídas · 0 pausadas/)
    ).toBeVisible();
    // a barra nomeia o split inteiro — risco/atenção/dia drifta com o
    // relógio; o denominador (5) e o apoio do Caio (pedido do jovem) não
    await expect(saude.getByRole("img")).toHaveAttribute(
      "aria-label",
      /5 em andamento: \d+ em risco, \d+ em atenção, \d+ em dia\. 2 pausadas ou concluídas\. 1 com apoio aberto\./
    );
    await expect(saude.getByText(/com apoio aberto/)).toBeVisible();

    // as abas do auxiliar: "Por turma" é o default, "Consolidada" vive em
    // ?aba=consolidada — links com role=tab, como no resto da agenda
    const abas = page.getByRole("tablist", { name: "Modos da agenda" });
    // uma barra só na página (REALIZA-246)
    await expect(abas).toHaveCount(1);
    await expect(
      abas.getByRole("tab", { name: "Por turma" })
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      abas.getByRole("tab", { name: "Consolidada" })
    ).toHaveAttribute("aria-selected", "false");

    // a faixa "Semana do programa" existe no escopo das supervisionadas —
    // mas é leitura pura: o supervisor sem papel mentor não tem superfície
    // de dia, então os títulos não podem linkar ?dia= (o param cairia no
    // ramo errado do page.tsx). Sem link nenhum na faixa: sem ?dia= e sem
    // "Abrir chamada" — presença é painel da coordenação
    const faixa = page.locator('section[aria-label="Semana do programa"]');
    await expect(faixa).toBeVisible();
    await expect(faixa.getByRole("link")).toHaveCount(0);
    await expect(faixa.locator('a[href*="dia="]')).toHaveCount(0);

    // o desencontro das turmas deixou de ser texto explicativo — a frase
    // saiu e a prova agora é a própria estrutura: 3 grupos (T1, T2 e
    // "Trilhas de especialista", o rótulo honesto do grupo sem cronograma)

    // grupos por cronograma: T1 com Bia e Caio, T2 com Laura e Matheus, e
    // o grupo sem cronograma da trilha esp supervisionada
    const t1 = page.locator('section[aria-label="Duplas da Turma 1"]');
    const t2 = page.locator('section[aria-label="Duplas da Turma 2"]');
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

    // card da Bia (d-ok) — nome_social no título, o mentor no contexto.
    // Mesmo drift do Caio abaixo: com pendência apontável o "Lembrar"
    // vira primária e "Ver ficha" recolhe no ⋯ "Mais ações" (REALIZA-186);
    // em dia o link solto segue no rodapé. O ⋯ no DOM decide o ramo.
    const cardBia = t1.locator("article", { hasText: "Bia" });
    await expect(cardBia.getByText("mentor: Ricardo Tavares")).toBeVisible();
    const maisAcoesBia = cardBia.getByRole("button", {
      name: "Mais ações da dupla de Bia",
    });
    if ((await maisAcoesBia.count()) > 0) {
      // o menu é nomeado pelo trigger — o card do Caio pode montar um ⋯
      // idêntico no mesmo view, então nunca pesquisa "menu" a seco
      const menuBia = page.getByRole("menu", {
        name: "Mais ações da dupla de Bia",
      });
      await agirComConfirma(
        () => maisAcoesBia.click(),
        () => menuBia.isVisible()
      );
      await expect(
        menuBia.getByRole("menuitem", { name: "Ver ficha" })
      ).toBeVisible();
      // fecha de verdade antes de seguir — menu aberto segue na árvore
      // de a11y e colide com o ⋯ do Caio logo abaixo
      await agirComConfirma(
        () => page.keyboard.press("Escape"),
        () => menuBia.isHidden()
      );
    } else {
      await expect(
        cardBia.getByRole("link", { name: "Ver ficha ›" })
      ).toBeVisible();
    }

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
    // REALIZA-186 — o rodapé do card muda de anatomia com o Lembrar: havendo
    // pendência apontável (sinais > 0) o nudge vira a primária visível e
    // supervisão + ficha recolhem no ⋯ "Mais ações da dupla de <nome>"; em
    // dia (sem sinal) voltam os botões soltos. O ⋯ no DOM decide o ramo —
    // a pendência do Caio drifta com o relógio, como o contexto acima.
    const maisAcoesCaio = cardCaio.getByRole("button", {
      name: "Mais ações da dupla de Caio Henrique Oliveira",
    });
    if ((await maisAcoesCaio.count()) > 0) {
      // o Lembrar é a condição do ⋯ — livre ("Lembrar") ou travada no cap
      // ("Lembrada dd/mm"), a primária está sempre no rodapé
      await expect(
        cardCaio.getByRole("button", { name: /^Lembrar/ }).first()
      ).toBeEnabled();
      // clique com confirmação: em preview frio o handler do trigger pode
      // ainda não ter hidratado — repete até o popup abrir. O menu é
      // nomeado pelo trigger: o card da Bia pode montar um ⋯ no mesmo
      // view, então nunca pesquisa "menu" a seco.
      const menuAcoes = page.getByRole("menu", {
        name: "Mais ações da dupla de Caio Henrique Oliveira",
      });
      await agirComConfirma(
        () => maisAcoesCaio.click(),
        () => menuAcoes.isVisible()
      );
      await expect(
        menuAcoes.getByRole("menuitem", { name: "Registrar supervisão" })
      ).toBeVisible();
      await expect(
        menuAcoes.getByRole("menuitem", { name: "Ver ficha" })
      ).toHaveAttribute("href", `/duplas/${DUPLA_PEND}`);
      await page.keyboard.press("Escape");
    } else {
      // Caio em-dia hoje — sem sinal, sem Lembrar e sem ⋯ (botões soltos)
      test.info().annotations.push({
        type: "dataset",
        description: "Caio em-dia hoje — sem sinal, sem Lembrar e sem ⋯",
      });
      await expect(
        cardCaio.getByRole("button", { name: "Registrar supervisão" })
      ).toBeEnabled();
      await expect(
        cardCaio.getByRole("link", { name: "Ver ficha ›" })
      ).toHaveAttribute("href", `/duplas/${DUPLA_PEND}`);
    }

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
        page.getByText(/Caio \(T1\).*Use/)
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

    // o item sintético do Caio — vigente sem row: "Encontro N a agendar"
    // com o detalhe da dupla e Lembrar livre. O N drifta com a semana
    // (enc. 5 na semana do vigente sem row; nas semanas em que o enc. 4
    // já rolou o item some da lista) — o assert casa qualquer número de
    // encontro.
    const aAgendar = page
      .locator("article")
      .filter({ hasText: /Encontro \d+ a agendar/ })
      .filter({ hasText: /Caio com Carlos Menezes/ });
    if ((await aAgendar.count()) > 0) {
      await expect(
        aAgendar.getByRole("heading", { name: /Encontro \d+ a agendar/ })
      ).toBeVisible();
      await expect(aAgendar).toContainText("A agendar");
      await expect(
        aAgendar.getByText(/Caio com Carlos Menezes · Turma 1/)
      ).toBeVisible();
      // o botão abre o preview — o lembrete sai do "Lembrar pelo app"
      await aAgendar
        .getByRole("button", { name: /^Lembrar .*ver a mensagem/ })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Lembrar pelo app" })
        .click();
      await expect(
        page.getByText("Modo demo: nada é enviado de verdade.")
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

    // sessões da trilha supervisionada (Sofia × Bia) — convidado: a tag
    // âmbar marca e o item não tem nenhuma ação pro supervisor. A âncora
    // nova da semana deixa MAIS de uma sessão da dupla na janela — o
    // invariante vale pra todas (filter por nome só resolve 2 → strict).
    const convidados = page
      .locator("article")
      .filter({ hasText: /Bia × Sofia Nogueira/ })
      .filter({ hasText: /Trilha de especialista · sessão \d de 5/ });
    await expect(convidados.first()).toBeVisible();
    for (const convidado of await convidados.all()) {
      await expect(convidado.getByText("só acompanhamento")).toBeVisible();
      await expect(convidado.getByRole("button")).toHaveCount(0);
      await expect(convidado.getByRole("link")).toHaveCount(0);
    }

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
