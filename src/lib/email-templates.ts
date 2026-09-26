import { SITE_URL } from "@/lib/email";
import type { ComunicadoPrioridade } from "@/lib/types";

// hex equivalentes das CSS vars da marca (globals.css) — e-mail não herda
// tokens, e cliente de e-mail só garante inline CSS
const INK = "#262626"; // --brand-ink hsl(0 0% 15%)
const LIME = "#a2ca44"; // --brand-lime hsl(78 56% 53%)
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

const AMARELO = "#ffd633"; // ponto do wordmark / --role-mentorado

/** Casca única dos e-mails do sistema — header ink com o wordmark da marca
 *  em texto puro (REALIZA branco + "." amarelo + "VC" lime; sem imagem,
 *  nada fica bloqueado) + keyline lime (a
 *  mesma do footer do app), corpo branco 600px, rodapé papel. Só tabelas +
 *  CSS inline: o que o Gmail/Outlook respeitam.
 *  `tagline` troca a linha sob o logo pelo contexto do e-mail
 *  ("Aviso da coordenação"), `selo` é o carimbo tracejado do rodapé e
 *  `preheader` é o texto de prévia que a caixa de entrada mostra. */
export function emailLayout({
  titulo,
  conteudoHtml,
  ctaLabel,
  ctaHref,
  tagline = "Programa de Mentoria Social",
  selo,
  preheader,
  rodapeExtra,
}: {
  titulo: string;
  conteudoHtml: string;
  ctaLabel?: string;
  ctaHref?: string;
  tagline?: string;
  selo?: string;
  preheader?: string;
  rodapeExtra?: string;
}): string {
  const ctaRender =
    ctaLabel && ctaHref
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 4px;">
  <tr>
    <td bgcolor="${LIME}" style="border-radius:999px;">
      <a href="${esc(ctaHref)}" target="_blank"
         style="display:inline-block;padding:13px 30px;font-family:${FONT};font-size:15px;font-weight:700;color:${INK};text-decoration:none;border-radius:999px;">${esc(ctaLabel)}&nbsp;&rarr;</a>
    </td>
  </tr>
</table>`
      : "";

  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title></head>
<body style="margin:0;padding:0;background:${PAPEL};font-family:${FONT};">
${
  preheader
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(preheader)}</div>`
    : ""
}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPEL};">
<tr><td align="center" style="padding:36px 14px 44px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:16px;border:1px solid ${BORDA};box-shadow:0 10px 30px rgba(38,38,38,0.08);">
    <!-- header ink + wordmark em texto (REALIZA branco, . amarelo, VC lime — tracking fechado igual ao logo) -->
    <tr>
      <td style="background:${INK};padding:26px 30px;border-radius:16px 16px 0 0;">
        <div style="font-family:'Arial Black',Arial,Helvetica,sans-serif;font-size:30px;font-weight:900;font-style:italic;letter-spacing:-1px;line-height:1;color:#ffffff;">REALIZA<span style="color:${AMARELO};letter-spacing:-6px;">.</span><span style="color:${LIME};">VC</span></div>
        <div style="margin-top:9px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.6px;color:rgba(255,255,255,0.55);line-height:1.3;">${esc(tagline)}</div>
      </td>
    </tr>
    <!-- keyline lime -->
    <tr><td style="height:3px;line-height:3px;font-size:0;background:${LIME};">&nbsp;</td></tr>
    <!-- corpo -->
    <tr>
      <td style="padding:30px 30px 10px;font-size:16px;line-height:1.65;color:${INK};">
        <h1 style="margin:0 0 20px;font-size:23px;line-height:1.32;font-weight:800;letter-spacing:-0.3px;color:${INK};">${esc(titulo)}</h1>
        ${conteudoHtml}
        ${ctaRender}
        <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
      </td>
    </tr>
    <!-- rodapé -->
    <tr>
      <td style="background:${PAPEL};padding:18px 30px;border-radius:0 0 16px 16px;border-top:1px solid ${BORDA};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:top;width:26px;padding-right:10px;">
            <div style="width:26px;height:26px;border-radius:7px;background:${LIME};color:${INK};font-family:'Arial Black',Arial,sans-serif;font-size:15px;font-weight:900;font-style:italic;line-height:26px;text-align:center;">R</div>
          </td>
          <td style="vertical-align:top;">
            ${
              selo
                ? `<p style="margin:0 0 8px;"><span style="display:inline-block;padding:3px 10px;border:1.5px dashed ${LIME};border-radius:7px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:${MUTED};">${esc(selo)}</span></p>`
                : ""
            }
            <p style="margin:0;font-size:12px;line-height:1.55;color:${MUTED};">
              Realiza.vc &middot; Programa de Mentoria Social
              &middot; <a href="${esc(SITE_URL)}" style="color:${MUTED};text-decoration:underline;">${esc(SITE_URL.replace(/^https?:\/\//, ""))}</a>
              ${rodapeExtra ? `<br>${rodapeExtra}` : ""}
            </p>
          </td>
        </tr></table>
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
    selo: tema ? `Aviso · ${tema.texto}` : "Aviso",
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
    <td style="padding:16px 18px;border:1px solid ${BORDA};border-left:4px solid ${LIME};border-radius:10px;background:#fcfbf7;">
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
    selo: "Material novo",
    preheader: `Novo material: ${titulo}${descricao ? ` — ${descricao.slice(0, 80)}` : ""}`,
    rodapeExtra:
      "O material fica disponível na aba Materiais da plataforma — este e-mail é só o aviso de que ele chegou.",
  });
}
