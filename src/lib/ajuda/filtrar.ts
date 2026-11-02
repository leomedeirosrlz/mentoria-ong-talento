import { normaliza } from "@/lib/utils";
import type { AppRole, Profile } from "@/lib/types";
import {
  MENU_DO_PAPEL,
  TEMAS_AJUDA,
  type ItemMenuPapel,
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

/** Prioridade neutra de quem não declara: a regra do tema é "dúvida mais
 *  comum primeiro", e o default não pode nem liderar nem afundar. */
const PRIORIDADE_PADRAO = 50;

/** FAQ do papel: as perguntas que declaram ao menos um papel efetivo, já
 *  ordenadas pra leitura — a ordem das seções é a de TEMAS_AJUDA e, dentro
 *  de cada tema, prioridade (menor = mais óbvia) com a ordem do array de
 *  desempate. Como a busca preserva a ordem recebida, o resultado
 *  pesquisado também sai com as dúvidas comuns primeiro. Links com
 *  `papeis` próprios passam pela mesma régua: o mesmo destino pode ter
 *  rota diferente por papel (Agenda do mentor ≠ Agenda do jovem). */
export function perguntasPara(
  papeis: readonly AppRole[],
  perguntas: readonly PerguntaAjuda[]
): PerguntaAjuda[] {
  const ordemTema = (p: PerguntaAjuda) =>
    TEMAS_AJUDA.findIndex((t) => t.id === p.tema);
  return perguntas
    .filter((p) => valePara(p.papeis, papeis))
    .map((p) =>
      p.links
        ? {
            ...p,
            links: p.links.filter(
              (l) => !l.papeis || valePara(l.papeis, papeis)
            ),
          }
        : p
    )
    .sort(
      (a, b) =>
        ordemTema(a) - ordemTema(b) ||
        (a.prioridade ?? PRIORIDADE_PADRAO) - (b.prioridade ?? PRIORIDADE_PADRAO)
    );
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

/** O mapa do menu pros papéis efetivos, na ordem recebida (papeisDe já põe
 *  o primário primeiro). O merge faz o dedup pelo rótulo do destino:
 *  rótulo repetido com texto diferente vira uma linha a mais no mesmo
 *  item — o híbrido DPP + especialista lê o que cada destino é nos dois
 *  mundos dele, em vez de ficar preso ao mapa do papel de entrada. */
export function menuDoPapel(papeis: readonly AppRole[]): ItemMenuPapel[] {
  const itens: ItemMenuPapel[] = [];
  const porRotulo = new Map<string, ItemMenuPapel>();
  for (const papel of papeis) {
    const mapa = MENU_DO_PAPEL.find((m) => m.papel === papel);
    if (!mapa) continue;
    for (const item of mapa.itens) {
      const existente = porRotulo.get(item.rotulo);
      if (!existente) {
        const novo = { rotulo: item.rotulo, textos: [item.texto] };
        porRotulo.set(item.rotulo, novo);
        itens.push(novo);
      } else if (!existente.textos.includes(item.texto)) {
        existente.textos.push(item.texto);
      }
    }
  }
  return itens;
}
