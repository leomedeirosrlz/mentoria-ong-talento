// REALIZA-417 fase 2 — fetchers da aba Adoção. Mesmo contrato de
// dados.ts: `dados*` batem nas RPCs de agregação (0198 — o evento bruto
// nunca desce pro client) e os gêmeos `*Demo` fabricam as mesmas formas
// a partir do dataset demo (determinístico — a demo não coleta eventos
// reais, mas a aba precisa viver na demo pra review e e2e).

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PAPEIS_ADOCAO,
  SUPERFICIES,
  type Caminho,
  type CelulaMatriz,
  type DiaSerie,
  type EventoRecente,
  type LinhaCoorte,
  type LinhaEventoExport,
  type LinhaSuperficie,
  type ResumoAdocao,
} from "@/lib/adocao";
import type { DemoData } from "@/lib/demo/data";

type Supa = SupabaseClient;

// ---------- real ----------

export async function dadosAdocaoResumo(
  supabase: Supa,
  desde: Date,
  papel: string | null = null
): Promise<ResumoAdocao> {
  const { data, error } = await supabase.rpc("adocao_resumo", {
    p_desde: desde.toISOString(),
    p_papel: papel,
  });
  if (error) throw error;
  return data as ResumoAdocao;
}

export async function dadosAdocaoMatriz(
  supabase: Supa,
  desde: Date,
  papel: string | null
): Promise<CelulaMatriz[]> {
  const { data, error } = await supabase.rpc("adocao_matriz", {
    p_desde: desde.toISOString(),
    p_papel: papel,
  });
  if (error) throw error;
  return (data ?? []) as CelulaMatriz[];
}

export async function dadosAdocaoSerieDia(
  supabase: Supa,
  desde: Date,
  papel: string | null
): Promise<DiaSerie[]> {
  const { data, error } = await supabase.rpc("adocao_serie_dia", {
    p_desde: desde.toISOString(),
    p_papel: papel,
  });
  if (error) throw error;
  return (data ?? []) as DiaSerie[];
}

export async function dadosAdocaoSuperficies(
  supabase: Supa,
  desde: Date,
  papel: string | null
): Promise<LinhaSuperficie[]> {
  const { data, error } = await supabase.rpc("adocao_superficies", {
    p_desde: desde.toISOString(),
    p_papel: papel,
  });
  if (error) throw error;
  return (data ?? []) as LinhaSuperficie[];
}

export async function dadosAdocaoCoorte(
  supabase: Supa,
  semanas = 10
): Promise<LinhaCoorte[]> {
  const { data, error } = await supabase.rpc("adocao_coorte", {
    p_semanas: semanas,
  });
  if (error) throw error;
  return (data ?? []) as LinhaCoorte[];
}

export async function dadosAdocaoCaminhos(
  supabase: Supa,
  desde: Date,
  top = 8,
  papel: string | null = null
): Promise<Caminho[]> {
  const { data, error } = await supabase.rpc("adocao_caminhos", {
    p_desde: desde.toISOString(),
    p_top: top,
    p_papel: papel,
  });
  if (error) throw error;
  return (data ?? []) as Caminho[];
}

export async function dadosAdocaoRecentes(
  supabase: Supa,
  limite = 30
): Promise<EventoRecente[]> {
  const { data, error } = await supabase.rpc("adocao_recentes", {
    p_limite: limite,
  });
  if (error) throw error;
  return (data ?? []) as EventoRecente[];
}

// ---------- funil de instrumentos (emitido → respondido) ----------
// Matéria-prima real: avaliacao_links (status/respondido_em/expira_em)
// + formulario_links × formulario_respostas. "Aberto" não existe hoje
// (links anônimos não gravam abertura) — o funil é honesto em 2 etapas
// com pendente/expirado nomeados. Janela de conversão declarada: 14d.

export const FUNIL_JANELA_DIAS = 14;

