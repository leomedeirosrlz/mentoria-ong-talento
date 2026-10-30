// Roteador determinístico de tier de modelo (REALIZA-329) — heurística
// pura, sem chamada de rede: classifica a pergunta em rapido/balanceado/
// forte pelo formato, não por conteúdo semântico (sem LLM juiz — seria
// uma chamada a mais no caminho crítico). As regras são conservadoras:
// em dúvida, balanceado; errar pra baixo custa qualidade, errar pra cima
// custa latência — e latência é a métrica que o usuário sente.

export type TierModelo = "rapido" | "balanceado" | "forte";

const SAUDACAO =
  /^(oi+|ol[áa]|eai|eae|fala|bom dia|boa tarde|boa noite|obrigad[oa]|valeu|tchau|at[ée]|blz|beleza|show|top|por favor|pfv?|hey|hi|hello|opa|e a[íi]|como (vai|vc|voce|você|tá|esta|está))[\s!?.🙂👍]*$/i;

const PADRAO_COMPLEXO =
  /(analis|compar|relat[óo]rio|explique|detalhad|por qu[êe]|porque|estrat[ée]gi|resum[ao]|consolid|plan[oe]j|avalia[çc][ãa]o|revis[ãa]o|sugest[ãa]o|recomend|diagn[óo]st|prioriz|todas as|todos os|cruza|correlac|impacto|tend[êe]ncia|evolu[çc][ãa]o)/i;

/** Tier por pergunta. `opts.posTool` = a rodada já executou tool e o
 *  modelo vai sintetizar dados estruturados → piso balanceado (resposta
 *  com dados reais não pode ser o modelo raso). */
export function rotearTier(
  pergunta: string,
  opts: { posTool?: boolean } = {}
): TierModelo {
  const p = pergunta.trim();
  // saudação/conversa curta sem interrogação → o raso resolve e responde
  // na velocidade que a interação pede
  if (p.length < 60 && !p.includes("?") && SAUDACAO.test(p)) return "rapido";
  // síntese de dados reais ou pedido analítico → o forte paga a latência
  // em qualidade; mensagem longa do usuário também sinaliza contexto rico
  if (p.length > 300 || PADRAO_COMPLEXO.test(p)) return "forte";
  if (opts.posTool) return "balanceado";
  return "balanceado";
}
