// REALIZA-417 fase 2 — tipos e derivações puras da aba Adoção.
// Os fetchers moram em lib/relatorios/adocao.ts; aqui fica só o que
// não toca banco: superfícies canônicas (denominador das "vivas"),
// rótulos de papel e as derivações testáveis (delta, pivot, ordenação).

/** Superfícies que a aba vigia — espelho dos rótulos que
 *  `superficieDoPath` (lib/produto-eventos.ts) emite. O denominador do
 *  KPI "superfícies vivas" sai daqui: uma área sem nenhum evento na
 *  janela não aparece no banco, mas precisa contar como parada.
 *  "demo" e "outros" ficam fora — demo não coleta; "outros" é ralo. */
export const SUPERFICIES: { id: string; rotulo: string }[] = [
  { id: "home", rotulo: "Home" },
  { id: "duplas", rotulo: "Duplas" },
  { id: "ficha_dupla", rotulo: "Ficha da dupla" },
  { id: "turmas", rotulo: "Turmas" },
  { id: "agenda", rotulo: "Agenda" },
  { id: "registros", rotulo: "Registros" },
  { id: "materiais", rotulo: "Materiais" },
  { id: "jovem", rotulo: "Área do jovem" },
  { id: "relatorios", rotulo: "Relatórios" },
  { id: "formularios", rotulo: "Formulários" },
  { id: "pessoas", rotulo: "Pessoas" },
  { id: "chamados", rotulo: "Chamados" },
  { id: "ia", rotulo: "Liza" },
  { id: "assistente", rotulo: "Assistente" },
  { id: "perfil", rotulo: "Perfil" },
  { id: "ajuda", rotulo: "Ajuda" },
  { id: "assinar", rotulo: "Assinatura" },
];

export const ROTULO_SUPERFICIE = new Map(SUPERFICIES.map((s) => [s.id, s.rotulo]));

/** Destino de cada superfície na tabela da aba — a linha inteira vira
 *  atalho pra área que o gesto mediu. Espelho das rotas de app/(app);
 *  ficha_dupla cai na lista /duplas (a ficha pede um id que a linha não
 *  tem). Superfície fora do mapa (evento de área aposentada) segue sem
 *  link — o nome continua visível. */
export const ROTA_SUPERFICIE: Record<string, string> = {
  home: "/",
  duplas: "/duplas",
  ficha_dupla: "/duplas",
  turmas: "/turmas",
  agenda: "/agenda",
  registros: "/registros",
  materiais: "/materiais",
  jovem: "/jovem",
  relatorios: "/relatorios/operacionais",
  formularios: "/formularios",
  pessoas: "/pessoas",
  chamados: "/chamados",
  ia: "/ia",
  assistente: "/assistente",
  perfil: "/perfil",
  ajuda: "/ajuda",
  assinar: "/assinar",
};

/** Papel gravado no evento = app_role + 'desconhecido' (fallback do RPC
 *  quando my_role() veio null). Ordem de exibição nas colunas do mapa. */
export const PAPEIS_ADOCAO: { id: string; rotulo: string }[] = [
  { id: "coordenacao", rotulo: "Coordenação" },
  { id: "mentor_dpp", rotulo: "Mentor DPP" },
  { id: "mentor_especialista", rotulo: "Especialista" },
  { id: "supervisor", rotulo: "Supervisor" },
  { id: "mentorado", rotulo: "Mentorado" },
  { id: "desconhecido", rotulo: "Sem papel" },
];

export const ROTULO_PAPEL = new Map(PAPEIS_ADOCAO.map((p) => [p.id, p.rotulo]));

// ---------- formas que as RPCs adocao_* devolvem ----------

export type ResumoAdocao = {
  ativas: number;
  ativas_prev: number;
  gestos: number;
  gestos_prev: number;
  sups_vivas: number;
  /** min(created_at) da tabela — âncora do estado "acumulando". */
  coletando_desde?: string | null;
};

export type CelulaMatriz = {
  superficie: string;
  papel: string;
  pessoas: number;
  gestos: number;
};

export type DiaSerie = {
  dia: string; // date::text
  papel: string;
  gestos: number;
  pessoas: number;
};

export type LinhaSuperficie = {
  superficie: string;
  gestos: number;
  pessoas: number;
  papeis: string[];
  ultimo: string; // timestamptz
  /** [{d: "2026-01-04", g: 12}] — série diária de gestos (spark da linha). */
  tendencia?: { d: string; g: number }[] | null;
};

export type LinhaCoorte = {
  coorte: string; // date::text — segunda-feira da semana do 1º evento
  semana: number; // 0 = a própria semana da coorte
  ativas: number;
  total: number;
};

export type Caminho = {
  de: string;
  meio: string;
  para: string;
  pessoas: number;
};

export type EventoRecente = {
  superficie: string;
  acao: string;
  papel: string;
  criado_em: string;
};

// ---------- derivações puras ----------

/** Delta honesto da régua: null quando a janela anterior era zero
 *  (÷0 não vira "∞%" nem 0%). Retorna fração — 0.12 = "+12%". */
export function deltaPct(atual: number, prev: number): number | null {
  if (prev <= 0) return null;
  return (atual - prev) / prev;
}

/** Janela da aba em dias — os chips 7/30/90 validados (valor estranho
 *  cai no default, mesmo contrato do `?turma=` dos operacionais). */
