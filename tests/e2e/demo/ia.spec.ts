import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-382 — /ia em modo demo: o painel inteiro responde sem sessão e
// sem provider — seção "Modelo de IA" (roteador por tier) com dados de
// exemplo e a aba Evals servida pelo dataset determinístico de
// lib/demo/ia-evals (runs prontos + um "na fila" que o laço dirige de
// verdade via cookie demo_eval).

test("demo /ia: seção Modelo de IA mostra o roteador com dados de exemplo", async ({
  page,
}) => {
  await entrarNaDemo(page, "coordenacao");
  await page.goto("/ia");

  const secao = page.getByRole("region", { name: "Modelo de IA" });
  await expect(secao).toBeVisible();
  await expect(
    secao.getByText(/Roteamento automático: a pergunta escolhe o tier/)
  ).toBeVisible();

  // os três tiers com os slugs do dataset demo
  await expect(
    secao.getByRole("heading", { name: "Rápido" })
  ).toBeVisible();
  await expect(
    secao.getByRole("heading", { name: "Balanceado" })
  ).toBeVisible();
  await expect(
    secao.getByRole("heading", { name: "Forte" })
  ).toBeVisible();
  await expect(secao.getByText("glm-5.3-flash")).toBeVisible();
  await expect(
    secao.getByText("deepseek-v4.1-flash").first()
  ).toBeVisible();
  await expect(secao.getByText("deepseek-v4-pro")).toBeVisible();

  // cadeia de reserva explícita (balanceado) e implícita (forte→médio)
  await expect(secao.getByText("mimo-v2.6-flash")).toBeVisible();
});

test("demo /ia: aba Evals lista runs de exemplo e o laço executa", async ({
  page,
}) => {
  test.setTimeout(60_000); // o laço roda item a item com pausa simulada
  await entrarNaDemo(page, "coordenacao");
  await page.goto("/ia?aba=evals");

  // a aba existe na demo (antes do 382 ela sumia e a API 401ava)
  await expect(
    page.getByRole("heading", { name: "Evals da Liza" })
  ).toBeVisible();
  await expect(page.getByText("Runs recentes")).toBeVisible();
  await expect(page.getByText("3 runs")).toBeVisible();

  // os dois prontos mostram pass rate; o "na fila" tem o botão Continuar
  // ("% passou" concatena sem espaço no card — "92%passou" na a11y tree)
  await expect(page.getByText(/\d+%\s*passou/).first()).toBeVisible();
  const continuar = page.getByRole("button", {
    name: "Continuar",
    exact: true,
  });
  await expect(continuar).toHaveCount(1);
  await continuar.click();

  // o detalhe abre e o laço dirige: 10 itens saem da fila um por POST —
  // prova de que o cookie demo_eval avança sem Supabase nem provider
  // (o card também mostra "rodando…" — o contador do dossiê tem o "N/10 ·")
  await expect(page.getByText(/· rodando…/)).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Itens executados" })
  ).toHaveAttribute("aria-valuenow", "10", { timeout: 45_000 });
  await expect(page.getByText(/\d+%\s*passou/).first()).toBeVisible();
});
