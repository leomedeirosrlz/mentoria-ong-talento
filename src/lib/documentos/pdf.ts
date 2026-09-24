// Renderer do PDF assinado (0033) — pdf-lib + StandardFonts (WinAnsi), sem
// embed de fonte custom. O corpo vem de texto.ts, a MESMA fonte do preview
// na tela: o PDF documenta exatamente o que a pessoa leu ao assinar.
//
// Layout fiel ao docx oficial (docs/fontes/termo-adesao-voluntario.txt):
// título centrado, preâmbulo, cláusulas com recuo, data por extenso, blocos
// de assinatura (nome digitado em itálico sobre a linha; contra-assinatura
// do presidente como PNG quando existe), Anexo I em página própria e, por
// último, o registro de evidências do ato eletrônico.

import { PageSizes, PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFImage, PDFPage, RGB } from "pdf-lib";
import type { AssinaturaVia, DadosAutorizacao, DadosCivis } from "../types";
import {
  ANEXO_I_PARAGRAFOS,
  ANEXO_I_TITULO,
  AUTORIZACAO_TITULO,
  CLAUSULAS_AUTORIZACAO,
  CLAUSULAS_MENTORANDO,
  CLAUSULAS_TERMO,
  CONTRA_SIGNATARIO,
  dadosAutorizacaoDe,
  dadosCivisDe,
  dataPorExtenso,
  FECHO_AUTORIZACAO,
  FECHO_MENTORANDO,
  FECHO_TERMO,
  MENTORANDO_TITULO,
  preambuloAutorizacao,
  preambuloMentorando,
  preambuloTermo,
  TERMO_TITULO,
} from "./texto";

// ---------- geometria ----------

const [PAGE_W, PAGE_H] = PageSizes.A4; // 595.28 x 841.89
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = MARGIN + 8; // folga acima do rodapé
const LINHA_W = 250; // largura da linha de assinatura

const PRETO = rgb(0, 0, 0);
const CINZA = rgb(0.35, 0.35, 0.35);
const CINZA_CLARO = rgb(0.78, 0.78, 0.78);

// ---------- WinAnsi ----------
// StandardFonts usa WinAnsiEncoding ≈ latin-1 + pontuação tipográfica em
// 0x80–0x9F (mesmo mapa do demo/pdf.ts). Caractere fora dele (emoji, hífen
// não-quebrável) derruba o drawText — então TUDO passa por sanitize(). As
// aspas “ ” e o º/ª do texto oficial moram em WinAnsi e saem intactos.
const WINANSI_EXTRA: Record<number, true> = {
  0x20ac: true, 0x201a: true, 0x0192: true, 0x201e: true, 0x2026: true,
  0x2020: true, 0x2021: true, 0x02c6: true, 0x2030: true, 0x0160: true,
  0x2039: true, 0x0152: true, 0x017d: true, 0x2018: true, 0x2019: true,
  0x201c: true, 0x201d: true, 0x2022: true, 0x2013: true, 0x2014: true,
  0x02dc: true, 0x2122: true, 0x0161: true, 0x203a: true, 0x0153: true,
  0x017e: true, 0x0178: true,
};

// fora do WinAnsi mas com substituto óbvio melhor que espaço
const SUBSTITUICOES: Record<number, string> = {
  0x2011: "-", // hífen não-quebrável
  0x2012: "-", // figure dash
  0x2015: "—", // horizontal bar
  0x2028: " ", // line separator
  0x2029: " ", // paragraph separator
  0x202f: " ", // narrow no-break space
  0x200b: "", // zero-width space
  0x200e: "", // LTR mark
  0x200f: "", // RTL mark
  0xfeff: "", // BOM
};

const ehWinAnsi = (cp: number) =>
  cp < 0x80 || (cp >= 0xa0 && cp <= 0xff) || WINANSI_EXTRA[cp] === true;

const COMBINING = /\p{M}/u;

/** Texto -> algo que StandardFonts consegue desenhar: NFC primeiro (compõe
 *  acentos pro latin-1), WinAnsi passa direto, fora do repertório tenta a
 *  decomposição NFKD sem marcas (Š→S, ﬁ→fi); se nada couber, vira espaço. */
