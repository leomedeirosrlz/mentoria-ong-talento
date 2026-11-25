import { describe, expect, it } from "vitest";
import { montarPlanoEmDia } from "@/lib/plano-em-dia";
import { saudadeDaDupla } from "@/lib/ciclo";
import {
  deriveAgendaMinha,
  filtraAgenda,
} from "@/lib/agenda-minha";
import {
  CICLO_16,
  CRON_T1,
  dt,
  encAgendado,
  encRealizado,
  mkCronograma,
  mkDupla,
} from "./helpers";
import type { Dupla, DuplaRecesso } from "@/lib/types";

// REALIZA-462 (0218) — recesso opcional por dupla. A decisão é por par e
// por período: usa=true = os encontros pausam no período (default
// implícito, igual a sempre); usa=false = a dupla segue se encontrando — só pra dupla que
// declarou, o calendário oficial não muda. Amarrada ao ID do evento:
// se a janela anda no cronograma, a decisão segue junto.

const REC_ID = "ev-recesso"; // recesso do CICLO_16 (2025-12-25 → 2026-01-04)

const dec = (usa: boolean, duplaId = "d-1"): DuplaRecesso => ({
  id: `dr-${duplaId}`,
  dupla_id: duplaId,
  ciclo_evento_id: REC_ID,
  usa,
  declarado_por: "p-1",
  declarado_em: "2025-12-01T12:00:00-03:00",
});

const realizadosAte = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    encRealizado(i + 1, CICLO_16.filter((e) => e.tipo === "encontro")[i].data!)
  );

/** Dupla devendo o 12 (oficial 2025-12-23): o "amanhã" de 2025-12-24
 *  cairia dentro do recesso — o cenário canônico da janela. */
const duplaDevendo12 = (recessos?: DuplaRecesso[]) =>
  mkDupla({
    iniciada_em: "2025-10-01",
    encontros: realizadosAte(11),
    recessos,
  });

const plano = (dupla: Dupla, hoje: string) =>
  montarPlanoEmDia({ dupla, eventos: CICLO_16, hoje: dt(hoje) });

describe("recesso opcional (462) — planner", () => {
  it("sem declaração segue como hoje: sugestão não cai no recesso", () => {
    const r = plano(duplaDevendo12(), "2025-12-24");
    if (!r.aplicavel) throw new Error("não aplicável");
    const p12 = r.passos.find((p) => p.numero === 12)!;
    expect(p12.data >= "2026-01-05").toBe(true);
    expect(p12.aviso).toMatch(/recesso/);
  });

  it("usa=true declarado mantém o empurrão pro fim da janela", () => {
    const r = plano(duplaDevendo12([dec(true)]), "2025-12-24");
    if (!r.aplicavel) throw new Error("não aplicável");
    const p12 = r.passos.find((p) => p.numero === 12)!;
    expect(p12.data >= "2026-01-05").toBe(true);
  });

  it("usa=false libera a janela: a sugestão pode cair dentro do recesso", () => {
    const r = plano(duplaDevendo12([dec(false)]), "2025-12-24");
    if (!r.aplicavel) throw new Error("não aplicável");
    const p12 = r.passos.find((p) => p.numero === 12)!;
    expect(p12.data >= "2025-12-25").toBe(true);
    expect(p12.data <= "2026-01-04").toBe(true);
    // dentro da janela por escolha declarada: nada de "empurrada pro fim
    // do recesso"; só o Natal (25/12) segue fora
    expect(p12.data).toBe("2025-12-26");
    expect(p12.aviso).not.toMatch(/recesso/);
  });

  it("opt-out de OUTRO evento não abre esta janela", () => {
    const r = plano(
      duplaDevendo12([
        { ...dec(false), ciclo_evento_id: "ev-outro-recesso" },
      ]),
      "2025-12-24"
    );
    if (!r.aplicavel) throw new Error("não aplicável");
    const p12 = r.passos.find((p) => p.numero === 12)!;
    expect(p12.data >= "2026-01-05").toBe(true);
  });

  it("travado dentro do recesso atravessado não ganha aviso de recesso", () => {
    const d = mkDupla({
      iniciada_em: "2025-10-01",
      encontros: [
        ...realizadosAte(12),
        encAgendado(13, "2025-12-30"), // dentro da janela, por escolha
      ],
      recessos: [dec(false)],
    });
    const r = plano(d, "2025-12-24");
    if (!r.aplicavel) throw new Error("não aplicável");
    const t13 = r.passos.find((p) => p.numero === 13)!;
    expect(t13.acao).toBe("travado");
    expect(t13.aviso).toBeUndefined();
  });

  it("travado dentro do recesso NÃO declarado segue avisando", () => {
    const d = mkDupla({
      iniciada_em: "2025-10-01",
      encontros: [...realizadosAte(12), encAgendado(13, "2025-12-30")],
    });
    const r = plano(d, "2025-12-24");
    if (!r.aplicavel) throw new Error("não aplicável");
    expect(r.passos.find((p) => p.numero === 13)!.aviso).toMatch(/recesso/);
  });
});

