import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "./demo/mode";
import { demoEncerramentoDaDupla } from "./demo/encerramento-data";
import { demoAvaliacao360DaDupla } from "./demo/forms-data";
import type { Encerramento } from "./types";

/** O encerramento da dupla (0 ou 1 — unique(dupla_id)). Legível por
 *  coordenação + mentor/supervisor da dupla (policy encerramentos_select);
 *  a row pode existir antes da decisão, só com a autoavaliação do mentor.
 *  Falha degrada pra null (a seção some da ficha) — com log, como as demais
 *  leituras complementares. */
export const getEncerramentoDaDupla = cache(
  async (duplaId: string): Promise<Encerramento | null> => {
    // modo demo: encerramento fake só no escopo do papel
    const demo = await demoRole();
    if (demo) return demoEncerramentoDaDupla(demo, duplaId);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("encerramentos")
      .select(
        `id, dupla_id, tipo, checklist, autoavaliacao_mentor,
         disponivel_proximo_ciclo, resumo_jornada, decidido_por, created_at,
         decidido:profiles!encerramentos_decidido_por_fkey(nome)`
      )
      .eq("dupla_id", duplaId)
      .maybeSingle();
    if (error) {
      console.error("getEncerramentoDaDupla:", error);
      return null;
    }
    if (!data) return null;
    const row = data as Record<string, unknown>;
    // embed to-one pode voltar como array no tipo do supabase-js
    const emb = Array.isArray(row.decidido) ? row.decidido[0] : row.decidido;
    return {
      ...(row as unknown as Encerramento),
      decidido: (emb as { nome: string } | null) ?? null,
    };
  }
);

/** Data da resposta 360º mais recente da dupla — derivação por join
 *  (resposta ← link ← form oficial), sem coluna nova em encerramentos: o
 *  checklist é vocabulário fechado e a resposta já sabe a que dupla/link
 *  pertence. null = nenhuma resposta oficial (marcação manual antiga) ou
 *  papel sem acesso aos forms — a UI só omite o "via formulário em dd/mm". */
export const getAvaliacao360DaDupla = cache(
  async (duplaId: string): Promise<string | null> => {
    const demo = await demoRole();
    // demo: a resposta 360º da Luiza (dupla d-fim) — o "via formulário em
    // dd/mm" do checklist aparece na ficha como na real
    if (demo) return demoAvaliacao360DaDupla(demo, duplaId);
    const supabase = await createClient();
    const { data: form, error } = await supabase
      .from("formularios")
      .select("id")
      .eq("sistema", "avaliacao_360")
      .maybeSingle();
    if (error) {
      console.error("getAvaliacao360DaDupla (form):", error);
      return null;
    }
    if (!form) return null;
    const { data, error: e2 } = await supabase
      .from("formulario_respostas")
      .select("respondido_em, link:formulario_links!inner(id)")
      .eq("link.dupla_id", duplaId)
      .eq("link.formulario_id", form.id)
      .order("respondido_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (e2) {
      console.error("getAvaliacao360DaDupla:", e2);
      return null;
    }
    return (data?.respondido_em as string | undefined) ?? null;
  }
);
