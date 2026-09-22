import { describe, expect, it } from "vitest";
import {
  emailValido,
  mapEscolaridade,
  mapGenero,
  mapPrefGenero,
  mapRole,
  normData,
  normEmail,
  normLista,
  normNome,
  normUf,
  normWhatsapp,
  parseCsv,
} from "@/lib/importar";

describe("parseCsv — detecção de delimitador e cabeçalho", () => {
  it("ponto e vírgula (Excel BR), vírgula e tab", () => {
    const csv = "nome;email;whatsapp\nAna;ana@x.com;11999998888";
    const r = parseCsv(csv);
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0]).toMatchObject({
      nome: "Ana",
      email: "ana@x.com",
      whatsapp: "11999998888",
    });

    expect(parseCsv("nome,email\nAna,ana@x.com").linhas[0].email).toBe("ana@x.com");
    expect(parseCsv("nome\temail\nAna\tana@x.com").linhas[0].email).toBe("ana@x.com");
  });

  it("cabeçalho sem coluna de nome descarta tudo e conta ignoradas", () => {
    const r = parseCsv("email;whatsapp\na@x.com;1199\nb@y.com;1188");
    expect(r.linhas).toEqual([]);
    expect(r.ignoradas).toBe(3); // header + 2 linhas
  });

  it("arquivo com menos de 2 registros não tem o que importar", () => {
    expect(parseCsv("nome;email")).toEqual({ linhas: [], ignoradas: 0 });
    expect(parseCsv("")).toEqual({ linhas: [], ignoradas: 0 });
  });

  it("linha sem o delimitador do header não é dado válido", () => {
    const r = parseCsv("nome;email\nAna;ana@x.com\nlinha quebrada sem separador");
    expect(r.linhas).toHaveLength(1);
    expect(r.ignoradas).toBe(1);
  });

  it("linha sem nome é pulada e contada", () => {
    const r = parseCsv("nome;email\nAna;a@x.com\n;sem-nome@x.com\nBia;b@y.com");
    expect(r.linhas.map((l) => l.nome)).toEqual(["Ana", "Bia"]);
    expect(r.ignoradas).toBe(1);
  });
});

describe("parseCsv — aspas e quebras", () => {
  it("campo entre aspas pode ter o delimitador e quebra de linha", () => {
    const r = parseCsv(
      'nome;notas\n"Silva; Ana";"primeira linha\nsegunda linha"'
    );
    expect(r.linhas[0].nome).toBe("Silva; Ana");
    expect(r.linhas[0].notas).toBe("primeira linha\nsegunda linha");
  });

  it('"" dentro de aspas é aspas literal', () => {
    const r = parseCsv('nome;notas\nAna;"disse ""oi"" pra todos"');
    expect(r.linhas[0].notas).toBe('disse "oi" pra todos');
  });

  it("CRLF e células com espaço são saneados", () => {
    const r = parseCsv("nome;email\r\n  Ana  ;  a@x.com  \r\nBia;b@y.com");
    expect(r.linhas.map((l) => l.nome)).toEqual(["Ana", "Bia"]);
    expect(r.linhas[0].email).toBe("a@x.com");
  });
});