describe("recesso opcional (462) — semáforo (declarado ≠ atraso)", () => {
  it("a declaração não muda o semáforo da dupla", () => {
    const sem = saudadeDaDupla(duplaDevendo12(), CICLO_16, dt("2025-12-26"));
    for (const usa of [true, false]) {
      const com = saudadeDaDupla(
        duplaDevendo12([dec(usa)]),
        CICLO_16,
        dt("2025-12-26")
      );
      expect(com.semaforo).toBe(sem.semaforo);
      expect(com.motivo).toBe(sem.motivo);
      expect(com.esperado).toBe(sem.esperado);
      expect(com.feitos).toBe(sem.feitos);
    }
  });
});

describe("recesso opcional (462) — agenda do mentor", () => {
  // hoje 2025-12-24 → o recesso do CICLO_16 (25/dez) é item do programa
  // em Próximos; a nota "segue se encontrando" é por par, na meta do item
  const HOJE = "2025-12-24";
  const cron = mkCronograma({ id: CRON_T1, turma: "T1", status: "ativo" });
  const evRecesso = CICLO_16.find((e) => e.id === REC_ID)!;

  const itensRecesso = (duplas: Dupla[]) =>
    deriveAgendaMinha({
      duplas,
      trilhas: {},
      eventos: [evRecesso],
      cronogramas: [cron],
      hoje: HOJE,
      agora: dt(HOJE).getTime(),
    }).secoes
      .flatMap((s) => s.grupos.flatMap((g) => g.itens))
      .filter((i) => i.rotulo.startsWith("Recesso"));

  it("o recesso vira item tipado do programa, sem nota sem declaração", () => {
    const [item] = itensRecesso([mkDupla()]);
    expect(item?.tipo).toBe("programa");
    expect(item?.meta).toEqual([]);
  });

  it("recesso atravessado nomeia o par que segue se encontrando", () => {
    const d = mkDupla({
      mentorado: {
        ...mkDupla().mentorado,
        nome: "Ana Souza",
        nome_social: null,
      },
      recessos: [dec(false)],
    });
    expect(itensRecesso([d])[0]?.meta).toEqual([
      "Ana segue se encontrando durante o recesso",
    ]);
  });

  it("só o par que declarou ganha a nota — a outra dupla fica no padrão", () => {
    const atravessou = mkDupla({
      id: "d-2",
      mentorado: {
        ...mkDupla().mentorado,
        id: "m-2",
        nome: "Ana Souza",
        nome_social: null,
      },
      recessos: [dec(false, "d-2")],
    });
    const noPadrao = mkDupla({
      id: "d-3",
      mentorado: {
        ...mkDupla().mentorado,
        id: "m-3",
        nome: "Bia Lima",
        nome_social: null,
      },
      recessos: [dec(true, "d-3")],
    });
    const itens = itensRecesso([atravessou, noPadrao]);
    expect(
      itens.find((i) => i.escopo === "dupla:d-2")?.meta
    ).toEqual(["Ana segue se encontrando durante o recesso"]);
    expect(itens.find((i) => i.escopo === "dupla:d-3")?.meta).toEqual([]);

    // no "tudo" o MESMO recesso funde num item só, com as notas somadas
    const agenda = deriveAgendaMinha({
      duplas: [atravessou, noPadrao],
      trilhas: {},
      eventos: [evRecesso],
      cronogramas: [cron],
      hoje: HOJE,
      agora: dt(HOJE).getTime(),
    });
    const fundidos = filtraAgenda(agenda, "tudo")
      .secoes.flatMap((s) => s.grupos.flatMap((g) => g.itens))
      .filter((i) => i.rotulo.startsWith("Recesso"));
    expect(fundidos).toHaveLength(1);
    expect(fundidos[0]!.meta).toEqual([
      "Ana segue se encontrando durante o recesso",
    ]);
  });
});
