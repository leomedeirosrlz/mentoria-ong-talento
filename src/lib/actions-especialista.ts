"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notificar } from "@/lib/notificar";
import { demoAtivo } from "./demo/mode";
import { DEMO_MSG } from "./demo/shared";
import { erroAmigavel as erroAmigavelBase } from "./utils";

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

async function me() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data } = await supabase
    .from("profiles")
    .select("id, role, nome")
    .eq("user_id", (claimsData?.claims?.sub as string) ?? "")
    .single();
  return { supabase, me: data };
}

/** Corpo da notificação com a demanda resumida — o texto completo fica na
 *  solicitação; o ping carrega só o suficiente pra decidir abrir. */
function resumo(texto: string, max = 200): string {
  return texto.length > max ? `${texto.slice(0, max).trimEnd()}…` : texto;
}

export async function criarSolicitacao(formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };

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
    .select("id, mentor_id, mentorado_id, status, trilha")
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
    const { data: esp } = await supabase
      .from("profiles")
      .select("id, role, ativo")
      .eq("id", desejado)
      .maybeSingle();
    if (esp?.role !== "mentor_especialista" || !esp.ativo) {
      return { error: "Escolha um mentor especialista ativo." };
    }
  }

  const { data: aberta } = await supabase
    .from("solicitacoes_especialista")
    .select("id")
    .eq("dupla_dpp_id", dupla_dpp_id)
    .eq("status", "aberta")
    .limit(1);
  if (aberta?.length) {
    return { error: "Já existe uma solicitação aberta pra essa dupla." };
  }

  const { error } = await supabase.from("solicitacoes_especialista").insert({
    mentorado_id: dupla.mentorado_id,
    dupla_dpp_id,
    demanda,
    especialista_desejado_id: desejado,
    created_by: eu.id,
  });
  if (error) return { error: erroAmigavel(error) };

  // pings: o especialista escolhido ou todos os ativos + a coordenação.
  // notificar() filtra o autor — se o solicitante for coord, ele não se pinga.
  const [esps, coords, mentorado] = await Promise.all([
    desejado
      ? Promise.resolve({ data: [{ id: desejado }] })
      : supabase
          .from("profiles")
          .select("id")
          .eq("role", "mentor_especialista")
          .eq("ativo", true),
    supabase.from("profiles").select("id").eq("role", "coordenacao").eq("ativo", true),
    supabase.from("mentorados").select("nome").eq("id", dupla.mentorado_id).maybeSingle(),
  ]);
  const nomeMentorado = mentorado.data?.nome;
  await notificar(
    supabase,
    [
      ...(esps.data ?? []).map((d: { id: string }) => ({
        profile_id: d.id,
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

  revalidatePath(`/duplas/${dupla_dpp_id}`);
  revalidatePath("/"); // card de demandas no dashboard da coordenação
  return { ok: true };
}

export async function aceitarSolicitacao(solicitacaoId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };

  // o RPC faz aceite + criação da dupla numa transação só — imune à corrida
  // de dois especialistas aceitando a mesma demanda
  const { data: duplaId, error } = await supabase.rpc("aceitar_solicitacao", {
    p_id: solicitacaoId,
  });
  if (error || !duplaId) {
    return { error: error ? erroAmigavel(error) : "Não foi possível concluir. Tente de novo." };
  }

  // depois do aceite a solicitação é "a sua" — legível pela RLS do especialista
  const [{ data: s }, { data: coords }] = await Promise.all([
    supabase
      .from("solicitacoes_especialista")
      .select("created_by, dupla_dpp_id")
      .eq("id", solicitacaoId)
      .single(),
    supabase.from("profiles").select("id").eq("role", "coordenacao").eq("ativo", true),
  ]);

  await notificar(
    supabase,
    [
      // o solicitante volta pra ficha DPP — a dupla nova é do especialista e
      // o mentor DPP não tem acesso a ela (RLS)
      {
        profile_id: s?.created_by,
        tipo: "especialista_aceitou",
        titulo: "Um especialista aceitou o pedido",
        corpo: `${eu.nome} vai mentorar esse jovem.`,
        href: `/duplas/${s?.dupla_dpp_id}`,
      },
      // a coordenação gerencia: link direto pra dupla recém-nascida. Quem
      // solicitou já recebeu o ping acima — não duplica.
      ...(coords ?? [])
        .filter((c: { id: string }) => c.id !== s?.created_by)
        .map((c: { id: string }) => ({
          profile_id: c.id,
          tipo: "especialista_aceitou",
          titulo: "Pedido de especialista aceito",
          corpo: `${eu.nome} assumiu — a dupla foi criada.`,
          href: `/duplas/${duplaId}`,
        })),
    ],
    eu.id
  );

  revalidatePath("/");
  return { ok: true, duplaId };
}

export async function cancelarSolicitacao(solicitacaoId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };

  const { data: s } = await supabase
    .from("solicitacoes_especialista")
    .select("id, status, created_by, dupla_dpp_id")
    .eq("id", solicitacaoId)
    .maybeSingle();
  if (!s) return { error: "Solicitação não encontrada." };
  if (s.status !== "aberta") {
    return { error: "Só dá pra cancelar uma solicitação aberta." };
  }
  const ehSolicitante = s.created_by === eu.id;
  const ehCoord = eu.role === "coordenacao";
  if (!ehSolicitante && !ehCoord) {
    return { error: "Só quem solicitou ou a coordenação podem cancelar." };
  }

  // o eq(status) garante que uma corrida com o aceite não desfaça a dupla
  const { error } = await supabase
    .from("solicitacoes_especialista")
    .update({ status: "cancelada", respondida_em: new Date().toISOString() })
    .eq("id", solicitacaoId)
    .eq("status", "aberta");
  if (error) return { error: erroAmigavel(error) };

  // aviso leve no sentido oposto: mentor cancela → coordenação fica sabendo;
  // coordenação cancela → quem pediu é avisado
  const rows = ehCoord
    ? [
        {
          profile_id: s.created_by,
          tipo: "solicitacao_cancelada",
          titulo: "Solicitação de especialista cancelada",
          corpo: "A coordenação cancelou o pedido de mentor especialista.",
          href: `/duplas/${s.dupla_dpp_id}`,
        },
      ]
    : (
        await supabase
          .from("profiles")
          .select("id")
          .eq("role", "coordenacao")
          .eq("ativo", true)
      ).data?.map((c: { id: string }) => ({
        profile_id: c.id,
        tipo: "solicitacao_cancelada",
        titulo: "Solicitação de especialista cancelada",
        corpo: `${eu.nome} cancelou o pedido de mentor especialista.`,
        href: `/duplas/${s.dupla_dpp_id}`,
      })) ?? [];
  await notificar(supabase, rows, eu.id);

  revalidatePath(`/duplas/${s.dupla_dpp_id}`);
  revalidatePath("/");
  return { ok: true };
}
