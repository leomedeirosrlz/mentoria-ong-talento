import {
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  expect,
  inserirViaServiceRole,
  limparDuplas,
  loginComSenha,
  test,
} from "../helpers";

// REALIZA-32 (0125) — o escopo do auxiliar é por pessoa: "só as duplas
// dele" (padrão, duplas.supervisor_id) ou "toda a turma" (profile_papeis
// com escopo_supervisao='turma'). A prova é de RLS real: uma dupla da
// Turma E2E sem supervisor é invisível pro auxiliar até ele ganhar a
// turma inteira — e volta a sumir quando o grant sai.

const SUP_EMAIL = process.env.E2E_SUP_EMAIL ?? "sup-e2e@realiza.test";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const SUP_PROFILE = "e2e00000-0000-4000-8000-000000000100";
const MENTOR_IMPORT = "e2e00000-0000-4000-8000-000000000090";
const MENTORADO_LIVRE = "e2e00000-0000-4000-8000-000000000080";
const CRONOGRAMA_E2E = "e2e00000-0000-4000-8000-0000000000e2";
const TURMA_E2E = "Turma E2E";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

const FILTRO_TURMA = `profile_id=eq.${SUP_PROFILE}&papel=eq.supervisor&escopo_turma=eq.${encodeURIComponent(TURMA_E2E)}`;

/** O seed já pode ter o auxiliar escopado na Turma E2E (escopo "duplas"):
 *  o grant é promover essa linha — ou criá-la quando o ambiente não tem. */
async function darTurma() {
  const [linha] = await buscarViaServiceRole<{ id: string }[]>(
    "profile_papeis",
    `${FILTRO_TURMA}&select=id`
  );
  if (linha) {
    await atualizarViaServiceRole("profile_papeis", `id=eq.${linha.id}`, {
      escopo_supervisao: "turma",
    });
  } else {
    await inserirViaServiceRole("profile_papeis", {
      profile_id: SUP_PROFILE,
      papel: "supervisor",
      escopo_turma: TURMA_E2E,
      escopo_supervisao: "turma",
    });
  }
}

/** Volta ao padrão: a linha fica (é do seed), o grant de turma sai. */
async function limparGrant() {
  await atualizarViaServiceRole("profile_papeis", FILTRO_TURMA, {
    escopo_supervisao: "duplas",
  });
}

test("auxiliar: dupla da turma só aparece com o escopo 'toda a turma'", async ({
  page,
}) => {
  const antigas = await buscarViaServiceRole<{ id: string }[]>(
    "duplas",
    `mentorado_id=eq.${MENTORADO_LIVRE}&select=id`
  );
  await limparDuplas(antigas.map((d) => d.id));
  await limparGrant();

  const dupla = await inserirViaServiceRole("duplas", {
    mentor_id: MENTOR_IMPORT,
    mentorado_id: MENTORADO_LIVRE,
    turma: TURMA_E2E,
    cronograma_id: CRONOGRAMA_E2E,
    trilha: "dpp",
    status: "ativa",
    supervisor_id: null,
    iniciada_em: new Date().toISOString().slice(0, 10),
  });
  const duplaId = String(dupla.id);
  try {
    await loginComSenha(page, SUP_EMAIL, SENHA);

    // padrão "só as dele": a dupla sem supervisor não aparece na lista
    await page.goto("/duplas");
    await expect(page.locator(`a[href="/duplas/${duplaId}"]`)).toHaveCount(0);

    // a coordenação dá a turma inteira
    await darTurma();
    await page.goto("/duplas");
    await expect(
      page.locator(`a[href="/duplas/${duplaId}"]`).first()
    ).toBeVisible({ timeout: 15_000 });

    // grant removido: volta a sumir
    await limparGrant();
    await page.goto("/duplas");
    await expect(page.locator(`a[href="/duplas/${duplaId}"]`)).toHaveCount(0);
  } finally {
    await limparGrant();
    await limparDuplas([duplaId]);
  }
});
