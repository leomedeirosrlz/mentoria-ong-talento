import {
  AVALIACAO_LABEL,
  diffDias,
  formatDate,
  toDateStr,
  TRILHA_LABEL,
  type PassoGuia,
} from "./ciclo";
import type {
  AvaliacaoJovem,
  CicloEvento,
  Dupla,
  Encaminhamento,
  EncerramentoChecklist,
  Encontro,
  Trilha,
} from "./types";

// ---------- checklist do fechamento (guia DPP, cap. encerramento) ----------

/** Ordem canônica do checklist — a chave `autoavaliacao` não é marcada à mão:
 *  deriva de autoavaliacao_mentor (o mentor preenche na própria ficha). */
export const CHECKLIST_ENCERRAMENTO: {
  key: keyof EncerramentoChecklist;
  label: string;
  /** true = vem dos dados, não do clique da coordenação */
  derivado?: boolean;
}[] = [
  {
    key: "feedback_final",
    label: "Encontro de encerramento realizado: celebração e fechamento",
  },
  {
    key: "feedback_mutuo",
    label: "Troca de feedbacks entre mentor e mentorado",
  },
  {
    key: "revisao_pdm",
    label: "PDM e Roda da Vida revisados: avanços e o que segue em aberto",
  },
  {
    key: "avaliacao_360_enviada",
    label: "Avaliação 360º enviada ao mentor e ao mentorado",
  },
  {
    key: "autoavaliacao",
    label: "Autoavaliação do mentor recebida",
    derivado: true,
  },
];

// ---------- resumo da jornada (relatório final do guia) ----------

const PESO_AVALIACAO: Record<AvaliacaoJovem, number> = {
  excelente: 4,
  boa: 3,
  regular: 2,
  baixa: 1,
};

export type ResumoJornada = {
  mentorNome: string;
  mentoradoNome: string;
  trilha: Trilha;
  /** Status atual da dupla — um fechamento antigo (sem row) ainda lê
   *  "jornada fechada", não "em andamento". */
  status: Dupla["status"];
  /** "YYYY-MM-DD" ou null quando a dupla nunca teve início registrado. */
  inicio: string | null;
  /** ISO do fechamento — ou null quando a jornada ainda está aberta. */
  fim: string | null;
  realizados: number;
  total: number;
  /** Encontros esperados pelo calendário oficial — null na trilha
   *  especialista (não há datas oficiais pra comparar). */
  esperados: number | null;
  /** Média 1–4 das avaliações do jovem — null quando nenhum registro avaliou. */
  mediaAvaliacao: number | null;
  /** Últimos registros entregues — os marcos que fecham a história. */
  ultimosRegistros: {
    numero: number;
    data: string | null;
    tema: string | null;
    avaliacao: AvaliacaoJovem | null;
  }[];
  combinadosFeitos: number;
  combinadosTotal: number;
};

/** O que o resumo precisa da dupla — estrutural e estreito pra servir tanto
 *  à ficha (Dupla completa do DUPLA_SELECT) quanto ao select enxuto da action
 *  de encerramento. */
export type DuplaParaResumo = {
  trilha: Dupla["trilha"];
  status: Dupla["status"];
  iniciada_em: string | null;
  mentor: { nome: string };
  mentorado: { nome: string };
  encontros: {
    numero: number;
    status: Encontro["status"];
    data_hora: string | null;
    realizado_em: string | null;
    registro?: {
      tema: string | null;
      avaliacao: AvaliacaoJovem | null;
    } | null;
  }[];
  encaminhamentos: { status: Encaminhamento["status"] }[];
};

/** Os dados do bloco "Resumo da jornada" — mesma derivação pra ficha (bloco
 *  print-friendly) e pro snapshot gravado em encerramentos.resumo_jornada. */
