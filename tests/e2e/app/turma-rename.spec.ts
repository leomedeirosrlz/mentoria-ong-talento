import {
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  expect,
  inserirViaServiceRole,
  limparViaServiceRole,
  loginComSenha,
  test,
} from "../helpers";

// Rename de turma pra um label que já existe (0127/0179): quando o label
// velho fica órfão o trigger `cronograma_turma_propaga` migra os snapshots
// por label — inclusive profile_papeis.escopo_turma. Sem dedup, quem
// repetia papel nos dois labels batia no profile_papeis_uniq e o 23505
// abortava o UPDATE inteiro (a UI caía no genérico "Já existe um
// cadastro"). Agora o trigger deixa a linha conflitante com o label velho
// pra revisão manual — mesma decisão da fila de inscrições — e a action
// pré-valida nomeando pessoa e papel em vez de mergear em silêncio.
//
// Os dois labels são do prefixo "E2E " — o sweep do seed cobre leftovers.
// Cada spec devolve o staging ao estado em que encontrou (mesmo piso do
// operacional.spec): cleanup no beforeEach E no afterEach.

const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const COORD_SENHA = process.env.E2E_COORD_PASSWORD ?? "";
// personas do seed-e2e: "Supervisor E2E" (auxiliar) e "Mentor E2E Import"
const SUP_PROFILE = "e2e00000-0000-4000-8000-000000000100";
const MENTOR_IMPORT = "e2e00000-0000-4000-8000-000000000090";

const ORIGEM = "E2E Rename Origem";
const DESTINO = "E2E Rename Destino";
const FILTRO_LABELS = `escopo_turma=in.(${encodeURIComponent(ORIGEM)},${encodeURIComponent(DESTINO)})`;

test.skip(
  !appEnvOk() || !COORD_SENHA,
  "sem credenciais de teste (E2E_*) — pula specs de app"
);

type PapelRow = {
  id: string;
  profile_id: string;
  papel: string;
  escopo_turma: string | null;
};

const papeisDoCenario = () =>
  buscarViaServiceRole<PapelRow[]>(
    "profile_papeis",
    `select=id,profile_id,papel,escopo_turma&${FILTRO_LABELS}`
  );

/** Remove cronogramas e papéis dos labels do spec — idempotente, cobre um
 *  run morto no meio. Eventos primeiro (FK ciclo_eventos.cronograma_id é
 *  NO ACTION); os papéis saem antes dos cronogramas porque o
 *  escopo_check exige label vivo em qualquer update posterior. */
async function limparCenario() {
  await limparViaServiceRole("profile_papeis", FILTRO_LABELS);
  const crons = await buscarViaServiceRole<{ id: string }[]>(
    "cronogramas",
    `select=id&turma=in.(${encodeURIComponent(ORIGEM)},${encodeURIComponent(DESTINO)})`
  );
  if (crons.length) {
    const ids = crons.map((c) => c.id).join(",");
    await limparViaServiceRole("ciclo_eventos", `cronograma_id=in.(${ids})`);
    await limparViaServiceRole("cronogramas", `id=in.(${ids})`);
  }
}

/** Dois cronogramas (origem/destino) + a auxiliar com o MESMO papel nos
 *  dois labels (a colisão) e o mentor import só na origem (migra limpo).
 *  escopo_turma só vale label vivo (profile_papeis_escopo_check, 0085) —
 *  os papéis entram depois dos cronogramas. */
async function montarCenario() {
  const origem = await inserirViaServiceRole("cronogramas", {
    nome: "Calendário E2E rename · origem",
    turma: ORIGEM,
    status: "ativo",
  });
  await inserirViaServiceRole("cronogramas", {
    nome: "Calendário E2E rename · destino",
    turma: DESTINO,
    status: "ativo",
  });
  await inserirViaServiceRole("profile_papeis", {
    profile_id: SUP_PROFILE,
    papel: "supervisor",
    escopo_turma: ORIGEM,
    escopo_supervisao: "turma",
  });
  await inserirViaServiceRole("profile_papeis", {
    profile_id: SUP_PROFILE,
    papel: "supervisor",
    escopo_turma: DESTINO,
    escopo_supervisao: "turma",
  });
  await inserirViaServiceRole("profile_papeis", {
    profile_id: MENTOR_IMPORT,
    papel: "mentor_dpp",
    escopo_turma: ORIGEM,
  });
  return String(origem.id);
}

