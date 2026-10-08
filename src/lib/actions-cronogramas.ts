"use server";

// Actions dos cronogramas oficiais (REALIZA-103) — o builder/editor de
// /turmas. Toda a escrita é da coordenação (a policy cronogramas_coord e
// ciclo_eventos_coord reforçam no banco) e a demo é só leitura.
//
// `ordem` é a chave de sequência do PDF (0062) — nunca derivada de data:
// toda mutação de lista regrava a ordem explícita das rows afetadas.
// inicio_em/fim_em/encontros_esperados do cronograma são derivados dos
// eventos (mesma conta do backfill da 0061) — recalculados a cada mutação.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "./demo/mode";
import { DEMO_MSG } from "./demo/shared";
import { erroAmigavel } from "./utils";
import {
  normalizaEvento,
  totaisCronograma,
  validaEvento,
  validaEventos,
  type EventoRascunho,
} from "./gerador-cronograma";

type Supa = Awaited<ReturnType<typeof createClient>>;

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

type Gate =
  | { supabase: Supa; eu: { id: string; role: string; nome: string }; error: null }
  | { supabase: Supa; eu: null; error: string };

async function meCoord(): Promise<Gate> {
  const { supabase, me: eu } = await me();
  if (!eu) return { supabase, eu: null, error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao")
    return { supabase, eu: null, error: "Só a coordenação gerencia cronogramas." };
  return { supabase, eu, error: null };
}

/** Revalida as superfícies que leem cronograma/eventos: a área /turmas, a
 *  agenda (calendário por cronograma), a home (resumo da semana), as duplas
 *  (semáforo/trilha medem contra o calendário da dupla) e /registros (o título
 *  do encontro por nº vem do evento). */
function revalidaCronograma(cronogramaId?: string) {
  revalidatePath("/turmas");
  if (cronogramaId) revalidatePath(`/turmas/${cronogramaId}`);
  revalidatePath("/agenda");
  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath("/duplas/[id]", "page");
  revalidatePath("/registros");
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type MinEvento = Pick<EventoRascunho, "tipo" | "data" | "data_fim">;

/** Recalcula os campos derivados do cronograma a partir das rows atuais —
 *  mesma fórmula do backfill da 0061 (min data / max data|data_fim / contagem
 *  de encontros). */
async function recalcTotais(supabase: Supa, cronogramaId: string) {
  const { data: evs } = await supabase
    .from("ciclo_eventos")
    .select("tipo, data, data_fim")
    .eq("cronograma_id", cronogramaId);
  const t = totaisCronograma((evs ?? []) as MinEvento[]);
  await supabase
    .from("cronogramas")
    .update({
      inicio_em: t.inicio_em,
      fim_em: t.fim_em,
      encontros_esperados: t.encontros_esperados,
    })
    .eq("id", cronogramaId);
}

/** Eventos do cronograma na sequência oficial — ordenação secundária por id
 *  estabiliza rows com `ordem` empatada (a coluna não é unique por desenho). */
async function eventosOrdenados(
  supabase: Supa,
  cronogramaId: string
): Promise<{ error: string } | { ids: string[] }> {
  const { data, error } = await supabase
    .from("ciclo_eventos")
    .select("id")
    .eq("cronograma_id", cronogramaId)
    .order("ordem", { ascending: true })
    .order("id", { ascending: true });
  if (error) return { error: erroAmigavel(error) };
  return { ids: (data ?? []).map((e) => e.id as string) };
}

/** Regrava `ordem` = posição na lista — reordenação explícita (0062) e, de
 *  brinde, repara gaps/duplicatas que uma edição anterior tenha deixado. */
async function renumerar(
  supabase: Supa,
  cronogramaId: string,
  idsEmOrdem: string[]
) {
  for (let i = 0; i < idsEmOrdem.length; i++) {
    const { error } = await supabase
      .from("ciclo_eventos")
      .update({ ordem: i + 1 })
      .eq("id", idsEmOrdem[i])
      .eq("cronograma_id", cronogramaId);
    if (error) return { error: erroAmigavel(error) };
  }
  return { ok: true as const };
}

// ---------- cronograma ----------

const STATUS_CRONOGRAMA = ["rascunho", "ativo", "encerrado"] as const;

/** Cria a turma/cronograma com os eventos já materializados — a lista sai do
 *  gerador revista/editável na prévia. Sem transação multi-row no PostgREST:
 *  se a inserção dos eventos falhar, a row do cronograma é removida pra não
 *  ficar casca vazia. */
export async function criarCronograma(input: {
  turma: string;
  nome: string;
  status: "rascunho" | "ativo";
  eventos: EventoRascunho[];
}): Promise<{ error: string } | { ok: true; id: string }> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, eu, error } = await meCoord();
  if (error || !eu) return { error: error! };

  const turma = String(input.turma ?? "").trim();
  const nome = String(input.nome ?? "").trim();
  if (turma.length < 1 || turma.length > 80)
    return { error: "A turma precisa ter até 80 caracteres." };
  if (nome.length < 3 || nome.length > 120)
    return { error: "O nome do cronograma precisa ter entre 3 e 120 caracteres." };
  if (!STATUS_CRONOGRAMA.includes(input.status))
    return { error: "Status inválido." };

  const eventos = (input.eventos ?? []).map(normalizaEvento);
  const erroLista = validaEventos(eventos);
  if (erroLista) return { error: erroLista };

  const totais = totaisCronograma(eventos);
  const { data: cron, error: cronErr } = await supabase
    .from("cronogramas")
    .insert({
      nome,
      turma,
      trilha: "dpp",
      status: input.status,
      inicio_em: totais.inicio_em,
      fim_em: totais.fim_em,
      encontros_esperados: totais.encontros_esperados,
      created_by: eu.id,
    })
    .select("id")
    .single();
  if (cronErr) return { error: erroAmigavel(cronErr) };

  const { error: evErr } = await supabase.from("ciclo_eventos").insert(
    eventos.map((e, i) => ({
      ...e,
      cronograma_id: cron.id,
      ordem: i + 1,
    }))
  );
  if (evErr) {
    // rollback manual: sem os eventos o cronograma novo não serve pra nada
    await supabase.from("cronogramas").delete().eq("id", cron.id);
    return { error: erroAmigavel(evErr) };
  }

  revalidaCronograma(cron.id);
  return { ok: true, id: cron.id as string };
}

