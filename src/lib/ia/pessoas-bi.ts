// BI demográfico da Liza (onda 5): agrega em JS só o que a sessão já lê
// por RLS. As colunas sensíveis vêm das views coord-only *_pessoal; data de
// nascimento entra no servidor unicamente pra virar faixa — nunca sai no
// payload. Jovem conta pela ficha `mentorados` (a conta role='mentorado'
// em profiles é excluída, mesma régua de getContagemPessoas).

import type { SupabaseClient } from "@supabase/supabase-js";
import { papelLabel } from "@/lib/ciclo";
import type { AppRole, Genero, Trilha } from "@/lib/types";

export type DimensaoPessoasBi =
  | "estado"
  | "genero"
  | "faixa_idade"
  | "papel"
  | "trilha";
export type FaixaIdade = "ate_17" | "18_24" | "25_34" | "35_mais";

export type FiltrosPessoasBi = {
  papel?: AppRole;
  uf?: string;
  genero?: Genero;
  faixa_idade?: FaixaIdade;
  trilha?: Trilha;
  incluir_inativas?: boolean;
};

export type PessoaBi = {
  id: string;
  nome: string;
  papel: AppRole | null;
  papeis: AppRole[];
  trilhas: Trilha[];
  uf: string | null;
  genero: Genero | null;
  data_nascimento: string | null;
};

export const FAIXAS_IDADE: Record<FaixaIdade, string> = {
  ate_17: "Até 17 anos",
  "18_24": "18 a 24 anos",
  "25_34": "25 a 34 anos",
  "35_mais": "35 anos ou mais",
};

/** Faixa etária na data de referência — aniversário ainda não cumprido
 *  conta na faixa anterior. */
export function faixaIdadeDe(
  dataNascimento: string | null | undefined,
  referencia = new Date()
): FaixaIdade | null {
  if (!dataNascimento) return null;
  const nasc = new Date(`${dataNascimento}T00:00:00Z`);
  if (Number.isNaN(nasc.getTime())) return null;
  let idade = referencia.getUTCFullYear() - nasc.getUTCFullYear();
  const mes = referencia.getUTCMonth() - nasc.getUTCMonth();
  if (mes < 0 || (mes === 0 && referencia.getUTCDate() < nasc.getUTCDate())) {
    idade -= 1;
  }
  if (idade < 0) return null;
  if (idade <= 17) return "ate_17";
  if (idade <= 24) return "18_24";
  if (idade <= 34) return "25_34";
  return "35_mais";
}

export function rotuloGenero(g: Genero | null): string {
  switch (g) {
    case "feminino": return "Feminino";
    case "masculino": return "Masculino";
    case "nao_binario": return "Não binário";
    case "outro": return "Outro";
    case "prefiro_nao_dizer": return "Prefere não dizer";
    default: return "Não informado";
  }
}

const rotuloTrilha = (t: Trilha | null) =>
  t === "dpp" ? "DPP" : t === "especialista" ? "Especialista" : "Sem trilha viva";

export function rotuloDaChave(dim: DimensaoPessoasBi, chave: string): string {
  if (chave === "__nao_informado") return "Não informado";
  if (dim === "estado") return chave;
  if (dim === "genero") return rotuloGenero(chave as Genero);
  if (dim === "faixa_idade") return FAIXAS_IDADE[chave as FaixaIdade] ?? "Não informada";
  if (dim === "papel") return papelLabel(chave);
  return rotuloTrilha(chave === "sem_trilha" ? null : (chave as Trilha));
}

type RowNome = { id: string | null; nome: string | null; nome_social: string | null; uf: string | null };

function nomeDe(r: RowNome): string {
  return (r.nome_social || r.nome || "Sem nome").trim();
}

/** Linhas mínimas do universo de pessoas, lidas com o client da sessão.
 *  Coordenação recebe tudo; supervisor recebe o recorte que as policies já
 *  lhe dão. A query nunca pede contato, dados civis, cor/raça ou motivação. */
