import type { Page } from "@playwright/test";
import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-199 — /formularios virou a casa dos forms CUSTOM da coordenação:
// os 5 instrumentos da régua DPP (Visão, Metas, PDM, Roda da Vida, 360º)
// saíram daqui e moram na seção "Instrumentos do programa" de /materiais
// (REALIZA-194 — os cards de lá fazem deep-link pras respostas daqui).
// Os oficiais "de bordo" (inscrições, avaliação da trilha, desfecho) ficam
// na prateleira read-only "Instrumentos do sistema" no fim da página. Spec demo: sem writes — o builder roda inteiro em estado
// local (o save falharia por DEMO_MSG, mas não é o que se testa).

const URL_VISAO = "/formularios/de000000-0000-4000-8000-000000016391";

test.describe("demo — /formularios separa customs de instrumentos", () => {
  test("lista só forms custom; bordo na seção própria; régua fora", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/formularios");

    // os 3 forms da coordenação seguem na lista
    for (const titulo of [
      /Avaliação do encontro/,
      /Anamnese social · família e contexto/,
      /Inscrição · ciclo 2026\/2027/,
    ]) {
      await expect(
        page.getByRole("link", { name: titulo })
      ).toBeVisible();
    }

    // a régua DPP saiu da página inteira — nem na lista, nem na seção
    for (const titulo of [
      /Construindo a sua Visão/,
      /Definindo Minhas Metas/,
      /Plano de Desenvolvimento do Mentorado/,
      /Roda da Vida/,
      /Avaliação 360º/,
    ]) {
      await expect(page.getByRole("link", { name: titulo })).toHaveCount(0);
    }

    // os oficiais de bordo moram na prateleira read-only (a anamnese e a
    // autoavaliação do mentor saíram do programa na REALIZA-236)
    const sec = page.locator("section", {
      hasText: "Instrumentos do sistema",
    });
    await expect(sec).toBeVisible();
    await expect(sec.getByRole("listitem")).toHaveCount(4);
    for (const titulo of [
      /Avaliação geral da trilha de especialista/,
      /Inscrição de mentores · Matching de Mentores/,
      /Inscrição de mentorados · Matching de Mentorados/,
      /Avaliação final da mentoria · mentor/,
    ]) {
      await expect(sec.getByRole("link", { name: titulo })).toBeVisible();
    }

    // a ponte pra casa nova dos instrumentos da jornada
    await expect(
      sec.getByRole("link", { name: "Materiais" })
    ).toHaveAttribute("href", "/materiais");
  });

  test("ficha de instrumento da régua aponta de volta pra /materiais", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(URL_VISAO);
    await expect(
      page.getByRole("link", { name: "Instrumentos do programa" })
    ).toHaveAttribute("href", "/materiais");
  });
});

