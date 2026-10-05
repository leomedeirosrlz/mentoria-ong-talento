"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notificar } from "@/lib/notificar";
import { demoAtivo } from "./demo/mode";
import { DEMO_MSG } from "./demo/shared";
import { passosDaTrilha } from "./ciclo";
import {
  CHECKLIST_ENCERRAMENTO,
  dadosResumoJornada,
  textoResumoJornada,
} from "./encerramento";
import { erroAmigavel as erroAmigavelBase } from "./utils";
import type {
  CicloEvento,
  EncerramentoChecklist,
  Encontro,
  Registro,
} from "./types";

/** Erro de UI do fechamento — as exceções de domínio dos RPCs
 *  (raise exception → P0001) já chegam em pt-BR e passam direto; o resto
 *  segue a tradução comum de utils. */
function erroAmigavel(e: { message: string; code?: string }): string {
  if (e.code === "P0001" && e.message) return e.message;
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

/** Decisão da coordenação sobre a dupla DPP: 'concluida' = jornada percorrida
 *  até o fim (checklist completo do guia), 'encerrada' = fechamento
 *  antecipado. Grava a row em encerramentos (upsert — a autoavaliação do
 *  mentor pode ter aberto a row antes) e carimba duplas.status. */
export async function registrarEncerramento(
  duplaId: string,
  formData: FormData
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao") {
    return { error: "Só a coordenação registra o encerramento." };
  }

  const tipo = String(formData.get("tipo") ?? "");
  if (tipo !== "concluida" && tipo !== "encerrada") {
    return { error: "Escolha entre concluir e encerrar a jornada." };
  }

  // dupla + tudo que o resumo da jornada precisa; o calendário oficial é o do
  // cronograma DELA (0061) — a união global misturaria passos de duas turmas
  const [{ data: duplaRow }, { data: eventos }] = await Promise.all([
    supabase
      .from("duplas")
      .select(
        `id, status, trilha, iniciada_em, mentor_id, supervisor_id, cronograma_id,
         mentor:profiles!duplas_mentor_id_fkey(nome),
         mentorado:mentorados!duplas_mentorado_id_fkey(nome),
         encontros(numero, status, data_hora, realizado_em,
                  registro:registros(tema, avaliacao)),
         encaminhamentos(status)`
      )
      .eq("id", duplaId)
      .maybeSingle(),
    supabase.from("ciclo_eventos").select("*"),
  ]);
  if (!duplaRow) return { error: "Dupla não encontrada." };
  if (duplaRow.trilha !== "dpp") {
    return {
      error: "A trilha de especialista encerra pelo próprio fluxo: motivo e devolutiva pro PDM.",
    };
  }
  if (duplaRow.status !== "ativa" && duplaRow.status !== "pausada") {
    return { error: "Essa dupla já foi encerrada." };
  }

  // a row pode já existir com a autoavaliação do mentor — o item do
  // checklist deriva dela, não de um clique da coordenação
  const { data: existente } = await supabase
    .from("encerramentos")
    .select("id, tipo, checklist, autoavaliacao_mentor")
    .eq("dupla_id", duplaId)
    .maybeSingle();
  if (existente?.tipo) {
    return { error: "O encerramento dessa dupla já foi registrado." };
  }

  // avaliacao_360_enviada virou fato derivado (0042): a resposta oficial que
  // chega pela RPC marca o checklist — um resave do form não pode "des-chegar"
  // uma resposta. Os demais itens seguem atestação manual da coordenação.
  const prev = (existente?.checklist ?? {}) as EncerramentoChecklist;
  const checklist: EncerramentoChecklist = {
    feedback_final: formData.get("feedback_final") === "on",
    feedback_mutuo: formData.get("feedback_mutuo") === "on",
    revisao_pdm: formData.get("revisao_pdm") === "on",
    avaliacao_360_enviada:
      formData.get("avaliacao_360_enviada") === "on" ||
      !!prev.avaliacao_360_enviada,
    autoavaliacao: !!existente?.autoavaliacao_mentor,
  };

  if (tipo === "concluida") {
    const faltando = CHECKLIST_ENCERRAMENTO.filter(
      (c) => !checklist[c.key]
    ).map((c) => c.label);
    if (faltando.length) {
      return {
        error: `Pra concluir a jornada, o checklist precisa estar completo. Falta: ${faltando.join("; ").toLowerCase()}.`,
      };
    }
  }

  // resumo gerado dos dados — snapshot pro relatório final do guia
  const norm = <T>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  const duplaParaResumo = {
    trilha: duplaRow.trilha,
    status: duplaRow.status,
    iniciada_em: duplaRow.iniciada_em,
    mentor: { nome: norm(duplaRow.mentor)?.nome ?? "—" },
    mentorado: { nome: norm(duplaRow.mentorado)?.nome ?? "—" },
    encontros: (duplaRow.encontros ?? []).map((e) => ({
      ...e,
      registro: norm(e.registro as Registro | Registro[] | null),
    })) as Encontro[],
    encaminhamentos: duplaRow.encaminhamentos ?? [],
  };
  // passos e datas esperadas do cronograma da dupla — fora dele é outra
  // turma (dupla sem cronograma resume só pelo que ela mesma fez)
  const evsDaDupla = ((eventos as CicloEvento[]) ?? []).filter(
    (e) => e.cronograma_id === duplaRow.cronograma_id
  );
  const passos = passosDaTrilha("dpp", evsDaDupla);
  const agora = new Date();
  const resumoJornada = textoResumoJornada(
    dadosResumoJornada(duplaParaResumo, passos, evsDaDupla, agora.toISOString(), agora)
  );

  const { error: errEnc } = await supabase.from("encerramentos").upsert(
    {
      dupla_id: duplaId,
      tipo,
      checklist,
      resumo_jornada: resumoJornada,
      decidido_por: eu.id,
    },
    { onConflict: "dupla_id" }
  );
  if (errEnc) return { error: erroAmigavel(errEnc) };

  const { error: errStatus } = await supabase
    .from("duplas")
    .update({ status: tipo })
    .eq("id", duplaId);
  if (errStatus) return { error: erroAmigavel(errStatus) };

  // quem vive a dupla precisa saber do desfecho — mentor e supervisor.
  // Reuso do tipo 'dupla_formada': é o ciclo de vida da dupla (mesma
  // convenção de pausa/encerramento no updateDupla).
  const nomeMd = norm(duplaRow.mentorado)?.nome;
  await notificar(
    supabase,
    [
      {
        profile_id: duplaRow.mentor_id,
        tipo: "dupla_formada",
        titulo:
          tipo === "concluida"
            ? "Sua dupla concluiu a jornada"
            : "Sua dupla foi encerrada",
        corpo: nomeMd
          ? `A jornada com ${nomeMd} foi registrada. O resumo está na ficha da dupla.`
          : "O encerramento foi registrado na ficha da dupla.",
        href: `/duplas/${duplaId}`,
      },
      duplaRow.supervisor_id
        ? {
            profile_id: duplaRow.supervisor_id,
            tipo: "dupla_formada",
            titulo:
              tipo === "concluida"
                ? "Dupla supervisionada concluída"
                : "Dupla supervisionada encerrada",
            corpo: nomeMd
              ? `A dupla com ${nomeMd}: a coordenação registrou o encerramento.`
              : "A coordenação registrou o encerramento.",
            href: `/duplas/${duplaId}`,
          }
        : null,
    ].filter((r): r is NonNullable<typeof r> => r !== null),
    eu.id
  );

  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}

