import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import {
  faltantesCivis,
  faltantesDocumento,
  msgLinkAssinatura,
  TEMPLATES_POR_TIPO,
} from "@/lib/documentos/texto";
import { emailDocumentoAssinatura } from "@/lib/email-templates";
import type { DadosCivis, ResponsavelCivis } from "@/lib/types";

const ENDERECO_OK = {
  logradouro: "Rua Vergueiro",
  numero: "1200",
  complemento: null,
  bairro: "Liberdade",
  cidade: "São Paulo",
  uf: "SP",
  cep: "01504001",
};

const CIVIS_OK: DadosCivis = {
  nome_civil: "Marina Duarte Ferreira",
  rg: "34.567.890-1",
  cpf: "123.456.789-09",
  data_nascimento: "1988-03-15",
  endereco: ENDERECO_OK,
};

const RESP_OK: ResponsavelCivis = { ...CIVIS_OK, parentesco: "Mãe" };

describe("faltantesCivis", () => {
  it("ficha vazia lista tudo que o documento precisa", () => {
    expect(faltantesCivis(null)).toEqual([
      "nome civil",
      "RG",
      "CPF",
      "endereço",
      "data de nascimento",
    ]);
  });

  it("ficha completa não gera alerta", () => {
    expect(faltantesCivis(CIVIS_OK)).toEqual([]);
  });

  it("nome sem sobrenome, CPF inválido e endereço incompleto entram na lista", () => {
    expect(
      faltantesCivis({
        nome_civil: "Marina", // sem sobrenome
        rg: "34.567.890-1",
        cpf: "111.111.111-11", // DV inválido
        data_nascimento: "1988-03-15",
        endereco: { ...ENDERECO_OK, numero: "" },
      })
    ).toEqual(["nome civil", "CPF", "endereço"]);
  });

  it("modo responsável: ficha ausente vira um rótulo só", () => {
    expect(faltantesCivis(null, { comResponsavel: true })).toEqual([
      "responsável",
    ]);
  });

  it("modo responsável: parentesco entra na checagem", () => {
    const semParentesco: ResponsavelCivis = { ...CIVIS_OK, parentesco: "" };
    expect(faltantesCivis(semParentesco, { comResponsavel: true })).toEqual([
      "parentesco",
    ]);
    expect(faltantesCivis(RESP_OK, { comResponsavel: true })).toEqual([]);
  });
});

describe("faltantesDocumento", () => {
  it("autorização olha a ficha do responsável, não a do jovem", () => {
    // jovem com civis completo, responsável ausente → alerta "responsável"
    expect(
      faltantesDocumento("autorizacao-responsavel", {
        dados_civis: CIVIS_OK,
        responsavel: null,
      })
    ).toEqual(["responsável"]);
    // responsável completo, jovem pelado → sem alerta (a autorização só
    // precisa dos dados de quem assina)
    expect(
      faltantesDocumento("autorizacao-responsavel", {
        dados_civis: null,
        responsavel: RESP_OK,
      })
    ).toEqual([]);
  });

  it("termos olham os civis do próprio alvo", () => {
    expect(
      faltantesDocumento("termo-voluntario", { dados_civis: CIVIS_OK })
    ).toEqual([]);
    expect(
      faltantesDocumento("termo-mentorando", { dados_civis: null })
    ).toContain("RG");
  });

  it("pool de templates: profile só tem o termo do voluntário", () => {
    expect(TEMPLATES_POR_TIPO.profile.map((t) => t.slug)).toEqual([
      "termo-voluntario",
    ]);
    expect(TEMPLATES_POR_TIPO.mentorado.map((t) => t.slug)).toEqual([
      "termo-mentorando",
      "autorizacao-responsavel",
    ]);
  });
});

describe("msgLinkAssinatura", () => {
  const link = "https://app.test/assinar/abc";

  it("voluntário: fala com a própria pessoa, não com 'o jovem'", () => {
    const msg = msgLinkAssinatura("termo-voluntario", "Ricardo Tavares", link);
    expect(msg).toContain("Ricardo");
    expect(msg).toContain("Seu termo");
    expect(msg).toContain(link);
    expect(msg).not.toContain("responsável");
  });

  it("jovem: termo de participação nomeia o(a) mentorado(a)", () => {
    const msg = msgLinkAssinatura("termo-mentorando", "Kauã Rodrigues", link);
    expect(msg).toContain("Kauã Rodrigues");
    expect(msg).toContain("Programa de Mentoria");
    expect(msg).toContain(link);
  });

  it("autorização: pede pro responsável assinar", () => {
    const msg = msgLinkAssinatura(
      "autorizacao-responsavel",
      "Kauã Rodrigues",
      link
    );
    expect(msg).toContain("responsável");
    expect(msg).toContain("Kauã Rodrigues");
  });
});

describe("emailDocumentoAssinatura", () => {
  it("monta e-mail com saudação, título do doc e o link único", () => {
    const html = emailDocumentoAssinatura({
      docTitulo: "Termo de Adesão ao Trabalho Voluntário",
      primeiroNome: "Ricardo",
      link: "https://app.test/assinar/abc-123",
    });
    if (process.env.EMAIL_PREVIEW)
      writeFileSync("/tmp/email-assinatura.html", html);
    expect(html).toContain("Olá, Ricardo!");
    expect(html).toContain("Termo de Adesão ao Trabalho Voluntário");
    expect(html).toContain("https://app.test/assinar/abc-123");
    expect(html).toContain("Ler e assinar o documento");
    expect(html).toContain("Documento para assinar");
  });

  it("documento de terceiro (autorização) nomeia o(a) jovem", () => {
    const html = emailDocumentoAssinatura({
      docTitulo: "Autorização do Responsável",
      nomePessoa: "Kauã <Rodrigues>",
      primeiroNome: "Sandra",
      link: "https://app.test/assinar/def-456",
    });
    expect(html).toContain("Olá, Sandra!");
    // nome da pessoa é escapado — PII em HTML cru seria quebra
    expect(html).toContain("Kauã &lt;Rodrigues&gt;");
    expect(html).not.toContain("Kauã <Rodrigues>");
  });
});
