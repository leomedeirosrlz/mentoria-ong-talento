import { describe, expect, it } from "vitest";
import {
  canonHeaderReg,
  candidatosDeNome,
  mapAvaliacao,
  mapDificuldade,
  mapDuracao,
  mapProximoPasso,
  matchDupla,
  normalizaLinhaReg,
  numeroEncontro,
  parseCsvRegistros,
  parseDataEncontro,
  processaLinhas,
  saneiaLinhaReg,
  scoreLinha,
  type DuplaCandidata,
  type LinhaRegCsv,
  type PessoaRef,
  type UniversoReg,
} from "@/lib/importar-registros";

// ---------- fixtures ----------

const HOJE = new Date("2026-10-08T12:00:00-03:00");

const mentor = (id: string, nome: string, extra: Partial<PessoaRef> = {}): PessoaRef => ({
  id,
  nome,
  nome_social: null,
  ...extra,
});

const jovem = (id: string, nome: string): PessoaRef => ({ id, nome, nome_social: null });

const dupla = (
  id: string,
  mentor_id: string,
  mentorado_id: string,
  mentorNome: string,
  mentoradoNome: string,
  status = "ativa"
): DuplaCandidata => ({
  id,
  mentor_id,
  mentorado_id,
  status,
  trilha: "dpp",
  mentorNome,
  mentoradoNome,
});

/** O universo do caso real: Fernando com dupla grafia, Priscila com typo de
 *  sobrenome, Nicolly com 4 grafias, Julio com dois mentorados possíveis. */
function universoBase(): UniversoReg {
  return {
    mentores: [
      mentor("m1", "Fernando Toledo Martins"),
      mentor("m2", "Priscila Stuani"),
      mentor("m3", "Julio Almeida"),
      mentor("m4", "Renata Campos"),
    ],
    mentorados: [
      jovem("j1", "Nicolly Jesus Bento Rodrigues"),
      jovem("j2", "Ednilson Alves"),
      jovem("j3", "Gustavo Marciano"),
      jovem("j4", "Larissa Prado"),
    ],
    duplas: [
      dupla("d1", "m1", "j1", "Fernando Toledo Martins", "Nicolly Jesus Bento Rodrigues"),
      dupla("d2", "m3", "j2", "Julio Almeida", "Ednilson Alves", "encerrada"),
      dupla("d3", "m3", "j3", "Julio Almeida", "Gustavo Marciano"),
      dupla("d4", "m4", "j4", "Renata Campos", "Larissa Prado"),
    ],
  };
}

const HEADER =
  'Carimbo de data/hora,Pontuação,Nome,Nome do Mentorando,"Qual encontro/semana está sendo avaliado?","Data do encontro","O que foi realizado neste encontro? (Descreva as atividades)","Como você avalia o desempenho e participação do jovem neste encontro?","Foi identificada alguma dificuldade que precisa de atenção?","Qual será o próximo passo do acompanhamento?","Observações do mentor. (Opcional)","Algum documento/foto de importância que gostaria de nos enviar?"';

const linha = (cells: (string | number)[]) => cells.join(",");

const csv = (...rows: string[]) => [HEADER, ...rows].join("\n");

function linhaCsv(parcial: Partial<LinhaRegCsv>): LinhaRegCsv {
  return {
    n: 1,
    mentor: "",
    mentorado: "",
    numero: "",
    data: "",
    duracao: "",
    feito: "",
    tema: "",
    ferramenta: "",
    atividades: "",
    avaliacao: "",
    dificuldade: "",
    proximo: "",
    obs: "",
    anexo: "",
    apoio: "",
    ...parcial,
  };
}

// ---------- canon de header ----------

