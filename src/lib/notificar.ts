import type { createClient } from "@/lib/supabase/server";
import { primeiroNome } from "@/components/forms/link-shared";
import type { Notificacao, Profile } from "./types";

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Fan-out de notificações in-app — um insert em lote. A RLS escopa pelo
 *  papel do destinatário (coord → qualquer um; demais → só staff). Falha vira
 *  console.error, não erro da ação: a notificação é complemento, e o autor
 *  nunca se auto-notifica. Compartilhada entre actions.ts e os demais módulos
 *  server-side (ex.: fluxo de especialista). */
export async function notificar(
  supabase: Supa,
  rows: {
    profile_id: string | null | undefined;
    tipo: string;
    titulo: string;
    corpo?: string | null;
    href?: string | null;
    comunicado_id?: string | null;
  }[],
  autorId: string
) {
  const limpos = rows
    .filter((r): r is typeof r & { profile_id: string } => !!r.profile_id)
    .filter((r) => r.profile_id !== autorId);
  if (!limpos.length) return;
  const { error } = await supabase
    .from("notificacoes")
    .insert(limpos.map((r) => ({ ...r, created_by: autorId })));
  if (error) console.error("notificar: falha ao gravar notificações", error);
}

/** 519: a 0225 minta a mesma notificação "…responda" pra proposta da equipe
 *  (o plano nasce `proposto`, esperando aceite) e pra proposta da própria
 *  dupla (nasce `aceito`, já valendo pelo aceite único). A row fica
 *  imutável depois de criada — a guarda da 0019 só deixa mexer em lida_em —
 *  então a leitura reescreve a copy quando o autor é o outro lado da dupla.
 *  Detecção sem consultar o plano: quem recebe esse tipo é sempre o par,
 *  então created_by = profile do outro membro basta. A correção definitiva
 *  é a RPC mintar tipos/copy distintos — anotada no relatório pro lead. */
export async function relerPlanoPropostoDeMembro(
  supabase: Supa,
  eu: Pick<Profile, "id" | "role">,
  itens: Notificacao[]
): Promise<Notificacao[]> {
  if (!itens.some((n) => n.tipo === "plano_proposto")) return itens;
  const autores = new Map<string, string>();
  if (eu.role === "mentorado") {
    // o outro lado do jovem é o mentor — jovem_duplas já entrega id e nome
    const { data } = await supabase
      .from("jovem_duplas")
      .select("mentor_id, mentor_nome, mentor_nome_social");
    for (const d of data ?? [])
      if (d.mentor_id)
        autores.set(
          d.mentor_id,
          primeiroNome(d.mentor_nome_social ?? d.mentor_nome)
        );
  } else {
    // o outro lado do mentor é o mentorado — o nome dele mora em
    // mentorados, não no profile de login que mintou a notificação
    const { data } = await supabase
      .from("duplas")
      .select(
        "mentorado:mentorados!duplas_mentorado_id_fkey(profile_id, nome, nome_social)"
      )
      .eq("mentor_id", eu.id);
    for (const d of data ?? []) {
      // embed many-to-one: objeto em runtime, array nos tipos gerados
      const m = (
        Array.isArray(d.mentorado) ? d.mentorado[0] : d.mentorado
      ) as {
        profile_id: string | null;
        nome: string | null;
        nome_social: string | null;
      } | null;
      if (m?.profile_id)
        autores.set(m.profile_id, primeiroNome(m.nome_social ?? m.nome));
    }
  }
  if (!autores.size) return itens;
  return itens.map((n) => {
    const nome =
      n.tipo === "plano_proposto" && n.created_by
        ? autores.get(n.created_by)
        : undefined;
    if (!nome) return n;
    return {
      ...n,
      titulo: 'Plano "ficar em dia" valendo',
      corpo: `${nome} combinou o plano. Já vale; veja as datas combinadas.`,
    };
  });
}
