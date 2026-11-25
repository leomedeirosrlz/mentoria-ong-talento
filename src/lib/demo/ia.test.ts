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
import type { UiBloco, UiPlano } from "@/lib/ia/ui";

beforeEach(() => {
  demo.role = "mentor_dpp";
});

const blocoJson = (content: string, tag: string) =>
  JSON.parse(content.split(`\`\`\`${tag}\n`)[1].split("\n```")[0]);

const planoDe = (ui: UiBloco[]): UiPlano | null =>
  ui.find((b): b is UiPlano => b.kind === "plano") ?? null;

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
    expect(r!.content).toContain("mesmo motor da ficha");
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
