// Domínio puro de /registros — o agrupamento da timeline (?grupo=) e o
// panorama do ciclo (REALIZA-198). Roda no server render e no vitest; os
// itens já chegam completos da query, então o custo é só o particionamento
// em memória (zero round-trip a mais).

import {
  AVALIACAO_LABEL,
  eventosDoCronograma,
  formatDiaMes,
  semanaBounds,
  toDateStr,
} from "@/lib/ciclo";
import { turmaCurta, turmaLonga } from "@/lib/turma";
import type {
  AvaliacaoJovem,
  CicloEvento,
  Cronograma,
  Dupla,
} from "@/lib/types";

/** Eixos de agrupamento do `?grupo=` — "dupla" é o default implícito e não
 *  viaja na URL. */
export const GRUPOS_REGISTROS = ["dupla", "semana", "avaliacao"] as const;
export type GrupoRegistros = (typeof GRUPOS_REGISTROS)[number];

/** Rótulos do segmented control — "Agrupar: por dupla · por semana · por
 *  avaliação". */
export const GRUPO_REGISTROS_OPCAO: Record<GrupoRegistros, string> = {
  dupla: "por dupla",
  semana: "por semana",
  avaliacao: "por avaliação",
};

/** `?grupo=` validado — lixo na URL cai no default em vez de quebrar a lista. */
export function grupoRegistrosDe(v: string | undefined): GrupoRegistros {
  return (GRUPOS_REGISTROS as readonly string[]).includes(v ?? "")
    ? (v as GrupoRegistros)
    : "dupla";
}

/** O mínimo que o agrupamento lê de cada item — `RegistroResumo` satisfaz
 *  estruturalmente (campos a mais sobram). Manter o tipo estrutural deixa a
 *  função testável sem montar a árvore inteira da query. */
export type RegistroAgrupavel = {
  created_at: string;
  avaliacao: AvaliacaoJovem | null;
  encontro: {
    dupla: {
      id: string;
      mentor: { nome: string } | null;
      mentorado: { nome: string } | null;
    } | null;
  } | null;
};

export type BlocoRegistros<T> = {
  /** chave estável do grupo — id da dupla, segunda ISO da semana, valor do
   *  enum de avaliação. */
  chave: string;
  /** cabeçalho pronto da seção ("Dupla: Ana × Bia", "Semana de 13/10/2025",
   *  "Avaliação: Baixa"). A contagem ("· K registros") é acoplada no render. */
  rotulo: string;
  itens: T[];
};

/** Chave residual de quem não tem dupla identificável (encontro órfão ou
 *  dupla removida) — sempre fecha a lista, nunca abre. */
const SEM_DUPLA = "__sem-dupla__";
const SEM_DATA = "__sem-data__";

/** Eixo semana = a segunda-feira calendário (seg–dom, mesma regra de
 *  `semanaBounds`) da data em que o registro foi ENTREGUE — `created_at`,
 *  não a data do encontro: agrupa "o que reportaram esta semana", que é a
 *  leitura de follow-up. Data inválida cai num balde residual no fim. */
function semanaDe(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return SEM_DATA;
  return semanaBounds(d).seg;
}

/** Baixa → regular → boa → excelente: a escala vira triagem — quem pede
 *  olho abre a lista (a mesma lógica do `scoreAlerta` da página). "Sem
 *  avaliação" fecha, por ser o balde menos informativo. */
const ORDEM_AVALIACAO: (AvaliacaoJovem | "")[] = [
  "baixa",
  "regular",
  "boa",
  "excelente",
  "",
];

/** Particiona `itens` em blocos com cabeçalho, SEM reordenar dentro de cada
 *  grupo — a ordem corrente (recentes/antigas/prioridade) segue valendo de
 *  item a item. Ordem entre grupos:
 *  - dupla/semana: primeira aparição na lista (adaptive — o grupo do item
 *    mais relevante abre, seja ele o mais novo em "recentes" ou o mais
 *    antigo em "antigas");
 *  - avaliacao: ordem fixa de severidade (ORDEM_AVALIACAO);
 *  - baldes residuais (sem dupla, sem data) sempre por último. */
