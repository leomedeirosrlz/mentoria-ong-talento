import { beforeEach, describe, expect, it, vi } from "vitest";

// demoRole lê o cookie da persona — no vitest (node, fora de request) o
// next/headers é simulado. O default é o mentor Ricardo, que tem duplas
// de sobra pra exercitar a escolha; os testes do "ficar em dia" trocam
// pra coordenação quando a dupla nomeada é de outro mentor
const demo = vi.hoisted(() => ({ role: "mentor_dpp" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: demo.role }) }),
}));

import { responderDemoIa } from "./ia";
import { demoJovemPlano } from "./queries";
import type { UiBloco, UiPlano, UiPlanoJovem } from "@/lib/ia/ui";

beforeEach(() => {
  demo.role = "mentor_dpp";
});

const blocoJson = (content: string, tag: string) =>
  JSON.parse(content.split(`\`\`\`${tag}\n`)[1].split("\n```")[0]);

const planoDe = (ui: UiBloco[]): UiPlano | null =>
  ui.find((b): b is UiPlano => b.kind === "plano") ?? null;

const planoJovemDe = (ui: UiBloco[]): UiPlanoJovem | null =>
  ui.find((b): b is UiPlanoJovem => b.kind === "plano_jovem") ?? null;

// QA 25/11: nenhuma resposta da demo pode vazar implementação — o texto
// honesto fala "na demonstração" / "com os seus dados", nunca RPC, nome
// de função, rota ou "ambiente real"
const MECANICA = /\bRPC\b|jovem_\w+|ambiente real|rota real|mesmo motor|\bview\b|\btabela\b|\bfunção\b/i;

describe("responderDemoIa — sem vazamento de implementação (QA 25/11)", () => {
  const perguntas: [string, string][] = [
    ["mentor_dpp", "e a adesão?"],
    ["mentor_dpp", "resumo da semana"],
    ["mentor_dpp", "próximos encontros"],
    ["coordenacao", "como a dupla do Caio vai ficar em dia?"],
    ["mentor_dpp", "escreva um lembrete pra dupla"],
    ["mentorado", "como tá minha jornada?"],
    ["mentorado", "o que tenho pra fazer?"],
    ["mentorado", "quando é o próximo encontro?"],
    ["mentorado", "quem é meu mentor?"],
    ["mentorado", "meu plano"],
    ["mentorado", "o que é o PDM?"],
    ["mentorado", "nos encontramos sem agendar"],
    ["mentorado", "quais meus pedidos de especialista?"],
  ];
  for (const [role, pergunta] of perguntas) {
    it(`[${role}] "${pergunta}"`, async () => {
      demo.role = role;
      const r = await responderDemoIa(pergunta);
      if (r) expect(r.content).not.toMatch(MECANICA);
    });
  }

  it("meu_plano projeta o plano do dataset, não um payload fixo", async () => {
    demo.role = "mentorado";
    const r = await responderDemoIa("meu plano");
    const card = planoJovemDe(r!.ui);
    const esperado = demoJovemPlano("mentorado");
    expect(card).not.toBeNull();
    expect(esperado).not.toBeNull();
    expect(card!.status).toBe(esperado!.status);
    expect(card!.versao).toBe(esperado!.versao);
    expect(card!.passos_aplicados.length).toBe(
      esperado!.passos_aplicados.length
    );
  });
});

describe("responderDemoIa — aderência (REALIZA-465)", () => {
  it("responde 'e a adesão' com número e próximo passo, não o fallback", async () => {
    const r = await responderDemoIa("e a adesão?");
    expect(r).not.toBeNull();
    expect(r!.content).toContain("Na demonstração");
    expect(r!.content).toContain("**");
    expect(r!.content).toMatch(/\d/);
    expect(r!.content).toContain("Próximo passo:");
    expect(r!.content).not.toContain("não tem acesso");
  });
});

