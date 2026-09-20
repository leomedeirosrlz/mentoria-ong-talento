export { cn } from "cn"

/** minúsculas e sem acentos — "joao" encontra "João", "vila" encontra "Vila". */
export function normaliza(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
