import { toDateStr } from "./ciclo";
import type { Dupla, Encontro } from "./types";

/** Uma remarcação achatada pra listagem: o encontro afetado, o vaivém da
 *  data e o motivo declarado na hora (0153 — a row crua mora em
 *  `encontro.remarcacoes`, vinda do embed da DUPLA_SELECT). */
export type RemarcacaoItem = {
  encontro: Encontro;
  numero: number;
  data_anterior: string;
  data_nova: string;
  motivo: string | null;
  created_at: string;
};

/** Quantas vezes cada encontro da dupla foi remarcado — chave = id do
 *  encontro. O agendamento inicial não entra: a trilha só grava mudança
 *  de data. O total da dupla é a soma dos valores; encontro nunca
 *  remarcado não vira chave (ausência = 0). */
export function contagemRemarcacoes(dupla: Dupla): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of dupla.encontros ?? []) {
    const n = e.remarcacoes?.length ?? 0;
    if (n) out.set(e.id, n);
  }
  return out;
}

/** Remarcações FEITAS no mês — `created_at` caindo em `ano`/`mes`
 *  (1–12), no fuso do programa — em todas as duplas do recorte. É a
 *  régua do relatório mensal da coordenação: o vaivém na ordem em que
 *  aconteceu, não a data para a qual o encontro foi empurrado. */
export function remarcacoesDoMes(
  duplas: Dupla[],
  ano: number,
  mes: number
): RemarcacaoItem[] {
  const alvo = `${ano}-${String(mes).padStart(2, "0")}`;
  const out: RemarcacaoItem[] = [];
  for (const d of duplas) {
    for (const e of d.encontros ?? []) {
      for (const r of e.remarcacoes ?? []) {
        if (r.created_at && toDateStr(new Date(r.created_at)).startsWith(alvo)) {
          out.push({
            encontro: e,
            numero: e.numero,
            data_anterior: r.data_anterior,
            data_nova: r.data_nova,
            motivo: r.motivo,
            created_at: r.created_at,
          });
        }
      }
    }
  }
  out.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return out;
}
