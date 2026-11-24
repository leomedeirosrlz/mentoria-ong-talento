"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { celulasComuns, celulasDe, parseDisponibilidade, toDateStr } from "./ciclo";
import { disponibilidadesDaDupla } from "./actions";
import { demoAtivo, demoRole } from "./demo/mode";
import { enviarEmailsIndividuais, SITE_URL } from "./email";
import {
  escopoDaProposta,
  montarPlanoEmDia,
  type EscopoProposta,
  type PlanoEmDia,
} from "./plano-em-dia";
import {
  comDecisoesRecesso,
  contextoPlano,
  type LadoPlano,
} from "./plano-servico";
import { emitirProdutoEvento } from "./produto-eventos-server";
import { getCicloEventos, getDupla } from "./queries";
import type {
  ChamadoCategoria,
  Disponibilidade,
  DuplaPlanoEscopo,
} from "./types";

type Resultado =
  | { ok: true; demo?: boolean; status?: string; novaVersao?: boolean }
  | { error: string };

/** Lê o contrato {error} das RPCs definer do plano (0219/0220) — a
 *  mensagem pt-BR do banco sobe intacta; PostgREST vira genérica. O
 *  `status`/`versao` que a RPC devolve sobe junto no ok. */
function lerRpc(data: unknown, error: { message: string } | null): Resultado {
  if (error) {
    console.error("actions-plano:", error);
    return { error: "Não consegui concluir agora." };
  }
  const r = data as { error?: string; status?: string } | null;
  // as RPCs falam em minúscula ("já existe um plano aberto…"): na tela a
  // frase abre com maiúscula
  if (r?.error)
    return { error: r.error.charAt(0).toUpperCase() + r.error.slice(1) };
  return { ok: true, status: r?.status };
}

/** O plano mora nas duas homes (banner) além da ficha e da agenda do
 *  jovem — toda escrita do plano revalida as quatro. */
function revalidarPlano(duplaId?: string) {
  if (duplaId) revalidatePath(`/duplas/${duplaId}`);
  revalidatePath("/");
  revalidatePath("/jovem");
  revalidatePath("/jovem/agenda");
}

// ---------- aviso externo (518 FR-006) ----------
// E-mail, só texto de chamada + deep link — datas, passos e nomes de
// passos ficam no app. "Tem um combinado no site" é o assunto; quem não
// tem e-mail cadastrado simplesmente não recebe (contato = opt-in do
// cadastro). Falha nunca derruba o gesto: complemento, não o canal.

async function avisoPlanoEmail(
  ctx: { emails: { mentor: string | null; jovem: string | null } },
  duplaId: string
): Promise<{ enviados: number; falhas: string[] }> {
  const mensagens = [
    { to: ctx.emails.mentor, link: `/duplas/${duplaId}#plano-em-dia` },
    { to: ctx.emails.jovem, link: `/jovem/agenda#plano` },
  ]
    .filter((m): m is { to: string; link: string } => Boolean(m.to))
    .map((m) => ({
      to: m.to,
      subject: "Tem um combinado pra você no Realiza",
      html: `<p>Tem um combinado pra você no Realiza.</p><p><a href="${SITE_URL}${m.link}">Abrir o Realiza</a></p>`,
    }));
  if (!mensagens.length) return { enviados: 0, falhas: [] };
  try {
    const r = await enviarEmailsIndividuais({ mensagens });
    return { enviados: r.enviados, falhas: r.falhas };
  } catch (e) {
    console.error("avisoPlanoEmail:", e);
    return { enviados: 0, falhas: mensagens.map((m) => m.to) };
  }
}

// ---------- a superfície "Combinar o plano" (518) ----------

export type DecisaoRecesso = { cicloEventoId: string; usa: boolean };

/** Resultado da simulação sob demanda — o que a superfície mostra enquanto
 *  a dupla responde. O PlanoEmDia é serializável (só dados). */
export type SimulacaoPlano =
  | {
      ok: true;
      demo?: boolean;
      lado: LadoPlano;
      plano: PlanoEmDia;
      /** Recessos do cronograma que cruzam a janela com a decisão atual —
       *  usa null = pendente (sem row). Titulo/datas pra superfície
       *  nomear o que pergunta. */
      recessos: {
        cicloEventoId: string;
        titulo: string;
        inicio: string;
        fim: string;
        usa: boolean | null;
      }[];
      grade: {
        mentor: boolean;
        jovem: boolean;
        diasComuns: number;
      };
      /** id do combinado aberto, se existir — a RPC recusa proposta dupla */
      planoVivo: string | null;
    }
  | { error: string };