export async function getPessoasBiIa(
  supabase: SupabaseClient,
  incluirInativas = false
): Promise<PessoaBi[]> {
  let qProfiles = supabase
    .from("profiles")
    .select("id, nome, nome_social, role, ativo, uf, profile_papeis(papel)")
    .or("role.is.null,role.neq.mentorado");
  if (!incluirInativas) qProfiles = qProfiles.eq("ativo", true);

  let qMentorados = supabase
    .from("mentorados")
    .select("id, nome, nome_social, situacao, uf, profile_id");
  if (!incluirInativas) qMentorados = qMentorados.eq("situacao", "ativo");

  const [profRes, mentRes, pessoalProfRes, pessoalMentRes, duplasRes] = await Promise.all([
    qProfiles,
    qMentorados,
    supabase.from("profiles_pessoal").select("id, data_nascimento, genero"),
    supabase.from("mentorados_pessoal").select("id, data_nascimento, genero"),
    supabase
      .from("duplas")
      .select("mentor_id, mentorado_id, trilha, status")
      .in("status", ["ativa", "pausada"]),
  ]);
  for (const [nome, res] of [
    ["profiles", profRes],
    ["mentorados", mentRes],
    ["profiles_pessoal", pessoalProfRes],
    ["mentorados_pessoal", pessoalMentRes],
    ["duplas", duplasRes],
  ] as const) {
    if (res.error) throw new Error(`getPessoasBiIa/${nome}: ${res.error.message}`);
  }

  const sensivelProf = new Map(
    ((pessoalProfRes.data ?? []) as { id: string; data_nascimento: string | null; genero: Genero | null }[])
      .map((r) => [r.id, r] as const)
  );
  const sensivelMent = new Map(
    ((pessoalMentRes.data ?? []) as { id: string; data_nascimento: string | null; genero: Genero | null }[])
      .map((r) => [r.id, r] as const)
  );

  const trilhas = new Map<string, Set<Trilha>>();
  const addTrilha = (id: string | null, trilha: string | null) => {
    if (!id || (trilha !== "dpp" && trilha !== "especialista")) return;
    const set = trilhas.get(id) ?? new Set<Trilha>();
    set.add(trilha);
    trilhas.set(id, set);
  };
  for (const d of (duplasRes.data ?? []) as { mentor_id: string | null; mentorado_id: string | null; trilha: string | null }[]) {
    addTrilha(d.mentor_id, d.trilha);
    addTrilha(d.mentorado_id, d.trilha);
  }

  const pessoas: PessoaBi[] = [];
  for (const p of (profRes.data ?? []) as (RowNome & {
    role: AppRole | null;
    profile_papeis?: { papel: AppRole }[] | null;
  })[]) {
    if (!p.id) continue;
    const efetivos = new Set<AppRole>([...(p.role ? [p.role] : []), ...((p.profile_papeis ?? []).map((r) => r.papel))]);
    const vivas = new Set<Trilha>([...(trilhas.get(p.id) ?? [])]);
    if (efetivos.has("mentor_dpp")) vivas.add("dpp");
    if (efetivos.has("mentor_especialista")) vivas.add("especialista");
    const sens = sensivelProf.get(p.id);
    pessoas.push({
      id: p.id,
      nome: nomeDe(p),
      papel: p.role,
      papeis: [...efetivos],
      trilhas: [...vivas],
      uf: p.uf?.toUpperCase() ?? null,
      genero: sens?.genero ?? null,
      data_nascimento: sens?.data_nascimento ?? null,
    });
  }
  for (const m of (mentRes.data ?? []) as RowNome[]) {
    if (!m.id) continue;
    const sens = sensivelMent.get(m.id);
    pessoas.push({
      id: m.id,
      nome: nomeDe(m),
      papel: "mentorado",
      papeis: ["mentorado"],
      trilhas: [...(trilhas.get(m.id) ?? [])],
      uf: m.uf?.toUpperCase() ?? null,
      genero: sens?.genero ?? null,
      data_nascimento: sens?.data_nascimento ?? null,
    });
  }
  return pessoas;
}

function chaveDaDimensao(p: PessoaBi, dim: DimensaoPessoasBi, ref: Date): string[] {
  if (dim === "estado") return [p.uf || "__nao_informado"];
  if (dim === "genero") return [p.genero || "__nao_informado"];
  if (dim === "faixa_idade") return [faixaIdadeDe(p.data_nascimento, ref) || "__nao_informado"];
  if (dim === "papel") return p.papeis.length ? p.papeis : ["__nao_informado"];
  return p.trilhas.length ? p.trilhas : ["sem_trilha"];
}

/** Agregação pura e testável. Em papel/trilha uma pessoa pode entrar em
 *  mais de um grupo (híbrido ou duas trilhas vivas); total_pessoas segue
 *  deduplicado e o payload diz isso explicitamente. */
export function agregarPessoasBi(
  pessoasBase: PessoaBi[],
  dimensao: DimensaoPessoasBi,
  filtros: FiltrosPessoasBi = {},
  limite = 8,
  referencia = new Date()
) {
  const ufFiltro = filtros.uf?.trim().toUpperCase() || null;
  const pessoas = pessoasBase.filter((p) => {
    if (filtros.papel && !p.papeis.includes(filtros.papel)) return false;
    if (ufFiltro && p.uf !== ufFiltro) return false;
    if (filtros.genero && p.genero !== filtros.genero) return false;
    if (filtros.faixa_idade && faixaIdadeDe(p.data_nascimento, referencia) !== filtros.faixa_idade) return false;
    if (filtros.trilha && !p.trilhas.includes(filtros.trilha)) return false;
    return true;
  });

  const contagens = new Map<string, number>();
  for (const p of pessoas) {
    for (const chave of new Set(chaveDaDimensao(p, dimensao, referencia))) {
      contagens.set(chave, (contagens.get(chave) ?? 0) + 1);
    }
  }
  const total = pessoas.length;
  const ordenadas = [...contagens.entries()]
    .map(([chave, pessoas]) => ({
      chave,
      rotulo: rotuloDaChave(dimensao, chave),
      pessoas,
      percentual: total ? Math.round((pessoas / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) =>
      b.pessoas - a.pessoas ||
      (a.chave === "__nao_informado" ? 1 : b.chave === "__nao_informado" ? -1 : a.rotulo.localeCompare(b.rotulo, "pt-BR"))
    );

  const n = Math.min(Math.max(Math.trunc(limite || 8), 1), 20);
  const grupos = ordenadas.slice(0, n);
  const resto = ordenadas.slice(n);
  const linhas = [...pessoas]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, 5)
    .map((p) => ({
      nome: p.nome,
      papel: p.papel ? papelLabel(p.papel) : "Sem papel",
      trilhas: p.trilhas.map((t) => rotuloTrilha(t)),
      uf: p.uf,
      genero: rotuloGenero(p.genero),
      faixa_idade: p.data_nascimento ? FAIXAS_IDADE[faixaIdadeDe(p.data_nascimento, referencia)!] : "Não informada",
    }));

  return {
    dimensao,
    total_pessoas: total,
    universo: filtros.incluir_inativas ? "pessoas cadastradas" : "pessoas ativas",
    deduplicacao: "jovens contam pela ficha de mentorado; a conta de login role=mentorado não soma de novo",
    participacao_multipla: dimensao === "papel" || dimensao === "trilha",
    grupos,
    outros: resto.length
      ? { grupos: resto.length, pessoas: resto.reduce((s, g) => s + g.pessoas, 0) }
      : null,
    linhas,
  };
}
