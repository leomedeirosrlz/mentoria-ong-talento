"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notificar } from "@/lib/notificar";
import { toDateStr } from "./ciclo";
import { demoAtivo } from "./demo/mode";
import { DEMO_MSG } from "./demo/shared";
import { erroAmigavel as erroAmigavelBase } from "./utils";
import type { AppRole } from "./types";

/** Erro de UI do fluxo de especialista — as exceções de domínio do RPC
 *  aceitar_solicitacao (raise exception → P0001) já chegam em pt-BR e passam
 *  direto; a capacidade fala em "especialista", não "mentor". */
function erroAmigavel(e: { message: string; code?: string }): string {
  if (e.code === "P0001" && e.message) return e.message;
  if (/capacidade do mentor excedida/i.test(e.message)) {
    return "Esse especialista já atingiu o número máximo de duplas.";
  }
  return erroAmigavelBase(e);
}

/** Normaliza o embed `profile_papeis` pro `papeis` efetivo — união do role
 *  primário com as linhas do embed (mesmo padrão do comPapeis de
 *  queries.ts, com o primário na união pra temPapel funcionar). */
const comPapeis = <T extends { role: AppRole | null }>(
  p: T & { profile_papeis?: { papel: AppRole }[] | null }
): Omit<T, "profile_papeis"> & { papeis: AppRole[] } => {
  const { profile_papeis, ...rest } = p;
  return {
    ...rest,
    papeis: [
      ...new Set<AppRole>([
        ...(p.role ? [p.role] : []),
        ...(profile_papeis ?? []).map((r) => r.papel),
      ]),
    ],
  };
};

async function me() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data } = await supabase
    .from("profiles")
    .select("id, role, nome, profile_papeis(papel)")
    .eq("user_id", (claimsData?.claims?.sub as string) ?? "")
    .single();
  return { supabase, me: data ? comPapeis(data) : data };
}

/** Corpo da notificação com a demanda resumida — o texto completo fica na
 *  solicitação; o ping carrega só o suficiente pra decidir abrir. */
function resumo(texto: string, max = 200): string {
  return texto.length > max ? `${texto.slice(0, max).trimEnd()}…` : texto;
}

/** Status efetivo da solicitação (0074): pedido em aberto com slot vencido
 *  lê 'expirada' sem writer — dedup e CTAs não podem olhar só a coluna. */
const STATUS_EM_ABERTO = ["aberta", "aguardando_coord", "contra_proposta"];

/** Revalida as rotas onde a solicitação aparece — o mural staff (/), a ficha
 *  DPP quando ela é a origem e as superfícies do jovem (o autor de pedido
 *  jovem age pela própria home/agenda — cancelar, contra-propor, aceitar a
 *  proposta do especialista). */
function revalidarMural(duplaDppId?: string | null) {
  revalidatePath("/");
  revalidatePath("/jovem");
  revalidatePath("/jovem/agenda");
  if (duplaDppId) revalidatePath(`/duplas/${duplaDppId}`);
}

