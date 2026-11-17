"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  ESCOLARIDADES,
  parseDisponibilidade,
  SENTINEL_VAZIO,
} from "./ciclo";
import { parseDataHora } from "./escritas";
import { getSlotsLivres } from "./queries-especialista";
import { demoAtivo } from "./demo/mode";
import { DEMO_MSG } from "./demo/shared";
import { erroAmigavel as erroAmigavelBase } from "./utils";
import type { Disponibilidade, SolicitacaoEspecialistaStatus } from "./types";

// Writes do jovem (REALIZA-112 PR2) — o pedido de especialista vai direto
// por RPC definer: a 0074 já valida tudo no servidor (teto de trilhas,
// dedup por par, slot dentro da grade real, gate da demanda) e levanta os
// erros em pt-BR (P0001) que passam direto pro toast. O mentorado_id NUNCA
// sai do cliente — a RPC deriva por my_mentorado_id().

/** Erro de UI do pedido do jovem — mesma convenção do actions-especialista:
 *  P0001 já chega pt-BR do banco; o resto traduz pela tabela comum. */
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

/** Opt-in colega↔colega da 0076 — liga/desliga a exibição do WhatsApp do
 *  cadastro pros colegas de turma com conta (view mentorados_turma). O
 *  banco rejeita quem não é o próprio jovem; no demo a preferência é
 *  fixa pra continuar ilustrando os dois estados dos colegas. */
export async function setContatoCompartilhado(ligado: boolean) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "mentorado") {
    return { error: "Essa escolha é só do jovem." };
  }
  const { error } = await supabase.rpc("set_contato_compartilhado", {
    p_ligado: ligado,
  });
  if (error) return { error: erroAmigavel(error) };
  revalidatePath("/jovem/perfil");
  revalidatePath("/jovem/pessoas");
  return { ok: true };
}

/** Grade semanal do próprio jovem (REALIZA-114) — escrita via RPC definer
 *  set_disponibilidade_mentorado (0078): mentorados não tem UPDATE pro
 *  papel, então a escrita deriva a ficha por my_mentorado_id() no banco.
 *  A grade chega como objeto tipado do client; o parse revalida o
 *  vocabulário do CHECK antes de mandar (grade vazia vira null). Serve o
 *  wizard de primeiro acesso e a edição do /jovem/perfil. */
export async function salvarDisponibilidadeJovem(
  grade: Disponibilidade | null
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "mentorado") {
    return { error: "Só o próprio jovem informa a disponibilidade dele." };
  }
  // round-trip pelo parser do domínio: filtra qualquer valor fora do
  // vocabulário antes do jsonb — a RPC revalida de novo no servidor
  const parsed = parseDisponibilidade(JSON.stringify(grade ?? null));
  if (parsed && "error" in parsed) return { error: parsed.error };
  const { error } = await supabase.rpc("set_disponibilidade_mentorado", {
    p_grade: parsed,
  });
  if (error) return { error: erroAmigavel(error) };
  revalidatePath("/jovem");
  revalidatePath("/jovem/perfil");
  return { ok: true };
}

/** Ficha do programa editável pelo próprio jovem (REALIZA-420) — os 3
 *  campos auto-descritivos (objetivos, motivação, escolaridade) descem
 *  pela RPC jovem_update_ficha (0200/0202): a whitelist de colunas mora
 *  no banco, porque mentorados não tem UPDATE pro papel. A validação
 *  espelha camposFicha (trim + teto dos CHECKs da 0034) pra devolver o
 *  erro claro em vez do 23514; a RPC revalida de novo no servidor. O form
 *  sempre manda o conjunto completo — vazio vira null ("limpar"). */
