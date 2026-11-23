import { describe, expect, it } from "vitest";
import {
  escopoDaProposta,
  montarPlanoEmDia,
  type PlanoAplicavel,
} from "@/lib/plano-em-dia";
import { feriadoNacional } from "@/lib/feriados";
import {
  CRON_T1,
  dt,
  encAgendado,
  encRealizado,
  mkDupla,
  mkEvento,
} from "./helpers";
import type { CicloEvento, DuplaRecesso } from "@/lib/types";

// REALIZA-513 — o calendário real da Turma 1 2026/2027
// (docs/fontes/plataforma-juventude-solidaria.txt): 16 terças de 08/09 a
// 12/01 com 15 dias entre o 8º e o 9º, recesso 16/12→04/01 e o evento de
// encerramento em 15/01, o limite duro. Relógio sempre fixo.

const OFICIAIS = [
  "2026-09-08", "2026-09-15", "2026-09-22", "2026-09-29",
  "2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27",
  "2026-11-10", "2026-11-17", "2026-11-24", "2026-12-01",
  "2026-12-08", "2026-12-15", "2027-01-05", "2027-01-12",
];
const RECESSO_ID = "ev-recesso-t1";
const CALENDARIO: CicloEvento[] = [
  ...OFICIAIS.map((d, i) => mkEvento(i + 1, d)),
  {
    id: RECESSO_ID,
    cronograma_id: CRON_T1,
    tipo: "recesso",
    numero: null,
    data: "2026-12-16",
    data_fim: "2027-01-04",
    status: "pendente",
    observacao: null,
    ordem: 145,
    titulo: "Recesso de fim de ano",
    fase: null,
    instrumentos: [],
  },
  {
    id: "ev-encerramento-t1",
    cronograma_id: CRON_T1,
    tipo: "evento_encerramento",
    numero: null,
    data: "2027-01-15",
    data_fim: null,
    status: "pendente",
    observacao: null,
    ordem: 170,
    titulo: "Evento de encerramento",
    fase: null,
    instrumentos: [],
  },
];
const HOJE = "2026-11-23"; // segunda: o 10º (17/11) já venceu, o 11º é amanhã
const ENCERRAMENTO = "2027-01-15";

const seguindoNoRecesso: DuplaRecesso = {
  id: "dr-1",
  dupla_id: "d-1",
  ciclo_evento_id: RECESSO_ID,
  usa: false,
  declarado_por: "p-1",
  declarado_em: "2026-11-20T12:00:00-03:00",
};

const dupla = (feitos: number, extra: Partial<Parameters<typeof mkDupla>[0]> = {}) =>
  mkDupla({
    iniciada_em: "2026-09-01",
    encontros: OFICIAIS.slice(0, feitos).map((d, i) => encRealizado(i + 1, d)),
    ...extra,
  });

const montar = (d: ReturnType<typeof dupla>, hoje = dt(HOJE), ritmo?: number) => {
  const r = montarPlanoEmDia({ dupla: d, eventos: CALENDARIO, hoje, ritmo });
  if (!r.aplicavel) throw new Error(r.motivo);
  return r;
};

/** Invariantes de toda data sugerida (FR-006): depois de hoje, fora do
 *  recesso que a dupla usa e fora de feriado nacional. */
function datasValidas(r: PlanoAplicavel, recessoValendo: boolean) {
  for (const p of r.passos.filter((x) => x.acao !== "travado")) {
    expect(p.data > HOJE, `${p.numero}º em ${p.data}`).toBe(true);
    expect(feriadoNacional(p.data), `${p.numero}º em ${p.data}`).toBeNull();
    if (recessoValendo) {
      const noRecesso = p.data >= "2026-12-16" && p.data <= "2027-01-04";
      expect(noRecesso, `${p.numero}º em ${p.data}`).toBe(false);
    }
  }
}

