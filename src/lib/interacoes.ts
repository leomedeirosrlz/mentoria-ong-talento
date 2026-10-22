import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "./demo/mode";
import { demoUltimasInteracoes } from "./demo/queries";

// tipos locais — interacoes ainda não entra em types.ts
export type InteracaoTipo = "nudge" | "contato" | "apoio";
// 0094 — 'in_app': o lembrete nasce na plataforma; o wa.me aberto junto é a
// entrega, não um segundo contato
export type InteracaoCanal = "whatsapp" | "email" | "outro" | "in_app";

export type Interacao = {
  dupla_id: string;
  tipo: InteracaoTipo;
  canal: InteracaoCanal;
  created_at: string;
  /** Autor do contato — vem do embed `autor:profiles!interacoes_autor_id_fkey(nome)`. */
  autor: { nome: string } | null;
};

/** Último contato registrado em cada dupla — Record indexado por dupla_id.
 *  O select vem ordenado desc; a primeira ocorrência de cada dupla é a mais
 *  recente. `tipo` filtra no SQL — o cap de 48h precisa do último NUDGE; um
 *  'contato' mais novo que o nudge esconderia o bloqueio da UI (o server
 *  segura, mas o botão habilitado mente). */
export const getUltimasInteracoes = cache(
  async (
    duplaIds: string[],
    tipo?: InteracaoTipo
  ): Promise<Record<string, Interacao>> => {
    if (duplaIds.length === 0) return {};
    // modo demo: últimas interações do dataset, restritas às duplas pedidas
    const demo = await demoRole();
    if (demo) return demoUltimasInteracoes(demo, duplaIds, tipo);
    const supabase = await createClient();
    let q = supabase
      .from("interacoes")
      .select(
        "dupla_id, tipo, canal, created_at, autor:profiles!interacoes_autor_id_fkey(nome)"
      )
      .in("dupla_id", duplaIds)
      .order("created_at", { ascending: false });
    if (tipo) q = q.eq("tipo", tipo);
    const { data, error } = await q;
    if (error) throw error;
    const ultimas: Record<string, Interacao> = {};
    for (const row of (data ?? []) as unknown as Interacao[]) {
      ultimas[row.dupla_id] ??= row;
    }
    return ultimas;
  }
);
