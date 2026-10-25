import type { Locator, Page } from "@playwright/test";
import {
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  convergirDuplaAtiva,
  expect,
  inserirViaServiceRole,
  limparEncontrosDaDupla,
  limparViaServiceRole,
  loginComSenha,
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

/** "YYYY-MM-DDTHH:mm" pro datetime-local — sempre relativo a agora. */
function emDias(dias: number, hora = "19:00") {
  const d = new Date(Date.now() + dias * 86400e3);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${hora}`;
}

/** Linha da agenda do jovem pra um nº — ancora no <p> "Nº encontro" e sobe
 *  dois níveis (texto → row com botões e badge). O `exact` é o que separa
 *  o 6º do 16º. */
function linha(secao: Locator, n: number) {
  return secao
    .getByText(`${n}º encontro`, { exact: true })
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
 *  NO ACTION pra encontros; apagar o pai antes dá 409. */
async function apagarEncontros(ids: Iterable<string>) {
  const lista = [...ids];
  if (!lista.length) return;
  const csv = lista.join(",");
  await limparViaServiceRole("avaliacoes_encontro", `encontro_id=in.(${csv})`);
  await limparViaServiceRole("avaliacao_links", `encontro_id=in.(${csv})`);
  await limparViaServiceRole("encontros", `id=in.(${csv})`);
}

/** Devolve a dupla a EXATAMENTE as duas fixtures: encontros criados pelos
 *  testes saem (o filtro é por exclusão — cobre os feitos pela UI, sem id
 *  conhecido), a d1/d2 são re-criadas/re-carimbadas quando preciso e os
 *  sinos de agenda zeram depois de qualquer insert (os do trigger). */
async function convergirPiso() {
  const restos = await buscarViaServiceRole<{ id: string }[]>(
    "encontros",
    `select=id&dupla_id=eq.${DUPLA_ID}&id=not.in.(${FIXTURES.join(",")})`
  );
  await apagarEncontros(restos.map((r) => r.id));

  const [d1] = await buscarViaServiceRole<{ id: string }[]>(
    "encontros",
    `select=id&id=eq.${IDS.encontroFixture}`
  );
  const futura3d = new Date(Date.now() + 3 * 86400e3).toISOString();
  if (d1) {
    // re-carimbo do seed — agendado→agendado não esbarra no guard 0043
    await atualizarViaServiceRole("encontros", `id=eq.${IDS.encontroFixture}`, {
      data_hora: futura3d,
      status: "agendado",
    });
  } else {
    // a home do mentor e a seção Próximos dependem de um agendado futuro
    await inserirViaServiceRole("encontros", {
      id: IDS.encontroFixture,
      dupla_id: DUPLA_ID,
      numero: 8,
      data_hora: futura3d,
      status: "agendado",
    });
  }

  const [d2] = await buscarViaServiceRole<{ id: string }[]>(
    "encontros",
    `select=id&id=eq.${IDS.encontroAvaliacao}`
  );
  const passada2d = new Date(Date.now() - 2 * 86400e3).toISOString();
  if (d2) {
    // update de data em realizado passa — o guard só trava mudança de status
    await atualizarViaServiceRole(
      "encontros",
      `id=eq.${IDS.encontroAvaliacao}`,
      { data_hora: passada2d, realizado_em: passada2d }
    );
  } else {
    // o insert dispara o trigger 0071 que minta o avaliacao_links da fixture
    await inserirViaServiceRole("encontros", {
      id: IDS.encontroAvaliacao,
      dupla_id: DUPLA_ID,
      numero: 16,
      data_hora: passada2d,
      realizado_em: passada2d,
      status: "realizado",
    });
  }

  // DEPOIS dos inserts: eles disparam o trigger (o "marcado" das fixtures,
  // creditado à coordenação) — o piso de sino tem que cobrir isso também
  await limparViaServiceRole(
    "notificacoes",
    `profile_id=in.(${IDS.mentorProfile},${IDS.jovemProfile})&tipo=in.(${TIPOS_AGENDA.join(",")})`
  );

  // o d2 é o ÚLTIMO encontro do cronograma — re-criá-lo dispara a 0102 e
  // a dupla acorda 'concluida' (a RPC de agenda recusa e o CTA some).
  // Devolve o piso de sempre: status ativa, sem encerramento nem sinos.
  await convergirDuplaAtiva(DUPLA_ID);
}

/** Agendado direto no banco — piso dos fluxos que não exercitam o agendar
 *  em si (remarcar, desmarcar, não aconteceu, guardas). `emDiasFuturo`
 *  negativo cria o "agendado que já passou" do botão Não aconteceu.
 *  A data é truncada no MINUTO: o datetime-local não carrega segundos e a
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

/** Login do jovem na home — ponto de partida fixo dos specs do /jovem. */
async function entrarComoJovem(page: Page) {
  await loginComSenha(page, JOVEM_EMAIL, SENHA);
  await page.waitForURL((u) => u.pathname === "/jovem", { timeout: 15_000 });
}

test.describe("mentorado — agenda livre (REALIZA-110)", () => {
  // o datetime-local é naïve e a action interpreta como -03:00 — browser
  // fora do fuso de SP (ex.: runner UTC) reescreveria o instante num
  // re-submit "sem mudar a data" e a RPC cobraria motivo à toa
  test.use({ timezoneId: "America/Sao_Paulo" });
  test.beforeEach(convergirPiso);
  test.afterEach(convergirPiso);

  test("agendar um encontro livre grava de verdade e avisa o mentor", async ({
    page,
  }) => {
    await entrarComoJovem(page);
    await page.goto("/jovem/agenda");

    await page.getByRole("button", { name: "Agendar encontro" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // o Select lista os nº livres (8 e 16 estão nas fixtures) — pro jovem o
    // hint de data oficial não chega (ciclo_eventos é RLS-vazio pra ele)
    await dialog.locator("#numero-select").click();
    await page.getByRole("option", { name: /^6º encontro/ }).click();

    await dialog.locator("#data_hora").fill(emDias(7));
    await dialog.locator("#link").fill("https://meet.google.com/e2e-agenda");
    await dialog
      .getByRole("button", { name: "Confirmar agendamento" })
      .click();

    await expect(page.getByText("6º encontro agendado.")).toBeVisible();
    await expect(dialog).not.toBeVisible();

    // a linha nova cai em Próximos — com o "Entrar" do link opcional
    const proximos = page.locator(
      'section[aria-labelledby="agenda-proximos"]'
    );
    const linha6 = linha(proximos, 6);
    await expect(linha6.getByText("Agendado")).toBeVisible();
    await expect(
      linha6.getByRole("link", { name: /Entrar/ })
    ).toBeVisible();

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
      /Jovem E2E marcou para \d{2}\/\d{2} às \d{2}:\d{2}\./
    );
    expect(notif?.href).toBe(`/duplas/${DUPLA_ID}`);
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
    await linha(proximos, 7)
      .getByRole("button", { name: "Remarcar" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.locator("#data_hora").fill(emDias(14));
    // a data mudou → o hint some e o motivo passa a ser exigido
    await expect(
      dialog.getByText("Só precisa se mudar a data.")
    ).toHaveCount(0);
    await dialog.locator("#motivo-select").click();
    await page.getByRole("option", { name: "Conflito de agenda" }).click();
    await dialog
      .getByRole("button", { name: "Confirmar remarcação" })
      .click();

    await expect(page.getByText("7º encontro remarcado.")).toBeVisible();
    await expect(dialog).not.toBeVisible();

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
      /Jovem E2E moveu para \d{2}\/\d{2} às \d{2}:\d{2}\./
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
    await linha(proximos, 9)
      .getByRole("button", { name: "Remarcar" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // data intacta → o hint fica e o motivo não é exigido
    await expect(
      dialog.getByText("Só precisa se mudar a data.")
    ).toBeVisible();
    await dialog.locator("#link").fill("https://meet.google.com/e2e-test");
    await dialog
      .getByRole("button", { name: "Confirmar remarcação" })
      .click();

    await expect(page.getByText("9º encontro remarcado.")).toBeVisible();
    await expect(dialog).not.toBeVisible();

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
      /Jovem E2E atualizou o link do encontro de \d{2}\/\d{2}\./
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
    await linha(proximos, 10)
      .getByRole("button", { name: "Desmarcar" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Desmarcar o encontro?" })
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Desmarcar" }).click();

    await expect(page.getByText("Encontro desmarcado.")).toBeVisible();
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
      /Jovem E2E desmarcou o encontro de \d{2}\/\d{2}\./
    );
  });

  test("agendado já passado vira 'não aconteceu' pela mão do jovem", async ({
    page,
  }) => {
    const enc = await criarAgendado(6, -1);
    await entrarComoJovem(page);
    await page.goto("/jovem/agenda");

    // agendado vencido cai no histórico — o botão é o "Não aconteceu"
    const historico = page.locator(
      'section[aria-labelledby="agenda-historico"]'
    );
    await linha(historico, 6)
      .getByRole("button", { name: "Não aconteceu" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "O encontro não aconteceu?" })
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: "Sim, não aconteceu" })
      .click();

    await expect(
      page.getByText("Encontro marcado como não realizado.")
    ).toBeVisible();
    // o botão some e vira badge no histórico
    await expect(
      linha(historico, 6).getByText("Não aconteceu", { exact: true })
    ).toBeVisible();

    const [row] = await buscarViaServiceRole<{ status: string }[]>(
      "encontros",
      `select=status&id=eq.${String(enc.id)}`
    );
    expect(row.status).toBe("nao_aconteceu");

    const [notif] = (await sinosDe(IDS.mentorProfile, "encontro_desfeito"))
      .filter((n) => n.titulo === "6º encontro não aconteceu");
    expect(notif?.corpo).toMatch(
      /Jovem E2E marcou que o encontro de \d{2}\/\d{2} não aconteceu\./
    );
  });

  test("agendado já passado vira realizado pelo 'Aconteceu' do jovem", async ({
    page,
  }) => {
    // 0121: qualquer ponta libera a jornada — o jovem confirma o encontro,
    // a avaliação dele nasce na hora e o mentor é lembrado de registrar
    const enc = await criarAgendado(7, -1);
    await entrarComoJovem(page);
    await page.goto("/jovem/agenda");

    const historico = page.locator(
      'section[aria-labelledby="agenda-historico"]'
    );
    await linha(historico, 7)
      .getByRole("button", { name: "Aconteceu", exact: true })
      .click();
    await expect(
      page.getByText("Encontro confirmado. Conta pra gente como foi.")
    ).toBeVisible({ timeout: 15_000 });

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
    ).filter((n) => /confirmou o 7º encontro$/.test(n.titulo));
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
    await page
      .getByRole("button", { name: /Agendar (encontro|próximo)/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // o nº é decidido pela home — lê do título pro assert do sino
    const titulo = await dialog
      .getByRole("heading", { name: /º encontro/ })
      .innerText();
    const numero = titulo.match(/(\d+)º/)?.[1];
    expect(numero).toBeTruthy();

    await dialog.locator("#data_hora").fill(emDias(6));
    await dialog
      .getByRole("button", { name: "Confirmar agendamento" })
      .click();
    // toast novo do dialog: "Agendamento confirmado: Nº encontro."
    await expect(
      page.getByText(/Agendamento confirmado: \d+º encontro\./i)
    ).toBeVisible();

    // o outro lado recebeu — o corpo credita o mentor e o href é do jovem
    const [notif] = (await sinosDe(IDS.jovemProfile, "encontro_marcado"))
      .filter((n) => n.titulo === `${numero}º encontro marcado`);
    expect(notif?.corpo).toMatch(/Mentor E2E marcou para/);
    expect(notif?.href).toBe("/jovem/agenda");

    // e o sino da /jovem mostra — relogado pra provar que não é estado local
    await page.context().clearCookies();
    await entrarComoJovem(page);
    await page.getByRole("button", { name: /^Notificações/ }).click();
    await expect(
      page.getByText(`${numero}º encontro marcado`)
    ).toBeVisible();
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
    await linha5
      .getByRole("button", { name: "Editar link da chamada" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Editar link da chamada" })
    ).toBeVisible();
    await dialog.locator("#link").fill("https://meet.google.com/e2e-jovem");
    await dialog.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Link atualizado.")).toBeVisible();
    await expect(dialog).not.toBeVisible();
    // o chip "Entrar" da linha aponta o link novo
    await expect(
      linha5.getByRole("link", { name: /Entrar/ })
    ).toHaveAttribute("href", "https://meet.google.com/e2e-jovem");

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
      /Jovem E2E atualizou o link do encontro de \d{2}\/\d{2}\./
    );
    expect(notif?.href).toBe(`/duplas/${DUPLA_ID}`);
  });

  test("agendado vencido também remarca — o limbo não é só 'não aconteceu'", async ({
    page,
  }) => {
    const enc = await criarAgendado(4, -2);
    await entrarComoJovem(page);
    await page.goto("/jovem/agenda");

    // agendado vencido cai no histórico — ao lado do "Não aconteceu" agora
    // mora o "Remarcar" (a RPC aceita fonte passada → alvo futuro)
    const historico = page.locator(
      'section[aria-labelledby="agenda-historico"]'
    );
    await linha(historico, 4)
      .getByRole("button", { name: "Remarcar" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "4º encontro" })
    ).toBeVisible();

    await dialog.locator("#data_hora").fill(emDias(9));
    // data mudou → o hint some e o motivo passa a ser exigido
    await expect(
      dialog.getByText("Só precisa se mudar a data.")
    ).toHaveCount(0);
    await dialog.locator("#motivo-select").click();
    await page.getByRole("option", { name: "Conflito de agenda" }).click();
    await dialog
      .getByRole("button", { name: "Confirmar remarcação" })
      .click();

    await expect(page.getByText("4º encontro remarcado.")).toBeVisible();
    await expect(dialog).not.toBeVisible();

    // a linha sai do limbo e migra do histórico pros Próximos
    const proximos = page.locator(
      'section[aria-labelledby="agenda-proximos"]'
    );
    await expect(linha(proximos, 4).getByText("Agendado")).toBeVisible();
    await expect(historico.getByText("4º encontro")).toHaveCount(0);

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
      /Jovem E2E moveu para \d{2}\/\d{2} às \d{2}:\d{2}\./
    );
    expect(notif?.corpo).toContain("Motivo: Conflito de agenda");
  });
});
