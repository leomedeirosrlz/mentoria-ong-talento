import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-117 no modo demo — os quatro instrumentos oficiais da jornada DPP
// (0080) viram formulários nativos. A dupla d-ok (Ricardo × Ana) tem visão,
// metas, PDM e a roda inicial respondidos (WP7 — fixture "jornada
// completa"); a dupla do João Pedro
// (Eduardo) tem links pendentes pra exercitar o /f/<token> público com os
// novos tipos (secao + escala_1_10). Sem writes — spec demo segura.

const DUPLA_OK = "de000000-0000-4000-8000-000000001537"; // Ricardo × Ana
const DUPLA_MATHEUS = "de000000-0000-4000-8000-000000001549"; // Ricardo × Matheus
const TOK_VISAO_EDUARDO = "demo-tok-visao-eduardo-00001";
const TOK_RODA_EDUARDO = "demo-tok-roda-eduardo-000001";

test.describe("demo — instrumentos oficiais da jornada", () => {
  test("ficha da dupla: status por instrumento + resultado estruturado", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${DUPLA_OK}`);

    const sec = page.locator("section", {
      hasText: "Instrumentos da jornada",
    });
    await expect(sec.getByText("Construindo a sua Visão")).toBeVisible();
    await expect(sec.getByText("Definindo Minhas Metas")).toBeVisible();
    await expect(sec.getByText("Roda da Vida")).toBeVisible();

    // quatro respondidos — a roda inicial da Ana entrou na WP7 (fixture
    // "jornada completa"), fechando visão/metas/PDM/roda
    await expect(sec.getByText("respondido", { exact: true })).toHaveCount(4);
    await expect(
      sec.getByRole("button", { name: "Ver resultado" }).first()
    ).toBeVisible();

    // resultado estruturado do PDM — metas com indicador/prazo/submeta,
    // não o dump campo-a-campo. O filtro é pelo título completo: os guias
    // de "Como conduzir" da Visão/Metas citam "PDM" no texto e casariam
    // num hasText solto
    const pdm = sec.locator("li", {
      hasText: "Plano de Desenvolvimento do Mentorado",
    });
    await pdm.getByRole("button", { name: "Ver resultado" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Declaração de Visão")).toBeVisible();
    await expect(dialog.getByText(/Indicador:/).first()).toBeVisible();
    await expect(
      dialog.getByText(/Desdobramento da meta/).first()
    ).toBeVisible();
  });

  test("mentor da dupla: seção visível, enviar responde toast demo", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    // Matheus: visão respondida + roda pendente — metas/PDM seguem
    // "não enviado", que é onde o Enviar vive
    await page.goto(`/duplas/${DUPLA_MATHEUS}`);

    const sec = page.locator("section", {
      hasText: "Instrumentos da jornada",
    });
    await expect(sec.getByText("Definindo Minhas Metas")).toBeVisible();
    await sec.getByRole("button", { name: "Enviar" }).first().click();
    await expect(page.getByText(/Modo demonstração/)).toBeVisible();
  });

  test("/f/<token>: visão numera só perguntas e mostra seções", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto(`/f/${TOK_VISAO_EDUARDO}`);
    await expect(
      page.getByRole("heading", { name: /Construindo a sua Visão/ })
    ).toBeVisible();
    await expect(page.getByText(/Instrumento oficial/)).toBeVisible();
    // 8 campos na definição, 6 são perguntas — 2 'secao' não contam
    await expect(page.getByText(/6 perguntas/)).toBeVisible();
    await expect(page.getByText("Antes de responder")).toBeVisible();
    await expect(
      page.getByText("Sua Declaração de Visão", { exact: true })
    ).toBeVisible();
  });

  test("/f/<token>: roda da vida com quadrantes e escala 1–10", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto(`/f/${TOK_RODA_EDUARDO}`);
    await expect(
      page.getByRole("heading", { name: /Roda da Vida/ })
    ).toBeVisible();
    // os 4 quadrantes são seções — visíveis, mas fora da contagem
    for (const q of [
      "Pessoal",
      "Profissional",
      "Relacionamentos",
      "Qualidade de vida",
    ])
      await expect(
        page.getByRole("heading", { name: q, exact: true })
      ).toBeVisible();
    // 16 áreas (escala 1–10) + reflexão final — seções não contam
    await expect(page.getByText(/17 perguntas/)).toBeVisible();
    await expect(page.getByText("Nada satisfeito").first()).toBeVisible();
    await expect(page.getByText("Muito satisfeito").first()).toBeVisible();
  });
});
