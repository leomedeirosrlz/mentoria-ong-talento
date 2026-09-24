import { describe, expect, it } from "vitest";
import {
  agregaRespostas,
  linkStatus,
  respostaFormatada,
  validaCampos,
  type FormularioCampo,
  type RespostaComAutor,
} from "@/lib/forms/schema";

const campo = (over: Partial<FormularioCampo> = {}): FormularioCampo => ({
  id: "f1",
  tipo: "texto",
  label: "Pergunta",
  obrigatorio: false,
  ...over,
});

describe("linkStatus", () => {
  const agora = new Date("2025-10-15T12:00:00-03:00");

  it("usado ganha de expirado; sem os dois, pendente", () => {
    expect(linkStatus({ usado_em: "2025-10-10", expira_em: "2025-10-01" }, agora)).toBe(
      "respondido"
    );
    expect(linkStatus({ usado_em: null, expira_em: "2025-10-14" }, agora)).toBe(
      "expirado"
    );
    expect(linkStatus({ usado_em: null, expira_em: "2025-10-16" }, agora)).toBe(
      "pendente"
    );
    expect(linkStatus({ usado_em: null, expira_em: null }, agora)).toBe("pendente");
  });
});

describe("validaCampos — definição do builder", () => {
  it("formato inválido, lista vazia e teto de 40 perguntas", () => {
    expect(validaCampos("não-array")).toEqual({
      error: "Formato de perguntas inválido.",
    });
    expect(validaCampos([])).toEqual({ error: "Adicione pelo menos uma pergunta." });
    expect(
      validaCampos(Array.from({ length: 41 }, (_, i) => campo({ id: `f${i}` })))
    ).toEqual({ error: "Um formulário pode ter até 40 perguntas." });
  });

  it("id vazio/repetido/longo e tipo desconhecido são recusados", () => {
    expect(validaCampos([{ id: "", tipo: "texto", label: "x" }])).toEqual({
      error: "Identificador da pergunta 1 é inválido ou repetido.",
    });
    expect(
      validaCampos([campo(), campo()]) // mesmo id 'f1'
    ).toEqual({ error: "Identificador da pergunta 2 é inválido ou repetido." });
    expect(validaCampos([campo({ id: "x".repeat(61) })])).toEqual({
      error: "Identificador da pergunta 1 é inválido ou repetido.",
    });
    expect(validaCampos([campo({ tipo: "quiz" as never })])).toEqual({
      error: "Tipo inválido na pergunta 1.",
    });
  });

  it("label vazio ou gigante são recusados", () => {
    expect(validaCampos([campo({ label: "   " })])).toEqual({
      error: "Escreva o texto da pergunta 1.",
    });
    expect(validaCampos([campo({ label: "x".repeat(201) })])).toEqual({
      error: "O texto da pergunta 1 passa de 200 caracteres.",
    });
  });

  it("select/multi_select precisam de 2+ opções úteis e até 30", () => {
    const sel = (opcoes: string[]) =>
      campo({ tipo: "select", label: "Escolha", opcoes });
    expect(validaCampos([sel(["só uma"])])).toEqual({
      error: 'A pergunta "Escolha" precisa de pelo menos 2 opções.',
    });
    // dedupe case-insensitive: "Azul" + "azul" + vazia contam como 1
    expect(validaCampos([sel(["Azul", "azul", "  "])])).toEqual({
      error: 'A pergunta "Escolha" precisa de pelo menos 2 opções.',
    });
    // mesma deduplicação no caminho feliz: sobra a 1ª forma de cada opção
    const ok = validaCampos([sel(["Azul", "azul", "verde"])]);
    expect(Array.isArray(ok) && ok[0].opcoes).toEqual(["Azul", "verde"]);
    expect(
      validaCampos([sel(Array.from({ length: 31 }, (_, i) => `op${i}`))])
    ).toEqual({ error: 'A pergunta "Escolha" passa de 30 opções.' });
  });

  it("entrada válida sai saneada: trim, obrigatorio coercido, opções limpas", () => {
    const out = validaCampos([
      { id: "  f1 ", tipo: "texto", label: "  Nome?  ", obrigatorio: "sim" },
      {
        id: "f2",
        tipo: "multi_select",
        label: "Temas",
        obrigatorio: true,
        opcoes: [" Escola ", "", "Família", "família"],
      },
      campo({ id: "f3", tipo: "escala_1_5", opcoes: ["ignorada"] }),
    ]);
    expect(Array.isArray(out)).toBe(true);
    if (!Array.isArray(out)) return;
    expect(out[0]).toEqual({
      id: "f1",
      tipo: "texto",
      label: "Nome?",
      obrigatorio: false, // só `true` literal liga
    });
    expect(out[1].opcoes).toEqual(["Escola", "Família"]);
    expect(out[2].opcoes).toBeUndefined(); // tipos sem opção ignoram o campo
  });
});

