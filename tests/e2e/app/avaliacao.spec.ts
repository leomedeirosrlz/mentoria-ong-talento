import {
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  convergirDuplaAtiva,
  expect,
  inserirViaServiceRole,
  limparViaServiceRole,
  loginComSenha,
  test,
} from "../helpers";

// Avaliação estrela do jovem (REALIZA-109 / migration 0071) contra backend
// real. Cobre os dois canais de submit — a pendência logada do /jovem e o
// link público /avaliar/<token> — mais os recortes por papel na ficha da
// dupla: coord lê a linha inteira e distribui o link; o mentor DPP lê SÓ a
// média quantizada (≥3) e a avaliação que o jovem liberou de propósito.
//
// Piso: o seed mantém o encontro …00d2 (numero 16) realizado e sem
// avaliação na dupla …0030 — aqui o convergir() devolve tudo ao estado
// "pendente" antes de cada teste e cria os demais encontros em números do
// pool. Os filhos da 0071 (avaliacoes_encontro, avaliacao_links) não têm
// ON DELETE CASCADE — a ordem dos deletes importa.
const JOVEM_EMAIL = process.env.E2E_JOVEM_EMAIL ?? "jovem-e2e@realiza.test";
const MENTOR_EMAIL = process.env.E2E_MENTOR_EMAIL ?? "e2e-mentor@realiza.test";
const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
// mesmo segredo compartilhado — um secret a menos no CI
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const COORD_SENHA = process.env.E2E_COORD_PASSWORD || SENHA;
const DUPLA_ID =
  process.env.E2E_DUPLA_ID ?? "e2e00000-0000-4000-8000-000000000030";

const IDS = {
  jovemProfile: "e2e00000-0000-4000-8000-0000000000b0",
  mentorProfile: "e2e00000-0000-4000-8000-000000000010",
  coordProfile: "e2e00000-0000-4000-8000-000000000040",
  encontroFixture: "e2e00000-0000-4000-8000-0000000000d2",
} as const;
const NUMERO_FIXTURE = 16;
// números reservados aos encontros que os testes criam: os baixos (≤ a
// semana corrente do ciclo) pra quando a linha do encontro precisa render
// fora do <details> da ficha, os altos pra quando só a pendência importa.
// O 8 é a fixture de encontro futuro do jovem; o 16 é a fixture daqui.
const POOL_NUMEROS = [1, 2, 3, 4, 5, 11, 12, 13, 14, 15];

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

// ids de encontro que o run criou — o afterEach devolve tudo
const criados = new Set<string>();

/** Encontro 'realizado' novo na dupla do jovem — o trigger 0071 minta o
 *  avaliacao_links no próprio insert (e a notificação pro jovem, já que a
 *  mentorada da dupla tem profile). Devolve id + token pra /avaliar/<token>. */
async function criarEncontroRealizado(numero: number, id?: string) {
  const quando = new Date(Date.now() - 2 * 86400e3).toISOString();
  const enc = await inserirViaServiceRole("encontros", {
    ...(id ? { id } : {}),
    dupla_id: DUPLA_ID,
    numero,
    data_hora: quando,
    realizado_em: quando,
    status: "realizado",
  });
  const encontroId = String(enc.id);
  criados.add(encontroId);
  const [link] = await buscarViaServiceRole<{ token: string }[]>(
    "avaliacao_links",
    `select=token&encontro_id=eq.${encontroId}`
  );
  return { encontroId, token: link?.token ?? null };
}

/** Avaliação gravada direto (service role) — pros testes que não exercitam
 *  o submit, só a leitura por papel. */
async function inserirAvaliacao(
  encontroId: string,
  corpo: Record<string, unknown> = {}
) {
  return inserirViaServiceRole("avaliacoes_encontro", {
    dupla_id: DUPLA_ID,
    encontro_id: encontroId,
    estrelas: 5,
    respondido_por_profile_id: IDS.jovemProfile,
    ...corpo,
  });
}

