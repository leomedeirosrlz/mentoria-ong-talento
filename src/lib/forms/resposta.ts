// Coleta e validação de respostas do /f/<token> — camada pura
// compartilhada pelo renderer genérico (inputs não-controlados lidos via
// FormData) e pelos instrumentos sob medida (estado controlado). As duas
// experiências convergem aqui pra nunca divergirem de regra: a fronteira
// real continua sendo a RPC, isto é o espelho de UX.

import {
  CAMPO_FORMATO_ERRO,
  campoFormato,
  type FormularioCampo,
  type RespostaValor,
} from "./schema";
import {
  normalizaData,
  normalizaPorFormato,
  normalizaTexto,
  type NormResult,
} from "./normaliza";

/** Tipos com teclado de texto — recebem enterKeyHint; o último deles leva
 *  "send" (fecha o teclado e envia em vez de saltar pra lugar nenhum). */
export const TIPOS_COM_ENTER: readonly FormularioCampo["tipo"][] = [
  "texto",
  "texto_longo",
  "data",
];

/** Banner de validação client-side — em constante pra distinguir de erro
 *  de servidor/rede: o banner de validação some assim que o último campo
 *  marcado é corrigido; o de servidor só sai no próximo submit. */
export const ERRO_VALIDACAO = "Revise os campos marcados antes de enviar.";

/** Lê o valor bruto de um campo — abstração pra FormData (renderer
 *  genérico) e pro mapa de valores controlados (instrumentos). */
export type LeCampo = (c: FormularioCampo) => unknown;

/** Leitura a partir de um <form> não-controlado. */
export function leDeFormData(fd: FormData): LeCampo {
  return (c) =>
    c.tipo === "multi_select"
      ? fd.getAll(c.id).map(String)
      : c.tipo === "checkbox"
        ? fd.get(c.id) === "on"
        : fd.get(c.id);
}

/** Leitura a partir do estado controlado (instrumentos sob medida). */
export function leDeValores(
  valores: Record<string, RespostaValor>
): LeCampo {
  return (c) => valores[c.id];
}

/** O campo tem resposta — usado pelo progresso e pra limpar erro assim
 *  que a pessoa corrige (sem esperar novo submit). Aceita o valor bruto
 *  das duas fontes: FormDataEntryValue ("on" no checkbox) ou RespostaValor. */
export function campoRespondido(c: FormularioCampo, v: unknown): boolean {
  if (c.tipo === "multi_select") return Array.isArray(v) && v.length > 0;
  if (c.tipo === "checkbox") return v === true || v === "on";
  return v != null && String(v).trim() !== "";
}

/** Normalização da resposta na entrada (REALIZA-118): campo 'texto' com
 *  `formato` declarado passa pelo normalizador do formato; 'data' aceita
 *  dd/mm/aaaa além do ISO que o input nativo já manda; o resto é trim.
 *  O que sai daqui é o que a RPC recebe — gravado já normalizado. */
export function normalizaResposta(c: FormularioCampo, v: string): NormResult {
  const f = campoFormato(c);
  if (f) return normalizaPorFormato(f, v);
  if (c.tipo === "data") return normalizaData(v);
  return normalizaTexto(v);
}

/** Coleta + normalização num passe só. `falhas` marca o campo cuja
 *  resposta veio preenchida mas não resgatou — o validador transforma
 *  isso em erro de formato só quando o campo é obrigatório (no opcional
 *  ela simplesmente não é gravada: a submissão não morre por ele). */
export function coletaRespostas(
  perguntas: FormularioCampo[],
  le: LeCampo
): {
  respostas: Record<string, RespostaValor>;
  falhas: Set<string>;
} {
  const respostas: Record<string, RespostaValor> = {};
  const falhas = new Set<string>();
  for (const c of perguntas) {
    const bruto = le(c);
    switch (c.tipo) {
      case "multi_select": {
        const itens = (Array.isArray(bruto) ? bruto : [])
          .map(String)
          .filter(Boolean);
        if (itens.length) respostas[c.id] = itens;
        break;
      }
      case "checkbox":
        respostas[c.id] = bruto === true || bruto === "on";
        break;
      case "escala_1_5":
      case "escala_1_10": {
        if (bruto != null && bruto !== "") respostas[c.id] = Number(bruto);
        break;
      }
      default: {
        const v = String(bruto ?? "").trim();
        if (!v) break;
        const r = normalizaResposta(c, v);
        if (r.valor) respostas[c.id] = r.valor;
        else falhas.add(c.id);
      }
    }
  }
  return { respostas, falhas };
}

/** Espelho client-side das regras do servidor, um erro por campo — a RPC
 *  continua sendo a fronteira real, aqui a resposta é imediata. */
export function validaRespostas(
  perguntas: FormularioCampo[],
  respostas: Record<string, RespostaValor>,
  falhas: Set<string>
): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const c of perguntas) {
    if (!c.obrigatorio) continue;
    const v = respostas[c.id];
    if (c.tipo === "checkbox") {
      if (v !== true) mapa[c.id] = "Marque a caixa pra continuar.";
    } else if (falhas.has(c.id)) {
      // respondeu algo, mas não vira o formato — erro de formato é mais
      // honesto que "responda esta pergunta" (a pessoa já respondeu)
      const f = campoFormato(c);
      mapa[c.id] =
        c.tipo === "data"
          ? "Use uma data válida (dd/mm/aaaa)."
          : f
            ? CAMPO_FORMATO_ERRO[f]
            : "Responda esta pergunta.";
    } else if (v == null || v === "" || (Array.isArray(v) && !v.length)) {
      mapa[c.id] =
        c.tipo === "multi_select"
          ? "Marque ao menos uma opção."
          : TIPOS_COM_ENTER.includes(c.tipo)
            ? "Responda esta pergunta."
            : "Escolha uma opção.";
    }
  }
  return mapa;
}
