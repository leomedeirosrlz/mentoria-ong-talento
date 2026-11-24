import {
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  convergirDuplaAtiva,
  expect,
  inserirViaServiceRole,
  jwtDoUsuario,
  loginComSenha,
  relogar,
  restComoUsuario,
  test,
} from "../helpers";

// Diretório do jovem (spec 023 / migration 0239) contra backend real:
//   * /jovem/pessoas é o diretório do programa — adultos com papel, os
//     jovens com conta e o catálogo; a faceta "Minha rede" recorta a rede
//     dele (jovem_contatos ∪ mentorados_turma) e nenhum card abre canal;
//   * a seção "Sua rede" do /jovem/perfil mostra as mesmas pessoas com os
//     canais de sempre — WhatsApp de colega atrás do opt-in
//     contato_compartilhado (RPC set_contato_compartilhado, toggle no
//     Perfil do DONO);
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
  // a dupla DPP do jovem — o selo "mentoria <status>" vive no card do
  // mentor quando a dupla não está em curso
  duplaDpp: "e2e00000-0000-4000-8000-000000000030",
  // a trilha esp do jovem — a mentorados_turma casa a turma por QUALQUER
  // dupla dele: turma degradada numa das duas esvazia a rede de colegas
  duplaEsp: "e2e00000-0000-4000-8000-0000000000e0",
  // mentor do colega e cronograma da Turma E2E — o seed usa o MESMO uuid
  // pros dois (tabelas diferentes, não conflita)
  mentorColega: "e2e00000-0000-4000-8000-0000000000e2",
  cronogramaE2e: "e2e00000-0000-4000-8000-0000000000e2",
  supProfile: "e2e00000-0000-4000-8000-000000000100", // supervisor das duplas fixture
  mentorProfile: "e2e00000-0000-4000-8000-000000000010",
  espProfile: "e2e00000-0000-4000-8000-000000000060",
  esp2Profile: "e2e00000-0000-4000-8000-0000000000c0", // catálogo, sem dupla com o jovem
  coordProfile: "e2e00000-0000-4000-8000-000000000040",
  mentorReserva: "e2e00000-0000-4000-8000-000000000050", // adulto não-relacionado
} as const;
const JOVEM2_WHATSAPP = "5511999000091";
// mesma turma das fixtures do seed (TURMA_E2E lá) — a mentorados_turma
// casa por string de turma, então o valor tem que ser verbatim
const TURMA_E2E = "Turma E2E";
// jovem demo do seed:demo (Ana, turma T1) — divide o staging com as
// fixtures e serve de pin "outra turma" pro teste de escopo da 0097
const JOVEM_DEMO_EMAIL = "jovem@realiza.test";
const SENHA_DEMO = process.env.E2E_DEMO_JOVEM_PASSWORD ?? "realiza123";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

/** Piso do spec: o colega converge ESTRUTURA, não só estado. PATCH numa
 *  row ausente é no-op silencioso, então ficha e dupla renascem com os
 *  mesmos campos do seed quando faltam — e os campos estruturais
 *  (nome, vínculos, turma, trilha) re-convergem junto dos voláteis, que
 *  drift manual no staging já degradou (o "Jovem E2e Sem Dpp"
 *  title-caseado que esvaziou o diretório). O opt-in desligado e o
 *  whatsapp voltam ao lugar a cada spec — um run morto com o toggle
 *  ligado vazaria "compartilhado" pro teste da contagem zero. */