describe("respostaFormatada", () => {
  it("formato por tipo de campo", () => {
    expect(respostaFormatada(campo(), undefined)).toBe("—");
    expect(respostaFormatada(campo({ tipo: "sim_nao" }), "sim")).toBe("Sim");
    expect(respostaFormatada(campo({ tipo: "sim_nao" }), "nao")).toBe("Não");
    expect(respostaFormatada(campo({ tipo: "checkbox" }), true)).toBe("Confirmado");
    expect(respostaFormatada(campo({ tipo: "checkbox" }), false)).toBe("Não marcado");
    expect(respostaFormatada(campo({ tipo: "escala_1_5" }), 4)).toBe("4/5");
    expect(respostaFormatada(campo({ tipo: "data" }), "2025-10-07")).toBe(
      "07/10/2025"
    );
    expect(respostaFormatada(campo({ tipo: "multi_select" }), ["a", "b"])).toBe("a, b");
    // sem definição do campo, o valor cru sai como texto
    expect(respostaFormatada(undefined, "livre")).toBe("livre");
  });
});

describe("agregaRespostas", () => {
  const campos = [
    campo({ id: "nota", tipo: "escala_1_5" }),
    campo({ id: "sn", tipo: "sim_nao" }),
    campo({ id: "sel", tipo: "select", opcoes: ["a", "b"] }),
    campo({ id: "multi", tipo: "multi_select", opcoes: ["x", "y"] }),
    campo({ id: "check", tipo: "checkbox" }),
    campo({ id: "txt", tipo: "texto" }),
    campo({ id: "longo", tipo: "texto_longo" }),
    campo({ id: "nasc", tipo: "data" }),
  ];
  const respostas: RespostaComAutor[] = [
    {
      autor: "Ana",
      respostas: {
        nota: 5, sn: "sim", sel: "a", multi: ["x", "y"], check: true,
        txt: "oi", longo: "texto da Ana", nasc: "2009-04-17",
      },
    },
    {
      autor: "Beto",
      respostas: {
        nota: 3, sn: "nao", sel: "b", multi: ["x"], check: false,
        txt: "tchau", longo: "   ", nasc: "2010-01-02",
      },
    },
    {
      autor: "Caio",
      respostas: {
        nota: 4, sn: "sim", sel: "opção removida", multi: [], check: true,
        txt: "...",
      },
    },
  ];

  it("agrega todos os tipos — fechados viram contagem, abertos viram lista", () => {
    const ag = agregaRespostas(campos, respostas);
    expect(ag.map((a) => a.campo.id)).toEqual([
      "nota", "sn", "sel", "multi", "check", "txt", "longo", "nasc",
    ]);

    const nota = ag[0];
    expect(nota.media).toBe(4); // (5+3+4)/3
    expect(nota.contagens).toEqual([
      { rotulo: "1", n: 0 },
      { rotulo: "2", n: 0 },
      { rotulo: "3", n: 1 },
      { rotulo: "4", n: 1 },
      { rotulo: "5", n: 1 },
    ]);

    expect(ag[1].contagens).toEqual([
      { rotulo: "Sim", n: 2 },
      { rotulo: "Não", n: 1 },
    ]);

    // resposta de versão antiga (opção que não existe mais) vira "Outros"
    expect(ag[2].contagens).toEqual([
      { rotulo: "a", n: 1 },
      { rotulo: "b", n: 1 },
      { rotulo: "Outros", n: 1 },
    ]);

    expect(ag[3].contagens).toEqual([
      { rotulo: "x", n: 2 },
      { rotulo: "y", n: 1 },
    ]);
    expect(ag[3].respondidas).toBe(3); // [] conta como respondida
  });

  it("checkbox vira Sim × Não marcado", () => {
    const ag = agregaRespostas(campos, respostas);
    const check = ag.find((a) => a.campo.id === "check")!;
    expect(check.contagens).toEqual([
      { rotulo: "Sim", n: 2 },
      { rotulo: "Não marcado", n: 1 },
    ]);
    expect(check.respondidas).toBe(3);
  });

  it("texto/data viram lista com autoria — branco e ausente não entram", () => {
    const ag = agregaRespostas(campos, respostas);
    const txt = ag.find((a) => a.campo.id === "txt")!;
    expect(txt.itens).toEqual([
      { autor: "Ana", valor: "oi" },
      { autor: "Beto", valor: "tchau" },
      { autor: "Caio", valor: "..." },
    ]);
    expect(txt.contagens).toEqual([]);

    // resposta em branco (opcional) não entra na lista nem na contagem
    const longo = ag.find((a) => a.campo.id === "longo")!;
    expect(longo.itens).toEqual([{ autor: "Ana", valor: "texto da Ana" }]);
    expect(longo.respondidas).toBe(1);

    // data sai formatada dd/mm/aaaa
    const nasc = ag.find((a) => a.campo.id === "nasc")!;
    expect(nasc.itens).toEqual([
      { autor: "Ana", valor: "17/04/2009" },
      { autor: "Beto", valor: "02/01/2010" },
    ]);
    expect(nasc.respondidas).toBe(2);
  });
});
