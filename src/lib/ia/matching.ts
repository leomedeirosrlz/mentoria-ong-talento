// Runtime server do pareamento semântico (REALIZA-338) — recompute do
// perfil vetorial por pessoa. O núcleo puro (doc, temas, ordenação) vive
// em ../matching.ts; aqui ficam as bordas: fetch, LLM, embedding e
// escrita na matching_perfis via service role.
//
// Quem dispara: `depoisDe` nas actions de cadastro/edição/onboarding/
// papel/ativação/saída — pós-resposta via after() pra IA nunca segurar
// um save. A sync é idempotente e se auto-corrige: decide sozinha entre
// recomputar (mentor ativo / jovem ativo) e remover (perdeu o papel,
// desativou, saiu do programa) — os hooks não precisam saber o estado.
//
// Escrita: só service role (a tabela não tem policy de escrita).
// Degradação por camada: sem IA_* não há temas novos; sem IA_EMBED_*
// não há vetor novo; falha de provider preserva o que já existia
// (campo ausente do patch = mantido no upsert). Em todos os casos o
// Parear segue funcionando na ordem determinística de sempre.

import { createHash } from "node:crypto";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/types";
import {
  TEMAS_MATCHING,
  montarDocMatching,
  sanitizarTemas,
  type DadosMentor,
  type DadosMentorado,
  type DonoTipo,
} from "../matching";
import { chamarModelo } from "./provider";
import { embedQuery, embedConfigurado } from "./embed";

export type { DonoTipo };

export function docHash(doc: string): string {
  return createHash("sha256").update(doc, "utf8").digest("hex");
}

const TEMAS_MAX = 6;

async function extrairTemas(doc: string): Promise<string[] | null> {
  if (!doc.trim()) return [];
  const res = await chamarModelo(
    [
      {
        role: "system",
        content:
          "Você extrai temas de perfis de um programa de mentoria pra pareamento. " +
          `Responda SOMENTE com um array JSON de até ${TEMAS_MAX} strings escolhidas desta lista fechada: ` +
          `${TEMAS_MATCHING.join(", ")}. Nada além do array.`,
      },
      { role: "user", content: doc },
    ],
    undefined,
    // sem papéis → payload sem tools: anunciar tools aqui só ensinaria o
    // modelo a chamar função em vez de responder o array
    { papeis: [] }
  );
  if (!res.ok) return null;
  return sanitizarTemas(res.mensagem.content);
}

const SELECT_MENTOR =
  "interesses, motivacao, bio, cargo, empresa, form_bruto, mentor_profiles(experiencia_previa, formacao_externa, areas)";
const SELECT_MENTORADO =
  "interesses, motivacao, objetivos, escolaridade, ong_origem, form_bruto";

/** Recomputa o perfil-matching de uma pessoa: monta o doc, pula se o
 *  hash não mudou, extrai temas (LLM) e vetor (OpenAI) em paralelo e faz
 *  upsert. Falha de provider preserva o que já existia (campo ausente do
 *  patch = valor anterior mantido no upsert). Nunca lança — é pós-
 *  resposta, um soluço de IA não pode virar erro de cadastro. */
export async function recomputarMatchingPerfil(
  tipo: DonoTipo,
  id: string
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: dados } =
      tipo === "mentor"
        ? await admin
            .from("profiles")
            .select(SELECT_MENTOR)
            .eq("id", id)
            .maybeSingle()
        : await admin
            .from("mentorados")
            .select(SELECT_MENTORADO)
            .eq("id", id)
            .maybeSingle();
    if (!dados) return;

    const doc = montarDocMatching(
      tipo,
      dados as DadosMentor & DadosMentorado
    );
    const hash = docHash(doc);
    const { data: atual } = await admin
      .from("matching_perfis")
      .select("doc_hash")
      .eq("dono_tipo", tipo)
      .eq("dono_id", id)
      .maybeSingle();
    if (atual?.doc_hash === hash) return;

    const [temas, vec] = await Promise.all([
      extrairTemas(doc),
      embedConfigurado() ? embedQuery(doc) : Promise.resolve(null),
    ]);

    const patch: Record<string, unknown> = {
      dono_tipo: tipo,
      dono_id: id,
      doc,
      doc_hash: hash,
      gerado_em: new Date().toISOString(),
    };
    // null = falha/ausência de provider → não escreve o campo (o upsert
    // preserva o valor anterior); [] de temas é resposta válida e grava
    if (temas != null) patch.temas = temas;
    if (vec) patch.embedding = `[${vec.join(",")}]`;

    const { error } = await admin
      .from("matching_perfis")
      .upsert(patch, { onConflict: "dono_tipo,dono_id" });
    if (error) console.error("matching_perfil upsert:", error.message);
  } catch (e) {
    console.error("recomputarMatchingPerfil:", e);
  }
}

export async function removerMatchingPerfil(
  tipo: DonoTipo,
  id: string
): Promise<void> {
  try {
    await createAdminClient()
      .from("matching_perfis")
      .delete()
      .eq("dono_tipo", tipo)
      .eq("dono_id", id);
  } catch (e) {
    console.error("removerMatchingPerfil:", e);
  }
}

const PAPEIS_MENTOR: AppRole[] = ["mentor_dpp", "mentor_especialista"];

/** Ponto de entrada único pra pessoa física (profiles): decide sozinho
 *  se recomputa (mentor ativo) ou remove (desativado/sem papel de
 *  mentor). Especialista também vetoriza — não entra na fila DPP, mas o
 *  doc dele já serve pro pareamento por demanda quando chegar lá. */
export async function sincronizarMatchingPerfilPessoa(
  profileId: string
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: p } = await admin
      .from("profiles")
      .select("id, ativo, role, profile_papeis(papel)")
      .eq("id", profileId)
      .maybeSingle();
    const papeis = new Set(
      [
        p?.role,
        ...(p?.profile_papeis ?? []).map(
          (r: { papel: AppRole }) => r.papel
        ),
      ].filter(Boolean) as AppRole[]
    );
    if (!p?.ativo || !PAPEIS_MENTOR.some((r) => papeis.has(r))) {
      return removerMatchingPerfil("mentor", profileId);
    }
    return recomputarMatchingPerfil("mentor", profileId);
  } catch (e) {
    console.error("sincronizarMatchingPerfilPessoa:", e);
  }
}

/** Idem pro jovem: recompute só enquanto ativo no programa; desistente/
 *  concluído sai do pool semântico junto com o pool visual. */
export async function sincronizarMatchingPerfilMentorado(
  mentoradoId: string
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: m } = await admin
      .from("mentorados")
      .select("id, situacao")
      .eq("id", mentoradoId)
      .maybeSingle();
    if (!m || m.situacao !== "ativo") {
      return removerMatchingPerfil("mentorado", mentoradoId);
    }
    return recomputarMatchingPerfil("mentorado", mentoradoId);
  } catch (e) {
    console.error("sincronizarMatchingPerfilMentorado:", e);
  }
}

/** Agenda o trabalho depois da resposta — `after` lança fora de request
 *  scope (testes, chamadas programáticas); nesses contextos o recompute
 *  simplesmente não dispara, e cadastro nunca quebra por causa de IA. */
export function depoisDe(task: () => Promise<void> | void): void {
  try {
    after(task);
  } catch {
    // sem request scope não há pós-resposta pra agendar — skip silencioso
  }
}
