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
import { enviarEmailsIndividuais, SITE_URL } from "./email";
import { emailDocumentoAssinatura } from "./email-templates";
import { DEMO_MSG } from "./demo/shared";
import { cpfValido } from "./utils";
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

/** Evidência: IP e UA só vêm do servidor — nunca confiar em campo de form.
 *  São repassados à RPC como parâmetros: o hash no banco cobre exatamente
 *  o par que for gravado junto (0053). */
async function ipUa(): Promise<{ ip: string | null; ua: string | null }> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: fwd || h.get("x-real-ip") || null,
    ua: h.get("user-agent"),
  };
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

// ---------- validação dos dados civis ----------

const apenasDigitos = (v: string) => v.replace(/\D/g, "");

function campo(f: FormData, nome: string): string {
  return String(f.get(nome) ?? "").trim();
}

function parseEndereco(f: FormData): Endereco | { error: string } {
  const e: Endereco = {
    logradouro: campo(f, "logradouro"),
    numero: campo(f, "numero"),
    complemento: campo(f, "complemento") || null,
    bairro: campo(f, "bairro"),
    cidade: campo(f, "cidade"),
    uf: campo(f, "uf").toUpperCase(),
    cep: apenasDigitos(campo(f, "cep")),
  };
  if (!e.logradouro || !e.numero || !e.bairro || !e.cidade || e.uf.length !== 2)
    return { error: "Endereço incompleto: revise logradouro, número, bairro, cidade e UF." };
  if (e.cep.length !== 8) return { error: "CEP inválido." };
  return e;
}

function parseDadosCivis(f: FormData): DadosCivis | { error: string } {
  const endereco = parseEndereco(f);
  if ("error" in endereco) return endereco;
  const nome_civil = campo(f, "nome_civil");
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

const em30d = () =>
  new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

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
    const { data } = await supabase
      .from("profiles_pessoal")
      .select("dados_civis")
      .eq("id", id)
      .maybeSingle();
    return faltantesDocumento(slug, {
      dados_civis: (data?.dados_civis ?? null) as DadosCivis | null,
    });
  }
  const { data } = await supabase
    .from("mentorados_pessoal")
    .select("dados_civis, responsavel")
    .eq("id", id)
    .maybeSingle();
  return faltantesDocumento(slug, {
    dados_civis: (data?.dados_civis ?? null) as DadosCivis | null,
    responsavel: (data?.responsavel ?? null) as ResponsavelCivis | null,
  });
}

/** Emite (ou reusa) o link de um alvo respeitando `assinaturas_viva_uk`
 *  (0053): uma row viva por alvo×template. Pendente com token vencido é
 *  link morto — em vez de reusar, regenera o token na mesma row (equivale
 *  ao "Reenviar" da ficha). "assinado" quando a viva já é a assinatura,
 *  null quando nem insert nem re-select deram link. */
async function emitirUm(
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
    if (errRegen || !novoToken) return null;
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
  // existe e é única; re-seleciona e devolve o que há
  const { data: retry } = await selViva();
  if (retry?.status === "assinado") return "assinado";
  if (retry) return { token: retry.token, existente: true, criado_em: retry.created_at };
  return null;
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

  const { data: tpl } = await supabase
    .from("documento_templates")
    .select("id")
    .eq("slug", slug)
    .eq("ativo", true)
    .single();
  if (!tpl) return { error: "Template de documento não configurado." };

  const [emissao, faltantes] = await Promise.all([
    emitirUm(supabase, tpl.id, tipo, id, eu.id),
    faltantesDoAlvo(supabase, tipo, id, slug),
  ]);
  if (emissao === "assinado")
    return { error: "Este documento já foi assinado." };
  if (!emissao) return { error: "Não foi possível gerar o link." };
  revalidatePath("/pessoas");
  revalidatePath(`/pessoas/${id}`);
  return {
    ok: true,
    link: `${LINK_BASE}${emissao.token}`,
    existente: emissao.existente,
    faltantes,
  };
}

/** Item do lote de emissão — a tela de resultado do "Enviar termos" renderiza
 *  um por pessoa: nome, contato pra onde o link vai, link pronto e os
 *  faltantes do cadastro (labels; quem assina completa no ato). */
export type ItemEmissao = {
  tipo: TipoAlvoAssinatura;
  id: string;
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
};

