import {
  agirComConfirma,
  appEnvOk,
  buscarViaServiceRole,
  convergirDuplaAtiva,
  expect,
  inserirViaServiceRole,
  limparEncontrosDaDupla,
  loginComSenha,
  relogar,
  test,
} from "../helpers";

// Rota dedicada de registro (REALIZA-473) contra backend real: home → rota
// em UMA navegação, salvar com evidências e concluir na ficha, encadear no
// próximo encontro, deep link antigo (#registrar-) ainda salvando, guardas
// de papel/estado e o colapso dos blocos do mentor e do jovem.
//
// Fixtures do scripts/seed-e2e-staging.mjs. A dupla é a mesma dos demais
// specs app: cada teste limpa o que criou (encontros + filhos da 0071) e
// devolve a dupla ao estado ativo no afterEach e no beforeEach.
const EMAIL = process.env.E2E_MENTOR_EMAIL ?? "";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const COORD_SENHA = process.env.E2E_COORD_PASSWORD || SENHA;
const DUPLA_ID =
  process.env.E2E_DUPLA_ID ?? "e2e00000-0000-4000-8000-000000000030";

const IDS = {
  mentorProfile: "e2e00000-0000-4000-8000-000000000010",
  jovemProfile: "e2e00000-0000-4000-8000-0000000000b0",
} as const;

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

/** Encontro direto no banco na dupla fixture. `dias` negativo = passado. */
async function criarEncontro(
  numero: number,
  {
    status = "realizado",
    dias = -2,
    hora = "19:00",
  }: { status?: "realizado" | "agendado" | "remarcado"; dias?: number; hora?: string } = {}
) {
  const dia = new Date(Date.now() + dias * 86400e3);
  const [hh, mm] = hora.split(":").map(Number);
  dia.setHours(hh, mm, 0, 0);
  const enc = await inserirViaServiceRole("encontros", {
    dupla_id: DUPLA_ID,
    numero,
    data_hora: dia.toISOString(),
    ...(status === "realizado" ? { realizado_em: dia.toISOString() } : {}),
    status,
    created_by: IDS.mentorProfile,
  });
  return String(enc.id);
}

/** Registro gravado direto (service role) — pros testes que só leem a ficha. */
async function inserirRegistro(encontroId: string) {
  return inserirViaServiceRole("registros", {
    encontro_id: encontroId,
    avaliacao: "boa",
    tema: "E2E: tema do registro",
  });
}

/** Etapa 1 → 2 → 3 do wizard, sem pressupor pré-hidratação. */
async function avancarAteCombinados(
  page: import("@playwright/test").Page,
  form: import("@playwright/test").Locator
) {
  await agirComConfirma(
    () => form.getByRole("button", { name: "Avançar" }).click(),
    () => form.getByRole("heading", { name: /Passo 2 de 3/ }).isVisible()
  );
  await agirComConfirma(
    () => form.getByRole("button", { name: "Avançar" }).click(),
    () => form.getByRole("heading", { name: /Passo 3 de 3/ }).isVisible()
  );
}

/** Avaliação "Boa" + duração 1h30 — os dois campos compartilhados que o
 *  encadeamento herda no rascunho. */
async function preencherEtapa1(
  page: import("@playwright/test").Page,
  form: import("@playwright/test").Locator
) {
  // o radio é sr-only: clica no rótulo visível (funciona antes da hidratação)
  await form.getByText("Boa", { exact: true }).click();
  const opcao90 = page.getByRole("option", { name: "1h30" });
  await agirComConfirma(
    () => form.locator("#duracao-select").click(),
    () => opcao90.isVisible()
  );
  await opcao90.click();
}

