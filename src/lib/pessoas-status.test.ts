import { describe, expect, it } from "vitest";
import {
  ACESSO_STALE_DIAS,
  papelNaTurma,
  papeisNaTurma,
  rankNaTurma,
  statusDePessoa,
  turmasDePessoa,
  type MapasTurma,
  type SinaisStatusPessoa,
} from "./pessoas-status";

const AGORA = new Date("2026-06-15T12:00:00Z");
const haDias = (n: number) =>
  new Date(AGORA.getTime() - n * 86400e3).toISOString();

const sinais = (
  over: Partial<SinaisStatusPessoa> = {}
): SinaisStatusPessoa => ({
  ativo: true,
  contaVinculada: false,
  onboardedEm: null,
  ultimoAcessoEm: null,
  termoOk: true,
  docsFaltantes: [],
  agora: AGORA,
  ...over,
});

describe("statusDePessoa — precedência", () => {
  it("inativo ganha de tudo — sem pendência secundária", () => {
    const r = statusDePessoa(
      sinais({ ativo: false, termoOk: false, docsFaltantes: ["RG"] })
    );
    expect(r.primario).toBe("inativo");
    expect(r.secundarios).toEqual([]);
  });

  it("convidado: conta criada sem onboarding; termo/docs vão como secundários", () => {
    const r = statusDePessoa(
      sinais({
        contaVinculada: true,
        onboardedEm: null,
        termoOk: false,
        docsFaltantes: ["RG"],
      })
    );
    expect(r.primario).toBe("convidado");
    expect(r.secundarios).toEqual(["termo_pendente", "docs_pendentes"]);
  });

  it("termo e documentos pendentes coexistem como primário + secundário", () => {
    const r = statusDePessoa(
      sinais({ termoOk: false, docsFaltantes: ["CPF"] })
    );
    expect(r.primario).toBe("termo_pendente");
    expect(r.secundarios).toEqual(["docs_pendentes"]);
  });

  it("convidado → não acessou na virada do onboarded_em; acesso recente vira ativo", () => {
    const convidado = statusDePessoa(
      sinais({ contaVinculada: true, onboardedEm: null })
    );
    expect(convidado.primario).toBe("convidado");

    // entrou (onboarded) mas auth nunca registrou acesso → não acessou
    const semAcesso = statusDePessoa(
      sinais({
        contaVinculada: true,
        onboardedEm: haDias(60),
        ultimoAcessoEm: null,
      })
    );
    expect(semAcesso.primario).toBe("nao_acessou");

    // acesso fora da janela operacional também conta como não acessou
    const antigo = statusDePessoa(
      sinais({
        contaVinculada: true,
        onboardedEm: haDias(60),
        ultimoAcessoEm: haDias(ACESSO_STALE_DIAS + 10),
      })
    );
    expect(antigo.primario).toBe("nao_acessou");

    // dentro da janela → próximo degrau da régua
    const recente = statusDePessoa(
      sinais({
        contaVinculada: true,
        onboardedEm: haDias(60),
        ultimoAcessoEm: haDias(3),
      })
    );
    expect(recente.primario).toBe("ativo");
  });

  it("não acessou + termo pendente: acesso é o primário, termo é secundário", () => {
    const r = statusDePessoa(
      sinais({
        contaVinculada: true,
        onboardedEm: haDias(90),
        ultimoAcessoEm: null,
        termoOk: false,
      })
    );
    expect(r.primario).toBe("nao_acessou");
    expect(r.secundarios).toEqual(["termo_pendente"]);
  });

  it("sem conta e sem onboarded o não acessou não se fabrica — cai na régua", () => {
    const r = statusDePessoa(sinais({ contaVinculada: false }));
    expect(r.primario).toBe("ativo");
  });
});