describe("canonHeaderReg", () => {
  it("casa os headers reais do Google Forms", () => {
    expect(canonHeaderReg("Carimbo de data/hora")).toBeNull();
    expect(canonHeaderReg("Pontuação")).toBeNull();
    expect(canonHeaderReg("Nome")).toBe("mentor");
    expect(canonHeaderReg("Nome do Mentorando")).toBe("mentorado");
    expect(canonHeaderReg("Qual encontro/semana está sendo avaliado?")).toBe("numero");
    expect(canonHeaderReg("Data do encontro")).toBe("data");
    expect(canonHeaderReg("O que foi realizado neste encontro? (Descreva as atividades)")).toBe("feito");
    expect(canonHeaderReg("Como você avalia o desempenho e participação do jovem neste encontro?")).toBe("avaliacao");
    expect(canonHeaderReg("Foi identificada alguma dificuldade que precisa de atenção?")).toBe("dificuldade");
    expect(canonHeaderReg("Qual será o próximo passo do acompanhamento?")).toBe("proximo");
    expect(canonHeaderReg("Observações do mentor. (Opcional)")).toBe("obs");
    expect(canonHeaderReg("Algum documento/foto de importância que gostaria de nos enviar?")).toBe("anexo");
  });

  it("aceita variações razoáveis", () => {
    expect(canonHeaderReg("Nome do mentor")).toBe("mentor");
    expect(canonHeaderReg("Nome do mentorado")).toBe("mentorado");
    expect(canonHeaderReg("Encontro nº")).toBe("numero");
    expect(canonHeaderReg("Semana")).toBe("numero");
    expect(canonHeaderReg("Instrumento do guia utilizado")).toBe("ferramenta");
    expect(canonHeaderReg("Tema trabalhado")).toBe("tema");
    expect(canonHeaderReg("Duração do encontro")).toBe("duracao");
    expect(canonHeaderReg("Precisa de apoio da coordenação?")).toBe("apoio");
  });
});

// ---------- campos ----------

describe("numeroEncontro", () => {
  it('parseia "1º Encontro"→1 e variações', () => {
    expect(numeroEncontro("1º Encontro")).toBe(1);
    expect(numeroEncontro("Encontro 6")).toBe(6);
    expect(numeroEncontro("Semana 12")).toBe(12);
    expect(numeroEncontro("3")).toBe(3);
    expect(numeroEncontro("")).toBeNull();
    expect(numeroEncontro("primeiro")).toBeNull();
  });
});

describe("parseDataEncontro", () => {
  it("dd/mm/aaaa → ISO", () => {
    expect(parseDataEncontro("16/09/2026", HOJE)).toEqual({ iso: "2026-09-16", anoSuspeito: false });
    expect(parseDataEncontro(" 02/10/2026 ", HOJE).iso).toBe("2026-10-02");
    expect(parseDataEncontro("2026-09-16", HOJE).iso).toBe("2026-09-16");
  });

  it("ano absurdo → corrige pro ano corrente e flaga", () => {
    const r = parseDataEncontro("16/09/1960", HOJE);
    expect(r.iso).toBe("2026-09-16");
    expect(r.anoSuspeito).toBe(true);
  });

  it("ano futuro distante → flaga", () => {
    expect(parseDataEncontro("16/09/2099", HOJE).anoSuspeito).toBe(true);
  });
});

describe("enums", () => {
  it("avaliação acento/case-insensitive", () => {
    expect(mapAvaliacao("Excelente")).toBe("excelente");
    expect(mapAvaliacao("BOA")).toBe("boa");
    expect(mapAvaliacao("Regular")).toBe("regular");
    expect(mapAvaliacao("baixa")).toBe("baixa");
    expect(mapAvaliacao("")).toBeNull();
    expect(mapAvaliacao("muito bom demais")).toBe("boa");
  });

  it("dificuldade: não/vazio → nenhuma", () => {
    for (const v of ["", "Não", "não.", "Nenhuma", "Não foi identificada nenhuma dificuldade", "N/A"]) {
      expect(mapDificuldade(v).dificuldade).toBe("nenhuma");
    }
  });

  it("dificuldade: categoria clara → enum", () => {
    expect(mapDificuldade("Sim, dificuldade de organização da rotina").dificuldade).toBe("organizacao");
    expect(mapDificuldade("Questão comportamental pontual").dificuldade).toBe("comportamental");
    expect(mapDificuldade("Dificuldade de aprendizagem na escola").dificuldade).toBe("aprendizagem");
    expect(mapDificuldade("Baixa participação e pouca interação").dificuldade).toBe("participacao");
  });

  it("dificuldade: texto livre → outro + detalhe integral", () => {
    const r = mapDificuldade("Família em luto recente, clima pesado");
    expect(r.dificuldade).toBe("outro");
    expect(r.detalhe).toBe("Família em luto recente, clima pesado");
  });

  it("próximo passo: continuar/manter → continuar", () => {
    expect(mapProximoPasso("Continuar o acompanhamento normalmente").proximo_passo).toBe("continuar");
    expect(mapProximoPasso("Manter o acompanhamento semanal").proximo_passo).toBe("continuar");
  });

  it("próximo passo: demais opções e texto livre", () => {
    expect(mapProximoPasso("Reforçar o conteúdo/atividade").proximo_passo).toBe("reforcar");
    expect(mapProximoPasso("Realizar novo feedback").proximo_passo).toBe("novo_feedback");
    expect(mapProximoPasso("Fazer um acompanhamento mais próximo").proximo_passo).toBe("acompanhar_de_perto");
    expect(mapProximoPasso("Conversar individualmente com o mentorado").proximo_passo).toBe("conversa_individual");
    const livre = mapProximoPasso("Levar ao psicólogo da ONG na próxima semana");
    expect(livre.proximo_passo).toBe("outro");
    expect(livre.detalhe).toBe("Levar ao psicólogo da ONG na próxima semana");
  });
});

