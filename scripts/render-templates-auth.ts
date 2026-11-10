/** Gera supabase/templates/{magic-link,recovery}.html renderizando o
 *  emailLayout real — o e-mail de auth sai com a mesma casca dos
 *  transacionais, sempre. Rode depois de mexer no emailLayout:
 *
 *    ./node_modules/.bin/jiti scripts/render-templates-auth.ts
 *
 *  O SITE_URL vira a variável do GoTrue ({{ .SiteURL }}) — o template
 *  segue o domínio configurado no projeto em vez de ficar fixo. No
 *  projeto hosteado, o conteúdo gerado vai colado em Authentication →
 *  Emails (dashboard). */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

process.env.NEXT_PUBLIC_SITE_URL = "{{ .SiteURL }}";

// email-templates usa o alias "@/" do tsconfig — o jiti CLI não resolve
// paths, então a instância aqui é criada com o alias explícito.
const jiti = createJiti(import.meta.url, {
  alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
});
const { emailLayout } = await jiti.import("../src/lib/email-templates.ts");

const CONFIRM_URL = "{{ .ConfirmationURL }}";
const EMAIL = "{{ .Email }}";

const fallbackLink = `Se o botão não abrir, copie este endereço no navegador:<br><span style="word-break:break-all;">${CONFIRM_URL}</span>`;

const magicLink = emailLayout({
  titulo: "Seu link de acesso",
  tagline: "Mentoria Social",
  preheader: "Seu link de acesso à Mentoria Social. Entra direto, sem senha.",
  conteudoHtml:
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#323232;">Olá! Chegou um pedido de entrada na <strong>Mentoria Social</strong> com este e-mail (<strong>${EMAIL}</strong>).</p>` +
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#323232;">É só clicar no botão pra entrar. Não precisa de senha: o link vale por 1 hora e só pode ser usado uma vez.</p>`,
  ctaLabel: "Entrar na Mentoria Social",
  ctaHref: CONFIRM_URL,
  rodapeExtra: `${fallbackLink}<br>Pediu o link em outro dispositivo? Volte na aba que pediu: a entrada acontece por lá.<br>Se você não pediu este link, pode ignorar o e-mail. Ninguém entra sem ele.`,
});

const confirmation = emailLayout({
  titulo: "Confirme seu cadastro",
  tagline: "Mentoria Social",
  preheader: "Confirme seu e-mail para entrar na Mentoria Social. O link vale 1 hora.",
  conteudoHtml:
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#323232;">Olá! Recebemos seu cadastro na <strong>Mentoria Social</strong> com este e-mail (<strong>${EMAIL}</strong>).</p>` +
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#323232;">É só clicar no botão pra confirmar e entrar. Não precisa de senha: o link vale por 1 hora e só pode ser usado uma vez.</p>`,
  ctaLabel: "Confirmar e entrar",
  ctaHref: CONFIRM_URL,
  rodapeExtra: `${fallbackLink}<br>Pediu o acesso em outro dispositivo? Volte na aba que pediu: a entrada acontece por lá.<br>Se você não fez este cadastro, pode ignorar o e-mail. Ninguém entra sem confirmar.`,
});

const emailChange = emailLayout({
  titulo: "Confirme a troca de e-mail",
  tagline: "Segurança da conta",
  preheader: "Pedido de troca de e-mail na Mentoria Social. Se não foi você, ignore.",
  conteudoHtml:
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#323232;">Olá! Recebemos um pedido pra trocar o e-mail da sua conta na <strong>Mentoria Social</strong> para este endereço (<strong>${EMAIL}</strong>).</p>` +
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#323232;">Se foi você, clique no botão pra confirmar a troca. O link vale por 1 hora e só pode ser usado uma vez.</p>` +
    `<p style="margin:14px 0 0;font-size:13px;line-height:1.55;color:#9a9aa3;">Se não foi você, ignore este e-mail: seu e-mail atual continua valendo e ninguém troca o endereço sem o link.</p>`,
  ctaLabel: "Confirmar troca de e-mail",
  ctaHref: CONFIRM_URL,
  rodapeExtra: `${fallbackLink}<br>Você está recebendo este e-mail porque alguém pediu a troca de e-mail da sua conta.`,
});

const recovery = emailLayout({
  titulo: "Redefinir sua senha",
  tagline: "Segurança da conta",
  preheader: "Pedido de redefinição de senha na Mentoria Social. Se não foi você, ignore.",
  conteudoHtml:
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#323232;">Olá! Recebemos um pedido pra redefinir a senha da conta <strong>${EMAIL}</strong> na <strong>Mentoria Social</strong>.</p>` +
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#323232;">Se foi você, clique no botão pra criar uma senha nova. O link vale por 1 hora e só pode ser usado uma vez.</p>` +
    `<p style="margin:14px 0 0;font-size:13px;line-height:1.55;color:#9a9aa3;">Se não foi você, ignore este e-mail: sua senha atual continua valendo e ninguém entra sem o link.</p>`,
  ctaLabel: "Criar nova senha",
  ctaHref: CONFIRM_URL,
  rodapeExtra: `${fallbackLink}<br>Você está recebendo este e-mail porque alguém pediu a redefinição de senha desta conta.`,
});

writeFileSync("supabase/templates/magic-link.html", magicLink);
writeFileSync("supabase/templates/confirmation.html", confirmation);
writeFileSync("supabase/templates/email-change.html", emailChange);
writeFileSync("supabase/templates/recovery.html", recovery);
console.log("supabase/templates/{magic-link,confirmation,email-change,recovery}.html gerados");