describe("responderDemoIa — templates do cap. 14 (REALIZA-388)", () => {
  it("CTA sem dupla nomeada devolve a escolha antes do texto", async () => {
    const r = await responderDemoIa(
      'Quero personalizar o template mensagem-preparacao ("Mensagem de preparação do(a) mentorado(a)") com os dados reais.'
    );
    expect(r).not.toBeNull();
    expect(r!.content).toContain("```escolha");
    const escolha = blocoJson(r!.content, "escolha");
    expect(escolha.opcoes.length).toBeGreaterThan(1);
    expect(escolha.opcoes[0].valor).toContain("prepara");
  });

  it("dupla nomeada no pedido sai direto pro rascunho", async () => {
    const r = await responderDemoIa(
      "pedido: personaliza a mensagem de preparação pra dupla da Bia"
    );
    expect(r).not.toBeNull();
    expect(r!.content).toContain("```rascunho");
    const rascunho = blocoJson(r!.content, "rascunho");
    expect(rascunho.canal).toBe("whatsapp");
    expect(rascunho.texto).toContain("Bia");
    expect(rascunho.texto).not.toContain("[Nome]");
  });

  it("encaminhamento usa a tarefa pendente e o próximo encontro da dupla", async () => {
    const r = await responderDemoIa(
      "pedido: personaliza a mensagem de encaminhamento pra dupla da Bia"
    );
    expect(r).not.toBeNull();
    expect(r!.content).toContain("```rascunho");
    const rascunho = blocoJson(r!.content, "rascunho");
    expect(rascunho.texto).toContain("Próxima tarefa:");
  });

  it("indicadas monta o convite com link de exemplo, sem numero inventado", async () => {
    const r = await responderDemoIa(
      'Quero personalizar o template mensagem-indicadas ("Mensagem às pessoas indicadas") com os dados reais da dupla da Bia.'
    );
    expect(r).not.toBeNull();
    expect(r!.content).toContain("```rascunho");
    const rascunho = blocoJson(r!.content, "rascunho");
    expect(rascunho.texto).toContain("/t/");
    expect(rascunho.numero).toBeUndefined();
  });
});

describe("responderDemoIa — BI de pessoas (onda 5)", () => {
  const agregadoDe = (ui: UiBloco[]) =>
    ui.find((b): b is Extract<UiBloco, { kind: "agregado" }> => b.kind === "agregado") ?? null;

  it("coord pergunta por estado e recebe o card agregado do dataset", async () => {
    demo.role = "coordenacao";
    const r = await responderDemoIa("quantas pessoas por estado?");
    expect(r).not.toBeNull();
    expect(r!.content).toContain("Na demonstração");
    expect(r!.content).toContain("ficha de mentorado");
    const card = agregadoDe(r!.ui);
    expect(card).not.toBeNull();
    expect(card!.titulo).toBe("Pessoas por estado (UF)");
    expect(card!.total).toBeGreaterThan(0);
    expect(card!.itens.length).toBeGreaterThan(0);
  });

  it("coord pergunta por gênero e o card sai — é o recorte dela", async () => {
    demo.role = "coordenacao";
    const r = await responderDemoIa("quantos jovens por gênero?");
    expect(r).not.toBeNull();
    const card = agregadoDe(r!.ui);
    expect(card).not.toBeNull();
    // o filtro "jovens" chega nomeado no recorte do card
    expect(card!.recorte).toContain("Mentorado");
    expect(r!.content).not.toContain("coordenação");
  });

  it("jovem e mentor ouvem a recusa honesta, sem card", async () => {
    for (const role of ["mentorado", "mentor_dpp"] as const) {
      demo.role = role;
      const r = await responderDemoIa("quantas pessoas por estado?");
      expect(r).not.toBeNull();
      expect(r!.content).toContain("visão é da coordenação");
      expect(r!.ui).toEqual([]);
    }
  });

  it("auxiliar agrega estado no recorte dele mas não gênero", async () => {
    demo.role = "supervisor";
    const ok = await responderDemoIa("quantas pessoas por estado?");
    expect(ok).not.toBeNull();
    expect(agregadoDe(ok!.ui)).not.toBeNull();

    const nao = await responderDemoIa("quantos jovens por gênero?");
    expect(nao).not.toBeNull();
    expect(nao!.content).toContain("visão da coordenação");
    expect(nao!.ui).toEqual([]);
  });

  it("pergunta por trilha agrega sem vazar mecânica nem travessão", async () => {
    demo.role = "coordenacao";
    const r = await responderDemoIa("quantas pessoas por trilha?");
    expect(r).not.toBeNull();
    expect(r!.content).not.toMatch(MECANICA);
    expect(r!.content).not.toContain("—");
    const card = agregadoDe(r!.ui);
    expect(card!.participacao_multipla).toBe(true);
  });
});

