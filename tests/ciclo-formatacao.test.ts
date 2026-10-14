import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cruzamentoDisponibilidade,
  cruzamentoDisponibilidadeHora,
  diaSemanaDe,
  diffDias,
  diasAtrasoRegistro,
  disponibilidadeNaHora,
  disponibilidadeNoDia,
  disponibilidadeTexto,
  disponibilidadeVazia,
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
  podeSupervisionar,
  registroTardio,
  toDateStr,
  ultimoRegistro,
  waLink,
} from "@/lib/ciclo";
import type { DiaSemana, Disponibilidade, Periodo } from "@/lib/types";
import { mkDupla, mkEncontro, mkRegistro } from "./helpers";

/** Literal de grade tipado — a Disponibilidade do CHECK é {dias,periodos}. */
const grade = (dias: DiaSemana[], periodos: Periodo[] = []): Disponibilidade => ({
  dias,
  periodos,
});

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
  it("formatDate: 'DD de mmm de AAAA' — 'a definir' sem data ou com data inválida", () => {
    expect(formatDate("2025-10-14")).toBe("14 de out. de 2025");
    expect(formatDate("2025-10-14T19:00:00-03:00")).toBe("14 de out. de 2025");
    expect(formatDate(null)).toBe("a definir");
    expect(formatDate("lixo")).toBe("a definir");
  });

  it("formatDateTime inclui hora", () => {
    expect(formatDateTime("2025-10-14T19:30:00-03:00")).toBe("14 de out. de 2025, 19:30");
  });

  it("formatDiaMes: 'DD/MM/AAAA'; formatDiaNum: só o dia; formatMesAbrev sem ponto", () => {
    expect(formatDiaMes("2025-10-14")).toBe("14/10/2025");
    expect(formatDiaNum("2025-10-14")).toBe("14");
    expect(formatMesAbrev("2025-10-14")).toBe("out");
    expect(formatMesAbrev(null)).toBe("");
  });

  it("formatDiaSemana por extenso e formatDiaSemanaMes com fallback", () => {
    expect(formatDiaSemana("2025-10-14")).toBe("terça-feira");
    expect(formatDiaSemanaMes("2025-10-14")).toBe("terça-feira (14/10/2025)");
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
    ).toBe("Segunda, Quarta e Sexta às manhãs e tardes");
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

describe("diaSemanaDe / disponibilidadeNoDia / cruzamentoDisponibilidade", () => {
  // 2025-10-14 = terça-feira; a grade usa o vocabulário seg..dom do CHECK
  it("diaSemanaDe resolve o DiaSemana da data (sem escorregar de fuso)", () => {
    expect(diaSemanaDe("2025-10-14")).toBe("ter");
    expect(diaSemanaDe("2025-10-12")).toBe("dom");
    expect(diaSemanaDe("2025-10-18")).toBe("sab");
  });

  it("disponibilidadeNoDia só olha `dias` — grade nula/sem dias não é livre", () => {
    expect(disponibilidadeNoDia(grade(["ter", "qui"]), "ter")).toBe(true);
    expect(disponibilidadeNoDia(grade(["ter", "qui"], ["noite"]), "qua")).toBe(false);
    expect(disponibilidadeNoDia(grade([], ["noite"]), "ter")).toBe(false);
    expect(disponibilidadeNoDia(null, "ter")).toBe(false);
    expect(disponibilidadeNoDia(undefined, "ter")).toBe(false);
  });

  it("disponibilidadeVazia segue a mesma régua do cruzamento — sem dia não cruza", () => {
    // a régua do lembrete do /jovem (REALIZA-114): null, esqueleto vazio e
    // períodos-sem-dia não servem pro overlay — "pendente"
    expect(disponibilidadeVazia(null)).toBe(true);
    expect(disponibilidadeVazia(undefined)).toBe(true);
    expect(disponibilidadeVazia(grade([]))).toBe(true);
    expect(disponibilidadeVazia(grade([], ["noite"]))).toBe(true);
    // dia marcado basta pra preencher — período vazio é "qualquer horário"
    expect(disponibilidadeVazia(grade(["ter"]))).toBe(false);
    expect(disponibilidadeVazia(grade(["ter"], ["noite"]))).toBe(false);
  });

  const MENTOR = grade(["ter", "qui"], ["noite"]);

  it("ambos = mesmo dia + período em comum; período vazio é coringa", () => {
    // encaixe exato (ter × noite nas duas grades)
    expect(
      cruzamentoDisponibilidade(MENTOR, [grade(["ter"], ["noite"])], "ter")
    ).toBe("ambos");
    // jovem sem períodos = "qualquer" — cruza com o "noite" do mentor
    expect(
      cruzamentoDisponibilidade(MENTOR, [grade(["qui"])], "qui")
    ).toBe("ambos");
    // mentor sem períodos também é coringa
    expect(
      cruzamentoDisponibilidade(
        grade(["ter"]),
        [grade(["ter"], ["manha"])],
        "ter"
      )
    ).toBe("ambos");
    // interseção parcial basta — o jovem tem "noite" entre os dele
    expect(
      cruzamentoDisponibilidade(MENTOR, [grade(["ter"], ["tarde", "noite"])], "ter")
    ).toBe("ambos");
  });

  it("mesmo dia sem período em comum cai pra 'mentor', não 'ambos'", () => {
    // honesto: ele pode de manhã, ela à noite — não é encaixe, mas ele está
    // livre (e ela conta como jovem livre; "mentor" ganha na ordem)
    expect(
      cruzamentoDisponibilidade(MENTOR, [grade(["ter"], ["manha", "tarde"])], "ter")
    ).toBe("mentor");
  });

  it("ordem ambos > mentor > jovem > nenhum, com OR entre jovens", () => {
    // mentor livre, nenhum jovem no dia
    expect(cruzamentoDisponibilidade(MENTOR, [grade(["seg"])], "ter")).toBe("mentor");
    expect(cruzamentoDisponibilidade(MENTOR, [], "ter")).toBe("mentor");
    // mentor fora do dia, jovem livre → "jovem" (sem mentor não há cruzamento,
    // então período nem entra na conta)
    expect(
      cruzamentoDisponibilidade(MENTOR, [grade(["sab"], ["manha"])], "sab")
    ).toBe("jovem");
    // multi-jovem: basta UMA grade compatível pro "ambos"…
    expect(
      cruzamentoDisponibilidade(
        MENTOR,
        [grade(["ter"], ["manha"]), grade(["ter"], ["noite"])],
        "ter"
      )
    ).toBe("ambos");
    // …e basta um jovem livre pro "jovem" quando o mentor não está
    expect(
      cruzamentoDisponibilidade(
        MENTOR,
        [grade(["sab"], ["noite"]), null],
        "sab"
      )
    ).toBe("jovem");
    // ninguém livre
    expect(cruzamentoDisponibilidade(MENTOR, [grade(["sab"])], "seg")).toBe("nenhum");
    expect(cruzamentoDisponibilidade(null, [null], "ter")).toBe("nenhum");
    // mentor sem grade: o lado dele nunca tá livre, o do jovem segue valendo
    expect(
      cruzamentoDisponibilidade(null, [grade(["ter"], ["noite"])], "ter")
    ).toBe("jovem");
  });
});

describe("disponibilidadeNaHora / cruzamentoDisponibilidadeHora (REALIZA-25)", () => {
  // janelas do programa: manhã 8–12, tarde 12–18, noite 18–22 — [ini, fim)
  it("a hora cheia cai dentro da janela do período; a borda é do próximo", () => {
    const noite = grade(["ter"], ["noite"]);
    expect(disponibilidadeNaHora(noite, "ter", 18)).toBe(true);
    expect(disponibilidadeNaHora(noite, "ter", 21)).toBe(true);
    expect(disponibilidadeNaHora(noite, "ter", 22)).toBe(false); // fim exclusivo
    expect(disponibilidadeNaHora(noite, "ter", 17)).toBe(false);
    // manhã cobre 8–11, não o meio-dia
    const manha = grade(["ter"], ["manha"]);
    expect(disponibilidadeNaHora(manha, "ter", 8)).toBe(true);
    expect(disponibilidadeNaHora(manha, "ter", 12)).toBe(false);
  });

  it("`dias` decide o dia; `periodos` vazio = qualquer hora do dia livre", () => {
    // fora do dia marcado, nenhuma hora livre
    expect(disponibilidadeNaHora(grade(["ter"], ["noite"]), "qua", 19)).toBe(false);
    expect(disponibilidadeNaHora(null, "ter", 19)).toBe(false);
    // dia marcado sem período = o dia inteiro livre (mesmo coringa do dia)
    expect(disponibilidadeNaHora(grade(["ter"]), "ter", 7)).toBe(true);
    expect(disponibilidadeNaHora(grade(["ter"]), "ter", 19)).toBe(true);
    // OR entre períodos — tarde OU noite cobre 14h e 20h, não 9h
    const duas = grade(["ter"], ["tarde", "noite"]);
    expect(disponibilidadeNaHora(duas, "ter", 14)).toBe(true);
    expect(disponibilidadeNaHora(duas, "ter", 20)).toBe(true);
    expect(disponibilidadeNaHora(duas, "ter", 9)).toBe(false);
  });

  it("ambos = os dois livres NA MESMA HORA — o encaixe que o dia inteiro não vê", () => {
    // o caso que o cruzamento por dia marcava "ambos" sem ser: ele de manhã,
    // ela à noite — na grade horária isso nunca se encontra
    const mentorManha = grade(["ter"], ["manha"]);
    const jovemNoite = grade(["ter"], ["noite"]);
    expect(
      cruzamentoDisponibilidadeHora(mentorManha, [jovemNoite], "ter", 9)
    ).toBe("mentor");
    expect(
      cruzamentoDisponibilidadeHora(mentorManha, [jovemNoite], "ter", 20)
    ).toBe("jovem");
    // com sobreposição real (tarde × tarde) é "ambos" nas horas em comum
    const mentorTarde = grade(["ter"], ["tarde"]);
    const jovemTardeNoite = grade(["ter"], ["tarde", "noite"]);
    expect(
      cruzamentoDisponibilidadeHora(mentorTarde, [jovemTardeNoite], "ter", 14)
    ).toBe("ambos");
    // fora da janela do mentor cai pra "jovem", não "ambos"
    expect(
      cruzamentoDisponibilidadeHora(mentorTarde, [jovemTardeNoite], "ter", 20)
    ).toBe("jovem");
  });

  it("ordem ambos > mentor > jovem > nenhum, com OR entre jovens", () => {
    const mentor = grade(["ter"], ["noite"]);
    // basta UM jovem livre na hora pro "ambos"/"jovem" — mesmo OR do dia
    expect(
      cruzamentoDisponibilidadeHora(
        mentor,
        [grade(["ter"], ["manha"]), grade(["ter"], ["noite"])],
        "ter",
        19
      )
    ).toBe("ambos");
    // mentor livre, jovem só de manhã → "mentor" na hora da noite
    expect(
      cruzamentoDisponibilidadeHora(mentor, [grade(["ter"], ["manha"])], "ter", 19)
    ).toBe("mentor");
    // mentor fora, jovem livre → "jovem"; ninguém → "nenhum"
    expect(
      cruzamentoDisponibilidadeHora(mentor, [grade(["ter"], ["manha"])], "ter", 9)
    ).toBe("jovem");
    expect(
      cruzamentoDisponibilidadeHora(mentor, [grade(["ter"], ["manha"])], "qua", 19)
    ).toBe("nenhum");
    expect(cruzamentoDisponibilidadeHora(null, [null], "ter", 19)).toBe("nenhum");
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

describe("podeSupervisionar", () => {
  it("supervisor e coordenação podem ser supervisor_id de dupla", () => {
    expect(podeSupervisionar("supervisor")).toBe(true);
    expect(podeSupervisionar("coordenacao")).toBe(true);
    expect(podeSupervisionar("mentor_dpp")).toBe(false);
    expect(podeSupervisionar("mentor_especialista")).toBe(false);
    expect(podeSupervisionar(null)).toBe(false);
    expect(podeSupervisionar(undefined)).toBe(false);
  });
});
