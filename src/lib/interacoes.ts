import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// tipos locais — interacoes ainda não entra em types.ts
export type InteracaoTipo = "nudge" | "contato" | "apoio";
export type InteracaoCanal = "whatsapp" | "email" | "outro";

export type Interacao = {
  dupla_id: string;
  tipo: InteracaoTipo;
  canal: InteracaoCanal;
  created_at: string;
  /** Autor do contato — vem do embed `autor:profiles!interacoes_autor_id_fkey(nome)`. */
  autor: { nome: string } | null;
};

/** Último contato registrado em cada dupla — Record indexado por dupla_id.
 *  O select vem ordenado desc; a primeira ocorrência de cada dupla é a mais recente. */
export const getUltimasInteracoes = cache(
  async (duplaIds: string[]): Promise<Record<string, Interacao>> => {
    if (duplaIds.length === 0) return {};
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("interacoes")
      .select(
        "dupla_id, tipo, canal, created_at, autor:profiles!interacoes_autor_id_fkey(nome)"
      )
      .in("dupla_id", duplaIds)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const ultimas: Record<string, Interacao> = {};
    for (const row of (data ?? []) as unknown as Interacao[]) {
      ultimas[row.dupla_id] ??= row;
    }
    return ultimas;
  }
);
