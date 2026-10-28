import { SITE_URL } from "@/lib/email";
import type { ComunicadoPrioridade } from "@/lib/types";

// hex equivalentes das CSS vars da marca (globals.css) — e-mail não herda
// tokens, e cliente de e-mail só garante inline CSS
const INK = "#323232";
const LIME = "#a0c644"; // --brand-lime hsl(78 56% 53%)
const LIME_CLARO = "#b8d85f";
const AMARELO = "#ffd531"; // ponto do logo — --role-mentorado
const FUNDO = "#f5f5f6";
const MUTED = "#9a9aa3";
const BORDA = "#ececef";
const CARD_SUAVE = "#fafafa";
const DANGER = "#c8321f";
const DANGER_BG = "#fdf0ee";
const WARN = "#b07a05";
const WARN_BG = "#fdf6e4";
const FONT = "'Mitr','Segoe UI',Helvetica,Arial,sans-serif";
/** Logo no bucket público do Supabase Storage — e-mail não depende do
 *  deploy do app pra carregar a marca. Override por EMAIL_LOGO_URL. */
const LOGO_BRANCO_URL =
  process.env.EMAIL_LOGO_URL ??
  "https://yhjzmxleotahijinjepl.supabase.co/storage/v1/object/public/email-assets/logo-realiza-branco.png";

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

/** Casca única dos e-mails do sistema — card branco 600px sobre fundo
 *  cinza, com barra lime no topo, logo oficial (imagem) no header, título,
 *  conteúdo, CTA pill e rodapé ink com o logo branco. Só tabelas + CSS
 *  inline: o que o Gmail/Outlook respeitam. `tagline` vira o eyebrow sobre
 *  o título e `preheader` é o texto de prévia que a caixa de entrada mostra. */
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
      ? `<div style="text-align:center;margin:30px 0 8px;"><a href="${esc(ctaHref)}" target="_blank" style="display:inline-block;background:${LIME};color:${INK};text-decoration:none;font-weight:600;padding:15px 34px;border-radius:999px;font-size:15px;letter-spacing:0.2px;box-shadow:0 2px 6px rgba(50,50,50,0.16);">${esc(ctaLabel)}</a></div>`
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
    .email-header { padding:24px 22px 16px !important; }
    .email-body { padding:24px 22px !important; }
    .email-legal { padding:16px 22px 24px !important; }
    .email-extra { padding:0 22px 20px !important; }
    .email-logo { width:128px !important; }
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
<tr><td align="center" style="padding:32px 12px 0;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid ${BORDA};box-shadow:0 4px 24px rgba(0,0,0,0.06);">
    <tr>
      <td class="email-header" bgcolor="${INK}" style="background:${INK};padding:26px 36px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td valign="top">
              <img src="${LOGO_BRANCO_URL}" alt="Realiza.vc" width="140" class="email-logo" style="display:block;width:140px;max-width:45%;height:auto;border:0;outline:none;">
              ${
                tagline
                  ? `<p style="margin:7px 0 0;font-family:${FONT};font-size:13px;font-weight:500;line-height:1.4;color:#b9b9c0;">${esc(tagline)}</p>`
                  : ""
              }
            </td>
            <td valign="top" align="right" style="padding-left:16px;white-space:nowrap;">
              <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${AMARELO};margin-left:8px;">&nbsp;</span><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${LIME};">&nbsp;</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr><td style="height:3px;line-height:3px;font-size:1px;background-color:${LIME};background-image:linear-gradient(90deg,${LIME} 0%,${LIME_CLARO} 100%);">&nbsp;</td></tr>
    <tr>
      <td class="email-body" style="padding:28px 36px;font-size:15px;line-height:1.6;color:${INK};">
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.35;font-weight:600;color:${INK};">${esc(titulo)}</h1>
        ${conteudoHtml}
        ${ctaRender}
      </td>
    </tr>
    <tr><td class="email-extra" style="padding:0 36px 24px;font-size:14px;line-height:1.55;color:${INK};"><p style="margin:0;color:${MUTED};">— Equipe Realiza.vc</p></td></tr>
    <tr><td class="email-legal" bgcolor="${INK}" style="background:${INK};padding:20px 36px 24px;font-size:11px;line-height:1.6;color:${MUTED};text-align:center;">
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

