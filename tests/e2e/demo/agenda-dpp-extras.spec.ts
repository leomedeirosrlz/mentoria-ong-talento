import { entrarNaDemo, expect, test } from "../helpers";

// WP5 — os extras do "Por mentorado" do mentor DPP (Ricardo): o strip
// "Sua semana" (7 células seg–dom com contadores seu/acompanha), a seção
// "Do programa" (supervisões recebidas + formações das turmas dele), a
// trilha de especialista em modo "Você acompanha, não participa" e o
// Lembrar por jovem (D5 → mentorado, não mentor).
//
// Dataset demo:
//   · supervisão do domingo (Paulo × Ricardo sobre a dupla da Bia) — sempre
//     dentro do seg–dom corrente
//   · "Roda de casos — formação continuada de mentores" no domingo da T1 —
//     o evento de formação vivo do calendário do Ricardo
//   · trilha Sofia × Bia ativa no card da Bia (e a concluída da Helena no
//     histórico — coberto no agenda-dpp.spec)
//   · nudges do Ricardo: nenhum recente nas duplas dele → "Lembrar Bia" e
//     "Lembrar Matheus" livres (o cap de 48h cobre AUTOR qualquer, mas o
//     nudge da Marina pro Matheus já tem 6 dias)
// Público, sem writes: o LembreteButton do demo responde o toast "Modo
// demo — nada é enviado de verdade."

test.describe("agenda demo do mentor DPP — Sua semana / Do programa / Lembrar o jovem (WP5)", () => {
  test.use({ timezoneId: "America/Sao_Paulo" });
  test.beforeEach(async ({ page }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/agenda?aba=por-mentorado");
  });

  test("sua semana — strip de 7 células com a legenda de contadores", async ({
    page,
  }) => {
    const semana = page.locator('section[aria-label="Sua semana"]');
    await expect(semana).toBeVisible();
    await expect(
      semana.getByRole("heading", { name: "Sua semana" })
    ).toBeVisible();

    // 7 células seg–dom — a grade inteira da semana corrente
    const celulas = semana.locator("ol > li");
    await expect(celulas).toHaveCount(7);
    await expect(celulas.first()).toContainText("seg");
    await expect(celulas.last()).toContainText("dom");

    // a legenda do mock v6 — colorido é seu, âmbar/cinza é "só acompanha"
    await expect(
      semana.getByText(
        "Contador colorido = é seu · âmbar tracejado = só acompanha."
      )
    ).toBeVisible();

    // a célula de domingo recebe a supervisão (dada pelo Paulo) e a roda de
    // casos — labels vivem em texto mesmo quando escondidos no mobile
    const domingo = celulas.last();
    await expect(domingo).toContainText("supervisão");
    await expect(domingo).toContainText("formação");
    // os dois são compromissos próprios → contador lime "2"
    await expect(
      domingo.locator('em[class*="bg-[var(--brand-lime)]"]')
    ).toHaveText("2");
  });

  test("do programa — supervisão recebida e formação da turma", async ({
    page,
  }) => {
    const prog = page.locator('section[aria-label="Do programa"]');
    await expect(prog).toBeVisible();

    // a supervisão recebida — "Supervisão com Paulo Serra" + a dupla dela
    await expect(prog.getByText("Supervisão com Paulo Serra")).toBeVisible();
    await expect(
      prog.getByText(/sobre a dupla com Ana Beatriz Silva/)
    ).toBeVisible();

    // a formação futura do cronograma do Ricardo (roda de casos no domingo)
    // o rótulo de categoria repete a cada formação listada — basta uma
    await expect(prog.getByText("Formação de mentores").first()).toBeVisible();
    await expect(
      prog.getByText(/Roda de casos — formação continuada de mentores/)
    ).toBeVisible();
  });

  test("lembrar o jovem — botão por card com o toast do modo demo", async ({
    page,
  }) => {
    // um LembreteButton por card — destino "mentorado" e o primeiro nome de
    // uso no rótulo ("Bia" é o nome social da Ana; "Matheus" o civil)
    const cardBia = page.locator("article").filter({ hasText: "Bia" });
    const lembrarBia = cardBia.getByRole("button", { name: "Lembrar Bia" });
    await expect(lembrarBia).toBeEnabled();
    await lembrarBia.click();
    await expect(
      page.getByText("Modo demo: nada é enviado de verdade.")
    ).toBeVisible();

    const cardMatheus = page
      .locator("article")
      .filter({ hasText: "Matheus Gonçalves" });
    await expect(
      cardMatheus.getByRole("button", { name: "Lembrar Matheus" })
    ).toBeEnabled();
  });

  test("trilha de especialista no card — acompanha, não participa", async ({
    page,
  }) => {
    const trilha = page.locator(
      'section[aria-label="Trilha de especialista · Sofia Nogueira"]'
    );
    await expect(trilha).toBeVisible();
    // o selo exato do mock v6 — o DPP não entra na sessão do especialista
    await expect(
      trilha.getByText("Você acompanha, não participa")
    ).toBeVisible();

    // nenhum controle de participação ou agenda dentro do bloco da trilha
    await expect(
      trilha.getByRole("button", { name: /entrar|participar|agendar|marcar/i })
    ).toHaveCount(0);
    await expect(
      trilha.getByRole("link", { name: /entrar|participar|meet|chamada/i })
    ).toHaveCount(0);
  });
});
