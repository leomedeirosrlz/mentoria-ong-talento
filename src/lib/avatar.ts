import { createHash } from "node:crypto";

export const AVATAR_ACCEPT = ".png,.jpg,.jpeg,.webp";
/** Teto do upload de foto — o server espelha em FOTO_MAX (actions.ts). */
export const AVATAR_MAX_BYTES = 10 * 1024 * 1024;

/** "12,4 MB" / "10 MB" — tamanho legível, vírgula decimal. As duas casas
 *  só aparecem quando importam: um arquivo logo acima do teto não pode ser
 *  anunciado com o mesmo texto do limite. */
export function tamanhoMb(bytes: number): string {
  const texto = (bytes / (1024 * 1024))
    .toFixed(2)
    .replace(/\.?0+$/, "")
    .replace(".", ",");
  return `${texto} MB`;
}

/** Erro de upload com o tamanho real do arquivo e o teto — "use uma de até
 *  X MB" não dizia quanto a imagem da pessoa tinha. */
export function avisoImagemGrande(bytes: number): string {
  return `Essa imagem tem ${tamanhoMb(bytes)}. O limite é ${tamanhoMb(AVATAR_MAX_BYTES)}.`;
}

/** URL pública do bucket `avatares` — path novo a cada upload, sem cache-bust.
 *  Paths "demo/*" são os retratos locais do modo demo (public/demo/*). */
export function avatarPublicUrl(path: string): string {
  if (path.startsWith("demo/")) return `/${path}`;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatares/${path}`;
}

/** Fallback do e-mail — d=404 devolve nada quando não existe, o <Avatar>
 *  cai pra iniciais no onError. Server-only (md5 via node:crypto). */
export function gravatarUrl(email: string, size = 128): string {
  const hash = createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`;
}

/** "Thiago Costa" -> "TC" · "madalena" -> "MA" */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
