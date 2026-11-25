"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { demoAtivo, demoRole } from "./demo/mode";
import { demoAssinaturaPorToken } from "./demo/queries";
import { getAssinaturasPessoa } from "./queries-assinaturas";
import {
  faltantesDocumento,
  TEMPLATES_POR_TIPO,
  type TipoAlvoAssinatura,
} from "./documentos/texto";
import { emitirUm } from "./documentos/emissao";
import {
  docsDevidosMentorado,
  type SlugDocMentorado,
} from "./pessoas-status";
import { enviarEmailsIndividuais, SITE_URL } from "./email";
import { emailDocumentoAssinatura } from "./email-templates";
import { ipCliente } from "./ip";
import { DEMO_MSG } from "./demo/shared";
import { capitalizar, cpfValido, nomeProprio } from "./utils";
import type { DadosCivis, Endereco, ResponsavelCivis } from "./types";

// Actions do fluxo de assinatura eletrônica (0033). Toda escrita vai por RPC
// security definer — a RLS de `assinaturas` não tem update: as transições de
// status são atômicas e auditadas dentro do banco.
//
// Dois caminhos:
//   · assinarTermo — mentor/voluntário logado (sessão prova a identidade)
//   · assinarComToken — responsável pelo mentorado, sem conta (token na URL
//     é o fator de posse)
//
// Desde 0053 a evidência é selada no banco: p_hash saiu — o sha256 do
// documento é computado dentro da RPC sobre exatamente o que é gravado, e
// p_dados passa pela validação `dados_civis_ok` antes de ir pro snapshot e
// de voltar pra ficha. ip/ua seguem lidos do request aqui (o PostgREST
// enxergaria o servidor Next, não o browser do signatário).
//
// Nada aqui gera PDF: o documento é renderizado sob demanda a partir de
// dados_snapshot + template.versao (src/lib/documentos/) — o hash cobre o
// conteúdo assinado, não bytes.

const LINK_BASE = "/assinar/";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Evidência: IP e UA só vêm do servidor — nunca confiar em campo de form.
 *  São repassados à RPC como parâmetros: o hash no banco cobre exatamente
 *  o par que for gravado junto (0053). */
async function ipUa(): Promise<{ ip: string | null; ua: string | null }> {
  const h = await headers();
  return {
    ip: await ipCliente(),
    ua: h.get("user-agent"),
  };
}

async function me() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data } = await supabase
    .from("profiles")
    .select("id, role, nome, ativo")
    .eq("user_id", (claimsData?.claims?.sub as string) ?? "")
    .single();
  return { supabase, me: data };
}

// ---------- validação dos dados civis ----------

const apenasDigitos = (v: string) => v.replace(/\D/g, "");

function campo(f: FormData, nome: string): string {
  return String(f.get(nome) ?? "").trim();
}

function parseEndereco(f: FormData): Endereco | { error: string } {
  const e: Endereco = {
    logradouro: nomeProprio(campo(f, "logradouro")),
    numero: campo(f, "numero"),
    complemento: campo(f, "complemento") || null,
    bairro: nomeProprio(campo(f, "bairro")),
    cidade: nomeProprio(campo(f, "cidade")),
    uf: campo(f, "uf").toUpperCase(),
    cep: apenasDigitos(campo(f, "cep")),
  };
  if (!e.logradouro || !e.numero || !e.bairro || !e.cidade || (e.uf ?? "").length !== 2)
    return { error: "Endereço incompleto: revise logradouro, número, bairro, cidade e UF." };
  if ((e.cep ?? "").length !== 8) return { error: "CEP inválido." };
  return e;
}

function parseDadosCivis(f: FormData): DadosCivis | { error: string } {
  const endereco = parseEndereco(f);
  if ("error" in endereco) return endereco;
  const nome_civil = nomeProprio(campo(f, "nome_civil"));
  const rg = campo(f, "rg");
  const cpf = apenasDigitos(campo(f, "cpf"));
  const nasc = campo(f, "data_nascimento");
  if (nome_civil.split(/\s+/).filter(Boolean).length < 2)
    return { error: "Informe o nome civil completo (como no documento)." };
  if (!rg) return { error: "Informe o RG." };
  if (!cpfValido(cpf)) return { error: "CPF inválido. Confira os dígitos." };
  if (nasc && Number.isNaN(Date.parse(nasc)))
    return { error: "Data de nascimento inválida." };
  return {
    nome_civil,
    rg,
    cpf,
    data_nascimento: nasc || null,
    endereco,
  };
}