export function agruparRegistros<T extends RegistroAgrupavel>(
  itens: T[],
  grupo: GrupoRegistros
): BlocoRegistros<T>[] {
  if (grupo === "avaliacao") {
    return ORDEM_AVALIACAO.map((av) => ({
      chave: av || "sem-avaliacao",
      rotulo: av ? `Avaliação: ${AVALIACAO_LABEL[av]}` : "Sem avaliação",
      itens: itens.filter((r) => (r.avaliacao ?? "") === av),
    })).filter((b) => b.itens.length > 0);
  }

  const blocos = new Map<string, BlocoRegistros<T>>();
  for (const r of itens) {
    let chave: string;
    let rotulo: string;
    if (grupo === "dupla") {
      const d = r.encontro?.dupla;
      chave = d?.id ?? SEM_DUPLA;
      rotulo = d
        ? `Dupla: ${d.mentor?.nome ?? "—"} × ${d.mentorado?.nome ?? "—"}`
        : "Dupla removida";
    } else {
      // grupo === "semana"
      const seg = semanaDe(r.created_at);
      chave = seg;
      rotulo =
        seg === SEM_DATA ? "Sem data" : `Semana de ${formatDiaMes(seg)}`;
    }
    let b = blocos.get(chave);
    if (!b) {
      b = { chave, rotulo, itens: [] };
      blocos.set(chave, b);
    }
    b.itens.push(r);
  }
  // residuais por último — sort estável preserva a ordem de 1ª aparição
  const residual = (b: BlocoRegistros<T>) =>
    b.chave === SEM_DUPLA || b.chave === SEM_DATA ? 1 : 0;
  return [...blocos.values()].sort((a, b) => residual(a) - residual(b));
}

// ---------- panorama do ciclo (dashboard v2, REALIZA-198) ----------
// As regras abaixo vêm do mock aprovado (docs/mockups/registros/v2.html) e
// do plano feedback-ux-2026-10/registros-dashboards.md. Resumo das decisões:
//  - denominador por célula (cronograma × nº) = duplas que o encontro cobra:
//    ativas lançadas até a data oficial OU com a linha do encontro criada
//    (quem pausou/encerrou depois de fazê-lo continua contando; quem saiu
//    antes de chegar ali não é cobrado — por isso o trilho "encolhe");
//  - data oficial ANTERIOR a hoje → "vencido" (o buraco é falta real); de
//    hoje até domingo → "semana" (hachurado "a acontecer", nunca é falta —
//    o encontro de hoje não é falta, regra do mock); além dela → "futuro"
//    (fora do trilho — coluna vira fantasma tracejado quando nenhuma turma
//    chegou lá);
//  - a linha ★ usa avaliacoes_encontro.estrelas (1–5, do jovem) — NÃO o
//    registros.avaliacao (4-pt qualitativo do mentor, que segue nos cards);
//  - a situação das duplas NÃO mora aqui: vem de saudeDoRecorte, a mesma
//    contagem de /duplas, /agenda e da home.

/** Recorte de período do painel: "ciclo" é o default implícito e não viaja
 *  na URL; "8s"/"4s" cortam as últimas N semanas pela DATA OFICIAL do
 *  encontro (a mesma régua das colunas — não a data de entrega do registro). */
export type PeriodoRegistros = "4s" | "8s";

export const PERIODO_REGISTROS_OPCOES: {
  valor: "ciclo" | PeriodoRegistros;
  rotulo: string;
}[] = [
  { valor: "ciclo", rotulo: "Ciclo todo" },
  { valor: "8s", rotulo: "Últimas 8 semanas" },
  { valor: "4s", rotulo: "Últimas 4 semanas" },
];

/** `?periodo=` validado — lixo na URL cai no "ciclo" em vez de quebrar. */
export function periodoRegistrosDe(
  v: string | undefined
): "ciclo" | PeriodoRegistros {
  return v === "4s" || v === "8s" ? v : "ciclo";
}

/** Corte inferior do período em ISO date ("YYYY-MM-DD") — comparável com a
 *  data oficial do ciclo_evento. "ciclo" não corta. */
export function cortePeriodo(
  p: "ciclo" | PeriodoRegistros,
  hoje: Date
): string | null {
  if (p === "ciclo") return null;
  const dias = p === "8s" ? 56 : 28;
  return toDateStr(new Date(hoje.getTime() - dias * 86400000));
}

/** Estado da célula (cronograma × encontro) no calendário — decide entre
 *  "falta de verdade" e "ainda não chegou": `vencido` = data oficial
 *  anterior a hoje; `semana` = de hoje até o domingo corrente; `futuro` =
 *  além da semana. */
