import type { Locator } from "@playwright/test";
import {
  agirComConfirma,
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  convergirDuplaAtiva,
  expect,
  inserirViaServiceRole,
  jwtDoUsuario,
  limparViaServiceRole,
  loginComSenha,
  relogar,
  restComoUsuario,
  test,
} from "../helpers";

// PDM vivo (REALIZA-181 / cobertura REALIZA-189 §E.27–35) contra backend
// real. A dupla fixture …0030 (mentor e2e × mentorada do jovem-e2e, trilha
// dpp ativa) é a mesma dos outros specs — o documento nasce lazy na 1ª
// escrita (pdm_salvar_item/projeta_resposta), então o piso o zera de
// verdade: sem row = doc vazio, exatamente como a RPC entrega.
//
// Piso entre testes (e retries): pdm+pdm_itens fora, link de metas do
// spec fora (a resposta snapshot cai no cascade do link — ela é do passado,
// o doc vivo é que projeta), sinos de formulario_respondido fora e o
// encontro realizado …00d2 convergido (âncora do "Resumo da jornada" —
// mesma convenção do avaliacao/jovem.spec: recria se um sweep levou).
// Escritas auxiliares vão pela MESMA RPC que a UI chama, só que com o JWT
// do papel via REST (service role não passa no gate pdm_pode_editar).
const MENTOR_EMAIL = process.env.E2E_MENTOR_EMAIL ?? "e2e-mentor@realiza.test";
const JOVEM_EMAIL = process.env.E2E_JOVEM_EMAIL ?? "jovem-e2e@realiza.test";
const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
// mesmo segredo compartilhado — um secret a menos no CI
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const COORD_SENHA = process.env.E2E_COORD_PASSWORD || SENHA;
const DUPLA_ID =
  process.env.E2E_DUPLA_ID ?? "e2e00000-0000-4000-8000-000000000030";

const IDS = {
  mentorProfile: "e2e00000-0000-4000-8000-000000000010",
  jovemProfile: "e2e00000-0000-4000-8000-0000000000b0",
  // encontro realizado da fixture (numero 16) — compartilhado com
  // avaliacao/jovem.spec: âncora da jornada e do resumo
  encontroFixture: "e2e00000-0000-4000-8000-0000000000d2",
} as const;

const SECAO = 'section[aria-label="Plano de desenvolvimento"]';

/** A confirmação do gesto: o componente copia o texto do toast de sucesso
 *  pro <span aria-live> sr-only — mesmo anúncio, assert determinístico
 *  (toasts idênticos empilham e o sr-only não é visível pra getByText). */
const anuncioDe = (secao: Locator, texto: string) =>
  expect(secao.locator('span[aria-live="polite"]')).toContainText(texto, {
    timeout: 15_000,
  });

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

// ---- auxiliares: a RPC escopada chamada como o papel (o que a action faz) ----

let jwtMentor: string | null = null;
/** JWT do mentor cacheado por run — cada teste semeia vários itens. */
async function mentorJwt() {
  return (jwtMentor ??= await jwtDoUsuario(MENTOR_EMAIL, SENHA));
}

/** POST /rest/v1/rpc/<fn> com o JWT do mentor — service role falharia no
 *  pdm_pode_editar de propósito (o gate lê my_profile_id do JWT). */
async function rpcPdm<T = unknown>(
  fn: string,
  args: Record<string, unknown>
): Promise<T> {
  const res = await restComoUsuario(`rpc/${fn}`, await mentorJwt(), {
    method: "POST",
    body: args,
  });
  if (!res.ok)
    throw new Error(`rpc ${fn} → ${res.status}: ${await res.text()}`);
  const texto = await res.text();
  return (texto ? JSON.parse(texto) : null) as T;
}

/** Meta raiz direto pela RPC do mentor — piso dos testes que exercitam
 *  outro gesto (ordem, status, recursão, leitura), não o "Nova meta". */
async function criarMeta(titulo: string) {
  return rpcPdm<string>("pdm_salvar_item", {
    p_dupla_id: DUPLA_ID,
    p_item_id: null,
    p_parent_id: null,
    p_titulo: titulo,
    p_porque: null,
    p_indicador: null,
    p_area_vida: null,
    p_prazo_alvo: null,
  });
}

