import { describe, expect, it } from "vitest";
import {
  MOTIVOS_REMANEJO,
  motivoRemanejo,
  resumoRemanejo,
} from "@/lib/ciclo";

// Regras puras do remanejamento de dupla (0063/0064): o texto que vai pra
// nota de saída em pessoa_notas e o "antes → depois" que o dialog mostra
// ANTES de confirmar (a troca não tem desfazer).

describe("motivoRemanejo", () => {
  it("categoria conhecida sem detalhe vira só o rótulo", () => {
    expect(motivoRemanejo("desistencia", "")).toBe("Desistência");
    expect(motivoRemanejo("realinhamento", "   ")).toBe(
      "Realinhamento do programa"
    );
  });

  it("categoria + detalhe compõe 'Rótulo — detalhe'", () => {
    expect(motivoRemanejo("remanejo", "assumiu outra dupla")).toBe(
      "Remanejo pra outra dupla — assumiu outra dupla"
    );
  });

  it("'outro' exige o texto livre — categoria vazia não diz nada", () => {
    expect(motivoRemanejo("outro", "")).toBeNull();
    expect(motivoRemanejo("outro", "   ")).toBeNull();
    expect(motivoRemanejo("outro", "mudou de cidade")).toBe("mudou de cidade");
  });

  it("categoria desconhecida cai no texto livre (ou null se vazio)", () => {
    expect(motivoRemanejo("qualquer", "pedido da família")).toBe(
      "pedido da família"
    );
    expect(motivoRemanejo("qualquer", "")).toBeNull();
    expect(motivoRemanejo("", "")).toBeNull();
  });

  it("apara espaços do detalhe antes de gravar", () => {
    expect(motivoRemanejo("desistencia", "  saiu do programa  ")).toBe(
      "Desistência — saiu do programa"
    );
  });

  it("cobre todo o vocabulário do select", () => {
    for (const m of MOTIVOS_REMANEJO) {
      expect(motivoRemanejo(m.value, "x")).not.toBeNull();
    }
  });
});

describe("resumoRemanejo", () => {
  const nomes = { mentor: "Crislayne", mentorado: "Rafaela" };

  it("troca do mentor: o mentorado fica, o nome novo entra na ponta dele", () => {
    expect(resumoRemanejo(nomes, "mentor", "Eduarda")).toEqual({
      antes: "Crislayne + Rafaela",
      depois: "Eduarda + Rafaela",
    });
  });

  it("troca do mentorado: o mentor fica", () => {
    expect(resumoRemanejo(nomes, "mentorado", "Eduarda")).toEqual({
      antes: "Crislayne + Rafaela",
      depois: "Crislayne + Eduarda",
    });
  });

  it("sem novo membro escolhido devolve null — o dialog não mostra resumo", () => {
    expect(resumoRemanejo(nomes, "mentor", null)).toBeNull();
    expect(resumoRemanejo(nomes, "mentorado", undefined)).toBeNull();
    expect(resumoRemanejo(nomes, "mentor", "")).toBeNull();
  });
});
