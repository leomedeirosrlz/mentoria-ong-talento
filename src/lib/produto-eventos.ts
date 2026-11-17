// REALIZA-417 — analytics de adoção in-house: tipos e mapeamento
// pathname → superfície do beacon. Sem imports de servidor — este módulo
// entra no bundle client inteiro via produto-telemetry.

/** Whitelist da RPC registrar_produto_eventos (0197) — acao nova pede
 *  migration de uma linha + esta lista. */
export type AcaoProduto =
  | "pageview"
  | "clique"
  | "busca"
  | "sort"
  | "dialog"
  | "nudge"
  | "form_emitido"
  | "material_aberto"
  | "lembrete_whatsapp";

export interface EventoProduto {
  superficie: string;
  acao: AcaoProduto;
  meta?: Record<string, unknown>;
}

/** pathname → superfície estável de analytics. Uma entrada por área do
 *  produto — o que o relatório de adoção agrega. Ids dinâmicos colapsam
 *  na área (a ficha não gera superfície por dupla). */
export function superficieDoPath(pathname: string): string {
  if (pathname === "/") return "home";
  const seg = pathname.split("/").filter(Boolean);
  const raiz = seg[0] ?? "";
  switch (raiz) {
    case "duplas":
      return seg.length > 1 ? "ficha_dupla" : "duplas";
    case "jovem":
      return "jovem";
    case "materiais":
      return "materiais";
    case "agenda":
      return "agenda";
    case "registros":
      return "registros";
    case "relatorios":
      return "relatorios";
    case "formularios":
      return "formularios";
    case "pessoas":
      return "pessoas";
    case "chamados":
      return "chamados";
    case "comunicados":
      return "comunicados";
    case "perfil":
      return "perfil";
    case "onboarding":
      return "onboarding";
    case "ia":
      return "ia";
    case "demo":
      return "demo";
    default:
      return raiz || "outros";
  }
}
