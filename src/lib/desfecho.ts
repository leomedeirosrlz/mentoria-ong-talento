// ---------- desfecho de empregabilidade (REALIZA-216) ----------
//
// Vocabulário e derivações do formulário oficial "Depois da mentoria"
// (sistema='desfecho', seed na 0124). O jovem responde em dois momentos:
// no encerramento da dupla e 6 meses depois. Este módulo é a fonte única
// dos rótulos das situações e da régua "estudando ou trabalhando" — a
// migration duplica a lista de propósito porque a fronteira dela é o
// banco, não este arquivo (mesma convenção do atividades do 0110).

/** As 8 situações da pergunta "Hoje você está…" — verbatim do seed da
 *  0124, na ordem do formulário. Manter em par com a opção opcoes[] do
 *  campo 'situacao' (mudança de texto vira outra opção no agregado). */
export const DESFECHO_SITUACOES = [
  "Estudando",
  "Trabalhando com carteira (CLT)",
  "Estágio",
  "Jovem Aprendiz",
  "Trabalhando sem carteira / bicos",
  "Empreendendo",
  "Procurando trabalho",
  "Nenhuma das anteriores",
] as const;

export type DesfechoSituacao = (typeof DESFECHO_SITUACOES)[number];

/** Situações que contam como "estudando ou trabalhando" no retrato — o
 *  número de cabeceira do /resumo. Procurando trabalho e nenhuma ficam
 *  de fora de propósito (desenho REALIZA-216). */
export const DESFECHO_POSITIVAS: ReadonlySet<string> = new Set([
  "Estudando",
  "Trabalhando com carteira (CLT)",
  "Estágio",
  "Jovem Aprendiz",
  "Trabalhando sem carteira / bicos",
  "Empreendendo",
]);

/** n mínimo pra uma célula sair no agregado público (LGPD do desenho) —
 *  o SQL aplica a mesma régua; aqui vive o número pro card saber o porquê
 *  do "dados insuficientes". */
export const DESFECHO_N_MIN = 5;

export type DesfechoMomentoChave = "encerramento" | "6m";

export const MOMENTO_LABEL: Record<DesfechoMomentoChave, string> = {
  encerramento: "No fim da mentoria",
  "6m": "6 meses depois",
};

/** Um retrato agregado de um momento — o que desfecho_agregado devolve.
 *  suficiente=false carrega só n (a célula some por privacidade). */
export type DesfechoMomento = {
  n: number;
  suficiente: boolean;
  media_ajudou?: number | null;
  pct_estudando_trabalhando?: number | null;
  opcoes?: { opcao: string; n: number; pct: number }[];
};

/** Resposta do RPC desfecho_agregado — chaves fixas pros dois momentos. */
export type DesfechoAgregado = {
  encerramento: DesfechoMomento;
  "6m": DesfechoMomento;
};

/** JSON da RPC → tipo com garantia mínima (nunca lança: relatório com
 *  desfecho ainda não plantado degrada pra null e o card some). */
export function parseDesfechoAgregado(raw: unknown): DesfechoAgregado | null {
  if (!raw || typeof raw !== "object") return null;
  const m = (k: DesfechoMomentoChave): DesfechoMomento | null => {
    const v = (raw as Record<string, unknown>)[k];
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    const n = typeof o.n === "number" ? o.n : 0;
    if (o.suficiente !== true) return { n, suficiente: false };
    const opcoes = Array.isArray(o.opcoes)
      ? o.opcoes
          .map((x): { opcao: string; n: number; pct: number } | null => {
            if (!x || typeof x !== "object") return null;
            const r = x as Record<string, unknown>;
            if (typeof r.opcao !== "string") return null;
            return {
              opcao: r.opcao,
              n: typeof r.n === "number" ? r.n : 0,
              pct: typeof r.pct === "number" ? r.pct : 0,
            };
          })
          .filter((x): x is { opcao: string; n: number; pct: number } => !!x)
      : [];
    return {
      n,
      suficiente: true,
      media_ajudou: typeof o.media_ajudou === "number" ? o.media_ajudou : null,
      pct_estudando_trabalhando:
        typeof o.pct_estudando_trabalhando === "number"
          ? o.pct_estudando_trabalhando
          : null,
      opcoes,
    };
  };
  const encerramento = m("encerramento");
  const seis = m("6m");
  if (!encerramento && !seis) return null;
  return {
    encerramento: encerramento ?? { n: 0, suficiente: false },
    "6m": seis ?? { n: 0, suficiente: false },
  };
}

