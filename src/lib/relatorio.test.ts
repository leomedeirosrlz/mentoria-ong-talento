import { describe, expect, it } from "vitest";
import {
  montarLinhas,
  montarLinhasAssinaturas,
  montarLinhasCiclo,
  textoCelula,
  type DuplaFonte,
  type PessoaFonte,
  type RelatorioConfig,
} from "./relatorio";

// regra da casa: toda exibição de pessoa é `nome_social || nome` — o civil
// só aparece quando não há social (o snapshot público da RPC pode nem
// projetar a coluna; nesse caso o tipo a deixa opcional e vale o civil)

const pessoa = (over: Partial<PessoaFonte> & { id: string }): PessoaFonte => ({
  nome: null,
  nome_social: null,
  cidade: null,
  uf: null,
  ...over,
});

const dupla = (over: Partial<DuplaFonte> = {}): DuplaFonte => ({
  id: "d1",
  turma: "T2 · 2026/2027",
  mentor_id: "m1",
  mentorado_id: "j1",
  supervisor_id: "s1",
  status: "ativa",
  iniciada_em: "2026-01-10T12:00:00Z",
  demanda: null,
  ...over,
});

const cfg = (granularidade: "pessoas" | "duplas"): RelatorioConfig => ({
  turma: null,
  granularidade,
  colunas: [],
});

const PROFS = new Map(
  [
    pessoa({ id: "m1", nome: "Carlos Silva", nome_social: "Kai" }),
    pessoa({ id: "s1", nome: "Paula Souza" }), // sem social → civil
    pessoa({ id: "m2", nome: "Ana Lima", nome_social: "Aninha" }),
  ].map((p) => [p.id, p])
);
const MENTS = new Map(
  [
    pessoa({ id: "j1", nome: "João Pedro", nome_social: "JP" }),
    pessoa({ id: "j2", nome: "Maria Clara" }), // sem social → civil
  ].map((m) => [m.id, m])
);

describe("montarLinhas — nome_social || nome", () => {
  it("grade de duplas mostra o social e cai no civil quando não há", () => {
    const [linha] = montarLinhas(cfg("duplas"), [dupla()], PROFS, MENTS);
    expect(textoCelula(linha, "mentor")).toBe("Kai");
    expect(textoCelula(linha, "mentorado")).toBe("JP");
    expect(textoCelula(linha, "auxiliar")).toBe("Paula Souza");
  });

  it("grade de pessoas: nome próprio e par seguem a mesma regra", () => {
    const linhas = montarLinhas(cfg("pessoas"), [dupla()], PROFS, MENTS);
    const mentor = linhas.find((l) => l.__papel === "mentor")!;
    const mentorado = linhas.find((l) => l.__papel === "mentorado")!;
    expect(textoCelula(mentor, "nome")).toBe("Kai");
    expect(textoCelula(mentor, "par")).toBe("JP");
    expect(textoCelula(mentorado, "nome")).toBe("JP");
    expect(textoCelula(mentorado, "par")).toBe("Kai");
    expect(textoCelula(mentor, "auxiliar")).toBe("Paula Souza");
  });

  it("fila Sem dupla usa o social; pessoa sem nenhum nome sai vazia", () => {
    const profs = new Map(PROFS);
    profs.set("m3", pessoa({ id: "m3", nome: null, nome_social: null }));
    const linhas = montarLinhas(cfg("pessoas"), [dupla()], profs, MENTS, {
      fila: [
        { papel_esperado: "mentor", profile_id: "m2" },
        { papel_esperado: "mentor", profile_id: "m3" },
        { papel_esperado: "mentorado", mentorado_id: "j2" },
      ],
    });
    const fila = linhas.filter((l) => l.__status === "sem_dupla");
    expect(fila.map((l) => textoCelula(l, "nome"))).toContain("Aninha");
    expect(fila.map((l) => textoCelula(l, "nome"))).toContain("Maria Clara");
    expect(fila.map((l) => textoCelula(l, "nome"))).toContain("");
  });
});

describe("montarLinhasCiclo — nome_social || nome", () => {
  it("mentor/mentorado/auxiliar da linha de encontro", () => {
    const [linha] = montarLinhasCiclo({
      duplas: [dupla()],
      encontros: [
        {
          id: "e1",
          dupla_id: "d1",
          numero: 1,
          data_hora: "2026-02-01T15:00:00Z",
          realizado_em: null,
          status: "agendado",
          motivo_reagendamento: null,
          duracao_min: null,
        },
      ],
      registros: [],
      profiles: [...PROFS.values()],
      mentorados: [...MENTS.values()],
      cronogramas: [],
    });
    expect(textoCelula(linha, "mentor")).toBe("Kai");
    expect(textoCelula(linha, "mentorado")).toBe("JP");
    expect(textoCelula(linha, "auxiliar")).toBe("Paula Souza");
  });
});

describe("montarLinhasAssinaturas — nome_social || nome", () => {
  const base = {
    id: "a1",
    status: "assinado",
    assinado_em: "2026-02-02T10:00:00Z",
    created_at: "2026-02-01T10:00:00Z",
    token_expira_em: null,
    template: {
      slug: "termo",
      titulo: "Termo de voluntariado",
      versao: 3,
      signatario: "mentor",
    },
  };

  it("signatário e emitido_por resolvem pelo social", () => {
    const [linha] = montarLinhasAssinaturas({
      assinaturas: [
        { ...base, profile_id: "m1", mentorado_id: null, created_by: "s1" },
      ],
      profiles: [...PROFS.values()],
      mentorados: [...MENTS.values()],
    });
    expect(textoCelula(linha, "nome")).toBe("Kai");
    expect(textoCelula(linha, "emitido_por")).toBe("Paula Souza");
  });

  it("assinatura de mentorado resolve pelo social dele", () => {
    const [linha] = montarLinhasAssinaturas({
      assinaturas: [
        { ...base, profile_id: null, mentorado_id: "j1", created_by: null },
      ],
      profiles: [...PROFS.values()],
      mentorados: [...MENTS.values()],
    });
    expect(textoCelula(linha, "nome")).toBe("JP");
    expect(textoCelula(linha, "emitido_por")).toBe("A própria pessoa");
  });
});