/** Edita os dados do cronograma (rótulo, turma, status). A turma das duplas
 *  já vinculadas NÃO muda — `duplas.turma` é label gravada no pareamento;
 *  renomear aqui só desloca o selo do cronograma. */
export async function atualizarCronograma(
  id: string,
  input: { nome?: string; turma?: string; status?: string }
): Promise<{ error: string } | { ok: true }> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, error } = await meCoord();
  if (error) return { error };
  if (!UUID_RE.test(id)) return { error: "Cronograma não encontrado." };

  const patch: Record<string, string> = {};
  if (input.nome != null) {
    const nome = input.nome.trim();
    if (nome.length < 3 || nome.length > 120)
      return { error: "O nome do cronograma precisa ter entre 3 e 120 caracteres." };
    patch.nome = nome;
  }
  if (input.turma != null) {
    const turma = input.turma.trim();
    if (turma.length < 1 || turma.length > 80)
      return { error: "A turma precisa ter até 80 caracteres." };
    patch.turma = turma;
  }
  if (input.status != null) {
    if (!(STATUS_CRONOGRAMA as readonly string[]).includes(input.status))
      return { error: "Status inválido." };
    patch.status = input.status;
  }
  if (!Object.keys(patch).length) return { ok: true };

  const { data, error: upErr } = await supabase
    .from("cronogramas")
    .update(patch)
    .eq("id", id)
    .select("id");
  if (upErr) return { error: erroAmigavel(upErr) };
  if (!data?.length) return { error: "Cronograma não encontrado." };
  revalidaCronograma(id);
  return { ok: true };
}

