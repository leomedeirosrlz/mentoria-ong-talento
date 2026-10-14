import type { Page } from "@playwright/test";
import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-119 no modo demo — o currículo é o documento mais confidencial da
// ficha do jovem: coordenação gerencia, auxiliar executivo (Paulo) lê só as
// duplas que supervisiona, mentor e o próprio jovem nunca veem. Sem writes —
// spec demo seguro em qualquer ambiente, produção inclusa.

const ANA_ID = "de000000-0000-4000-8000-000000001025"; // M.ana — sup. Paulo, link Drive
const CAIO_ID = "de000000-0000-4000-8000-000000001026"; // M.caio — sup. Paulo, arquivo
const DANDARA_ID = "de000000-0000-4000-8000-000000001027"; // M.dandara — sup. Beatriz

const cardCurriculo = (page: Page) =>
  page.locator("section", {
    has: page.getByRole("heading", { name: "Currículo" }),
  });

test.describe("demo — currículo confidencial do mentorado", () => {
  test("coordenação vê link e arquivo com os controles de gestão", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");

    // Caio tem arquivo no bucket — o card traz o link pro signed URL
    await page.goto(`/pessoas/${CAIO_ID}`);
    const card = cardCurriculo(page);
    await expect(
      card.getByRole("link", { name: "Ver currículo", exact: true })
    ).toHaveAttribute("href", `/api/documento/${CAIO_ID}?tipo=curriculo`);
    // coord gerencia: anexar/substituir arquivo e editar o link externo
    await expect(
      card.getByRole("button", { name: /Anexar arquivo|Substituir arquivo/ })
    ).toBeVisible();

    // Ana tem o link do Drive que veio do matching
    await page.goto(`/pessoas/${ANA_ID}`);
    const cardAna = cardCurriculo(page);
    await expect(
      cardAna.getByRole("link", {
        name: "Abrir link do currículo",
        exact: true,
      })
    ).toHaveAttribute("href", /drive\.google\.com/);

    // o download passa pelo gate da rota — demo devolve o PDF placeholder
    const resp = await page.request.get(
      `/api/documento/${CAIO_ID}?tipo=curriculo`
    );
    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"]).toContain("application/pdf");
  });

  test("auxiliar executivo lê o supervisionado mas não gerencia; fora do escopo é 404", async ({
    page,
  }) => {
    await entrarNaDemo(page, "supervisor");

    // Caio é dupla supervisionada pelo Paulo — leitura liberada
    await page.goto(`/pessoas/${CAIO_ID}`);
    const card = cardCurriculo(page);
    await expect(
      card.getByRole("link", { name: "Ver currículo", exact: true })
    ).toBeVisible();
    // mas a gestão é gesto de coordenação — nada de anexar/editar pra ele
    await expect(
      card.getByRole("button", { name: /Anexar arquivo|Substituir arquivo/ })
    ).toHaveCount(0);
    await expect(card.getByText(/Editar link externo/)).toHaveCount(0);

    // o download também passa — a policy do bucket espelha o recorte
    const ok = await page.request.get(
      `/api/documento/${CAIO_ID}?tipo=curriculo`
    );
    expect(ok.status()).toBe(200);

    // Dandara é supervisionada pela Beatriz: nem a ficha abre (RLS → 404),
    // nem o download por id conhecido — a policy replica o recorte
    await page.goto(`/pessoas/${DANDARA_ID}`);
    await expect(
      page.getByText(/não encontrada|não existe|Página não/i).first()
    ).toBeVisible();
    const negado = await page.request.get(
      `/api/documento/${DANDARA_ID}?tipo=curriculo`
    );
    expect(negado.status()).toBe(404);
  });

  test("mentor abre a ficha do par sem o card de currículo", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/pessoas/${ANA_ID}`);

    // a ficha da Ana abre (o Ricardo é o mentor dela) mas o confidencial
    // nem renderiza — o título da seção é a âncora do card
    await expect(
      page.getByRole("heading", { name: "Ana Beatriz Silva" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Currículo" })
    ).toHaveCount(0);
    await expect(page.getByText(/curriculo/i)).toHaveCount(0);
  });
});