/** Filhos da 0071 primeiro — avaliacoes_encontro e avaliacao_links
 *  referenciam encontros com NO ACTION; apagar o pai antes dá 409. E os
 *  chamados da 0084 apontam pro registro/avaliação com SET NULL — apagar
 *  a origem antes deixa a linha órfã, então o chamado sai primeiro. */
async function apagarEncontros(ids: Iterable<string>) {
  const lista = [...ids];
  if (!lista.length) return;
  const avals = await buscarViaServiceRole<{ id: string }[]>(
    "avaliacoes_encontro",
    `select=id&encontro_id=in.(${lista.join(",")})`
  );
  if (avals.length) {
    await limparViaServiceRole(
      "chamados",
      `avaliacao_id=in.(${avals.map((a) => a.id).join(",")})`
    );
  }
  // fallback: chamados do jovem fixture criados por outros caminhos
  await limparViaServiceRole(
    "chamados",
    `autor_id=eq.${IDS.jovemProfile}`
  );
  await limparViaServiceRole(
    "avaliacoes_encontro",
    `encontro_id=in.(${lista.join(",")})`
  );
  await limparViaServiceRole(
    "avaliacao_links",
    `encontro_id=in.(${lista.join(",")})`
  );
  await limparViaServiceRole("encontros", `id=in.(${lista.join(",")})`);
}

/** Sinos e log de e-mail que o ciclo de avaliação dispara. O prompt pro
 *  jovem e o chamado_resolvido vão por destinatário; o chamado_aberto vai
 *  por created_by (o trigger assina com o profile de quem respondeu —
 *  alcança qualquer coord real do staging que foi notificado). */
async function limparRastros() {
  await limparViaServiceRole(
    "notificacoes",
    `profile_id=eq.${IDS.jovemProfile}&tipo=eq.avaliacao_pendente`
  );
  await limparViaServiceRole(
    "notificacoes",
    `profile_id=eq.${IDS.jovemProfile}&tipo=eq.chamado_resolvido`
  );
  await limparViaServiceRole(
    "notificacoes",
    `created_by=eq.${IDS.jovemProfile}&tipo=like.chamado_*`
  );
  await limparViaServiceRole("emails_enviados", "tipo=eq.apoio_jovem");
}

/** Piso entre testes (e retries): dupla do jovem com EXATAMENTE a pendência
 *  da fixture — encontro 16 realizado, sem avaliação, link 'pendente'. Um
 *  mentor.spec solto pode ter varrido os encontros da dupla inteira: se a
 *  fixture sumiu, recria (o insert dispara o trigger que minta o link). */
async function convergirPiso() {
  // leftovers de run morto no pool de números do spec — filhos primeiro
  const restos = await buscarViaServiceRole<{ id: string }[]>(
    "encontros",
    `select=id&dupla_id=eq.${DUPLA_ID}&numero=in.(${POOL_NUMEROS.join(",")})`
  );
  await apagarEncontros(restos.map((r) => r.id));
  criados.delete(IDS.encontroFixture);

  const [enc] = await buscarViaServiceRole<{ id: string }[]>(
    "encontros",
    `select=id&id=eq.${IDS.encontroFixture}`
  );
  if (!enc) {
    const quando = new Date(Date.now() - 2 * 86400e3).toISOString();
    await inserirViaServiceRole("encontros", {
      id: IDS.encontroFixture,
      dupla_id: DUPLA_ID,
      numero: NUMERO_FIXTURE,
      data_hora: quando,
      realizado_em: quando,
      status: "realizado",
    });
  }

  // pendência de verdade: nenhuma avaliação no encontro e o link de volta a
  // 'pendente' (o submit do spec consome os dois). Encontro 'realizado' não
  // volta de status (guard 0043) — o reconverso é nos filhos, não nele.
  await limparViaServiceRole(
    "avaliacoes_encontro",
    `encontro_id=eq.${IDS.encontroFixture}`
  );
  const [link] = await buscarViaServiceRole<{ id: string }[]>(
    "avaliacao_links",
    `select=id&encontro_id=eq.${IDS.encontroFixture}`
  );
  if (!link) {
    await inserirViaServiceRole("avaliacao_links", {
      token: crypto.randomUUID(),
      encontro_id: IDS.encontroFixture,
      dupla_id: DUPLA_ID,
      expira_em: new Date(Date.now() + 60 * 86400e3).toISOString(),
    });
  } else {
    await atualizarViaServiceRole(
      "avaliacao_links",
      `encontro_id=eq.${IDS.encontroFixture}`,
      { status: "pendente", respondido_em: null, respondido_por_profile_id: null }
    );
  }
  await limparRastros();
  // a fixture é o ÚLTIMO encontro do cronograma — re-criá-la dispara a
  // 0102 e a dupla acorda 'concluida' (PDM read-only, agenda sem CTA).
  // Devolve o piso de sempre: status ativa, sem encerramento nem sinos.
  await convergirDuplaAtiva(DUPLA_ID);
}

