import { describe, expect, it } from "vitest";
import {
  RECORTES_FATIA,
  resolveRecorteFatia,
} from "@/lib/agenda-coordenacao";
import { parseAba } from "@/app/(app)/duplas/[id]/ficha-abas";
import {
  rotaAgenda,
  rotaChamados,
  rotaDupla,
  rotaDuplas,
  rotaMateriais,
  rotaPessoa,
  rotaPessoas,
  rotaRegistros,
  rotaRelatoriosOperacionais,
} from "./rotas";

// O contrato do REALIZA-396: o link que a Liza monta sai daqui e a página
// aplica o parâmetro — os testes cruzam os dois lados (builder → parser
// real da tela) sempre que o parser é importável.

const params = (href: string) => new URL(href, "https://x").searchParams;

describe("rotaDuplas", () => {
  it("sem filtro devolve a lista limpa", () => {
    expect(rotaDuplas()).toBe("/duplas");
    expect(rotaDuplas({})).toBe("/duplas");
  });

  it("todo recorte emitido é um valor que a página resolve", () => {
    for (const recorte of RECORTES_FATIA) {
      const href = rotaDuplas({ recorte });
      expect(href).toBe(`/duplas?recorte=${recorte}`);
      expect(resolveRecorteFatia(params(href).get("recorte"))).toBe(recorte);
    }
  });

  it("combina recorte e turma (rótulo codificado)", () => {
    const href = rotaDuplas({ recorte: "risco", turma: "Turma 2" });
    expect(params(href).get("recorte")).toBe("risco");
    expect(params(href).get("turma")).toBe("Turma 2");
  });
});

describe("rotaDupla", () => {
  it("ficha sem aba e aba não-default", () => {
    expect(rotaDupla("d1")).toBe("/duplas/d1");
    expect(rotaDupla("d1", "encontros")).toBe("/duplas/d1?aba=encontros");
    expect(rotaDupla("d1", "instrumentos")).toBe(
      "/duplas/d1?aba=instrumentos"
    );
  });

  it("aba default não viaja e a emitida é a que a ficha entende", () => {
    expect(rotaDupla("d1", "agora")).toBe("/duplas/d1");
    for (const aba of ["encontros", "instrumentos", "pessoas"] as const) {
      expect(parseAba(params(rotaDupla("d1", aba)).get("aba")!)).toBe(aba);
    }
  });
});

describe("rotaPessoas", () => {
  it("vazia devolve a lista limpa", () => {
    expect(rotaPessoas()).toBe("/pessoas");
  });

  it("monta o filtro do diretório no vocabulário da página", () => {
    const p = params(
      rotaPessoas({
        busca: "ana",
        cat: "mentorados",
        status: "nao_acessou",
        trilha: "dpp",
        turma: "Turma 1",
        pendencias: true,
        ordem: "pendencias",
        agrupar: "turma",
      })
    );
    expect(p.get("busca")).toBe("ana");
    expect(p.get("cat")).toBe("mentorados");
    expect(p.get("status")).toBe("nao_acessou");
    expect(p.get("trilha")).toBe("dpp");
    expect(p.get("turma")).toBe("Turma 1");
    expect(p.get("pendencias")).toBe("1");
    expect(p.get("ordem")).toBe("pendencias");
    expect(p.get("agrupar")).toBe("turma");
  });

  it("sem-turma é o marcador do balde sem evidência", () => {
    expect(params(rotaPessoas({ turma: "sem-turma" })).get("turma")).toBe(
      "sem-turma"
    );
  });
});

describe("rotaPessoa", () => {
  it("perfil direto", () => {
    expect(rotaPessoa("p1")).toBe("/pessoas/p1");
  });
});

describe("rotaRegistros", () => {
  it("defaults da página (recentes/dupla/mentor) não viajam", () => {
    expect(
      rotaRegistros({ ordem: "recentes", grupo: "dupla", persp: "mentor" })
    ).toBe("/registros");
  });

  it("monta o recorte de registros", () => {
    const p = params(
      rotaRegistros({
        encontro: 5,
        avaliacao: "baixa",
        apoio: true,
        tardio: true,
        dificuldade: "com",
        dupla: "d1",
        turma: "t-uuid",
        periodo: "4s",
        q: "roda da vida",
        ordem: "prioridade",
        grupo: "semana",
        persp: "jovem",
        r: "r-uuid",
      })
    );
    expect(p.get("encontro")).toBe("5");
    expect(p.get("avaliacao")).toBe("baixa");
    expect(p.get("apoio")).toBe("1");
    expect(p.get("tardio")).toBe("1");
    expect(p.get("dificuldade")).toBe("com");
    expect(p.get("dupla")).toBe("d1");
    expect(p.get("turma")).toBe("t-uuid");
    expect(p.get("periodo")).toBe("4s");
    expect(p.get("q")).toBe("roda da vida");
    expect(p.get("ordem")).toBe("prioridade");
    expect(p.get("grupo")).toBe("semana");
    expect(p.get("persp")).toBe("jovem");
    expect(p.get("r")).toBe("r-uuid");
  });

  it("pagina 1 não viaja", () => {
    expect(rotaRegistros({ pagina: 1 })).toBe("/registros");
    expect(params(rotaRegistros({ pagina: 3 })).get("pagina")).toBe("3");
  });
});

describe("rotaAgenda", () => {
  it("dia, visão, modo e janela", () => {
    const p = params(
      rotaAgenda({
        dia: "2026-03-14",
        visao: "dpp",
        aba: "calendario",
        jw: "semana",
        turma: "Turma 2",
      })
    );
    expect(p.get("dia")).toBe("2026-03-14");
    expect(p.get("visao")).toBe("dpp");
    expect(p.get("aba")).toBe("calendario");
    expect(p.get("jw")).toBe("semana");
    expect(p.get("turma")).toBe("Turma 2");
  });

  it("limpa devolve a agenda", () => {
    expect(rotaAgenda()).toBe("/agenda");
  });
});

describe("rotaMateriais / rotaRelatoriosOperacionais / rotaChamados", () => {
  it("aba da biblioteca", () => {
    expect(rotaMateriais("biblioteca")).toBe("/materiais?aba=biblioteca");
    expect(rotaMateriais()).toBe("/materiais");
  });

  it("operacionais com aba, turma e cronograma", () => {
    const p = params(
      rotaRelatoriosOperacionais({
        aba: "aderencia",
        turma: "Turma 1",
        cronograma: "c-uuid",
      })
    );
    expect(p.get("aba")).toBe("aderencia");
    expect(p.get("turma")).toBe("Turma 1");
    expect(p.get("cronograma")).toBe("c-uuid");
    expect(rotaRelatoriosOperacionais()).toBe("/relatorios/operacionais");
  });

  it("chamado direto pelo uuid", () => {
    expect(rotaChamados("ch-1")).toBe("/chamados?c=ch-1");
    expect(rotaChamados()).toBe("/chamados");
  });
});
