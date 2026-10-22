import { describe, expect, it } from "vitest";
import {
  catalogoDeTipo,
  COLUNAS_ASSINATURAS,
  COLUNAS_CICLO,
  colunasDeLink,
  configLinkOk,
  estadoLink,
  montarLinhasAssinaturas,
  montarLinhasCiclo,
  resumoRecorteLink,
  textoCelula,
  type RelatorioDadosAssinaturas,
  type RelatorioDadosCiclo,
  type RelatorioLinkConfig,
} from "@/lib/relatorio";

// REALIZA-170 — fronteira do link público: o config salvo decide o recorte
// (tipo + filtros + colunas) e os montadores só dão forma ao que a RPC já
// allowlistou em SQL. O que o teste garante: instrumento/dado civil não tem
// como aparecer — não existe coluna nem campo que o carregue.

const CFG_GRADE: RelatorioLinkConfig = {
  tipo: "grade",
  turma: "T2 · 2026/2027",
  granularidade: "pessoas",
  colunas: ["papel", "nome", "cidade_uf", "status_dupla"],
  expor_contato: false,
};

describe("configLinkOk · contrato do recorte salvo", () => {
  it("aceita os 3 tipos com filtros válidos", () => {
    expect(configLinkOk(CFG_GRADE)).toBe(true);
    expect(
      configLinkOk({ tipo: "ciclo", turma: "T2 · 2026/2027" })
    ).toBe(true);
    expect(
      configLinkOk({
        tipo: "ciclo",
        cronograma_id: "3f7c2a1e-9b4d-4e5f-8a6c-1d2e3f4a5b6c",
      })
    ).toBe(true);
    expect(
      configLinkOk({ tipo: "assinaturas", documento: "termo-voluntario", status_assinatura: "pendente" })
    ).toBe(true);
  });

  it("rejeita tipo fora do allowlist — 'respostas' nunca é recorte", () => {
    for (const t of ["respostas", "anamnese", "avaliacoes", "admin", ""]) {
      expect(configLinkOk({ tipo: t })).toBe(false);
    }
    expect(configLinkOk(null)).toBe(false);
    expect(configLinkOk("grade")).toBe(false);
    expect(configLinkOk({})).toBe(false);
  });

  it("rejeita coluna fora do catálogo do tipo", () => {
    expect(
      configLinkOk({ ...CFG_GRADE, colunas: ["nome", "cpf"] })
    ).toBe(false);
    expect(
      configLinkOk({ ...CFG_GRADE, colunas: ["__alvos"] })
    ).toBe(false);
    // coluna de ciclo não vale em grade (catálogo é do tipo)
    expect(
      configLinkOk({ ...CFG_GRADE, colunas: ["encontro_num"] })
    ).toBe(false);
  });

  it("contato exige o opt-in explícito — coluna pedida sem a flag barra", () => {
    expect(
      configLinkOk({
        ...CFG_GRADE,
        colunas: ["nome", "email", "whatsapp"],
        expor_contato: false,
      })
    ).toBe(false);
    expect(
      configLinkOk({
        ...CFG_GRADE,
        colunas: ["nome", "email"],
        expor_contato: true,
      })
    ).toBe(true);
  });

  it("expor_contato só existe na grade — ciclo/assinaturas não têm coluna de contato", () => {
    expect(configLinkOk({ tipo: "ciclo", expor_contato: true })).toBe(false);
    expect(configLinkOk({ tipo: "assinaturas", expor_contato: true })).toBe(false);
  });

  it("cronograma_id precisa ser uuid — forjado não alarga o recorte", () => {
    expect(configLinkOk({ tipo: "ciclo", cronograma_id: "x' OR 1=1 --" })).toBe(false);
    expect(configLinkOk({ tipo: "ciclo", cronograma_id: 42 })).toBe(false);
  });

  it("status_assinatura só aceita o enum", () => {
    expect(
      configLinkOk({ tipo: "assinaturas", status_assinatura: "rascunho" })
    ).toBe(false);
  });
});

