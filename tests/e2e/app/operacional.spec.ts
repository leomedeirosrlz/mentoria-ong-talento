import {
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  expect,
  inserirViaServiceRole,
  limparEncontrosDaDupla,
  limparViaServiceRole,
  loginComSenha,
  test,
} from "../helpers";

// Fluxos operacionais da coordenação (REALIZA-99…103) contra backend real:
// fila "Aguardando par" em /pessoas, remanejamento atômico na ficha da dupla,
// pareamento em lote por CSV e o builder de cronograma de /turmas.
//
// Fixtures do scripts/seed-e2e-staging.mjs (ids e2e00000-*). Cada spec
// devolve o staging ao estado em que encontrou: a restauração roda no
// afterEach E no beforeEach — o piso que cobre um run morto no meio (o seed
// repete a mesma limpeza).
const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const COORD_SENHA = process.env.E2E_COORD_PASSWORD ?? "";
const DUPLA2_ID =
  process.env.E2E_DUPLA2_ID ?? "e2e00000-0000-4000-8000-000000000070";

const IDS = {
  mentor: "e2e00000-0000-4000-8000-000000000010",
  mentorado: "e2e00000-0000-4000-8000-000000000020",
  coord: "e2e00000-0000-4000-8000-000000000040",
  mentorReserva: "e2e00000-0000-4000-8000-000000000050",
  mentoradoDupla2: "e2e00000-0000-4000-8000-000000000060",
  mentoradoLivre: "e2e00000-0000-4000-8000-000000000080",
  mentorImport: "e2e00000-0000-4000-8000-000000000090",
  mentoradoImport: "e2e00000-0000-4000-8000-0000000000a0",
  // mentor com a dupla pausada do jovem-sem-DPP (REALIZA-113): o "cheio de
  // pausada" dos specs de capacidade — cap implícita 1, uso 1/1
  mentorColega: "e2e00000-0000-4000-8000-0000000000e2",
} as const;
const PROFILES_E2E = [
  IDS.mentor,
  IDS.coord,
  IDS.mentorReserva,
  IDS.mentorImport,
].join(",");
const MENTORADOS_E2E = [
  IDS.mentorado,
  IDS.mentoradoDupla2,
  IDS.mentoradoLivre,
  IDS.mentoradoImport,
].join(",");
// nome único do cronograma do spec — cleanup por prefixo, sem depender de id
const TURMA_E2E = "E2E Turma de teste";

test.skip(
  !appEnvOk() || !COORD_SENHA,
  "sem credenciais de teste (E2E_*) — pula specs de app"
);

/** Remove os cronogramas "E2E …" do staging. Eventos primeiro: a FK
 *  ciclo_eventos.cronograma_id (0061) NÃO tem ON DELETE CASCADE — apagar o
 *  cronograma direto batia em FK violation. */
async function limparCronogramasE2E() {
  const crons = await buscarViaServiceRole<{ id: string }[]>(
    "cronogramas",
    `select=id&turma=like.E2E%20*`
  );
  if (!crons.length) return;
  const ids = crons.map((c) => c.id).join(",");
  await limparViaServiceRole("ciclo_eventos", `cronograma_id=in.(${ids})`);
  await limparViaServiceRole("cronogramas", `id=in.(${ids})`);
}

/** Devolve o staging ao estado do seed — idempotente, vale tanto pro
 *  afterEach quanto pro pre-clean de um staging que sobrou de run quebrado. */
