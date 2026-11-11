// Geradores CSV puros dos 6 tipos novos (REALIZA-178) — recebem as linhas
// já resolvidas (dados.ts faz fetch + recorte + mapeamento) e devolvem o
// documento completo. Nenhuma regra de negócio nova: semáforo/motivos vêm
// de saudadeDaDupla, esperados de encontroEsperado, status efetivo da
// solicitação do status_efetivo da view — aqui é só serialização + labels.

import { csvDoc, dataHora, dia } from "./csv-core";

const numPt = (v: number, casas = 0) =>
  v.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });

const ordem = (a: string, b: string) => a.localeCompare(b, "pt-BR");

// ---------- tipo=aderencia — 1 linha/dupla ----------

export type LinhaAderencia = {
  turma: string;
  cronograma: string;
  trilha: string;
  mentor: string;
  mentorado: string;
  /** encontroEsperado no cronograma da dupla (especialista = 0). */
  esperados: number;
  realizados: number;
  /** realizados/esperados em % — null sem régua (especialista). */
  aderencia: number | null;
  /** média de diasAtrasoRegistro nos registros entregues — null sem registro. */
  atrasoMedioRegistro: number | null;
  /** média 1–4 da avaliação do jovem (PESO_AVALIACAO) — null sem avaliação. */
  avaliacaoMedia: number | null;
  remarcacoes: number;
  /** label do semáforo ("em risco"/"em atenção"/"em dia") — saude.semaforo. */
  semaforo: string;
  /** saude.motivos já em pt-BR, "a | b". */
  motivos: string;
};

export function csvAderencia(linhas: LinhaAderencia[]): string {
  return csvDoc(
    [
      "turma",
      "cronograma",
      "trilha",
      "mentor",
      "mentorado",
      "encontros_esperados",
      "encontros_realizados",
      "aderencia_pct",
      "atraso_medio_registro_dias",
      "avaliacao_media",
      "remarcacoes",
      "semaforo",
      "motivos",
    ],
    [...linhas]
      .sort((a, b) => ordem(a.mentor, b.mentor) || ordem(a.mentorado, b.mentorado))
      .map((l) => [
        l.turma,
        l.cronograma,
        l.trilha,
        l.mentor,
        l.mentorado,
        String(l.esperados),
        String(l.realizados),
        l.aderencia == null ? "" : `${numPt(l.aderencia)}%`,
        l.atrasoMedioRegistro == null ? "" : numPt(l.atrasoMedioRegistro, 1),
        l.avaliacaoMedia == null ? "" : numPt(l.avaliacaoMedia, 1),
        String(l.remarcacoes),
        l.semaforo,
        l.motivos,
      ])
  );
}

// ---------- tipo=assinaturas-pendentes — 1 linha/pendência ----------

export type LinhaAssinaturaPendente = {
  nome: string;
  /** Papel da pessoa (mentor DPP, supervisor, mentorado…). */
  papel: string;
  documento: string;
  /** "pendente" | "expirado" (token_expira_em vencido com status pendente). */
  status: "pendente" | "expirado";
  emitido_em: string;
  expira_em: string;
};

export function csvAssinaturasPendentes(
  linhas: LinhaAssinaturaPendente[]
): string {
  return csvDoc(
    ["nome", "papel", "documento", "status", "emitido_em", "expira_em"],
    [...linhas]
      .sort((a, b) => ordem(a.nome, b.nome) || ordem(a.documento, b.documento))
      .map((l) => [
        l.nome,
        l.papel,
        l.documento,
        l.status,
        dia(l.emitido_em),
        dia(l.expira_em),
      ])
  );
}

// ---------- tipo=interacoes — 1 linha/interação ----------

export type LinhaInteracao = {
  /** "Mentor ↔ Mentorado" — mesmo formato da coluna dupla do tipo=respostas. */
  dupla: string;
  tipo: string;
  canal: string;
  autor: string;
  data: string;
  /** Nota livre da coordenação — formula-injection tratado no celula(). */
  nota: string;
};