describe("colunasDeLink · default seguro", () => {
  it("grade sem colunas explícitas sai SEM contato", () => {
    const cols = colunasDeLink({ tipo: "grade", granularidade: "pessoas" });
    const ids = cols.map((c) => c.id);
    expect(ids).not.toContain("email");
    expect(ids).not.toContain("whatsapp");
    expect(ids).toContain("nome");
    expect(ids).toContain("status_dupla");
  });

  it("expõe contato só com o opt-in", () => {
    const sem = colunasDeLink({
      tipo: "grade",
      granularidade: "duplas",
      colunas: ["mentor", "mentorado", "contato_mentor"],
      expor_contato: false,
    }).map((c) => c.id);
    expect(sem).not.toContain("contato_mentor");
    const com = colunasDeLink({
      tipo: "grade",
      granularidade: "duplas",
      colunas: ["mentor", "mentorado", "contato_mentor"],
      expor_contato: true,
    }).map((c) => c.id);
    expect(com).toContain("contato_mentor");
  });

  it("ciclo e assinaturas não têm coluna de contato no catálogo", () => {
    const todas = [...COLUNAS_CICLO, ...COLUNAS_ASSINATURAS].map((c) => c.id);
    for (const proibida of ["email", "whatsapp", "contato_mentor", "contato_mentorado"]) {
      expect(todas).not.toContain(proibida);
    }
    expect(catalogoDeTipo("ciclo")).toBe(COLUNAS_CICLO);
    expect(catalogoDeTipo("assinaturas")).toBe(COLUNAS_ASSINATURAS);
  });
});

// ---------- fixtures do ciclo ----------

const DADOS_CICLO: RelatorioDadosCiclo = {
  duplas: [
    {
      id: "d1",
      turma: "T2 · 2026/2027",
      trilha: "dpp",
      cronograma_id: "c1",
      mentor_id: "m1",
      mentorado_id: "j1",
      supervisor_id: "s1",
      status: "ativa",
      iniciada_em: "2026-03-10",
      demanda: null,
    },
  ],
  encontros: [
    {
      id: "e1",
      dupla_id: "d1",
      numero: 2,
      data_hora: "2026-04-14T19:00:00-03:00",
      realizado_em: "2026-04-14T20:30:00-03:00",
      status: "realizado",
      motivo_reagendamento: null,
      duracao_min: 90,
    },
    {
      id: "e2",
      dupla_id: "d1",
      numero: 1,
      data_hora: "2026-04-07T19:00:00-03:00",
      realizado_em: null,
      status: "nao_aconteceu",
      motivo_reagendamento: "Jovem faltou",
      duracao_min: null,
    },
  ],
  registros: [
    {
      encontro_id: "e1",
      created_at: "2026-04-14T21:00:00-03:00",
      avaliacao: "excelente",
      // texto livre do "outro" não pode atravessar — a RPC já filtra e o
      // montador filtra de novo (belt & suspenders)
      atividades: ["Conversa de acompanhamento", "segredo da família digitado no outro"],
    },
  ],
  profiles: [
    { id: "m1", nome: "Marta Souza", cidade: "São Paulo", uf: "SP" },
    { id: "s1", nome: "Rui Auxiliar", cidade: null, uf: null },
  ],
  mentorados: [{ id: "j1", nome: "Ana Lima", cidade: null, uf: null }],
  cronogramas: [{ id: "c1", nome: "Ciclo DPP 2026" }],
};

describe("montarLinhasCiclo · uma linha por encontro", () => {
  it("monta linha por encontro com nomes resolvidos e nº ordenado", () => {
    const linhas = montarLinhasCiclo(DADOS_CICLO);
    expect(linhas).toHaveLength(2);
    // ordena por mentor e depois nº do encontro (1 antes do 2)
    expect(textoCelula(linhas[0], "encontro_num")).toBe("1");
    expect(textoCelula(linhas[1], "encontro_num")).toBe("2");
    expect(textoCelula(linhas[1], "mentor")).toBe("Marta Souza");
    expect(textoCelula(linhas[1], "mentorado")).toBe("Ana Lima");
    expect(textoCelula(linhas[1], "auxiliar")).toBe("Rui Auxiliar");
    expect(textoCelula(linhas[1], "cronograma")).toBe("Ciclo DPP 2026");
    expect(linhas[1].__status).toBe("ativa");
  });

  it("texto livre de atividades não atravessa — só o catálogo sai", () => {
    const linhas = montarLinhasCiclo(DADOS_CICLO);
    const l2 = linhas.find((l) => textoCelula(l, "encontro_num") === "2")!;
    expect(textoCelula(l2, "registro_atividades")).toBe(
      "Conversa de acompanhamento"
    );
    expect(textoCelula(l2, "registro_avaliacao")).toBe("Excelente");
    const l1 = linhas.find((l) => textoCelula(l, "encontro_num") === "1")!;
    expect(textoCelula(l1, "status_encontro")).toBe("não aconteceu");
    expect(textoCelula(l1, "registro_em")).toBe("");
  });

  it("nenhuma linha carrega evidência ou campo interno", () => {
    const linhas = montarLinhasCiclo(DADOS_CICLO);
    for (const l of linhas) {
      const chaves = Object.keys(l);
      for (const proibida of [
        "precisa_apoio", "tema", "reflexoes", "observacoes", "dificuldade",
        "proximo_passo", "dados_snapshot", "ip", "__alvos", "__links",
      ]) {
        expect(chaves).not.toContain(proibida);
      }
    }
  });
});

