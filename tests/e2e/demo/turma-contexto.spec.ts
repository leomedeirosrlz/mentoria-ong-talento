import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-73 — contexto de turma no demo (fase A): hub da home, seletor
// "Turma em foco", cookie turma_foco + ?turma= na URL e a aterrissagem da
// /duplas. Read-only — seguro em qualquer deploy, produção inclusa (o
// cookie turma_foco é conveniência de UI, nunca autorização).

const T1 = "T1 · 2026/2027";
const T2 = "T2 · 2026/2027";
const T2_URL = `/?turma=${encodeURIComponent(T2)}`;

/** valor decodificado do cookie turma_foco (null = ausente/apagado) */
async function cookieTurma(page: import("@playwright/test").Page) {
  const cs = await page.context().cookies();
  const c = cs.find((k) => k.name === "turma_foco");
  if (!c || !c.value) return null;
  try {
    return decodeURIComponent(c.value);
  } catch {
    return c.value;
  }
}

async function esperaCookie(page: import("@playwright/test").Page, v: string | null) {
  await expect
    .poll(() => cookieTurma(page), { timeout: 5_000 })
    .toBe(v);
}

test.describe("demo — contexto de turma (REALIZA-73 · fase A)", () => {
  test("hub na home, clicar T2 filtra, cookie persiste, /duplas pousa com chip, ver todas restaura", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/");

    // (1) sem contexto: hub com T1+T2 e o seletor "Turma em foco" em "Todas"
    const hub = page.locator('section[aria-label="Turmas"]');
    await expect(hub).toBeVisible();
    const cards = hub.locator('a[href^="/?turma="]');
    await expect(cards).toHaveCount(2);
    await expect(cards.filter({ hasText: "Turma 1" })).toBeVisible();
    await expect(cards.filter({ hasText: "Turma 2" })).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Turma em foco" })
    ).toBeVisible();

    // (2) clicar o card da T2 filtra a home — URL honesta + faixa + cookie
    await cards.filter({ hasText: "Turma 2" }).click();
    await page.waitForURL(/\?turma=/);
    expect(decodeURIComponent(page.url())).toContain(`turma=${T2}`);
    await expect(
      page.getByRole("status").filter({ hasText: /Mostrando: Turma 2/ })
    ).toBeVisible();
    // o card da turma em foco é o contexto ativo
    await expect(cards.filter({ hasText: "Turma 2" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    // os atalhos de situação carregam a turma — pousam na /duplas já filtrada
    await expect(
      page.locator('a[href*="/duplas?turma="]').first()
    ).toBeVisible();
    await esperaCookie(page, T2);

    // (3) navegar pra /duplas: o chip da T2 já vem ativo (contexto é inicial)
    await page.goto("/duplas");
    // a página tem dois grupos com chip "Todas" (situação e turma) —
    // o grupo "Filtrar por turma" desambigua
    const grupoTurma = page.getByRole("group", { name: "Filtrar por turma" });
    const chipT2 = grupoTurma.locator("button[aria-pressed]").filter({
      hasText: "Turma 2",
    });
    await expect(chipT2).toHaveAttribute("aria-pressed", "true");
    // ...e o contexto não trava — o chip local continua livre
    const chipTodas = grupoTurma
      .locator("button[aria-pressed]")
      .filter({ hasText: "Todas" });
    await chipTodas.click();
    await expect(chipTodas).toHaveAttribute("aria-pressed", "true");
    await esperaCookie(page, null); // "Todas" apaga o foco

    // (4) "ver todas" na home também restaura (o caminho do cookie T2)
    await page.goto(T2_URL);
    await esperaCookie(page, T2);
    await page.getByRole("link", { name: "ver todas" }).click();
    await page.waitForURL(/\?turma=todas/);
    await esperaCookie(page, null);
    await expect(hub).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "Mostrando:" })
    ).toHaveCount(0);
  });

  test("URL vence cookie; lixo cai em todas sem erro; seletor troca em lugar", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");

    // cookie T1 + URL T2 → URL vence e o cookie é reescrito (sync)
    await page.goto("/demo");
    await page.context().addCookies([
      {
        name: "turma_foco",
        value: encodeURIComponent(T1),
        url: page.url(),
      },
    ]);
    await page.goto(T2_URL);
    await expect(
      page.getByRole("status").filter({ hasText: /Mostrando: Turma 2/ })
    ).toBeVisible();
    await esperaCookie(page, T2);

    // trocar pelo seletor — mesma gravação, sem sair da página. A URL já
    // tem ?turma= (estamos no foco T2): esperar pelo valor novo, não pelo
    // param — /turma=/ resolveria na hora e correria com o router.replace
    await page.getByRole("combobox", { name: "Turma em foco" }).click();
    await page.getByRole("option", { name: /^Turma 1/ }).click();
    await page.waitForURL((url) =>
      decodeURIComponent(url.href).includes(`turma=${T1}`)
    );
    await esperaCookie(page, T1);

    // param lixo → todas, sem erro, cookie preservado
    await page.goto("/?turma=turma-que-nao-existe");
    await expect(
      page.getByRole("heading", { name: /Olá,/, level: 1 })
    ).toBeVisible();
    await expect(page.locator('section[aria-label="Turmas"]')).toBeVisible();
    await esperaCookie(page, T1); // link errado não destrói a preferência
  });

  test("auxiliar vê só as turmas do escopo; mentor não vê nada; demo_role segue independente", async ({
    page,
  }) => {
    // Paulo supervisiona duplas da T1 e da T2 (e uma histórica "2025/2026"
    // sem cronograma — não é navegável). Seletor com escopo, sem hub.
    await entrarNaDemo(page, "supervisor");
    await page.goto("/");
    const seletorSup = page.getByRole("combobox", { name: "Turma em foco" });
    await expect(seletorSup).toBeVisible();
    await expect(
      page.locator('section[aria-label="Turmas"]')
    ).toHaveCount(0);
    await seletorSup.click();
    const opcoes = page.getByRole("option");
    await expect(opcoes).toHaveCount(3); // Todas + T1 + T2 — nunca a alheia
    await expect(opcoes.filter({ hasText: "2025/2026" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // foco do auxiliar recorta a home dele e a /duplas chega filtrada
    await page.goto(T2_URL);
    await expect(
      page.getByRole("status").filter({ hasText: /Mostrando: Turma 2/ })
    ).toBeVisible();
    await esperaCookie(page, T2);
    await page.goto("/duplas");
    await expect(
      page.getByRole("status").filter({ hasText: /Mostrando: Turma 2/ })
    ).toBeVisible();

    // mentor nunca vê seletor/hub — nem com ?turma= na URL (papel sem
    // contexto ignora param e cookie). E o demo_role troca de papel
    // normalmente com turma_foco presente: cookies independentes.
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(T2_URL);
    await expect(
      page.getByRole("combobox", { name: "Turma em foco" })
    ).toHaveCount(0);
    await expect(page.locator('section[aria-label="Turmas"]')).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible();
  });
});