/** Pedido de ajuda marcado pelo JOVEM na avaliação do encontro (0071) — o
 *  sino pode passar despercebido, então coord + supervisor da dupla levam
 *  o mesmo alerta por e-mail. É canal de segurança de menor: o texto leva
 *  o combinado do programa (responder em 1 dia útil) e o comentário que o
 *  jovem escreveu — nunca o nome do mentor no corpo: comentário livre pode
 *  citá-lo e o e-mail também vai pro supervisor, que já tem acesso pela
 *  RLS, mas a menos dados redundantes melhor pra não virar segunda via do
 *  formulário. */
export function emailApoioJovem({
  jovemNome,
  encontroNumero,
  estrelas,
  comentario,
  duplaId,
  chamadoHref,
  chamadoNumero,
}: {
  jovemNome: string;
  encontroNumero: number;
  estrelas: number;
  comentario: string | null;
  duplaId: string;
  /** 0084: quando o chamado já nasceu na mesma transação, o e-mail leva
   *  direto na fila — senão cai na ficha da dupla como antes. */
  chamadoHref?: string | null;
  chamadoNumero?: string | null;
}): string {
  const estrelasTxt =
    "★".repeat(estrelas) + "☆".repeat(Math.max(0, 5 - estrelas));
  return emailLayout({
    titulo: "Um jovem pediu ajuda",
    tagline: "Canal de segurança",
    conteudoHtml:
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};"><strong>${esc(jovemNome)}</strong> avaliou o encontro ${encontroNumero} e marcou <strong>“preciso de ajuda”</strong>.</p>` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;background:${DANGER_BG};border-radius:10px;"><tr><td style="padding:14px 16px;font-size:15px;line-height:1.55;color:${INK};">` +
      `<span style="font-size:17px;letter-spacing:1px;color:${DANGER};">${estrelasTxt}</span>` +
      (comentario
        ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.55;color:${INK};">“${esc(comentario)}”</p>`
        : "") +
      `</td></tr></table>` +
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};">Combinado do programa: <strong>responder em 1 dia útil</strong>. ${chamadoNumero ? `O chamado <strong>${esc(chamadoNumero)}</strong> já está na fila` : "A ficha da dupla tem a avaliação completa"} e o botão pra marcar o pedido como atendido.</p>`,
    ctaLabel: chamadoHref ? "Abrir chamado" : "Abrir ficha da dupla",
    ctaHref: chamadoHref ?? `${SITE_URL}/duplas/${duplaId}`,
    preheader: `${jovemNome} marcou "preciso de ajuda" na avaliação do encontro ${encontroNumero}.`,
    rodapeExtra:
      "Você está recebendo este e-mail porque acompanha a coordenação ou a supervisão do programa.",
  });
}

/** Link do instrumento da jornada pro JOVEM (REALIZA-51 — lote da
 *  coordenação). O e-mail leva só nome + instrumento + link: o token é o
 *  fator de posse, então nada de resposta/dado de outra pessoa no corpo.
 *  Copy "sem senha, no seu tempo" — a entrega que antes ia por WhatsApp
 *  agora tem canal próprio. */
