import { cache } from "react";
import { createClient } from "./supabase/server";
import { demoRole } from "./demo/mode";
import { demoPdmDaDupla, demoPdmResumo } from "./demo/pdm-data";
import type { PdmDoc, PdmResumo } from "./pdm";
import { resumoPdm } from "./pdm";

// Leituras do PDM vivo (REALIZA-181). A RPC pdm_da_dupla devolve o
// documento inteiro numa chamada (visão + itens planos) e aplica o escopo
// ela mesma: coord; mentor, supervisor e mentorado DA dupla. Sem PDM a
// resposta é {itens: []} — a row só nasce na primeira escrita.

/** O documento completo da dupla — null quando o papel não tem acesso
 *  (a RPC lança) ou a dupla não existe; doc vazio quando ainda não há
 *  PDM escrito (mesma semântica da RPC: null ≠ vazio). */
export const getPdmDaDupla = cache(
  async (duplaId: string): Promise<PdmDoc | null> => {
    const demo = await demoRole();
    if (demo) return demoPdmDaDupla(demo, duplaId);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("pdm_da_dupla", {
      p_dupla_id: duplaId,
    });
    if (error) {
      console.error("getPdmDaDupla:", error);
      return null;
    }
    return (data as PdmDoc | null) ?? null;
  }
);

/** O recorte pro resumo da jornada/encerramento — deriva do mesmo
 *  documento, sem RPC extra: totais + a lista de metas atingidas. Null
 *  quando não há PDM ou nenhuma meta (o bloco não renderiza). */
export const getPdmResumo = cache(
  async (duplaId: string): Promise<PdmResumo | null> => {
    const demo = await demoRole();
    if (demo) return demoPdmResumo(demo, duplaId);
    return resumoPdm(await getPdmDaDupla(duplaId));
  }
);
