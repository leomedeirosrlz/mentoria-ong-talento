import { entrarNaDemo, expect, test } from "../helpers";

// 0084 — chamados unificados no modo demo: a fila da equipe e os "meus
// pedidos" do autor saem do mesmo dataset. Sem writes — spec demo seguro
// em qualquer ambiente, produção inclusa.

const CH_REGISTRO = "de000000-0000-4000-8000-000000022569"; // CHA-000141
const CH_JOVEM = "de000000-0000-4000-8000-000000022570"; // CHA-000142
const CH_AGENDA = "de000000-0000-4000-8000-000000022571"; // CHA-000143
const CH_PLATAFORMA = "de000000-0000-4000-8000-000000022572"; // CHA-000144

test.describe("demo — chamados (WP1)", () => {
  test("coordenação vê a fila inteira e a conversa com internos", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/chamados");

    await expect(
      page.getByRole("heading", { name: "Chamados", level: 1 })
    ).toBeVisible();
    // a fila: os dois nascidos de flag (registro da Fernanda + pedido do
    // Caio) e o de plataforma da Ana — nada mascarado pra coord
    await expect(page.getByText("CHA-000141")).toBeVisible();
    await expect(page.getByText("CHA-000142")).toBeVisible();
    await expect(page.getByText("CHA-000144")).toBeVisible();
    await expect(
      page.getByText("Não consigo anexar a foto do combinado")
    ).toBeVisible();

    // detalhe do chamado do jovem: origem avaliação + evento de sistema +
    // comentário interno da Marina (só a equipe lê)
    await page.goto(`/chamados?c=${CH_JOVEM}`);
    await expect(
      page.getByText("Avaliação do jovem", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText(/marcou “preciso de ajuda” na avaliação/)
    ).toBeVisible();
    await expect(
      page.getByText(/Caso sensível — o comentário do Caio/)
    ).toBeVisible();

    // o chamado de registro cruza com a flag — contexto do encontro na linha
    await page.goto(`/chamados?c=${CH_REGISTRO}`);
    await expect(
      page.getByText(/o mentor marcou “preciso de apoio” no registro/)
    ).toBeVisible();
    await expect(
      page.getByText(/cruza com o risco da dupla/)
    ).toBeVisible();
  });

  test("auxiliar executivo vê a fila com plataforma mascarada", async ({
    page,
  }) => {
    await entrarNaDemo(page, "supervisor");
    await page.goto("/chamados");

    // linha de plataforma chega mascarada: protocolo sim, conteúdo não
    await expect(page.getByText("CHA-000144")).toBeVisible();
    const linhaPlataforma = page.locator("li", { hasText: "CHA-000144" });
    await expect(
      linhaPlataforma.getByText("Chamado restrito à coordenação")
    ).toBeVisible();
    await expect(
      page.getByText("Não consigo anexar a foto do combinado")
    ).toHaveCount(0);

    // e o detalhe mantém a máscara — sem autor, sem assunto, sem trilha.
    // ("Ana Beatriz" aparece na fila como dupla de OUTROS chamados — a
    // máscara cobre só o CHA-000144: autor, evento de sistema e anexo.)
    await page.goto(`/chamados?c=${CH_PLATAFORMA}`);
    await expect(
      page.getByText("Chamados de plataforma são tratados pela coordenação.")
    ).toBeVisible();
    await expect(linhaPlataforma.getByText(/Ana Beatriz/)).toHaveCount(0);
    await expect(
      page.getByText("Chamado aberto por Ana Beatriz Silva.")
    ).toHaveCount(0);
    await expect(page.getByText("print-do-erro.png")).toHaveCount(0);
    await expect(page.getByText(/Autor: /)).toHaveCount(0);

    // o chamado atribuído ao Paulo (persona supervisor) aparece no "Meus"
    await page.goto("/chamados");
    await page.getByRole("button", { name: "Meus", exact: true }).click();
    await expect(page.getByText("CHA-000145")).toBeVisible();
    await expect(page.getByText("CHA-000141")).toHaveCount(0);
  });

  test("mentor vê só os próprios chamados — nada interno, nada do jovem", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/chamados");

    await expect(
      page.getByRole("heading", { name: "Meus chamados", level: 1 })
    ).toBeVisible();
    // os dois dele: o de agenda em atendimento e o antigo resolvido
    await expect(page.getByText("CHA-000143")).toBeVisible();
    await expect(page.getByText("CHA-000118")).toBeVisible();
    // privacidade do canal do jovem: o chamado do Caio é da DUPLA do
    // mentor Carlos, não do Ricardo — e mesmo assim dupla_id não abre acesso
    await expect(page.getByText("CHA-000142")).toHaveCount(0);
    await expect(page.getByText("CHA-000141")).toHaveCount(0);

    // detalhe: trilha pública (a resposta da Marina) sem o comentário interno
    await page.goto(`/chamados?c=${CH_AGENDA}`);
    await expect(
      page.getByText(/Conversei com a Ana — quinta funciona/)
    ).toBeVisible();
    await expect(page.getByText(/Remarcação simples/)).toHaveCount(0);
    // stepper do "seu pedido" do mock: aberto → em atendimento → resolvido
    await expect(
      page.getByRole("list", { name: "Situação do pedido" })
    ).toBeVisible();
  });

  test("mentorada acompanha os próprios pedidos no perfil", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/perfil");

    await expect(
      page.getByRole("heading", { name: "Meus pedidos de ajuda" })
    ).toBeVisible();
    await expect(page.getByText("CHA-000144")).toBeVisible();

    // detalhe embutido no perfil: só a trilha pública, sem nome de staff
    await page.goto(`/jovem/perfil?c=${CH_PLATAFORMA}`);
    await expect(
      page.getByText("Chamado aberto por Ana Beatriz Silva.")
    ).toBeVisible();
    await expect(page.getByText(/comentário interno/i)).toHaveCount(0);
  });
});