test.describe("rota de registro do encontro (REALIZA-473)", () => {
  test.beforeEach(async ({ page }) => {
    if (DUPLA_ID) {
      await limparEncontrosDaDupla(DUPLA_ID);
      await convergirDuplaAtiva(DUPLA_ID);
    }
    await loginComSenha(page, EMAIL, SENHA);
  });

  test.afterEach(async () => {
    if (DUPLA_ID) {
      await limparEncontrosDaDupla(DUPLA_ID);
      await convergirDuplaAtiva(DUPLA_ID);
    }
  });

  test("home → rota em uma navegação, salva e conclui na ficha com o bloco aberto", async ({
    page,
  }) => {
    const enc = await criarEncontro(3);

    // AC-473.1: a home do mentor leva direto pra rota, sem aba e sem hash
    await page.goto("/");
    await page.getByRole("link", { name: "Registrar como foi" }).first().click();
    await expect(page).toHaveURL(
      new RegExp(`/duplas/${DUPLA_ID}/registrar/${enc}`)
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "Registrar o 3º encontro" })
    ).toBeVisible();
    // a tela da tarefa não é a ficha: nenhuma árvore de abas
    await expect(page.getByRole("tablist")).toHaveCount(0);
    // o contexto do encontro vem antes do form
    await expect(
      page.getByRole("heading", { name: /^3º ·/ })
    ).toBeVisible();

    const form = page.locator("form");
    await preencherEtapa1(page, form);
    await avancarAteCombinados(page, form);
    await agirComConfirma(
      () => form.getByRole("button", { name: "Salvar registro" }).click(),
      () => page.getByText(/Registro salvo/).first().isVisible()
    );

    // a etapa de evidências fica no mesmo lugar (K1) e o Concluir volta pra
    // ficha com o bloco aberto, sem refresh concorrente
    await page.getByRole("button", { name: "Concluir" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/duplas/${DUPLA_ID}\\?aba=encontros#registrar-${enc}`)
    );
    const card = page.locator(`#registrar-${enc}`);
    const gatilhoRegistro = card.getByRole("button", { name: /^Registro/ });
    await expect(gatilhoRegistro).toHaveAttribute("aria-expanded", "true");
    await expect(card.getByText("registro pendente")).toHaveCount(0);

    // AC-473.2: o servidor gravou o fato e o registro
    const [salvo] = await buscarViaServiceRole<{ status: string; duracao_min: number }[]>(
      "encontros",
      `select=status,duracao_min&id=eq.${enc}`
    );
    expect(salvo.status).toBe("realizado");
    expect(salvo.duracao_min).toBe(90);
    const registros = await buscarViaServiceRole<{ id: string }[]>(
      "registros",
      `select=id&encontro_id=eq.${enc}`
    );
    expect(registros).toHaveLength(1);
  });

  test("'Registrar o 4º também' navega pra rota do próximo com o rascunho", async ({
    page,
  }) => {
    const e3 = await criarEncontro(3, { dias: -3 });
    const e4 = await criarEncontro(4, { dias: -1 });

    await page.goto(`/duplas/${DUPLA_ID}/registrar/${e3}`);
    const form = page.locator("form");
    await preencherEtapa1(page, form);
    await avancarAteCombinados(page, form);

    const proximoTambem = page.getByRole("button", {
      name: "Registrar o 4º também",
    });
    await agirComConfirma(
      () => form.getByRole("button", { name: "Salvar registro" }).click(),
      () => proximoTambem.isVisible()
    );
    await expect(proximoTambem).toBeVisible({ timeout: 15_000 });
    await proximoTambem.click();

    // AC-473.4: a rota do 4º abre com duração/avaliação herdadas do rascunho
    await expect(page).toHaveURL(
      new RegExp(`/duplas/${DUPLA_ID}/registrar/${e4}`),
      { timeout: 15_000 }
    );
    const form4 = page.locator("form");
    await expect(form4).toBeVisible({ timeout: 15_000 });
    await expect(form4.getByText(/Rascunho de .* restaurado/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      form4.locator('input[name="avaliacao"][value="boa"]')
    ).toBeChecked({ timeout: 15_000 });
    await expect(form4.locator("#duracao-select")).toContainText("1h30", {
      timeout: 15_000,
    });
  });

  test("a sessão cobriu o 7º também — um encontro e um registro por nº", async ({
    page,
  }) => {
    // dois realizados sem registro: o 7º é o candidato de cobertura do 6º
    const e6 = await criarEncontro(6, { dias: -4 });
    const e7 = await criarEncontro(7, { dias: -2 });

    await page.goto(`/duplas/${DUPLA_ID}/registrar/${e6}`);
    const form = page.locator("form");

    // AC-473 (007 US11): a cobertura que existia só na ficha vale na rota
    await expect(form.getByText("7º encontro")).toBeVisible();
    await form.getByText("7º encontro").click();
    await preencherEtapa1(page, form);
    await avancarAteCombinados(page, form);
    await agirComConfirma(
      () => form.getByRole("button", { name: "Salvar registro" }).click(),
      () => page.getByText(/Também cobriu o 7º encontro/).isVisible()
    );
    await expect(
      page.getByText(/Também cobriu o 7º encontro/)
    ).toBeVisible({ timeout: 15_000 });

    // o pós-save não oferece encadear pro nº que a sessão já cobriu
    await expect(
      page.getByRole("button", { name: "Registrar o 7º também" })
    ).toHaveCount(0);

    // Concluir volta pra ficha com o bloco do 6º aberto; o 7º também tem
    // registro (cada encontro é salvo separadamente)
    await page.getByRole("button", { name: "Concluir" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/duplas/${DUPLA_ID}\\?aba=encontros#registrar-${e6}`)
    );
    await expect(
      page.locator(`#registrar-${e7}`).getByRole("button", { name: /^Registro/ })
    ).toBeVisible();

    // os dois fatos existem: encontros realizados + um registro por nº
    const encs = await buscarViaServiceRole<{ id: string; status: string }[]>(
      "encontros",
      `select=id,status&id=in.(${e6},${e7})`
    );
    expect(encs).toHaveLength(2);
    expect(encs.every((e) => e.status === "realizado")).toBe(true);
    const regs = await buscarViaServiceRole<{ encontro_id: string }[]>(
      "registros",
      `select=encontro_id&encontro_id=in.(${e6},${e7})`
    );
    expect(regs.map((r) => r.encontro_id).sort()).toEqual([e6, e7].sort());
  });

  test("deep link legado #registrar- continua abrindo e salvando na ficha", async ({
    page,
  }) => {
    const enc = await criarEncontro(2);

    // AC-473.5: o link antigo (WhatsApp/e-mail) não quebra no PR1
    await page.goto(`/duplas/${DUPLA_ID}#registrar-${enc}`);
    const linha = page.locator(`#registrar-${enc}`);
    const form = linha.locator("form");
    await expect(form).toBeVisible({ timeout: 15_000 });

    await preencherEtapa1(page, form);
    await avancarAteCombinados(page, form);
    await agirComConfirma(
      () => form.getByRole("button", { name: "Salvar registro" }).click(),
      () => page.getByText(/Registro salvo/).first().isVisible()
    );

    const registros = await buscarViaServiceRole<{ id: string }[]>(
      "registros",
      `select=id&encontro_id=eq.${enc}`
    );
    expect(registros).toHaveLength(1);
  });

  test("guardas: futuro tem saída, já registrado e coordenação caem na ficha", async ({
    page,
  }) => {
    const futuro = await criarEncontro(6, { status: "agendado", dias: 10 });

    // AC-473.7 — futuro: cartão com saída nomeada, sem form
    await page.goto(`/duplas/${DUPLA_ID}/registrar/${futuro}`);
    await expect(page.getByText(/Marcado para .+\./)).toBeVisible();
    await expect(page.getByText("O registro abre depois do horário.")).toBeVisible();
    await expect(page.locator("form")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Voltar para a dupla" })
    ).toBeVisible();

    // já registrado: editar mora na ficha, com o bloco aberto
    const jaRegistrado = await criarEncontro(4, { dias: -4 });
    await inserirRegistro(jaRegistrado);
    await page.goto(`/duplas/${DUPLA_ID}/registrar/${jaRegistrado}`);
    await expect(page).toHaveURL(
      new RegExp(`/duplas/${DUPLA_ID}\\?aba=encontros#registrar-${jaRegistrado}`)
    );
    await expect(
      page
        .locator(`#registrar-${jaRegistrado}`)
        .getByRole("button", { name: /^Registro/ })
    ).toHaveAttribute("aria-expanded", "true");

    // id que não pertence à dupla cai no mesmo 404 (não vaza existência)
    await page.goto(
      `/duplas/${DUPLA_ID}/registrar/00000000-0000-4000-8000-000000000000`
    );
    await expect(page.getByText("Página não encontrada")).toBeVisible();

    // coordenação lê, não registra — volta pra ficha com o bloco aberto
    const doMentor = await criarEncontro(5, { dias: -2 });
    await relogar(page, COORD_EMAIL, COORD_SENHA);
    await page.goto(`/duplas/${DUPLA_ID}/registrar/${doMentor}`);
    await expect(page).toHaveURL(
      new RegExp(`/duplas/${DUPLA_ID}\\?aba=encontros#registrar-${doMentor}`)
    );
    await expect(
      page.getByRole("heading", { name: /Passo 1 de 3/ })
    ).toHaveCount(0);
  });

  test("colapso: os blocos do mentor e do jovem nascem fechados e o hash abre os dois", async ({
    page,
  }) => {
    const enc = await criarEncontro(3, { dias: -5 });
    await inserirRegistro(enc);
    await inserirViaServiceRole("avaliacoes_encontro", {
      dupla_id: DUPLA_ID,
      encontro_id: enc,
      estrelas: 5,
      respondido_por_profile_id: IDS.jovemProfile,
      // o mentor DPP só recebe a linha que o jovem liberou (RLS da 0071)
      avaliacao_visivel_mentor: true,
    });

    await page.goto(`/duplas/${DUPLA_ID}?aba=encontros`);
    const card = page.locator(`#registrar-${enc}`);
    const mentor = card.getByRole("button", { name: /^Registro/ });
    const jovem = card.getByRole("button", { name: /Avaliação do jovem/ });

    // AC-473.6: ambos fechados, com o resumo visível no trigger
    await expect(mentor).toHaveAttribute("aria-expanded", "false");
    await expect(jovem).toHaveAttribute("aria-expanded", "false");
    await expect(mentor).toContainText("E2E: tema do registro");
    await expect(jovem).toContainText(/pela conta do jovem/);

    // clicar num trigger abre só o acionado (não é acordeão)
    await mentor.click();
    await expect(mentor).toHaveAttribute("aria-expanded", "true");
    await expect(jovem).toHaveAttribute("aria-expanded", "false");

    // o hash abre os dois: o link antigo revela o encontro inteiro
    await page.goto(`/duplas/${DUPLA_ID}?aba=encontros#registrar-${enc}`);
    await expect(mentor).toHaveAttribute("aria-expanded", "true");
    await expect(jovem).toHaveAttribute("aria-expanded", "true");
  });
});

test.describe("rota de registro no celular (390×844)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    if (DUPLA_ID) {
      await limparEncontrosDaDupla(DUPLA_ID);
      await convergirDuplaAtiva(DUPLA_ID);
    }
    await loginComSenha(page, EMAIL, SENHA);
  });

  test.afterEach(async () => {
    if (DUPLA_ID) {
      await limparEncontrosDaDupla(DUPLA_ID);
      await convergirDuplaAtiva(DUPLA_ID);
    }
  });

  test("sem scroll horizontal e o salvar alcançável em todas as etapas", async ({
    page,
  }) => {
    const enc = await criarEncontro(3);
    await page.goto(`/duplas/${DUPLA_ID}/registrar/${enc}`);

    const largura = () =>
      page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
    expect((await largura()).scroll).toBeLessThanOrEqual((await largura()).inner);

    const form = page.locator("form");
    await preencherEtapa1(page, form);
    await avancarAteCombinados(page, form);

    // AC-473.8: rodapé sticky com o primário à mão na última etapa
    const salvar = form.getByRole("button", { name: "Salvar registro" });
    await expect(salvar).toBeVisible();
    const fim = await largura();
    expect(fim.scroll).toBeLessThanOrEqual(fim.inner);
  });
});