test.describe("avaliação estrela do jovem (REALIZA-109)", () => {
  test.beforeEach(convergirPiso);

  test.afterEach(async () => {
    await apagarEncontros(criados);
    criados.clear();
    // devolve a fixture ao "sem avaliação, link pendente" — um teste que
    // submeteu a dela não pode vazar estado pro próximo
    await limparViaServiceRole(
      "avaliacoes_encontro",
      `encontro_id=eq.${IDS.encontroFixture}`
    );
    await atualizarViaServiceRole(
      "avaliacao_links",
      `encontro_id=eq.${IDS.encontroFixture}`,
      { status: "pendente", respondido_em: null, respondido_por_profile_id: null }
    );
    await limparRastros();
  });

  // ---------- jovem logado (/jovem) ----------

  test("jovem vê a pendência em Suas avaliações, submete e ela vira histórico", async ({
    page,
  }) => {
    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.waitForURL((u) => u.pathname === "/jovem", { timeout: 15_000 });

    const secao = page.locator('section[aria-labelledby="avaliacoes-titulo"]');
    await expect(
      secao.getByRole("heading", { name: "Suas avaliações" })
    ).toBeVisible();
    // as pendências moram recolhidas na seção — o trigger "N esperando sua
    // resposta" abre a lista (a ação primária delas vive em "Para fazer
    // agora"; aqui fica o atalho que não repete os botões)
    await secao.getByText(/esperando sua resposta/).click();
    const pendente = secao.locator("li", {
      hasText: "16º encontro",
      has: page.getByRole("button", { name: "Avaliar" }),
    });
    await expect(pendente).toBeVisible();

    await pendente.getByRole("button", { name: "Avaliar" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("16º encontro: como foi?")
    ).toBeVisible();

    // radios/checkbox do form moram sr-only dentro do label — o clique
    // honesto é no label (mesmo padrão do login por senha)
    const marcar = (campo: string, valor: string) =>
      dialog
        .locator("label", {
          has: page.locator(`input[name="${campo}"][value="${valor}"]`),
        })
        .click();
    await marcar("estrelas", "4");
    await marcar("sentimento", "bem");
    await marcar("avancei", "sim");
    await marcar("temas", "familia");
    await dialog
      .locator("#aval-comentario")
      .fill("E2E: conversa boa sobre família");
    await dialog
      .getByRole("button", { name: "Enviar avaliação" })
      .click();

    await expect(
      page.getByText("Avaliação enviada. Obrigado por contar!")
    ).toBeVisible();

    // a pendência vira linha de histórico com a nota — o refresh re-renderiza
    // (o bloco recolhido desmonta quando zera, então a marca dela some)
    await expect(
      secao.getByText("aguardando sua resposta")
    ).toHaveCount(0);
    const feita = secao.locator("li", { hasText: "16º encontro" });
    await expect(
      feita.getByRole("img", { name: "4 de 5 estrelas" })
    ).toBeVisible();
    await expect(
      feita.getByRole("button", { name: "Ver resposta" })
    ).toBeVisible();

    // write real no banco — a linha saiu da conta do jovem
    const rows = await buscarViaServiceRole<
      {
        estrelas: number;
        sentimento: string | null;
        avancei: string | null;
        temas: string[] | null;
        comentario: string | null;
        respondido_por_profile_id: string | null;
      }[]
    >(
      "avaliacoes_encontro",
      `select=estrelas,sentimento,avancei,temas,comentario,respondido_por_profile_id&encontro_id=eq.${IDS.encontroFixture}`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].estrelas).toBe(4);
    expect(rows[0].sentimento).toBe("bem");
    expect(rows[0].avancei).toBe("sim");
    expect(rows[0].temas).toContain("familia");
    expect(rows[0].respondido_por_profile_id).toBe(IDS.jovemProfile);
  });

  test("ver resposta mostra o que disse e o toggle de visibilidade reverte", async ({
    page,
  }) => {
    const { encontroId } = await criarEncontroRealizado(15);
    const aval = await inserirAvaliacao(encontroId, {
      estrelas: 5,
      sentimento: "muito_bem",
      avancei: "sim",
      temas: ["estudos", "familia"],
      comentario: "E2E: resposta detalhada do jovem",
    });

    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.waitForURL((u) => u.pathname === "/jovem", { timeout: 15_000 });

    const secao = page.locator('section[aria-labelledby="avaliacoes-titulo"]');
    await secao
      .locator("li", { hasText: "15º encontro" })
      .getByRole("button", { name: "Ver resposta" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("Sua avaliação do 15º encontro")
    ).toBeVisible();
    await expect(
      dialog.getByRole("img", { name: "5 de 5 estrelas" })
    ).toBeVisible();
    await expect(dialog.getByText("Muito bem")).toBeVisible();
    await expect(dialog.getByText("Sim, avancei")).toBeVisible();
    await expect(dialog.getByText("Família")).toBeVisible();
    await expect(
      dialog.getByText("E2E: resposta detalhada do jovem")
    ).toBeVisible();

    // o toggle é do jovem (trilha dpp) — liga, persiste, desliga
    const chave = dialog.getByRole("switch", {
      name: "Meu mentor pode ler esta avaliação",
    });
    await expect(chave).not.toBeChecked();
    await chave.click();
    await expect(
      page.getByText("Seu mentor agora lê esta avaliação.")
    ).toBeVisible();
    await expect(chave).toBeChecked();
    let [row] = await buscarViaServiceRole<
      { avaliacao_visivel_mentor: boolean }[]
    >(
      "avaliacoes_encontro",
      `select=avaliacao_visivel_mentor&id=eq.${String(aval.id)}`
    );
    expect(row.avaliacao_visivel_mentor).toBe(true);

    await chave.click();
    await expect(page.getByText("Voltou a valer só na média.")).toBeVisible({ timeout: 15_000 });
    await expect(chave).not.toBeChecked();
    [row] = await buscarViaServiceRole<
      { avaliacao_visivel_mentor: boolean }[]
    >(
      "avaliacoes_encontro",
      `select=avaliacao_visivel_mentor&id=eq.${String(aval.id)}`
    );
    expect(row.avaliacao_visivel_mentor).toBe(false);
  });

  test("'Preciso de ajuda' avisa a coordenação, que atende na ficha", async ({
    page,
  }) => {
    await criarEncontroRealizado(14);
    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.waitForURL((u) => u.pathname === "/jovem", { timeout: 15_000 });

    const secao = page.locator('section[aria-labelledby="avaliacoes-titulo"]');
    // mesma pendência recolhida do spec acima — abre antes de achar a linha
    await secao.getByText(/esperando sua resposta/).click();
    await secao
      .locator("li", {
        hasText: "14º encontro",
        has: page.getByRole("button", { name: "Avaliar" }),
      })
      .getByRole("button", { name: "Avaliar" })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .locator("label", {
        has: page.locator('input[name="estrelas"][value="2"]'),
      })
      .click();
    await dialog.locator("label", { hasText: "Preciso de ajuda" }).click();
    await dialog
      .getByRole("button", { name: "Enviar avaliação" })
      .click();
    await expect(
      page.getByText(
        "Pedido enviado. A coordenação foi avisada e fala com você."
      )
    ).toBeVisible({ timeout: 15_000 });

    // 0084: a flag acesa abriu o chamado no mesmo insert (trigger) — a
    // urgência virou ticket com número e estado, não notificação solta
    const [avalChamado] = await buscarViaServiceRole<{ id: string }[]>(
      "avaliacoes_encontro",
      `select=id&encontro_id=in.(${[...criados].join(",")})&pedir_apoio=eq.true`
    );
    const [chamado] = await buscarViaServiceRole<
      { id: string; numero: string; status: string; categoria: string }[]
    >(
      "chamados",
      `select=id,numero,status,categoria&avaliacao_id=eq.${avalChamado.id}`
    );
    expect(chamado.numero).toMatch(/^CHA-\d{6}$/);
    expect(chamado.status).toBe("aberto");
    expect(chamado.categoria).toBe("urgencia");

    // o sino chamado_aberto chegou de verdade — pra coord fixture com o
    // href do chamado (a RPC avisa TODA a coordenação ativa + supervisor)
    const notifs = await buscarViaServiceRole<
      { profile_id: string; href: string }[]
    >(
      "notificacoes",
      `select=profile_id,href&tipo=eq.chamado_aberto&href=eq./chamados%3Fc%3D${chamado.id}`
    );
    expect(notifs.map((n) => n.profile_id)).toContain(IDS.coordProfile);

    // a coord atende na ficha — dois logins no mesmo teste via cookies
    // limpos; o card do pedido mora na linha do encontro (aba Encontros)
    await page.context().clearCookies();
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    await page.goto(`/duplas/${DUPLA_ID}?aba=encontros`);
    await expect(
      page.getByText("Pedido de ajuda em aberto", { exact: false })
    ).toBeVisible();
    await expect(page.getByText("pediu ajuda", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Marcar ajuda como atendida" })
      .click();
    await expect(page.getByText("Pedido de ajuda atendido.")).toBeVisible({ timeout: 15_000 });

    // o ciclo fecha nas duas pontas na mesma transação: flag limpa,
    // chamado resolvido e o jovem recebe "foi visto" (chamado_resolvido)
    const [aval] = await buscarViaServiceRole<{ pedir_apoio: boolean }[]>(
      "avaliacoes_encontro",
      `select=pedir_apoio&encontro_id=in.(${[...criados].join(",")})`
    );
    expect(aval.pedir_apoio).toBe(false);
    const [resolvido] = await buscarViaServiceRole<{ status: string }[]>(
      "chamados",
      `select=status&id=eq.${chamado.id}`
    );
    expect(resolvido.status).toBe("resolvido");
    const resolvidas = await buscarViaServiceRole<{ tipo: string }[]>(
      "notificacoes",
      `select=tipo&profile_id=eq.${IDS.jovemProfile}&tipo=eq.chamado_resolvido`
    );
    expect(resolvidas.length).toBeGreaterThan(0);
  });

  // ---------- /avaliar/<token> público ----------

  test("link público abre o form sem login e consome de verdade", async ({
    page,
  }) => {
    const { token } = await criarEncontroRealizado(13);
    expect(token).toBeTruthy();

    // contexto fresco do teste = sem sessão — o canal do jovem sem login
    await page.goto(`/avaliar/${token}`);
    await expect(page.getByText("Olá, Mentorada!")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Como foi o encontro?" })
    ).toBeVisible();
    await expect(page.getByText(/Encontro 13 com Mentor/)).toBeVisible();
    await expect(
      page.getByText(/a nota só aparece na média/)
    ).toBeVisible();

    const marcar = (campo: string, valor: string) =>
      page
        .locator("label", {
          has: page.locator(`input[name="${campo}"][value="${valor}"]`),
        })
        .click();
    await marcar("estrelas", "3");
    await marcar("temas", "estudos");
    await page
      .getByRole("button", { name: "Enviar avaliação" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Avaliação enviada!" })
    ).toBeVisible();
    await expect(page.getByText(/Obrigado, Mentorada/)).toBeVisible();

    // anon não carrega sessão — a linha sai sem respondido_por e o link
    // morre no uso
    const [aval] = await buscarViaServiceRole<
      { estrelas: number; respondido_por_profile_id: string | null }[]
    >(
      "avaliacoes_encontro",
      `select=estrelas,respondido_por_profile_id&encontro_id=in.(${[...criados].join(",")})`
    );
    expect(aval.estrelas).toBe(3);
    expect(aval.respondido_por_profile_id).toBeNull();
    const [link] = await buscarViaServiceRole<{ status: string }[]>(
      "avaliacao_links",
      `select=status&encontro_id=in.(${[...criados].join(",")})`
    );
    expect(link.status).toBe("respondido");

    // reabrir o mesmo link mostra o estado honesto, não o form de novo
    await page.goto(`/avaliar/${token}`);
    await expect(
      page.getByRole("heading", { name: "Avaliação já registrada" })
    ).toBeVisible();
  });

  test("jovem logado também responde pelo link público", async ({ page }) => {
    const { token } = await criarEncontroRealizado(12);
    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.waitForURL((u) => u.pathname === "/jovem", { timeout: 15_000 });

    await page.goto(`/avaliar/${token}`);
    await expect(
      page.getByRole("heading", { name: "Como foi o encontro?" })
    ).toBeVisible();
    // trilha dpp: o checkbox de visibilidade existe no form público também
    await page.locator("label", { hasText: "Quero que meu mentor leia" }).click();
    await page
      .locator("label", {
        has: page.locator('input[name="estrelas"][value="5"]'),
      })
      .click();
    await page
      .getByRole("button", { name: "Enviar avaliação" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Avaliação enviada!" })
    ).toBeVisible();

    const [aval] = await buscarViaServiceRole<
      {
        estrelas: number;
        avaliacao_visivel_mentor: boolean;
        respondido_por_profile_id: string | null;
      }[]
    >(
      "avaliacoes_encontro",
      `select=estrelas,avaliacao_visivel_mentor,respondido_por_profile_id&encontro_id=in.(${[...criados].join(",")})`
    );
    expect(aval.estrelas).toBe(5);
    expect(aval.avaliacao_visivel_mentor).toBe(true);
    // caminho híbrido: logado e dono do link — a conta fica registrada
    expect(aval.respondido_por_profile_id).toBe(IDS.jovemProfile);
  });

  test("link aberto na conta de outra pessoa não rende form", async ({
    page,
  }) => {
    const { token } = await criarEncontroRealizado(11);
    await loginComSenha(page, MENTOR_EMAIL, SENHA);
    await page.goto(`/avaliar/${token}`);
    await expect(
      page.getByRole("heading", { name: "Este link é de outra pessoa" })
    ).toBeVisible();
    await expect(page.getByText("Mentorada E2E")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Enviar avaliação" })
    ).toHaveCount(0);
  });

  // ---------- ficha da dupla por papel ----------

  test("coord vê Voz do jovem: a linha inteira, a média e o link pendente", async ({
    page,
  }) => {
    const { encontroId } = await criarEncontroRealizado(5);
    await inserirAvaliacao(encontroId, {
      estrelas: 5,
      sentimento: "muito_bem",
      temas: ["carreira"],
      comentario: "E2E: detalhe que só a equipe lê",
    });

    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    await page.goto(`/duplas/${DUPLA_ID}?aba=instrumentos`);

    // rail da ficha (aba Instrumentos) — a média direta (coord lê as
    // linhas, não o agregado quantizado) e a contagem de pendências (a
    // fixture 16 segue sem estrela)
    await expect(
      page.getByRole("heading", { name: "Voz do jovem" })
    ).toBeVisible();
    await expect(page.getByText("média de 1 avaliação")).toBeVisible();
    await expect(
      page.getByText(/aguardando a resposta dele/)
    ).toBeVisible();

    // a linha inteira na linha do encontro (aba Encontros) — o comentário
    // chega pra coord
    await page.goto(`/duplas/${DUPLA_ID}?aba=encontros`);
    await expect(page.getByText("Avaliação do jovem", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("img", { name: "5 de 5 estrelas" }).first()
    ).toBeVisible();
    await expect(
      page.getByText("E2E: detalhe que só a equipe lê")
    ).toBeVisible();
    await expect(page.getByText(/pela conta do jovem/)).toBeVisible();

    // encontro 16 (fixture) segue pendente — a coord distribui o link
    await expect(
      page.getByText("Avaliação do jovem ainda não chegou")
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Copiar link da avaliação" })
    ).toBeVisible();
  });

  test("mentor lê só a média liberada em lotes — nunca a linha escondida", async ({
    page,
  }) => {
    // 3 avaliações não-liberadas (a média snapshot pega as 3 primeiras) +
    // uma que o jovem liberou — a única linha que o RLS entrega ao mentor
    const estrelas = [5, 4, 3];
    for (let i = 0; i < 3; i++) {
      const { encontroId } = await criarEncontroRealizado(i + 1);
      await inserirAvaliacao(encontroId, {
        estrelas: estrelas[i],
        comentario: "E2E: comentário que o mentor não lê",
      });
    }
    const { encontroId: encLiberada } = await criarEncontroRealizado(4);
    await inserirAvaliacao(encLiberada, {
      estrelas: 2,
      comentario: "E2E: esta o jovem liberou pro mentor",
      avaliacao_visivel_mentor: true,
    });

    await loginComSenha(page, MENTOR_EMAIL, SENHA);
    await page.goto(`/duplas/${DUPLA_ID}?aba=instrumentos`);

    await expect(
      page.getByRole("heading", { name: "Voz do jovem" })
    ).toBeVisible();
    // média das 3 primeiras (5,4,3) = 4,0 — "4 recebidas", base liberada 3
    await expect(page.getByText("4,0", { exact: true })).toBeVisible();
    await expect(page.getByText("média de 3 avaliações")).toBeVisible();
    await expect(page.getByText(/4 recebidas no total/)).toBeVisible();

    // a fronteira de privacidade é o assert principal: o comentário da
    // linha não-liberada não vaza — nem no rail, nem na linha do encontro
    // (a linha mora na aba Encontros)
    await page.goto(`/duplas/${DUPLA_ID}?aba=encontros`);
    await expect(
      page.getByText("E2E: comentário que o mentor não lê")
    ).toHaveCount(0);
    // pendência também é recorte coord/sup — o mentor não cobra o jovem
    await expect(
      page.getByText("Avaliação do jovem ainda não chegou")
    ).toHaveCount(0);
    await expect(page.getByText("pediu ajuda")).toHaveCount(0);

    // e a linha que o jovem liberou chega com a nota que explica o porquê
    await expect(
      page.getByText("E2E: esta o jovem liberou pro mentor")
    ).toBeVisible();
    await expect(
      page.getByText(/O jovem ligou “meu mentor pode ler esta”/)
    ).toBeVisible();
  });
});
