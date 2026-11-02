import { normaliza } from "@/lib/utils";
import type { AppRole, Profile } from "@/lib/types";
import {
  MENU_DO_PAPEL,
  type ItemComoFunciona,
  type PerguntaAjuda,
  type SecaoComoFunciona,
} from "./conteudo";

/** Papéis efetivos de quem lê: primário + secundários (o híbrido DPP +
 *  especialista carrega a linha extra de profile_papeis). Mesma régua do
 *  temPapel e do papeisIa do layout: quando `papeis` vem carregado ele já é
 *  o conjunto efetivo; o `role` entra por segurança e fica dedupado. */
export function papeisDe(
  me: Pick<Profile, "role" | "papeis"> | null | undefined
): AppRole[] {
  if (!me) return [];
  return [...new Set([...(me.role ? [me.role] : []), ...(me.papeis ?? [])])];
}

/** O item declara pra quais papéis vale; vale se QUALQUER papel efetivo
 *  bater — o híbrido recebe a união dos dois mundos. */
const valePara = (
  declarados: readonly AppRole[],
  papeis: readonly AppRole[]
) => papeis.some((p) => declarados.includes(p));

/** FAQ do papel: as perguntas que declaram ao menos um papel efetivo. */
export function perguntasPara(
  papeis: readonly AppRole[],
  perguntas: readonly PerguntaAjuda[]
): PerguntaAjuda[] {
  return perguntas.filter((p) => valePara(p.papeis, papeis));
}

/** Busca client-side do FAQ: casa pergunta E resposta, sem acento e sem
 *  caixa (o mesmo normaliza das outras buscas do app). Vazia devolve tudo. */
export function buscarPerguntas(
  perguntas: readonly PerguntaAjuda[],
  busca: string
): PerguntaAjuda[] {
  const q = normaliza(busca.trim());
  if (!q) return [...perguntas];
  return perguntas.filter((p) =>
    normaliza(`${p.pergunta} ${p.resposta}`).includes(q)
  );
}

/** Seções do "Como funciona" que valem pros papéis efetivos. */
export function secoesPara(
  papeis: readonly AppRole[],
  secoes: readonly SecaoComoFunciona[]
): SecaoComoFunciona[] {
  return secoes.filter((s) => valePara(s.papeis, papeis));
}

/** O mapa do menu do papel primário — quem monta a navegação é o role, não
 *  os papéis efetivos (o híbrido navega pelo shell do papel de entrada). */
export function menuDoPapel(
  papel: AppRole | null | undefined
): ItemComoFunciona[] {
  return MENU_DO_PAPEL.find((m) => m.papel === papel)?.itens ?? [];
}
