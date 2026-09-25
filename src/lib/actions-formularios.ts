"use server";

import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "./demo/mode";
import { DEMO_MSG } from "./demo/shared";
import { gerarLinksFormulario, type DestinoLink } from "./forms/actions";
import { erroAmigavel } from "./utils";

// "Enviar formulário" a partir da ficha da dupla — a action do motor
// (forms/actions) resolve reuso de pendente, validade e o gate de
// coordenação; aqui entra o que a ficha precisa a mais: destinatários por
// papel da dupla, contexto { origem: "ficha", dupla_id } e os links prontos
// de volta pra copiar/mandar no WhatsApp sem sair da página.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALIDADES_DIAS = new Set([7, 15, 30, 60]);

export type LinkPronto = {
  tipo: "profile" | "mentorado";
  dest_id: string;
  token: string;
  expira_em: string | null;
};

export async function gerarLinksParaDupla(input: {
  formularioId: string;
  duplaId: string;
  /** papéis da dupla que recebem link — "mentor" (dest_profile_id) e/ou
   *  "mentorado" (dest_mentorado_id) */
  destinos: ("mentor" | "mentorado")[];
  diasValidade?: number | null;
}): Promise<
  | { error: string }
  | { ok: true; criados: number; reutilizados: number; links: LinkPronto[] }
> {
  if (await demoAtivo()) return { error: DEMO_MSG };

  const formularioId = String(input?.formularioId ?? "");
  const duplaId = String(input?.duplaId ?? "");
  if (!UUID_RE.test(formularioId) || !UUID_RE.test(duplaId))
    return { error: "Dados inválidos." };
  const papeis = [
    ...new Set(
      (input?.destinos ?? []).filter(
        (d): d is "mentor" | "mentorado" => d === "mentor" || d === "mentorado"
      )
    ),
  ];
  if (!papeis.length)
    return { error: "Escolha ao menos um destinatário." };
  const dias = input?.diasValidade ?? null;
  if (dias !== null && !VALIDADES_DIAS.has(dias))
    return { error: "Validade inválida." };

  const supabase = await createClient();
  // guard próprio antes de tocar em duplas — meCoord dentro de
  // gerarLinksFormulario barteria depois, mas a leitura da dupla viria antes
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data: eu } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", (claimsData?.claims?.sub as string) ?? "")
    .maybeSingle();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao")
    return { error: "Só a coordenação envia formulários." };

  const { data: dupla, error: eDupla } = await supabase
    .from("duplas")
    .select("id, mentor_id, mentorado_id")
    .eq("id", duplaId)
    .maybeSingle();
  if (eDupla) return { error: erroAmigavel(eDupla) };
  if (!dupla) return { error: "Dupla não encontrada." };

  const destinos: DestinoLink[] = papeis.map((p) =>
    p === "mentor"
      ? { tipo: "profile", id: dupla.mentor_id as string }
      : { tipo: "mentorado", id: dupla.mentorado_id as string }
  );
  const r = await gerarLinksFormulario({
    formularioId,
    destinos,
    diasValidade: dias,
  });
  // "ok" discrimina a união sem ambiguidade: erro chega sempre como string
  if (!("ok" in r))
    return {
      error:
        (r as { error?: string }).error ??
        "Não foi possível gerar os links.",
    };

  // lê de volta os links vigentes desses destinos — cobre os criados agora
  // e os reutilizados (pendente já existente vale como "enviado" aqui também)
  const destIds = destinos
    .map((d) => (d.tipo === "generico" ? null : d.id))
    .filter((x): x is string => typeof x === "string" && UUID_RE.test(x));
  if (!destIds.length)
    return { error: "Dupla sem destinatários válidos." };
  const { data: links, error: eLinks } = await supabase
    .from("formulario_links")
    .select(
      "id, token, dest_profile_id, dest_mentorado_id, dupla_id, contexto, expira_em"
    )
    .eq("formulario_id", formularioId)
    .is("usado_em", null)
    .or(
      `dest_profile_id.in.(${destIds.join(",")}),dest_mentorado_id.in.(${destIds.join(",")})`
    );
  if (eLinks) return { error: erroAmigavel(eLinks) };
  // expirados fora em JS — timestamp dentro de or() do PostgREST é frágil e
  // a lista por form é pequena
  const agoraMs = Date.now();
  const vigentes = (links ?? []).filter(
    (l) => !l.expira_em || new Date(l.expira_em).getTime() > agoraMs
  );

  const prontos: LinkPronto[] = [];
  for (const l of vigentes) {
    // contexto de origem — gerarLinksFormulario não recebe contexto; o merge
    // preserva chaves que já existiam no link reutilizado (ex.: encontro)
    const contexto = {
      ...(l.contexto && typeof l.contexto === "object"
        ? (l.contexto as Record<string, unknown>)
        : {}),
      origem: "ficha",
      dupla_id: duplaId,
    };
    // dupla_id órfão (dest sem dupla ativa na emissão — ex.: dupla já
    // encerrada) passa a apontar pra esta; um vínculo já preenchido com
    // outra dupla não é repintado
    const patch: { contexto: typeof contexto; dupla_id?: string } = {
      contexto,
    };
    if (!l.dupla_id) patch.dupla_id = duplaId;
    const { error: eUp } = await supabase
      .from("formulario_links")
      .update(patch)
      .eq("id", l.id);
    if (eUp) return { error: erroAmigavel(eUp) };
    prontos.push({
      tipo: l.dest_profile_id ? "profile" : "mentorado",
      dest_id: (l.dest_profile_id ?? l.dest_mentorado_id) as string,
      token: l.token,
      expira_em: l.expira_em,
    });
  }
  return {
    ok: true,
    criados: r.criados ?? 0,
    reutilizados: r.reutilizados ?? 0,
    links: prontos,
  };
}