/** Assinatura textual: o nome que a pessoa digita no ato. Não precisa bater
 *  com nome_civil — o snapshot registra o que foi declarado. */
function parseTextoAssinatura(f: FormData): string | { error: string } {
  const t = campo(f, "assinatura_texto");
  if (t.split(/\s+/).filter(Boolean).length < 2 || t.length > 120)
    return { error: "Digite seu nome completo pra assinar." };
  return t;
}

// ---------- coordenação ----------

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Faltantes civis de um alvo, via views *_pessoal (coord-only — a action já
 *  passou pelo gate de papel). Devolve labels, nunca valores: vão pro
 *  client/toast sem carregar PII. Não bloqueia a emissão. */
async function faltantesDoAlvo(
  supabase: Supa,
  tipo: TipoAlvoAssinatura,
  id: string,
  slug: string
): Promise<string[]> {
  if (tipo === "profile") {
    const [{ data: pes }, { data }] = await Promise.all([
      supabase.from("profiles").select("nome").eq("id", id).maybeSingle(),
      supabase
        .from("profiles_pessoal")
        .select("dados_civis, data_nascimento")
        .eq("id", id)
        .maybeSingle(),
    ]);
    return faltantesDocumento(slug, {
      nome: pes?.nome,
      data_nascimento: data?.data_nascimento,
      dados_civis: (data?.dados_civis ?? null) as DadosCivis | null,
    });
  }
  const [{ data: base }, { data }] = await Promise.all([
    supabase
      .from("mentorados")
      .select("nome")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("mentorados_pessoal")
      .select("dados_civis, data_nascimento, responsavel")
      .eq("id", id)
      .maybeSingle(),
  ]);
  return faltantesDocumento(slug, {
    nome: base?.nome,
    data_nascimento: data?.data_nascimento,
    dados_civis: (data?.dados_civis ?? null) as DadosCivis | null,
    responsavel: (data?.responsavel ?? null) as ResponsavelCivis | null,
  });
}

/** Coord emite um documento pela ficha — devolve o link tokenizado pra
 *  mandar por WhatsApp/e-mail. `tipo` decide o pool (profile: só
 *  termo-voluntario; mentorado: os dois documentos do jovem). */
export async function solicitarAssinatura({
  tipo,
  id,
  slug,
}: {
  tipo: TipoAlvoAssinatura;
  id: string;
  slug: string;
}) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao")
    return { error: "Só a coordenação solicita assinatura." };
  if (!TEMPLATES_POR_TIPO[tipo]?.some((t) => t.slug === slug))
    return { error: "Este documento não existe pra esse cadastro." };
  if (!UUID_RE.test(id)) return { error: "Cadastro inválido." };

  // conta de jovem não recebe o pool de staff (termo-voluntario): os
  // documentos dela saem pela ficha de mentorado — mesmo filtro do lote
  if (tipo === "profile") {
    const { data: ficha } = await supabase
      .from("mentorados")
      .select("id")
      .eq("profile_id", id)
      .maybeSingle();
    if (ficha)
      return {
        error: "Essa conta pertence a um jovem do programa. Emita o documento pela ficha dele.",
      };
  }

  // os documentos devidos do jovem dependem da idade: menor deve os dois —
  // pedir um emite o conjunto inteiro (o par anda junto, nunca pela
  // metade). Pedido fora dos devidos (ex.: autorização pra adulto) segue
  // emitindo só o template escolhido, como antes
  let slugs = [slug];
  if (tipo === "mentorado") {
    const { data: pessoal } = await supabase
      .from("mentorados_pessoal")
      .select("data_nascimento")
      .eq("id", id)
      .maybeSingle();
    const devidos = docsDevidosMentorado({
      data_nascimento: pessoal?.data_nascimento ?? null,
    });
    if (devidos.includes(slug as SlugDocMentorado))
      slugs = [slug, ...devidos.filter((s) => s !== slug)];
  }

  const { data: tpls } = await supabase
    .from("documento_templates")
    .select("id, slug")
    .in("slug", slugs)
    .eq("ativo", true);
  const tplPorSlug = new Map(
    ((tpls ?? []) as { id: string; slug: string }[]).map((t) => [t.slug, t.id])
  );
  if (slugs.some((s) => !tplPorSlug.has(s)))
    return { error: "Template de documento não configurado." };

  const links: { slug: string; link: string; existente: boolean }[] = [];
  const faltantes = new Set<string>();
  let assinados = 0;
  for (const s of slugs) {
    const emissao = await emitirUm(
      supabase,
      tplPorSlug.get(s)!,
      tipo,
      id,
      eu.id
    );
    for (const f of await faltantesDoAlvo(supabase, tipo, id, s))
      faltantes.add(f);
    if (emissao === "assinado") assinados++;
    else if (emissao)
      links.push({
        slug: s,
        link: `${LINK_BASE}${emissao.token}`,
        existente: emissao.existente,
      });
  }
  if (!links.length)
    return {
      error:
        assinados === slugs.length
          ? slugs.length > 1
            ? "Os documentos já foram assinados."
            : "Este documento já foi assinado."
          : "Não foi possível gerar o link.",
    };
  revalidatePath("/pessoas");
  revalidatePath(`/pessoas/${id}`);
  return { ok: true, links, faltantes: [...faltantes] };
}

