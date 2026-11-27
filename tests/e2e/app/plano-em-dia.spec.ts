import {
  agirComConfirma,
  appEnvOk,
  buscarViaServiceRole,
  convergirDuplaAtiva,
  convergirDuplaEmDia,
  expect,
  inserirViaServiceRole,
  limparEncontrosDaDupla,
  limparViaServiceRole,
  loginComSenha,
  relogar,
  test,
} from "../helpers";

// REALIZA-397 — "Para ficar em dia" na ficha + pós-save "registrar o próximo
// também". O piso é a dupla fixture e2e…00d1: o card nasce quando 2+ passos
// devidos cabem agendamento/remarcação; o chaining encadeia registros de
// encontros realizado-sem-registro pelo rascunho local + âncora #registrar-id.

const EMAIL = process.env.E2E_MENTOR_EMAIL ?? "";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const COORD_SENHA = process.env.E2E_COORD_PASSWORD ?? "";
const DUPLA_ID = process.env.E2E_DUPLA_ID ?? "";
const MENTOR_PROFILE = "e2e00000-0000-4000-8000-000000000010";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

/** Encontro atrás no tempo no status pedido — data_hora no passado, sem
 *  registro: `nao_aconteceu` alimenta os passos "remarcar" do plano e
 *  `realizado` sem registro é a pendência que o chaining encadeia. */
function criarEncontro(numero: number, status: string, emDiasAtras: number) {
  const quando = new Date(Date.now() + emDiasAtras * 86400e3).toISOString();
  return inserirViaServiceRole("encontros", {
    dupla_id: DUPLA_ID,
    numero,
    data_hora: quando,
    status,
    ...(status === "realizado" ? { realizado_em: quando } : {}),
  });
}

