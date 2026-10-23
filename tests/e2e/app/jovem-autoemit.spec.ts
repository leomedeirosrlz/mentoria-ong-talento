import {
  appEnvOk,
  atualizarViaServiceRole,
  buscarViaServiceRole,
  expect,
  inserirViaServiceRole,
  limparDuplas,
  limparEncontrosDaDupla,
  limparViaServiceRole,
  loginComSenha,
  test,
} from "../helpers";

// REALIZA-152 — auto-emissão dos instrumentos da jornada (0099): o link
// do instrumento deixa de depender do gesto manual do mentor/coord. As
// fontes de disponibilidade: a dupla nasce → janela do enc. 1 abre; o
// mentor registra o encontro N → a janela do N+1 abre; a RPC
// jovem_jornada auto-cura o resto (duplas antigas, forms reativados).
// Descansos garantidos: instrumento respondido nunca re-emite e a dupla
// encerrada leva os links pendentes dela junto.
//
// Fixture UI: a dupla PAUSADA do Mentor E2E Colega (…00f2) é a única DPP
// do jovem2 — cronograma próprio e zero encontros de série (encCorrente=1).
// Pausada também emite: jornada viva não espera a dupla voltar.
// Fixture DB: mentoradoLivre+mentorImport recebem uma dupla descartável
// — isola o trigger de INSERT sem nenhum page load.

const JOVEM2_EMAIL = process.env.E2E_JOVEM2_EMAIL ?? "jovem2-e2e@realiza.test";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const DUPLA_COLEGA = "e2e00000-0000-4000-8000-0000000000f2";
const DUPLA_ESP = "e2e00000-0000-4000-8000-0000000000e0";
const CRONOGRAMA_E2E = "e2e00000-0000-4000-8000-0000000000e2";
const MENTOR_IMPORT = "e2e00000-0000-4000-8000-000000000090";
const MENTORADO_LIVRE = "e2e00000-0000-4000-8000-000000000080";
const TURMA_E2E = "Turma E2E";
const SISTEMAS = ["visao", "roda_vida", "pdm", "metas"] as const;

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

type LinkJornada = {
  id: string;
  contexto: { origem?: string; momento?: string } | null;
  usado_em: string | null;
  expira_em: string | null;
  formularios: { sistema: string };
};

/** Links dos 4 instrumentos da jornada de uma dupla, com o sistema
 *  embutido pelo join — o estado real da emissão, sem passar pela UI. */
function linksJornada(duplaId: string) {
  return buscarViaServiceRole<LinkJornada[]>(
    "formulario_links",
    `dupla_id=eq.${duplaId}&select=id,contexto,usado_em,expira_em,formularios!inner(sistema)&formularios.sistema=in.(${SISTEMAS.join(",")})`
  );
}

/** Zera links de instrumento e encontros da dupla — encCorrente volta a 1
 *  e a auto-cura da jovem_jornada emite do zero no primeiro load. Os
 *  filhos morrem antes: o trigger 0071 minta avaliacao_links no
 *  realizado e a FK encontro_id trava o delete (409). */
async function limpar() {
  await limparViaServiceRole(
    "avaliacoes_encontro",
    `dupla_id=eq.${DUPLA_COLEGA}`
  );
  await limparViaServiceRole("avaliacao_links", `dupla_id=eq.${DUPLA_COLEGA}`);
  await limparViaServiceRole("formulario_links", `dupla_id=eq.${DUPLA_COLEGA}`);
  // a varredura da 0071 apaga os filhos NO ACTION (registros→chamados,
  // aval_*) antes do pai — o delete direto bateria 409 se a f2 crescer
  await limparEncontrosDaDupla(DUPLA_COLEGA);
}

