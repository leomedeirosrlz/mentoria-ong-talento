import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "./demo/mode";
import { leRespostaDesfecho, type DesfechoEntrega } from "./desfecho";
import type { DuplaLote } from "@/components/enviar-instrumento-lote";

// Leituras do desfecho de empregabilidade (0124) — a fila do lote 6m
// pra coordenação e a resposta individual da ficha da dupla.

/** A fila do "Depois da mentoria · 6 meses": RPC coord-only
 *  desfecho_elegiveis_6m (concluídas DPP há ≥180 dias sem link 6m
 *  pendente nem respondido). Devolve no shape do lote compartilhado —
 *  contato sai só como flag, como na 0114. `detalhe` carrega a data de
 *  conclusão pra coordenar a escolha. Falha degrada pra [] (o card cai
 *  no estado vazio, não quebra a aba). */
export const getDesfechoElegiveis6m = cache(async (): Promise<DuplaLote[]> => {
  const demo = await demoRole();
  if (demo) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("desfecho_elegiveis_6m");
  if (error) {
    console.error("getDesfechoElegiveis6m:", error);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    duplaId: r.dupla_id as string,
    jovemNome: (r.jovem_nome as string) ?? "",
    mentorNome: (r.mentor_nome as string) ?? "",
    jovemTemEmail: r.jovem_tem_email === true,
    mentorTemEmail: r.mentor_tem_email === true,
    detalhe:
      typeof r.concluida_em === "string" && r.concluida_em
        ? `concluída em ${new Date(r.concluida_em).toLocaleDateString("pt-BR")}`
        : "",
  }));
});

/** As entregas do "Depois da mentoria" desta dupla — links do form
 *  oficial (sistema='desfecho') com a resposta lida quando existe.
 *  Leitura por tabela: RLS de formulario_links/respostas já é
 *  coord-only (0036), então outros papéis recebem [] pela policy e a
 *  seção some — não precisa de gate de papel aqui. Falha degrada pra
 *  [] com log, idem as leituras complementares da ficha. */
export const getDesfechoDaDupla = cache(
  async (duplaId: string): Promise<DesfechoEntrega[]> => {
    const demo = await demoRole();
    if (demo) return [];
    const supabase = await createClient();
    const { data: form, error } = await supabase
      .from("formularios")
      .select("id")
      .eq("sistema", "desfecho")
      .maybeSingle();
    if (error) {
      console.error("getDesfechoDaDupla (form):", error);
      return [];
    }
    if (!form) return [];
    const { data: links, error: e2 } = await supabase
      .from("formulario_links")
      .select(
        `id, contexto, usado_em, expira_em, created_at,
         resposta:formulario_respostas(respostas, respondido_em)`
      )
      .eq("formulario_id", form.id)
      .eq("dupla_id", duplaId)
      .order("created_at", { ascending: true });
    if (e2) {
      console.error("getDesfechoDaDupla (links):", e2);
      return [];
    }
    type LinkRaw = {
      id: string;
      contexto: Record<string, unknown> | null;
      usado_em: string | null;
      expira_em: string | null;
      created_at: string;
      resposta:
        | { respostas: unknown; respondido_em: string }
        | { respostas: unknown; respondido_em: string }[]
        | null;
    };
    const agora = Date.now();
    const out: DesfechoEntrega[] = [];
    for (const l of (links ?? []) as LinkRaw[]) {
      const momento = l.contexto?.momento;
      if (momento !== "encerramento" && momento !== "6m") continue;
      const resp = Array.isArray(l.resposta)
        ? (l.resposta[0] ?? null)
        : l.resposta;
      const status: DesfechoEntrega["status"] = l.usado_em
        ? "respondido"
        : l.expira_em && new Date(l.expira_em).getTime() <= agora
          ? "expirado"
          : "pendente";
      out.push({
        momento,
        status,
        respondido_em: resp?.respondido_em ?? l.usado_em,
        resposta: leRespostaDesfecho(resp?.respostas),
      });
    }
    return out;
  }
);
