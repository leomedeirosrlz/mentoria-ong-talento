import type { Locator, Page } from "@playwright/test";
import {
  abrirMenuEncontro,
  agirComConfirma,
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  convergirDuplaAtiva,
  expect,
  inserirViaServiceRole,
  jwtDoUsuario,
  limparEncontrosDaDupla,
  limparViaServiceRole,
  loginComSenha,
  preencherDiaHora,
  restComoUsuario,
  test,
} from "../helpers";

// Agenda livre DPP do jovem (REALIZA-110 / migration 0072) contra backend
// real. Cobre o ciclo inteiro na /jovem/agenda — agendar (Select de nº),
// remarcar com motivo, trocar só o link, desmarcar e "não aconteceu" —
// mais os guards que a UI esconde (data passada, remarcação sem motivo,
// nº inválido, ressuscitar nao_aconteceu) chamando a RPC definer com o JWT
// do jovem, e o sentido bilateral: o mentor agenda → o sino do jovem toca.
//
// Piso: a dupla …0030 volta a EXATAMENTE as fixtures antes e depois de cada
// teste — d1 (nº 8, agendado futuro) e d2 (nº 16, realizado). Os sinos de
// agenda dos dois lados também zeram: o dedup do trigger encontros_agenda_
// notify suprime notificação não-lida de mesmo (destino, tipo, corpo), e
// uma sobra de run morto com o mesmo corpo faria o insert nem acontecer.
const JOVEM_EMAIL = process.env.E2E_JOVEM_EMAIL ?? "jovem-e2e@realiza.test";
const MENTOR_EMAIL = process.env.E2E_MENTOR_EMAIL ?? "e2e-mentor@realiza.test";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const DUPLA_ID =
  process.env.E2E_DUPLA_ID ?? "e2e00000-0000-4000-8000-000000000030";
const SUPA_URL = process.env.E2E_SUPABASE_URL ?? "";

const IDS = {
  jovemProfile: "e2e00000-0000-4000-8000-0000000000b0",
  mentorProfile: "e2e00000-0000-4000-8000-000000000010",
  encontroFixture: "e2e00000-0000-4000-8000-0000000000d1", // nº 8, agendado
  encontroAvaliacao: "e2e00000-0000-4000-8000-0000000000d2", // nº 16, realizado
} as const;
const FIXTURES = [IDS.encontroFixture, IDS.encontroAvaliacao];
const TIPOS_AGENDA = [
  "encontro_marcado",
  "encontro_alterado",
  "encontro_desfeito",
] as const;

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

/** "YYYY-MM-DDTHH:mm" — sempre relativo a agora; o spec fatia em dia+hora
 *  pros campos nativos do SeletorDiaHora (530, sem datetime-local). */
