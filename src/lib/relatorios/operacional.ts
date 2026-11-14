// Derivações puras das duas seções redesenhadas do hub operacional
// (REALIZA-389): aderência e encerramento viram resumo + fila acionável.
// Nada de régua nova: os agregados leem itemAderencia (a mesma que gera a
// linha do CSV) e saudeDoRecorte (a contagem canônica de saúde) — a seção
// e o export nunca divergem.

import {
  comparaNome,
  diffDias,
  eventosDoCronograma,
  passosDaTrilha,
  toDateStr,
  type DuplaSaude,
} from "@/lib/ciclo";
import {
  saudeRecorteDeItens,
  type SaudeRecorte,
} from "@/lib/agenda-coordenacao";
import { encerramentoDecidido, fechamentoEmFoco } from "@/lib/encerramento";
import {
  duplaNoRecorte,
  type RecorteCsv,
} from "./csv-core";
import {
  itemAderencia,
  linhaEncerramento,
  type DuplaMapa,
} from "./dados";
import type { LinhaAderencia, LinhaEncerramento } from "./csv";
import type {
  CicloEvento,
  Cronograma,
  Dupla,
  Encerramento,
  EncerramentoChecklist,
} from "@/lib/types";

// =====================================================================
// aderência
// =====================================================================

export type ItemAderencia = {
  dupla: Dupla;
  saude: DuplaSaude;
  /** a linha idêntica à do CSV — a prévia da seção lê daqui */
  linha: LinhaAderencia;
};

export type ResumoAderencia = {
  /** contagem canônica do recorte — alimenta SaudePrograma */
  saude: SaudeRecorte;
  /** encontros devidos até hoje pelas duplas ativas */
  esperados: number;
  /** encontros realizados dentro do devido (capped no esperado) */
  realizadosNoPrazo: number;
  /** encontros devidos ainda não realizados — barra "em atraso" */
  emAtraso: number;
  /** realizados além do devido (adiantados ou reposição) */
  adiantados: number;
  /** duplas ativas abaixo do esperado do calendário */
  atrasDoCalendario: number;
  /** duplas ativas com sinal de registro (registro_pendente ou limbo) */
  registrosPendentes: number;
  /** média ponderada do atraso de registro (dias) — null sem registro */
  atrasoMedioRegistro: number | null;
  /** remarcações somadas de todas as duplas do recorte */
  remarcacoes: number;
  /** duplas ativas com sinal ou pedido de apoio — ordenadas por urgência */
  fila: ItemAderencia[];
  /** as demais duplas do recorte, por nome */
  demais: ItemAderencia[];
  /** todos os itens na ordem do recorte — a prévia do CSV lê daqui */
  itens: ItemAderencia[];
};

