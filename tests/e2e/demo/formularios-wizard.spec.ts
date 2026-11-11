import type { Page } from "@playwright/test";
import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-144 — o /f/<token> genérico com ≥2 seções vira wizard "uma seção
// por vez". Os dois lados já existem no fixture: a inscrição de
// mentorados (4 seções, link multi_uso sempre pendente) e a avaliação
// genérica (nenhuma 'secao' → página única). Sem writes de verdade: o
// submit cai no DEMO_MSG e o upload obrigatório da última seção não sobe
// na demo — o recorte aqui é navegação, validação local e o rascunho do
// localStorage. Upload/grid/condicional/payload-parity ficam pros specs
// do projeto app (backend real).

const TOK_INTAKE = "demo-tok-intake-mentorados-001";
const TOK_FLAT = "demo-tok-avalia-generico1";

const secoes = (page: Page) => page.locator("section[data-secao]");

/** §1 da inscrição de mentorados — todas as obrigatórias preenchidas. */
async function preencherSecao1(page: Page) {
  await page.getByLabel(/Nome completo civil/).fill("Ana Beatriz Demo");
  await page.getByLabel(/Data de nascimento/).fill("2004-03-12");
  await page
    .getByLabel(/Gênero/)
    .selectOption({ label: "Cisgênero feminino" });
  await page.getByLabel(/Cor\/raça/).selectOption({ label: "Parda" });
  await page.getByLabel(/município de residência/).fill("São Paulo");
}

/** §2 "Sobre você" — cinco texto_longo obrigatórios. */
async function preencherSecao2(page: Page) {
  await page.getByLabel(/Hobbies/).fill("Correr e ler");
  await page.getByLabel(/mais gosta/).fill("Música e cozinha");
  await page.getByLabel(/Esportes/).fill("Vôlei");
  await page.getByLabel(/Auto-descrição/).fill("Curiosa e persistente");
  await page.getByLabel(/familiares lhe descreveriam/).fill("Determinada");
}

