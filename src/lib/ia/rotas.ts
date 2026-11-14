// Links internos que a Liza monta (REALIZA-396): um vocabulário só,
// tipado pelos valores que cada página aplica de fato — param fora da
// lista cai no default da tela e o "link com filtro" virava link sem
// filtro. Os cards (assistente-cards) e os testes passam por aqui; o
// prompt espelha a mesma lista pra resposta em markdown.

import type { RecorteFatia } from "@/lib/agenda-coordenacao";
import type { StatusPessoa } from "@/lib/pessoas-status";
import type { AvaliacaoJovem, Dificuldade } from "@/lib/types";

// espelho de src/app/(app)/duplas/[id]/ficha-abas.ts (o tipo mora na
// rota; lib não importa de app) — desconhecido cai em "agora" lá dentro
export type AbaFicha = "agora" | "encontros" | "instrumentos" | "pessoas";

const qs = (params: Record<string, string | number | undefined>): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") p.set(k, String(v));
  }
  const t = p.toString();
  return t ? `?${t}` : "";
};

// ---------- duplas ----------

/** /duplas — lista. `recorte` aplica o chip de fatia (risco, atenção…);
 *  `turma` é o rótulo ("Turma 2"), não o id. */
export function rotaDuplas(o: {
  recorte?: RecorteFatia;
  turma?: string;
} = {}): string {
  return `/duplas${qs({ recorte: o.recorte, turma: o.turma })}`;
}

/** /duplas/<id> — ficha. `aba` fora de agora|encontros|instrumentos|pessoas
 *  cai em "agora" (default, por isso não viaja na URL). */
export function rotaDupla(id: string, aba?: AbaFicha): string {
  return `/duplas/${id}${qs({ aba: aba && aba !== "agora" ? aba : undefined })}`;
}

// ---------- pessoas ----------

export type CatPessoas =
  | "equipe"
  | "supervisores"
  | "mentores"
  | "mentorados"
  | "sempapel";

/** /pessoas — diretório filtrado no cliente. `turma` é o rótulo da pill
 *  ou "sem-turma"; `ordem` "nome" é o default e não viaja. */
export function rotaPessoas(
  o: {
    busca?: string;
    cat?: CatPessoas;
    turma?: string;
    status?: StatusPessoa;
    trilha?: "dpp" | "especialista";
    pendencias?: boolean;
    ordem?: "pendencias";
    agrupar?: "turma";
  } = {}
): string {
  return `/pessoas${qs({
    busca: o.busca,
    cat: o.cat,
    turma: o.turma,
    status: o.status,
    trilha: o.trilha,
    pendencias: o.pendencias ? "1" : undefined,
    ordem: o.ordem,
    agrupar: o.agrupar,
  })}`;
}

export const rotaPessoa = (id: string): string => `/pessoas/${id}`;

// ---------- registros ----------

export type DificuldadeFiltro = "com" | Dificuldade;

/** /registros — central de registros. `turma` aqui é o UUID da turma
 *  (diferente das outras telas, que levam o rótulo); `dupla`/`r` também
 *  são UUIDs. Defaults recentes/dupla/mentor não viajam. */
export function rotaRegistros(
  o: {
    encontro?: number;
    avaliacao?: AvaliacaoJovem;
    apoio?: boolean;
    tardio?: boolean;
    dificuldade?: DificuldadeFiltro;
    dupla?: string;
    turma?: string;
    periodo?: "4s" | "8s";
    q?: string;
    pagina?: number;
    ordem?: "recentes" | "prioridade" | "antigas";
    grupo?: "dupla" | "semana" | "avaliacao";
    persp?: "mentor" | "jovem" | "ambos";
    r?: string;
  } = {}
): string {
  return `/registros${qs({
    encontro: o.encontro,
    avaliacao: o.avaliacao,
    apoio: o.apoio ? "1" : undefined,
    tardio: o.tardio ? "1" : undefined,
    dificuldade: o.dificuldade,
    dupla: o.dupla,
    turma: o.turma,
    periodo: o.periodo,
    q: o.q,
    pagina: o.pagina && o.pagina > 1 ? o.pagina : undefined,
    ordem: o.ordem && o.ordem !== "recentes" ? o.ordem : undefined,
    grupo: o.grupo && o.grupo !== "dupla" ? o.grupo : undefined,
    persp: o.persp && o.persp !== "mentor" ? o.persp : undefined,
    r: o.r,
  })}`;
}

// ---------- agenda ----------

/** /agenda — `dia` em AAAA-MM-DD (a página valida o padrão); `aba` é o
 *  modo dentro da visão DPP; `jw` a janela de coord/supervisor; `turma`
 *  o rótulo do contexto. */
export function rotaAgenda(
  o: {
    dia?: string;
    visao?: "dpp" | "especialista";
    aba?: "minha" | "por-mentorado" | "calendario" | "consolidada";
    jw?: "semana" | "mes" | "ciclo";
    turma?: string;
  } = {}
): string {
  return `/agenda${qs({
    dia: o.dia,
    visao: o.visao,
    aba: o.aba,
    jw: o.jw,
    turma: o.turma,
  })}`;
}

// ---------- materiais / relatorios / chamados ----------

export const rotaMateriais = (aba?: "instrumentos" | "biblioteca"): string =>
  `/materiais${qs({ aba })}`;

export type AbaRelatoriosLink =
  | "visao"
  | "aderencia"
  | "assinaturas"
  | "interacoes"
  | "solicitacoes"
  | "encerramento"
  | "formularios";

/** /relatorios/operacionais — `turma` leva o rótulo e `cronograma` o id
 *  do cronograma (deep-link do hub). A grade é /relatorios mesmo. */
export function rotaRelatoriosOperacionais(
  o: {
    aba?: AbaRelatoriosLink;
    turma?: string;
    cronograma?: string;
  } = {}
): string {
  return `/relatorios/operacionais${qs({
    aba: o.aba,
    turma: o.turma,
    cronograma: o.cronograma,
  })}`;
}

/** /chamados — `c` é o UUID do chamado pra abrir direto no painel. */
export const rotaChamados = (c?: string): string => `/chamados${qs({ c })}`;
