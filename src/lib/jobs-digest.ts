// Job do tick (REALIZA-178, configurável na 451): digest da coordenação.
// O tick roda diário; o guard de dia e a cadência moram aqui dentro, não
// em um segundo cron. Sem row na digest_config vale o padrão — segunda,
// semanal, coordenação, todas as seções — o comportamento original.
//
// Dedup pela memória de envio em emails_enviados: uma row tipo='digest'
// com enviados>0 na janela segura o re-run — semanal olha a semana civil
// corrente; quinzenal olha os últimos 14 dias (a âncora é o próprio
// último envio). Run com o envio desligado (enviados=0) não bloqueia a
// próxima tentativa. A row de log SEMPRE grava (mesmo com enviados=0):
// é a auditoria de que o job rodou. autor_id=null no cron — não foi uma
// pessoa que disparou.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmailsIndividuais } from "./email";
import {
  lerDigestConfig,
  montarDigestSemanal,
} from "./relatorios/digest";
import { semanaBounds } from "./ciclo";
import type { JobContext, JobResult } from "./jobs";

const QUINZENAL_DIAS = 14;

/** Dependências injetáveis — o vitest passa fakes (admin/envar/lerConfig)
 *  pra exercitar guard+dedup sem banco nem Resend. */
export type DigestDeps = {
  admin?: SupabaseClient;
  enviar?: typeof enviarEmailsIndividuais;
  montar?: typeof montarDigestSemanal;
  lerConfig?: typeof lerDigestConfig;
};

export async function rodarDigestSemanal(
  ctx: JobContext,
  deps: DigestDeps = {}
): Promise<JobResult> {
  const hoje = new Date(`${ctx.hoje}T12:00:00Z`);

  const admin = deps.admin ?? createAdminClient();
  const enviar = deps.enviar ?? enviarEmailsIndividuais;
  const montar = deps.montar ?? montarDigestSemanal;
  const config = await (deps.lerConfig ?? lerDigestConfig)(admin);

  if (config.cadencia === "desligado") {
    return { ok: true, pulado: "digest desligado na configuração" };
  }
  // o dia vem da config (default 1 = segunda) — âncora UTC do date-only
  if (hoje.getUTCDay() !== config.diaSemana) return { ok: true, pulado: true };

  const semana = semanaBounds(hoje);

  // created_at é timestamptz; a semana civil é BRT — seg 00:00 de SP.
  // Quinzenal ancora no último envio: 14 dias sem envio liberam a próxima
  // edição (run falho grava enviados=0 e não atrasa a cadência).
  const desde =
    config.cadencia === "quinzenal"
      ? new Date(hoje.getTime() - QUINZENAL_DIAS * 86400000).toISOString()
      : `${semana.seg}T00:00:00-03:00`;
  const { count, error: errDedup } = await admin
    .from("emails_enviados")
    .select("id", { count: "exact", head: true })
    .eq("tipo", "digest")
    .gt("enviados", 0)
    .gte("created_at", desde);
  if (errDedup) return { ok: false, error: `dedup: ${errDedup.message}` };
  if ((count ?? 0) > 0) {
    return {
      ok: true,
      pulado:
        config.cadencia === "quinzenal"
          ? "quinzenal — último envio há menos de 14 dias"
          : "já enviado esta semana",
    };
  }

  const digest = await montar(admin, semana, undefined, config);
  const envio = digest.mensagens.length
    ? await enviar({ mensagens: digest.mensagens })
    : { enviados: 0, falhas: [] as string[] };

  const { error: errLog } = await admin.from("emails_enviados").insert({
    autor_id: null,
    tipo: "digest",
    assunto: digest.assunto,
    audiencia: digest.audiencia,
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