export type PanoramaEstado = "vencido" | "semana" | "futuro";

export type PanoramaCelula = {
  cronogramaId: string;
  estado: PanoramaEstado;
  /** data oficial do encontro neste cronograma (YYYY-MM-DD). */
  dataOficial: string;
  /** denominador honesto — duplas cobradas por este encontro (regra acima). */
  esperadas: number;
  /** com registro entregue (a métrica default das barras). */
  entregues: number;
  /** status realizado — aconteceu, com ou sem registro. */
  realizados: number;
  /** com a avaliação-estrela do jovem. */
  avaliados: number;
  /** notas 1–5 individuais do jovem — alimenta a nuvem "por avaliação". */
  estrelas: number[];
  /** avaliação qualitativa do mentor mapeada p/ número (baixa 1 …
   *  excelente 4) — a segunda métrica da linha. */
  notasMentor: number[];
  /** "Mentor × Jovem" de quem devia e não entregou (só em célula vencida —
   *  no futuro ninguém deve). Pendente = sem registro E sem fechamento do
   *  encontro: `nao_aconteceu`/`cancelado` já encerraram o caso (o buraco
   *  vira "encontro não realizado", não dívida de registro). Cortada em 3
   *  pro tooltip. */
  pendentes: string[];
  totalPendentes: number;
};

export type PanoramaSlot = {
  numero: number;
  /** uma célula por cronograma que cobre este número (ordem de `turmas`). */
  celulas: PanoramaCelula[];
};

export type PanoramaTurma = {
  cronogramaId: string;
  /** "T1" — sigla curta (legenda, tooltip). */
  rotulo: string;
  /** "Turma 1" — leitura longa (títulos, aria). */
  longa: string;
};

export type RegistrosPanorama = {
  /** colunas do gráfico por nº de encontro, já no recorte (período/turma/
   *  dupla/encontro da URL). Vazio = nenhum encontro oficial no recorte. */
  slots: PanoramaSlot[];
  /** cronogramas que formam o eixo (ordem do banco — T1 antes da T2). */
  turmas: PanoramaTurma[];
  /** trilhas de especialista no recorte — sem calendário oficial, ficam
   *  fora das colunas e da linha. */
  espNoRecorte: number;
};

/** avaliação qualitativa do mentor → eixo numérico 1–4 pra linha "do
 *  mentor". A escala oficial é texto; o número é só a régua do gráfico. */
export const NOTA_MENTOR: Record<string, number> = {
  baixa: 1,
  regular: 2,
  boa: 3,
  excelente: 4,
};

const nomeCurto = (nome: string | null | undefined): string =>
  nome?.split(" ")[0] ?? "—";

/** Agrega o painel "Panorama do ciclo" sobre o escopo já resolvido pela
 *  query (RLS: coord = todas as duplas; supervisor = as que supervisiona).
 *  Tudo é derivado de `duplas` + `eventos`/`cronogramas` — mesma fonte da
 *  ficha e do semáforo, zero query extra de agregação.
 *
 *  O recorte estrutural da página (turma, período, dupla, encontro) entra
 *  inteiro; os filtros de CONTEÚDO (busca, avaliação, apoio, dificuldade,
 *  tardio) não fazem sentido num gráfico de cobertura — eles só afunilam a
 *  lista abaixo (decisão registrada no plano da issue). */
