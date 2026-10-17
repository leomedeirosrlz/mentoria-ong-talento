import {
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  expect,
  limparViaServiceRole,
  loginComSenha,
  test,
} from "../helpers";

// Shell do mentorado (REALIZA-108) contra backend real. Fixtures do
// scripts/seed-e2e-staging.mjs: profile jovem com senha, a ficha da
// mentorada da dupla …0030 vinculada a ele, um combinado pendente (e um do
// mentor, que a view jovem_encaminhamentos não expõe), um encontro futuro e
// as assinaturas pendentes (termo do mentorado + autorização do responsável).
// Specs escrevem de verdade — o piso re-converge a fixture antes de cada um
// e o afterAll sai do mapa pro próximo arquivo da suíte.
const JOVEM_EMAIL = process.env.E2E_JOVEM_EMAIL ?? "jovem-e2e@realiza.test";
// mesmo segredo compartilhado do mentor — um secret a menos no CI
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";

const IDS = {
  jovemProfile: "e2e00000-0000-4000-8000-0000000000b0",
  combinado: "e2e00000-0000-4000-8000-0000000000c1",
  encontro: "e2e00000-0000-4000-8000-0000000000d1",
  mentorProfile: "e2e00000-0000-4000-8000-000000000010",
  coordProfile: "e2e00000-0000-4000-8000-000000000040",
} as const;

// as descrições moram no seed — se mudarem lá, mudam aqui
const COMBINADO_JOVEM = "Ler o capítulo 3 do guia até o próximo encontro";
const COMBINADO_MENTOR = "Mentor prepara material de revisão";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

/** Piso entre specs (e retries): combinado pendente e encontro com data
 *  futura — o seed cria; aqui só re-converge o que um teste muda ou um run
 *  morto deixou sujo (PATCH em row ausente é no-op, quem cria é o seed). */
async function restaurarJovem() {
  await atualizarViaServiceRole(
    "encaminhamentos",
    `id=eq.${IDS.combinado}`,
    { status: "pendente" }
  );
  await atualizarViaServiceRole("encontros", `id=eq.${IDS.encontro}`, {
    data_hora: new Date(Date.now() + 3 * 86400e3).toISOString(),
    status: "agendado",
  });
}

