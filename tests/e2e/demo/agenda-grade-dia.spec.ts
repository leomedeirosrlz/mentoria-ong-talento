import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-163 (superfície demo) — a grade semanal do especialista vira
// editor "pinta e clica" dentro do <details> "Editar grade" (arrastar no
// vazio cria a janela com snap de 30min; clique numa janela remove) e a
// agenda ganha a visão "Dia" (o detalhe do dia selecionado em largura
// cheia, navegando dia a dia). Actions são stubadas no modo demo — os
// writes devolvem o toast "Modo demonstração…" — então o spec afirma a
// INTERAÇÃO (rascunho visível no arraste, chamada disparada na soltura),
// não a persistência. Público, sem writes: vale em qualquer deploy.
const DEMO_MSG = "Modo demonstração. Nada é gravado de verdade.";

test.describe("REALIZA-163 — grade editável do especialista (demo)", () => {
  test.use({ timezoneId: "America/Sao_Paulo" });

  test("pintar na grade mostra o rascunho e soltar dispara a action", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_especialista");
    await page.goto("/agenda");

    // o editor mora no <details> "Editar grade" — a grade demo da Sofia não
    // é vazia, então vem fechado e abre pelo summary
    const summary = page
      .locator("summary")
      .filter({ hasText: /Editar grade/ })
      .first();
    await expect(summary).toBeVisible();
    await summary.click();

    const editor = page.getByRole("group", { name: "Grade semanal editável" });
    await expect(editor).toBeVisible();
    // régua 8h–20h no gutter + dica do gesto
    await expect(editor.getByText("8h", { exact: true })).toBeVisible();
    await expect(editor.getByText("19h", { exact: true })).toBeVisible();
    await expect(
      page.getByText(/Arraste na grade pra criar uma janela/)
    ).toBeVisible();

    // as três janelas recorrentes da Sofia (ter/qui 18–21, sáb 9–12) viram
    // botões de remoção — a lista por dia embaixo segue intacta
    await expect(
      editor.getByRole("button", { name: /Remover janela de Terça/ })
    ).toBeVisible();
    await expect(
      editor.getByRole("button", { name: /Remover janela de Sábado/ })
    ).toBeVisible();
    await expect(
      page.getByText("Toda semana", { exact: true })
    ).toBeVisible();

    // arrasto na coluna vazia de quarta: ~10h → ~12h (o eixo começa às 8h;
    // 1h = 48px). Nome curto sem "-feira" — a coluna da grade de leitura
    // usa o dia por extenso e não colide no seletor
    const quarta = editor.getByRole("group", { name: "Quarta", exact: true });
    await expect(quarta).toBeVisible();
    const box = await quarta.boundingBox();
    if (!box) throw new Error("coluna de quarta sem bounding box");
    const x = box.x + box.width / 2;
    const y10h = box.y + (10 - 8) * 48;
    await page.mouse.move(x, y10h);
    await page.mouse.down();
    await page.mouse.move(x, y10h + 2 * 48, { steps: 6 });

    // o rascunho aparece enquanto o ponteiro segura o gesto…
    const rascunho = page.locator("[data-draft-janela]");
    await expect(rascunho).toBeVisible();
    await expect(rascunho).toContainText("10h–12h");

    // …e a soltura chama adicionarJanela — no modo demo a action responde
    // o toast stub e nada é gravado
    await page.mouse.up();
    await expect(rascunho).toHaveCount(0);
    await expect(page.getByText(DEMO_MSG).first()).toBeVisible();

    // clique numa janela dispara a remoção (mesmo stub demo)
    await editor
      .getByRole("button", { name: /Remover janela de Quinta/ })
      .click();
    await expect(page.getByText(DEMO_MSG).first()).toBeVisible();
  });

  test("clique sem arrastar não cria janela (gesto < 30min é descartado)", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_especialista");
    await page.goto("/agenda");
    await page
      .locator("summary")
      .filter({ hasText: /Editar grade/ })
      .first()
      .click();

    const quarta = page
      .getByRole("group", { name: "Grade semanal editável" })
      .getByRole("group", { name: "Quarta", exact: true });
    await expect(quarta).toBeVisible();
    await quarta.click(); // down+up no mesmo ponto — nenhum toast dispara
    await expect(page.locator("[data-draft-janela]")).toHaveCount(0);
    await expect(page.getByText(DEMO_MSG)).toHaveCount(0);
  });
});

test.describe("REALIZA-163 — visão Dia do calendário (demo)", () => {
  test.use({ timezoneId: "America/Sao_Paulo" });

  test("mentor demo: chip Dia abre a data cheia e 'Agendar neste dia' vai pros Horários", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/agenda?aba=calendario");

    // o chip "Dia" entra no switcher do mentor (dia/mês/semana/horários)
    const chipDia = page.locator("label", {
      has: page.locator('input[name="agenda-visao"][value="dia"]'),
    });
    await expect(chipDia).toBeVisible();
    await chipDia.click();

    // a visão abre no dia selecionado: chrome navegando por dia + a data
    // por extenso ("Terça-feira, 27 de outubro") como heading
    await expect(
      page.getByRole("button", { name: "Dia anterior" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Próximo dia" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /, \d{1,2} de / })
    ).toBeVisible();

    // navegar anda de um dia — o rótulo live-region acompanha
    const rotulo = page.locator("#agenda-mes-rotulo");
    const antes = await rotulo.textContent();
    await page.getByRole("button", { name: "Próximo dia" }).click();
    await expect(rotulo).not.toHaveText(antes ?? "");

    // o atalho de agendamento do mentor pousa na grade de horários da
    // semana do dia — a mesma troca do chip "Horários"
    await page
      .getByRole("button", { name: "Agendar neste dia" })
      .click();
    await expect(
      page.locator("div[class*='grid-cols-[2.5rem']")
    ).toBeVisible();
  });

  test("coordenação demo: chip Dia existe e renderiza o detalhe do dia", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/agenda?aba=calendario");

    const chipDia = page.locator("label", {
      has: page.locator('input[name="agenda-visao"][value="dia"]'),
    });
    await expect(chipDia).toBeVisible();
    await chipDia.click();

    await expect(
      page.getByRole("button", { name: "Dia anterior" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /, \d{1,2} de / })
    ).toBeVisible();
    // coord não agenda — o atalho de mentor não aparece pra ela
    await expect(
      page.getByRole("button", { name: "Agendar neste dia" })
    ).toHaveCount(0);
  });
});
