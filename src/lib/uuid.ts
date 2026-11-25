/** uuid v4 com fallback pra contexto não-seguro: `crypto.randomUUID` só
 *  existe em contexto seguro (https / localhost) — via http://IP (dev na
 *  LAN/Tailscale) a função some e o call site quebra em runtime.
 *  `getRandomValues` sobrevive em qualquer contexto, então o v4 manual é
 *  o plano B. Server-side o randomUUID existe sempre — mesma API nos dois. */
export function novoUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
