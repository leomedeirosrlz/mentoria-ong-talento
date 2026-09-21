import { createClient } from "@/lib/supabase/server";
import { demoRole } from "./demo/mode";
import { demoAnexosPorRegistros } from "./demo/queries";
import type { RegistroAnexo } from "./types";

const ANEXO_SELECT = "*, autor:profiles!registro_anexos_created_by_fkey(nome)";

/** Anexos de evidência agrupados por registro_id — a page da dupla já tem os
 *  ids via `encontros[].registro.id` (RLS filtra sozinha no banco). */
export async function getAnexosPorRegistros(
  registroIds: string[]
): Promise<Record<string, RegistroAnexo[]>> {
  if (registroIds.length === 0) return {};
  // modo demo: anexos do dataset, agrupados por registro_id
  const demo = await demoRole();
  if (demo) return demoAnexosPorRegistros(demo, registroIds);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registro_anexos")
    .select(ANEXO_SELECT)
    .in("registro_id", registroIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const mapa: Record<string, RegistroAnexo[]> = {};
  for (const a of (data as unknown as RegistroAnexo[]) ?? []) {
    (mapa[a.registro_id] ??= []).push(a);
  }
  return mapa;
}