test.describe("plano pra ficar em dia + registro encadeado (REALIZA-397)", () => {
  test.beforeEach(async ({ page }) => {
    if (DUPLA_ID) await limparEncontrosDaDupla(DUPLA_ID);
    // um 'aceito' pendurado (run anterior) cala a projeção do card — o
    // teste lê "Plano valendo" toda vez, então o piso é plano limpo
    if (DUPLA_ID)
      await limparViaServiceRole("dupla_planos", `dupla_id=eq.${DUPLA_ID}`);
    if (DUPLA_ID) await convergirDuplaAtiva(DUPLA_ID);
    await loginComSenha(page, EMAIL, SENHA);
  });

  test.afterEach(async () => {
    if (DUPLA_ID) await limparEncontrosDaDupla(DUPLA_ID);
    if (DUPLA_ID)
      await limparViaServiceRole("dupla_planos", `dupla_id=eq.${DUPLA_ID}`);
  });

  test("mentor combina o plano na superfície — uma pergunta por tela até o gesto", async ({
    page,
  }) => {
    // o plano precisa FECHAR pra superfície abrir o gesto — "conversa"
    // (nenhum ritmo fecha) não tem "Combinar". O calendário fixo deixa
    // todo passo vencido devendo: cobrir o resto e segurar só os dois
    // 'não aconteceu' deixa a dupla em recuperação, como o spec sempre
    // assumiu — 2 passos remarcáveis, não a trilha inteira
    await convergirDuplaEmDia(DUPLA_ID, MENTOR_PROFILE, { exceto: [3, 4] });
    await criarEncontro(3, "nao_aconteceu", -7);
    await criarEncontro(4, "nao_aconteceu", -5);
    await page.goto(`/duplas/${DUPLA_ID}?aba=agora`);

    const card = page.getByRole("region", { name: "Para ficar em dia" });
    await expect(card).toBeVisible();
    // a data projetada é o número principal do card — projeção honesta,
    // conta quem vence no caminho, não só o backlog de hoje
    await expect(
      card.getByText(/Em dia em|Nesse ritmo não fecha/)
    ).toBeVisible();
    // 518: o card é leitura — nada de Agendar/Remarcar por passo; o gesto
    // inteiro (ritmo, recesso, grade) mora no "Combinar o plano"
    await expect(
      card.getByRole("button", { name: /Agendar|Remarcar/ })
    ).toHaveCount(0);

    // a superfície pode demorar a hidratar — repete o gesto até o
    // dialog abrir (mesmo padrão do agendar)
    const dialog = page.getByRole("dialog", { name: "Combinar o plano" });
    await agirComConfirma(
      () => card.getByRole("button", { name: "Combinar o plano" }).click(),
      () => dialog.isVisible()
    );
    await expect(
      dialog.getByText("Quantos encontros por semana")
    ).toBeVisible({ timeout: 15_000 });

    // ritmo livre: "outro" aceita qualquer inteiro — 7 = até 1 por dia,
    // o ritmo que sempre fecha quando o card diz que fecha. O input é
    // sr-only — clica o label pai (padrão do login por senha)
    await dialog
      .locator("label", {
        has: page.locator('input[name="ritmo"][value="outro"]'),
      })
      .click();
    await dialog
      .getByLabel("Outro número de encontros por semana")
      .fill("7");

    // as perguntas seguintes dependem do cronograma: recesso pendente
    // exige resposta da dupla — o mentor logado é lado (staff passaria
    // sem responder, suposição 0245 coberta no teste abaixo); grade em
    // falta vira pergunta — responde o que aparecer até o gesto final
    const combinar = dialog.getByRole("button", {
      name: "Combinar",
      exact: true,
    });
    for (let i = 0; i < 4 && !(await combinar.isVisible()); i++) {
      for (const r of await dialog
        .locator("label", { hasText: "Vamos seguir nos encontrando" })
        .all()) {
        // o wizard monta todas as etapas e esconde a inativa — a pergunta
        // de recesso de outra tela casa o hasText mas não é clicável
        if (!(await r.isVisible())) continue;
        if (
          (await r.isVisible()) &&
          !(await r
            .locator('input[type="radio"]')
            .isChecked()
            .catch(() => false))
        )
          await r.click();
      }
      const semGrade = dialog.locator("label", {
        hasText: "Combinar sem a grade",
      });
      if (await semGrade.isVisible()) await semGrade.click();
      const avancar = dialog.getByRole("button", { name: "Avançar" });
      await expect(avancar).toBeEnabled({ timeout: 15_000 });
      await avancar.click();
    }
    await expect(combinar).toBeEnabled({ timeout: 15_000 });
    await combinar.click();

    // mentor é lado: o combinado nasce valendo (aceito) e o jovem é
    // avisado — aceite único do 0225, não sobra pendência bilateral
    await expect(
      page.getByText("Plano valendo", { exact: false })
    ).toBeVisible({ timeout: 15_000 });
    const [vivo] = await buscarViaServiceRole<{ status: string }[]>(
      "dupla_planos",
      `dupla_id=eq.${DUPLA_ID}&status=in.(proposto,aceito,ativo)&order=created_at.desc&limit=1`
    );
    expect(vivo.status).toBe("aceito");
  });

  test("pós-save oferece 'registrar o próximo também' e preenche o rascunho", async ({
    page,
  }) => {
    const e3 = await criarEncontro(3, "realizado", -3);
    const e4 = await criarEncontro(4, "realizado", -1);
    await page.goto(`/duplas/${DUPLA_ID}?aba=encontros`);

    // abre o form do 3º pela âncora própria — a linha realizado-sem-registro
    // nasce com o trigger "Registrar" (um <a> apesar do visual de botão)
    const linha3 = page.locator(`#registrar-${String(e3.id)}`);
    await linha3.getByRole("link", { name: "Registrar" }).click();

    const form3 = linha3.locator("form");
    await expect(form3).toBeVisible();
    // avaliacao é o único campo com portão — fica na etapa 1 ("Como foi")
    // com o rótulo novo do review #9; o input é sr-only, clica no rótulo
    // visível (label → radio nativo: funciona antes da hidratação)
    await form3.getByText("Sim", { exact: true }).click();
    // duração não-default: é o campo compartilhado que o rascunho do 4º
    // herda. O Select é client — o clique pode cair pré-hidratação (o
    // form é lazy-loaded no hash), então repete até a option abrir
    const opcao90 = page.getByRole("option", { name: "1h30" });
    await agirComConfirma(
      () => form3.locator("#duracao-select").click(),
      () => opcao90.isVisible()
    );
    await opcao90.click();

    await agirComConfirma(
      () => form3.getByRole("button", { name: "Avançar" }).click(),
      () => form3.getByText(/Passo 2 de 3/).isVisible()
    );
    // 472: registro só de defaults não é entrega — o servidor recusa sem
    // conteúdo; o tema é o campo livre da etapa 2 desde o review #9
    await form3.locator("#tema").fill("E2E: tema do registro");
    await agirComConfirma(
      () => form3.getByRole("button", { name: "Avançar" }).click(),
      () => form3.getByText(/Passo 3 de 3/).isVisible()
    );
    const proximoTambem = linha3.getByRole("button", {
      name: "Registrar o 4º também",
    });
    await agirComConfirma(
      () => form3.getByRole("button", { name: "Salvar registro" }).click(),
      () => proximoTambem.isVisible()
    );

    // pós-save: a oferta aponta o 4º (menor nº devendo registro na dupla)
    await expect(proximoTambem).toBeVisible({ timeout: 15_000 });
    await proximoTambem.click();

    // a âncora troca pro 4º e o form dele abre já hidratado pelo rascunho
    await expect(page).toHaveURL(new RegExp(`#registrar-${String(e4.id)}`), {
      timeout: 15_000,
    });
    const linha4 = page.locator(`#registrar-${String(e4.id)}`);
    const form4 = linha4.locator("form");
    await expect(form4).toBeVisible({ timeout: 15_000 });
    await expect(
      form4.getByText(/Rascunho de .* restaurado/)
    ).toBeVisible({ timeout: 15_000 });
    // campos compartilhados vieram no rascunho
    await expect(
      form4.locator('input[name="avaliacao"][value="boa"]')
    ).toBeChecked({ timeout: 15_000 });
    await expect(form4.locator("#duracao-select")).toContainText("1h30", {
      timeout: 15_000,
    });
  });

  test("a sessão cobre outro passo do guia — UM registro na âncora cobre o grupo (018)", async ({
    page,
  }) => {
    const e6 = await criarEncontro(6, "realizado", -4);
    const e7 = await criarEncontro(7, "realizado", -2);
    await page.goto(`/duplas/${DUPLA_ID}?aba=encontros`);

    const linha6 = page.locator(`#registrar-${String(e6.id)}`);
    await linha6.getByRole("link", { name: "Registrar" }).click();
    const form6 = linha6.locator("form");
    await expect(form6).toBeVisible();

    // etapa 1 enxuta (review #9): só o portão da avaliação e a duração
    await form6.getByText("Sim", { exact: true }).click();
    await form6.getByRole("button", { name: "Avançar" }).click();
    // a sessão física cobriu o 7º também — o checkbox desceu pro passo 2
    // junto das atividades. 018: UM registro fica na âncora com o 7º na
    // cobertura; a row do 7º só linka o mesmo sessao_id — clone nunca
    await expect(form6.getByText("7º encontro")).toBeVisible();
    await form6.getByText("7º encontro").click();
    // 472: sem conteúdo o servidor recusa e a oferta do 7º não aparece
    await form6.locator("#tema").fill("E2E: tema do registro");
    await form6.getByRole("button", { name: "Avançar" }).click();
    await form6.getByRole("button", { name: "Salvar registro" }).click();

    await expect(
      page.getByText(/Também cobriu o 7º encontro/)
    ).toBeVisible({ timeout: 15_000 });

    // UMA sessão = UM registro, na âncora — os demais nºs moram na
    // cobertura dele, nunca num segundo registro
    const regs = await buscarViaServiceRole<
      { encontro_id: string; cobertura: number[] | null }[]
    >(
      "registros",
      `select=encontro_id,cobertura&encontro_id=in.(${String(e6.id)},${String(e7.id)})`
    );
    expect(regs).toHaveLength(1);
    expect(regs[0].encontro_id).toBe(String(e6.id));
    expect(regs[0].cobertura).toEqual([7]);

    // as duas rows são realizado NA mesma sessão — sessao_id carimba o grupo
    const encs = await buscarViaServiceRole<
      { id: string; status: string; sessao_id: string | null }[]
    >(
      "encontros",
      `select=id,status,sessao_id&id=in.(${String(e6.id)},${String(e7.id)})`
    );
    expect(encs).toHaveLength(2);
    expect(encs.every((e) => e.status === "realizado")).toBe(true);
    expect(encs[0].sessao_id).toBeTruthy();
    expect(encs[0].sessao_id).toBe(encs[1].sessao_id);

    // e o pós-save NÃO oferece "registrar o 7º" — a sessão já deu o dele
    await expect(
      linha6.getByRole("button", { name: "Registrar o 7º também" })
    ).toHaveCount(0);
  });

  test("a equipe combina sem a decisão do recesso — a proposta sai com suposição", async ({
    page,
  }) => {
    // 0245 "propor não é decidir pela dupla": com pendência aberta o
    // passo do recesso é leitura + aviso pra equipe (a suposição é pausa,
    // não resposta dela) e o gesto fecha sem ela — pra DUPLA a decisão
    // continua prévia (o fluxo do mentor acima responde as pills). A
    // pendência segue a régua do recessosPendentes do planner: período
    // do cronograma dela sem row e com fim no futuro
    test.skip(!DUPLA_ID, "sem E2E_DUPLA_ID — piso do spec ausente");
    const [duplaRow] = await buscarViaServiceRole<
      { cronograma_id: string | null }[]
    >("duplas", `select=cronograma_id&id=eq.${DUPLA_ID}&limit=1`);
    const cronogramaId = duplaRow?.cronograma_id ?? "";
    test.skip(
      !cronogramaId,
      "dupla fixture sem cronograma — o wizard não tem recesso pra assumir"
    );
    // o cenário é a pendência: decisão declarada de run anterior não pesa
    await limparViaServiceRole("dupla_recessos", `dupla_id=eq.${DUPLA_ID}`);
    const evs = await buscarViaServiceRole<
      { id: string; data: string | null; data_fim: string | null }[]
    >(
      "ciclo_eventos",
      `cronograma_id=eq.${cronogramaId}&tipo=eq.recesso&data=not.is.null&select=id,data,data_fim`
    );
    const hojeStr = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Sao_Paulo",
    });
    const pendentes = evs.filter((e) => (e.data_fim ?? e.data)! >= hojeStr);
    test.skip(
      pendentes.length === 0,
      "recesso da fixture já passou — sem pendência o wizard não tem suposição pra mostrar"
    );

    // mesmo piso do fluxo do mentor: 2 passos remarcáveis
    await convergirDuplaEmDia(DUPLA_ID, MENTOR_PROFILE, { exceto: [3, 4] });
    await criarEncontro(3, "nao_aconteceu", -7);
    await criarEncontro(4, "nao_aconteceu", -5);
    // o piso do arquivo já logou o mentor — a equipe propõe pelo mesmo gesto
    await relogar(page, COORD_EMAIL, COORD_SENHA);
    await page.goto(`/duplas/${DUPLA_ID}?aba=agora`);

    const card = page.getByRole("region", { name: "Para ficar em dia" });
    await expect(card).toBeVisible();
    // o card da equipe já anuncia a suposição antes de abrir o wizard
    await expect(
      card.getByText(/dá para enviar assim/i)
    ).toBeVisible({ timeout: 15_000 });

    const dialog = page.getByRole("dialog", { name: "Combinar o plano" });
    await agirComConfirma(
      () => card.getByRole("button", { name: "Combinar o plano" }).click(),
      () => dialog.isVisible()
    );
    await expect(
      dialog.getByText("Quantos encontros por semana")
    ).toBeVisible({ timeout: 15_000 });

    // ritmo livre — o mesmo atalho do fluxo do mentor
    await dialog
      .locator("label", {
        has: page.locator('input[name="ritmo"][value="outro"]'),
      })
      .click();
    await dialog
      .getByLabel("Outro número de encontros por semana")
      .fill("7");

    // o passo do recesso pra equipe é leitura + aviso: as pills da
    // decisão nem montam pro staff — o wizard avança sem resposta dela
    const combinar = dialog.getByRole("button", {
      name: "Combinar",
      exact: true,
    });
    let viuSuposicao = false;
    for (let i = 0; i < 5 && !(await combinar.isVisible()); i++) {
      if (await dialog.getByText(/recesso no caminho/i).isVisible()) {
        viuSuposicao = true;
        // a etapa inativa fica `hidden` — fora da árvore de acessibilidade.
        // O texto visível é o que a pessoa lê na pergunta atual
        // a nota da suposição é coberta pelo teste de componente
        // (plano-em-dia-card: "a suposição avisa em vez de travar"); aqui
        // o que importa é o gesto seguir sem as pills de decisão
        await expect(
          dialog.getByRole("radio", { name: /Vamos seguir|Vamos pausar/ })
        ).toHaveCount(0);
      }
      const semGrade = dialog.locator("label", {
        hasText: "Combinar sem a grade",
      });
      if (await semGrade.isVisible()) await semGrade.click();
      const avancar = dialog.getByRole("button", { name: "Avançar" });
      await expect(avancar).toBeEnabled({ timeout: 15_000 });
      await avancar.click();
    }
    await expect(combinar).toBeEnabled({ timeout: 15_000 });
    expect(viuSuposicao).toBe(true);
    await combinar.click();

    // a proposta sai assumida: nasce "proposto" esperando o aceite da
    // dupla — e NENHUMA linha entra em dupla_recessos
    await expect(
      page.getByText(/Falta um aceite da dupla/i)
    ).toBeVisible({ timeout: 15_000 });
    const [vivo] = await buscarViaServiceRole<
      {
        status: string;
        escopo: {
          decisoes?: {
            recessos?: { cicloEventoId: string; origem?: string }[];
          };
        };
      }[]
    >(
      "dupla_planos",
      `dupla_id=eq.${DUPLA_ID}&status=in.(proposto,aceito,ativo)&order=created_at.desc&limit=1&select=status,escopo`
    );
    expect(vivo.status).toBe("proposto");
    // a suposição viaja no escopo e é o que o aceite resolve depois —
    // toda pendência sai marcada 'proposta' (o carimbo `assumido` em si
    // a RPC só liga quando o período cruza a janela do plano, o que é
    // sazonal; a cobertura cheia é o assert do acordo.spec)
    const sup = vivo.escopo.decisoes?.recessos ?? [];
    expect(sup.length).toBeGreaterThanOrEqual(1);
    expect(sup.every((d) => d.origem === "proposta")).toBe(true);
    expect(
      await buscarViaServiceRole(
        "dupla_recessos",
        `dupla_id=eq.${DUPLA_ID}&select=id`
      )
    ).toHaveLength(0);
  });
});
