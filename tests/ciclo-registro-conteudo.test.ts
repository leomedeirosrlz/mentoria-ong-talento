import { describe, expect, it } from "vitest";
import {
  emLimbo,
  jornadaDaDupla,
  passosDaTrilha,
  registroTemConteudo,
  saudadeDaDupla,
  ultimoRegistro,
} from "@/lib/ciclo";
import type { Registro } from "@/lib/types";
import {
  CICLO_16,
  dt,
  encRealizado,
  mkDupla,
  mkRegistro,
} from "./helpers";

const PASSOS = passosDaTrilha("dpp", CICLO_16);
const HOJE = dt("2025-10-15"); // qua — semana do encontro 2

/** Registro legado salvo só com os defaults do form. */
const REGISTRO_VAZIO: Registro = mkRegistro({
  tema: null,
  ferramenta: null,
  reflexoes: null,
  observacoes: null,
  atividades: [],
  avaliacao: null,
  dificuldade: null,
  proximo_passo: null,
});

describe("registroTemConteudo", () => {
  it("registro nulo ou ausente não tem conteúdo", () => {
    expect(registroTemConteudo(null)).toBe(false);
    expect(registroTemConteudo(undefined)).toBe(false);
  });

  it("registro só com defaults não tem conteúdo", () => {
    expect(registroTemConteudo(REGISTRO_VAZIO)).toBe(false);
  });

  it("texto em branco não conta como conteúdo", () => {
    const reg = { tema: "   ", reflexoes: "\n", observacoes: "\t", atividades: ["", "  "] };
    expect(registroTemConteudo(reg)).toBe(false);
  });

  it.each([
    ["tema", { ...REGISTRO_VAZIO, tema: "Escuta ativa" }],
    ["reflexões", { ...REGISTRO_VAZIO, reflexoes: "Abriu sobre a escola" }],
    ["observações", { ...REGISTRO_VAZIO, observacoes: "Chegou animado" }],
    ["atividade", { ...REGISTRO_VAZIO, atividades: ["Orientação individual"] }],
  ])("um campo de conteúdo (%s) basta", (_campo, reg) => {
    expect(registroTemConteudo(reg)).toBe(true);
  });

  it("ferramenta, avaliação e próximos passos sozinhos não são conteúdo", () => {
    const reg = mkRegistro({
      tema: null,
      reflexoes: null,
      observacoes: null,
      atividades: [],
      ferramenta: "Genograma",
      avaliacao: "boa",
      dificuldade: "nenhuma",
      proximo_passo: "continuar",
      precisa_apoio: true,
    });
    expect(registroTemConteudo(reg)).toBe(false);
  });

  it("aceita o payload da action (atividades como array simples)", () => {
    const payload = { tema: null, reflexoes: null, observacoes: null, atividades: ["Atividade prática"] };
    expect(registroTemConteudo(payload)).toBe(true);
  });
});

describe("jornadaDaDupla — registro vazio não fecha o passo", () => {
  it("encontro realizado com registro de defaults lê como pendente_registro", () => {
    const dupla = mkDupla({
      encontros: [encRealizado(1, "2025-10-07", REGISTRO_VAZIO)],
    });

    const j = jornadaDaDupla(dupla, PASSOS, HOJE);

    expect(j.nos[0].estado).toBe("pendente_registro");
    expect(j.comRegistro).toBe(0);
    expect(j.pendentesRegistro).toBe(1);
    // o encontro conta como feito ("você está aqui" é o 2º), mas o nó 1
    // segue pedindo o registro
    expect(j.proximoNumero).toBe(2);
  });

  it("registro com conteúdo segue completo", () => {
    const dupla = mkDupla({
      encontros: [encRealizado(1, "2025-10-07", mkRegistro({ tema: "Escuta ativa" }))],
    });

    const j = jornadaDaDupla(dupla, PASSOS, HOJE);

    expect(j.nos[0].estado).toBe("realizado_completo");
    expect(j.comRegistro).toBe(1);
    expect(j.pendentesRegistro).toBe(0);
  });
});

describe("saudadeDaDupla — registro vazio mantém a pendência", () => {
  it("realizado há mais de 24h com registro vazio é registro pendente", () => {
    const dupla = mkDupla({
      encontros: [encRealizado(1, "2025-10-07", REGISTRO_VAZIO)],
    });

    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-09"));

    expect(s.semaforo).toBe("atencao");
    expect(s.motivo).toBe("Encontro realizado sem registro");
    expect(s.registroPendente).toBe(true);
    expect(s.sinais.map((x) => x.tipo)).toEqual(["registro_pendente"]);
  });

  it("pedido de apoio do registro vazio segue visível no eixo próprio", () => {
    const dupla = mkDupla({
      encontros: [
        encRealizado(1, "2025-10-07", { ...REGISTRO_VAZIO, precisa_apoio: true }),
      ],
    });

    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-09"));

    expect(s.registroPendente).toBe(true);
    expect(s.apoio.aberto).toBe(true);
    expect(s.pediuApoio).toBe(true);
  });
});

describe("leituras que dependem de registro entregue", () => {
  it("encontro agendado vencido com registro vazio segue em limbo", () => {
    const enc = encRealizado(1, "2025-10-07", REGISTRO_VAZIO);
    expect(emLimbo({ ...enc, status: "agendado" }, HOJE.getTime())).toBe(true);
  });

  it("ultimoRegistro ignora o registro vazio e acha o último com conteúdo", () => {
    const dupla = mkDupla({
      encontros: [
        encRealizado(1, "2025-10-07", mkRegistro({ tema: "Escuta ativa" })),
        encRealizado(2, "2025-10-14", REGISTRO_VAZIO),
      ],
    });

    expect(ultimoRegistro(dupla)?.tema).toBe("Escuta ativa");
  });
});