export async function salvarFichaJovem(formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "mentorado") {
    return { error: "Só o próprio jovem edita a ficha dele." };
  }

  const campos: Record<string, string | null> = {};
  for (const [k, max, rotulo] of [
    ["objetivos", 2000, "Objetivos com a mentoria"],
    ["motivacao", 2000, "Motivação"],
  ] as const) {
    const v = String(formData.get(k) ?? "").trim() || null;
    if (v && v.length > max) {
      return { error: `O campo "${rotulo}" aceita até ${max} caracteres.` };
    }
    campos[k] = v;
  }
  // SelectOpcional emite SENTINEL_VAZIO no "Não informado" (contrato do
  // camposFicha): sentinela e branco viram null; fora do vocabulário é erro
  const escolaridadeRaw = String(formData.get("escolaridade") ?? "").trim();
  const escolaridade =
    escolaridadeRaw === SENTINEL_VAZIO ? "" : escolaridadeRaw;
  if (!escolaridade) {
    campos.escolaridade = null;
  } else if (!(ESCOLARIDADES as readonly string[]).includes(escolaridade)) {
    return { error: "Escolha uma escolaridade válida." };
  } else {
    campos.escolaridade = escolaridade;
  }

  const { error } = await supabase.rpc("jovem_update_ficha", {
    p_objetivos: campos.objetivos,
    p_motivacao: campos.motivacao,
    p_escolaridade: campos.escolaridade,
  });
  if (error) return { error: erroAmigavel(error) };
  revalidatePath("/jovem/perfil");
  return { ok: true };
}

/** Foto do jovem no bucket `avatares` (REALIZA-419) — o arquivo já subiu
 *  na pasta do profile_id pelo client (a policy da 0014/0024 garante); a
 *  RPC jovem_set_avatar (0200) grava mentorados.avatar_path, a coluna que
 *  jovem_perfil e mentorados_turma projetam (profiles.avatar_path é a dos
 *  adultos). Mesmo protocolo do setAvatarPath de staff: path fora da
 *  própria pasta é rejeitado e o arquivo antigo sai do bucket. */
export async function setAvatarJovem(path: string | null) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "mentorado") {
    return { error: "Só o próprio jovem troca a foto dele." };
  }
  if (path != null && !path.startsWith(`${eu.id}/`)) {
    return { error: "Não foi possível usar esse arquivo." };
  }

  // jovem_perfil já é self-scoped — o path antigo sai sem round extra
  const { data: atual } = await supabase
    .from("jovem_perfil")
    .select("avatar_path")
    .maybeSingle();
  const { error } = await supabase.rpc("jovem_set_avatar", {
    p_path: path ?? undefined,
  });
  if (error) return { error: erroAmigavel(error) };

  const antigo = atual?.avatar_path;
  if (antigo && antigo !== path) {
    await supabase.storage.from("avatares").remove([antigo]);
  }
  revalidatePath("/jovem/perfil");
  revalidatePath("/jovem/pessoas");
  // o avatar do rodapé da sidebar vem do layout — revalida o grupo inteiro
  revalidatePath("/jovem", "layout");
  return { ok: true };
}

/** O jovem pede uma sessão de especialista (pedir_especialista_jovem,
 *  0074): direcionado (com slot opcional da grade real dele) ou broadcast
 *  pro mural. Todo pedido nasce 'aberta', direto no mural (0158: sem
 *  triagem da coordenação) — devolvemos o status pra UI contar certo, sem
 *  prometer sessão marcada (ela só nasce no aceite). */
