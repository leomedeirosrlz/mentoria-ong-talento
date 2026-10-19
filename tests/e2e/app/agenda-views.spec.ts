import type { Locator, Page } from "@playwright/test";
import {
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  expect,
  inserirViaServiceRole,
  limparViaServiceRole,
  loginComSenha,
  relogar,
  test,
} from "../helpers";

// REALIZA-25 — as visões novas da agenda do mentor: "Semana" (grade compacta
// seg–dom com tinta de disponibilidade por dia + detalhe) e "Horários" (grade
// horária estilo calendário com tinta por hora, clique-no-vazio que agenda e
// blocos que são links pra ficha). Coord/sup segue Semana/Mês/Lista.
//
// Fixture (scripts/seed-e2e-staging.mjs): mentor E2E com grade
// {ter,qui,sab}/{noite} × mentorada da dupla …0030 com {ter,qui}/{noite} —
// ter/qui pintam "ambos" (diagonal), sáb "você livre". JANELA_PERIODO noite =
// 18–22h → a tinta horária cobre 18–21h. Piso de encontros da dupla = o das
// fixtures: d1 (nº 8, agendado futuro) e d2 (nº 16, realizado) — o mesmo
// protocolo de convergência do jovem-agenda.spec.
const EMAIL = process.env.E2E_MENTOR_EMAIL ?? "";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const COORD_SENHA = process.env.E2E_COORD_PASSWORD ?? "";
const DUPLA_ID =
  process.env.E2E_DUPLA_ID ?? "e2e00000-0000-4000-8000-000000000030";

const IDS = {
  mentorProfile: "e2e00000-0000-4000-8000-000000000010",
  jovemProfile: "e2e00000-0000-4000-8000-0000000000b0",
  encontroFixture: "e2e00000-0000-4000-8000-0000000000d1", // nº 8, agendado
  encontroAvaliacao: "e2e00000-0000-4000-8000-0000000000d2", // nº 16, realizado
} as const;
const FIXTURES = [IDS.encontroFixture, IDS.encontroAvaliacao];
const TIPOS_AGENDA = "encontro_marcado,encontro_alterado,encontro_desfeito";

const TZ = "America/Sao_Paulo";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

// ---------- datas: mesmas convenções do componente (TZ de São Paulo) ----------

const pad = (n: number) => String(n).padStart(2, "0");
const paraISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const fmtCompleta = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TZ,
});
/** fmtCompleta de um "YYYY-MM-DD" — o -03:00 fixo ancora no meio-dia de SP
 *  (o fuso do runner não desloca o dia). */
const completaDe = (iso: string) =>
  fmtCompleta.format(new Date(`${iso}T12:00:00-03:00`));

/** "YYYY-MM-DD" de hoje no fuso do programa — o `hoje` que a page computa. */
function hojeSP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

/** seg..dom (7 × "YYYY-MM-DD") da semana `offsetSemanas` a partir da que
 *  contém hoje — a mesma régua do semanaBounds (segunda abre a semana). */
function diasDaSemana(offsetSemanas = 0): string[] {
  const base = new Date(`${hojeSP()}T12:00:00`);
  const dow = (base.getDay() + 6) % 7; // seg=0 … dom=6
  const seg = new Date(base);
  seg.setDate(base.getDate() - dow + offsetSemanas * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(seg);
    d.setDate(seg.getDate() + i);
    return paraISO(d);
  });
}

// ---------- piso de encontros da dupla (protocolo do jovem-agenda.spec) ------

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
 *  testes saem (o filtro é por exclusão — cobre ids desconhecidos), d1/d2
 *  são re-criadas/re-carimbadas e os sinos de agenda zeram depois dos
 *  inserts (o dedup do trigger suprime corpo repetido não-lido). */
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

  // DEPOIS dos inserts: eles disparam o trigger (o "marcado" das fixtures) —
  // o piso de sino dos dois lados tem que cobrir isso também
  await limparViaServiceRole(
    "notificacoes",
    `profile_id=in.(${IDS.mentorProfile},${IDS.jovemProfile})&tipo=in.(${TIPOS_AGENDA})`
  );
}