export function resumoAderencia(
  duplas: Dupla[],
  eventos: CicloEvento[],
  crons: readonly Pick<Cronograma, "id" | "nome" | "turma">[],
  hoje = new Date()
): ResumoAderencia {
  const itens = duplas.map((dupla) => ({
    dupla,
    ...itemAderencia(dupla, eventos, crons, hoje),
  }));
  // a saúde já derivada no item — a contagem canônica não repassa pela
  // derivação só pra contar (mesma régua do SaudePrograma, um cálculo só)
  const saude = saudeRecorteDeItens(itens);

  // A régua agregada só cobra dupla ativa — pausada está fora da cobrança
  // e fechada já conta a própria história no desfecho. O denominador é
  // saude.esperado/feitos (a mesma contagem do semáforo e da legenda da
  // linha — inclui os defasados retroativos vencidos e desconta o que o
  // limbo cobre), não linha.esperados, que é só a régua de entrada do CSV.
  // Especialista não entra: trilha livre não tem calendário pra dever.
  let esperados = 0;
  let noPrazo = 0;
  let adiantados = 0;
  let atrasCal = 0;
  let pendReg = 0;
  let remarc = 0;
  let atrasoSoma = 0;
  let atrasoN = 0;
  for (const i of itens) {
    const l = i.linha;
    if (i.dupla.status === "ativa") {
      if (i.dupla.trilha !== "especialista") {
        esperados += i.saude.esperado;
        noPrazo += Math.min(i.saude.feitos, i.saude.esperado);
        adiantados += Math.max(0, i.saude.feitos - i.saude.esperado);
        if (i.saude.feitos < i.saude.esperado) atrasCal++;
      }
      if (
        i.saude.sinais.some(
          (s) => s.tipo === "registro_pendente" || s.tipo === "limbo"
        )
      )
        pendReg++;
    }
    if (l.atrasoMedioRegistro != null) {
      // a média da dupla pesa pelos registros que a medem
      const n = i.dupla.encontros.filter((e) => e.registro).length;
      atrasoSoma += l.atrasoMedioRegistro * n;
      atrasoN += n;
    }
    remarc += l.remarcacoes;
  }

  const deficit = (i: ItemAderencia) =>
    Math.max(0, i.saude.esperado - i.saude.feitos);
  // apoio aberto lidera a fila (é trabalho a fazer, não falha da dupla);
  // depois semáforo, depois o buraco no calendário
  const peso = (i: ItemAderencia) =>
    i.saude.apoio.aberto
      ? 0
      : i.saude.semaforo === "risco"
        ? 1
        : i.saude.semaforo === "atencao"
          ? 2
          : 3;
  // pausada entra só por pedido de apoio — a jornada congelada não gera
  // cobrança, mas o pedido continua sendo trabalho da coordenação
  const fila = itens
    .filter((i) =>
      i.dupla.status === "ativa"
        ? i.saude.sinais.length > 0 || i.saude.apoio.aberto
        : i.dupla.status === "pausada" && i.saude.apoio.aberto
    )
    .sort(
      (a, b) =>
        peso(a) - peso(b) ||
        deficit(b) - deficit(a) ||
        comparaNome(a.dupla.mentor?.nome ?? "", b.dupla.mentor?.nome ?? "")
    );
  const filaIds = new Set(fila.map((i) => i.dupla.id));
  const demais = itens
    .filter((i) => !filaIds.has(i.dupla.id))
    .sort(
      (a, b) =>
        comparaNome(a.dupla.mentor?.nome ?? "", b.dupla.mentor?.nome ?? "") ||
        comparaNome(
          a.dupla.mentorado?.nome ?? "",
          b.dupla.mentorado?.nome ?? ""
        )
    );
  // a prévia mostra as primeiras linhas do CSV — mesma ordem do export
  const itensCsv = [...itens].sort(
    (a, b) =>
      comparaNome(a.linha.mentor, b.linha.mentor) ||
      comparaNome(a.linha.mentorado, b.linha.mentorado)
  );

  return {
    saude,
    esperados,
    realizadosNoPrazo: noPrazo,
    emAtraso: esperados - noPrazo,
    adiantados,
    atrasDoCalendario: atrasCal,
    registrosPendentes: pendReg,
    atrasoMedioRegistro: atrasoN ? atrasoSoma / atrasoN : null,
    remarcacoes: remarc,
    fila,
    demais,
    itens: itensCsv,
  };
}

// =====================================================================
// encerramento
// =====================================================================

/** Rótulo curto do item do checklist pra contagem e linha — a label longa
 *  canônica (CHECKLIST_ENCERRAMENTO) segue na ficha e no title. */
export const CHECKLIST_CURTO: Record<keyof EncerramentoChecklist, string> = {
  feedback_final: "encontro de encerramento",
  feedback_mutuo: "troca de feedbacks",
  revisao_pdm: "revisão do PDM",
  avaliacao_360_enviada: "avaliação 360",
};

export type ParEncerramento = { enc: Encerramento; dupla: Dupla | null };

/** Encerramentos × duplas já filtrados pelo recorte — a mesma regra do
 *  linhasEncerramento (órfo só entra sem recorte). */
export function paresEncerramento(
  encerramentos: Encerramento[],
  duplas: Dupla[],
  recorte: RecorteCsv,
  crons: readonly Pick<Cronograma, "id" | "turma">[]
): ParEncerramento[] {
  const porId = new Map(duplas.map((d) => [d.id, d]));
  return encerramentos
    .map((enc) => ({ enc, dupla: porId.get(enc.dupla_id) ?? null }))
    .filter((p) =>
      p.dupla
        ? duplaNoRecorte(p.dupla, recorte, crons)
        : !(recorte.turma || recorte.cronogramaId)
    );
}

export type ItemEncerramento = {
  enc: Encerramento;
  /** null quando a dupla não veio no escopo carregado — a linha do CSV
   *  cobre o fato; a fila não renderiza o que não pode abrir */
  dupla: Dupla | null;
  /** a linha idêntica à do CSV — derivada UMA vez por par */
  linha: LinhaEncerramento;
  feitos: number;
  total: number;
  /** itens do checklist ainda por marcar, na ordem canônica */
  faltantes: (keyof EncerramentoChecklist)[];
  /** dias desde a abertura do rito */
  diasAberto: number;
};