async function criarSubmeta(paiId: string, titulo: string) {
  return rpcPdm<string>("pdm_salvar_item", {
    p_dupla_id: DUPLA_ID,
    p_item_id: null,
    p_parent_id: paiId,
    p_titulo: titulo,
    p_porque: null,
    p_indicador: null,
    p_area_vida: null,
    p_prazo_alvo: null,
  });
}

async function statusItem(itemId: string, status: string) {
  return rpcPdm("pdm_status_item", {
    p_dupla_id: DUPLA_ID,
    p_item_id: itemId,
    p_status: status,
  });
}

/** O documento da dupla zera + as trilhas do spec (link de metas e os
 *  sinos do submit). O doc lazy não precisa de seed — a 1ª escrita da RPC
 *  cria a row; aqui ela some pra cada teste começar do "sem PDM". */
async function convergirPiso() {
  const [doc] = await buscarViaServiceRole<{ id: string }[]>(
    "pdm",
    `select=id&dupla_id=eq.${DUPLA_ID}`
  );
  if (doc) {
    await limparViaServiceRole("pdm_itens", `pdm_id=eq.${doc.id}`);
    await limparViaServiceRole("pdm", `id=eq.${doc.id}`);
  }
  // só o instrumento metas — as outras fixtures de link (visão do
  // jovem.spec e afins) não são daqui; a resposta snapshot vai no cascade
  const [metas] = await buscarViaServiceRole<{ id: string }[]>(
    "formularios",
    "select=id&sistema=eq.metas&limit=1"
  );
  if (metas) {
    await limparViaServiceRole(
      "formulario_links",
      `dupla_id=eq.${DUPLA_ID}&formulario_id=eq.${metas.id}`
    );
    await limparViaServiceRole(
      "notificacoes",
      `tipo=eq.formulario_respondido&href=eq./formularios/${metas.id}`
    );
  }
  // "Resumo da jornada" só renderiza com história — o realizado da fixture
  // é a âncora (recria se um sweep paralelo levou e reconverge o status se
  // alguém o moveu; o insert remint o link de avaliação que a
  // avaliacao.spec espera pendente)
  const [enc] = await buscarViaServiceRole<
    { id: string; status: string; realizado_em: string | null }[]
  >("encontros", `select=id,status,realizado_em&id=eq.${IDS.encontroFixture}`);
  const ha2d = new Date(Date.now() - 2 * 86400e3).toISOString();
  if (!enc) {
    await inserirViaServiceRole("encontros", {
      id: IDS.encontroFixture,
      dupla_id: DUPLA_ID,
      numero: 16,
      data_hora: ha2d,
      realizado_em: ha2d,
      status: "realizado",
    });
  } else if (enc.status !== "realizado" || !enc.realizado_em) {
    await atualizarViaServiceRole(
      "encontros",
      `id=eq.${IDS.encontroFixture}`,
      { status: "realizado", realizado_em: enc.realizado_em ?? ha2d }
    );
  }
  // o realizado nº16 é o ÚLTIMO do cronograma e2e — o insert (ou o PATCH
  // que o devolve a realizado) dispara a 0102 e a dupla vira 'concluida',
  // o que mata o gate pdm_pode_editar. O piso da fixture é dupla ATIVA:
  // devolve o status e tira o encerramento + sinos que o trigger mintou.
  await convergirDuplaAtiva(DUPLA_ID);
}

