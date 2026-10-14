import { describe, expect, it } from "vitest";
import {
  emailValido,
  normalizaCorRaca,
  normalizaData,
  normalizaEmail,
  normalizaEscolaridade,
  normalizaGenero,
  normalizaPapel,
  normalizaPorFormato,
  normalizaPrefGenero,
  normalizaTelefone,
  normalizaTexto,
  normalizaUrl,
  semAcento,
} from "@/lib/forms/normaliza";

// REALIZA-118 — a lib é o coração do resgate: "normalizar agressivamente,
// rejeitar só o impossível". Cada caso aqui é sujeira real de planilha
// exportada do Google Forms.

describe("normalizaTexto", () => {
  it("trim + colapso de espaço interno; vazio vira null", () => {
    expect(normalizaTexto("  Maria   Silva \n")).toEqual({
      valor: "Maria Silva",
      mudou: true,
    });
    expect(normalizaTexto("Maria Silva")).toEqual({
      valor: "Maria Silva",
      mudou: false,
    });
    expect(normalizaTexto("   ")).toEqual({ valor: null, mudou: false });
  });
});

describe("normalizaEmail — resgates do Google Forms", () => {
  it('"@@" colapsa pra "@" (o clássico do ticket)', () => {
    expect(normalizaEmail("maria@@gmail.com")).toEqual({
      valor: "maria@gmail.com",
      mudou: true,
    });
    expect(normalizaEmail("joao@@@empresa.com.br").valor).toBe(
      "joao@empresa.com.br"
    );
  });

  it("caixa, espaços e envoltório de cópia/cola saem de graça", () => {
    expect(normalizaEmail("  MARIA@Gmail.COM ")).toEqual({
      valor: "maria@gmail.com",
      mudou: true,
    });
    expect(normalizaEmail("joao @ gmail . com").valor).toBe("joao@gmail.com");
    expect(normalizaEmail("mailto:ana@ong.org").valor).toBe("ana@ong.org");
    expect(normalizaEmail("<ana@ong.org>").valor).toBe("ana@ong.org");
    expect(normalizaEmail('"ana@ong.org",').valor).toBe("ana@ong.org");
  });

  it("e-mail já limpo volta intacto e sem diff", () => {
    expect(normalizaEmail("maria@gmail.com")).toEqual({
      valor: "maria@gmail.com",
      mudou: false,
    });
  });

  it("vírgula no lugar do ponto do domínio resgata com aviso", () => {
    const r = normalizaEmail("maria@gmail,com");
    expect(r.valor).toBe("maria@gmail.com");
    expect(r.aviso).toMatch(/vírgula/);
  });

  it("célula com mais de um e-mail fica o primeiro e pede revisão", () => {
    const r = normalizaEmail("maria@gmail.com; joao@x.com");
    expect(r.valor).toBe("maria@gmail.com");
    expect(r.aviso).toMatch(/mais de um e-mail/);
    // separador "e" também conta — mas só quando os dois lados têm "@"
    const r2 = normalizaEmail("a@x.com e b@y.com");
    expect(r2.valor).toBe("a@x.com");
    expect(r2.aviso).toBeTruthy();
  });

  it("vírgula que é ponto NÃO parte a célula (só separa quando todos têm @)", () => {
    const r = normalizaEmail("maria@gmail,com,extra");
    // "extra" não tem "@" → não é lista; a vírgula vira ponto
    expect(r.valor).toBe("maria@gmail.com.extra");
  });

  it("o impossível volta null — sem @ ou domínio inválido", () => {
    expect(normalizaEmail("").valor).toBeNull();
    expect(normalizaEmail("sem arroba").valor).toBeNull();
    expect(normalizaEmail("maria@").valor).toBeNull();
    expect(normalizaEmail("maria@gmail").valor).toBeNull();
    expect(normalizaEmail("@gmail.com").valor).toBeNull();
  });
});

