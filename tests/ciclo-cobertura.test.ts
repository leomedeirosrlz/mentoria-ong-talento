// Uma sessão pode cobrir mais de um passo do guia (007 US11 / REALIZA-448):
// a régua pura decide quais passos a ficha oferece no checkbox "a sessão
// também cobriu". Espelha o recorte do salvarRegistro — se divergirem, a UI
// oferece o que a action recusa (ou esconde o que ela aceita).

import { describe, expect, it } from "vitest";
import { passosCobertosCandidatos, passosDaTrilha } from "@/lib/ciclo";
import {
  CICLO_16,
  encAgendado,
  encRealizado,
  mkEncontro,
} from "./helpers";

const PASSOS = passosDaTrilha("dpp", CICLO_16);
// 15/11/2025 — oficiais 1..6 já venceram (6º = 11/11, 7º só em 11/18)
const AGORA = new Date("2025-11-15T15:00:00Z");

describe("passosCobertosCandidatos", () => {
  it("passo vencido sem row entra; o próprio, o último e os não-vencidos ficam de fora", () => {
    const candidatos = passosCobertosCandidatos(PASSOS, [], 6, AGORA).map(
      (p) => p.numero
    );
    expect(candidatos).toEqual([1, 2, 3, 4, 5]);
    expect(candidatos).not.toContain(6); // é o da ficha atual
    expect(candidatos).not.toContain(16); // fechamento é gesto próprio
    expect(candidatos).not.toContain(7); // oficial 18/11 ainda não venceu
  });

  it("realizado sem registro e agendado/remarcado vencido entram; fatos gravados ficam de fora", () => {
    const encontros = [
      encRealizado(1, "2025-11-10", null), // realizado SEM registro → entra
      encRealizado(2, "2025-11-09"), // realizado COM registro → fora
      encAgendado(3, "2025-11-11"), // agendado já vencido → entra
      encAgendado(4, "2025-11-20"), // agendado futuro → fora (cobrir não é desmarcação)
      mkEncontro(5, {
        status: "nao_aconteceu",
        data_hora: "2025-11-10T22:00:00Z",
      }), // fato registrado → fora
      mkEncontro(7, {
        status: "remarcado",
        data_hora: "2025-11-12T22:00:00Z",
      }), // remarcado vencido → entra
    ];
    const candidatos = passosCobertosCandidatos(
      PASSOS,
      encontros,
      6,
      AGORA
    ).map((p) => p.numero);
    expect(candidatos).toEqual([1, 3, 7]);
  });

  it("agendado sem data ('a combinar') é compromisso aberto — entra", () => {
    const encontros = [mkEncontro(2, { status: "agendado" })];
    const candidatos = passosCobertosCandidatos(
      PASSOS,
      encontros,
      6,
      AGORA
    ).map((p) => p.numero);
    expect(candidatos).toContain(2);
  });
});
