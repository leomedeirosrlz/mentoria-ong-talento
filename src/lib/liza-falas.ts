// Balões de fala da Liza com o painel fechado: dizem que o ponto lima no
// canto é uma assistente (não um enfeite) e oferecem uma pergunta pronta
// da página. Regras puras aqui (testadas em tests/liza-falas.test.ts); a
// bolha (assistente-bolha.tsx) só cuida do relógio e do storage.
//
// Contra a chatice: a apresentação sai até a pessoa abrir a Liza uma vez
// (no máximo APRESENTACOES_MAX visitas); depois disso, no máximo UMA dica
// por sessão, e quem dispensa DICAS_DISPENSA_MAX dicas não vê mais nenhuma.

import type { AppRole } from "@/lib/types";

export type FalaLiza = {
  tipo: "apresentacao" | "dica" | "pronto";
  texto: string;
  /** pergunta do chip: abre a Liza e já envia */
  pergunta?: string;
};

export type MemoriaFalas = {
  /** quantas visitas já viram a apresentação (localStorage) */
  apresentacoes: number;
  /** a pessoa já abriu a Liza alguma vez neste aparelho (localStorage) */
  abriu: boolean;
  /** dicas fechadas no X (localStorage) */
  dicasDispensadas: number;
  /** esta aba já mostrou uma fala (sessionStorage) */
  falouNaSessao: boolean;
};

export const APRESENTACOES_MAX = 3;
export const DICAS_DISPENSA_MAX = 2;

const primeiroNome = (nome?: string) => nome?.trim().split(/\s+/)[0] ?? "";

/** Dica contextual da página: só onde existe uma pergunta que a Liza
 *  responde bem ali (mesmas rotas das sugestões da conversa). */
export function dicaDaPagina(
  pagina: string,
  papeis: AppRole[]
): Omit<FalaLiza, "tipo"> | null {
  const mentorado = papeis.includes("mentorado");
  const staff = papeis.some((p) => p === "coordenacao" || p === "supervisor");
  if (/^\/duplas\/[0-9a-f-]{36}/.test(pagina) && !mentorado)
    return {
      texto: "Vai conversar com esta dupla? Eu faço um resumo do que já aconteceu.",
      pergunta: "Resuma esta dupla",
    };
  if (pagina.startsWith("/materiais"))
    return {
      texto: "Dúvida sobre um instrumento ou um encontro? Eu procuro nos guias pra você.",
      pergunta: "O que diz o guia sobre a Roda da Vida?",
    };
  if (pagina.startsWith("/agenda") && !mentorado)
    return {
      texto: "Quer saber quem tem encontro nesta semana? É só perguntar.",
      pergunta: "Encontros desta semana",
    };
  if (pagina.startsWith("/duplas") && staff)
    return {
      texto: "Eu mostro quais duplas pedem atenção agora.",
      pergunta: "Quem está em risco?",
    };
  return null;
}

/** A fala que a Liza deve dizer agora (ou nenhuma). `perguntaPadrao` é a
 *  primeira sugestão da conversa pra página: o chip da apresentação. */
export function proximaFala({
  memoria,
  pagina,
  papeis,
  nome,
  perguntaPadrao,
}: {
  memoria: MemoriaFalas;
  pagina: string;
  papeis: AppRole[];
  nome?: string;
  perguntaPadrao?: string;
}): FalaLiza | null {
  if (memoria.falouNaSessao) return null;
  if (!memoria.abriu && memoria.apresentacoes < APRESENTACOES_MAX) {
    const n = primeiroNome(nome);
    return {
      tipo: "apresentacao",
      texto: `Oi${n ? `, ${n}` : ""}! Eu sou a Liza, a assistente do programa. Pode me perguntar sobre os guias, os encontros e as suas duplas.`,
      pergunta: perguntaPadrao,
    };
  }
  if (memoria.dicasDispensadas >= DICAS_DISPENSA_MAX) return null;
  const dica = dicaDaPagina(pagina, papeis);
  return dica ? { tipo: "dica", ...dica } : null;
}

export const FALA_PRONTO: FalaLiza = {
  tipo: "pronto",
  texto: "Respondi a sua pergunta.",
};

/** quanto a fala fica na tela sem interação (ms); `pronto` espera a abertura */
export const DURACAO_FALA: Record<FalaLiza["tipo"], number | null> = {
  apresentacao: 12_000,
  dica: 9_000,
  pronto: null,
};
