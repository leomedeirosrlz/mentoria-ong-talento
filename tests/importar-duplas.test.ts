import { describe, expect, it } from "vitest";
import {
  canonHeaderPar,
  parseCsvPares,
  resolverPares,
  resolverPessoa,
  type DiretorioPar,
  type LinhaPar,
  type PessoaRef,
} from "@/lib/importar-duplas";
import type { AppRole, Cronograma } from "@/lib/types";

// ---------- fixtures ----------

const perfil = (
  id: string,
  nome: string,
  role: AppRole | null,
  extra: Partial<PessoaRef> = {}
): PessoaRef => ({
  id,
  nome,
  role,
  email: `${id}@realiza.vc`,
  nome_social: null,
  ativo: true,
  ...extra,
});

const jovem = (id: string, nome: string, extra: Partial<PessoaRef> = {}): PessoaRef => ({
  id,
  nome,
  email: `${id}@escola.br`,
  nome_social: null,
  ...extra,
});

const crono = (
  id: string,
  turma: string,
  status: Cronograma["status"] = "ativo"
): Cronograma => ({
  id,
  nome: `Calendário oficial · ${turma}`,
  turma,
  trilha: "dpp",
  inicio_em: "2026-10-01",
  fim_em: "2027-01-15",
  encontros_esperados: 16,
  status,
  created_by: null,
  created_at: "2026-09-01T00:00:00Z",
});

const dir = (over: Partial<DiretorioPar> = {}): DiretorioPar => ({
  profiles: [
    perfil("m1", "Stéphanie Maria Moraes dos Santos", "mentor_dpp"),
    perfil("m2", "Priscila Stuani", "mentor_dpp"),
    perfil("me1", "Sofia Nogueira", "mentor_especialista"),
    perfil("s1", "Paulo Serra", "supervisor"),
    perfil("c1", "Marina Duarte", "coordenacao"),
    perfil("in1", "Helena Inativa", "mentor_dpp", { ativo: false }),
  ],
  mentorados: [
    jovem("j1", "Yaleh Marina de Souza França Nóbrega"),
    jovem("j2", "Juliana Novaes de Oliveira"),
    jovem("j3", "Rafaela Alves dos Santos Pereira"),
  ],
  duplas: [],
  cronogramas: [crono("k1", "T1 · 2026/2027"), crono("k2", "T2 · 2026/2027")],
  capacidades: new Map([["m1", 1]]),
  eventos: [
    { cronograma_id: "k1", tipo: "encontro", data: "2026-10-06" },
    { cronograma_id: "k2", tipo: "encontro", data: "2026-10-13" },
  ],
  ...over,
});

const linha = (mentor: string, mentorado: string, extra: Partial<LinhaPar> = {}): LinhaPar => ({
  n: 1,
  mentor,
  mentorado,
  supervisor: "",
  turma: "T2 · 2026/2027",
  demanda: "",
  iniciada_em: "",
  ...extra,
});

// ---------- parser ----------

describe("canonHeaderPar", () => {
  it("reconhece os campos e os sinônimos do relatório de pareamento", () => {
    expect(canonHeaderPar("mentor")).toBe("mentor");
    expect(canonHeaderPar("Mentor(a)")).toBe("mentor");
    expect(canonHeaderPar("E-mail do mentor")).toBe("mentor");
    expect(canonHeaderPar("mentorado")).toBe("mentorado");
    expect(canonHeaderPar("Mentorando(a)")).toBe("mentorado");
    expect(canonHeaderPar("jovem")).toBe("mentorado");
    expect(canonHeaderPar("Supervisor")).toBe("supervisor");
    expect(canonHeaderPar("turma")).toBe("turma");
    expect(canonHeaderPar("Eixo da mentoria")).toBe("demanda");
    expect(canonHeaderPar("demanda")).toBe("demanda");
    expect(canonHeaderPar("Iniciada em")).toBe("iniciada_em");
    expect(canonHeaderPar("observações")).toBeNull();
  });
});

