import { SITE_URL } from "@/lib/email";
import type { ComunicadoPrioridade } from "@/lib/types";

// hex equivalentes das CSS vars da marca (globals.css) — e-mail não herda
// tokens, e cliente de e-mail só garante inline CSS
const INK = "#323232";
const LIME = "#a0c644"; // --brand-lime hsl(78 56% 53%)
const LIME_CLARO = "#b8d85f";
const LIME_ESCURO = "#7fa02e"; // eyebrow — o lime puro não lê em 11px
const FUNDO = "#f5f5f6";
const MUTED = "#9a9aa3";
const BORDA = "#ececef";
const CARD_SUAVE = "#fafafa";
const DANGER = "#c8321f";
const DANGER_BG = "#fdf0ee";
const WARN = "#b07a05";
const WARN_BG = "#fdf6e4";
const FONT = "'Mitr','Segoe UI',Helvetica,Arial,sans-serif";
const BANNER_URL = `${SITE_URL}/email/vamos-juntos.png`;

/** Conteúdo digitado pela coordenação vai pra HTML de e-mail — escapa sempre. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragrafos(texto: string): string {
  return texto
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};">${esc(p)}</p>`
    )
    .join("");
}

/** Casca única dos e-mails do sistema — banner da marca em imagem (servido
 *  pelo próprio site, sem dependência de CDN externo), card branco 600px
 *  sobre fundo cinza, CTA pill em gradiente lime, assinatura "— Equipe
 *  Realiza.vc" e o mesmo banner fechando. Só tabelas + CSS inline: o que o
 *  Gmail/Outlook respeitam. `tagline` vira o eyebrow sobre o título e
 *  `preheader` é o texto de prévia que a caixa de entrada mostra. */
