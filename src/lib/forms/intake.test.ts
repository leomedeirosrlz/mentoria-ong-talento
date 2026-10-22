import { describe, expect, it } from "vitest";
import {
  camposArquivo,
  gridParaResposta,
  horaParaPeriodo,
  prefillDoIntake,
  respostaParaDisponibilidade,
  respostaParaHoras,
} from "./intake";
import type { FormularioCampo, RespostaValor } from "./schema";

// Helpers puros do intake (REALIZA-70): a grade horária da inscrição
// projeta pro canônico {dia,periodo} da 0100 e a resposta vira o prefill
// do cadastro — os dois caminhos são fronteira de dados e vivem de teste.

describe("horaParaPeriodo", () => {
  it("projeta as fronteiras canônicas", () => {
    expect(horaParaPeriodo(9)).toBe("manha");
    expect(horaParaPeriodo(11)).toBe("manha");
    expect(horaParaPeriodo(12)).toBe("tarde");
    expect(horaParaPeriodo(17)).toBe("tarde");
    expect(horaParaPeriodo(18)).toBe("noite");
    expect(horaParaPeriodo(19)).toBe("noite");
  });
});

describe("gridParaResposta", () => {
  it("ordena horas por dia/hora e dedupe celulas", () => {
    const r = gridParaResposta([
      { dia: "qua", hora: 19 },
      { dia: "seg", hora: 19 },
      { dia: "seg", hora: 18 },
      { dia: "seg", hora: 10 },
    ]);
    expect(r.horas).toEqual([
      { dia: "seg", hora: 10 },
      { dia: "seg", hora: 18 },
      { dia: "seg", hora: 19 },
      { dia: "qua", hora: 19 },
    ]);
    // celulas preservam a ordem da marcação (verbatim): seg 18h e 19h
    // colapsam na mesma célula canônica (seg/noite)
    expect(r.celulas).toEqual([
      { dia: "qua", periodo: "noite" },
      { dia: "seg", periodo: "noite" },
      { dia: "seg", periodo: "manha" },
    ]);
  });

  it("vazio vira grade vazia (opcional não respondida)", () => {
    expect(gridParaResposta([])).toEqual({ celulas: [], horas: [] });
  });
});

describe("respostaParaDisponibilidade", () => {
  it("devolve o canônico do perfil a partir das celulas", () => {
    const r = gridParaResposta([
      { dia: "ter", hora: 9 },
      { dia: "ter", hora: 19 },
    ]);
    expect(respostaParaDisponibilidade(r)).toEqual({
      celulas: [
        { dia: "ter", periodo: "manha" },
        { dia: "ter", periodo: "noite" },
      ],
    });
  });

  it("rejeita o que não é grade", () => {
    expect(respostaParaDisponibilidade(undefined)).toBeNull();
    expect(respostaParaDisponibilidade("seg 18h")).toBeNull();
    expect(respostaParaDisponibilidade({ celulas: [] })).toBeNull();
  });
});

describe("respostaParaHoras", () => {
  it("filtra marcações fora do vocabulário (dom/8h nunca entram)", () => {
    const horas = respostaParaHoras({
      celulas: [],
      horas: [
        { dia: "seg", hora: 18 },
        { dia: "dom", hora: 10 },
        { dia: "ter", hora: 8 },
        { dia: "qua", hora: 13.5 },
        { dia: "sex", hora: "19" },
      ],
    } as unknown as RespostaValor);
    expect(horas).toEqual([{ dia: "seg", hora: 18 }]);
  });
});

describe("prefillDoIntake", () => {
  const respostaCompleta = {
    nome_civil: "Maurício Ferraz de Almeida",
    nome_social: "Maurício",
    email: "mauricio@exemplo.com",
    telefone: "(19) 97766-4321",
    nascimento: "1984-11-02",
    genero: "Cisgênero masculino",
    cor_raca: "Parda",
    cidade: "Campinas - SP",
    cargo: "Head de Dados",
    empresa: "Varejo S.A.",
    objetivos: "Ensinar um jovem a olhar pro futuro com método.",
    pref_genero_mentorado: "Sem preferência",
    disponibilidade: {
      celulas: [{ dia: "ter", periodo: "noite" }],
      horas: [{ dia: "ter", hora: 18 }],
    },
    experiencia_previa: "sim",
    experiencia_descricao: "Mentorei por 2 anos.",
    formacao_erlich: "nao",
  };

  it("mapeia os campos do cadastro", () => {
    const p = prefillDoIntake(respostaCompleta);
    expect(p.nome).toBe("Maurício Ferraz de Almeida");
    expect(p.email).toBe("mauricio@exemplo.com");
    expect(p.whatsapp).toBe("(19) 97766-4321");
    expect(p.genero).toBe("masculino");
    expect(p.cor_raca).toBe("parda");
    expect(p.cidade).toBe("Campinas");
    expect(p.uf).toBe("SP");
    expect(p.pref_genero_par).toBe("indiferente");
    expect(p.disponibilidade).toEqual({
      celulas: [{ dia: "ter", periodo: "noite" }],
    });
    expect(p.experiencia_previa).toBe("Mentorei por 2 anos.");
    expect(p.formacao_externa).toBe("");
    expect(p.origem).toBeTruthy();
  });

  it('extrai UF de "São Paulo/SP" e tolera cidade sem padrão', () => {
    const a = prefillDoIntake({ cidade: "São Paulo/SP" });
    expect(a.uf).toBe("SP");
    expect(a.cidade).toBe("São Paulo");
    const b = prefillDoIntake({ cidade: "Recife" });
    expect(b.uf).toBe("");
    expect(b.cidade).toBe("Recife");
  });

  it('"Outro: quilombola" vira enum outro — o texto segue na resposta', () => {
    const p = prefillDoIntake({ cor_raca: "Outro: quilombola" });
    expect(p.cor_raca).toBe("outro");
  });

  it('experiência "sim" sem descrição não perde a declaração', () => {
    const p = prefillDoIntake({ experiencia_previa: "sim" });
    expect(p.experiencia_previa).toContain("Experiência prévia");
    expect(prefillDoIntake({ experiencia_previa: "nao" }).experiencia_previa).toBe("");
  });

  it("formacao_erlich sim → formação externa preenchida", () => {
    expect(prefillDoIntake({ formacao_erlich: "sim" }).formacao_externa).toBe(
      "Formação Erlich Mentoring"
    );
  });
});

describe("camposArquivo", () => {
  it("isola os campos de upload da definição", () => {
    const campos: FormularioCampo[] = [
      { id: "sec", tipo: "secao", label: "S", obrigatorio: false },
      { id: "nome", tipo: "texto", label: "N", obrigatorio: true },
      { id: "cv", tipo: "arquivo", label: "CV", obrigatorio: true },
      { id: "foto", tipo: "arquivo", label: "Foto", obrigatorio: false },
      { id: "grid", tipo: "grid_disponibilidade", label: "G", obrigatorio: true },
    ];
    expect(camposArquivo(campos).map((c) => c.id)).toEqual(["cv", "foto"]);
  });
});