describe("parseCsvPares — cabeçalho e linhas", () => {
  it("colunas canônicas e sinônimos do relatório", () => {
    const r = parseCsvPares(
      "mentor;mentorado;supervisor;turma;demanda;iniciada_em\nAna;Bia;Cleo;T2;Eixo X;06/10/2026"
    );
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0]).toMatchObject({
      mentor: "Ana",
      mentorado: "Bia",
      supervisor: "Cleo",
      turma: "T2",
      demanda: "Eixo X",
      iniciada_em: "06/10/2026",
      n: 1,
    });
  });

  it("'mentorado' não é engolido pelo campo 'mentor'; 'eixo' vira demanda", () => {
    const r = parseCsvPares(
      "Mentor(a);Mentorado(a);Eixo da mentoria\nAna;Bia;Carreira"
    );
    expect(r.linhas[0].mentor).toBe("Ana");
    expect(r.linhas[0].mentorado).toBe("Bia");
    expect(r.linhas[0].demanda).toBe("Carreira");
  });

  it("headers por extenso com pontuação e acento", () => {
    const r = parseCsvPares(
      "E-mail do mentor;Nome do mentorado;Iniciada em:\na@x.com;Bia;2026-10-06"
    );
    expect(r.linhas[0].mentor).toBe("a@x.com");
    expect(r.linhas[0].mentorado).toBe("Bia");
    expect(r.linhas[0].iniciada_em).toBe("2026-10-06");
  });

  it("sem coluna mentor ou mentorado o arquivo inteiro é ignorado", () => {
    expect(parseCsvPares("mentor;turma\nAna;T2").linhas).toEqual([]);
    expect(parseCsvPares("nome;email\nAna;a@x.com").ignoradas).toBe(2);
  });

  it("linha sem nenhum dos lados é ignorada; com um lado entra na prévia", () => {
    const r = parseCsvPares("mentor;mentorado\nAna;Bia\n;\nAna;");
    expect(r.linhas.map((l) => l.n)).toEqual([1, 2]);
    expect(r.ignoradas).toBe(1);
  });

  it("vírgula e tab também são delimitadores", () => {
    expect(parseCsvPares("mentor,mentorado\nAna,Bia").linhas).toHaveLength(1);
    expect(parseCsvPares("mentor\tmentorado\nAna\tBia").linhas).toHaveLength(1);
  });
});

// ---------- resolução de identidade ----------

describe("resolverPessoa", () => {
  const pool = [
    perfil("a", "Stéphanie Maria Moraes dos Santos", "mentor_dpp"),
    perfil("b", "Júlio César de Andrade", "mentor_dpp", {
      nome_social: "Júlio Andrade",
    }),
    perfil("c", "Ana Souza", "mentor_dpp"),
    perfil("d", "Ana Paula Silva", "mentor_dpp"),
  ];

  it("e-mail casa exato sem case; desconhecido falha", () => {
    const ok = resolverPessoa("  A@Realiza.VC ", pool);
    expect(ok).toMatchObject({ pessoa: { id: "a" } });
    expect(resolverPessoa("ninguem@x.com", pool)).toHaveProperty("erro");
  });

  it("nome exato ignora acento, caixa e espaço extra", () => {
    expect(resolverPessoa("stephanie maria moraes dos santos", pool))
      .toMatchObject({ pessoa: { id: "a" } });
    expect(resolverPessoa("JULIO CESAR DE ANDRADE", pool))
      .toMatchObject({ pessoa: { id: "b" } });
  });

  it("nome social do cadastro também resolve", () => {
    expect(resolverPessoa("Júlio Andrade", pool))
      .toMatchObject({ pessoa: { id: "b" } });
  });

  it("nome de exibição contido resolve quando único", () => {
    // todos os tokens do valor estão no nome do cadastro
    expect(resolverPessoa("Juliana Novaes", [jovem("j", "Juliana Novaes de Oliveira")]))
      .toMatchObject({ pessoa: { id: "j" } });
    expect(resolverPessoa("César", pool)).toMatchObject({ pessoa: { id: "b" } });
  });

  it("ambíguo falha e sugere o e-mail — nunca chuta", () => {
    // "Ana" bate por contenção em Ana Souza e Ana Paula Silva
    const r = resolverPessoa("Ana", pool);
    expect(r).toHaveProperty("erro");
    expect("erro" in r && r.erro).toContain("ambíguo");
    expect("erro" in r && r.erro).toContain("e-mail");
  });

  it("apelido que não é pedaço do nome NÃO resolve", () => {
    // "Drica" -> Adriana não é automático: nem token, nem prefixo, nem exato
    expect(resolverPessoa("Drica", [jovem("x", "Adriana Nogueira")])).toHaveProperty("erro");
    expect(resolverPessoa("Nando", pool)).toHaveProperty("erro");
  });

  it("vazio e célula inexistente falham com motivo", () => {
    expect(resolverPessoa("", pool)).toHaveProperty("erro");
    expect(resolverPessoa("   ", pool)).toHaveProperty("erro");
  });
});

// ---------- resolução do lote ----------