export type FunilInstrumento = {
  instrumento: string;
  emitidos: number;
  respondidos: number;
  /** respondeu depois da janela de conversão — nomeado, não é pendente. */
  tardios: number;
  expirados: number;
  pendentes: number;
  /** campanha multi_uso: sem denominador observável (link aberto de
   *  divulgação — emitidos=respondidos por construção, % não informa). */
  campanha?: boolean;
};

export async function dadosFunilInstrumentos(
  supabase: Supa,
  desde: Date
): Promise<FunilInstrumento[]> {
  const iso = desde.toISOString();
  const [aRes, fRes, cRes] = await Promise.all([
    supabase
      .from("avaliacao_links")
      .select("status, respondido_em, expira_em, created_at")
      .gte("created_at", iso),
    // link manual (uso único) entra pela emissão na janela — a resposta
    // é 1:1, então o embed fica barato
    supabase
      .from("formulario_links")
      .select(
        `usado_em, expira_em, created_at,
         formularios(titulo), resposta:formulario_respostas(respondido_em)`
      )
      .eq("multi_uso", false)
      .gte("created_at", iso),
    // o de campanha (multi_uso) é mintado uma vez e segue colhendo
    // respostas — entra sempre e a janela recorta as respostas, não o
    // link. SEM o embed: com ele cada linha arrastava TODAS as respostas
    // históricas da campanha — a contagem vai na query recortada abaixo
    supabase
      .from("formulario_links")
      .select("id, formularios(titulo)")
      .eq("multi_uso", true),
  ]);
  if (aRes.error) throw aRes.error;
  if (fRes.error) throw fRes.error;
  if (cRes.error) throw cRes.error;

  // respostas da janela por link de campanha — o SQL já recorta por
  // respondido_em, então aqui só sobra o group-by por link
  const idsCampanha = (cRes.data ?? []).map((l) => l.id);
  const { data: respCampanha, error: errResp } = idsCampanha.length
    ? await supabase
        .from("formulario_respostas")
        .select("link_id, respondido_em")
        .in("link_id", idsCampanha)
        .gte("respondido_em", iso)
    : { data: [] as { link_id: string; respondido_em: string }[], error: null };
  if (errResp) throw errResp;
  const respPorLink = new Map<string, number>();
  for (const r of respCampanha ?? [])
    respPorLink.set(r.link_id, (respPorLink.get(r.link_id) ?? 0) + 1);

  const agora = Date.now();
  const janelaMs = FUNIL_JANELA_DIAS * 86400000;

  const acc = new Map<string, FunilInstrumento>();
  const slot = (nome: string) => {
    const s = acc.get(nome) ?? {
      instrumento: nome,
      emitidos: 0,
      respondidos: 0,
      tardios: 0,
      expirados: 0,
      pendentes: 0,
    };
    acc.set(nome, s);
    return s;
  };

  for (const l of aRes.data ?? []) {
    const s = slot("Avaliação do encontro");
    s.emitidos++;
    const resp =
      l.status === "respondido" && l.respondido_em != null
        ? new Date(l.respondido_em).getTime() - new Date(l.created_at).getTime()
        : null;
    if (resp != null && resp <= janelaMs) s.respondidos++;
    else if (resp != null) s.tardios++;
    else if (
      l.status === "expirado" ||
      (l.expira_em && new Date(l.expira_em).getTime() < agora)
    )
      s.expirados++;
    else s.pendentes++;
  }
  // o embed formularios(titulo) vem objeto ou array conforme a leitura
  // do PostgREST — os dois formatos resolvem igual
  const tituloDe = (l: unknown): string => {
    const emb = (
      l as {
        formularios?: { titulo?: string } | { titulo?: string }[] | null;
      }
    ).formularios;
    return (Array.isArray(emb) ? emb[0]?.titulo : emb?.titulo) ?? "Formulário";
  };

  for (const l of cRes.data ?? []) {
    // campanha (origem='intake'): 1 link, N respostas anônimas e nunca
    // carimba usado_em (0115) — contar pelo link deixaria o intake
    // "pendente" pra sempre. Cada resposta na janela é um instrumento
    // respondido; não há pool de pendentes observável em divulgação.
    const n = respPorLink.get(l.id) ?? 0;
    if (n === 0) continue;
    const s = slot(tituloDe(l));
    s.campanha = true;
    s.emitidos += n;
    s.respondidos += n;
  }
  for (const l of fRes.data ?? []) {
    const s = slot(tituloDe(l));
    s.emitidos++;
    const resp =
      l.usado_em != null
        ? new Date(l.usado_em).getTime() - new Date(l.created_at).getTime()
        : null;
    if (resp != null && resp <= janelaMs) s.respondidos++;
    else if (resp != null) s.tardios++;
    else if (l.expira_em && new Date(l.expira_em).getTime() < agora)
      s.expirados++;
    else s.pendentes++;
  }
  return [...acc.values()].sort((a, b) => b.emitidos - a.emitidos);
}

