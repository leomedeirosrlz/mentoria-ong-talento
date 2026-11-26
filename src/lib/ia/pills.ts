// Catálogo e baralho das sugestões do empty state da Liza (spec 026,
// FR-011/012/013): 6–8 perguntas por contexto (papel × página), cada uma
// mapeada 1:1 na tool do registry que responde de fato — a pill nunca
// promete o que o papel não tem na allowlist. O sorteio roda uma vez por
// visita (mount do grupo no painel): lote de 3 sem repetição até esgotar
// o catálogo; esgotado, o baralho reseta junto com os clicados.
//
// Módulo puro: storage e rng entram por parâmetro, então o teste cobre
// o deck inteiro sem DOM. O caller injeta Math.random e o localStorage;
// qualquer falha de acesso degrada pro catálogo inteiro da visita, nunca
// quebra o empty state.

import type { IaToolNome } from "@/lib/ia/tools";
import type { AppRole } from "@/lib/types";

/** Papéis com grant de cada tool citada no catálogo — espelho do `roles`
 *  do IA_TOOLS. Duplicado de propósito: o registry é servidor (importá-lo
 *  no client arrastaria queries/crypto pro bundle da bolha), então o
 *  teste (tests/ia-pills.test.ts) cruza cada entrada com a fonte real —
 *  drift de roles ou nome inexistente quebra o CI, não a promessa da pill. */
export const PILLS_TOOL_ROLES = {
  agenda_do_periodo: [
    "coordenacao",
    "supervisor",
    "mentor_dpp",
    "mentor_especialista",
  ],
  aguardando_par: ["coordenacao"],
  ajuda_faq: ["mentorado"],
  capacidade_mentores: ["coordenacao"],
  chamados_resumo: [
    "coordenacao",
    "supervisor",
    "mentor_dpp",
    "mentor_especialista",
    "mentorado",
  ],
  combinados_das_duplas: [
    "coordenacao",
    "supervisor",
    "mentor_dpp",
    "mentor_especialista",
  ],
  duplas_do_usuario: [
    "coordenacao",
    "supervisor",
    "mentor_dpp",
    "mentor_especialista",
  ],
  encontros_retroativo: ["mentorado"],
  ficha_dupla: [
    "coordenacao",
    "supervisor",
    "mentor_dpp",
    "mentor_especialista",
    "mentorado",
  ],
  guia_consulta: [
    "coordenacao",
    "supervisor",
    "mentor_dpp",
    "mentor_especialista",
    "mentorado",
  ],
  historico_encontros: [
    "coordenacao",
    "supervisor",
    "mentor_dpp",
    "mentor_especialista",
  ],
  instrumentos_da_dupla: [
    "coordenacao",
    "supervisor",
    "mentor_dpp",
    "mentor_especialista",
    "mentorado",
  ],
  mensagem_template: [
    "coordenacao",
    "supervisor",
    "mentor_dpp",
    "mentor_especialista",
  ],
  meu_progresso: ["mentorado"],
  meus_combinados: ["mentorado"],
  meus_pedidos: ["mentorado"],
  minha_agenda: ["mentorado"],
  minha_dupla: ["mentorado"],
  pessoas_agregado: ["coordenacao", "supervisor"],
  plano_em_dia: ["coordenacao", "supervisor", "mentor_dpp"],
  registros_da_dupla: [
    "coordenacao",
    "supervisor",
    "mentor_dpp",
    "mentor_especialista",
  ],
  resumo_dupla: [
    "coordenacao",
    "supervisor",
    "mentor_dpp",
    "mentor_especialista",
    "mentorado",
  ],
  resumo_semana: ["coordenacao", "supervisor"],
} satisfies Partial<Record<IaToolNome, readonly AppRole[]>>;

export type PillTool = keyof typeof PILLS_TOOL_ROLES;

/** Uma sugestão do catálogo: o texto do chip (pergunta que a pessoa
 *  escreveria — ≤60, pt-BR, sem travessão) e a tool que a responde.
 *  `papeis` é o recorte da PERGUNTA, quando mais estreito que o da tool:
 *  "Quantos chamados abertos?" é pergunta de equipe — o mentor tem grant
 *  em chamados_resumo, mas a tool dele devolve só os pedidos dele, não a
 *  fila da operação. Ausente = a pergunta vale pra quem tem grant. */
export type Pill = {
  texto: string;
  tool: PillTool;
  papeis?: readonly AppRole[];
};

// ---------- catálogo por contexto ----------
// Ordem interna = relevância pra página (o chip do balão usa a primeira).
// O filtro de roles roda no `catalogo`, então cada lista pode citar tools
// que só um subconjunto dos papéis do contexto tem — elas simplesmente não
// entram pra quem não tem grant (especialista nunca vê plano_em_dia).

