// Job do tick (REALIZA-178): digest semanal da coordenação — toda segunda
// (o tick roda diário; o guard de dia-da-semana mora aqui dentro, não em
// um segundo cron). Dedup pela memória de envio em emails_enviados: uma
// row tipo='digest' com enviados>0 na semana corrente segura o re-run —
// run com o envio desligado (enviados=0) não bloqueia a próxima tentativa.
// A row de log SEMPRE grava (mesmo com enviados=0): é a auditoria de que
// o job rodou. autor_id=null no cron — não foi uma pessoa que disparou.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmailsIndividuais } from "./email";
import { montarDigestSemanal } from "./relatorios/digest";
import { semanaBounds } from "./ciclo";
import type { JobContext, JobResult } from "./jobs";

const SEGUNDA = 1; // getUTCDay: seg=1 — âncora UTC do date-only (semanaBounds)

/** Dependências injetáveis — o vitest passa fakes (admin/envar) pra
 *  exercitar guard+dedup sem banco nem Resend. */
export type DigestDeps = {
  admin?: SupabaseClient;
  enviar?: typeof enviarEmailsIndividuais;
  montar?: typeof montarDigestSemanal;
};

export async function rodarDigestSemanal(
  ctx: JobContext,
  deps: DigestDeps = {}
): Promise<JobResult> {
  const hoje = new Date(`${ctx.hoje}T12:00:00Z`);
  if (hoje.getUTCDay() !== SEGUNDA) return { ok: true, pulado: true };

  const admin = deps.admin ?? createAdminClient();
  const enviar = deps.enviar ?? enviarEmailsIndividuais;
  const montar = deps.montar ?? montarDigestSemanal;
  const semana = semanaBounds(hoje);

  // created_at é timestamptz; a semana civil é BRT — seg 00:00 de SP
  const { count, error: errDedup } = await admin
    .from("emails_enviados")
    .select("id", { count: "exact", head: true })
    .eq("tipo", "digest")
    .gt("enviados", 0)
    .gte("created_at", `${semana.seg}T00:00:00-03:00`);
  if (errDedup) return { ok: false, error: `dedup: ${errDedup.message}` };
  if ((count ?? 0) > 0) {
    return { ok: true, pulado: "já enviado esta semana" };
  }

  const digest = await montar(admin, semana);
  const envio = digest.mensagens.length
    ? await enviar({ mensagens: digest.mensagens })
    : { enviados: 0, falhas: [] as string[] };

  const { error: errLog } = await admin.from("emails_enviados").insert({
    autor_id: null,
    tipo: "digest",
    assunto: digest.assunto,
    audiencia: ["coordenacao"],
    destinatarios: digest.mensagens.length,
    enviados: envio.enviados,
    falhas: envio.falhas,
  });
  if (errLog) return { ok: false, error: `log: ${errLog.message}` };

  return {
    // falha de transporte (sem RESEND_API_KEY, kill-switch) marca o run
    // como falho — a row enviados=0 permite a próxima tentativa legítima
    ok: !envio.error,
    ...(envio.error ? { error: envio.error } : {}),
    destinatarios: digest.mensagens.length,
    enviados: envio.enviados,
    nRisco: digest.nRisco,
    nPendentes: digest.nPendentes,
  };
}
