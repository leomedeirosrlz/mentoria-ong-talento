"use server";

import { cookies } from "next/headers";
import { getMe } from "./queries";
import { getJovemPerfil } from "./queries-jovem";
import {
  MAX_SELOS,
  SELOS_COOKIE,
  escolhaValida,
  serializaEscolha,
} from "./selos-perfil";

/** Guarda os selos que o jovem escolheu mostrar no perfil (até 3). Hoje a
 *  escolha mora num cookie do navegador, igual ao tema; a coluna que a
 *  leva pra qualquer aparelho está proposta em specs/030-selos-perfil. */
export async function salvarSelosDoPerfil(
  chaves: string[] | null
): Promise<{ ok: true } | { error: string }> {
  // null devolve a sugestão da casa (a faixa atual e as mais recentes)
  const escolha = chaves === null ? null : escolhaValida(chaves);
  if (chaves !== null && !escolha)
    return { error: `Escolha no máximo ${MAX_SELOS} selos.` };
  const me = await getMe();
  if (!me) return { error: "Entre de novo para escolher seus selos." };
  if (escolha === null) {
    (await cookies()).delete(SELOS_COOKIE);
    return { ok: true };
  }
  const perfil = await getJovemPerfil();
  (await cookies()).set(
    SELOS_COOKIE,
    serializaEscolha(perfil?.id ?? me.id, escolha),
    {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    }
  );
  return { ok: true };
}
