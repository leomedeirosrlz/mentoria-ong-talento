import { describe, expect, it } from "vitest";
import {
  recorteHistorico,
  type ItemHistorico,
} from "@/components/jovem-historico";

// REALIZA-488 — histórico compacto da agenda do jovem: os 5 mais
// recentes abertos + "Ver histórico completo", grupos por mês na ordem
// de chegada e chips de origem quando as duas trilhas convivem.

const linha = (id: string, mes: string, trilha = "dpp"): ItemHistorico => ({
  id,
  trilha,
  mes,
  node: null,
});

describe("recorteHistorico — os 5 mais recentes + 'ver completo'", () => {
  const NOV = "novembro de 2026";
  const OUT = "outubro de 2026";
  const sete = Array.from({ length: 7 }, (_, i) =>
    linha(`e${i + 1}`, i < 3 ? NOV : OUT)
  );

  it("mais de 5: só os recentes aparecem e a sobra vira contador", () => {
    const r = recorteHistorico(sete, "tudo", false);
    expect(r.filtrados).toHaveLength(7);
    expect(r.grupos.flatMap((g) => g.linhas).map((i) => i.id)).toEqual([
      "e1",
      "e2",
      "e3",
      "e4",
      "e5",
    ]);
    expect(r.ocultos).toBe(2);
  });

  it("'ver completo' abre o resto sem reordenar", () => {
    const r = recorteHistorico(sete, "tudo", true);
    expect(r.grupos.flatMap((g) => g.linhas)).toHaveLength(7);
    expect(r.ocultos).toBe(0);
  });

  it("5 ou menos não oferece expansão — botão seria vazio", () => {
    expect(recorteHistorico(sete.slice(0, 5), "tudo", false).ocultos).toBe(0);
    expect(recorteHistorico([], "tudo", false).grupos).toEqual([]);
  });

  it("agrupa meses consecutivos; mês intercalado vira grupo novo", () => {
    const itens = [
      linha("a", NOV),
      linha("b", NOV),
      linha("c", OUT),
      linha("d", NOV), // mesmo mês fora de sequência — outro cabeçalho
    ];
    const r = recorteHistorico(itens, "tudo", false);
    expect(r.grupos.map((g) => [g.mes, g.linhas.map((i) => i.id)])).toEqual([
      [NOV, ["a", "b"]],
      [OUT, ["c"]],
      [NOV, ["d"]],
    ]);
  });

  it("chips de origem recortam o conjunto — e a sobra do 'ver completo' junto", () => {
    const itens = [
      ...Array.from({ length: 6 }, (_, i) => linha(`d${i + 1}`, NOV)),
      linha("s1", NOV, "especialista"),
      linha("s2", NOV, "especialista"),
    ];
    const esp = recorteHistorico(itens, "especialista", false);
    expect(esp.filtrados.map((i) => i.id)).toEqual(["s1", "s2"]);
    expect(esp.ocultos).toBe(0);
    // 6 de mentoria: 5 visíveis + 1 na sobra — o chip muda a conta
    const dpp = recorteHistorico(itens, "dpp", false);
    expect(dpp.ocultos).toBe(1);
    expect(recorteHistorico(itens, "dpp", true).ocultos).toBe(0);
  });
});
