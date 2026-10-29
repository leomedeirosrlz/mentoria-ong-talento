/** Payload do POST /api/ia/chat (REALIZA-283): o body é `.strict()` na
 *  rota — só `role`/`content` passam. Campos de UI (`estado`, `tools`)
 *  que o estado da conversa carrega derrubam o parse com "Pedido
 *  inválido"; bolha vazia idem (min 1). O cap de 20 mensagens da rota
 *  vale pro histórico inteiro — mantém as mais recentes. */
export type MsgEnvio = { role: "user" | "assistant"; content: string };

export function montarEnvioChat<T extends { role: string; content: string }>(
  msgs: T[]
): MsgEnvio[] {
  return msgs
    .filter(
      (m): m is T & { role: "user" | "assistant" } =>
        (m.role === "user" || m.role === "assistant") && !!m.content
    )
    .slice(-20)
    .map(({ role, content }) => ({ role, content }));
}

/** Links internos do texto viram chips de ação sob a resposta
 *  (REALIZA-286): o modelo emite [rótulo](/rota) no markdown e a bolha
 *  renderiza o link + um chip "ir para" por destino (máx. 3). */
const LINK_INTERNO = /\[([^\]]+)\]\((\/[^)\s]+)\)/g;

export function extrairAcoes(texto: string): { rotulo: string; href: string }[] {
  const acoes: { rotulo: string; href: string }[] = [];
  const vistos = new Set<string>();
  for (const m of texto.matchAll(LINK_INTERNO)) {
    const href = m[2];
    // /materiais/ é citação de guia — vai pra fileira "Fontes" (render.ts),
    // não pra chip de ação, senão o mesmo link renderiza duas vezes
    if (href.startsWith("/materiais/")) continue;
    if (vistos.has(href) || acoes.length >= 3) continue;
    vistos.add(href);
    acoes.push({ rotulo: m[1], href });
  }
  return acoes;
}

/** Erro → frase amigável (REALIZA-284). A rota já manda mensagens
 *  prontas no JSON — mas fetch quebrado (TypeError), redirect pro login
 *  e status de gate chegam sem texto útil. */
export function msgAmigavel(e: unknown, status: number, fallback: string): string {
  if (
    e instanceof TypeError ||
    (typeof navigator !== "undefined" && navigator.onLine === false)
  )
    return "Sem conexão — verifique sua internet e tente de novo.";
  if (status === 429)
    return "Muitas perguntas em sequência — aguarde um instante e tente de novo.";
  if (status === 401 || status === 403)
    return "Sua sessão expirou — entre de novo pelo login.";
  if (status === 503)
    return "O assistente está indisponível agora — tente de novo em alguns minutos.";
  return e instanceof Error && e.message ? e.message : fallback;
}