/** Item do lote de emissão — a tela de resultado do "Enviar termos" renderiza
 *  um por documento emitido: nome, contato pra onde o link vai, link pronto
 *  e os faltantes do cadastro (labels; quem assina completa no ato). Um
 *  mentorado menor de idade gera DUAS linhas — termo + autorização saem
 *  juntos na mesma passada. */
export type ItemEmissao = {
  tipo: TipoAlvoAssinatura;
  id: string;
  /** documento emitido — distingue as duas linhas do mentorado menor */
  slug: string;
  nome: string;
  email: string | null;
  whatsapp: string | null;
  /** `/assinar/<token>` pronto — null quando a linha não saiu (já assinada
   *  ou falha de escrita). */
  link: string | null;
  /** true = reuso de pendência viva (ou token regenerado de vencida) — a
   *  row já existia, nada novo foi criado. */
  existente: boolean;
  /** O documento já está assinado — nada a emitir. */
  assinado: boolean;
  /** created_at da row — "emitido em dd/mm" na tela de resultado. */
  criado_em: string | null;
  faltantes: string[];
  /** Quem recebe o link quando não é o alvo do documento — a autorização
   *  vai pra caixa da família e a saudação usa o nome do responsável
   *  (mentorados_pessoal). null = o próprio alvo recebe/assina. */
  destinatario: string | null;
};

/** Emissão em massa do dialog "Enviar termos" — uma passada por alvo.
 *  O documento pedido sempre sai; pro mentorado menor de idade o irmão
 *  devido sai junto na mesma passada (termo + autorização, a régua da
 *  ficha), reaproveitando pendências vivas e devolvendo contato +
 *  faltantes por documento pra tela de resultado. */
