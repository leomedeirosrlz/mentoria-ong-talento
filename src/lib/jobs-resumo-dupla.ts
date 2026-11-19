import { createAdminClient } from "@/lib/supabase/admin";
import { DUPLA_SELECT } from "@/lib/queries";
import { montarResumoDupla } from "@/lib/dupla-resumo";
import type { JobResult } from "./jobs";
import type { CicloEvento, Dupla } from "@/lib/types";

const LOTE = 400;

/** Ciclo de vida do plano "ficar em dia" (0219): expira propostas
 *  vencidas e conclui quem cobriu o escopo. service_role only, mesmo
 *  desenho de produto_eventos_reter — roda no tick diário e o re-run é
 *  inócuo (já expirado/concluído sai do filtro). */
export async function rodarPlanoCiclo(): Promise<JobResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("plano_ciclo");
  if (error) return { ok: false, error: `plano_ciclo: ${error.message}` };
  return { ok: true, transicoes: typeof data === "number" ? data : 0 };
}

/** Resumo consolidado por dupla (0221 — REALIZA-459): alimenta a tool
 *  `resumo_dupla` e o painel da Liza. Determinístico + hash estável: o
 *  tick só re-escreve a linha quando a fonte mudou, então `gerado_em`
 *  continua significando "quando o conteúdo mudou". Um registro ruim vai
 *  pra `erros[]` sem apagar o resto do lote. */
export async function rodarResumoDuplas(): Promise<JobResult> {
  const admin = createAdminClient();
  const [duplasRes, eventosRes, atuaisRes] = await Promise.all([
    admin
      .from("duplas")
      .select(DUPLA_SELECT)
      .in("status", ["ativa", "pausada"])
      .order("created_at", { ascending: true }),
    admin
      .from("ciclo_eventos")
      .select("*")
      .order("ordem", { ascending: true }),
    admin.from("dupla_resumo_ia").select("dupla_id, fontes_hash"),
  ]);
  if (duplasRes.error)
    return { ok: false, error: `duplas: ${duplasRes.error.message}` };
  if (eventosRes.error)
    return { ok: false, error: `ciclo_eventos: ${eventosRes.error.message}` };
  if (atuaisRes.error)
    return { ok: false, error: `resumos: ${atuaisRes.error.message}` };

  const duplas = (duplasRes.data ?? []) as unknown as Dupla[];
  const eventos = (eventosRes.data ?? []) as CicloEvento[];
  const hashAtual = new Map(
    (atuaisRes.data ?? []).map((r) => [r.dupla_id as string, r.fontes_hash])
  );

  const erros: { alvo: string; erro: string }[] = [];
  const rows: { dupla_id: string; resumo: unknown; fontes_hash: string }[] = [];
  const ref = new Date();
  for (const d of duplas) {
    try {
      const { resumo, fontes_hash } = montarResumoDupla(d, eventos, ref);
      if (hashAtual.get(d.id) !== fontes_hash)
        rows.push({ dupla_id: d.id, resumo, fontes_hash });
    } catch (e) {
      erros.push({
        alvo: d.id,
        erro: e instanceof Error ? e.message : String(e),
      });
    }
  }

  let upserts = 0;
  for (let i = 0; i < rows.length; i += LOTE) {
    const { data, error } = await admin.rpc("gravar_resumo_duplas", {
      p_rows: rows.slice(i, i + LOTE),
    });
    if (error) {
      erros.push({ alvo: `lote ${i / LOTE}`, erro: error.message });
    } else {
      upserts += typeof data === "number" ? data : 0;
    }
  }

  return {
    ok: erros.length === 0,
    duplas: duplas.length,
    alteradas: rows.length,
    upserts,
    ...(erros.length ? { erros } : {}),
  };
}
