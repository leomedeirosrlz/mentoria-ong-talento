import { describe, expect, it } from "vitest";
import { getDemoData } from "../src/lib/demo/data";
import { semanaBounds, toDateStr } from "../src/lib/ciclo";

// Âncoras do dataset evergreen — a invariante é "hoje" e a semana corrente
// no fuso do PROGRAMA (America/Sao_Paulo), não no fuso da máquina. Rode com
// TZ=Pacific/Kiritimati pra reproduzir o drift que esta guarda cobre:
// meio-dia local em UTC+14 cai no dia anterior em SP.

const dowDaData = (iso: string): number =>
  new Date(`${iso}T12:00:00Z`).getUTCDay();

describe("datas do dataset demo", () => {
  const data = getDemoData();
  const hojeSP = toDateStr(new Date());
  const { seg, dom } = semanaBounds(new Date());

  it("o 5º encontro da T1 cai na terça da semana corrente (seg–dom)", () => {
    // Âncora do cronograma T1: a terça DESTA semana ISO — de quarta a
    // domingo ela já passou (o encontro recente fica vencido, a coluna
    // "semana" do panorama acende e a T2 empilha: o 1º enc. dela é esta
    // mesma terça); seg/ter ainda está por vir. A âncora anterior mirava
    // a próxima terça e deixava a semana sem célula "a acontecer".
    const ev5 = data.cicloEventos.find(
      (e) =>
        e.tipo === "encontro" &&
        e.numero === 5 &&
        e.data != null &&
        e.cronograma_id === data.cronogramas[0]?.id
    );
    expect(ev5).toBeDefined();
    expect(dowDaData(ev5!.data!)).toBe(2); // terça
    expect(ev5!.data! >= seg && ev5!.data! <= dom).toBe(true);
  });

  it("as exceções ancoradas em HOJE caem dentro da semana corrente", () => {
    const ancoradas = data.especialistaExcecoes.filter((x) =>
      ["07:00", "12:00"].includes(x.hora_inicio.slice(0, 5))
    );
    expect(ancoradas.length).toBeGreaterThanOrEqual(2);
    for (const x of ancoradas) {
      expect(x.data).toBe(hojeSP);
      expect(x.data >= seg && x.data <= dom).toBe(true);
    }
  });

  it("todas as datas do dataset são YYYY-MM-DD válidas no calendário SP", () => {
    for (const x of data.especialistaExcecoes)
      expect(x.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const ev of data.cicloEventos)
      if (ev.data != null) expect(ev.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
