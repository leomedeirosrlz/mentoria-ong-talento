/** Escopo do auxiliar executivo (REALIZA-32, migration 0125).
 *
 *  Quem decide o alcance é o banco: a RLS de `duplas` entrega, pro papel
 *  supervisor, as duplas que ele supervisiona direto (supervisor_id = ele)
 *  + as da turma do escopo dele + as que ele MENTORA (supervisor+mentor é
 *  híbrido comum). O TS não reimplementa a turma — quem chama estas regras
 *  trabalha sobre listas já escopadas pela RLS. O que sobra local é tirar o
 *  lado mentor: a superfície do auxiliar é "duplas que ele supervisiona", e
 *  a dupla que ele mentora vive na visão de mentor (?visao=dpp / home). */

export type EscopoAuxiliar = "duplas" | "turma";

/** A dupla está sob supervisão de `meuId` numa lista JÁ escopada pela RLS?
 *  supervisor_id = eu mantém o vínculo direto (inclusive quem é mentor E
 *  supervisor da mesma dupla); mentor ≠ eu mantém o que a RLS entregou por
 *  turma — a dupla mentora é justamente o que sai do radar daqui. A regra
 *  pressupõe o recorte do banco: numa lista não-escopada ela não filtra
 *  dupla alheia (mentor ≠ eu seria verdade pra qualquer uma). */
export function duplaSupervisionada<
  D extends {
    supervisor?: { id: string } | null;
    mentor?: { id: string } | null;
  },
>(d: D, meuId: string): boolean {
  return d.supervisor?.id === meuId || d.mentor?.id !== meuId;
}

/** O recorte de uma linha de `profile_papeis` que a regra lê. */
export type PapelEscopo = {
  papel: string;
  escopo_turma: string | null;
  escopo_supervisao: string | null;
};

/** O que o dialog de escopo mostra: modo + a turma do grant atual. */
export type EscopoAuxiliarEstado = {
  modo: EscopoAuxiliar;
  turma: string | null;
};

/** Estado do escopo a partir das linhas de papel da pessoa — o prefill do
 *  dialog. "turma" quando existe linha supervisor com escopo_supervisao =
 *  'turma' e escopo_turma definido (a UI grava um grant só, então a
 *  primeira linha descreve o estado); todo o resto é "duplas", o padrão.
 *  Linhas de outros papéis e um 'turma' sem turma não contam — mesma régua
 *  do banco (escopo_turma null + 'turma' não vale). */
export function escopoAuxiliarDe(linhas: PapelEscopo[]): EscopoAuxiliarEstado {
  const grant = linhas.find(
    (l) =>
      l.papel === "supervisor" &&
      l.escopo_supervisao === "turma" &&
      l.escopo_turma != null
  );
  return grant
    ? { modo: "turma", turma: grant.escopo_turma }
    : { modo: "duplas", turma: null };
}
