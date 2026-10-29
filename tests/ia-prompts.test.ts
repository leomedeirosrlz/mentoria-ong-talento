// systemPromptIa — o prompt é curto de propósito: o escopo mora nas tools
// (allowlist + RLS), então o texto ensina COMO responder e quando chamar.
// Aqui se prova o que só o texto garante: o label do papel na voz certa
// (inclusive o híbrido "A + B"), o vocabulário fechado de rotas internas
// que vira chip de ação, e os guardrails que nenhuma tool carrega —
// não inventar dado, crise escala pra humano, LGPD.

import { describe, expect, it } from "vitest";
import { systemPromptIa } from "@/lib/ia/prompts";
import type { AppRole } from "@/lib/types";

describe("papel no prompt", () => {
  // os labels são os mesmos da interface (papelLabel) — o assistente se
  // apresenta pro usuário com o nome que ele já vê no app
  const casos: { papeis: AppRole[]; label: string }[] = [
    { papeis: ["coordenacao"], label: "Coordenação" },
    { papeis: ["supervisor"], label: "Auxiliar executivo" },
    { papeis: ["mentor_dpp"], label: "Mentor DPP" },
    { papeis: ["mentor_especialista"], label: "Mentor especialista" },
    { papeis: ["mentorado"], label: "Mentorado" },
  ];

  for (const { papeis, label } of casos) {
    it(`${papeis[0]} aparece como "${label}"`, () => {
      expect(systemPromptIa(papeis)).toContain(`papel de ${label}`);
    });
  }

  it("híbrido vira 'A + B' na ordem em que os papéis vieram", () => {
    // mentor DPP + especialista é o caso real do programa (0085); o
    // join por " + " é o que diferencia de um papel só
    expect(systemPromptIa(["mentor_dpp", "mentor_especialista"])).toContain(
      "papel de Mentor DPP + Mentor especialista"
    );
    expect(systemPromptIa(["supervisor", "coordenacao"])).toContain(
      "papel de Auxiliar executivo + Coordenação"
    );
  });

  it("lista vazia cai no fallback honesto em vez de inventar papel", () => {
    expect(systemPromptIa([])).toContain("papel ainda não definido");
  });
});

describe("rotas internas", () => {
  const prompt = systemPromptIa(["coordenacao"]);

  it("lista o vocabulário fechado de rotas da plataforma", () => {
    // o modelo só pode linkar o que existe — os chips de ação da UI
    // (REALIZA-286) confiam nesse vocabulário
    for (const rota of [
      "/duplas",
      "/agenda",
      "/registros",
      "/materiais",
      "/pessoas/",
      "/chamados",
      "/relatorios",
    ]) {
      expect(prompt).toContain(rota);
    }
  });

  it("proíbe rota fora da lista e dá o exemplo de link em markdown", () => {
    expect(prompt).toContain("Não invente rotas");
    // o exemplo é o que ensina o formato que a UI transforma em botão
    expect(prompt).toMatch(/\[[^\]]+\]\(\/duplas\/[^)]+\)/);
  });
});

describe("guardrails", () => {
  const prompt = systemPromptIa(["coordenacao"]);

  it("proíbe inventar dados — números, nomes e fatos só vêm das tools", () => {
    expect(prompt).toContain("NUNCA invente dados");
    expect(prompt).toContain("ferramenta");
    // sem tool pra pergunta, a resposta honesta é "não tenho acesso"
    expect(prompt).toContain("não tem acesso");
  });

  it("crise, violência e violação de direitos escalam pra humano", () => {
    expect(prompt).toContain("crise");
    // o assistente não resolve — orienta acionar gente do programa
    expect(prompt).toContain("Supervisor de Relacionamento");
    expect(prompt).toContain("coordenação");
    expect(prompt).toContain("mentoria@realiza.vc");
  });

  it("delimita o que o assistente não é: terapia, clínica, promessa", () => {
    expect(prompt).toContain("não faz terapia");
    expect(prompt).toContain("aconselhamento clínico");
    expect(prompt).toContain("promessa de emprego");
  });

  it("dados pessoais colados na conversa não se repetem — LGPD", () => {
    expect(prompt).toContain("dados pessoais");
    expect(prompt).toContain("LGPD");
  });

  it("metodologia sai do guia_consulta, fonte de verdade, 1x por pergunta", () => {
    expect(prompt).toContain("guia_consulta");
    expect(prompt).toContain("fonte de verdade");
    expect(prompt).toContain("no máximo uma vez");
    // busca vazia vira resposta honesta, não alucinação
    expect(prompt).toContain("não está nos guias");
  });

  it("fixa o tom: pt-BR, sem emoji, markdown leve e sem títulos", () => {
    expect(prompt).toContain("pt-BR");
    expect(prompt).toContain("sem emoji");
    expect(prompt).toContain("títulos");
  });
});