describe("parseCsv — cabeçalhos canônicos", () => {
  // "<header>;nome\nvalor;Ana" — em qual campo o "valor" aterrissou?
  function campoDe(header: string): string | null {
    const r = parseCsv(`${header};nome\nvalor;Ana`);
    const linha = r.linhas[0];
    if (!linha) return null;
    return (
      Object.keys(linha).find(
        (k) => linha[k as keyof typeof linha] === "valor"
      ) ?? null
    );
  }

  it("mapeia apelidos comuns de planilha pt-BR", () => {
    expect(campoDe("nome")).toBe("nome");
    expect(campoDe("E-mail")).toBe("email");
    expect(campoDe("WhatsApp")).toBe("whatsapp");
    expect(campoDe("Nome social")).toBe("nome_social");
    expect(campoDe("Papel")).toBe("papel");
    expect(campoDe("Função")).toBe("papel");
    expect(campoDe("Gênero")).toBe("genero");
    expect(campoDe("Pref. gênero do par")).toBe("pref_genero_par");
    expect(campoDe("Tipo de gênero")).toBe("genero"); // o 'tipo' não sequestra
    expect(campoDe("Data de nascimento")).toBe("data_nascimento");
    expect(campoDe("Cidade")).toBe("cidade");
    expect(campoDe("UF")).toBe("uf");
    expect(campoDe("Estado")).toBe("uf");
    expect(campoDe("Interesses")).toBe("interesses");
    expect(campoDe("Motivação")).toBe("motivacao");
    expect(campoDe("ONG")).toBe("ong");
    expect(campoDe("Organização")).toBe("ong");
    expect(campoDe("Notas")).toBe("notas");
    expect(campoDe("Observações")).toBe("notas");
    expect(campoDe("Objetivos")).toBe("objetivos");
    expect(campoDe("Escolaridade")).toBe("escolaridade");
    expect(campoDe("Experiência prévia")).toBe("experiencia_previa");
    expect(campoDe("Formação externa")).toBe("formacao_externa");
    expect(campoDe("Cargo")).toBe("cargo");
    expect(campoDe("Empresa")).toBe("empresa");
    expect(campoDe("Origem")).toBe("origem");
    expect(campoDe("Como conheceu")).toBe("origem");
  });

  it("substring não sequestra: 'sobrenome' não é nome, 'longo' não é ong", () => {
    // 'sobrenome' sozinho → sem coluna nome → linhas descartadas
    const r = parseCsv("sobrenome;email\nSilva;a@x.com");
    expect(r.linhas).toEqual([]);
    // headers sem campo canônico são ignorados
    expect(campoDe("Quanto tempo")).toBeNull();
    expect(campoDe("longo")).toBeNull();
  });

  it("coluna desconhecida é ignorada; primeira coluna do campo vence", () => {
    const r = parseCsv("nome;xyz;email\nAna;???;a@x.com");
    expect(r.linhas[0].email).toBe("a@x.com");
    expect("xyz" in r.linhas[0]).toBe(false);

    const dup = parseCsv("nome;nome\nAna;Ignorado");
    expect(dup.linhas[0].nome).toBe("Ana");
  });
});

describe("normWhatsapp", () => {
  it("DD+número BR ganha prefixo 55; já com DDI (+) não duplica", () => {
    expect(normWhatsapp("(11) 98765-4321")).toBe("5511987654321");
    expect(normWhatsapp("11 98765 4321")).toBe("5511987654321");
    expect(normWhatsapp("+55 11 98765-4321")).toBe("5511987654321");
    expect(normWhatsapp("+1 415 555 0132")).toBe("14155550132");
  });

  it("0800/curto/dígitos demais não são whatsapp", () => {
    expect(normWhatsapp("0800 123 4567")).toBeNull(); // começa com 0
    expect(normWhatsapp("98765")).toBeNull(); // menos de 10 dígitos
    expect(normWhatsapp("")).toBeNull();
  });

  it("mais de 11 dígitos sem + volta como está (DDI embutido)", () => {
    expect(normWhatsapp("55119876543211")).toBe("55119876543211");
  });
});

describe("mapRole", () => {
  it("mapeia os 4 papéis com sinônimos e sem acento", () => {
    expect(mapRole("coordenação")).toBe("coordenacao");
    expect(mapRole("Coordenadora")).toBe("coordenacao");
    expect(mapRole("supervisor")).toBe("supervisor");
    expect(mapRole("Mentor")).toBe("mentor_dpp");
    expect(mapRole("DPP")).toBe("mentor_dpp");
    expect(mapRole("especialista")).toBe("mentor_especialista");
    // 'especial' vence 'mentor' — "mentor especialista" é a trilha certa
    expect(mapRole("Mentor Especialista")).toBe("mentor_especialista");
  });

  it("vazio ou irreconhecível devolve null", () => {
    expect(mapRole("")).toBeNull();
    expect(mapRole("jovem")).toBeNull();
  });
});