describe("responderDemoIa — ficar em dia (026/FR-016)", () => {
  // uids do dataset evergreen: faixa 0x06xx vira sufixo decimal —
  // 1537 = Ricardo×Bia, 1538 = Carlos×Caio (atrasadas), 1549 = Ricardo×
  // Matheus, 1548 = Luiza×Laura (em_dia), 1545 = André×Pedro (pausada)
  it("pergunta nomeando a dupla atribui o card a ela, não à primeira atrasada", async () => {
    // sem o nome a primeira atrasada seria a da Bia (1537) — nomear o
    // Matheus tem que render o card da dupla dele, qualquer que seja o
    // estado dela no planner
    const r = await responderDemoIa(
      "como a dupla do Matheus vai ficar em dia?"
    );
    expect(r).not.toBeNull();
    expect(r!.content).toContain("Na demonstração");
    const plano = planoDe(r!.ui);
    expect(plano?.dupla_id).toBe("de000000-0000-4000-8000-000000001549");
  });

  it("dupla atrasada nomeada devolve o plano de recuperação dela", async () => {
    demo.role = "coordenacao";
    const r = await responderDemoIa(
      "e a dupla do Caio, como vai ficar em dia?"
    );
    expect(r).not.toBeNull();
    expect(r!.content).toContain("sequência com as datas sugeridas");
    const plano = planoDe(r!.ui);
    expect(plano?.dupla_id).toBe("de000000-0000-4000-8000-000000001538");
    expect(plano?.em_dia).toBe(false);
    expect(plano?.estado).toBe("recuperacao");
  });

  it("pergunta sem nome segue escolhendo a primeira atrasada", async () => {
    const r = await responderDemoIa("como faço pra ficar em dia?");
    expect(r).not.toBeNull();
    const plano = planoDe(r!.ui);
    expect(plano?.dupla_id).toBe("de000000-0000-4000-8000-000000001537");
    expect(r!.content).toContain("mesma conta da ficha");
  });

  it("dupla em dia nomeada ganha resposta honesta, não o plano de outra", async () => {
    demo.role = "coordenacao";
    const r = await responderDemoIa(
      "e a dupla da Laura vai ficar em dia como?"
    );
    expect(r).not.toBeNull();
    expect(r!.content).toContain("já está em dia");
    expect(r!.content).toContain("Laura");
    expect(r!.content).not.toContain("sequência com as datas sugeridas");
    // o card viaja junto como evidência — em_dia, não plano de recuperação
    const plano = planoDe(r!.ui);
    expect(plano?.dupla_id).toBe("de000000-0000-4000-8000-000000001548");
    expect(plano?.em_dia).toBe(true);
    expect(plano?.estado).toBe("em_dia");
  });

  it("dupla nomeada fora do ficar em dia ganha o motivo honesto", async () => {
    demo.role = "coordenacao";
    const r = await responderDemoIa(
      "como a dupla do Pedro vai ficar em dia?"
    );
    expect(r).not.toBeNull();
    expect(r!.content).toContain("não está em andamento");
    expect(r!.ui).toEqual([]);
  });
});