function sanitize(texto: string): string {
  let out = "";
  for (const ch of texto.normalize("NFC")) {
    const cp = ch.codePointAt(0)!;
    if (ehWinAnsi(cp)) {
      out += ch;
      continue;
    }
    const sub: string | undefined = SUBSTITUICOES[cp];
    if (sub !== undefined) {
      out += sub;
      continue;
    }
    let decomp = "";
    for (const d of ch.normalize("NFKD")) {
      const dp = d.codePointAt(0)!;
      if (!COMBINING.test(d) && ehWinAnsi(dp)) decomp += d;
    }
    out += decomp || " ";
  }
  return out;
}

// ---------- fluxo de página ----------

type Fontes = { regular: PDFFont; bold: PDFFont; italic: PDFFont };

type OptsParagrafo = {
  font?: PDFFont;
  size?: number;
  /** recuo do bloco inteiro (cláusulas numeradas, como no docx) */
  indent?: number;
  /** espaço antes/depois do parágrafo */
  antes?: number;
  depois?: number;
  centro?: boolean;
  color?: RGB;
};

/** Cursor de escrita: `y` é a baseline da próxima linha. nova() abre página
 *  com o cabeçalho; ensure() garante `h` pontos ou quebra antes. */
class Fluxo {
  page!: PDFPage;
  y = 0;

  constructor(
    private doc: PDFDocument,
    readonly f: Fontes // os helpers do módulo medem texto com estas fontes
  ) {
    this.nova();
  }

  nova() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.page.drawText("Realiza.vc — Programa de Mentoria", {
      x: MARGIN,
      y: PAGE_H - 40,
      size: 8,
      font: this.f.regular,
      color: CINZA,
    });
    this.page.drawLine({
      start: { x: MARGIN, y: PAGE_H - 46 },
      end: { x: PAGE_W - MARGIN, y: PAGE_H - 46 },
      thickness: 0.5,
      color: CINZA_CLARO,
    });
    this.y = PAGE_H - 66;
  }

  ensure(h: number) {
    if (this.y - h < BOTTOM) this.nova();
  }

  paragrafo(s: string, o: OptsParagrafo = {}) {
    const font = o.font ?? this.f.regular;
    const size = o.size ?? 11;
    const leading = size * 1.4;
    const indent = o.indent ?? 0;
    this.y -= o.antes ?? 0;
    for (const linha of wrapText(s, font, size, CONTENT_W - indent)) {
      this.ensure(leading);
      const x = o.centro
        ? MARGIN +
          Math.max(0, (CONTENT_W - font.widthOfTextAtSize(linha, size)) / 2)
        : MARGIN + indent;
      this.page.drawText(linha, {
        x,
        y: this.y,
        size,
        font,
        color: o.color ?? PRETO,
      });
      this.y -= leading;
    }
    this.y -= o.depois ?? 0;
  }
}

/** pdf-lib não quebra linha: quebra por palavra medindo com a fonte real;
 *  token maior que a linha (hash, user-agent) sofre quebra dura por char. */
function wrapText(
  texto: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const linhas: string[] = [];
  let atual = "";
  const flush = () => {
    if (atual) {
      linhas.push(atual);
      atual = "";
    }
  };
  for (const palavra of sanitize(texto).split(/\s+/).filter(Boolean)) {
    if (font.widthOfTextAtSize(palavra, size) > maxWidth) {
      flush();
      let pedaco = "";
      for (const ch of palavra) {
        if (pedaco && font.widthOfTextAtSize(pedaco + ch, size) > maxWidth) {
          linhas.push(pedaco);
          pedaco = ch;
        } else {
          pedaco += ch;
        }
      }
      atual = pedaco;
      continue;
    }
    const cand = atual ? `${atual} ${palavra}` : palavra;
    if (atual && font.widthOfTextAtSize(cand, size) > maxWidth) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = cand;
    }
  }
  flush();
  return linhas;
}

// ---------- data/hora ----------

const TZ_SP = "America/Sao_Paulo";

/** "07/08/2024 14:32" — sempre no fuso de São Paulo, não no do servidor. */
function dataHoraFmt(iso: string): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ_SP,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const v = (t: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === t)?.value ?? "";
  return `${v("day")}/${v("month")}/${v("year")} ${v("hour")}:${v("minute")}`;
}

