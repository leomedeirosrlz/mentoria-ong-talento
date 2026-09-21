export { cn } from "cn"

/** minúsculas e sem acentos — "joao" encontra "João", "vila" encontra "Vila". */
export function normaliza(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Só paths internos: "/" sozinho ou "/" + algo que não seja "/" nem "\" —
 *  "//host" e "/\host" normalizam pra externo no URL parser (open redirect). */
export function pathInterno(p: string | null | undefined): string | null {
  if (p === "/") return p;
  return p != null && /^\/[^/\\]/.test(p) ? p : null;
}
