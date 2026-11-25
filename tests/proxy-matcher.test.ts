// O matcher do proxy (src/proxy.ts) é um regex com 6 negações: ninguém
// revisa isso à mão. "Simplificar" para `/((?!_next).*)` faz o tunnel do
// Sentry (/monitoring), as metadatas geradas (opengraph-image, sitemap) e
// os assets receberem 307 pro /login — crawler vê redirect, preview de
// WhatsApp quebra, e o Sentry do browser morre. Este spec compara o matcher
// versionado contra os dois conjuntos esperados, sem importar nada do Next.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const fonte = readFileSync(path.join(process.cwd(), "src", "proxy.ts"), "utf8");

const blocoMatcher = /matcher:\s*\[([\s\S]*?)\]/.exec(fonte);
const literais = [...(blocoMatcher?.[1] ?? "").matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(
  (m) => JSON.parse(`"${m[1]}"`) as string
);

describe("matcher do proxy — metadata e tunnel passam direto", () => {
  it("é uma única entrada de matcher", () => {
    expect(literais.length, "matcher ganhou/perdeu entradas — atualize este spec de propósito").toBe(1);
  });

  // o Next ancora o matcher no início do path (path-to-regexp) — sem o ^,
  // o motor recomeça em qualquer "/" no meio da URL e o teste mente
  const re = new RegExp(`^${literais[0] ?? "a^"}`);

  it("rotas de app passam pelo proxy", () => {
    for (const rota of ["/", "/login", "/duplas/abc", "/f/tok", "/api/mcp", "/jovem"]) {
      expect(rota).toMatch(re);
    }
  });

  it("assets, metadata, tunnel e imagens ficam fora", () => {
    const fora = [
      "/_next/static/chunk.js",
      "/_next/image?url=x",
      "/favicon.ico",
      "/manifest.webmanifest",
      "/robots.txt",
      "/sitemap.xml",
      "/llms.txt",
      "/monitoring",
      "/monitoring/envelope",
      "/opengraph-image",
      "/f/tok/opengraph-image",
      "/logo.svg",
      "/foto.png",
      "/banner.jpg",
      "/icone.jpeg",
      "/anim.gif",
      "/pesada.webp",
      "/arquivo.txt",
    ];
    const invadidos = fora.filter((rota) => re.test(rota));
    expect(invadidos, "o proxy passou a capturar o que devia passar direto").toEqual([]);
  });
});