describe("mapDuracao", () => {
  it("aceita formatos comuns dentro da faixa", () => {
    expect(mapDuracao("60")).toBe(60);
    expect(mapDuracao("45 min")).toBe(45);
    expect(mapDuracao("1h")).toBe(60);
    expect(mapDuracao("1h30")).toBe(90);
    expect(mapDuracao("2 horas")).toBe(120);
  });
  it("fora da faixa → null", () => {
    expect(mapDuracao("15")).toBeNull();
    expect(mapDuracao("3h")).toBeNull();
  });
});

// ---------- parse ----------

describe("parseCsvRegistros", () => {
  it("lê o CSV do form com vírgula e aspas", () => {
    const { linhas } = parseCsvRegistros(
      csv(
        linha([
          "08/10/2026 21:03", "", "Fernando Toledo", "Nicolly Barbosa",
          "1º Encontro", "16/09/2026", '"Conversamos sobre rotina, escola e metas"',
          "Excelente", "Não", "Continuar o acompanhamento normalmente", '"Tudo bem."', "",
        ])
      )
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0].mentor).toBe("Fernando Toledo");
    expect(linhas[0].mentorado).toBe("Nicolly Barbosa");
    expect(linhas[0].numero).toBe("1º Encontro");
    expect(linhas[0].feito).toContain("Conversamos sobre rotina");
  });

  it("aceita ponto e vírgula (Excel BR)", () => {
    const cab = HEADER.replace(/,/g, ";").replace(/"/g, "");
    const { linhas } = parseCsvRegistros(
      [cab, "08/10/2026 21:03;;Fernando Toledo;Nicolly Barbosa;1º Encontro;16/09/2026;Feito;Boa;Não;Continuar;Obs;"].join("\n")
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0].avaliacao).toBe("Boa");
  });

  it("arquivo sem colunas obrigatórias → zero linhas", () => {
    const { linhas, ignoradas } = parseCsvRegistros("a,b,c\n1,2,3\n");
    expect(linhas).toHaveLength(0);
    expect(ignoradas).toBeGreaterThan(0);
  });
});

// ---------- normalização da linha ----------

