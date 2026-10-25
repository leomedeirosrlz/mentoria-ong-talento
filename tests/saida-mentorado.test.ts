import { describe, expect, it } from "vitest";
import { foraDoPrograma, motivoSaida, SITUACAO_MENTORADO_LABEL } from "@/lib/ciclo";
import { filaMentorados } from "@/lib/fila";
import { mkMentorado } from "./helpers";

// Saída do mentorado (0077) — situacao 'ativo'|'desistente'|'concluido' +
// saiu_em + motivo_saida. O teste trava o que a /pessoas depende: quem saiu
// sai do grupo principal, some da fila e carrega o motivo legível.

describe("foraDoPrograma", () => {
  it("ativo ou campo ausente (select parcial/persona) conta como no programa", () => {
    expect(foraDoPrograma({ situacao: "ativo" })).toBe(false);
    expect(foraDoPrograma({})).toBe(false);
    expect(foraDoPrograma({ situacao: null })).toBe(false);
  });

  it("desistente e concluído são fora do programa", () => {
    expect(foraDoPrograma({ situacao: "desistente" })).toBe(true);
    expect(foraDoPrograma({ situacao: "concluido" })).toBe(true);
  });
});

describe("motivoSaida", () => {
  it("categoria conhecida vira rótulo canônico, com detalhe depois de dois-pontos", () => {
    expect(motivoSaida("mudou_cidade", "")).toBe("Mudou de cidade");
    expect(motivoSaida("desistencia", "falta de tempo")).toBe(
      "Desistiu do programa: falta de tempo"
    );
  });

  it("'outro' e categoria desconhecida mandam o texto livre (ou null)", () => {
    expect(motivoSaida("outro", "foi morar com a avó")).toBe(
      "foi morar com a avó"
    );
    expect(motivoSaida("outro", "   ")).toBeNull();
    expect(motivoSaida("qualquer", "")).toBeNull();
  });
});

describe("labels da situação", () => {
  it("cobre os três valores do CHECK da 0077", () => {
    expect(Object.keys(SITUACAO_MENTORADO_LABEL).sort()).toEqual([
      "ativo",
      "concluido",
      "desistente",
    ]);
  });
});

describe("filaMentorados × situação", () => {
  it("quem saiu não entra na fila — nem quem nunca pareou", () => {
    const livre = mkMentorado({ id: "m-ok", nome: "Sem Par" });
    const desistente = mkMentorado({
      id: "m-fora",
      nome: "Que Saiu",
      situacao: "desistente",
    });
    const concluida = mkMentorado({
      id: "m-fim",
      nome: "Que Concluiu",
      situacao: "concluido",
    });
    const fila = filaMentorados(
      [livre, desistente, concluida],
      new Set(),
      new Set()
    );
    expect(fila.map((f) => f.id)).toEqual(["m-ok"]);
  });
});
