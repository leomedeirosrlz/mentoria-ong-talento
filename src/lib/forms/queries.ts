import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "../demo/mode";
import { getDemoData } from "../demo/data";
import {
  demoAnamneseMentorado,
  getDemoFormularios,
} from "../demo/forms-data";
import type { AppRole } from "../types";
import type {
  Formulario,
  FormularioCampo,
  FormularioLink,
  FormularioResposta,
  FormularioSistema,
} from "./schema";

// Leituras da engine de formulários (0034). O escopo é o da RLS: tudo
// coord-only — as páginas redirecionam outros papéis antes de chamar, e a
// policy barra qualquer vazamento.
//
// A leitura pública do /f/<token> NÃO sai de query de tabela — anon não tem
// grant de tabela (0032/0034): entra pela RPC security definer
// formulario_por_token (mesmo padrão do aceite de termo por token, 0033),
// executável por anon e authenticated.

/** Form + contagens pra lista da coordenação. */
export type FormularioListaItem = Formulario & {
  linksTotal: number;
  respondidos: number;
};

/** Link com o destinatário resolvido pra UI (nome, WhatsApp, dupla) e a
 *  resposta embutida quando existe. */
export type LinkResolvido = FormularioLink & {
  dest_tipo: "profile" | "mentorado" | "generico";
  dest_nome: string | null;
  dest_whatsapp: string | null;
  dupla: { id: string; mentor_nome: string; mentorado_nome: string } | null;
  resposta: FormularioResposta | null;
};

export type FormularioDetalhe = {
  formulario: Formulario;
  links: LinkResolvido[];
};

/** Payload público do /f/<token> — o que formulario_por_token devolve. */
export type FormularioPublico = {
  status: "pendente" | "respondido" | "expirado" | "inativo";
  expira_em: string | null;
  respondido_em: string | null;
  destinatario: string | null;
  formulario: {
    id: string;
    titulo: string;
    descricao: string | null;
    campos: FormularioCampo[];
    versao: number;
    /** 0042 — selo do instrumento oficial na página pública */
    sistema?: FormularioSistema | null;
  };
};

// embed to-one pode vir array no client não-tipado — mesma norm() de queries.ts
const norm = <T,>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : v;

export const getFormularios = cache(async (): Promise<FormularioListaItem[]> => {
  const demo = await demoRole();
  if (demo) return demoLista(demo);
  const supabase = await createClient();
  const [{ data: forms, error }, { data: links, error: e2 }] = await Promise.all([
    supabase
      .from("formularios")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("formulario_links").select("formulario_id, usado_em"),
  ]);
  if (error) throw error;
  if (e2) throw e2;
  const cont = new Map<string, { total: number; resp: number }>();
  for (const l of links ?? []) {
    const c = cont.get(l.formulario_id) ?? { total: 0, resp: 0 };
    c.total++;
    if (l.usado_em) c.resp++;
    cont.set(l.formulario_id, c);
  }
  return ((forms ?? []) as Formulario[]).map((f) => ({
    ...f,
    campos: (f.campos as unknown as FormularioCampo[]) ?? [],
    linksTotal: cont.get(f.id)?.total ?? 0,
    respondidos: cont.get(f.id)?.resp ?? 0,
  }));
});

export const getFormulario = cache(
  async (id: string): Promise<FormularioDetalhe | null> => {
    const demo = await demoRole();
    if (demo) return demoDetalhe(demo, id);
    const supabase = await createClient();
    const { data: f, error } = await supabase
      .from("formularios")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!f) return null;

    const { data: links, error: e2 } = await supabase
      .from("formulario_links")
      .select(
        `*,
        resposta:formulario_respostas(id, link_id, respostas, respondido_em),
        dest_profile:profiles!formulario_links_dest_profile_id_fkey(id, nome),
        dest_mentorado:mentorados!formulario_links_dest_mentorado_id_fkey(id, nome, whatsapp),
        dupla:duplas!formulario_links_dupla_id_fkey(
          id,
          mentor:profiles!duplas_mentor_id_fkey(nome),
          mentorado:mentorados!duplas_mentorado_id_fkey(nome)
        )`
      )
      .eq("formulario_id", id)
      .order("created_at", { ascending: true });
    if (e2) throw e2;

    // whatsapp de destinatário profile não sai pelo embed (grant de coluna,
    // 0026) — vem da view escopada profiles_contato, que pra coord cobre todos
    const idsProfiles = (links ?? [])
      .map((l) => l.dest_profile_id)
      .filter((x): x is string => Boolean(x));
    const contatos = new Map<string, string | null>();
    if (idsProfiles.length) {
      const { data: conts, error: e3 } = await supabase
        .from("profiles_contato")
        .select("id, whatsapp")
        .in("id", idsProfiles);
      if (e3) throw e3;
      for (const c of conts ?? []) contatos.set(c.id, c.whatsapp);
    }

    type LinkRaw = FormularioLink & {
      resposta: FormularioResposta | FormularioResposta[] | null;
      dest_profile: { id: string; nome: string }[] | { id: string; nome: string } | null;
      dest_mentorado:
        | { id: string; nome: string; whatsapp: string | null }
        | { id: string; nome: string; whatsapp: string | null }[]
        | null;
      dupla:
        | {
            id: string;
            mentor: { nome: string } | { nome: string }[] | null;
            mentorado: { nome: string } | { nome: string }[] | null;
          }
        | {
            id: string;
            mentor: { nome: string } | { nome: string }[] | null;
            mentorado: { nome: string } | { nome: string }[] | null;
          }[]
        | null;
    };

    const resolvidos: LinkResolvido[] = ((links ?? []) as unknown as LinkRaw[]).map(
      (l) => {
        const p = norm(l.dest_profile);
        const m = norm(l.dest_mentorado);
        const dupla = norm(l.dupla);
        return {
          ...l,
          resposta: norm(l.resposta),
          dest_tipo: p ? "profile" : m ? "mentorado" : "generico",
          dest_nome: p?.nome ?? m?.nome ?? null,
          dest_whatsapp: m?.whatsapp ?? (p ? (contatos.get(p.id) ?? null) : null),
          dupla: dupla
            ? {
                id: dupla.id,
                mentor_nome: norm(dupla.mentor)?.nome ?? "",
                mentorado_nome: norm(dupla.mentorado)?.nome ?? "",
              }
            : null,
        };
      }
    );

    return {
      formulario: {
        ...(f as Formulario),
        campos: (f.campos as unknown as FormularioCampo[]) ?? [],
      },
      links: resolvidos,
    };
  }
);