test.describe("jornada — auto-emissão de instrumentos (REALIZA-152)", () => {
  test("instrumentos do enc. 1 nascem com link; metas destrava ao registrar o enc. 1", async ({
    page,
  }) => {
    await limpar();
    await loginComSenha(page, JOVEM2_EMAIL, SENHA);
    await page.goto("/jovem/materiais");

    const trilha = page.locator('section[aria-label="Sua jornada"]');
    // enc. corrente 1 → os instrumentos do enc. 1 já nasceram com link:
    // Roda da Vida disponível antes mesmo do programa começar de fato,
    // sem ninguém clicar "Gerar link". Metas segue trancada — a janela
    // dela é enc. 2–3 e o encontro 1 ainda não aconteceu.
    for (const titulo of [
      "Roda da Vida · leitura inicial",
      "Construindo a sua Visão",
      "PDM · Plano de Desenvolvimento",
    ]) {
      const estacao = trilha.locator("article", { hasText: titulo });
      await expect(
        estacao.getByRole("link", { name: "Continuar" })
      ).toBeVisible();
    }
    const trancadas = trilha.locator("details", {
      hasText: "Daqui pra frente",
    });
    await expect(trancadas).toContainText("Definindo minhas metas");
    await expect(
      trilha.locator("article", { hasText: "Definindo minhas metas" })
    ).toHaveCount(0);

    // emissão automática é auditável: um link por instrumento, origem 'auto'
    let links = await linksJornada(DUPLA_COLEGA);
    expect(links).toHaveLength(3);
    expect(links.every((l) => l.contexto?.origem === "auto")).toBe(true);
    expect(links.find((l) => l.formularios.sistema === "roda_vida")?.contexto
      ?.momento).toBe("inicial");

    // o registro do mentor é a fonte: encontro 1 realizado → janela do
    // enc. 2 abre e o link de metas é mintado — a jovem não pede nada.
    const quando = new Date(Date.now() - 86400e3).toISOString();
    const enc = await inserirViaServiceRole("encontros", {
      dupla_id: DUPLA_COLEGA,
      numero: 1,
      data_hora: quando,
      realizado_em: quando,
      status: "realizado",
    });
    expect(enc.id).toBeTruthy();

    // o trigger já mintou — o reload confirma, não emite (idempotente)
    links = await linksJornada(DUPLA_COLEGA);
    expect(links).toHaveLength(4);
    await page.reload();

    await expect(
      trilha
        .locator("article", { hasText: "Definindo minhas metas" })
        .getByRole("link", { name: "Continuar" })
    ).toBeVisible();
    // e a re-emissão é idempotente: os três do enc. 1 seguem únicos
    for (const titulo of [
      "Roda da Vida · leitura inicial",
      "Construindo a sua Visão",
      "PDM · Plano de Desenvolvimento",
    ]) {
      await expect(
        trilha
          .locator("article", { hasText: titulo })
          .getByRole("link", { name: "Continuar" })
      ).toBeVisible();
    }
    links = await linksJornada(DUPLA_COLEGA);
    expect(links).toHaveLength(4);
    await limpar();
  });

  test("trigger da dupla emite no INSERT; respondida descansa; formal abre no enc. 12; encerrada expira", async () => {
    // limpa qualquer dupla/link órfão de runs anteriores — limparDuplas
    // cobre TODOS os filhos NO ACTION (formulario_links, encerramentos,
    // remanejada_de…), não só encontros
    const antigas = await buscarViaServiceRole<{ id: string }[]>(
      "duplas",
      `mentorado_id=eq.${MENTORADO_LIVRE}&select=id`
    );
    await limparDuplas(antigas.map((d) => d.id));

    // a) a dupla nasce → os 3 instrumentos do enc. 1 já estão no banco —
    //    zero page load, zero clique: é o trigger puro
    const dupla = await inserirViaServiceRole("duplas", {
      mentor_id: MENTOR_IMPORT,
      mentorado_id: MENTORADO_LIVRE,
      turma: TURMA_E2E,
      cronograma_id: CRONOGRAMA_E2E,
      trilha: "dpp",
      status: "ativa",
      iniciada_em: new Date().toISOString().slice(0, 10),
    });
    const duplaId = dupla.id as string;
    expect(duplaId).toBeTruthy();
    try {
      let links = await linksJornada(duplaId);
      expect(links.map((l) => l.formularios.sistema).sort()).toEqual(
        ["pdm", "roda_vida", "visao"].sort()
      );
      expect(links.every((l) => l.contexto?.origem === "auto")).toBe(true);

      // b) a jovem responde a roda inicial → a estação descansa: nem o
      //    trigger do próximo realizado nem a auto-cura re-mintam.
      //    E aberta a janela da formal só no enc. 12.
      const roda = links.find((l) => l.formularios.sistema === "roda_vida")!;
      expect(roda.contexto?.momento).toBe("inicial");
      await atualizarViaServiceRole(
        "formulario_links",
        `id=eq.${roda.id}`,
        { usado_em: new Date().toISOString() }
      );
      const quando1 = new Date(Date.now() - 2 * 86400e3).toISOString();
      await inserirViaServiceRole("encontros", {
        dupla_id: duplaId,
        numero: 1,
        data_hora: quando1,
        realizado_em: quando1,
        status: "realizado",
      });
      links = await linksJornada(duplaId);
      // +1 metas (janela do enc. 2 abriu); roda segue 1 — nada de zombie
      expect(links).toHaveLength(4);
      expect(
        links.filter((l) => l.formularios.sistema === "roda_vida")
      ).toHaveLength(1);

      // c) enc. 12 realizado → a formal minta com momento próprio
      const quando12 = new Date(Date.now() - 86400e3).toISOString();
      await inserirViaServiceRole("encontros", {
        dupla_id: duplaId,
        numero: 12,
        data_hora: quando12,
        realizado_em: quando12,
        status: "realizado",
      });
      links = await linksJornada(duplaId);
      const rodas = links.filter((l) => l.formularios.sistema === "roda_vida");
      expect(rodas).toHaveLength(2);
      const formal = rodas.find((l) => l.usado_em === null)!;
      expect(formal.contexto?.momento).toBe("formal");
      expect(formal.contexto?.origem).toBe("auto");

      // d) a dupla morre (remanejo/encerramento) → os pendentes expiram:
      //    nenhum token órfão fica respondível apontando pra dupla morta.
      //    A respondida não é tocada — a resposta é história da dupla.
      // DPP fecha só com status — os campos de carimbo são da trilha
      // especialista (check duplas_encerramento_esp, 0037)
      await atualizarViaServiceRole("duplas", `id=eq.${duplaId}`, {
        status: "encerrada",
      });
      links = await linksJornada(duplaId);
      const respondida = links.find((l) => l.usado_em !== null)!;
      expect(respondida.expira_em).toBeNull();
      for (const l of links.filter((x) => x.usado_em === null)) {
        expect(l.expira_em).not.toBeNull();
      }
    } finally {
      // a dupla encerrada do teste leva encerramentos/links/avaliações
      // junto — limparDuplas varre todos os filhos NO ACTION
      await limparDuplas([duplaId]);
    }
  });

  test("trilha de especialista nunca emite instrumento da jornada DPP", async () => {
    // a duplaEsp da fixture nasceu DEPOIS da migration (db reset roda
    // migrations → seed) — o trigger disparou e respeitou o early-return
    const links = await linksJornada(DUPLA_ESP);
    expect(links).toHaveLength(0);
  });
});
