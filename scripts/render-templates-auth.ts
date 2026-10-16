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

process.env.NEXT_PUBLIC_SITE_URL = "{{ .SiteURL }}";

const { emailLayout } = await import("../src/lib/email-templates");

const CONFIRM_URL = "{{ .ConfirmationURL }}";
const EMAIL = "{{ .Email }}";

const fallbackLink = `Se o botão não abrir, copie este endereço no navegador:<br><span style="word-break:break-all;">${CONFIRM_URL}</span>`;

const magicLink = emailLayout({
  titulo: "Seu link de acesso",
  tagline: "Acesso à plataforma",
  preheader: "Seu link de acesso ao Realiza.vc — entra direto, sem senha.",
  conteudoHtml:
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#323232;">Olá! Chegou um pedido de entrada no <strong>Realiza.vc</strong> com este e-mail (<strong>${EMAIL}</strong>).</p>` +
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#323232;">É só clicar no botão pra entrar — não precisa de senha. O link vale por 1 hora e só pode ser usado uma vez.</p>`,
  ctaLabel: "Entrar no Realiza.vc",
  ctaHref: CONFIRM_URL,
  rodapeExtra: `${fallbackLink}<br>Pediu o link em outro dispositivo? Volte na aba que pediu — a entrada acontece por lá.<br>Se você não pediu este link, pode ignorar o e-mail — ninguém entra sem ele.`,
});

const recovery = emailLayout({
  titulo: "Redefinir sua senha",
  tagline: "Segurança da conta",
  preheader: "Pedido de redefinição de senha no Realiza.vc — se não foi você, ignore.",
  conteudoHtml:
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#323232;">Olá! Recebemos um pedido pra redefinir a senha da conta <strong>${EMAIL}</strong> no <strong>Realiza.vc</strong>.</p>` +
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#323232;">Se foi você, clique no botão pra criar uma senha nova. O link vale por 1 hora e só pode ser usado uma vez.</p>` +
    `<p style="margin:14px 0 0;font-size:13px;line-height:1.55;color:#9a9aa3;">Se não foi você, ignore este e-mail — sua senha atual continua valendo e ninguém entra sem o link.</p>`,
  ctaLabel: "Criar nova senha",
  ctaHref: CONFIRM_URL,
  rodapeExtra: `${fallbackLink}<br>Você está recebendo este e-mail porque alguém pediu a redefinição de senha desta conta.`,
});

writeFileSync("supabase/templates/magic-link.html", magicLink);
writeFileSync("supabase/templates/recovery.html", recovery);
console.log("supabase/templates/magic-link.html + recovery.html gerados");