// =====================================================================
// demo — mesmas formas fabricadas deterministicamente. Escala = dataset
// demo real (profiles por papel) pra o mapa parecer o programa, não um
// punhado de zeros.
// =====================================================================

/** pseudo-aleatório determinístico por chave — a demo re-renderiza com
 *  os mesmos números (sem Math.random a cada render). */
function semeado(chave: string): number {
  let h = 2166136261;
  for (let i = 0; i < chave.length; i++) {
    h ^= chave.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function pessoasDemo(d: DemoData, papel: string): number {
  const mapa: Record<string, string[]> = {
    mentor_dpp: ["mentor_dpp"],
    mentor_especialista: ["mentor_especialista"],
    supervisor: ["supervisor"],
    coordenacao: ["coordenacao"],
    mentorado: [],
  };
  if (papel === "mentorado") return d.mentorados.length;
  return d.profiles.filter((p) =>
    (mapa[papel] ?? []).includes(p.role ?? "")
  ).length;
}

/** Matriz demo: densidade por superfície × papel com assinatura própria
 *  (ficha_dupla+mentor alta, materiais+mentorado alta, chamados quase só
 *  coord) — uma história legível, não ruído uniforme. */
const PESO_SUP: Record<string, Record<string, number>> = {
  home: { todos: 0.9 },
  ficha_dupla: { mentor_dpp: 0.95, coordenacao: 0.8, supervisor: 0.7 },
  duplas: { mentor_dpp: 0.75, coordenacao: 0.85, supervisor: 0.6 },
  agenda: { mentor_dpp: 0.85, coordenacao: 0.7, supervisor: 0.5, mentorado: 0.3 },
  registros: { mentor_dpp: 0.8, coordenacao: 0.9, supervisor: 0.65 },
  materiais: { mentor_dpp: 0.6, mentorado: 0.85, coordenacao: 0.4 },
  jovem: { mentorado: 0.9 },
  relatorios: { coordenacao: 0.75, supervisor: 0.2 },
  formularios: { coordenacao: 0.6 },
  pessoas: { coordenacao: 0.8 },
  chamados: { coordenacao: 0.5, supervisor: 0.15 },
  turmas: { coordenacao: 0.7 },
  ia: { coordenacao: 0.65, mentor_dpp: 0.3 },
  assistente: { coordenacao: 0.25, mentor_dpp: 0.1 },
  perfil: { todos: 0.25 },
  ajuda: { todos: 0.2 },
  assinar: { coordenacao: 0.45, mentor_dpp: 0.3 },
};

export function dadosAdocaoMatrizDemo(
  d: DemoData,
  janela: number
): CelulaMatriz[] {
  // os gêmeos honram a janela como a RPC faria: gestos acumulam ~linear
  // com os dias (7d ≈ 1/4 de 30d, 90d ≈ 3×); pessoas únicas crescem
  // amortecidas — quem já usava volta, não entra gente nova na mesma
  // proporção — e nunca passam da população do papel
  const fatorGestos = janela / 30;
  const fatorPessoas = Math.pow(janela / 30, 0.45);
  const out: CelulaMatriz[] = [];
  for (const sup of SUPERFICIES) {
    for (const papel of PAPEIS_ADOCAO) {
      if (papel.id === "desconhecido") continue;
      const w = PESO_SUP[sup.id] ?? {};
      const peso = w[papel.id] ?? w.todos ?? 0;
      if (peso <= 0) continue;
      const base = pessoasDemo(d, papel.id);
      // jitter largo de propósito: 0,45–1,6 separa célula quente de cauda
      // longa — uniforme demais deixava o mapa pálido e sem história
      const jit = 0.45 + semeado(`${sup.id}:${papel.id}`) * 1.15;
      const pessoas30 = base * peso * jit;
      const pessoas = Math.min(base, Math.round(pessoas30 * fatorPessoas));
      if (pessoas <= 0) continue;
      const gestos = Math.round(
        pessoas30 *
          (3 + semeado(`g:${sup.id}:${papel.id}`) * 17) *
          fatorGestos
      );
      out.push({ superficie: sup.id, papel: papel.id, pessoas, gestos });
    }
  }
  return out;
}

export function dadosAdocaoResumoDemo(
  d: DemoData,
  janela: number,
  papel: string | null = null
): ResumoAdocao {
  const matriz = dadosAdocaoMatrizDemo(d, janela).filter(
    (c) => !papel || c.papel === papel
  );
  const ativas = new Map<string, number>();
  for (const c of matriz)
    ativas.set(c.papel, (ativas.get(c.papel) ?? 0) + c.pessoas);
  // união ≠ soma das colunas — desconto de sobreposição plausível
  const ativasTotal = Math.round(
    [...ativas.values()].reduce((s, v) => s + v, 0) * 0.55
  );
  // matriz já carrega o volume da janela inteira — somar de novo por
  // dias inflaria 30× (foi o "24.900 vs 830" que brigava com o mapa)
  const gestos = matriz.reduce((s, c) => s + c.gestos, 0);
  const vivas = new Set(matriz.map((c) => c.superficie)).size;
  const fatorPrev = 0.82 + semeado("prev") * 0.2;
  return {
    ativas: ativasTotal,
    ativas_prev: Math.round(ativasTotal * fatorPrev),
    gestos,
    gestos_prev: Math.round(gestos * fatorPrev),
    sups_vivas: vivas,
    coletando_desde: new Date(
      Date.now() - 14 * 86400000
    ).toISOString(),
  };
}

export function dadosAdocaoSerieDiaDemo(
  d: DemoData,
  janela: number,
  hoje = new Date()
): DiaSerie[] {
  const matriz = dadosAdocaoMatrizDemo(d, janela);
  const gestosDia = new Map<string, number>();
  for (const c of matriz)
    gestosDia.set(
      c.papel,
      // a célula carrega o total da janela — a taxa diária é a fração
      // dela, então a soma da série ≈ resumo.gestos (consistente com o
      // herói em qualquer janela)
      (gestosDia.get(c.papel) ?? 0) +
        Math.max(1, Math.round(c.gestos / janela))
    );
  const out: DiaSerie[] = [];
  for (let i = janela - 1; i >= 0; i--) {
    const dia = new Date(hoje.getTime() - i * 86400000)
      .toISOString()
      .slice(0, 10);
    // dia morto honesto (~5%): ninguém usou — a série precisa de buraco
    // pra contar a mesma história do dado real
    if (semeado(`morto:${dia}`) < 0.05 && i > 0) continue;
    const dow = new Date(`${dia}T12:00:00`).getDay();
    const fds = dow === 0 || dow === 6 ? 0.35 : 1;
    // tendência de crescimento: dias antigos ~62% dos recentes — o
    // gráfico lê "o uso vem crescendo", não ruído estacionário
    const tend = 0.62 + ((janela - 1 - i) / Math.max(1, janela - 1)) * 0.75;
    // pico esporádico (~8%): um dia de campanha/mutirão
    const pico = semeado(`pico:${dia}`) < 0.08 ? 1.9 : 1;
    for (const [papel, base] of gestosDia) {
      const gestos = Math.round(
        base * fds * tend * pico * (0.6 + semeado(`${dia}:${papel}`) * 0.8)
      );
      if (gestos <= 0) continue;
      out.push({
        dia,
        papel,
        gestos,
        pessoas: Math.max(1, Math.round(gestos * 0.3)),
      });
    }
  }
  return out;
}

export function dadosAdocaoSuperficiesDemo(
  d: DemoData,
  janela: number
): LinhaSuperficie[] {
  const porSup = new Map<string, LinhaSuperficie>();
  for (const c of dadosAdocaoMatrizDemo(d, janela)) {
    const l = porSup.get(c.superficie) ?? {
      superficie: c.superficie,
      gestos: 0,
      pessoas: 0,
      papeis: [] as string[],
      ultimo: "",
    };
    l.gestos += c.gestos;
    l.pessoas += c.pessoas;
    if (!l.papeis.includes(c.papel)) l.papeis.push(c.papel);
    porSup.set(c.superficie, l);
  }
  const agora = Date.now();
  return [...porSup.values()]
    .map((l) => ({
      ...l,
      ultimo: new Date(
        agora - semeado(`u:${l.superficie}`) * 86400000 * 3
      ).toISOString(),
      // a tendência cobre a janela inteira (a série fixa de 14 dias
      // deixava 2/3 do spark zerado em 90d)
      tendencia: Array.from({ length: janela }, (_, i) => ({
        d: new Date(agora - (janela - 1 - i) * 86400000)
          .toISOString()
          .slice(0, 10),
        g: Math.max(
          1,
          Math.round(
            (l.gestos / janela) * (0.5 + semeado(`t:${l.superficie}:${i}`))
          )
        ),
      })),
    }))
    .sort((a, b) => b.pessoas - a.pessoas);
}

export function dadosAdocaoCoorteDemo(semanas = 10): LinhaCoorte[] {
  const out: LinhaCoorte[] = [];
  const hoje = new Date();
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7));
  for (let c = semanas - 1; c >= 0; c--) {
    const c0 = new Date(segunda.getTime() - c * 7 * 86400000);
    const chave = c0.toISOString().slice(0, 10);
    // coortes com personalidade: tamanho 5–24 e força inicial 55%–100%
    // (uma semana de onboarding fraca fica visível na primeira coluna)
    const total = 5 + Math.round(semeado(`ct:${chave}`) * 19);
    const forca = 0.55 + semeado(`cf:${chave}`) * 0.45;
    const queda = 0.05 + semeado(`cq:${chave}`) * 0.1;
    for (let s = 0; s <= c; s++) {
      const decaimento =
        s === 0 ? forca : Math.max(0.12, forca - s * queda);
      // ativas nunca passa do total da coorte — o jitter até 1,15 na
      // semana 0 fabricava "108% de retenção"
      const ativas = Math.min(
        total,
        Math.max(
          1,
          Math.round(
            total * decaimento * (0.85 + semeado(`ct:${chave}:${s}`) * 0.3)
          )
        )
      );
      out.push({ coorte: chave, semana: s, ativas, total });
    }
  }
  return out;
}