/** Simula o plano com as respostas em edição — chamada a cada resposta da
 *  superfície ("a projeção muda conforme as respostas"). Leitura de
 *  referência via serviço depois da autorização por RPC; nada grava. */
export async function simularPlano(
  duplaId: string,
  input?: {
    ritmo?: number;
    decisoes?: DecisaoRecesso[];
    /** "combinar sem a grade" — a dupla respondeu explicitamente */
    semGrade?: boolean;
  }
): Promise<SimulacaoPlano> {
  const eventos = await getCicloEventos();
  if (await demoAtivo()) {
    const dupla = await getDupla(duplaId);
    if (!dupla) return { error: "Não encontrei essa dupla." };
    // mesmo recorte da real: o lado é o da persona demo e as grades são
    // as do dataset — a superfície ensaia o gesto de verdade, só a
    // escrita que é simulada
    const papel = await demoRole();
    const lado: LadoPlano =
      papel === "mentor_dpp"
        ? "mentor"
        : papel === "mentorado"
          ? "mentorado"
          : "staff";
    const { mentor: gradeMentor, jovem: gradeJovem } =
      await disponibilidadesDaDupla(duplaId);
    const celM = celulasDe(gradeMentor);
    const celJ = celulasDe(gradeJovem);
    const comuns =
      celM.length && celJ.length
        ? celulasComuns(gradeMentor, gradeJovem)
        : celM.length
          ? celM
          : celJ;
    const plano = montarPlanoEmDia({
      dupla: comDecisoesRecesso(dupla, input?.decisoes),
      eventos,
      ritmo: input?.ritmo,
      disponibilidade: input?.semGrade
        ? null
        : comuns.length
          ? { celulas: comuns }
          : null,
      hoje: new Date(),
    });
    const pendentes = plano.aplicavel ? plano.recessosPendentes : [];
    const pendenteIds = new Set(pendentes.map((p) => p.cicloEventoId));
    const hojeStr = toDateStr(new Date());
    const evPorId = new Map(eventos.map((e) => [e.id, e]));
    const decididos = (dupla.recessos ?? [])
      .filter((r) => {
        if (pendenteIds.has(r.ciclo_evento_id)) return false;
        const ev = evPorId.get(r.ciclo_evento_id);
        return ev != null && (ev.data_fim ?? ev.data ?? "") >= hojeStr;
      })
      .map((r) => {
        const ev = evPorId.get(r.ciclo_evento_id)!;
        return {
          cicloEventoId: r.ciclo_evento_id,
          titulo: ev.titulo,
          inicio: ev.data!,
          fim: ev.data_fim ?? ev.data!,
          usa: r.usa as boolean | null,
        };
      });
    return {
      ok: true,
      demo: true,
      lado,
      plano,
      recessos: [
        ...pendentes.map((p) => ({
          cicloEventoId: p.cicloEventoId,
          titulo: p.titulo,
          inicio: p.inicio,
          fim: p.fim,
          usa: null as boolean | null,
        })),
        ...decididos,
      ],
      grade: {
        mentor: celM.length > 0,
        jovem: celJ.length > 0,
        diasComuns: new Set(comuns.map((c) => c.dia)).size,
      },
      planoVivo:
        (dupla.planos ?? []).find((p) =>
          ["proposto", "aceito", "ativo"].includes(p.status)
        )?.id ?? null,
    };
  }
  const ctx = await contextoPlano(duplaId, eventos);
  if ("error" in ctx) return ctx;
  const dupla = comDecisoesRecesso(ctx.dupla, input?.decisoes);
  const plano = montarPlanoEmDia({
    dupla,
    eventos,
    ritmo: input?.ritmo,
    disponibilidade: input?.semGrade ? null : ctx.combinada,
    hoje: new Date(),
  });
  const pendentes = plano.aplicavel ? plano.recessosPendentes : [];
  const pendenteIds = new Set(pendentes.map((p) => p.cicloEventoId));
  const hojeStr = toDateStr(new Date());
  const evPorId = new Map(eventos.map((e) => [e.id, e]));
  const decididos = (ctx.dupla.recessos ?? [])
    .filter((r) => {
      if (pendenteIds.has(r.ciclo_evento_id)) return false;
      // só o que ainda importa pra janela — recesso encerrado não é
      // pergunta da superfície
      const ev = evPorId.get(r.ciclo_evento_id);
      return ev != null && (ev.data_fim ?? ev.data ?? "") >= hojeStr;
    })
    .map((r) => {
      const ev = evPorId.get(r.ciclo_evento_id)!;
      return {
        cicloEventoId: r.ciclo_evento_id,
        titulo: ev.titulo,
        inicio: ev.data!,
        fim: ev.data_fim ?? ev.data!,
        usa: r.usa as boolean | null,
      };
    });
  return {
    ok: true,
    lado: ctx.lado,
    plano,
    recessos: [
      ...pendentes.map((p) => ({
        cicloEventoId: p.cicloEventoId,
        titulo: p.titulo,
        inicio: p.inicio,
        fim: p.fim,
        usa: null as boolean | null,
      })),
      // recessos já decididos também voltam — a superfície mostra a
      // resposta vigente e deixa a dupla repensar antes de confirmar
      ...decididos,
    ],
    grade: {
      mentor: Boolean(ctx.gradeMentor?.celulas?.length),
      jovem: Boolean(ctx.gradeJovem?.celulas?.length),
      diasComuns: ctx.diasComuns,
    },
    planoVivo:
      (ctx.dupla.planos ?? []).find((p) =>
        ["proposto", "aceito", "ativo"].includes(p.status)
      )?.id ?? null,
  };
}