describe("513 — 10 atrasos em 23/11 no calendário real", () => {
  it("com o recesso valendo, nem 1 por dia fecha: vira conversa com a coordenação", () => {
    const r = montar(dupla(0));
    expect(r.estado).toBe("conversa");
    expect(r.nivel).toBe("conversa_coord");
    expect(r.dataRecuperacao).toBeNull();
    // o melhor caso que o card mostra: 1 por dia, com a prática de 7 dias
    // entre o 4º e o 9º e o recesso inteiro no meio
    expect(r.ritmo).toBe(7);
    expect(r.dataProjetada! > ENCERRAMENTO).toBe(true);
    expect(r.cabemAteEncerramento!.faltam).toBe(16);
    expect(r.cabemAteEncerramento!.cabem).toBeLessThan(16);
    expect(r.sugestao).toMatch(/Nem com 1 encontro por dia/);
    expect(r.sugestao).toMatch(/coordenação/);
    datasValidas(r, true);
  });

  it("a conversa mostra o efeito de seguir no recesso: 1 por dia fecha até 15/01", () => {
    const r = montar(dupla(0));
    expect(r.alternativaRecesso).not.toBeNull();
    expect(r.alternativaRecesso!.ritmo).toBe(7);
    expect(r.alternativaRecesso!.data <= ENCERRAMENTO).toBe(true);
  });

  it("seguindo no recesso, a dupla lenta termina junto: os 16 até o encerramento", () => {
    const r = montar(dupla(0, { recessos: [seguindoNoRecesso] }));
    expect(r.estado).toBe("recuperacao");
    expect(r.nivel).toBe("um_por_dia");
    expect(r.ritmo).toBe(7);
    expect(r.dataRecuperacao! <= ENCERRAMENTO).toBe(true);
    // a rápida termina no 16º oficial (12/01); a lenta dentro da mesma janela
    expect(r.dataRecuperacao! >= OFICIAIS[15]).toBe(true);
    expect(r.passos.map((p) => p.numero)).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1)
    );
    // 11º a 16º não estão devidos hoje, mas vencem no caminho
    expect(
      r.passos.filter((p) => p.venceNoCaminho).map((p) => p.numero)
    ).toEqual([11, 12, 13, 14, 15, 16]);
    expect(r.cabemAteEncerramento).toEqual({ cabem: 16, faltam: 16 });
    datasValidas(r, false);
    // a prática segue valendo mesmo a 1 por dia: 7 dias entre 4º→5º…8º→9º
    const data = (n: number) => r.passos.find((p) => p.numero === n)!.data;
    for (const n of [4, 5, 6, 7, 8]) {
      const gap =
        (new Date(data(n + 1)).getTime() - new Date(data(n)).getTime()) /
        86_400_000;
      expect(gap, `${n}º → ${n + 1}º`).toBeGreaterThanOrEqual(7);
    }
  });

  it("o escopo da proposta sai com 1 por dia e janela até o encerramento", () => {
    const r = montar(dupla(0, { recessos: [seguindoNoRecesso] }));
    const e = escopoDaProposta(r, HOJE);
    if ("erro" in e) throw new Error(e.erro);
    expect(e.escopo.ritmo).toBe(7);
    expect(e.escopo.nivel).toBe("um_por_dia");
    expect(e.escopo.janela).toEqual({ inicio: HOJE, fim: ENCERRAMENTO });
    expect(e.escopo.numeros).toHaveLength(16);
    expect(e.escopo.passos.every((p) => p.data <= ENCERRAMENTO)).toBe(true);
  });

  it("na conversa o escopo não nasce: o plano não promete agenda impossível", () => {
    const e = escopoDaProposta(montar(dupla(0)), HOJE);
    expect(e).toEqual({ erro: expect.stringMatching(/coordenação/) });
  });
});