test.describe("PDM vivo (REALIZA-181)", () => {
  test.beforeEach(convergirPiso);
  // o último teste não pode vazar metas pro próximo arquivo — o piso
  // reconverge (o beforeEach cobre entre os meus; aqui é saída limpa)
  test.afterAll(convergirPiso);

  // §E.27 — o caminho inteiro do mentor: empty state → dialog completo →
  // item na árvore → sobrevive ao reload (e grava origem/autor no banco).
  test("mentor cria meta completa na ficha — árvore e persistência", async ({
    page,
  }) => {
    await loginComSenha(page, MENTOR_EMAIL, SENHA);
    await page.goto(`/duplas/${DUPLA_ID}?aba=instrumentos`);

    const secao = page.locator(SECAO);
    await expect(
      secao.getByRole("heading", { name: "Plano de desenvolvimento" })
    ).toBeVisible();
    // doc zerado pelo piso: visão por escrever + CTA da primeira meta
    await expect(
      secao.getByRole("button", { name: "Escrever a Declaração de Visão" })
    ).toBeVisible();
    await expect(
      secao.getByText("Nenhuma meta no plano ainda")
    ).toBeVisible();

    await agirComConfirma(
      () =>
        secao
          .getByRole("button", { name: "Adicionar a primeira meta" })
          .click(),
      () => page.getByRole("dialog").isVisible()
    );
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Nova meta" })
    ).toBeVisible();
    await dialog
      .locator("#pdm-titulo")
      .fill("Conseguir um jovem aprendiz até junho");
    await dialog
      .locator("#pdm-porque")
      .fill("Quero minha própria renda e experiência de trabalho.");
    await dialog
      .locator("#pdm-indicador")
      .fill("Contrato assinado num programa de aprendiz");
    // Base UI: o trigger abre a listbox de áreas da Roda
    await agirComConfirma(
      () => dialog.locator("#pdm-area").click(),
      () => page.getByRole("option").first().isVisible()
    );
    await page
      .getByRole("option", { name: "Carreira e trabalho" })
      .click();
    await dialog.locator("#pdm-prazo").fill("2027-06-30");
    await dialog.getByRole("button", { name: "Adicionar" }).click();

    // a árvore recebe a meta com os metadados — refresh do server, sem
    // estado otimista (a RPC é a fonte da verdade)
    await expect(
      secao
        .getByRole("treeitem")
        .filter({ hasText: "Conseguir um jovem aprendiz até junho" })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      secao.getByText("Quero minha própria renda e experiência de trabalho.")
    ).toBeVisible();
    await expect(
      secao.getByText(/Contrato assinado num programa de aprendiz/)
    ).toBeVisible();
    await expect(
      secao.getByText("Carreira e trabalho", { exact: true })
    ).toBeVisible();
    await expect(secao.getByText(/até \d{2} de jun\.? de 2027/)).toBeVisible();
    await expect(
      secao.getByRole("img", { name: "0 de 1 metas atingidas" })
    ).toBeVisible();

    // persistência honesta — reload traz o mesmo documento do servidor
    await page.reload();
    await expect(
      secao.getByText("Conseguir um jovem aprendiz até junho")
    ).toBeVisible({ timeout: 15_000 });
    const itens = await buscarViaServiceRole<
      { titulo: string; origem: string; created_by: string; area_vida: string }[]
    >(
      "pdm_itens",
      "select=titulo,origem,created_by,area_vida&titulo=eq.Conseguir%20um%20jovem%20aprendiz%20at%C3%A9%20junho"
    );
    expect(itens).toHaveLength(1);
    expect(itens[0].origem).toBe("manual");
    expect(itens[0].created_by).toBe(IDS.mentorProfile);
    expect(itens[0].area_vida).toBe("Carreira e trabalho");
  });

  // §E.28 — co-edição real: o jovem retoca o título e planta uma submeta
  // pelo portal dele; o mentor relê o mesmo documento na ficha.
  test("co-edição: jovem edita e cria submeta pelo /jovem/pdm — mentor vê", async ({
    page,
  }) => {
    test.setTimeout(90_000); // dois papeis em sequência, preview frio
    // o mentor cria a meta — mesma RPC que o "Nova meta" chama (a escrita
    // via UI já está coberta no teste acima; aqui o foco é a co-edição)
    await criarMeta("Meta da dupla e2e");

    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem/pdm");
    const pdm = page.locator(SECAO);
    const meta = pdm
      .getByRole("treeitem")
      .filter({ hasText: "Meta da dupla e2e" })
      .first();
    await expect(meta).toBeVisible({ timeout: 15_000 });

    // a jovem retoca o título no portal dela
    await agirComConfirma(
      () =>
        pdm
          .getByRole("button", { name: 'Ações de "Meta da dupla e2e"' })
          .click(),
      () => page.getByRole("menuitem", { name: "Editar" }).isVisible()
    );
    await page.getByRole("menuitem", { name: "Editar" }).click();
    const editar = page.getByRole("dialog");
    await expect(
      editar.getByRole("heading", { name: "Editar meta" })
    ).toBeVisible();
    await editar
      .locator("#pdm-titulo")
      .fill("Meta da dupla e2e — revista pela jovem");
    await editar.getByRole("button", { name: "Salvar" }).click();
    await expect(
      pdm.getByText("Meta da dupla e2e — revista pela jovem")
    ).toBeVisible({ timeout: 15_000 });

    // e planta a submeta pelo ⋯ do próprio nó — a filha nasce dentro do
    // grupo recuado da meta (a borda-l da árvore)
    await agirComConfirma(
      () =>
        pdm
          .getByRole("button", {
            name: 'Ações de "Meta da dupla e2e — revista pela jovem"',
          })
          .click(),
      () =>
        page
          .getByRole("menuitem", { name: "Adicionar submeta" })
          .isVisible()
    );
    await page
      .getByRole("menuitem", { name: "Adicionar submeta" })
      .click();
    const novaSub = page.getByRole("dialog");
    await expect(
      novaSub.getByRole("heading", { name: "Nova submeta" })
    ).toBeVisible();
    await expect(
      novaSub.getByText(/Dentro de "Meta da dupla e2e — revista pela jovem"/)
    ).toBeVisible();
    await novaSub.locator("#pdm-titulo").fill("Passo da jovem e2e");
    await novaSub.getByRole("button", { name: "Adicionar" }).click();

    // a filha renderiza aninhada: dentro do ul[role=group] da meta-mãe
    await expect(
      meta.locator('ul[role="group"] > li[role="treeitem"]', {
        hasText: "Passo da jovem e2e",
      })
    ).toBeVisible({ timeout: 15_000 });
    await expect(meta).toHaveAttribute("aria-expanded", "true");

    // o mentor recarrega a ficha e lê a edição dela — mesmo documento
    await relogar(page, MENTOR_EMAIL, SENHA);
    await page.goto(`/duplas/${DUPLA_ID}?aba=instrumentos`);
    const secao = page.locator(SECAO);
    await expect(
      secao.getByText("Meta da dupla e2e — revista pela jovem")
    ).toBeVisible({ timeout: 15_000 });
    await expect(secao.getByText("Passo da jovem e2e")).toBeVisible();
    // e o autor da escrita é quem escreveu — created_by do banco
    const [sub] = await buscarViaServiceRole<
      { titulo: string; created_by: string; parent_id: string }[]
    >(
      "pdm_itens",
      "select=titulo,created_by,parent_id&titulo=eq.Passo%20da%20jovem%20e2e"
    );
    expect(sub.created_by).toBe(IDS.jovemProfile);
  });

  // §E.29 — a ordem É a prioridade (a cópia diz: "a primeira meta é a mais
  // importante agora"). O jovem sobe a 2ª e ela vira 1ª — e desce de volta.
  test("jovem sobe e desce a prioridade — a ordem persiste entre sessões", async ({
    page,
  }) => {
    await criarMeta("Meta A — primeira e2e");
    await criarMeta("Meta B — que sobe e2e");

    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem/pdm");
    const secao = page.locator(SECAO);
    const raizes = secao.locator('ul[role="tree"] > li[role="treeitem"]');
    await expect(raizes).toHaveCount(2, { timeout: 15_000 });
    await expect(raizes.first()).toContainText("Meta A — primeira e2e");

    // sobe a B: menu ⋯ → "Subir na prioridade"
    await agirComConfirma(
      () =>
        secao
          .getByRole("button", { name: 'Ações de "Meta B — que sobe e2e"' })
          .click(),
      () =>
        page
          .getByRole("menuitem", { name: "Subir na prioridade" })
          .isVisible()
    );
    await page
      .getByRole("menuitem", { name: "Subir na prioridade" })
      .click();
    await anuncioDe(secao, '"Meta B — que sobe e2e" subiu pra 1ª prioridade.');
    await expect(raizes.first()).toContainText("Meta B — que sobe e2e", {
      timeout: 15_000,
    });
    // na ponta, o gesto oposto desabilita — a UI não promete o impossível
    await agirComConfirma(
      () =>
        secao
          .getByRole("button", { name: 'Ações de "Meta B — que sobe e2e"' })
          .click(),
      () =>
        page
          .getByRole("menuitem", { name: "Descer na prioridade" })
          .isVisible()
    );
    await expect(
      page.getByRole("menuitem", { name: "Subir na prioridade" })
    ).toBeDisabled();
    await page
      .getByRole("menuitem", { name: "Descer na prioridade" })
      .click();
    await anuncioDe(secao, '"Meta B — que sobe e2e" desceu pra 2ª prioridade.');
    await expect(raizes.first()).toContainText("Meta A — primeira e2e", {
      timeout: 15_000,
    });

    // sobe de novo e sai — a ordem grava no servidor, não na tela
    await agirComConfirma(
      () =>
        secao
          .getByRole("button", { name: 'Ações de "Meta B — que sobe e2e"' })
          .click(),
      () =>
        page
          .getByRole("menuitem", { name: "Subir na prioridade" })
          .isVisible()
    );
    await page
      .getByRole("menuitem", { name: "Subir na prioridade" })
      .click();
    await expect(raizes.first()).toContainText("Meta B — que sobe e2e", {
      timeout: 15_000,
    });
    await page.reload();
    await expect(
      secao
        .locator('ul[role="tree"] > li[role="treeitem"]')
        .first()
    ).toContainText("Meta B — que sobe e2e", { timeout: 15_000 });
    // escopo pelo pdm_id da fixture — sem ele o select varre as raízes de
    // TODOS os docs do staging (a seed demo de… também planta metas)
    const [docOrdem] = await buscarViaServiceRole<{ id: string }[]>(
      "pdm",
      `select=id&dupla_id=eq.${DUPLA_ID}`
    );
    const ordem = await buscarViaServiceRole<
      { titulo: string; ordem: number }[]
    >(
      "pdm_itens",
      `select=titulo,ordem&pdm_id=eq.${docOrdem.id}&parent_id=is.null&order=ordem`
    );
    expect(ordem.map((i) => i.titulo)).toEqual([
      "Meta B — que sobe e2e",
      "Meta A — primeira e2e",
    ]);
  });

  // §E.30 + histórico — o círculo carimba/descarimba "atingida em" no item
  // e o descarte tira da vista sem apagar: fica no histórico do documento.
  test("jovem carimba atingida, reverte e descarta — histórico guarda", async ({
    page,
  }) => {
    const meta = await criarMeta("Meta do jovem e2e");
    await criarSubmeta(meta, "Passo do jovem e2e");
    await criarMeta("Meta que sai do plano e2e");

    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem/pdm");
    const secao = page.locator(SECAO);
    const passo = secao.getByRole("checkbox", {
      name: 'Marcar "Passo do jovem e2e" como atingida',
    });
    await expect(passo).toBeVisible({ timeout: 15_000 });

    // o círculo é o gesto de "bati": carimba atingida_em no servidor
    await passo.click();
    await expect(secao.getByText(/atingida em/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      secao.getByRole("checkbox", {
        name: 'Marcar "Passo do jovem e2e" como em andamento',
      })
    ).toBeChecked();

    // desmarca — o carimbo some (o banco limpa atingida_em, §A.5)
    await secao
      .getByRole("checkbox", {
        name: 'Marcar "Passo do jovem e2e" como em andamento',
      })
      .click();
    await expect(secao.getByText(/atingida em/)).toHaveCount(0, {
      timeout: 15_000,
    });

    // descartar pelo ⋯ — sai da árvore viva e fica guardado no histórico
    await agirComConfirma(
      () =>
        secao
          .getByRole("button", {
            name: 'Ações de "Meta que sai do plano e2e"',
          })
          .click(),
      () =>
        page
          .getByRole("menuitem", {
            name: "Descartar (fica no histórico)",
          })
          .isVisible()
    );
    await page
      .getByRole("menuitem", { name: "Descartar (fica no histórico)" })
      .click();
    await anuncioDe(
      secao,
      '"Meta que sai do plano e2e" foi descartada — segue no histórico.'
    );
    // fora da vista ativa…
    const arvore = secao.locator('ul[role="tree"]').first();
    await expect(
      arvore.getByText("Meta que sai do plano e2e")
    ).toHaveCount(0, { timeout: 15_000 });
    // …mas dentro do <details> do histórico, com o rótulo "Descartada"
    const historico = secao.locator("details", { hasText: "descartada" });
    await expect(
      historico.getByText(/1 meta descartada · fora do plano/)
    ).toBeVisible();
    await historico.locator("summary").click();
    await expect(
      historico.getByText("Meta que sai do plano e2e")
    ).toBeVisible();
    await expect(
      historico.getByText("Descartada", { exact: true })
    ).toBeVisible();
    // e o banco confirma: row viva com status descartada, não deletada
    const [row] = await buscarViaServiceRole<{ status: string }[]>(
      "pdm_itens",
      "select=status&titulo=eq.Meta%20que%20sai%20do%20plano%20e2e"
    );
    expect(row.status).toBe("descartada");
  });

  // §E.31 — recursão livre: submeta de submeta de submeta. No 4º nível o
  // recuo para e o chip "nível 4" assume a leitura — o comportamento
  // desenhado pra telas de celular (390px aqui).
  test("recursão: submeta dentro de submeta dentro de submeta no mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await criarMeta("Meta raiz e2e");

    await loginComSenha(page, JOVEM_EMAIL, SENHA);
    await page.goto("/jovem/pdm");
    const secao = page.locator(SECAO);
    const meta = secao
      .getByRole("treeitem")
      .filter({ hasText: "Meta raiz e2e" })
      .first();
    await expect(meta).toBeVisible({ timeout: 15_000 });

    // cria um nível por vez: ⋯ do pai → "Adicionar submeta". Quem edita é
    // sempre o nó visível; a filha criada só entra no DOM quando o pai
    // está expandido — nó novo abre fechado (só a raiz abre por padrão).
    const criarFilha = async (paiTitulo: string, filhaTitulo: string) => {
      await agirComConfirma(
        () =>
          secao
            .getByRole("button", { name: `Ações de "${paiTitulo}"` })
            .click(),
        () =>
          page
            .getByRole("menuitem", { name: "Adicionar submeta" })
            .isVisible()
      );
      await page
        .getByRole("menuitem", { name: "Adicionar submeta" })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: "Nova submeta" })
      ).toBeVisible();
      await dialog.locator("#pdm-titulo").fill(filhaTitulo);
      await dialog.getByRole("button", { name: "Adicionar" }).click();
      // o anúncio confirma a gravação — a filha pode estar sob um pai
      // ainda fechado (a visibilidade é assert do expandir, não daqui)
      await anuncioDe(secao, "Item adicionado ao plano.");
    };
    const expandir = async (paiTitulo: string, n: number) => {
      await secao
        .getByRole("button", {
          name: `Expandir ${n} subitens de "${paiTitulo}"`,
        })
        .click();
    };

    await criarFilha("Meta raiz e2e", "Passo 1 e2e");
    await expect(secao.getByText("Passo 1 e2e")).toBeVisible({
      timeout: 15_000,
    });
    await criarFilha("Passo 1 e2e", "Passo 2 e2e");
    // o "Passo 2" nasceu dentro do "Passo 1", que abriu fechado — expande
    await expandir("Passo 1 e2e", 1);
    await expect(secao.getByText("Passo 2 e2e")).toBeVisible({
      timeout: 15_000,
    });
    await criarFilha("Passo 2 e2e", "Passo 3 e2e");
    await expandir("Passo 2 e2e", 1);
    await expect(secao.getByText("Passo 3 e2e")).toBeVisible({
      timeout: 15_000,
    });

    // a cadeia renderiza: três grupos aninhados dentro da meta e o chip
    // "nível 4" marcando a profundidade (o recuo parou de crescer)
    await expect(secao.getByText("nível 4")).toBeVisible({ timeout: 15_000 });
    const passo3 = secao
      .getByRole("treeitem")
      .filter({ hasText: "Passo 3 e2e" })
      .first();
    await expect(passo3).toBeVisible();
    // profundidade estrutural de verdade: tree > li(meta) > group > li > group > li > group > li
    await expect(
      meta.locator(
        'ul[role="group"] > li[role="treeitem"] ul[role="group"] > li[role="treeitem"] ul[role="group"] > li[role="treeitem"]',
        { hasText: "Passo 3 e2e" }
      )
    ).toHaveCount(1);
  });

  // §E.33 — o cap não é erro solto: com 10 metas o CTA sai do ar e a copy
  // explica o limite e o caminho (descartar uma pra abrir espaço).
  test("cap de 10 metas: CTA sai do ar e a copy do limite aparece", async ({
    page,
  }) => {
    for (let i = 1; i <= 10; i++) await criarMeta(`Meta ${i} do teto e2e`);

    await loginComSenha(page, MENTOR_EMAIL, SENHA);
    await page.goto(`/duplas/${DUPLA_ID}?aba=instrumentos`);
    const secao = page.locator(SECAO);
    await expect(
      secao.locator('ul[role="tree"] > li[role="treeitem"]')
    ).toHaveCount(10, { timeout: 15_000 });
    await expect(
      secao.getByRole("button", { name: "Nova meta" })
    ).toHaveCount(0);
    await expect(
      secao.getByText(
        "Limite de 10 metas por plano — descarte uma pra abrir espaço."
      )
    ).toBeVisible();
    // as ações por item seguem — descartar é o caminho que a copy aponta
    await expect(
      secao
        .getByRole("button", { name: 'Ações de "Meta 1 do teto e2e"' })
    ).toBeVisible();
  });

  // §E.34 — a rodada do instrumento alimenta o vivo: emitir o link de
  // Metas pela RPC da ficha (é o que o botão "Gerar link" chama) → a jovem
  // responde em /f/<token> → as metas projetam na árvore com a visão.
  test("resposta do instrumento Metas projeta metas e visão na árvore", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    // o instrumento oficial precisa estar ativo no ambiente pra emitir
    const [formMetas] = await buscarViaServiceRole<{ id: string }[]>(
      "formularios",
      "select=id&sistema=eq.metas&ativo=eq.true&limit=1"
    );
    test.skip(!formMetas, "sem instrumento oficial de metas ativo no ambiente");
    // emissão escopada como o mentor — mesma RPC do botão da ficha
    const emissao = await restComoUsuario(
      "rpc/emitir_link_instrumento",
      await mentorJwt(),
      {
        method: "POST",
        body: { p_dupla_id: DUPLA_ID, p_sistema: "metas" },
      }
    );
    if (!emissao.ok)
      throw new Error(`emitir_link_instrumento → ${emissao.status}`);
    const { token } = (await emissao.json()) as { token: string };
    expect(token).toBeTruthy();

    // resposta pública — o link é a autorização (a jovem nem precisa de
    // sessão pra isso; o gate 0070 também aceitaria ela logada)
    await page.goto(`/f/${token}`);
    await expect(page.locator("#f-declaracao_visao")).toBeVisible({
      timeout: 15_000,
    });
    await page
      .locator("#f-declaracao_visao")
      .fill("Em 3 anos, serei uma profissional formada e independente.");
    await page.locator("#f-meta_1").fill("Conseguir um jovem aprendiz e2e");
    await page.locator("#f-porque_1").fill("Quero minha própria renda.");
    // desdobramento (0118): submetas não é mais um textarea — o "+" abre
    // uma linha por vez e cada input carrega "Submeta N da meta M"; o
    // contrato texto_longo (join por \n) segue o mesmo no submit
    const submetas1 = page.locator('fieldset[data-campo="submetas_1"]');
    await submetas1
      .getByRole("button", { name: "Adicionar submeta" })
      .click();
    await submetas1
      .getByRole("textbox", { name: "Submeta 1 da meta 1" })
      .fill("Montar o currículo e2e");
    await submetas1
      .getByRole("button", { name: "Adicionar submeta" })
      .click();
    await submetas1
      .getByRole("textbox", { name: "Submeta 2 da meta 1" })
      .fill("Me inscrever nos programas e2e");
    await page.locator("#f-meta_2").fill("Subir a média de matemática e2e");
    await page.locator("#f-porque_2").fill("É a matéria que me atrapalha.");
    await page.locator("#f-meta_3").fill("Fazer o simulado completo e2e");
    await page.locator("#f-porque_3").fill("É a porta da faculdade.");
    // o CTA do instrumento carrega o nome do exercício (flow.tsx — CTA
    // por sistema), não o "Enviar resposta" genérico dos forms avulsos
    await page
      .getByRole("button", { name: "Salvar minhas metas" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Resposta enviada!" })
    ).toBeVisible({ timeout: 15_000 });

    // a projeção já aconteceu no submit — a ficha lê o documento vivo
    await loginComSenha(page, MENTOR_EMAIL, SENHA);
    await page.goto(`/duplas/${DUPLA_ID}?aba=instrumentos`);
    const secao = page.locator(SECAO);
    await expect(
      secao.getByText("Conseguir um jovem aprendiz e2e")
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      secao.getByText("Subir a média de matemática e2e")
    ).toBeVisible();
    await expect(secao.getByText("Fazer o simulado completo e2e")).toBeVisible();
    // submetas do desdobramento viraram filhas da meta 1
    const meta1 = secao
      .getByRole("treeitem")
      .filter({ hasText: "Conseguir um jovem aprendiz e2e" })
      .first();
    await expect(
      meta1.locator('ul[role="group"] > li[role="treeitem"]', {
        hasText: "Montar o currículo e2e",
      })
    ).toBeVisible();
    // e a Declaração de Visão da resposta preencheu o bloco
    await expect(
      secao.getByText(/Em 3 anos, serei uma profissional formada/)
    ).toBeVisible();

    // procedência no banco: os itens nasceram da projeção (origem 'metas')
    // — escopo pela pdm_id da fixture: o staging tem outras duplas com
    // metas projetadas e a pergunta é sobre ESTE documento
    const [doc] = await buscarViaServiceRole<{ id: string }[]>(
      "pdm",
      `select=id&dupla_id=eq.${DUPLA_ID}`
    );
    const itens = await buscarViaServiceRole<
      { titulo: string; origem: string; origem_campo: string }[]
    >(
      "pdm_itens",
      `select=titulo,origem,origem_campo&pdm_id=eq.${doc.id}&origem=eq.metas`
    );
    expect(itens.map((i) => i.origem_campo).sort()).toEqual([
      "meta_1",
      "meta_2",
      "meta_3",
      "sub_1_1",
      "sub_1_2",
    ]);
  });

  // §E.35 + §E.32 — staff lê tudo, edita nada: a árvore completa sem
  // círculo/⋯/CTA, e o "Resumo da jornada" conta as metas do PDM.
  test("coord lê a árvore completa sem controles e o resumo conta atingidas", async ({
    page,
  }) => {
    // piso com conteúdo pra ler: visão + meta atingida + meta em curso
    // com submeta — via RPC do mentor (a escrita é dele, não do staff)
    await rpcPdm("pdm_salvar_visao", {
      p_dupla_id: DUPLA_ID,
      p_visao: "Em 3 anos, serei uma profissional formada e independente.",
    });
    const batida = await criarMeta("Meta atingida e2e");
    await statusItem(batida, "atingida");
    const emCurso = await criarMeta("Meta em andamento e2e");
    await criarSubmeta(emCurso, "Passo em andamento e2e");

    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
    await page.goto(`/duplas/${DUPLA_ID}?aba=instrumentos`);
    const secao = page.locator(SECAO);
    await expect(
      secao.getByRole("heading", { name: "Plano de desenvolvimento" })
    ).toBeVisible({ timeout: 15_000 });
    // documento inteiro visível: visão, as duas metas, a submeta e o carimbo
    await expect(
      secao.getByText(/Em 3 anos, serei uma profissional formada/)
    ).toBeVisible();
    await expect(secao.getByText("Meta atingida e2e")).toBeVisible();
    await expect(secao.getByText("Meta em andamento e2e")).toBeVisible();
    await expect(secao.getByText("Passo em andamento e2e")).toBeVisible();
    await expect(secao.getByText(/atingida em/)).toBeVisible();
    await expect(
      secao.getByRole("img", { name: "1 de 2 metas atingidas" })
    ).toBeVisible();

    // sem nenhum controle de edição — podeEditar=false no JSX inteiro
    await expect(secao.getByRole("checkbox")).toHaveCount(0);
    await expect(
      secao.getByRole("button", { name: /^Ações de / })
    ).toHaveCount(0);
    await expect(
      secao.getByRole("button", { name: "Nova meta" })
    ).toHaveCount(0);
    await expect(
      secao.getByRole("button", { name: "Adicionar a primeira meta" })
    ).toHaveCount(0);
    await expect(
      secao.getByRole("button", { name: "Editar" })
    ).toHaveCount(0);

    // §E.32 — "Metas do PDM" no Resumo da jornada: X de Y + a lista das
    // atingidas com data (o encontro realizado da fixture liga o bloco).
    // O bloco mora na aba Encontros da ficha
    await page.goto(`/duplas/${DUPLA_ID}?aba=encontros`);
    const resumo = page.locator('section[aria-label="Resumo da jornada"]');
    await expect(
      resumo.getByRole("heading", { name: "Resumo da jornada" })
    ).toBeVisible();
    const cardMetas = resumo.locator("div", { hasText: "Metas do PDM" });
    await expect(cardMetas.getByText("1 de 2")).toBeVisible();
    await expect(cardMetas.getByText("atingidas")).toBeVisible();
    await expect(resumo.getByText("Meta atingida e2e")).toBeVisible();
    await expect(resumo.getByText(/atingida em/)).toBeVisible();
  });
});
