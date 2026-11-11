// Domain write cores shared by the server actions (actions.ts) and the
// AI write tools (ia/tools.ts). One contract — a rule that lives here
// can't be silently bypassed by a new caller: the "a dupla agenda" guard
// is the canonical example (the encontros policy lets coord write for
// operational fixes, so the domain refusal must live in code, not RLS).
//
// Each core receives the caller-scoped client (session JWT in actions,
// JWT/PAT client in tools — RLS applies equally) plus `eu` (the resolved
// profile) and returns { error } | { ok } — never throws, never touches
// the request lifecycle (session/demo/revalidate stay in the wrappers).

import type { SupabaseClient } from "@supabase/supabase-js";
import { MOTIVOS_REAGENDAMENTO, UFS } from "@/lib/ciclo";
import { erroAmigavel, nomeProprio } from "@/lib/utils";
import { emailValido, normEmail, normWhatsapp } from "@/lib/importar";
import type { AppRole, SituacaoMentorado } from "@/lib/types";

/** The resolved caller a write core needs: profile id + primary role
 *  (`me()` in actions, my_profile_id/my_role in the IA transport). */
export type AtorEscrita = {
  id: string;
  role: AppRole | null;
};

export type ResultadoCore = { error: string; duplaId?: string } | { ok: true; valor?: string | null };

const GENERICO = "Não foi possível concluir. Recarregue a página e tente de novo.";

/** http/https only — a stored javascript:/data: URL renders <a href> as-is. */
export function urlOk(s: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(s).protocol);
  } catch {
    return false;
  }
}

/** Accepts both client formats: ISO with offset ("...Z" / "+03:00") parses
 *  as a Date directly; naïve `datetime-local` ("YYYY-MM-DDTHH:mm", no
 *  offset) is read as São Paulo time (fixed -03:00, no DST). */
