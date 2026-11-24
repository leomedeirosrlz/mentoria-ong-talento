import { FAMILIA_TIERS } from "./conquistas";
import type {
  ConquistaGlifo,
  ConquistaPhosphor,
  NivelChave,
} from "./conquistas";
import type { EstacaoChave } from "./jornada";

// Ilustração isométrica de cada glifo de conquista (016): o slug do
// arquivo em public/badges, gerado por scripts/gerar-badges.mjs. Glifo sem
// entrada (estação nova, por exemplo) fica com o emblema squircle — o
// mesmo fallback de quando o arquivo não carrega.

const PHOSPHOR: Record<ConquistaPhosphor, string> = {
  flag: "marco-primeiro",
  medal: "marco-metade",
  flagCheckered: "marco-reta-final",
  // a jornada completa é UMA peça: o marco da estante e a última faixa de
  // nível vestem o mesmo desenho
  trophy: "nivel-completa",
  listChecks: "conta-combinados",
  usersThree: "conta-especialista",
};

const ESTACAO: Partial<Record<EstacaoChave, string>> = {
  roda_inicial: "inst-roda-inicial",
  roda_formal: "inst-roda-formal",
  visao: "inst-visao",
  metas: "inst-metas",
  pdm: "inst-pdm",
  avaliacao_360: "inst-360",
  avaliacao_encontro: "conta-avaliacoes",
};

const NIVEL: Record<NivelChave, string> = {
  inicio: "nivel-inicio",
  constancia: "nivel-constancia",
  veterania: "nivel-veterania",
  completa: "nivel-completa",
};

/** Caminho público da ilustração do glifo — null quando não há desenho. */
export function arteDoGlifo(glifo: ConquistaGlifo): string | null {
  const slug =
    glifo.tipo === "phosphor"
      ? PHOSPHOR[glifo.nome]
      : glifo.tipo === "nivel"
        ? NIVEL[glifo.chave]
        : glifo.tipo === "familia"
          ? `fam-${glifo.familia}-${glifo.tier}`
          : ESTACAO[glifo.chave];
  return slug ? `/badges/${slug}.svg` : null;
}

/** Todos os caminhos registrados — o teste confere que cada um existe. */
export const ARTES_REGISTRADAS: readonly string[] = [
  ...new Set(
    [
      ...Object.values(PHOSPHOR),
      ...Object.values(ESTACAO),
      ...Object.values(NIVEL),
      ...Object.entries(FAMILIA_TIERS).flatMap(([fam, n]) =>
        Array.from({ length: n }, (_, i) => `fam-${fam}-${i + 1}`)
      ),
    ]
      .filter((s): s is string => !!s)
      .map((s) => `/badges/${s}.svg`)
  ),
];
