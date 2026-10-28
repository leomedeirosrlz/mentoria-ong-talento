// Contexto de turma (REALIZA-73 — modelo D de docs/planos/navegacao-turmas.md):
// `?turma=` na URL é a fonte honesta/compartilhável; o cookie `turma_foco` é
// a conveniência de retorno ("estou trabalhando na T2 hoje"). Núcleo
// isomórfico, SEM imports de next/*: as puras rolam no server (as páginas
// resolvem o recorte) e os helpers de cookie rolam no browser — a escrita
// mora no seletor client porque página server-renderizada não escreve
// cookie de response; `document.cookie` segue o precedente de tema.ts e
// dos cookies demo_* (valor = label de turma, metadado interno — nunca
// credencial nem dado pessoal; sdr.md).

import type { AppRole, Cronograma } from "./types";

export const TURMA_FOCO_COOKIE = "turma_foco";

/** Valor do param que apaga o foco — `?turma=todas` é o "ver todas"
 *  explícito e viaja na URL (vence o cookie de quem recebe o link). */
export const TURMA_TODAS = "todas";

/** De onde veio o foco — dita o que a camada client faz com o cookie:
 *  - "param": `?turma=<válido>` explícito → grava o cookie
 *  - "todas": `?turma=todas` explícito → limpa o cookie
 *  - "cookie": veio do cookie → já está persistido, nada a fazer
 *  - "padrao": sem param nem cookie válido → "todas", cookie intocado
 *  - "invalido": `?turma=<lixo>` → falha fechada em "todas" SEM apagar a
 *    preferência guardada (um link errado não destrói o contexto) */
export type TurmaFocoOrigem =
  | "param"
  | "cookie"
  | "todas"
  | "invalido"
  | "padrao";

export type TurmaFoco = {
  /** Label cru de `cronogramas.turma` em foco. Null = "todas". A
   *  comparação com as duplas é por `turmaDaDupla` (rótulo vivo), nunca
   *  pelo selo `duplas.turma` — ele congela no pareamento. */
  turma: string | null;
  /** O recorte: cronogramas da turma em foco (todos quando null). Uma
   *  turma com dois cronogramas devolve os dois. */
  cronogramas: Cronograma[];
  origem: TurmaFocoOrigem;
};

export type TurmaContextoOpts = {
  /** Papel de quem navega. Fora de coordenacao/supervisor não existe
   *  contexto de turma — o RLS já entrega o recorte; param e cookie são
   *  ignorados. Sem `papel` o resolvedor assume a leitura de coordenação. */
  papel?: AppRole | null;
  /** Escopo do auxiliar executivo: os labels de turma que ele enxerga
   *  (derivado das duplas escopadas pela RLS, não do cookie). Sem ele,
   *  supervisor falha fechado: nenhuma turma disponível, nenhum seletor —
   *  o seletor nunca nomeia turma que a RLS já esconderia (sdr.md). */
  escopoTurmas?: readonly string[];
};

const papelSemContexto = (papel: AppRole | null | undefined): boolean =>
  papel != null && papel !== "coordenacao" && papel !== "supervisor";

/** Turmas que o seletor oferece — as "navegáveis": cronograma ativo ou
 *  rascunho (turma em preparação já é contexto de trabalho). Encerrada é
 *  histórico: sai do seletor, mas segue endereçável — `resolveTurmaFoco`
 *  continua resolvendo `?turma=<encerrada>` (acceptance #16). */
export function turmasDisponiveis(
  cronogramas: Cronograma[],
  opts: TurmaContextoOpts = {}
): string[] {
  if (papelSemContexto(opts.papel)) return [];
  // auxiliar: só as turmas do escopo dele; sem escopo informado, lista
  // vazia (falha fechada — não vaza nome de turma alheia)
  const escopo =
    opts.papel === "supervisor" ? new Set(opts.escopoTurmas ?? []) : null;
  const labels = new Set<string>();
  for (const c of cronogramas) {
    if (c.status !== "ativo" && c.status !== "rascunho") continue;
    if (escopo && !escopo.has(c.turma)) continue;
    labels.add(c.turma);
  }
  return [...labels].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** O cookie guarda o label encodeURIComponent'd ("T1 · 2026/2027" tem
 *  espaço e "·", inválidos cruos). Aceita também valor não-encoded —
 *  cookie plantado por fora ou label simples — e nunca quebra. */
function decodificaCookie(v: string | undefined): string | undefined {
  if (!v) return undefined;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/** Resolve o contexto de turma da página. Precedência: `?turma=` explícito
 *  > cookie > "todas". O param aceita o label cru OU um cronograma_id —
 *  os dois resolvem pro label (o `/registros` fala em id; o contexto fala
 *  em turma, que é a chave de `duplas.turma`). Turma encerrada segue
 *  válida; param lixo cai em "todas" sem erro (falha fechada). */
export function resolveTurmaFoco(
  param: string | string[] | undefined,
  cookieValor: string | undefined,
  cronogramas: Cronograma[],
  opts: TurmaContextoOpts = {}
): TurmaFoco {
  const todas = (origem: TurmaFocoOrigem): TurmaFoco => ({
    turma: null,
    cronogramas,
    origem,
  });
  const { papel } = opts;
  if (papelSemContexto(papel)) return todas("padrao");

  // auxiliar sem escopo informado falha fechado (set vazio → nada resolve),
  // na mesma disciplina de turmasDisponiveis — nunca nomeia turma alheia
  const escopo =
    papel === "supervisor" ? new Set(opts.escopoTurmas ?? []) : null;
  /** Label cru se `v` aponta pra uma turma existente (por label, por
   *  cronograma_id ou — pro auxiliar, que nem sempre paga a tabela de
   *  cronogramas — por label dentro do escopo dele); senão null. */
  const rotuloValido = (v: string): string | null => {
    const label = cronogramas.some((c) => c.turma === v)
      ? v
      : (cronogramas.find((c) => c.id === v)?.turma ??
        (escopo?.has(v) ? v : undefined));
    if (label == null) return null;
    if (escopo && !escopo.has(label)) return null;
    return label;
  };
  const foco = (turma: string, origem: TurmaFocoOrigem): TurmaFoco => ({
    turma,
    cronogramas: cronogramas.filter((c) => c.turma === turma),
    origem,
  });

  const raw = (Array.isArray(param) ? param[0] : param)?.trim();
  if (raw) {
    if (raw === TURMA_TODAS) return todas("todas");
    const turma = rotuloValido(raw);
    return turma ? foco(turma, "param") : todas("invalido");
  }
  const ck = decodificaCookie(cookieValor);
  if (ck) {
    const turma = rotuloValido(ck);
    // cookie obsoleto (turma apagada/fora do escopo) trata como ausente
    if (turma) return foco(turma, "cookie");
  }
  return todas("padrao");
}

// ---------- lado client (document.cookie, precedente tema.ts) ----------

/** Lê o cookie no browser — já decodificado. */
export function lerTurmaFocoClient(): string | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${TURMA_FOCO_COOKIE}=`));
  if (!raw) return null;
  return decodificaCookie(raw.slice(raw.indexOf("=") + 1)) ?? null;
}

/** Grava (ou apaga, com null) o foco — um ano, path raiz, SameSite=Lax,
 *  Secure só em https (dev local é http). Mesma disciplina do tema. */
export function gravarTurmaFocoClient(turma: string | null) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie =
    turma == null
      ? `${TURMA_FOCO_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`
      : `${TURMA_FOCO_COOKIE}=${encodeURIComponent(turma)}; path=/; max-age=31536000; samesite=lax${secure}`;
}
