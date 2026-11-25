const CAPACIDADES =
  "duplas de mentoria, encontros e agenda, registros, materiais e instrumentos do programa, chamados e pessoas";

/** `instructions` do initialize MCP (spec): o cliente que conecta já recebe
 *  o contexto de uso sem precisar do prompt copiado. */
export const MCP_INSTRUCOES =
  `Servidor MCP do Realiza.vc, a plataforma do Programa de Mentoria — as ferramentas consultam e agem sobre ${CAPACIDADES}, sempre com o papel e as permissões do dono do token. Leituras são diretas; escritas passam por uma prévia antes de executar.`;

/** Prompt pronto pra colar num cliente de IA (Claude, ChatGPT, Cursor):
 *  contexto do que o MCP expõe + endpoint + Bearer com o token embutido
 *  (ou placeholder — o token cru só existe no card de criação). */
export function promptMcp(origem: string, token?: string | null): string {
  const bearer = `Bearer ${token ?? "<seu-token-rlz_mcp>"}`;
  return `Você tem acesso ao servidor MCP do Realiza.vc, a plataforma do Programa de Mentoria — as ferramentas dele consultam e agem sobre ${CAPACIDADES}, sempre com o meu papel e as minhas permissões. Leituras são diretas; escritas passam por uma prévia antes de executar.

Endpoint (Streamable HTTP, JSON-RPC 2.0):
POST ${origem}/api/mcp
Authorization: ${bearer}

Configuração de cliente MCP (Claude Desktop, Cursor e afins):
{
  "mcpServers": {
    "realiza": {
      "url": "${origem}/api/mcp",
      "headers": { "Authorization": "${bearer}" }
    }
  }
}`;
}
