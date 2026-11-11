import { describe, expect, it } from "vitest";
import { prepararArquivoAnexo } from "./anexo-imagem";

// node não tem createImageBitmap/canvas — os casos de pass-through e o
// fallback de imagem grande são exatamente o que roda aqui; a compressão
// em si só existe no browser.
describe("prepararArquivoAnexo — o que não é foto grande passa intacto", () => {
  it("PDF devolve o próprio arquivo", async () => {
    const pdf = new File([new Uint8Array(9 * 1024 * 1024)], "plano.pdf", {
      type: "application/pdf",
    });
    expect(await prepararArquivoAnexo(pdf)).toBe(pdf);
  });

  it("imagem já pequena não reencoda", async () => {
    const png = new File([new Uint8Array(120 * 1024)], "print.png", {
      type: "image/png",
    });
    expect(await prepararArquivoAnexo(png)).toBe(png);
  });

  it("sem canvas (node/browser antigo) a imagem grande sobe original", async () => {
    const jpg = new File([new Uint8Array(6 * 1024 * 1024)], "foto.jpg", {
      type: "image/jpeg",
    });
    expect(await prepararArquivoAnexo(jpg)).toBe(jpg);
  });
});
