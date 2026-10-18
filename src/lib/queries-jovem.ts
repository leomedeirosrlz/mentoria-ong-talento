import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { comparaNome } from "./ciclo";
import { demoRole } from "./demo/mode";
import {
  demoDevolutivas,
  demoTrilhaEsp,
  demoJovemAssinaturas,
  demoJovemColegas,
  demoJovemContatos,
  demoJovemDuplas,
  demoJovemEncaminhamentos,
  demoJovemEncontros,
  demoJovemEspecialistas,
  demoJovemPerfil,
} from "./demo/queries";
import { pedidoEmAberto } from "./jovem-especialista";
import {
  getPropostasMap,
  getSlotsLivres,
  getSolicitacoesVisiveis,
} from "./queries-especialista";
import type {
  ColegaTurma,
  Devolutiva,
  EncontroStatus,
  JovemAssinatura,
  JovemContato,
  JovemDupla,
  JovemEncaminhamento,
  JovemEspecialista,
  JovemPerfil,
  JovemPessoa,
  SolicitacaoEspecialista,
  SolicitacaoProposta,
} from "./types";

// Leituras do shell /jovem (REALIZA-108). Contrato do D2: tudo que é dado
// de domínio do próprio jovem vem das views definer `jovem_*` (0067/0070) —
// NUNCA de duplas/mentorados/profiles base (o papel não tem SELECT nelas e
// a projeção da view é a fronteira do que ele pode ver). As únicas tabelas
// lidas direto são as de policy aberta pra ele: encontros (branch
// exists(jovem_duplas) da 0068), materiais/comunicados audiencia='todos' e
// notificacoes (self). O ramo demo delega às demoJovem* — que projetam as
// mesmas colunas das views sobre o dataset em memória.

/** Ficha do próprio jovem (view jovem_perfil) — null quando o vínculo
 *  profiles↔mentorados ainda não foi feito pela coordenação. */
export const getJovemPerfil = cache(async (): Promise<JovemPerfil | null> => {
  const demo = await demoRole();
  if (demo) return demoJovemPerfil(demo);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jovem_perfil")
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("getJovemPerfil:", error);
    return null;
  }
  return data;
});

/** Duplas do jovem (view jovem_duplas) — normalmente 0-1 ativa; o histórico
 *  (concluida/encerrada) também vem, pra agenda e home saberem distinguir. */
export const getJovemDuplas = cache(async (): Promise<JovemDupla[]> => {
  const demo = await demoRole();
  if (demo) return demoJovemDuplas(demo);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jovem_duplas")
    .select("*")
    .order("iniciada_em", { ascending: false });
  if (error) {
    console.error("getJovemDuplas:", error);
    return [];
  }
  return data ?? [];
});

/** Adultos alcançáveis (view jovem_contatos): mentor + supervisor das
 *  próprias duplas e a coordenação — os mesmos destinos que a policy de
 *  pedido_apoio valida (0069). */
export const getJovemContatos = cache(async (): Promise<JovemContato[]> => {
  const demo = await demoRole();
  if (demo) return demoJovemContatos(demo);
  const supabase = await createClient();
  const { data, error } = await supabase.from("jovem_contatos").select("*");
  if (error) {
    console.error("getJovemContatos:", error);
    return [];
  }
  return data ?? [];
});

/** Colegas de turma do jovem (view `mentorados_turma`, 0076 — definer,
 *  mentorado-only): só quem tem conta na plataforma e divide turma de
 *  dupla com ele; `whatsapp` chega null quando o colega não ligou o
 *  compartilhamento — a UI mostra o estado honesto, não um CTA quebrado. */
export const getJovemColegas = cache(async (): Promise<ColegaTurma[]> => {
  const demo = await demoRole();
  if (demo) return demoJovemColegas(demo);
  const supabase = await createClient();
  const { data, error } = await supabase.from("mentorados_turma").select("*");
  if (error) {
    console.error("getJovemColegas:", error);
    return [];
  }
  // pt-BR no app — a collation do banco ordena acentos depois de Z
  return (data ?? []).sort((a, b) =>
    comparaNome(a.nome_social || a.nome || "", b.nome_social || b.nome || "")
  );
});

/** A pessoa por trás de um card de /jovem/pessoas — resolvida SÓ nas
 *  três fontes já seguras (contatos adultos → colegas de turma → catálogo
 *  de especialistas). id de fora desses conjuntos cai no mesmo null de
 *  quem não existe: a página 404 não vaza nem a existência do profile. */