export function emailLayout({
  titulo,
  conteudoHtml,
  ctaLabel,
  ctaHref,
  tagline,
  preheader,
  rodapeExtra,
}: {
  titulo: string;
  conteudoHtml: string;
  ctaLabel?: string;
  ctaHref?: string;
  tagline?: string;
  preheader?: string;
  rodapeExtra?: string;
}): string {
  const ctaRender =
    ctaLabel && ctaHref
      ? `<div style="text-align:center;margin:28px 0 8px;"><a href="${esc(ctaHref)}" target="_blank" style="display:inline-block;background-color:${LIME};background-image:linear-gradient(90deg,${LIME} 0%,${LIME_CLARO} 100%);color:#ffffff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:999px;font-size:15px;letter-spacing:0.2px;">${esc(ctaLabel)}</a></div>`
      : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${esc(titulo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Mitr:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @media screen and (max-width:620px) {
    .email-body { padding:24px 20px !important; }
    .email-legal { padding:16px 20px 24px !important; }
    .email-extra { padding:0 20px 12px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${FUNDO};font-family:${FONT};color:${INK};-webkit-text-size-adjust:100%;">
${
  preheader
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(preheader)}</div>`
    : ""
}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${FUNDO}" style="background:${FUNDO};">
<tr><td align="center" style="padding:24px 0;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <tr><td><img src="${BANNER_URL}" alt="Realiza.vc" width="600" style="display:block;width:100%;height:auto;max-width:600px;border:0;outline:none;"></td></tr>
    <tr>
      <td class="email-body" style="padding:32px;font-size:15px;line-height:1.55;color:${INK};">
        ${
          tagline
            ? `<p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.6px;color:${LIME_ESCURO};">${esc(tagline)}</p>`
            : ""
        }
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.35;font-weight:600;color:${INK};">${esc(titulo)}</h1>
        ${conteudoHtml}
        ${ctaRender}
      </td>
    </tr>
    <tr><td class="email-extra" style="padding:0 32px 16px;font-size:14px;line-height:1.55;color:${INK};"><p style="margin:0;">— Equipe Realiza.vc</p></td></tr>
    <tr><td><img src="${BANNER_URL}" alt="Instituto Realiza.vc — Vamos Juntos!" width="600" style="display:block;width:100%;height:auto;max-width:600px;border:0;outline:none;"></td></tr>
    <tr><td class="email-legal" style="padding:20px 32px 28px;font-size:11px;line-height:1.6;color:${MUTED};text-align:center;">
      Instituto Realiza.vc &middot; <a href="${esc(SITE_URL)}" style="color:${MUTED};text-decoration:underline;">${esc(SITE_URL.replace(/^https?:\/\//, ""))}</a>
      ${rodapeExtra ? `<br>${rodapeExtra}` : ""}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

const PRIORIDADE_TEMA: Record<
  ComunicadoPrioridade,
  { texto: string; cor: string; fundo: string } | null
> = {
  urgente: { texto: "Urgente", cor: DANGER, fundo: DANGER_BG },
  importante: { texto: "Importante", cor: WARN, fundo: WARN_BG },
  normal: null,
};

/** Aviso da coordenação — prioridade vira uma faixa sutil com badge (urgente
 *  vermelha, importante âmbar, normal neutra) sobre o corpo em parágrafos. */
export function emailAviso({
  titulo,
  corpo,
  prioridade,
  ctaHref,
}: {
  titulo: string;
  corpo: string;
  prioridade: ComunicadoPrioridade;
  ctaHref?: string;
}): string {
  const tema = PRIORIDADE_TEMA[prioridade] ?? null;
  const faixa = tema
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
  <tr>
    <td style="width:5px;background:${tema.cor};border-radius:3px;">&nbsp;</td>
    <td style="padding:11px 16px;background:${tema.fundo};border-radius:0 10px 10px 0;">
      <span style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${tema.cor};">${tema.texto}</span>
    </td>
  </tr>
</table>`
    : "";
  return emailLayout({
    titulo,
    conteudoHtml: `${faixa}${paragrafos(corpo)}`,
    ctaLabel: "Abrir avisos",
    ctaHref: ctaHref ?? `${SITE_URL}/#avisos`,
    tagline: "Aviso da coordenação",
    preheader: `${tema ? `${tema.texto}: ` : ""}${titulo} — ${corpo.slice(0, 90)}`,
    rodapeExtra:
      "Este aviso também está na plataforma, na aba inicial — você pode conferir por lá a qualquer momento.",
  });
}

/** Aviso de material novo — card com chip do tipo + descrição e CTA pro
 *  destino real (arquivo assinado via /api/material ou o link externo). */
export function emailMaterial({
  titulo,
  descricao,
  tipoLabel,
  ctaHref,
}: {
  titulo: string;
  descricao: string | null;
  tipoLabel: string;
  ctaHref: string;
}): string {
  const card = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;">
  <tr>
    <td style="padding:16px 18px;border:1px solid ${BORDA};border-left:4px solid ${LIME};border-radius:10px;background:${CARD_SUAVE};">
      <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${MUTED};">${esc(tipoLabel)}</span>
      <div style="margin-top:4px;font-size:16px;font-weight:700;line-height:1.4;color:${INK};">${esc(titulo)}</div>
      ${
        descricao
          ? `<div style="margin-top:6px;font-size:14px;line-height:1.55;color:${MUTED};">${esc(descricao)}</div>`
          : ""
      }
    </td>
  </tr>
</table>`;
  return emailLayout({
    titulo: `Novo material: ${titulo}`,
    conteudoHtml: `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${INK};">Um novo material entrou na biblioteca:</p>${card}`,
    ctaLabel: "Abrir material",
    ctaHref,
    tagline: "Biblioteca de materiais",
    preheader: `Novo material: ${titulo}${descricao ? ` — ${descricao.slice(0, 80)}` : ""}`,
    rodapeExtra:
      "O material fica disponível na aba Materiais da plataforma — este e-mail é só o aviso de que ele chegou.",
  });
}

/** Link individual de assinatura (coord dispara no lote da /pessoas) — um
 *  e-mail por pessoa porque o link é o fator de posse. `nomePessoa` é o alvo
 *  do documento quando quem recebe não é o signatário (autorização do
 *  responsável → nome do(a) jovem); null = o doc é do próprio destinatário. */
export function emailDocumentoAssinatura({
  docTitulo,
  nomePessoa,
  primeiroNome,
  link,
}: {
  docTitulo: string;
  nomePessoa?: string | null;
  primeiroNome: string;
  link: string;
}): string {
  const saudacao = primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!";
  const objeto = nomePessoa
    ? `O documento “${esc(docTitulo)}” de ${esc(nomePessoa)}`
    : `Seu documento “${esc(docTitulo)}”`;
  const conteudoHtml =
    `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${INK};">${esc(saudacao)}</p>` +
    `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${INK};">${objeto} está pronto pra assinatura eletrônica no Realiza.vc.</p>` +
    `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${INK};">Os dados já vêm preenchidos do cadastro — é só conferir, completar o que faltar e assinar com o nome completo. Leva cerca de 1 minuto.</p>`;
  return emailLayout({
    titulo: docTitulo,
    conteudoHtml,
    ctaLabel: "Ler e assinar o documento",
    ctaHref: link,
    tagline: "Documento para assinar",
    preheader: `${docTitulo}: link pra assinar — leva ~1 minuto`,
    rodapeExtra: `Se o botão não abrir, copie este endereço no navegador:<br><span style="word-break:break-all;">${esc(link)}</span><br>Este link é pessoal. Se ele expirar, peça um novo à coordenação.`,
  });
}

/** Notificação de segurança "senha alterada" — vai pro endereço da conta.
 *  Se não foi a pessoa, o caminho de volta é o login por link de e-mail +
 *  redefinir senha no perfil (o recovery não depende de lembrar a senha). */
export function emailSenhaAlterada({ email }: { email: string }): string {
  return emailLayout({
    titulo: "Sua senha foi alterada",
    tagline: "Segurança da conta",
    conteudoHtml:
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};">Olá! Esta é uma confirmação de que a senha da conta <strong>${esc(email)}</strong> no <strong>Realiza.vc</strong> acaba de ser alterada.</p>` +
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};">Se foi você quem fez essa alteração, pode ignorar este e-mail — está tudo certo.</p>` +
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};">Se <strong>não foi você</strong>, entre pelo link de e-mail, troque a senha no seu perfil e avise a coordenação.</p>`,
    ctaLabel: "Acessar minha conta",
    ctaHref: `${SITE_URL}/perfil`,
    preheader:
      "Sua senha no Realiza.vc foi alterada — se não foi você, aja agora.",
    rodapeExtra:
      "Você está recebendo este e-mail porque a senha da sua conta no Instituto Realiza.vc foi alterada.",
  });
}

