import { afterEach, describe, expect, it, vi } from "vitest";
import {
  diffDias,
  diasAtrasoRegistro,
  disponibilidadeTexto,
  formatDate,
  formatDateTime,
  formatDiaMes,
  formatDiaNum,
  formatDiaSemana,
  formatDiaSemanaMes,
  formatMesAbrev,
  idade,
  linkSeguro,
  papelLabel,
  parseDisponibilidade,
  registroTardio,
  toDateStr,
  ultimoRegistro,
  waLink,
} from "@/lib/ciclo";
import { mkDupla, mkEncontro, mkRegistro } from "./helpers";

describe("toDateStr / diffDias", () => {
  it("toDateStr formata no fuso do programa (YYYY-MM-DD)", () => {
    expect(toDateStr(new Date("2025-10-14T12:00:00-03:00"))).toBe("2025-10-14");
    // 23h em SP já é madrugada UTC — a data lida segue a de SP
    expect(toDateStr(new Date("2025-10-14T23:30:00-03:00"))).toBe("2025-10-14");
  });

  it("diffDias conta dias inteiros de calendário (a − b), com negativo", () => {
    expect(diffDias("2025-10-14", "2025-10-07")).toBe(7);
    expect(diffDias("2025-10-07", "2025-10-14")).toBe(-7);
    expect(diffDias("2025-10-14", "2025-10-14")).toBe(0);
    expect(diffDias("2026-01-01", "2025-12-31")).toBe(1); // atravessa o ano
  });
});

describe("format* (pt-BR, fuso America/Sao_Paulo)", () => {
  it("formatDate: 'DD de mmm' — 'a definir' sem data ou com data inválida", () => {
    expect(formatDate("2025-10-14")).toBe("14 de out.");
    expect(formatDate("2025-10-14T19:00:00-03:00")).toBe("14 de out.");
    expect(formatDate(null)).toBe("a definir");
    expect(formatDate("lixo")).toBe("a definir");
  });

  it("formatDateTime inclui hora", () => {
    expect(formatDateTime("2025-10-14T19:30:00-03:00")).toBe("14 de out., 19:30");
  });

  it("formatDiaMes: 'DD/MM'; formatDiaNum: só o dia; formatMesAbrev sem ponto", () => {
    expect(formatDiaMes("2025-10-14")).toBe("14/10");
    expect(formatDiaNum("2025-10-14")).toBe("14");
    expect(formatMesAbrev("2025-10-14")).toBe("out");
    expect(formatMesAbrev(null)).toBe("");
  });

  it("formatDiaSemana por extenso e formatDiaSemanaMes com fallback", () => {
    expect(formatDiaSemana("2025-10-14")).toBe("terça-feira");
    expect(formatDiaSemanaMes("2025-10-14")).toBe("terça-feira (14/10)");
    expect(formatDiaSemanaMes("lixo")).toBe("a definir");
    expect(formatDiaSemana(null)).toBe("");
  });
});

describe("registroTardio / diasAtrasoRegistro", () => {
  it("tardio = entregue mais de 3 dias depois do encontro (realizado_em ganha de data_hora)", () => {
    const enc = {
      realizado_em: "2025-10-05T19:00:00-03:00",
      data_hora: "2025-10-07T19:00:00-03:00",
    };
    // 4 dias depois do realizado_em (mesmo a 2 do data_hora)
    const reg = { created_at: "2025-10-09T20:00:00-03:00" };
    expect(registroTardio(reg, enc)).toBe(true);
    expect(diasAtrasoRegistro(reg, enc)).toBe(4);
  });

  it("sem data do encontro não dá pra atrasar — false e 0", () => {
    const reg = { created_at: "2025-10-09T20:00:00-03:00" };
    expect(registroTardio(reg, null)).toBe(false);
    expect(diasAtrasoRegistro(reg, { realizado_em: null, data_hora: null })).toBe(0);
  });

  it("entrega no dia seguinte não é tardia", () => {
    const enc = { realizado_em: "2025-10-07T19:00:00-03:00", data_hora: null };
    const reg = { created_at: "2025-10-08T10:00:00-03:00" };
    expect(registroTardio(reg, enc)).toBe(false);
    expect(diasAtrasoRegistro(reg, enc)).toBe(1);
  });
});

describe("idade", () => {
  afterEach(() => vi.useRealTimers());

  it("conta anos respeitando se o aniversário já passou", () => {
    vi.setSystemTime(new Date("2025-10-14T12:00:00-03:00"));
    expect(idade("1990-05-10")).toBe(35); // aniversário passou
    expect(idade("2000-12-01")).toBe(24); // ainda não fez
    expect(idade("2000-10-14")).toBe(25); // faz hoje
  });

  it("data inválida ou futura devolve null", () => {
    vi.setSystemTime(new Date("2025-10-14T12:00:00-03:00"));
    expect(idade("14/10/2000")).toBeNull();
    expect(idade("")).toBeNull();
    expect(idade(null)).toBeNull();
    expect(idade("2030-01-01")).toBeNull();
  });
});