export const getJovemPessoa = cache(
  async (id: string): Promise<JovemPessoa | null> => {
    const [contatos, colegas, especialistas] = await Promise.all([
      getJovemContatos(),
      getJovemColegas(),
      getJovemEspecialistas(),
    ]);
    const contato = contatos.find((c) => c.id === id);
    if (contato) return { tipo: "contato", contato };
    const colega = colegas.find((c) => c.id === id);
    if (colega) return { tipo: "colega", colega };
    const especialista = especialistas.find((e) => e.id === id);
    if (especialista) return { tipo: "especialista", especialista };
    return null;
  }
);

/** Combinados do jovem (view jovem_encaminhamentos) — o que ele se
 *  comprometeu a fazer entre um encontro e outro. Escrita só via RPC
 *  marcar_combinado; aqui é leitura ordenada (pendente com prazo primeiro). */
export const getJovemEncaminhamentos = cache(
  async (): Promise<JovemEncaminhamento[]> => {
    const demo = await demoRole();
    if (demo) return demoJovemEncaminhamentos(demo);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("jovem_encaminhamentos")
      .select("*")
      .order("status", { ascending: true })
      .order("prazo", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) {
      console.error("getJovemEncaminhamentos:", error);
      return [];
    }
    return data ?? [];
  }
);

/** Documentos do jovem pra assinar/encaminhar (view jovem_assinaturas) —
 *  token exposto só pra montar o link /assinar/[token]; nunca renderizado. */
export const getJovemAssinaturas = cache(
  async (): Promise<JovemAssinatura[]> => {
    const demo = await demoRole();
    if (demo) return demoJovemAssinaturas(demo);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("jovem_assinaturas")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("getJovemAssinaturas:", error);
      return [];
    }
    return data ?? [];
  }
);

/** Encontro do jovem — projeção explícita (D2: nada de `*`, os registros e
 *  notas do mentor ficam fora). `link` e `motivo_reagendamento` são as
 *  colunas "operacionais" que o jovem precisa pra entrar na chamada e saber
 *  por que a data mudou. */
export type JovemEncontro = {
  id: string;
  dupla_id: string;
  numero: number;
  data_hora: string | null;
  realizado_em: string | null;
  duracao_min: number | null;
  status: EncontroStatus;
  link: string | null;
  motivo_reagendamento: string | null;
};

const JOVEM_ENCONTRO_COLS =
  "id, dupla_id, numero, data_hora, realizado_em, duracao_min, status, link, motivo_reagendamento";

/** Todos os encontros das duplas do jovem — a RLS (0068) já escopa às duplas
 *  dele via exists(jovem_duplas). Ordenação cronológica pra home e agenda. */
export const getJovemEncontros = cache(async (): Promise<JovemEncontro[]> => {
  const demo = await demoRole();
  if (demo) return demoJovemEncontros(demo);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("encontros")
    .select(JOVEM_ENCONTRO_COLS)
    .order("data_hora", { ascending: true, nullsFirst: false });
  if (error) {
    console.error("getJovemEncontros:", error);
    return [];
  }
  return (data ?? []) as JovemEncontro[];
});

/** Catálogo de especialistas pro pedido do jovem (view `jovem_especialistas`,
 *  0075 — definer, escopada a my_role()='mentorado'): nome/social/avatar/
 *  áreas de quem ele pode procurar. Contato direto não entra — o canal abre
 *  quando a dupla nasce, pelo jovem_contatos de sempre. A view ainda não
 *  está no database.types gerado — a projeção recebe cast local. */
export const getJovemEspecialistas = cache(
  async (): Promise<JovemEspecialista[]> => {
    const demo = await demoRole();
    if (demo) return demoJovemEspecialistas(demo);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("jovem_especialistas")
      .select(
        "id, nome, nome_social, avatar_path, areas, bio, cargo, empresa, cidade, uf, voluntariado, experiencia_previa, formacao_externa, grade_resumo, vagas"
      )
      .order("nome");
    if (error) {
      console.error("getJovemEspecialistas:", error);
      return [];
    }
    type Row = Omit<JovemEspecialista, "id" | "nome" | "vagas"> & {
      id: string | null;
      nome: string | null;
      vagas: number | null;
    };
    // a collation do banco ordena acentos depois de Z — pt-BR no app
    return ((data ?? []) as Row[])
      .filter(
        (e): e is Row & { id: string; nome: string } =>
          e.id != null && e.nome != null
      )
      .map((e) => ({ ...e, vagas: e.vagas ?? 0 }))
      .sort((a, b) => comparaNome(a.nome, b.nome));
  }
);