/** Remove o cronograma inteiro — só quando nenhuma dupla o segue e nenhum
 *  evento tem chamada registrada (presencas caem em cascata com o evento; o
 *  histórico de formação não pode sumir em silêncio). */
export async function excluirCronograma(
  id: string
): Promise<{ error: string } | { ok: true }> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, error } = await meCoord();
  if (error) return { error };
  if (!UUID_RE.test(id)) return { error: "Cronograma não encontrado." };

  const { count: duplas, error: dErr } = await supabase
    .from("duplas")
    .select("id", { count: "exact", head: true })
    .eq("cronograma_id", id);
  if (dErr) return { error: erroAmigavel(dErr) };
  if ((duplas ?? 0) > 0)
    return {
      error:
        "Há duplas vinculadas a este cronograma — excluir apagaria o calendário oficial delas. Remaneje as duplas ou encerre o cronograma.",
    };

  // presenças são histórico de chamada — cascata do delete de evento as
  // apagaria; bloqueia em vez de perder o registro
  const { data: evIds, error: eErr } = await supabase
    .from("ciclo_eventos")
    .select("id")
    .eq("cronograma_id", id);
  if (eErr) return { error: erroAmigavel(eErr) };
  const ids = (evIds ?? []).map((e) => e.id);
  if (ids.length) {
    const { count: presencas, error: pErr } = await supabase
      .from("presencas")
      .select("id", { count: "exact", head: true })
      .in("ciclo_evento_id", ids);
    if (pErr) return { error: erroAmigavel(pErr) };
    if ((presencas ?? 0) > 0)
      return {
        error:
          "Há chamadas registradas em eventos deste cronograma. A exclusão apagaria o histórico — encerre o cronograma em vez de excluir.",
      };
    const { error: delEvErr } = await supabase
      .from("ciclo_eventos")
      .delete()
      .eq("cronograma_id", id);
    if (delEvErr) return { error: erroAmigavel(delEvErr) };
  }

  const { error: delErr } = await supabase
    .from("cronogramas")
    .delete()
    .eq("id", id);
  if (delErr) return { error: erroAmigavel(delErr) };
  revalidaCronograma(id);
  return { ok: true };
}

// ---------- eventos ----------

/** Cria ou edita um evento do cronograma. Na criação `posicao` é o índice na
 *  sequência ordenada (0 = primeiro); omitido entra no fim. `ordem` é
 *  regravada explicitamente sempre que a posição muda. */
