import { describe, expect, it } from "vitest";
import {
  avisoDisponibilidade,
  disponibilidadeDeConjuntos,
  textoAvisoDisponibilidade,
} from "@/lib/ciclo";

// TZ fixo America/Sao_Paulo (vitest.config.mts) — quarta 04/11/2026, horas
// locais determinísticas. 15h = tarde [12,18), 10h = manhã [8,12), 20h =
// noite [18,22); 5h e 23h30 ficam fora das três faixas.
const QUARTA_MANHA = new Date("2026-11-04T10:00:00-03:00");
const QUARTA_TARDE = new Date("2026-11-04T15:00:00-03:00");
const QUARTA_NOITE = new Date("2026-11-04T20:00:00-03:00");
const QUARTA_MADRUGADA = new Date("2026-11-04T05:00:00-03:00");
const QUARTA_FIM_NOITE = new Date("2026-11-04T23:30:00-03:00");

const LIVRE_TARDE = disponibilidadeDeConjuntos(["qua"], ["tarde"]);
const LIVRE_NOITE = disponibilidadeDeConjuntos(["qua"], ["noite"]);
const LIVRE_SAB_MANHA = disponibilidadeDeConjuntos(["sab"], ["manha"]);
const VAZIA = { celulas: [] };

describe("avisoDisponibilidade", () => {
  it("os dois livres na célula não avisam", () => {
    expect(
      avisoDisponibilidade(LIVRE_TARDE, LIVRE_TARDE, QUARTA_TARDE)
    ).toBeNull();
  });

  it("lado sem grade conta como livre — não sabemos, não alertamos", () => {
    expect(avisoDisponibilidade(null, LIVRE_TARDE, QUARTA_TARDE)).toBeNull();
    expect(
      avisoDisponibilidade(LIVRE_TARDE, undefined, QUARTA_TARDE)
    ).toBeNull();
    expect(avisoDisponibilidade(VAZIA, VAZIA, QUARTA_TARDE)).toBeNull();
    expect(avisoDisponibilidade(null, null, QUARTA_TARDE)).toBeNull();
  });

  it("grade que não cobre o dia conta como ocupada", () => {
    // mentor livre só sábado de manhã: quarta à tarde ele não está
    expect(
      avisoDisponibilidade(LIVRE_SAB_MANHA, LIVRE_TARDE, QUARTA_TARDE)
    ).toEqual({ mentorLivre: false, jovemLivre: true });
  });

  it("só o mentor ocupado", () => {
    expect(
      avisoDisponibilidade(LIVRE_NOITE, LIVRE_TARDE, QUARTA_TARDE)
    ).toEqual({ mentorLivre: false, jovemLivre: true });
  });

  it("só o jovem ocupado", () => {
    expect(
      avisoDisponibilidade(LIVRE_TARDE, LIVRE_NOITE, QUARTA_TARDE)
    ).toEqual({ mentorLivre: true, jovemLivre: false });
  });

  it("os dois ocupados", () => {
    expect(
      avisoDisponibilidade(LIVRE_NOITE, LIVRE_NOITE, QUARTA_TARDE)
    ).toEqual({ mentorLivre: false, jovemLivre: false });
  });

  it("hora fora das três faixas nenhuma célula cobre", () => {
    const ocupados = { mentorLivre: false, jovemLivre: false };
    expect(
      avisoDisponibilidade(LIVRE_TARDE, LIVRE_TARDE, QUARTA_MADRUGADA)
    ).toEqual(ocupados);
    expect(
      avisoDisponibilidade(LIVRE_TARDE, LIVRE_TARDE, QUARTA_FIM_NOITE)
    ).toEqual(ocupados);
    // lado sem grade segue livre mesmo fora da faixa — avisa só o outro
    expect(
      avisoDisponibilidade(null, LIVRE_TARDE, QUARTA_MADRUGADA)
    ).toEqual({ mentorLivre: true, jovemLivre: false });
    expect(avisoDisponibilidade(null, null, QUARTA_MADRUGADA)).toBeNull();
  });
});

describe("textoAvisoDisponibilidade", () => {
  it("só o mentor ocupado", () => {
    expect(
      textoAvisoDisponibilidade(
        { mentorLivre: false, jovemLivre: true },
        "Ana",
        QUARTA_TARDE
      )
    ).toBe("Você não marcou disponibilidade na quarta à tarde.");
  });

  it("só o jovem — com nome e sem nome", () => {
    const aviso = { mentorLivre: true, jovemLivre: false };
    expect(textoAvisoDisponibilidade(aviso, "Ana", QUARTA_TARDE)).toBe(
      "Ana não marcou disponibilidade na quarta à tarde."
    );
    expect(textoAvisoDisponibilidade(aviso, undefined, QUARTA_TARDE)).toBe(
      "O mentorado não marcou disponibilidade na quarta à tarde."
    );
  });

  it("os dois ocupados — com nome e sem nome", () => {
    const aviso = { mentorLivre: false, jovemLivre: false };
    expect(textoAvisoDisponibilidade(aviso, "Ana", QUARTA_TARDE)).toBe(
      "Nem você nem Ana marcaram disponibilidade na quarta à tarde."
    );
    expect(textoAvisoDisponibilidade(aviso, undefined, QUARTA_TARDE)).toBe(
      "Nem você nem o mentorado marcaram disponibilidade na quarta à tarde."
    );
  });

  it("períodos: de manhã, à tarde, à noite", () => {
    const aviso = { mentorLivre: false, jovemLivre: true };
    expect(textoAvisoDisponibilidade(aviso, "Ana", QUARTA_MANHA)).toBe(
      "Você não marcou disponibilidade na quarta de manhã."
    );
    expect(textoAvisoDisponibilidade(aviso, "Ana", QUARTA_NOITE)).toBe(
      "Você não marcou disponibilidade na quarta à noite."
    );
  });

  it("hora fora das três faixas vira 'nesse horário'", () => {
    const aviso = { mentorLivre: false, jovemLivre: true };
    expect(textoAvisoDisponibilidade(aviso, "Ana", QUARTA_MADRUGADA)).toBe(
      "Você não marcou disponibilidade na quarta nesse horário."
    );
    expect(textoAvisoDisponibilidade(aviso, "Ana", QUARTA_FIM_NOITE)).toBe(
      "Você não marcou disponibilidade na quarta nesse horário."
    );
  });

  it("aviso nulo ou os dois livres devolve vazio", () => {
    expect(textoAvisoDisponibilidade(null, "Ana", QUARTA_TARDE)).toBe("");
    expect(
      textoAvisoDisponibilidade(
        { mentorLivre: true, jovemLivre: true },
        "Ana",
        QUARTA_TARDE
      )
    ).toBe("");
  });
});

describe("textoAvisoDisponibilidade · artigo do dia", () => {
  it("sábado e domingo levam 'no'", () => {
    const sabado = new Date("2026-11-07T10:00:00-03:00");
    const domingo = new Date("2026-11-08T20:00:00-03:00");
    const aviso = { mentorLivre: false, jovemLivre: true };
    expect(textoAvisoDisponibilidade(aviso, "Ana", sabado)).toBe(
      "Você não marcou disponibilidade no sábado de manhã."
    );
    expect(textoAvisoDisponibilidade(aviso, "Ana", domingo)).toBe(
      "Você não marcou disponibilidade no domingo à noite."
    );
  });
});
