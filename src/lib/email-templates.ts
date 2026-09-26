import { SITE_URL } from "@/lib/email";
import type { ComunicadoPrioridade } from "@/lib/types";

// hex equivalentes das CSS vars da marca (globals.css) — e-mail não herda
// tokens, e cliente de e-mail só garante inline CSS
const INK = "#262626"; // --brand-ink hsl(0 0% 15%)
const LIME = "#a2ca44"; // --brand-lime hsl(78 56% 53%)
const AMARELO = "#ffd633"; // --role-mentorado hsl(48 100% 60%)
const PAPEL = "#f6f4ee"; // fundo papel quente
const MUTED = "#6f6a5f";
const BORDA = "#e8e4d8";
const DANGER = "#c8321f";
const DANGER_BG = "#fdf0ee";
const WARN = "#b07a05";
const WARN_BG = "#fdf6e4";
const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

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
        `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${INK};">${esc(p)}</p>`
    )
    .join("");
}

/** Casca única dos e-mails do sistema — header ink com os dois discos da
 *  marca + keyline lime (a mesma do footer do app), corpo branco 600px,
 *  rodapé papel. Só tabelas + CSS inline: o que o Gmail/Outlook respeitam. */
export function emailLayout({
  titulo,
  conteudoHtml,
  ctaLabel,
  ctaHref,
  rodapeExtra,
}: {
  titulo: string;
  conteudoHtml: string;
  ctaLabel?: string;
  ctaHref?: string;
  rodapeExtra?: string;
}): string {
  const cta =
    ctaLabel && ctaHref
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;">
  <tr>
    <td bgcolor="${LIME}" style="border-radius:8px;">
      <a href="${esc(ctaHref)}" target="_blank"
         style="display:inline-block;padding:12px 26px;font-family:${FONT};font-size:15px;font-weight:700;color:${INK};text-decoration:none;border-radius:8px;">${esc(ctaLabel)}</a>
    </td>
  </tr>
</table>`
      : "";

  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title></head>
<body style="margin:0;padding:0;background:${PAPEL};font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPEL};">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:12px;border:1px solid ${BORDA};">
    <!-- header ink + marca -->
    <tr>
      <td style="background:${INK};padding:20px 28px;border-radius:12px 12px 0 0;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:12px;vertical-align:middle;">
            <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${LIME};"></span><span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${AMARELO};margin-left:-7px;"></span>
          </td>
          <td style="vertical-align:middle;">
            <div style="font-size:18px;font-weight:700;color:#ffffff;line-height:1.2;">Realiza.vc</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.6);line-height:1.3;">Programa de Mentoria Social</div>
          </td>
        </tr></table>
      </td>
    </tr>
    <!-- keyline lime -->
    <tr><td style="height:2px;line-height:2px;font-size:0;background:${LIME};">&nbsp;</td></tr>
    <!-- corpo -->
    <tr>
      <td style="padding:26px 28px 8px;font-size:16px;line-height:1.6;color:${INK};">
        <h1 style="margin:0 0 18px;font-size:20px;line-height:1.35;font-weight:700;color:${INK};">${esc(titulo)}</h1>
        ${conteudoHtml}
        ${cta}
        <div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>
      </td>
    </tr>
    <!-- rodapé -->
    <tr>
      <td style="background:${PAPEL};padding:16px 28px;border-radius:0 0 12px 12px;border-top:1px solid ${BORDA};">
        <p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED};">
          Realiza.vc &middot; Programa de Mentoria Social
          &middot; <a href="${esc(SITE_URL)}" style="color:${MUTED};text-decoration:underline;">${esc(SITE_URL.replace(/^https?:\/\//, ""))}</a>
          ${rodapeExtra ? `<br>${rodapeExtra}` : ""}
        </p>
      </td>
    </tr>
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
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
  <tr>
    <td style="width:4px;background:${tema.cor};border-radius:2px;">&nbsp;</td>
    <td style="padding:10px 14px;background:${tema.fundo};border-radius:0 8px 8px 0;">
      <span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${tema.cor};">${tema.texto}</span>
    </td>
  </tr>
</table>`
    : "";
  return emailLayout({
    titulo,
    conteudoHtml: `${faixa}${paragrafos(corpo)}`,
    ctaLabel: "Abrir avisos",
    ctaHref: ctaHref ?? `${SITE_URL}/#avisos`,
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
    <td style="padding:14px 16px;border:1px solid ${BORDA};border-left:4px solid ${LIME};border-radius:8px;">
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
  });
}