export function emailInstrumentoJovem({
  primeiroNome,
  instrumento,
  link,
}: {
  primeiroNome: string;
  instrumento: string;
  link: string;
}): string {
  return emailLayout({
    titulo: instrumento,
    tagline: "Instrumento da jornada",
    conteudoHtml:
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};">Oi${primeiroNome ? `, ${esc(primeiroNome)}` : ""}!</p>` +
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};">Chegou a sua vez de responder <strong>${esc(instrumento)}</strong> — um exercício da sua jornada de mentoria.</p>` +
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};">É só seu: responda no seu tempo, direto pelo botão abaixo. Não precisa de senha nem de cadastro.</p>`,
    ctaLabel: "Responder agora",
    ctaHref: link,
    preheader: `${instrumento}: seu link chegou — responda no seu tempo, sem senha.`,
    rodapeExtra: `Se o botão não abrir, copie este endereço no navegador:<br><span style="word-break:break-all;">${esc(link)}</span><br>Este link é pessoal e só seu.`,
  });
}

/** Mesma entrega por repasse (decisão da issue): jovem sem e-mail
 *  cadastrado → o link chega ao MENTOR pra repassar. O texto deixa claro
 *  de quem é o exercício — o mentor é canal, não destinatário. */
export function emailInstrumentoRepasseMentor({
  mentorNome,
  jovemNome,
  instrumento,
  link,
}: {
  mentorNome: string;
  jovemNome: string;
  instrumento: string;
  link: string;
}): string {
  const primeiroMentor = mentorNome.trim().split(/\s+/)[0] ?? "";
  const primeiroJovem = jovemNome.trim().split(/\s+/)[0] ?? "";
  return emailLayout({
    titulo: instrumento,
    tagline: "Instrumento da jornada",
    conteudoHtml:
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};">Oi${primeiroMentor ? `, ${esc(primeiroMentor)}` : ""}!</p>` +
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};"><strong>${esc(jovemNome)}</strong> não tem e-mail cadastrado, então o link de <strong>${esc(instrumento)}</strong> veio pra você.</p>` +
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};">Repasse pra ${esc(primeiroJovem) || "a jovem"} — o exercício faz parte da jornada de mentoria e a resposta é dela. O link abre direto, sem senha.</p>`,
    ctaLabel: "Abrir o link",
    ctaHref: link,
    preheader: `${instrumento}: o link de ${jovemNome} veio pra você repassar.`,
    rodapeExtra: `Se o botão não abrir, copie este endereço no navegador:<br><span style="word-break:break-all;">${esc(link)}</span><br>Este link é da jornada de ${esc(jovemNome)}.`,
  });
}

/** "Depois da mentoria" pro JOVEM (REALIZA-216 — lote da coordenação,
 *  6 meses depois da conclusão). Não é exercício da jornada: é a pergunta
 *  de desfecho — a copy lembra de onde ele conhece o programa e diz pra
 *  que serve a resposta (a finalidade LGPD do form, em linguagem simples). */
export function emailDesfechoJovem({
  primeiroNome,
  link,
}: {
  primeiroNome: string;
  link: string;
}): string {
  const instrumento = "Depois da mentoria";
  return emailLayout({
    titulo: instrumento,
    tagline: "Programa de Mentoria",
    conteudoHtml:
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};">Oi${primeiroNome ? `, ${esc(primeiroNome)}` : ""}!</p>` +
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};">Faz um tempo que a sua mentoria terminou e a gente quer saber: <strong>como você está?</strong> Estudando, trabalhando, empreendendo?</p>` +
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};">São 2 perguntinhas rápidas. Sua resposta ajuda o Instituto a medir se a mentoria funciona e a prestar contas a quem apoia o programa; a gente só publica números juntos, nunca a sua resposta sozinha.</p>`,
    ctaLabel: "Responder agora",
    ctaHref: link,
    preheader:
      "Como você está depois da mentoria? 2 perguntinhas, sem senha.",
    rodapeExtra: `Se o botão não abrir, copie este endereço no navegador:<br><span style="word-break:break-all;">${esc(link)}</span><br>Este link é pessoal e só seu.`,
  });
}

/** Repasse do desfecho pelo mentor (jovem sem e-mail cadastrado) — mesmo
 *  arranjo do lote de instrumentos: o mentor é o canal, a resposta é da
 *  jovem. */