export async function criarSolicitacao(formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };

  const dupla_dpp_id = String(formData.get("dupla_dpp_id") ?? "");
  const demanda = String(formData.get("demanda") ?? "").trim();
  const desejado = String(formData.get("especialista_desejado_id") ?? "").trim() || null;

  if (!dupla_dpp_id) return { error: "Dupla não informada." };
  if (demanda.length < 10 || demanda.length > 1000) {
    return { error: "Descreva o contexto em 10 a 1.000 caracteres." };
  }

  // a dupla de origem precisa ser DPP e estar ativa — a solicitação nasce da
  // trilha principal, nunca de uma dupla de especialista ou encerrada
  const { data: dupla } = await supabase
    .from("duplas")
    .select("id, mentor_id, mentorado_id, status, trilha, turma")
    .eq("id", dupla_dpp_id)
    .maybeSingle();
  if (!dupla) return { error: "Dupla não encontrada." };
  const ehMentorDaDupla = dupla.mentor_id === eu.id;
  const ehCoord = eu.role === "coordenacao";
  if (!ehMentorDaDupla && !ehCoord) {
    return { error: "Só o mentor da dupla ou a coordenação podem pedir um especialista." };
  }
  if ((dupla.trilha ?? "dpp") !== "dpp") {
    return { error: "Só dá pra pedir um especialista a partir de uma dupla DPP." };
  }
  if (dupla.status !== "ativa") {
    return { error: "A dupla precisa estar ativa para pedir um especialista." };
  }

  if (desejado) {
    // papel efetivo (WP6b): o híbrido com especialista como secundário vale
    // — !inner em profile_papeis devolve null quando a linha não existe
    const { data: esp } = await supabase
      .from("profiles")
      .select("id, profile_papeis!inner(papel)")
      .eq("id", desejado)
      .eq("profile_papeis.papel", "mentor_especialista")
      .eq("ativo", true)
      .maybeSingle();
    if (!esp) {
      return { error: "Escolha um mentor especialista ativo." };
    }
  }

  // "em aberto" v2 (0074): aguardando triagem ou em negociação também ocupam
  // o pedido — e um slot vencido (status_efetivo 'expirada') libera de novo
  const agora = new Date().toISOString();
  const { data: aberta } = await supabase
    .from("solicitacoes_especialista")
    .select("id")
    .eq("dupla_dpp_id", dupla_dpp_id)
    .in("status", STATUS_EM_ABERTO)
    .or(`slot_proposto.is.null,slot_proposto.gt.${agora}`)
    .limit(1);
  if (aberta?.length) {
    return { error: "Já existe uma solicitação em aberto pra essa dupla." };
  }

  const { error } = await supabase.from("solicitacoes_especialista").insert({
    mentorado_id: dupla.mentorado_id,
    dupla_dpp_id,
    demanda,
    turma: dupla.turma,
    especialista_desejado_id: desejado,
    created_by: eu.id,
  });
  if (error) return { error: erroAmigavel(error) };

  // pings: o especialista escolhido ou todos os ativos + a coordenação.
  // notificar() filtra o autor — se o solicitante for coord, ele não se pinga.
  const [esps, coords, mentorado] = await Promise.all([
    desejado
      ? Promise.resolve({ data: [{ id: desejado }] })
      : // broadcast vai pra quem TEM o papel, não só pro primário (WP6b)
        supabase
          .from("profiles")
          .select("id, profile_papeis!inner(papel)")
          .eq("profile_papeis.papel", "mentor_especialista")
          .eq("ativo", true),
    supabase.from("profiles").select("id").eq("role", "coordenacao").eq("ativo", true),
    supabase.from("mentorados").select("nome").eq("id", dupla.mentorado_id).maybeSingle(),
  ]);
  const nomeMentorado = mentorado.data?.nome;
  // o !inner devolve UMA linha de profile por linha de papel — o papel em
  // múltiplos escopos duplicaria o especialista e o ping chegaria em dobro
  const espIds = [
    ...new Set((esps.data ?? []).map((d: { id: string }) => d.id)),
  ];
  await notificar(
    supabase,
    [
      ...espIds.map((id) => ({
        profile_id: id,
        tipo: "demanda_especialista",
        titulo: "Novo pedido de mentoria especializada",
        corpo: resumo(demanda),
        href: "/",
      })),
      ...(coords.data ?? []).map((c: { id: string }) => ({
        profile_id: c.id,
        tipo: "solicitacao_registrada",
        titulo: "Solicitação de especialista registrada",
        corpo: nomeMentorado
          ? `${eu.nome} pediu um especialista pra ${nomeMentorado}.`
          : `${eu.nome} pediu um especialista.`,
        href: `/duplas/${dupla_dpp_id}`,
      })),
    ],
    eu.id
  );

  revalidarMural(dupla_dpp_id);
  return { ok: true };
}