/** O gesto único do "Combinar o plano" (518): declara os recessos que a
 *  superfície respondeu (só a dupla declara — a RPC revalida), simula o
 *  escopo final e propõe na mesma chamada. Proposta de lado da dupla já
 *  nasce aceita; a da equipe nasce `proposto` esperando um aceite. */
export async function combinarPlano(
  duplaId: string,
  input: {
    ritmo: number;
    decisoes?: DecisaoRecesso[];
    semGrade?: boolean;
  }
): Promise<Resultado> {
  if (await demoAtivo()) return { ok: true, demo: true };
  const supabase = await createClient();
  // a decisão de recesso é só da dupla — declarar antes da proposta, na
  // mesma RPC que a 0225 restringiu a mentor/mentorado; staff que tenta
  // declarar recebe o erro honesto do banco
  for (const d of input.decisoes ?? []) {
    const { data: rd, error: re } = await supabase.rpc("declarar_recesso", {
      p_dupla: duplaId,
      p_evento: d.cicloEventoId,
      p_usa: d.usa,
    });
    const r = lerRpc(rd, re);
    if ("error" in r) return r;
  }
  const eventos = await getCicloEventos();
  const ctx = await contextoPlano(duplaId, eventos);
  if ("error" in ctx) return ctx;
  // depois das declarações a leitura já reflete o banco — comDecisoes
  // cobre a janela de consistência do re-read
  const dupla = comDecisoesRecesso(ctx.dupla, input.decisoes);
  const agora = new Date();
  const plano = montarPlanoEmDia({
    dupla,
    eventos,
    ritmo: input.ritmo,
    disponibilidade: input.semGrade ? null : ctx.combinada,
    hoje: agora,
  });
  if (!plano.aplicavel) return { error: plano.motivo };
  if (plano.recessosPendentes.length)
    return { error: "Falta a dupla confirmar o recesso." };
  const e = escopoDaProposta(plano, toDateStr(agora));
  if ("erro" in e) return { error: e.erro };
  const escopo: EscopoProposta = {
    ...e.escopo,
    // 518: as decisões do gesto viajam no jsonb do escopo — snapshot que
    // o aceite compara pra detectar "a resposta mudou depois" (sem DDL)
    decisoes: {
      recessos: input.decisoes ?? [],
      sem_grade: input.semGrade === true,
    },
  };
  const { data, error } = await supabase.rpc("plano_propor", {
    p_dupla: duplaId,
    p_escopo: escopo,
    p_via: "app",
  });
  const r = lerRpc(data, error);
  if ("error" in r) return r;
  const aviso = await avisoPlanoEmail(ctx, duplaId);
  await emitirProdutoEvento(supabase, {
    superficie: "ficha_dupla",
    acao: "plano_proposto",
    meta: {
      dupla_id: duplaId,
      ritmo: escopo.ritmo,
      nivel: plano.nivel,
      sem_grade: input.semGrade === true,
      aviso_email: aviso.enviados,
    },
  });
  revalidarPlano(duplaId);
  return r;
}

