import { randomUUID } from "node:crypto";
import {
  appEnvOk,
  buscarViaServiceRole,
  expect,
  inserirViaServiceRole,
  limparViaServiceRole,
  test,
} from "../helpers";

// REALIZA-509 (R23) — os cards terminais de /assinar/<token> contra
// backend real. Cada teste semeia uma assinatura DESCARTÁVEL na Mentorada
// E2E Livre (…0080 — nenhuma assinatura no seed) e apaga no afterEach.
// O alvo não é o mentorado …0020: as rows a1/a2 dele ocupam os templates
// e o índice assinaturas_viva_uk (0053) só admite uma row pendente|
// assinado por alvo×template — fixture em cima de fixture explode no
// insert. `mentorado_id` (não `profile_id`) evita o trigger
// assinaturas_termo_ok mexer no termo_ok de ninguém. Service role só
// cria/limpa a fixture; a visita é anônima — a rota é pública e o token
// é o fator de posse.
const MENTORADO_ID = "e2e00000-0000-4000-8000-000000000080";
const COORD_ID = "e2e00000-0000-4000-8000-000000000040";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

const criados: string[] = [];

test.beforeEach(async () => {
  // toda assinatura do …0080 é deste spec — um run abortado que deixou
  // row pra trás não pode derrubar o próximo (o índice viva_uk recusa o
  // segundo pendente/assinado do mesmo alvo×template)
  await limparViaServiceRole(
    "assinaturas",
    `mentorado_id=eq.${MENTORADO_ID}`
  );
});

test.afterEach(async () => {
  if (criados.length) {
    await limparViaServiceRole(
      "assinaturas",
      `id=in.(${criados.join(",")})`
    );
    criados.length = 0;
  }
});

/** Template ativo por slug — mesmo lookup do seed (o banco já tem os três). */
async function templateId(slug: string) {
  const [t] = await buscarViaServiceRole<{ id: string }[]>(
    "documento_templates",
    `select=id&slug=eq.${slug}&ativo=eq.true&limit=1`
  );
  if (!t) throw new Error(`template ${slug} ausente no backend de teste`);
  return t.id;
}

/** Assinatura descartável com token único — devolve a row criada. */
async function semearAssinatura(campos: Record<string, unknown>) {
  const row = await inserirViaServiceRole("assinaturas", {
    template_id: await templateId("termo-mentorando"),
    mentorado_id: MENTORADO_ID,
    token: randomUUID(),
    created_by: COORD_ID,
    ...campos,
  });
  criados.push(String(row.id));
  return row;
}

test.describe("/assinar/[token] — cards terminais (R23)", () => {
  test("assinado → 'Documento assinado' com a via pra baixar", async ({
    page,
  }) => {
    const a = await semearAssinatura({
      status: "assinado",
      assinado_em: new Date().toISOString(),
      assinatura_texto: "Jovem E2E",
      dados_snapshot: {
        nome_civil: "Mentorada E2E",
        data_nascimento: "2008-05-10",
      },
    });
    await page.goto(`/assinar/${a.token}`);

    await expect(
      page.getByRole("heading", { name: "Documento assinado" })
    ).toBeVisible();
    await expect(page.getByText(/já foi assinado/)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^Baixar a via do documento/ })
    ).toHaveAttribute("href", `/api/assinar-token/${a.token}`);
    // card terminal: nada de form por baixo
    await expect(page.getByRole("button", { name: /Assinar/ })).toHaveCount(0);
  });

  test("revogado → 'Documento cancelado'", async ({ page }) => {
    const a = await semearAssinatura({ status: "revogado" });
    await page.goto(`/assinar/${a.token}`);

    await expect(
      page.getByRole("heading", { name: "Documento cancelado" })
    ).toBeVisible();
    await expect(
      page.getByText(/cancelado pela coordenação/)
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Assinar/ })).toHaveCount(0);
  });

  test("pendente vencido → a RPC faz o flip lazy e o card é 'Link expirado'", async ({
    page,
  }) => {
    const a = await semearAssinatura({
      status: "pendente",
      // emitido há 40 dias com validade de 30 — venceu faz 10
      token_expira_em: new Date(Date.now() - 10 * 86400e3).toISOString(),
    });
    await page.goto(`/assinar/${a.token}`);

    await expect(
      page.getByRole("heading", { name: "Link expirado" })
    ).toBeVisible();
    await expect(
      page.getByText(/prazo deste link de assinatura terminou/)
    ).toBeVisible();

    // o flip é lazy mas real: o primeiro acesso marcou a row — não é só
    // o retorno da RPC dizendo "expirado" de mentira
    const [row] = await buscarViaServiceRole<{ status: string }[]>(
      "assinaturas",
      `select=status&id=eq.${a.id}`
    );
    expect(row.status).toBe("expirado");
  });

  test("token malformado → 'Link inválido' sem sair da página", async ({
    page,
  }) => {
    // charset ok, tamanho errado — o TOKEN_RE rejeita antes de qualquer RPC
    await page.goto("/assinar/abc123");
    await expect(
      page.getByRole("heading", { name: "Link inválido" })
    ).toBeVisible();
  });

  test("uuid bem-formado sem row → 'Link inválido'", async ({ page }) => {
    await page.goto(`/assinar/${randomUUID()}`);
    await expect(
      page.getByRole("heading", { name: "Link inválido" })
    ).toBeVisible();
  });
});
