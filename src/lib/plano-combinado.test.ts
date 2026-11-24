import { describe, expect, it } from "vitest";
import {
  aceitesDoPlano,
  combinadoDoJovem,
  estadoLeituraPlano,
  resumoCombinado,
} from "./plano-combinado";
import { fraseDoCombinado } from "@/components/plano-em-dia-pecas";

// ---------- estadoLeituraPlano — a leitura única do combinado (518) ----------
// 0225: proposta de lado nasce `aceito`; a da equipe nasce `proposto` e o
// primeiro aceite da dupla a coloca em vigor. Não existe "faltam os dois".

describe("estadoLeituraPlano", () => {
  const aceitesNinguem = { mentor: false, mentorado: false };

  it("proposta da equipe: falta um aceite da dupla — pra quem é lado, o seu", () => {
    expect(
      estadoLeituraPlano({
        status: "proposto",
        meuLado: "mentor",
        aceites: aceitesNinguem,
      })
    ).toBe("proposto_staff_falta_meu");
    expect(
      estadoLeituraPlano({
        status: "proposto",
        meuLado: "mentorado",
        aceites: aceitesNinguem,
      })
    ).toBe("proposto_staff_falta_meu");
  });

  it("proposta da equipe lida pela equipe: esperando a dupla", () => {
    expect(
      estadoLeituraPlano({
        status: "proposto",
        meuLado: null,
        aceites: aceitesNinguem,
      })
    ).toBe("proposto_staff_falta_outro");
  });

  it("legado bilateral: quem já carimbou lê 'esperando o outro'", () => {
    expect(
      estadoLeituraPlano({
        status: "proposto",
        meuLado: "mentor",
        aceites: { mentor: true, mentorado: false },
      })
    ).toBe("proposto_staff_falta_outro");
  });

  it("combinado em vigor sem o meu carimbo: fui avisado, não devo aceite", () => {
    const aceites = { mentor: true, mentorado: false };
    expect(
      estadoLeituraPlano({ status: "aceito", meuLado: "mentorado", aceites })
    ).toBe("ativo_sem_minha_ciencia");
    expect(
      estadoLeituraPlano({ status: "ativo", meuLado: "mentorado", aceites })
    ).toBe("ativo_sem_minha_ciencia");
  });

  it("combinado em vigor com o meu carimbo — e pra equipe", () => {
    const aceites = { mentor: true, mentorado: false };
    expect(
      estadoLeituraPlano({ status: "aceito", meuLado: "mentor", aceites })
    ).toBe("ativo");
    expect(
      estadoLeituraPlano({ status: "ativo", meuLado: null, aceites })
    ).toBe("ativo");
  });

  it("contestado é terminal na leitura; fechados não pedem nada", () => {
    expect(
      estadoLeituraPlano({
        status: "contestado",
        meuLado: "mentor",
        aceites: aceitesNinguem,
      })
    ).toBe("contestado");
    expect(
      estadoLeituraPlano({
        status: "concluido",
        meuLado: "mentor",
        aceites: aceitesNinguem,
      })
    ).toBeNull();
    expect(
      estadoLeituraPlano({
        status: "expirado",
        meuLado: null,
        aceites: aceitesNinguem,
      })
    ).toBeNull();
  });
});

// ---------- resumoCombinado — falta "dupla", nunca "os dois" ----------

describe("resumoCombinado", () => {
  const planoBase = {
    id: "p-1",
    versao: 1,
    aprovado_lado: null,
    escopo: {
      ritmo: 2,
      janela: { inicio: "2026-01-12", fim: "2026-02-10" },
      passos: [
        { numero: 14, data: "2026-01-13", acao: "agendar" },
        { numero: 15, data: "2026-01-20", acao: "agendar" },
      ],
    },
    proposto_em: "2026-01-11T10:00:00Z",
  };

  it("proposta da equipe sem carimbo: quem falta é a dupla", () => {
    const r = resumoCombinado({ ...planoBase, status: "proposto" });
    expect(r.falta).toBe("dupla");
    expect(r.aceites).toEqual({ mentor: false, mentorado: false });
    expect(r.aberto).toBe(true);
    expect(r.propostoEm).toBe("2026-01-11T10:00:00Z");
  });

  it("proposta com um carimbo (legado): falta o outro lado", () => {
    const r = resumoCombinado({
      ...planoBase,
      status: "proposto",
      aceites: { mentor: true, mentorado: false },
    });
    expect(r.falta).toBe("mentorado");
  });

  it("em vigor não tem 'falta' — o outro lado foi avisado", () => {
    const r = resumoCombinado({
      ...planoBase,
      status: "aceito",
      aceites: { mentor: true, mentorado: false },
    });
    expect(r.falta).toBeNull();
    expect(r.aberto).toBe(true);
    expect(r.total).toBe(2);
    expect(r.proximo?.numero).toBe(14);
    expect(r.ate).toBe("2026-01-20");
  });
});