// ---------- fixtures de assinaturas ----------

const DADOS_ASSIN: RelatorioDadosAssinaturas = {
  assinaturas: [
    {
      id: "a1",
      profile_id: "p1",
      mentorado_id: null,
      status: "assinado",
      assinado_em: "2026-02-10T14:00:00-03:00",
      created_at: "2026-02-09T10:00:00-03:00",
      token_expira_em: null,
      created_by: null, // self-sign — "A própria pessoa"
      template: {
        slug: "termo-voluntario",
        titulo: "Termo de Adesão ao Trabalho Voluntário",
        versao: 1,
        signatario: "profile",
      },
    },
    {
      id: "a2",
      profile_id: null,
      mentorado_id: "j1",
      status: "pendente",
      assinado_em: null,
      created_at: "2026-03-01T10:00:00-03:00",
      token_expira_em: "2026-04-01T00:00:00-03:00",
      created_by: "p1",
      template: {
        slug: "autorizacao-responsavel",
        titulo: "Autorização do Responsável",
        versao: 1,
        signatario: "mentorado",
      },
    },
  ],
  profiles: [{ id: "p1", nome: "Marta Souza", role: "mentor_dpp", cidade: null, uf: null }],
  mentorados: [{ id: "j1", nome: "Ana Lima", cidade: null, uf: null }],
};

describe("montarLinhasAssinaturas · documento + status, sem evidência", () => {
  it("resolve pessoa, papel, documento e status", () => {
    const linhas = montarLinhasAssinaturas(DADOS_ASSIN);
    expect(linhas).toHaveLength(2);
    const marta = linhas.find((l) => textoCelula(l, "nome") === "Marta Souza")!;
    expect(textoCelula(marta, "tipo")).toBe("Mentor DPP");
    expect(textoCelula(marta, "documento")).toBe(
      "Termo de Adesão ao Trabalho Voluntário"
    );
    expect(textoCelula(marta, "status_assinatura")).toBe("Assinado");
    expect(textoCelula(marta, "emitido_por")).toBe("A própria pessoa");
    const ana = linhas.find((l) => textoCelula(l, "nome") === "Ana Lima")!;
    expect(textoCelula(ana, "tipo")).toBe("Mentorado");
    expect(textoCelula(ana, "status_assinatura")).toBe("Pendente");
    expect(textoCelula(ana, "emitido_por")).toBe("Marta Souza");
  });

  it("dado civil e evidência não existem no shape da linha", () => {
    const linhas = montarLinhasAssinaturas(DADOS_ASSIN);
    for (const l of linhas) {
      const chaves = Object.keys(l);
      for (const proibida of [
        "dados_snapshot", "assinatura_texto", "cpf", "rg", "ip",
        "user_agent", "hash_documento", "token",
      ]) {
        expect(chaves).not.toContain(proibida);
      }
    }
  });
});

describe("estadoLink + resumoRecorteLink", () => {
  const passado = new Date(Date.now() - 3600e3).toISOString();
  const futuro = new Date(Date.now() + 3600e3).toISOString();
  it("revogado vence expirado — revogar não ressuscita link vencido", () => {
    expect(estadoLink({ revogado_em: passado, expira_em: futuro })).toBe("revogado");
    expect(estadoLink({ revogado_em: null, expira_em: passado })).toBe("expirado");
    expect(estadoLink({ revogado_em: null, expira_em: futuro })).toBe("ativo");
    expect(estadoLink({ revogado_em: null, expira_em: null })).toBe("ativo");
  });
  it("descreve o recorte numa linha", () => {
    expect(resumoRecorteLink(CFG_GRADE)).toContain("Grade de pessoas");
    expect(resumoRecorteLink(CFG_GRADE)).toContain("sem contato");
    expect(
      resumoRecorteLink({ tipo: "assinaturas", documento: "termo-voluntario", status_assinatura: "assinado" })
    ).toContain("termo-voluntario");
  });
});