describe("normalizaTelefone — WhatsApp 55DDDNUMERO", () => {
  it('"(11)9.9999-8888" — máscara + ponto no meio (caso do ticket)', () => {
    expect(normalizaTelefone("(11)9.9999-8888")).toEqual({
      valor: "5511999998888",
      mudou: true,
    });
  });

  it("DDD+número BR sem DDI ganha 55; com '+' o DDI já veio", () => {
    expect(normalizaTelefone("11 98765-4321").valor).toBe("5511987654321");
    expect(normalizaTelefone("+55 11 98765-4321").valor).toBe("5511987654321");
    expect(normalizaTelefone("+1 415 555 1234").valor).toBe("14155551234");
  });

  it("notação científica de planilha expande antes de extrair", () => {
    expect(normalizaTelefone("1.1984788783E10").valor).toBe("5511984788783");
  });

  it("zero de DDD à esquerda resgata — com aviso pra conferir", () => {
    const r = normalizaTelefone("0 11 98888-7777");
    expect(r.valor).toBe("5511988887777");
    expect(r.aviso).toMatch(/zero/);
  });

  it("0800/0900 é serviço, não WhatsApp — segue impossível", () => {
    expect(normalizaTelefone("0800 123 4567").valor).toBeNull();
    expect(normalizaTelefone("0900 123 4567").valor).toBeNull();
    expect(normalizaTelefone("123").valor).toBeNull();
  });

  it('"/" dentro do número não parte a formatação ("11/98888-7777")', () => {
    expect(normalizaTelefone("11/98888-7777").valor).toBe("5511988887777");
  });

  it("dois números na célula ficam o primeiro + revisão", () => {
    const r = normalizaTelefone("11 98888-7777 ou 11 97777-6666");
    expect(r.valor).toBe("5511988887777");
    expect(r.aviso).toMatch(/mais de um número/);
  });

  it("rótulo colado ('whatsapp:', 'tel:') sai antes dos dígitos", () => {
    expect(normalizaTelefone("whatsapp: (11) 98888-7777").valor).toBe(
      "5511988887777"
    );
  });
});

describe("normalizaUrl — LinkedIn e afins", () => {
  it('"linkedin.com/in/foo" sem scheme ganha https (caso do ticket)', () => {
    expect(normalizaUrl("linkedin.com/in/foo")).toEqual({
      valor: "https://linkedin.com/in/foo",
      mudou: true,
    });
  });

  it("URL já com scheme volta intacta; www. e path preservam", () => {
    expect(normalizaUrl("https://linkedin.com/in/foo").mudou).toBe(false);
    expect(normalizaUrl("www.github.com/ana").valor).toBe(
      "https://www.github.com/ana"
    );
  });

  it('"Marcos Silva" num campo de link NÃO é URL — null + revisar', () => {
    const r = normalizaUrl("Marcos Silva");
    expect(r.valor).toBeNull();
    expect(r.aviso).toMatch(/não parece um link/);
  });

  it("e-mail em campo de link também é não-link — null + revisar", () => {
    const r = normalizaUrl("marcos@gmail.com");
    expect(r.valor).toBeNull();
    expect(r.aviso).toMatch(/e-mail/);
  });

  it('"não tenho"/"n/a" são resposta legítima — null SEM aviso', () => {
    for (const v of ["não tenho", "N/A", "-", "nenhum", "sem linkedin"]) {
      const r = normalizaUrl(v);
      expect(r.valor).toBeNull();
      expect(r.aviso).toBeUndefined();
    }
  });

  it("domínio de rótulo único não é link navegável", () => {
    expect(normalizaUrl("marcos").valor).toBeNull();
    expect(normalizaUrl("https://localhost:3000/x").valor).toBeNull();
  });

  it("domínio incomum de 2 rótulos passa, mas pede conferência", () => {
    const r = normalizaUrl("marcossilva.dev/sobre");
    expect(r.valor).toBe("https://marcossilva.dev/sobre");
    expect(r.aviso).toMatch(/domínio/);
  });
});

describe("normalizaData — formatos de planilha e teclado", () => {
  const hoje = new Date("2026-06-15T12:00:00");

  it("dd/mm/aaaa, dd-mm-aaaa e ISO voltam ISO", () => {
    expect(normalizaData("14/10/2025", hoje).valor).toBe("2025-10-14");
    expect(normalizaData("14-10-2025", hoje).valor).toBe("2025-10-14");
    expect(normalizaData("14.10.2025", hoje).valor).toBe("2025-10-14");
    expect(normalizaData("2025-10-14", hoje)).toEqual({
      valor: "2025-10-14",
      mudou: false,
    });
    expect(normalizaData("2025/10/14", hoje).valor).toBe("2025-10-14");
  });

  it('"31/02/2024" é impossível — Date normalizaria em vez de falhar', () => {
    expect(normalizaData("31/02/2024", hoje).valor).toBeNull();
    expect(normalizaData("30/02/2024", hoje).valor).toBeNull();
    expect(normalizaData("29/02/2024", hoje).valor).toBe("2024-02-29"); // bissexto vale
    expect(normalizaData("32/01/2024", hoje).valor).toBeNull();
    expect(normalizaData("14/13/2025", hoje).valor).toBeNull();
  });

  it("serial de planilha e horário colado entram", () => {
    expect(normalizaData("30762", hoje).valor).toBe("1984-03-21");
    expect(normalizaData("14/10/2025 10:30", hoje).valor).toBe("2025-10-14");
    expect(normalizaData("2025-10-14T10:30:00", hoje).valor).toBe("2025-10-14");
  });

  it("ano de 2 dígitos resolve por janela — com aviso", () => {
    const r26 = normalizaData("15/03/26", hoje);
    expect(r26.valor).toBe("2026-03-15");
    expect(r26.aviso).toMatch(/2 dígitos/);
    const r85 = normalizaData("15/03/85", hoje);
    expect(r85.valor).toBe("1985-03-15");
    expect(r85.aviso).toBeTruthy();
  });

  it("texto solto e vazio são impossíveis", () => {
    expect(normalizaData("", hoje).valor).toBeNull();
    expect(normalizaData("outubro", hoje).valor).toBeNull();
  });
});