test.describe("mentorado — shell /jovem", () => {
  test.beforeEach(async ({ page }) => {
    await restaurarJovem();
    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    // o login despeja em "/" (grupo app), que devolve o mentorado pro shell
    // dele — esperar o destino fixa o ponto de partida de cada spec
    await page.waitForURL((u) => u.pathname === "/jovem", { timeout: 15_000 });
  });

  test.afterAll(async () => {
    // a home do mentor olha a MESMA dupla: um agendado fixture pendurado
    // trocaria o CTA "Agendar encontro" por "Agendar próximo" e quebraria o
    // spec dele — os encontros da dupla voltam a zero (o seed recria o d1)
    // Filhos da 0071 primeiro: se o d1 passou por 'realizado' o trigger
    // mintou avaliacao_links (e o spec pode ter avaliado) — apagar o pai
    // direto dá 409 na FK.
    await limparViaServiceRole(
      "avaliacoes_encontro",
      `encontro_id=eq.${IDS.encontro}`
    );
    await limparViaServiceRole(
      "avaliacao_links",
      `encontro_id=eq.${IDS.encontro}`
    );
    await limparViaServiceRole("encontros", `id=eq.${IDS.encontro}`);
    await atualizarViaServiceRole(
      "encaminhamentos",
      `id=eq.${IDS.combinado}`,
      { status: "pendente" }
    );
    // pedidos de ajuda do spec — cada destinatário (incl. coords reais do
    // staging) sai junto pelo created_by; o chamado aberto pelo dialog e
    // a trilha pública dele vão em cascata
    await limparViaServiceRole(
      "notificacoes",
      `created_by=eq.${IDS.jovemProfile}`
    );
    await limparViaServiceRole(
      "chamados",
      `autor_id=eq.${IDS.jovemProfile}`
    );
  });

  test("login cai na home do jovem e rotas de staff devolvem pra ela", async ({
    page,
  }) => {
    // o beforeEach já pousou em /jovem — a home apresenta a dupla dele
    await expect(
      page.getByRole("heading", { name: /Olá, Jovem/ })
    ).toBeVisible();
    const mentoria = page.locator('section[aria-labelledby="dupla-titulo"]');
    await expect(mentoria.getByText("Mentor E2E")).toBeVisible();
    await expect(mentoria.getByText("Seu mentor")).toBeVisible();

    // qualquer rota do grupo (app) devolve o mentorado pro shell próprio —
    // incluindo a home de staff
    for (const rota of ["/", "/pessoas", "/agenda", "/duplas"]) {
      await page.goto(rota);
      await page.waitForURL((u) => u.pathname === "/jovem", {
        timeout: 15_000,
      });
    }
  });

  test("home lista o combinado do jovem e esconde o do mentor", async ({
    page,
  }) => {
    await page.goto("/jovem");
    const combinados = page.locator(
      'section[aria-labelledby="combinados-titulo"]'
    );
    await expect(combinados.getByText(COMBINADO_JOVEM)).toBeVisible();
    // o filtro é da view (responsavel='mentorado'): nem no DOM entra
    await expect(combinados.getByText(COMBINADO_MENTOR)).toHaveCount(0);
  });

  test("home mostra o próximo encontro e os documentos pendentes", async ({
    page,
  }) => {
    await page.goto("/jovem");
    const encontros = page.locator(
      'section[aria-labelledby="encontros-titulo"]'
    );
    // a home mostra só o PRÓXIMO encontro (futuros[0]) — em run paralelo a
    // trilha esp ou outro spec pode pôr um mais perto; o assert é "o card de
    // próximo existe", não "é o nº 8"
    await expect(encontros.getByText(/\d+º encontro/)).toBeVisible();

    const docs = page.locator('section[aria-labelledby="docs-titulo"]');
    await expect(
      docs.getByText(
        "Termo de Adesão e Participação no Programa de Mentoria Social"
      )
    ).toBeVisible();
    await expect(docs.getByRole("link", { name: "Assinar" })).toBeVisible();
    await expect(docs.getByText("Autorização do Responsável")).toBeVisible();
    await expect(
      docs.getByRole("link", { name: /Encaminhar para o responsável/ })
    ).toBeVisible();
  });

  test("marcar combinado persiste via RPC marcar_combinado", async ({
    page,
  }) => {
    await page.goto("/jovem");
    const combinados = page.locator(
      'section[aria-labelledby="combinados-titulo"]'
    );
    const checkbox = combinados.getByRole("checkbox");
    // o input é sr-only — o clique honesto é no label que o embrulha
    await combinados
      .locator("label", { hasText: COMBINADO_JOVEM })
      .click();
    await expect(
      page.getByText("Combinado marcado como feito.")
    ).toBeVisible();
    await expect(checkbox).toBeChecked();
    // o router.refresh re-renderizou — e o estado sobrevive a um reload de
    // verdade (write passou pelo banco, não por estado local)
    await page.reload();
    await expect(
      page
        .locator('section[aria-labelledby="combinados-titulo"]')
        .getByRole("checkbox")
    ).toBeChecked();
  });

  test("pedir ajuda abre chamado e avisa a equipe — nunca o mentor", async ({
    page,
  }) => {
    await page.goto("/jovem");
    await page.getByRole("button", { name: "Pedir ajuda" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // 0084: o canal de segurança é um chamado — opção na linguagem dele
    await dialog
      .getByRole("button", { name: /Com meu mentor/ })
      .click();
    await dialog
      .locator("#chamado-assunto")
      .fill("E2E: preciso falar com alguém da equipe");
    await dialog
      .locator("#chamado-mensagem")
      .fill("E2E: preciso falar com meu mentor");
    await dialog.getByRole("button", { name: "Enviar pedido" }).click();

    await expect(page.getByText(/equipe foi avisada/)).toBeVisible();
    await expect(dialog).not.toBeVisible();

    // write real: o chamado existe com o jovem como autor (a equipe vê
    // quem pediu — é canal de segurança, não anônimo)
    const [chamado] = await buscarViaServiceRole<
      { id: string; numero: string; autor_id: string }[]
    >(
      "chamados",
      `select=id,numero,autor_id&autor_id=eq.${IDS.jovemProfile}&order=created_at.desc&limit=1`
    );
    expect(chamado.numero).toMatch(/^CHA-\d{6}$/);

    // a equipe foi avisada no sino — o mentor da dupla NÃO entra na lista:
    // o pedido pode ser justamente sobre ele (privacidade do canal)
    const rows = await buscarViaServiceRole<{ profile_id: string }[]>(
      "notificacoes",
      `select=profile_id&tipo=eq.chamado_aberto&href=eq./chamados%3Fc%3D${chamado.id}`
    );
    const destinos = rows.map((r) => r.profile_id);
    expect(destinos).toContain(IDS.coordProfile);
    expect(destinos).not.toContain(IDS.mentorProfile);
  });

  test("agenda lista o encontro futuro", async ({ page }) => {
    await page.goto("/jovem/agenda");
    await expect(
      page.getByRole("heading", { name: "Agenda", level: 1 })
    ).toBeVisible();
    const proximos = page.locator('section[aria-labelledby="agenda-proximos"]');
    await expect(proximos.getByText("8º encontro")).toBeVisible();
    // .first: a trilha esp (e specs paralelos) põe outro "Agendado" na
    // mesma lista — o assert é "o encontro existe com o badge", não "1 só"
    await expect(proximos.getByText("Agendado").first()).toBeVisible();
  });

  test("materiais abre a biblioteca — conteúdo ou estado vazio honesto", async ({
    page,
  }) => {
    await page.goto("/jovem/materiais");
    await expect(
      page.getByRole("heading", { name: "Materiais", level: 1 })
    ).toBeVisible();
    // a RLS entrega só audiencia='todos'; o seed de domínio tem algumas, mas
    // num stack sem elas o vazio honesto é a resposta certa
    await expect(
      page
        .getByText("Nenhum material por aqui ainda")
        .or(page.getByRole("heading", { level: 2 }).first())
    ).toBeVisible();
  });

  test("perfil mostra a ficha do programa e os dados de contato", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    await expect(
      page.getByRole("heading", { name: "Jovem E2E", level: 1 })
    ).toBeVisible();
    // o desenho é o do perfil de todo mundo: badge de papel no header,
    // ficha como gaveta (summary), dados como seção e conta no fim
    await expect(page.getByText("Mentorado").first()).toBeVisible();
    await expect(
      page.locator("summary").getByText("Sua ficha no programa")
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Seus dados" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Conta" })
    ).toBeVisible();
    await expect(page.getByText(/jovem-e2e@realiza\.test/)).toBeVisible();
    // opt-in colega↔colega (0076): a ficha do jovem não tem WhatsApp — o
    // controle aparece desligado e explicado, nunca escondido
    await expect(
      page.getByRole("heading", { name: "Privacidade" })
    ).toBeVisible();
    await expect(
      page.getByRole("switch", { name: /Compartilhar meu WhatsApp/ })
    ).toBeDisabled();
  });

  test("perfil edita os dados dele pelo lápis — o gesto do perfil de todos", async ({
    page,
  }) => {
    await page.goto("/jovem/perfil");
    await page
      .getByRole("button", { name: "Editar seus dados" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Seus dados" })
    ).toBeVisible();
    await dialog
      .getByLabel("Seu WhatsApp")
      .fill("(11) 98888-7777");
    await dialog.getByRole("button", { name: /Salvar/i }).click();
    await expect(page.getByText("(11) 98888-7777")).toBeVisible();
    // reverte — o spec é rerodável e o número não é fixture de ninguém
    await page.getByRole("button", { name: "Editar seus dados" }).click();
    await page.getByRole("dialog").getByLabel("Seu WhatsApp").fill("");
    await page.getByRole("dialog").getByRole("button", { name: /Salvar/i }).click();
  });

  test("pessoas lista a equipe das duplas e o diretório de colegas", async ({
    page,
  }) => {
    await page.goto("/jovem/pessoas");
    await expect(
      page.getByRole("heading", { name: "Pessoas", level: 1 })
    ).toBeVisible();
    // agrupado por cargo — uma seção por papel, a linha não repete o rótulo
    const mentoria = page.locator(
      'section[aria-labelledby="mentoria-titulo"]'
    );
    await expect(mentoria.getByText("Mentor E2E")).toBeVisible();
    // a trilha esp da ficha (duplaEsp) entrega papel 'especialista' desde a
    // 0076 — antes sumia como 'mentor' duplicado
    const especialistas = page.locator(
      'section[aria-labelledby="especialistas-titulo"]'
    );
    await expect(especialistas.getByText("Esp E2E")).toBeVisible();
    // o diretório de colegas existe mesmo sem colega com conta — o vazio
    // honesto é a resposta certa
    await expect(
      page.locator('section[aria-labelledby="colegas-titulo"]')
    ).toBeVisible();
    await expect(
      page.getByText(/o seu você controla em/i)
    ).toBeVisible();
  });
});