/** Contexto do pedido de especialista do jovem (REALIZA-112): os pedidos
 *  DELE (a RLS de solicitacoes_mural já escopa), o catálogo, as threads
 *  das negociações abertas e a agenda livre de cada especialista na mesa.
 *  Os embeds de profiles não passam pela RLS do papel mentorado — o
 *  direcionado (`desejado`) e o autor especialista da thread voltam null
 *  e são costurados aqui pelo catálogo. */
export const getJovemPedidosEspecialista = cache(
  async (): Promise<{
    catalogo: JovemEspecialista[];
    solicitacoes: SolicitacaoEspecialista[];
    propostas: Record<string, SolicitacaoProposta[]>;
    slotsPorEsp: Record<string, string[]>;
  }> => {
    const [catalogo, solicitacoes] = await Promise.all([
      getJovemEspecialistas(),
      getSolicitacoesVisiveis(),
    ]);
    const nomePorId = new Map(
      catalogo.map((e) => [e.id, e.nome_social || e.nome] as const)
    );

    // o nome do direcionado entra como embed `desejado` — o que o rail e as
    // frases de estado já consomem pro staff
    const sols = solicitacoes.map((s) => ({
      ...s,
      desejado:
        s.desejado ??
        (s.especialista_desejado_id &&
        nomePorId.has(s.especialista_desejado_id)
          ? { nome: nomePorId.get(s.especialista_desejado_id)! }
          : null),
    }));

    const emAberto = sols.filter(pedidoEmAberto);
    const propostas: Record<string, SolicitacaoProposta[]> = {};
    if (emAberto.length) {
      const mapa = await getPropostasMap(emAberto.map((s) => s.id));
      // o autor de proposta que não é o jovem também sai da RLS — costura o
      // nome do catálogo; fora dele (staff), "a equipe"
      for (const [sid, lista] of Object.entries(mapa)) {
        propostas[sid] = lista.map((p) => ({
          ...p,
          autor:
            p.autor ??
            (nomePorId.has(p.autor_id)
              ? { nome: nomePorId.get(p.autor_id)! }
              : { nome: "a equipe" }),
        }));
      }
    }

    // a contra-proposta do jovem sai da grade real do especialista — dos
    // dois lados da mesa (a RPC revalida); um mapa por id, sem N+1
    const espIds = [
      ...new Set(
        emAberto
          .map((s) => s.especialista_id ?? s.especialista_desejado_id)
          .filter((id): id is string => id != null)
      ),
    ];
    const slotsPorEsp = Object.fromEntries(
      await Promise.all(
        espIds.map(
          async (id) => [id, await getSlotsLivres(id)] as const
        )
      )
    );

    return { catalogo, solicitacoes: sols, propostas, slotsPorEsp };
  }
);

/** Devolutivas das trilhas do jovem (0086 — feed datado por dupla esp). A
 *  RLS da tabela base escopa às duplas dele; aqui o caller passa os ids
 *  das trilhas que já carregou, e o nome do autor vem do mentor da dupla
 *  (mentorado não tem SELECT em profiles — se quem escreveu foi a
 *  coordenação, cai no fallback "Equipe"). */
export const getDevolutivas = cache(
  async (duplaIds: string[]): Promise<Devolutiva[]> => {
    if (duplaIds.length === 0) return [];
    const demo = await demoRole();
    if (demo) return demoDevolutivas(demo, duplaIds);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("devolutivas")
      .select("id, dupla_id, autor_id, texto, created_at")
      .in("dupla_id", duplaIds)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("getDevolutivas:", error);
      return [];
    }
    return (data ?? []) as Devolutiva[];
  }
);

/** Os 5 passos do guia da trilha de especialista, projetados pro jovem pela
 *  view definer 0088 (a tabela base não abre pro papel mentorado — 0065). */
export const getJovemTrilhaEsp = cache(
  async (): Promise<{ numero: number; titulo: string; foco: string | null }[]> => {
    const demo = await demoRole();
    if (demo) {
      if (demo !== "mentorado") return [];
      return demoTrilhaEsp();
    }
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("jovem_trilha_esp")
      .select("numero, titulo, foco")
      .order("numero");
    if (error) {
      console.error("getJovemTrilhaEsp:", error);
      return [];
    }
    return (data ?? []).filter(
      (e): e is { numero: number; titulo: string; foco: string | null } =>
        e.numero != null && e.titulo != null
    );
  }
);