export function emailDesfechoRepasseMentor({
  mentorNome,
  jovemNome,
  link,
}: {
  mentorNome: string;
  jovemNome: string;
  link: string;
}): string {
  const primeiroMentor = mentorNome.trim().split(/\s+/)[0] ?? "";
  const primeiroJovem = jovemNome.trim().split(/\s+/)[0] ?? "";
  return emailLayout({
    titulo: "Depois da mentoria",
    tagline: "Programa de Mentoria",
    conteudoHtml:
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};">Oi${primeiroMentor ? `, ${esc(primeiroMentor)}` : ""}!</p>` +
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};"><strong>${esc(jovemNome)}</strong> não tem e-mail cadastrado, então o link do questionário <strong>Depois da mentoria</strong> veio pra você.</p>` +
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};">Repasse pra ${esc(primeiroJovem) || "a jovem"} — são 2 perguntinhas sobre como ela está depois da jornada, e a resposta é dela. O link abre direto, sem senha.</p>`,
    ctaLabel: "Abrir o link",
    ctaHref: link,
    preheader: `Depois da mentoria: o link de ${jovemNome} veio pra você repassar.`,
    rodapeExtra: `Se o botão não abrir, copie este endereço no navegador:<br><span style="word-break:break-all;">${esc(link)}</span><br>Este link é de ${esc(jovemNome)}.`,
  });
}

// 0084 — chamados unificados: urgência/origem jovem avisa a equipe por
// e-mail (o sino não é garantia pra canal de segurança) e atualização
// pública chega ao autor também fora do app.

export function emailChamadoUrgencia({
  numero,
  assunto,
  categoria,
  autorNome,
  href,
}: {
  numero: string;
  assunto: string;
  categoria: string;
  autorNome: string;
  href: string;
}): string {
  return emailLayout({
    titulo: `Chamado ${esc(numero)} precisa de resposta`,
    tagline: categoria === "urgencia" ? "Pedido urgente" : "Novo pedido de apoio",
    conteudoHtml:
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};"><strong>${esc(autorNome)}</strong> abriu o chamado <strong>${esc(numero)}</strong>${categoria === "urgencia" ? ' marcado como <strong>urgente</strong>' : ""}.</p>` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;background:${categoria === "urgencia" ? DANGER_BG : CARD_SUAVE};border-radius:10px;"><tr><td style="padding:14px 16px;font-size:15px;line-height:1.55;color:${INK};">“${esc(assunto)}”</td></tr></table>` +
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};">Combinado do programa: <strong>responder em 1 dia útil</strong>. A fila de chamados tem a conversa completa.</p>`,
    ctaLabel: "Abrir a fila de chamados",
    ctaHref: href,
    preheader: `${autorNome} abriu o chamado ${numero}: ${assunto}`,
    rodapeExtra:
      "Você está recebendo este e-mail porque faz parte da coordenação ou supervisão do programa.",
  });
}

export function emailChamadoAtualizacao({
  autorNome,
  texto,
  href,
}: {
  autorNome: string;
  texto: string;
  href: string;
}): string {
  return emailLayout({
    titulo: "Atualização no seu pedido",
    tagline: "Chamados · Realiza",
    conteudoHtml:
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};">Oi${autorNome ? `, ${esc(autorNome.split(" ")[0])}` : ""}! A equipe respondeu no seu pedido de apoio:</p>` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;background:${CARD_SUAVE};border-radius:10px;"><tr><td style="padding:14px 16px;font-size:15px;line-height:1.55;color:${INK};">${paragrafos(texto)}</td></tr></table>`,
    ctaLabel: "Ver a conversa",
    ctaHref: href,
    preheader: `A equipe respondeu no seu pedido de apoio.`,
    rodapeExtra:
      "Você está recebendo este e-mail porque abriu um pedido de apoio no Realiza.",
  });
}
