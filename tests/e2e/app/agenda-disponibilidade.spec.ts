import {
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  expect,
  inserirViaServiceRole,
  loginComSenha,
  relogar,
  test,
} from "../helpers";

// REALIZA-24 — overlay "quem pode nesse dia" na agenda do mentor DPP: as
// células do mês ganham tinta por lado livre (verde = mentor, amarelo =
// mentorado, gradiente diagonal = ambos com período em comum), a legenda
// explica as cores e o detalhe do dia nomeia quem tá livre com o período.
//
// Fixture do scripts/seed-e2e-staging.mjs: mentor …0010 com
// mentor_profiles.disponibilidade {ter,qui,sab + noite} e a mentorada
// …0020 da dupla ativa com {ter,qui + noite} — ter/qui pintam "ambos
// livres", sábado "você livre".
//
// O spec só lia e confiava na convergência do seed — piso quebrado: se a
// grade de qualquer um dos lados (ou a dupla ativa) sai do estado
// esperado — run manual com seed velho, fixture alterada por outro spec,
// retry depois de cleanup — o overlay pinta "você livre" mas nenhuma
// célula cruza os dois lados e "/, ambos livres$/" não casa nada. A
// convenção de piso pede que quem depende de fixture compartilhada
// re-crie o que precisa: o beforeEach abaixo converge as duas grades e a
// dupla ativa via service role (mesmos PATCHes do seed — grade é dado
// aditivo e o guard do mentor_profiles só trava validações).
const IDS = {
  mentor: "e2e00000-0000-4000-8000-000000000010",
  mentorado: "e2e00000-0000-4000-8000-000000000020",
  dupla: "e2e00000-0000-4000-8000-000000000030",
};
const GRADE_MENTOR = { dias: ["ter", "qui", "sab"], periodos: ["noite"] };
const GRADE_MENTORADA = { dias: ["ter", "qui"], periodos: ["noite"] };

const EMAIL = process.env.E2E_MENTOR_EMAIL ?? "";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const COORD_SENHA = process.env.E2E_COORD_PASSWORD ?? "";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

test.describe("agenda — overlay de disponibilidade do mentor (REALIZA-24)", () => {
  test.beforeEach(async ({ page }) => {
    // piso da fixture (ver o cabeçalho): as grades dos dois lados + a
    // dupla DPP ativa — sem elas o overlay não tem o que cruzar
    const [mp] = await buscarViaServiceRole<{ profile_id: string }[]>(
      "mentor_profiles",
      `select=profile_id&profile_id=eq.${IDS.mentor}`
    );
    if (mp) {
      await atualizarViaServiceRole(
        "mentor_profiles",
        `profile_id=eq.${IDS.mentor}`,
        { disponibilidade: GRADE_MENTOR }
      );
    } else {
      await inserirViaServiceRole("mentor_profiles", {
        profile_id: IDS.mentor,
        tipo: "dpp",
        disponibilidade: GRADE_MENTOR,
      });
    }
    await atualizarViaServiceRole("mentorados", `id=eq.${IDS.mentorado}`, {
      disponibilidade: GRADE_MENTORADA,
    });
    await atualizarViaServiceRole("duplas", `id=eq.${IDS.dupla}`, {
      status: "ativa",
      trilha: "dpp",
    });
    await loginComSenha(page, EMAIL, SENHA);
  });

  test("mentor vê legenda, células tintas e o detalhe do dia", async ({
    page,
  }) => {
    // WP3: a agenda do mentor abre em "Minha agenda" — o overlay vive na
    // aba calendário
    await page.goto("/agenda?aba=calendario");

    // legenda "Disponibilidade:" com os três estados — só existe porque
    // algum lado tem grade preenchida
    await expect(page.getByText("Disponibilidade:")).toBeVisible();
    await expect(
      page.getByText("Você livre", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("Mentorado livre", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("Ambos livres", { exact: true })
    ).toBeVisible();

    // células tintas: o aria-label do dia carrega quem tá livre — sábado é
    // só do mentor ("você livre"), ter/qui cruzam com a mentorada
    const celVoce = page
      .getByRole("button", { name: /, você livre$/ })
      .first();
    const celAmbos = page
      .getByRole("button", { name: /, ambos livres$/ })
      .first();
    await expect(celVoce).toBeVisible();
    await expect(celAmbos).toBeVisible();

    // o split "ambos" desenha um gradiente diagonal inline na célula —
    // o marcador estável é data-tinta (o swatch da legenda não é célula,
    // então o filtro fica dentro do gridcell)
    await expect(
      page
        .locator('div[role="gridcell"] button span[data-tinta="ambos"]')
        .first()
    ).toBeAttached();

    const detalhe = page.locator(
      'section[aria-label="Detalhe do dia selecionado"]'
    );

    // dia "ambos": a linha nomeia os dois lados com o período de cada um
    await celAmbos.click();
    const linhaAmbos = detalhe.getByText(/Disponível neste dia:/);
    await expect(linhaAmbos).toBeVisible();
    await expect(linhaAmbos).toContainText("você");
    await expect(linhaAmbos).toContainText("Mentorada");
    // período da grade — "à noite" (os dois lados marcam só noite)
    await expect(linhaAmbos).toContainText("à noite");

    // dia "só mentor": a linha lista só o lado livre — o nome da mentorada
    // não pode entrar
    await celVoce.click();
    const linhaVoce = detalhe.getByText(/Disponível neste dia:/);
    await expect(linhaVoce).toBeVisible();
    await expect(linhaVoce).toContainText("você");
    await expect(linhaVoce).not.toContainText("Mentorada");
  });

  test("coordenação não vê overlay — nem na visão de mês", async ({
    page,
  }) => {
    await relogar(page, COORD_EMAIL, COORD_SENHA);
    await page.goto("/agenda?aba=calendario");

    // a visão default da coord é "semana"; troca pra "mês" — o overlay é
    // prop só do mentor (undefined pra coord), a grade não pinta pra ela
    await page
      .locator("label", {
        has: page.locator('input[name="agenda-visao"][value="mes"]'),
      })
      .click();

    await expect(page.locator('div[role="grid"]')).toBeVisible();
    await expect(page.getByText("Disponibilidade:")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /livre/ })
    ).toHaveCount(0);
    await expect(
      page.locator('div[role="gridcell"] button span[data-tinta]')
    ).toHaveCount(0);
  });
});
