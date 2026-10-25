import type { Locator } from "@playwright/test";
import {
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  expect,
  inserirViaServiceRole,
  limparViaServiceRole,
  loginComSenha,
  test,
} from "../helpers";

// Agenda real do especialista (REALIZA-111 / migration 0073) contra backend
// real. Cobre a agenda do especialista (lista + resumo dos horários) e o
// editor de horários do perfil (#horarios: faixas semanais e exceções),
// e o lado do jovem na /jovem/agenda (seção "Mentoria especializada": slots
// chegam por PROJEÇÃO da RPC definer — nunca a grade crua; combinar é fora
// do app, via WhatsApp; e "Remarcar" não renderiza na trilha esp porque a
// RPC de agenda do jovem é DPP-only — desmarcar segue valendo).
//
// Fixtures do seed (scripts/seed-e2e-staging.mjs): profile+auth do
// especialista (esp-e2e@realiza.test), mentor_profiles tipo 'especialista',
// a trilha ativa …00e0 com a MESMA mentorada da dupla DPP e UMA janela de
// grade (terça 19:00–21:00, …00f0). O encontro agendado …00d3 é dado do
// SPEC — o convergirPiso garante ele de pé (e no futuro) antes de cada
// teste, o que cobre retry: um run morto na metade não deixa resíduo. O
// afterAll apaga: dado do spec morre com o spec, fixture do seed fica.
const ESP_EMAIL = process.env.E2E_ESP_EMAIL ?? "esp-e2e@realiza.test";
const JOVEM_EMAIL = process.env.E2E_JOVEM_EMAIL ?? "jovem-e2e@realiza.test";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";

const IDS = {
  espProfile: "e2e00000-0000-4000-8000-000000000060",
  jovemProfile: "e2e00000-0000-4000-8000-0000000000b0",
  duplaEsp: "e2e00000-0000-4000-8000-0000000000e0",
  gradeFixture: "e2e00000-0000-4000-8000-0000000000f0", // terça 19:00–21:00
  encontroEsp: "e2e00000-0000-4000-8000-0000000000d3", // agendado, 1º da trilha
  // a linha DPP do contraste ("Remarcar aparece na trilha comum") é a
  // fixture nº 8 do jovem — de outro spec, então o piso garante ela de pé
  duplaDpp: "e2e00000-0000-4000-8000-000000000030",
  encontroDpp: "e2e00000-0000-4000-8000-0000000000d1",
} as const;
const TIPOS_AGENDA = [
  "encontro_marcado",
  "encontro_alterado",
  "encontro_desfeito",
] as const;
const TZ = "America/Sao_Paulo"; // fuso do app e da RPC — datas/slots falam BRT

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

/** "YYYY-MM-DD" de hoje + `dias` no fuso de Brasília — o input date e as
 *  datas da RPC leem esse fuso (runner UTC não escorrega o dia). */
function diaBrt(dias: number): string {
  return new Date(Date.now() + dias * 86400e3).toLocaleDateString("en-CA", {
    timeZone: TZ,
  });
}

/** dow do Postgres (0=dom … 6=sáb) de uma data ISO — meio-dia UTC tira o
 *  getDay da borda de fuso. */
