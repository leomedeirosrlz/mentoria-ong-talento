// Contexto canônico dos cards "Perguntar à Liza" (REALIZA-456): recorte,
// agregados por aba e o hash que marca "desatualizado". Módulo puro — a
// página deriva o hash dos dados já renderizados e a action refaz a mesma
// derivação no banco antes de gravar; os dois lados têm de bater.
//
// Regra de privacidade (spec): o contexto é SÓ agregado — contagens, rótulos
// de enum e datas. Nome, nota, demanda, resumo_jornada ou qualquer texto
// livre de pessoa nunca entra aqui nem no prompt.

import type { MsgChat } from "@/lib/ia/provider";
import type {
  Janela,
  MedidaAdocao,
  ResumoAdocao,
  CelulaMatriz,
  LinhaCoorte,
} from "@/lib/adocao";
import {
  SUPERFICIES,
  PAPEIS_ADOCAO,
  ROTULO_PAPEL,
} from "@/lib/adocao";
import type { FunilInstrumento } from "./adocao";
import type { ResumoAderencia, ResumoEncerramento } from "./operacional";
import type {
  ItemAssinatura,
  ItemInteracao,
  ItemSolicitacao,
  ItemForms,
  DiaSaude,
} from "./dados";

// ---------- recorte canônico ----------

/** Os ids das abas do hub — vocabulário livre no banco (secao é text). */
export type AbaLiza =
  | "visao"
  | "aderencia"
  | "assinaturas"
  | "interacoes"
  | "solicitacoes"
  | "encerramento"
  | "formularios"
  | "adocao";

export const ABAS_LIZA: AbaLiza[] = [
  "visao",
  "aderencia",
  "assinaturas",
  "interacoes",
  "solicitacoes",
  "encerramento",
  "formularios",
  "adocao",
];

export const ABA_LIZA_ROTULO: Record<AbaLiza, string> = {
  visao: "Saúde",
  aderencia: "Aderência",
  assinaturas: "Assinaturas",
  interacoes: "Interações",
  solicitacoes: "Especialistas",
  encerramento: "Encerramento",
  formularios: "Formulários",
  adocao: "Adoção",
};

/** Recorte que identifica "o mesmo lugar" do card: os params que mudam os
 *  agregados da seção. turma/cronograma valem pras abas operacionais;
 *  janela/papel/medida só pra Adoção. */
export type RecorteLiza = {
  aba: AbaLiza;
  turma?: string | null;
  cronogramaId?: string | null;
  janela?: Janela | null;
  papel?: string | null;
  medida?: MedidaAdocao | null;
};

/** Chave estável do recorte — identidade da row vigente junto de `secao`.
 *  Campos sempre na mesma ordem, ausente = "". */
export function recorteKey(r: RecorteLiza): string {
  return [
    r.aba,
    r.turma ?? "",
    r.cronogramaId ?? "",
    r.aba === "adocao" ? (r.janela ?? "") : "",
    r.aba === "adocao" ? (r.papel ?? "") : "",
    r.aba === "adocao" ? (r.medida ?? "") : "",
  ].join("|");
}

/** Rótulo humano do recorte — exibido no card e gravado em `recorte`. */
export function recorteDescricao(r: RecorteLiza): Record<string, unknown> {
  const d: Record<string, unknown> = { aba: ABA_LIZA_ROTULO[r.aba] ?? r.aba };
  if (r.turma) d.turma = r.turma;
  if (r.cronogramaId) d.cronograma_id = r.cronogramaId;
  if (r.aba === "adocao") {
    if (r.janela) d.janela_dias = r.janela;
    if (r.papel) d.papel = ROTULO_PAPEL.get(r.papel) ?? r.papel;
    if (r.medida) d.medida = r.medida;
  }
  return d;
}

export function recorteTexto(r: RecorteLiza): string {
  const partes = [ABA_LIZA_ROTULO[r.aba] ?? r.aba];
  if (r.turma) partes.push(r.turma);
  if (r.cronogramaId) partes.push("cronograma do recorte");
  if (r.aba === "adocao") {
    if (r.janela) partes.push(`janela de ${r.janela} dias`);
    if (r.papel) partes.push(ROTULO_PAPEL.get(r.papel) ?? r.papel);
    if (r.medida === "gestos") partes.push("por gestos");
  }
  return partes.join(" · ");
}

// ---------- hash do contexto ----------

/** JSON canônico: chaves de objeto ordenadas recursivamente — o mesmo
 *  contexto serializa igual na página e na action. */
function canonico(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`)
    .join(",")}}`;
}

/** FNV-1a 32-bit com duas sementes sobre o JSON canônico → 16 hex. Não é
 *  segurança: é o fingerprint "os agregados mudaram?" — determinístico,
 *  barato e igual nos dois lados (sem BigInt: o target é < ES2020). */
export function contextoHash(contexto: unknown): string {
  const s = canonico(contexto);
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return fnv(0x811c9dc5) + fnv(0x811c9dc5 ^ 0x9e3779b9);
}