// ---------- helpers de UI ----------

/** O input radio das visões é sr-only — o clique honesto é no label pai
 *  (mesmo padrão do loginComSenha). */
function chipVisao(page: Page, valor: string) {
  return page.locator("label", {
    has: page.locator(`input[name="agenda-visao"][value="${valor}"]`),
  });
}

/** Troca pra uma visão do mentor e espera a transição de grade assentar —
 *  o slide `animate-enter-x` move as colunas por ~300ms e um clique por
 *  coordenada na janela errada cai no slot errado. */
async function abrirVisao(page: Page, valor: "semana" | "horarios") {
  await chipVisao(page, valor).click();
  await page.waitForTimeout(450);
}

/** Coluna de um dia na grade de horários — o <button> "Agendar encontro na
 *  {dia completo}" que cobre o dia inteiro. */
function colunaHorarios(page: Page, iso: string): Locator {
  return page.getByRole("button", {
    name: `Agendar encontro na ${completaDe(iso)}`,
  });
}

/** O grid horário — seletor pelo template de colunas (o rail de encontros e
 *  a grade compacta também são .scroll-fina; esse minmax é só da de horas).
 *  Dentro dele, a tinta "ambos" assina com `linear-gradient(135deg` — a trama
 *  de linhas usa `repeating-linear-gradient` e não pode colar no filtro. */
const gradeHorarios = (page: Page) =>
  page.locator("div[class*='grid-cols-[2.5rem']");