function dowDe(isoDate: string): number {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

/** 1ª data ≥ hoje (BRT) com o dow pedido cuja janela `hhmm` ainda rende
 *  slot — se "hoje" é o dia mas a hora já passou, pula pra semana seguinte. */
function proximaDataDow(dow: number, hhmm = "19:00"): string {
  for (let i = 0; i < 14; i++) {
    const iso = diaBrt(i);
    if (dowDe(iso) !== dow) continue;
    if (new Date(`${iso}T${hhmm}:00-03:00`).getTime() > Date.now()) return iso;
  }
  throw new Error(`nenhum dow ${dow} com janela futura nos próximos 14 dias`);
}

/** "dd/mm" do chip de slot ("terça 14/10 às 19:00") a partir de ISO date. */
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** O texto da data que a linha de encontro mostra ("20 de out. de 2026,
 *  19:00") — o mês abreviado varia, o resto é estável. Ancora pela data (e
 *  não pelo "Nº encontro") porque um spec paralelo pode ter encontro DPP
 *  com o mesmo nº na lista do jovem. */
const regexDataHora = (iso: string, hhmm: string) =>
  new RegExp(`${iso.slice(8, 10)} de \\S+ de ${iso.slice(0, 4)}, ${hhmm}`);

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

/** data_hora do encontro do spec: a 1ª terça com a janela de 19:00 ainda
 *  rendendo — sentada em cima da grade, "come" os slots 19:00/19:30 dela (é
 *  o que o teste do jovem usa pra provar a subtração na projeção). */
function dataEncontroEsp(): string {
  return `${proximaDataDow(2)}T19:00:00-03:00`;
}

/** Piso entre testes (e entre retries): a trilha esp com EXATAMENTE as
 *  fixtures — a janela de terça do seed + o encontro agendado do spec —
 *  mais nada. O que testes criam pela UI sai por exclusão de id (a action
 *  não devolve o id, então "o que não é fixture" é o critério estável). */
async function convergirPiso() {
  // encontros fora do fixture do spec — leftovers de runs mortos
  const restos = await buscarViaServiceRole<{ id: string }[]>(
    "encontros",
    `select=id&dupla_id=eq.${IDS.duplaEsp}&id=not.eq.${IDS.encontroEsp}`
  );
  await apagarEncontros(restos.map((r) => r.id));

  const [enc] = await buscarViaServiceRole<{ id: string; status: string }[]>(
    "encontros",
    `select=id,status&id=eq.${IDS.encontroEsp}`
  );
  const quando = dataEncontroEsp();
  if (enc?.status === "agendado") {
    // agendado→agendado não esbarra no guard 0043 (o WHEN só olha status)
    await atualizarViaServiceRole("encontros", `id=eq.${IDS.encontroEsp}`, {
      data_hora: quando,
    });
  } else {
    // realizado/nao_aconteceu é imutável (0043) — sai de cena e volta criado
    if (enc) await apagarEncontros([enc.id]);
    await inserirViaServiceRole("encontros", {
      id: IDS.encontroEsp,
      dupla_id: IDS.duplaEsp,
      numero: 1,
      data_hora: quando,
      status: "agendado",
      created_by: IDS.espProfile,
    });
  }

  // grade do esp: qualquer janela além da fixture morre (é o que o spec
  // adicionou pela UI); a fixture de terça é recriada se um run morto a
  // removeu — sem ela não há slot pra projetar
  await limparViaServiceRole(
    "especialista_grade",
    `profile_id=eq.${IDS.espProfile}&id=not.eq.${IDS.gradeFixture}`
  );
  const [janela] = await buscarViaServiceRole<{ id: string }[]>(
    "especialista_grade",
    `select=id&id=eq.${IDS.gradeFixture}`
  );
  if (!janela) {
    await inserirViaServiceRole("especialista_grade", {
      id: IDS.gradeFixture,
      profile_id: IDS.espProfile,
      dia_semana: 2,
      hora_inicio: "19:00",
      hora_fim: "21:00",
    });
  }
  // exceção não é fixture: todas morrem — um bloqueio extra de run morto
  // esvaziaria a projeção e faria o teste do jovem falhar
  await limparViaServiceRole(
    "especialista_excecoes",
    `profile_id=eq.${IDS.espProfile}`
  );

  // o contraste do teste do jovem precisa do agendado DPP nº 8 — fixture do
  // jovem-agenda, mas este arquivo roda ANTES dele na ordem alfabética e o
  // cleanup do mentor varre a dupla inteira (run anterior pode ter levado).
  // Reconverge no mesmo molde (id fixo, nº 8, agendado ~+3d).
  const [dpp] = await buscarViaServiceRole<{ id: string; status: string }[]>(
    "encontros",
    `select=id,status&id=eq.${IDS.encontroDpp}`
  );
  const futura3d = new Date(Date.now() + 3 * 86400e3).toISOString();
  if (dpp?.status === "agendado") {
    await atualizarViaServiceRole("encontros", `id=eq.${IDS.encontroDpp}`, {
      data_hora: futura3d,
    });
  } else {
    // realizado/nao_aconteceu é imutável (0043) — sai de cena e volta criado
    if (dpp) await apagarEncontros([dpp.id]);
    await inserirViaServiceRole("encontros", {
      id: IDS.encontroDpp,
      dupla_id: IDS.duplaDpp,
      numero: 8,
      data_hora: futura3d,
      status: "agendado",
    });
  }

  // DEPOIS dos writes: o trigger encontros_agenda_notify minta sinos de
  // agenda pros dois lados (ator=service role → "A coordenação…") — zera
  // aqui pra cada teste começar com o sino limpo
  await limparViaServiceRole(
    "notificacoes",
    `profile_id=in.(${IDS.espProfile},${IDS.jovemProfile})&tipo=in.(${TIPOS_AGENDA.join(",")})`
  );
}

/** Gira a roda de hora (`n`-ésimo seletor da seção: 0 = toda semana,
 *  1 = exceção) até `h` — Home zera, cada ↓ sobe uma hora. */
async function roda(sec: Locator, n: number, qual: "Início" | "Fim", h: number) {
  const hora = sec.getByRole("spinbutton", { name: `${qual}: hora` }).nth(n);
  await hora.press("Home");
  for (let i = 0; i < h; i++) await hora.press("ArrowDown");
  await expect(hora).toHaveAttribute("aria-valuetext", `${h} horas`);
}
const datas = (sec: Locator) => sec.getByRole("radiogroup", { name: "Data" });
const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** nome acessível do dia na faixa de datas: "qua, 29 de out". */
function rotuloData(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DOW[d.getUTCDay()]}, ${d.getUTCDate()} de ${MES[d.getUTCMonth()]}`;
}

test.describe("mentor especialista — agenda (REALIZA-111)", () => {
  test.beforeEach(convergirPiso);
  test.afterEach(convergirPiso);

  test.afterAll(async () => {
    // o encontro agendado é dado do spec — morre com o arquivo (a dupla e a
    // janela de terça são do seed e ficam)
    const encs = await buscarViaServiceRole<{ id: string }[]>(
      "encontros",
      `select=id&dupla_id=eq.${IDS.duplaEsp}`
    );
    await apagarEncontros(encs.map((r) => r.id));
    await limparViaServiceRole(
      "especialista_grade",
      `profile_id=eq.${IDS.espProfile}&id=not.eq.${IDS.gradeFixture}`
    );
    await limparViaServiceRole(
      "especialista_excecoes",
      `profile_id=eq.${IDS.espProfile}`
    );
    await limparViaServiceRole(
      "notificacoes",
      `profile_id=in.(${IDS.espProfile},${IDS.jovemProfile})&tipo=in.(${TIPOS_AGENDA.join(",")})`
    );
  });

  test("especialista edita horários no perfil e a agenda resume em frase", async ({
    page,
  }) => {
    // a terça a bloquear é a SEGUINTE à próxima — a próxima tem o encontro
    // do piso, que o teste do jovem usa pra provar a subtração
    const tercaEncontro = proximaDataDow(2);
    const dataBloqueio = new Date(`${tercaEncontro}T12:00:00Z`);
    dataBloqueio.setUTCDate(dataBloqueio.getUTCDate() + 7);
    const isoBloqueio = dataBloqueio.toISOString().slice(0, 10);
    const dataExtra = diaBrt(1); // amanhã, fora de qualquer faixa da grade

    await loginComSenha(page, ESP_EMAIL, SENHA);
    await page.goto("/agenda");

    // REALIZA-207: a agenda é lista (próximas sessões + card da trilha) e o
    // resumo dos horários em frase, com a edição no perfil
    await expect(
      page
        .locator('section[aria-label="Próximas sessões"]')
        .getByText(/Mentorada/)
        .first()
    ).toBeVisible();
    await expect(
      page
        .locator('section[aria-label="Suas trilhas"]')
        .locator(`a[href^="/duplas/${IDS.duplaEsp}"]`)
    ).toBeVisible();
    const atende = page.locator('section[aria-label="Quando você atende"]');
    await expect(atende).toContainText("Terças 19h–21h");
    await atende.getByRole("link", { name: "Editar no perfil" }).click();
    await expect(page).toHaveURL(/\/perfil#horarios$/);

    const sec = page.locator("#horarios");
    await expect(sec.getByText("Terças 19h–21h")).toBeVisible();

    // ---- adiciona faixa: quarta 19:00–21:00 (dia novo, não pisa na fixture)
    // REALIZA-212: dia é botão, horário é roda (spinbutton no teclado)
    await sec.getByRole("button", { name: "Quarta" }).click();
    await roda(sec, 0, "Início", 19);
    await roda(sec, 0, "Fim", 21);
    await sec.getByRole("button", { name: "Adicionar" }).first().click();
    // pós-write: server action + refresh (convenção da suite: 15s)
    await expect(sec.getByText("Quartas 19h–21h")).toBeVisible({
      timeout: 15_000,
    });

    const janelas = await buscarViaServiceRole<
      { id: string; hora_inicio: string; hora_fim: string }[]
    >(
      "especialista_grade",
      `select=id,hora_inicio,hora_fim&profile_id=eq.${IDS.espProfile}&dia_semana=eq.3`
    );
    expect(janelas).toHaveLength(1);
    expect(janelas[0].hora_inicio).toBe("19:00:00");
    expect(janelas[0].hora_fim).toBe("21:00:00");

    // ---- horário a mais, datado: amanhã 14–16
    await sec.getByText("Posso a mais", { exact: true }).click();
    await datas(sec).getByRole("radio", { name: rotuloData(dataExtra) }).click();
    await roda(sec, 1, "Início", 14);
    await roda(sec, 1, "Fim", 16);
    await sec.getByRole("button", { name: "Adicionar" }).last().click();
    await expect(
      sec.getByText(`Atende também em ${ddmm(dataExtra)}, 14h–16h`)
    ).toBeVisible({ timeout: 15_000 });

    // ---- bloqueio: a terça da semana seguinte, na faixa inteira
    await sec.getByText("Não posso", { exact: true }).click();
    await datas(sec).getByRole("radio", { name: rotuloData(isoBloqueio) }).click();
    await roda(sec, 1, "Início", 19);
    await roda(sec, 1, "Fim", 21);
    await sec.getByRole("button", { name: "Adicionar" }).last().click();
    await expect(
      sec.getByText(`Não atende em ${ddmm(isoBloqueio)}, 19h–21h`)
    ).toBeVisible({ timeout: 15_000 });

    const excs = await buscarViaServiceRole<{ data: string; tipo: string }[]>(
      "especialista_excecoes",
      `select=data,tipo&profile_id=eq.${IDS.espProfile}&order=data`
    );
    expect(excs).toEqual([
      { data: dataExtra, tipo: "extra" },
      { data: isoBloqueio, tipo: "bloqueio" },
    ]);

    // ---- remove a faixa criada pela UI; a fixture de terça fica intacta
    await sec.getByRole("button", { name: "Remover quartas 19h–21h" }).click();
    await expect(sec.getByText("Quartas 19h–21h")).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(sec.getByText("Terças 19h–21h")).toBeVisible();
    const janelasDepois = await buscarViaServiceRole<{ id: string }[]>(
      "especialista_grade",
      `select=id&profile_id=eq.${IDS.espProfile}&dia_semana=eq.3`
    );
    expect(janelasDepois).toHaveLength(0);
  });

  test("jovem lê os slots do especialista e não remarca a trilha", async ({
    page,
  }) => {
    // o encontro do piso está na 1ª terça com slot — comeu 19:00 e 19:30 dela
    const dataEnc = proximaDataDow(2);

    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.waitForURL((u) => u.pathname === "/jovem", {
      timeout: 15_000,
    });
    await page.goto("/jovem/agenda");

    // seção "Mentoria especializada": a projeção de slots, nunca a grade crua
    const esp = page.locator('section[aria-labelledby="agenda-esp"]');
    await expect(
      esp.getByText("Horários de Esp", { exact: true })
    ).toBeVisible();
    await expect(
      esp.getByText(/Sessões de 1h · escolhe um horário/)
    ).toBeVisible();
    await expect(
      esp.getByText(/terça \d{2}\/\d{2} às 20:00/).first()
    ).toBeVisible();

    // o agendado da trilha subtrai o horário da oferta — 19:00/19:30 daquela
    // terça não aparecem pro jovem; 20:00 (fora do encontro de 1h) continua
    await expect(
      esp.getByText(new RegExp(`terça ${ddmm(dataEnc)} às (19:00|19:30)`))
    ).toHaveCount(0);

    // combinar é fora do app — o botão abre o wa.me do especialista
    const wa = esp.getByRole("link", { name: "Chamar Esp E2E no WhatsApp" });
    await expect(wa).toHaveAttribute("href", /wa\.me\/5511999000070/);

    // o agendado da trilha esp aparece em Próximos SEM "Remarcar" — a RPC de
    // agenda do jovem é DPP-only; desmarcar segue valendo em qualquer trilha.
    // Ancora pela data (única por construção), não pelo nº — encontros DPP
    // paralelos podem dividir o mesmo número.
    const proximos = page.locator(
      'section[aria-labelledby="agenda-proximos"]'
    );
    const linhaEsp = proximos
      .getByText(regexDataHora(dataEnc, "19:00"))
      .locator("xpath=../..");
    await expect(linhaEsp.getByText("Agendado")).toBeVisible();
    await expect(
      linhaEsp.getByRole("button", { name: "Remarcar" })
    ).toHaveCount(0);
    await expect(
      linhaEsp.getByRole("button", { name: "Desmarcar" })
    ).toBeVisible();

    // contraste: a linha DPP na mesma lista segue com o gesto
    const linhaDpp = proximos
      .getByText("8º encontro", { exact: true })
      .locator("xpath=../..");
    await expect(
      linhaDpp.getByRole("button", { name: "Remarcar" })
    ).toBeVisible();
  });
});