describe("normalizaLinhaReg", () => {
  it("monta o payload: feito→reflexoes, obs→observacoes, apoio fora", () => {
    const r = normalizaLinhaReg(
      linhaCsv({
        numero: "2º Encontro",
        data: "20/09/2026",
        feito: "Revisão do PDM e dinâmica de cartas",
        avaliacao: "Regular",
        dificuldade: "Família em luto recente",
        proximo: "Conversar individualmente com o mentorado",
        obs: "Jovem pediu material",
        apoio: "Sim, preciso de apoio",
      }),
      HOJE
    );
    expect(r.numero).toBe(2);
    expect(r.dataIso).toBe("2026-09-20");
    expect(r.dataHora).toBe("2026-09-20T19:00:00-03:00");
    expect(r.payload.reflexoes).toBe("Revisão do PDM e dinâmica de cartas");
    expect(r.payload.observacoes).toBe("Jovem pediu material");
    expect(r.payload.avaliacao).toBe("regular");
    expect(r.payload.dificuldade).toBe("outro");
    expect(r.payload.dificuldade_detalhe).toBe("Família em luto recente");
    expect(r.payload.proximo_passo).toBe("conversa_individual");
    // apoio nunca vira precisa_apoio — vira diff auditável
    expect("precisa_apoio" in r.payload).toBe(false);
    expect(r.diffs.some((d) => d.campo === "apoio")).toBe(true);
  });

  it("data absurda → diff de revisão com o ano corrigido", () => {
    const r = normalizaLinhaReg(linhaCsv({ numero: "1", data: "16/09/1960" }), HOJE);
    expect(r.dataIso).toBe("2026-09-16");
    const d = r.diffs.find((x) => x.campo === "data");
    expect(d?.revisar).toBe(true);
  });

  it("sem número → ignorar", () => {
    const r = normalizaLinhaReg(linhaCsv({ mentor: "A", data: "16/09/2026" }));
    expect(r.status).toBe("ignorar");
    expect(r.motivo).toContain("encontro");
  });

  it("anexo vira diff ignorado (link externo)", () => {
    const r = normalizaLinhaReg(
      linhaCsv({ numero: "1", anexo: "https://drive.google.com/file/d/xyz" })
    );
    expect(r.diffs.find((d) => d.campo === "anexo")?.aviso).toContain("link externo");
  });
});

// ---------- match de nomes ----------

describe("candidatosDeNome", () => {
  const lista = [
    mentor("a", "Fernando Toledo Martins"),
    mentor("b", "Priscila Stuani"),
    mentor("c", "Nicolly Jesus Bento Rodrigues"),
  ];

  it("sem acento e case-insensitive", () => {
    expect(candidatosDeNome("fernando toledo martins", lista).fortes.map((p) => p.id)).toEqual(["a"]);
    expect(candidatosDeNome("PRISCILA STUANI", lista).fortes.map((p) => p.id)).toEqual(["b"]);
  });

  it("subset de tokens: 'Fernando Toledo' ⊆ 'Fernando Toledo Martins'", () => {
    expect(candidatosDeNome("Fernando Toledo", lista).fortes.map((p) => p.id)).toEqual(["a"]);
  });

  it("typo dist-1 ('Stuanni', 'Nucolly') → fraco: aparece como parecido, nunca auto-resolve", () => {
    expect(candidatosDeNome("Priscila Stuanni", lista).fortes).toHaveLength(0);
    expect(candidatosDeNome("Priscila Stuanni", lista).fracos.map((p) => p.id)).toEqual(["b"]);
  });

  it("typo sem prefixo ('Nucolly') → fraco, nunca resolve sozinho", () => {
    const r = candidatosDeNome("Nucolly Jesus", lista);
    expect(r.fortes).toHaveLength(0);
    expect(r.fracos.map((p) => p.id)).toEqual(["c"]);
  });
});

describe("matchDupla", () => {
  it("par resolvido → dupla única", () => {
    const m = matchDupla("Fernando Toledo", "Nicolly Barbosa", universoBase());
    // "Nicolly Barbosa" não é forte de "Nicolly Jesus Bento Rodrigues"
    // (barbosa não casa nada) → vai pra candidatos, não resolve
    expect(m.dupla).toBeNull();
    expect(m.candidatos.map((d) => d.id)).toContain("d1");
    expect(m.mentorNome).toBe("Fernando Toledo Martins");
  });

  it("par exato → ok direto", () => {
    const m = matchDupla("Fernando Toledo Martins", "Nicolly Jesus", universoBase());
    expect(m.dupla?.id).toBe("d1");
    expect(m.motivo).toBeNull();
  });

  it("dupla encerrada também é alvo legítimo", () => {
    const m = matchDupla("Julio Almeida", "Ednilson Alves", universoBase());
    expect(m.dupla?.id).toBe("d2");
    expect(m.dupla?.status).toBe("encerrada");
  });

  it("mentor com dois mentorados possíveis → ambíguo sem chute", () => {
    // "Gustavo" sozinho não resolve mentorado com nome completo diferente?
    const m = matchDupla("Julio Almeida", "Gustavo Marciano", universoBase());
    // Gustavo Marciano resolve → d3 única forte
    expect(m.dupla?.id).toBe("d3");
    // agora o caso real de ambiguidade: "Guto" é apelido que não é pedaço
    // do nome — não resolve, e as duas duplas do Julio viram candidatas
    const m2 = matchDupla("Julio Almeida", "Guto", universoBase());
    expect(m2.dupla).toBeNull();
    expect(new Set(m2.candidatos.map((d) => d.id))).toEqual(new Set(["d2", "d3"]));
  });

  it("nenhum nome achado → candidatos vazios e motivo legível", () => {
    const m = matchDupla("Xunda Pereira", "Zé Ninguém", universoBase());
    expect(m.dupla).toBeNull();
    expect(m.candidatos).toHaveLength(0);
    expect(m.motivo).toContain("Xunda Pereira");
  });
});