test.describe("demo — wizard por seções no /f/<token> (REALIZA-144)", () => {
  test("4 seções viram uma por vez — régua, montadas-escondidas, sem Voltar na capa", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto(`/f/${TOK_INTAKE}`);

    // capa do form intacta + régua conta seções (não perguntas)
    await expect(
      page.getByRole("heading", { name: /Inscrição de mentorados/ })
    ).toBeVisible();
    await expect(page.getByText("Seção 1 de 4")).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      "Seção 1 de 4"
    );

    // as 4 seções seguem montadas (FormData idêntico ao da página única):
    // só a corrente sai do hidden
    await expect(secoes(page)).toHaveCount(4);
    await expect(secoes(page).nth(0)).toBeVisible();
    for (const i of [1, 2, 3])
      await expect(secoes(page).nth(i)).toBeHidden();

    // só a 1ª seção aparece: cabeçalho dela visível, os das outras no DOM
    await expect(
      secoes(page).nth(0).getByRole("heading", { name: "Dados pessoais" })
    ).toBeVisible();
    await expect(
      secoes(page).nth(1).getByRole("heading", { name: "Sobre você" })
    ).toBeHidden();

    // Voltar some na 1ª seção; a última ainda não oferece envio
    await expect(
      page.getByRole("button", { name: "Voltar" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Avançar" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Enviar resposta" })
    ).toHaveCount(0);
  });

  test("Avançar com obrigatória vazia não sai da seção e marca os campos", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto(`/f/${TOK_INTAKE}`);

    await page.getByRole("button", { name: "Avançar" }).click();

    // ficou na seção 1: aviso local + erro inline nas obrigatórias
    await expect(page.getByText("Seção 1 de 4")).toBeVisible();
    await expect(
      page.getByText("Revise os campos marcados nesta seção.")
    ).toBeVisible();
    // 5 obrigatórias na §1: texto/data levam "responda", selects "escolha"
    await expect(
      page.getByText("Responda esta pergunta.")
    ).toHaveCount(3);
    await expect(page.getByText("Escolha uma opção.")).toHaveCount(2);
  });

  test("Avançar valida só a seção; Voltar volta com tudo preenchido", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto(`/f/${TOK_INTAKE}`);

    await preencherSecao1(page);
    await page.getByRole("button", { name: "Avançar" }).click();

    // seção 2 aberta com o título focado (a11y da troca de capítulo)
    await expect(page.getByText("Seção 2 de 4")).toBeVisible();
    await expect(secoes(page).nth(1)).toBeVisible();
    await expect(secoes(page).nth(0)).toBeHidden();
    await expect(
      secoes(page).nth(1).getByRole("heading", { name: "Sobre você" })
    ).toBeFocused();

    // digita na §2, volta e avança — as duas seções mantêm o preenchido
    await page.getByLabel(/Hobbies/).fill("Correr e ler");
    await page.getByRole("button", { name: "Voltar" }).click();
    await expect(page.getByText("Seção 1 de 4")).toBeVisible();
    await expect(page.getByLabel(/Nome completo civil/)).toHaveValue(
      "Ana Beatriz Demo"
    );
    await page.getByRole("button", { name: "Avançar" }).click();
    await expect(page.getByText("Seção 2 de 4")).toBeVisible();
    await expect(page.getByLabel(/Hobbies/)).toHaveValue("Correr e ler");
  });

  test("formato inválido barra a seção; corrigido libera o Avançar", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto(`/f/${TOK_INTAKE}`);

    await preencherSecao1(page);
    await page.getByRole("button", { name: "Avançar" }).click();
    await preencherSecao2(page);
    await page.getByRole("button", { name: "Avançar" }).click();
    await expect(page.getByText("Seção 3 de 4")).toBeVisible();

    // e-mail irreconhecível → erro de formato, não de "pergunta vazia"
    await page.getByLabel(/E-mail/).fill("sem-arroba");
    await page.getByLabel(/Telefone/).fill("11987654321");
    await page.getByRole("button", { name: "Avançar" }).click();
    await expect(page.getByText("Seção 3 de 4")).toBeVisible();
    await expect(page.getByText(/Confira o e-mail/)).toBeVisible();

    await page.getByLabel(/E-mail/).fill("ana@demo.dev");
    await page.getByRole("button", { name: "Avançar" }).click();
    await expect(page.getByText("Seção 4 de 4")).toBeVisible();
    // última seção: o botão do passo é o envio
    await expect(
      page.getByRole("button", { name: "Enviar resposta" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Avançar" })
    ).toHaveCount(0);
  });

  test("rascunho restaura a seção e os valores no reload", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto(`/f/${TOK_INTAKE}`);

    await preencherSecao1(page);
    await page.getByRole("button", { name: "Avançar" }).click();
    await expect(page.getByText("Seção 2 de 4")).toBeVisible();

    // a etapa viaja no mesmo JSON do rascunho (chave "etapa")
    const rascunho = await page.evaluate((k) => {
      const raw = localStorage.getItem(k);
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    }, `rascunho:/f/${TOK_INTAKE}`);
    expect(rascunho?.etapa).toBe(1);

    await page.reload();

    // reabriu onde parou, com a digitação de volta
    await expect(page.getByText("Seção 2 de 4")).toBeVisible();
    await expect(secoes(page).nth(1)).toBeVisible();
    await page.getByRole("button", { name: "Voltar" }).click();
    await expect(page.getByLabel(/Nome completo civil/)).toHaveValue(
      "Ana Beatriz Demo"
    );
  });

  test("form sem seção segue página única — sem régua nem navegação", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto(`/f/${TOK_FLAT}`);

    await expect(
      page.getByText(/Seção \d+ de \d+/)
    ).toHaveCount(0);
    await expect(secoes(page)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Avançar" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Voltar" })
    ).toHaveCount(0);
    // envio direto e todas as perguntas visíveis de uma vez
    await expect(
      page.getByRole("button", { name: "Enviar resposta" })
    ).toBeVisible();
    await expect(
      page.getByText(/\d+ de \d+ perguntas|\d+ de \d+$/)
    ).toBeVisible();
  });
});
