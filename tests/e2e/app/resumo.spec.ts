import {
  agirComConfirma,
  appEnvOk,
  expect,
  inserirViaServiceRole,
  limparViaServiceRole,
  loginComSenha,
  test,
} from "../helpers";

// REALIZA-167 — o resumo público passa a ser dono do banco: o gate do
// /resumo/[slug] consulta relatorio_links (antes era a constante do slug
// T2 no código) e a fila "Sem dupla" vem de turma_inscricoes (antes o
// array FILA_T2_*). A prova da issue: turma nova = insert, zero deploy —
// o spec cria link+fila de uma turma fake por service role e navega o
// resumo sem login.
//
// Cobertura:
//   * slug válido → renderiza a grade com a linha "Sem dupla" do inscrito
//   * slug inexistente → 404
//   * slug revogado → 404 (idêntico ao inexistente — não vira oráculo)
//   * builder /relatorios: turma com link habilita "Copiar link"; turma
//     sem link desabilita com o hint "cadastre em relatorio_links"
//
// Fixtures _e2e-resumo-* criadas por service role e removidas no afterAll —
// mesmo hard-stop de sempre: E2E_* em prod aborta tudo antes de escrever.

const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const COORD_SENHA =
  process.env.E2E_COORD_PASSWORD || process.env.E2E_MENTOR_PASSWORD || "";

const TURMA = "Turma E2E Resumo";
const TURMA_SEM_LINK = "Turma E2E Semlink";
const SLUG = "e2e-resumo-111-a";
const SLUG_REVOGADO = "e2e-resumo-111-b";
const SLUG_SENHA = "e2e-resumo-170-c";
// bcrypt("e2esenha") pré-gerado — a RPC compara crypt(senha, hash) então
// qualquer hash válido da senha serve de fixture (o banco nunca vê o claro)
const SENHA_E2E = "e2esenha";
const SENHA_HASH_E2E =
  "$2a$06$Dzv.FvJmWlGJ4.z1ej3Lr.M189wAXHR/6Ca4tFG5q6q8D.90vCu3i";
let mentoradoId = "";
let slugCriado = "";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

