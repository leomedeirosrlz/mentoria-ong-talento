import { cache } from "react";
import { createClient } from "./supabase/server";
import { demoRole } from "./demo/mode";
import { getMe } from "./queries";
import { getDemoData } from "./demo/data";
import {
  demoChamadosFila,
  demoChamadoTimeline,
  demoChamadosSemDono,
  demoEquipeChamados,
} from "./demo/queries";
import { comparaNome } from "./ciclo";
import type {
  ChamadoAnexo,
  ChamadoFilaItem,
  ChamadoTimelineItem,
  Profile,
} from "./types";

// Leituras dos chamados unificados (0084). Equipe lê pela view chamados_fila
// (plataforma chega mascarada pro auxiliar); autor lê a tabela base — a RLS
// entrega só os próprios (autor_id ou autor_mentorado_id), nunca comentário
// interno. Nada cruza com dupla_id — dividir a dupla não abre o chamado.
// Os labels CHAMADO_*_LABEL moram em ./ciclo (puro) — este arquivo é
// server-only e não pode ser importado por client components.

/** `mentorado:mentorados!duplas_mentorado_id_fkey(nome, nome_social)` — embed
 *  to-one, mas o PostgREST pode serializar como array dependendo do schema
 *  cache. O nome exibido é o social quando existe (mesma régua do resto). */
function nomeMentoradoEmbed(v: unknown): string | null {
  if (!v) return null;
  const m = Array.isArray(v) ? v[0] : v;
  const o = m as { nome?: string | null; nome_social?: string | null } | null;
  return o ? o.nome_social || o.nome || null : null;
}

/** Colunas de `ChamadoFila` (sem os derivados) — explícitas em vez de `*`
 *  pra coluna nova na tabela/view não engordar o payload da fila, que vai
 *  inteiro pro client a cada clique. `mensagem` fica: o detalhe reaproveita
 *  a linha da fila em vez de reler o chamado. */
// literal único: o parser de tipos do supabase-js não lê string concatenada
const CHAMADO_COLS =
  "id, numero, autor_id, autor_mentorado_id, dupla_id, categoria, descricao_outro, assunto, mensagem, status, atribuido_a, origem, registro_id, avaliacao_id, created_at, updated_at, resolvido_em, resolvido_por, resolucao_resumo";

type LinhaChamado = Record<string, unknown> & {
  id: string;
  autor_id: string | null;
  autor_mentorado_id: string | null;
  atribuido_a: string | null;
  dupla_id: string | null;
  registro_id: string | null;
  avaliacao_id: string | null;
  categoria: string;
};

/** Fila pro papel: staff → todos (auxiliar com plataforma mascarada); autor
 *  → os próprios. Ordem: abertos primeiro, em atendimento depois, resolvidos
 *  por último — dentro de cada grupo, mais recente em cima. */
export const getChamados = cache(
  async (): Promise<{ papel: string | null; itens: ChamadoFilaItem[] }> => {
    const demo = await demoRole();
    if (demo) {
      return { papel: demo, itens: demoChamadosFila(demo) };
    }
    const supabase = await createClient();
    // getMe é React.cache — o layout já resolveu o mesmo profile no request
    const me = await getMe();
    if (!me) return { papel: null, itens: [] };
    const staff = me.role === "coordenacao" || me.role === "supervisor";

    if (staff) {
      const { data, error } = await supabase
        .from("chamados_fila")
        .select(CHAMADO_COLS)
        .order("status", { ascending: true }) // aberto < em_atendimento < resolvido
        .order("created_at", { ascending: false });
      if (error) {
        console.error("getChamados:", error);
        return { papel: me.role, itens: [] };
      }
      const rows = (data ?? []) as unknown as LinhaChamado[];
      const itens = await enriqueceItens(supabase, rows, me.role === "supervisor");
      return { papel: me.role, itens };
    }

    // autor (mentor/especialista/jovem logado): os próprios chamados
    const { data, error } = await supabase
      .from("chamados")
      .select(CHAMADO_COLS)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("getChamados(autor):", error);
      return { papel: me.role, itens: [] };
    }
    // o autor vê o nome do responsável ("Responsável: Marina" no mock) e o
    // mentorado da dupla vinculada — a view definer projeta os dois nomes
    // sob o escopo do autor; ler profiles/duplas direto devolvia vazio pra
    // jovem porque a RLS dessas tabelas não alcança a equipe nem a ficha
    const ids = (data ?? []).map((c) => c.id);
    const { data: ctx } = ids.length
      ? await supabase
          .from("chamados_contexto")
          .select("chamado_id, atribuido_nome, mentorado_nome")
          .in("chamado_id", ids)
      : { data: [] };
    const ctxPorId = new Map(
      (ctx ?? []).map((x) => [x.chamado_id, x])
    );
    const itens = (data ?? []).map((c) => {
      const x = ctxPorId.get(c.id);
      return {
        ...c,
        restrito: false,
        autor_nome: null,
        autor_papel: null,
        atribuido_nome: c.atribuido_a ? (x?.atribuido_nome ?? null) : null,
        contexto: null,
        mentorado_nome: c.dupla_id ? (x?.mentorado_nome ?? null) : null,
      };
    }) as ChamadoFilaItem[];
    return { papel: me.role, itens };
  }
);

