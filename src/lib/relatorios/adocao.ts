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
  const [aRes, fRes] = await Promise.all([
    supabase
      .from("avaliacao_links")
      .select("status, respondido_em, expira_em, created_at")
      .gte("created_at", iso),
    supabase
      .from("formulario_links")
      .select(
        `usado_em, expira_em, created_at, multi_uso,
         formularios(titulo), resposta:formulario_respostas(respondido_em)`
      )
      // link manual entra pela emissão na janela; o de campanha
      // (multi_uso) é mintado uma vez e segue colhendo respostas —
      // entra sempre e a janela recorta as respostas, não o link
      .or(`multi_uso.eq.true,created_at.gte.${iso}`),
  ]);
  if (aRes.error) throw aRes.error;
  if (fRes.error) throw fRes.error;

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
  const desdeMs = desde.getTime();
  for (const l of fRes.data ?? []) {
    // os embeds formularios(titulo) e resposta:formulario_respostas vêm
    // objeto (n:1 — resposta tem unique em link_id) ou array conforme a
    // leitura do PostgREST — os dois formatos resolvem igual
    const emb = (
      l as {
        formularios?: { titulo?: string } | { titulo?: string }[] | null;
      }
    ).formularios;
    const titulo =
      (Array.isArray(emb) ? emb[0]?.titulo : emb?.titulo) ?? "Formulário";
    const embResp = (
      l as {
        resposta?:
          | { respondido_em?: string | null }
          | { respondido_em?: string | null }[]
          | null;
      }
    ).resposta;
    const respostas = Array.isArray(embResp)
      ? embResp
      : embResp
        ? [embResp]
        : [];

    if ((l as { multi_uso?: boolean }).multi_uso === true) {
      // campanha (origem='intake'): 1 link, N respostas anônimas e nunca
      // carimba usado_em (0115) — contar pelo link deixaria o intake
      // "pendente" pra sempre. Cada resposta na janela é um instrumento
      // respondido; não há pool de pendentes observável em divulgação.
      const n = respostas.filter(
        (r) => r.respondido_em != null && new Date(r.respondido_em).getTime() >= desdeMs
      ).length;
      if (n === 0) continue;
      const s = slot(titulo);
      s.campanha = true;
      s.emitidos += n;
      s.respondidos += n;
      continue;
    }

    const s = slot(titulo);
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
      const jit = 0.7 + semeado(`${sup.id}:${papel.id}`) * 0.6;
      const pessoas30 = base * peso * jit;
      const pessoas = Math.min(base, Math.round(pessoas30 * fatorPessoas));
      if (pessoas <= 0) continue;
      const gestos = Math.round(
        pessoas30 *
          (4 + semeado(`g:${sup.id}:${papel.id}`) * 10) *
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
    const dow = new Date(`${dia}T12:00:00`).getDay();
    const fds = dow === 0 || dow === 6 ? 0.35 : 1;
    for (const [papel, base] of gestosDia) {
      const gestos = Math.round(
        base * fds * (0.6 + semeado(`${dia}:${papel}`) * 0.8)
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
    const total = 6 + Math.round(semeado(`ct:${chave}`) * 14);
    for (let s = 0; s <= c; s++) {
      const decaimento = s === 0 ? 1 : Math.max(0.15, 0.85 - s * 0.09);
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
  const base: [string, string, string][] = [
    ["ficha_dupla", "pageview", "mentor_dpp"],
    ["agenda", "pageview", "mentor_dpp"],
    ["registros", "busca", "coordenacao"],
    ["materiais", "material_aberto", "mentorado"],
    ["jovem", "pageview", "mentorado"],
    ["duplas", "sort", "coordenacao"],
    ["home", "pageview", "supervisor"],
    ["ia", "dialog", "coordenacao"],
    ["registros", "pageview", "mentor_dpp"],
    ["ficha_dupla", "nudge", "coordenacao"],
    ["pessoas", "busca", "coordenacao"],
    ["agenda", "pageview", "mentorado"],
  ];
  // janela menor = menos gesto acumulado pra exibir — o feed encolhe
  // junto em vez de repetir os mesmos 12 em qualquer recorte
  const n = Math.max(
    3,
    Math.min(base.length, Math.round((base.length * janela) / 30))
  );
  return base.slice(0, n).map(([superficie, acao, papel], i) => ({
    superficie,
    acao,
    papel,
    criado_em: new Date(agora - (i + 1) * 7 * 60000).toISOString(),
  }));
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
  ];
}