export async function aceitarSolicitacao(
  solicitacaoId: string,
  slot: string | null = null
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (!solicitacaoId) return { error: "Solicitação não informada." };
  if (slot != null && Number.isNaN(Date.parse(slot))) {
    return { error: "Escolha um horário válido." };
  }

  // o RPC efetiva: pedido staff sem slot → o especialista escolhe na hora
  // (p_slot); com slot na mesa (do jovem ou da última proposta) o aceite usa
  // o proposto. Aceite + criação do encontro/dupla numa transação só —
  // imune à corrida de dois especialistas. A notificação sai do próprio RPC.
  const { data: duplaId, error } = await supabase.rpc("aceitar_solicitacao", {
    p_id: solicitacaoId,
    p_slot: slot,
  });
  if (error || !duplaId) {
    return { error: error ? erroAmigavel(error) : "Não foi possível concluir. Tente de novo." };
  }

  // a RPC avisa autor/jovem/mentor DPP mas não a coordenação — quem gerencia
  // o programa precisa ver o aceite (link direto pra dupla nova, que é do
  // escopo deles). Quem pediu sendo coord não duplica.
  const [{ data: s }, { data: coords }] = await Promise.all([
    supabase
      .from("solicitacoes_especialista")
      .select("created_by")
      .eq("id", solicitacaoId)
      .single(),
    supabase.from("profiles").select("id").eq("role", "coordenacao").eq("ativo", true),
  ]);
  await notificar(
    supabase,
    (coords ?? [])
      .filter((c: { id: string }) => c.id !== s?.created_by)
      .map((c: { id: string }) => ({
        profile_id: c.id,
        tipo: "especialista_aceitou",
        titulo: "Pedido de especialista aceito",
        corpo: `${eu.nome} assumiu. A sessão foi marcada.`,
        href: `/duplas/${duplaId}`,
      })),
    eu.id
  );

  revalidarMural();
  return { ok: true, duplaId };
}

export async function cancelarSolicitacao(solicitacaoId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };

  const { data: s } = await supabase
    .from("solicitacoes_especialista")
    .select("id, status, created_by, dupla_dpp_id")
    .eq("id", solicitacaoId)
    .maybeSingle();
  if (!s) return { error: "Solicitação não encontrada." };
  if (!STATUS_EM_ABERTO.includes(s.status)) {
    return { error: "Esse pedido não pode mais ser cancelado." };
  }
  const ehSolicitante = s.created_by === eu.id;
  const ehCoord = eu.role === "coordenacao";
  if (!ehSolicitante && !ehCoord) {
    return { error: "Só quem pediu ou a coordenação podem cancelar." };
  }

  // a RPC valida de novo e notifica o especialista engajado/dirigido — o
  // app só complementa: quando a coordenação cancela pedido alheio, quem
  // pediu fica sabendo (a RPC só avisa o lado do especialista)
  const { error } = await supabase.rpc("cancelar_solicitacao", {
    p_id: solicitacaoId,
  });
  if (error) return { error: erroAmigavel(error) };

  if (ehCoord && !ehSolicitante) {
    await notificar(
      supabase,
      [
        {
          profile_id: s.created_by,
          tipo: "solicitacao_cancelada",
          titulo: "Solicitação de especialista cancelada",
          corpo: "A coordenação cancelou o pedido de mentor especialista.",
          href: s.dupla_dpp_id ? `/duplas/${s.dupla_dpp_id}` : "/",
        },
      ],
      eu.id
    );
  }

  revalidarMural(s.dupla_dpp_id);
  return { ok: true };
}

/** Contra-proposta de horário (0074) — dos dois lados da mesa: o
 *  especialista responde ao pedido, o autor responde à proposta dele. O
 *  slot SEMPRE sai da grade do especialista — a RPC valida. */
export async function contraProporSolicitacao(
  solicitacaoId: string,
  slotIso: string,
  mensagem?: string | null
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (!solicitacaoId) return { error: "Solicitação não informada." };
  if (!slotIso || Number.isNaN(Date.parse(slotIso))) {
    return { error: "Escolha um horário válido." };
  }
  const msg = mensagem?.trim() || null;
  if (msg && (msg.length < 3 || msg.length > 500)) {
    return { error: "A mensagem precisa ter entre 3 e 500 caracteres." };
  }

  const { error } = await supabase.rpc("contra_propor_solicitacao", {
    p_id: solicitacaoId,
    p_slot: slotIso,
    p_mensagem: msg,
  });
  if (error) return { error: erroAmigavel(error) };
  revalidarMural();
  return { ok: true };
}

/** Recusa do pedido — só o especialista procurado/engajado, e sempre com
 *  justificativa (a recusa chega ao autor como `solicitacao_recusada`). */