describe("513 — a projeção não ignora o que vence no caminho", () => {
  it("6 atrasos: o backlog zera em janeiro, mas em dia só quando o 16º é coberto", () => {
    const r = montar(dupla(4));
    expect(r.estado).toBe("recuperacao");
    expect(r.nivel).toBe("um_por_dia");
    const devidos = r.passos.filter((p) => !p.venceNoCaminho);
    expect(devidos.map((p) => p.numero)).toEqual([5, 6, 7, 8, 9, 10]);
    const ultimoDevido = devidos.at(-1)!.data;
    // contar só o backlog de hoje diria "em dia" no 10º; o 14º (oficial
    // 15/12) e os seguintes vencem antes de serem cobertos
    expect(r.dataRecuperacao! > ultimoDevido).toBe(true);
    const p14 = r.passos.find((p) => p.numero === 14)!;
    expect(p14.venceNoCaminho).toBe(true);
    expect(p14.data > p14.dataOficial).toBe(true);
    expect(r.dataRecuperacao).toBe(r.passos.at(-1)!.data);
    datasValidas(r, true);
  });

  it("2 atrasos fecham com semana dupla antes do recesso", () => {
    const r = montar(dupla(8));
    expect(r.estado).toBe("recuperacao");
    expect(r.nivel).toBe("semana_dupla");
    expect(r.ritmo).toBe(2);
    expect(r.dataRecuperacao! < "2026-12-16").toBe(true);
    expect(r.alternativaRecesso).toBeNull();
    datasValidas(r, true);
  });

  it("o ritmo pedido que não fecha aponta o degrau seguinte da escada", () => {
    const r = montar(dupla(4), dt(HOJE), 3);
    expect(r.dataRecuperacao).toBeNull();
    expect(r.alternativaRitmo).toEqual({ ritmo: 7, data: expect.any(String) });
    expect(r.avisos.join(" ")).toMatch(/até 1 encontro por dia/);
  });
});

describe("513 — dupla em dia", () => {
  it("10 feitos nas datas oficiais: nada a recuperar, nenhuma proposta", () => {
    const r = montar(dupla(10));
    expect(r.emDia).toBe(true);
    expect(r.estado).toBe("em_dia");
    expect(r.passos).toEqual([]);
    expect(r.dataRecuperacao).toBeNull();
    expect(r.sugestao).toMatch(/Não há recuperação a fazer/);
    expect(escopoDaProposta(r, HOJE)).toEqual({
      erro: expect.stringMatching(/em dia/),
    });
  });

  it("dupla em dia e dupla com 10 atrasos têm resultados diferentes e explicáveis", () => {
    const emDia = montar(dupla(10));
    const atrasada = montar(dupla(0));
    expect(emDia.estado).not.toBe(atrasada.estado);
    expect(emDia.sugestao).not.toBe(atrasada.sugestao);
  });
});

describe("513 — calendário: feriado, travado, fuso", () => {
  it("passo que cairia no Natal anda um dia e explica por quê", () => {
    // véspera de Natal, devendo 13º e 14º, seguindo no recesso: amanhã é
    // 25/12 — o 13º vai pro dia 26
    const r = montar(
      dupla(12, { recessos: [seguindoNoRecesso] }),
      dt("2026-12-24")
    );
    const p13 = r.passos.find((p) => p.numero === 13)!;
    expect(p13.data).toBe("2026-12-26");
    expect(p13.aviso).toMatch(/feriado \(Natal\)/);
    expect(r.passos.some((p) => p.data === "2027-01-01")).toBe(false);
  });

  it("6 atrasos a 1 por dia fecham no limite; seguir no recesso alivia pra semana dupla", () => {
    const r = montar(dupla(4));
    expect(r.dataRecuperacao).toBe(ENCERRAMENTO);
    expect(r.alternativaRecesso).toEqual({ ritmo: 2, data: expect.any(String) });
    expect(r.alternativaRecesso!.data <= ENCERRAMENTO).toBe(true);
  });

  it("encontro já marcado no futuro fica travado com a data dele", () => {
    const d = dupla(8, {
      encontros: [
        ...OFICIAIS.slice(0, 8).map((x, i) => encRealizado(i + 1, x)),
        encAgendado(9, "2026-11-26"),
      ],
    });
    const r = montar(d);
    const p9 = r.passos.find((p) => p.numero === 9)!;
    expect(p9.acao).toBe("travado");
    expect(p9.data).toBe("2026-11-26");
    expect(r.passos.find((p) => p.numero === 10)!.data > "2026-11-26").toBe(true);
  });

  it("virada de dia em São Paulo: 23h30 de 23/11 ainda é 23/11", () => {
    const tarde = new Date("2026-11-23T23:30:00-03:00");
    const r = montar(dupla(8), tarde);
    expect(r.passos[0].data).toBe("2026-11-24");
  });
});
