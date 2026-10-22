"use server";

import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { rastroAcesso, resumoCookie } from "@/lib/resumo-acesso";

// Desbloqueio do link público com senha (REALIZA-170). A verificação é da
// RPC abrir_relatorio (0110): bcrypt no banco, rate-limit e auditoria já
// acontecem lá — aqui só entra o cookie de conveniência, que guarda a
// senha e é revalidado a cada render (revogação/rotação derrubam na hora).

/** O cookie carrega a própria senha — não há sessão pra derrubar: cada
 *  render refaz a RPC e a senha velha morre no bcrypt. 30 dias cobre a
 *  cadência de consulta de um parceiro sem pedir a senha toda semana. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export type ResultadoDesbloqueio =
  | { ok: true }
  | { ok: false; erro: string };

/** Chamado pelo form da senha. Sempre a mesma superfície de erro pro
 *  público — o motivo interno (senha/limite/estado) mora na auditoria. */
export async function desbloquearResumo(
  slug: string,
  senha: string
): Promise<ResultadoDesbloqueio> {
  const { ipHash, ua } = await rastroAcesso();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("abrir_relatorio", {
    p_slug: slug,
    p_senha: senha || null,
    p_ip_hash: ipHash,
    p_ua: ua,
  });

  if (error) {
    Sentry.captureException(error);
    return { ok: false, erro: "Não foi possível verificar agora. Tente de novo." };
  }

  if (data?.audit_fail) {
    // auditoria quebrada não é gate pro visitante, mas é sinal de schema/
    // tabela fora do lugar — tem que chegar no Sentry
    console.error("[abrir_relatorio] audit_fail na auditoria de acesso");
    Sentry.captureMessage("resumo: auditoria de acesso falhou (audit_fail)", "warning");
  }

  if (data?.ok) {
    (await cookies()).set(resumoCookie(slug), senha, {
      path: "/resumo",
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return { ok: true };
  }

  switch (data?.motivo) {
    case "senha":
      return {
        ok: false,
        erro: "Senha incorreta. Confira com a coordenação e tente de novo.",
      };
    case "limite":
      return {
        ok: false,
        erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
      };
    case "revogado":
    case "expirado":
      return {
        ok: false,
        erro: "Este link não está mais disponível. Peça um novo à coordenação.",
      };
    default:
      // sem_link/config/erro inesperado — o visitante só precisa saber que
      // não abriu; detalhe nenhum vaza oráculo
      return {
        ok: false,
        erro: "Não foi possível abrir este relatório. Peça um novo link à coordenação.",
      };
  }
}