export async function emitirAssinaturasEmLote({
  slug,
  alvos,
}: {
  slug: string;
  alvos: { tipo: TipoAlvoAssinatura; id: string }[];
}) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao")
    return { error: "Só a coordenação emite documentos." };

  const tipo: TipoAlvoAssinatura | null = TEMPLATES_POR_TIPO.profile.some(
    (t) => t.slug === slug
  )
    ? "profile"
    : TEMPLATES_POR_TIPO.mentorado.some((t) => t.slug === slug)
      ? "mentorado"
      : null;
  if (!tipo) return { error: "Documento desconhecido." };
  // o pool do documento é fechado — alvo de outro tipo é ignorado, não erro
  let ids = [
    ...new Set(
      (Array.isArray(alvos) ? alvos : [])
        .filter((a) => a?.tipo === tipo && UUID_RE.test(a?.id ?? ""))
        .map((a) => a.id)
    ),
  ];
  // conta de jovem no pool de staff também é alvo errado: sai como um tipo
  // estranho — o documento certo dela é emitido pela ficha de mentorado
  if (tipo === "profile" && ids.length) {
    const { data: fichas } = await supabase
      .from("mentorados")
      .select("profile_id")
      .in("profile_id", ids);
    if (fichas?.length) {
      const deJovem = new Set(fichas.map((f) => f.profile_id));
      ids = ids.filter((id) => !deJovem.has(id));
    }
  }
  if (!ids.length) return { error: "Escolha ao menos uma pessoa." };

  // todos os templates que podem sair no lote: pro mentorado o pool inteiro
  // (menor emite o par), pro profile só o pedido — um select só
  const { data: tplRows } = await supabase
    .from("documento_templates")
    .select("id, slug, titulo")
    .in("slug", TEMPLATES_POR_TIPO[tipo].map((t) => t.slug))
    .eq("ativo", true);
  const tplPorSlug = new Map(
    (
      (tplRows ?? []) as { id: string; slug: string; titulo: string }[]
    ).map((t) => [t.slug, t])
  );
  const tpl = tplPorSlug.get(slug);
  if (!tpl) return { error: "Template de documento não configurado." };

  // nomes + contatos + civis numa passada só por pool: contato de profile
  // vem da view profiles_contato (0026 — coord vê todos), civis das views
  // *_pessoal (0034/0046 — coord-only). Mentorado carrega email/whatsapp na
  // própria tabela (grant de coluna público).
  const info = new Map<
    string,
    {
      nome: string;
      email: string | null;
      whatsapp: string | null;
      /** documentos a emitir pro alvo — os devidos quando o pedido é um
       *  deles (menor leva os dois); senão o pedido, como sempre */
      emissao: string[];
      faltantesPor: Record<string, string[]>;
      destinatarioPor: Record<string, string | null>;
    }
  >();
  if (tipo === "profile") {
    const [{ data: ps }, { data: contatos }, { data: pessoal }] =
      await Promise.all([
        supabase.from("profiles").select("id, nome").in("id", ids),
        supabase
          .from("profiles_contato")
          .select("id, email, whatsapp")
          .in("id", ids),
        supabase
          .from("profiles_pessoal")
          .select("id, dados_civis, data_nascimento")
          .in("id", ids),
      ]);
    const contatoPorId = new Map(
      (contatos ?? []).map(
        (c: { id: string; email: string | null; whatsapp: string | null }) => [
          c.id,
          c,
        ]
      )
    );
    const pessoalPorId = new Map(
      (pessoal ?? []).map(
        (p: { id: string; dados_civis: unknown; data_nascimento: string | null }) => [
          p.id,
          p,
        ]
      )
    );
    for (const p of (ps ?? []) as { id: string; nome: string }[]) {
      const c = contatoPorId.get(p.id);
      const d = pessoalPorId.get(p.id);
      info.set(p.id, {
        nome: p.nome,
        email: c?.email ?? null,
        whatsapp: c?.whatsapp ?? null,
        emissao: [slug],
        faltantesPor: {
          [slug]: faltantesDocumento(slug, {
            nome: p.nome,
            data_nascimento: d?.data_nascimento,
            dados_civis: (d?.dados_civis ?? null) as DadosCivis | null,
          }),
        },
        destinatarioPor: { [slug]: null },
      });
    }
  } else {
    const [{ data: ms }, { data: pessoal }] = await Promise.all([
      supabase
        .from("mentorados")
        .select("id, nome, email, whatsapp")
        .in("id", ids),
      supabase
        .from("mentorados_pessoal")
        .select("id, dados_civis, data_nascimento, responsavel")
        .in("id", ids),
    ]);
    const pessoalPorId = new Map(
      (pessoal ?? []).map(
        (p: {
          id: string;
          dados_civis: unknown;
          data_nascimento: string | null;
          responsavel: unknown;
        }) => [p.id, p]
      )
    );
    for (const m of (ms ?? []) as {
      id: string;
      nome: string;
      email: string | null;
      whatsapp: string | null;
    }[]) {
      const d = pessoalPorId.get(m.id);
      const resp = (d?.responsavel ?? null) as ResponsavelCivis | null;
      const ctx = {
        nome: m.nome,
        data_nascimento: d?.data_nascimento,
        dados_civis: (d?.dados_civis ?? null) as DadosCivis | null,
        responsavel: resp,
      };
      const devidos = docsDevidosMentorado({
        data_nascimento: d?.data_nascimento ?? null,
      });
      // pedido dentro dos devidos → o conjunto inteiro sai junto (o par
      // anda junto); pedido de fora (ex.: autorização pra adulto) respeita
      // o template escolhido, como antes
      const emissao = devidos.includes(slug as SlugDocMentorado)
        ? [slug, ...devidos.filter((s) => s !== slug)]
        : [slug];
      const faltantesPor: Record<string, string[]> = {};
      const destinatarioPor: Record<string, string | null> = {};
      for (const s of emissao) {
        faltantesPor[s] = faltantesDocumento(s, ctx);
        // quem abre o link da autorização é o responsável — o e-mail e o
        // WhatsApp saúdam ele, não o(a) jovem (alvo do documento)
        destinatarioPor[s] =
          s === "autorizacao-responsavel"
            ? (resp?.nome_civil?.trim() || null)
            : null;
      }
      info.set(m.id, {
        nome: m.nome,
        email: m.email ?? null,
        whatsapp: m.whatsapp ?? null,
        emissao,
        faltantesPor,
        destinatarioPor,
      });
    }
  }

  const itens: ItemEmissao[] = [];
  for (const id of ids) {
    const p = info.get(id);
    if (!p) continue; // id fora do cadastro — pula em vez de derrubar o lote
    for (const s of p.emissao) {
      const base = {
        tipo,
        id,
        slug: s,
        nome: p.nome,
        email: p.email,
        whatsapp: p.whatsapp,
        faltantes: p.faltantesPor[s] ?? [],
        destinatario: p.destinatarioPor[s] ?? null,
      };
      const tplDoc = tplPorSlug.get(s);
      const emissao = tplDoc
        ? await emitirUm(supabase, tplDoc.id, tipo, id, eu.id)
        : null;
      if (emissao === "assinado") {
        itens.push({
          ...base,
          link: null, existente: false, assinado: true, criado_em: null,
        });
      } else if (!emissao) {
        itens.push({
          ...base,
          link: null, existente: false, assinado: false, criado_em: null,
        });
      } else {
        itens.push({
          ...base,
          link: `${LINK_BASE}${emissao.token}`,
          existente: emissao.existente,
          assinado: false,
          criado_em: emissao.criado_em,
        });
      }
    }
  }
  revalidatePath("/pessoas");
  return { ok: true, docTitulo: tpl.titulo as string, itens };
}