test.describe("demo — builder: numeração e reordenação", () => {
  async function montaForm(page: Page) {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/formularios/novo");
    await page.getByLabel("Texto da pergunta 1").fill("Alpha");
    await page
      .getByRole("button", { name: "Adicionar pergunta", exact: true })
      .click();
    await page.getByLabel("Texto da pergunta 2").fill("Beta");
    await page
      .getByRole("button", { name: "Adicionar pergunta", exact: true })
      .click();
    await page.getByLabel("Texto da pergunta 3").fill("Gama");
  }

  test("seção não consome número: régua de perguntas espelha o /f/<token>", async ({
    page,
  }) => {
    await montaForm(page);

    // o campo 2 vira seção — sai da régua de perguntas e entra na dela.
    // O seletor de tipo é um Base UI Select: o trigger é role=combobox,
    // não button (ARIA 1.2 — select é combobox).
    await page
      .getByRole("combobox", { name: "Tipo da pergunta 2" })
      .click();
    await page
      .getByRole("option", { name: /Seção \(rótulo de estrutura\)/ })
      .click();

    // "Beta" guardou o label e agora é a seção 1; "Gama" virou a pergunta 2
    await expect(page.getByLabel("Título da seção 1")).toHaveValue("Beta");
    await expect(page.getByLabel("Texto da pergunta 1")).toHaveValue("Alpha");
    await expect(page.getByLabel("Texto da pergunta 2")).toHaveValue("Gama");

    // os chips visíveis espelham as duas réguas
    await expect(page.getByText("Seção 1", { exact: true })).toBeVisible();
    await expect(page.getByText("1.", { exact: true })).toBeVisible();
    await expect(page.getByText("2.", { exact: true })).toBeVisible();

    // e a barra conta só perguntas — a seção não pesa no "~min"
    await expect(page.getByText("2 perguntas")).toBeVisible();
  });

  test("menu ⋯ e setas na alça movem o campo — numeração acompanha", async ({
    page,
  }) => {
    await montaForm(page);

    // Gama sobe duas posições pelo menu — [Gama, Alpha, Beta]
    await page
      .getByRole("button", { name: "Ações da pergunta 3" })
      .click();
    await page.getByRole("menuitem", { name: "Mover pra cima" }).click();
    await expect(page.getByLabel("Texto da pergunta 2")).toHaveValue("Gama");

    await page
      .getByRole("button", { name: "Ações da pergunta 2" })
      .click();
    await page.getByRole("menuitem", { name: "Mover pra cima" }).click();
    await expect(page.getByLabel("Texto da pergunta 1")).toHaveValue("Gama");
    await expect(page.getByLabel("Texto da pergunta 2")).toHaveValue("Alpha");
    await expect(page.getByLabel("Texto da pergunta 3")).toHaveValue("Beta");

    // a alça focada também move com seta — segundo caminho de teclado,
    // sem abrir menu (mesmo `move`, mesma live region)
    await page
      .getByRole("button", { name: "Reordenar a pergunta 3" })
      .press("ArrowUp");
    await expect(page.getByLabel("Texto da pergunta 2")).toHaveValue("Beta");
    await expect(page.getByLabel("Texto da pergunta 3")).toHaveValue("Alpha");
  });

  test("alça arrasta o card e a numeração reordena ao vivo", async ({
    page,
  }) => {
    // viewport com folga: alça da 3ª e input da 1ª ficam ~500px distantes;
    // nos 720px default o alvo caía fora da área visível e o drop morria
    // no snap-back do Reorder
    await page.setViewportSize({ width: 1280, height: 960 });
    await montaForm(page);

    // alça dedicada por card — o ⋯ ao lado segue como caminho de menu
    const alcaGama = page.getByRole("button", {
      name: "Reordenar a pergunta 3",
    });
    await expect(alcaGama).toBeVisible();

    // boundingBox() auto-rola cada elemento pra dentro da tela — medir o
    // alvo DEPOIS da alça re-rolava a página e invalidava as coordenadas
    // do agarramento (o pointerdown caía fora da alça, drag nem começava).
    // Mede os dois num único passe por getBoundingClientRect, sem scroll.
    await alcaGama.scrollIntoViewIfNeeded();
    const rect = await page.evaluate(() => {
      const alca = document.querySelector('[aria-label="Reordenar a pergunta 3"]');
      const alvo = document
        .querySelector('[aria-label="Texto da pergunta 1"]')
        ?.closest("li");
      if (!alca || !alvo) return null;
      const a = alca.getBoundingClientRect();
      const b = alvo.getBoundingClientRect();
      return {
        ax: a.x + a.width / 2,
        ay: a.y + a.height / 2,
        bx: b.x + b.width / 2,
        by: b.y + b.height / 2,
      };
    });
    expect(rect).not.toBeNull();
    const { ax, ay, bx, by } = rect!;

    // arrasta Gama (3ª) pra cima de Alpha (1ª): o centro do card arrastado
    // tem que cruzar o centro do irmão — mira o meio do input da 1ª
    await page.mouse.move(ax, ay);
    await page.mouse.down();
    await page.mouse.move(bx, by, { steps: 15 });
    await page.mouse.up();

    await expect(page.getByLabel("Texto da pergunta 1")).toHaveValue("Gama");
    await expect(page.getByLabel("Texto da pergunta 2")).toHaveValue("Alpha");
    await expect(page.getByLabel("Texto da pergunta 3")).toHaveValue("Beta");
  });
});
