"use server";

import { createHash } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { demoAtivo, demoRole } from "./demo/mode";
import { demoAssinaturaPorToken } from "./demo/queries";
import { getAssinaturasPessoa } from "./queries-assinaturas";
import { DEMO_MSG } from "./demo/shared";
import { cpfValido } from "./utils";
import type { DadosAutorizacao, DadosCivis, Endereco } from "./types";

// Actions do fluxo de assinatura eletrônica (0033). Toda escrita vai por RPC
// security definer — a RLS de `assinaturas` não tem update: as transições de
// status são atômicas e auditadas dentro do banco.
//
// Dois caminhos:
//   · assinarTermo — mentor/voluntário logado (sessão prova a identidade)
//   · assinarComToken — responsável pelo mentorado, sem conta (token na URL
//     é o fator de posse; ip/ua/hash registram a evidência)
//
// Nada aqui gera PDF: o documento é renderizado sob demanda a partir de
// dados_snapshot + template.versao (src/lib/documentos/) — o hash cobre o
// conteúdo assinado, não bytes.

const LINK_BASE = "/assinar/";

/** Evidência: IP e UA só vêm do servidor — nunca confiar em campo de form. */
async function ipUa(): Promise<{ ip: string | null; ua: string | null }> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: fwd || h.get("x-real-ip") || null,
    ua: h.get("user-agent"),
  };
}

/** sha256 do payload canônico (template + snapshot + texto + ip + ua) —
 *  recomputável pra verificação posterior. O timestamp fica na row. */
function hashDocumento(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
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
    return { error: "Endereço incompleto — revise logradouro, número, bairro, cidade e UF." };
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
  if (!cpfValido(cpf)) return { error: "CPF inválido — confira os dígitos." };
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

/** Coord emite a autorização do responsável pela ficha do mentorado —
 *  devolve o link tokenizado pra mandar por WhatsApp/e-mail. */
export async function solicitarAutorizacao(mentoradoId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (eu.role !== "coordenacao")
    return { error: "Só a coordenação solicita autorização." };

  const { data: tpl } = await supabase
    .from("documento_templates")
    .select("id")
    .eq("slug", "autorizacao-responsavel")
    .eq("ativo", true)
    .single();
  if (!tpl) return { error: "Template de autorização não configurado." };

  // uma pendente por mentorado por template — reenvio regenera o token
  const { data: pendente } = await supabase
    .from("assinaturas")
    .select("id, token")
    .eq("mentorado_id", mentoradoId)
    .eq("template_id", tpl.id)
    .eq("status", "pendente")
    .maybeSingle();
  if (pendente) {
    return { ok: true, link: `${LINK_BASE}${pendente.token}`, existente: true };
  }

  const { data, error } = await supabase
    .from("assinaturas")
    .insert({
      template_id: tpl.id,
      mentorado_id: mentoradoId,
      created_by: eu.id,
      token_expira_em: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    })
    .select("token")
    .single();
  if (error) return { error: "Não foi possível gerar o link." };
  revalidatePath("/pessoas");
  return { ok: true, link: `${LINK_BASE}${data.token}` };
}

/** Reenvio = token novo (o anterior morre) + nova expiração. */
export async function reenviarAssinatura(id: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (eu.role !== "coordenacao")
    return { error: "Só a coordenação reenvia." };
  const { data, error } = await supabase.rpc("regenerar_token_assinatura", {
    p_id: id,
  });
  if (error || !data) return { error: "Não foi possível reenviar — já foi assinado?" };
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
    return { error: "Sessão expirada — entre de novo." };
  const itens = await getAssinaturasPessoa(tipo, id);
  return { ok: true, itens };
}

export async function revogarAssinatura(id: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
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
  if (!eu) return { error: "Sessão expirada — entre de novo." };
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
  if (!eu) return { error: "Sessão expirada — entre de novo." };

  const dados = parseDadosCivis(formData);
  if ("error" in dados) return dados;
  const texto = parseTextoAssinatura(formData);
  if (typeof texto !== "string") return texto;
  if (campo(formData, "aceite") !== "on")
    return { error: "É preciso ler e aceitar o termo pra assinar." };

  const { ip, ua } = await ipUa();
  const hash = hashDocumento({
    slug: "termo-voluntario",
    dados,
    texto,
    ip,
    ua,
  });
  const { data, error } = await supabase.rpc("assinar_termo", {
    p_dados: dados,
    p_texto: texto,
    p_ip: ip,
    p_ua: ua,
    p_hash: hash,
  });
  if (error) return { error: "Não foi possível registrar a assinatura — tente de novo." };
  revalidatePath("/", "layout");
  return { ok: true, id: data };
}

// ---------- signatário por token (autorização do responsável) ----------

/** Página pública /assinar/<token>: lê a pendência sem sessão. */
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
  } | null;
}

export async function assinarComToken(token: string, formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const supabase = await createClient();

  // o nome do mentorado entra no snapshot pelo servidor — o client não pode
  // forjar pra quem o documento vale
  const info = await assinaturaPorToken(token);
  if (!info || info.status !== "pendente")
    return { error: "Este link não está mais disponível." };

  const dados = parseDadosCivis(formData);
  if ("error" in dados) return dados;
  const parentesco = campo(formData, "parentesco");
  if (!parentesco) return { error: "Informe o parentesco com o jovem." };
  const texto = parseTextoAssinatura(formData);
  if (typeof texto !== "string") return texto;
  if (campo(formData, "aceite") !== "on")
    return { error: "É preciso ler e aceitar pra assinar." };

  const snapshot: DadosAutorizacao = {
    mentorado_nome: info.alvo.nome,
    responsavel: { ...dados, parentesco },
  };
  const { ip, ua } = await ipUa();
  const hash = hashDocumento({
    slug: info.template.slug,
    versao: info.template.versao,
    dados: snapshot,
    texto,
    ip,
    ua,
  });
  const { error } = await supabase.rpc("assinar_com_token", {
    p_token: token,
    p_dados: snapshot,
    p_texto: texto,
    p_ip: ip,
    p_ua: ua,
    p_hash: hash,
  });
  if (error) return { error: "Não foi possível registrar a assinatura — tente de novo." };
  return { ok: true };
}
