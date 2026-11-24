import { describe, expect, it } from "vitest";
import {
  privacidadeAvaliacao,
  privacidadeAvaliacoes,
} from "@/lib/avaliacao-privacidade";

// 027 (FR-003) — a copy de privacidade não promete "só na média" quando o
// lote da RPC avaliacao_media_dpp ainda não existe (<3 respostas na dupla).
// Honesta nos dois lados: com média promete a média, sem média diz quando
// ela aparece.

describe("privacidadeAvaliacao — os dois lados do lote", () => {
  it("dpp com lote (≥3): promete a média como sempre", () => {
    const txt = privacidadeAvaliacao("dpp", true);
    expect(txt).toContain("só a média das notas");
    expect(txt).not.toContain("a partir de 3");
  });

  it("dpp sem lote (<3): não promete média que não existe", () => {
    const txt = privacidadeAvaliacao("dpp", false);
    expect(txt).not.toContain("só a média das notas");
    expect(txt).toContain("a partir de 3 avaliações");
    expect(txt).toContain("só lê uma resposta se você liberar");
  });

  it("especialista ignora o lote — o recorte dela não tem média", () => {
    expect(privacidadeAvaliacao("especialista", false)).toBe(
      privacidadeAvaliacao("especialista", true)
    );
    expect(privacidadeAvaliacao("especialista", false)).toContain(
      "veem só a nota desta sessão"
    );
  });

  it("default é otimista (tem média) — call site que conhece a conta passa o real", () => {
    expect(privacidadeAvaliacao("dpp")).toBe(privacidadeAvaliacao("dpp", true));
  });
});

describe("privacidadeAvaliacoes — frase única da lista", () => {
  it("duas trilhas sem média: a versão combinada também é honesta", () => {
    const txt = privacidadeAvaliacoes(["dpp", "especialista"], false);
    expect(txt).toContain("a partir de 3 avaliações");
    expect(txt).toContain("veem só a nota da sessão");
  });

  it("uma trilha só segue a variante dela", () => {
    expect(privacidadeAvaliacoes(["dpp"], false)).toBe(
      privacidadeAvaliacao("dpp", false)
    );
  });
});