/** "Propor à dupla" (513/518): mesmo gesto do combinar sem decisões —
 *  mantido pro botão legado e pra Liza, que propõe com o ritmo que o
 *  planner devolveu. */
export async function proporPlano(
  duplaId: string,
  ritmo?: number
): Promise<Resultado> {
  return combinarPlano(duplaId, { ritmo: ritmo ?? 1 });
}

/** Mesmas datas dos passos? — o comparador do "aceite que recalcula":
 *  o que o banco gravou vs. o que a decisão nova de recesso projeta. */
function mesmaDatas(a: DuplaPlanoEscopo, b: EscopoProposta): boolean {
  const mapaA = new Map((a.passos ?? []).map((p) => [p.numero, p.data]));
  const mapaB = new Map(b.passos.map((p) => [p.numero, p.data]));
  if (mapaA.size !== mapaB.size) return false;
  for (const [n, d] of mapaA) if (mapaB.get(n) !== d) return false;
  return true;
}

/** Aceite com decisão de recesso no mesmo gesto (518, US3.5): a dupla
 *  pode repensar a resposta ao aceitar — a action declara, re-simula e,
 *  se a data mudou, fecha a versão velha (contestação registrada com o
 *  motivo) e propõe a recalculada já aceita pelo lado que responde. Sem
 *  divergência, é um aceite normal. */
export async function responderPlanoComRecesso(
  planoId: string,
  acao: "aceitar" | "contestar",
  decisoes?: DecisaoRecesso[],
  duplaId?: string
): Promise<Resultado> {
  if (await demoAtivo()) return { ok: true, demo: true };
  const supabase = await createClient();
  for (const d of decisoes ?? []) {
    const { data: rd, error: re } = await supabase.rpc("declarar_recesso", {
      p_dupla: duplaId!,
      p_evento: d.cicloEventoId,
      p_usa: d.usa,
    });
    const r = lerRpc(rd, re);
    if ("error" in r) return r;
  }
  if (acao === "contestar") return responderPlano(planoId, acao, undefined, duplaId);
  if (!duplaId || !(decisoes ?? []).length)
    return responderPlano(planoId, acao, undefined, duplaId);

  const eventos = await getCicloEventos();
  const ctx = await contextoPlano(duplaId, eventos);
  if ("error" in ctx) return ctx;
  const planoAtual = (ctx.dupla.planos ?? []).find((p) => p.id === planoId);
  if (!planoAtual?.escopo)
    return responderPlano(planoId, acao, undefined, duplaId);
  const agora = new Date();
  // re-simula com o MESMO ritmo do combinado — o que muda é só a decisão
  // de recesso nova; se as datas recalculadas forem as mesmas, é aceite
  const plano = montarPlanoEmDia({
    dupla: ctx.dupla,
    eventos,
    ritmo: Number(planoAtual.escopo.ritmo) || undefined,
    disponibilidade: ctx.combinada,
    hoje: agora,
  });
  if (!plano.aplicavel || plano.dataRecuperacao == null)
    return responderPlano(planoId, acao, undefined, duplaId);
  const e = escopoDaProposta(plano, toDateStr(agora));
  if ("erro" in e)
    return responderPlano(planoId, acao, undefined, duplaId);
  // a decisão nova não muda nenhuma data — aceite normal, sem versão nova
  if (mesmaDatas(planoAtual.escopo, e.escopo))
    return responderPlano(planoId, acao, undefined, duplaId);

  // mudou: fecha a versão antiga com o motivo do ajuste e propõe a
  // recalculada — proposta de lado nasce aceita, é o "aprovar no mesmo
  // gesto" da spec
  const rc = await supabase.rpc("plano_responder", {
    p_plano: planoId,
    p_acao: "contestar",
    p_motivo: "A decisão de recesso mudou no aceite — versão recalculada.",
  });
  const rcLido = lerRpc(rc.data, rc.error);
  if ("error" in rcLido) return rcLido;
  const escopo: EscopoProposta = {
    ...e.escopo,
    decisoes: {
      recessos: decisoes,
      ajuste_no_aceite: true,
    },
  };
  const { data, error } = await supabase.rpc("plano_propor", {
    p_dupla: duplaId,
    p_escopo: escopo,
    p_via: "app",
  });
  const r = lerRpc(data, error);
  if ("error" in r) return r;
  const aviso = await avisoPlanoEmail(ctx, duplaId);
  await emitirProdutoEvento(supabase, {
    superficie: "ficha_dupla",
    acao: "plano_proposto",
    meta: {
      plano_id: planoId,
      dupla_id: duplaId,
      ajuste_no_aceite: true,
      aviso_email: aviso.enviados,
    },
  });
  revalidarPlano(duplaId);
  return { ok: true, novaVersao: true, status: r.status };
}