export function csvInteracoes(linhas: LinhaInteracao[]): string {
  return csvDoc(
    ["dupla", "tipo", "canal", "autor", "data", "nota"],
    [...linhas]
      // mais recente primeiro — leitura de log, igual à timeline da ficha
      .sort((a, b) => b.data.localeCompare(a.data))
      .map((l) => [
        l.dupla,
        l.tipo,
        l.canal,
        l.autor,
        dataHora(l.data),
        l.nota,
      ])
  );
}

// ---------- tipo=solicitacoes — 1 linha/solicitação de especialista ----------

export type LinhaSolicitacao = {
  mentorado: string;
  demanda: string;
  origem: string;
  /** status_efetivo — a expiração lazy já aplicada. */
  status: string;
  criada_em: string;
  respondida_em: string | null;
  /** dias entre criada_em e respondida_em — null sem resposta ainda. */
  latencia: number | null;
  especialista: string;
};

export function csvSolicitacoes(linhas: LinhaSolicitacao[]): string {
  return csvDoc(
    [
      "mentorado",
      "demanda",
      "origem",
      "status",
      "criada_em",
      "respondida_em",
      "latencia_dias",
      "especialista",
    ],
    [...linhas]
      .sort((a, b) => b.criada_em.localeCompare(a.criada_em))
      .map((l) => [
        l.mentorado,
        l.demanda,
        l.origem,
        l.status,
        dataHora(l.criada_em),
        dataHora(l.respondida_em),
        l.latencia == null ? "" : String(l.latencia),
        l.especialista,
      ])
  );
}

// ---------- tipo=encerramento — 1 linha/dupla com encerramento ----------

export type LinhaEncerramento = {
  mentor: string;
  mentorado: string;
  tipo: string;
  /** "N de 4" — itens true no checklist da 0037. */
  checklist: string;
  decidido_por: string;
  /** resumo_jornada gravado no fechamento — "sim"/"não". */
  resumo_jornada: string;
  created_at: string;
};

export function csvEncerramento(linhas: LinhaEncerramento[]): string {
  return csvDoc(
    [
      "mentor",
      "mentorado",
      "tipo",
      "checklist",
      "decidido_por",
      "resumo_jornada",
      "created_at",
    ],
    [...linhas]
      .sort((a, b) => ordem(a.mentor, b.mentor) || ordem(a.mentorado, b.mentorado))
      .map((l) => [
        l.mentor,
        l.mentorado,
        l.tipo,
        l.checklist,
        l.decidido_por,
        l.resumo_jornada,
        dataHora(l.created_at),
      ])
  );
}

// ---------- tipo=forms-taxa — 1 linha/link de formulário ----------

export type LinhaFormsTaxa = {
  formulario: string;
  /** Nome do destinatário ou "Link genérico" (intake anônimo). */
  destinatario: string;
  papel: string;
  /** "Mentor ↔ Mentorado" — vazio em link sem dupla. */
  dupla: string;
  /** "manual" = destinatário específico; "intake" = divulgação pública. */
  origem: string;
  emitido_em: string;
  /** "sim" quando usado_em (link único) ou com resposta (multi_uso). */
  respondido: "sim" | "não";
  /** Quantas respostas o link recebeu — o multi_uso conta N. */
  respostas: number;
  respondido_em: string | null;
};

export function csvFormsTaxa(linhas: LinhaFormsTaxa[]): string {
  return csvDoc(
    [
      "formulario",
      "destinatario",
      "papel",
      "dupla",
      "origem",
      "emitido_em",
      "respondido",
      "respostas",
      "respondido_em",
    ],
    [...linhas]
      .sort(
        (a, b) =>
          ordem(a.formulario, b.formulario) ||
          ordem(a.destinatario, b.destinatario)
      )
      .map((l) => [
        l.formulario,
        l.destinatario,
        l.papel,
        l.dupla,
        l.origem,
        dataHora(l.emitido_em),
        l.respondido,
        String(l.respostas),
        dataHora(l.respondido_em),
      ])
  );
}