export async function recusarSolicitacao(
  solicitacaoId: string,
  justificativa: string
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (!solicitacaoId) return { error: "Solicitação não informada." };
  const just = justificativa.trim();
  if (just.length < 3) {
    return { error: "Explique o motivo da recusa." };
  }
  if (just.length > 500) {
    return { error: "A justificativa aceita até 500 caracteres." };
  }

  const { error } = await supabase.rpc("recusar_solicitacao", {
    p_id: solicitacaoId,
    p_justificativa: just,
  });
  if (error) return { error: erroAmigavel(error) };
  revalidarMural();
  return { ok: true };
}

/** O autor (ou a coordenação) aceita a proposta que o especialista deixou
 *  na mesa — a RPC confere que a última proposta é dele e efetiva. */
export async function aceitarProposta(solicitacaoId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (!solicitacaoId) return { error: "Solicitação não informada." };

  const { data: duplaId, error } = await supabase.rpc("aceitar_proposta", {
    p_id: solicitacaoId,
  });
  if (error || !duplaId) {
    return { error: error ? erroAmigavel(error) : "Não foi possível concluir. Tente de novo." };
  }
  revalidarMural();
  return { ok: true, duplaId };
}

/** Triagem da coordenação (0074): pedido do jovem sem dupla DPP entra
 *  'aguardando_coord' — reconhecer libera pro mural com a turma definida. */
export async function reconhecerSolicitacao(
  solicitacaoId: string,
  turma: string
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao") {
    return { error: "Só a coordenação faz a triagem." };
  }
  if (!solicitacaoId) return { error: "Solicitação não informada." };
  if (!turma.trim()) return { error: "Escolha uma turma." };

  const { error } = await supabase.rpc("reconhecer_solicitacao", {
    p_id: solicitacaoId,
    p_turma: turma.trim(),
  });
  if (error) return { error: erroAmigavel(error) };
  revalidarMural();
  return { ok: true };
}

// ---------- agenda real do especialista (0073) ----------
// Grade semanal + exceções datadas. RLS restringe a escrita ao dono da
// agenda (mentor_especialista) e à coordenação — os checks de papel aqui
// são UX honesta (o banco segura o resto). `profile_id` é sempre o da
// sessão: ninguém edita agenda alheia pelo app.

/** "HH:mm" do input time → `time` do Postgres (segundos entram como :00). */
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

function erroAgenda(e: { message: string; code?: string }): string {
  // unique(profile_id, dia_semana, hora_inicio) — a janela repetida
  if (/especialista_grade_profile_id_dia_semana_hora_inicio_key/i.test(e.message)) {
    return "Já existe uma janela começando nesse horário nesse dia.";
  }
  return erroAmigavel(e);
}

function revalidarAgenda() {
  revalidatePath("/agenda");
  // os slots aparecem pro jovem com dupla de especialista ativa
  revalidatePath("/jovem/agenda");
}

export async function adicionarJanela(formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };

  const diaSemana = Number(formData.get("dia_semana"));
  const horaInicio = String(formData.get("hora_inicio") ?? "");
  const horaFim = String(formData.get("hora_fim") ?? "");
  if (!Number.isInteger(diaSemana) || diaSemana < 0 || diaSemana > 6) {
    return { error: "Escolha o dia da semana." };
  }
  if (!HORA_RE.test(horaInicio) || !HORA_RE.test(horaFim)) {
    return { error: "Confira os horários da janela." };
  }
  if (horaFim <= horaInicio) {
    return { error: "O fim da janela precisa ser depois do início." };
  }

  const { error } = await supabase.from("especialista_grade").insert({
    profile_id: eu.id,
    dia_semana: diaSemana,
    hora_inicio: horaInicio,
    hora_fim: horaFim,
  });
  if (error) return { error: erroAgenda(error) };
  revalidarAgenda();
  return { ok: true };
}

export async function removerJanela(id: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (!id) return { error: "Janela não informada." };

  const { error } = await supabase
    .from("especialista_grade")
    .delete()
    .eq("id", id)
    .eq("profile_id", eu.id);
  if (error) return { error: erroAgenda(error) };
  revalidarAgenda();
  return { ok: true };
}

