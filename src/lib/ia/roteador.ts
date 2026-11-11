// Roteador determinístico de tier de modelo (REALIZA-329/299) — heurística
// pura, sem chamada de rede: classifica a rodada em rapido/balanceado/
// forte por tarefa × papel, com a tarefa derivada do formato da mensagem
// (não do conteúdo semântico — sem LLM juiz, que seria uma chamada a mais
// no caminho crítico). As regras são conservadoras: em dúvida, balanceado;
// errar pra baixo custa qualidade, errar pra cima custa latência — e
// latência é a métrica que o usuário sente.

import type { AppRole } from "@/lib/types";

export type TierModelo = "rapido" | "balanceado" | "forte";

/** Tarefa da rodada (REALIZA-299) — enum concreto derivado no caller, sem
 *  classificador: saudação curta, leitura de dados (default), análise
 *  complexa ou síntese pós-tool. Vai pro args.roteador da auditoria. */
export type TarefaIa = "saudacao" | "leitura" | "analise" | "sintese";

const SAUDACAO =
  /^(oi+|ol[áa]|eai|eae|fala|bom dia|boa tarde|boa noite|obrigad[oa]|valeu|tchau|at[ée]|blz|beleza|show|top|por favor|pfv?|hey|hi|hello|opa|e a[íi]|como (vai|vc|voce|você|tá|esta|está))[\s!?.🙂👍]*$/i;

// domínio do programa — mensagem curta MENCIONANDO domínio não é
// saudação mesmo sem "?" ("encontro 12", "dupla da maria")
const DOMINIO =
  /\b(dupla|encontro|semana|guia|program|mentor|agenda|chamad|avalia|registr|pdm|roda|meta|jovem|turma|formul|instrument|parear|fila|supervis|coord|whatsapp|relat[óo]ri)/i;

const PADRAO_COMPLEXO =
  /(analis|compar|relat[óo]rio|explique|detalhad|por qu[êe]|porque|estrat[ée]gi|resum[ao]|consolid|plan[oe]j|avalia[çc][ãa]o|revis[ãa]o|sugest[ãa]o|recomend|diagn[óo]st|prioriz|todas as|todos os|cruza|correlac|impacto|tend[êe]ncia|evolu[çc][ãa]o)/i;

/** Papéis com teto `forte` — staff analítico (coordenação e supervisor).
 *  Mentor e jovem ficam capados no balanceado: o escopo deles é a própria
 *  dupla, então `forte` só pagaria latência/custo sem dados pra sintetizar. */
const PAPEIS_STAFF: readonly AppRole[] = ["coordenacao", "supervisor"];

/** Tarefa da pergunta por formato — mesma régua do tier, exposta pro
 *  caller derivar uma vez e auditar (args.roteador.tarefa) sem re-rodar a
 *  classificação. `posTool` marca a rodada de síntese independente do
 *  texto: a próxima resposta fala sobre dados reais, não sobre a
 *  mensagem curta que disparou a tool. */
export function tarefaDaPergunta(
  pergunta: string,
  opts: { posTool?: boolean } = {}
): TarefaIa {
  const p = pergunta.trim();
  if (opts.posTool) return "sintese";
  if (
    p.length < 60 &&
    !p.includes("?") &&
    (SAUDACAO.test(p) || (p.length < 25 && !DOMINIO.test(p)))
  )
    return "saudacao";
  if (p.length > 300 || PADRAO_COMPLEXO.test(p)) return "analise";
  return "leitura";
}

/** Papel que decide o teto quando há vários (híbrido DPP+especialista):
 *  staff primeiro — é ele que libera `forte`; sem staff, o primeiro da
 *  lista. Ausente/desconhecido devolve null = não-staff (fail-closed: sem
 *  prova de staff não há tier caro). É o valor gravado em
 *  args.roteador.papel — a auditoria lê exatamente o papel que embasou a
 *  decisão. */
export function papelDecisivo(
  papel: AppRole | AppRole[] | null | undefined
): AppRole | null {
  const lista = Array.isArray(papel) ? papel : papel ? [papel] : [];
  return lista.find((p) => PAPEIS_STAFF.includes(p)) ?? lista[0] ?? null;
}

/** Tier da rodada = tarefa × papel (matriz REALIZA-299):
 *      tarefa   | staff      | demais (incl. sem papel)
 *      saudacao | rapido     | rapido
 *      leitura  | balanceado | balanceado
 *      analise  | forte      | balanceado  ← cap não-staff
 *      sintese  | balanceado | balanceado
 *  `papel` aceita o array de papéis efetivos — qualquer staff libera o
 *  `forte`. `opts.tarefa` explícita (derivada no caller) ganha da
 *  derivação por formato. `posTool` é piso estrutural, não tarefa:
 *  síntese de dados reais nunca desce pro raso, nem com `tarefa`
 *  explícita contraditória. */
export function rotearTier(
  pergunta: string,
  opts: {
    posTool?: boolean;
    papel?: AppRole | AppRole[] | null;
    tarefa?: TarefaIa;
  } = {}
): TierModelo {
  const tarefa =
    opts.tarefa ?? tarefaDaPergunta(pergunta, { posTool: opts.posTool });
  const decisivo = papelDecisivo(opts.papel);
  const staff = decisivo !== null && PAPEIS_STAFF.includes(decisivo);
  const tier: TierModelo =
    tarefa === "saudacao"
      ? "rapido"
      : tarefa === "analise" && staff
        ? "forte"
        : "balanceado";
  if (opts.posTool && tier === "rapido") return "balanceado";
  return tier;
}
