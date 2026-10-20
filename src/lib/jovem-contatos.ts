import type { JovemContato, JovemDupla } from "./types";

/** "Vida" da dupla — o vínculo ainda em curso vence na dedupe abaixo. */
export function pesoStatusDupla(
  status: JovemDupla["status"] | undefined | null
): number {
  return status === "ativa" ? 0
    : status === "pausada" ? 1
    : status === "concluida" ? 2
    : status === "encerrada" ? 3
    : 0;
}

/** A view `jovem_contatos` repete a pessoa por dupla (mentor de duas
 *  trilhas, supervisor de três) — a linha é uma por papel, marcando a
 *  dupla mais viva. Extraído de /jovem/pessoas: a home usa o mesmo
 *  agrupamento (antes deduplicava só por filtro de dupla, e a view
 *  devolvia a pessoa repetida — React key duplicada + linha dobrada). */
export function agrupaContatosPorPessoa(
  lista: JovemContato[],
  porDupla: ReadonlyMap<
    string | null,
    { status: JovemDupla["status"]; trilha: JovemDupla["trilha"] }
  >
): JovemContato[] {
  const mapa = new Map<string, JovemContato>();
  for (const c of lista) {
    const chave = `${c.id}:${c.papel}`;
    const atual = mapa.get(chave);
    const pesoNovo = pesoStatusDupla(
      c.dupla_id ? porDupla.get(c.dupla_id)?.status : null
    );
    const pesoAtual = pesoStatusDupla(
      atual?.dupla_id ? porDupla.get(atual.dupla_id)?.status : null
    );
    if (!atual || pesoNovo < pesoAtual) mapa.set(chave, c);
  }
  return [...mapa.values()];
}