/** Resolve nomes/contexto pra lista — batched, sem N+1. */
async function enriqueceItens(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: LinhaChamado[],
  mascaradoSupervisor: boolean
): Promise<ChamadoFilaItem[]> {
  const profileIds = new Set<string>();
  const mentoradoIds = new Set<string>();
  const duplaIds = new Set<string>();
  const registroIds = new Set<string>();
  const avaliacaoIds = new Set<string>();
  for (const r of rows) {
    if (r.autor_id) profileIds.add(r.autor_id);
    if (r.atribuido_a) profileIds.add(r.atribuido_a);
    if (r.autor_mentorado_id) mentoradoIds.add(r.autor_mentorado_id);
    if (r.dupla_id) duplaIds.add(r.dupla_id);
    if (r.registro_id) registroIds.add(r.registro_id);
    if (r.avaliacao_id) avaliacaoIds.add(r.avaliacao_id);
  }
  const [profilesRes, mentoradosRes, duplasRes, registrosRes, avaliacoesRes] =
    await Promise.all([
      profileIds.size
        ? supabase.from("profiles").select("id, nome, nome_social, role").in("id", [...profileIds])
        : Promise.resolve({ data: [] }),
      mentoradoIds.size
        ? supabase.from("mentorados").select("id, nome, nome_social").in("id", [...mentoradoIds])
        : Promise.resolve({ data: [] }),
      duplaIds.size
        ? supabase.from("duplas").select("id, mentorado:mentorados!duplas_mentorado_id_fkey(nome, nome_social)").in("id", [...duplaIds])
        : Promise.resolve({ data: [] }),
      registroIds.size
        ? supabase.from("registros").select("id, encontro:encontros!registros_encontro_id_fkey(numero)").in("id", [...registroIds])
        : Promise.resolve({ data: [] }),
      avaliacaoIds.size
        ? supabase.from("avaliacoes_encontro").select("id, encontro:encontros!avaliacoes_encontro_encontro_id_fkey(numero)").in("id", [...avaliacaoIds])
        : Promise.resolve({ data: [] }),
    ]);
  const profiles = new Map(
    (profilesRes.data ?? []).map((p) => [
      p.id,
      { nome: p.nome_social || p.nome, papel: p.role },
    ])
  );
  const mentorados = new Map(
    (mentoradosRes.data ?? []).map((m) => [m.id, m.nome_social || m.nome])
  );
  const duplaMentorado = new Map(
    (duplasRes.data ?? []).map((d) => [
      d.id,
      nomeMentoradoEmbed(
        (d as unknown as { mentorado?: unknown }).mentorado
      ),
    ])
  );
  const registroEncontro = new Map(
    (registrosRes.data ?? []).map((r) => [
      r.id,
      (r as unknown as { encontro?: { numero: number } | { numero: number }[] | null })
        .encontro
        ? Array.isArray(
            (r as unknown as { encontro: { numero: number } | { numero: number }[] })
              .encontro
          )
          ? ((r as unknown as { encontro: { numero: number }[] }).encontro[0]
              ?.numero ?? null)
          : ((r as unknown as { encontro: { numero: number } }).encontro
              ?.numero ?? null)
        : null,
    ])
  );
  const avaliacaoEncontro = new Map(
    (avaliacoesRes.data ?? []).map((a) => [
      a.id,
      (a as unknown as { encontro?: { numero: number } | { numero: number }[] | null })
        .encontro
        ? Array.isArray(
            (a as unknown as { encontro: { numero: number } | { numero: number }[] })
              .encontro
          )
          ? ((a as unknown as { encontro: { numero: number }[] }).encontro[0]
              ?.numero ?? null)
          : ((a as unknown as { encontro: { numero: number } }).encontro
              ?.numero ?? null)
        : null,
    ])
  );

  return rows.map((r) => {
    const restrito =
      mascaradoSupervisor && r.categoria === "plataforma";
    const autorNome = r.autor_id
      ? (profiles.get(r.autor_id)?.nome ?? null)
      : r.autor_mentorado_id
        ? (mentorados.get(r.autor_mentorado_id) ?? null)
        : null;
    const contexto = restrito
      ? null
      : r.registro_id && registroEncontro.get(r.registro_id)
        ? `Registro do ${registroEncontro.get(r.registro_id)}º encontro` +
          (duplaMentorado.get(r.dupla_id ?? "") ? ` · ${duplaMentorado.get(r.dupla_id ?? "")}` : "")
        : r.avaliacao_id && avaliacaoEncontro.get(r.avaliacao_id)
          ? `Avaliação do ${avaliacaoEncontro.get(r.avaliacao_id)}º encontro` +
            (duplaMentorado.get(r.dupla_id ?? "") ? ` · ${duplaMentorado.get(r.dupla_id ?? "")}` : "")
          : r.dupla_id && duplaMentorado.get(r.dupla_id)
            ? `Dupla de ${duplaMentorado.get(r.dupla_id)}`
            : null;
    return {
      ...(r as unknown as ChamadoFilaItem),
      restrito,
      autor_nome: autorNome,
      autor_papel: r.autor_id ? (profiles.get(r.autor_id)?.papel ?? null) : "mentorado",
      atribuido_nome: r.atribuido_a
        ? (profiles.get(r.atribuido_a)?.nome ?? null)
        : null,
      contexto,
      mentorado_nome:
        !restrito && r.dupla_id
          ? (duplaMentorado.get(r.dupla_id) ?? null)
          : null,
    };
  });
}

