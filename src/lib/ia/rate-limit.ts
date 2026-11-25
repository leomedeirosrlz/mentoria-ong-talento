// Rate limit da camada de IA (sdd D3, liza-pacote-2026-11): a RPC
// consumir_limite_ia faz check+insert do evento 'mensagem' sob advisory lock
// por profile — o TOCTOU do desenho anterior (contava aqui, inseria dentro do
// stream) deixava um burst paralelo estourar o teto junto; agora N requests
// simultâneos viram N veredictos sequenciais. O evento 'mensagem' inserido é
// também a reserva que a contagem mede — request negado não entra no ledger.
// O request_id devolvido correlaciona os eventos seguintes da mesma request
// (tools + resumo de telemetria).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/types";
import type { CanalIa } from "./tools";

export type VeredictoLimite =
  | { permitido: true; usados: number; requestId: string }
  | { permitido: false; usados: number };

/** Consome um slot do limite (default 20/60s por profile, compartilhado entre
 *  chat e MCP). permitido=false → responder 429. Falha na RPC BLOQUEIA
 *  (fail-closed): em serverless não há estado local pra provar baixa
 *  atividade, e liberar com o DB degradado abre custo de LLM sem teto — o
 *  429 é recuperável com retry do cliente (o componente já trata). */
export async function consumirLimiteIa(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  canal: CanalIa = "chat",
  limite = 20
): Promise<VeredictoLimite> {
  const { data, error } = await supabase.rpc("consumir_limite_ia", {
    p_args: args,
    p_limite: limite,
    p_canal: canal,
  });
  if (error) {
    console.error("consumirLimiteIa:", error);
    return { permitido: false, usados: limite };
  }
  const r = (Array.isArray(data) ? data[0] : data) as
    | { permitido: boolean; usados: number; request_id: string }
    | undefined;
  if (!r?.permitido || !r.request_id) {
    return { permitido: false, usados: r?.usados ?? limite };
  }
  return { permitido: true, usados: r.usados, requestId: r.request_id };
}

export type ContextoIa =
  | { status: "sem_cadastro" }
  | { status: "negado"; usados: number }
  | {
      status: "ok";
      profileId: string;
      role: AppRole | null;
      papeis: AppRole[];
      usados: number;
      requestId: string;
    };

/** Chat: identidade (profile ativo + papel + papéis efetivos) e a reserva do
 *  limite numa RPC só (ia_contexto_e_limite, 0160) — mesma régua do
 *  consumirLimiteIa. Erro da RPC segue fail-closed como "negado" (429
 *  recuperável), não "sem_cadastro": um 401 mandaria a pessoa pro login à
 *  toa com o banco só degradado. */
export async function contextoELimiteIa(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  limite = 20
): Promise<ContextoIa> {
  const { data, error } = await supabase.rpc("ia_contexto_e_limite", {
    p_args: args,
    p_limite: limite,
    p_canal: "chat",
  });
  if (error) {
    console.error("contextoELimiteIa:", error);
    return { status: "negado", usados: limite };
  }
  const r = (Array.isArray(data) ? data[0] : data) as
    | {
        profile_id: string | null;
        role: AppRole | null;
        papeis: AppRole[] | null;
        permitido: boolean;
        usados: number;
        request_id: string | null;
      }
    | undefined
    | null;
  if (!r?.profile_id) return { status: "sem_cadastro" };
  if (!r.permitido || !r.request_id) {
    return { status: "negado", usados: r.usados ?? limite };
  }
  return {
    status: "ok",
    profileId: r.profile_id,
    role: r.role,
    papeis: r.papeis ?? [],
    usados: r.usados,
    requestId: r.request_id,
  };
}