test.describe("turmas — rename pra label que já existe", () => {
  test.beforeEach(limparCenario);
  test.afterEach(limparCenario);

  test("trigger migra os papéis e deixa a duplicata no label velho", async () => {
    const origemId = await montarCenario();

    // PATCH direto no PostgREST — o caminho do trigger, sem a action.
    // Antes da 0179 o update de profile_papeis batia no unique e o PATCH
    // inteiro falhava com 23505 (aqui: o helper lançaria no !res.ok).
    await atualizarViaServiceRole("cronogramas", `id=eq.${origemId}`, {
      turma: DESTINO,
    });

    const papeis = await papeisDoCenario();
    // a auxiliar repetia supervisor nos dois labels: a linha da origem
    // ficou com o label velho pra revisão manual; a do destino já existia
    const sup = papeis.filter((p) => p.profile_id === SUP_PROFILE);
    expect(sup).toHaveLength(2);
    expect(sup.map((p) => p.escopo_turma).sort()).toEqual(
      [ORIGEM, DESTINO].sort()
    );
    // quem não conflitava migrou junto com o label
    const mentor = papeis.filter((p) => p.profile_id === MENTOR_IMPORT);
    expect(mentor).toHaveLength(1);
    expect(mentor[0].escopo_turma).toBe(DESTINO);
  });

  test("dialog bloqueia o merge nomeando a pessoa e o papel repetido", async ({
    page,
  }) => {
    // a página /turmas/[id] lê a lista via unstable_cache de 1h com a
    // service role setada — um cronograma inserido via PostgREST nunca
    // aparece na UI (a página 404ia). A origem é o cronograma do seed
    // ("Turma E2E"); o destino segue inserido porque a UI nunca abre ele —
    // só precisa existir pro check de label vivo e pro papel repetido.
    const SEED_CRON = "e2e00000-0000-4000-8000-0000000000e2";
    const [{ turma: origemLabel }] = await buscarViaServiceRole<
      { turma: string }[]
    >("cronogramas", `select=turma&id=eq.${SEED_CRON}`);
    await inserirViaServiceRole("cronogramas", {
      nome: "Calendário E2E rename · destino",
      turma: DESTINO,
      status: "ativo",
    });
    // a auxiliar E2E já é "supervisor" na "Turma E2E" do seed — só o papel
    // repetido no label novo monta a colisão que a pré-validação nomeia.
    // O rename é bloqueado antes do update: o seed volta intacto e a
    // limpeza só precisa varrer os labels "E2E " (beforeEach/afterEach).
    await inserirViaServiceRole("profile_papeis", {
      profile_id: SUP_PROFILE,
      papel: "supervisor",
      escopo_turma: DESTINO,
      escopo_supervisao: "turma",
    });
    await loginComSenha(page, COORD_EMAIL, COORD_SENHA);

    await page.goto(`/turmas/${SEED_CRON}`);
    await page
      .getByRole("button", { name: "Editar dados do cronograma" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator("#cg-turma").fill(DESTINO);
    await dialog.getByRole("button", { name: "Salvar", exact: true }).click();

    // a pré-validação nomeia o conflito em vez de mergear em silêncio —
    // o toast fica aberto sobre o dialog, que não fecha no erro
    await expect(
      page.getByText(
        /duplicaria papéis: Supervisor E2E já é Auxiliar executivo nas duas turmas/
      )
    ).toBeVisible({ timeout: 15_000 });
    await expect(dialog).toBeVisible();

    // o label da origem não mudou — rename bloqueado de verdade
    const [cron] = await buscarViaServiceRole<{ turma: string }[]>(
      "cronogramas",
      `select=turma&id=eq.${SEED_CRON}`
    );
    expect(cron.turma).toBe(origemLabel);
  });
});