export function dadosAdocaoCaminhosDemo(
  papel: string | null = null,
  janela: number
): Caminho[] {
  const pares: [string, string, string, number][] = [
    ["home", "agenda", "ficha_dupla", 41],
    ["home", "duplas", "ficha_dupla", 38],
    ["ficha_dupla", "registros", "ficha_dupla", 27],
    ["home", "registros", "agenda", 22],
    ["jovem", "materiais", "jovem", 19],
    ["home", "materiais", "ficha_dupla", 15],
    ["agenda", "ficha_dupla", "agenda", 12],
    ["duplas", "pessoas", "ficha_dupla", 9],
    ["ajuda", "ia", "home", 7],
    ["assinar", "home", "duplas", 5],
  ];
  // com recorte de papel a lista demo encolhe pelo peso de presença do
  // papel — caminho de coordenador some quando o filtro é mentorado
  const peso: Record<string, number> = {
    mentor_dpp: 0.8,
    coordenacao: 0.7,
    mentorado: 0.6,
    supervisor: 0.4,
    mentor_especialista: 0.35,
  };
  // a contagem do caminho também é acumulado de janela — sem o fator a
  // lista ficava igual em 7d e 90d
  const fator = janela / 30;
  return pares
    .map(([de, meio, para, pessoas]) => ({
      de,
      meio,
      para,
      pessoas: Math.round(
        pessoas * (papel ? (peso[papel] ?? 0.3) : 1) * fator
      ),
    }))
    .filter((c) => c.pessoas >= 1);
}

