/**
 * WP7 · REALIZA-140 — jornada do jovem ("Minha jornada").
 *
 * Domínio puro: deriva as 7 estações canônicas do guia a partir do
 * cronograma da turma DELA + as entregas de instrumentos (RPC
 * `jovem_jornada`, 0096) + encontros/avaliações já legíveis.
 *
 * Erros dos mocks corrigidos aqui (plano §432): Roda inicial abre no
 * enc. 1 (não no 2); PDM é documento vivo construído nos enc. 1–4 com
 * revisão no 9; Roda formal nos enc. 12–14; 360º é terminal (enc. 16 /
 * encerramento). Anamnese e avaliação por terceiros ficam FORA da
 * jornada por decisão (C8/C10). "Avaliação do encontro" é recorrente —
 * "em dia · X de Y", nunca "fecha".
 */

import {
  extraiMetas,
  extraiRodaDaVida,
  type FormularioCampo,
  type RespostaValor,
  type RodaArea,
} from "./forms/schema";

export type EstacaoChave =
  | "roda_inicial"
  | "visao"
  | "metas"
  | "pdm"
  | "avaliacao_encontro"
  | "roda_formal"
  | "avaliacao_360";

/** Pill da v4 + "trancada" (o "abre no enc. N" do plano). "em_andamento"
 *  (rascunho localStorage) é sobreposição client-side sobre `a_fazer`/
 *  `pendente` — o estado server-side nunca o emite. */
export type EstacaoEstado = "feito" | "a_fazer" | "trancada";

export type JanelaGuia = {
  /** Encontros do guia em que a estação vive (ex.: PDM 1–4, rev. 9). */
  encIni: number;
  encFim: number;
  /** Datas reais dos encontros da turma dela (null se o cronograma
   *  não cobre o número — turma encurtada, evento apagado). */
  dataIni: string | null;
  dataFim: string | null;
  /** Rótulo curto pro chip: "Enc. 1", "Enc. 1–4", "Todo encontro". */
  label: string;
};

export type Estacao = {
  chave: EstacaoChave;
  titulo: string;
  /** O que a estação é, na voz do guia (copy da v3/v4 saneada). */
  descricao: string;
  janela: JanelaGuia;
  estado: EstacaoEstado;
  /** Carimbo "Feito · 17 ago" — respostas.respondido_em/usado_em. */
  respondidoEm: string | null;
  /** Token da entrega viva → CTA "Continuar" → /f/<token>. Null em
   *  qualquer outro caso — o jovem nunca emite link. */
  token: string | null;
  /** "Você escreveu…" — citação real de respostas (campo canônico por
   *  instrumento). Null quando não há resposta ou campo citável. */
  snippet: { tag: string; texto: string } | null;
  /** Estado honesto em texto: "o mentor envia quando chegar a hora",
   *  "libera no enc. 12 (4 nov)", "em dia · 5 de 6", "falta avaliar o
   *  encontro 7". Null quando o pill+CTA já dizem tudo. */
  detalhe: string | null;
  /** Respostas brutas da entrega corrente (pro dialog "Rever resposta"
   *  reusar InstrumentoResultado). Null fora de `feito`. */
  respostas: Record<string, unknown> | null;
};

export type EntregaJornada = {
  link_id: string;
  /** null quando a entrega não é endereçada ao mentorado e o caller é
   *  ele (0096 — a jovem não carrega bearer token de link alheio). */
  token: string | null;
  destino: "mentorado" | "mentor" | "outro";
  status: "respondido" | "pendente" | "expirado";
  respondido_em: string | null;
  respostas: Record<string, unknown> | null;
  contexto: Record<string, unknown> | null;
  created_at: string;
  usado_em: string | null;
  expira_em: string | null;
};

export type InstrumentoJornada = {
  sistema: "visao" | "metas" | "pdm" | "roda_vida";
  formulario_id: string;
  titulo: string;
  descricao: string | null;
  ativo: boolean;
  campos: unknown;
  entregas: EntregaJornada[];
};

export type Entrega360 = Omit<EntregaJornada, "destino" | "usado_em">;

export type EventoJornada = {
  numero: number | null;
  /** null em etapa_preparacao já concluída (0062 — sem data oficial) */
  data: string | null;
  tipo:
    | "encontro"
    | "formacao"
    | "recesso"
    | "etapa_preparacao"
    | "evento_encerramento";
  fase: string | null;
  instrumentos: string[];
};

export type JovemJornadaDados = {
  dupla_id: string;
  cronograma: EventoJornada[];
  instrumentos: InstrumentoJornada[];
  avaliacao_360: Entrega360[];
};