export function panoramaRegistros({
  duplas,
  eventos,
  cronogramas,
  recorte,
  hoje = new Date(),
}: {
  duplas: Dupla[];
  eventos: CicloEvento[];
  cronogramas: Cronograma[];
  recorte: {
    /** cronograma_id da pill de turma. */
    turma?: string;
    periodo?: PeriodoRegistros;
    /** ?dupla= da lista — o painel vira o resumo dela. */
    dupla?: string;
    /** ?encontro= da lista — o painel zomba no slot. */
    encontro?: number;
  };
  hoje?: Date;
}): RegistrosPanorama {
  const hojeStr = toDateStr(hoje);
  const { dom } = semanaBounds(hoje);
  const corte = recorte.periodo ? cortePeriodo(recorte.periodo, hoje) : null;

  const escopo = duplas.filter(
    (d) =>
      (!recorte.dupla || d.id === recorte.dupla) &&
      (!recorte.turma || d.cronograma_id === recorte.turma)
  );

  // legenda = cronogramas com dupla no escopo: turma sem ninguém cobrado
  // não pode ocupar cor nem pill de legenda (eixo de barras/linha é o
  // mesmo — sem célula ela já não desenharia nada)
  const turmas: PanoramaTurma[] = cronogramas
    .filter(
      (c) =>
        (!recorte.turma || c.id === recorte.turma) &&
        escopo.some((d) => d.cronograma_id === c.id)
    )
    .map((c) => ({
      cronogramaId: c.id,
      rotulo: turmaCurta(c.turma),
      longa: turmaLonga(c.turma),
    }));

  const slotsPorNumero = new Map<number, PanoramaSlot>();
  for (const t of turmas) {
    const eventosC = eventosDoCronograma(eventos, t.cronogramaId).filter(
      (e) => e.tipo === "encontro" && e.numero != null && e.data != null
    );
    const duplasC = escopo.filter((d) => d.cronograma_id === t.cronogramaId);
    for (const ev of eventosC) {
      const numero = ev.numero!;
      if (recorte.encontro && numero !== recorte.encontro) continue;
      const data = ev.data!;
      // hoje já é "semana" (a acontecer): vencido = data ANTES de hoje —
      // cobrar o encontro do dia como falta mostraria buraco + pendente
      // num encontro que nem aconteceu ainda (regra do mock v2)
      const estado: PanoramaEstado =
        data < hojeStr ? "vencido" : data <= dom ? "semana" : "futuro";
      // janela "últimas N semanas": corta o que ficou antes do corte e o
      // futuro além da semana corrente (que segue hachurada, "a acontecer")
      if (corte && (data < corte || data > dom)) continue;
      // elegível = a dupla ativa já lançada quando a data oficial chegou,
      // OU quem tem a linha do encontro (fez antes de pausar/encerrar — a
      // linha é a prova de que o encontro era dela)
      const elegiveis = duplasC.filter(
        (d) =>
          (d.encontros ?? []).some((e) => e.numero === numero) ||
          (d.status === "ativa" &&
            (!d.iniciada_em || d.iniciada_em <= data))
      );
      let entregues = 0,
        realizados = 0,
        avaliados = 0;
      const estrelas: number[] = [],
        notasMentor: number[] = [],
        pendentes: string[] = [];
      for (const d of elegiveis) {
        const enc = (d.encontros ?? []).find((e) => e.numero === numero);
        if (enc?.status === "realizado") realizados++;
        if (enc?.registro) {
          entregues++;
          const nota = NOTA_MENTOR[enc.registro.avaliacao ?? ""];
          if (nota != null) notasMentor.push(nota);
        } else if (
          estado === "vencido" &&
          // a falta nomeada é "registro devido e não entregue": sem row
          // nenhuma, ou row ainda aberta (agendado/remarcado/realizado sem
          // registro). nao_aconteceu/cancelado fecharam o encontro — o
          // buraco fica no "não realizado" do trilho, não vira pendência
          (enc == null ||
            enc.status === "agendado" ||
            enc.status === "remarcado" ||
            enc.status === "realizado")
        ) {
          pendentes.push(
            `${nomeCurto(d.mentor?.nome)} × ${nomeCurto(d.mentorado?.nome)}`
          );
        }
        if (enc?.avaliacao_jovem) {
          avaliados++;
          if (enc.avaliacao_jovem.estrelas >= 1)
            estrelas.push(enc.avaliacao_jovem.estrelas);
        }
      }
      // célula sem ninguém cobrado (turma sem duplas naquele ponto) não
      // desenha nada — nem trilho vazio
      if (elegiveis.length === 0) continue;
      const slot =
        slotsPorNumero.get(numero) ?? { numero, celulas: [] };
      slot.celulas.push({
        cronogramaId: t.cronogramaId,
        estado,
        dataOficial: data,
        esperadas: elegiveis.length,
        entregues,
        realizados,
        avaliados,
        estrelas,
        notasMentor,
        pendentes: pendentes.slice(0, 3),
        totalPendentes: pendentes.length,
      });
      slotsPorNumero.set(numero, slot);
    }
  }
  const slots = [...slotsPorNumero.values()].sort(
    (a, b) => a.numero - b.numero
  );

  return {
    slots,
    turmas,
    espNoRecorte: escopo.filter((d) => d.trilha === "especialista").length,
  };
}
