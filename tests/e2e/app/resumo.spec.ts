import {
  agirComConfirma,
  appEnvOk,
  expect,
  inserirViaServiceRole,
  limparViaServiceRole,
  loginComSenha,
  test,
} from "../helpers";

// REALIZA-167/170/201 — o resumo público é dono do banco: o gate do
// /resumo/[slug] consulta relatorio_links e a fila "Sem dupla" vem de
// turma_inscricoes. A prova da 167: turma nova = insert, zero deploy — o
// spec cria link+fila de uma turma fake por service role e navega o
// resumo sem login. A 201 desce a gestão pro "Compartilhar" da toolbar do
// builder e soma os três caminhos de senha (gerada, digitada, nenhuma).
//
// Cobertura:
//   * slug válido → renderiza a grade com a linha "Sem dupla" do inscrito
//   * slug inexistente → 404
//   * slug revogado → card neutro (não vira oráculo)
//   * builder: turma via fila entra no seletor e mostra "Sem dupla"
//   * gate de senha: form → erro amigável → senha certa abre
//   * Compartilhar: criar link da grade atual (senha gerada aparece 1×)
//   * senha digitada abre o gate; "Redefinir senha" gira e a velha morre
//   * "Link sem senha" abre direto; revogar tira o ar na hora
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
const slugsCriados: string[] = [];

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
    if (slugsCriados.length)
      await limparViaServiceRole(
        "resumo_acessos",
        `slug=in.(${slugsCriados.map((s) => `"${s}"`).join(",")})`
      );
    await limparViaServiceRole(
      "turma_inscricoes",
      `turma=in.(${encodeURIComponent(`"${TURMA}","${TURMA_SEM_LINK}"`)})`
    );
    await limparViaServiceRole(
      "relatorio_links",
      `slug=in.("${SLUG}","${SLUG_REVOGADO}","${SLUG_SENHA}"${slugsCriados.length ? `,${slugsCriados.map((s) => `"${s}"`).join(",")}` : ""})`
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
    // Next 16 streama notFound() como 200 no documento (o status real só
    // fica 404 em build de produção servindo a página estática) — o assert
    // honesto é a UI de 404, que é a mesma em dev/preview/prod
    const res = await page.goto("/resumo/e2e-slug-que-nao-existe-111");
    expect(res?.status()).toBe(200);
    await expect(page.getByText("Página não encontrada")).toBeVisible();
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

    // a publicação do link é da 170/201 (menu "Compartilhar") — a turma
    // sem link não impede nada: qualquer turma vira relatório novo ali
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
      page.getByRole("button", { name: "Compartilhar" })
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

  test("Compartilhar: cria link da grade atual — senha gerada aparece 1× e abre o gate", async ({
    page,
  }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    await page.goto("/relatorios");

    // o "Compartilhar" da toolbar concentra criar + gerir — o card
    // permanente de links não existe mais na página
    await page.getByRole("button", { name: TURMA, exact: true }).click();
    await page.getByRole("button", { name: "Compartilhar" }).click();
    // popover aberto: os fixtures já publicados aparecem na lista
    await expect(page.getByText("Resumo E2E").first()).toBeVisible();
    await expect(page.getByText("Links ·").first()).toBeVisible();

    await page.getByRole("button", { name: "Novo link público" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // o dialog importa o recorte DA TELA — a turma clicada no builder é a
    // do seletor aqui dentro (a reabertura re-semeia: não é o mount da
    // página que manda, é o estado atual da grade). O seletor é um Select
    // do Base UI → role combobox com nome vindo do Label "Turma".
    await expect(
      dialog.getByRole("combobox", { name: "Turma" })
    ).toContainText(TURMA);
    await expect(dialog.getByText("Recorte do link")).toBeVisible();
    await expect(
      dialog.getByText(TURMA, { exact: true }).first()
    ).toBeVisible();

    await dialog.getByLabel("Título do link").fill("E2E Resumo publicado");
    // senha em branco → a RPC gera a forte de sempre e devolve 1×
    await dialog.getByRole("button", { name: "Criar link" }).click();

    // a senha aparece UMA vez na tela de sucesso — extrai slug + senha.
    // O marcador de estágio é o heading "Link criado": "Link público" como
    // substring case-insensitive resolve o h2 "Novo link público" + o aviso
    // LGPD ("…menor em link público") enquanto a RPC ainda voa (30s — a
    // action + router.refresh() passam de 15s em runner frio).
    await expect(
      dialog.getByRole("heading", { name: "Link criado" })
    ).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByText("Link público")).toBeVisible();
    const url = await dialog.locator("code").nth(0).innerText();
    const slug = url.split("/resumo/")[1]?.trim() ?? "";
    const senha = (await dialog.locator("code").nth(1).innerText()).trim();
    expect(slug.length).toBeGreaterThanOrEqual(12);
    expect(senha).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    slugsCriados.push(slug);
    await dialog.getByRole("button", { name: "Concluir" }).click();

    // o link novo entra na lista do Compartilhar já Ativo
    await page.getByRole("button", { name: "Compartilhar" }).click();
    await expect(page.getByText("E2E Resumo publicado")).toBeVisible({
      timeout: 15_000,
    });

    // "Ver acessos" abre o log por evento (resumo_acessos) — as entradas
    // de fixture dos slugs e2e-resumo-* aparecem
    await page.getByRole("button", { name: "Ver acessos" }).click();
    const acessos = page.getByRole("dialog", { name: "Acessos aos links" });
    await expect(acessos).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");

    // e a senha devolvida abre o gate público de verdade
    await page.goto(`/resumo/${slug}`);
    await expect(
      page.getByRole("heading", { name: "Relatório protegido" })
    ).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Senha do relatório").fill(senha);
    await page.getByRole("button", { name: "Abrir relatório" }).click();
    await expect(
      page.getByRole("heading", { name: "E2E Resumo publicado" })
    ).toBeVisible({ timeout: 15_000 });
  });

  test("senha digitada abre o gate — e 'Redefinir senha' aposenta a anterior (201)", async ({
    page,
  }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    await page.goto("/relatorios");

    await page.getByRole("button", { name: "Compartilhar" }).click();
    await page.getByRole("button", { name: "Novo link público" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Título do link").fill("E2E Senha digitada");
    await dialog.getByLabel("Senha de acesso").fill("secreta-2026");
    await dialog.getByRole("button", { name: "Criar link" }).click();

    await expect(
      dialog.getByRole("heading", { name: "Link criado" })
    ).toBeVisible({ timeout: 30_000 });
    const url = await dialog.locator("code").nth(0).innerText();
    const slug = url.split("/resumo/")[1]?.trim() ?? "";
    const senhaVolta = (
      await dialog.locator("code").nth(1).innerText()
    ).trim();
    slugsCriados.push(slug);
    // o que a coordenação digitou é o que volta — senha escolhida, não gerada
    expect(senhaVolta).toBe("secreta-2026");
    await dialog.getByRole("button", { name: "Concluir" }).click();

    // a senha escolhida abre o gate — o cookie fica com ela
    await page.goto(`/resumo/${slug}`);
    await page.getByLabel("Senha do relatório").fill("secreta-2026");
    await page.getByRole("button", { name: "Abrir relatório" }).click();
    await expect(
      page.getByRole("heading", { name: "E2E Senha digitada" })
    ).toBeVisible({ timeout: 15_000 });

    // rotação pelo menu: "Redefinir senha" gera a forte e troca o hash na
    // hora — a página revalida o cookie a cada render, então o visitante
    // com a senha velha cai no form sem aviso no próximo acesso
    await page.goto("/relatorios");
    await page.getByRole("button", { name: "Compartilhar" }).click();
    const card = page
      .locator("li")
      .filter({ has: page.locator("code", { hasText: slug }) })
      .last();
    await card
      .getByRole("button", { name: "Redefinir senha" })
      .click();
    // a rotação é irreversível (a senha atual morre na hora) — pede
    // confirmação, como o Revogar
    await page
      .getByRole("dialog", { name: "Redefinir senha do link" })
      .getByRole("button", { name: "Redefinir" })
      .click();
    await expect(card.getByText("Nova senha")).toBeVisible({
      timeout: 15_000,
    });
    const novaSenha = (
      await card.getByText("Nova senha").locator("..").locator("code").innerText()
    ).trim();
    expect(novaSenha).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);

    // cookie tem a senha VELHA: recarregar a página revalida e cai no form
    await page.goto(`/resumo/${slug}`);
    await expect(
      page.getByRole("heading", { name: "Relatório protegido" })
    ).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Senha do relatório").fill(novaSenha);
    await page.getByRole("button", { name: "Abrir relatório" }).click();
    await expect(
      page.getByRole("heading", { name: "E2E Senha digitada" })
    ).toBeVisible({ timeout: 15_000 });
  });

  test("'Link sem senha' abre direto — e revogar pelo menu tira o ar (201)", async ({
    page,
  }) => {
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    await page.goto("/relatorios");

    await page.getByRole("button", { name: "Compartilhar" }).click();
    await page.getByRole("button", { name: "Novo link público" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Título do link").fill("E2E Sem senha");

    // opt-in explícito: o toggle avisa que qualquer um com o endereço abre
    await dialog
      .getByRole("switch", { name: "Link sem senha" })
      .click();
    await expect(dialog.getByLabel("Senha de acesso")).toBeDisabled();
    await expect(
      dialog.getByText(/Todo o recorte fica visível/)
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Criar link" }).click();

    // sucesso sem segredo: só o link, sem código de senha
    await expect(
      dialog.getByRole("heading", { name: "Link criado" })
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      dialog.getByText("ele abre direto, sem senha")
    ).toBeVisible();
    const url = await dialog.locator("code").nth(0).innerText();
    const slug = url.split("/resumo/")[1]?.trim() ?? "";
    expect(slug.length).toBeGreaterThanOrEqual(12);
    slugsCriados.push(slug);
    expect(await dialog.locator("code").count()).toBe(1);
    await dialog.getByRole("button", { name: "Concluir" }).click();

    // sem cookie, sem senha: a página pública abre direto o relatório
    await page.goto(`/resumo/${slug}`);
    await expect(
      page.getByRole("heading", { name: "E2E Sem senha" })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "Relatório protegido" })
    ).not.toBeVisible();

    // revogação pelo Compartilhar: confirmar tira o ar na hora — o
    // próximo acesso vê o card neutro, não a grade
    await page.goto("/relatorios");
    await page.getByRole("button", { name: "Compartilhar" }).click();
    const card = page
      .locator("li")
      .filter({ has: page.locator("code", { hasText: slug }) })
      .last();
    await card.getByRole("button", { name: "Revogar" }).click();
    await page
      .getByRole("dialog", { name: "Revogar link público" })
      .getByRole("button", { name: "Revogar" })
      .click();
    await expect(page.getByText("Link revogado.")).toBeVisible({
      timeout: 15_000,
    });

    await page.goto(`/resumo/${slug}`);
    await expect(page.getByText("não está mais disponível")).toBeVisible({
      timeout: 15_000,
    });
  });
});