async function restaurarColega() {
  // pares independentes em paralelo — em staging cada ida serial ao
  // PostgREST soma segundos e o hook comia o teto de 60s do teste
  const [ficha, dupla] = await Promise.all([
    buscarViaServiceRole<{ id: string }[]>(
      "mentorados",
      `select=id&id=eq.${IDS.mentoradoSemDpp}`
    ),
    buscarViaServiceRole<{ id: string }[]>(
      "duplas",
      `select=id&id=eq.${IDS.duplaColega}`
    ),
  ]);
  // a ficha sai na frente SOZINHA: o insert da dupla tem FK mentorado_id
  // — em run com estado zerado ela precisa existir antes do paralelo
  if (ficha) {
    await atualizarViaServiceRole(
      "mentorados",
      `id=eq.${IDS.mentoradoSemDpp}`,
      {
        nome: "Jovem E2E Sem DPP",
        profile_id: IDS.jovem2Profile,
        contato_compartilhado: false,
        whatsapp: JOVEM2_WHATSAPP,
      }
    );
  } else {
    await inserirViaServiceRole("mentorados", {
      id: IDS.mentoradoSemDpp,
      nome: "Jovem E2E Sem DPP",
      profile_id: IDS.jovem2Profile,
      whatsapp: JOVEM2_WHATSAPP,
      contato_compartilhado: false,
    });
  }
  await Promise.all([
    dupla
      ? atualizarViaServiceRole("duplas", `id=eq.${IDS.duplaColega}`, {
          status: "pausada",
          encerrada_em: null,
          motivo_encerramento: null,
          turma: TURMA_E2E,
          mentor_id: IDS.mentorColega,
          mentorado_id: IDS.mentoradoSemDpp,
          supervisor_id: IDS.supProfile,
          trilha: "dpp",
        })
      : // insert espelha o seed (status pausada na Turma E2E, trilha dpp) +
        // o supervisor_id que o bloco do supervisor costura depois — a dupla
        // renasce já no estado final convergido. O insert dispara
        // duplas_jornada_autoemit, mesmo efeito do seed: links do enc. 1
        inserirViaServiceRole("duplas", {
          id: IDS.duplaColega,
          mentor_id: IDS.mentorColega,
          mentorado_id: IDS.mentoradoSemDpp,
          supervisor_id: IDS.supProfile,
          turma: TURMA_E2E,
          cronograma_id: IDS.cronogramaE2e,
          trilha: "dpp",
          status: "pausada",
          iniciada_em: "2026-09-08",
        }),
    // o join da mentorados_turma casa pela turma das duplas do JOVEM —
    // qualquer uma degradada esvazia a rede de colegas inteira
    atualizarViaServiceRole(
      "duplas",
      `id=in.(${IDS.duplaDpp},${IDS.duplaEsp})`,
      { turma: TURMA_E2E }
    ),
    // a dupla do jovem tem que estar ativa — 'concluida' costura o selo
    // "mentoria concluída" no card do mentor e muda o recorte
    convergirDuplaAtiva(IDS.duplaDpp),
  ]);
}

// o card do diretório navega por UM link nomeado (aria-label "Abrir
// perfil de …") — o nome acessível não se mistura com os chips
// nomes da fixture são prefixo uns dos outros ("Mentor E2E" × "Mentor E2E
// Colega/Híbrido/…") — o match exato é o que torna o card único
const cardDe = (page: import("@playwright/test").Page, nome: string) =>
  page.getByRole("link", { name: `Abrir perfil de ${nome}`, exact: true });

const pill = (page: import("@playwright/test").Page, nome: string) =>
  page.getByRole("group", { name: "Filtrar por vínculo" })
    .getByRole("button", { name: nome, exact: true });

