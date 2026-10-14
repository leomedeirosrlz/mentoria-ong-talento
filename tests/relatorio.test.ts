import { describe, expect, it } from "vitest";
import {
  montarLinhas,
  textoCelula,
  type DuplaFonte,
  type PessoaFonte,
  type RelatorioConfig,
} from "@/lib/relatorio";

// Grade de relatórios — derivação pura das linhas e, principalmente, os
// metadados `__*` que alimentam a edição inline e os chips: quem tem alvo,
// quem não tem (e-mail de conta vinculada) e o que o resumo público recebe.

const MENTOR: PessoaFonte = {
  id: "m-1",
  user_id: null,
  nome: "Marta Souza",
  email: "marta@ex.com",
  whatsapp: "5511999990001",
  cidade: "São Paulo",
  uf: "SP",
};
const MENTOR_LOGADO: PessoaFonte = { ...MENTOR, id: "m-2", user_id: "u-2" };
const JOVEM: PessoaFonte = {
  id: "j-1",
  nome: "Ana Lima",
  email: "ana@ex.com",
  whatsapp: "5511999990002",
  cidade: null,
  uf: null,
};
const DUPLA: DuplaFonte = {
  id: "d-1",
  turma: "T2 · 2026/2027",
  mentor_id: "m-1",
  mentorado_id: "j-1",
  supervisor_id: null,
  status: "ativa",
  iniciada_em: "2026-03-10",
  demanda: null,
};

const CFG_PESSOAS: RelatorioConfig = {
  turma: "T2 · 2026/2027",
  granularidade: "pessoas",
  colunas: [],
};
const CFG_DUPLAS: RelatorioConfig = { ...CFG_PESSOAS, granularidade: "duplas" };

const mapa = (...ps: PessoaFonte[]) => new Map(ps.map((p) => [p.id, p]));

describe("montarLinhas · metadados de exibição", () => {
  it("carrega __status cru e __papel em qualquer contexto", () => {
    const linhas = montarLinhas(CFG_PESSOAS, [DUPLA], mapa(MENTOR), mapa(JOVEM));
    const mentor = linhas.find((l) => textoCelula(l, "papel") === "Mentor(a)")!;
    const jovem = linhas.find((l) => textoCelula(l, "papel") === "Mentorado(a)")!;
    expect(mentor.__status).toBe("ativa");
    expect(mentor.__papel).toBe("mentor");
    expect(jovem.__papel).toBe("mentorado");
    expect(textoCelula(mentor, "status_dupla")).toBe("Ativa");
  });

  it("sem paraApp não emite __alvos nem __links (resumo público)", () => {
    const linhas = montarLinhas(CFG_PESSOAS, [DUPLA], mapa(MENTOR), mapa(JOVEM));
    for (const l of linhas) {
      expect(l.__alvos).toBeUndefined();
      expect(l.__links).toBeUndefined();
    }
  });
});

describe("montarLinhas · alvos de edição (paraApp)", () => {
  it("linha por pessoa mira profiles/mentorados nos campos de cadastro", () => {
    const linhas = montarLinhas(CFG_PESSOAS, [DUPLA], mapa(MENTOR), mapa(JOVEM), {
      paraApp: true,
    });
    const mentor = linhas.find((l) => textoCelula(l, "papel") === "Mentor(a)")!;
    expect(mentor.__alvos?.nome).toEqual([
      { tabela: "profiles", id: "m-1", campo: "nome", valor: "Marta Souza" },
    ]);
    // célula composta: um alvo por campo, na ordem da célula
    expect(mentor.__alvos?.cidade_uf).toEqual([
      { tabela: "profiles", id: "m-1", campo: "cidade", valor: "São Paulo" },
      { tabela: "profiles", id: "m-1", campo: "uf", valor: "SP" },
    ]);
    const jovem = linhas.find((l) => textoCelula(l, "papel") === "Mentorado(a)")!;
    expect(jovem.__alvos?.whatsapp?.[0]).toMatchObject({
      tabela: "mentorados",
      id: "j-1",
      campo: "whatsapp",
    });
  });

  it("colunas derivadas nunca têm alvo", () => {
    const linhas = montarLinhas(CFG_PESSOAS, [DUPLA], mapa(MENTOR), mapa(JOVEM), {
      paraApp: true,
    });
    for (const l of linhas) {
      for (const col of ["papel", "par", "status_dupla", "iniciada_em", "demanda", "auxiliar"]) {
        expect(l.__alvos?.[col], col).toBeUndefined();
      }
    }
  });

  it("e-mail de profile com conta vinculada não é alvo (0060)", () => {
    const linhas = montarLinhas(
      CFG_PESSOAS,
      [{ ...DUPLA, mentor_id: "m-2" }],
      mapa(MENTOR_LOGADO),
      mapa(JOVEM),
      { paraApp: true }
    );
    const mentor = linhas.find((l) => textoCelula(l, "papel") === "Mentor(a)")!;
    expect(mentor.__alvos?.email).toBeUndefined();
    // o resto do cadastro segue editável
    expect(mentor.__alvos?.whatsapp).toHaveLength(1);
    // mentorados.email é contato, não identidade — segue alvo
    const jovem = linhas.find((l) => textoCelula(l, "papel") === "Mentorado(a)")!;
    expect(jovem.__alvos?.email).toHaveLength(1);
  });

  it("par vira link pra ficha da dupla", () => {
    const linhas = montarLinhas(CFG_PESSOAS, [DUPLA], mapa(MENTOR), mapa(JOVEM), {
      paraApp: true,
    });
    for (const l of linhas) expect(l.__links?.par).toBe("/duplas/d-1");
  });

  it("linha por dupla mira os campos compostos de contato", () => {
    const linhas = montarLinhas(CFG_DUPLAS, [DUPLA], mapa(MENTOR), mapa(JOVEM), {
      paraApp: true,
    });
    expect(linhas).toHaveLength(1);
    const l = linhas[0];
    expect(l.__alvos?.mentor?.[0]).toMatchObject({ tabela: "profiles", campo: "nome" });
    expect(l.__alvos?.mentorado?.[0]).toMatchObject({ tabela: "mentorados", campo: "nome" });
    // contato = whatsapp + email, na ordem da célula
    expect(l.__alvos?.contato_mentor?.map((a) => a.campo)).toEqual(["whatsapp", "email"]);
    expect(l.__alvos?.contato_mentorado?.map((a) => a.campo)).toEqual(["whatsapp", "email"]);
  });
});