const JOVEM_GENERICO: Pill[] = [
  { texto: "O que tenho pra fazer?", tool: "meus_combinados" },
  { texto: "Como tá minha jornada?", tool: "meu_progresso" },
  { texto: "Quem é meu mentor?", tool: "minha_dupla" },
  { texto: "Quando é o próximo encontro?", tool: "minha_agenda" },
  { texto: "O que é o PDM?", tool: "ajuda_faq" },
  { texto: "E meu pedido de especialista?", tool: "meus_pedidos" },
  { texto: "Como funciona o programa?", tool: "ajuda_faq" },
];

const JOVEM_AGENDA: Pill[] = [
  { texto: "Quando é o próximo encontro?", tool: "minha_agenda" },
  { texto: "Tive encontro essa semana?", tool: "minha_agenda" },
  { texto: "Nos encontramos sem agendar, e agora?", tool: "encontros_retroativo" },
  { texto: "O que tenho pra fazer?", tool: "meus_combinados" },
  { texto: "Posso remarcar um encontro?", tool: "ajuda_faq" },
  { texto: "O que é o PDM?", tool: "ajuda_faq" },
  { texto: "Como tá minha jornada?", tool: "meu_progresso" },
];

const JOVEM_ESPECIALISTAS: Pill[] = [
  { texto: "E meu pedido de especialista?", tool: "meus_pedidos" },
  { texto: "Como funciona o especialista?", tool: "ajuda_faq" },
  { texto: "Como tá minha jornada?", tool: "meu_progresso" },
  { texto: "O que tenho pra fazer?", tool: "meus_combinados" },
  { texto: "Quem é meu mentor?", tool: "minha_dupla" },
  { texto: "Quando é o próximo encontro?", tool: "minha_agenda" },
  { texto: "O que diz o guia sobre especialistas?", tool: "guia_consulta" },
];

const JOVEM_MATERIAIS: Pill[] = [
  { texto: "O que é o PDM?", tool: "ajuda_faq" },
  { texto: "O que diz o guia sobre a Roda da Vida?", tool: "guia_consulta" },
  { texto: "O que tenho pra fazer?", tool: "meus_combinados" },
  { texto: "Como tá minha jornada?", tool: "meu_progresso" },
  { texto: "Quando é o próximo encontro?", tool: "minha_agenda" },
  { texto: "Quem é meu mentor?", tool: "minha_dupla" },
  { texto: "Como funciona o programa?", tool: "ajuda_faq" },
];

// ficha de staff — mentorado puro nunca alcança esta rota; híbrido
// (mentorado + papel de equipe) lê as pills de equipe
const FICHA_DUPLA: Pill[] = [
  { texto: "Resuma esta dupla", tool: "resumo_dupla" },
  { texto: "O que falta registrar?", tool: "registros_da_dupla" },
  { texto: "Escreva um lembrete pra dupla", tool: "mensagem_template" },
  { texto: "Como esta dupla fica em dia?", tool: "plano_em_dia" },
  { texto: "Quais instrumentos ela já respondeu?", tool: "instrumentos_da_dupla" },
  { texto: "Tem combinado vencido?", tool: "combinados_das_duplas" },
  { texto: "Tem chamado aberto?", tool: "chamados_resumo" },
  { texto: "Quando é o próximo encontro dela?", tool: "ficha_dupla" },
];

const AGENDA_STAFF: Pill[] = [
  { texto: "Encontros desta semana", tool: "agenda_do_periodo" },
  { texto: "Alguém sem encontro marcado?", tool: "resumo_semana" },
  { texto: "Escreva um lembrete pra dupla", tool: "mensagem_template" },
  { texto: "Como foi a semana passada?", tool: "historico_encontros" },
  { texto: "Tem combinado vencido?", tool: "combinados_das_duplas" },
  // a fila de chamados é recorte de equipe — pro mentor a tool devolve
  // só os pedidos dele, e a promessa da pill era a contagem da operação
  {
    texto: "Quantos chamados abertos?",
    tool: "chamados_resumo",
    papeis: ["coordenacao", "supervisor"],
  },
  { texto: "Como está minha dupla?", tool: "resumo_dupla" },
  { texto: "O que diz o guia sobre remarcação?", tool: "guia_consulta" },
];

const DUPLAS_STAFF: Pill[] = [
  { texto: "Quem está em risco?", tool: "resumo_semana" },
  { texto: "Quem pediu apoio?", tool: "chamados_resumo" },
  { texto: "Resumo da semana", tool: "resumo_semana" },
  { texto: "Quem tá esperando par?", tool: "aguardando_par" },
  { texto: "Tem combinado vencido?", tool: "combinados_das_duplas" },
  { texto: "Quantos encontros rolaram no mês?", tool: "historico_encontros" },
  { texto: "O que diz o guia sobre a Roda da Vida?", tool: "guia_consulta" },
];