export function dadosAdocaoRecentesDemo(janela: number): EventoRecente[] {
  const agora = Date.now();
  // mistura de ações e superfícies — o feed com pageview atrás de
  // pageview lê como log, não como pulse do produto
  const base: [string, string, string][] = [
    ["ficha_dupla", "pageview", "mentor_dpp"],
    ["ia", "dialog", "coordenacao"],
    ["agenda", "pageview", "mentor_dpp"],
    ["materiais", "material_aberto", "mentorado"],
    ["registros", "busca", "coordenacao"],
    ["formularios", "form_emitido", "coordenacao"],
    ["jovem", "pageview", "mentorado"],
    ["duplas", "sort", "coordenacao"],
    ["home", "pageview", "supervisor"],
    ["ficha_dupla", "lembrete_whatsapp", "coordenacao"],
    ["registros", "pageview", "mentor_dpp"],
    ["pessoas", "busca", "coordenacao"],
    ["agenda", "pageview", "mentor_especialista"],
    ["ficha_dupla", "nudge", "coordenacao"],
    ["ajuda", "pageview", "mentor_dpp"],
    ["assinar", "pageview", "mentorado"],
  ];
  // janela menor = menos gesto acumulado pra exibir — o feed encolhe
  // junto em vez de repetir os mesmos 12 em qualquer recorte
  const n = Math.max(
    3,
    Math.min(base.length, Math.round((base.length * janela) / 30))
  );
  // espaçamento irregular (2–95min) — intervalo fixo lia como mock;
  // o topo fica quase sempre "há minutos", não já velho
  let atraso = 0;
  return base.slice(0, n).map(([superficie, acao, papel], i) => {
    atraso += 2 + Math.round(semeado(`gap:${superficie}:${i}`) * 93);
    return {
      superficie,
      acao,
      papel,
      criado_em: new Date(agora - atraso * 60000).toISOString(),
    };
  });
}