export async function pedirEspecialistaJovem(input: {
  especialistaId: string | null;
  slot: string | null;
  demanda: string | null;
  motivo: string | null;
}): Promise<{
  ok?: true;
  status?: SolicitacaoEspecialistaStatus;
  error?: string;
}> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "mentorado") {
    return { error: "Só jovens mentorados podem pedir um especialista." };
  }

  const especialistaId = input.especialistaId || null;
  const slot = input.slot || null;
  const demanda = input.demanda?.trim() || null;
  const motivo = input.motivo?.trim() || null;

  // saneamento de forma — o domínio (gate, dedup, teto, grade) a RPC valida
  if (demanda && (demanda.length < 10 || demanda.length > 1000)) {
    return { error: "Conta um pouco mais — entre 10 e 1.000 caracteres." };
  }
  if (motivo && (motivo.length < 3 || motivo.length > 500)) {
    return { error: "O motivo precisa ter entre 3 e 500 caracteres." };
  }
  if (slot) {
    if (!especialistaId) {
      return { error: "Escolha um especialista pra propor um horário." };
    }
    if (Number.isNaN(Date.parse(slot))) {
      return { error: "Escolha um horário válido." };
    }
  }

  const { data: id, error } = await supabase.rpc("pedir_especialista_jovem", {
    p_especialista_id: especialistaId ?? undefined,
    p_demanda: demanda ?? undefined,
    p_motivo: motivo ?? undefined,
    p_slot: slot ?? undefined,
  });
  if (error) return { error: erroAmigavel(error) };
  if (!id) return { error: "Não foi possível enviar o pedido. Tente de novo." };

  // a linha nasce 'aberta' (0158: com ou sem dupla DPP); o jovem lê a
  // própria solicitação pelo sol_select
  const { data: sol } = await supabase
    .from("solicitacoes_especialista")
    .select("status")
    .eq("id", id)
    .single();

  // o pedido muda a home do jovem, a agenda (dedup por especialista), a
  // página de especialistas e o mural de quem atende (staff na home)
  revalidatePath("/jovem");
  revalidatePath("/jovem/agenda");
  revalidatePath("/jovem/especialistas");
  revalidatePath("/");
  return {
    ok: true,
    status: (sol?.status ?? "aberta") as SolicitacaoEspecialistaStatus,
  };
}

/** Leitura embrulhada em action pro dialog client: os slots livres do
 *  especialista escolhido (mesma projeção definer da /jovem/agenda —
 *  especialista_slots_livres é pública pra autenticado). No demo devolve a
 *  projeção do dataset — leitura não é write, não leva DEMO_MSG. */
export async function buscarSlotsEspecialista(
  especialistaId: string
): Promise<{ slots: string[] }> {
  if (!especialistaId) return { slots: [] };
  return { slots: await getSlotsLivres(especialistaId) };
}

/** WP6 — o jovem confirma a sugestão que o mentor DPP registrou (status
 *  'sugerida' → 'aberta', virando pedido de verdade). Pode ajustar o
 *  especialista-destino, a demanda e o objetivo antes de mandar — a RPC
 *  refaz os tetos de pedidos em aberto e o dedup por especialista. */
export async function confirmarSugestaoEspecialista(input: {
  id: string;
  especialistaId?: string | null;
  demanda?: string | null;
  objetivo?: string | null;
}): Promise<{ ok?: true; error?: string }> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "mentorado") {
    return { error: "Só o jovem mentorado confirma a sugestão." };
  }
  if (!input.id) return { error: "Sugestão não encontrada." };
  const demanda = input.demanda?.trim() || null;
  const objetivo = input.objetivo?.trim() || null;
  if (demanda && (demanda.length < 10 || demanda.length > 1000)) {
    return { error: "A demanda precisa ter entre 10 e 1.000 caracteres." };
  }
  if (objetivo && (objetivo.length < 3 || objetivo.length > 500)) {
    return { error: "O objetivo precisa ter entre 3 e 500 caracteres." };
  }
  const { error } = await supabase.rpc("confirmar_sugestao_especialista", {
    p_id: input.id,
    p_demanda: demanda ?? undefined,
    p_objetivo: objetivo ?? undefined,
    p_especialista_id: input.especialistaId ?? undefined,
  });
  if (error) return { error: erroAmigavel(error) };
  revalidatePath("/jovem");
  revalidatePath("/jovem/agenda");
  revalidatePath("/jovem/especialistas");
  revalidatePath("/");
  return { ok: true };
}

/** WP6 — o jovem dispensa a sugestão do mentor (vira 'cancelada' e sai de
 *  vista). A decisão é dele — a demanda pertence a quem vive o tema. */
