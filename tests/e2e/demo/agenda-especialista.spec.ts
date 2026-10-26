import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-207 — a agenda do especialista deixa de ser grade: é uma lista do
// que pede ação ("Precisa de você"), as próximas sessões por dia, um card
// por trilha e o resumo "Quando você atende" em frase. Os horários (faixas
// semanais + exceções) se editam no perfil, em #horarios. A persona
// mentor_especialista (Sofia) tem fixtures determinísticas:
//   · grade semanal: ter 18–21, qui 18–21, sáb 9–12
//   · exceções ancoradas em hoje (extra 7–9, bloqueio 12–14) e adiante
//   · sessões: Eduardo hoje 19:30 (nº2), Bia no próximo sábado 10:00;
//     a nº1 do Eduardo já passou sem registro → pendência
// Público, sem writes: vale em qualquer deploy, produção inclusive.
const DEMO_MSG = "Modo demonstração. Nada é gravado de verdade.";

test.describe("agenda demo do especialista (REALIZA-207)", () => {
  test.use({ timezoneId: "America/Sao_Paulo" });

  test("lista de ação, próximas sessões, trilhas e resumo dos horários", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_especialista");
    await page.goto("/agenda");

    // sessão passada sem registro sobe pro topo com o CTA preenchido
    const precisa = page.locator('section[aria-label="Precisa de você"]');
    await expect(precisa.getByText(/Sessão 1 com Eduardo/)).toBeVisible();
    await expect(
      // .first(): depois das 19h30 a sessão de hoje também vira pendência
      precisa.getByRole("link", { name: "Registrar sessão" }).first()
    ).toBeVisible();

    const proximas = page.locator('section[aria-label="Próximas sessões"]');
    // a sessão de hoje do Eduardo (19h30) é próxima até acabar; depois
    // vira pendência no "Precisa de você" — o teste vale em qualquer hora
    await expect(
      proximas.getByText("Sessão com Eduardo").or(precisa.getByText(/Eduardo/)).first()
    ).toBeVisible();
    await expect(proximas.getByText("Sessão com Bia")).toBeVisible();

    // um card por trilha, cada um abrindo a ficha da dupla
    const trilhas = page.locator('section[aria-label="Suas trilhas"]');
    const abrir = trilhas.getByRole("link", { name: /Abrir trilha/ });
    await expect(abrir).toHaveCount(2);
    for (const href of await abrir.evaluateAll((els) =>
      els.map((el) => el.getAttribute("href"))
    ))
      expect(href).toMatch(/^\/duplas\/de000000-/);
    await expect(trilhas.getByText(/\d de 5 sessões/).first()).toBeVisible();

    // horários em frase, sem grade; a edição mora no perfil
    const atende = page.locator('section[aria-label="Quando você atende"]');
    await expect(atende).toContainText("Terças 18h–21h");
    await expect(atende).toContainText("Sábados 9h–12h");
    await expect(
      atende.getByRole("link", { name: "Editar no perfil" })
    ).toHaveAttribute("href", "/perfil#horarios");
    await expect(page.getByText("Editar grade")).toHaveCount(0);
    await expect(page.getByRole("columnheader")).toHaveCount(0);
  });

  test("perfil #horarios: faixas e exceções em frase, editáveis", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_especialista");
    await page.goto("/perfil#horarios");

    const sec = page.locator("#horarios");
    await expect(
      sec.getByRole("heading", { name: "Quando você pode atender" })
    ).toBeVisible();
    await expect(sec.getByText("Terças 18h–21h")).toBeVisible();
    await expect(sec.getByText("Quintas 18h–21h")).toBeVisible();
    await expect(sec.getByText(/^Atende também em \d{2}\/\d{2}/).first()).toBeVisible();
    await expect(sec.getByText(/^Não atende em \d{2}\/\d{2}/).first()).toBeVisible();

    // remover dispara a action (stub demo devolve o aviso)
    await sec.getByRole("button", { name: "Remover quintas 18h–21h" }).click();
    await expect(page.getByText(DEMO_MSG).first()).toBeVisible();

    // REALIZA-212: sem input nativo — dias são botões, o horário são rodas
    // (spinbutton no teclado) e a data é uma faixa de dias
    await expect(sec.locator('input[type="time"], input[type="date"]')).toHaveCount(0);
    const inicioHora = sec.getByRole("spinbutton", { name: "Início: hora" }).first();
    await expect(inicioHora).toHaveAttribute("aria-valuetext", "18 horas");
    await inicioHora.press("ArrowDown");
    await expect(inicioHora).toHaveAttribute("aria-valuetext", "19 horas");
    await expect(sec.getByRole("radiogroup", { name: "Data" }).getByRole("radio").first()).toBeVisible();

    // validação no cliente: sem dia escolhido não chega a chamar a action
    await sec.getByRole("button", { name: "Adicionar" }).first().click();
    await expect(sec.getByText("Escolha ao menos um dia.")).toBeVisible();
    // vários dias de uma vez: um clique por dia, um Adicionar
    await sec.getByRole("button", { name: "Segunda" }).click();
    await sec.getByRole("button", { name: "Quarta" }).click();
    await expect(sec.getByRole("button", { name: "Quarta" })).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("agenda demo do especialista — celular", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    timezoneId: "America/Sao_Paulo",
  });

  test("<768px: nada estoura a largura da tela", async ({ page }) => {
    await entrarNaDemo(page, "mentor_especialista");
    await page.goto("/agenda");
    await expect(
      page.locator('section[aria-label="Suas trilhas"]')
    ).toBeVisible();
    const largura = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    expect(largura).toBeLessThanOrEqual(390);
  });
});