export async function salvarEventoCronograma(input: {
  id?: string;
  cronograma_id: string;
  rascunho: EventoRascunho;
  /** criação: índice-alvo na sequência (0-based); omitido = fim */
  posicao?: number;
}): Promise<{ error: string } | { ok: true }> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, error } = await meCoord();
  if (error) return { error };
  if (!UUID_RE.test(input.cronograma_id))
    return { error: "Cronograma não encontrado." };
  if (input.id != null && !UUID_RE.test(input.id))
    return { error: "Evento não encontrado." };

  const rascunho = normalizaEvento(input.rascunho);
  const erroEvento = validaEvento(rascunho);
  if (erroEvento) return { error: erroEvento };

  // identidade do encontro oficial é (cronograma, numero) — checa aqui pra
  // dar mensagem útil; o índice único do banco segue sendo a garantia final
  if (rascunho.tipo === "encontro" && rascunho.numero != null) {
    const { data: choque } = await supabase
      .from("ciclo_eventos")
      .select("id")
      .eq("cronograma_id", input.cronograma_id)
      .eq("numero", rascunho.numero)
      .neq("id", input.id ?? "00000000-0000-0000-0000-000000000000");
    if (choque?.length)
      return {
        error: `Já existe um encontro número ${rascunho.numero} neste cronograma.`,
      };
  }

  if (input.id) {
    const { data, error: upErr } = await supabase
      .from("ciclo_eventos")
      .update(rascunho)
      .eq("id", input.id)
      .eq("cronograma_id", input.cronograma_id)
      .select("id");
    if (upErr) return { error: erroAmigavel(upErr) };
    if (!data?.length) return { error: "Evento não encontrado." };
  } else {
    const { data: novo, error: insErr } = await supabase
      .from("ciclo_eventos")
      // placeholder na ponta — a posição real entra no renumber abaixo
      .insert({ ...rascunho, cronograma_id: input.cronograma_id, ordem: 0 })
      .select("id")
      .single();
    if (insErr) return { error: erroAmigavel(insErr) };

    const ordenados = await eventosOrdenados(supabase, input.cronograma_id);
    if ("error" in ordenados) return ordenados;
    const ids = ordenados.ids.filter((x) => x !== novo.id);
    const pos = input.posicao;
    const alvo =
      pos != null && Number.isInteger(pos)
        ? Math.max(0, Math.min(pos, ids.length))
        : ids.length;
    ids.splice(alvo, 0, novo.id as string);
    const ren = await renumerar(supabase, input.cronograma_id, ids);
    if ("error" in ren) return ren;
  }

  await recalcTotais(supabase, input.cronograma_id);
  revalidaCronograma(input.cronograma_id);
  return { ok: true };
}

/** Move o evento uma posição na sequência (dir = -1 sobe, +1 desce). */
export async function moverEvento(
  cronogramaId: string,
  eventoId: string,
  direcao: -1 | 1
): Promise<{ error: string } | { ok: true }> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, error } = await meCoord();
  if (error) return { error };
  if (!UUID_RE.test(cronogramaId) || !UUID_RE.test(eventoId))
    return { error: "Evento não encontrado." };
  if (direcao !== -1 && direcao !== 1) return { error: "Direção inválida." };

  const ordenados = await eventosOrdenados(supabase, cronogramaId);
  if ("error" in ordenados) return ordenados;
  const ids = ordenados.ids;
  const i = ids.indexOf(eventoId);
  if (i < 0) return { error: "Evento não encontrado." };
  const j = i + direcao;
  if (j < 0 || j >= ids.length) return { ok: true }; // já na ponta — no-op

  [ids[i], ids[j]] = [ids[j], ids[i]];
  const ren = await renumerar(supabase, cronogramaId, ids);
  if ("error" in ren) return ren;
  revalidaCronograma(cronogramaId);
  return { ok: true };
}

/** Remove um evento — bloqueia quando há chamada registrada (a cascata do
 *  delete apagaria o histórico de presenças sem aviso). */
export async function excluirEvento(
  cronogramaId: string,
  eventoId: string
): Promise<{ error: string } | { ok: true }> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, error } = await meCoord();
  if (error) return { error };
  if (!UUID_RE.test(cronogramaId) || !UUID_RE.test(eventoId))
    return { error: "Evento não encontrado." };

  const { count: presencas, error: pErr } = await supabase
    .from("presencas")
    .select("id", { count: "exact", head: true })
    .eq("ciclo_evento_id", eventoId);
  if (pErr) return { error: erroAmigavel(pErr) };
  if ((presencas ?? 0) > 0)
    return {
      error:
        "Este evento tem chamada registrada — excluir apagaria as presenças. Edite a data ou o título em vez de excluir.",
    };

  const { data, error: delErr } = await supabase
    .from("ciclo_eventos")
    .delete()
    .eq("id", eventoId)
    .eq("cronograma_id", cronogramaId)
    .select("id");
  if (delErr) return { error: erroAmigavel(delErr) };
  if (!data?.length) return { error: "Evento não encontrado." };

  await recalcTotais(supabase, cronogramaId);
  revalidaCronograma(cronogramaId);
  return { ok: true };
}