/** Emissão em massa do dialog "Enviar termos" — uma passada por alvo sobre
 *  o mesmo template, reaproveitando pendências vivas e devolvendo contato +
 *  faltantes pra tela de resultado (copiar, WhatsApp, e-mail). */
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
  const ids = [
    ...new Set(alvos.filter((a) => a.tipo === tipo).map((a) => a.id)),
  ];
  if (!ids.length) return { error: "Escolha ao menos uma pessoa." };

  const { data: tpl } = await supabase
    .from("documento_templates")
    .select("id, titulo")
    .eq("slug", slug)
    .eq("ativo", true)
    .single();
  if (!tpl) return { error: "Template de documento não configurado." };

  // nomes + contatos + civis numa passada só por pool: contato de profile
  // vem da view profiles_contato (0026 — coord vê todos), civis das views
  // *_pessoal (0034/0046 — coord-only). Mentorado carrega email/whatsapp na
  // própria tabela (grant de coluna público).
  const info = new Map<
    string,
    { nome: string; email: string | null; whatsapp: string | null; faltantes: string[] }
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
          .select("id, dados_civis")
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
      (pessoal ?? []).map((p: { id: string; dados_civis: unknown }) => [
        p.id,
        p.dados_civis,
      ])
    );
    for (const p of (ps ?? []) as { id: string; nome: string }[]) {
      const c = contatoPorId.get(p.id);
      info.set(p.id, {
        nome: p.nome,
        email: c?.email ?? null,
        whatsapp: c?.whatsapp ?? null,
        faltantes: faltantesDocumento(slug, {
          dados_civis: (pessoalPorId.get(p.id) ?? null) as DadosCivis | null,
        }),
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
        .select("id, dados_civis, responsavel")
        .in("id", ids),
    ]);
    const pessoalPorId = new Map(
      (pessoal ?? []).map(
        (p: { id: string; dados_civis: unknown; responsavel: unknown }) => [
          p.id,
          p,
        ]
      )
    );
    for (const m of (ms ?? []) as {
      id: string;
      nome: string;
      email: string | null;
      whatsapp: string | null;
    }[]) {
      const d = pessoalPorId.get(m.id);
      info.set(m.id, {
        nome: m.nome,
        email: m.email ?? null,
        whatsapp: m.whatsapp ?? null,
        faltantes: faltantesDocumento(slug, {
          dados_civis: (d?.dados_civis ?? null) as DadosCivis | null,
          responsavel: (d?.responsavel ?? null) as ResponsavelCivis | null,
        }),
      });
    }
  }

  const itens: ItemEmissao[] = [];
  for (const id of ids) {
    const p = info.get(id);
    if (!p) continue; // id fora do cadastro — pula em vez de derrubar o lote
    const emissao = await emitirUm(supabase, tpl.id, tipo, id, eu.id);
    if (emissao === "assinado") {
      itens.push({
        tipo, id, ...p,
        link: null, existente: false, assinado: true, criado_em: null,
      });
    } else if (!emissao) {
      itens.push({
        tipo, id, ...p,
        link: null, existente: false, assinado: false, criado_em: null,
      });
    } else {
      itens.push({
        tipo, id, ...p,
        link: `${LINK_BASE}${emissao.token}`,
        existente: emissao.existente,
        assinado: false,
        criado_em: emissao.criado_em,
      });
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
  envios: { para: string; nome: string; link: string }[];
}) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao")
    return { error: "Só a coordenação dispara e-mails." };

  const { data: tpl } = await supabase
    .from("documento_templates")
    .select("id, titulo")
    .eq("slug", slug)
    .maybeSingle();
  const docTitulo = (tpl?.titulo as string | undefined) ?? "Documento";

  // saneamento mínimo do payload do client: e-mail plausível + link no
  // formato do fluxo — lixo aqui inflaria o log com falhas evitáveis
  const limpos = envios.filter(
    (e) =>
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.para) &&
      /^\/assinar\/[0-9a-f-]{36}$/.test(e.link)
  );
  if (!limpos.length)
    return { error: "Nenhum destinatário com e-mail cadastrado." };

  const assunto = `${docTitulo} — link pra assinar`;
  const { enviados, falhas, error } = await enviarEmailsIndividuais({
    mensagens: limpos.map((e) => ({
      to: e.para,
      subject: assunto,
      html: emailDocumentoAssinatura({
        docTitulo,
        nomePessoa: e.nome,
        primeiroNome: e.nome.trim().split(/\s+/)[0] ?? "",
        link: `${SITE_URL}${e.link}`,
      }),
    })),
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
  if (!enviados) return { error: "Não foi possível enviar. Tente de novo." };
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
  if (demo) return demoAssinaturaPorToken(token);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assinatura_por_token", {
    p_token: token,
  });
  if (error) return null;
  return data as {
    id: string;
    status: string;
    assinado_em: string | null;
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
    const parentesco = campo(formData, "parentesco");
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
  if (error) return { error: "Não foi possível registrar a assinatura. Tente de novo." };
  return { ok: true };
}
