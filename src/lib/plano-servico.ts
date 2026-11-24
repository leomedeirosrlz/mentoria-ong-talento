import "server-only";

/** Insumos do planner lidos com o client de serviço (REALIZA-518): a
 *  simulação e a proposta valem pros três públicos — mentor, jovem e
 *  equipe — e o jovem não lê `duplas`/grades pela RLS. A AUTORIZAÇÃO é
 *  checada pelas RPCs do próprio chamador (o papel real mora no banco,
 *  nunca na tela); depois dela a leitura de referência é idêntica pra
 *  qualquer papel. Escrita segue só via RPCs definer — o client de
 *  serviço aqui nunca grava. */

import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { celulasComuns, celulasDe } from "./ciclo";
import { DUPLA_SELECT } from "./queries";
import type {
  CicloEvento,
  Disponibilidade,
  Dupla,
  DuplaRecesso,
} from "./types";

/** Quem chama a superfície do plano: os dois lados da dupla ou a equipe
 *  (coordenação/auxiliar via supervisiona_dupla — a RPC revalida de
 *  novo em cada escrita). */
export type LadoPlano = "mentor" | "mentorado" | "staff";

export type ContextoPlano =
  | {
      ok: true;
      lado: LadoPlano;
      dupla: Dupla;
      eventos: CicloEvento[];
      gradeMentor: Disponibilidade | null;
      gradeJovem: Disponibilidade | null;
      /** Interseção quando os dois marcaram, a grade do único lado que
       *  marcou quando só um tem — a mesma régua das sugestões. */
      combinada: Disponibilidade | null;
      /** Dias da semana com ao menos uma célula em comum — a sugestão de
       *  ritmo honesta da superfície. */
      diasComuns: number;
      /** Contato pra aviso externo (e-mail) — mentor em profiles.email,
       *  jovem em mentorados.email. */
      emails: { mentor: string | null; jovem: string | null };
    }
  | { error: string };

const primeiroNomeDe = (n: string | null | undefined) =>
  (n ?? "").trim().split(/\s+/)[0] || null;

/** A dupla no shape do planner + as grades dos dois lados, depois de
 *  provar que o chamador alcança a dupla. Qualquer falha de auth devolve
 *  error — nada vaza antes do check. */
export async function contextoPlano(
  duplaId: string,
  eventos: CicloEvento[]
): Promise<ContextoPlano> {
  const supabase = await createClient();
  const svc = createServiceClient();
  const { data: row, error: erroDupla } = await svc
    .from("duplas")
    .select(DUPLA_SELECT)
    .eq("id", duplaId)
    .maybeSingle();
  if (erroDupla) {
    console.error("contextoPlano:", erroDupla);
    return { error: "Não consegui ler essa dupla agora." };
  }
  if (!row) return { error: "Não encontrei essa dupla." };
  const dupla = row as unknown as Dupla & {
    mentor_id: string;
    mentorado_id: string;
  };

  // o papel real é o do CHAMADOR — as RPCs leem o JWT da sessão, nunca o
  // client de serviço
  const [pid, mid, sup, coord] = await Promise.all([
    supabase.rpc("my_profile_id"),
    supabase.rpc("my_mentorado_id"),
    supabase.rpc("supervisiona_dupla", { p_dupla: duplaId }),
    supabase.rpc("has_papel", { p_papel: "coordenacao" }),
  ]);
  const lado: LadoPlano | null =
    pid.data === dupla.mentor_id
      ? "mentor"
      : mid.data === dupla.mentorado_id
        ? "mentorado"
        : sup.data === true || coord.data === true
          ? "staff"
          : null;
  if (!lado) return { error: "Sem permissão pra ver o plano dessa dupla." };

  const [{ data: mp }, { data: jv }, { data: prof }] = await Promise.all([
    svc
      .from("mentor_profiles")
      .select("disponibilidade")
      .eq("profile_id", dupla.mentor_id)
      .maybeSingle(),
    svc
      .from("mentorados")
      .select("disponibilidade, email")
      .eq("id", dupla.mentorado_id)
      .maybeSingle(),
    svc
      .from("profiles")
      .select("email")
      .eq("id", dupla.mentor_id)
      .maybeSingle(),
  ]);
  const gradeMentor = (mp?.disponibilidade ?? null) as Disponibilidade | null;
  const gradeJovem = (jv?.disponibilidade ?? null) as Disponibilidade | null;
  const celM = celulasDe(gradeMentor);
  const celJ = celulasDe(gradeJovem);
  const comuns =
    celM.length && celJ.length
      ? celulasComuns(gradeMentor, gradeJovem)
      : celM.length
        ? celM
        : celJ;
  return {
    ok: true,
    lado,
    dupla,
    eventos,
    gradeMentor,
    gradeJovem,
    combinada: comuns.length ? { celulas: comuns } : null,
    diasComuns: new Set(comuns.map((c) => c.dia)).size,
    emails: { mentor: prof?.email ?? null, jovem: jv?.email ?? null },
  };
}

/** Sobrepõe as decisões em aberto na simulação: rows hipotéticas pra
 *  recessos ainda não declarados, `usa` trocado nas já declaradas. O
 *  banco só fica sabendo no gesto de confirmação — a projeção já mostra. */
export function comDecisoesRecesso(
  dupla: Dupla,
  decisoes: { cicloEventoId: string; usa: boolean }[] | undefined
): Dupla {
  if (!decisoes?.length) return dupla;
  const mapa = new Map(decisoes.map((d) => [d.cicloEventoId, d.usa]));
  const recessos: DuplaRecesso[] = [...(dupla.recessos ?? [])];
  for (const [eventoId, usa] of mapa) {
    const i = recessos.findIndex((r) => r.ciclo_evento_id === eventoId);
    if (i >= 0) recessos[i] = { ...recessos[i], usa };
    else
      recessos.push({
        id: `hipotetico-${eventoId}`,
        dupla_id: dupla.id,
        ciclo_evento_id: eventoId,
        usa,
        declarado_por: null,
        declarado_em: "",
      });
  }
  return { ...dupla, recessos };
}

/** Nome de uso dos dois lados — o e-mail e o ledger falam de gente. */
export function nomesDaDupla(dupla: Dupla): {
  mentor: string | null;
  jovem: string | null;
} {
  return {
    mentor: primeiroNomeDe(dupla.mentor?.nome_social ?? dupla.mentor?.nome),
    jovem: primeiroNomeDe(
      dupla.mentorado?.nome_social ?? dupla.mentorado?.nome
    ),
  };
}