// ---------- pipeline completo ----------

describe("processaLinhas", () => {
  it("CSV realista: ok, revisar por ambiguidade e por data absurda, ignorar", () => {
    const { linhas, stats } = processaLinhas(
      [
        linhaCsv({ n: 1, mentor: "Fernando Toledo", mentorado: "Nicolly Rodrigues", numero: "1º Encontro", data: "16/09/2026" }),
        linhaCsv({ n: 2, mentor: "Julio Almeida", mentorado: "O menino", numero: "2º Encontro", data: "23/09/2026" }),
        linhaCsv({ n: 3, mentor: "Fernando Toledo Martins", mentorado: "Nicolly Jesus", numero: "2º Encontro", data: "16/09/1960" }),
        linhaCsv({ n: 4, mentor: "Fernando Toledo Martins", mentorado: "Nicolly Jesus", numero: "abc", data: "16/09/2026" }),
      ],
      universoBase(),
      HOJE
    );
    expect(linhas[0].status).toBe("ok");
    expect(linhas[0].duplaId).toBe("d1");
    // "O menino" não resolve → revisar com as duplas do Julio de candidata
    expect(linhas[1].status).toBe("revisar");
    expect(linhas[1].candidatos.map((d) => d.id).sort()).toEqual(["d2", "d3"]);
    // dupla resolve mas ano 1960 → revisar com duplaId sugerido
    expect(linhas[2].status).toBe("revisar");
    expect(linhas[2].duplaId).toBe("d1");
    expect(linhas[2].dataIso).toBe("2026-09-16");
    // sem número → ignorar
    expect(linhas[3].status).toBe("ignorar");
    expect(stats).toEqual({ ok: 1, revisar: 2, ignorar: 1 });
  });

  it("idempotência do motivo: par forte único com campo flagado cita os campos", () => {
    const { linhas } = processaLinhas(
      [
        linhaCsv({
          n: 1, mentor: "Fernando Toledo", mentorado: "Nicolly Rodrigues",
          numero: "1º", data: "16/09/2026", anexo: "drive.com/x",
        }),
      ],
      universoBase(),
      HOJE
    );
    expect(linhas[0].status).toBe("revisar");
    expect(linhas[0].motivo).toContain("conferir");
    expect(linhas[0].duplaId).toBe("d1");
  });
});

// ---------- scoreLinha — pontuação de certeza ----------

