"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { demoAtivo } from "./demo/mode";
import { enviarEmailsIndividuais, SITE_URL } from "./email";
import { emailConviteAcesso } from "./email-templates";

// Convite de primeiro acesso pela ficha (0180). Antes a pessoa descobria
// sozinha que tinha conta: o cadastro existia, a allowlist aceitava, mas
// nada avisava. Aqui a coordenação dispara o e-mail com o link pronto.
//
// O token vem do generateLink (admin, service role — mesmo precedente do
// clientImpersonado), não do signInWithOtp: o link da plataforma não pode
// plantar sessão no GET, então o CTA aponta pro /auth/confirm com
// token_hash + type e a página pede o gesto "Entrar neste navegador?".
//
// Efeito colateral assumido: type 'invite' INSERTA o auth.users já no
// envio — o handle_new_user vincula user_id/profile_id na hora, muito
// antes do clique. A conta "existe mas a pessoa nunca viu" é um estado
// real do sistema: a UI distingue as 3 fases pelo onboarded_em (não
// convidado → convite enviado → entrou). O reenvio cai no fallback
// magiclink porque o usuário já existe.

async function me() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data } = await supabase
    .from("profiles")
    .select("id, role, ativo")
    .eq("user_id", (claimsData?.claims?.sub as string) ?? "")
    .single();
  return { supabase, me: data };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Resultado =
  | { ok: true; email: string }
  | { ok: true; demo: true }
  | { error: string };

type Alvo =
  | { email: string; primeiroNome: string; audiencia: string }
  | { error: string };

/** Resolve o destinatário e as guardas de estado. O e-mail é sempre lido
 *  do banco (profiles_contato pro staff — coluna fora do grant público,
 *  0026; mentorados.email é grant de coluna), nunca do payload do client. */
async function alvoConvite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tipo: "profile" | "mentorado",
  id: string
): Promise<Alvo> {
  const primeiro = (nome: string, social?: string | null) =>
    ((social || nome).trim().split(/\s+/)[0] ?? "");

  if (tipo === "profile") {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, nome, nome_social, role, ativo, user_id, onboarded_em")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("profiles_contato")
        .select("id, email")
        .eq("id", id)
        .maybeSingle(),
    ]);
    if (!p) return { error: "Cadastro não encontrado." };
    if (!p.ativo) return { error: "Reative o cadastro antes de convidar." };
    // o papel é o que libera o acesso — convidar cadastro sem papel cria
    // conta que cai no "cadastro recebido" sem caminho de saída
    if (!p.role) {
      return { error: "Defina um papel antes de enviar o convite." };
    }
    if (p.user_id && p.onboarded_em) {
      return { error: "Essa pessoa já entrou na plataforma." };
    }
    const email = c?.email?.trim().toLowerCase();
    if (!email) return { error: "Cadastre um e-mail pra enviar o convite." };
    return {
      email,
      primeiroNome: primeiro(p.nome, p.nome_social),
      audiencia: p.role,
    };
  }

  const { data: m } = await supabase
    .from("mentorados")
    .select("id, nome, nome_social, email, situacao, profile_id")
    .eq("id", id)
    .maybeSingle();
  if (!m) return { error: "Cadastro não encontrado." };
  if (m.situacao !== "ativo") {
    return { error: "Reative o cadastro antes de convidar." };
  }
  if (m.profile_id) {
    // profile vinculado (invite já saiu ou login próprio): reenvio só faz
    // sentido até o onboarding — conta onboarded não recebe link novo
    const { data: conta } = await supabase
      .from("profiles")
      .select("onboarded_em")
      .eq("id", m.profile_id)
      .maybeSingle();
    if (conta?.onboarded_em) {
      return { error: "Essa pessoa já entrou na plataforma." };
    }
  }
  const email = m.email?.trim().toLowerCase();
  if (!email) return { error: "Cadastre um e-mail pra enviar o convite." };
  return {
    email,
    primeiroNome: primeiro(m.nome, m.nome_social),
    audiencia: "mentorado",
  };
}

export async function convidarAcesso({
  tipo,
  id,
}: {
  tipo: "profile" | "mentorado";
  id: string;
}): Promise<Resultado> {
  // no demo o item do menu continua vivo pra mostrar o fluxo, mas nada sai
  if (await demoAtivo()) return { ok: true, demo: true };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  // gate de ativo explícito: a ação dispara o e-mail ANTES de bater em
  // qualquer policy — sem ela uma coord desativada seguiria convidando
  if (eu.role !== "coordenacao" || !eu.ativo) {
    return { error: "Só a coordenação envia convites de acesso." };
  }
  if (!UUID_RE.test(id)) return { error: "Cadastro inválido." };

  const alvo = await alvoConvite(supabase, tipo, id);
  if ("error" in alvo) return alvo;

  const admin = createAdminClient();
  let { data: link, error: eLink } = await admin.auth.admin.generateLink({
    type: "invite",
    email: alvo.email,
  });
  if (eLink && /already|exists|registered|cadastr/i.test(eLink.message)) {
    // reenvio (o auth.users nasceu no 1º convite) ou conta pré-existente:
    // magiclink minta o token de acesso pro usuário que já existe
    ({ data: link, error: eLink } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: alvo.email,
    }));
  }
  const props = link?.properties;
  if (eLink || !props?.hashed_token || !props.verification_type) {
    console.error("convidarAcesso generateLink:", eLink);
    return { error: "Não foi possível gerar o link de acesso. Tente de novo." };
  }
  // o type vai da RESPOSTA (invite minta 'invite', o fallback 'magiclink')
  // — o /auth/confirm repassa direto pro verifyOtp
  const url = `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(props.hashed_token)}&type=${props.verification_type}`;

  const jovem = tipo === "mentorado";
  const assunto = jovem
    ? "Sua jornada de mentoria começou"
    : "Sua conta na Mentoria Social está pronta";
  const { enviados, falhas, error: eEnvio } = await enviarEmailsIndividuais({
    // e-mail de acesso à conta, on-demand — fura o kill-switch como os
    // demais de segurança, nunca como notificação
    critico: true,
    mensagens: [
      {
        to: alvo.email,
        subject: assunto,
        html: emailConviteAcesso({
          trilha: jovem ? "jovem" : "staff",
          primeiroNome: alvo.primeiroNome,
          link: url,
          email: alvo.email,
        }),
      },
    ],
  });

  // o log é a memória do disparo — falha nele não desfaz o que saiu
  const { error: errLog } = await supabase.from("emails_enviados").insert({
    autor_id: eu.id,
    tipo: "convite",
    ref_id: id,
    assunto,
    audiencia: [alvo.audiencia],
    destinatarios: 1,
    enviados,
    falhas,
  });
  if (errLog) console.error("convidarAcesso: log", errLog);

  if (eEnvio) return { error: eEnvio };
  if (!enviados) {
    return {
      error: falhas.length
        ? `Falha ao enviar pra ${falhas.join(", ")}.`
        : "Não foi possível enviar. Tente de novo.",
    };
  }

  // a conta pode ter nascido neste envio — a lista troca "não convidado"
  // por "convite enviado" assim que a página relê
  revalidatePath("/pessoas");
  revalidatePath(`/pessoas/${id}`);
  return { ok: true, email: alvo.email };
}
