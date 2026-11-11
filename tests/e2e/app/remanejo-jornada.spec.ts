import {
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  expect,
  inserirViaServiceRole,
  jwtDoUsuario,
  limparDuplas,
  limparViaServiceRole,
  restComoUsuario,
  test,
} from "../helpers";

// 0178 — rematch herda a jornada de instrumentos.
//
// Antes da migration o INSERT da dupla nova disparava duplas_jornada_autoemit
// com encCorrente=1 e dedup por dupla: visao/pdm/roda inicial re-mintavam pro
// mentorado que fica mesmo já respondidos na dupla encerrada (e a auto-cura
// do /jovem mintava metas por cima). Agora a emissão do INSERT é suprimida,
// os links respondidos migram pra sucessora, o PDM vivo atravessa, os
// encontros copiados ganham avaliacao_links e a re-emissão roda no fim com
// o estado final — pendente re-minta, respondido descansa.
//
// Fixtures: dupla descartável mentorImport × mentoradoLivre (o mesmo par dos
// specs de auto-emissão/auxiliar — limparDuplas varre a linhagem inteira) +
// mentor/mentorado descartáveis criados no spec (o INSERT em profiles já
// espelha o papel em profile_papeis — o has_papel do rematch passa).
const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const SENHA_COORD =
  process.env.E2E_COORD_PASSWORD ?? process.env.E2E_MENTOR_PASSWORD ?? "";
const MENTOR_BASE = "e2e00000-0000-4000-8000-000000000090";
const MENTORADO_BASE = "e2e00000-0000-4000-8000-000000000080";
const CRONOGRAMA_E2E = "e2e00000-0000-4000-8000-0000000000e2";
const TURMA_E2E = "Turma E2E";
const SISTEMAS = ["visao", "roda_vida", "pdm", "metas"] as const;

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

type LinkJornada = {
  id: string;
  contexto: { origem?: string; momento?: string } | null;
  usado_em: string | null;
  expira_em: string | null;
  dest_mentorado_id: string | null;
  formularios: { sistema: string };
};

/** Links dos 4 instrumentos da jornada de uma dupla — o estado real da
 *  emissão no banco, sem passar pela UI (mesmo recorte do jovem-autoemit). */
function linksJornada(duplaId: string) {
  return buscarViaServiceRole<LinkJornada[]>(
    "formulario_links",
    `dupla_id=eq.${duplaId}&select=id,contexto,usado_em,expira_em,dest_mentorado_id,formularios!inner(sistema)&formularios.sistema=in.(${SISTEMAS.join(",")})`
  );
}

const perfisCriados: string[] = [];
const mentoradosCriados: string[] = [];

/** Varre toda a linhagem que o spec pode ter criado — duplas do par base
 *  (as sucessoras do rematch caem no filtro por mentorado), duplas dos
 *  mentorados descartáveis e os profiles novos (profile_papeis vai em
 *  cascade). Roda antes e depois: run morto deixa resíduo. */
async function limparTudo() {
  const sujas = await buscarViaServiceRole<{ id: string }[]>(
    "duplas",
    `or=(mentorado_id.eq.${MENTORADO_BASE},mentor_id.eq.${MENTOR_BASE})&select=id`
  );
  await limparDuplas(sujas.map((d) => d.id));
  for (const m of mentoradosCriados.splice(0)) {
    const ds = await buscarViaServiceRole<{ id: string }[]>(
      "duplas",
      `mentorado_id=eq.${m}&select=id`
    );
    await limparDuplas(ds.map((d) => d.id));
    await limparViaServiceRole("mentorados", `id=eq.${m}`);
  }
  for (const p of perfisCriados.splice(0)) {
    await limparViaServiceRole("profiles", `id=eq.${p}`);
  }
}

/** Dupla DPP ativa do par base — o INSERT dispara o autoemit e nasce com
 *  os 3 links do enc. 1 (visão, PDM, roda inicial), como na vida real. */
async function duplaBase() {
  const d = await inserirViaServiceRole("duplas", {
    mentor_id: MENTOR_BASE,
    mentorado_id: MENTORADO_BASE,
    turma: TURMA_E2E,
    cronograma_id: CRONOGRAMA_E2E,
    trilha: "dpp",
    status: "ativa",
    iniciada_em: new Date().toISOString().slice(0, 10),
  });
  return d.id as string;
}