// página dos guias — todas as perguntas caem na guia_consulta (tool de
// todos os papéis), então o contexto nunca fica sem lote por filtro
const MATERIAIS: Pill[] = [
  { texto: "O que diz o guia sobre a Roda da Vida?", tool: "guia_consulta" },
  { texto: "Como dar um feedback construtivo?", tool: "guia_consulta" },
  { texto: "O que é o PDM?", tool: "guia_consulta" },
  { texto: "Como funciona a reposição de encontro?", tool: "guia_consulta" },
  { texto: "O que o guia diz sobre formação?", tool: "guia_consulta" },
  { texto: "Quais guias existem?", tool: "guia_consulta" },
  { texto: "O que diz o guia sobre o especialista?", tool: "guia_consulta" },
];

const COORD_GENERICO: Pill[] = [
  { texto: "Resumo da semana", tool: "resumo_semana" },
  { texto: "Quem está aguardando par?", tool: "aguardando_par" },
  { texto: "Quem tem vaga pra parear?", tool: "capacidade_mentores" },
  { texto: "Encontros desta semana", tool: "agenda_do_periodo" },
  {
    texto: "Quantos chamados abertos?",
    tool: "chamados_resumo",
    papeis: ["coordenacao", "supervisor"],
  },
  { texto: "Como foi o último mês de encontros?", tool: "historico_encontros" },
  { texto: "O que diz o guia sobre a Roda da Vida?", tool: "guia_consulta" },
];

const SUPERVISOR_GENERICO: Pill[] = [
  { texto: "Resumo da semana", tool: "resumo_semana" },
  { texto: "Alguma dupla minha pede atenção?", tool: "resumo_semana" },
  { texto: "Encontros desta semana", tool: "agenda_do_periodo" },
  { texto: "Tem combinado vencido?", tool: "combinados_das_duplas" },
  { texto: "Escreva um lembrete pra dupla", tool: "mensagem_template" },
  {
    texto: "Quantos chamados abertos?",
    tool: "chamados_resumo",
    papeis: ["coordenacao", "supervisor"],
  },
  { texto: "Como foi o último mês de encontros?", tool: "historico_encontros" },
];

// mentor (DPP, especialista ou híbrido) e fallback geral — só tools que
// os dois papeis de mentor têm, então a filtragem não encolhe o lote
const MENTOR_PADRAO: Pill[] = [
  { texto: "Como está minha dupla?", tool: "resumo_dupla" },
  { texto: "Quais são minhas duplas?", tool: "duplas_do_usuario" },
  { texto: "Próximos encontros", tool: "agenda_do_periodo" },
  { texto: "Tem combinado vencido?", tool: "combinados_das_duplas" },
  { texto: "Escreva um lembrete pra dupla", tool: "mensagem_template" },
  {
    texto: "Quantos chamados abertos?",
    tool: "chamados_resumo",
    papeis: ["coordenacao", "supervisor"],
  },
  { texto: "O que é o PDM?", tool: "guia_consulta" },
  { texto: "Como dar um feedback construtivo?", tool: "guia_consulta" },
];

/** As 6–8 sugestões do contexto, já filtradas pela allowlist efetiva:
 *  a página decide a lista (a mesma precedência do sugestoes() antigo —
 *  jovem primeiro, ficha antes das listas, papel no fim) e a tool da
 *  pill precisa existir nos roles de algum papel da pessoa. Contexto que
 *  encolher abaixo do lote simplesmente mostra o que tem — nunca repete
 *  nem fabrica pergunta sem tool. */
export function catalogo(papeis: AppRole[], pagina: string): Pill[] {
  const staff = papeis.some((p) => p === "coordenacao" || p === "supervisor");
  const soJovem = papeis.length > 0 && papeis.every((p) => p === "mentorado");
  let lista: Pill[];
  if (soJovem) {
    if (pagina.startsWith("/jovem/agenda")) lista = JOVEM_AGENDA;
    else if (pagina.startsWith("/jovem/especialistas"))
      lista = JOVEM_ESPECIALISTAS;
    else if (pagina.startsWith("/jovem/materiais")) lista = JOVEM_MATERIAIS;
    else lista = JOVEM_GENERICO;
  } else if (/^\/duplas\/[0-9a-f-]{36}/.test(pagina)) lista = FICHA_DUPLA;
  else if (pagina.startsWith("/agenda") && !papeis.includes("mentorado"))
    lista = AGENDA_STAFF;
  else if (pagina.startsWith("/duplas") && staff) lista = DUPLAS_STAFF;
  else if (pagina.startsWith("/materiais")) lista = MATERIAIS;
  else if (papeis.includes("coordenacao")) lista = COORD_GENERICO;
  else if (papeis.includes("supervisor")) lista = SUPERVISOR_GENERICO;
  else lista = MENTOR_PADRAO;
  return lista.filter(
    (p) =>
      (!p.papeis || p.papeis.some((r) => papeis.includes(r))) &&
      PILLS_TOOL_ROLES[p.tool].some((r) => papeis.includes(r))
  );
}