describe("ultimoRegistro", () => {
  it("é o registro do encontro de maior número, não o primeiro da lista", () => {
    const r1 = mkRegistro({ id: "r1", tema: "antigo" });
    const r3 = mkRegistro({ id: "r3", tema: "recente" });
    const dupla = mkDupla({
      encontros: [
        mkEncontro(3, { status: "realizado", registro: r3 }),
        mkEncontro(1, { status: "realizado", registro: r1 }),
        mkEncontro(2, { status: "realizado", registro: null }),
      ],
    });
    expect(ultimoRegistro(dupla)?.id).toBe("r3");
  });

  it("sem nenhum registro devolve null", () => {
    expect(ultimoRegistro(mkDupla())).toBeNull();
  });
});

describe("disponibilidadeTexto / parseDisponibilidade", () => {
  it("grade vazia ou ausente vira null", () => {
    expect(disponibilidadeTexto(null)).toBeNull();
    expect(disponibilidadeTexto(undefined)).toBeNull();
    expect(disponibilidadeTexto({ dias: [], periodos: [] })).toBeNull();
  });

  it("monta a frase curta com 'e' e plural do 'às'", () => {
    expect(disponibilidadeTexto({ dias: ["ter", "qui"], periodos: ["noite"] })).toBe(
      "Terça e Quinta à noite"
    );
    expect(
      disponibilidadeTexto({ dias: ["seg", "qua", "sex"], periodos: ["manha", "tarde"] })
    ).toBe("Segunda, Quarta e Sexta às manhã e tarde");
    expect(disponibilidadeTexto({ dias: ["sab"], periodos: [] })).toBe("Sábado");
    expect(disponibilidadeTexto({ dias: [], periodos: ["manha"] })).toBe("à manhã");
  });

  it("parseDisponibilidade valida o JSON contra o vocabulário do CHECK", () => {
    expect(parseDisponibilidade('{"dias":["ter","qui"],"periodos":["noite"]}')).toEqual({
      dias: ["ter", "qui"],
      periodos: ["noite"],
    });
    // valores fora do vocabulário são filtrados; sobrando nada, vira null
    expect(parseDisponibilidade('{"dias":["ter","x"],"periodos":[]}')).toEqual({
      dias: ["ter"],
      periodos: [],
    });
    expect(parseDisponibilidade('{"dias":["x"]}')).toBeNull();
    expect(parseDisponibilidade("")).toBeNull();
    expect(parseDisponibilidade("null")).toBeNull();
    expect(parseDisponibilidade("{quebrado")).toEqual({
      error: "A disponibilidade chegou num formato inválido.",
    });
  });
});

describe("waLink / linkSeguro", () => {
  it("waLink limpa o telefone e encoda a mensagem", () => {
    expect(waLink("(11) 98765-4321", "Oi, tudo bem?")).toBe(
      "https://wa.me/11987654321?text=Oi%2C%20tudo%20bem%3F"
    );
    expect(waLink("5511987654321", "Até amanhã")).toBe(
      "https://wa.me/5511987654321?text=At%C3%A9%20amanh%C3%A3"
    );
  });

  it("waLink sem dígito nenhum devolve null (wa.me/ vazio quebra)", () => {
    expect(waLink(null, "oi")).toBeNull();
    expect(waLink("-", "oi")).toBeNull();
    expect(waLink("abc", "oi")).toBeNull();
  });

  it("linkSeguro só passa http(s)", () => {
    expect(linkSeguro("https://exemplo.com/x")).toBe("https://exemplo.com/x");
    expect(linkSeguro("http://exemplo.com")).toBe("http://exemplo.com");
    expect(linkSeguro("javascript:alert(1)")).toBeNull();
    expect(linkSeguro("ftp://x")).toBeNull();
    expect(linkSeguro(null)).toBeNull();
  });
});

describe("papelLabel", () => {
  it("rótulos pt-BR por papel, com fallback", () => {
    expect(papelLabel("coordenacao")).toBe("Coordenação");
    expect(papelLabel("supervisor")).toBe("Supervisor de relacionamento");
    expect(papelLabel("mentor_dpp")).toBe("Mentor DPP");
    expect(papelLabel("mentor_especialista")).toBe("Mentor especialista");
    expect(papelLabel(null)).toBe("Sem papel definido");
  });
});
