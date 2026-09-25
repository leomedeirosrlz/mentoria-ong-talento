import { describe, expect, it } from "vitest";
import { passosDaTrilha } from "@/lib/ciclo";
import {
  CHECKLIST_ENCERRAMENTO,
  dadosResumoJornada,
  mediaAvaliacaoLabel,
  prazoTrilhaEspecialista,
  textoResumoJornada,
  type DuplaParaResumo,
} from "@/lib/encerramento";
import { CICLO_16, dt, mkEncaminhamento } from "./helpers";

const PASSOS = passosDaTrilha("dpp", CICLO_16);
const HOJE = dt("2025-10-15"); // já passaram as datas dos encontros 1 e 2

function duplaResumo(over: Partial<DuplaParaResumo> = {}): DuplaParaResumo {
  return {
    trilha: "dpp",
    status: "ativa",
    iniciada_em: "2025-09-30",
    mentor: { nome: "Maria Silva" },
    mentorado: { nome: "João Souza" },
    encontros: [],
    encaminhamentos: [],
    ...over,
  };
}

describe("CHECKLIST_ENCERRAMENTO", () => {
  it("5 passos do guia; autoavaliação é derivada (não se marca à mão)", () => {
    expect(CHECKLIST_ENCERRAMENTO.map((c) => c.key)).toEqual([
      "feedback_final",
      "feedback_mutuo",
      "revisao_pdm",
      "avaliacao_360_enviada",
      "autoavaliacao",
    ]);
    expect(
      CHECKLIST_ENCERRAMENTO.find((c) => c.key === "autoavaliacao")?.derivado
    ).toBe(true);
    expect(
      CHECKLIST_ENCERRAMENTO.filter((c) => !c.derivado).map((c) => c.key)
    ).toHaveLength(4);
  });
});

describe("dadosResumoJornada", () => {
  it("conta realizados, esperados pela janela e média ponderada das avaliações", () => {
    const r = dadosResumoJornada(
      duplaResumo({
        encontros: [
          {
            numero: 1,
            status: "realizado",
            data_hora: "2025-10-07T19:00:00-03:00",
            realizado_em: "2025-10-07T19:00:00-03:00",
            registro: { tema: "PDM", avaliacao: "excelente" },
          },
          {
            numero: 2,
            status: "realizado",
            data_hora: "2025-10-14T19:00:00-03:00",
            realizado_em: "2025-10-14T19:00:00-03:00",
            registro: { tema: null, avaliacao: "regular" },
          },
          {
            numero: 3,
            status: "agendado",
            data_hora: "2025-10-21T19:00:00-03:00",
            realizado_em: null,
            registro: null,
          },
        ],
        encaminhamentos: [
          mkEncaminhamento({ status: "feito" }),
          mkEncaminhamento({ status: "pendente" }),
        ],
      }),
      PASSOS,
      CICLO_16,
      null,
      HOJE
    );
    expect(r.realizados).toBe(2);
    expect(r.total).toBe(16);
    expect(r.esperados).toBe(2); // encontros 1 e 2 já venceram
    expect(r.mediaAvaliacao).toBe(3); // (4 + 2) / 2
    expect(r.combinadosFeitos).toBe(1);
    expect(r.combinadosTotal).toBe(2);
    expect(r.inicio).toBe("2025-09-30");
    expect(r.fim).toBeNull();
    expect(r.ultimosRegistros.map((u) => u.numero)).toEqual([2, 1]);
  });

  it("esperados respeita iniciada_em; trilha especialista devolve null", () => {
    const tardia = dadosResumoJornada(
      duplaResumo({ iniciada_em: "2025-10-15" }),
      PASSOS,
      CICLO_16,
      null,
      HOJE
    );
    expect(tardia.esperados).toBe(0); // nada vencido dentro da janela

    const esp = dadosResumoJornada(
      duplaResumo({ trilha: "especialista" }),
      passosDaTrilha("especialista", CICLO_16),
      CICLO_16,
      "2025-12-01",
      HOJE
    );
    expect(esp.esperados).toBeNull(); // sem calendário oficial pra comparar
    expect(esp.fim).toBe("2025-12-01");
  });

  it("sem avaliações a média é null; últimos registros são no máximo 3", () => {
    const r = dadosResumoJornada(
      duplaResumo({
        encontros: [1, 2, 3, 4].map((numero) => ({
          numero,
          status: "realizado" as const,
          data_hora: `2025-10-0${numero}T19:00:00-03:00`,
          realizado_em: null,
          registro: { tema: `t${numero}`, avaliacao: null },
        })),
      }),
      PASSOS,
      CICLO_16,
      null,
      HOJE
    );
    expect(r.mediaAvaliacao).toBeNull();
    expect(r.ultimosRegistros.map((u) => u.numero)).toEqual([4, 3, 2]);
    // sem realizado_em a data cai na data_hora agendada
    expect(r.ultimosRegistros[0].data).toBe("2025-10-04T19:00:00-03:00");
  });
});