export function dadosFunilInstrumentosDemo(): FunilInstrumento[] {
  return [
    {
      instrumento: "Avaliação do encontro",
      emitidos: 96,
      respondidos: 61,
      tardios: 8,
      expirados: 15,
      pendentes: 12,
    },
    {
      instrumento: "Intake do mentor",
      emitidos: 18,
      respondidos: 14,
      tardios: 3,
      expirados: 1,
      pendentes: 0,
    },
    {
      instrumento: "Intake da comunidade (campanha)",
      emitidos: 23,
      respondidos: 23,
      tardios: 0,
      expirados: 0,
      pendentes: 0,
      campanha: true,
    },
    {
      instrumento: "Roda de conversa (presença)",
      emitidos: 12,
      respondidos: 7,
      tardios: 1,
      expirados: 2,
      pendentes: 2,
    },
    {
      // instrumento fraco de propósito — o funil só conta história se
      // houver contraste: este converte 1 em 5 e expira quase tudo
      instrumento: "Guia de bolso (pulse)",
      emitidos: 24,
      respondidos: 5,
      tardios: 2,
      expirados: 14,
      pendentes: 3,
    },
  ];
}

/** Cru demo do export (fase B): a matriz agregada vira linhas de
 *  evento — o explorador da aba mastiga o mesmo parquet no modo demo.
 *  Distribuição determinística: gestos espalhados pela janela com
 *  jitter hash (mesma regra dos irmãos), ação pesada pra pageview,
 *  profile_id cíclico dentro do pool do papel. `limite` escala
 *  proporcionalmente — a forma do dataset se mantém em qualquer teto. */