/** Notificação "e-mail de acesso mudou" — vai pro endereço ANTIGO (é o
 *  sinal de segurança quando a sessão cai em mãos erradas: quem trocou já
 *  sabe; quem perdeu a conta descobre aqui). */
export function emailEmailAlterado({
  antigo,
  novo,
}: {
  antigo: string;
  novo: string;
}): string {
  return emailLayout({
    titulo: "Seu e-mail de acesso mudou",
    tagline: "Segurança da conta",
    conteudoHtml:
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};">Olá! O e-mail de acesso da sua conta no <strong>Realiza.vc</strong> mudou de <strong>${esc(antigo)}</strong> para <strong>${esc(novo)}</strong>.</p>` +
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};">Se foi você quem fez essa alteração, pode ignorar este e-mail — está tudo certo.</p>` +
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};">Se <strong>não foi você</strong>, sua conta pode estar em risco — fale com a coordenação agora.</p>`,
    ctaLabel: "Acessar o Realiza.vc",
    ctaHref: SITE_URL,
    preheader: `Seu acesso mudou de ${antigo} para ${novo} — se não foi você, fale com a coordenação.`,
    rodapeExtra:
      "Você está recebendo este e-mail porque o endereço de acesso da sua conta no Instituto Realiza.vc foi alterado.",
  });
}
