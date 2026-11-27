import {
  montarPlanoEmDia,
  type PlanoEmDia,
  type PlanoAplicavel,
} from "./plano-em-dia";
import type { CicloEvento, Dupla } from "./types";

/**
 * Motor de cenários do "ficar em dia" (rodada 1126).
 *
 * A Liza vinha simulando um caminho por vez (ritmo, fusão, recesso) e
 * errava a leitura: dizia "não fecha" sem testar a fusão, trocava datas e
 * tratava o recesso como sentença. Aqui os caminhos são gerados de uma vez,
 * com o MESMO planner da ficha, comparados e ordenados — a resposta passa a
 * ser uma escolha, não um veredito.
 *
 * Determinístico e puro: nenhum cenário grava nada. O universo é fixo e
 * pequeno (ritmo, fusão em pares, decisão de recesso), sem explosão
 * combinatória.
 */

export type CenarioPlano = {
  id: string;
  /** Rótulo curto pro humano ("fusão em pares · recesso: seguir"). */
  rotulo: string;
  viavel: boolean;
  estado: PlanoAplicavel["estado"] | "nao_aplicavel";
  /** Recuperação quando viavel; projeção quando não. */
  data: string | null;
  cabem: { cabem: number; faltam: number } | null;
  /** Sessões distintas que o plano pede (fusão reduz). */
  sessoes: number;
  /** Pares fundidos usados neste cenário. */
  fusao: number[][];
  decisaoRecesso: "pausa" | "segue" | null;
  praticaFlex: { dias: number; oficial: number } | null;
  /** Por que não fecha / o que o caminho custa. */
  observacao?: string;
};

export type ResultadoCenarios = {
  cenarios: CenarioPlano[];
  /** Caminho recomendado: viável, mais cedo e com menos mudanças. */
  melhor: CenarioPlano | null;
};

type EntradaCenarios = {
  dupla: Dupla;
  eventos: CicloEvento[];
  hoje: Date | string;
  disponibilidade?: Parameters<typeof montarPlanoEmDia>[0]["disponibilidade"];
  /** Sem grade combinada: simula sem exigir o par de disponibilidades. */
  semGrade?: boolean;
};

/** Pares consecutivos dos passos ainda sem data (travados não se movem). */
function paresMoviveis(passos: PlanoAplicavel["passos"]): number[][] {
  const numeros = passos
    .filter((p) => p.acao !== "travado")
    .map((p) => p.numero);
  const pares: number[][] = [];
  for (let i = 0; i + 1 < numeros.length; i += 2) {
    pares.push([numeros[i], numeros[i + 1]]);
  }
  return pares;
}

function sessoesDe(passos: PlanoAplicavel["passos"]): number {
  return new Set(passos.map((p) => p.data)).size;
}

/** Recesso do calendário, quando existe um. */
function eventoRecesso(eventos: CicloEvento[]): CicloEvento | null {
  return eventos.find((e) => e.tipo === "recesso") ?? null;
}

/** Declara a decisão só para a simulação (nunca grava). */
function comDecisaoRecesso(
  dupla: Dupla,
  evento: CicloEvento | null,
  usa: boolean
): Dupla {
  if (!evento) return dupla;
  const outras = (dupla.recessos ?? []).filter(
    (r) => r.ciclo_evento_id !== evento.id
  );
  return {
    ...dupla,
    recessos: [
      ...outras,
      {
        id: `sim-${evento.id}`,
        dupla_id: dupla.id,
        ciclo_evento_id: evento.id,
        usa,
        declarado_por: dupla.mentor?.id ?? dupla.mentorado?.id ?? "",
        declarado_em: new Date().toISOString(),
      },
    ],
  };
}

function vazio(dupla: Dupla, motivo: string): CenarioPlano {
  return {
    id: "nao_aplicavel",
    rotulo: "sem plano",
    viavel: false,
    estado: "nao_aplicavel",
    data: null,
    cabem: null,
    sessoes: 0,
    fusao: [],
    decisaoRecesso: null,
    praticaFlex: null,
    observacao: motivo,
  };
}

/**
 * Gera e compara os caminhos. Ordem: viável primeiro, depois data mais
 * cedo, depois menos mudanças (recesso declarado > fusão > ritmo).
 */
