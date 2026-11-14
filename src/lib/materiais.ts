import { linkSeguro } from "./ciclo";
import {
  docsDoEncontro,
  type CronogramaEncontros,
  type DocApoio,
} from "./como-conduzir";
import type { AppRole, Material } from "./types";
import { temPapel } from "./types";

/** Audiências possíveis de um material — uma por papel, na ordem do select.
 *  `todos` continua sendo o "para todo mundo" (inclui o jovem); os demais
 *  são cumulativos: um material pode valer pra coordenação E auxiliares. */
export const AUDIENCIAS = [
  "todos",
  "coordenacao",
  "supervisor",
  "mentor_dpp",
  "mentor_especialista",
  "mentorado",
] as const;

export type Audiencia = (typeof AUDIENCIAS)[number];

export const AUDIENCIA_LABEL: Record<Audiencia, string> = {
  todos: "Todos",
  coordenacao: "Coordenação",
  supervisor: "Auxiliar executivo",
  mentor_dpp: "Mentor DPP",
  mentor_especialista: "Mentor especialista",
  mentorado: "Mentorando(a)",
};

/** Público-alvo de um material. A coluna nova (`audiencias`) é a verdade;
 *  `audiencia` é o legado de valor único — normalizado aqui pra que demo,
 *  fixtures e rows antigas continuem lendo. */
export function audienciasDe(m: {
  audiencias?: readonly string[] | null;
  audiencia?: string | null;
}): Audiencia[] {
  const lista = (m.audiencias ?? []).filter((a): a is Audiencia =>
    (AUDIENCIAS as readonly string[]).includes(a)
  );
  if (lista.length) return lista;
  switch (m.audiencia) {
    case "dpp":
      return ["mentor_dpp"];
    case "especialista":
      return ["mentor_especialista"];
    case "coordenacao":
      return ["coordenacao"];
    default:
      return ["todos"];
  }
}

/** O material aparece pra esta pessoa? Coordenação vê tudo (a policy também
 *  libera); os demais veem `todos` ou o próprio papel (primário ou
 *  secundário — híbrido incluso). Paridade com a policy 0139: ela usa
 *  my_role() (papel primário) e aqui temPapel() inclui secundários — a
 *  divergência só existiria com um híbrido adulto+mentorado, que não há. */
export function veMaterial(
  audiencias: readonly string[],
  pessoa: { role: AppRole | null; papeis?: AppRole[] | null } | null | undefined
): boolean {
  if (!pessoa?.role) return false;
  if (audiencias.includes("todos")) return true;
  if (temPapel(pessoa, "coordenacao")) return true;
  return audiencias.some((a) => temPapel(pessoa, a as AppRole));
}

/** Materiais de UMA turma carregam o nº dela no título ("Cronograma do
 *  programa — Turma 2"). Devolve esse nº, ou null quando o material é do
 *  programa inteiro. A régua é o título porque `materiais` não tem coluna
 *  de turma — o recorte acontece na query/UI, não na RLS. */
export function turmaDoMaterial(
  titulo: string | null | undefined
): string | null {
  // dígito só: "turma da"/"turma toda" não é âncora de turma
  return titulo?.match(/\bturma\s+(\d+)\b/i)?.[1] ?? null;
}

/** Material de turma só aparece pra quem tem dupla nela. `turmas` = os nºs
 *  das turmas do recorte da pessoa (turmaDaDupla → turmaNumero); null
 *  desliga o recorte (coordenação lê o catálogo inteiro). */
export function veMaterialDaTurma(
  m: { titulo?: string | null },
  turmas: ReadonlySet<string> | null
): boolean {
  const t = turmaDoMaterial(m.titulo);
  return t == null || turmas == null || turmas.has(t);
}

/** Destino único do material: "doc:<slug>" é documento nativo (a base muda
 *  por casa — /materiais no staff, /jovem no mentorado); arquivo oficial
 *  ganha da url externa; sem os três não há link pra abrir. Resolver aqui
 *  porque o path "doc:" não passa pelo /api/material (a rota devolve 404
 *  pra ele de propósito — o PDF de storage deixou de existir na 0194). */
export function hrefMaterial(
  m: { id: string; path?: string | null; url?: string | null },
  docBase = "/materiais/documento"
): string | null {
  if (m.path?.startsWith("doc:")) return `${docBase}/${m.path.slice(4)}`;
  return m.path ? `/api/material/${m.id}` : linkSeguro(m.url);
}

/** Valor legado (`audiencia` de uma coluna) derivado do array — o código
 *  antigo que ainda estiver rodando durante o deploy continua funcionando. */
export function audienciaLegada(audiencias: readonly string[]): string {
  if (audiencias.includes("todos")) return "todos";
  if (audiencias.includes("mentor_dpp")) return "dpp";
  if (audiencias.includes("mentor_especialista")) return "especialista";
  return "coordenacao";
}

// ---------- material de apoio por encontro (REALIZA-394) ----------

/** A linha-síntese de um doc nativo: o que o encontro ganha quando o
 *  catálogo não amarra o doc ao número (linha transversal — encontro_num
 *  nulo — ou ausente). id estável `doc-<slug>`: a dedup é pelo `path`
 *  (`doc:<slug>`), então a linha real sempre vence a sintética. */
function materialDeDoc(d: DocApoio, encontroNum: number): Material {
  return {
    id: `doc-${d.slug}`,
    titulo: d.titulo,
    descricao: null,
    tipo: d.tipo,
    url: null,
    path: `doc:${d.slug}`,
    audiencia: audienciaLegada(d.audiencias) as Material["audiencia"],
    audiencias: [...d.audiencias],
    encontro_num: encontroNum,
    ordem: 40, // depois das linhas do catálogo (roteiros ordem 3–18)
  };
}

/** Completa o material de apoio de cada encontro DPP do mapa: além das
 *  linhas que o catálogo já amarra ao nº, o encontro herda os docs nativos
 *  que o guia oficial põe em jogo — o roteiro da semana, os guias dos
 *  instrumentos na janela e as técnicas que o evento nomeia (a derivação é
 *  `docsDoEncontro`, a mesma do chip de instrumento da ficha). Dedup por
 *  slug `doc:` dentro de cada lista — a linha real sempre vence. Domínio
 *  DPP: a trilha especialista não tem janelas nem roteiros neste modelo —
 *  quem chama só passa o mapa dela. */
export function enriquecerMateriaisPorEncontro(
  porNumero: Map<number, Material[]>,
  cronograma: CronogramaEncontros = []
): Map<number, Material[]> {
  const numeros = new Set<number>([
    ...porNumero.keys(),
    ...cronograma
      .filter((e) => e.tipo == null || e.tipo === "encontro")
      .map((e) => e.numero)
      .filter((n): n is number => n != null),
  ]);
  for (const n of numeros) {
    const lista = porNumero.get(n) ?? [];
    const presentes = new Set(
      lista
        .map((m) => (m.path?.startsWith("doc:") ? m.path.slice(4) : null))
        .filter((s): s is string => s != null)
    );
    const extras = docsDoEncontro(n, cronograma)
      .filter((d) => !presentes.has(d.slug))
      .map((d) => materialDeDoc(d, n));
    if (extras.length) porNumero.set(n, [...lista, ...extras]);
  }
  return porNumero;
}