const PAPEL_DEMO_ROLES: Record<string, string[]> = {
  coordenacao: ["coordenacao"],
  mentor_dpp: ["mentor_dpp"],
  mentor_especialista: ["mentor_especialista"],
  supervisor: ["supervisor"],
};

const ACOES_PESO: [string, number][] = [
  ["pageview", 68],
  ["busca", 10],
  ["sort", 8],
  ["dialog", 6],
  ["material_aberto", 4],
  ["nudge", 2],
  ["form_emitido", 1],
  ["lembrete_whatsapp", 1],
];

export function dadosAdocaoEventosDemo(
  d: DemoData,
  janela: number,
  limite: number
): LinhaEventoExport[] {
  const matriz = dadosAdocaoMatrizDemo(d, janela);
  const totalGestos = matriz.reduce((s, c) => s + c.gestos, 0);
  const fator = totalGestos > 0 ? Math.min(1, limite / totalGestos) : 0;

  // pools de pessoas por papel — mentorado usa profile_id quando há
  // (conta vinculada 0066) ou o próprio id da linha como identificador
  const poolPorPapel = new Map<string, string[]>();
  for (const [papel, roles] of Object.entries(PAPEL_DEMO_ROLES)) {
    poolPorPapel.set(
      papel,
      d.profiles.filter((p) => roles.includes(p.role ?? "")).map((p) => p.id)
    );
  }
  poolPorPapel.set(
    "mentorado",
    d.mentorados.map((m) => m.profile_id ?? m.id)
  );

  const agora = Date.now();
  const janelaMs = janela * 86400000;
  const out: LinhaEventoExport[] = [];
  let seq = 0;
  for (const c of matriz) {
    const n = Math.round(c.gestos * fator);
    const pool = poolPorPapel.get(c.papel) ?? [];
    if (n <= 0 || pool.length === 0) continue;
    for (let i = 0; i < n; i++) {
      const chave = `${c.superficie}:${c.papel}:${i}`;
      // espalha pela janela com jitter horário — sem o espalhamento o
      // histograma do explorador virava um bloco só
      const frac = (i + semeado(`e:${chave}`)) / n;
      const criado = new Date(agora - janelaMs * (1 - frac));
      const a = semeado(`a:${chave}`) * 100;
      let acao = "pageview";
      let acc = 0;
      for (const [nome, peso] of ACOES_PESO) {
        acc += peso;
        if (a <= acc) {
          acao = nome;
          break;
        }
      }
      out.push({
        id: `de000000-0000-4000-8000-${String(seq++).padStart(12, "0")}`,
        profile_id: pool[Math.floor(semeado(`p:${chave}`) * pool.length)]!,
        papel: c.papel,
        superficie: c.superficie,
        acao,
        meta:
          acao === "busca"
            ? { q: "exemplo" }
            : acao === "pageview"
              ? { path: `/${c.superficie}` }
              : {},
        created_at: criado,
      });
    }
  }
  return out.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
}