export function simularCenariosPlano(
  input: EntradaCenarios
): ResultadoCenarios {
  const recesso = eventoRecesso(input.eventos);

  const rodar = (over: {
    dupla?: Dupla;
    fusao?: number[][];
    ritmo?: number;
    sem_grade?: boolean;
  }): PlanoEmDia => {
    const dupla = over.dupla ?? input.dupla;
    return montarPlanoEmDia({
      dupla,
      eventos: input.eventos,
      hoje: input.hoje instanceof Date ? input.hoje : new Date(input.hoje),
      disponibilidade: input.semGrade ? undefined : input.disponibilidade,
      ritmo: over.ritmo,
      fusao: over.fusao?.length ? over.fusao : undefined,
    });
  };

  const base = rodar({});
  if (!base.aplicavel) return { cenarios: [vazio(input.dupla, base.motivo)], melhor: null };

  const pares = paresMoviveis(base.passos);
  const primeiroPar = pares.slice(0, 1);

  const definicoes: {
    id: string;
    rotulo: string;
    dupla: Dupla;
    fusao?: number[][];
    ritmo?: number;
    decisaoRecesso: CenarioPlano["decisaoRecesso"];
  }[] = [
    {
      id: "base",
      rotulo: "como está",
      dupla: input.dupla,
      decisaoRecesso: null,
    },
    {
      id: "recesso_segue",
      rotulo: "recesso: seguir encontros",
      dupla: comDecisaoRecesso(input.dupla, recesso, false),
      decisaoRecesso: "segue",
    },
    {
      id: "recesso_pausa",
      rotulo: "recesso: pausar",
      dupla: comDecisaoRecesso(input.dupla, recesso, true),
      decisaoRecesso: "pausa",
    },
    {
      id: "fusao_par",
      rotulo: "fusão do próximo par",
      dupla: input.dupla,
      fusao: primeiroPar,
      decisaoRecesso: null,
    },
    {
      id: "fusao_pares",
      rotulo: "fusão em pares",
      dupla: input.dupla,
      fusao: pares,
      decisaoRecesso: null,
    },
    {
      id: "recesso_segue_fusao",
      rotulo: "recesso: seguir · fusão em pares",
      dupla: comDecisaoRecesso(input.dupla, recesso, false),
      fusao: pares,
      decisaoRecesso: "segue",
    },
    {
      id: "ritmo_1_por_dia",
      rotulo: "1 encontro por dia",
      dupla: input.dupla,
      ritmo: 7,
      decisaoRecesso: null,
    },
    {
      id: "recesso_segue_ritmo",
      rotulo: "recesso: seguir · 1 por dia",
      dupla: comDecisaoRecesso(input.dupla, recesso, false),
      ritmo: 7,
      decisaoRecesso: "segue",
    },
  ];

  const vistos = new Set<string>();
  const cenarios: CenarioPlano[] = [];
  for (const def of definicoes) {
    const r = rodar({
      dupla: def.dupla,
      fusao: def.fusao,
      ritmo: def.ritmo,
    });
    if (!r.aplicavel) continue;
    const viavel = r.estado === "recuperacao" || r.estado === "em_dia";
    const data = r.dataRecuperacao ?? r.dataProjetada;
    const chave = [
      viavel,
      data,
      r.cabemAteEncerramento?.cabem ?? "-",
      def.fusao?.flat().join(",") ?? "-",
      def.decisaoRecesso ?? "-",
    ].join("|");
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    const fusaoAtiva = def.fusao?.filter((g) => g.length > 1) ?? [];
    const observacao = viavel
      ? undefined
      : r.sugestao.includes("seguir encontros no recesso")
        ? "Só fecha com a decisão do recesso."
        : "Nem com este caminho fecha antes do encerramento.";

    cenarios.push({
      id: def.id,
      rotulo: def.rotulo,
      viavel,
      estado: r.estado,
      data,
      cabem: r.cabemAteEncerramento,
      sessoes: sessoesDe(r.passos),
      fusao: fusaoAtiva,
      decisaoRecesso: def.decisaoRecesso,
      praticaFlex: r.praticaFlex,
      observacao,
    });
  }

  // custo de mudança: menos decisões/fusões primeiro no empate de data
  const custo = (c: CenarioPlano) =>
    (c.decisaoRecesso ? 2 : 0) + c.fusao.length;
  cenarios.sort((a, b) => {
    if (a.viavel !== b.viavel) return a.viavel ? -1 : 1;
    const da = a.data ?? "9999-12-31";
    const db = b.data ?? "9999-12-31";
    if (da !== db) return da < db ? -1 : 1;
    return custo(a) - custo(b);
  });

  return { cenarios, melhor: cenarios.find((c) => c.viavel) ?? null };
}
