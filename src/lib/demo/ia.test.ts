import { describe, expect, it, vi } from "vitest";

// demoRole lê o cookie da persona — no vitest (node, fora de request) o
// next/headers é simulado devolvendo sempre o mentor Ricardo, que tem
// duplas de sobra pra exercitar a escolha
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "mentor_dpp" }) }),
}));

import { responderDemoIa } from "./ia";

const blocoJson = (content: string, tag: string) =>
  JSON.parse(content.split(`\`\`\`${tag}\n`)[1].split("\n```")[0]);

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
