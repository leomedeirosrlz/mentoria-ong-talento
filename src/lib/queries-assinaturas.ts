import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "./demo/mode";
import {
  demoAssinatura,
  demoAssinaturasPessoa,
  demoAssinaturasResumo,
  demoMeusDadosCivis,
  demoMinhaAssinaturaTermo,
} from "./demo/queries";
import type {
  Assinatura,
  AssinaturaResumo,
  DadosCivis,
  DocumentoTemplate,
} from "./types";

// Leituras de assinaturas (0033). O escopo é o da policy assinaturas_select:
// o signatário lê as próprias (profile_id = eu), a coordenação lê tudo —
// linhas de mentorado só existem pra coord (mentorado não tem login).

const COLS =
  "id, template_id, profile_id, mentorado_id, status, dados_snapshot, token, token_expira_em, assinatura_texto, assinado_em, ip, user_agent, hash_documento, created_by, created_at, template:documento_templates(slug, titulo, versao, signatario)";

// o embed to-one volta como array no client não-tipado — mesma norm() de queries.ts
const norm = <T,>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : v;

const normAssinatura = (a: Assinatura): Assinatura => ({
  ...a,
  template: norm(a.template as Assinatura["template"]),
});

/** A assinatura do termo de adesão do usuário logado (a mais recente de
 *  qualquer status — a página decide o que mostrar). null = nunca iniciou. */
export const getMinhaAssinaturaTermo = cache(async (): Promise<Assinatura | null> => {
  const demo = await demoRole();
  if (demo) return demoMinhaAssinaturaTermo(demo);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assinaturas")
    .select(
      COLS.replace(
        "template:documento_templates(",
        "template:documento_templates!inner("
      )
    )
    .eq("template.slug", "termo-voluntario")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? normAssinatura(data as unknown as Assinatura) : null;
});

/** Uma assinatura por id — pra autorização de download do PDF e pro detalhe. */
export const getAssinatura = cache(async (id: string): Promise<Assinatura | null> => {
  const demo = await demoRole();
  if (demo) return demoAssinatura(demo, id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assinaturas")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? normAssinatura(data as unknown as Assinatura) : null;
});

/** Dados civis do próprio usuário (0046) — prefill do /assinar. A RPC
 *  devolve só a coluna da própria linha; a ficha segue coord-only. */
export const getMeusDadosCivis = cache(async (): Promise<DadosCivis | null> => {
  const demo = await demoRole();
  if (demo) return demoMeusDadosCivis(demo);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("meus_dados_civis");
  if (error) return null;
  return (data as DadosCivis | null) ?? null;
});

/** Status de assinatura de todo mundo, sem snapshot/token — a aba /pessoas
 *  (coord-only) monta os badges "assinou vs. não" a partir daqui. O escopo
 *  é o da policy: fora da coordenação só voltam as próprias linhas. */
export const getAssinaturasResumo = cache(
  async (): Promise<AssinaturaResumo[]> => {
    const demo = await demoRole();
    if (demo) return demoAssinaturasResumo(demo);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("assinaturas")
      .select(
        "profile_id, mentorado_id, status, assinado_em, template:documento_templates(slug)"
      );
    if (error) throw error;
    return ((data ?? []) as unknown as (Omit<AssinaturaResumo, "slug"> & {
      template: { slug: string } | { slug: string }[] | null;
    })[]).map((r) => ({
      profile_id: r.profile_id,
      mentorado_id: r.mentorado_id,
      status: r.status,
      assinado_em: r.assinado_em,
      slug: norm(r.template)?.slug ?? "",
    }));
  }
);

/** Histórico de assinaturas de uma pessoa — seção da ficha (coord-only). */
export async function getAssinaturasPessoa(
  tipo: "profile" | "mentorado",
  id: string
): Promise<Assinatura[]> {
  const demo = await demoRole();
  if (demo) return demoAssinaturasPessoa(demo, tipo, id);
  const supabase = await createClient();
  const col = tipo === "profile" ? "profile_id" : "mentorado_id";
  const { data, error } = await supabase
    .from("assinaturas")
    .select(COLS)
    .eq(col, id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Assinatura[]).map(normAssinatura);
}

export type { DocumentoTemplate };
