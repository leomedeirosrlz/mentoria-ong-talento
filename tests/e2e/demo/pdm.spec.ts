import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-189 — cobertura e2e do PDM vivo (aceite §F.36–37 da 181) no modo
// demo. O dataset (src/lib/demo/pdm-data.ts) conta a história das respostas
// de instrumento da Ana: d-ok tem o documento completo — visão, 3 metas com
// submetas (2 já atingidas) e 1 descartada no histórico; d-risco só tem a
// Declaração de Visão — o empty state honesto de quem ainda não chegou nas
// Metas. Read-only por fora dos gestos: toda escrita devolve o toast do
// modo demo — o toast É o assert, não uma limitação do stub.
const DUPLA_OK = "de000000-0000-4000-8000-000000001537"; // Ricardo × Ana
const DUPLA_RISCO = "de000000-0000-4000-8000-000000001539"; // Fernanda × Dandara
const SECAO = 'section[aria-label="Plano de desenvolvimento"]';

test.describe("demo — PDM vivo (REALIZA-181)", () => {
  // §F.36 — ficha com PDM fixture: a árvore inteira renderiza (metas,
  // submetas, atingidas, histórico); os controles de edição existem pro
  // papel que editaria, mas o gesto devolve o toast do modo demo.
  test("mentor: árvore completa renderiza e o gesto responde o toast demo", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/duplas/${DUPLA_OK}`);

    const secao = page.locator(SECAO);
    await expect(
      secao.getByRole("heading", { name: "Plano de desenvolvimento" })
    ).toBeVisible();

    // Declaração de Visão — escrita pela resposta do instrumento Visão
    await expect(secao.getByText("Declaração de Visão")).toBeVisible();
    await expect(
      secao.getByText(/Em até 3 anos, serei uma profissional formada/)
    ).toBeVisible();

    // régua de progresso — nenhuma meta raiz batida ainda (o aria-label
    // da barra é o texto atômico; o <p> quebra os números em spans)
    await expect(
      secao.getByRole("img", { name: "0 de 3 metas atingidas" })
    ).toBeVisible();

    // a árvore: as 3 metas com os metadados do plano
    const arvore = secao.locator('ul[role="tree"]').first();
    await expect(
      arvore.getByText("Subir a média de matemática pra 7,0")
    ).toBeVisible();
    await expect(
      arvore.getByText("Conseguir um jovem aprendiz até dezembro")
    ).toBeVisible();
    await expect(
      arvore.getByText("Fazer o simulado completo do ENEM sem zerar nenhuma área")
    ).toBeVisible();
    await expect(secao.getByText("Carreira e trabalho").first()).toBeVisible();
    await expect(
      secao.getByText(/Média 7,0 ou mais no boletim/)
    ).toBeVisible();
    await expect(secao.getByText(/até \d{2} de/).first()).toBeVisible();

    // submetas — a árvore abre o 1º nível por padrão; duas já batidas
    // carimbam "atingida em <data>"
    await expect(
      arvore.getByText("30 min de exercícios toda terça e quinta")
    ).toBeVisible();
    await expect(
      arvore.getByText("Montar o currículo com a Luana da ONG")
    ).toBeVisible();
    await expect(secao.getByText(/atingida em/).first()).toBeVisible();
    await expect(
      secao.getByRole("group").getByRole("treeitem").first()
    ).toBeVisible();

    // histórico — a meta que saiu do plano na revisão fica guardada
    const historico = secao.locator("details", {
      hasText: "meta descartada",
    });
    await expect(
      historico.getByText(/1 meta descartada — fora do plano/)
    ).toBeVisible();
    await historico.locator("summary").click();
    await expect(
      historico.getByText("Apresentar um trabalho sem ler os slides")
    ).toBeVisible();
    await expect(
      historico.getByText("Descartada", { exact: true })
    ).toBeVisible();

    // controles do papel que editaria — CTA, círculo de status e o ⋯
    await expect(
      secao.getByRole("button", { name: "Nova meta" })
    ).toBeVisible();
    await expect(
      secao.getByRole("button", { name: "Editar" })
    ).toBeVisible(); // a da Declaração de Visão
    await expect(
      secao.getByRole("checkbox", {
        name: 'Marcar "Conseguir um jovem aprendiz até dezembro" como atingida',
      })
    ).toBeVisible();
    await expect(
      secao.getByRole("button", {
        name: 'Ações de "Conseguir um jovem aprendiz até dezembro"',
      })
    ).toBeVisible();

    // F.36 — o gesto existe mas a escrita é bloqueada: o círculo devolve o
    // toast do modo demonstração (convenção DEMO_MSG das actions)
    await secao
      .getByRole("checkbox", {
        name: 'Marcar "Fazer o simulado completo do ENEM sem zerar nenhuma área" como atingida',
      })
      .click();
    await expect(
      page.getByText(/No modo demonstração/).first()
    ).toBeVisible();

    // o ⋯ abre o menu de ações do nó — submeta, prioridade, descarte
    await secao
      .getByRole("button", {
        name: 'Ações de "Conseguir um jovem aprendiz até dezembro"',
      })
      .click();
    await expect(
      page.getByRole("menuitem", { name: "Adicionar submeta" })
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Subir na prioridade" })
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Descartar (fica no histórico)" })
    ).toBeVisible();
  });

  // §F.37 — o mesmo documento na mão da jovem: /jovem/pdm acha a dupla DPP
  // viva dela e renderiza o PDM com edição (o portal é o canal de escrita
  // dela — mesma árvore, mesmos gestos).
  test("mentorado: /jovem/pdm abre o mesmo documento com edição", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/pdm");

    const secao = page.locator(SECAO);
    await expect(
      secao.getByRole("heading", { name: "Plano de desenvolvimento" })
    ).toBeVisible();
    await expect(
      secao.getByText(/Em até 3 anos, serei uma profissional formada/)
    ).toBeVisible();
    await expect(
      secao.getByText("Subir a média de matemática pra 7,0")
    ).toBeVisible();
    await expect(
      secao.getByText("Conseguir um jovem aprendiz até dezembro")
    ).toBeVisible();

    // podeEditar=true pra ela — CTA e ações de nó presentes
    await expect(
      secao.getByRole("button", { name: "Nova meta" })
    ).toBeVisible();
    await expect(
      secao.getByRole("button", {
        name: 'Ações de "Subir a média de matemática pra 7,0"',
      })
    ).toBeVisible();
  });

  // staff lê o documento inteiro — mas sem nenhum controle de edição (o
  // podeEditar=false do JSX: sem círculo, sem ⋯, sem CTA, sem "Editar").
  test("coordenação: lê a árvore inteira sem controle de edição", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${DUPLA_OK}`);

    const secao = page.locator(SECAO);
    await expect(
      secao.getByText("Subir a média de matemática pra 7,0")
    ).toBeVisible();
    await expect(
      secao.getByText("30 min de exercícios toda terça e quinta")
    ).toBeVisible();
    await expect(
      secao.getByText(/1 meta descartada — fora do plano/)
    ).toBeVisible();

    await expect(secao.getByRole("checkbox")).toHaveCount(0);
    await expect(
      secao.getByRole("button", { name: /^Ações de / })
    ).toHaveCount(0);
    await expect(
      secao.getByRole("button", { name: "Nova meta" })
    ).toHaveCount(0);
    await expect(
      secao.getByRole("button", { name: "Editar" })
    ).toHaveCount(0);
    await expect(
      secao.getByRole("button", { name: "Escrever a Declaração de Visão" })
    ).toHaveCount(0);
  });

  // d-risco tem a Declaração de Visão escrita no enc. 1 mas nenhuma meta —
  // o estado vazio real do documento (não é ausência de PDM: é doc com
  // itens []). A CTA "Adicionar a primeira meta" só aparece pra quem edita
  // — a dupla dela é Fernanda × Dandara e nenhuma persona da demo é a
  // Fernanda, então pra staff o empty state vem sem CTA. Comportamento
  // correto: staff não planta meta por um jovem.
  test("dupla sem metas: visão escrita + estado vazio, sem CTA pra staff", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${DUPLA_RISCO}`);

    const secao = page.locator(SECAO);
    await expect(
      secao.getByRole("heading", { name: "Plano de desenvolvimento" })
    ).toBeVisible();
    await expect(
      secao.getByText(/Em 3 anos, serei técnica de enfermagem empregada/)
    ).toBeVisible();
    await expect(
      secao.getByText("Nenhuma meta no plano ainda")
    ).toBeVisible();
    await expect(
      secao.getByText(/As metas chegam pelos instrumentos Metas e PDM/)
    ).toBeVisible();
    await expect(
      secao.getByRole("button", { name: "Adicionar a primeira meta" })
    ).toHaveCount(0);
  });
});
