"use server";

import { createClient as createAnonClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { demoAtivo } from "./demo/mode";
import { DEMO_MSG } from "./demo/shared";
import { emailValido, normEmail } from "./importar";
import { enviarEmailsIndividuais } from "./email";
import { emailEmailAlterado, emailSenhaAlterada } from "./email-templates";

/** Troca de e-mail verificada por credencial — o padrão da indústria: quem
 *  tem senha prova a posse com ela (verificada server-side num client
 *  descartável pra tentativa não tocar na sessão nem contar como "login
 *  fresco" pros outros gates); quem dispensou a senha no onboarding usa a
 *  sessão ativa como credencial (passwordless — ela só existe porque um
 *  e-mail foi verificado e é exatamente o que salva quem perdeu a caixa).
 *  Aplicado via admin.updateUserById com email_confirm: a prova já foi
 *  feita aqui, sem link nem espera. O trigger sync_profile_email (0060)
 *  espelha em profiles.email no mesmo movimento. */
export async function trocarEmail(input: {
  email: string;
  senha?: string;
}): Promise<{ error: string } | { ok: true }> {
  if (await demoAtivo()) return { error: DEMO_MSG };

  const supabase = await createClient();
  const {
    data: { user },
    error: erroUser,
  } = await supabase.auth.getUser();
  if (erroUser || !user?.email) {
    return { error: "Sessão expirada. Entre de novo pelo link de e-mail." };
  }

  const novo = normEmail(input.email);
  if (!emailValido(novo)) return { error: "Confira o e-mail." };
  if (novo === user.email.toLowerCase()) {
    return { error: "Esse já é o seu e-mail." };
  }

  const meta = user.user_metadata;
  const temSenha = !(meta?.senha_dispensada && !meta?.senha_em);
  if (temSenha) {
    if (!input.senha) return { error: "Confirme sua senha atual." };
    const verificador = createAnonClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );
    const { error } = await verificador.auth.signInWithPassword({
      email: user.email,
      password: input.senha,
    });
    if (error) return { error: "Senha incorreta." };
  }

  const { data: livre, error: erroRpc } = await supabase.rpc(
    "email_disponivel",
    { p_email: novo }
  );
  if (erroRpc) {
    return { error: "Não foi possível verificar o e-mail. Tente de novo." };
  }
  if (!livre) {
    return { error: "Esse e-mail já está em outro cadastro do programa." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    email: novo,
    email_confirm: true,
  });
  if (error) {
    // race: outro auth.users pegou o endereço entre a checagem e o update
    if (/already been registered|already exists|duplicate/i.test(error.message)) {
      return { error: "Esse e-mail já está em outro cadastro do programa." };
    }
    return { error: "Não foi possível trocar o e-mail. Tente de novo." };
  }

  // notificação pro endereço ANTIGO — é onde quem perdeu a conta descobre.
  // await porque serverless mata promise solta ao responder; a função nunca
  // lança, então falha de envio não trava a troca (que já aconteceu)
  await enviarEmailsIndividuais({
    mensagens: [
      {
        to: user.email,
        subject: "Seu e-mail de acesso mudou — Realiza.vc",
        html: emailEmailAlterado({ antigo: user.email, novo }),
      },
    ],
  });
  return { ok: true };
}

/** Aviso "senha alterada" pro endereço da conta — chamado pelo client após
 *  o updateUser de senha dar certo (perfil, recovery e primeiro acesso).
 *  O GoTrue local tem secure_password_change desligado, então a
 *  notificação é responsabilidade do app. Nunca lança: se o envio falhar,
 *  a senha continua trocada e ninguém fica sabendo por aqui. */
export async function avisarSenhaAlterada(): Promise<{ ok: true }> {
  if (await demoAtivo()) return { ok: true };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email) {
    await enviarEmailsIndividuais({
      mensagens: [
        {
          to: user.email,
          subject: "Sua senha foi alterada — Realiza.vc",
          html: emailSenhaAlterada({ email: user.email }),
        },
      ],
    });
  }
  return { ok: true };
}