// ---------- agregados por aba ----------

/** Média de um campo nos últimos N dias com dado (0 sem dado). */
function mediaDias(t: DiaSaude[], campo: keyof Omit<DiaSaude, "dia">, n: number) {
  const fatia = t.slice(-n);
  if (!fatia.length) return 0;
  return Math.round((fatia.reduce((s, d) => s + d[campo], 0) / fatia.length) * 10) / 10;
}

export function contextoVisao(tendencia: DiaSaude[]): Record<string, unknown> {
  const ultimo = tendencia.at(-1) ?? null;
  return {
    dias_com_dados: tendencia.length,
    ultimo_dia: ultimo
      ? { dia: ultimo.dia, risco: ultimo.risco, atencao: ultimo.atencao, ok: ultimo.ok }
      : null,
    media_7d: {
      risco: mediaDias(tendencia, "risco", 7),
      atencao: mediaDias(tendencia, "atencao", 7),
      ok: mediaDias(tendencia, "ok", 7),
    },
    media_7d_anterior: {
      risco: mediaDias(tendencia.slice(0, -7), "risco", 7),
      atencao: mediaDias(tendencia.slice(0, -7), "atencao", 7),
      ok: mediaDias(tendencia.slice(0, -7), "ok", 7),
    },
  };
}

export function contextoAderencia(r: ResumoAderencia): Record<string, unknown> {
  const sinais: Record<string, number> = {};
  let comApoio = 0;
  for (const i of r.itens) {
    if (i.saude.apoio.aberto) comApoio++;
    for (const s of i.saude.sinais) sinais[s.tipo] = (sinais[s.tipo] ?? 0) + 1;
  }
  return {
    duplas_no_recorte: r.itens.length,
    saude: {
      risco: r.saude.risco,
      atencao: r.saude.atencao,
      em_dia: r.saude.emDia,
      pausadas: r.saude.pausadas,
      concluidas: r.saude.concluidas,
      encerradas: r.saude.encerradas,
    },
    encontros_devidos: r.esperados,
    realizados_no_prazo: r.realizadosNoPrazo,
    em_atraso: r.emAtraso,
    adiantados: r.adiantados,
    duplas_atras_do_calendario: r.atrasDoCalendario,
    duplas_registro_pendente: r.registrosPendentes,
    atraso_medio_registro_dias: r.atrasoMedioRegistro,
    remarcacoes: r.remarcacoes,
    fila_acao: r.fila.length,
    pedidos_apoio_abertos: comApoio,
    sinais,
  };
}

export function contextoAssinaturas(
  itens: ItemAssinatura[]
): Record<string, unknown> {
  const porStatus: Record<string, number> = {};
  const porDocumento: Record<string, number> = {};
  let maisAntiga: string | null = null;
  for (const i of itens) {
    porStatus[i.status] = (porStatus[i.status] ?? 0) + 1;
    const doc = i.linha.documento || "sem documento";
    porDocumento[doc] = (porDocumento[doc] ?? 0) + 1;
    if (!maisAntiga || i.linha.emitido_em < maisAntiga)
      maisAntiga = i.linha.emitido_em;
  }
  return {
    total: itens.length,
    por_status: porStatus,
    por_documento: porDocumento,
    mais_antiga_em: maisAntiga,
  };
}

export function contextoInteracoes(
  itens: ItemInteracao[]
): Record<string, unknown> {
  const porTipo: Record<string, number> = {};
  const porCanal: Record<string, number> = {};
  let ultima: string | null = null;
  for (const i of itens) {
    porTipo[i.tipo] = (porTipo[i.tipo] ?? 0) + 1;
    porCanal[i.canal] = (porCanal[i.canal] ?? 0) + 1;
    if (!ultima || i.linha.data > ultima) ultima = i.linha.data;
  }
  return {
    total: itens.length,
    por_tipo: porTipo,
    por_canal: porCanal,
    ultima_em: ultima,
  };
}

export function contextoSolicitacoes(
  itens: ItemSolicitacao[]
): Record<string, unknown> {
  const porStatus: Record<string, number> = {};
  let latSoma = 0;
  let latN = 0;
  for (const i of itens) {
    porStatus[i.statusEfetivo] = (porStatus[i.statusEfetivo] ?? 0) + 1;
    if (i.linha.latencia != null) {
      latSoma += i.linha.latencia;
      latN++;
    }
  }
  return {
    total: itens.length,
    por_status: porStatus,
    latencia_media_dias: latN ? Math.round((latSoma / latN) * 10) / 10 : null,
  };
}

export function contextoEncerramento(
  r: ResumoEncerramento
): Record<string, unknown> {
  const faltantes: Record<string, number> = {};
  for (const f of r.faltantes) faltantes[f.key] = f.n;
  return {
    total: r.total,
    concluidas: r.concluidas,
    encerradas: r.encerradas,
    pendentes: r.pendentes.length,
    decididos: r.decididos.length,
    mais_antigo_dias: r.maisAntigoDias,
    checklist_faltante: faltantes,
  };
}

