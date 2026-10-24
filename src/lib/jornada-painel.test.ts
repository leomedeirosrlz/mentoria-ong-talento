import { describe, expect, it } from "vitest";
import {
  agrupaPorTurma,
  diaMesEvento,
  elegiveisLote,
  liberaCopia,
  resolveLinhasPainel,
  type CicloEventoMinimo,
  type PainelJornadaLinha,
} from "./jornada";

// REALIZA-194 — os agregados que a faixa segmentada do painel e os cards
// "Instrumentos do programa" compartilham: resolução por dupla, grupos
// por turma com rótulo canônico, elegíveis ao lote e a cópia de liberação.
// Os dados são mínimos: 2 turmas com cronogramas próprios, uma dupla
// saudável na T1 e uma sem entregas na T2.

const EVENTOS: CicloEventoMinimo[] = [
  // T1: calendário já correu até o enc. 5
  ...[1, 2, 3, 4, 5, 12].map((n, i) => ({
    cronograma_id: "c-t1",
    tipo: "encontro",
    numero: n,
    data: `2025-09-0${1 + i}`.padEnd(10, "0").slice(0, 10),
  })),
  // T2: começou depois — enc. 1 realizado, o resto no futuro
  { cronograma_id: "c-t2", tipo: "encontro", numero: 1, data: "2025-10-01" },
  { cronograma_id: "c-t2", tipo: "encontro", numero: 2, data: "2030-01-13" },
  { cronograma_id: "c-t2", tipo: "encontro", numero: 12, data: "2030-03-24" },
];

function linha(
  over: Partial<PainelJornadaLinha> = {}
): PainelJornadaLinha {
  return {
    dupla_id: "d-1",
    turma: "T1 · 2026/2027",
    cronograma_id: "c-t1",
    mentor_id: "m-1",
    mentor_nome: "Mentor Um",
    mentorado_id: "j-1",
    jovem_nome: "Jovem Um",
    entregas: {},
    avaliacoes_encontro: { feitas: 4, realizados: 4, max_numero: 4 },
    ...over,
  };
}

describe("diaMesEvento", () => {
  it("extrai dd/mm de ISO válido sem depender de fuso", () => {
    expect(diaMesEvento("2026-11-04")).toBe("04/11");
    expect(diaMesEvento("2026-01-15T18:30:00")).toBe("15/01");
  });
  it("null/malformada devolve null (a cópia cai pro nº do encontro)", () => {
    expect(diaMesEvento(null)).toBeNull();
    expect(diaMesEvento("")).toBeNull();
    expect(diaMesEvento("04/11/2026")).toBeNull();
  });
});

describe("resolveLinhasPainel", () => {
  it("encCorrDupla = maior realizado + 1 (régua da dupla, não da coorte)", () => {
    const [r] = resolveLinhasPainel([linha()], EVENTOS);
    expect(r.encCorrDupla).toBe(5);
    // janela aberta pra dupla: construção sem entrega conta nao_enviado;
    // roda formal (enc. 12) e 360º (16) seguem trancadas
    expect(r.estados.visao).toBe("nao_enviado");
    expect(r.estados.roda_formal).toBe("trancada");
    expect(r.estados.avaliacao_360).toBe("trancada");
    // a recorrente em dia conta como respondida
    expect(r.estados.avaliacao_encontro).toBe("respondido");
    // visão (1–4), metas (2–3), pdm (1–4) e roda inicial (1) já
    // fecharam a janela na régua DELA sem resposta → fora da janela
    for (const c of ["roda_inicial", "visao", "metas", "pdm"] as const) {
      expect(r.atrasadas.has(c)).toBe(true);
    }
    expect(r.atrasadas.has("avaliacao_encontro")).toBe(false);
  });
});

describe("agrupaPorTurma", () => {
  it("agrupa por cronograma com rótulo canônico e 'Sem turma' por último", () => {
    const resolvidas = resolveLinhasPainel(
      [
        linha(),
        linha({
          dupla_id: "d-2",
          turma: "T2 · 2027",
          cronograma_id: "c-t2",
          jovem_nome: "Jovem Dois",
          avaliacoes_encontro: { feitas: 0, realizados: 1, max_numero: 1 },
        }),
        linha({
          dupla_id: "d-3",
          turma: null,
          cronograma_id: "",
          jovem_nome: "Jovem Três",
        }),
      ],
      EVENTOS
    );
    const grupos = agrupaPorTurma(resolvidas);
    expect(grupos.map((g) => g.sigla)).toEqual(["T1", "T2", "—"]);
    expect(grupos[0].nome).toBe("Turma 1");
    expect(grupos[1].nome).toBe("Turma 2");
    expect(grupos[2].nome).toBe("Sem turma");
    expect(grupos[0].linhas.map((r) => r.linha.dupla_id)).toEqual(["d-1"]);
  });
});

describe("elegiveisLote", () => {
  it("seleciona nao_enviado/pendente/expirado e nunca respondido/trancada", () => {
    const resolvidas = resolveLinhasPainel(
      [
        linha(), // visao nao_enviado → elegível
        linha({
          dupla_id: "d-2",
          jovem_nome: "Jovem Dois",
          entregas: {
            visao: [
              {
                status: "respondido",
                created_at: "2025-09-10",
                destino: "mentorado",
              },
            ],
          },
        }),
      ],
      EVENTOS
    );
    const info = new Map([
      ["d-1", { jovemTemEmail: true, mentorTemEmail: false }],
      ["d-2", { jovemTemEmail: false, mentorTemEmail: false }],
    ]);
    const elegiveis = elegiveisLote(resolvidas, "visao", info);
    expect(elegiveis).toHaveLength(1);
    expect(elegiveis[0].duplaId).toBe("d-1");
    expect(elegiveis[0].jovemTemEmail).toBe(true);
    // trancada nunca é lote — roda formal não abriu na régua da dupla
    expect(elegiveisLote(resolvidas, "roda_formal", info)).toHaveLength(0);
  });
});

describe("liberaCopia", () => {
  it("compõe data de abertura por turma; sem datas fica o nº do encontro", () => {
    const resolvidas = resolveLinhasPainel(
      [
        linha(),
        linha({
          dupla_id: "d-2",
          turma: "T2 · 2027",
          cronograma_id: "c-t2",
          avaliacoes_encontro: { feitas: 0, realizados: 1, max_numero: 1 },
        }),
      ],
      EVENTOS
    );
    const grupos = agrupaPorTurma(resolvidas);
    // roda formal abre no enc. 12: T1 já passou (data antiga), T2 tem data
    expect(liberaCopia("roda_formal", grupos)).toBe(
      "libera no encontro 12 · T1 06/09 · T2 24/03"
    );
    // turma sem data oficial pro encIni cai fora da cópia por turma
    const semDatas = grupos.map((g) => ({
      ...g,
      ctx: { ...g.ctx, dataEnc: () => null },
    }));
    expect(liberaCopia("avaliacao_360", semDatas)).toBe(
      "libera no encontro 16"
    );
  });
});