/** Situações marcadas que contam no retrato "estudando ou trabalhando" —
 *  usado na ficha da dupla pra traduzir a resposta individual. */
export function desfechoPositivo(situacao: readonly string[]): boolean {
  return situacao.some((s) => DESFECHO_POSITIVAS.has(s));
}

/** O que uma resposta individual carrega — parse do jsonb guardado em
 *  formulario_respostas.respostas. Nunca lança: resposta antiga ou
 *  marcada de formas inesperadas degrada pro que der pra ler. */
export type RespostaDesfecho = {
  situacao: string[];
  ajudou: number | null;
  conquista: string | null;
};

export function leRespostaDesfecho(raw: unknown): RespostaDesfecho | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const situacao = Array.isArray(o.situacao)
    ? o.situacao.filter((s): s is string => typeof s === "string")
    : [];
  const ajudou =
    typeof o.ajudou === "number" && o.ajudou >= 1 && o.ajudou <= 5
      ? o.ajudou
      : null;
  const conquista =
    typeof o.conquista === "string" && o.conquista.trim() !== ""
      ? o.conquista.trim()
      : null;
  // resposta sem nenhum campo legível não é resposta de desfecho
  if (!situacao.length && ajudou == null && conquista == null) return null;
  return { situacao, ajudou, conquista };
}

/** Uma entrega do desfecho na ficha da dupla — link + resposta lida. */
export type DesfechoEntrega = {
  momento: DesfechoMomentoChave;
  status: "pendente" | "respondido" | "expirado";
  respondido_em: string | null;
  resposta: RespostaDesfecho | null;
};

/** Modelo de uma linha do card "Depois da mentoria" no /resumo — já em
 *  pt-BR de exibição, ou null quando o momento não tem nem respostas. */
export type DesfechoCardMomento = {
  chave: DesfechoMomentoChave;
  rotulo: string;
  suficiente: boolean;
  n: number;
  /** "% estudando ou trabalhando" — deriva das contagens por opção
   *  quando a RPC não manda pronto (a fonte da verdade é a mesma régua
   *  DESFECHO_POSITIVAS). */
  pctPositivo: number | null;
  mediaAjudou: number | null;
  opcoes: { opcao: string; n: number; pct: number }[];
};

/** Agregado da RPC → as duas linhas do card, na ordem da narrativa (fim
 *  da mentoria → 6 meses). Momento sem resposta nenhuma não vira linha —
 *  "ainda não perguntamos" não merece espaço de tela. */
export function montaDesfechoCard(
  ag: DesfechoAgregado | null
): DesfechoCardMomento[] {
  if (!ag) return [];
  const linha = (chave: DesfechoMomentoChave): DesfechoCardMomento | null => {
    const m = ag[chave];
    if (!m || m.n <= 0) return null;
    if (!m.suficiente) {
      return {
        chave,
        rotulo: MOMENTO_LABEL[chave],
        suficiente: false,
        n: m.n,
        pctPositivo: null,
        mediaAjudou: null,
        opcoes: [],
      };
    }
    const opcoes = m.opcoes ?? [];
    const pctPositivo =
      m.pct_estudando_trabalhando ??
      (opcoes.length
        ? Math.round(
            (opcoes
              .filter((o) => DESFECHO_POSITIVAS.has(o.opcao))
              .reduce((s, o) => s + o.n, 0) *
              1000) /
              m.n
          ) / 10
        : null);
    return {
      chave,
      rotulo: MOMENTO_LABEL[chave],
      suficiente: true,
      n: m.n,
      pctPositivo,
      mediaAjudou: m.media_ajudou ?? null,
      opcoes,
    };
  };
  return [linha("encerramento"), linha("6m")].filter(
    (l): l is DesfechoCardMomento => !!l
  );
}

/** Formatação de porcentagem pt-BR sem casas desnecessárias: 80 → "80%",
 *  77.8 → "77,8%". */
export function formatPct(pct: number): string {
  const v = Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
  return `${v.replace(".", ",")}%`;
}
