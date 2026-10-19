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

  it("o 5º encontro da T1 cai na próxima terça (inclusive se hoje for terça)", () => {
    // Âncora do cronograma T1: `((2 - dow) + 7) % 7` dias à frente — de
    // quarta a domingo a "semana corrente" da história é a da próxima terça,
    // pra o encontro recente nunca ficar no passado demais.
    const ev5 = data.cicloEventos.find(
      (e) =>
        e.tipo === "encontro" &&
        e.numero === 5 &&
        e.data != null &&
        e.cronograma_id === data.cronogramas[0]?.id
    );
    expect(ev5).toBeDefined();
    expect(dowDaData(ev5!.data!)).toBe(2); // terça
    const limite = new Date(`${hojeSP}T12:00:00Z`);
    limite.setUTCDate(limite.getUTCDate() + 6);
    expect(ev5!.data! >= hojeSP).toBe(true);
    expect(ev5!.data! <= limite.toISOString().slice(0, 10)).toBe(true);
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