export async function dispensarSugestaoEspecialista(
  id: string
): Promise<{ ok?: true; error?: string }> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "mentorado") {
    return { error: "Só o jovem mentorado responde à sugestão." };
  }
  if (!id) return { error: "Sugestão não encontrada." };
  const { error } = await supabase.rpc("dispensar_sugestao_especialista", {
    p_id: id,
  });
  if (error) return { error: erroAmigavel(error) };
  revalidatePath("/jovem");
  revalidatePath("/jovem/especialistas");
  revalidatePath("/");
  return { ok: true };
}

// ---------- retroativo do jovem (REALIZA-437, migration 0207) ----------
// As RPCs definer devolvem jsonb {error} em pt-BR pronto pro toast — a
// action só saneia o payload e repassa. O encontro nasce realizado: é o
// que destrava a avaliação dele, e o registro do mentor segue devido.

function retornoRpc(data: unknown): {
  error?: string;
  ok?: boolean;
  encontro_id?: string;
} {
  return (data ?? {}) as { error?: string; ok?: boolean; encontro_id?: string };
}

/** O jovem registra encontro que já aconteceu sem agendamento prévio —
 *  a linha que faltava na lista pra avaliar. A mesma RPC cobre a correção
 *  de data do retroativo criado por ele (upsert por (dupla,numero)
 *  enquanto o mentor não registrou). `dataHora` chega naïve do
 *  datetime-local; a RPC revalida tudo (dupla DPP ativa dele, teto do
 *  cronograma sem o último, passado, piso do início da mentoria). */
export async function registrarRetroativoJovem(
  duplaId: string,
  numero: number,
  dataHora: string
): Promise<{ error?: string; ok?: boolean; encontroId?: string }> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "mentorado") {
    return { error: "Essa ação é do mentorado." };
  }
  if (!duplaId || !numero || !dataHora) {
    return { error: "Encontro e data são obrigatórios." };
  }
  const quando = parseDataHora(dataHora);
  if (!quando) return { error: "Confira a data." };
  const { data, error } = await supabase.rpc("registrar_retroativo_mentorado", {
    p_dupla: duplaId,
    p_numero: numero,
    p_data_hora: quando.toISOString(),
  });
  if (error) return { error: erroAmigavel(error) };
  const ret = retornoRpc(data);
  if (ret.error) return { error: ret.error };
  // realizado sem registro pende pro mentor — a home dele, a agenda e a
  // ficha da dupla leem a mesma row que acabou de nascer (ou mudar)
  revalidatePath("/jovem");
  revalidatePath("/jovem/agenda");
  revalidatePath("/jovem/materiais");
  revalidatePath("/");
  revalidatePath("/agenda");
  revalidatePath("/duplas");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true, encontroId: ret.encontro_id };
}

/** Desfaz o retroativo criado pelo próprio jovem enquanto o mentor não
 *  registrou — o "não aconteceu de verdade" do gesto dele. */
export async function desfazerRetroativoJovem(encontroId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "mentorado") {
    return { error: "Essa ação é do mentorado." };
  }
  // a dupla sai antes do delete só pra revalidar a ficha dela — a RPC não
  // devolve o id
  const { data: enc } = await supabase
    .from("encontros")
    .select("dupla_id")
    .eq("id", encontroId)
    .maybeSingle();
  const { data, error } = await supabase.rpc("desfazer_retroativo_mentorado", {
    p_encontro: encontroId,
  });
  if (error) return { error: erroAmigavel(error) };
  const ret = retornoRpc(data);
  if (ret.error) return { error: ret.error };
  revalidatePath("/jovem");
  revalidatePath("/jovem/agenda");
  revalidatePath("/");
  revalidatePath("/agenda");
  revalidatePath("/duplas");
  if (enc?.dupla_id) revalidatePath(`/duplas/${enc.dupla_id}`);
  return { ok: true };
}
