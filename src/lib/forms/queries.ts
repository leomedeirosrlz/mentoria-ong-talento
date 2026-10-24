import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "../demo/mode";
import { getDemoData } from "../demo/data";
import { demoFormularioPorToken } from "../demo/queries";
import {
  demoAnamneseMentorado,
  demoInstrumentosDaDupla,
  getDemoFormularios,
} from "../demo/forms-data";
import type { AppRole } from "../types";
import type {
  Formulario,
  FormularioCampo,
  FormularioLink,
  FormularioResposta,
  FormularioSistema,
  InstrumentoSistema,
  RespostaValor,
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
  /** links vivos ainda não respondidos — o número acionável ("quem falta?") */
  pendentes: number;
  /** max(usado_em) — a meta da lista mostra "última resposta em" quando há */
  ultimaResposta: string | null;
};

/** Link com o destinatário resolvido pra UI (nome, WhatsApp, avatar, papel,
 *  dupla) e a resposta embutida quando existe. */
export type LinkResolvido = FormularioLink & {
  dest_tipo: "profile" | "mentorado" | "generico";
  dest_nome: string | null;
  dest_whatsapp: string | null;
  /** role do profile destinatário ("mentorado" quando o link aponta pra
   *  jovem) — meta do card de resposta. null no genérico e em profile sem
   *  papel definido. */
  dest_papel: string | null;
  /** avatar_path do destinatário — o grant de coluna já existe pros dois
   *  tipos; null sem foto e no genérico. */
  dest_avatar: string | null;
  /** ficha da pessoa em /pessoas — null no link genérico (não há quem abrir). */
  dest_url: string | null;
  dupla: { id: string; mentor_nome: string; mentorado_nome: string } | null;
  resposta: FormularioResposta | null;
  /** TODAS as respostas do link — em link manual é 0..1 (espelha
   *  `resposta`); em link de intake (multi_uso) é a fila de candidatos */
  respostas: FormularioResposta[];
};

/** Metadados de um upload do intake (0115) — path é o objeto no bucket
 *  form-anexos; o download sai por /api/form-anexo/<id>. */
export type FormularioAnexo = {
  id: string;
  link_id: string;
  campo_id: string;
  path: string;
  nome: string;
  tamanho: number;
  created_at: string;
};

export type FormularioDetalhe = {
  formulario: Formulario;
  links: LinkResolvido[];
  /** anexos de todas as respostas do form (só consultado quando a
   *  definição tem campo 'arquivo' — senão fica vazio) */
  anexos: FormularioAnexo[];
};

