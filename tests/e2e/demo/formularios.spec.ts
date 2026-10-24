import type { Page } from "@playwright/test";
import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-199 — /formularios virou a casa dos forms CUSTOM da coordenação:
// os 5 instrumentos da régua DPP (Visão, Metas, PDM, Roda da Vida, 360º)
// saíram daqui e moram na seção "Instrumentos do programa" de /materiais
// (REALIZA-194 — os cards de lá fazem deep-link pras respostas daqui).
// Os oficiais "de bordo" (anamnese, inscrições, autoavaliação, avaliação
// da trilha) ficam na prateleira read-only "Instrumentos do sistema" no
// fim da página. Spec demo: sem writes — o builder roda inteiro em estado
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

    // os 4 oficiais de bordo moram na prateleira read-only
    const sec = page.locator("section", {
      hasText: "Instrumentos do sistema",
    });
    await expect(sec).toBeVisible();
    await expect(sec.getByRole("listitem")).toHaveCount(4);
    for (const titulo of [
      /Anamnese Social/,
      /Autoavaliação do mentor/,
      /Avaliação geral da trilha de especialista/,
      /Inscrição de mentores · Matching de Mentores/,
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

    // o campo 2 vira seção — sai da régua de perguntas e entra na dela
    await page
      .getByRole("button", { name: "Tipo da pergunta 2" })
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
    await montaForm(page);

    // alça dedicada por card — o ⋯ ao lado segue como caminho de menu
    const alcaGama = page.getByRole("button", {
      name: "Reordenar a pergunta 3",
    });
    await expect(alcaGama).toBeVisible();
    const alvo = page.getByLabel("Texto da pergunta 1");
    const bAlca = await alcaGama.boundingBox();
    const bAlvo = await alvo.boundingBox();
    expect(bAlca).not.toBeNull();
    expect(bAlvo).not.toBeNull();

    // arrasta Gama (3ª) pra cima de Alpha (1ª): o centro do card arrastado
    // tem que cruzar o centro do irmão — mira o meio do input da 1ª
    await page.mouse.move(
      bAlca!.x + bAlca!.width / 2,
      bAlca!.y + bAlca!.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(bAlvo!.x + bAlvo!.width / 2, bAlvo!.y, {
      steps: 15,
    });
    await page.mouse.up();

    await expect(page.getByLabel("Texto da pergunta 1")).toHaveValue("Gama");
    await expect(page.getByLabel("Texto da pergunta 2")).toHaveValue("Alpha");
    await expect(page.getByLabel("Texto da pergunta 3")).toHaveValue("Beta");
  });
});
