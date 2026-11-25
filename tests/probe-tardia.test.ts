import { describe, it } from "vitest";
import { alvoAgendamento, saudadeDaDupla } from "@/lib/ciclo";
import { CICLO_16, dt, encRealizado, mkDupla } from "./helpers";

// dupla entrou na semana do encontro 7 (18/11), hoje = semana do 9 (02/12)
const INI = "2025-11-18";
const HOJE = dt("2025-12-02");

describe("dupla tardia", () => {
  it("sem encontro nenhum", () => {
    const dupla = mkDupla({ iniciada_em: INI });
    const alvo = alvoAgendamento(dupla, CICLO_16, HOJE);
    const saude = saudadeDaDupla(dupla, CICLO_16, HOJE);
    console.log("proximoNumero:", alvo.proximoNumero);
    console.log("sugeridoProximo:", alvo.sugeridoProximo);
    console.log("faltantes:", JSON.stringify(alvo.faltantes));
    console.log("saude:", JSON.stringify({ esperado: saude.esperado, feitos: saude.feitos, atraso: saude.atraso }));
  });
  it("fez encontro 7 e 8 (os oficiais pós-entrada)", () => {
    const dupla = mkDupla({
      iniciada_em: INI,
      encontros: [encRealizado(7, "2025-11-18"), encRealizado(8, "2025-11-25")],
    });
    const alvo = alvoAgendamento(dupla, CICLO_16, HOJE);
    const saude = saudadeDaDupla(dupla, CICLO_16, HOJE);
    console.log("proximoNumero:", alvo.proximoNumero);
    console.log("sugeridoProximo:", alvo.sugeridoProximo);
    console.log("faltantes:", JSON.stringify(alvo.faltantes));
    console.log("saude:", JSON.stringify({ esperado: saude.esperado, feitos: saude.feitos, atraso: saude.atraso }));
  });
});