/** Mentor descartável: profile com role espelha papel global em
 *  profile_papeis (profiles_role_para_papeis, 0085) — has_papel(…,
 *  'mentor_dpp', turma) aceita escopo null e a capacidade implícita é 1. */
async function mentorDescartavel() {
  const p = await inserirViaServiceRole("profiles", {
    nome: "Mentor E2E Rematch",
    email: `e2e-rematch-${crypto.randomUUID()}@realiza.test`,
    role: "mentor_dpp",
    ativo: true,
  });
  perfisCriados.push(p.id as string);
  return p.id as string;
}

async function encontroRealizado(duplaId: string, numero: number) {
  const quando = new Date(Date.now() - numero * 86400e3).toISOString();
  await inserirViaServiceRole("encontros", {
    dupla_id: duplaId,
    numero,
    data_hora: quando,
    realizado_em: quando,
    status: "realizado",
  });
}

/** "Responder" = carimbar usado_em — o dedup da jornada lê só o carimbo
 *  (mesmo atalho do jovem-autoemit; a resposta jsonb é irrelevante aqui). */
async function responder(linkId: string) {
  await atualizarViaServiceRole("formulario_links", `id=eq.${linkId}`, {
    usado_em: new Date().toISOString(),
  });
}

/** Rematch de verdade, na borda do PostgREST com o JWT da coord — a RPC
 *  exige my_role()='coordenacao', service role não passa no guard. */
async function rematch(
  duplaId: string,
  lado: "mentor" | "mentorado",
  novoId: string
) {
  const jwt = await jwtDoUsuario(COORD_EMAIL, SENHA_COORD);
  const res = await restComoUsuario("rpc/rematch_dupla", jwt, {
    method: "POST",
    body: {
      p_dupla_id: duplaId,
      p_lado: lado,
      p_novo_id: novoId,
      p_motivo: "E2E-178: remanejo de jornada",
      p_registrar_nota: false,
    },
  });
  const text = await res.text();
  expect(res.ok, `rematch lado=${lado} → ${text}`).toBeTruthy();
  return JSON.parse(text) as string;
}

