// Telemetria do form de registro (REALIZA-217, fase 1 — medir antes de
// redesenhar). Uma sessão por abertura do RegistroForm: inicia no mount,
// bate a cada troca de etapa e a cada ~15s com atividade, conclui no
// submit bem-sucedido.
//
// FIRE-AND-FORGET ABSOLUTO: telemetria nunca bloqueia, atrasa ou falha o
// form. RPC do PostgREST é lazy — só `.then()` envia de verdade — e todo
// caminho de erro (rede, permissão, stub da demo) é engolido aqui, no
// wrapper, pra não espalhar `if demo`/try-catch pelo componente.

import { demoAtivoClient } from "@/lib/demo/shared";
import { createClient } from "@/lib/supabase/client";

/** Superfície em que o form abriu — casa com o CHECK do banco. */
export type OrigemTentativa = "novo" | "retroativo" | "edicao";
/** Heurística do client — casa com o CHECK do banco. */
export type DispositivoTentativa = "mobile" | "desktop" | "tablet";

/** Mede a experiência de tela, não o hardware — pura, recebe os sinais
 *  (o wrapper lê os globals): UA móvel/tablet primeiro (iPadOS 13+ se
 *  anuncia como Mac — o fator toque desempata), e uma janela desktop
 *  estreita conta como mobile porque é essa a leitura que o redesign
 *  "1 minuto no celular" precisa. */
export function dispositivoDe(
  ua: string,
  touchPoints: number,
  viewportWidth: number | null
): DispositivoTentativa {
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  const touchMac = /macintosh/i.test(ua) && touchPoints > 1;
  if (
    /mobi|android|iphone|ipod|blackberry|windows phone/i.test(ua) ||
    touchMac
  ) {
    return "mobile";
  }
  if (viewportWidth != null && viewportWidth < 768) return "mobile";
  return "desktop";
}

export function dispositivoAtual(): DispositivoTentativa {
  if (typeof navigator === "undefined") return "desktop";
  return dispositivoDe(
    navigator.userAgent,
    navigator.maxTouchPoints,
    typeof window === "undefined" ? null : window.innerWidth
  );
}

/** Abertura do form → uma tentativa. Devolve o id (uuid) ou null — null
 *  é "telemetria desligada" (demo, sem papel, dupla fora do escopo): as
 *  demais funções recebem o id e simplesmente não disparam. */
export async function iniciarTentativa(
  duplaId: string,
  encontroId: string,
  origem: OrigemTentativa
): Promise<string | null> {
  if (demoAtivoClient()) return null;
  try {
    const { data } = await createClient().rpc("iniciar_tentativa_registro", {
      p_dupla: duplaId,
      p_encontro: encontroId,
      p_origem: origem,
      p_dispositivo: dispositivoAtual(),
    });
    return typeof data === "string" ? data : null;
  } catch {
    return null;
  }
}

/** Heartbeat — carimba `ultima_atividade` e o tempo por etapa
 *  (`{ "1": ms, "2": ms, "3": ms }`). Sem id (iniciar não resolveu ou
 *  recusou) é no-op; erro some. */
export function atualizarTentativa(
  id: string | null,
  etapas: Record<string, number>
) {
  if (!id || demoAtivoClient()) return;
  try {
    void Promise.resolve(
      createClient().rpc("atualizar_tentativa_registro", {
        p_id: id,
        p_etapas: etapas,
      })
    ).catch(() => {});
  } catch {
    // silêncio — o form segue
  }
}

/** Submit bem-sucedido → tentativa concluída com a duração medida no
 *  cliente (abertura → gesto de salvar; o round-trip do server não conta
 *  como preenchimento). `registroId` amarra a sessão ao resultado quando
 *  disponível. */
export function concluirTentativa(
  id: string | null,
  registroId: string | null,
  duracaoMs: number
) {
  if (!id || demoAtivoClient()) return;
  try {
    void Promise.resolve(
      createClient().rpc("concluir_tentativa_registro", {
        p_id: id,
        p_registro: registroId,
        p_duracao_ms: Math.max(0, Math.round(duracaoMs)),
      })
    ).catch(() => {});
  } catch {
    // silêncio — o registro já está salvo, a métrica é secundária
  }
}