/** Resposta da dupla ao plano "ficar em dia" (0219/0225): o mentor e o
 *  jovem usam a MESMA RPC. Um aceite da dupla ativa o combinado e o outro
 *  lado é avisado; aceitar de novo carimba a ciência (idempotente).
 *  Quem contesta encerra o plano de vez e um acordo novo nasce por
 *  plano_propor como versão nova. */
export async function responderPlano(
  planoId: string,
  acao: "aceitar" | "contestar",
  motivo?: string,
  duplaId?: string
): Promise<Resultado> {
  if (await demoAtivo()) return { ok: true, demo: true };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("plano_responder", {
    p_plano: planoId,
    p_acao: acao,
    p_motivo: motivo ?? null,
  });
  const r = lerRpc(data, error);
  if ("error" in r) return r;
  // aviso externo: só com duplaId e sem expor dados do plano — "tem um
  // combinado no site" + deep link, nada mais
  if (duplaId) {
    const ctx = await contextoPlano(duplaId, []).catch(() => null);
    if (ctx && "ok" in ctx) {
      await avisoPlanoEmail(ctx, duplaId);
    }
  }
  await emitirProdutoEvento(supabase, {
    superficie: "ficha_dupla",
    acao: acao === "aceitar" ? "plano_aceito" : "plano_contestado",
    meta: { plano_id: planoId, dupla_id: duplaId ?? null },
  });
  revalidarPlano(duplaId);
  return r;
}

/** Aplica um passo do plano aceito (0219): grava a data combinada e o
 *  ledger atômico na mesma RPC — vale pra ficha do mentor e pra agenda
 *  do jovem, porque o combinado é dos dois. Repetir é idempotente. */
export async function aplicarPassoPlano(
  planoId: string,
  numero: number,
  dataHora: string,
  link?: string,
  motivo?: string,
  duplaId?: string
): Promise<Resultado> {
  if (await demoAtivo()) return { ok: true, demo: true };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("plano_aplicar_passo", {
    p_plano: planoId,
    p_numero: numero,
    p_data_hora: dataHora,
    p_link: link?.trim() || null,
    p_motivo: motivo ?? null,
    p_via: "app",
  });
  const r = lerRpc(data, error);
  if ("error" in r) return r;
  await emitirProdutoEvento(supabase, {
    superficie: "ficha_dupla",
    acao: "plano_passo",
    meta: { plano_id: planoId, dupla_id: duplaId ?? null, numero },
  });
  revalidarPlano(duplaId);
  return r;
}

/** Ajuste do guia de um encontro (0220): substitui a lista inteira do
 *  número — cada ajuste ancora no guia base (sugestão + justificativa). */
export async function salvarGuiaAjuste(
  duplaId: string,
  numero: number,
  ajustes: { sugestao: string; justificativa: string }[]
): Promise<Resultado> {
  if (await demoAtivo()) return { ok: true, demo: true };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("guia_ajuste_salvar", {
    p_dupla: duplaId,
    p_numero: numero,
    p_ajustes: ajustes,
    p_via: "app",
  });
  const r = lerRpc(data, error);
  if ("error" in r) return r;
  await emitirProdutoEvento(supabase, {
    superficie: "ficha_dupla",
    acao: "plano_guia",
    meta: { dupla_id: duplaId, numero },
  });
  revalidatePath(`/duplas/${duplaId}`);
  return r;
}

/** "Voltar ao guia" (0220): apaga os ajustes do encontro — o oficial
 *  passa a valer sozinho de novo. */