/** Payload público do /f/<token> — o que formulario_por_token devolve. */
export type FormularioPublico = {
  /** 0070 — 'outra_pessoa' quando uma sessão autenticada abre o link de
   *  outro destinatário: a RPC omite `formulario` e `campos` nesse caso. */
  status: "pendente" | "respondido" | "expirado" | "inativo" | "outra_pessoa";
  expira_em: string | null;
  respondido_em: string | null;
  destinatario: string | null;
  formulario?: {
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
    supabase
      .from("formulario_links")
      .select(
        "formulario_id, usado_em, expira_em, multi_uso, respostas:formulario_respostas(count)"
      ),
  ]);
  if (error) throw error;
  if (e2) throw e2;
  const agora = Date.now();
  const cont = new Map<
    string,
    { total: number; resp: number; pend: number; ultima: string | null }
  >();
  for (const l of links ?? []) {
    const c = cont.get(l.formulario_id) ?? {
      total: 0,
      resp: 0,
      pend: 0,
      ultima: null,
    };
    c.total++;
    // link de intake (multi_uso) nunca carimba usado_em — "respondidos"
    // da lista conta as respostas recebidas, não o link
    const nRespostas =
      (l as { respostas?: { count: number }[] }).respostas?.[0]?.count ?? 0;
    if (l.multi_uso) {
      c.resp += nRespostas;
      // link de intake vigente é o estado desejado (ninguém "deve" uma
      // resposta ao link de inscrição) — a ficha conta "link vivo, não
      // falta" e a prateleira espelha a mesma régua
    } else if (l.usado_em) {
      c.resp++;
      // ISO 8601 compara lexicograficamente — max(usado_em) sem Date
      if (!c.ultima || l.usado_em > c.ultima) c.ultima = l.usado_em;
    } else if (!l.expira_em || new Date(l.expira_em).getTime() > agora) {
      c.pend++;
    }
    cont.set(l.formulario_id, c);
  }
  return ((forms ?? []) as Formulario[]).map((f) => ({
    ...f,
    campos: (f.campos as unknown as FormularioCampo[]) ?? [],
    linksTotal: cont.get(f.id)?.total ?? 0,
    respondidos: cont.get(f.id)?.resp ?? 0,
    pendentes: cont.get(f.id)?.pend ?? 0,
    ultimaResposta: cont.get(f.id)?.ultima ?? null,
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
        resposta:formulario_respostas(id, link_id, respostas, respondido_em, promovido_profile_id),
        dest_profile:profiles!formulario_links_dest_profile_id_fkey(id, nome, role, avatar_path),
        dest_mentorado:mentorados!formulario_links_dest_mentorado_id_fkey(id, nome, whatsapp, avatar_path),
        dupla:duplas!formulario_links_dupla_id_fkey(
          id,
          mentor:profiles!duplas_mentor_id_fkey(nome),
          mentorado:mentorados!duplas_mentorado_id_fkey(nome)
        )`
      )
      .eq("formulario_id", id)
      .order("created_at", { ascending: true });
    if (e2) throw e2;

    // metadados dos uploads — só faz a query quando a definição tem campo
    // 'arquivo' (form comum não paga o join a mais); resolve path→id pra
    // os links de download /api/form-anexo/<id> da ficha de resposta
    const campos = (f.campos as unknown as FormularioCampo[]) ?? [];
    let anexos: FormularioAnexo[] = [];
    if (campos.some((c) => c.tipo === "arquivo") && (links ?? []).length) {
      const { data: anx, error: eA } = await supabase
        .from("formulario_anexos")
        .select("id, link_id, campo_id, path, nome, tamanho, created_at")
        .in(
          "link_id",
          (links ?? []).map((l) => l.id)
        );
      if (eA) throw eA;
      anexos = (anx ?? []) as FormularioAnexo[];
    }

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
      dest_profile:
        | { id: string; nome: string; role: string | null; avatar_path: string | null }
        | { id: string; nome: string; role: string | null; avatar_path: string | null }[]
        | null;
      dest_mentorado:
        | { id: string; nome: string; whatsapp: string | null; avatar_path: string | null }
        | { id: string; nome: string; whatsapp: string | null; avatar_path: string | null }[]
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
        const todas = Array.isArray(l.resposta)
          ? l.resposta
          : l.resposta
            ? [l.resposta]
            : [];
        return {
          ...l,
          resposta: norm(l.resposta),
          respostas: todas,
          dest_tipo: p ? "profile" : m ? "mentorado" : "generico",
          dest_nome: p?.nome ?? m?.nome ?? null,
          dest_whatsapp: m?.whatsapp ?? (p ? (contatos.get(p.id) ?? null) : null),
          dest_papel: p?.role ?? (m ? "mentorado" : null),
          dest_avatar: p?.avatar_path ?? m?.avatar_path ?? null,
          dest_url: p ? `/pessoas/${p.id}` : m ? `/pessoas/${m.id}` : null,
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
        campos,
      },
      links: resolvidos,
      anexos,
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

// ---------- instrumentos da dupla (0080) ----------

/** Uma entrega (link) do instrumento na dupla — a RPC instrumentos_da_dupla
 *  devolve respostas só quando há (pendente/expirado sai sem payload). O
 *  token acompanha: quem lê a RPC é quem entrega o link. Desde a 0096 a RPC
 *  também manda contexto/created_at/usado_em/expira_em — opcionais aqui pra
 *  não quebrar mirrors (demo) montados antes do superset. */
export type InstrumentoEntrega = {
  link_id: string;
  /** null quando o caller é o mentorado da dupla e a entrega não é
   *  endereçada a ele (0096 — a jovem não carrega bearer token alheio). */
  token: string | null;
  destino: "mentorado" | "mentor" | "outro";
  status: "pendente" | "respondido" | "expirado";
  respondido_em: string | null;
  respostas: Record<string, RespostaValor> | null;
  /** metadados do link (0096): origem/momento da aplicação e datas — é o
   *  que separa Roda inicial da formal na jornada do jovem */
  contexto?: Record<string, unknown> | null;
  created_at?: string;
  usado_em?: string | null;
  expira_em?: string | null;
};

/** Um instrumento oficial no contexto da dupla — definição + entregas. */
export type InstrumentoDupla = {
  sistema: InstrumentoSistema;
  formulario_id: string;
  titulo: string;
  descricao: string | null;
  ativo: boolean;
  campos: FormularioCampo[];
  entregas: InstrumentoEntrega[];
};

/** Os 4 instrumentos oficiais da jornada, com os links/respostas DESTA
 *  dupla — RPC security definer (0080) porque mentor/supervisor/mentorado
 *  não têm grant de tabela em formulario_links/respostas. O escopo fica no
 *  SQL; aqui só degradamos: erro → [] (a seção não aparece, mas a ficha
 *  continua abrindo). */
export const getInstrumentosDaDupla = cache(
  async (duplaId: string): Promise<InstrumentoDupla[]> => {
    const demo = await demoRole();
    if (demo) return demoInstrumentosDaDupla(demo, duplaId);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("instrumentos_da_dupla", {
      p_dupla_id: duplaId,
    });
    if (error) {
      console.error("getInstrumentosDaDupla:", error);
      return [];
    }
    return (data ?? []) as InstrumentoDupla[];
  }
);

// ---------- público (/f/<token>) ----------

/** Resultado da leitura pública — "não encontrado" (token inválido, a RPC
 *  devolveu null) e "erro" (falha de rede/RPC) são estados diferentes na
 *  tela: um é terminal, o outro pede retry. */
export type FormularioTokenResult =
  | { kind: "ok"; info: FormularioPublico }
  | { kind: "nao_encontrado" }
  | { kind: "erro" };

/** Definição do form + estado do link pra página pública — RPC security
 *  definer (anon não tem grant de tabela). Sem sessão funciona igual: o
 *  createClient cai no papel anon e o grant de execute cobre. cache():
 *  generateMetadata e a página dividem a mesma chamada no request. */
export const formularioPorToken = cache(
  async (token: string): Promise<FormularioTokenResult> => {
    // demo: o /f/<token> abre em leitura sobre os links do fixture — todos
    // os estados (pendente/respondido/expirado/inativo) são demonstráveis;
    // o submit segue barrado por DEMO_MSG na action
    if (await demoRole()) {
      const info = demoFormularioPorToken(token);
      return info ? { kind: "ok", info } : { kind: "nao_encontrado" };
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("formulario_por_token", {
      p_token: token,
    });
    if (error) {
      console.error("formularioPorToken:", error);
      return { kind: "erro" };
    }
    if (!data) return { kind: "nao_encontrado" };
    return { kind: "ok", info: data as FormularioPublico };
  }
);

// ---------- demo (coord-only, como a página) ----------

function demoLista(role: AppRole): FormularioListaItem[] {
  if (role !== "coordenacao") return [];
  const { formularios, links, respostas } = getDemoFormularios();
  const agora = Date.now();
  return formularios.map((f) => {
    const doForm = links.filter((l) => l.formulario_id === f.id);
    return {
      ...f,
      linksTotal: doForm.length,
      // link de intake (multi_uso) nunca carimba usado_em — "respondidos"
      // conta as respostas recebidas, igual à query real acima
      respondidos: doForm.reduce(
        (n, l) =>
          n +
          (l.multi_uso
            ? respostas.filter((r) => r.link_id === l.id).length
            : l.usado_em
              ? 1
              : 0),
        0
      ),
      pendentes: doForm.filter(
        (l) =>
          // multi_uso vigente é link de intake vivo, não falta — a régua
          // é a da query real acima (e da ficha do form)
          !l.multi_uso &&
          !l.usado_em &&
          (!l.expira_em || new Date(l.expira_em).getTime() > agora)
      ).length,
      ultimaResposta: doForm.reduce<string | null>(
        (max, l) =>
          l.usado_em && (!max || l.usado_em > max) ? l.usado_em : max,
        null
      ),
    };
  });
}

function demoDetalhe(role: AppRole, id: string): FormularioDetalhe | null {
  if (role !== "coordenacao") return null;
  const { formularios, links, respostas, anexos } = getDemoFormularios();
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
      const todas = respostas.filter((r) => r.link_id === l.id);
      return {
        ...l,
        dest_tipo: p ? "profile" : m ? "mentorado" : "generico",
        dest_nome: p?.nome ?? m?.nome ?? null,
        dest_whatsapp: p?.whatsapp ?? m?.whatsapp ?? null,
        dest_papel: p?.role ?? (m ? "mentorado" : null),
        dest_avatar: p?.avatar_path ?? m?.avatar_path ?? null,
        dest_url: p ? `/pessoas/${p.id}` : m ? `/pessoas/${m.id}` : null,
        dupla: dupla
          ? {
              id: dupla.id,
              mentor_nome: dupla.mentor?.nome ?? "",
              mentorado_nome: dupla.mentorado?.nome ?? "",
            }
          : null,
        resposta: todas[0] ?? null,
        respostas: todas,
      };
    });
  const anexosDoForm = (anexos ?? []).filter((a) =>
    resolvidos.some((l) => l.id === a.link_id)
  );
  return { formulario: f, links: resolvidos, anexos: anexosDoForm };
}
