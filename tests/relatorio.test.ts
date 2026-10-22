import { describe, expect, it } from "vitest";
import {
  montarLinhas,
  parseConfig,
  textoCelula,
  type DuplaFonte,
  type InscricaoFila,
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

describe("montarLinhas · fila de espera (turma_inscricoes, 0111)", () => {
  // espelha a linha crua do banco — a query real filtra status='aguardando'
  // e a turma pedida antes de chamar montarLinhas; o helper reproduz o
  // mesmo pipeline pra exercitar a derivação de ponta a ponta
  type InscricaoRow = {
    turma: string;
    status: "aguardando" | "formada" | "desistiu";
    papel_esperado: "mentor" | "mentorado";
    profile_id: string | null;
    mentorado_id: string | null;
  };
  const escopoFila = (rows: InscricaoRow[], turma: string | null) =>
    rows
      .filter((i) => i.status === "aguardando" && (!turma || i.turma === turma))
      .flatMap((i): InscricaoFila[] => {
        if (i.papel_esperado === "mentor" && i.profile_id)
          return [{ papel_esperado: "mentor", profile_id: i.profile_id }];
        if (i.papel_esperado === "mentorado" && i.mentorado_id)
          return [{ papel_esperado: "mentorado", mentorado_id: i.mentorado_id }];
        return [];
      });

  const MENTOR_FILA: PessoaFonte = {
    id: "m-fila",
    user_id: null,
    nome: "Carlos Nunes",
    email: "carlos@ex.com",
    whatsapp: null,
    cidade: "Recife",
    uf: "PE",
  };
  const JOVEM_FILA: PessoaFonte = {
    id: "j-fila",
    nome: "Bruno Reis",
    email: "bruno@ex.com",
    whatsapp: null,
    cidade: null,
    uf: null,
  };
  const JOVEM_T3: PessoaFonte = {
    id: "j-t3",
    nome: "Duda T3",
    email: null,
    whatsapp: null,
    cidade: null,
    uf: null,
  };
  const JOVEM_DESISTENTE: PessoaFonte = { ...JOVEM_FILA, id: "j-desist", nome: "Eva Saiu" };
  const JOVEM_FORMADA: PessoaFonte = { ...JOVEM_FILA, id: "j-formada", nome: "Fê Formada" };

  const ROWS: InscricaoRow[] = [
    { turma: "T2 · 2026/2027", status: "aguardando", papel_esperado: "mentor", profile_id: "m-fila", mentorado_id: null },
    { turma: "T2 · 2026/2027", status: "aguardando", papel_esperado: "mentorado", profile_id: null, mentorado_id: "j-fila" },
    // já em dupla ativa (m-1 é o mentor de DUPLA) — some da fila
    { turma: "T2 · 2026/2027", status: "aguardando", papel_esperado: "mentor", profile_id: "m-1", mentorado_id: null },
    // outra turma — só aparece com recorte nulo
    { turma: "T3 · 2027", status: "aguardando", papel_esperado: "mentorado", profile_id: null, mentorado_id: "j-t3" },
    // saíram da fila — a query já não devolve (status ≠ aguardando)
    { turma: "T2 · 2026/2027", status: "desistiu", papel_esperado: "mentorado", profile_id: null, mentorado_id: "j-desist" },
    { turma: "T2 · 2026/2027", status: "formada", papel_esperado: "mentorado", profile_id: null, mentorado_id: "j-formada" },
  ];
  const profsTodas = mapa(MENTOR, MENTOR_FILA);
  const mentsTodas = mapa(JOVEM, JOVEM_FILA, JOVEM_T3, JOVEM_DESISTENTE, JOVEM_FORMADA);

  it("inscrito aguardando sem dupla vira linha 'Sem dupla' com os dados dele", () => {
    const linhas = montarLinhas(
      CFG_PESSOAS,
      [DUPLA],
      profsTodas,
      mentsTodas,
      { fila: escopoFila(ROWS, "T2 · 2026/2027") }
    );
    const semDupla = linhas.filter((l) => l.__status === "sem_dupla");
    expect(semDupla).toHaveLength(2);
    const mentor = semDupla.find((l) => l.__papel === "mentor")!;
    expect(textoCelula(mentor, "nome")).toBe("Carlos Nunes");
    expect(textoCelula(mentor, "status_dupla")).toBe("Sem dupla");
    expect(textoCelula(mentor, "par")).toBe("");
    const jovem = semDupla.find((l) => l.__papel === "mentorado")!;
    expect(textoCelula(jovem, "nome")).toBe("Bruno Reis");
  });

  it("inscrito com dupla ativa não repete na fila (m-1 já tem a dele)", () => {
    const linhas = montarLinhas(
      CFG_PESSOAS,
      [DUPLA],
      profsTodas,
      mentsTodas,
      { fila: escopoFila(ROWS, "T2 · 2026/2027") }
    );
    expect(
      linhas.filter((l) => textoCelula(l, "nome") === "Marta Souza")
    ).toHaveLength(1); // só a linha da dupla ativa — nada de "Sem dupla" pra ela
  });

  it("fila de outra turma não vaza no recorte da T2", () => {
    const linhas = montarLinhas(
      CFG_PESSOAS,
      [DUPLA],
      profsTodas,
      mentsTodas,
      { fila: escopoFila(ROWS, "T2 · 2026/2027") }
    );
    expect(linhas.some((l) => textoCelula(l, "nome") === "Duda T3")).toBe(false);
    // …mas aparece quando o recorte é "todas" (a query devolve sem filtro)
    const todas = montarLinhas(
      { ...CFG_PESSOAS, turma: null },
      [DUPLA],
      profsTodas,
      mentsTodas,
      { fila: escopoFila(ROWS, null) }
    );
    expect(todas.some((l) => textoCelula(l, "nome") === "Duda T3")).toBe(true);
  });

  it("desistiu/formada não chegam — o filtro status='aguardando' é da query", () => {
    const linhas = montarLinhas(
      CFG_PESSOAS,
      [DUPLA],
      profsTodas,
      mentsTodas,
      { fila: escopoFila(ROWS, "T2 · 2026/2027") }
    );
    for (const nome of ["Eva Saiu", "Fê Formada"]) {
      expect(linhas.some((l) => textoCelula(l, "nome") === nome), nome).toBe(false);
    }
  });

  it("granularidade 'duplas' ignora a fila (linha por dupla, não por pessoa)", () => {
    const linhas = montarLinhas(
      CFG_DUPLAS,
      [DUPLA],
      profsTodas,
      mentsTodas,
      { fila: escopoFila(ROWS, "T2 · 2026/2027") }
    );
    expect(linhas).toHaveLength(1);
    expect(linhas.every((l) => l.__status !== "sem_dupla")).toBe(true);
  });

  it("paraApp marca os alvos de edição mas sem link de dupla (não há)", () => {
    const linhas = montarLinhas(
      CFG_PESSOAS,
      [DUPLA],
      profsTodas,
      mentsTodas,
      { paraApp: true, fila: escopoFila(ROWS, "T2 · 2026/2027") }
    );
    const mentor = linhas.find(
      (l) => l.__status === "sem_dupla" && l.__papel === "mentor"
    )!;
    expect(mentor.__alvos?.nome).toEqual([
      { tabela: "profiles", id: "m-fila", campo: "nome", valor: "Carlos Nunes" },
    ]);
    expect(mentor.__links).toBeUndefined();
  });
});

describe("parseConfig · contato opt-in no resumo público (0105)", () => {
  it("sem ?col= o default exclui e-mail/whatsapp/contatos", () => {
    for (const gran of ["pessoas", "duplas"] as const) {
      const cfg = parseConfig({ gran: gran });
      for (const c of cfg.colunas) {
        expect(["email", "whatsapp", "contato_mentor", "contato_mentorado"]).not.toContain(c);
      }
      // e o resto da grade continua presente
      expect(cfg.colunas).toContain(gran === "pessoas" ? "nome" : "mentor");
      expect(cfg.colunas.length).toBeGreaterThan(3);
    }
  });

  it("?col= explícito readmitte contato (link montado no builder)", () => {
    const cfg = parseConfig({ gran: "pessoas", col: "nome,email,whatsapp" });
    expect(cfg.colunas).toEqual(["nome", "email", "whatsapp"]);
  });

  it("?col= com só lixo cai no default sem contato", () => {
    const cfg = parseConfig({ gran: "duplas", col: "foo,bar" });
    expect(cfg.colunas).not.toContain("contato_mentor");
    expect(cfg.colunas).toContain("mentor");
  });
});