// ---------- baralho (rotação por visita) ----------

/** Deck persistido por papel: `vistos` = textos já sorteados pra tela,
 *  `clicados` = os que a pessoa chegou a enviar. Clicado conta como visto
 *  no sorteio e zera junto quando o baralho esgota (FR-013). */
export type DeckPills = { vistos: string[]; clicados: string[] };

const DECK_VAZIO: DeckPills = { vistos: [], clicados: [] };

export type Rng = () => number;

/** Chave do localStorage por papel primário — mesmo padrão `liza:*` da
 *  memória de falas (assistente-bolha): aparelho, nada pro servidor. */
export function chaveDeckPills(papel: string): string {
  return `liza:pills:${papel}`;
}

/** Lê o deck do storage — parse falho, formato estranho ou storage
 *  indisponível devolvem o deck vazio: a visita sorteia do catálogo
 *  inteiro em vez de quebrar o empty state. */
export function lerDeckPills(
  storage: Pick<Storage, "getItem"> | null | undefined,
  papel: string
): DeckPills {
  if (!storage) return { ...DECK_VAZIO };
  try {
    const raw = storage.getItem(chaveDeckPills(papel));
    const p = raw ? (JSON.parse(raw) as unknown) : null;
    if (!p || typeof p !== "object") return { ...DECK_VAZIO };
    const d = p as Partial<DeckPills>;
    return {
      vistos: Array.isArray(d.vistos)
        ? d.vistos.filter((t): t is string => typeof t === "string")
        : [],
      clicados: Array.isArray(d.clicados)
        ? d.clicados.filter((t): t is string => typeof t === "string")
        : [],
    };
  } catch {
    return { ...DECK_VAZIO };
  }
}

/** Grava o deck — escrita indisponível (modo privado, quota) só desliga
 *  a memória entre visitas; a rotação da sessão segue pelo retorno. */
export function gravarDeckPills(
  storage: Pick<Storage, "setItem"> | null | undefined,
  papel: string,
  deck: DeckPills
): void {
  try {
    storage?.setItem(chaveDeckPills(papel), JSON.stringify(deck));
  } catch {
    // sem persistência: o lote desta visita já saiu pelo retorno
  }
}

/** Fisher-Yates sobre cópia — determinístico dado o rng injetado
 *  (Math.random no caller, rng de teste no teste). */
function embaralhar<T>(itens: readonly T[], rng: Rng): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Sorteia até `n` pills ainda não vistas nem clicadas e devolve o deck
 *  já atualizado (lote marcado como visto). Vistos + clicados cobrindo o
 *  catálogo → o baralho reseta junto: os clicados zeram e o lote sai do
 *  catálogo inteiro. Catálogo menor que `n` devolve o que existe. */
export function sortearLote(
  cat: readonly Pill[],
  deck: DeckPills,
  n = 3,
  rng: Rng = Math.random
): { lote: Pill[]; deck: DeckPills } {
  const bloqueados = new Set([...deck.vistos, ...deck.clicados]);
  const restantes = cat.filter((p) => !bloqueados.has(p.texto));
  // baralho coberto: reseta junto — o sorteio volta pro catálogo inteiro
  // e o set de clicados zera com ele (FR-013)
  const reset = cat.length > 0 && restantes.length === 0;
  const lote = embaralhar(reset ? cat : restantes, rng).slice(
    0,
    Math.max(0, n)
  );
  const marcados = lote.map((p) => p.texto);
  return {
    lote,
    deck: {
      vistos: [...(reset ? [] : deck.vistos), ...marcados],
      clicados: reset ? [] : deck.clicados,
    },
  };
}

/** Marca a pill clicada — ela sai do sorteio até o baralho esgotar e
 *  resetar junto. Dedup incluso: clicar duas vezes não duplica. */
export function marcarClicada(deck: DeckPills, texto: string): DeckPills {
  if (!texto || deck.clicados.includes(texto)) return deck;
  return { ...deck, clicados: [...deck.clicados, texto] };
}