export const JANELAS = [7, 30, 90] as const;
export type Janela = (typeof JANELAS)[number];
export const JANELA_DEFAULT: Janela = 30;
export function janelaDeParam(v: string | undefined): Janela {
  const n = Number(v);
  return (JANELAS as readonly number[]).includes(n) ? (n as Janela) : JANELA_DEFAULT;
}

/** Papel da régua validado contra a whitelist (string solta na URL não
 *  vira filtro nem erro). */
export function papelDeParam(v: string | undefined): string | null {
  return v && ROTULO_PAPEL.has(v) ? v : null;
}

/** Medida da célula do mapa: pessoas únicas (adoção) × gestos
 *  (intensidade — infla com power users, por isso o default é pessoas).
 *  A régua troca a medida via `?medida=`; afeta SÓ o MapaCalor. */
export type MedidaAdocao = "pessoas" | "gestos";

/** Pivot da matriz pra grade do MapaCalor: linhas = superfícies (as
 *  canônicas primeiro, na ordem de uso; desconhecidas — superfície que
 *  sumiu do app mas ainda tem evento — entram no fim), colunas = papéis
 *  na ordem PAPEIS_ADOCAO sem os vazios. */
export type GradeMatriz = {
  linhas: { id: string; rotulo: string; total: number }[];
  colunas: { id: string; rotulo: string; total: number }[];
  /** celula[linhaId][papelId] — ausente = zero (o vazio é o dado) */
  celulas: Map<string, Map<string, number>>;
};

export function matrizParaGrade(
  celulas: CelulaMatriz[],
  medida: MedidaAdocao
): GradeMatriz {
  const valor = (c: CelulaMatriz) => (medida === "pessoas" ? c.pessoas : c.gestos);

  const porLinha = new Map<string, Map<string, number>>();
  const totLinha = new Map<string, number>();
  const totCol = new Map<string, number>();
  for (const c of celulas) {
    const v = valor(c);
    if (v <= 0) continue;
    const linha = porLinha.get(c.superficie) ?? new Map<string, number>();
    linha.set(c.papel, (linha.get(c.papel) ?? 0) + v);
    porLinha.set(c.superficie, linha);
    totLinha.set(c.superficie, (totLinha.get(c.superficie) ?? 0) + v);
    totCol.set(c.papel, (totCol.get(c.papel) ?? 0) + v);
  }

  // linhas: canônicas com evento primeiro (ordem de uso), depois
  // canônicas zeradas (a parada explícita — a pergunta da aba), e
  // desconhecidas no fim
  const comEvento = SUPERFICIES.filter((s) => totLinha.has(s.id));
  const paradas = SUPERFICIES.filter((s) => !totLinha.has(s.id));
  const desconhecidas = [...totLinha.keys()]
    .filter((id) => !ROTULO_SUPERFICIE.has(id))
    .sort();
  const linhas = [
    ...[...comEvento].sort(
      (a, b) => (totLinha.get(b.id) ?? 0) - (totLinha.get(a.id) ?? 0)
    ),
    ...paradas,
    ...desconhecidas.map((id) => ({ id, rotulo: id })),
  ].map((s) => ({
    id: s.id,
    rotulo: s.rotulo,
    total: totLinha.get(s.id) ?? 0,
  }));

  const colunas = PAPEIS_ADOCAO.filter((p) => totCol.has(p.id)).map((p) => ({
    ...p,
    total: totCol.get(p.id) ?? 0,
  }));

  return { linhas, colunas, celulas: porLinha };
}

/** Grade do CoorteGrade: uma linha por coorte (mais nova em cima),
 *  colunas semana 0..N; a % é sobre o total da própria coorte. Células
 *  futuras (semana > hoje - coorte) não existem — triângulo honesto. */
export type GradeCoorte = {
  linhas: { coorte: string; rotulo: string; total: number }[];
  semanas: number;
  /** pct[coorte][semana] = ativas/total dessa coorte (0..1) */
  pct: Map<string, Map<number, number>>;
};

export function coorteParaGrade(
  linhas: LinhaCoorte[],
  semanas: number
): GradeCoorte {
  const pct = new Map<string, Map<number, number>>();
  const totais = new Map<string, number>();
  for (const l of linhas) {
    totais.set(l.coorte, Math.max(totais.get(l.coorte) ?? 0, l.total));
    const m = pct.get(l.coorte) ?? new Map<number, number>();
    // clamp em 1: retenção >100% é impossível — sem o teto um ativas>total
    // (jitter do demo, dedupe da RPC) imprime "108%" e estoura o fill
    m.set(l.semana, l.total > 0 ? Math.min(1, l.ativas / l.total) : 0);
    pct.set(l.coorte, m);
  }
  const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
  const linhasCoorte = [...totais.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((c) => ({
      coorte: c,
      rotulo: `sem ${fmt.format(new Date(`${c}T12:00:00`))}`,
      total: totais.get(c) ?? 0,
    }));
  return { linhas: linhasCoorte, semanas, pct };
}

/** Intensidade da célula do heatmap: 0..1 na escala sequencial — com
 *  teto no máximo da grade (normalização linear; o topo é sempre a
 *  célula mais densa, o que mantém contraste em janelas pequenas). */
export function intensidades(grade: GradeMatriz): Map<string, Map<string, number>> {
  let max = 0;
  for (const [, cols] of grade.celulas)
    for (const [, v] of cols) if (v > max) max = v;
  const out = new Map<string, Map<string, number>>();
  for (const [sup, cols] of grade.celulas) {
    const m = new Map<string, number>();
    for (const [papel, v] of cols) m.set(papel, max > 0 ? v / max : 0);
    out.set(sup, m);
  }
  return out;
}