describe("normalizaPorFormato — o hint do campo texto", () => {
  it("despacha pro normalizador do formato declarado", () => {
    expect(normalizaPorFormato("email", "a@@b.com").valor).toBe("a@b.com");
    expect(normalizaPorFormato("telefone", "(11) 98888-7777").valor).toBe(
      "5511988887777"
    );
    expect(normalizaPorFormato("url", "linkedin.com/in/x").valor).toBe(
      "https://linkedin.com/in/x"
    );
  });
});

describe("enums — fuzzy pro vocabulário fechado", () => {
  it('"Não tenho preferência" → indiferente (caso do ticket)', () => {
    expect(normalizaPrefGenero("Não tenho preferência").valor).toBe(
      "indiferente"
    );
    expect(normalizaPrefGenero("tanto faz").valor).toBe("indiferente");
    expect(normalizaPrefGenero("Indiferente").valor).toBe("indiferente");
    expect(normalizaPrefGenero("mulher").valor).toBe("feminino");
    expect(normalizaPrefGenero("homem").valor).toBe("masculino");
    expect(normalizaPrefGenero("xyz").valor).toBeNull();
  });

  it("gênero — exceções antes dos binários", () => {
    expect(normalizaGenero("prefiro não dizer").valor).toBe("prefiro_nao_dizer");
    expect(normalizaGenero("não binário").valor).toBe("nao_binario");
    expect(normalizaGenero("NB").valor).toBe("nao_binario");
    expect(normalizaGenero("cisgênero feminino").valor).toBe("feminino");
    expect(normalizaGenero("Mulher").valor).toBe("feminino");
    expect(normalizaGenero("homem trans").valor).toBe("masculino");
    expect(normalizaGenero("outro").valor).toBe("outro");
  });

  it("cor/raça — autodeclaração livre pro CHECK", () => {
    expect(normalizaCorRaca("Branca").valor).toBe("branca");
    expect(normalizaCorRaca("preta").valor).toBe("negra");
    expect(normalizaCorRaca("Parda").valor).toBe("parda");
    expect(normalizaCorRaca("indígena").valor).toBe("indigena");
    expect(normalizaCorRaca("prefiro não responder").valor).toBe(
      "prefiro_nao_dizer"
    );
    expect(normalizaCorRaca("da Silva").valor).toBeNull();
  });

  it("escolaridade e papel", () => {
    expect(normalizaEscolaridade("ensino médio").valor).toBe("medio");
    expect(normalizaEscolaridade("superior incompleto").valor).toBe(
      "superior_incompleto"
    );
    expect(normalizaEscolaridade("pós-graduação").valor).toBe("pos");
    expect(normalizaPapel("mentor DPP").valor).toBe("mentor_dpp");
    expect(normalizaPapel("auxiliar executivo").valor).toBe("supervisor");
    expect(normalizaPapel("coordenação").valor).toBe("coordenacao");
    expect(normalizaPapel("especialista").valor).toBe("mentor_especialista");
  });

  it("mudou=false quando já veio canônico; vazio → null", () => {
    expect(normalizaGenero("feminino").mudou).toBe(false);
    expect(normalizaGenero("Feminino").mudou).toBe(true);
    expect(normalizaPrefGenero("").valor).toBeNull();
  });
});

describe("contrato {valor, mudou, aviso}", () => {
  it("helpers exportados compõem — emailValido bate com o normalizador", () => {
    const r = normalizaEmail("maria@@gmail.com");
    expect(r.valor).not.toBeNull();
    expect(emailValido(r.valor!)).toBe(true);
    expect(semAcento("Não âncora")).toBe("nao ancora");
  });
});