/** Disparo dos links emitidos por e-mail — um envelope por pessoa, cada um
 *  com o próprio link (o token é a posse; lote de HTML único não serve
 *  aqui). Loga em emails_enviados (tipo 'assinatura', 0057) como os demais
 *  envios da coordenação. */
export async function enviarLinksAssinatura({
  slug,
  envios,
}: {
  slug: string;
  envios: { para: string; nome: string; link: string; destinatario?: string | null }[];
}) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  // gate explícito de ativo: esta é a única action privilegiada que não
  // bate no banco antes do side-effect (Resend) — sem ela, uma sessão de
  // coord desativada ainda dispararia e-mail, e o log falharia quieto
  if (eu.role !== "coordenacao" || !eu.ativo)
    return { error: "Só a coordenação dispara e-mails." };

  const { data: tpl } = await supabase
    .from("documento_templates")
    .select("id, titulo")
    .eq("slug", slug)
    .eq("ativo", true)
    .maybeSingle();
  const docTitulo = (tpl?.titulo as string | undefined) ?? "Documento";

  // saneamento mínimo do payload do client: e-mail plausível + link no
  // formato do fluxo — lixo aqui inflaria o log com falhas evitáveis
  const limpos = (Array.isArray(envios) ? envios : [])
    .map((e) => ({
      ...e,
      para: typeof e?.para === "string" ? e.para.trim().toLowerCase() : "",
    }))
    .filter(
      (e) =>
        typeof e?.nome === "string" &&
        /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.para) &&
        /^\/assinar\/[0-9a-f-]{36}$/.test(e.link)
    );
  if (!limpos.length)
    return { error: "Nenhum destinatário com e-mail cadastrado." };

  const assunto = `${docTitulo}: link pra assinar`;
  const { enviados, falhas, error } = await enviarEmailsIndividuais({
    mensagens: limpos.map((e) => {
      // a autorização sai da caixa da família: saúda o responsável
      // (destinatario) falando do documento do(a) jovem (nome); nos demais
      // docs o alvo é o próprio signatário → "Seu documento…"
      const destinatario =
        typeof e.destinatario === "string" && e.destinatario.trim()
          ? e.destinatario.trim()
          : e.nome;
      return {
        to: e.para,
        subject: assunto,
        html: emailDocumentoAssinatura({
          docTitulo,
          nomePessoa: slug === "autorizacao-responsavel" ? e.nome : null,
          primeiroNome: destinatario.split(/\s+/)[0] ?? "",
          link: `${SITE_URL}${e.link}`,
        }),
      };
    }),
  });

  // o log é a memória do disparo — falha nele não desfaz o que saiu
  const { error: errLog } = await supabase.from("emails_enviados").insert({
    autor_id: eu.id,
    tipo: "assinatura",
    ref_id: tpl?.id ?? null,
    assunto,
    audiencia: [slug],
    destinatarios: limpos.length,
    enviados,
    falhas,
  });
  if (errLog) console.error("enviarLinksAssinatura: log", errLog);

  if (error) return { error };
  if (!enviados)
    return {
      error: falhas.length
        ? `Falha ao enviar pra ${falhas.join(", ")}.`
        : "Não foi possível enviar. Tente de novo.",
    };
  return { ok: true, enviados, destinatarios: limpos.length, falhas };
}