/** "Enviar anamnese" na ficha do mentorado — atalho pro instrumento oficial
 *  (sistema='anamnese', 0042). O form não vem do cliente: quem decide qual
 *  definição é "a anamnese" é o banco, senão qualquer form comum poderia ser
 *  passado como oficial. Reusa o pendente se já houver link válido. */
export async function enviarAnamneseMentorado(
  mentoradoId: string
): Promise<
  | { error: string }
  | { ok: true; token: string; formularioId: string; reutilizado: boolean }
> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  if (!UUID_RE.test(mentoradoId)) return { error: "Mentorado inválido." };

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data: eu } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", (claimsData?.claims?.sub as string) ?? "")
    .maybeSingle();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao")
    return { error: "Só a coordenação envia formulários." };

  const { data: form, error: eForm } = await supabase
    .from("formularios")
    .select("id, ativo")
    .eq("sistema", "anamnese")
    .maybeSingle();
  if (eForm) return { error: erroAmigavel(eForm) };
  if (!form)
    return { error: "A anamnese oficial ainda não está cadastrada no banco." };
  if (!form.ativo)
    return { error: "A anamnese oficial está encerrada. Reative-a em Formulários." };

  const { data: alvo } = await supabase
    .from("mentorados")
    .select("id")
    .eq("id", mentoradoId)
    .maybeSingle();
  if (!alvo) return { error: "Mentorado(a) não encontrado(a)." };

  const r = await gerarLinksFormulario({
    formularioId: form.id,
    destinos: [{ tipo: "mentorado", id: mentoradoId }],
    diasValidade: null,
  });
  if (!("ok" in r))
    return {
      error:
        (r as { error?: string }).error ?? "Não foi possível gerar o link.",
    };

  // lê de volta o token vigente — criado agora ou pendente reutilizado
  const { data: link, error: eLink } = await supabase
    .from("formulario_links")
    .select("token")
    .eq("formulario_id", form.id)
    .eq("dest_mentorado_id", mentoradoId)
    .is("usado_em", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (eLink) return { error: erroAmigavel(eLink) };
  if (!link?.token)
    return { error: "Link gerado, mas o token não apareceu. Abra a ficha do formulário." };

  return {
    ok: true,
    token: link.token,
    formularioId: form.id,
    reutilizado: (r.reutilizados ?? 0) > 0,
  };
}
