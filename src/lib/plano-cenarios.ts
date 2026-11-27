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
  /** Encontros por semana que o planner escolheu neste caminho. */
  ritmo: number;
  /** Pares fundidos usados neste cenário. */
  fusao: number[][];
  decisaoRecesso: "pausa" | "segue" | null;
  /** Recesso que a decisão declara (null quando não há recesso no ciclo). */
  recesso: { cicloEventoId: string; usa: boolean } | null;
  praticaFlex: { dias: number; oficial: number } | null;
  /** Por que não fecha / o que o caminho custa. */
  observacao?: string;
};

export type ResultadoCenarios = {
  cenarios: CenarioPlano[];
  /** Caminho mais cedo entre os viáveis. */
  melhor: CenarioPlano | null;
  /** Caminho COMPLETO de menor fricção (o que menos muda o combinado) —
   *  é ele que responde "como a dupla fica em dia?". */
  menorFriccao: {
    cenario: CenarioPlano;
    passos: PlanoAplicavel["passos"];
  } | null;
};

/** Custo de mudança do caminho: fusão, decisão de seguir no recesso e
 *  ritmo acima de 1/semana (os prompts de fricção da dupla). */
export function friccaoDoCenario(c: CenarioPlano): number {
  // ritmo pesa pelo degrau: 2/semana é um ajuste, 1/dia é outro regime
  const ritmo = c.ritmo >= 7 ? 3 : c.ritmo >= 3 ? 2 : c.ritmo > 1 ? 1 : 0;
  return (
    c.fusao.length +
    (c.decisaoRecesso === "segue" ? 2 : 0) +
    ritmo +
    (c.praticaFlex && c.praticaFlex.dias < c.praticaFlex.oficial ? 1 : 0)
  );
}

/** O que o caminho pede da dupla, em frases curtas pra interface. */
export function exigenciasDoCenario(c: CenarioPlano): string[] {
  const out: string[] = [];
  if (c.decisaoRecesso === "segue")
    out.push("continuar se encontrando no recesso");
  if (c.decisaoRecesso === "pausa") out.push("parar no recesso");
  if (c.fusao.length === 1)
    out.push("juntar 2 encontros numa sessão só");
  else if (c.fusao.length > 1)
    out.push(
      `juntar ${c.fusao.length} pares de encontros (${c.fusao.map((g) => g.join("+")).join(", ")})`
    );
  if (c.ritmo >= 7) out.push("com 1 encontro por dia");
  else if (c.ritmo > 1) out.push(`${c.ritmo} encontros por semana`);
  if (c.praticaFlex && c.praticaFlex.dias < c.praticaFlex.oficial)
    out.push(
      `esperar só ${c.praticaFlex.dias} dias de prática entre dois encontros`
    );
  return out;
}

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
    ritmo: 0,
    decisaoRecesso: null,
    recesso: null,
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
  if (!base.aplicavel)
    return {
      cenarios: [vazio(input.dupla, base.motivo)],
      melhor: null,
      menorFriccao: null,
    };

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
      rotulo: "do jeito que está",
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
      rotulo: "parando no recesso",
      dupla: comDecisaoRecesso(input.dupla, recesso, true),
      decisaoRecesso: "pausa",
    },
    {
      id: "fusao_par",
      rotulo: "juntando 2 encontros",
      dupla: input.dupla,
      fusao: primeiroPar,
      decisaoRecesso: null,
    },
    {
      id: "fusao_pares",
      rotulo: "juntando todos os pares",
      dupla: input.dupla,
      fusao: pares,
      decisaoRecesso: null,
    },
    {
      id: "recesso_segue_fusao",
      rotulo: "seguindo no recesso e juntando todos os pares",
      dupla: comDecisaoRecesso(input.dupla, recesso, false),
      fusao: pares,
      decisaoRecesso: "segue",
    },
    {
      id: "ritmo_1_por_dia",
      rotulo: "com 1 encontro por dia",
      dupla: input.dupla,
      ritmo: 7,
      decisaoRecesso: null,
    },
    {
      id: "recesso_segue_ritmo",
      rotulo: "seguindo no recesso, com 1 encontro por dia",
      dupla: comDecisaoRecesso(input.dupla, recesso, false),
      ritmo: 7,
      decisaoRecesso: "segue",
    },
  ];

  // fusão em k pares (k crescente): a menor fricção que fecha costuma ser
  // "fundir só o necessário", não "fundir tudo" nem "1 por dia"
  for (let k = 1; k <= Math.min(pares.length, 6); k++) {
    const grupos = pares.slice(0, k);
    definicoes.push({
      id: `fusao_${k}`,
      rotulo:
        k === 1
          ? "juntando 2 encontros"
          : `juntando ${k} pares de encontros`,
      dupla: input.dupla,
      fusao: grupos,
      decisaoRecesso: null,
    });
    if (recesso) {
      definicoes.push({
        id: `recesso_segue_fusao_${k}`,
        rotulo:
          k === 1
            ? "seguindo no recesso e juntando 2 encontros"
            : `seguindo no recesso e juntando ${k} pares de encontros`,
        dupla: comDecisaoRecesso(input.dupla, recesso, false),
        fusao: grupos,
        decisaoRecesso: "segue",
      });
    }
  }

  const chaveDoCenario = new Map<string, string>();
  const vistos = new Set<string>();
  const cenarios: CenarioPlano[] = [];
  const passosPorChave = new Map<string, PlanoAplicavel["passos"]>();
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
    passosPorChave.set(chave, r.passos);

    const fusaoAtiva = def.fusao?.filter((g) => g.length > 1) ?? [];
    const observacao = viavel
      ? undefined
      : r.sugestao.includes("seguir encontros no recesso")
        ? "Só fecha se a dupla decidir seguir no recesso."
        : "Nem assim fecha antes do encerramento.";

    chaveDoCenario.set(def.id, chave);
    cenarios.push({
      id: def.id,
      rotulo: def.rotulo,
      viavel,
      estado: r.estado,
      data,
      cabem: r.cabemAteEncerramento,
      sessoes: sessoesDe(r.passos),
      ritmo: r.ritmo,
      fusao: fusaoAtiva,
      decisaoRecesso: def.decisaoRecesso,
      recesso:
        def.decisaoRecesso && recesso
          ? {
              cicloEventoId: recesso.id,
              usa: def.decisaoRecesso === "pausa",
            }
          : null,
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

  // menor fricção: entre os viáveis, o que menos muda (fusão/recesso/
  // ritmo/prática); no empate, o mais cedo
  const viaveis = cenarios.filter((c) => c.viavel);
  const escolhido = [...viaveis].sort((a, b) => {
    const fa = friccaoDoCenario(a);
    const fb = friccaoDoCenario(b);
    if (fa !== fb) return fa - fb;
    const da = a.data ?? "9999-12-31";
    const db = b.data ?? "9999-12-31";
    if (da !== db) return da < db ? -1 : 1;
    // empate de fricção e data: menos encontros por semana antes de mais
    // fusões (a agenda pesa mais que juntar dois encontros)
    if (a.ritmo !== b.ritmo) return a.ritmo - b.ritmo;
    return a.fusao.length - b.fusao.length;
  })[0];
  const menorFriccao = escolhido
    ? {
        cenario: escolhido,
        passos: passosPorChave.get(chaveDoCenario.get(escolhido.id) ?? "") ?? [],
      }
    : null;

  return {
    cenarios,
    melhor: cenarios.find((c) => c.viavel) ?? null,
    menorFriccao,
  };
}