function emDias(dias: number, hora = "19:00") {
  const d = new Date(Date.now() + dias * 86400e3);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${hora}`;
}

/** Primeira terça a pelo menos `min` dias — a grade da fixture (mentor e
 *  mentorada) só marca terça/quinta à noite; fora dela o dialog pede
 *  "Agendar mesmo assim" e o spec dependia do dia da semana em que rodava. */
function naTerca(min: number, hora = "19:00") {
  const d = new Date(Date.now() + min * 86400e3);
  const ate = (2 - d.getDay() + 7) % 7;
  return emDias(min + ate, hora);
}

/** Linha da agenda do jovem pra um nº — ancora no <p> "Nº encontro" e sobe
 *  dois níveis (texto → row com botões e badge). O `exact` é o que separa
 *  o 6º do 16º. */
function linha(secao: Locator, n: number) {
  // o rótulo pode ganhar sufixo ("· adiantado") — prefixo casa os dois
  return secao
    .getByText(new RegExp(`^${n}º encontro`))
    .locator("xpath=../..");
}

type Notif = { titulo: string; corpo: string | null; href: string | null };

/** Sinos de agenda recebidos por um lado da dupla — esses três tipos só
 *  nascem do trigger encontros_agenda_notify. */
async function sinosDe(
  profileId: string,
  tipo: (typeof TIPOS_AGENDA)[number]
): Promise<Notif[]> {
  return buscarViaServiceRole<Notif[]>(
    "notificacoes",
    `select=titulo,corpo,href&profile_id=eq.${profileId}&tipo=eq.${tipo}`
  );
}

/** Filhos da 0071 primeiro — avaliacoes_encontro e avaliacao_links têm FK
 *  NO ACTION pra encontros; apagar o pai antes dá 409. Os dois filhos são
 *  independentes entre si — em paralelo pra caber no hook em staging. */
async function apagarEncontros(ids: Iterable<string>) {
  const lista = [...ids];
  if (!lista.length) return;
  const csv = lista.join(",");
  await Promise.all([
    limparViaServiceRole("avaliacoes_encontro", `encontro_id=in.(${csv})`),
    limparViaServiceRole("avaliacao_links", `encontro_id=in.(${csv})`),
  ]);
  await limparViaServiceRole("encontros", `id=in.(${csv})`);
}

/** Devolve a dupla a EXATAMENTE as duas fixtures: encontros criados pelos
 *  testes saem (o filtro é por exclusão — cobre os feitos pela UI, sem id
 *  conhecido), a d1/d2 são re-criadas/re-carimbadas quando preciso e os
 *  sinos de agenda zeram depois de qualquer insert (os do trigger).
 *  Os blocos independentes correm em paralelo: em staging cada chamada
 *  PostgREST serial soma segundos e o hook comia o teto de 60s do teste. */
async function convergirPiso() {
  const [restos, existentes] = await Promise.all([
    buscarViaServiceRole<{ id: string }[]>(
      "encontros",
      `select=id&dupla_id=eq.${DUPLA_ID}&id=not.in.(${FIXTURES.join(",")})`
    ),
    buscarViaServiceRole<{ id: string }[]>(
      "encontros",
      `select=id&id=in.(${FIXTURES.join(",")})`
    ),
  ]);
  const tem = new Set(existentes.map((e) => e.id));
  const futura3d = new Date(Date.now() + 3 * 86400e3).toISOString();
  const passada2d = new Date(Date.now() - 2 * 86400e3).toISOString();

  await Promise.all([
    apagarEncontros(restos.map((r) => r.id)),
    tem.has(IDS.encontroFixture)
      ? // re-carimbo do seed — agendado→agendado não esbarra no guard 0043
        atualizarViaServiceRole("encontros", `id=eq.${IDS.encontroFixture}`, {
          data_hora: futura3d,
          status: "agendado",
        })
      : // a home do mentor e a seção Próximos dependem de um agendado futuro
        inserirViaServiceRole("encontros", {
          id: IDS.encontroFixture,
          dupla_id: DUPLA_ID,
          numero: 8,
          data_hora: futura3d,
          status: "agendado",
        }),
    tem.has(IDS.encontroAvaliacao)
      ? // update de data em realizado passa — o guard só trava status
        atualizarViaServiceRole(
          "encontros",
          `id=eq.${IDS.encontroAvaliacao}`,
          { data_hora: passada2d, realizado_em: passada2d }
        )
      : // o insert dispara o trigger 0071 que minta o avaliacao_links
        inserirViaServiceRole("encontros", {
          id: IDS.encontroAvaliacao,
          dupla_id: DUPLA_ID,
          numero: 16,
          data_hora: passada2d,
          realizado_em: passada2d,
          status: "realizado",
        }),
  ]);

  // DEPOIS dos inserts: eles disparam o trigger (o "marcado" das fixtures,
  // creditado à coordenação) — o piso de sino tem que cobrir isso também.
  // E o d2 é o ÚLTIMO encontro do cronograma — re-criá-lo dispara a 0102
  // e a dupla acorda 'concluida' (a RPC de agenda recusa e o CTA some):
  // convergirDuplaAtiva devolve status ativa, sem encerramento nem sinos.
  // As duas limpezas tocam linhas diferentes de tabelas diferentes.
  await Promise.all([
    limparViaServiceRole(
      "notificacoes",
      `profile_id=in.(${IDS.mentorProfile},${IDS.jovemProfile})&tipo=in.(${TIPOS_AGENDA.join(",")})`
    ),
    convergirDuplaAtiva(DUPLA_ID),
  ]);
}

/** Agendado direto no banco — piso dos fluxos que não exercitam o agendar
 *  em si (remarcar, desmarcar, não aconteceu, guardas). `emDiasFuturo`
 *  negativo cria o "agendado que já passou" do botão Não aconteceu.
 *  A data é truncada no MINUTO: o par dia/hora não carrega segundos e a
 *  action interpreta o valor naïve como -03:00 — um timestamp com :42s não
 *  sobreviveria a um re-submit inalterado (a RPC veria a data "mudada" e
 *  cobraria motivo). As rows que o app grava já nascem com :00s — o
 *  truncamento reproduz exatamente isso. */
function criarAgendado(numero: number, emDiasFuturo: number) {
  const ms = Math.floor((Date.now() + emDiasFuturo * 86400e3) / 60000) * 60000;
  return inserirViaServiceRole("encontros", {
    dupla_id: DUPLA_ID,
    numero,
    data_hora: new Date(ms).toISOString(),
    status: "agendado",
    created_by: IDS.jovemProfile,
  });
}

/** Login do jovem na home — ponto de partida fixo dos specs do /jovem.
 *  O redirect /→/jovem em preview frio passa dos 15s (mesma régua dos 30s
 *  do loginComSenha). */
async function entrarComoJovem(page: Page) {
  await loginComSenha(page, JOVEM_EMAIL, SENHA);
  await page.waitForURL((u) => u.pathname === "/jovem", { timeout: 30_000 });
}

test.describe("mentorado — agenda livre (REALIZA-110)", () => {
  // os campos dia/hora são naïve e a action interpreta como -03:00 —
  // browser fora do fuso de SP (ex.: runner UTC) reescreveria o instante
  // num re-submit "sem mudar a data" e a RPC cobraria motivo à toa
  test.use({ timezoneId: "America/Sao_Paulo" });
  test.beforeEach(convergirPiso);
  test.afterEach(convergirPiso);

  test("agendar um encontro livre grava de verdade e avisa o mentor", async ({
    page,
  }) => {
    await entrarComoJovem(page);
    await page.goto("/jovem/agenda");

    const dialog = page.getByRole("dialog");
    // 530: com sugestão no topo o CTA "Agendar encontro" do header some —
    // o caminho real é "Escolher outro dia" do hero (abre o seletor do
    // encontro sugerido) e o "Outro encontro" revela o select de nº
    await agirComConfirma(
      () => page.getByRole("button", { name: "Escolher outro dia" }).click(),
      () => dialog.isVisible()
    );

    // o Select lista os nº livres (8 e 16 estão nas fixtures) — pro jovem o
    // hint de data oficial não chega (ciclo_eventos é RLS-vazio pra ele)
    await dialog.getByRole("button", { name: "Outro encontro" }).click();
    await dialog.getByRole("combobox", { name: "Qual encontro?" }).click();
    await page.getByRole("option", { name: /^6º encontro/ }).click();

    await preencherDiaHora(dialog, emDias(9));
    await dialog
      .getByRole("button", { name: "Confirmar agendamento" })
      .click();

    await expect(page.getByText("6º encontro agendado.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });

    // a linha nova cai em Próximos — o link entra depois pelo ⋯ (530: a
    // sugestão é o fluxo enxuto, "Editar link da chamada" é gesto dela)
    const proximos = page.locator(
      'section[aria-labelledby="agenda-proximos"]'
    );
    const linha6 = linha(proximos, 6);
    await expect(
      linha6.getByText("Agendado").filter({ visible: true })
    ).toBeVisible({
      timeout: 15_000,
    });
    await abrirMenuEncontro(page, linha6);
    await page
      .getByRole("menuitem", { name: "Editar link da chamada" })
      .click();
    await dialog.locator("#link").fill("https://meet.google.com/e2e-agenda");
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Link atualizado.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });
    await abrirMenuEncontro(page, linha6);
    await expect(
      page.getByRole("menuitem", { name: "Link da chamada", exact: true })
    ).toHaveAttribute("href", "https://meet.google.com/e2e-agenda", {
      timeout: 15_000,
    });
    await page.keyboard.press("Escape");

    // write real: row agendada na dupla, com autoria do jovem
    const rows = await buscarViaServiceRole<
      { status: string; link: string | null; created_by: string | null }[]
    >(
      "encontros",
      `select=status,link,created_by&dupla_id=eq.${DUPLA_ID}&numero=eq.6`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("agendado");
    expect(rows[0].link).toBe("https://meet.google.com/e2e-agenda");
    expect(rows[0].created_by).toBe(IDS.jovemProfile);

    // o sino do mentor — o corpo leva a data em pt-BR (America/Sao_Paulo)
    const [notif] = (await sinosDe(IDS.mentorProfile, "encontro_marcado"))
      .filter((n) => n.titulo === "6º encontro marcado");
    expect(notif).toBeTruthy();
    expect(notif?.corpo).toMatch(
      /Mentorada E2E marcou para \d{2}\/\d{2} às \d{2}:\d{2}\./
    );
    expect(notif?.href).toBe(`/duplas/${DUPLA_ID}`);
  });

  test("agendar grava o numeroAgendar pré-selecionado sem tocar o nº (QW7)", async ({
    page,
  }) => {
    await entrarComoJovem(page);
    await page.goto("/jovem/agenda");

    // REALIZA-509 (R22): numeroAgendar é o primeiro livre DEPOIS do último
    // realizado; a fixture tem o 16º realizado (o último do ciclo), então
    // nenhum livre passa dele e a regra cai no fallback livres[0] = 1.
    // O nº chega pré-selecionado na superfície que a página oferecer — o
    // cartão de sugestão (caminho principal da 481) ou o dialog de rede
    // de segurança (#numero-select), um dos dois sempre monta.
    const marcar = page.getByRole("button", { name: /^Marcar para / });
    const cta = page.getByRole("button", { name: "Agendar encontro" });
    await expect(marcar.or(cta)).toBeVisible();

    if (await marcar.isVisible()) {
      // o título do cartão já é a promessa do nº — o toque único marca
      // numeroAgendar + slot do motor sem passar por select algum
      await expect(
        page.getByText("1º encontro com Mentor")
      ).toBeVisible();
      await marcar.click();
    } else {
      const dialog = page.getByRole("dialog");
      await agirComConfirma(
        () => cta.click(),
        () => dialog.isVisible()
      );
      await expect(dialog.locator("#numero-select")).toContainText(
        "1º encontro"
      );
      await preencherDiaHora(dialog, emDias(7));
      await dialog
        .getByRole("button", { name: "Confirmar agendamento" })
        .click();
    }

    // a prova forte: o submit sem escolha de nº gravou exatamente o
    // numeroAgendar — não o próximo da agenda (que seria o 9º)
    await expect(page.getByText("1º encontro agendado.")).toBeVisible({
      timeout: 15_000,
    });

    const rows = await buscarViaServiceRole<
      { numero: number; status: string }[]
    >(
      "encontros",
      `select=numero,status&dupla_id=eq.${DUPLA_ID}&numero=eq.1`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("agendado");
  });

  test("remarcar mudando a data exige motivo e o mentor lê o motivo", async ({
    page,
  }) => {
    const enc = await criarAgendado(7, 10);
    await entrarComoJovem(page);
    await page.goto("/jovem/agenda");

    const proximos = page.locator(
      'section[aria-labelledby="agenda-proximos"]'
    );
    const dialog = page.getByRole("dialog");
    await agirComConfirma(
      async () => {
        await linha(proximos, 7)
          .getByRole("button", { name: "Ações do encontro" })
          .click();
        await page.getByRole("menuitem", { name: "Remarcar" }).click();
      },
      () => dialog.isVisible()
    );

    await preencherDiaHora(dialog, emDias(14));
    // a data mudou → o hint some e o motivo passa a ser exigido
    await expect(
      dialog.getByText("Só precisa se mudar a data.")
    ).toHaveCount(0);
    await dialog.locator("#motivo-select").click();
    await page.getByRole("option", { name: "Conflito de agenda" }).click();
    await dialog
      .getByRole("button", { name: "Confirmar remarcação" })
      .click();

    await expect(page.getByText("7º encontro remarcado.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });

    const [row] = await buscarViaServiceRole<
      { data_hora: string; motivo_reagendamento: string | null }[]
    >(
      "encontros",
      `select=data_hora,motivo_reagendamento&id=eq.${String(enc.id)}`
    );
    expect(row.motivo_reagendamento).toBe("Conflito de agenda");
    // a data moveu de verdade (+10d → +14d)
    expect(new Date(row.data_hora).getTime()).toBeGreaterThan(
      Date.now() + 12 * 86400e3
    );

    const [notif] = (await sinosDe(IDS.mentorProfile, "encontro_alterado"))
      .filter((n) => n.titulo === "7º encontro alterado");
    expect(notif?.corpo).toMatch(
      /Mentorada E2E moveu para \d{2}\/\d{2} às \d{2}:\d{2}\./
    );
    expect(notif?.corpo).toContain("Motivo: Conflito de agenda");
  });

  test("remarcar só o link não pede motivo e persiste de verdade", async ({
    page,
  }) => {
    const enc = await criarAgendado(9, 11);
    await entrarComoJovem(page);
    await page.goto("/jovem/agenda");

    const proximos = page.locator(
      'section[aria-labelledby="agenda-proximos"]'
    );
    const dialog = page.getByRole("dialog");
    await agirComConfirma(
      async () => {
        await linha(proximos, 9)
          .getByRole("button", { name: "Ações do encontro" })
          .click();
        await page.getByRole("menuitem", { name: "Remarcar" }).click();
      },
      () => dialog.isVisible()
    );

    // data intacta → o hint fica e o motivo não é exigido
    await expect(
      dialog.getByText("Só precisa se mudar a data.")
    ).toBeVisible();
    await dialog.locator("#link").fill("https://meet.google.com/e2e-test");
    await dialog
      .getByRole("button", { name: "Confirmar remarcação" })
      .click();

    await expect(page.getByText("9º encontro remarcado.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });

    const [row] = await buscarViaServiceRole<
      { link: string | null; motivo_reagendamento: string | null }[]
    >(
      "encontros",
      `select=link,motivo_reagendamento&id=eq.${String(enc.id)}`
    );
    expect(row.link).toBe("https://meet.google.com/e2e-test");
    expect(row.motivo_reagendamento).toBeNull();

    // "atualizou o link", não "moveu" — o trigger separa os dois eventos
    const [notif] = (await sinosDe(IDS.mentorProfile, "encontro_alterado"))
      .filter((n) => n.titulo === "9º encontro alterado");
    expect(notif?.corpo).toMatch(
      /Mentorada E2E atualizou o link do encontro de \d{2}\/\d{2}\./
    );
  });

  test("desmarcar apaga o encontro da agenda e avisa o mentor", async ({
    page,
  }) => {
    await criarAgendado(10, 12);
    await entrarComoJovem(page);
    await page.goto("/jovem/agenda");

    const proximos = page.locator(
      'section[aria-labelledby="agenda-proximos"]'
    );
    const dialog = page.getByRole("dialog");
    // "Desmarcar" mora no ⋯ da linha — a primária do agendado sem link é
    // o "Remarcar" (530)
    await agirComConfirma(
      () =>
        abrirMenuEncontro(page, linha(proximos, 10)).then(() =>
          page.getByRole("menuitem", { name: "Desmarcar" }).click()
        ),
      () =>
        dialog
          .getByRole("heading", { name: "Desmarcar o encontro?" })
          .isVisible()
    );
    await dialog.getByRole("button", { name: "Desmarcar" }).click();

    await expect(page.getByText("Encontro desmarcado.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(proximos.getByText("10º encontro")).toHaveCount(0, {
      timeout: 15_000,
    });

    const rows = await buscarViaServiceRole<{ id: string }[]>(
      "encontros",
      `select=id&dupla_id=eq.${DUPLA_ID}&numero=eq.10`
    );
    expect(rows).toHaveLength(0);

    const [notif] = (await sinosDe(IDS.mentorProfile, "encontro_desfeito"))
      .filter((n) => n.titulo === "10º encontro desmarcado");
    expect(notif?.corpo).toMatch(
      /Mentorada E2E desmarcou o encontro de \d{2}\/\d{2}\./
    );
  });

  test("agendado já passado vira 'não aconteceu' pela mão do jovem", async ({
    page,
  }) => {
    const enc = await criarAgendado(6, -1);
    await entrarComoJovem(page);
    await page.goto("/jovem/agenda");

    // agendado vencido cai no histórico — "Não aconteceu" mora no ⋯ da
    // linha (a primária do limbo é o "Aconteceu", 530)
    const historico = page.locator(
      'section[aria-labelledby="agenda-historico"]'
    );
    const dialog = page.getByRole("dialog");
    await agirComConfirma(
      () =>
        abrirMenuEncontro(page, linha(historico, 6)).then(() =>
          page.getByRole("menuitem", { name: "Não aconteceu" }).click()
        ),
      () =>
        dialog
          .getByRole("heading", { name: "O encontro não aconteceu?" })
          .isVisible()
    );
    await dialog
      .getByRole("button", { name: "Sim, não aconteceu" })
      .click();

    await expect(
      page.getByText("Encontro marcado como não realizado.")
    ).toBeVisible({ timeout: 15_000 });
    // o botão some e vira badge no histórico
    await expect(
      linha(historico, 6)
        .getByText("Não aconteceu", { exact: true })
        .filter({ visible: true })
    ).toBeVisible({ timeout: 15_000 });

    const [row] = await buscarViaServiceRole<{ status: string }[]>(
      "encontros",
      `select=status&id=eq.${String(enc.id)}`
    );
    expect(row.status).toBe("nao_aconteceu");

    const [notif] = (await sinosDe(IDS.mentorProfile, "encontro_desfeito"))
      .filter((n) => n.titulo === "6º encontro não aconteceu");
    expect(notif?.corpo).toMatch(
      /Mentorada E2E marcou que o encontro de \d{2}\/\d{2} não aconteceu\./
    );
  });

  test("agendado já passado vira realizado pelo 'Aconteceu' do jovem", async ({
    page,
  }) => {
    // 90s: a action confirmar_encontro (write + sino + refresh) em staging
    // frio já passou do teto de 60s com o botão preso em "Salvando…"
    test.setTimeout(90_000);
    // 0121: qualquer ponta libera a jornada — o jovem confirma o encontro,
    // a avaliação dele nasce na hora e o mentor é lembrado de registrar
    const enc = await criarAgendado(7, -1);
    await entrarComoJovem(page);
    await page.goto("/jovem/agenda");

    const historico = page.locator(
      'section[aria-labelledby="agenda-historico"]'
    );
    // confirma no estado final, não no toast (passageiro): o agendado do
    // jovem vira realizado DELE (created_by=jovem → retroDele) e a linha
    // ganha o "Corrigir" à vista — a pendência "Avaliar" não serve de
    // régua porque pode cair no "e mais N" colapsado. O click tem teto
    // próprio — um click sem timeout esperaria no botão preso
    const corrigir = linha(historico, 7).getByRole("button", {
      name: "Corrigir",
    });
    await agirComConfirma(
      () =>
        linha(historico, 7)
          .getByRole("button", { name: "Aconteceu", exact: true })
          .click({ timeout: 5_000 }),
      () => corrigir.isVisible()
    );

    const [row] = await buscarViaServiceRole<
      { status: string; realizado_em: string | null; data_hora: string }[]
    >(
      "encontros",
      `select=status,realizado_em,data_hora&id=eq.${String(enc.id)}`
    );
    expect(row.status).toBe("realizado");
    expect(new Date(row.realizado_em!).getTime()).toBe(
      new Date(row.data_hora).getTime()
    );
    // o trigger da 0071 minta o link de avaliação do jovem
    const links = await buscarViaServiceRole<{ id: string }[]>(
      "avaliacao_links",
      `select=id&encontro_id=eq.${String(enc.id)}`
    );
    expect(links).toHaveLength(1);

    // o mentor recebe o lembrete apontando o registro do encontro
    const lembretes = (
      await buscarViaServiceRole<Notif[]>(
        "notificacoes",
        `select=titulo,corpo,href&profile_id=eq.${IDS.mentorProfile}&tipo=eq.lembrete`
      )
    ).filter(
      (n) =>
        /confirmou o 7º encontro$/.test(n.titulo) &&
        // runs anteriores falhas deixam lembretes órfãos do mesmo título —
        // o href ancora no encontro DESTA run
        n.href === `/duplas/${DUPLA_ID}#registrar-${String(enc.id)}`
    );
    expect(lembretes).toHaveLength(1);
    expect(lembretes[0]!.href).toBe(
      `/duplas/${DUPLA_ID}#registrar-${String(enc.id)}`
    );
    await limparViaServiceRole(
      "notificacoes",
      `profile_id=eq.${IDS.mentorProfile}&tipo=eq.lembrete&titulo=like.*confirmou*`
    );
  });

  test("guards do banco: data passada, remarcação sem motivo e nº inválido", async ({
    page,
  }) => {
    // piso: um agendado remarcável e um nao_aconteceu que não ressuscita
    const enc7 = await criarAgendado(7, 10);
    await inserirViaServiceRole("encontros", {
      dupla_id: DUPLA_ID,
      numero: 10,
      data_hora: new Date(Date.now() - 86400e3).toISOString(),
      status: "nao_aconteceu",
    });

    // sessão real do jovem: o grant do login por senha devolve o JWT e a
    // apikey — chamar a RPC por fora da UI prova que o guard mora no banco
    // (o input min do browser esconde o "sempre pra frente")
    const grant = page.waitForResponse(
      (r) => r.url().includes("grant_type=password"),
      { timeout: 20_000 }
    );
    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    const res = await grant;
    const apiKey = res.request().headers()["apikey"] ?? "";
    const { access_token: token } = (await res.json()) as {
      access_token?: string;
    };
    expect(token).toBeTruthy();

    const rpc = (args: Record<string, unknown>) =>
      page.request.post(
        `${SUPA_URL}/rest/v1/rpc/agendar_encontro_mentorado`,
        {
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          data: args,
        }
      );

    // sempre pra frente: data passada não agenda nem vira retroativo
    const passada = await rpc({
      p_dupla: DUPLA_ID,
      p_numero: 6,
      p_data_hora: new Date(Date.now() - 3600e3).toISOString(),
    });
    expect((await passada.json()).error).toContain("sempre pra frente");

    // remarcação sem motivo quando a data muda: a UI marca required, mas o
    // guard de verdade é da RPC — e o write não acontece
    const semMotivo = await rpc({
      p_dupla: DUPLA_ID,
      p_numero: 7,
      p_data_hora: new Date(Date.now() + 14 * 86400e3).toISOString(),
    });
    expect((await semMotivo.json()).error).toContain("motivo");
    const [r7] = await buscarViaServiceRole<{ data_hora: string }[]>(
      "encontros",
      `select=data_hora&id=eq.${String(enc7.id)}`
    );
    expect(new Date(r7.data_hora).getTime()).toBeLessThan(
      Date.now() + 11 * 86400e3
    );

    // nao_aconteceu não volta por agendar — o caminho é conversar/remarcar
    const travado = await rpc({
      p_dupla: DUPLA_ID,
      p_numero: 10,
      p_data_hora: new Date(Date.now() + 5 * 86400e3).toISOString(),
    });
    expect((await travado.json()).error).toContain("não realizado");

    // nº fora do teto do cronograma da dupla
    const fora = await rpc({
      p_dupla: DUPLA_ID,
      p_numero: 99,
      p_data_hora: new Date(Date.now() + 5 * 86400e3).toISOString(),
    });
    expect((await fora.json()).error).toContain("Escolha um encontro");
  });

  test("bilateral: o mentor agenda pela home e o sino do jovem toca", async ({
    page,
  }) => {
    // o painel "O que fazer agora" do mentor dá o CTA de agendar quando não
    // há registro pendente — esvaziar os encontros reproduz o estado do
    // mentor.spec (o afterEach reconverge as fixtures d1/d2)
    await limparEncontrosDaDupla(DUPLA_ID);

    await loginComSenha(page, MENTOR_EMAIL, SENHA);
    const dialog = page.getByRole("dialog");
    await agirComConfirma(
      () =>
        page
          .getByRole("button", { name: /Agendar (encontro|próximo)/ })
          // .first: a home pode mostrar o CTA no "O que fazer agora" e na
          // agenda da semana — os dois abrem o mesmo dialog
          .first()
          .click(),
      () => dialog.isVisible()
    );
    // o nº é decidido pela home — lê do título pro assert do sino
    const titulo = await dialog
      .getByRole("heading", { name: /º encontro/ })
      .innerText();
    const numero = titulo.match(/(\d+)º/)?.[1];
    expect(numero).toBeTruthy();

    await preencherDiaHora(dialog, naTerca(6));
    await dialog
      .getByRole("button", { name: "Confirmar agendamento" })
      .click();
    // toast novo do dialog: "Agendamento confirmado: Nº encontro."
    await expect(
      page.getByText(/Agendamento confirmado: \d+º encontro\./i)
    ).toBeVisible({ timeout: 15_000 });

    // o outro lado recebeu — o corpo credita o mentor e o href é do jovem
    const [notif] = (await sinosDe(IDS.jovemProfile, "encontro_marcado"))
      .filter((n) => n.titulo === `${numero}º encontro marcado`);
    expect(notif?.corpo).toMatch(/Mentor E2E marcou para/);
    expect(notif?.href).toBe("/jovem/agenda");

    // e o sino da /jovem mostra — relogado pra provar que não é estado local
    await page.context().clearCookies();
    await entrarComoJovem(page);
    await agirComConfirma(
      () => page.getByRole("button", { name: /^Notificações/ }).click(),
      () => page.getByText(`${numero}º encontro marcado`).isVisible()
    );
    await expect(
      page.getByText(`${numero}º encontro marcado`)
    ).toBeVisible({ timeout: 15_000 });
  });

  // REALIZA-23: gestos por linha — o lápis troca SÓ o link (a action roteia
  // o jovem pela RPC da 0072 com a mesma data → sem motivo) e o agendado
  // vencido ganha "Remarcar" ao lado do "não aconteceu" — o limbo tem duas
  // saídas honestas, não uma.
  test("lápis troca só o link — o mentor é avisado", async ({ page }) => {
    // agendado futuro SEM link — pra quem ainda não tem link o lápis é o
    // "adicionar" da linha
    const enc = await criarAgendado(5, 12);
    await entrarComoJovem(page);
    await page.goto("/jovem/agenda");

    const proximos = page.locator(
      'section[aria-labelledby="agenda-proximos"]'
    );
    const linha5 = linha(proximos, 5);
    const dialog = page.getByRole("dialog");
    // o lápis mora no ⋯ da linha — a primária do agendado sem link é o
    // "Remarcar" (530)
    await agirComConfirma(
      () =>
        abrirMenuEncontro(page, linha5).then(() =>
          page.getByRole("menuitem", { name: "Editar link da chamada" }).click()
        ),
      () =>
        dialog
          .getByRole("heading", { name: "Editar link da chamada" })
          .isVisible()
    );
    await dialog.locator("#link").fill("https://meet.google.com/e2e-jovem");
    await dialog.getByRole("button", { name: "Salvar" }).click();

    // toast + refresh: o roundtrip action→router.refresh em preview frio
    // passa dos 5s default — a régua da suite é 15s pós-write
    await expect(page.getByText("Link atualizado.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });
    // "Link da chamada" fora da janela vira item do ⋯ (530) — abre o
    // menu e o href do menuitem aponta o link novo (+12d nunca é janela)
    await abrirMenuEncontro(page, linha5);
    await expect(
      page.getByRole("menuitem", { name: "Link da chamada", exact: true })
    ).toHaveAttribute("href", "https://meet.google.com/e2e-jovem", {
      timeout: 15_000,
    });
    await page.keyboard.press("Escape");

    // write real via RPC — a data não muda, então motivo não é cobrado
    const [row] = await buscarViaServiceRole<
      { link: string | null; data_hora: string; motivo_reagendamento: string | null }[]
    >(
      "encontros",
      `select=link,data_hora,motivo_reagendamento&id=eq.${String(enc.id)}`
    );
    expect(row.link).toBe("https://meet.google.com/e2e-jovem");
    expect(row.motivo_reagendamento).toBeNull();
    // a RPC reenvia a mesma data — o instante não anda nem um milissegundo
    expect(new Date(String(row.data_hora)).getTime()).toBe(
      new Date(String(enc.data_hora)).getTime()
    );

    // sino do mentor — "atualizou o link", não "moveu" (o trigger separa)
    const [notif] = (await sinosDe(IDS.mentorProfile, "encontro_alterado"))
      .filter((n) => n.titulo === "5º encontro alterado");
    expect(notif).toBeTruthy();
    expect(notif?.corpo).toMatch(
      /Mentorada E2E atualizou o link do encontro de \d{2}\/\d{2}\./
    );
    expect(notif?.href).toBe(`/duplas/${DUPLA_ID}`);
  });

  test("agendado vencido também remarca — o limbo não é só 'não aconteceu'", async ({
    page,
  }) => {
    const enc = await criarAgendado(4, -2);
    await entrarComoJovem(page);
    await page.goto("/jovem/agenda");

    // agendado vencido cai no histórico — o "Remarcar" mora no ⋯ da linha
    // junto do "Não aconteceu" (a RPC aceita fonte passada → alvo futuro).
    // A lista densa mostra só os 5 mais recentes: quando há mais, o nº4
    // antigo pede o "Ver histórico completo" antes de localizar a linha
    const historico = page.locator(
      'section[aria-labelledby="agenda-historico"]'
    );
    const verTudo = historico.getByRole("button", {
      name: /Ver histórico completo/,
    });
    if (await verTudo.isVisible().catch(() => false)) await verTudo.click();
    const dialog = page.getByRole("dialog");
    await agirComConfirma(
      () =>
        abrirMenuEncontro(page, linha(historico, 4)).then(() =>
          page.getByRole("menuitem", { name: "Remarcar" }).click()
        ),
      () =>
        dialog.getByRole("heading", { name: "4º encontro" }).isVisible()
    );

    await preencherDiaHora(dialog, emDias(9));
    // data mudou → o hint some e o motivo passa a ser exigido
    await expect(
      dialog.getByText("Só precisa se mudar a data.")
    ).toHaveCount(0);
    await dialog.locator("#motivo-select").click();
    await page.getByRole("option", { name: "Conflito de agenda" }).click();
    await dialog
      .getByRole("button", { name: "Confirmar remarcação" })
      .click();

    await expect(page.getByText("4º encontro remarcado.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });

    // a linha sai do limbo e migra do histórico pros Próximos
    const proximos = page.locator(
      'section[aria-labelledby="agenda-proximos"]'
    );
    await expect(
      linha(proximos, 4).getByText("Agendado").filter({ visible: true })
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(historico.getByText("4º encontro")).toHaveCount(0, {
      timeout: 15_000,
    });

    const [row] = await buscarViaServiceRole<
      { status: string; data_hora: string; motivo_reagendamento: string | null }[]
    >(
      "encontros",
      `select=status,data_hora,motivo_reagendamento&id=eq.${String(enc.id)}`
    );
    expect(row.status).toBe("agendado");
    expect(row.motivo_reagendamento).toBe("Conflito de agenda");
    // a data moveu de passada pra futura de verdade (+9d pedidos)
    expect(new Date(row.data_hora).getTime()).toBeGreaterThan(
      Date.now() + 7 * 86400e3
    );

    // sino do mentor — remarcação leva data nova + motivo no corpo
    const [notif] = (await sinosDe(IDS.mentorProfile, "encontro_alterado"))
      .filter((n) => n.titulo === "4º encontro alterado");
    expect(notif?.corpo).toMatch(
      /Mentorada E2E moveu para \d{2}\/\d{2} às \d{2}:\d{2}\./
    );
    expect(notif?.corpo).toContain("Motivo: Conflito de agenda");
  });
});

test.describe("mentorado — retroativo (REALIZA-437 / migration 0207)", () => {
  test.use({ timezoneId: "America/Sao_Paulo" });
  test.beforeEach(convergirPiso);
  test.afterEach(convergirPiso);

  // realizado criado direto no banco com autoria do jovem — piso dos
  // fluxos de Corrigir/Desfazer sem depender do registro pela UI
  function criarRetroativo(numero: number, emDiasAtras: number) {
    const ms =
      Math.floor((Date.now() + emDiasAtras * 86400e3) / 60000) * 60000;
    const iso = new Date(ms).toISOString();
    return inserirViaServiceRole("encontros", {
      dupla_id: DUPLA_ID,
      numero,
      data_hora: iso,
      realizado_em: iso,
      status: "realizado",
      origem: "externo",
      created_by: IDS.jovemProfile,
    });
  }

  test("encontro combinado por fora nasce realizado, avaliável e o mentor é lembrado", async ({
    page,
  }) => {
    await entrarComoJovem(page);
    await page.goto("/jovem/agenda");

    const dialog = page.getByRole("dialog");
    // o gatilho do header encurtou pra "Registrar encontro" (530) e fica
    // sempre visível — sem elegível o dialog abre o empty-state. O card
    // "Próximo passo" pode render um gatilho irmão com o mesmo rótulo →
    // .first() pega o do header (os dois abrem o mesmo dialog)
    await agirComConfirma(
      () =>
        page
          .getByRole("button", { name: "Registrar encontro" })
          .first()
          .click(),
      () =>
        dialog
          .getByRole("heading", {
            name: "Registrar encontro que já aconteceu",
          })
          .isVisible()
    );

    await dialog.locator("#retro-numero-select").click();
    await page.getByRole("option", { name: "6º encontro" }).click();
    await preencherDiaHora(dialog, emDias(-3));
    // 0242: passaram mais de 7 dias do vencimento oficial — o motivo é
    // obrigatório e o registro nasce marcado como tardio
    await dialog
      .getByPlaceholder(/Se passaram mais de 7 dias/)
      .fill("Combinamos por fora e registrei depois.");
    await dialog
      .getByRole("button", { name: "Registrar encontro" })
      .click();

    await expect(
      page.getByText("6º encontro registrado. Já dá pra avaliar.")
    ).toBeVisible({ timeout: 15_000 });
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });

    // born-realizado no histórico: o realizado não carimba badge (o
    // CheckCircle já diz) e a linha ganha os gestos do criador (Corrigir à
    // vista / Desfazer no ⋯ — enquanto o mentor não registra). O
    // "avaliável" se prova no avaliacao_links mintado pela 0071 (abaixo) —
    // a pendência "Avaliar" pode cair no "e mais N" colapsado e não é
    // régua confiável
    const historico = page.locator(
      'section[aria-labelledby="agenda-historico"]'
    );
    const linha6 = linha(historico, 6);
    await expect(
      linha6.getByRole("button", { name: "Corrigir" })
    ).toBeVisible({ timeout: 15_000 });
    // "Desfazer" mora no ⋯ da linha — a primária do retroativo dele é o
    // "Corrigir" (530)
    await abrirMenuEncontro(page, linha6);
    await expect(
      page.getByRole("menuitem", { name: "Desfazer" })
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // write real: realizado, origem externo, autoria do jovem — data e
    // realizado_em são o instante declarado
    const [row] = await buscarViaServiceRole<
      {
        id: string;
        status: string;
        origem: string;
        created_by: string | null;
        data_hora: string;
        realizado_em: string | null;
      }[]
    >(
      "encontros",
      `select=id,status,origem,created_by,data_hora,realizado_em&dupla_id=eq.${DUPLA_ID}&numero=eq.6`
    );
    expect(row.status).toBe("realizado");
    expect(row.origem).toBe("externo");
    expect(row.created_by).toBe(IDS.jovemProfile);
    expect(new Date(row.realizado_em!).getTime()).toBe(
      new Date(row.data_hora).getTime()
    );

    // o trigger da 0071 minta o link — é o que destrava o "Avaliar"
    const links = await buscarViaServiceRole<{ id: string }[]>(
      "avaliacao_links",
      `select=id&encontro_id=eq.${String(row.id)}`
    );
    expect(links).toHaveLength(1);

    // o mentor recebe o lembrete apontando o registro (segue devido) —
    // mesma peça da 0121, verbo "registrou" (ele criou, não confirmou)
    const lembretes = (
      await buscarViaServiceRole<Notif[]>(
        "notificacoes",
        `select=titulo,corpo,href&profile_id=eq.${IDS.mentorProfile}&tipo=eq.lembrete`
      )
    ).filter(
      (n) =>
        /registrou o 6º encontro$/.test(n.titulo) &&
        // lembretes órfãos de runs falhas dividem o título — o href
        // ancora no encontro DESTA run
        n.href === `/duplas/${DUPLA_ID}#registrar-${String(row.id)}`
    );
    expect(lembretes).toHaveLength(1);
    expect(lembretes[0]!.href).toBe(
      `/duplas/${DUPLA_ID}#registrar-${String(row.id)}`
    );
    await limparViaServiceRole(
      "notificacoes",
      `profile_id=eq.${IDS.mentorProfile}&tipo=eq.lembrete&titulo=like.*registrou*`
    );
  });

  test("o retroativo dele corrige a data e se desfaz — enquanto o mentor não registra", async ({
    page,
  }) => {
    const enc = await criarRetroativo(7, -4);
    await entrarComoJovem(page);
    await page.goto("/jovem/agenda");

    const historico = page.locator(
      'section[aria-labelledby="agenda-historico"]'
    );
    const linha7 = linha(historico, 7);

    // Corrigir: dialog prefilled com a data declarada, nº fixo
    const dialog = page.getByRole("dialog");
    await agirComConfirma(
      () => linha7.getByRole("button", { name: "Corrigir" }).click(),
      () =>
        dialog
          .getByRole("heading", { name: "Corrigir a data do 7º encontro" })
          .isVisible()
    );
    await preencherDiaHora(dialog, emDias(-6));
    await dialog
      .getByRole("button", { name: "Salvar correção" })
      .click();
    await expect(page.getByText("Data corrigida.")).toBeVisible({
      timeout: 15_000,
    });

    const [corrigido] = await buscarViaServiceRole<
      { data_hora: string; realizado_em: string | null; status: string }[]
    >(
      "encontros",
      `select=data_hora,realizado_em,status&id=eq.${String(enc.id)}`
    );
    expect(corrigido.status).toBe("realizado");
    // andou pra trás de verdade (-4d → -6d) nos dois carimbos
    expect(new Date(corrigido.data_hora).getTime()).toBeLessThan(
      Date.now() - 5 * 86400e3
    );
    expect(new Date(corrigido.realizado_em!).getTime()).toBe(
      new Date(corrigido.data_hora).getTime()
    );

    // Desfazer (menu ⋯ da linha): a row sai e a avaliação/link vão junto
    // (filhos NO ACTION)
    await agirComConfirma(
      () =>
        abrirMenuEncontro(page, linha7).then(() =>
          page.getByRole("menuitem", { name: "Desfazer" }).click()
        ),
      () =>
        dialog
          .getByRole("heading", { name: "Desfazer o registro?" })
          .isVisible()
    );
    await dialog
      .getByRole("button", { name: "Sim, desfazer" })
      .click();
    await expect(page.getByText("Registro desfeito.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(historico.getByText("7º encontro")).toHaveCount(0, {
      timeout: 15_000,
    });

    const rows = await buscarViaServiceRole<{ id: string }[]>(
      "encontros",
      `select=id&id=eq.${String(enc.id)}`
    );
    expect(rows).toHaveLength(0);
    const links = await buscarViaServiceRole<{ id: string }[]>(
      "avaliacao_links",
      `select=id&encontro_id=eq.${String(enc.id)}`
    );
    expect(links).toHaveLength(0);
  });

  test("guards do banco: futuro não entra, último é do mentor, nao_aconteceu não ressuscita", async ({
    page,
  }) => {
    await inserirViaServiceRole("encontros", {
      dupla_id: DUPLA_ID,
      numero: 10,
      data_hora: new Date(Date.now() - 86400e3).toISOString(),
      status: "nao_aconteceu",
    });

    // JWT real do jovem — prova que o guard mora na RPC, não no input max
    const grant = page.waitForResponse(
      (r) => r.url().includes("grant_type=password"),
      { timeout: 20_000 }
    );
    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    const res = await grant;
    const apiKey = res.request().headers()["apikey"] ?? "";
    const { access_token: token } = (await res.json()) as {
      access_token?: string;
    };
    expect(token).toBeTruthy();

    const rpc = (args: Record<string, unknown>) =>
      page.request.post(
        `${SUPA_URL}/rest/v1/rpc/registrar_retroativo_mentorado`,
        {
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          data: args,
        }
      );

    // retroativo é só pra trás — futuro é agendamento (outra RPC)
    const futura = await rpc({
      p_dupla: DUPLA_ID,
      p_numero: 6,
      p_data_hora: new Date(Date.now() + 3600e3).toISOString(),
    });
    expect((await futura.json()).error).toContain("já aconteceu");

    // o último do ciclo conclui a dupla (0102) — fechar a jornada segue
    // sendo registro do mentor (mesma fronteira da 0121)
    const ultimo = await rpc({
      p_dupla: DUPLA_ID,
      p_numero: 16,
      p_data_hora: new Date(Date.now() - 3600e3).toISOString(),
    });
    expect((await ultimo.json()).error).toContain("último encontro");

    // nao_aconteceu não ressuscita por aqui — desfazer é do mentor
    const travado = await rpc({
      p_dupla: DUPLA_ID,
      p_numero: 10,
      p_data_hora: new Date(Date.now() - 3600e3).toISOString(),
    });
    expect((await travado.json()).error).toContain("não realizado");
    const [r10] = await buscarViaServiceRole<{ status: string }[]>(
      "encontros",
      `select=status&dupla_id=eq.${DUPLA_ID}&numero=eq.10`
    );
    expect(r10.status).toBe("nao_aconteceu");

    // 0208: passo oficial ainda não vencido não nasce retroativo — criar
    // antes da data do guia pularia o gating da jornada e trancaria um
    // realizado irreversível pro mentor. O nº vem do cronograma real
    // (dinâmico: "hoje" anda e a lista de vencidos só cresce)
    const [{ cronograma_id: cronId }] = await buscarViaServiceRole<
      { cronograma_id: string }[]
    >("duplas", `select=cronograma_id&id=eq.${DUPLA_ID}`);
    const hoje = new Date().toISOString().slice(0, 10);
    const [naoVencido] = await buscarViaServiceRole<{ numero: number }[]>(
      "ciclo_eventos",
      `select=numero&cronograma_id=eq.${cronId}&tipo=eq.encontro&data=gt.${hoje}&numero=lt.16&order=numero.desc&limit=1`
    );
    if (naoVencido) {
      const cedo = await rpc({
        p_dupla: DUPLA_ID,
        p_numero: naoVencido.numero,
        p_data_hora: new Date(Date.now() - 86400e3).toISOString(),
      });
      expect((await cedo.json()).error).toContain("data oficial");
    }

    // 0208: agendado ainda futuro não vira realizado por aqui — mesmo
    // guard da 0121 ("aconteceu" só depois da hora marcada)
    const ag9 = await criarAgendado(9, 10);
    const cedo9 = await rpc({
      p_dupla: DUPLA_ID,
      p_numero: 9,
      p_data_hora: new Date(Date.now() - 86400e3).toISOString(),
    });
    expect((await cedo9.json()).error).toContain("futuro");
    const [r9] = await buscarViaServiceRole<{ status: string }[]>(
      "encontros",
      `select=status&id=eq.${String(ag9.id)}`
    );
    expect(r9.status).toBe("agendado");
  });

  test("pela Liza: a confirmação registra o retroativo, uso único vale e o desfazer apaga a row", async ({
    page,
  }) => {
    // REALIZA-461 — o e2e não roda o provider LLM: a linha ia_confirmacoes
    // é a mesma que a tool grava na 1ª chamada e o POST do card consume
    // atomicamente — prova a ferramenta real de ponta a ponta
    await entrarComoJovem(page);
    const jwt = await jwtDoUsuario(JOVEM_EMAIL, SENHA);
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS;
    const postConf = (data: Record<string, unknown>) =>
      page.request.post("/api/ia/confirmacao", {
        data,
        headers: bypass
          ? { "x-vercel-protection-bypass": bypass }
          : undefined,
      });
    const criarPrevia = async (
      tool: string,
      args: Record<string, unknown>
    ) => {
      const res = await restComoUsuario("rpc/ia_confirmacao_criar", jwt, {
        method: "POST",
        body: { p_tool: tool, p_args: args, p_resumo: `e2e ${tool}` },
      });
      expect(res.status).toBe(200);
      return (await res.json()) as string;
    };

    // primeiro passo elegível real — o mesmo recorte da tool
    // encontros_retroativo (oficial vencido, sem row, nunca o último)
    const [{ cronograma_id: cronId }] = await buscarViaServiceRole<
      { cronograma_id: string }[]
    >("duplas", `select=cronograma_id&id=eq.${DUPLA_ID}`);
    const hoje = new Date().toISOString().slice(0, 10);
    const vencidos = await buscarViaServiceRole<{ numero: number }[]>(
      "ciclo_eventos",
      `select=numero&cronograma_id=eq.${cronId}&tipo=eq.encontro&data=lte.${hoje}&numero=lt.16`
    );
    const ocupados = new Set(
      (
        await buscarViaServiceRole<{ numero: number }[]>(
          "encontros",
          `select=numero&dupla_id=eq.${DUPLA_ID}`
        )
      ).map((e) => e.numero)
    );
    const passo = vencidos.find((e) => !ocupados.has(e.numero));
    expect(passo).toBeTruthy();
    const numero = passo!.numero;
    const args = {
      dupla_id: DUPLA_ID,
      numero,
      data_hora: new Date(Date.now() - 3 * 86400e3).toISOString(),
    };

    // prévia → Confirmar do card → a 0207 escreve de verdade
    const cid = await criarPrevia("jovem_registrar_retroativo", args);
    const okRes = await postConf({
      confirmacao_id: cid,
      tool: "jovem_registrar_retroativo",
      args,
    });
    expect(okRes.status()).toBe(200);
    await expect(okRes.json()).resolves.toMatchObject({ ok: true });
    const [row] = await buscarViaServiceRole<
      { id: string; status: string; origem: string; created_by: string | null }[]
    >(
      "encontros",
      `select=id,status,origem,created_by&dupla_id=eq.${DUPLA_ID}&numero=eq.${numero}`
    );
    expect(row.status).toBe("realizado");
    expect(row.origem).toBe("externo");
    expect(row.created_by).toBe(IDS.jovemProfile);

    // uso único — a mesma prévia não executa de novo nem duplica a row
    const reuse = await postConf({
      confirmacao_id: cid,
      tool: "jovem_registrar_retroativo",
      args,
    });
    await expect(reuse.json()).resolves.toMatchObject({ ok: false });
    const duplicados = await buscarViaServiceRole<{ id: string }[]>(
      "encontros",
      `select=id&dupla_id=eq.${DUPLA_ID}&numero=eq.${numero}`
    );
    expect(duplicados).toHaveLength(1);

    // o desfazer pelo mesmo envelope — a 0208 apaga a row que o jovem criou
    const cid2 = await criarPrevia("jovem_desfazer_retroativo", {
      encontro_id: String(row.id),
    });
    const okDes = await postConf({
      confirmacao_id: cid2,
      tool: "jovem_desfazer_retroativo",
      args: { encontro_id: String(row.id) },
    });
    await expect(okDes.json()).resolves.toMatchObject({ ok: true });
    const depois = await buscarViaServiceRole<{ id: string }[]>(
      "encontros",
      `select=id&id=eq.${String(row.id)}`
    );
    expect(depois).toHaveLength(0);
  });
});

// REALIZA-509 (R24) — o item "Agendar Nº" do ⋯ só existe quando a
// primária do mentor já é o registrar (pendência aberta) E o próximo
// passo não tem data. O demo não reproduz o recorte (toda dupla DPP da
// persona tem agendado futuro garantido — nunca falta data); aqui a d1
// vira limbo e o estado nasce sozinho. convergirPiso devolve as fixtures.
test.describe("mentor — 'Agendar Nº' no ⋯ da ficha (R24)", () => {
  test.use({ timezoneId: "America/Sao_Paulo" });
  test.beforeEach(convergirPiso);
  test.afterEach(convergirPiso);

  test("pendência + próximo sem data → ⋯ vende 'Agendar Nº encontro' e o dialog abre no nº", async ({
    page,
  }) => {
    // d1 (nº 8 agendado futuro) vai pro limbo: vira a pendência que toma a
    // primária e ao mesmo tempo some o "já tem data" — o próximo alvo
    // volta pro primeiro faltante do ciclo (o 16º é o único realizado)
    await atualizarViaServiceRole(
      "encontros",
      `id=eq.${IDS.encontroFixture}`,
      { data_hora: new Date(Date.now() - 86400e3).toISOString() }
    );

    await loginComSenha(page, MENTOR_EMAIL, SENHA);
    await page.goto(`/duplas/${DUPLA_ID}`);

    // a primária ficou com a pendência de menor nº — o 8º em limbo
    await expect(
      page.getByRole("link", { name: "Registrar 8º encontro" })
    ).toBeVisible();

    const mais = page.getByRole("button", { name: "Mais ações da dupla" });
    await expect(mais).toBeVisible();
    await mais.click();
    const popup = page.locator('[data-slot="dropdown-menu-content"]');
    await expect(popup).toBeVisible();
    const item = popup.getByRole("menuitem", {
      name: /^Agendar \d+º encontro$/,
    });
    await expect(item).toBeVisible();
    const numero = (await item.innerText()).match(/(\d+)º/)?.[1];
    expect(numero).toBeTruthy();

    // o dialog mora fora do popup e já abre no nº que o item anunciava.
    // Como o slot oficial do 1º já venceu, ele abre em modo retroativo
    // ("entra como realizado") — o gesto certo pro passo perdido
    await item.click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: `${numero}º encontro` })
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Registrar encontro" })
    ).toBeVisible();
  });
});
