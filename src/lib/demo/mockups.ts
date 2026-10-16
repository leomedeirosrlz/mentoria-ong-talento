// Registro das telas com mockups de layout em avaliação (rodada 1, relatório
// em docs/mockups/RELATORIO.md). Os arquivos são HTML standalone em
// public/demo/mockups/<tela>/v<N>.html — servidos direto, sem passar pelo
// app. A seleção via ?mockup=<tela>:v<N> é lida pelo MockupViewer.
// Quando uma vencedora for implementada, a linha correspondente sai daqui.

export const MOCKUP_TELAS = [
  {
    id: "agenda",
    label: "Agenda",
    descricao: "Mentor com 2 mentorados em turmas diferentes",
    variantes: ["Grade semanal", "Por mentorado", "Cards por dia"],
  },
  {
    id: "duplas",
    label: "Duplas",
    descricao: "Categorias explicadas + apoio separado do risco",
    variantes: ["Critério nos filtros", "Legenda sob demanda", "Seções por categoria"],
  },
  {
    id: "materiais",
    label: "Materiais",
    descricao: "Hub da jornada do jovem",
    variantes: ["4 portais iguais", "Jornada protagonista", "Trilha narrativa"],
  },
  {
    id: "jovem-especialistas",
    label: "Especialistas",
    descricao: "Catálogo fora da home do jovem",
    variantes: ["Aba na navegação", "Menu Mais", "Card na home"],
  },
  {
    id: "chamados",
    label: "Chamados",
    descricao: "Fila + thread da coordenação (tela nova)",
    variantes: ["Duas colunas", "Board por status", "Inbox"],
  },
] as const;

export type MockupTela = (typeof MOCKUP_TELAS)[number];

/** Lê o param ?mockup=agenda:v2 — devolve { tela, variante } ou null. */
export function parseMockupParam(
  raw: string | null,
): { tela: MockupTela; variante: 1 | 2 | 3 } | null {
  const m = raw && /^([a-z-]+):v([123])$/.exec(raw);
  if (!m) return null;
  const tela = MOCKUP_TELAS.find((t) => t.id === m[1]);
  return tela ? { tela, variante: Number(m[2]) as 1 | 2 | 3 } : null;
}