describe("mediaAvaliacaoLabel", () => {
  it("âncoras da escala 1–4 do form semanal", () => {
    expect(mediaAvaliacaoLabel(4)).toBe("Excelente");
    expect(mediaAvaliacaoLabel(3.5)).toBe("Excelente");
    expect(mediaAvaliacaoLabel(3.4)).toBe("Boa");
    expect(mediaAvaliacaoLabel(2.5)).toBe("Boa");
    expect(mediaAvaliacaoLabel(1.5)).toBe("Regular");
    expect(mediaAvaliacaoLabel(1)).toBe("Baixa");
  });
});

describe("textoResumoJornada", () => {
  const resumo = dadosResumoJornada(
    duplaResumo({
      encontros: [
        {
          numero: 2,
          status: "realizado",
          data_hora: "2025-10-14T19:00:00-03:00",
          realizado_em: "2025-10-14T19:00:00-03:00",
          registro: { tema: "Roda da Vida", avaliacao: "excelente" },
        },
      ],
      encaminhamentos: [mkEncaminhamento({ status: "feito" })],
    }),
    PASSOS,
    CICLO_16,
    null,
    HOJE
  );

  it("snapshot completo com nomes, datas e contagens", () => {
    const t = textoResumoJornada(resumo);
    expect(t).toContain("Resumo da jornada · Maria Silva e João Souza");
    expect(t).toContain("Trilha DPP · início 30 de set.");
    expect(t).toContain("em andamento");
    expect(t).toContain("Encontros realizados: 1 de 16 (esperados pelo calendário: 2)");
    expect(t).toContain("Avaliação média do jovem: 4.0/4 (excelente)");
    expect(t).toContain("Combinados cumpridos: 1 de 1");
    expect(t).toContain("Últimos registros:");
    expect(t).toContain("· 2º encontro (14 de out.) · Roda da Vida · avaliação excelente");
  });

  it("jornada fechada sem fim registrado lê 'jornada fechada'; especialista não cita calendário", () => {
    const fechada = textoResumoJornada({ ...resumo, status: "concluida" });
    expect(fechada).toContain("jornada fechada");

    const esp = textoResumoJornada({
      ...resumo,
      trilha: "especialista",
      esperados: null,
      mediaAvaliacao: null,
      ultimosRegistros: [],
    });
    expect(esp).toContain("Trilha Especialista");
    expect(esp).not.toContain("esperados pelo calendário");
    expect(esp).toContain("Sem avaliações registradas");
    expect(esp).not.toContain("Últimos registros:");
  });
});

describe("prazoTrilhaEspecialista", () => {
  it("sem início registrado não há prazo", () => {
    expect(prazoTrilhaEspecialista(null, HOJE)).toBeNull();
    expect(prazoTrilhaEspecialista(undefined, HOJE)).toBeNull();
    expect(prazoTrilhaEspecialista("lixo", HOJE)).toBeNull();
  });

  it("fim = início + 3 meses; estado por dias restantes", () => {
    const inicio = "2025-10-07";
    // 91 dias restantes → ok
    expect(prazoTrilhaEspecialista(inicio, dt("2025-10-08"))).toEqual({
      fim: "2026-01-07",
      diasRestantes: 91,
      estado: "ok",
    });
    // 13 dias → urgente (<14)
    expect(prazoTrilhaEspecialista(inicio, dt("2025-12-25"))?.estado).toBe("urgente");
    // passou → vencido
    const vencido = prazoTrilhaEspecialista(inicio, dt("2026-01-08"));
    expect(vencido?.estado).toBe("vencido");
    expect(vencido?.diasRestantes).toBe(-1);
  });

  it("meses curtos transbordam no setMonth (30/11 + 3m → 02/03)", () => {
    expect(prazoTrilhaEspecialista("2025-11-30", dt("2025-12-01"))?.fim).toBe(
      "2026-03-02"
    );
  });
});
