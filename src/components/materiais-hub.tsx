import { linkSeguro } from "@/lib/ciclo";
import type { CicloEvento, Material } from "@/lib/types";

// Utilidades puras da biblioteca: particionar por encontro, régua de
// "tem conteúdo" e títulos dos encontros por número. A UI mora em
// biblioteca-lista.tsx (lista única, REALIZA-210).

// seções do bloco transversal — cada tipo cai no rótulo do próprio tipo
const GRUPO_TIPO = {
  guia: "Guias",
  template: "Modelos gerais",
  conteudo: "Conteúdos",
  link: "Links",
} as const;

/** Material com destino real: arquivo oficial no bucket ou link http(s)
 *  válido. Sem os dois é o "em breve" — estado legítimo (materiais chegam
 *  ao longo do ciclo), não erro. Exportada: a faixa de KPIs e a contagem
 *  "com material" da trilha usam a mesma régua (REALIZA-184). */
export function temConteudo(m: Material): boolean {
  return m.path != null || linkSeguro(m.url) != null;
}

/** Separa o catálogo visível: materiais datados por encontro (1..teto do
 *  cronograma, com qualquer nº fora dele que já exista nos dados) ×
 *  transversais (sem encontro_num) agrupados por tipo na ordem do GRUPO_TIPO. */
export function particionarMateriais(
  materiais: Material[],
  maxEncontro: number
) {
  const porEncontro = new Map<number, Material[]>();
  const porTipo = new Map<Material["tipo"], Material[]>();
  for (const m of materiais) {
    if (m.encontro_num != null) {
      const lista = porEncontro.get(m.encontro_num) ?? [];
      lista.push(m);
      porEncontro.set(m.encontro_num, lista);
    } else {
      const lista = porTipo.get(m.tipo) ?? [];
      lista.push(m);
      porTipo.set(m.tipo, lista);
    }
  }
  const teto = Math.max(maxEncontro, 0, ...porEncontro.keys());
  const nums = Array.from({ length: teto }, (_, i) => i + 1);
  const transversais = (Object.keys(GRUPO_TIPO) as (keyof typeof GRUPO_TIPO)[])
    .filter((t) => porTipo.has(t))
    .map((t) => ({ tipo: t, itens: porTipo.get(t)! }));
  return { porEncontro, nums, transversais };
}

/** Título do encontro no calendário oficial — só quando todos os cronogramas
 *  concordam no nº (título divergente entre turmas não se exibe, pra não
 *  prometer a semana errada no summary). */
export function titulosPorNumero(eventos: CicloEvento[]): Map<number, string> {
  const vistos = new Map<number, string | false>();
  for (const e of eventos) {
    if (e.tipo !== "encontro" || e.numero == null) continue;
    const prev = vistos.get(e.numero);
    if (prev === undefined) vistos.set(e.numero, e.titulo);
    else if (prev !== e.titulo) vistos.set(e.numero, false);
  }
  const mapa = new Map<number, string>();
  for (const [n, t] of vistos) if (t !== false) mapa.set(n, t);
  return mapa;
}

