import {
  appEnvOk,
  atualizarViaServiceRole,
  expect,
  loginComSenha,
  test,
} from "../helpers";

// Agenda do mentor HÍBRIDO (papeis mentor_dpp + mentor_especialista na
// mesma pessoa — WP6b/WP3) contra backend real. O demo cobre o DPP-primário
// (Ricardo); aqui entra o que a demo não alcança: o caminho esp-primário —
// o ALTA da revisão do WP6b era exatamente a aba "Ciclo DPP" inalcançável
// pra quem tem papel primário especialista (href sem ?visao=).
//
// REALIZA-246: um alternador só — a visão de especialista entrou como aba da
// MESMA tablist dos modos do mentor (não existe mais o nav "Visão da agenda"
// com "Ciclo DPP"/"Especialista").
//
// Fixture do seed (scripts/seed-e2e-staging.mjs): profile+auth do híbrido
// (hib-e2e@realiza.test, senha E2E_MENTOR_PASSWORD), role "mentor_dpp",
// profile_papeis com os dois papéis, dupla DPP ativa (…0120) + trilha esp
// ativa (…0130) + janela de grade sexta 19–21. O teste "esp-primário"
// INVERTE o role via service role e restaura no finally — dado do spec
// morre com o spec.
const HIB_EMAIL = process.env.E2E_HIB_EMAIL ?? "hib-e2e@realiza.test";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const HIB_PROFILE = "e2e00000-0000-4000-8000-000000000110";

const tablistModos = (page: import("@playwright/test").Page) =>
  page.getByRole("tablist", { name: "Modos da agenda" });

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

test.describe("agenda do mentor híbrido", () => {
  test("DPP-primário: cai na aba DPP com os modos novos e transita pras duas visões", async ({
    page,
  }) => {
    await loginComSenha(page, HIB_EMAIL, SENHA);
    await page.goto("/agenda");

    // default = visão do papel primário (DPP) — uma tablist só, com os três
    // modos do mentor e a visão de especialista como quarta aba
    await expect(tablistModos(page)).toHaveCount(1);
    await expect(
      tablistModos(page).getByRole("tab", { name: "Minha agenda" })
    ).toHaveAttribute("aria-selected", "true");
    await expect(tablistModos(page).getByRole("tab")).toHaveCount(4);
    await expect(
      page.getByRole("heading", { name: "Agenda", level: 1 })
    ).toBeVisible();

    // visão especialista — grade editável + a trilha dele
    await tablistModos(page)
      .getByRole("tab", { name: "Especialista" })
      .click();
    await page.waitForURL((url) => url.searchParams.get("visao") === "especialista");
    await expect(
      page.getByText(/Mentoria especializada · até 5 sessões/)
    ).toBeVisible();
    await expect(
      tablistModos(page).getByRole("tab", { name: "Especialista" })
    ).toHaveAttribute("aria-selected", "true");

    // volta pro DPP pela mesma barra — a aba DPP é alcançável (regressão do ALTA).
    // No híbrido de primário DPP o link volta pra `?aba=minha` (o `?visao=dpp`
    // só é obrigatório quando o default da página cai na visão esp); o que
    // importa é o modo selecionado e o painel.
    await tablistModos(page)
      .getByRole("tab", { name: "Minha agenda" })
      .click();
    await expect(
      tablistModos(page).getByRole("tab", { name: "Minha agenda" })
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("tabpanel", { name: "Minha agenda" })
    ).toBeVisible();
  });

  test("esp-primário: cai na visão especialista e os modos DPP seguem alcançáveis", async ({
    page,
  }) => {
    await loginComSenha(page, HIB_EMAIL, SENHA);
    try {
      // inverte o primário via service role — o papel efetivo vem de
      // profile_papeis, então as DUAS visões seguem existindo
      await atualizarViaServiceRole(
        "profiles",
        `id=eq.${HIB_PROFILE}`,
        { role: "mentor_especialista" }
      );
      await page.goto("/agenda");

      // default agora é a visão especialista
      await expect(
        page.getByText(/Mentoria especializada · até 5 sessões/)
      ).toBeVisible();
      await expect(
        tablistModos(page).getByRole("tab", { name: "Especialista" })
      ).toHaveAttribute("aria-selected", "true");

      // os modos DPP precisam carregar ?visao=dpp — o bug do ALTA era o
      // href pelado, que recaía no primário esp e tornava a aba DPP
      // inalcançável pra sempre
      const abaDpp = tablistModos(page).getByRole("tab", {
        name: "Minha agenda",
      });
      await expect(abaDpp).toHaveAttribute("href", /visao=dpp/);
      await abaDpp.click();
      await page.waitForURL((url) => url.searchParams.get("visao") === "dpp");
      await expect(
        tablistModos(page).getByRole("tab", { name: "Minha agenda" })
      ).toHaveAttribute("aria-selected", "true");
    } finally {
      await atualizarViaServiceRole(
        "profiles",
        `id=eq.${HIB_PROFILE}`,
        { role: "mentor_dpp" }
      );
    }
  });

  test("híbrido: Por mentorado renderiza card da dupla DPP com trilha acompanhada", async ({
    page,
  }) => {
    await loginComSenha(page, HIB_EMAIL, SENHA);
    await page.goto("/agenda?visao=dpp&aba=por-mentorado");
    // a dupla DPP dele vira card; a mentorada aparece
    await expect(
      page.getByText(/Mentorada E2E Híbrido/).first()
    ).toBeVisible();
    // sem solicitação de especialista em voo na fixture → CTA de sugerir
    // ou stepper renderizado — qualquer um dos dois é estado honesto
    await expect(
      page.getByText(/PEND[ÊE]NCIAS DA DUPLA|Nada pendente|Especialista/i).first()
    ).toBeVisible();
  });
});