/** Encontro mínimo pra estação "avaliação do encontro" — mesmo shape de
 *  JovemEncontro (queries-jovem.ts) usado pela home. */
export type EncontroJornada = {
  id: string;
  numero: number;
  status: string;
  data: string | null;
};

/** Linha de `painel_instrumentos_jornada()` (0096) — entregas por
 *  sistema SEM respostas/tokens (o painel agregado não vaza conteúdo).
 *  A resolução por estação (roda inicial × formal, janelas) usa a mesma
 *  lógica de `estacoesJornada`. */
export type PainelEntrega = {
  status: "respondido" | "pendente" | "expirado";
  created_at: string;
  destino: "mentorado" | "mentor";
  /** whitelist da 0096 (origem/momento/encontro/dupla_id) — o painel
   *  precisa do `momento` pra cortar Roda inicial × formal igual a
   *  jornada, sem divergir. */
  contexto?: Record<string, unknown> | null;
};

export type PainelJornadaLinha = {
  dupla_id: string;
  turma: string | null;
  cronograma_id: string;
  mentor_id: string;
  mentor_nome: string;
  mentorado_id: string;
  jovem_nome: string;
  entregas: Partial<
    Record<
      "visao" | "metas" | "pdm" | "roda_vida" | "avaliacao_360",
      PainelEntrega[]
    >
  >;
  avaliacoes_encontro: {
    feitas: number;
    realizados: number;
    /** posição real da dupla (maior enc. realizado) — a régua "fora da
     *  janela" compara com ela, não só com a coorte (0096). */
    max_numero: number | null;
  };
};

/** Estado de um instrumento no painel — espelha `estadoAtual` da ficha
 *  (0080) + `nao_enviado`, resolvido pela lib com a janela da turma. */
export type PainelEstado =
  | "respondido"
  | "pendente"
  | "expirado"
  | "nao_enviado";

/** Metadados canônicos das estações — âncoras do guia oficial
 *  (ENCONTROS_DPP_OFICIAL / gerador-cronograma.ts), não literais de mock. */
export const ESTACOES: Record<
  EstacaoChave,
  {
    titulo: string;
    descricao: string;
    /** encIni/encFim do guia; a recorrente usa o encontro corrente. */
    encIni: number;
    encFim: number;
    chipLabel: string;
    /** Campo citável em respostas pro "Você escreveu…". */
    tagSnippet: string;
  }
> = {
  roda_inicial: {
    titulo: "Roda da Vida · leitura inicial",
    descricao:
      "As 16 áreas da sua vida, de 1 a 10, em 4 quadrantes. É o ponto de partida pra comparar com a aplicação formal.",
    encIni: 1,
    encFim: 1,
    chipLabel: "Enc. 1",
    tagSnippet: "O que você marcou",
  },
  visao: {
    titulo: "Construindo a sua Visão",
    descricao:
      "5 perguntas pra imaginar o seu futuro. Vira a Declaração de Visão no topo do PDM.",
    encIni: 1,
    encFim: 4,
    chipLabel: "Enc. 1–4",
    tagSnippet: "Você escreveu",
  },
  metas: {
    titulo: "Definindo minhas metas",
    descricao:
      "Criar, aprender, melhorar, eliminar: metas com importância e a checagem SMART. A prioritária abre o PDM.",
    encIni: 2,
    encFim: 3,
    chipLabel: "Enc. 2–3",
    tagSnippet: "Sua meta",
  },
  pdm: {
    titulo: "PDM · Plano de Desenvolvimento",
    descricao:
      "Documento vivo: a Visão no topo, metas por prioridade e submetas. Revisão de meio de percurso no encontro 9.",
    encIni: 1,
    encFim: 4,
    chipLabel: "Construir 1–4",
    tagSnippet: "O combinado",
  },
  avaliacao_encontro: {
    titulo: "Avaliação do encontro",
    descricao:
      "Depois de cada encontro, uma nota de 1 a 5 e um comentário. É recorrente — acompanha o ciclo inteiro.",
    encIni: 1,
    encFim: 16,
    chipLabel: "Todo encontro",
    tagSnippet: "Sua nota",
  },
  roda_formal: {
    titulo: "Roda da Vida · aplicação formal",
    descricao:
      "Você refaz a Roda e vê o antes × depois sobre a leitura inicial.",
    encIni: 12,
    encFim: 14,
    chipLabel: "Enc. 12–14",
    tagSnippet: "O que você marcou",
  },
  avaliacao_360: {
    titulo: "Avaliação 360º",
    descricao:
      "O fechamento do ciclo: como você se vê e como te veem. A coordenação emite no fim da jornada.",
    encIni: 16,
    encFim: 16,
    chipLabel: "Enc. 16",
    tagSnippet: "Você escreveu",
  },
};

