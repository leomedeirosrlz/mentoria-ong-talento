"use server";

/** Roteiros do plano (020 — REALIZA-521): gerar sob demanda (equipe),
 *  editar rascunho e publicar — sempre via as RPCs definer da 0231 com o
 *  client de sessão (a RLS é a fronteira; `contextoPlano` prova o papel
 *  antes de qualquer leitura de referência). */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { emitirProdutoEvento } from "./produto-eventos-server";
import { demoAtivo } from "./demo/mode";
import { contextoPlano } from "./plano-servico";
import { getCicloEventos } from "./queries";
import { montarRoteiroDoPlano, planoVigente } from "./plano-roteiros-servico";
import { docBlocosSchema } from "./doc-bloco-schema";
import type { DocBloco } from "./materiais-documentos";
import type { DuplaPlanoRoteiro } from "./types";

export type Resultado = {
  ok?: boolean;
  demo?: boolean;
  error?: string;
  id?: string;
};

function lerRpc(data: unknown, error: { message: string } | null): Resultado {
  if (error) {
    console.error("actions-roteiros:", error);
    return { error: "Não consegui concluir agora." };
  }
  const r = data as { error?: string; id?: string } | null;
  if (r?.error)
    return { error: r.error.charAt(0).toUpperCase() + r.error.slice(1) };
  return { ok: true, id: r?.id };
}

/** O plano mora nas duas homes, na ficha, na agenda do jovem e na rota
 *  do roteiro — toda escrita revalida as cinco. */
function revalidarRoteiros(duplaId: string) {
  revalidatePath(`/duplas/${duplaId}`);
  revalidatePath("/");
  revalidatePath("/jovem");
  revalidatePath("/jovem/agenda");
  revalidatePath(`/duplas/${duplaId}/roteiro/[numero]`, "page");
  revalidatePath("/jovem/roteiro/[numero]", "page");
}

async function buscarRoteiro(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<DuplaPlanoRoteiro | null> {
  const { data, error } = await supabase
    .from("dupla_plano_roteiros")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("buscarRoteiro:", error);
  return (data as DuplaPlanoRoteiro | null) ?? null;
}

/** "Gerar a semana" (equipe): monta determinístico e salva como
 *  rascunho — revisão humana antes de publicar. Se já existe publicado,
 *  a RPC cria uma versão nova e preserva a anterior. */
export async function gerarRoteiroSemana(
  duplaId: string,
  numero: number
): Promise<Resultado> {
  if (await demoAtivo()) return { ok: true, demo: true };
  const eventos = await getCicloEventos();
  const ctx = await contextoPlano(duplaId, eventos);
  if ("error" in ctx) return ctx;
  if (ctx.lado !== "staff")
    return { error: "Quem gera a semana sob demanda é a equipe." };
  const plano = planoVigente(ctx.dupla);
  if (!plano) return { error: "Essa dupla não tem um combinado em vigor." };
  if (!(plano.escopo?.numeros ?? []).includes(numero))
    return { error: "Esse encontro não faz parte do combinado." };

  const supabase = await createClient();
  const conteudo = await montarRoteiroDoPlano(
    ctx.dupla,
    plano,
    numero,
    eventos
  );
  const { data, error } = await supabase.rpc("roteiro_salvar", {
    p_plano: plano.id,
    p_numero: numero,
    p_conteudo: conteudo as unknown as never,
    p_via: "app",
  });
  const r = lerRpc(data, error);
  if ("error" in r) return r;
  await emitirProdutoEvento(supabase, {
    superficie: "ficha_dupla",
    acao: "plano_guia",
    meta: { dupla_id: duplaId, numero, gesto: "roteiro_gerar" },
  });
  revalidarRoteiros(duplaId);
  return r;
}

/** Salvar edição do rascunho: conteúdo validado pelo schema e conflito
 *  checado por updated_at — quem edita por último não sobrescreve em
 *  silêncio (a RPC não tem parâmetro de concorrência; o check mora aqui). */
export async function salvarRoteiroSemana(
  duplaId: string,
  roteiroId: string,
  conteudo: DocBloco[],
  expectedUpdatedAt: string
): Promise<Resultado> {
  if (await demoAtivo()) return { ok: true, demo: true };
  const valido = docBlocosSchema.safeParse(conteudo);
  if (!valido.success)
    return { error: "O conteúdo tem bloco inválido — revise antes de salvar." };
  const supabase = await createClient();
  const row = await buscarRoteiro(supabase, roteiroId);
  if (!row || row.dupla_id !== duplaId)
    return { error: "Não encontrei esse roteiro." };
  if (row.status !== "rascunho")
    return { error: "Só o rascunho é editável — o publicado não muda." };
  if (row.updated_at !== expectedUpdatedAt)
    return {
      error:
        "Esse rascunho mudou enquanto você editava — recarregue pra ver a versão atual.",
    };
  const { data, error } = await supabase.rpc("roteiro_salvar", {
    p_plano: row.plano_id,
    p_numero: row.numero,
    p_conteudo: valido.data as unknown as never,
    p_via: "app",
  });
  const r = lerRpc(data, error);
  if ("error" in r) return r;
  await emitirProdutoEvento(supabase, {
    superficie: "ficha_dupla",
    acao: "plano_guia",
    meta: { dupla_id: duplaId, numero: row.numero, gesto: "roteiro_editar" },
  });
  revalidarRoteiros(duplaId);
  return r;
}

/** Publicar o rascunho: a RPC marca os demais como `substituido`. */
export async function publicarRoteiroSemana(
  duplaId: string,
  roteiroId: string
): Promise<Resultado> {
  if (await demoAtivo()) return { ok: true, demo: true };
  const supabase = await createClient();
  const row = await buscarRoteiro(supabase, roteiroId);
  if (!row || row.dupla_id !== duplaId)
    return { error: "Não encontrei esse roteiro." };
  if (row.status !== "rascunho")
    return { error: "Só o rascunho publica — essa versão já encerrou." };
  const { data, error } = await supabase.rpc("roteiro_publicar", {
    p_id: roteiroId,
  });
  const r = lerRpc(data, error);
  if ("error" in r) return r;
  await emitirProdutoEvento(supabase, {
    superficie: "ficha_dupla",
    acao: "plano_guia",
    meta: { dupla_id: duplaId, numero: row.numero, gesto: "roteiro_publicar" },
  });
  revalidarRoteiros(duplaId);
  return r;
}