/** Detalhe do chamado: trilha pública + (equipe) comentários internos e
 *  anexos. O autor recebe só a trilha pública — policy garante. */
export const getChamadoDetalhe = cache(
  async (
    id: string
  ): Promise<{
    chamado: ChamadoFilaItem | null;
    timeline: ChamadoTimelineItem[];
    equipe: Pick<Profile, "id" | "nome" | "nome_social" | "role">[];
    papel: string | null;
    meuId: string | null;
  }> => {
    const demo = await demoRole();
    if (demo) {
      const fila = demoChamadosFila(demo);
      const chamado = fila.find((c) => c.id === id) ?? null;
      const staff = demo === "coordenacao" || demo === "supervisor";
      return {
        chamado,
        // restrito (plataforma pro auxiliar): a RLS devolve trilha vazia —
        // a demo replica. Sem isso vazaria até o nome do autor no sistema.
        timeline:
          chamado && !chamado.restrito ? demoChamadoTimeline(id, staff) : [],
        // a equipe alimenta o autocomplete "@" do composer interno — o autor
        // não menciona ninguém (o composer dele nem mostra a lista)
        equipe: staff ? demoEquipeChamados() : [],
        papel: demo,
        meuId: getDemoData().personas[demo]?.id ?? null,
      };
    }
    const supabase = await createClient();
    const me = await getMe();
    if (!me)
      return { chamado: null, timeline: [], equipe: [], papel: null, meuId: null };
    const staff = me.role === "coordenacao" || me.role === "supervisor";

    // A trilha não depende da linha do chamado: sai junto com a fila (o page
    // já pediu getChamados — o React.cache devolve a mesma promise) em vez de
    // esperar a linha. A RLS dessas tabelas filtra sozinha; se o chamado não
    // estiver visível o resultado é descartado abaixo.
    const [{ itens: fila }, [atualRes, comentRes, anexoRes, equipe]] =
      await Promise.all([
        getChamados(),
        Promise.all([
          supabase
            .from("chamado_atualizacoes")
            .select("id, chamado_id, autor_id, tipo, texto, created_at")
            .eq("chamado_id", id)
            .order("created_at", { ascending: true }),
          staff
            ? supabase
                .from("chamado_comentarios")
                .select("id, chamado_id, autor_id, texto, created_at")
                .eq("chamado_id", id)
                .order("created_at", { ascending: true })
            : Promise.resolve({ data: [] }),
          supabase
            .from("chamado_anexos")
            .select("id, chamado_id, path, nome, tamanho, mime, interno, created_by, created_at")
            .eq("chamado_id", id)
            .order("created_at", { ascending: true }),
          staff ? getEquipeChamados() : Promise.resolve([]),
        ]),
      ]);

    // a fila já traz a linha enriquecida pelo mesmo client/RLS; a leitura
    // avulsa só cobre fila que falhou
    const chamado =
      fila.find((c) => c.id === id) ??
      (await leChamadoAvulso(supabase, id, staff, me.role === "supervisor"));
    if (!chamado)
      return { chamado: null, timeline: [], equipe: [], papel: me.role, meuId: me.id };

    // nomes que já estão em mãos (equipe, eu, autor, responsável) não voltam
    // ao banco — sobra quem não está nesses grupos (ex.: jovem autor,
    // ex-equipe inativa), lido sob a mesma RLS de antes
    const nomes = new Map<string, string>();
    for (const p of equipe) nomes.set(p.id, p.nome_social || p.nome);
    nomes.set(me.id, me.nome_social || me.nome);
    if (chamado.autor_id && chamado.autor_nome)
      nomes.set(chamado.autor_id, chamado.autor_nome);
    if (chamado.atribuido_a && chamado.atribuido_nome)
      nomes.set(chamado.atribuido_a, chamado.atribuido_nome);
    const faltam = new Set<string>();
    for (const a of atualRes.data ?? [])
      if (a.autor_id && !nomes.has(a.autor_id)) faltam.add(a.autor_id);
    for (const c of comentRes.data ?? [])
      if (c.autor_id && !nomes.has(c.autor_id)) faltam.add(c.autor_id);
    for (const x of anexoRes.data ?? [])
      if (x.created_by && !nomes.has(x.created_by)) faltam.add(x.created_by);
    if (faltam.size) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("id, nome, nome_social")
        .in("id", [...faltam]);
      for (const p of ps ?? []) nomes.set(p.id, p.nome_social || p.nome);
    }

    const timeline: ChamadoTimelineItem[] = [
      ...(atualRes.data ?? []).map((a) => ({
        tipo: a.tipo as "sistema" | "publica",
        item: { ...a, autor_nome: a.autor_id ? (nomes.get(a.autor_id) ?? null) : null },
      })),
      ...(comentRes.data ?? []).map((c) => ({
        tipo: "interno" as const,
        item: { ...c, autor_nome: nomes.get(c.autor_id) ?? null },
      })),
      ...(anexoRes.data ?? []).map((x) => ({
        tipo: "anexo" as const,
        item: {
          ...(x as ChamadoAnexo),
          autor_nome: x.created_by ? (nomes.get(x.created_by) ?? null) : null,
        },
      })),
    ].sort(
      (a, b) =>
        new Date(a.item.created_at).getTime() -
        new Date(b.item.created_at).getTime()
    );

    return { chamado, timeline, equipe, papel: me.role, meuId: me.id };
  }
);

