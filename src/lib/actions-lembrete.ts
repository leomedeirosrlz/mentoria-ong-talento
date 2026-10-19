"use server";

import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "./demo/mode";

export type LembreteDestino = "mentor" | "mentorado";

/** "Lembrar" (D5): notificação in-app + registro em `interacoes`, com cap de
 *  1 lembrete por dupla a cada 48h (qualquer autor). A RPC `enviar_lembrete`
 *  (0094) é a única porta — valida papel, estado da dupla e o intervalo.
 *  `ctx` é o texto honesto que a UI montou a partir do contexto da dupla
 *  (sem encontro, atraso, registro pendente…). */
export async function enviarLembrete(
  duplaId: string,
  destino: LembreteDestino,
  ctx: { titulo: string; corpo: string; href: string }
): Promise<
  | { ok: true; demo?: boolean }
  | { error: string; bloqueadoAte?: string }
> {
  // no demo o botão continua vivo pra mostrar o fluxo, mas nada sai de verdade
  if (await demoAtivo()) return { ok: true, demo: true };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("enviar_lembrete", {
    p_dupla_id: duplaId,
    p_destino: destino,
    p_titulo: ctx.titulo,
    p_corpo: ctx.corpo,
    p_href: ctx.href,
  });
  if (error) {
    console.error("enviarLembrete:", error);
    return { error: "Não consegui enviar o lembrete agora." };
  }
  const r = data as
    | { ok: true }
    | { ok: false; erro: string; bloqueado_ate?: string };
  if (r.ok) return { ok: true };
  switch (r.erro) {
    case "intervalo_48h":
      return {
        error: "Essa dupla já recebeu um lembrete nas últimas 48h.",
        bloqueadoAte: r.bloqueado_ate,
      };
    case "sem_permissao":
      return { error: "Você só pode lembrar as suas duplas." };
    case "dupla_inativa":
      return { error: "Só dá pra lembrar dupla ativa." };
    default:
      return { error: "Não consegui enviar o lembrete agora." };
  }
}