test.describe("agenda do mentor — visões Semana e Horários (REALIZA-25)", () => {
  // encontros da dupla sobem/descem com -03:00 explícito — browser em outro
  // fuso não desloca o dia do bloco
  test.use({ timezoneId: "America/Sao_Paulo" });
  test.beforeEach(async ({ page }) => {
    await convergirPiso();
    await loginComSenha(page, EMAIL, SENHA);
  });
  test.afterEach(convergirPiso);

  test("visão Semana: 7 colunas, tinta por dia e detalhe ao clicar", async ({
    page,
  }) => {
    // WP3: o default do mentor virou "Minha agenda" — as visões do
    // calendário (mes/semana/horários) vivem na aba ?aba=calendario
    await page.goto("/agenda?aba=calendario");

    // os três chips do mentor — mês/semana/horários (a lista é da coord)
    for (const v of ["mes", "semana", "horarios"])
      await expect(
        page.locator(`input[name="agenda-visao"][value="${v}"]`)
      ).toBeAttached();
    await expect(
      page.locator('input[name="agenda-visao"][value="lista"]')
    ).toHaveCount(0);

    await abrirVisao(page, "semana");

    const grade = page.locator('div[role="grid"]');
    await expect(grade.getByRole("gridcell")).toHaveCount(7);

    // a semana exibida é a de hoje — seg..dom calculados na mesma régua
    const dias = diasDaSemana();
    for (const iso of [dias[0], dias[6]])
      await expect(
        page.getByRole("button", { name: new RegExp(completaDe(iso)) })
      ).toBeVisible();

    // tinta por dia: ter/qui cruzam mentor+jovem à noite ("ambos livres",
    // gradiente diagonal); sáb é só do mentor ("você livre")
    await expect(
      page.getByRole("button", { name: /, ambos livres$/ })
    ).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: /, você livre$/ })
    ).toHaveCount(1);
    await expect(
      grade.locator(
        'div[role="gridcell"] > span[style*="linear-gradient(135deg"]'
      )
    ).toHaveCount(2);

    // clicar na quinta seleciona o dia — o detalhe mostra "quinta · 15 · outubro"
    const qui = dias[3];
    const mesLongo = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      timeZone: TZ,
    }).format(new Date(`${qui}T12:00:00-03:00`));
    await page
      .getByRole("button", { name: new RegExp(`^${completaDe(qui)}`) })
      .click();
    const detalhe = page.locator(
      'section[aria-label="Detalhe do dia selecionado"]'
    );
    await expect(detalhe).toContainText("quinta");
    await expect(
      detalhe.getByText(String(Number(qui.slice(8))), { exact: true })
    ).toBeVisible();
    await expect(detalhe).toContainText(mesLongo);
    await page.screenshot({ path: "/tmp/realiza25-semana-mentor.png" });
  });

  test("visão Horários: grade de horas, tinta por faixa e evento no topo", async ({
    page,
  }) => {
    await page.goto("/agenda?aba=calendario");
    await abrirVisao(page, "horarios");

    // régua de horas no gutter — a janela cobre a noite inteira
    const grade = gradeHorarios(page);
    await expect(grade.getByText("19h", { exact: true })).toBeVisible();
    await expect(grade.getByText("20h", { exact: true })).toBeVisible();

    // tinta por hora (JANELA_PERIODO noite = 18–22h): ter e qui pintam o
    // split "ambos" 18–21h (4 faixas × 2 dias); sáb é mentor-only. O filtro
    // de gradiente exige a assinatura 135deg — a trama das linhas de hora é
    // repeating-linear-gradient e casaria num contains largo.
    await expect(
      grade.locator('span[style*="linear-gradient(135deg"]')
    ).toHaveCount(8);
    await expect(
      grade.locator('span[class*="bg-[var(--ok)]/8"]')
    ).toHaveCount(4);

    // evento oficial da semana (sempre há um no ciclo vigente) vira marcador
    // fino na faixa de topo — nunca um bloco na grade
    await expect(
      grade.getByText("encontro", { exact: true }).first()
    ).toBeVisible();

    // cada coluna é a superfície de agendamento — o aria-label diz o dia
    const dias = diasDaSemana();
    await expect(colunaHorarios(page, dias[3])).toBeVisible();
    await page.screenshot({
      path: "/tmp/realiza25-horarios-mentor.png",
      fullPage: true,
    });
  });

  test("clique no slot vazio agenda com a hora certa e o bloco se posiciona", async ({
    page,
  }) => {
    // modo "agendar" (não remarcar) exige o alvo sem row: com a d1 (nº 8
    // agendado) presente, proximoNumero=8 e a grade abriria o dialog de
    // remarcação com a data ATUAL — sem o d1, proximoNumero=1 e o slot
    // clicado entra como sugestão. A fixture volta no afterEach.
    await apagarEncontros([IDS.encontroFixture]);

    await page.goto("/agenda?aba=calendario");
    await abrirVisao(page, "horarios");

    // a próxima semana é toda futura — clicar num dia passado cairia no
    // fluxo retroativo ("Registrar encontro"), não no agendamento
    await page.getByRole("button", { name: "Próxima semana" }).click();
    const qua = diasDaSemana(1)[2];
    const coluna = colunaHorarios(page, qua);
    await expect(coluna).toBeVisible();

    // clique ~19h: a régua começa 8h com 48px/hora — 11/14 da altura
    // (a janela é 8–22h quando a semana não tem blocos). Snap é de 30min.
    const box = await coluna.boundingBox();
    if (!box) throw new Error("coluna sem bounding box");
    await coluna.click({
      position: { x: box.width / 2, y: box.height * (11 / 14) },
    });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "1º encontro" })
    ).toBeVisible();
    // o slot clicado preenche o datetime-local — dia da coluna + a hora do Y
    const campo = dialog.locator("#data_hora");
    await expect(campo).toHaveValue(new RegExp(`^${qua}T19:(00|30)$`));
    const valor = await campo.inputValue();
    await page.screenshot({ path: "/tmp/realiza25-dialog-slot.png" });

    await dialog
      .getByRole("button", { name: "Confirmar agendamento" })
      .click();
    await expect(
      page.getByText(/Agendamento confirmado — 1º encontro\./)
    ).toBeVisible();
    await expect(dialog).not.toBeVisible();

    // o bloco nasce na grade — link pra ficha posicionado na hora agendada
    const bloco = page.getByRole("link", { name: /1º encontro/ });
    await expect(bloco).toBeVisible();
    const partes = valor.match(/T(\d{2}):(\d{2})$/)!;
    const minutos = Number(partes[1]) * 60 + Number(partes[2]);
    // horaIni=8 (a semana seguinte não tem outros blocos) → top = (min-480)/60*48
    const topEsperado = ((minutos - 8 * 60) / 60) * 48;
    await expect(bloco).toHaveAttribute(
      "style",
      new RegExp(`top: ${topEsperado}px`)
    );
    await expect(bloco).toHaveAttribute("href", `/duplas/${DUPLA_ID}`);
    await page.screenshot({
      path: "/tmp/realiza25-bloco-posicionado.png",
      fullPage: true,
    });

    // write real: a row existe na dupla com o instante do slot (-03:00)
    const [row] = await buscarViaServiceRole<
      { status: string; data_hora: string }[]
    >(
      "encontros",
      `select=status,data_hora&dupla_id=eq.${DUPLA_ID}&numero=eq.1`
    );
    expect(row.status).toBe("agendado");
    expect(new Date(row.data_hora).getTime()).toBe(
      new Date(`${valor}-03:00`).getTime()
    );
  });

  test("bloco de encontro é link pra ficha — nunca abre o agendamento", async ({
    page,
  }) => {
    // bloco em horário conhecido: sábado da semana corrente às 20h (a
    // fixture d1 viaja com o relógio do seed — o spec ancora no próprio)
    const sab = diasDaSemana()[5];
    await inserirViaServiceRole("encontros", {
      dupla_id: DUPLA_ID,
      numero: 9,
      data_hora: `${sab}T20:00:00-03:00`,
      status: "agendado",
      created_by: IDS.mentorProfile,
    });

    await page.goto("/agenda?aba=calendario");
    await abrirVisao(page, "horarios");

    const bloco = page.getByRole("link", { name: /9º encontro/ });
    await expect(bloco).toBeVisible();
    // agendado futuro → ficha; em limbo (sáb já passado) → #registrar-<id>
    const href = await bloco.getAttribute("href");
    expect(href).toMatch(new RegExp(`^/duplas/${DUPLA_ID}`));

    await bloco.click();
    await page.waitForURL((u) => u.pathname === `/duplas/${DUPLA_ID}`);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("prev/next de semana navega nas duas visões novas", async ({ page }) => {
    await page.goto("/agenda?aba=calendario");
    const rotulo = page.locator("#agenda-mes-rotulo");

    for (const visao of ["semana", "horarios"] as const) {
      await abrirVisao(page, visao);
      const inicial = await rotulo.innerText();
      // "12–18 jan 2026" no mesmo mês, "26 out–1 nov 2026" cruzando o mês —
      // o label pinta o mês nas duas pontas quando a semana vira
      expect(inicial).toMatch(/\d+( \w+)?–\d+ \w+ \d{4}/);

      await page.getByRole("button", { name: "Próxima semana" }).click();
      await expect(rotulo).not.toHaveText(inicial);
      const seguinte = await rotulo.innerText();
      expect(seguinte).toMatch(/\d+( \w+)?–\d+ \w+ \d{4}/);

      await page.getByRole("button", { name: "Semana anterior" }).click();
      await expect(rotulo).toHaveText(inicial);
    }
  });

  test("coordenação não tem a visão de horários nem a superfície de agendar", async ({
    page,
  }) => {
    await relogar(page, COORD_EMAIL, COORD_SENHA);
    await page.goto("/agenda?aba=calendario");

    // chips da coord: Semana/Mês/Lista — "Horários" é só do mentor
    for (const v of ["semana", "mes", "lista"])
      await expect(
        page.locator(`input[name="agenda-visao"][value="${v}"]`)
      ).toBeAttached();
    await expect(
      page.locator('input[name="agenda-visao"][value="horarios"]')
    ).toHaveCount(0);

    // board da semana da coord — nenhuma coluna clicável de agendamento
    await expect(
      page.getByRole("button", { name: /^Agendar encontro na / })
    ).toHaveCount(0);

    // nem trocando pra visão de mês
    await chipVisao(page, "mes").click();
    await expect(page.locator('div[role="grid"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Agendar encontro na / })
    ).toHaveCount(0);
  });
});