async function restaurarFixtures() {
  // sucessora criada pelo remanejo (carrega remanejada_de=dupla2) e qualquer
  // vínculo do mentorado livre — depois a dupla2 volta a "ativa"
  await limparViaServiceRole("duplas", `remanejada_de=eq.${DUPLA2_ID}`);
  await limparViaServiceRole(
    "duplas",
    `mentorado_id=eq.${IDS.mentoradoLivre}`
  );
  await atualizarViaServiceRole("duplas", `id=eq.${DUPLA2_ID}`, {
    status: "ativa",
  });
  // risco plantado pelo spec da sugestão de remanejo (encontro + registro
  // com precisa_apoio) — filhos da 0071 primeiro, igual ao seed
  await limparEncontrosDaDupla(DUPLA2_ID);
  // capacidade ajustada nos specs (updateCapacidadeMentor faz upsert): a
  // row que o spec cria sai — seed nunca semeia mentor_profiles pra esses
  // dois, então apagar a linha volta ao default implícito 1
  await limparViaServiceRole(
    "mentor_profiles",
    `profile_id=in.(${IDS.mentorReserva},${IDS.mentorColega})`
  );
  // par criado pelo import CSV (identificado pelo mentor fixture)
  await limparViaServiceRole("duplas", `mentor_id=eq.${IDS.mentorImport}`);
  // rastros que os fluxos deixam: nota de saída do remanejo nas fichas das
  // fixtures e notificações "dupla_formada" (remanejo + import)
  await limparViaServiceRole(
    "pessoa_notas",
    `texto=like.*remanejamento*&or=(profile_id.in.(${PROFILES_E2E}),mentorado_id.in.(${MENTORADOS_E2E}))`
  );
  await limparViaServiceRole(
    "notificacoes",
    `profile_id=in.(${PROFILES_E2E})`
  );
  await limparCronogramasE2E();
}