type MembroEquipe = Pick<Profile, "id" | "nome" | "nome_social" | "role">;

/** Equipe ativa (coordenação + auxiliar) — autocomplete "@" e "Atribuir".
 *  Por request (React.cache), nunca entre usuários: é leitura sob RLS. */
const getEquipeChamados = cache(async (): Promise<MembroEquipe[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nome, nome_social, role")
    .in("role", ["coordenacao", "supervisor"])
    .eq("ativo", true);
  if (error) console.error("getEquipeChamados:", error);
  return ((data ?? []) as MembroEquipe[]).sort((a, b) =>
    comparaNome(a.nome_social || a.nome, b.nome_social || b.nome)
  );
});

/** Linha do chamado fora da fila — mesmo enriquecimento da fila. */
async function leChamadoAvulso(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  staff: boolean,
  mascaradoSupervisor: boolean
): Promise<ChamadoFilaItem | null> {
  const { data: row, error } = await supabase
    .from(staff ? "chamados_fila" : "chamados")
    .select(CHAMADO_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("getChamadoDetalhe:", error);
  if (!row) return null;
  const linha = row as unknown as LinhaChamado;
  if (staff) {
    const [item] = await enriqueceItens(supabase, [linha], mascaradoSupervisor);
    return item ?? null;
  }
  // o autor vê o nome do responsável e o mentorado da dupla vinculada —
  // mesma view definer da fila (0187): RLS de profiles/duplas nega a
  // leitura direta pro jovem
  const { data: ctx } = await supabase
    .from("chamados_contexto")
    .select("atribuido_nome, mentorado_nome")
    .eq("chamado_id", id)
    .maybeSingle();
  return {
    ...(linha as unknown as ChamadoFilaItem),
    restrito: false,
    autor_nome: null,
    autor_papel: null,
    atribuido_nome: linha.atribuido_a ? (ctx?.atribuido_nome ?? null) : null,
    contexto: null,
    mentorado_nome: linha.dupla_id ? (ctx?.mentorado_nome ?? null) : null,
  };
}

/** Badge da nav: chamados na fila (aberto sem dono), escopo RLS — pro
 *  auxiliar a contagem exclui plataforma automaticamente. */
export const getChamadosSemDono = cache(async (): Promise<number> => {
  const demo = await demoRole();
  if (demo) return demoChamadosSemDono(demo);
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("chamados")
    .select("id", { count: "exact", head: true })
    .eq("status", "aberto")
    .is("atribuido_a", null);
  if (error) {
    console.error("getChamadosSemDono:", error);
    return 0;
  }
  return count ?? 0;
});

export function demoDisponivel() {
  return demoRole();
}