describe("resolverPares", () => {
  it("linha feliz: resolve os dois lados, turma e início default", () => {
    const [r] = resolverPares([linha("Stéphanie Santos", "Yaleh Nóbrega")], dir());
    expect(r.status).toBe("ok");
    expect(r.par?.mentor.id).toBe("m1");
    expect(r.par?.mentorado.id).toBe("j1");
    expect(r.par?.trilha).toBe("dpp");
    expect(r.par?.cronogramaId).toBe("k2");
    expect(r.par?.turma).toBe("T2 · 2026/2027");
    // sem iniciada_em: DPP nasce uma semana antes do 1º encontro (13/10)
    expect(r.par?.iniciadaEm).toBe("2026-10-06");
  });

  it("resolve os dois lados por e-mail", () => {
    const [r] = resolverPares(
      [linha("m1@realiza.vc", "j1@escola.br")],
      dir()
    );
    expect(r.status).toBe("ok");
  });

  it("iniciada_em dd/mm/aaaa e ISO; inválida falha a linha", () => {
    const [ok] = resolverPares(
      [linha("m1@realiza.vc", "j1@escola.br", { iniciada_em: "06/10/2026" })],
      dir()
    );
    expect(ok.par?.iniciadaEm).toBe("2026-10-06");
    const [iso] = resolverPares(
      [linha("m1@realiza.vc", "j1@escola.br", { iniciada_em: "2026-10-06" })],
      dir()
    );
    expect(iso.par?.iniciadaEm).toBe("2026-10-06");
    const [bad] = resolverPares(
      [linha("m1@realiza.vc", "j1@escola.br", { iniciada_em: "amanhã" })],
      dir()
    );
    expect(bad.status).toBe("falha");
    expect(bad.motivo).toContain("iniciada_em inválida");
  });

  it("par já existente (ativa/pausada) vira 'existe', não falha", () => {
    const d = dir({
      duplas: [
        {
          mentor_id: "m1",
          mentorado_id: "j1",
          trilha: "dpp",
          status: "ativa",
          turma: "T2 · 2026/2027",
          created_at: "2026-10-01T00:00:00Z",
        },
      ],
    });
    const [r] = resolverPares([linha("m1@realiza.vc", "j1@escola.br")], d);
    expect(r.status).toBe("existe");
    expect(r.motivo).toContain("já existe");
  });

  it("mesmo par duplicado no próprio arquivo: a 2ª linha já é 'existe'", () => {
    const rs = resolverPares([linha("m1@realiza.vc", "j1@escola.br"), { ...linha("m1@realiza.vc", "j1@escola.br"), n: 2 }], dir());
    expect(rs[0].status).toBe("ok");
    expect(rs[1].status).toBe("existe");
  });

  it("mentorado já em dupla ativa da mesma trilha ocupa a vaga", () => {
    const d = dir({
      duplas: [
        {
          mentor_id: "m2",
          mentorado_id: "j1",
          trilha: "dpp",
          status: "pausada",
          turma: "T1 · 2026/2027",
          created_at: "2026-09-01T00:00:00Z",
        },
      ],
      capacidades: new Map([["m1", 2]]),
    });
    const [r] = resolverPares([linha("m1@realiza.vc", "j1@escola.br")], d);
    expect(r.status).toBe("existe");
    expect(r.motivo).toContain("já está em uma dupla ativa");
  });

  it("capacidade do mentor conta o que o próprio lote reservou", () => {
    const d = dir({ capacidades: new Map([["m1", 1]]) });
    const rs = resolverPares(
      [linha("m1@realiza.vc", "j1@escola.br"), { ...linha("m1@realiza.vc", "j2@escola.br"), n: 2 }],
      d
    );
    expect(rs[0].status).toBe("ok");
    expect(rs[1].status).toBe("falha");
    expect(rs[1].motivo).toContain("sem vaga");
  });

  it("supervisor resolve por nome/e-mail; não achado ou sem papel falham a linha", () => {
    const [ok] = resolverPares(
      [linha("m1@realiza.vc", "j1@escola.br", { supervisor: "Paulo Serra" })],
      dir()
    );
    expect(ok.status).toBe("ok");
    expect(ok.par?.supervisor?.id).toBe("s1");

    const [naoAcha] = resolverPares(
      [linha("m1@realiza.vc", "j1@escola.br", { supervisor: "Sumido" })],
      dir()
    );
    expect(naoAcha.status).toBe("falha");
    expect(naoAcha.motivo).toContain("supervisor");

    // mentor DPP não pode ser supervisor da própria dupla
    const [semPapel] = resolverPares(
      [linha("m1@realiza.vc", "j1@escola.br", { supervisor: "Priscila Stuani" })],
      dir()
    );
    expect(semPapel.status).toBe("falha");
    expect(semPapel.motivo).toContain("não pode supervisionar");

    // coordenação pode supervisionar (F1)
    const [coord] = resolverPares(
      [linha("m1@realiza.vc", "j1@escola.br", { supervisor: "Marina Duarte" })],
      dir()
    );
    expect(coord.par?.supervisor?.id).toBe("c1");
  });

  it("mentor sem papel de mentor ou inativo falha com motivo claro", () => {
    const [semPapel] = resolverPares([linha("Paulo Serra", "j1@escola.br")], dir());
    expect(semPapel.status).toBe("falha");
    expect(semPapel.motivo).toContain("não tem papel de mentor");

    const [inativo] = resolverPares([linha("Helena Inativa", "j1@escola.br")], dir());
    expect(inativo.status).toBe("falha");
    expect(inativo.motivo).toContain("inativo");
  });

  it("turma vazia com 2 cronogramas ativos falha pedindo a coluna; com 1 resolve", () => {
    const [semTurma] = resolverPares([linha("m1@realiza.vc", "j1@escola.br", { turma: "" })], dir());
    expect(semTurma.status).toBe("falha");
    expect(semTurma.motivo).toContain("informe a coluna turma");
    expect(semTurma.motivo).toContain("T1 · 2026/2027");

    const unico = dir({ cronogramas: [crono("k1", "T1 · 2026/2027")] });
    const [ok] = resolverPares([linha("m1@realiza.vc", "j1@escola.br", { turma: "" })], unico);
    expect(ok.status).toBe("ok");
    expect(ok.par?.turma).toBe("T1 · 2026/2027");
  });

  it("turma resolve exata ou contida; desconhecida lista as existentes", () => {
    const [curta] = resolverPares([linha("m1@realiza.vc", "j1@escola.br", { turma: "T2" })], dir());
    expect(curta.status).toBe("ok");
    expect(curta.par?.turma).toBe("T2 · 2026/2027");

    const [ruim] = resolverPares([linha("m1@realiza.vc", "j1@escola.br", { turma: "T9" })], dir());
    expect(ruim.status).toBe("falha");
    expect(ruim.motivo).toContain("não encontrada");
    expect(ruim.motivo).toContain("T1 · 2026/2027");
  });

  it("trilha especialista: sem supervisor, sem cronograma, turma derivada da DPP", () => {
    const d = dir({
      duplas: [
        {
          mentor_id: "m2",
          mentorado_id: "j1",
          trilha: "dpp",
          status: "encerrada",
          turma: "T1 · 2026/2027",
          created_at: "2026-09-01T00:00:00Z",
        },
      ],
      capacidades: new Map([["me1", 1]]),
    });
    const [r] = resolverPares(
      [linha("Sofia Nogueira", "j1@escola.br", { supervisor: "Paulo Serra" })],
      d
    );
    expect(r.status).toBe("ok");
    expect(r.par?.trilha).toBe("especialista");
    expect(r.par?.supervisor).toBeNull(); // especialista não leva supervisor
    expect(r.par?.cronogramaId).toBeNull();
    expect(r.par?.turma).toBe("T1 · 2026/2027"); // da dupla DPP encerrada do jovem
    expect(r.par?.iniciadaEm).toMatch(/^\d{4}-\d{2}-\d{2}$/); // hoje
  });

  it("demanda grava nas duas trilhas; vazia vira null", () => {
    const [dpp] = resolverPares(
      [linha("m1@realiza.vc", "j1@escola.br", { demanda: "Transição para tecnologia" })],
      dir()
    );
    expect(dpp.par?.demanda).toBe("Transição para tecnologia");
    const [sem] = resolverPares([linha("m1@realiza.vc", "j1@escola.br")], dir());
    expect(sem.par?.demanda).toBeNull();
  });

  it("linha com um lado só falha com o lado nomeado", () => {
    const [semMd] = resolverPares([linha("m1@realiza.vc", "")], dir());
    expect(semMd.status).toBe("falha");
    expect(semMd.motivo).toContain("mentorado em branco");
    const [semM] = resolverPares([linha("", "j1@escola.br")], dir());
    expect(semM.status).toBe("falha");
    expect(semM.motivo).toContain("mentor em branco");
  });

  it("resolução parcial fica visível na linha (achou mentor, faltou mentorado)", () => {
    const [r] = resolverPares([linha("m1@realiza.vc", "Ninguém da Silva")], dir());
    expect(r.status).toBe("falha");
    expect(r.mentorNome).toBe("Stéphanie Maria Moraes dos Santos");
    expect(r.mentoradoNome).toBeNull();
  });
});