test.describe("diretório do jovem (spec 023 / 0239)", () => {
  test.beforeEach(restaurarColega);
  test.afterAll(restaurarColega);

  test("o colega com conta vira card no diretório — contato fechado até o opt-in", async ({
    page,
  }) => {
    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem/pessoas");

    // a ficha dele existe no diretório (mentorados.nome, não o login) —
    // e dentro da faceta "Minha rede" por ser colega de turma
    await pill(page, "Minha rede").click();
    await expect(cardDe(page, "Jovem E2E Sem DPP")).toBeVisible();
    await expect(cardDe(page, "Mentor E2E")).toBeVisible();
    await expect(cardDe(page, "Coordenação E2E")).toBeVisible();

    // opt-in fechado: o card existe, mas nenhum canal viaja — nem no
    // diretório inteiro, nem como wa.me com número null
    const main = page.getByRole("main");
    await expect(main.locator('a[href*="wa.me"]')).toHaveCount(0);
    await expect(main.locator('a[href^="mailto:"]')).toHaveCount(0);

    // e a ficha dele mostra o estado honesto em vez do botão
    await cardDe(page, "Jovem E2E Sem DPP").click();
    await expect(page).toHaveURL(
      new RegExp(`/jovem/pessoas/${IDS.mentoradoSemDpp}`)
    );
    await expect(
      page.getByText(/ainda não compartilhou o contato/i)
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveCount(0);

    // colega sem conta (profile_id null) nem entra no diretório — as
    // outras fichas e2e são esse caso
    await page.goto("/jovem/pessoas");
    await expect(cardDe(page, "Mentorada E2E Dois")).toHaveCount(0);
    await expect(cardDe(page, "Mentorada E2E Livre")).toHaveCount(0);
  });

  test("abre o perfil de quem ele enxerga — cada fonte segura resolve", async ({
    page,
  }) => {
    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem/pessoas");

    // contato de dupla (jovem_contatos): o click do card cai no perfil —
    // mesmo cartão-banner do /perfil de todo mundo
    await cardDe(page, "Mentor E2E").click();
    await expect(page).toHaveURL(
      new RegExp(`/jovem/pessoas/${IDS.mentorProfile}`)
    );
    await expect(
      page.getByRole("heading", { name: "Mentor E2E", level: 1 })
    ).toBeVisible();
    // o badge do vínculo — "Seu mentor" (rotuloContato do perfil)
    await expect(page.getByText("Seu mentor", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /e2e-mentor@realiza\.test/ })
    ).toBeVisible();

    // o especialista da trilha dele — papel 'especialista' da view
    await page.goto(`/jovem/pessoas/${IDS.espProfile}`);
    await expect(
      page.getByRole("heading", { name: "Esp E2E", level: 1 })
    ).toBeVisible();
    await expect(page.getByText("Seu especialista")).toBeVisible();

    // coordenação (dupla_id null — ainda é contato legítimo da view)
    await page.goto(`/jovem/pessoas/${IDS.coordProfile}`);
    await expect(
      page.getByRole("heading", { name: "Coordenação E2E", level: 1 })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /e2e-coord@realiza\.test/ })
    ).toBeVisible();

    // colega da turma (mentorados_turma — id de mentorados, outro espaço)
    await page.goto("/jovem/pessoas");
    await cardDe(page, "Jovem E2E Sem DPP").click();
    await expect(page).toHaveURL(
      new RegExp(`/jovem/pessoas/${IDS.mentoradoSemDpp}`)
    );
    await expect(
      page.getByRole("heading", { name: "Jovem E2E Sem DPP", level: 1 })
    ).toBeVisible();
    await expect(page.getByText("Colega da turma")).toBeVisible();
    await expect(
      page.getByText(/ainda não compartilhou o contato/i)
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveCount(0);

    // especialista do catálogo (jovem_especialistas) — perfil abre, mas o
    // canal direto só nasce com a trilha: sem e-mail nem WhatsApp
    await page.goto(`/jovem/pessoas/${IDS.esp2Profile}`);
    await expect(
      page.getByRole("heading", { name: "Esp Dois E2E", level: 1 })
    ).toBeVisible();
    await expect(page.getByText("Mentor especialista")).toBeVisible();
    await expect(
      page.getByText(/O contato direto abre quando a sua trilha/)
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /e2e-|WhatsApp/ })
    ).toHaveCount(0);
  });

  test("perfil de quem ele não enxerga cai no mesmo 404 de quem não existe", async ({
    page,
  }) => {
    await loginComSenha(page, JOVEM_EMAIL, SENHA);

    // id aleatório — sem vazar existência
    await page.goto(
      "/jovem/pessoas/00000000-0000-4000-8000-000000000000"
    );
    await expect(page.getByText("Página não encontrada")).toBeVisible();

    // e o profile do próprio jovem não resolve pelo id de profiles — a
    // fonte dele é a ficha (mentorados.id), colega não é ele mesmo
    await page.goto(`/jovem/pessoas/${IDS.jovemProfile}`);
    await expect(page.getByText("Página não encontrada")).toBeVisible();
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

    // a seção "Sua rede" do perfil dele espelha a simetria: o jovem (ficha
    // "Mentorada E2E") é colega dele de volta — com o contato fechado
    const redeJovem2 = page.locator(
      'section[aria-labelledby="sua-rede-titulo"]'
    );
    const linhaJovem = redeJovem2.locator("li", {
      hasText: "Mentorada E2E",
    });
    await expect(linhaJovem).toBeVisible();
    await expect(
      linhaJovem.getByText("não compartilhou o contato")
    ).toBeVisible();

    // lado do COLEGA: relogado como jovem, o opt-in destravou o botão na
    // "Sua rede" do perfil — href aponta pro número da ficha, nunca vazio
    await relogar(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem/perfil");
    const rede = page.locator(
      'section[aria-labelledby="sua-rede-titulo"]'
    );
    const wa = rede
      .locator("li", { hasText: "Jovem E2E Sem DPP" })
      .getByRole("link", { name: /WhatsApp/ });
    await expect(wa).toBeVisible();
    await expect(wa).toHaveAttribute(
      "href",
      new RegExp(`wa\\.me/${JOVEM2_WHATSAPP}`)
    );

    // e o perfil do colega espelha o mesmo opt-in — o número chega só
    // através da view, então o botão da página aponta pro mesmo wa.me
    await page.goto(`/jovem/pessoas/${IDS.mentoradoSemDpp}`);
    const waPerfil = page.getByRole("link", { name: /WhatsApp/ });
    await expect(waPerfil).toBeVisible();
    await expect(waPerfil).toHaveAttribute(
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

    // o jovem DA DUPLA dele aparece uma vez só, pela ficha: o profile
    // "Jovem E2E" está vinculado a "Mentorada E2E" e a linha de conta some
    await expect(page.getByText("Mentorada E2E", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Jovem E2E", { exact: true })).toHaveCount(0);
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

  test("a faceta Minha rede não vaza gente de outra turma (escopo 0097)", async ({
    page,
  }) => {
    // Ana (seed:demo) é turma T1; as personas do seed e2e agora têm papel
    // escopado na "Turma E2E" e duplas na mesma turma — jovem_contatos
    // (0097) e mentorados_turma (join por turma da dupla) devem ignorar
    // tudo isso pra ela NA FACETA REDE. O diretório em si mudou de regra
    // (0239): adultos com papel, jovens com conta e o catálogo são
    // programa-inteiro — eles aparecem em "Todos" por decisão, só não
    // viram "rede" dela. Antes da 0097 o branch de coordenação listava
    // qualquer profile com o papel.
    // Depende do dataset demo — o e2e-app (stack local) só semeia e2e:
    // sem a persona o teste pula, não quebra.
    const [anaExiste] = await buscarViaServiceRole<{ id: string }[]>(
      "profiles",
      `select=id&email=eq.${JOVEM_DEMO_EMAIL}`
    );
    test.skip(!anaExiste, "jovem demo (seed:demo) ausente nesta base");
    await loginComSenha(page, JOVEM_DEMO_EMAIL, SENHA_DEMO);
    await page.goto("/jovem/pessoas");

    // programa-inteiro por decisão (0239): a coordenação e2e e o jovem2
    // com conta aparecem no diretório geral — pessoas do programa, ponto
    await expect(cardDe(page, "Coordenação E2E")).toBeVisible();
    await expect(cardDe(page, "Jovem E2E Sem DPP")).toBeVisible();

    // mas a rede dela segue escopada às duplas/turma dela — a faceta
    // "Minha rede" é quem não pode vazar
    await pill(page, "Minha rede").click();
    await expect(cardDe(page, "Coordenação E2E")).toHaveCount(0);
    await expect(cardDe(page, "Jovem E2E Sem DPP")).toHaveCount(0);
    await expect(cardDe(page, "Mentor E2E")).toHaveCount(0);

    // na borda do PostgREST com o JWT real dela — é a view quem filtra,
    // não a UI (o teste de tela acima podia passar por acidente de nome)
    const jwt = await jwtDoUsuario(JOVEM_DEMO_EMAIL, SENHA_DEMO);
    const res = await restComoUsuario(
      `jovem_contatos?select=id&or=(id.eq.${IDS.espProfile},id.eq.${IDS.esp2Profile},id.eq.${IDS.coordProfile},id.eq.${IDS.mentorProfile})`,
      jwt
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    const resColega = await restComoUsuario(
      `mentorados_turma?select=id&id=eq.${IDS.mentoradoSemDpp}`,
      jwt
    );
    expect(resColega.status).toBe(200);
    expect(await resColega.json()).toEqual([]);
  });
});
