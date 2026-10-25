import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-172 — a página pública de assinatura no modo demo:
//   · a faixa "Demonstração: nada aqui é assinado de verdade." no topo (a
//     mesma etiqueta das irmãs /t e /f — vale no form e nos cards de estado)
//   · o ramo `outra_pessoa` (0070) finalmente exercitável: o stub agora
//     espelha a regra da RPC — a persona logada só abre documento
//     endereçado a ela
//
// Tokens-fixture do dataset (uid estável):
//   · uid(0x3407) — termo-mentorando da Isabela: ela não tem login, então
//     pra QUALQUER papel o doc é "de outra pessoa" — é O token
//     determinístico do ramo (documentado no data.ts)
//   · uid(0x3406) — termo-voluntario do Ricardo: a persona mentor_dpp é a
//     destinatária → o form abre; os outros papéis veem o card
//   · uid(0x3404) — autorização do Kauã: o signatário é o responsável,
//     que nunca tem conta — a demo trata o link como aberto por ele
//     ('anon'), mantendo o único form de autorização visível
// Público, sem writes: vale em qualquer deploy, produção inclusive.

const TOKEN_ISABELA = "de000000-0000-4000-8000-000000013319"; // uid(0x3407)
const TOKEN_RICARDO = "de000000-0000-4000-8000-000000013318"; // uid(0x3406)
const TOKEN_KAUA = "de000000-0000-4000-8000-000000013316"; // uid(0x3404)
const FAIXA = "Demonstração: nada aqui é assinado de verdade.";

test.describe("demo — /assinar/[token] (REALIZA-172)", () => {
  test("outra_pessoa: token da Isabela resolve o card pra qualquer papel", async ({
    page,
  }) => {
    for (const papel of ["coordenacao", "mentorado"] as const) {
      await entrarNaDemo(page, papel);
      await page.goto(`/assinar/${TOKEN_ISABELA}`);
      await expect(
        page.getByRole("heading", { name: "Este link é de outra pessoa" })
      ).toBeVisible();
      await expect(page.getByText("Isabela Ferreira")).toBeVisible();
      // a faixa também marca os cards de estado — demo é demo
      await expect(page.getByText(FAIXA)).toBeVisible();
      // e nada de form por baixo do bloqueio
      await expect(
        page.getByRole("button", { name: /Assinar/ })
      ).toHaveCount(0);
    }
  });

  test("próprio destinatário abre o form — Ricardo vê o termo dele, com a faixa", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/assinar/${TOKEN_RICARDO}`);
    await expect(
      page.getByRole("heading", {
        name: "Termo de Adesão ao Trabalho Voluntário",
        level: 1,
      })
    ).toBeVisible();
    await expect(page.getByText(FAIXA)).toBeVisible();

    // o mesmo token pra outra persona vira o card — a coordenação não é a
    // destinatária do termo do Ricardo
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/assinar/${TOKEN_RICARDO}`);
    await expect(
      page.getByRole("heading", { name: "Este link é de outra pessoa" })
    ).toBeVisible();
    await expect(page.getByText("Ricardo Tavares")).toBeVisible();
  });

  test("autorização segue abrindo o form (o responsável não tem conta)", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/assinar/${TOKEN_KAUA}`);
    await expect(
      page.getByRole("heading", {
        name: "Autorização do Responsável",
        level: 1,
      })
    ).toBeVisible();
    await expect(page.getByText(/responsável por Kauã/i)).toBeVisible();
    await expect(page.getByText(FAIXA)).toBeVisible();
  });

  test("sem o cookie demo a faixa não aparece (rota real)", async ({ page }) => {
    // token desconhecido → a RPC real devolve null → "Link inválido" — e
    // nenhuma etiqueta de simulação, porque não é demo
    await page.goto(`/assinar/${TOKEN_ISABELA}`);
    await expect(
      page.getByRole("heading", { name: "Link inválido" })
    ).toBeVisible();
    await expect(page.getByText(FAIXA)).toHaveCount(0);
  });
});