export async function limparGuiaAjuste(
  duplaId: string,
  numero: number
): Promise<Resultado> {
  if (await demoAtivo()) return { ok: true, demo: true };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("guia_ajuste_limpar", {
    p_dupla: duplaId,
    p_numero: numero,
  });
  const r = lerRpc(data, error);
  if ("error" in r) return r;
  await emitirProdutoEvento(supabase, {
    superficie: "ficha_dupla",
    acao: "plano_guia",
    meta: { dupla_id: duplaId, numero, limpar: true },
  });
  revalidatePath(`/duplas/${duplaId}`);
  return r;
}

/** Encaminha ou descarta uma intervenção sugerida (0220): saida
 *  'mensagem' marca como tratada por conversa, 'descartada' arquiva com
 *  o motivo. A saída real é humana — a ação só fecha a sugestão. */
export async function fecharIntervencao(
  intervencaoId: string,
  duplaId: string,
  saida: "mensagem" | "descartada",
  motivo?: string
): Promise<Resultado> {
  if (await demoAtivo()) return { ok: true, demo: true };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("intervencao_fechar", {
    p_intervencao: intervencaoId,
    p_saida: saida,
    p_motivo: motivo ?? null,
  });
  const r = lerRpc(data, error);
  if ("error" in r) return r;
  await emitirProdutoEvento(supabase, {
    superficie: "ficha_dupla",
    acao: "plano_intervencao",
    meta: { dupla_id: duplaId, saida },
  });
  revalidatePath(`/duplas/${duplaId}`);
  return r;
}

/** Intervenção → chamado (0220): abre o chamado com origem 'liza' e já
 *  marca a intervenção como encaminhada — o mesmo movimento do card. */
export async function abrirChamadoIntervencao(
  intervencaoId: string,
  duplaId: string,
  categoria: ChamadoCategoria,
  assunto: string,
  mensagem?: string
): Promise<Resultado> {
  if (await demoAtivo()) return { ok: true, demo: true };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("intervencao_abrir_chamado", {
    p_intervencao: intervencaoId,
    p_categoria: categoria,
    p_assunto: assunto,
    p_mensagem: mensagem ?? null,
    p_descricao_outro: null,
  });
  const r = lerRpc(data, error);
  if ("error" in r) return r;
  await emitirProdutoEvento(supabase, {
    superficie: "ficha_dupla",
    acao: "plano_intervencao",
    meta: { dupla_id: duplaId, saida: "chamado" },
  });
  revalidatePath(`/duplas/${duplaId}`);
  return r;
}

/** A grade no "Combinar o plano" (518, US2.1): cada lado responde a sua
 *  ali mesmo na superfície, sem ejetar pro perfil — mentor grava em
 *  mentor_profiles pelo mesmo self-update do cadastro (a 0004 segue
 *  travando as colunas administrativas), jovem desce pela RPC do papel
 *  (set_disponibilidade_mentorado). Staff não edita grade de ninguém
 *  aqui. Grade vazia vira null, como no cadastro. */
export async function salvarDisponibilidadePlano(
  duplaId: string,
  grade: Disponibilidade | null
): Promise<Resultado> {
  if (await demoAtivo()) return { ok: true, demo: true };
  const supabase = await createClient();
  // round-trip pelo parser do domínio — a RPC/coluna revalida no banco
  const parsed = parseDisponibilidade(JSON.stringify(grade ?? null));
  if (parsed && "error" in parsed) return { error: parsed.error };
  const { data: role } = await supabase.rpc("my_role");
  if (role === "mentorado") {
    const { error } = await supabase.rpc("set_disponibilidade_mentorado", {
      p_grade: parsed,
    });
    if (error) {
      console.error("salvarDisponibilidadePlano:", error);
      return { error: "Não consegui salvar sua grade agora." };
    }
  } else if (role === "mentor_dpp" || role === "mentor_especialista") {
    const { data: pid } = await supabase.rpc("my_profile_id");
    const { error } = await supabase
      .from("mentor_profiles")
      .update({ disponibilidade: parsed })
      .eq("profile_id", pid);
    if (error) {
      console.error("salvarDisponibilidadePlano:", error);
      return { error: "Não consegui salvar sua grade agora." };
    }
  } else {
    return { error: "Só a dupla informa a própria grade." };
  }
  revalidarPlano(duplaId);
  return { ok: true };
}
