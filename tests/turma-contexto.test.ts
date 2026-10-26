// Contexto de turma (src/lib/turma-contexto.ts — REALIZA-73): a
// precedência param > cookie > "todas", a falha fechada (param lixo cai
// em "todas" sem erro), a resolução por label OU cronograma_id e o
// escopo do auxiliar. As puras não tocam cookie de verdade — o teste
// trava o CONTRATO que o sync client (turma-contexto-select.tsx) usa
// pra decidir gravar/apagar.
import { describe, expect, it } from "vitest";
import {
  resolveTurmaFoco,
  TURMA_FOCO_COOKIE,
  TURMA_TODAS,
  turmasDisponiveis,
} from "@/lib/turma-contexto";
import { mkCronograma, CRON_T1, CRON_T2 } from "./helpers";

const T1 = "T1 · 2026/2027";
const T2 = "T2 · 2026/2027";
const T_OLD = "2025/2026"; // encerrada — cronograma existe mas status=encerrado

const crons = [
  mkCronograma({ id: CRON_T1, turma: T1, status: "ativo" }),
  mkCronograma({ id: CRON_T2, turma: T2, status: "ativo" }),
  mkCronograma({ id: "cron-old", turma: T_OLD, status: "encerrado" }),
];

const enc = encodeURIComponent;

describe("resolveTurmaFoco — precedência e falha fechada", () => {
  it("sem param nem cookie → todas ('padrao')", () => {
    const r = resolveTurmaFoco(undefined, undefined, crons);
    expect(r.turma).toBeNull();
    expect(r.origem).toBe("padrao");
    expect(r.cronogramas).toHaveLength(3);
  });

  it("cookie válido resolve sem param ('cookie')", () => {
    const r = resolveTurmaFoco(undefined, enc(T2), crons);
    expect(r.turma).toBe(T2);
    expect(r.origem).toBe("cookie");
    expect(r.cronogramas.map((c) => c.id)).toEqual([CRON_T2]);
  });

  it("cookie cru (não-encoded) também lê", () => {
    const r = resolveTurmaFoco(undefined, T1, crons);
    expect(r.turma).toBe(T1);
    expect(r.origem).toBe("cookie");
  });

  it("param válido vence o cookie ('param' — o client grava)", () => {
    const r = resolveTurmaFoco(T1, enc(T2), crons);
    expect(r.turma).toBe(T1);
    expect(r.origem).toBe("param");
  });

  it("?turma=todas explicita limpa o foco ('todas' — o client apaga)", () => {
    const r = resolveTurmaFoco(TURMA_TODAS, enc(T2), crons);
    expect(r.turma).toBeNull();
    expect(r.origem).toBe("todas");
  });

  it("param inválido falha fechado: todas, sem erro ('invalido')", () => {
    for (const lixo of ["inexistente", "T99", "null", "undefined"]) {
      const r = resolveTurmaFoco(lixo, enc(T2), crons);
      expect(r.turma).toBeNull();
      expect(r.origem).toBe("invalido");
    }
  });

  it("param vazio/só espaço conta como ausente — o cookie segue valendo", () => {
    for (const vazio of ["", " ", "  "]) {
      const r = resolveTurmaFoco(vazio, enc(T2), crons);
      expect(r.turma).toBe(T2);
      expect(r.origem).toBe("cookie");
    }
  });

  it("cookie obsoleto (turma removida) cai no default", () => {
    const r = resolveTurmaFoco(undefined, enc("T9 · 2020/2021"), crons);
    expect(r.turma).toBeNull();
    expect(r.origem).toBe("padrao");
  });

  it("param em array (query repetida) usa o primeiro", () => {
    const r = resolveTurmaFoco([T2, T1], undefined, crons);
    expect(r.turma).toBe(T2);
    expect(r.origem).toBe("param");
  });
});