/** Autoavaliação do mentor — os 2 campos dele na row de encerramento da
 *  própria dupla, via RPC de escopo fino (checklist/tipo/decisão não passam
 *  pela mão dele). */
export async function salvarAutoavaliacao(
  duplaId: string,
  formData: FormData
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };

  const texto = String(formData.get("autoavaliacao") ?? "").trim();
  const disponivel = formData.get("disponivel_proximo_ciclo") === "on";
  if (texto.length < 10 || texto.length > 4000) {
    return {
      error: "Conte como foi a jornada em 10 a 4.000 caracteres.",
    };
  }

  const { error } = await supabase.rpc("salvar_autoavaliacao", {
    p_dupla: duplaId,
    p_texto: texto,
    p_disponivel: disponivel,
  });
  if (error) return { error: erroAmigavel(error) };

  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}

/** Fechamento da trilha de especialista — o especialista dono ou a
 *  coordenação, com motivo obrigatório e devolutiva pro PDM. O RPC carimba
 *  status + os 3 campos numa transação (e trava a corrida de dois cliques). */
export async function encerrarTrilhaEspecialista(
  duplaId: string,
  formData: FormData
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };

  const tipo = String(formData.get("tipo") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();
  const devolutiva = String(formData.get("devolutiva_pdm") ?? "").trim();
  if (tipo !== "concluida" && tipo !== "encerrada") {
    return { error: "Escolha entre concluir e encerrar a trilha." };
  }
  if (motivo.length < 3 || motivo.length > 300) {
    return { error: "O motivo do encerramento precisa de 3 a 300 caracteres." };
  }
  if (devolutiva.length < 10 || devolutiva.length > 4000) {
    return {
      error: "A devolutiva pro PDM precisa de 10 a 4.000 caracteres.",
    };
  }

  const { error } = await supabase.rpc("encerrar_trilha_especialista", {
    p_dupla: duplaId,
    p_tipo: tipo,
    p_motivo: motivo,
    p_devolutiva: devolutiva,
  });
  if (error) return { error: erroAmigavel(error) };

  // quem pediu o especialista precisa da devolutiva; a coordenação acompanha.
  // A solicitação liga a dupla de especialista à dupla DPP de origem.
  const [{ data: s }, { data: espDupla }, { data: coords }] = await Promise.all([
    supabase
      .from("solicitacoes_especialista")
      .select("created_by, dupla_dpp_id, mentorado_id")
      .eq("dupla_id", duplaId)
      .maybeSingle(),
    supabase
      .from("duplas")
      .select("mentor_id, mentorado:mentorados!duplas_mentorado_id_fkey(nome)")
      .eq("id", duplaId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id")
      .eq("role", "coordenacao")
      .eq("ativo", true),
  ]);
  // embed to-one pode voltar como array no tipo do supabase-js
  const mdRaw = espDupla?.mentorado as unknown;
  const mdEmb = Array.isArray(mdRaw) ? mdRaw[0] : mdRaw;
  const nomeMd = (mdEmb as { nome: string } | null | undefined)?.nome ?? null;
  const titulo =
    tipo === "concluida" ? "Trilha de especialista concluída" : "Trilha de especialista encerrada";
  await notificar(
    supabase,
    [
      // o solicitante volta pra ficha DPP — a devolutiva aparece lá, no chip
      // da solicitação (a dupla de especialista não é do escopo dele)
      s?.created_by
        ? {
            profile_id: s.created_by,
            tipo: "trilha_encerrada",
            titulo,
            corpo: nomeMd
              ? `${eu.nome} fechou a mentoria de ${nomeMd}. A devolutiva pro PDM está na ficha da dupla.`
              : `${eu.nome} fechou a trilha. A devolutiva pro PDM está na ficha da dupla.`,
            href: `/duplas/${s.dupla_dpp_id}`,
          }
        : null,
      ...(coords ?? [])
        .filter((c: { id: string }) => c.id !== s?.created_by)
        .map((c: { id: string }) => ({
          profile_id: c.id,
          tipo: "trilha_encerrada",
          titulo,
          corpo: nomeMd
            ? `${eu.nome} fechou a trilha de ${nomeMd}: motivo e devolutiva na ficha.`
            : `${eu.nome} fechou a trilha de especialista.`,
          href: `/duplas/${duplaId}`,
        })),
      // se a coordenação encerrou, o especialista também é avisado
      eu.role === "coordenacao" && espDupla?.mentor_id
        ? {
            profile_id: espDupla.mentor_id,
            tipo: "trilha_encerrada",
            titulo,
            corpo: "A coordenação registrou o encerramento da sua trilha.",
            href: `/duplas/${duplaId}`,
          }
        : null,
    ].filter((r): r is NonNullable<typeof r> => r !== null),
    eu.id
  );

  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath(`/duplas/${duplaId}`);
  if (s?.dupla_dpp_id) revalidatePath(`/duplas/${s.dupla_dpp_id}`);
  return { ok: true };
}
