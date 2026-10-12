import {
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  expect,
  jwtDoUsuario,
  loginComSenha,
  relogar,
  restComoUsuario,
  test,
} from "../helpers";

// Diretório do jovem (REALIZA-113 / migration 0076) contra backend real:
//   * /jovem/pessoas lista o colega de turma COM conta — a ficha dele vem da
//     view mentorados_turma (colega = divide turma de dupla, sem filtro de
//     status — a pausada do jovem2 basta) e o WhatsApp fica atrás do opt-in
//     contato_compartilhado;
//   * o toggle mora no /jovem/perfil do DONO (RPC set_contato_compartilhado)
//     — ligar na UI libera o botão WhatsApp do outro lado;
//   * profiles_select apertado: staff não-coord não lê profile role=mentorado
//     fora das duplas dele — conferido na UI (/pessoas) e com o JWT real dele
//     no PostgREST;
//   * a RPC recusa quem não é o próprio jovem (status ≥ 400 com o JWT do
//     mentor).
//
// Fixtures do seed e2e: o "Jovem E2E Sem DPP" (profile …00f0 → ficha …00d0)
// ganhou whatsapp + uma dupla DPP pausada …00f2 (mentor …00e2) na mesma
// turma do jovem — vira colega com conta sem perder a triagem "sem DPP
// ativa" dos specs de pedido. contato_compartilhado converge a false no
// piso de cada spec (e no afterAll) — o opt-in nunca vaza entre runs.
const JOVEM_EMAIL = process.env.E2E_JOVEM_EMAIL ?? "jovem-e2e@realiza.test";
const JOVEM2_EMAIL = process.env.E2E_JOVEM2_EMAIL ?? "jovem2-e2e@realiza.test";
const MENTOR_EMAIL = process.env.E2E_MENTOR_EMAIL ?? "e2e-mentor@realiza.test";
// mesmo segredo compartilhado do mentor — um secret a menos no CI
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";

const IDS = {
  jovemProfile: "e2e00000-0000-4000-8000-0000000000b0",
  jovem2Profile: "e2e00000-0000-4000-8000-0000000000f0",
  mentoradoSemDpp: "e2e00000-0000-4000-8000-0000000000d0", // a ficha do jovem2
  duplaColega: "e2e00000-0000-4000-8000-0000000000f2",
} as const;
const JOVEM2_WHATSAPP = "5511999000091";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

/** Piso do spec: o opt-in desligado, o whatsapp da ficha e a dupla pausada
 *  no lugar — idempotente (PATCH sem row casa nada; quem cria é o seed).
 *  Um run morto com o toggle ligado vazaria "compartilhado" pro teste da
 *  contagem zero — por isso a convergência roda por spec, não só no seed. */
async function restaurarColega() {
  await atualizarViaServiceRole(
    "mentorados",
    `id=eq.${IDS.mentoradoSemDpp}`,
    { contato_compartilhado: false, whatsapp: JOVEM2_WHATSAPP }
  );
  await atualizarViaServiceRole("duplas", `id=eq.${IDS.duplaColega}`, {
    status: "pausada",
    encerrada_em: null,
    motivo_encerramento: null,
  });
}