// ---------- internals ----------

const SNIPPET_MAX = 140;
/** Teto do guia pro mapa de submetas do PDM (~20 no total — decisão D3 do
 *  plano; é o denominador do "X de Y submetas"). */
const SUBMETAS_TETO = 20;

type StatusEntrega = EntregaJornada["status"];
type ResolucaoEstacao = Pick<
  Estacao,
  "estado" | "respondidoEm" | "token" | "snippet" | "detalhe" | "respostas"
>;

/** 'yyyy-mm-dd' → 'dd/mm' por substring — a data do evento é dia de
 *  calendário; criar Date aqui convidaria shift de fuso. */
function diaMes(iso: string | null | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Snippet com reticência — os campos são texto longo, o card quer ~2 linhas. */
function truncaSnippet(texto: string): string {
  const t = texto.replace(/\s+/g, " ").trim();
  return t.length <= SNIPPET_MAX
    ? t
    : `${t.slice(0, SNIPPET_MAX - 1).trimEnd()}…`;
}

/** Reconfere a vigência — a RPC já resolve `status`, mas um pendente com
 *  expira_em no passado é expirado de fato (o mirror demo e fixtures
 *  antigas podem trazer o par dessincronizado). */
function statusEntrega(
  e: { status: StatusEntrega; expira_em?: string | null },
  agora: Date
): StatusEntrega {
  if (e.status === "respondido") return "respondido";
  if (e.expira_em && new Date(e.expira_em).getTime() < agora.getTime())
    return "expirado";
  return e.status;
}

/** Separa as duas aplicações da Roda. `contexto->>'momento'` quando o
 *  emissor marcou (0096 grava na emissão); sem marca, a PRIMEIRA roda da
 *  dupla é a leitura inicial e as seguintes a formal — a data do enc. 12
 *  não serve de régua (dupla emparelhada tarde tem a inicial dela depois
 *  do enc. 12; aplicação atrasada idem; re-envio cria link novo). */
function momentoRoda(
  e: Pick<EntregaJornada, "contexto">,
  primeiraSemMarca: boolean
): "inicial" | "formal" {
  const m = e.contexto?.["momento"];
  if (m === "inicial" || m === "formal") return m;
  return primeiraSemMarca ? "inicial" : "formal";
}

/** Conta os itens de um campo submetas_N: enumerações "1. … 2. …" (mesmo
 *  na mesma linha) valem por item; texto solto conta linhas não-vazias. */
function contaItensSubmeta(texto: string): number {
  let n = 0;
  for (const linha of texto.split(/\n+/)) {
    if (!linha.trim()) continue;
    const numerados = linha
      .split(/(?=\d+\s*[.)]\s)/)
      .map((p) => p.trim())
      .filter((p) => /^\d+\s*[.)]/.test(p));
    n += Math.max(1, numerados.length);
  }
  return n;
}

/** "N metas · X de 20 submetas" — metas saem do extractor canônico; as
 *  submetas são os itens enumerados dos campos submetas_N respondidos. */
function contagensPdm(
  campos: FormularioCampo[],
  respostas: Record<string, RespostaValor>
): string | null {
  const metas = extraiMetas(campos, respostas);
  if (!metas.length) return null;
  let submetas = 0;
  for (const m of metas) {
    const v = respostas[`submetas_${m.n}`];
    if (typeof v === "string" && v.trim()) submetas += contaItensSubmeta(v);
  }
  return `${metas.length} ${metas.length === 1 ? "meta" : "metas"} · ${submetas} de ${SUBMETAS_TETO} submetas`;
}

/** O trecho citável de uma resposta, por estação — o campo canônico do
 *  instrumento, não o primeiro texto que aparecer. */
