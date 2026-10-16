// Registro das telas com mockups de layout em avaliação (rodada 1, relatório
// em docs/mockups/RELATORIO.md). Os arquivos são HTML standalone em
// public/demo/mockups/<tela>/v<N>.html — servidos direto, sem passar pelo
// app. A seleção via ?mockup=<tela>:v<N> é lida pelo MockupViewer.
// Quando uma vencedora for implementada, a linha correspondente sai daqui.

type MockupTelaDef = {
  id: string;
  label: string;
  descricao: string;
  rotas: readonly string[];
  variantes: readonly string[];
};

export const MOCKUP_TELAS: readonly MockupTelaDef[] = [
  {
    id: "agenda",
    label: "Agenda",
    descricao: "Mentor com 2 mentorados em turmas diferentes",
    rotas: ["/agenda"],
    variantes: [
      "Grade semanal",
      "Por mentorado",
      "Cards por dia",
      "R2 · Duas superfícies",
      "R2 · Por pessoa",
    ],
  },
  {
    id: "duplas",
    label: "Duplas",
    descricao: "Categorias explicadas + apoio separado do risco",
    rotas: ["/duplas"],
    variantes: ["Critério nos filtros", "Legenda sob demanda", "Seções por categoria"],
  },
  {
    id: "materiais",
    label: "Materiais",
    descricao: "Hub da jornada do jovem",
    rotas: ["/jovem/materiais"],
    variantes: ["4 portais iguais", "Jornada protagonista", "Trilha narrativa"],
  },
  {
    id: "jovem-especialistas",
    label: "Especialistas",
    descricao: "Catálogo fora da home do jovem",
    rotas: ["/jovem"],
    variantes: [
      "Aba na navegação",
      "Menu Mais",
      "Card na home",
      "R2 · Trilha explícita",
      "R2 · Estados do pedido",
    ],
  },
  {
    id: "chamados",
    label: "Chamados",
    descricao: "Fila + thread da coordenação (tela nova)",
    // sem rota real ainda — entrada só pelo catálogo do popover da DemoBar
    rotas: [],
    variantes: ["Duas colunas", "Board por status", "Inbox"],
  },
];

export type MockupTela = (typeof MOCKUP_TELAS)[number];

/** Lê o param ?mockup=agenda:v2 — devolve { tela, variante } ou null. */
export function parseMockupParam(
  raw: string | null,
): { tela: MockupTela; variante: number } | null {
  const m = raw && /^([a-z-]+):v(\d+)$/.exec(raw);
  if (!m) return null;
  const tela = MOCKUP_TELAS.find((t) => t.id === m[1]);
  const v = Number(m[2]);
  return tela && v >= 1 && v <= tela.variantes.length
    ? { tela, variante: v }
    : null;
}

/** Tela de mockup associada à rota real atual (ex.: /duplas → "duplas") —
 *  é o que faz o switch da variante aparecer dentro da própria tela. */
export function telaPorRota(pathname: string): MockupTela | null {
  return MOCKUP_TELAS.find((t) => t.rotas.includes(pathname)) ?? null;
}