test.describe("remanejo — jornada de instrumentos (0178)", () => {
  test.beforeEach(limparTudo);
  test.afterAll(limparTudo);

  test("rematch de mentor com tudo respondido: respostas migram, zero links novos", async () => {
    const antiga = await duplaBase();
    const mentorNovo = await mentorDescartavel();
    // enc. 1 realizado destrava metas (v_enc=2) — os 4 instrumentos emitidos
    await encontroRealizado(antiga, 1);
    await encontroRealizado(antiga, 2);
    const links = await linksJornada(antiga);
    expect(links).toHaveLength(4);
    for (const l of links) await responder(l.id);
    const respondidos = links.map((l) => l.id).sort();

    // PDM vivo na dupla antiga — o dialog promete "o link do PDM" como herança
    const pdm = await inserirViaServiceRole("pdm", {
      dupla_id: antiga,
      visao: "Quero ser desenvolvedora.",
      visao_em: new Date().toISOString(),
    });
    const item = await inserirViaServiceRole("pdm_itens", {
      pdm_id: pdm.id,
      titulo: "Terminar o curso de lógica",
    });

    // enc. 1 avaliado pela jovem; enc. 2 sem avaliação — o encontro copiado
    // sem ela precisa do avaliacao_links pro "copiar link" da ficha
    const encs = await buscarViaServiceRole<
      { id: string; numero: number }[]
    >(
      "encontros",
      `dupla_id=eq.${antiga}&status=eq.realizado&order=numero&select=id,numero`
    );
    await inserirViaServiceRole("avaliacoes_encontro", {
      dupla_id: antiga,
      encontro_id: encs[0].id,
      estrelas: 5,
    });

    const nova = await rematch(antiga, "mentor", mentorNovo);

    // os mesmos ids na dupla nova: moveram — nenhum link re-mintado
    const linksNova = await linksJornada(nova);
    expect(linksNova.map((l) => l.id).sort()).toEqual(respondidos);
    expect(linksNova.every((l) => l.usado_em !== null)).toBe(true);
    // a encerrada não ficou com link de jornada nenhum
    expect(await linksJornada(antiga)).toHaveLength(0);

    // PDM atravessou com os itens
    const [pdmNovo] = await buscarViaServiceRole<
      { id: string; dupla_id: string; visao: string | null }[]
    >("pdm", `dupla_id=eq.${nova}&select=id,dupla_id,visao`);
    expect(pdmNovo?.id).toBe(pdm.id);
    expect(pdmNovo?.visao).toContain("desenvolvedora");
    const itens = await buscarViaServiceRole<{ id: string }[]>(
      "pdm_itens",
      `pdm_id=eq.${pdm.id}&select=id`
    );
    expect(itens.map((i) => i.id)).toEqual([item.id]);

    // o encontro copiado sem avaliação ganhou link; o avaliado não duplicou
    const encsNova = await buscarViaServiceRole<{ id: string }[]>(
      "encontros",
      `dupla_id=eq.${nova}&status=eq.realizado&select=id`
    );
    const avalsNova = await buscarViaServiceRole<{ encontro_id: string }[]>(
      "avaliacao_links",
      `dupla_id=eq.${nova}&select=encontro_id`
    );
    expect(avalsNova).toHaveLength(1);
    const encSemAval = encsNova.map((e) => e.id);
    expect(encSemAval).toContain(avalsNova[0].encontro_id);
    const avalsFeitas = await buscarViaServiceRole<{ encontro_id: string }[]>(
      "avaliacoes_encontro",
      `dupla_id=eq.${nova}&select=encontro_id`
    );
    expect(avalsFeitas).toHaveLength(1);
    expect(avalsNova[0].encontro_id).not.toBe(avalsFeitas[0].encontro_id);
  });

  test("rematch de mentor sem nada respondido: pendentes expiram na antiga e re-mintam na nova", async () => {
    const antiga = await duplaBase();
    const mentorNovo = await mentorDescartavel();
    const antes = await linksJornada(antiga);
    expect(antes).toHaveLength(3);

    const nova = await rematch(antiga, "mentor", mentorNovo);

    // nada respondido → nada migra: a jovem recebe os links dela de novo
    // (pedir de novo o que nunca foi respondido é o comportamento certo)
    const linksNova = await linksJornada(nova);
    expect(linksNova).toHaveLength(3);
    expect(linksNova.map((l) => l.formularios.sistema).sort()).toEqual(
      ["pdm", "roda_vida", "visao"].sort()
    );
    expect(
      linksNova.every((l) => l.usado_em === null && l.expira_em === null)
    ).toBe(true);
    expect(linksNova.every((l) => !antes.some((a) => a.id === l.id))).toBe(
      true
    );

    // os pendentes morreram com a dupla encerrada — nenhum token órfão vivo
    const linksAntiga = await linksJornada(antiga);
    expect(linksAntiga).toHaveLength(3);
    expect(linksAntiga.every((l) => l.expira_em !== null)).toBe(true);
  });

  test("rematch de mentor parcial: respondidos migram, pendentes re-mintam", async () => {
    const antiga = await duplaBase();
    const mentorNovo = await mentorDescartavel();
    await encontroRealizado(antiga, 1); // destrava metas → 4 links
    const links = await linksJornada(antiga);
    expect(links).toHaveLength(4);
    // visão e metas respondidos; PDM e roda seguem pendentes
    const visao = links.find((l) => l.formularios.sistema === "visao")!;
    const metas = links.find((l) => l.formularios.sistema === "metas")!;
    const pdmAntigo = links.find((l) => l.formularios.sistema === "pdm")!;
    const rodaAntiga = links.find(
      (l) => l.formularios.sistema === "roda_vida"
    )!;
    await responder(visao.id);
    await responder(metas.id);

    const nova = await rematch(antiga, "mentor", mentorNovo);

    const linksNova = await linksJornada(nova);
    expect(linksNova).toHaveLength(4);
    // respondidos: mesmas rows na dupla nova
    const visaoNova = linksNova.find(
      (l) => l.formularios.sistema === "visao"
    )!;
    const metasNova = linksNova.find(
      (l) => l.formularios.sistema === "metas"
    )!;
    expect(visaoNova.id).toBe(visao.id);
    expect(visaoNova.usado_em).not.toBeNull();
    expect(metasNova.id).toBe(metas.id);
    expect(metasNova.usado_em).not.toBeNull();
    // pendentes: mints novas, nunca a mesma row
    const pdmNovo = linksNova.find((l) => l.formularios.sistema === "pdm")!;
    const rodaNova = linksNova.find(
      (l) => l.formularios.sistema === "roda_vida"
    )!;
    expect(pdmNovo.id).not.toBe(pdmAntigo.id);
    expect(pdmNovo.usado_em).toBeNull();
    expect(rodaNova.id).not.toBe(rodaAntiga.id);
    expect(rodaNova.usado_em).toBeNull();
    expect(rodaNova.contexto?.momento).toBe("inicial");
  });

  test("rematch de mentorado: a jovem nova recebe os instrumentos do enc. 1", async () => {
    const antiga = await duplaBase();
    const jovemNova = await inserirViaServiceRole("mentorados", {
      nome: "E2E Rematch Jovem",
    });
    mentoradosCriados.push(jovemNova.id as string);
    // a jovem que sai tinha respondido a visão — a resposta é história DELA,
    // fica na dupla encerrada e não atravessa pra outra pessoa
    const links = await linksJornada(antiga);
    const visao = links.find((l) => l.formularios.sistema === "visao")!;
    await responder(visao.id);

    const nova = await rematch(antiga, "mentorado", jovemNova.id as string);

    const linksNova = await linksJornada(nova);
    expect(linksNova).toHaveLength(3);
    expect(linksNova.map((l) => l.formularios.sistema).sort()).toEqual(
      ["pdm", "roda_vida", "visao"].sort()
    );
    expect(linksNova.every((l) => l.usado_em === null)).toBe(true);
    expect(
      linksNova.every((l) => l.dest_mentorado_id === jovemNova.id)
    ).toBe(true);
    expect(
      linksNova.find((l) => l.formularios.sistema === "roda_vida")?.contexto
        ?.momento
    ).toBe("inicial");

    // a resposta da jovem que saiu segue na dupla morta; os pendentes expiraram
    const linksAntiga = await linksJornada(antiga);
    expect(linksAntiga.filter((l) => l.usado_em !== null)).toHaveLength(1);
    expect(linksAntiga.filter((l) => l.expira_em !== null)).toHaveLength(2);
  });

  test("roda: inicial respondida + histórico ≥ enc. 12 emite só a formal", async () => {
    const antiga = await duplaBase();
    const mentorNovo = await mentorDescartavel();
    const links = await linksJornada(antiga);
    const rodaInicial = links.find(
      (l) => l.formularios.sistema === "roda_vida"
    )!;
    expect(rodaInicial.contexto?.momento).toBe("inicial");
    await responder(rodaInicial.id);
    // enc. 12 realizado → v_enc=13: a janela da formal abre (na antiga já
    // minta a formal pendente — ela morre com a dupla) e metas destrava
    await encontroRealizado(antiga, 12);

    const nova = await rematch(antiga, "mentor", mentorNovo);

    const linksNova = await linksJornada(nova);
    const rodas = linksNova.filter(
      (l) => l.formularios.sistema === "roda_vida"
    );
    // exatamente duas rodas: a inicial respondida (migrada) + UMA formal —
    // nunca uma segunda "inicial" pra uma jovem que já leu a dela
    expect(rodas).toHaveLength(2);
    const iniciais = rodas.filter((l) => l.contexto?.momento === "inicial");
    const formais = rodas.filter((l) => l.contexto?.momento === "formal");
    expect(iniciais).toHaveLength(1);
    expect(iniciais[0].id).toBe(rodaInicial.id);
    expect(iniciais[0].usado_em).not.toBeNull();
    expect(formais).toHaveLength(1);
    expect(formais[0].usado_em).toBeNull();
    expect(formais[0].contexto?.origem).toBe("auto");
  });
});
