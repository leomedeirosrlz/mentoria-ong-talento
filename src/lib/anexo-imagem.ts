/** Compressão client-side da evidência de imagem (REALIZA-66): foto de
 *  câmera moderna chega com 3–8 MB e o plano do Supabase cobra pelo
 *  storage — reencodar em WebP ~200 KB mantém a legibilidade e segura a
 *  cota. PDF e imagem já pequena passam intactos; decode/canvas falho
 *  devolve o arquivo original (a recusa de tamanho/formato já rodou antes
 *  e o bucket limita por cima). */

const ALVO_BYTES = 200 * 1024;
const LADO_MAX = 2048;
const QUALIDADES = [0.82, 0.68, 0.54, 0.42, 0.32];
const RODADAS = 4;

/** Devolve o File pronto pra subir: imagem grande vira WebP ~200 KB,
 *  qualquer outro caso devolve o próprio arquivo. */
export async function prepararArquivoAnexo(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= ALVO_BYTES) {
    return file;
  }
  if (
    typeof createImageBitmap !== "function" ||
    typeof document === "undefined"
  ) {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    try {
      let largura = bitmap.width;
      let altura = bitmap.height;
      const escala = Math.min(1, LADO_MAX / Math.max(largura, altura));
      largura = Math.max(1, Math.round(largura * escala));
      altura = Math.max(1, Math.round(altura * escala));

      // escada qualidade → dimensão: tenta cada JPEG-quality na proporção
      // atual; sem atingir o alvo, encolhe 30% e repete
      let melhor: Blob | null = null;
      let pronto = false;
      for (let rodada = 0; rodada < RODADAS && !pronto; rodada++) {
        for (const qualidade of QUALIDADES) {
          const blob = await rasteriza(bitmap, largura, altura, qualidade);
          if (!blob) {
            pronto = true;
            break;
          }
          if (!melhor || blob.size < melhor.size) melhor = blob;
          if (blob.size <= ALVO_BYTES) {
            pronto = true;
            break;
          }
        }
        largura = Math.max(1, Math.round(largura * 0.7));
        altura = Math.max(1, Math.round(altura * 0.7));
      }

      // original só sai vencedor se nenhuma reencodar menor que ele
      if (!melhor || melhor.size >= file.size) return file;
      const base = file.name.replace(/\.[^.]+$/, "") || "foto";
      return new File([melhor], `${base}.webp`, { type: "image/webp" });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}

function rasteriza(
  bitmap: ImageBitmap,
  largura: number,
  altura: number,
  qualidade: number
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  return new Promise((resolve) =>
    canvas.toBlob(resolve, "image/webp", qualidade)
  );
}