export async function adicionarExcecao(formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };

  const data = String(formData.get("data") ?? "");
  const tipo = String(formData.get("tipo") ?? "");
  const horaInicio = String(formData.get("hora_inicio") ?? "");
  const horaFim = String(formData.get("hora_fim") ?? "");
  if (!DATA_RE.test(data)) return { error: "Escolha a data da exceção." };
  if (tipo !== "bloqueio" && tipo !== "extra") {
    return { error: "Escolha o tipo da exceção." };
  }
  if (!HORA_RE.test(horaInicio) || !HORA_RE.test(horaFim)) {
    return { error: "Confira os horários da exceção." };
  }
  if (horaFim <= horaInicio) {
    return { error: "O fim precisa ser depois do início." };
  }
  // exceção passada não muda a projeção e não apareceria na lista — erro
  // honesto em vez de sumir com o que a pessoa acabou de cadastrar
  if (data < toDateStr(new Date())) {
    return { error: "Escolha uma data de hoje em diante." };
  }

  const { error } = await supabase.from("especialista_excecoes").insert({
    profile_id: eu.id,
    data,
    tipo,
    hora_inicio: horaInicio,
    hora_fim: horaFim,
  });
  if (error) return { error: erroAgenda(error) };
  revalidarAgenda();
  return { ok: true };
}

export async function removerExcecao(id: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (!id) return { error: "Exceção não informada." };

  const { error } = await supabase
    .from("especialista_excecoes")
    .delete()
    .eq("id", id)
    .eq("profile_id", eu.id);
  if (error) return { error: erroAgenda(error) };
  revalidarAgenda();
  return { ok: true };
}

/** WP6 — o mentor DPP registra a demanda de especialista em nome do jovem:
 *  nasce 'sugerida' (fora dos tetos e do mural) e só vira pedido real
 *  quando o jovem confirma. A RPC valida que o autor é o DPP da dupla
 *  ativa — aqui saneamos forma e repassamos. */
export async function sugerirEspecialistaMentor(input: {
  mentoradoId: string;
  demanda: string;
  objetivo?: string | null;
  especialistaId?: string | null;
  duplaDppId?: string | null;
}): Promise<{ ok?: true; error?: string }> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role === "mentorado") {
    return { error: "O jovem pede direto pela página de especialistas." };
  }

  const demanda = input.demanda?.trim() ?? "";
  const objetivo = input.objetivo?.trim() || null;
  if (!input.mentoradoId) return { error: "Mentorado não informado." };
  if (demanda.length < 10 || demanda.length > 1000) {
    return { error: "Descreva o tema em 10 a 1.000 caracteres." };
  }
  if (objetivo && (objetivo.length < 3 || objetivo.length > 500)) {
    return { error: "O objetivo precisa ter entre 3 e 500 caracteres." };
  }

  const { error } = await supabase.rpc("sugerir_especialista_mentor", {
    p_mentorado_id: input.mentoradoId,
    p_demanda: demanda,
    p_objetivo: objetivo ?? undefined,
    p_especialista_id: input.especialistaId ?? undefined,
  });
  if (error) return { error: erroAmigavel(error) };

  revalidarMural(input.duplaDppId);
  revalidatePath("/jovem/especialistas");
  return { ok: true };
}

/** WP6 — o especialista devolve pra trilha ao longo do percurso (não só no
 *  encerramento). Só o mentor daquela dupla esp aberta escreve — a RPC
 *  confere o vínculo de novo. */
export async function postarDevolutiva(input: {
  duplaId: string;
  texto: string;
}): Promise<{ ok?: true; error?: string }> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };

  const texto = input.texto?.trim() ?? "";
  if (!input.duplaId) return { error: "Trilha não informada." };
  if (texto.length < 10 || texto.length > 4000) {
    return { error: "Escreva a devolutiva (entre 10 e 4.000 caracteres)." };
  }

  const { error } = await supabase.rpc("postar_devolutiva", {
    p_dupla_id: input.duplaId,
    p_texto: texto,
  });
  if (error) return { error: erroAmigavel(error) };

  revalidatePath(`/duplas/${input.duplaId}`);
  revalidatePath("/jovem/especialistas");
  return { ok: true };
}
