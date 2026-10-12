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
// real. Cobre o card "Sua agenda" do /agenda (grade semanal, exceções
// datadas e a projeção "Próximos horários livres" que acompanha cada edição)
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

  test("especialista edita grade e exceções e a projeção acompanha", async ({
    page,
  }) => {
    // a terça a bloquear é a SEGUINTE à do encontro agendado — o encontro já
    // comeu os slots 19:00/19:30 da terça mais próxima
    const tercaEncontro = proximaDataDow(2);
    const dataBloqueio = new Date(`${tercaEncontro}T12:00:00Z`);
    dataBloqueio.setUTCDate(dataBloqueio.getUTCDate() + 7);
    const isoBloqueio = dataBloqueio.toISOString().slice(0, 10);
    const dataExtra = diaBrt(1); // amanhã — fora de qualquer janela da grade

    await loginComSenha(page, ESP_EMAIL, SENHA);
    await page.goto("/agenda");

    // card do editor + a fila real da dupla ao lado (mesma mentorada da DPP)
    await expect(
      page.getByText("Sua agenda", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("Mentorada E2E", { exact: true })
    ).toBeVisible();
    // o agendado da trilha já aparece na fila de "Próximos" do especialista —
    // a linha é link com a data e o passo ("1º encontro, agendado para … ·
    // próximo passo"), então ancora pelo nome parcial, não pelo texto exato
    await expect(
      page.getByRole("link", { name: /1º encontro/ })
    ).toBeVisible();

    const grade = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Toda semana" }) });
    const excecoes = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Dias específicos" }) });
    const livres = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", { name: "Próximos horários livres" }),
      });

    // a janela da fixture (terça 19–21) já projeta slots
    const linhaTerca = grade.locator("li", { hasText: "Terça" });
    await expect(linhaTerca.getByText("19:00–21:00")).toBeVisible();
    await expect(
      livres.getByText(/terça \d{2}\/\d{2} às 19:00/).first()
    ).toBeVisible();

    // ---- adiciona janela: quarta 19:00–21:00 (dia novo, não pisa na fixture)
    await grade.getByLabel("Dia da semana").click();
    await page.getByRole("option", { name: "Quarta" }).click();
    await grade.getByLabel("Início da janela").fill("19:00");
    await grade.getByLabel("Fim da janela").fill("21:00");
    await grade.getByRole("button", { name: "Adicionar" }).click();

    const linhaQuarta = grade.locator("li", { hasText: "Quarta" });
    await expect(linhaQuarta.getByText("19:00–21:00")).toBeVisible();
    await expect(
      livres.getByText(/quarta \d{2}\/\d{2} às 19:00/).first()
    ).toBeVisible();

    // write real: a janela de quarta existe no banco (com as horas certas)
    const janelas = await buscarViaServiceRole<
      { id: string; hora_inicio: string; hora_fim: string }[]
    >(
      "especialista_grade",
      `select=id,hora_inicio,hora_fim&profile_id=eq.${IDS.espProfile}&dia_semana=eq.3`
    );
    expect(janelas).toHaveLength(1);
    expect(janelas[0].hora_inicio).toBe("19:00:00");
    expect(janelas[0].hora_fim).toBe("21:00:00");

    // ---- horário extra datado: amanhã, fora da grade — vira slot no dia
    await excecoes.getByLabel("Tipo da exceção").click();
    await page.getByRole("option", { name: "Horário extra" }).click();
    await excecoes.getByLabel("Data da exceção").fill(dataExtra);
    await excecoes.getByLabel("Início da exceção").fill("14:00");
    await excecoes.getByLabel("Fim da exceção").fill("16:00");
    await excecoes.getByRole("button", { name: "Adicionar" }).click();

    const linhaExtra = excecoes.locator("li", { hasText: "14:00–16:00" });
    await expect(linhaExtra.getByText("Extra", { exact: true })).toBeVisible();
    // o extra projeta chips no dia — "dd/mm às 14:00" no dia de amanhã
    await expect(
      livres.getByText(new RegExp(`${ddmm(dataExtra)} às 14:00`))
    ).toBeVisible();

    // ---- bloqueio datado: a terça da semana seguinte sai inteira da projeção
    await expect(
      livres
        .getByText(new RegExp(`terça ${ddmm(isoBloqueio)} às`))
        .first()
    ).toBeVisible();
    await excecoes.getByLabel("Tipo da exceção").click();
    await page.getByRole("option", { name: "Bloquear um dia" }).click();
    await excecoes.getByLabel("Data da exceção").fill(isoBloqueio);
    await excecoes.getByLabel("Início da exceção").fill("00:00");
    await excecoes.getByLabel("Fim da exceção").fill("23:59");
    await excecoes.getByRole("button", { name: "Adicionar" }).click();

    const linhaBloqueio = excecoes.locator("li", { hasText: "00:00–23:59" });
    await expect(
      linhaBloqueio.getByText("Bloqueio", { exact: true })
    ).toBeVisible();
    // o dia bloqueado some da projeção; as demais terças seguem com slots
    await expect(
      livres.getByText(new RegExp(`terça ${ddmm(isoBloqueio)} às`))
    ).toHaveCount(0);
    await expect(
      livres.getByText(/terça \d{2}\/\d{2} às/).first()
    ).toBeVisible();

    // ---- remove a janela criada pela UI — a fixture de terça fica intacta
    await linhaQuarta
      .getByRole("button", { name: "Remover janela de Quarta das 19:00" })
      .click();
    await expect(linhaQuarta.getByText("19:00–21:00")).toHaveCount(0);
    await expect(
      livres.getByText(/quarta \d{2}\/\d{2} às 19:00/)
    ).toHaveCount(0);
    await expect(linhaTerca.getByText("19:00–21:00")).toBeVisible();
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