function textoSnippet(
  chave: EstacaoChave,
  campos: FormularioCampo[],
  respostas: Record<string, unknown> | null
): string | null {
  if (!respostas) return null;
  const resp = respostas as Record<string, RespostaValor>;
  const textoDe = (id: string): string | null => {
    const v = respostas[id];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  switch (chave) {
    case "visao":
      return textoDe("declaracao_visao");
    case "metas":
      return extraiMetas(campos, resp)[0]?.meta ?? null;
    case "pdm":
      return contagensPdm(campos, resp);
    case "roda_inicial":
    case "roda_formal": {
      const roda = extraiRodaDaVida(campos, resp);
      if (!roda) return null;
      const areas = roda.quadrantes
        .flatMap((q) => q.areas)
        .filter((a): a is RodaArea & { nota: number } => a.nota != null);
      if (!areas.length) return null;
      // o par de eixos mais distantes — o contraste que a pessoa marcou
      const menor = areas.reduce((a, b) => (b.nota < a.nota ? b : a));
      const maior = areas.reduce((a, b) => (b.nota > a.nota ? b : a));
      return menor.nota === maior.nota
        ? `${menor.label} ${menor.nota}/10`
        : `${menor.label} ${menor.nota}/10 · ${maior.label} ${maior.nota}/10`;
    }
    case "avaliacao_360": {
      // sem campos no payload (a RPC 0096 não os manda): os ids citáveis
      // do instrumento oficial primeiro, depois qualquer texto com corpo
      for (const id of ["o_que_leva", "melhorar"]) {
        const v = textoDe(id);
        if (v) return v;
      }
      for (const v of Object.values(respostas)) {
        if (typeof v === "string" && v.trim().length >= 12) return v.trim();
      }
      return null;
    }
    default:
      return null;
  }
}

/** Resolve estado/token/detalhe de uma estação de instrumento — o núcleo
 *  compartilhado pelos 4 instrumentos e pelo 360º. `proJovem` diz se a
 *  entrega é endereçada a ela (link do mentor nunca vira CTA pra jovem). */
function resolveEstacao<
  T extends {
    status: StatusEntrega;
    token: string | null;
    respondido_em: string | null;
    respostas: Record<string, unknown> | null;
    created_at: string;
    usado_em?: string | null;
    expira_em?: string | null;
  },
>(
  chave: EstacaoChave,
  entregas: T[],
  campos: FormularioCampo[],
  proJovem: (e: T) => boolean,
  ctx: { encCorrente: number; encFim: number; dataIni: string | null; agora: Date; emissor: "mentor" | "coordenacao" }
): ResolucaoEstacao {
  // respondida primeiro — entrega cumprida é feita mesmo fora da janela
  // (a coord pode emitir antes da hora; o que foi respondido, consta).
  // proJovem também aqui: uma resposta do MENTOR não fecha a estação dela
  // nem vira "Você escreveu" (mesma regra do painel — jornada.ts ~640).
  const respondidas = entregas
    .filter((e) => proJovem(e) && statusEntrega(e, ctx.agora) === "respondido")
    .sort((a, b) =>
      (b.respondido_em ?? b.usado_em ?? b.created_at).localeCompare(
        a.respondido_em ?? a.usado_em ?? a.created_at
      )
    );
  const ultima = respondidas[0];
  // uma pendente NOVA depois da respondida é re-emissão (a revisão do PDM
  // no enc. 9 é isso): a estação não fica cega — volta a "a fazer" com o
  // CTA do link novo, e a resposta antiga segue consultável no detalhe
  const reemissao = ultima
    ? entregas
        .filter(
          (e) =>
            proJovem(e) &&
            statusEntrega(e, ctx.agora) === "pendente" &&
            e.created_at > ultima.created_at
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    : undefined;
  // ...mas a JANELA vence: re-emissão antes do enc. de abertura não abre o
  // CTA — cai no `feito` da resposta anterior (paridade com a estação
  // trancada e com o painel, que usa a mesma régua min(vigente, dupla))
  if (reemissao && ctx.encCorrente >= ESTACOES[chave].encIni) {
    return {
      estado: "a_fazer",
      // Rever sobrevive à re-emissão: respondidoEm/respostas da última
      // respondida — não da pendente nova (que ainda não tem resposta)
      respondidoEm: ultima!.respondido_em ?? ultima!.usado_em ?? null,
      token: reemissao.token,
      snippet: null,
      detalhe: "o mentor enviou uma nova rodada — a resposta anterior segue salva",
      respostas: ultima!.respostas,
    };
  }
  if (ultima) {
    const texto = textoSnippet(chave, campos, ultima.respostas);
    return {
      estado: "feito",
      respondidoEm: ultima.respondido_em ?? ultima.usado_em ?? null,
      token: null,
      snippet: texto ? { tag: ESTACOES[chave].tagSnippet, texto: truncaSnippet(texto) } : null,
      detalhe: chave === "pdm" ? texto : null,
      respostas: ultima.respostas,
    };
  }

  // janela ainda não abriu — trancada nunca tem botão, mesmo com link
  // emitido antes da hora (o guia manda esperar; o link segue válido pro
  // jovem que já o tem na mão, mas a jornada não empurra)
  if (ctx.encCorrente < ESTACOES[chave].encIni) {
    const dm = diaMes(ctx.dataIni);
    return {
      estado: "trancada",
      respondidoEm: null,
      token: null,
      snippet: null,
      detalhe: `libera no enc. ${ESTACOES[chave].encIni}${dm ? ` (${dm})` : ""}`,
      respostas: null,
    };
  }

  // janela aberta sem resposta: link vivo dela → CTA "Continuar";
  // expirado → detalhe honesto; sem link → quem emite aparece
  const pendente = entregas
    .filter((e) => proJovem(e) && statusEntrega(e, ctx.agora) === "pendente")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (pendente) {
    return {
      estado: "a_fazer",
      respondidoEm: null,
      token: pendente.token,
      snippet: null,
      detalhe: null,
      respostas: null,
    };
  }
  const expirada = entregas.some(
    (e) => proJovem(e) && statusEntrega(e, ctx.agora) === "expirado"
  );
  // janela já passou sem link: "a hora" foi embora — copy honesta aponta
  // o caminho (falar com o mentor) em vez de prometer emissão futura
  const passou = ctx.encCorrente > ctx.encFim;
  const detalhe = expirada
    ? ctx.emissor === "mentor"
      ? "o link expirou — peça ao mentor pra reenviar"
      : "o link expirou — peça à coordenação pra reenviar"
    : passou
      ? ctx.emissor === "mentor"
        ? "o link ainda não chegou — fala com teu mentor"
        : "o link ainda não chegou — a coordenação pode ajudar"
      : ctx.emissor === "mentor"
        ? "o mentor envia quando chegar a hora"
        : "a coordenação envia quando chegar a hora";
  return {
    estado: "a_fazer",
    respondidoEm: null,
    token: null,
    snippet: null,
    detalhe,
    respostas: null,
  };
}

/**
 * Deriva as estações da jornada. Inputs: o payload de `jovem_jornada()`
 * + os encontros e avaliações já legíveis do jovem + "agora" (testes
 * fixam). Retorna as 7 estações ordenadas + resumo pro hero.
 *
 * Regras:
 *  - `feito`: entrega respondida da janela → data + snippet do campo
 *    canônico; `a_fazer`: janela aberta/corrente, sem resposta (link vivo
 *    → token "Continuar"; sem link → detalhe "o mentor envia quando
 *    chegar a hora"); `trancada`: janela ainda não abriu (detalhe
 *    "libera no enc. N ({data da turma})", NUNCA botão).
 *  - Roda duas vezes: `momento` = contexto->>'momento' quando existir
 *    (0096 grava na emissão); sem marca, a PRIMEIRA roda da dupla é a
 *    inicial — nunca a data do enc. 12 (dupla tardia aplica a dela
 *    depois). A entrega corrente de cada momento é a mais recente dele.
 *  - "encontro corrente" = maior numero de encontro realizado + 1, teto
 *    16 — mesma âncora da home (realizado, não agendado futuro).
 *  - avaliacao_encontro: X = avaliacoes feitas, Y = encontros realizados;
 *    pendência → `a_fazer` + detalhe "falta avaliar o encontro N" (o
 *    mais antigo sem avaliação); em dia (X=Y, Y>0) → `feito` + detalhe
 *    "em dia · X de Y" — conta no progresso sem "fechar" nunca.
 */
export function estacoesJornada(input: {
  cronograma: EventoJornada[];
  instrumentos: InstrumentoJornada[];
  avaliacao360: Entrega360[];
  encontros: EncontroJornada[];
  /** encontro_ids com avaliação respondida pela jovem. */
  avaliacoesFeitas: string[];
  agora?: Date;
}): Estacao[] {
  const agora = input.agora ?? new Date();

  // âncoras de janela: só evento tipo 'encontro' com numero gera data —
  // formação/recesso/marco do ciclo não movem a régua do guia
  const dataPorNumero = new Map<number, string>();
  for (const ev of input.cronograma) {
    if (ev.tipo === "encontro" && ev.numero != null && ev.data != null && !dataPorNumero.has(ev.numero))
      dataPorNumero.set(ev.numero, ev.data);
  }


  // encontro corrente = último realizado + 1 (teto 16) — realizado, não
  // agendado: a régua é o que já aconteceu, não o que está marcado
  const realizados = input.encontros.filter((e) => e.status === "realizado");
  const maxRealizado = realizados.reduce((m, e) => Math.max(m, e.numero), 0);
  const encCorrente = Math.min(16, maxRealizado + 1);

  const instPorSistema = new Map(input.instrumentos.map((i) => [i.sistema, i]));
  const camposDe = (sistema: InstrumentoJornada["sistema"]): FormularioCampo[] => {
    const c = instPorSistema.get(sistema)?.campos;
    return Array.isArray(c) ? (c as FormularioCampo[]) : [];
  };
  const entregasDe = (sistema: InstrumentoJornada["sistema"]): EntregaJornada[] =>
    [...(instPorSistema.get(sistema)?.entregas ?? [])].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );

  // a Roda aparece duas vezes na estrada — reparte as entregas pelo
  // recorte de cada aplicação antes de resolver cada estação. Marca
  // explícita primeiro; sem ela, a mais antiga sem marca é a inicial.
  const rodaBuckets: Record<"inicial" | "formal", EntregaJornada[]> = {
    inicial: [],
    formal: [],
  };
  const rodasOrdem = entregasDe("roda_vida");
  const idxPrimeiraSemMarca = rodasOrdem.findIndex(
    (e) => e.contexto?.["momento"] !== "inicial" && e.contexto?.["momento"] !== "formal"
  );
  rodasOrdem.forEach((e, i) =>
    rodaBuckets[momentoRoda(e, i === idxPrimeiraSemMarca)].push(e)
  );

  const proJovem = (e: EntregaJornada) => e.destino === "mentorado";

  // a recorrente: X de Y avaliações de encontro — o CTA é da home/agenda,
  // a estação nunca emite token
  const feitas = new Set(input.avaliacoesFeitas);
  const faltantes = realizados
    .filter((e) => !feitas.has(e.id))
    .map((e) => e.numero)
    .sort((a, b) => a - b);
  const emDia = realizados.length - faltantes.length;
  const avaliacaoResolucao: ResolucaoEstacao =
    realizados.length > 0 && faltantes.length === 0
      ? {
          estado: "feito",
          respondidoEm: null,
          token: null,
          snippet: null,
          detalhe: `em dia · ${emDia} de ${realizados.length}`,
          respostas: null,
        }
      : {
          estado: "a_fazer",
          respondidoEm: null,
          token: null,
          snippet: null,
          detalhe: faltantes.length
            ? `falta avaliar o encontro ${faltantes[0]}`
            : "a primeira sai depois do encontro 1",
          respostas: null,
        };

  // sempre na ordem narrativa da tabela canônica — nunca por estado
  return (Object.keys(ESTACOES) as EstacaoChave[]).map((chave) => {
    const meta = ESTACOES[chave];
    const janela: JanelaGuia = {
      encIni: meta.encIni,
      encFim: meta.encFim,
      dataIni: dataPorNumero.get(meta.encIni) ?? null,
      dataFim: dataPorNumero.get(meta.encFim) ?? null,
      label: meta.chipLabel,
    };
    const ctx = { encCorrente, encFim: meta.encFim, dataIni: janela.dataIni, agora };
    let r: ResolucaoEstacao;
    switch (chave) {
      case "roda_inicial":
      case "roda_formal": {
        const bucket = chave === "roda_inicial" ? rodaBuckets.inicial : rodaBuckets.formal;
        r = resolveEstacao(chave, bucket, camposDe("roda_vida"), proJovem, { ...ctx, emissor: "mentor" });
        break;
      }
      case "avaliacao_encontro":
        r = avaliacaoResolucao;
        break;
      case "avaliacao_360":
        // as entregas 360º já chegam filtradas pela RPC pra própria jovem
        // (dest_mentorado_id = ela) — não há `destino` pra conferir
        r = resolveEstacao(chave, input.avaliacao360, [], () => true, { ...ctx, emissor: "coordenacao" });
        break;
      default:
        r = resolveEstacao(chave, entregasDe(chave), camposDe(chave), proJovem, { ...ctx, emissor: "mentor" });
    }
    return {
      chave,
      titulo: meta.titulo,
      descricao: meta.descricao,
      janela,
      ...r,
    };
  });
}

/** Resumo pro hero slim: progresso de entregas + próxima parada. */
export function resumoJornada(estacoes: Estacao[]): {
  feitas: number;
  total: number;
  proxima: { titulo: string; detalhe: string | null } | null;
} {
  const feitas = estacoes.filter((e) => e.estado === "feito").length;
  const proxima =
    estacoes.find((e) => e.estado === "a_fazer") ??
    estacoes.find((e) => e.estado === "trancada") ??
    null;
  return {
    feitas,
    total: estacoes.length,
    proxima: proxima
      ? { titulo: proxima.titulo, detalhe: proxima.detalhe }
      : null,
  };
}

/* ======================================================================
 * WP7 · painel da coordenação/supervisão — "Progresso da jornada"
 *
 * Deriva o estado de cada estação por dupla a partir do payload de
 * `painel_instrumentos_jornada()` (fatos brutos — sem respostas e sem
 * tokens, decisão da 0096) + o cronograma da turma da dupla. A regra é a
 * MESMA da jornada do jovem (ESTACOES), com duas adaptações do payload
 * mais enxuto:
 *
 *   · roda inicial × formal: mesma régua da jornada — contexto->>'momento'
 *     explícito vence; sem marca, a primeira entrega é a inicial e as
 *     seguintes a formal (nunca a data do enc. 12).
 *   · avaliacao_encontro: vem agregada {feitas, realizados} — "em dia" é
 *     feitas ≥ realizados com realizados > 0; realizados = 0 → trancada
 *     (ainda não houve encontro); o resto é pendência recorrente.
 *
 * Só entregas endereçadas à JOVEM contam: um 360º respondido pelo mentor
 * não fecha a estação dela (o payload do painel separa por `destino`).
 * ====================================================================== */

/** As 7 estações na ordem canônica do guia — a mesma de ESTACOES, numa
 *  lista iterável pro painel (Object.keys não garante a ordem ao
 *  TypeScript). */
export const ESTACAO_CHAVES = [
  "roda_inicial",
  "visao",
  "metas",
  "pdm",
  "avaliacao_encontro",
  "roda_formal",
  "avaliacao_360",
] as const satisfies readonly EstacaoChave[];

/** Estado de uma estação numa dupla do painel — `PainelEstado` (o fato da
 *  entrega, espelho do `estadoAtual` da ficha) + `trancada` (a janela da
 *  turma ainda não abriu pra estação — "abre no enc. N"). */
export type EstacaoPainelEstado = PainelEstado | "trancada";

/** Contexto da turma pra resolver as estações de uma dupla do painel —
 *  derivado dos eventos do cronograma dela (`ciclo_eventos`), nunca da
 *  dupla: a régua de "em dia × fora da janela" é o calendário oficial.
 *  `encVigente` = maior nº de encontro oficial com data ≤ hoje (0 = a
 *  turma ainda não começou); `dataEnc(n)` = a data real do encontro n,
 *  null quando o cronograma não cobre o número. */
export type PainelTurmaCtx = {
  /** Maior numero de evento tipo 'encontro' com data ≤ hoje (0–16). */
  encVigente: number;
  /** Data "YYYY-MM-DD" do encontro n no cronograma desta turma. */
  dataEnc: (numero: number) => string | null;
};

/** As colunas de ciclo_eventos que o painel consome — o shape completo
 *  (types.ts) satisfaz sem cast; testes e mirrors passam o mínimo. */
export type CicloEventoMinimo = {
  cronograma_id: string | null;
  tipo: string;
  numero: number | null;
  data: string | null;
};

/** Monta o contexto de uma turma a partir da lista de ciclo_eventos. O
 *  "encontro vigente" é o maior número já alcançado pelo CALENDÁRIO —
 *  datas oficiais, não encontros marcados pela dupla (uma turma que
 *  não começou fica com vigente 0 e todas as estações trancadas). */
export function painelTurmaCtx(
  eventos: CicloEventoMinimo[],
  cronogramaId: string | null,
  agora: Date = new Date()
): PainelTurmaCtx {
  const hoje = agora.toISOString().slice(0, 10);
  const datas = new Map<number, string>();
  for (const e of eventos) {
    if (
      e.cronograma_id === cronogramaId &&
      e.tipo === "encontro" &&
      e.numero != null &&
      e.data != null
    ) {
      datas.set(e.numero, e.data);
    }
  }
  let encVigente = 0;
  for (const [numero, data] of datas) {
    if (data <= hoje && numero > encVigente) encVigente = numero;
  }
  return { encVigente, dataEnc: (n) => datas.get(n) ?? null };
}

/** Entregas de uma estação na linha do painel — já filtradas pro destino
 *  `mentorado` (a estação é a entrega DA JOVEM; link pro mentor da mesma
 *  dupla, ex.: o lado dele do 360º, não fecha nem abre estação). */
function entregasDaEstacao(
  linha: PainelJornadaLinha,
  chave: Exclude<EstacaoChave, "avaliacao_encontro">
): PainelEntrega[] {
  const daJovem = (l: PainelEntrega[]) =>
    l.filter((e) => e.destino === "mentorado");
  if (chave === "avaliacao_360") {
    return daJovem(linha.entregas.avaliacao_360 ?? []);
  }
  if (chave === "roda_inicial" || chave === "roda_formal") {
    // mesma régua da jornada: contexto.momento quando marcado (0096 o
    // projeta no painel); sem marca, a PRIMEIRA roda da dupla é a
    // inicial — a data do enc. 12 não separa (dupla tardia aplica a
    // leitura inicial depois dele).
    const rodas = daJovem(linha.entregas.roda_vida ?? []).sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
    const idxSemMarca = rodas.findIndex(
      (e) =>
        e.contexto?.["momento"] !== "inicial" &&
        e.contexto?.["momento"] !== "formal"
    );
    const momento = (e: PainelEntrega, i: number): "inicial" | "formal" => {
      const m = e.contexto?.["momento"];
      if (m === "inicial" || m === "formal") return m;
      return i === idxSemMarca ? "inicial" : "formal";
    };
    const alvo = chave === "roda_inicial" ? "inicial" : "formal";
    return rodas.filter((e, i) => momento(e, i) === alvo);
  }
  return daJovem(linha.entregas[chave] ?? []);
}

/** Resolve o estado das 7 estações de uma linha do painel. Ordem das
 *  regras por estação (instrumento único): respondida vence — uma resposta
 *  tardia ainda é resposta; sem resposta e janela fechada pro futuro →
 *  `trancada`; link vivo → `pendente`; só links mortos → `expirado`;
 *  nenhuma entrega → `nao_enviado`. A avaliação do encontro segue a regra
 *  recorrente de feitas × realizados. */
export function estacoesPainelDupla(
  linha: PainelJornadaLinha,
  ctx: PainelTurmaCtx,
  /** régua da DUPLA (posição dela na jornada) — a janela "aberta" usa
   *  min(encVigente da turma, posição da dupla), a mesma de
   *  atrasadasPainel: a coorte pode estar no enc. 12 e a dupla no 4 —
   *  nesse caso a estação que abre no 9 segue trancada PRA ELA, igual ao
   *  que a jornada dela mostra (encCorrente). */
  encCorrDupla: number
): Record<EstacaoChave, EstacaoPainelEstado> {
  const out = {} as Record<EstacaoChave, EstacaoPainelEstado>;
  const regua = Math.min(ctx.encVigente, encCorrDupla);
  for (const chave of ESTACAO_CHAVES) {
    if (chave === "avaliacao_encontro") {
      const { feitas, realizados } = linha.avaliacoes_encontro;
      out[chave] =
        realizados === 0 ? "trancada" : feitas >= realizados ? "respondido" : "pendente";
      continue;
    }
    const entregas = entregasDaEstacao(linha, chave);
    const ultimaResp = entregas
      .filter((e) => e.status === "respondido")
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    // pendente NOVA depois da última respondida = re-emissão viva (revisão
    // do PDM no enc. 9). A estação volta a `pendente` — a coord vê que há
    // link esperando a jovem — quando a janela está aberta pra dupla;
    // antes disso o fato dominante segue a resposta anterior (paridade
    // com resolveEstacao, onde a janela vence a re-emissão).
    const reemissaoViva =
      ultimaResp != null &&
      regua >= ESTACOES[chave].encIni &&
      entregas.some(
        (e) => e.status === "pendente" && e.created_at > ultimaResp.created_at
      );
    if (ultimaResp && !reemissaoViva) {
      out[chave] = "respondido";
    } else if (regua < ESTACOES[chave].encIni) {
      out[chave] = "trancada";
    } else if (entregas.some((e) => e.status === "pendente")) {
      out[chave] = "pendente";
    } else if (entregas.length) {
      out[chave] = "expirado";
    } else {
      out[chave] = "nao_enviado";
    }
  }
  return out;
}

/** Estações fora da janela do guia — o recorte da lista de ação do painel.
 *  A régua é `min(encVigente, encCorrDupla)`: a coorte encerrou a janela
 *  E ela já passou pra dupla — dupla recém-emparelhada ou atrasada tem a
 *  janela ainda aberta pra ela e não pode ser flagada por um prazo que
 *  nunca existiu do lado dela (o nudge ao mentor ficaria injusto). */
export function atrasadasPainel(
  estados: Record<EstacaoChave, EstacaoPainelEstado>,
  ctx: PainelTurmaCtx,
  encCorrDupla: number
): EstacaoChave[] {
  const regua = Math.min(ctx.encVigente, encCorrDupla);
  return ESTACAO_CHAVES.filter((chave) => {
    if (chave === "avaliacao_encontro") {
      return estados[chave] === "pendente";
    }
    return regua > ESTACOES[chave].encFim && estados[chave] !== "respondido";
  });
}