/** Reenvio = token novo (o anterior morre) + nova expiração. */
export async function reenviarAssinatura(id: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao")
    return { error: "Só a coordenação reenvia." };
  const { data, error } = await supabase.rpc("regenerar_token_assinatura", {
    p_id: id,
  });
  if (error || !data) return { error: "Não foi possível reenviar. Já foi assinado?" };
  revalidatePath("/pessoas");
  return { ok: true, link: `${LINK_BASE}${data}` };
}

/** A ficha da pessoa abre sob demanda (client) — wrapper de leitura pra
 *  listar o histórico de assinaturas sem prefetch de N fichas. */
export async function listarAssinaturasPessoa(
  tipo: "profile" | "mentorado",
  id: string
) {
  const { me: eu } = await me();
  if (!eu && !(await demoAtivo()))
    return { error: "Sessão expirada. Entre de novo." };
  const itens = await getAssinaturasPessoa(tipo, id);
  return { ok: true, itens };
}

export async function revogarAssinatura(id: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao")
    return { error: "Só a coordenação revoga." };
  const { error } = await supabase.rpc("revogar_assinatura", { p_id: id });
  if (error) return { error: "Não foi possível revogar." };
  revalidatePath("/pessoas");
  return { ok: true };
}

/** Contra-assinatura do presidente: imagem única no prefixo interno do
 *  bucket `documentos` (policy `sistema/%`, 0033). Sobe sobrescrevendo —
 *  trocar a imagem não toca nos PDFs já assinados (a evidência é a row). */
export async function subirContraAssinatura(formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao")
    return { error: "Só a coordenação gerencia a contra-assinatura." };
  const file = formData.get("arquivo");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Escolha uma imagem PNG." };
  if (file.type !== "image/png" || file.size > 1024 * 1024)
    return { error: "Use um PNG de até 1 MB (fundo transparente)." };
  const { error } = await supabase.storage
    .from("documentos")
    .upload("sistema/contra-assinatura.png", file, {
      contentType: "image/png",
      upsert: true,
    });
  if (error) return { error: "Não foi possível subir a imagem." };
  return { ok: true };
}

// ---------- autoemissão no login ----------

/** Auto-cura do login (0206): garante emitidos — como pendente, assinado
 *  ou revogado pela coordenação — todos os documentos devidos do papel da
 *  pessoa logada (termo-voluntario pra staff voluntária; o pool do
 *  mentorado pra jovem com ficha, + autorizacao-responsavel pra menor).
 *  A RPC é idempotente e self-scoped, então rodar a cada mount do shell
 *  é barato e cobre o 1º login e a conta antiga com documento novo —
 *  emito no mesmo request que lê a pendência, o banner e o wizard já
 *  sobem com o documento. Erro fica no log, nunca no caminho do login. */
export async function garantirDocumentosDevidos() {
  if (await demoAtivo()) return { ok: true };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("garantir_documentos_devidos");
    if (error) {
      console.error("garantirDocumentosDevidos:", error);
      return { error: "Não foi possível garantir os documentos." };
    }
    return { ok: true };
  } catch (e) {
    console.error("garantirDocumentosDevidos:", e);
    return { error: "Não foi possível garantir os documentos." };
  }
}