/** 1ª terça estritamente futura — "YYYY-MM-DD" pro input date. */
function proximaTerca(): string {
  const d = new Date();
  const delta = (((2 - d.getDay()) % 7) + 7) % 7 || 7;
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

test.describe("coordenação — fluxos operacionais", () => {
  test.beforeEach(async ({ page }) => {
    // restaura ANTES do login: um run quebrado no meio deixava a dupla2
    // encerrada/o mentorado livre pareado e o próximo spec nascia falho
    await restaurarFixtures();
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);
  });

  test.afterEach(async () => {
    await restaurarFixtures();
  });

  test("pessoas: fila 'Aguardando par' lista o mentorado sem par", async ({
    page,
  }) => {
    await page.goto("/pessoas");
    // seção coord-only — aria-labelledby fixo do componente
    const fila = page.locator(
      'section[aria-labelledby="fila-espera-titulo"]'
    );
    await expect(fila.getByText(/Aguardando par · \d+/)).toBeVisible();
    // a mentorada fixture nunca teve dupla — espera na coluna de mentorados
    await expect(
      fila.getByRole("link", { name: "Abrir perfil de Mentorada E2E Livre" })
    ).toBeVisible();
  });

  test("remanejar o mentorado encerra a dupla e abre a sucessora", async ({
    page,
  }) => {
    await page.goto(`/duplas/${DUPLA2_ID}`);
    // o "Remanejar" do header é o trigger do dialog (data-slot próprio) —
    // quando a dupla está em risco a sugestão da 115 adiciona botões com
    // o mesmo rótulo por candidato, então role+name sozinhos não bastam
    await page
      .locator('button[data-slot="dialog-trigger"]', { hasText: "Remanejar" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // quem sai: o mentorado da dupla (o radio mora dentro do label clicável)
    await dialog
      .locator("label", { hasText: "Trocar o mentorado" })
      .click();
    // opções chegam por fetch client-side — o trigger só existe pronto
    await dialog.locator("#remanejo-novo").click();
    await page
      .getByRole("option", { name: "Mentorada E2E Livre", exact: true })
      .click();
    await dialog
      .locator("#remanejo-detalhe")
      .fill("E2E: exercício de remanejamento");
    // a troca é irreversível — o resumo "antes → depois" aparece antes de
    // confirmar
    await expect(dialog.getByText(/será encerrada/)).toBeVisible();
    await dialog
      .getByRole("button", { name: "Remanejar a dupla" })
      .click();

    // a action empurra pra ficha da dupla nova (URL ≠ da antiga)
    await page.waitForURL(
      (url) =>
        /^\/duplas\/[0-9a-f-]{36}$/.test(url.pathname) &&
        !url.pathname.includes(DUPLA2_ID),
      { timeout: 15_000 }
    );
    await expect(
      page.getByRole("heading", { name: /Mentorada E2E Livre/ })
    ).toBeVisible();
    await expect(page.getByText(/Originada de/)).toBeVisible();

    // a ficha antiga guarda a linhagem: encerrada + aponta a sucessora
    await page.goto(`/duplas/${DUPLA2_ID}`);
    await expect(page.getByText(/Substituída por/)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Mentorada E2E Livre/ })
    ).toBeVisible();
    await expect(
      page.getByText("Dupla encerrada", { exact: true })
    ).toBeVisible();
    // remanejo é de dupla viva — a encerrada não oferece o botão de novo
    await expect(
      page.getByRole("button", { name: "Remanejar", exact: true })
    ).not.toBeVisible();
  });

  test("import CSV de pareamento resolve a prévia e cria a dupla", async ({
    page,
  }) => {
    // label exato da turma da fixture — a coluna turma resolve determinístico
    // mesmo com mais de um cronograma ativo no staging
    const [d2] = await buscarViaServiceRole<{ turma: string }[]>(
      "duplas",
      `select=turma&id=eq.${DUPLA2_ID}`
    );

    await page.goto("/duplas");
    await page.getByRole("button", { name: "Importar CSV" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.locator("#importar-tipo-select").click();
    await page
      .getByRole("option", { name: "Pareamento (duplas)" })
      .click();
    await dialog
      .locator("#csv_text")
      .fill(
        `mentor;mentorado;turma\nMentor E2E Import;Mentorado E2E Import;${d2.turma}`
      );
    await dialog
      .getByRole("button", { name: "Pré-visualizar" })
      .click();

    // a prévia server-side resolveu os dois lados contra o diretório
    await expect(dialog.getByText(/1 dupla pronta/)).toBeVisible();
    await expect(
      dialog.getByText("Pronta", { exact: true })
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: "Criar 1 dupla" })
      .click();

    // a action cria dupla + sinos de uma vez — em suite serial de staging
    // pode passar dos 5s padrão sem estar quebrada
    await expect(dialog.getByText(/1 dupla criada/)).toBeVisible({
      timeout: 20_000,
    });
    // "Fechar" do footer — o X do header também se chama "Fechar"
    // (data-slot="dialog-close"), então filtro pelo botão de ação
    await dialog
      .locator('button[data-slot="button"]', { hasText: "Fechar" })
      .click();
    // a dupla nova aparece na lista (router.refresh da action)
    await expect(
      page.getByRole("link", { name: /Mentor E2E Import/ })
    ).toBeVisible({ timeout: 15_000 });
  });

  test("turmas: builder gera a prévia e grava o cronograma", async ({
    page,
  }) => {
    await page.goto("/turmas");
    await page.getByRole("link", { name: "Novo cronograma" }).click();
    await page.waitForURL("**/turmas/novo");

    // 4 encontros às terças; a exceção default (folga 8→9) não cabe num ciclo
    // de 4 — remover é parte do fluxo
    await page.locator("#cb-turma").fill(TURMA_E2E);
    await page.locator("#cb-total").fill("4");
    await page
      .getByRole("button", { name: "Remover exceção 1" })
      .click();
    await page.locator("#cb-primeiro").fill(proximaTerca());
    await page
      .getByRole("button", { name: "Gerar prévia do calendário" })
      .click();

    // prévia materializada: 4 encontros + preparação (7) + encerramento (1)
    await expect(
      page.getByText(/4 encontros oficiais · 12 eventos/)
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Criar cronograma" })
      .click();

    // a action leva direto ao detalhe da turma criada
    await page.waitForURL(/\/turmas\/[0-9a-f-]{36}/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: new RegExp(TURMA_E2E) })
    ).toBeVisible();
    await expect(
      page.getByText(/4 encontros oficiais/).first()
    ).toBeVisible();
    // a sequência gravada: preparação, mentoria ativa (encontro 1 do guia) e
    // encerramento
    await expect(page.getByText("Mentoria ativa")).toBeVisible();
    await expect(
      page.getByText("Boas-vindas, histórias de vida e abertura")
    ).toBeVisible();
    await expect(
      page.getByText("Evento de encerramento do programa")
    ).toBeVisible();
  });

  // REALIZA-115 — dupla em risco vira pergunta de trabalho: o card sugere
  // quem assume cada lado (cheio marcado "sem vaga", não escondido) e o
  // clique abre o remanejo atômico de sempre já com o par escolhido
  test("dupla em risco sugere remanejo e abre o dialog pré-escolhido", async ({
    page,
  }) => {
    test.slow(); // dois writes em staging (risco plantado + ajuste de capacidade)
    // risco plantado: registro com pedido de apoio num encontro realizado da
    // dupla2 — o semáforo vira "risco" e o card nasce (cleanup tira os dois)
    const enc = await inserirViaServiceRole("encontros", {
      dupla_id: DUPLA2_ID,
      numero: 24, // encontros_numero_faixa = 1..24; o cleanup zera a dupla2
      status: "realizado",
      data_hora: new Date(Date.now() - 2 * 86400000).toISOString(),
      realizado_em: new Date(Date.now() - 2 * 86400000).toISOString(),
    });
    await inserirViaServiceRole("registros", {
      encontro_id: enc.id,
      avaliacao: "boa",
      dificuldade: "nenhuma",
      precisa_apoio: true,
    });

    await page.goto(`/duplas/${DUPLA2_ID}`);
    const card = page.locator(
      'section[aria-labelledby="remanejo-sugerido-titulo"]'
    );
    await expect(card).toBeVisible();
    await expect(
      card.getByText("Sugerir remanejamento", { exact: true })
    ).toBeVisible();
    await expect(card.getByText(/Pedido de apoio/)).toBeVisible();

    // pool de mentores: o import (sem dupla) tem vaga e leva Remanejar;
    // o colega (dupla PAUSADA, cap implícita 1) aparece cheio — a saída
    // dele é ajustar a capacidade, não desaparecer
    const linhaImport = card.locator("li", { hasText: "Mentor E2E Import" });
    await expect(linhaImport).toBeVisible();
    const linhaColega = card.locator("li", { hasText: "Mentor E2E Colega" });
    await expect(linhaColega.getByText(/1\/1 · sem vaga/)).toBeVisible();
    await expect(
      linhaColega.getByRole("button", { name: /aumentar capacidade/ })
    ).toBeVisible();

    // lado do mentorado: a fila "Aguardando par" ranqueada — a Mentorada
    // E2E Livre nunca teve dupla e segue no programa
    await expect(
      card.locator("li", { hasText: "Mentorada E2E Livre" })
    ).toBeVisible();

    // o clique abre o dialog de sempre com lado + par já escolhidos — o
    // resumo "antes → depois" prova a preseleção sem submeter nada
    await linhaImport
      .getByRole("button", { name: "Remanejar", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/será encerrada/)).toBeVisible({
      timeout: 15_000,
    });
    // o nome aparece no select já escolhido e no resumo — strict mode pede first
    await expect(dialog.getByText(/Mentor E2E Import/).first()).toBeVisible();
    // fecha pelo X (sr-only "Fechar") — sem submeter: a prova é a preseleção
    await dialog.getByRole("button", { name: "Fechar" }).click();
    await expect(dialog).not.toBeVisible();

    // a saída do cheio: o ajuste sobe a capacidade e o nome dele sai de
    // "sem vaga" pra candidato — o card re-renderiza pelo refresh
    await linhaColega
      .getByRole("button", { name: /aumentar capacidade/ })
      .click();
    // accessible name vem do título do dialog ("Capacidade de Mentor…")
    const capDialog = page.getByRole("dialog", { name: /Capacidade de/ });
    await expect(capDialog.getByText(/Cuida de 1 dupla em andamento/)).toBeVisible();
    await capDialog.locator("#cap-mentor").fill("2");
    await capDialog.getByRole("button", { name: "Salvar" }).click();
    // dev server compila a action no 1º hit — a janela de write em staging
    // pede folga maior que a dos cliques read-only
    await expect(capDialog).not.toBeVisible({ timeout: 30_000 });
    await expect(
      card.locator("li", { hasText: "Mentor E2E Colega" }).getByRole("button", {
        name: "Remanejar",
        exact: true,
      })
    ).toBeVisible({ timeout: 30_000 });
    // o colega saiu de 1/1 cheio pra 1/2 — outros mentores seguem sem vaga
    await expect(linhaColega.getByText(/sem vaga/)).not.toBeVisible();
    await expect(linhaColega.getByText(/1\/2/)).toBeVisible();
  });

  // REALIZA-116 — o X/Y percorre o board e o NovaDuplaDialog: mentor cheio
  // fica selecionável marcado "sem vaga" (a afinidade dele ainda compara)
  // mas o submit bloqueia até a capacidade subir ou outro mentor entrar
  test("matching: X/Y no board e nova dupla bloqueada até aumentar a capacidade", async ({
    page,
  }) => {
    test.slow(); // write de capacidade em staging no meio do fluxo
    await page.goto("/pessoas");
    await page
      .getByRole("button", { name: "Livres para dupla" })
      .click();

    // board: todo mentor ativo com o X/Y — o reserva (1/1 implícita) já
    // nasce cheio marcado; o import (0/1) tem vaga
    const painel = page.locator("section", {
      has: page.getByRole("heading", { name: "Parear", exact: true }),
    });
    await expect(painel).toBeVisible();
    await painel.locator("#parear-mentor").click();
    await expect(
      page.getByRole("option", { name: /Mentor E2E Reserva · 1\/1 · sem vaga/ })
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: /Mentor E2E Import · 0\/1/ })
    ).toBeVisible();
    // o colega carrega a pausada na contagem — 1/1 sem vaga também
    await expect(
      page.getByRole("option", { name: /Mentor E2E Colega · 1\/1 · sem vaga/ })
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // NovaDuplaDialog: mentor cheio selecionável + marcado, mas o submit
    // segura até a capacidade subir — e o "aumentar capacidade →" resolve
    await painel.getByRole("button", { name: "Nova dupla" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator("#mentor").click();
    await page
      .getByRole("option", { name: /Mentor E2E Reserva · 1\/1 · sem vaga/ })
      .click();
    const submit = dialog.getByRole("button", { name: "Formar dupla" });
    await expect(submit).toBeDisabled();
    await expect(dialog.getByText(/está sem vaga/)).toBeVisible();

    await dialog
      .getByRole("button", { name: /aumentar capacidade/ })
      .click();
    // o dialog de capacidade abre aninhado ao NovaDuplaDialog — o nome
    // acessível ("Capacidade de …") é o escopo certo, não a ordem do DOM
    const capDialog = page.getByRole("dialog", { name: /Capacidade de/ });
    await capDialog.locator("#cap-mentor").fill("2");
    await capDialog.getByRole("button", { name: "Salvar" }).click();
    await expect(capDialog).not.toBeVisible({ timeout: 30_000 });
    // capacidade subiu pra 2 (uso 1) — o bloqueio cai na hora (onSaved
    // atualiza o mapa local sem depender do refresh)
    await expect(submit).toBeEnabled({ timeout: 30_000 });
    await expect(dialog.getByText(/está sem vaga/)).not.toBeVisible();
    // não forma a dupla — o spec só valida o destrave do submit
    await dialog.getByRole("button", { name: "Fechar" }).click();
  });
});