describe("scoreLinha", () => {
  /** universoBase + contexto: cronograma oficial de d1, encontro já
   *  registrado e início da dupla — é o que o import real enxerga. */
  const uniCtx = (): UniversoReg => {
    const u = universoBase();
    u.duplas[0].cronograma_id = "c1";
    u.duplas[0].iniciada_em = "2026-09-01";
    u.duplas[3].cronograma_id = "c1";
    u.calendario = new Map([
      ["c1", new Map([[1, "2026-09-08"], [2, "2026-09-15"], [4, "2026-09-29"]])],
    ]);
    u.encontros = new Map([
      ["d1", new Map([[1, { status: "realizado", data: "2026-09-08" }]])],
    ]);
    return u;
  };
  const HOJE_ISO = "2026-10-08";
  const evTexto = (r: { evidencias: { texto: string }[] }) =>
    r.evidencias.map((e) => e.texto).join(" · ");

  it("par exato + contexto cheio → auto 100", () => {
    const r = scoreLinha("Fernando Toledo Martins", "Nicolly Jesus", 1, "2026-09-08", uniCtx(), {
      hoje: HOJE_ISO,
    });
    expect(r.nivel).toBe("auto");
    expect(r.score).toBe(100);
    expect(r.top?.id).toBe("d1");
    expect(evTexto(r)).toContain("nome exato");
    expect(evTexto(r)).toContain("oficial era");
  });

  it("typo dist-1 → provável com a sugestão certa, nunca auto", () => {
    // "Larissa Prado" exato 100 × "Priscila Stuanni" ≈ Stuani ~78 → o elo
    // mais fraco dita; contexto não lava um lado de grafia duvidosa.
    const u = uniCtx();
    u.duplas.push(dupla("d6", "m2", "j4", "Priscila Stuani", "Larissa Prado"));
    u.duplas.find((d) => d.id === "d6")!.cronograma_id = "c1";
    const r = scoreLinha("Priscila Stuanni", "Larissa Prado", 2, "2026-09-15", u, {
      hoje: HOJE_ISO,
    });
    expect(r.nivel).toBe("provavel");
    expect(r.top?.id).toBe("d6");
    expect(evTexto(r)).toContain("grafia");
  });

  it("lado fraco + contexto máximo ainda não fecha auto", () => {
    const r = scoreLinha("Fernando Toledo", "Nicolly Barbosa", 1, "2026-09-08", uniCtx(), {
      hoje: HOJE_ISO,
    });
    // "Nicolly Barbosa" só divide o 1º nome com JBR → lado ~55; mesmo
    // somando data oficial + nº + encontro, o auto exige os dois lados ≥80
    expect(r.nivel).not.toBe("auto");
    expect(r.top?.id).toBe("d1");
    expect(r.score).toBeLessThan(90);
  });

  it("rótulo genérico ('Mentorada') → revisão explicada, nunca auto", () => {
    const r = scoreLinha("Fernando Toledo Martins", "Mentorada", 2, "2026-09-15", uniCtx(), {
      hoje: HOJE_ISO,
    });
    expect(r.nivel).not.toBe("auto");
    expect(r.motivo).toContain("rótulo genérico");
    // a dupla do mentor resolvido responde por eliminação (prior do rótulo)
    expect(r.top?.id).toBe("d1");
  });

  it("dupla encerrada continua alvo legítimo (histórico retroativo)", () => {
    const r = scoreLinha("Julio Almeida", "Ednilson Alves", 2, "2026-09-15", uniCtx(), {
      hoje: HOJE_ISO,
    });
    expect(r.nivel).toBe("auto");
    expect(r.top?.id).toBe("d2");
    expect(r.top?.status).toBe("encerrada");
  });

  it("duas pessoas com o mesmo nome — o par desempata", () => {
    const u = universoBase();
    u.mentores.push(mentor("m9", "Julio Almeida"));
    u.duplas.push(dupla("d9", "m9", "j4", "Julio Almeida", "Larissa Prado"));
    const r = scoreLinha("Julio Almeida", "Ednilson Alves", null, null, u);
    // "Julio Almeida" empata m3×m9; só a dupla do m3 tem o Ednilson
    expect(r.nivel).toBe("auto");
    expect(r.top?.id).toBe("d2");
  });

  it("par real que não forma dupla → manual com motivo dedicado", () => {
    const u = universoBase();
    // Fernanda Arrelaro existe como pessoa mas não tem dupla; Larissa
    // Prado tem dupla — com a Renata, não com ela. Nenhuma hipótese se
    // forma porque cada lado resolveu alguém real do cadastro.
    u.mentores.push(mentor("m9", "Fernanda Arrelaro Santos"));
    const r = scoreLinha("Fernanda Arrelaro", "Larissa Prado", null, null, u);
    expect(r.nivel).toBe("manual");
    expect(r.score).toBe(0);
    expect(r.top).toBeNull();
    expect(r.motivo).toContain("não forma dupla cadastrada");
    // a pessoa resolveu mesmo assim — aparece como resolução do lado
    expect(r.mentorNome).toBe("Fernanda Arrelaro Santos");
  });

  it("lado desconhecido → duplas do outro lado como candidatas, manual", () => {
    const r = scoreLinha("Julio Almeida", "Guto", null, null, universoBase());
    expect(r.nivel).toBe("manual");
    expect(new Set(r.candidatos.map((d) => d.id))).toEqual(new Set(["d2", "d3"]));
  });

  it("empate entre duplas plausíveis → manual, sem pré-seleção", () => {
    const u = universoBase();
    // Fernando ganha uma 2ª dupla com outra Nicolly — "Nicolly Barbosa"
    // só divide o 1º nome com as duas
    u.mentorados.push(jovem("j5", "Nicolly Albuquerque Ferreira"));
    u.duplas.push(dupla("d5", "m1", "j5", "Fernando Toledo Martins", "Nicolly Albuquerque Ferreira"));
    const r = scoreLinha("Fernando Toledo", "Nicolly Barbosa", null, null, u);
    expect(r.nivel).toBe("manual");
    expect(r.motivo).toContain("plausível");
    expect(new Set(r.candidatos.map((d) => d.id))).toEqual(new Set(["d1", "d5"]));
  });

  it("data no futuro pesa na nota e flaga a linha", () => {
    const r = scoreLinha("Fernando Toledo Martins", "Nicolly Jesus", 1, "2026-11-08", uniCtx(), {
      hoje: HOJE_ISO,
    });
    expect(evTexto(r)).toContain("futuro");
    const { linhas } = processaLinhas(
      [linhaCsv({ n: 1, mentor: "Fernando Toledo Martins", mentorado: "Nicolly Jesus", numero: "1º", data: "08/11/2026" })],
      universoBase(),
      HOJE
    );
    expect(linhas[0].status).toBe("revisar");
    expect(linhas[0].motivo).toContain("data no futuro");
  });

  it("data anterior ao início da dupla → evidência de alerta", () => {
    const r = scoreLinha("Fernando Toledo Martins", "Nicolly Jesus", 1, "2026-08-20", uniCtx(), {
      hoje: HOJE_ISO,
    });
    expect(evTexto(r)).toContain("anterior ao início");
  });

  it("nº acima da trilha da dupla → penalidade, não bônus", () => {
    const u = universoBase();
    u.duplas.push(dupla("d9", "m4", "j1", "Renata Campos", "Nicolly Jesus Bento Rodrigues"));
    u.duplas.find((d) => d.id === "d9")!.trilha = "especialista";
    const r = scoreLinha("Renata Campos", "Nicolly Jesus", 7, null, u);
    expect(evTexto(r)).toContain("excede a trilha (máx 5)");
  });

  it("duplicata no lote: a 2ª linha perde confiança e flaga", () => {
    const duas = [
      linhaCsv({ n: 1, mentor: "Fernando Toledo", mentorado: "Nicolly Jesus", numero: "1º", data: "16/09/2026" }),
      linhaCsv({ n: 2, mentor: "Fernando Toledo Martins", mentorado: "Nicolly Jesus", numero: "1º", data: "16/09/2026" }),
    ];
    const { linhas } = processaLinhas(duas, universoBase(), HOJE);
    expect(linhas[0].status).toBe("ok");
    expect(linhas[1].status).toBe("revisar");
    expect(linhas[1].motivo).toContain("linha 1 já aponta");
  });

  it("empate 100×100 → manual, sem cara-ou-coroa pré-selecionada", () => {
    const u = universoBase();
    // dupla gêmea nominal da d2 — mesmos nomes, outras pessoas
    u.mentores.push(mentor("m9", "Julio Almeida"));
    u.mentorados.push(jovem("j9", "Ednilson Alves"));
    u.duplas.push(dupla("d9", "m9", "j9", "Julio Almeida", "Ednilson Alves"));
    const r = scoreLinha("Julio Almeida", "Ednilson Alves", null, null, u);
    expect(r.nivel).toBe("manual");
    expect(r.motivo).toContain("empatad");
    // o pipeline não pré-seleciona uma das duas ao acaso
    const { linhas } = processaLinhas(
      [linhaCsv({ n: 1, mentor: "Julio Almeida", mentorado: "Ednilson Alves", numero: "2º", data: "16/09/2026" })],
      u,
      HOJE
    );
    expect(linhas[0].nivel).toBe("manual");
    expect(linhas[0].duplaId).toBeNull();
  });

  it("contexto desempata acima do cap: a dupla corroborada é a sugestão", () => {
    const u = uniCtx();
    // gêmea nominal da d2, mas SEM cronograma/encontro — capar o score em
    // 100 saturava as duas e a menos corroborada ia pro topo da sugestão
    u.mentores.push(mentor("m9", "Julio Almeida"));
    u.mentorados.push(jovem("j9", "Ednilson Alves"));
    u.duplas.push(dupla("d9", "m9", "j9", "Julio Almeida", "Ednilson Alves"));
    u.duplas.find((d) => d.id === "d2")!.cronograma_id = "c1";
    u.encontros!.set("d2", new Map([[2, { status: "realizado", data: "2026-09-15" }]]));
    const r = scoreLinha("Julio Almeida", "Ednilson Alves", 2, "2026-09-15", u, {
      hoje: HOJE_ISO,
    });
    expect(r.top?.id).toBe("d2");
    // gêmea segue ambígua: sugere a corroborada, não fecha sozinha
    expect(r.nivel).toBe("provavel");
    expect(evTexto(r)).toContain("outra dupla plausível");
  });

  it("placeholder com artigo ('o menino') entra no caminho do rótulo", () => {
    const r = scoreLinha("Fernando Toledo", "o menino", null, null, universoBase());
    expect(r.motivo).toContain("rótulo genérico");
    // 1 dupla só pro lado resolvido → eliminação vira sugestão provável
    expect(r.nivel).toBe("provavel");
    expect(r.top?.id).toBe("d1");
  });

  it("placeholder com 2 duplas possíveis → manual, nunca cara-ou-coroa", () => {
    // m3 tem d2 e d3 — "mentorado" não escolhe entre elas
    const r = scoreLinha("Julio Almeida", "mentorado", null, null, universoBase());
    expect(r.nivel).toBe("manual");
    expect(r.motivo).toContain("rótulo genérico");
    expect(r.motivo).toContain("empatad");
  });

  it("lado em branco → explicado como branco, não só 'provável'", () => {
    const r = scoreLinha("Fernando Toledo Martins", "  ", null, null, universoBase());
    expect(r.nivel).toBe("provavel");
    expect(r.motivo).toContain("em branco");
  });

  it("busca sem token útil ('A') não fabrica evidência nem resolve lado", () => {
    const r = scoreLinha("A", "Nicolly Jesus", null, null, universoBase());
    expect(r.nivel).not.toBe("auto");
    expect(r.motivo).toContain("não encontrado");
    expect(evTexto(r)).not.toContain('"a" ⊆');
  });

  it("manual nunca pré-seleciona: provável sugere, manual deixa vazio", () => {
    const u = universoBase();
    u.duplas.push(dupla("d6", "m2", "j4", "Priscila Stuani", "Larissa Prado"));
    const { linhas } = processaLinhas(
      [
        // provável: typo → sugestão pré-selecionada
        linhaCsv({ n: 1, mentor: "Priscila Stuanni", mentorado: "Larissa Prado", numero: "2º", data: "16/09/2026" }),
        // manual: "Guto" não resolve → Select vazio
        linhaCsv({ n: 2, mentor: "Julio Almeida", mentorado: "Guto", numero: "2º", data: "16/09/2026" }),
      ],
      u,
      HOJE
    );
    expect(linhas[0].nivel).toBe("provavel");
    expect(linhas[0].duplaId).toBe("d6");
    expect(linhas[1].nivel).toBe("manual");
    expect(linhas[1].duplaId).toBeNull();
    expect(linhas[1].candidatos.map((d) => d.id).sort()).toEqual(["d2", "d3"]);
  });
});

describe("saneiaLinhaReg", () => {
  it("score, nivel e evidencias sobrevivem à fronteira server/client", () => {
    const { linhas } = processaLinhas(
      [linhaCsv({ n: 1, mentor: "Fernando Toledo Martins", mentorado: "Nicolly Jesus", numero: "1º", data: "16/09/2026" })],
      universoBase(),
      HOJE
    );
    const s = saneiaLinhaReg(JSON.parse(JSON.stringify(linhas[0])), 0);
    expect(s.score).toBe(linhas[0].score);
    expect(s.nivel).toBe("auto");
    expect(s.evidencias.length).toBeGreaterThan(0);
    expect(s.status).toBe("ok");
  });
});
