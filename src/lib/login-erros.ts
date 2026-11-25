// Tradução dos erros do fluxo de entrada (magic link + senha) pra copy da
// tela — extraído do login-form pra ser testável. Toda string retornada
// aqui aparece verbatim; preservar textos existentes é contrato (o e2e e a
// memória muscular do suporte dependem deles).

export type ModoLogin = "link" | "senha";

const NAO_CADASTRADO =
  "E-mail não cadastrado. Fale com a coordenação pra liberar seu acesso.";

const INSTAVEL =
  "O acesso está instável agora. Tente de novo em alguns minutos. Se persistir, fale com a coordenação.";

/** "Pedir acesso" path when the email is not on the allowlist: the real
 *  channel today is the coordination mailbox (same one SiteFooter shows).
 *  With the typed address the body ships pre-filled; without it (blocked
 *  account screens) the body leaves a blank for the person to fill in. */
export function pedirAcessoHref(email?: string): string {
  const corpo = email?.trim()
    ? `Olá! Quero pedir acesso à plataforma com este e-mail: ${email.trim()}.`
    : "Olá! Quero pedir acesso à plataforma. Meu e-mail é:";
  return `mailto:mentoria@realiza.vc?subject=${encodeURIComponent("Pedido de acesso à Mentoria Social")}&body=${encodeURIComponent(corpo)}`;
}

function textoDe(error: { message: string; code?: string }): string {
  return `${error.code ?? ""} ${error.message}`.toLowerCase();
}

/** "database error saving new user" SEM a frase do trigger de allowlist —
 *  o 500 genérico do GoTrue cobre allowlist-miss E falha de infra (SMTP,
 *  pooler, trigger quebrado). Quem precisa distinguir os dois consulta
 *  email_liberado() no caller; este predicado marca o caso ambíguo. */
export function ehErroInfraSignup(error: { message: string; code?: string }): boolean {
  const texto = textoDe(error);
  return (
    texto.includes("database error saving new user") &&
    !texto.includes("cadastrados do programa")
  );
}

export function mensagemErro(
  error: { message: string; code?: string },
  modo: ModoLogin
): string {
  const texto = textoDe(error);
  if (texto.includes("invalid_credentials") || texto.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos. Confira e tente de novo.";
  }
  if (texto.includes("email_not_confirmed") || texto.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }
  // pausa de envio/pedidos do GoTrue (429): honesto dizer que é temporário —
  // o erro não é do e-mail digitado. Vale pros dois modos: o brute-force do
  // login por senha bate no mesmo limite
  if (
    texto.includes("over_email_send_rate_limit") ||
    texto.includes("over_request_rate_limit")
  ) {
    return "Muitos pedidos de uma vez. Tente de novo em alguns minutos.";
  }
  // e-mail fora da allowlist: só a frase real do trigger 0045/0171
  // ("cadastrados do programa") prova allowlist-miss; otp_disabled cobre
  // signup desligado no painel
  if (
    texto.includes("otp_disabled") ||
    texto.includes("signups not allowed") ||
    texto.includes("cadastrados do programa")
  ) {
    return NAO_CADASTRADO;
  }
  // o 500 pelado do signup NÃO é "não cadastrado": metade dos casos era
  // infra e a pessoa cadastrada ouvia que não existia — culpa invertida
  if (texto.includes("database error saving new user")) {
    return INSTAVEL;
  }
  return modo === "link"
    ? "Não foi possível enviar o link. Confira o e-mail ou tente de novo em alguns minutos."
    : "Não foi possível entrar. Tente de novo em alguns minutos.";
}

export { NAO_CADASTRADO, INSTAVEL };