describe("resolveTurmaFoco — label, id e turma encerrada", () => {
  it("cronograma_id resolve pro label (a ponte com o ?turma= do /registros)", () => {
    const r = resolveTurmaFoco(CRON_T2, undefined, crons);
    expect(r.turma).toBe(T2);
    expect(r.origem).toBe("param");
  });

  it("turma encerrada segue endereçável (acceptance #16)", () => {
    const r = resolveTurmaFoco(T_OLD, undefined, crons);
    expect(r.turma).toBe(T_OLD);
    expect(r.cronogramas.map((c) => c.id)).toEqual(["cron-old"]);
  });

  it("turma com dois cronogramas devolve os dois no recorte", () => {
    const dobrada = [
      ...crons,
      mkCronograma({ id: "cron-t1b", turma: T1, status: "rascunho" }),
    ];
    const r = resolveTurmaFoco(T1, undefined, dobrada);
    expect(r.cronogramas.map((c) => c.id).sort()).toEqual([CRON_T1, "cron-t1b"]);
  });
});

describe("resolveTurmaFoco — papel e escopo", () => {
  it("mentor/jovem/especialista não têm contexto — param e cookie ignorados", () => {
    for (const papel of ["mentor_dpp", "mentorado", "mentor_especialista"] as const) {
      const r = resolveTurmaFoco(T1, enc(T2), crons, { papel });
      expect(r.turma).toBeNull();
      expect(r.origem).toBe("padrao");
      expect(r.cronogramas).toHaveLength(3); // recorte intocado
    }
  });

  it("auxiliar só resolve dentro do próprio escopo", () => {
    const escopo = [T2];
    // dentro: resolve normal
    const dentro = resolveTurmaFoco(T2, undefined, crons, {
      papel: "supervisor",
      escopoTurmas: escopo,
    });
    expect(dentro.turma).toBe(T2);
    // fora: falha fechada (a turma existe, mas o RLS esconderia)
    const fora = resolveTurmaFoco(T1, undefined, crons, {
      papel: "supervisor",
      escopoTurmas: escopo,
    });
    expect(fora.turma).toBeNull();
    expect(fora.origem).toBe("invalido");
  });

  it("auxiliar sem escopo informado falha fechado (nunca nomeia turma alheia)", () => {
    const r = resolveTurmaFoco(T1, enc(T1), crons, { papel: "supervisor" });
    expect(r.turma).toBeNull();
  });

  it("auxiliar resolve label do escopo mesmo sem a linha do cronograma", () => {
    // a /duplas do auxiliar pode chegar sem cronogramas — o label das
    // próprias duplas dele (o escopo) ainda é chave válida
    const r = resolveTurmaFoco(T2, undefined, [], {
      papel: "supervisor",
      escopoTurmas: [T2],
    });
    expect(r.turma).toBe(T2);
    expect(r.cronogramas).toEqual([]);
  });
});

describe("turmasDisponiveis — as navegáveis do seletor", () => {
  it("só cronograma ativo ou rascunho; encerrada sai da lista", () => {
    expect(turmasDisponiveis(crons)).toEqual([T1, T2]);
  });

  it("ordena lexicográfico pt-BR e deduplica labels", () => {
    const lista = turmasDisponiveis([
      ...crons,
      mkCronograma({ id: "cron-t2b", turma: T2, status: "rascunho" }),
      mkCronograma({ id: "cron-10", turma: "T10 · 2026/2027", status: "ativo" }),
    ]);
    // '1' < '2' — "T10" vem antes de "T2" (ordenação de texto, não numérica)
    expect(lista).toEqual([T1, "T10 · 2026/2027", T2]);
  });

  it("auxiliar recebe só as turmas do escopo", () => {
    expect(
      turmasDisponiveis(crons, { papel: "supervisor", escopoTurmas: [T2, T_OLD] })
    ).toEqual([T2]); // T_OLD tem cronograma encerrado — não é navegável
  });

  it("mentor e afins: lista vazia, sempre", () => {
    expect(turmasDisponiveis(crons, { papel: "mentor_dpp" })).toEqual([]);
    expect(turmasDisponiveis(crons, { papel: "mentorado" })).toEqual([]);
    expect(turmasDisponiveis(crons, { papel: "mentor_especialista" })).toEqual([]);
  });

  it("sem papel assume a leitura de coordenação", () => {
    expect(turmasDisponiveis(crons, { papel: "coordenacao" })).toEqual([T1, T2]);
  });
});

describe("constantes do contrato", () => {
  it("o nome do cookie e o sentinel de 'todas' são estáveis", () => {
    expect(TURMA_FOCO_COOKIE).toBe("turma_foco");
    expect(TURMA_TODAS).toBe("todas");
  });
});
