import {
  apiGetApp,
  appEnvOk,
  expect,
  loginComSenha,
  relogar,
  test,
} from "../helpers";

// Hub /relatorios + os 6 tipos novos de /api/export (REALIZA-178) contra o
// backend real: 200+CSV+BOM+header por tipo, recorte ?turma=, 403 pra
// mentor/supervisor, abas e prévias do hub e o disparo manual do digest.
const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const COORD_SENHA =
  process.env.E2E_COORD_PASSWORD ?? process.env.E2E_MENTOR_PASSWORD ?? "";
const MENTOR_EMAIL = process.env.E2E_MENTOR_EMAIL ?? "e2e-mentor@realiza.test";
const SUP_EMAIL = "sup-e2e@realiza.test";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";

test.skip(
  !appEnvOk() || !COORD_SENHA,
  "sem credenciais de teste (E2E_*) — pula specs de app"
);

const TIPOS: { tipo: string; header: string }[] = [
  {
    tipo: "aderencia",
    header: "turma;cronograma;trilha;mentor;mentorado;encontros_esperados",
  },
  { tipo: "assinaturas-pendentes", header: "nome;papel;documento;status" },
  { tipo: "interacoes", header: "dupla;tipo;canal;autor;data;nota" },
  {
    tipo: "solicitacoes",
    header: "mentorado;demanda;origem;status;criada_em",
  },
  {
    tipo: "encerramento",
    header: "mentor;mentorado;tipo;checklist;decidido_por",
  },
  {
    tipo: "forms-taxa",
    header: "formulario;destinatario;papel;dupla;origem;emitido_em;respondido",
  },
];

test.describe("/api/export — os 6 tipos novos (coord)", () => {
  test.beforeEach(async ({ page }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
  });

  for (const { tipo, header } of TIPOS) {
    test(`tipo=${tipo} → 200 + text/csv + BOM + header`, async ({ page }) => {
      const r = await apiGetApp(page, `/api/export?tipo=${tipo}`);
      expect(r.status()).toBe(200);
      expect(r.headers()["content-type"]).toContain("text/csv");
      expect(r.headers()["content-disposition"]).toContain(
        `filename="${tipo}-`
      );
      const body = await r.text();
      expect(body.charCodeAt(0)).toBe(0xfeff);
      expect(body).toContain(header.replace(/;/g, '";"'));
    });
  }

  test("?turma= recorta: turma E2E tem linhas, turma inexistente não", async ({
    page,
  }) => {
    const com = await apiGetApp(
      page,
      `/api/export?tipo=aderencia&turma=${encodeURIComponent("Turma E2E")}`
    );
    expect(com.status()).toBe(200);
    const comBody = await com.text();
    const linhasCom = comBody.trim().split("\r\n").length - 1;
    expect(linhasCom).toBeGreaterThanOrEqual(1);

    const sem = await apiGetApp(
      page,
      `/api/export?tipo=aderencia&turma=${encodeURIComponent("Turma Inexistente ZZ")}`
    );
    expect(sem.status()).toBe(200);
    const semBody = await sem.text();
    expect(semBody.trim().split("\r\n")).toHaveLength(1); // só o header
  });

  test("mentor recebe 403; supervisor também", async ({ page }) => {
    // beforeEach já logou coord — troca de papel exige o relogar (limpa o
    // cookie antes, senão /login desvia pra home e o pill nunca aparece)
    await relogar(page, MENTOR_EMAIL, SENHA);
    const rMentor = await apiGetApp(page, "/api/export?tipo=aderencia");
    expect(rMentor.status()).toBe(403);

    await relogar(page, SUP_EMAIL, SENHA);
    const rSup = await apiGetApp(page, "/api/export?tipo=solicitacoes");
    expect(rSup.status()).toBe(403);
  });
});

test.describe("/relatorios — grade principal + hub operacional", () => {
  test.beforeEach(async ({ page }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
  });

  test("?aba= antiga redirecta pra operacionais; inválida cai na default", async ({
    page,
  }) => {
    await page.goto("/relatorios?aba=nao-existe");
    // o deep-link do hub antigo pousa na subpágina, que cai na aba Saúde
    await expect(page).toHaveURL(/\/relatorios\/operacionais\?aba=/);
    await expect(
      page.getByRole("heading", { name: "Saúde do programa" })
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Aderência" })
    ).toBeVisible();
  });

  test("aba aderencia mostra prévia e o CSV aponta o tipo certo", async ({
    page,
  }) => {
    await page.goto("/relatorios/operacionais?aba=aderencia");
    await expect(
      page.getByRole("heading", { name: "Aderência ao ciclo" })
    ).toBeVisible();
    const csv = page.getByRole("link", { name: "Baixar CSV completo" });
    await expect(csv).toBeVisible();
    expect(await csv.getAttribute("href")).toContain(
      "/api/export?tipo=aderencia"
    );
  });

  test("recorte ?turma= entra no link de download", async ({ page }) => {
    await page.goto(
      `/relatorios/operacionais?aba=interacoes&turma=${encodeURIComponent("Turma E2E")}`
    );
    const csv = page.getByRole("link", { name: "Baixar CSV completo" });
    const href = await csv.getAttribute("href");
    expect(href).toContain("tipo=interacoes");
    expect(href).toContain("turma=Turma%20E2E");
  });

  test("/relatorios abre direto na grade livre", async ({ page }) => {
    // o link antigo ?aba=grade também resolve — redirecta pra a página
    // limpa e o RelatorioBuilder renderiza com o "Outros relatórios"
    await page.goto("/relatorios?aba=grade");
    await expect(page).toHaveURL(/\/relatorios$/);
    await expect(page.locator("main")).toContainText("Colunas");
    const outros = page.getByRole("link", { name: "Outros relatórios" });
    await expect(outros).toBeVisible();
    expect(await outros.getAttribute("href")).toBe(
      "/relatorios/operacionais"
    );
  });

  test("digest: disparo manual mostra feedback (enviado ou erro honesto)", async ({
    page,
  }) => {
    await page.goto("/relatorios/operacionais?aba=visao");
    const botao = page.getByRole("button", { name: /Enviar digest agora/ });
    await expect(botao).toBeVisible();
    // RESEND configurado → "Enviado para N de M"; sem envio → a mensagem de
    // transporte honesta. Click re-tentado até a hidratação ligar o handler.
    await expect(async () => {
      await botao.click();
      await expect(
        page.getByText(
          /Enviado para|Nenhum e-mail|não configurado|desativado/i
        )
      ).toBeVisible({ timeout: 15_000 });
    }).toPass({ timeout: 45_000 });
  });
});