// ---------- blocos de assinatura ----------

type BlocoCfg = {
  /** nome digitado, em itálico pousado sobre a linha (assinatura textual) */
  nomeDigitado?: string;
  /** PNG sobre a linha (contra-assinatura do presidente) */
  imagem?: PDFImage | null;
  /** linhas de legenda abaixo da linha */
  legenda: string[];
  legendaSize?: number;
  legendaColor?: RGB;
};

/** Um bloco linha+assinatura, mantido inteiro na página (nunca parte a
 *  linha das legendas). Alinhado à margem esquerda, como no docx. */
function blocoAssinatura(p: Fluxo, cfg: BlocoCfg) {
  const legSize = cfg.legendaSize ?? 8;
  const legLeading = legSize + 4;

  // PNG: max 150x46, sem upscale (assinatura escaneada vem grande; uma
  // imagem pequena não é esticada)
  let imgW = 0;
  let imgH = 0;
  if (cfg.imagem) {
    const s = Math.min(150 / cfg.imagem.width, 46 / cfg.imagem.height, 1);
    imgW = cfg.imagem.width * s;
    imgH = cfg.imagem.height * s;
  }

  const acima = cfg.nomeDigitado ? 18 : cfg.imagem ? imgH + 2 : 12;
  const abaixo = cfg.legenda.length * legLeading + 2;
  p.ensure(acima + 4 + abaixo + 22);

  const x = MARGIN;
  const lineY = p.y - acima;

  if (cfg.nomeDigitado) {
    // a assinatura encolhe até caber na linha (assinatura_texto pode ter
    // 120 chars)
    const t = sanitize(cfg.nomeDigitado);
    let size = 12;
    while (size > 6 && p.f.italic.widthOfTextAtSize(t, size) > LINHA_W - 8) {
      size -= 0.5;
    }
    const w = p.f.italic.widthOfTextAtSize(t, size);
    p.page.drawText(t, {
      x: x + Math.max(0, (LINHA_W - w) / 2),
      y: lineY + 5,
      size,
      font: p.f.italic,
      color: PRETO,
    });
  }
  if (cfg.imagem) {
    p.page.drawImage(cfg.imagem, {
      x: x + (LINHA_W - imgW) / 2,
      y: lineY - 3, // a base da imagem pousa sobre a linha
      width: imgW,
      height: imgH,
    });
  }
  p.page.drawLine({
    start: { x, y: lineY },
    end: { x: x + LINHA_W, y: lineY },
    thickness: 0.8,
    color: PRETO,
  });

  let yy = lineY - 14;
  for (const l of cfg.legenda) {
    p.page.drawText(sanitize(l), {
      x,
      y: yy,
      size: legSize,
      font: p.f.regular,
      color: cfg.legendaColor ?? CINZA,
    });
    yy -= legLeading;
  }
  p.y = yy - 20;
}

// ---------- corpo dos documentos ----------

function corpoClausulas(
  p: Fluxo,
  clausulas: readonly (readonly [string, string[]])[]
) {
  for (const [titulo, pars] of clausulas) {
    p.ensure(64); // título de cláusula nunca fica órfão no fim da página
    p.paragrafo(titulo, { font: p.f.bold, size: 11, depois: 6 });
    for (const par of pars) {
      p.paragrafo(par, { size: 11, indent: 20, depois: 7 });
    }
    p.y -= 4;
  }
}

