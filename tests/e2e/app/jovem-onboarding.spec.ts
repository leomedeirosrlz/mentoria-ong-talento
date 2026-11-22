import {
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  expect,
  loginComSenha,
  test,
} from "../helpers";

// Wizard de primeiro acesso do mentorado (REALIZA-114) contra backend
// real. Fixture do scripts/seed-e2e-staging.mjs: jovem3 — profile
// mentorado com senha e ficha vinculada, mas o estado "nunca entrou":
// onboarded_em null e mentorados.disponibilidade null. O beforeEach
// re-converge os três campos — o wizard carimba/grava de verdade e um
// spec não pode vazar "já vi" pro próximo.
const JOVEM3_EMAIL = process.env.E2E_JOVEM3_EMAIL ?? "jovem3-e2e@realiza.test";
// mesmo segredo compartilhado do mentor — um secret a menos no CI
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";

const IDS = {
  jovem3Profile: "e2e00000-0000-4000-8000-0000000000e3",
  mentoradoOnboarding: "e2e00000-0000-4000-8000-0000000000f3",
} as const;

type FichaGrade = {
  // a 0100 grava a forma canônica + as chaves derivadas (leitura legada)
  disponibilidade: {
    celulas: { dia: string; periodo: string }[];
    dias: string[];
    periodos: string[];
  } | null;
};

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

test.describe("mentorado — onboarding do 1º acesso (REALIZA-114)", () => {
  test.beforeEach(async () => {
    // devolve o "nunca entrou": sem carimbo de onboarding e a ficha sem
    // grade nem opt-in — cada spec vê o wizard do zero
    await atualizarViaServiceRole("profiles", `id=eq.${IDS.jovem3Profile}`, {
      onboarded_em: null,
    });
    await atualizarViaServiceRole(
      "mentorados",
      `id=eq.${IDS.mentoradoOnboarding}`,
      { disponibilidade: null, contato_compartilhado: false }
    );
  });

  test("wizard aparece no 1º acesso e grava a grade", async ({
    page,
  }) => {
    await loginComSenha(page, JOVEM3_EMAIL, SENHA);
    // o login despeja em "/" (grupo app), que devolve o mentorado — o
    // layout dele serve o wizard em vez do shell (sem carimbo)
    await page.waitForURL((u) => u.pathname === "/jovem", { timeout: 15_000 });

    // passo 1 — boas-vindas com a promessa do programa (e a Liza abrindo a
    // jornada, REALIZA-426). Sem "Voltar": não há passo anterior (o botão
    // só existe na demo, onde vira "Escolher outro papel")
    await expect(
      page.getByRole("heading", { name: /Boas-vindas ao Realiza\.vc/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Voltar um passo" })
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Continuar" }).click();

    // passo 2 — o tour das telas reais: os itens são botões que trocam o
    // print (a grade vem logo depois); o voltar volta a existir
    await expect(
      page.getByRole("heading", { name: "O que você pode fazer aqui" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Voltar um passo" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Sua página inicial/ })
    ).toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();

    // passo 3 — a grade semanal (seg–dom × manhã/tarde/noite): marca e
    // segue — o "Continuar" aqui grava pela RPC do jovem
    await expect(
      page.getByRole("heading", { name: "Quando dá pra você?" })
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Sábado de manhã", exact: true })
      .click();
    await page.getByRole("button", { name: "Continuar" }).click();

    // passo 4 — o termo autoemitido no login (436): a assinatura entra no
    // wizard quando há pendência; "Assinar depois" adia sem esconder a
    // pendência (o fechamento lembra dela e a home carrega o card)
    await expect(
      page.getByRole("heading", { name: "Seu termo de participação" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Assinar depois" }).click();

    // passo 5 — contato: WhatsApp da ficha formatado + o toggle do opt-in
    // (mesma semântica do card Privacidade do perfil)
    await expect(
      page.getByRole("heading", { name: "Seu contato tá certo?" })
    ).toBeVisible();
    await expect(page.getByText("(11) 99900-0093")).toBeVisible();
    await expect(page.getByText(JOVEM3_EMAIL)).toBeVisible();
    await expect(
      page.getByRole("switch", {
        name: "Compartilhar meu WhatsApp com os colegas",
      })
    ).toBeVisible();
    await page.getByRole("button", { name: "Entrar" }).click();

    // shell monta no lugar do wizard — e sem o lembrete: a grade existe
    await expect(
      page.getByRole("heading", { name: /Olá, Jovem/ })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Conte quando você pode/ })
    ).not.toBeVisible();

    // o que a RPC gravou na ficha — a prova de que o write foi de verdade
    const [ficha] = await buscarViaServiceRole<FichaGrade[]>(
      "mentorados",
      `select=disponibilidade&id=eq.${IDS.mentoradoOnboarding}`
    );
    expect(ficha.disponibilidade).toEqual({
      celulas: [{ dia: "sab", periodo: "manha" }],
      dias: ["sab"],
      periodos: ["manha"],
    });
  });

  test("'Preencher depois' deixa lembrete na home até a grade existir", async ({
    page,
  }) => {
    await loginComSenha(page, JOVEM3_EMAIL, SENHA);
    await page.waitForURL((u) => u.pathname === "/jovem", { timeout: 15_000 });

    // pula a grade — permitido, mas a pendência não é silenciosa
    await page.getByRole("button", { name: "Continuar" }).click();
    // o tour das telas fica entre as boas-vindas e a grade
    await expect(
      page.getByRole("heading", { name: "O que você pode fazer aqui" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(
      page.getByRole("heading", { name: "Quando dá pra você?" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Preencher depois" }).click();
    // termo autoemitido no login (436) — entre a grade e o contato
    await expect(
      page.getByRole("heading", { name: "Seu termo de participação" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Assinar depois" }).click();
    await expect(
      page.getByRole("heading", { name: "Seu contato tá certo?" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Entrar" }).click();

    // a faixa permanente na home (não-dismissível por desenho) — ela é o
    // atalho pro lugar onde a pendência se resolve
    await expect(
      page.getByRole("heading", { name: /Olá, Jovem/ })
    ).toBeVisible();
    const lembrete = page.getByRole("link", {
      name: /Conte quando você pode/,
    });
    await expect(lembrete).toBeVisible();

    // lembrete → perfil → lápis do card "Sua disponibilidade" → grade no
    // dialog (mesma CampoDisponibilidade do wizard)
    await lembrete.click();
    await page.waitForURL((u) => u.pathname === "/jovem/perfil");
    await page
      .getByRole("button", { name: "Editar sua disponibilidade" })
      .click();
    const dialogo = page.getByRole("dialog");
    await dialogo
      .getByRole("button", { name: "Domingo de noite", exact: true })
      .click();
    await dialogo.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Disponibilidade salva.")).toBeVisible();

    // gravou na ficha e o lembrete some da home — a pendência acabou
    const [ficha] = await buscarViaServiceRole<FichaGrade[]>(
      "mentorados",
      `select=disponibilidade&id=eq.${IDS.mentoradoOnboarding}`
    );
    expect(ficha.disponibilidade).toEqual({
      celulas: [{ dia: "dom", periodo: "noite" }],
      dias: ["dom"],
      periodos: ["noite"],
    });
    await page.goto("/jovem");
    await expect(
      page.getByRole("link", { name: /Conte quando você pode/ })
    ).not.toBeVisible();
  });
});