test.describe("diretório do jovem (REALIZA-113 / 0076)", () => {
  test.beforeEach(restaurarColega);
  test.afterAll(restaurarColega);

  test("colegas da turma lista o colega com conta — contato fechado até o opt-in", async ({
    page,
  }) => {
    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem/pessoas");

    const colegas = page.locator('section[aria-labelledby="colegas-titulo"]');
    // a view entrega a ficha (mentorados.nome), não o login — "Jovem E2E Sem
    // DPP" é o nome das duas coisas no seed
    const linha = colegas.locator("li", { hasText: "Jovem E2E Sem DPP" });
    await expect(linha).toBeVisible();
    // opt-in fechado: o card existe, mas o contato não viaja — nunca um
    // botão wa.me com número null
    await expect(linha.getByText("não compartilhou o contato")).toBeVisible();
    await expect(
      linha.getByRole("link", { name: /WhatsApp/ })
    ).toHaveCount(0);

    // colega sem conta (profile_id null) nem entra no diretório — as duas
    // outras fichas e2e são esse caso
    await expect(colegas.getByText("Mentorada E2E Dois")).toHaveCount(0);
    await expect(colegas.getByText("Mentorada E2E Livre")).toHaveCount(0);
  });

  test("o colega liga o próprio toggle no perfil e o WhatsApp aparece", async ({
    page,
  }) => {
    // lado do DONO: a ficha tem whatsapp (seed), então o switch vem
    // habilitado — o gesto dele decide o que o colega vê
    await loginComSenha(page, JOVEM2_EMAIL, SENHA);
    await page.goto("/jovem/perfil");
    await expect(
      page.getByRole("heading", { name: "Privacidade" })
    ).toBeVisible();
    const sw = page.getByRole("switch", {
      name: /Compartilhar meu WhatsApp/,
    });
    await expect(sw).toBeEnabled();
    await sw.click();
    await expect(
      page.getByText("Seu WhatsApp agora aparece pros colegas da turma.")
    ).toBeVisible();

    // o write passou pelo banco de verdade (RPC definer no próprio papel)
    const [ficha] = await buscarViaServiceRole<{
      contato_compartilhado: boolean;
    }[]>(
      "mentorados",
      `select=contato_compartilhado&id=eq.${IDS.mentoradoSemDpp}`
    );
    expect(ficha.contato_compartilhado).toBe(true);

    // e o diretório dele espelha a simetria: o jovem (ficha "Mentorada E2E")
    // é colega dele de volta — com o contato ainda fechado
    await page.goto("/jovem/pessoas");
    const linhaJovem = page
      .locator('section[aria-labelledby="colegas-titulo"]')
      .locator("li", { hasText: "Mentorada E2E" });
    await expect(linhaJovem).toBeVisible();
    await expect(
      linhaJovem.getByText("não compartilhou o contato")
    ).toBeVisible();

    // lado do COLEGA: relogado como jovem, o opt-in destravou o botão —
    // href aponta pro número da ficha, não um wa.me vazio
    await relogar(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem/pessoas");
    const wa = page
      .locator('section[aria-labelledby="colegas-titulo"]')
      .locator("li", { hasText: "Jovem E2E Sem DPP" })
      .getByRole("link", { name: /WhatsApp/ });
    await expect(wa).toBeVisible();
    await expect(wa).toHaveAttribute(
      "href",
      new RegExp(`wa\\.me/${JOVEM2_WHATSAPP}`)
    );
  });

  test("staff não lê profile de mentorado fora da própria dupla", async ({
    page,
  }) => {
    await loginComSenha(page, MENTOR_EMAIL, SENHA);
    await page.goto("/pessoas");
    await expect(
      page.getByRole("heading", { name: "Pessoas", level: 1 })
    ).toBeVisible();

    // o jovem DA DUPLA dele aparece (profile e ficha são coisas distintas:
    // "Jovem E2E" em Mentores e equipe, "Mentorada E2E" em Mentorados)
    await expect(page.getByText("Jovem E2E").first()).toBeVisible();
    await expect(page.getByText("Mentorada E2E").first()).toBeVisible();
    // o outro jovem logado não é de dupla dele — some das duas seções
    await expect(page.getByText("Jovem E2E Sem DPP")).toHaveCount(0);
    // e as fichas e2e sem vínculo com ele também
    await expect(page.getByText("Mentorada E2E Livre")).toHaveCount(0);
    await expect(page.getByText("Mentorada E2E Dois")).toHaveCount(0);

    // a fronteira de verdade é a policy — com o JWT do mentor no PostgREST,
    // profiles?role=mentorado devolve só o jovem relacionado
    const jwt = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    const res = await restComoUsuario(
      "profiles?select=id&role=eq.mentorado",
      jwt
    );
    expect(res.status).toBe(200);
    const jovens = (await res.json()) as { id: string }[];
    expect(jovens.map((j) => j.id)).toEqual([IDS.jovemProfile]);

    // e o diretório de colegas é papel mentorado — staff recebe lista vazia,
    // não erro (o WHERE da view simplesmente não casa)
    const resDir = await restComoUsuario(
      "mentorados_turma?select=id",
      jwt
    );
    expect(resDir.status).toBe(200);
    expect(await resDir.json()).toEqual([]);
  });

  test("set_contato_compartilhado recusa quem não é o próprio jovem", async () => {
    const jwt = await jwtDoUsuario(MENTOR_EMAIL, SENHA);
    const res = await restComoUsuario("rpc/set_contato_compartilhado", jwt, {
      method: "POST",
      body: { p_ligado: true },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const erro = (await res.json()) as { message?: string };
    expect(erro.message ?? "").toContain("Só o próprio jovem");

    // o dono passa — mesma RPC, papel mentorado (o caminho da UI testado
    // acima, conferido na borda do PostgREST também)
    const jwtJovem = await jwtDoUsuario(JOVEM2_EMAIL, SENHA);
    const ok = await restComoUsuario(
      "rpc/set_contato_compartilhado",
      jwtJovem,
      { method: "POST", body: { p_ligado: true } }
    );
    // void RPC → PostgREST devolve 204; o assert é "passou", não o número
    expect(ok.ok).toBe(true);
    // deixa o opt-in como achou — o spec é rerodável mesmo se o afterAll
    // não rodar (crash no meio) — o beforeEach também re-converge
    await atualizarViaServiceRole(
      "mentorados",
      `id=eq.${IDS.mentoradoSemDpp}`,
      { contato_compartilhado: false }
    );
  });
});
