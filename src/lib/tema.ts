// Preferência de tema (REALIZA-192) — núcleo isomórfico, SEM imports de
// next/*: entra no bundle do browser (tema-toggle) e é lido no server
// (layout + páginas de perfil resolvem a classe do <html> via cookie).

/** Preferência persistida: "auto" segue o SO, "claro"/"escuro" forçam. */
export type Tema = "auto" | "claro" | "escuro";

export const TEMA_COOKIE = "tema";

/** Interpreta o valor do cookie — qualquer coisa fora do enum vira "auto". */
export function temaValido(v: string | undefined | null): Tema {
  return v === "claro" || v === "escuro" ? v : "auto";
}

/** A preferência resolve pra escuro? Explícito vence; "auto" segue o SO. */
export function resolveEscuro(tema: Tema, prefereEscuro: boolean): boolean {
  return tema === "escuro" || (tema === "auto" && prefereEscuro);
}

/** Script inline do <head> (inline pra rodar antes da primeira pintura e
 *  o `auto` não piscar claro em SO escuro): lê data-tema do <html> — já
 *  emitido pelo layout com o valor do cookie — e acende .dark quando a
 *  resolução dá escuro. CSP libera inline ('unsafe-inline' no script-src). */
export const TEMA_SCRIPT = `(function(){try{var d=document.documentElement;var t=d.getAttribute("data-tema")||"auto";if(t==="escuro"||(t!=="claro"&&window.matchMedia("(prefers-color-scheme: dark)").matches)){d.classList.add("dark")}}catch(e){}})()`;

// --- lado client (document.cookie é legível de propósito: preferência de
// UI, não credencial — igual aos cookies demo_*) ---

export function lerTemaClient(): Tema {
  if (typeof document === "undefined") return "auto";
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${TEMA_COOKIE}=`));
  return temaValido(raw?.slice(raw.indexOf("=") + 1));
}

export function gravarTemaClient(tema: Tema) {
  if (typeof document === "undefined") return;
  // um ano, path raiz; Secure só em https (dev local é http)
  document.cookie = `${TEMA_COOKIE}=${tema}; path=/; max-age=31536000; samesite=lax${
    location.protocol === "https:" ? "; secure" : ""
  }`;
}

/** Aplica imediatamente: classe no <html> + data-tema (o TemaSync e o
 *  script inline do próximo carregamento leem daí). O cookie já deve ter
 *  sido gravado antes — o router.refresh() re-renderiza o layout com ele. */
export function aplicarTemaDom(tema: Tema) {
  const d = document.documentElement;
  d.setAttribute("data-tema", tema);
  d.classList.toggle(
    "dark",
    resolveEscuro(tema, window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}