export function dadosResumoJornada(
  dupla: DuplaParaResumo,
  passos: PassoGuia[],
  eventos: CicloEvento[],
  fim: string | null,
  hoje = new Date()
): ResumoJornada {
  const realizados = dupla.encontros.filter(
    (e) => e.status === "realizado"
  ).length;
  // "esperados" só existe contra um calendário — na trilha especialista não
  // há datas oficiais, então a régua é a própria trilha
  const esperados =
    dupla.trilha === "especialista"
      ? null
      : eventos.filter(
          (e) =>
            e.tipo === "encontro" &&
            e.data != null &&
            e.data <= toDateStr(hoje) &&
            (!dupla.iniciada_em || e.data >= dupla.iniciada_em)
        ).length;

  const avaliacoes = dupla.encontros
    .map((e) => e.registro?.avaliacao)
    .filter((a): a is AvaliacaoJovem => !!a);
  const mediaAvaliacao = avaliacoes.length
    ? avaliacoes.reduce((s, a) => s + PESO_AVALIACAO[a], 0) / avaliacoes.length
    : null;

  const ultimosRegistros = dupla.encontros
    .filter((e) => e.registro)
    .sort((a, b) => b.numero - a.numero)
    .slice(0, 3)
    .map((e) => ({
      numero: e.numero,
      data: e.realizado_em ?? e.data_hora,
      tema: e.registro!.tema,
      avaliacao: e.registro!.avaliacao,
    }));

  const combinadosFeitos = dupla.encaminhamentos.filter(
    (t) => t.status === "feito"
  ).length;

  return {
    mentorNome: dupla.mentor.nome,
    mentoradoNome: dupla.mentorado.nome,
    trilha: dupla.trilha,
    status: dupla.status,
    inicio: dupla.iniciada_em,
    fim,
    realizados,
    total: passos.length,
    esperados,
    mediaAvaliacao,
    ultimosRegistros,
    combinadosFeitos,
    combinadosTotal: dupla.encaminhamentos.length,
  };
}

/** Label da média — ancora na escala do form semanal (1–4). */
export function mediaAvaliacaoLabel(media: number): string {
  return media >= 3.5
    ? AVALIACAO_LABEL.excelente
    : media >= 2.5
      ? AVALIACAO_LABEL.boa
      : media >= 1.5
        ? AVALIACAO_LABEL.regular
        : AVALIACAO_LABEL.baixa;
}

/** Texto do resumo — snapshot gravado em encerramentos.resumo_jornada e base
 *  do relatório final do guia. Gerado dos dados; não é campo livre. */
export function textoResumoJornada(r: ResumoJornada): string {
  const linhas = [
    `Resumo da jornada · ${r.mentorNome} e ${r.mentoradoNome}`,
    `Trilha ${TRILHA_LABEL[r.trilha]} · início ${formatDate(r.inicio)}` +
      (r.fim
        ? ` · encerramento ${formatDate(r.fim)}`
        : r.status === "concluida" || r.status === "encerrada"
          ? " · jornada fechada"
          : " · em andamento"),
    `Encontros realizados: ${r.realizados} de ${r.total}` +
      (r.esperados != null ? ` (esperados pelo calendário: ${r.esperados})` : ""),
    r.mediaAvaliacao != null
      ? `Avaliação média do jovem: ${r.mediaAvaliacao.toFixed(1)}/4 (${mediaAvaliacaoLabel(r.mediaAvaliacao).toLowerCase()})`
      : "Sem avaliações registradas",
    `Combinados cumpridos: ${r.combinadosFeitos} de ${r.combinadosTotal}`,
  ];
  if (r.ultimosRegistros.length) {
    linhas.push("Últimos registros:");
    for (const u of r.ultimosRegistros) {
      linhas.push(
        `· ${u.numero}º encontro (${formatDate(u.data)})` +
          `${u.tema ? ` · ${u.tema}` : ""}` +
          `${u.avaliacao ? ` · avaliação ${AVALIACAO_LABEL[u.avaliacao].toLowerCase()}` : ""}`
      );
    }
  }
  return linhas.join("\n");
}

// ---------- prazo da trilha especialista (3 meses do aceite) ----------

export type PrazoTrilha = {
  /** "YYYY-MM-DD" — início + 3 meses (duração máxima do guia). */
  fim: string;
  /** Dias restantes até o fim — negativo = prazo estourado. */
  diasRestantes: number;
  /** urgente = <2 semanas pro fim (ainda dentro); vencido = já passou. */
  estado: "ok" | "urgente" | "vencido";
};

/** Prazo da trilha de especialista: 3 meses a partir do início da dupla
 *  (duplas.iniciada_em, carimbada no aceite — aceitar_solicitacao grava
 *  current_date). Sem início registrado não há prazo a mostrar. */
export function prazoTrilhaEspecialista(
  iniciadaEm: string | null | undefined,
  hoje = new Date()
): PrazoTrilha | null {
  if (!iniciadaEm) return null;
  const inicio = new Date(`${iniciadaEm}T12:00:00`);
  if (isNaN(inicio.getTime())) return null;
  const fimData = new Date(inicio);
  fimData.setMonth(fimData.getMonth() + 3);
  const fim = toDateStr(fimData);
  const diasRestantes = diffDias(fim, toDateStr(hoje));
  return {
    fim,
    diasRestantes,
    estado: diasRestantes < 0 ? "vencido" : diasRestantes < 14 ? "urgente" : "ok",
  };
}