export type ResumoEncerramento = {
  /** ritos sem decisão com dupla visível — mais antigos primeiro
   *  (urgência = espera). Órfão (dupla fora do escopo carregado) fica
   *  fora da fila: entra no total e na prévia, não no trabalho acionável */
  pendentes: ItemEncerramento[];
  /** ritos decididos com dupla visível — abertos por último primeiro
   *  (sem carimbo da decisão) */
  decididos: ItemEncerramento[];
  /** as linhas do CSV na mesma ordem do export — a prévia lê daqui */
  linhasCsv: LinhaEncerramento[];
  total: number;
  concluidas: number;
  encerradas: number;
  /** dias do rito aberto mais antigo — null sem pendente */
  maisAntigoDias: number | null;
  /** itens do checklist em aberto nos pendentes, mais frequente primeiro */
  faltantes: { key: keyof EncerramentoChecklist; n: number }[];
};

export function resumoEncerramento(
  pares: ParEncerramento[],
  hoje = new Date()
): ResumoEncerramento {
  const hojeStr = toDateStr(hoje);
  const itens = pares.map(({ enc, dupla }): ItemEncerramento => {
    const { feitos, total, linha } = linhaEncerramento(
      { ...enc, decidido: enc.decidido?.nome ?? "" },
      dupla ? duplaParaMapa(dupla) : undefined
    );
    return {
      enc,
      dupla,
      linha,
      feitos,
      total,
      faltantes: (
        Object.keys(CHECKLIST_CURTO) as (keyof EncerramentoChecklist)[]
      ).filter((k) => enc.checklist?.[k] !== true),
      diasAberto: Math.max(
        0,
        diffDias(hojeStr, toDateStr(new Date(enc.created_at)))
      ),
    };
  });

  const visiveis = itens.filter((i) => i.dupla != null);
  const pendentes = visiveis
    .filter((i) => !encerramentoDecidido(i.enc))
    .sort(
      (a, b) =>
        b.diasAberto - a.diasAberto ||
        a.enc.created_at.localeCompare(b.enc.created_at)
    );
  const decididos = visiveis
    .filter((i) => encerramentoDecidido(i.enc))
    .sort((a, b) => b.enc.created_at.localeCompare(a.enc.created_at));

  const faltMap = new Map<keyof EncerramentoChecklist, number>();
  for (const i of pendentes)
    for (const k of i.faltantes) faltMap.set(k, (faltMap.get(k) ?? 0) + 1);

  return {
    pendentes,
    decididos,
    // mesma ordem do csvEncerramento — a prévia é literalmente o início
    // do arquivo que o export baixa
    linhasCsv: itens
      .map((i) => i.linha)
      .sort(
        (a, b) =>
          comparaNome(a.mentor, b.mentor) ||
          comparaNome(a.mentorado, b.mentorado)
      ),
    total: itens.length,
    // a contagem cobre TODOS os pares (órfão incluso) — "X de Y decididos"
    // fala do recorte inteiro, não só do que a fila renderiza
    concluidas: itens.filter(
      (i) => encerramentoDecidido(i.enc) && i.enc.tipo === "concluida"
    ).length,
    encerradas: itens.filter(
      (i) => encerramentoDecidido(i.enc) && i.enc.tipo === "encerrada"
    ).length,
    maisAntigoDias: pendentes.length ? pendentes[0].diasAberto : null,
    // stable sort: mesma contagem cai na ordem canônica do checklist
    faltantes: (Object.keys(CHECKLIST_CURTO) as (keyof EncerramentoChecklist)[])
      .map((key) => ({ key, n: faltMap.get(key) ?? 0 }))
      .filter((f) => f.n > 0)
      .sort((a, b) => b.n - a.n),
  };
}

/** Onde o passo do rito mora na ficha: na aba Agora quando a dupla já está
 *  em reta final ou fechada, na aba Encontros antes disso — o MESMO
 *  predicado que a ficha usa pra decidir onde renderizar o bloco
 *  (fechamentoEmFoco, 0389): o link leva pra onde o rito está de fato. */
export function fichaRitoHref(d: Dupla, eventos: CicloEvento[]): string {
  const total = passosDaTrilha(
    d.trilha,
    eventosDoCronograma(eventos, d.cronograma_id)
  ).length;
  const feitos = d.encontros.filter((e) => e.status === "realizado").length;
  return `/duplas/${d.id}${fechamentoEmFoco(d, total, feitos) ? "" : "?aba=encontros"}`;
}

function duplaParaMapa(d: Dupla): DuplaMapa {
  return {
    id: d.id,
    turma: d.turma,
    cronograma_id: d.cronograma_id,
    mentor_id: d.mentor?.id ?? null,
    mentorado_id: d.mentorado?.id ?? null,
    mentor: d.mentor ? { nome: d.mentor.nome } : null,
    mentorado: d.mentorado ? { nome: d.mentorado.nome } : null,
  };
}
