import { describe, expect, it } from "vitest";
import { normLinkExterno } from "@/lib/ciclo";
import { demoCurriculoMap, demoPessoaPerfil } from "@/lib/demo/queries";
import { getDemoData } from "@/lib/demo/data";
import type { Mentorado } from "@/lib/types";

// O currículo (0081) é o documento mais confidencial da ficha do jovem —
// estes testes travam a fronteira por papel no espelho demo da view
// mentorados_curriculo: coord tudo, auxiliar executivo só as duplas dele,
// mentor/jovem nada.
const { mentorados } = getDemoData();
const idDe = (nome: string) =>
  mentorados.find((m) => m.nome.startsWith(nome))!.id;
const anaId = idDe("Ana Beatriz");
const caioId = idDe("Caio Henrique");
const dandaraId = idDe("Dandara");

describe("demoCurriculoMap — WHERE da mentorados_curriculo (0081)", () => {
  it("coordenação recebe os dois canais de todos os mentorados", () => {
    const mapa = demoCurriculoMap("coordenacao");
    expect(mapa.get(anaId)?.curriculo_url).toContain("drive.google.com");
    expect(mapa.get(caioId)?.curriculo_path).toBe(
      "documentos/curriculo-caio-henrique.pdf"
    );
    expect(mapa.get(dandaraId)?.curriculo_url).toContain("drive.google.com");
  });

  it("auxiliar executivo recebe só mentorados das duplas que supervisiona", () => {
    const mapa = demoCurriculoMap("supervisor");
    // Paulo supervisiona Ana e Caio
    expect(mapa.get(anaId)).toBeTruthy();
    expect(mapa.get(caioId)).toBeTruthy();
    // Dandara é supervisionada pela Beatriz — nem a linha chega
    expect(mapa.has(dandaraId)).toBe(false);
  });

  it("mentor e jovem recebem mapa vazio — nem a ficha do próprio par", () => {
    expect(demoCurriculoMap("mentor_dpp").size).toBe(0);
    expect(demoCurriculoMap("mentorado").size).toBe(0);
  });
});

describe("demoPessoaPerfil — currículo na ficha (0081)", () => {
  it("auxiliar executivo lê o currículo do mentorado que supervisiona", () => {
    const perfil = demoPessoaPerfil("supervisor", caioId);
    expect(perfil?.tipo).toBe("mentorado");
    expect((perfil?.pessoa as Mentorado).curriculo_path).toBe(
      "documentos/curriculo-caio-henrique.pdf"
    );
  });

  it("auxiliar executivo nem abre ficha de mentorado fora das duplas dele", () => {
    // espelho da RLS da 0023: a linha não volta → notFound na page
    expect(demoPessoaPerfil("supervisor", dandaraId)).toBeNull();
  });

  it("mentor abre a ficha do par mas o currículo vem zerado", () => {
    // Ricardo é mentor da Ana — a ficha abre, o confidencial não
    const perfil = demoPessoaPerfil("mentor_dpp", anaId);
    expect(perfil?.tipo).toBe("mentorado");
    const jovem = perfil?.pessoa as Mentorado;
    expect(jovem.curriculo_path ?? null).toBeNull();
    expect(jovem.curriculo_url ?? null).toBeNull();
  });

  it("coordenação lê o link do Drive de mentorado supervisionado por outro", () => {
    const perfil = demoPessoaPerfil("coordenacao", dandaraId);
    expect((perfil?.pessoa as Mentorado).curriculo_url).toContain(
      "drive.google.com"
    );
  });
});

describe("normLinkExterno — escrita do curriculo_url (0081)", () => {
  it("cola domínio sem scheme e ganha https://", () => {
    expect(normLinkExterno("drive.google.com/file/d/abc")).toBe(
      "https://drive.google.com/file/d/abc"
    );
  });

  it("URL http(s) passa intacta (com query)", () => {
    expect(normLinkExterno("https://drive.google.com/d/abc?usp=sharing")).toBe(
      "https://drive.google.com/d/abc?usp=sharing"
    );
    expect(normLinkExterno("http://a.co")).toBe("http://a.co");
  });

  it("recusa o que não vira URL http(s) com domínio", () => {
    expect(normLinkExterno("javascript:alert(1)")).toBeNull();
    expect(normLinkExterno("ftp://x.com/f")).toBeNull();
    expect(normLinkExterno("localhost:3000")).toBeNull();
    expect(normLinkExterno("texto qualquer")).toBeNull();
    expect(normLinkExterno("")).toBeNull();
    expect(normLinkExterno("   ")).toBeNull();
  });

  it("corta no teto de 300 chars", () => {
    const url = normLinkExterno("x.com/" + "y".repeat(400))!;
    expect(url).toHaveLength(300);
    expect(url).toMatch(/^https:\/\/x\.com\//);
  });
});