// ---------- signatário logado (termo do voluntário) ----------

export async function assinarTermo(formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };

  const dados = parseDadosCivis(formData);
  if ("error" in dados) return dados;
  const texto = parseTextoAssinatura(formData);
  if (typeof texto !== "string") return texto;
  if (campo(formData, "aceite") !== "on")
    return { error: "É preciso ler e aceitar o termo pra assinar." };

  const { ip, ua } = await ipUa();
  // o hash_documento é computado dentro da RPC (0053) — a action não
  // fabrica evidência, só repassa o que o request trouxe
  const { data, error } = await supabase.rpc("assinar_termo", {
    p_dados: dados,
    p_texto: texto,
    p_ip: ip,
    p_ua: ua,
  });
  if (error) return { error: "Não foi possível registrar a assinatura. Tente de novo." };
  revalidatePath("/", "layout");
  return { ok: true, id: data };
}

// ---------- signatário por token (autorização do responsável) ----------

/** Página pública /assinar/<token>: lê a pendência sem sessão. `civis` é a
 *  sugestão de prefill vinda da ficha (0046) — DadosCivis pro termo do
 *  jovem, ResponsavelCivis pra autorização. */
export async function assinaturaPorToken(token: string) {
  const demo = await demoRole();
  if (demo) return demoAssinaturaPorToken(demo, token);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assinatura_por_token", {
    p_token: token,
  });
  if (error) return null;
  return data as {
    id: string;
    status: string;
    assinado_em: string | null;
    /** 0070 — sessão autenticada conferida contra o destinatário do link:
     *  'outra_pessoa' (link de outro), 'signatario_externo' (autorização é
     *  do responsável), 'ok'/'anon' (segue o fluxo). Ausente em versões
     *  antigas da RPC — tratar como 'ok'. */
    identidade?: "outra_pessoa" | "signatario_externo" | "ok" | "anon";
    template: { slug: string; titulo: string; versao: number };
    alvo: { nome: string };
    civis: (DadosCivis & { parentesco?: string }) | null;
  } | null;
}

export async function assinarComToken(token: string, formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const supabase = await createClient();

  // a RPC decide o contrato do snapshot pelo template da row — aqui só
  // checamos se o link existe/está assinável pra falhar rápido na UX
  const info = await assinaturaPorToken(token);
  if (!info || info.status !== "pendente")
    return { error: "Este link não está mais disponível." };
  // 0070 — a RPC também barra na gravação; aqui o erro chega específico
  if (info.identidade === "outra_pessoa")
    return { error: "Este link de assinatura é de outra pessoa." };
  if (info.identidade === "signatario_externo")
    return {
      error:
        "Este documento é assinado pelo responsável. Encaminhe o link para ele.",
    };

  const dados = parseDadosCivis(formData);
  if ("error" in dados) return dados;
  const texto = parseTextoAssinatura(formData);
  if (typeof texto !== "string") return texto;
  if (campo(formData, "aceite") !== "on")
    return { error: "É preciso ler e aceitar pra assinar." };

  // autorização: o client manda só os civis do RESPONSÁVEL + parentesco —
  // o banco embrulha com o mentorado_nome vindo da ficha (o client não pode
  // mais dizer pra quem o documento vale). Demais templates: DadosCivis
  // direto. dados_civis_ok revalida tudo lá dentro.
  let pDados: DadosCivis | ResponsavelCivis = dados;
  if (info.template.slug === "autorizacao-responsavel") {
    const parentesco = capitalizar(campo(formData, "parentesco"));
    if (!parentesco) return { error: "Informe o parentesco com o jovem." };
    pDados = { ...dados, parentesco };
  }
  const { ip, ua } = await ipUa();
  const { error } = await supabase.rpc("assinar_com_token", {
    p_token: token,
    p_dados: pDados,
    p_texto: texto,
    p_ip: ip,
    p_ua: ua,
  });
  if (error)
    return {
      // mensagens de domínio da RPC (pt-BR) passam direto; infra vira genérica
      error: /outra pessoa|pelo responsável/i.test(error.message)
        ? error.message
        : "Não foi possível registrar a assinatura. Tente de novo.",
    };
  return { ok: true };
}
