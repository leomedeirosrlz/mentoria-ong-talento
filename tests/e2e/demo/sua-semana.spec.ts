import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-520 — "Sua semana" nas três homes do demo: o combinado dentro
// do hero do jovem (d-ok tem plano ativo proposto pelo Ricardo), a seção
// fundida no card do mentor e "O que precisa de você" na home do staff
// (d-pend tem proposta da equipe expirando; d-risco tem plano contestado
// ontem). O recesso da T1 não entra: começa em mais de 45 dias.

const D_OK = "de000000-0000-4000-8000-000000001537"; // Ricardo × Ana
const D_PEND = "de000000-0000-4000-8000-000000001538"; // Carlos × Caio
const D_RISCO = "de000000-0000-4000-8000-000000001539"; // Fernanda × Dandara

test.describe("Sua semana — jovem", () => {
  test("o combinado é extensão do hero: status, ritmo, CTAs", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem");
    // o hero da Bia aponta a sessão de especialista (sábado) — o vínculo
    // "este é o Nº" só aparece quando o encontro em destaque é passo do
    // plano (exercido no card do mentor). Aqui ficam status, ritmo,
    // progresso e os gestos no mesmo lugar do hero
    await expect(page.getByText("Plano combinado")).toBeVisible();
    await expect(
      page.getByText("até 2 encontros por semana")
    ).toBeVisible();
    await expect(
      page.getByText(/Próximo: \d+º encontro, sugestão/)
    ).toBeVisible();
    const ver = page.getByRole("link", { name: "Ver o combinado" });
    await expect(ver).toHaveAttribute("href", "/jovem/combinado");
    // janela de contestação aberta (nenhum passo feito depois da proposta)
    await expect(
      page.getByRole("button", { name: "Não serve pra mim" })
    ).toBeVisible();
  });
});

test.describe("Sua semana — mentor", () => {
  test("o card da dupla funde plano + próximo passo, sem banner solto", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/");
    // a seção do card que tem o combinado é a da d-ok (única com plano)
    const semana = page.locator("section", {
      has: page.getByRole("link", { name: "Ver o combinado" }),
    });
    await expect(
      semana.getByRole("heading", { name: "Sua semana" })
    ).toBeVisible();
    await expect(semana.getByText("Plano combinado")).toBeVisible();
    // o mentor propôs — "você combinou", nunca o próprio nome
    await expect(
      semana.getByText(/encontro do plano que você combinou\./)
    ).toBeVisible();
    await expect(
      semana.getByRole("link", { name: "Ver o combinado" })
    ).toHaveAttribute("href", `/duplas/${D_OK}/combinado`);
    // passo pendente → o CTA leva direto pro lugar de confirmar
    await expect(
      semana.getByRole("link", { name: "Confirmar data" })
    ).toHaveAttribute("href", `/duplas/${D_OK}#acordos`);
    // disclosure em linha do próximo passo: o roteiro do número vem do
    // catálogo do papel, sem navegação dropdown
    const disclosure = semana.locator("details", {
      hasText: /Roteiro e materiais do \d+º encontro/,
    });
    await expect(disclosure).toBeVisible();
    await disclosure.locator("summary").click();
    // o roteiro do plano substitui o link do corpus quando existe —
    // nesta dupla, o 6º é o vigente publicado
    await expect(
      disclosure.getByRole("link", { name: /Roteiro do 6º encontro/ })
    ).toHaveAttribute("href", `/duplas/${D_OK}/roteiro/6`);
  });
});

test.describe("O que precisa de você — staff", () => {
  test("coordenação vê expirando antes do contestado, motivo na frente", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/");
    const secao = page.locator("section", {
      has: page.getByRole("heading", { name: "O que precisa de você" }),
    });
    const linhas = secao.locator("li");
    await expect(linhas).toHaveCount(2);
    // expirando ordena antes de contestado — os dias são relativos à
    // data de build do dataset (cache 6h), então a virada do dia não
    // pode derrubar o assert: vale o prefixo, não a contagem
    await expect(linhas.first()).toContainText("Carlos × Caio");
    await expect(linhas.first()).toContainText(/proposta expira/);
    await expect(
      linhas.first().getByRole("link", { name: "Ver a proposta" })
    ).toHaveAttribute("href", `/duplas/${D_PEND}#acordos`);
    await expect(linhas.last()).toContainText("Fernanda × Dandara");
    await expect(linhas.last()).toContainText(/plano contestado/);
    await expect(
      linhas.last().getByRole("link", { name: "Retomar o plano" })
    ).toHaveAttribute("href", `/duplas/${D_RISCO}#acordos`);
  });

  test("âncora do recesso existe na ficha e staff não ganha gesto da dupla", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    // a d-pend (T1) tem recesso sem decisão — a âncora monta nos dois
    // mundos: o card standalone ou o bloco dentro do "ficar em dia"
    await page.goto(`/duplas/${D_PEND}#recesso-dupla`);
    const recesso = page.locator("#recesso-dupla");
    await expect(recesso).toBeVisible();
    await expect(recesso).toContainText(/recesso(s)? (do programa|no caminho)/i);
    // staff acompanha e cobra — os botões de decidir são da dupla (0225)
    await expect(recesso).toContainText(/a decisão é da dupla/i);
    await expect(
      recesso.getByRole("button", { name: /Vamos usar o recesso/ })
    ).toHaveCount(0);
  });

  test("auxiliar vê a mesma lista no escopo dele — só a d-pend", async ({
    page,
  }) => {
    await entrarNaDemo(page, "supervisor");
    await page.goto("/");
    const secao = page.locator("section", {
      has: page.getByRole("heading", { name: "O que precisa de você" }),
    });
    const linhas = secao.locator("li");
    // Paulo supervisiona a d-pend e a T2 inteira; a d-risco é da
    // Beatriz em T1 — fora do escopo dele
    await expect(linhas).toHaveCount(1);
    await expect(linhas.first()).toContainText("Carlos × Caio");
    await expect(
      linhas.first().getByRole("link", { name: "Ver a proposta" })
    ).toHaveAttribute("href", `/duplas/${D_PEND}#acordos`);
  });
});
