import { describe, expect, it } from "vitest";
import type { DuplaSaude, Semaforo } from "@/lib/ciclo";
import {
  comparadorDe,
  escreveOrdem,
  parseOrdemDupla,
  pesoFila,
} from "@/lib/duplas-ordem";
import type { Dupla, MentoradoPar, Profile } from "@/lib/types";

function mkProfile(nome: string): Profile {
  return {
    id: `p-${nome}`,
    user_id: null,
    nome,
    email: `${nome}@x.test`,
    whatsapp: null,
    role: "mentor_dpp",
    ativo: true,
    bio: null,
    linkedin: null,
    areas: null,
    voluntariado: null,
    onboarded_em: null,
  };
}

function mkMentorado(nome: string): MentoradoPar {
  return {
    id: `m-${nome}`,
    nome,
    nome_social: null,
    avatar_path: null,
    whatsapp: null,
    email: null,
    ong_origem: null,
    cidade: null,
    uf: null,
    interesses: [],
    disponibilidade: null,
    situacao: "ativo",
  };
}

function mkDupla(id: string, mentorNome: string, over: Partial<Dupla> = {}): Dupla {
  return {
    id,
    turma: "T1",
    cronograma_id: "c1",
    status: "ativa",
    iniciada_em: "2026-09-01",
    trilha: "dpp",
    demanda: null,
    solicitacao_id: null,
    mentor: mkProfile(mentorNome),
    mentorado: mkMentorado(`Jovem ${id}`),
    supervisor: null,
    encontros: [],
    encaminhamentos: [],
    ...over,
  };
}

function mkSaude(semaforo: Semaforo, apoioAberto = false): DuplaSaude {
  return {
    semaforo,
    motivo: "m",
    motivos: ["m"],
    sinais: [],
    apoio: { aberto: apoioAberto },
    esperado: 0,
    feitos: 0,
    proximo: null,
    registroPendente: false,
    pediuApoio: false,
    apoioJovem: false,
    avaliacaoJovemPendente: 0,
  };
}

// uma de cada situação: apoio (ok+apoio), risco, atenção, em dia e fora da
// régua — os nomes ordenam por mentor no desempate (Ana…Eva)
const DUPLAS = [
  mkDupla("d-ok", "Duda Melo"),
  mkDupla("d-risco", "Bia Prado"),
  mkDupla("d-apoio", "Ana Cruz"),
  mkDupla("d-atencao", "Caio Reis"),
  mkDupla("d-pausada", "Eva Sousa", { status: "pausada" }),
];
const SAUDE = new Map<string, DuplaSaude>([
  ["d-ok", mkSaude("ok")],
  ["d-risco", mkSaude("risco")],
  ["d-apoio", mkSaude("ok", true)],
  ["d-atencao", mkSaude("atencao")],
  ["d-pausada", mkSaude("ok")],
]);

const ids = (ds: Dupla[]) => ds.map((d) => d.id);

describe("parseOrdemDupla / escreveOrdem", () => {
  it("aceita situacao e situacao-desc além das colunas antigas", () => {
    expect(parseOrdemDupla("situacao")).toEqual({ col: "situacao", dir: 1 });
    expect(parseOrdemDupla("situacao-desc")).toEqual({
      col: "situacao",
      dir: -1,
    });
    expect(parseOrdemDupla("nome")).toEqual({ col: "nome", dir: 1 });
    expect(parseOrdemDupla("az")).toEqual({ col: "nome", dir: 1 });
    expect(parseOrdemDupla("za")).toEqual({ col: "nome", dir: -1 });
  });

  it("rejeita lixo e roundtripa o que escreve", () => {
    expect(parseOrdemDupla("situacao-asc")).toBeNull();
    expect(parseOrdemDupla("mentor")).toBeNull();
    expect(parseOrdemDupla(null)).toBeNull();
    for (const v of ["situacao", "situacao-desc", "nota", "encontros-desc"]) {
      expect(escreveOrdem(parseOrdemDupla(v)!)).toBe(v);
    }
  });
});

describe("pesoFila — a régua do radar", () => {
  it("apoio → risco → atenção → em dia → fora da régua", () => {
    const ativa = mkDupla("x", "M");
    const pausada = mkDupla("y", "N", { status: "pausada" });
    expect(pesoFila(ativa, mkSaude("ok", true))).toBe(0);
    expect(pesoFila(ativa, mkSaude("risco"))).toBe(1);
    expect(pesoFila(ativa, mkSaude("atencao"))).toBe(2);
    expect(pesoFila(ativa, mkSaude("ok"))).toBe(3);
    expect(pesoFila(pausada, mkSaude("ok"))).toBe(5);
  });
});

describe("comparadorDe — coluna situacao", () => {
  it("asc segue o radar e desc inverte com fora da régua sempre no fim", () => {
    const asc = [...DUPLAS].sort(
      comparadorDe({ col: "situacao", dir: 1 }, SAUDE)
    );
    expect(ids(asc)).toEqual([
      "d-apoio",
      "d-risco",
      "d-atencao",
      "d-ok",
      "d-pausada",
    ]);

    const desc = [...DUPLAS].sort(
      comparadorDe({ col: "situacao", dir: -1 }, SAUDE)
    );
    expect(ids(desc)).toEqual([
      "d-ok",
      "d-atencao",
      "d-risco",
      "d-apoio",
      "d-pausada",
    ]);
  });

  it("desempata pelo A→Z da dupla (mentor, depois mentorado)", () => {
    const ds = [
      mkDupla("d2", "Zé Lima"),
      mkDupla("d1", "Ana Lima"),
      mkDupla("d3", "Bia Lima"),
    ];
    const saude = new Map(ds.map((d) => [d.id, mkSaude("risco")]));
    const ord = [...ds].sort(comparadorDe({ col: "situacao", dir: 1 }, saude));
    expect(ids(ord)).toEqual(["d1", "d3", "d2"]);
  });
});