describe("emailValido / normEmail / normNome", () => {
  it("aceita e-mails comuns e recusa formatos quebrados", () => {
    expect(emailValido("ana@x.com")).toBe(true);
    expect(emailValido("ana.maria@empresa.com.br")).toBe(true); // domínio multi-label
    expect(emailValido("a@b.c")).toBe(false); // TLD de 1 char
    expect(emailValido("a@b.com.")).toBe(false); // ponto no fim
    expect(emailValido("a b@c.com")).toBe(false);
    expect(emailValido("a..b@c.com")).toBe(false); // ponto duplo
    expect(emailValido("@b.com")).toBe(false);
    expect(emailValido("a@.com")).toBe(false);
    expect(emailValido("")).toBe(false);
  });

  it("normEmail baixa caixa e normNome colapsa espaços", () => {
    expect(normEmail("  ANA@X.COM ")).toBe("ana@x.com");
    expect(normNome("  Ana   Maria  ")).toBe("Ana Maria");
  });
});

describe("normData / normUf / normLista", () => {
  it("datas BR e ISO viram ISO; impossíveis viram null", () => {
    expect(normData("14/10/2025")).toBe("2025-10-14");
    expect(normData("5-3-2025")).toBe("2025-03-05");
    expect(normData("2025-10-14")).toBe("2025-10-14");
    expect(normData("31/02/2025")).toBeNull(); // Date normalizaria — rejeitado
    expect(normData("2025-02-30")).toBeNull();
    expect(normData("não é data")).toBeNull();
    expect(normData("")).toBeNull();
  });

  it("UF sai em sigla maiúscula de qualquer formato", () => {
    expect(normUf("sp")).toBe("SP");
    expect(normUf("São Paulo - SP")).toBe("SP");
    expect(normUf("")).toBeNull();
    expect(normUf("x")).toBeNull();
    expect(normUf("abc")).toBeNull();
  });

  it("listas separam por ; | ou , e limpam espaços", () => {
    expect(normLista("esportes; música | leitura, jogos")).toEqual([
      "esportes",
      "música",
      "leitura",
      "jogos",
    ]);
    expect(normLista("  muita   coisa  ")).toEqual(["muita coisa"]);
    expect(normLista("")).toEqual([]);
  });
});

describe("mapGenero / mapPrefGenero / mapEscolaridade", () => {
  it("gênero aceita sinônimos do vocabulário do CHECK", () => {
    expect(mapGenero("Feminino")).toBe("feminino");
    expect(mapGenero("mulher")).toBe("feminino");
    expect(mapGenero("masculino")).toBe("masculino");
    expect(mapGenero("homem")).toBe("masculino");
    expect(mapGenero("não-binário")).toBe("nao_binario");
    expect(mapGenero("nb")).toBe("nao_binario");
    expect(mapGenero("prefiro não dizer")).toBe("prefiro_nao_dizer");
    expect(mapGenero("outro")).toBe("outro");
    expect(mapGenero("")).toBeNull();
    expect(mapGenero("xyz")).toBeNull();
  });

  it("preferência de gênero do par", () => {
    expect(mapPrefGenero("indiferente")).toBe("indiferente");
    expect(mapPrefGenero("tanto faz")).toBe("indiferente");
    expect(mapPrefGenero("sem preferência")).toBe("indiferente");
    expect(mapPrefGenero("feminino")).toBe("feminino");
    expect(mapPrefGenero("masculino")).toBe("masculino");
    expect(mapPrefGenero("")).toBeNull();
  });

  it("escolaridade — 'incompleto' antes de 'superior'", () => {
    expect(mapEscolaridade("Ensino fundamental")).toBe("fundamental");
    expect(mapEscolaridade("ensino médio")).toBe("medio");
    expect(mapEscolaridade("Técnico")).toBe("tecnico");
    expect(mapEscolaridade("Pós-graduação")).toBe("pos");
    expect(mapEscolaridade("MBA")).toBe("pos");
    expect(mapEscolaridade("superior incompleto")).toBe("superior_incompleto");
    expect(mapEscolaridade("cursando faculdade")).toBe("superior_incompleto");
    expect(mapEscolaridade("Superior completo")).toBe("superior");
    expect(mapEscolaridade("graduação")).toBe("superior");
    expect(mapEscolaridade("")).toBeNull();
  });
});
