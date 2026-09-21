// PDF placeholder do modo demo — serve os downloads de /api/material,
// /api/anexo e /api/documento sem sessão nem storage: uma página A4 válida
// (PDF 1.4, Helvetica/WinAnsi) com o título do documento e o aviso de que o
// oficial sai do bucket privado. Montado na mão pra ficar isomórfico e sem
// dependência — roda em route handler, server action ou node puro.

const enc = new TextEncoder();

// WinAnsiEncoding ≈ latin-1: ASCII e 0xA0–0xFF saem direto (todo acento do
// pt-BR mora aí); o intervalo 0x80–0x9F guarda pontuação tipográfica, mapeada
// aqui; qualquer outra coisa vira "?"
const WINANSI_EXTRA: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

/** Texto -> bytes de literal string PDF: WinAnsi + escape de `\()`, e
 *  caractere de controle vira espaço (o conteúdo aqui é de linha única). */
function pdfString(texto: string): Uint8Array {
  const bytes: number[] = [];
  for (const ch of texto) {
    const cp = ch.codePointAt(0)!;
    const b =
      cp < 0x80 || (cp >= 0xa0 && cp <= 0xff) ? cp : (WINANSI_EXTRA[cp] ?? 0x3f);
    if (b === 0x28 || b === 0x29 || b === 0x5c) bytes.push(0x5c, b);
    else if (b < 0x20) bytes.push(0x20);
    else bytes.push(b);
  }
  return new Uint8Array(bytes);
}

/** Junta pedaços: strings são ASCII/UTF-8 do operador, Uint8Array vem pronto. */
function bytes(...partes: (string | Uint8Array)[]): Uint8Array {
  const segs = partes.map((p) => (typeof p === "string" ? enc.encode(p) : p));
  const out = new Uint8Array(segs.reduce((n, s) => n + s.length, 0));
  let o = 0;
  for (const s of segs) {
    out.set(s, o);
    o += s.length;
  }
  return out;
}

/** Quebra por palavra — sem métrica de fonte real, maxChars conservador pela
 *  largura média do Helvetica (~0.5em) pra não estourar a margem. */
function quebra(texto: string, maxChars: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    const cand = atual ? `${atual} ${palavra}` : palavra;
    if (atual && cand.length > maxChars) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = cand;
    }
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [" "];
}

/** Bloco de texto: BT/Td posiciona a 1ª linha, cada T* desce `leading` pt. */
function bloco(
  fonte: "F1" | "F2",
  tam: number,
  leading: number,
  x: number,
  y: number,
  linhas: string[]
): (string | Uint8Array)[] {
  const ops: (string | Uint8Array)[] = [
    `BT /${fonte} ${tam} Tf ${leading} TL ${x} ${y} Td `,
  ];
  linhas.forEach((linha, i) => {
    if (i) ops.push("T* ");
    ops.push("(", pdfString(linha), ") Tj ");
  });
  ops.push("ET\n");
  return ops;
}

/** PDF de uma página pros downloads da demo — o documento oficial mora no
 *  storage; aqui sai um placeholder válido com título, subtítulo e aviso. */
export function demoPdf(
  titulo: string,
  subtitulo = "Documento de demonstração — conteúdo fictício gerado pela plataforma."
): Uint8Array {
  // A4 = 595.28 x 841.89 pt, margem de ~2cm; T* desce `leading`, então o y do
  // subtítulo depende de quantas linhas o título ocupou
  const tituloLinhas = quebra(titulo, 46);
  const subLinhas = quebra(subtitulo, 80);
  const rodape = quebra(
    "Este arquivo é um placeholder do modo demo — o documento oficial é servido via storage.",
    95
  );

  const conteudo = bytes(
    "q\n",
    "0.4 g\n",
    ...bloco("F1", 9, 12, 56, 802, ["Realiza.vc — demonstração"]),
    "0.75 G 0.75 w 56 790 m 539.28 790 l S\n",
    "0 g\n",
    ...bloco("F2", 18, 23, 56, 748, tituloLinhas),
    "0.3 g\n",
    ...bloco("F1", 11, 15, 56, 738 - 23 * tituloLinhas.length, subLinhas),
    "0.45 g\n",
    ...bloco("F1", 8.5, 11, 56, 76, rodape),
    "Q\n"
  );

  // objetos na ordem em que saem no arquivo — offsets do xref são medidos
  // byte a byte abaixo, então qualquer mudança aqui continua correta
  const objetos: (string | Uint8Array)[][] = [
    ["<< /Type /Catalog /Pages 2 0 R >>"],
    ["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"],
    [
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] " +
        "/Resources << /ProcSet [/PDF /Text] /Font << /F1 4 0 R /F2 5 0 R >> >> " +
        "/Contents 6 0 R >>",
    ],
    [
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica " +
        "/Encoding /WinAnsiEncoding >>",
    ],
    [
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold " +
        "/Encoding /WinAnsiEncoding >>",
    ],
    [`<< /Length ${conteudo.length} >>\nstream\n`, conteudo, "\nendstream"],
  ];

  const partes: (string | Uint8Array)[] = [];
  let pos = 0;
  const push = (p: string | Uint8Array) => {
    partes.push(p);
    pos += typeof p === "string" ? enc.encode(p).length : p.length;
  };

  push("%PDF-1.4\n");
  // bytes altos depois do % marcam o arquivo como binário pros transportes
  push("% placeholder do modo demo — gerado sem storage\n");

  const offsets: number[] = [];
  objetos.forEach((corpo, i) => {
    offsets.push(pos);
    push(`${i + 1} 0 obj\n`);
    for (const p of corpo) push(p);
    push("\nendobj\n");
  });

  // xref com os offsets reais de cada objeto — o leitor acha o trailer por ele
  const xrefPos = pos;
  push(`xref\n0 ${objetos.length + 1}\n`);
  push("0000000000 65535 f \n");
  for (const off of offsets) {
    push(`${String(off).padStart(10, "0")} 00000 n \n`);
  }
  push(
    `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\n` +
      `startxref\n${xrefPos}\n%%EOF\n`
  );

  return bytes(...partes);
}
