import { idade } from "../ciclo";
import type { createClient } from "../supabase/server";
import type { TipoAlvoAssinatura } from "./texto";

// Emissão de documentos de assinatura — miolo compartilhado entre a emissão
// manual da coordenação (actions-assinaturas.ts) e a autoemissão do cadastro
// de mentorado (REALIZA-436). Não é "use server": as actions chamam as
// funções internamente com o client da sessão já autenticada — nada aqui
// vira endpoint.

type Supa = Awaited<ReturnType<typeof createClient>>;

const em30d = () =>
  new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

/** Emite (ou reusa) o link de um alvo respeitando `assinaturas_viva_uk`
 *  (0053): uma row viva por alvo×template. Pendente com token vencido é
 *  link morto — em vez de reusar, regenera o token na mesma row (equivale
 *  ao "Reenviar" da ficha). "assinado" quando a viva já é a assinatura,
 *  null quando nem insert nem re-select deram link. */
export async function emitirUm(
  supabase: Supa,
  tplId: string,
  tipo: TipoAlvoAssinatura,
  alvoId: string,
  createdBy: string
): Promise<
  { token: string; existente: boolean; criado_em: string | null } | "assinado" | null
> {
  const col = tipo === "profile" ? "profile_id" : "mentorado_id";
  const selViva = () =>
    supabase
      .from("assinaturas")
      .select("id, token, status, token_expira_em, created_at")
      .eq(col, alvoId)
      .eq("template_id", tplId)
      .in("status", ["pendente", "assinado"])
      .maybeSingle();

  const { data: viva } = await selViva();
  if (viva?.status === "assinado") return "assinado";
  if (viva) {
    const vencido =
      viva.token_expira_em != null && new Date(viva.token_expira_em) < new Date();
    if (!vencido)
      return { token: viva.token, existente: true, criado_em: viva.created_at };
    // pendente morta: regenera o token na mesma row (token novo, +30d)
    const { data: novoToken, error: errRegen } = await supabase.rpc(
      "regenerar_token_assinatura",
      { p_id: viva.id }
    );
    if (errRegen || !novoToken) {
      console.error("emitirUm: regen", errRegen);
      return null;
    }
    return { token: novoToken, existente: true, criado_em: viva.created_at };
  }

  const { data, error } = await supabase
    .from("assinaturas")
    .insert(
      tipo === "profile"
        ? {
            template_id: tplId,
            profile_id: alvoId,
            created_by: createdBy,
            token_expira_em: em30d(),
          }
        : {
            template_id: tplId,
            mentorado_id: alvoId,
            created_by: createdBy,
            token_expira_em: em30d(),
          }
    )
    .select("token, created_at")
    .single();
  if (!error && data)
    return { token: data.token, existente: false, criado_em: data.created_at };

  // perdeu a corrida da unique (dois cliques/emissões simultâneas) — a viva
  // existe e é única; re-seleciona e devolve o que há. Antes, loga: sem
  // isso um erro de RLS/FK é indistinguível de corrida e some em silêncio.
  if (error) console.error("emitirUm: insert", error);
  const { data: retry } = await selViva();
  if (retry?.status === "assinado") return "assinado";
  if (retry) return { token: retry.token, existente: true, criado_em: retry.created_at };
  return null;
}

// ---------- autoemissão do cadastro de mentorado (REALIZA-436) ----------

/** ids dos templates ativos do pool do mentorado, indexados por "qual
 *  documento" — um select por chamada; a importação em lote hasteia fora
 *  do loop em vez de repetir por linha. */
export type TemplatesMentorado = Partial<
  Record<"termo" | "autorizacao", string>
>;

export async function templatesMentoradoAtivos(
  supabase: Supa
): Promise<TemplatesMentorado> {
  const { data, error } = await supabase
    .from("documento_templates")
    .select("id, slug")
    .in("slug", ["termo-mentorando", "autorizacao-responsavel"])
    .eq("ativo", true);
  if (error) console.error("templatesMentoradoAtivos:", error);
  const tpls: TemplatesMentorado = {};
  for (const t of (data ?? []) as { id: string; slug: string }[]) {
    if (t.slug === "termo-mentorando") tpls.termo = t.id;
    if (t.slug === "autorizacao-responsavel") tpls.autorizacao = t.id;
  }
  return tpls;
}

/** Documentos que nascem com o cadastro do mentorado (REALIZA-436): termo
 *  de participação sempre; autorização do responsável só quando a ficha
 *  prova menor de idade — sem data de nascimento não dá pra decidir, então
 *  ela fica pra emissão manual quando a data entrar. Mesma gravação da
 *  emissão manual (emitirUm): pendência viva é reusada, nunca duplicada,
 *  e a pendência aparece normal na ficha e no "Enviar termos". Devolve os
 *  slugs que falharam (logados no caminho) — nunca lança: o cadastro já
 *  está salvo e não pode ser derrubado por causa do documento. */
export async function emitirDocumentosMentorado(
  supabase: Supa,
  tpls: TemplatesMentorado,
  opts: {
    mentoradoId: string;
    dataNascimento: string | null | undefined;
    createdBy: string;
  }
): Promise<string[]> {
  const falhas: string[] = [];
  const emitir = async (tplId: string | undefined, slug: string) => {
    if (!tplId) {
      console.error(`emitirDocumentosMentorado: template ativo ausente (${slug})`);
      falhas.push(slug);
      return;
    }
    // "assinado" num cadastro novo não acontece na prática; se acontecer,
    // o documento já está resolvido — não é falha
    const r = await emitirUm(supabase, tplId, "mentorado", opts.mentoradoId, opts.createdBy);
    if (r === null) falhas.push(slug);
  };
  await emitir(tpls.termo, "termo-mentorando");
  const anos = idade(opts.dataNascimento);
  if (anos != null && anos < 18)
    await emitir(tpls.autorizacao, "autorizacao-responsavel");
  return falhas;
}