function renderTermo(
  p: Fluxo,
  dados: DadosCivis,
  texto: string,
  em: string,
  contraAssinatura: PDFImage | null
) {
  p.paragrafo(TERMO_TITULO, {
    font: p.f.bold,
    size: 13,
    centro: true,
    depois: 18,
  });
  for (const par of preambuloTermo(dados)) {
    p.paragrafo(par, { size: 11, depois: 10 });
  }
  corpoClausulas(p, CLAUSULAS_TERMO);

  p.paragrafo(FECHO_TERMO, { size: 11, antes: 4, depois: 16 });
  p.paragrafo(dataPorExtenso(em), { size: 11, depois: 30 });

  blocoAssinatura(p, {
    nomeDigitado: texto,
    legenda: [`VOLUNTÁRIO(A) — assinado eletronicamente em ${dataHoraFmt(em)}`],
  });
  blocoAssinatura(p, {
    imagem: contraAssinatura,
    legenda: [
      CONTRA_SIGNATARIO.nome,
      CONTRA_SIGNATARIO.instituicao,
      CONTRA_SIGNATARIO.cargo,
    ],
    legendaSize: 10.5,
    legendaColor: PRETO,
  });

  // Anexo I abre em página própria, como no docx
  p.nova();
  p.paragrafo(ANEXO_I_TITULO, { font: p.f.bold, size: 12, depois: 10 });
  for (const par of ANEXO_I_PARAGRAFOS) {
    p.paragrafo(par, { size: 10.5, depois: 7 });
  }
}

function renderAutorizacao(
  p: Fluxo,
  dados: DadosAutorizacao,
  texto: string,
  em: string
) {
  p.paragrafo(AUTORIZACAO_TITULO, {
    font: p.f.bold,
    size: 13,
    centro: true,
    depois: 18,
  });
  for (const par of preambuloAutorizacao(dados)) {
    p.paragrafo(par, { size: 11, depois: 10 });
  }
  corpoClausulas(p, CLAUSULAS_AUTORIZACAO);

  p.paragrafo(FECHO_AUTORIZACAO, { size: 11, antes: 4, depois: 16 });
  p.paragrafo(dataPorExtenso(em), { size: 11, depois: 30 });

  blocoAssinatura(p, {
    nomeDigitado: texto,
    legenda: [`RESPONSÁVEL — assinado eletronicamente em ${dataHoraFmt(em)}`],
  });
}

/** Termo do jovem (0046): mesmo esqueleto do termo do voluntário — dois
 *  blocos de assinatura (mentorando eletrônico + instituto com a
 *  contra-assinatura), sem Anexo de lei. */
function renderMentorando(
  p: Fluxo,
  dados: DadosCivis,
  texto: string,
  em: string,
  contraAssinatura: PDFImage | null
) {
  p.paragrafo(MENTORANDO_TITULO, {
    font: p.f.bold,
    size: 13,
    centro: true,
    depois: 18,
  });
  for (const par of preambuloMentorando(dados)) {
    p.paragrafo(par, { size: 11, depois: 10 });
  }
  corpoClausulas(p, CLAUSULAS_MENTORANDO);

  p.paragrafo(FECHO_MENTORANDO, { size: 11, antes: 4, depois: 16 });
  p.paragrafo(dataPorExtenso(em), { size: 11, depois: 30 });

  blocoAssinatura(p, {
    nomeDigitado: texto,
    legenda: [
      "MENTORANDO(A) — Nome completo e assinatura",
      `assinado eletronicamente em ${dataHoraFmt(em)}`,
    ],
  });
  blocoAssinatura(p, {
    imagem: contraAssinatura,
    legenda: ["INSTITUTO REALIZA.VC", "Representante legal"],
    legendaSize: 10.5,
    legendaColor: PRETO,
  });
}

// ---------- página de evidências ----------

