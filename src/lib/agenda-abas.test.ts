import { describe, expect, it } from "vitest";
import { abasDaAgenda } from "./agenda-abas";

// REALIZA-246 — a barra de modos da agenda é uma só, montada neste helper.
// Os testes prendem o que a página vinha decidindo em três lugares: a ordem
// das superfícies, o `?visao=dpp` explícito e o recorte por papel.

const ids = (abas: ReturnType<typeof abasDaAgenda>) => abas.map((a) => a.id);
const href = (abas: ReturnType<typeof abasDaAgenda>, id: string) =>
  abas.find((a) => a.id === id)?.href;

describe("abasDaAgenda", () => {
  it("mentor DPP puro: os três modos, sem ?visao (a aterrissagem já é a dele)", () => {
    const abas = abasDaAgenda({ papel: "mentor_dpp", mentor: true, especialista: false });
    expect(ids(abas)).toEqual(["minha", "por-mentorado", "calendario"]);
    expect(href(abas, "minha")).toBe("/agenda?aba=minha");
    expect(href(abas, "calendario")).toBe("/agenda?aba=calendario");
  });

  it("coordenação: monitoramento primeiro, calendário como segunda aba", () => {
    const abas = abasDaAgenda({
      papel: "coordenacao",
      mentor: false,
      especialista: false,
    });
    expect(ids(abas)).toEqual(["monitoramento", "calendario"]);
    expect(href(abas, "monitoramento")).toBe("/agenda");
    expect(href(abas, "calendario")).toBe("/agenda?aba=calendario");
  });

  it("supervisor puro: por turma e consolidada, sem calendário", () => {
    const abas = abasDaAgenda({
      papel: "supervisor",
      mentor: false,
      especialista: false,
    });
    expect(ids(abas)).toEqual(["turma", "consolidada"]);
    expect(href(abas, "consolidada")).toBe("/agenda?aba=consolidada");
  });

  it("staff+mentor: a superfície de equipe vem primeiro e os modos carregam ?visao=dpp", () => {
    const abas = abasDaAgenda({
      papel: "coordenacao",
      mentor: true,
      especialista: false,
    });
    expect(ids(abas)).toEqual([
      "monitoramento",
      "minha",
      "por-mentorado",
      "calendario",
    ]);
    expect(href(abas, "minha")).toBe("/agenda?visao=dpp&aba=minha");
    expect(href(abas, "por-mentorado")).toBe(
      "/agenda?visao=dpp&aba=por-mentorado"
    );
    // o calendário do staff é o de equipe: sem o param ele abre na superfície
    // certa e o link do mentor (?visao=dpp) também passa pelo guard dele
    expect(href(abas, "calendario")).toBe("/agenda?aba=calendario");
  });

  it("híbrido de primário especialista: o calendário precisa do ?visao=dpp", () => {
    const abas = abasDaAgenda({
      papel: "mentor_especialista",
      mentor: true,
      especialista: true,
    });
    expect(ids(abas)).toEqual([
      "minha",
      "por-mentorado",
      "calendario",
      "especialista",
    ]);
    expect(href(abas, "calendario")).toBe("/agenda?visao=dpp&aba=calendario");
    expect(href(abas, "especialista")).toBe("/agenda?visao=especialista");
  });

  it("especialista puro: uma aba só — a barra não renderiza com menos de duas", () => {
    expect(
      abasDaAgenda({
        papel: "mentor_especialista",
        mentor: false,
        especialista: true,
      })
    ).toEqual([
      {
        id: "especialista",
        href: "/agenda?visao=especialista",
        rotulo: "Especialista",
      },
    ]);
  });

  it("sem superfície nenhuma: lista vazia (nem mentor, nem staff, nem esp)", () => {
    expect(
      abasDaAgenda({ papel: "mentorado", mentor: false, especialista: false })
    ).toEqual([]);
  });

  it("staff+esp: a visão de especialista entra depois da superfície de equipe", () => {
    const abas = abasDaAgenda({
      papel: "coordenacao",
      mentor: false,
      especialista: true,
    });
    expect(ids(abas)).toEqual(["monitoramento", "calendario", "especialista"]);
  });
});
