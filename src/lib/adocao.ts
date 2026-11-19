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

/** Evento cru lido direto de `produto_eventos` pros painéis ricos
 *  (REALIZA-454): a mesma linha do export, com meta tipado como objeto —
 *  o parser do PostgREST já devolve jsonb como objeto. */
export type EventoCru = {
  profile_id: string;
  papel: string;
  superficie: string;
  acao: string;
  meta: Record<string, unknown> | null;
  created_at: string; // timestamptz
};

/** Linha do export parquet (fase B — /api/adocao/export): espelho do
 *  cru `produto_eventos`, já com created_at em Date pro TIMESTAMP do
 *  parquet. O export nunca embute profile (nome é PII a mais, não a
 *  menos) — quem cruza puxa por profile_id. */
export type LinhaEventoExport = {
  id: string;
  profile_id: string;
  papel: string;
  superficie: string;
  acao: string;
  meta: unknown;
  created_at: Date;
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

// =====================================================================
// REALIZA-453/454 — derivações puras dos painéis ricos da aba Adoção.
// Mesma normalização dos presets do explorador (adocao-sql.ts): o heatmap
// é fx/fy = floor(pos/viewport * 10) clampado 0..9; percentis e marcos
// são derivação em TS sobre o cru — o que é conta fica em TS, não em RPC.
// =====================================================================

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Cliques com x/y/vw/vh válidos → grade 10×10 por superfície.
 *  `grade[fy][fx]` = toques na célula. pessoas = profile_id distintos. */
export type HeatmapCliques = {
  grade: number[][];
  toques: number;
  pessoas: number;
};

export function heatmapCliques(eventos: EventoCru[]): Map<string, HeatmapCliques> {
  const out = new Map<string, HeatmapCliques>();
  for (const e of eventos) {
    if (e.acao !== "clique" || !e.meta) continue;
    const x = num(e.meta.x);
    const y = num(e.meta.y);
    const vw = num(e.meta.vw);
    const vh = num(e.meta.vh);
    if (x == null || y == null || !vw || !vh) continue;
    const fx = Math.min(9, Math.max(0, Math.floor((x / vw) * 10)));
    const fy = Math.min(9, Math.max(0, Math.floor((y / vh) * 10)));
    const h = out.get(e.superficie) ?? {
      grade: Array.from({ length: 10 }, () => Array(10).fill(0)),
      toques: 0,
      pessoas: 0,
    };
    h.grade[fy]![fx]!++;
    h.toques++;
    out.set(e.superficie, h);
  }
  const pessoasPor = new Map<string, Set<string>>();
  for (const e of eventos) {
    if (e.acao !== "clique") continue;
    const s = pessoasPor.get(e.superficie) ?? new Set<string>();
    s.add(e.profile_id);
    pessoasPor.set(e.superficie, s);
  }
  for (const [sup, h] of out) h.pessoas = pessoasPor.get(sup)?.size ?? 0;
  return out;
}

function percentil(ordenada: number[], q: number): number {
  if (ordenada.length === 0) return 0;
  const i = (ordenada.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return ordenada[lo]! + (ordenada[hi]! - ordenada[lo]!) * (i - lo);
}

/** Gestos de permanência → estatística por superfície: mediana + faixa
 *  p25–p75 da duração das estadias. `estadias` é o denominador honesto —
 *  uma permanencia = uma estadia (não uma sessão nem uma pessoa). */
export type TempoTela = {
  superficie: string;
  mediana_ms: number;
  p25_ms: number;
  p75_ms: number;
  estadias: number;
};

export function tempoPorTela(eventos: EventoCru[]): TempoTela[] {
  const porSup = new Map<string, number[]>();
  for (const e of eventos) {
    if (e.acao !== "permanencia" || !e.meta) continue;
    const dur = num(e.meta.dur_ms);
    if (dur == null || dur <= 0) continue;
    const arr = porSup.get(e.superficie) ?? [];
    arr.push(dur);
    porSup.set(e.superficie, arr);
  }
  return [...porSup.entries()]
    .map(([superficie, durs]) => {
      durs.sort((a, b) => a - b);
      return {
        superficie,
        mediana_ms: Math.round(percentil(durs, 0.5)),
        p25_ms: Math.round(percentil(durs, 0.25)),
        p75_ms: Math.round(percentil(durs, 0.75)),
        estadias: durs.length,
      };
    })
    .sort((a, b) => b.mediana_ms - a.mediana_ms);
}

/** Gestos de rolagem → % de visitas roláveis que alcançou cada marco, por
 *  superfície. O denominador são os eventos de rolagem — cada um marca
 *  uma estadia em página rolável com o MAIOR marco atingido (0..100), um
 *  por saída. prof>=M conta pro marco M (atingir 75 implica 25 e 50). */
export type ProfundidadeSup = {
  superficie: string;
  visitas: number;
  /** pct[25] = fração de visitas que chegou a pelo menos 25% da página */
  pct: Record<25 | 50 | 75 | 100, number>;
};

export function profundidadeRolagem(eventos: EventoCru[]): ProfundidadeSup[] {
  const porSup = new Map<string, { visitas: number; atingiu: Record<number, number> }>();
  for (const e of eventos) {
    if (e.acao !== "rolagem" || !e.meta) continue;
    const prof = num(e.meta.prof);
    if (prof == null) continue;
    const acc = porSup.get(e.superficie) ?? {
      visitas: 0,
      atingiu: { 25: 0, 50: 0, 75: 0, 100: 0 },
    };
    acc.visitas++;
    for (const m of [25, 50, 75, 100]) if (prof >= m) acc.atingiu[m]!++;
    porSup.set(e.superficie, acc);
  }
  return [...porSup.entries()]
    .map(([superficie, a]) => ({
      superficie,
      visitas: a.visitas,
      pct: {
        25: a.visitas ? a.atingiu[25]! / a.visitas : 0,
        50: a.visitas ? a.atingiu[50]! / a.visitas : 0,
        75: a.visitas ? a.atingiu[75]! / a.visitas : 0,
        100: a.visitas ? a.atingiu[100]! / a.visitas : 0,
      } as ProfundidadeSup["pct"],
    }))
    .sort((a, b) => b.visitas - a.visitas);
}

/** Pessoas distintas no cru, pra alimentar o seletor do drill — ordena
 *  por volume de gestos e rotula com o mapa de nomes quando houver. */
export type PessoaAtiva = {
  profile_id: string;
  papel: string;
  gestos: number;
  nome?: string;
};

export function pessoasAtivas(
  eventos: EventoCru[],
  nomes?: Map<string, string>,
  limite = 20
): PessoaAtiva[] {
  const acc = new Map<string, PessoaAtiva>();
  for (const e of eventos) {
    const p = acc.get(e.profile_id) ?? {
      profile_id: e.profile_id,
      papel: e.papel,
      gestos: 0,
    };
    p.gestos++;
    if (p.papel === "desconhecido" && e.papel !== "desconhecido")
      p.papel = e.papel;
    acc.set(e.profile_id, p);
  }
  return [...acc.values()]
    .sort((a, b) => b.gestos - a.gestos)
    .slice(0, limite)
    .map((p) => ({ ...p, nome: nomes?.get(p.profile_id) }));
}

/** Verbo da ação no feed e na trilha ("clicou em", "ficou em"). O mapa
 *  vive aqui porque os dois consumidores (GestosVivos, PaineisRicos)
 *  leem do mesmo conjunto — ação nova da whitelist ganha rótulo num
 *  lugar só. */
export const ROTULO_ACAO: Record<string, string> = {
  pageview: "visitou",
  clique: "clicou em",
  busca: "buscou",
  sort: "ordenou",
  dialog: "abriu a Liza em",
  nudge: "enviou lembrete em",
  form_emitido: "emitiu formulário em",
  material_aberto: "abriu material em",
  lembrete_whatsapp: "lembrete WhatsApp em",
  permanencia: "ficou em",
  rolagem: "rolou em",
};

/** Trilha de uma pessoa na janela: os gestos dela em ordem cronológica —
 *  o preset "jornada" do explorador, sem SQL. */
export type GestoTrilha = {
  superficie: string;
  acao: string;
  criado_em: string;
  /** resumo da meta pra exibição: "45s", "75%", "cta: nova-dupla"… */
  detalhe?: string;
};

function fmtDur(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const min = Math.floor(ms / 60_000);
  const seg = Math.round((ms % 60_000) / 1000);
  return seg > 0 ? `${min}min ${seg}s` : `${min}min`;
}

export function fmtDuracao(ms: number): string {
  return fmtDur(ms);
}

export function trilhaPessoa(
  eventos: EventoCru[],
  profileId: string
): GestoTrilha[] {
  return eventos
    .filter((e) => e.profile_id === profileId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((e) => {
      let detalhe: string | undefined;
      if (e.acao === "permanencia") {
        const d = num(e.meta?.dur_ms);
        if (d != null && d > 0) detalhe = fmtDur(d);
      } else if (e.acao === "rolagem") {
        const p = num(e.meta?.prof);
        if (p != null) detalhe = `${p}% da página`;
      } else if (e.acao === "clique") {
        const a = e.meta?.alvo;
        if (typeof a === "string" && a) detalhe = a;
      }
      return {
        superficie: e.superficie,
        acao: e.acao,
        criado_em: e.created_at,
        ...(detalhe ? { detalhe } : {}),
      };
    });
}