/** Estado da Anamnese Social de um mentorado — instrumento oficial
 *  (sistema='anamnese', 0042). Alimenta o atalho "Enviar anamnese" na ficha
 *  da pessoa: form ausente → null (a migração ainda não rodou); já
 *  respondida → data; link vigente pendente → linkPendente (a ação reusa). */
export type AnamneseMentorado = {
  formularioId: string;
  respondida_em: string | null;
  linkPendente: boolean;
};

export const getAnamneseMentorado = cache(
  async (mentoradoId: string): Promise<AnamneseMentorado | null> => {
    const demo = await demoRole();
    // demo: a fixture modela os oficiais — Ana respondida, Eduardo com
    // link pendente (as policies das tabelas são coord-only, idem a real)
    if (demo) return demoAnamneseMentorado(demo, mentoradoId);
    const supabase = await createClient();
    const { data: form, error } = await supabase
      .from("formularios")
      .select("id")
      .eq("sistema", "anamnese")
      .maybeSingle();
    // falha (ex.: coluna sistema ainda não migrada) degrada pra null — a
    // ficha segue igual, sem o bloco da anamnese
    if (error) {
      console.error("getAnamneseMentorado:", error);
      return null;
    }
    if (!form) return null;

    const { data: links, error: e2 } = await supabase
      .from("formulario_links")
      .select("id, usado_em, expira_em, resposta:formulario_respostas(respondido_em)")
      .eq("formulario_id", form.id)
      .eq("dest_mentorado_id", mentoradoId)
      .order("created_at", { ascending: false });
    if (e2) {
      console.error("getAnamneseMentorado (links):", e2);
      return null;
    }

    type LinkRaw = {
      id: string;
      usado_em: string | null;
      expira_em: string | null;
      resposta: { respondido_em: string } | { respondido_em: string }[] | null;
    };
    const agora = Date.now();
    let respondida_em: string | null = null;
    let linkPendente = false;
    for (const l of (links ?? []) as LinkRaw[]) {
      if (l.usado_em) {
        respondida_em = respondida_em ?? norm(l.resposta)?.respondido_em ?? l.usado_em;
      } else if (!l.expira_em || new Date(l.expira_em).getTime() > agora) {
        linkPendente = true;
      }
    }
    return { formularioId: form.id, respondida_em, linkPendente };
  }
);

// ---------- público (/f/<token>) ----------

/** Definição do form + estado do link pra página pública — RPC security
 *  definer (anon não tem grant de tabela). Sem sessão funciona igual: o
 *  createClient cai no papel anon e o grant de execute cobre. */
export async function formularioPorToken(
  token: string
): Promise<FormularioPublico | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("formulario_por_token", {
    p_token: token,
  });
  if (error) {
    console.error("formularioPorToken:", error);
    return null;
  }
  return (data as FormularioPublico | null) ?? null;
}

// ---------- demo (coord-only, como a página) ----------

function demoLista(role: AppRole): FormularioListaItem[] {
  if (role !== "coordenacao") return [];
  const { formularios, links } = getDemoFormularios();
  return formularios.map((f) => {
    const doForm = links.filter((l) => l.formulario_id === f.id);
    return {
      ...f,
      linksTotal: doForm.length,
      respondidos: doForm.filter((l) => l.usado_em).length,
    };
  });
}

function demoDetalhe(role: AppRole, id: string): FormularioDetalhe | null {
  if (role !== "coordenacao") return null;
  const { formularios, links, respostas } = getDemoFormularios();
  const f = formularios.find((x) => x.id === id);
  if (!f) return null;
  // nomes/whatsapp/dupla resolvem pelo dataset principal — a demo fala das
  // mesmas pessoas em todas as telas
  const data = getDemoData();
  const resolvidos: LinkResolvido[] = links
    .filter((l) => l.formulario_id === id)
    .map((l) => {
      const p = l.dest_profile_id
        ? data.profiles.find((x) => x.id === l.dest_profile_id)
        : null;
      const m = l.dest_mentorado_id
        ? data.mentorados.find((x) => x.id === l.dest_mentorado_id)
        : null;
      const dupla = l.dupla_id
        ? data.duplas.find((x) => x.id === l.dupla_id)
        : null;
      return {
        ...l,
        dest_tipo: p ? "profile" : m ? "mentorado" : "generico",
        dest_nome: p?.nome ?? m?.nome ?? null,
        dest_whatsapp: p?.whatsapp ?? m?.whatsapp ?? null,
        dupla: dupla
          ? {
              id: dupla.id,
              mentor_nome: dupla.mentor?.nome ?? "",
              mentorado_nome: dupla.mentorado?.nome ?? "",
            }
          : null,
        resposta: respostas.find((r) => r.link_id === l.id) ?? null,
      };
    });
  return { formulario: f, links: resolvidos };
}