export function parseDataHora(s: string): Date | null {
  const d = new Date(/Z|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}-03:00`);
  return isNaN(d.getTime()) ? null : d;
}

// ---------- agendar_encontro ----------

export type ParamsAgendarEncontro = {
  dupla_id: string;
  numero: number;
  data_hora: string;
  link: string | null;
  /** preset value from MOTIVOS_REAGENDAMENTO or "outro" (reschedules) */
  motivo?: string;
  motivo_outro?: string;
};

/** Schedules or reschedules an encounter — the "a dupla agenda" rule lives
 *  here, not only in the UI: the broad fixes RLS policy would let coord
 *  write, so the contract is this guard. Specialist track: a new session
 *  is only born from an accepted request — rescheduling an existing
 *  attempt is allowed, creating a row from scratch is not. */
export async function agendarEncontroCore(
  supabase: SupabaseClient,
  eu: AtorEscrita,
  params: ParamsAgendarEncontro
): Promise<{ error: string } | { ok: true }> {
  if (eu.role === "coordenacao") {
    return { error: "Quem agenda é a dupla. A coordenação acompanha o andamento." };
  }
  const { dupla_id, numero, data_hora, link } = params;
  const motivo = (params.motivo ?? "").trim();
  const motivoOutro = (params.motivo_outro ?? "").trim();
  if (!dupla_id || !numero || !data_hora) return { error: "Data e horário são obrigatórios." };
  const { data: d } = await supabase
    .from("duplas")
    .select("status, trilha, cronograma_id")
    .eq("id", dupla_id)
    .single();
  // no row = RLS hid it (not theirs) or the duo doesn't exist
  if (!d) return { error: "Dupla não encontrada." };
  if (d.status !== "ativa") return { error: "Essa dupla não está ativa." };
  // DPP without a schedule is invalid data — without a calendar the number
  // ceiling would be a lie; point at the fix instead of booking blind
  if (d.trilha !== "especialista" && !d.cronograma_id) {
    return { error: "Essa dupla está sem cronograma — a coordenação vincula um na edição da dupla." };
  }
  const quando = parseDataHora(data_hora);
  if (!quando) return { error: "Confira a data." };

  // never overwrite a completed encounter (re-scheduling would erase "realizado")
  const { data: existente } = await supabase
    .from("encontros")
    .select("id, status, data_hora")
    .eq("dupla_id", dupla_id)
    .eq("numero", numero)
    .maybeSingle();
  if (existente?.status === "realizado") {
    return { error: "Esse encontro já foi realizado e não pode ser remarcado." };
  }

  if (d.trilha === "especialista" && !existente) {
    return {
      error:
        "As sessões da trilha especialista nascem dos pedidos aceitos — combine com o jovem ou a coordenação.",
    };
  }

  // scheduling always looks forward — an encounter that already happened
  // goes through the retroactive flow (stamps realizado_em); moving a
  // scheduled one into the past would hide lateness
  if (quando.getTime() <= Date.now()) {
    return {
      error: existente
        ? "Essa data já passou. Se o encontro aconteceu, registre como foi ou marque 'não aconteceu' na ficha da dupla."
        : "Essa data já passou. Use 'Registrar encontro já realizado' na ficha da dupla ou na agenda do dia.",
    };
  }
  if (link && !urlOk(link)) {
    return { error: "Confira o link: precisa ser um endereço completo (https://…)." };
  }

  // number ceiling per track — specialist counts ATTEMPTS (the CHECK takes
  // up to 24); DPP measures against THE DUO's calendar (0061), never global
  const maxNum =
    d.trilha === "especialista"
      ? 24
      : ((
          await supabase
            .from("ciclo_eventos")
            .select("numero")
            .eq("tipo", "encontro")
            .eq("cronograma_id", d.cronograma_id!)
            .order("numero", { ascending: false })
            .limit(1)
            .maybeSingle()
        ).data?.numero ?? 16);
  if (!Number.isInteger(numero) || numero < 1 || numero > maxNum) {
    return { error: "Escolha um encontro da lista." };
  }

  // a real reschedule = the date changed; saving the same date again (just
  // to swap the link, say) needs no reason and doesn't touch what was
  // audited. Compares instants, not strings — PostgREST returns "+00:00",
  // toISOString gives "Z"
  const ehReagendamento =
    existente != null &&
    existente.data_hora != null &&
    new Date(existente.data_hora).getTime() !== quando.getTime();
  let motivoReagendamento: string | null = null;
  if (ehReagendamento) {
    if (!motivo) return { error: "Conte o motivo do reagendamento." };
    if (motivo === "outro") {
      if (motivoOutro.length < 2 || motivoOutro.length > 140) {
        return { error: "Descreva o motivo do reagendamento (2 a 140 caracteres)." };
      }
      motivoReagendamento = motivoOutro;
    } else {
      const preset = MOTIVOS_REAGENDAMENTO.find((m) => m.value === motivo);
      if (!preset) return { error: "Escolha um motivo de reagendamento." };
      motivoReagendamento = preset.label;
    }
  }

  // update keeps created_by; insert is the encounter's first time.
  // motivo_reagendamento only enters the payload on a real reschedule —
  // an edit that doesn't move the date must not overwrite the audited one
  const payload = {
    data_hora: quando.toISOString(),
    link,
    status: "agendado" as const,
    ...(motivoReagendamento ? { motivo_reagendamento: motivoReagendamento } : {}),
  };
  const { error } = existente
    ? await supabase.from("encontros").update(payload).eq("id", existente.id)
    : await supabase
        .from("encontros")
        .insert({ ...payload, dupla_id, numero, created_by: eu.id });
  if (error) return { error: erroAmigavel(error) };
  return { ok: true };
}

// ---------- marcar_situacao_mentorado ----------

const SITUACOES_MENTORADO = ["ativo", "desistente", "concluido"] as const;

/** Marks the mentorado's exit from the program (0077) — desistente/
 *  concluído — or reactivation (situacao 'ativo' clears stamp and reason).
 *  Coord-only; the live duo is a precondition: whoever has a pair in
 *  progress goes through the duo-card closing rite FIRST — marking the
 *  exit over it would leave a slot occupied by someone who already left. */
export async function marcarSaidaMentoradoCore(
  supabase: SupabaseClient,
  eu: AtorEscrita,
  params: { id: string; situacao: SituacaoMentorado; motivo?: string | null }
): Promise<{ error: string; duplaId?: string } | { ok: true }> {
  if (eu.role !== "coordenacao") {
    return { error: "Só a coordenação marca a saída de mentorados." };
  }
  const { id, situacao } = params;
  if (!(SITUACOES_MENTORADO as readonly string[]).includes(situacao)) {
    return { error: "Escolha uma situação válida." };
  }
  const motivoTxt = (params.motivo ?? "").trim() || null;
  if (motivoTxt && motivoTxt.length > 300) {
    return { error: "O motivo da saída aceita até 300 caracteres." };
  }
  // the reason is the "why" the card and the list display — desistente
  // without it becomes mute data; concluído is exempt (the journey speaks)
  if (situacao === "desistente" && !motivoTxt) {
    return { error: "Conte o motivo da saída — ele aparece na ficha e na lista." };
  }
  if (situacao !== "ativo") {
    const { data: vivas } = await supabase
      .from("duplas")
      .select("id")
      .eq("mentorado_id", id)
      .in("status", ["ativa", "pausada"])
      .limit(1);
    if (vivas?.length) {
      return {
        error:
          "Tem dupla em andamento — registre o encerramento na ficha da dupla antes de marcar a saída.",
        duplaId: vivas[0].id,
      };
    }
  }
  const { data, error } = await supabase
    .from("mentorados")
    .update(
      situacao === "ativo"
        ? { situacao, saiu_em: null, motivo_saida: null }
        : { situacao, saiu_em: new Date().toISOString(), motivo_saida: motivoTxt }
    )
    .eq("id", id)
    .select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) return { error: GENERICO };
  return { ok: true };
}

// ---------- registrar_interacao ----------

/** Contact log on the duo's timeline (`interacoes`, 0008): fixed channel
 *  'in_app' (the record was born on the platform — 0094) and type limited
 *  to contato/apoio — 'nudge' is an artifact of the Lembrar flow with its
 *  wa.me link, not a standalone log. The policy already scopes: coord any
 *  duo, mentor and supervisor only their own. */
export async function registrarInteracaoCore(
  supabase: SupabaseClient,
  eu: AtorEscrita,
  params: { dupla_id: string; tipo: "contato" | "apoio"; nota?: string | null }
): Promise<{ error: string } | { ok: true; id: string }> {
  if (params.tipo !== "contato" && params.tipo !== "apoio") {
    return { error: "Escolha um tipo válido." };
  }
  const nota = (params.nota ?? "").trim() || null;
  if (nota && nota.length > 300) {
    return { error: "A nota aceita até 300 caracteres." };
  }
  const { data, error } = await supabase
    .from("interacoes")
    .insert({
      dupla_id: params.dupla_id,
      autor_id: eu.id,
      canal: "in_app",
      tipo: params.tipo,
      nota,
    })
    .select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) return { error: GENERICO };
  return { ok: true, id: String(data[0].id) };
}

// ---------- editar_campo_pessoa ----------

type TabelaPessoa = "profiles" | "mentorados";

/** Fields the report grid edits inline (typo/contact fixes). */
export const CAMPOS_RELATORIO = ["nome", "email", "whatsapp", "cidade", "uf"] as const;

/** Allowlist of the `editar_campo_pessoa` tool (REALIZA-126): field per
 *  table — "fix the easy stuff". nome/email/cidade/uf have their own flow
 *  on the grid; `notas` only exists on mentorados (the per-author private
 *  note is `pessoa_notas`, a different concept, out of here). */
export const CAMPOS_PESSOA_IA: Record<TabelaPessoa, readonly string[]> = {
  profiles: ["whatsapp", "nome_social"],
  mentorados: ["whatsapp", "nome_social", "notas"],
};

/** Single normalization for editable fields — the same CHECKs/validations
 *  as the full dialogs (updatePessoa/updateMentorado + camposFicha): a
 *  value typed in the grid or sent by the AI is worth the same as the form. */
async function normalizarCampoPessoa(
  supabase: SupabaseClient,
  tabela: TabelaPessoa,
  id: string,
  campo: string,
  valor: string
): Promise<{ valor: string | null } | { error: string }> {
  const v = valor.trim();
  switch (campo) {
    case "nome": {
      const normalizado = nomeProprio(v);
      if (!normalizado) return { error: "Nome é obrigatório." };
      return { valor: normalizado };
    }
    case "nome_social": {
      const normalizado = nomeProprio(v) || null;
      if (normalizado && normalizado.length > 150) {
        return { error: 'O campo "Nome social" aceita até 150 caracteres.' };
      }
      return { valor: normalizado };
    }
    case "email": {
      const normalizado = normEmail(v) || null;
      if (normalizado && !emailValido(normalizado)) {
        return { error: "Confira o e-mail." };
      }
      // an e-mail on a profile already linked to an account only changes
      // via auth sync (0060): the swap is self-service, done by the person
      if (tabela === "profiles") {
        const { data: atual } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("id", id)
          .single();
        if (atual?.user_id) {
          return {
            error:
              "Essa pessoa já entrou na plataforma — o e-mail de acesso só muda pelo perfil dela.",
          };
        }
      }
      // same for a linked youth card (mentorados.profile_id): the login
      // e-mail lives on the account — diverging here opens a ghost account
      if (tabela === "mentorados") {
        const { data: atual } = await supabase
          .from("mentorados")
          .select("profile_id")
          .eq("id", id)
          .single();
        if (atual?.profile_id) {
          return {
            error:
              "Essa pessoa já entrou na plataforma — o e-mail de acesso só muda pelo perfil dela.",
          };
        }
      }
      return { valor: normalizado };
    }
    case "whatsapp": {
      const normalizado = v ? normWhatsapp(v) : null;
      // typed garbage must not silently zero the field
      if (v && !normalizado) {
        return { error: "Confira o WhatsApp: use DDD e o número completo." };
      }
      return { valor: normalizado };
    }
    case "cidade": {
      const normalizado = nomeProprio(v) || null;
      if (normalizado && normalizado.length > 100) {
        return { error: 'O campo "Cidade" aceita até 100 caracteres.' };
      }
      return { valor: normalizado };
    }
    case "uf": {
      const uf = v.toUpperCase();
      if (!uf) return { valor: null };
      if (!(UFS as readonly string[]).includes(uf)) {
        return { error: "Escolha um estado (UF) válido." };
      }
      return { valor: uf };
    }
    case "notas": {
      const normalizado = v || null;
      // ceiling from the 0023 CHECK (char_length <= 10000)
      if (normalizado && normalizado.length > 10000) {
        return { error: 'O campo "Notas" aceita até 10.000 caracteres.' };
      }
      return { valor: normalizado };
    }
    default:
      return { error: "Esse campo não é editável por aqui." };
  }
}

/** UPDATE straight on the table (never the profiles_contato view): coord
 *  covers the whole row via the *_coord for all policy (0001) — the per-
 *  column grant of 0026/0034 only narrowed SELECT. Returns the written
 *  value so the UI applies the normalized form to local state. */
async function atualizarCampoPessoa(
  supabase: SupabaseClient,
  tabela: TabelaPessoa,
  id: string,
  campo: string,
  normalizado: string | null
): Promise<{ error: string } | { ok: true; valor: string | null }> {
  const { data, error } = await supabase
    .from(tabela)
    .update({ [campo]: normalizado })
    .eq("id", id)
    .select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) return { error: GENERICO };
  return { ok: true, valor: normalizado };
}

/** Core of the `salvarCampoRelatorio` action — same allowlist as the
 *  report grid (nome/email/whatsapp/cidade/uf), validated at the door. */
export async function salvarCampoRelatorioCore(
  supabase: SupabaseClient,
  eu: AtorEscrita,
  params: { tabela: string; id: string; campo: string; valor: string }
): Promise<{ error: string } | { ok: true; valor: string | null }> {
  if (eu.role !== "coordenacao") {
    return { error: "Só a coordenação edita cadastros." };
  }
  const { tabela, id, campo, valor } = params;
  if (tabela !== "profiles" && tabela !== "mentorados") {
    return { error: "Não foi possível concluir. Tente de novo." };
  }
  if (!(CAMPOS_RELATORIO as readonly string[]).includes(campo)) {
    return { error: "Esse campo não é editável por aqui." };
  }
  const n = await normalizarCampoPessoa(supabase, tabela, id, campo, valor);
  if ("error" in n) return n;
  return atualizarCampoPessoa(supabase, tabela, id, campo, n.valor);
}

/** Core of the `editar_campo_pessoa` tool — its own per-table allowlist
 *  (CAMPOS_PESSOA_IA); the table resolves by pessoa_id lookup (uuids do
 *  not collide between profiles and mentorados). A field off the list is
 *  "not editable here" (allowlist, not blocklist). */
export async function editarCampoPessoaCore(
  supabase: SupabaseClient,
  eu: AtorEscrita,
  params: { pessoa_id: string; campo: string; valor: string }
): Promise<{ error: string } | { ok: true; tabela: TabelaPessoa; valor: string | null }> {
  if (eu.role !== "coordenacao") {
    return { error: "Só a coordenação edita cadastros." };
  }
  const { pessoa_id, campo, valor } = params;
  // resolve the table — profiles first (most edits are on staff)
  const { data: prof } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", pessoa_id)
    .maybeSingle();
  let tabela: TabelaPessoa;
  if (prof) {
    tabela = "profiles";
  } else {
    const { data: ment } = await supabase
      .from("mentorados")
      .select("id")
      .eq("id", pessoa_id)
      .maybeSingle();
    if (!ment) return { error: "Pessoa não encontrada." };
    tabela = "mentorados";
  }
  if (!CAMPOS_PESSOA_IA[tabela].includes(campo)) {
    return { error: "Esse campo não é editável por aqui." };
  }
  const n = await normalizarCampoPessoa(supabase, tabela, pessoa_id, campo, valor);
  if ("error" in n) return n;
  const r = await atualizarCampoPessoa(supabase, tabela, pessoa_id, campo, n.valor);
  if ("error" in r) return r;
  return { ok: true, tabela, valor: r.valor };
}
