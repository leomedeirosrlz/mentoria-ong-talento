import type { createClient } from "@/lib/supabase/server";

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Fan-out de notificações in-app — um insert em lote. A RLS escopa pelo
 *  papel do destinatário (coord → qualquer um; demais → só staff). Falha vira
 *  console.error, não erro da ação: a notificação é complemento, e o autor
 *  nunca se auto-notifica. Compartilhada entre actions.ts e os demais módulos
 *  server-side (ex.: fluxo de especialista). */
export async function notificar(
  supabase: Supa,
  rows: {
    profile_id: string | null | undefined;
    tipo: string;
    titulo: string;
    corpo?: string | null;
    href?: string | null;
    comunicado_id?: string | null;
  }[],
  autorId: string
) {
  const limpos = rows
    .filter((r): r is typeof r & { profile_id: string } => !!r.profile_id)
    .filter((r) => r.profile_id !== autorId);
  if (!limpos.length) return;
  const { error } = await supabase
    .from("notificacoes")
    .insert(limpos.map((r) => ({ ...r, created_by: autorId })));
  if (error) console.error("notificar: falha ao gravar notificações", error);
}
