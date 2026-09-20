import { createHash } from "node:crypto";

export const AVATAR_ACCEPT = ".png,.jpg,.jpeg,.webp";
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** URL pública do bucket `avatares` — path novo a cada upload, sem cache-bust. */
export function avatarPublicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatares/${path}`;
}

/** Fallback do e-mail — d=404 devolve nada quando não existe, o <Avatar>
 *  cai pra iniciais no onError. Server-only (md5 via node:crypto). */
export function gravatarUrl(email: string, size = 128): string {
  const hash = createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`;
}

/** "Thiago Costa" -> "TC" · "madalena" -> "M" */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}
