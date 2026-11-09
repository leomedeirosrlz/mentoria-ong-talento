// Balões de fala da Liza (lib/liza-falas.ts): apresentação até a pessoa
// abrir a Liza uma vez, depois no máximo uma dica por aba, e quem dispensa
// dicas demais não vê mais nenhuma.

import { describe, expect, it } from "vitest";
import {
  APRESENTACOES_MAX,
  DICAS_DISPENSA_MAX,
  dicaDaPagina,
  proximaFala,
  type MemoriaFalas,
} from "@/lib/liza-falas";

const nova: MemoriaFalas = {
  apresentacoes: 0,
  abriu: false,
  dicasDispensadas: 0,
  falouNaSessao: false,
};
const DUPLA = "/duplas/de000000-0000-0000-0000-000000000001";

describe("proximaFala", () => {
  it("apresenta a Liza pelo primeiro nome, com a pergunta da página no chip", () => {
    const f = proximaFala({
      memoria: nova,
      pagina: "/",
      papeis: ["mentor_dpp"],
      nome: "Ana Paula Souza",
      perguntaPadrao: "Como está minha dupla?",
    });
    expect(f?.tipo).toBe("apresentacao");
    expect(f?.texto).toMatch(/^Oi, Ana! Eu sou a Liza/);
    expect(f?.pergunta).toBe("Como está minha dupla?");
  });

  it("sem nome, a saudação fica genérica", () => {
    const f = proximaFala({ memoria: nova, pagina: "/", papeis: ["mentor_dpp"] });
    expect(f?.texto).toMatch(/^Oi! Eu sou a Liza/);
  });

  it("uma fala por aba", () => {
    expect(
      proximaFala({
        memoria: { ...nova, falouNaSessao: true },
        pagina: "/materiais",
        papeis: ["mentor_dpp"],
      })
    ).toBeNull();
  });

  it("depois de abrir a Liza (ou de esgotar as apresentações) vira dica da página", () => {
    for (const memoria of [
      { ...nova, abriu: true },
      { ...nova, apresentacoes: APRESENTACOES_MAX },
    ]) {
      const f = proximaFala({ memoria, pagina: "/materiais", papeis: ["mentor_dpp"] });
      expect(f?.tipo).toBe("dica");
      expect(f?.pergunta).toBe("O que diz o guia sobre a Roda da Vida?");
    }
  });

  it("página sem dica não fala nada depois da apresentação", () => {
    expect(
      proximaFala({ memoria: { ...nova, abriu: true }, pagina: "/", papeis: ["mentor_dpp"] })
    ).toBeNull();
  });

  it("quem dispensou dicas demais não vê mais nenhuma", () => {
    expect(
      proximaFala({
        memoria: { ...nova, abriu: true, dicasDispensadas: DICAS_DISPENSA_MAX },
        pagina: "/materiais",
        papeis: ["mentor_dpp"],
      })
    ).toBeNull();
  });
});

describe("dicaDaPagina", () => {
  it("ficha da dupla oferece o resumo pra quem conduz, não pro jovem", () => {
    expect(dicaDaPagina(DUPLA, ["mentor_dpp"])?.pergunta).toBe("Resuma esta dupla");
    expect(dicaDaPagina(DUPLA, ["mentorado"])).toBeNull();
  });

  it("lista de duplas só pra staff; agenda não pro jovem", () => {
    expect(dicaDaPagina("/duplas", ["coordenacao"])?.pergunta).toBe("Quem está em risco?");
    expect(dicaDaPagina("/duplas", ["mentor_dpp"])).toBeNull();
    expect(dicaDaPagina("/agenda", ["mentor_dpp"])?.pergunta).toBe("Encontros desta semana");
    expect(dicaDaPagina("/agenda", ["mentorado"])).toBeNull();
  });

  it("copy sem travessão", () => {
    for (const [pag, pap] of [
      [DUPLA, "mentor_dpp"],
      ["/materiais", "mentor_dpp"],
      ["/agenda", "mentor_dpp"],
      ["/duplas", "coordenacao"],
    ] as const)
      expect(dicaDaPagina(pag, [pap])?.texto).not.toMatch(/[—–]/);
  });

  it("ramos /jovem só pro mentorado", () => {
    expect(dicaDaPagina("/jovem/agenda", ["mentorado"])?.pergunta).toBe(
      "Quando é o próximo encontro?"
    );
    expect(dicaDaPagina("/jovem/especialistas", ["mentorado"])?.pergunta).toBe(
      "E meu pedido de especialista?"
    );
    expect(dicaDaPagina("/jovem/materiais", ["mentorado"])?.pergunta).toBe(
      "O que é o PDM?"
    );
    expect(dicaDaPagina("/jovem", ["mentorado"])?.pergunta).toBe(
      "O que tenho pra fazer?"
    );
    // staff nunca navega /jovem (o layout redireciona), mas se caísse
    // ali a dica não pode fingir voz de mentorado
    expect(dicaDaPagina("/jovem/agenda", ["coordenacao"])).toBeNull();
    expect(dicaDaPagina("/jovem", ["mentor_dpp"])).toBeNull();
  });
});
