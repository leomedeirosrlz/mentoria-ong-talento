// MCP server PAT helpers (REALIZA-295) — generation and label/meta
// formatting pulled out of the assistant bubble settings tab so the shared
// TokensMcp component can mount on all three issuance surfaces (coord
// bubble, staff /perfil, mentee /jovem/perfil) and vitest can cover the
// format without a DOM.
//
// The plaintext token leaves this module exactly once (the creation card);
// the database stores only its sha256 — the ia_mcp_autorizar RPC runs the
// same digest to resolve the owner. rlz_mcp_ + 24 random bytes hex: the
// prefix identifies the credential type in logs and leaks, the rest is
// entropy.

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

export type TokenMcp = {
  id: string;
  rotulo: string;
  created_at: string;
  ultimo_uso_em: string | null;
  expira_em: string | null;
};

/** rlz_mcp_ + 24 bytes → plaintext (shown once) + sha256 hex (stored). */
export async function gerarTokenMcp(): Promise<{ cru: string; hash: string }> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const cru = `rlz_mcp_${[...bytes]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(cru)
  );
  const hash = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { cru, hash };
}

/** Label when the surface has no field (bubble) or the field stayed empty —
 *  "Token dd/mm/yy". The label never reaches the DB empty (check 1..80). */
export function rotuloPadraoMcp(): string {
  return `Token ${shortDate(new Date().toISOString())}`;
}

/** The label that goes into the insert: the typed one when the surface has
 *  a field, otherwise the default. */
export function rotuloDoToken(digitado: string, padrao: string): string {
  return digitado.trim() || padrao;
}

/** List row meta: last use when it exists (the live data point), creation
 *  otherwise — plus the expiry so the owner knows when the token dies. */
export function metaTokenMcp(
  t: Pick<TokenMcp, "created_at" | "ultimo_uso_em" | "expira_em">
): string {
  const base = t.ultimo_uso_em
    ? `último uso ${shortDate(t.ultimo_uso_em)}`
    : `criado ${shortDate(t.created_at)}`;
  return t.expira_em ? `${base} · expira em ${shortDate(t.expira_em)}` : base;
}
