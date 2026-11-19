import type { Page } from "@playwright/test";
import {
  apiGetApp,
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  expect,
  limparViaServiceRole,
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
const SUPA_URL = process.env.E2E_SUPABASE_URL ?? "";

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

// digest_config (REALIZA-451 / spec 007 US14): a policy coord-only mora no
// banco — o teste chama o PostgREST com o JWT de cada papel (mesmo molde do
// guard de RPC do jovem-agenda), não só pela UI. A row é singleton; o spec
// devolve o staging ao estado em que encontrou.
const CONFIG_COLS =
  "dia_semana,cadencia,destinatarios,secoes,atualizado_por,atualizado_em";

type ConfigRow = {
  dia_semana: number;
  cadencia: string;
  destinatarios: unknown;
  secoes: unknown;
  atualizado_por: string | null;
  atualizado_em: string;
};

/** JWT + apikey do papel logado — o password grant do login devolve os
 *  dois; chamar a REST por fora da UI prova que o guard é a RLS. */
async function credenciaisDaSessao(page: Page, email: string, senha: string) {
  const grant = page.waitForResponse(
    (r) => r.url().includes("grant_type=password"),
    { timeout: 20_000 }
  );
  await loginComSenha(page, email, senha);
  const res = await grant;
  const apiKey = res.request().headers()["apikey"] ?? "";
  const { access_token: token } = (await res.json()) as {
    access_token?: string;
  };
  expect(token).toBeTruthy();
  return { apiKey, token };
}

async function snapshotConfig(): Promise<ConfigRow | null> {
  const rows = await buscarViaServiceRole<ConfigRow[]>(
    "digest_config",
    `select=${CONFIG_COLS}&id=eq.true`
  );
  return rows[0] ?? null;
}

async function restaurarConfig(antes: ConfigRow | null) {
  if (antes) {
    await atualizarViaServiceRole("digest_config", "id=eq.true", {
      dia_semana: antes.dia_semana,
      cadencia: antes.cadencia,
      destinatarios: antes.destinatarios as Record<string, unknown>,
      secoes: antes.secoes as Record<string, unknown>,
    });
  } else {
    await limparViaServiceRole("digest_config", "id=eq.true");
  }
}

test.describe("digest_config — RLS coord-only", () => {
  test("mentor não lê nem escreve a config", async ({ page }) => {
    const antes = await snapshotConfig();
    const { apiKey, token } = await credenciaisDaSessao(
      page,
      MENTOR_EMAIL,
      SENHA
    );
    const req = (method: "GET" | "POST" | "PATCH", corpo?: unknown) =>
      page.request.fetch(`${SUPA_URL}/rest/v1/digest_config?id=eq.true`, {
        method,
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        data: corpo,
      });

    // SELECT filtrado pela using(): sem coord, a tabela é invisível — []
    const sel = await req("GET");
    expect(sel.status()).toBe(200);
    expect(await sel.json()).toEqual([]);

    // INSERT na singleton: o with check recusa antes do conflito de PK
    const ins = await req("POST", {
      id: true,
      cadencia: "desligado",
    });
    expect(ins.status()).not.toBe(201);
    expect((await ins.json()).code).toBeTruthy();

    // UPDATE só alcança row visível: 200 mas [] — nada tocado
    const upd = await req("PATCH", { cadencia: "desligado" });
    expect(upd.status()).toBe(200);
    expect(await upd.json()).toEqual([]);

    // prova final no banco: o estado é exatamente o de antes
    expect(await snapshotConfig()).toEqual(antes);
  });

  test("coord salva pelo card e a config persiste na row", async ({ page }) => {
    const antes = await snapshotConfig();
    try {
      await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
      await page.goto("/relatorios/operacionais?aba=visao");
      await expect(
        page.getByRole("heading", { name: "Configuração do envio" })
      ).toBeVisible();

      // troca a frequência — #digest-cadencia é o SelectTrigger (Base UI)
      await page.locator("#digest-cadencia").click();
      await page
        .getByRole("option", { name: "A cada duas semanas" })
        .click();
      await page
        .getByRole("button", { name: /Salvar configuração/ })
        .click();
      await expect(
        page.getByText(/Configuração salva/)
      ).toBeVisible({ timeout: 15_000 });

      const depois = await snapshotConfig();
      expect(depois?.cadencia).toBe("quinzenal");
      // auditoria: quem salvou foi a coord do fixture
      expect(depois?.atualizado_por).toBeTruthy();
    } finally {
      await restaurarConfig(antes);
    }
  });
});