function paginaEvidencias(
  p: Fluxo,
  a: AssinaturaVia,
  tpl: NonNullable<AssinaturaVia["template"]>,
  texto: string,
  em: string
) {
  p.nova();
  p.paragrafo("REGISTRO DE ASSINATURA ELETRÔNICA", {
    font: p.f.bold,
    size: 12.5,
    centro: true,
    depois: 6,
  });
  p.paragrafo(
    "Evidências capturadas pela plataforma no ato da assinatura eletrônica.",
    { size: 8.5, centro: true, color: CINZA, depois: 20 }
  );

  // o método vem do signatário declarado no template — mentorado assina
  // pelo link tokenizado (não tem conta), profile assina logado. O
  // mentorado_id não sai do banco na via pública (0053), então a decisão
  // não pode mais depender da row
  const metodo =
    tpl.signatario === "mentorado"
      ? "link de assinatura tokenizado (enviado por e-mail/WhatsApp)"
      : "sessão autenticada (magic link)";

  const linhas: [string, string][] = [
    ["Documento", `${tpl.titulo} — versão ${tpl.versao}`],
    ["ID da assinatura", a.id],
    ["Signatário", texto],
    ["Data/hora", `${em} (${dataHoraFmt(em)}, horário de São Paulo)`],
    ["IP", a.ip ?? "não registrado"],
    ["User-Agent", a.user_agent ?? "não registrado"],
    ["Hash SHA-256", a.hash_documento ?? "não registrado"],
    ["Método", metodo],
  ];

  const LABEL_W = 116;
  const valX = MARGIN + LABEL_W + 12;
  const valW = CONTENT_W - LABEL_W - 12;
  const size = 9;
  const leading = 12;

  const traco = (y: number) =>
    p.page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 0.4,
      color: CINZA_CLARO,
    });

  traco(p.y + 4);
  for (const [label, valor] of linhas) {
    const vs = wrapText(valor, p.f.regular, size, valW);
    const rowH = vs.length * leading + 12;
    p.ensure(rowH + 6);
    const top = p.y;
    p.page.drawText(sanitize(label), {
      x: MARGIN,
      y: top - 11,
      size,
      font: p.f.bold,
      color: PRETO,
    });
    vs.forEach((v, i) =>
      p.page.drawText(v, {
        x: valX,
        y: top - 11 - i * leading,
        size,
        font: p.f.regular,
        color: PRETO,
      })
    );
    traco(top - rowH);
    p.y = top - rowH;
  }
}

// ---------- entrada ----------

/** Renderiza o PDF final de uma assinatura concluída. `contraAssinaturaPng`
 *  é a assinatura manuscrita do presidente (só o termo usa); null desenha
 *  só a linha. Lança Error em status errado/snapshot ausente — a rota trata. */
export async function renderDocumentoAssinado(
  a: AssinaturaVia,
  contraAssinaturaPng: Uint8Array | null
): Promise<Uint8Array> {
  if (a.status !== "assinado") {
    throw new Error("assinatura não está concluída");
  }
  const tpl = a.template;
  if (!tpl) {
    throw new Error("assinatura sem template");
  }
  if (
    tpl.slug !== "termo-voluntario" &&
    tpl.slug !== "autorizacao-responsavel" &&
    tpl.slug !== "termo-mentorando"
  ) {
    throw new Error("template desconhecido");
  }
  const em = a.assinado_em;
  const texto = a.assinatura_texto;
  if (!em || !texto || !a.dados_snapshot) {
    throw new Error("assinatura incompleta (sem data, nome ou dados)");
  }

  const doc = await PDFDocument.create();
  const f: Fontes = {
    regular: await doc.embedFont(StandardFonts.TimesRoman),
    bold: await doc.embedFont(StandardFonts.TimesRomanBold),
    italic: await doc.embedFont(StandardFonts.TimesRomanItalic),
  };
  const p = new Fluxo(doc, f);

  if (tpl.slug === "termo-voluntario" || tpl.slug === "termo-mentorando") {
    const dados = dadosCivisDe(a);
    if (!dados) throw new Error("snapshot não corresponde ao termo");
    const img = contraAssinaturaPng
      ? await doc.embedPng(contraAssinaturaPng)
      : null;
    if (tpl.slug === "termo-voluntario") {
      renderTermo(p, dados, texto, em, img);
    } else {
      renderMentorando(p, dados, texto, em, img);
    }
  } else {
    const dados = dadosAutorizacaoDe(a);
    if (!dados) throw new Error("snapshot não corresponde à autorização");
    renderAutorizacao(p, dados, texto, em);
  }

  paginaEvidencias(p, a, tpl, texto, em);

  // numeração discreta no rodapé de todas as páginas
  const pages = doc.getPages();
  pages.forEach((pg, i) => {
    const t = `${i + 1} / ${pages.length}`;
    pg.drawText(t, {
      x: PAGE_W - MARGIN - f.regular.widthOfTextAtSize(t, 7.5),
      y: 30,
      size: 7.5,
      font: f.regular,
      color: CINZA,
    });
  });

  doc.setTitle(tpl.titulo);
  doc.setAuthor(texto);
  doc.setCreator("Realiza.vc — Programa de Mentoria");
  doc.setProducer("Realiza.vc");
  doc.setCreationDate(new Date(em));

  return doc.save();
}