export function contextoFormularios(
  itens: ItemForms[]
): Record<string, unknown> {
  const porFormulario: Record<string, number> = {};
  const porOrigem: Record<string, number> = {};
  let respondidos = 0;
  for (const i of itens) {
    if (i.respondido) respondidos++;
    const f = i.linha.formulario || "sem título";
    porFormulario[f] = (porFormulario[f] ?? 0) + 1;
    porOrigem[i.origem] = (porOrigem[i.origem] ?? 0) + 1;
  }
  return {
    total: itens.length,
    respondidos,
    pendentes: itens.length - respondidos,
    taxa_resposta_pct: itens.length
      ? Math.round((respondidos / itens.length) * 100)
      : null,
    por_origem: porOrigem,
    por_formulario: porFormulario,
  };
}

export function contextoAdocao({
  resumo,
  celulas,
  coorte,
  funil,
  janela,
  papel,
  medida,
}: {
  resumo: ResumoAdocao;
  celulas: CelulaMatriz[];
  coorte: LinhaCoorte[];
  funil: FunilInstrumento[];
  janela: Janela;
  papel: string | null;
  medida: MedidaAdocao;
}): Record<string, unknown> {
  const celulasRecorte = papel ? celulas.filter((c) => c.papel === papel) : celulas;
  const usadas = new Set(
    celulasRecorte.filter((c) => c.pessoas > 0 || c.gestos > 0).map((c) => c.superficie)
  );
  const semUso = PAPEIS_ADOCAO.filter(
    (p) => p.id !== "desconhecido" && !celulas.some((c) => c.papel === p.id && (c.pessoas > 0 || c.gestos > 0))
  ).map((p) => p.rotulo);
  const emitidos = funil.filter((f) => !f.campanha).reduce((s, f) => s + f.emitidos, 0);
  const respondidos = funil.filter((f) => !f.campanha).reduce((s, f) => s + f.respondidos, 0);
  // retenção média da semana 1 das coortes com total observável
  const w1 = coorte.filter((c) => c.semana === 1 && c.total > 0);
  const retencaoW1 = w1.length
    ? Math.round((w1.reduce((s, c) => s + c.ativas / c.total, 0) / w1.length) * 100)
    : null;
  return {
    janela_dias: janela,
    papel_recorte: papel ? (ROTULO_PAPEL.get(papel) ?? papel) : "todos",
    medida,
    pessoas_ativas: resumo.ativas,
    pessoas_ativas_janela_anterior: resumo.ativas_prev,
    gestos: resumo.gestos,
    gestos_janela_anterior: resumo.gestos_prev,
    superficies_vivas: usadas.size,
    superficies_paradas: SUPERFICIES.filter((s) => !usadas.has(s.id)).map((s) => s.rotulo),
    papeis_sem_uso: semUso,
    instrumentos: {
      emitidos,
      respondidos,
      taxa_resposta_pct: emitidos ? Math.round((respondidos / emitidos) * 100) : null,
    },
    retencao_semana1_pct: retencaoW1,
  };
}

// ---------- prompt ----------

/** Versão do contrato do prompt — vai pro args do evento (auditoria sabe
 *  que formato gerou a resposta). */
export const PROMPT_RELATORIO_V = "relatorio-ia@1";

export const PERGUNTA_PADRAO =
  "O que esta seção está me dizendo? O que pede ação agora?";

const PROMPT_SISTEMA = `Você é a Liza, assistente da coordenação do Realiza, um programa de mentoria entre adultos e adolescentes.

Você responde perguntas sobre RELATÓRIOS OPERACIONAIS. Sua única fonte são os agregados estruturados enviados junto da pergunta (contagens, percentuais, datas e rótulos de categorias).

Regras:
- Responda em português brasileiro, em markdown simples (parágrafos, listas e **negrito**).
- Fale só o que os agregados sustentam: cite os números e os denominadores que embasam cada afirmação.
- Se os agregados não respondem a pergunta, diga isso com honestidade em vez de inventar.
- Proponha 1 a 3 próximos passos concretos para a coordenação, ligados aos achados.
- Não use travessão. Frases curtas e diretas.
- Não invente nomes, pessoas ou casos individuais: os agregados não os contêm.
- Até 250 palavras.`;

export function promptLiza({
  secao,
  recorte,
  contexto,
  pergunta,
}: {
  secao: string;
  recorte: string;
  contexto: Record<string, unknown>;
  pergunta: string;
}): MsgChat[] {
  return [
    { role: "system", content: PROMPT_SISTEMA },
    {
      role: "user",
      content: `Seção do relatório: ${secao}\nRecorte: ${recorte}\n\nAgregados da seção (JSON):\n${JSON.stringify(contexto)}\n\nPergunta da coordenação: ${pergunta}`,
    },
  ];
}