const MAPAS: MapasTurma = {
  duplas: [
    // mentora híbrida: DPP na T1, especialista na T2 — as duas turmas contam
    { mentor_id: "m-hibrida", mentorado_id: "j-ana", supervisor_id: null,
      trilha: "dpp", turma: "T1 · 2026/2027" },
    { mentor_id: "m-hibrida", mentorado_id: "j-ana", supervisor_id: null,
      trilha: "especialista", turma: "T2 · 2026/2027" },
    { mentor_id: "m-dpp", mentorado_id: "j-bia", supervisor_id: "s-paulo",
      trilha: "dpp", turma: "T2 · 2026/2027" },
    // dupla encerrada ainda filia (a turma é recorte, não estado vivo)
    { mentor_id: "m-dpp", mentorado_id: "j-caio", supervisor_id: null,
      trilha: "dpp", turma: "T1 · 2025/2026" },
  ],
  inscricoes: [
    { turma: "T2 · 2026/2027", profile_id: null, mentorado_id: "j-rafael",
      papel_esperado: "mentorado", status: "aguardando" },
    { turma: "T2 · 2026/2027", profile_id: "m-fila", mentorado_id: null,
      papel_esperado: "mentor", status: "aguardando" },
    // formada segue a regra da dupla — papel base no esperado
    { turma: "T1 · 2026/2027", profile_id: null, mentorado_id: "j-ana",
      papel_esperado: "mentorado", status: "formada" },
  ],
  papeisEscopo: [
    { profile_id: "s-paulo", papel: "supervisor", escopo_turma: "T2 · 2026/2027" },
    { profile_id: "c-marina", papel: "coordenacao", escopo_turma: "T1 · 2026/2027" },
  ],
};

describe("turmasDePessoa — evidências por ordem", () => {
  it("dupla + inscrição + escopo, com papel contextual por fonte", () => {
    // híbrida: DPP na T1 + especialista na T2 — aparece nas duas turmas
    const h = turmasDePessoa({ tipo: "profile", id: "m-hibrida" }, MAPAS);
    expect(h).toEqual([
      { turma: "T1 · 2026/2027", papel: "mentor_dpp" },
      { turma: "T2 · 2026/2027", papel: "mentor_especialista" },
    ]);

    // jovem com dupla nas duas trilhas + inscrição formada: uma linha por papel
    const j = turmasDePessoa({ tipo: "mentorado", id: "j-ana" }, MAPAS);
    expect(j).toEqual([
      { turma: "T1 · 2026/2027", papel: "mentorado" },
      { turma: "T2 · 2026/2027", papel: "mentorado" },
    ]);

    // auxiliar por supervisor_id E por grant escopado — dedup por (turma,papel)
    const s = turmasDePessoa({ tipo: "profile", id: "s-paulo" }, MAPAS);
    expect(s).toEqual([{ turma: "T2 · 2026/2027", papel: "auxiliar" }]);

    // aguardando marca o papel; formada segue o esperado
    const fila = turmasDePessoa({ tipo: "mentorado", id: "j-rafael" }, MAPAS);
    expect(fila).toEqual([{ turma: "T2 · 2026/2027", papel: "aguardando" }]);
    const mfila = turmasDePessoa({ tipo: "profile", id: "m-fila" }, MAPAS);
    expect(mfila).toEqual([{ turma: "T2 · 2026/2027", papel: "aguardando" }]);
  });

  it("multi-turma e sem turma", () => {
    const m = turmasDePessoa({ tipo: "profile", id: "m-dpp" }, MAPAS);
    expect(m.map((t) => t.turma).sort()).toEqual([
      "T1 · 2025/2026",
      "T2 · 2026/2027",
    ]);
    expect(turmasDePessoa({ tipo: "profile", id: "ninguem" }, MAPAS)).toEqual([]);
  });

  it("papelNaTurma/papeisNaTurma + rank da subseção (jovens, mentores, staff)", () => {
    const h = { tipo: "profile" as const, id: "m-hibrida" };
    expect(papelNaTurma(h, "T1 · 2026/2027", MAPAS)).toBe("mentor_dpp");
    expect(papelNaTurma(h, "T2 · 2026/2027", MAPAS)).toBe("mentor_especialista");
    expect(papelNaTurma(h, "T9", MAPAS)).toBeNull();

    expect(rankNaTurma(papeisNaTurma({ tipo: "mentorado", id: "j-ana" }, "T1 · 2026/2027", MAPAS), "mentorado")).toBe(0);
    expect(rankNaTurma(papeisNaTurma(h, "T1 · 2026/2027", MAPAS), "profile")).toBe(1);
    expect(rankNaTurma(papeisNaTurma({ tipo: "profile", id: "m-fila" }, "T2 · 2026/2027", MAPAS), "profile")).toBe(1);
    expect(rankNaTurma(papeisNaTurma({ tipo: "mentorado", id: "j-rafael" }, "T2 · 2026/2027", MAPAS), "mentorado")).toBe(0);
    expect(rankNaTurma(papeisNaTurma({ tipo: "profile", id: "s-paulo" }, "T2 · 2026/2027", MAPAS), "profile")).toBe(2);
  });
});