// ---------- aceitesDoPlano / combinadoDoJovem — projeções 0225 ----------

describe("aceitesDoPlano", () => {
  it("carimbos da 0224 mandam; aprovado_lado é o fallback da leitura antiga", () => {
    expect(
      aceitesDoPlano({
        aprovado_lado: "mentor",
        aceito_mentor_em: "2026-01-11",
        aceito_mentorado_em: null,
      })
    ).toEqual({ mentor: true, mentorado: false });
    expect(aceitesDoPlano({ aprovado_lado: "mentorado" })).toEqual({
      mentor: false,
      mentorado: true,
    });
  });
});

describe("combinadoDoJovem", () => {
  it("recorte da RPC jovem_plano vira a projeção das superfícies (0225)", () => {
    const p = combinadoDoJovem({
      id: "p-9",
      status: "proposto",
      versao: 2,
      ritmo: "3",
      janela: { inicio: "2026-01-12", fim: "2026-02-10" },
      passos: [{ numero: 15, data: "2026-01-20", acao: "agendar" }],
      aprovado_lado: null,
      aceito_mentor: false,
      aceito_mentorado: false,
      proposto_em: "2026-01-11T10:00:00Z",
      expira_em: "2026-02-01",
      passos_aplicados: [],
    });
    expect(p.status).toBe("proposto");
    expect(p.aceites).toEqual({ mentor: false, mentorado: false });
    expect(p.escopo?.ritmo).toBe(3);
    expect(p.proposto_em).toBe("2026-01-11T10:00:00Z");
    // a mesma projeção alimenta a máquina de leitura do lado mentorado
    expect(
      estadoLeituraPlano({
        status: p.status,
        meuLado: "mentorado",
        aceites: p.aceites!,
      })
    ).toBe("proposto_staff_falta_meu");
  });
});

// ---------- fraseDoCombinado — a copy que sai da máquina (518) ----------
// FR-008: nada de "os dois aceitarem"; no ativo não se fala "aceitar" —
// quem não carimbou foi avisado e pode contestar.

describe("fraseDoCombinado", () => {
  const resumoBase = {
    aberto: true,
    aceites: { mentor: false, mentorado: false },
    falta: null,
    passos: [],
    total: 2,
    marcados: 0,
    feitos: 0,
    proximo: null,
    ate: "2026-02-10",
    propostoEm: "2026-01-11T10:00:00Z",
  };

  it("proposta da equipe: 'um aceite da dupla', nunca 'os dois'", () => {
    const f = fraseDoCombinado(
      { ...resumoBase, status: "proposto", falta: "dupla" },
      "jovem",
      "Paulo"
    );
    expect(f.pill).toMatch(/aceite da dupla/i);
    expect(f.texto).not.toMatch(/os dois/i);
    expect(f.cta).toBe("Ver e responder");
  });

  it("em vigor sem o meu carimbo: 'Fulano combinou', avisado em data — sem pedir aceite", () => {
    const f = fraseDoCombinado(
      {
        ...resumoBase,
        status: "aceito",
        aceites: { mentor: true, mentorado: false },
      },
      "jovem",
      "Paulo"
    );
    expect(f.pill).toBe("Plano em vigor");
    expect(f.texto).toMatch(/Paulo combinou/);
    expect(f.texto).toMatch(/avisado em/);
    expect(f.texto).toMatch(/contestar/);
    expect(`${f.texto} ${f.cta} ${f.pill}`).not.toMatch(/aceit/i);
    expect(f.cta).toBe("Ver o combinado");
  });

  it("em vigor com o meu carimbo: segue o plano, sem falar de aceite", () => {
    const f = fraseDoCombinado(
      {
        ...resumoBase,
        status: "ativo",
        aceites: { mentor: true, mentorado: true },
        proximo: {
          numero: 14,
          data: "2026-01-13",
          estado: "pendente",
          marcadoEm: null,
        },
      },
      "mentor",
      "Dandara"
    );
    expect(f.pill).toBe("Plano combinado");
    expect(`${f.texto} ${f.cta}`).not.toMatch(/aceit/i);
  });
});
