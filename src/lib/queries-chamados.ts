import { cache } from "react";
import { createClient } from "./supabase/server";
import { demoRole } from "./demo/mode";
import {
  demoChamadosFila,
  demoChamadoTimeline,
  demoChamadosSemDono,
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
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims?.claims?.sub) return { papel: null, itens: [] };
    const { data: me } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", claims.claims.sub)
      .single();
    if (!me) return { papel: null, itens: [] };
    const staff = me.role === "coordenacao" || me.role === "supervisor";

    if (staff) {
      const { data, error } = await supabase
        .from("chamados_fila")
        .select("*")
        .order("status", { ascending: true }) // aberto < em_atendimento < resolvido
        .order("created_at", { ascending: false });
      if (error) {
        console.error("getChamados:", error);
        return { papel: me.role, itens: [] };
      }
      const rows = (data ?? []) as unknown as (Record<string, unknown> & {
        id: string;
        autor_id: string | null;
        autor_mentorado_id: string | null;
        atribuido_a: string | null;
        dupla_id: string | null;
        registro_id: string | null;
        avaliacao_id: string | null;
        categoria: string;
      })[];
      const itens = await enriqueceItens(supabase, rows, me.role === "supervisor");
      return { papel: me.role, itens };
    }

    // autor (mentor/especialista/jovem logado): os próprios chamados
    const { data, error } = await supabase
      .from("chamados")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("getChamados(autor):", error);
      return { papel: me.role, itens: [] };
    }
    // o autor vê o nome do responsável ("Responsável: Marina" no mock)
    const atribIds = [...new Set(
      (data ?? []).map((c) => c.atribuido_a).filter(Boolean) as string[]
    )];
    const nomes = new Map<string, string>();
    if (atribIds.length) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("id, nome, nome_social")
        .in("id", atribIds);
      for (const p of ps ?? []) nomes.set(p.id, p.nome_social || p.nome);
    }
    const itens = (data ?? []).map((c) => ({
      ...c,
      restrito: false,
      autor_nome: null,
      autor_papel: null,
      atribuido_nome: c.atribuido_a ? (nomes.get(c.atribuido_a) ?? null) : null,
      contexto: null,
    })) as ChamadoFilaItem[];
    return { papel: me.role, itens };
  }
);

/** Resolve nomes/contexto pra lista — batched, sem N+1. */
async function enriqueceItens(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: (Record<string, unknown> & {
    id: string;
    autor_id: string | null;
    autor_mentorado_id: string | null;
    atribuido_a: string | null;
    dupla_id: string | null;
    registro_id: string | null;
    avaliacao_id: string | null;
    categoria: string;
  })[],
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
        ? supabase.from("mentorados").select("id, nome").in("id", [...mentoradoIds])
        : Promise.resolve({ data: [] }),
      duplaIds.size
        ? supabase.from("duplas").select("id, mentorado:mentorados!duplas_mentorado_id_fkey(nome)").in("id", [...duplaIds])
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
    (mentoradosRes.data ?? []).map((m) => [m.id, m.nome])
  );
  const duplaMentorado = new Map(
    (duplasRes.data ?? []).map((d) => [
      d.id,
      (d as unknown as { mentorado?: { nome: string } | { nome: string }[] | null })
        .mentorado
        ? Array.isArray(
            (d as unknown as { mentorado: { nome: string } | { nome: string }[] })
              .mentorado
          )
          ? ((d as unknown as { mentorado: { nome: string }[] }).mentorado[0]
              ?.nome ?? null)
          : ((d as unknown as { mentorado: { nome: string } }).mentorado?.nome ??
            null)
        : null,
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
        equipe: [],
        papel: demo,
        meuId: null,
      };
    }
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims?.claims?.sub)
      return { chamado: null, timeline: [], equipe: [], papel: null, meuId: null };
    const { data: me } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", claims.claims.sub)
      .single();
    if (!me)
      return { chamado: null, timeline: [], equipe: [], papel: null, meuId: null };
    const staff = me.role === "coordenacao" || me.role === "supervisor";

    const { data: row, error } = staff
      ? await supabase.from("chamados_fila").select("*").eq("id", id).maybeSingle()
      : await supabase.from("chamados").select("*").eq("id", id).maybeSingle();
    if (error) console.error("getChamadoDetalhe:", error);
    if (!row)
      return { chamado: null, timeline: [], equipe: [], papel: me.role, meuId: me.id };

    let atribuidoNome: string | null = null;
    if (!staff && (row as { atribuido_a?: string | null }).atribuido_a) {
      const { data: pr } = await supabase
        .from("profiles")
        .select("nome, nome_social")
        .eq("id", (row as { atribuido_a: string }).atribuido_a)
        .maybeSingle();
      atribuidoNome = pr ? pr.nome_social || pr.nome : null;
    }
    const [itens] = staff
      ? await enriqueceItens(
          supabase,
          [row as never],
          me.role === "supervisor"
        )
      : [
          {
            ...(row as object),
            restrito: false,
            autor_nome: null,
            autor_papel: null,
            atribuido_nome: atribuidoNome,
            contexto: null,
          } as ChamadoFilaItem,
        ];

    const [atualRes, comentRes, anexoRes, equipeRes] = await Promise.all([
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
      staff
        ? supabase
            .from("profiles")
            .select("id, nome, nome_social, role")
            .in("role", ["coordenacao", "supervisor"])
            .eq("ativo", true)
        : Promise.resolve({ data: [] }),
    ]);

    // nomes dos autores da trilha numa batida
    const autorIds = new Set<string>();
    for (const a of atualRes.data ?? []) if (a.autor_id) autorIds.add(a.autor_id);
    for (const c of comentRes.data ?? []) if (c.autor_id) autorIds.add(c.autor_id);
    for (const x of anexoRes.data ?? []) if (x.created_by) autorIds.add(x.created_by);
    const nomes = new Map<string, string>();
    if (autorIds.size) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("id, nome, nome_social")
        .in("id", [...autorIds]);
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

    return {
      chamado: itens ?? null,
      timeline,
      equipe: ((equipeRes.data ?? []) as Pick<
        Profile,
        "id" | "nome" | "nome_social" | "role"
      >[]).sort((a, b) =>
        comparaNome(a.nome_social || a.nome, b.nome_social || b.nome)
      ),
      papel: me.role,
      meuId: me.id,
    };
  }
);

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
