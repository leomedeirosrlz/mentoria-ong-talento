import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ARTES_REGISTRADAS, arteDoGlifo } from "./badges";

// O registro glifo → ilustração aponta pra arquivo que existe, e todo
// arquivo gerado tem dono no registro (desenho órfão não vai pra estante).

const PUBLIC = join(__dirname, "../../public");

describe("ilustrações das conquistas", () => {
  it("todo caminho registrado existe em public/badges", () => {
    for (const p of ARTES_REGISTRADAS)
      expect(existsSync(join(PUBLIC, p)), p).toBe(true);
  });

  it("todo arquivo em public/badges está no registro", () => {
    const arquivos = readdirSync(join(PUBLIC, "badges"))
      .filter((f) => f.endsWith(".svg"))
      .map((f) => `/badges/${f}`);
    expect([...arquivos].sort()).toEqual([...ARTES_REGISTRADAS].sort());
  });

  it("os arquivos são locais e estáticos: sem script, sem recurso externo, com tamanho intrínseco", () => {
    for (const p of ARTES_REGISTRADAS) {
      const svg = readFileSync(join(PUBLIC, p), "utf8");
      expect(svg, p).not.toMatch(/<script|<animate|@keyframes|https?:\/\/(?!www\.w3\.org)/);
      expect(svg, p).toMatch(/width="500" height="500"/);
    }
  });

  it("marco completo e a faixa Jornada completa são a mesma peça", () => {
    expect(arteDoGlifo({ tipo: "phosphor", nome: "trophy" })).toBe(
      arteDoGlifo({ tipo: "nivel", chave: "completa" })
    );
  });

  it("glifo sem desenho devolve null (o emblema squircle assume)", () => {
    expect(
      arteDoGlifo({ tipo: "instrumento", chave: "nao_existe" as never })
    ).toBeNull();
  });
});
