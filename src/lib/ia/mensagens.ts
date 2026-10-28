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