test.describe("/resumo — gate por relatorio_links + fila turma_inscricoes", () => {
  test.beforeAll(async () => {
    // resíduo de run anterior (o afterAll é best-effort — CI mata processo)
    await limparViaServiceRole("resumo_acessos", `slug=like.e2e-resumo-*`);
    await limparViaServiceRole(
      "turma_inscricoes",
      `turma=in.(${encodeURIComponent(`"${TURMA}","${TURMA_SEM_LINK}"`)})`
    );
    await limparViaServiceRole(
      "relatorio_links",
      `slug=in.("${SLUG}","${SLUG_REVOGADO}","${SLUG_SENHA}")`
    );

    const m = await inserirViaServiceRole("mentorados", {
      nome: "E2E Resumo Jovem",
    });
    mentoradoId = m.id as string;

    // link ativo + link já revogado (o revogado nasce assim de propósito:
    // prova que revogado_em barra mesmo com a row íntegra). `config` é o
    // recorte salvo que a abrir_relatorio serve — a query da URL não é
    // mais lida (170); turma/titulo vêm no shape mínimo da 0111.
    const config = {
      tipo: "grade",
      turma: TURMA,
      granularidade: "pessoas",
    };
    await inserirViaServiceRole("relatorio_links", {
      slug: SLUG,
      turma: TURMA,
      titulo: "Resumo E2E",
      config,
    });
    await inserirViaServiceRole("relatorio_links", {
      slug: SLUG_REVOGADO,
      turma: TURMA,
      titulo: "Resumo E2E revogado",
      config,
      revogado_em: new Date().toISOString(),
    });
    // link com senha (170): o gate público é a prova da issue — sem cookie
    // o visitante cai no form; senha errada vira auditoria, certa abre
    await inserirViaServiceRole("relatorio_links", {
      slug: SLUG_SENHA,
      turma: TURMA,
      titulo: "Resumo E2E com senha",
      config,
      senha_hash: SENHA_HASH_E2E,
    });

    // a prova da issue: inscrever na turma nova é insert — nada de código
    await inserirViaServiceRole("turma_inscricoes", {
      turma: TURMA,
      mentorado_id: mentoradoId,
      papel_esperado: "mentorado",
    });
    // turma irmã SEM link — exercita o botão desabilitado do builder
    await inserirViaServiceRole("turma_inscricoes", {
      turma: TURMA_SEM_LINK,
      mentorado_id: mentoradoId,
      papel_esperado: "mentorado",
    });
  });

  test.afterAll(async () => {
    await limparViaServiceRole("resumo_acessos", `slug=like.e2e-resumo-*`);
    await limparViaServiceRole(
      "turma_inscricoes",
      `turma=in.(${encodeURIComponent(`"${TURMA}","${TURMA_SEM_LINK}"`)})`
    );
    await limparViaServiceRole(
      "relatorio_links",
      `slug=in.("${SLUG}","${SLUG_REVOGADO}","${SLUG_SENHA}"${slugCriado ? `,"${slugCriado}"` : ""})`
    );
    if (mentoradoId)
      await limparViaServiceRole("mentorados", `id=eq.${mentoradoId}`);
  });

  test("slug cadastrado renderiza o resumo com a fila 'Sem dupla'", async ({
    page,
  }) => {
    const res = await page.goto(`/resumo/${SLUG}`);
    expect(res?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Resumo E2E" })
    ).toBeVisible({ timeout: 15_000 });
    // o inscrito aguardando da turma vira linha "Sem dupla" na grade — a
    // RPC abrir_relatorio devolve turma_inscricoes no `dados.inscricoes`
    await expect(page.getByText("E2E Resumo Jovem").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Sem dupla").first()).toBeVisible();
  });

  test("slug inexistente → 404", async ({ page }) => {
    const res = await page.goto("/resumo/e2e-slug-que-nao-existe-111");
    expect(res?.status()).toBe(404);
  });

  test("slug revogado → card neutro 'não está mais disponível' (170)", async ({
    page,
  }) => {
    // a 170 muda a superfície: o shell público informa o estado e a página
    // mostra card neutro em vez de 404 — o detalhe 'revogado' fica na
    // auditoria, não no html
    const res = await page.goto(`/resumo/${SLUG_REVOGADO}`);
    expect(res?.status()).toBe(200);
    await expect(
      page.getByText("não está mais disponível")
    ).toBeVisible();
    await expect(page.getByText("E2E Resumo Jovem")).not.toBeVisible();
  });

  test("builder interno: turma via fila entra no seletor e mostra 'Sem dupla'", async ({
    page,
  }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    await page.goto("/relatorios");

    // a turma existe SÓ na fila (sem dupla nenhuma) — entra no seletor
    // pela união com turma_inscricoes; selecionar mostra a linha do
    // inscrito como "Sem dupla" na grade interna
    await agirComConfirma(
      () => page.getByRole("button", { name: TURMA, exact: true }).click(),
      async () =>
        page.getByRole("button", { name: TURMA, exact: true })
          .getAttribute("aria-pressed")
          .then((v) => v === "true")
    );
    await expect(page.getByText("E2E Resumo Jovem").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Sem dupla").first()).toBeVisible();

    // a publicação do link é da 170 (NovoLinkDialog) — a turma sem link
    // não impede nada: qualquer turma vira relatório novo pelo dialog
    await agirComConfirma(
      () =>
        page.getByRole("button", { name: TURMA_SEM_LINK, exact: true }).click(),
      async () =>
        page.getByRole("button", { name: TURMA_SEM_LINK, exact: true })
          .getAttribute("aria-pressed")
          .then((v) => v === "true")
    );
    await expect(page.getByText("E2E Resumo Jovem").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("button", { name: "Publicar link" })
    ).toBeVisible();
  });

  test("link com senha: sem cookie cai no form, senha errada erra, certa abre", async ({
    page,
  }) => {
    const res = await page.goto(`/resumo/${SLUG_SENHA}`);
    expect(res?.status()).toBe(200);
    // o gate é a superfície pública: form de senha, nada da grade
    await expect(
      page.getByRole("heading", { name: "Relatório protegido" })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("E2E Resumo Jovem")).not.toBeVisible();

    // senha errada: erro amigável — e a tentativa vira linha ok=false
    // 'senha' na auditoria (a RPC grava antes de responder)
    await page.getByLabel("Senha do relatório").fill("errada-0000");
    await page.getByRole("button", { name: "Abrir relatório" }).click();
    await expect(page.getByText("Senha incorreta")).toBeVisible({
      timeout: 15_000,
    });

    // senha certa: o cookie desbloqueia e a grade renderiza
    await page.getByLabel("Senha do relatório").fill(SENHA_E2E);
    await page.getByRole("button", { name: "Abrir relatório" }).click();
    await expect(
      page.getByRole("heading", { name: "Resumo E2E com senha" })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("E2E Resumo Jovem").first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("coordenação publica link pela UI — senha aparece uma vez e abre o gate", async ({
    page,
  }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    await page.goto("/relatorios");

    // o painel de links lista os fixtures — o link sem senha mostra o
    // badge de lembrete ("Sem senha" é o estado de migração do legado)
    await expect(
      page.getByRole("heading", { name: "Links públicos" })
    ).toBeVisible();
    await expect(page.getByText("Resumo E2E").first()).toBeVisible();

    // publica a grade como ela está — o dialog congela o recorte
    await page
      .getByRole("button", { name: TURMA, exact: true })
      .click();
    await page
      .getByRole("button", { name: "Publicar link", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Título").fill("E2E Resumo publicado");
    await dialog
      .getByRole("button", { name: "Publicar link", exact: true })
      .click();

    // a senha aparece UMA vez na tela de sucesso — extrai slug + senha
    await expect(dialog.getByText("Link público")).toBeVisible({
      timeout: 15_000,
    });
    const url = await dialog.locator("code").nth(0).innerText();
    slugCriado = url.split("/resumo/")[1]?.trim() ?? "";
    const senha = (await dialog.locator("code").nth(1).innerText()).trim();
    expect(slugCriado.length).toBeGreaterThanOrEqual(12);
    expect(senha).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    await dialog.getByRole("button", { name: "Concluir" }).click();

    // o link novo entra no painel já Ativo
    await expect(page.getByText("E2E Resumo publicado")).toBeVisible({
      timeout: 15_000,
    });

    // e a senha devolvida abre o gate público de verdade
    await page.goto(`/resumo/${slugCriado}`);
    await expect(
      page.getByRole("heading", { name: "Relatório protegido" })
    ).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Senha do relatório").fill(senha);
    await page.getByRole("button", { name: "Abrir relatório" }).click();
    await expect(
      page.getByRole("heading", { name: "E2E Resumo publicado" })
    ).toBeVisible({ timeout: 15_000 });
  });
});
