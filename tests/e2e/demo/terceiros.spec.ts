import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-172 · item 7 — o card "Este link expirou" do /t/[token] é
// alcançável: a RPC terceiro_por_token tem o flip lazy (0105: pendente +
// expira_em < now() → 'expirado' no primeiro acesso) e o dataset demo
// carrega o Diego Fontes já expirado, com o stub espelhando a mesma régua
// pra fixture pendente com prazo vencido.
// Público, sem writes: vale em qualquer deploy, produção inclusive.

// token-fixture do contato expirado (gerado no data: demo-tok-tercero-<nome>)
const TOKEN_EXPIRADO = "demo-tok-tercero-diegofontes";
// e um convite vivo da mesma dupla — o contraste mostra o estado, não o erro
const TOKEN_PENDENTE = "demo-tok-tercero-brunoandrade";

test.describe("demo — /t/[token] estados do convite de terceiros", () => {
  test("link vencido mostra o card 'Este link expirou'", async ({ page }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/t/${TOKEN_EXPIRADO}`);
    await expect(
      page.getByRole("heading", { name: "Este link expirou" })
    ).toBeVisible();
    await expect(
      page.getByText(/O prazo pra responder sobre/)
    ).toBeVisible();
    // a saída honesta do card é falar com a equipe — não reabrir o form
    await expect(
      page.getByRole("link", { name: "Falar com a equipe" })
    ).toHaveAttribute("href", /^mailto:/);
    await expect(page.getByRole("textbox")).toHaveCount(0);
  });

  test("convite pendente abre o form de resposta", async ({ page }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/t/${TOKEN_PENDENTE}`);
    await expect(
      page.getByText("Modo demonstração — respostas não são gravadas.")
    ).toBeVisible();
    // o form do convidado — a saudação usa o primeiro nome do link e o
    // jovem-alvo aparece no título ("Olá, Bruno! Como você vê Ana?")
    await expect(
      page.getByRole("heading", { name: /Olá, Bruno! Como você vê Ana\?/ })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Este link expirou" })
    ).toHaveCount(0);
  });
});
