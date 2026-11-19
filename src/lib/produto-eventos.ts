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
  | "lembrete_whatsapp"
  | "permanencia"
  | "rolagem"
  // plano ficar em dia (459): gestos de adoção do combinado — proposta,
  // resposta, passo aplicado, intervenção e ajuste de guia
  | "plano_proposto"
  | "plano_aceito"
  | "plano_contestado"
  | "plano_passo"
  | "plano_intervencao"
  | "plano_guia";

/** Marcos de profundidade do gesto `rolagem` (REALIZA-453): o evento
 *  grava SÓ o maior marco alcançado na estadia — nunca fração contínua
 *  nem um gesto por pixel de scroll. 0 = a página rolava e a pessoa não
 *  passou do primeiro quarto (o denominador limpo do "quem lê o fim"). */
export const MARCOS_ROLAGEM = [0, 25, 50, 75, 100] as const;
export type MarcoRolagem = (typeof MARCOS_ROLAGEM)[number];

/** Fração rolada (0..1) → maior marco atingido. Fora de [0,1] clampa.
 *  Os quartos usam floor (só conta quem CRUZOU a marca); o fundo vale a
 *  partir de 98% — scrollY fracionário (pinch, DPR) quase nunca bate
 *  exatamente 1 no rodapé. */
export function marcoRolagem(frac: number): MarcoRolagem {
  const f = Number.isFinite(frac) ? Math.min(1, Math.max(0, frac)) : 0;
  if (f >= 0.98) return 100;
  const pct = Math.floor(f * 100);
  if (pct >= 75) return 75;
  if (pct >= 50) return 50;
  if (pct >= 25) return 25;
  return 0;
}

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
