import type { Notificacao } from "./types";

/** 027 (FR-011b / FR-012): vários mints guardam no corpo a frase que
 *  responde "o quê, de quem" e deixam o título genérico ("Sugestão
 *  confirmada", "Novo pedido de sessão"). A guarda da 0019 torna a row
 *  imutável depois de criada, então a leitura promove a frase do corpo pro
 *  título — a cauda depois do separador segue como corpo (o próximo passo).
 *  Pares (tipo|título) fora da lista passam intocados e um corpo que não
 *  bate no formato esperado não é reescrito (fail-safe). A correção na
 *  mint é alçada do lead — sugestão em
 *  docs/planos/issues/_recon/privacidade-sql-sugerido.md.
 *  Módulo puro (sem I/O): serve getNotificacoes, listarNotificacoes e a
 *  demo (paridade). */

type Corte = "emdash" | "frase" | "mural";

const AMBIGUOS = new Map<string, Corte>([
  // 0086 — confirmar/dispensar sugestão e trilha
  ["solicitacao_registrada|Sugestão confirmada", "emdash"],
  ["solicitacao_cancelada|Sugestão dispensada", "frase"],
  ["devolutiva_especialista|Nova devolutiva da trilha", "frase"],
  // 0074/0087/0158 — fluxo de solicitação de especialista
  ["solicitacao_registrada|Pedido de especialista em aberto", "mural"],
  ["solicitacao_registrada|Pedido de especialista registrado", "frase"],
  ["solicitacao_registrada|Pedido liberado", "frase"],
  ["solicitacao_triagem|Pedido de especialista pra triagem", "emdash"],
  ["solicitacao_recusada|Pedido de especialista recusado", "frase"],
  ["solicitacao_cancelada|Pedido de especialista cancelado", "frase"],
  ["solicitacao_proposta|Nova proposta de horário", "frase"],
  ["demanda_especialista|Novo pedido de sessão", "frase"],
  ["demanda_especialista|Novo pedido de mentoria especializada", "frase"],
  ["especialista_aceitou|Especialista confirmado", "frase"],
  ["especialista_aceitou|Pedido de especialista aceito", "emdash"],
  ["especialista_aceitou|Proposta aceita", "emdash"],
  // fan-outs pra coord/supervisor — o "de quem" mora no corpo
  ["formulario_respondido|Resposta de formulário", "frase"],
  ["terceiro_respondeu|Resposta de avaliação por terceiros", "frase"],
  ["terceiro_respondeu|Resposta de terceiros registrada", "frase"],
  ["plano_intervencao|Intervenção sugerida pela Liza", "emdash"],
  ["dupla_formada|Dupla concluiu a jornada", "emdash"],
  ["dupla_reta_final|Dupla na reta final", "emdash"],
]);

function capitalizar(s: string): string {
  return s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1);
}

/** Devolve { titulo, corpo } reescritos, ou null quando o corpo não bate
 *  no formato mintado (a row segue como está). */
export function reescreveTitulo(
  tipo: string,
  titulo: string,
  corpo: string | null
): { titulo: string; corpo: string | null } | null {
  const corte = AMBIGUOS.get(`${tipo}|${titulo}`);
  if (!corte || !corpo?.trim()) return null;
  const texto = corpo.trim();
  if (corte === "mural") {
    const m = texto.match(/^(.*?)(?:\s+—\s+|\.\s+)o mural decide\.?\s*$/i);
    if (!m || !m[1].trim()) return null;
    return { titulo: m[1].trim(), corpo: "O mural decide." };
  }
  if (corte === "emdash") {
    const i = texto.indexOf(" — ");
    if (i > 0 && i < texto.length - 3) {
      const cabeca = texto.slice(0, i).trim().replace(/\.$/, "");
      const cauda = capitalizar(texto.slice(i + 3).trim());
      if (cabeca && cauda) return { titulo: cabeca, corpo: cauda };
    }
    // sem a cauda, cai pro caso "frase" — promove o corpo inteiro
  }
  const cabeca = texto.replace(/\.$/, "");
  return cabeca ? { titulo: cabeca, corpo: null } : null;
}

/** Aplica a promoção de título na lista inteira (lida do banco ou demo). */
export function relerTitulosNotificacao(
  itens: Notificacao[]
): Notificacao[] {
  return itens.map((n) => {
    const novo = reescreveTitulo(n.tipo, n.titulo, n.corpo);
    return novo ? { ...n, ...novo } : n;
  });
}
