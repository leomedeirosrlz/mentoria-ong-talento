// Sugestão de remanejo (REALIZA-115/116) — os pools e a ordem saem de
// src/lib/remanejo.ts, puros e testáveis: afinidade mesma matéria do
// AfinidadePar, cheio marcado "sem vaga" (não some), fila pura pro lado
// do mentorado.

import { describe, expect, it } from "vitest";
import {
  afinidadeScore,
  ladoDeMentor,
  ladoDeMentorado,
  ocupacaoMentor,
  ranquearMentorados,
  ranquearMentores,
} from "@/lib/remanejo";
import { mkMentorado, mkProfile } from "./helpers";
import type { FilaItem } from "@/lib/fila";
import type { MentorProfile } from "@/lib/types";

const mp = (capacidade = 1, over: Partial<MentorProfile> = {}): MentorProfile =>
  ({
    profile_id: "p-x",
    tipo: "dpp",
    areas: [],
    capacidade,
    capacidade_especialista: 1,
    termo_ok: true,
    formacao_ok: true,
    ...over,
  }) as MentorProfile;

const filaItem = (id: string, desde: string | null = null): FilaItem => ({
  id,
  nome: id,
  avatar_path: null,
  whatsapp: null,
  origem: null,
  desde,
});

describe("afinidadeScore", () => {
  it("agenda que cruza pesa mais que tema", () => {
    const agenda = afinidadeScore(
      {
        disponibilidade: { dias: ["ter"], periodos: ["noite"] },
      },
      {
        disponibilidade: { dias: ["ter"], periodos: ["noite"] },
      }
    );
    const tema = afinidadeScore(
      { interesses: ["tecnologia"] },
      { areas: ["tecnologia"] }
    );
    expect(agenda.score).toBeGreaterThan(tema.score);
    expect(agenda.motivos[0]).toContain("agenda");
    expect(tema.motivos[0]).toContain("tema em comum: tecnologia");
  });

  it("dia em comum sem período cruzável não pontua agenda", () => {
    const r = afinidadeScore(
      { disponibilidade: { dias: ["ter"], periodos: ["manha"] } },
      { disponibilidade: { dias: ["ter"], periodos: ["noite"] } }
    );
    expect(r.score).toBe(0);
    expect(r.motivos).toHaveLength(0);
  });

  it("áreas do mentor contam como tema dele — mesmo cruzamento do AfinidadePar", () => {
    const r = afinidadeScore(
      ladoDeMentorado(
        mkMentorado({ interesses: ["comunicação", "redação"] })
      ),
      ladoDeMentor(
        mkProfile({ interesses: ["design"] }),
        mp(1, { areas: ["comunicação"] })
      )
    );
    expect(r.motivos).toEqual(["tema em comum: comunicação"]);
    expect(r.score).toBe(2);
  });

  it("normaliza caixa e acento no cruzamento de temas", () => {
    const r = afinidadeScore(
      { interesses: ["Tecnologia"] },
      { interesses: ["tecnologia", "educação"] }
    );
    expect(r.motivos[0]).toBe("tema em comum: Tecnologia");
  });

  it("preferência de par não atendida alerta e penaliza — nos dois sentidos", () => {
    const dandara = ladoDeMentorado(
      mkMentorado({
        nome: "Dandara Souza",
        genero: "feminino",
        pref_genero_par: "feminino",
      })
    );
    const carlos = ladoDeMentor(
      mkProfile({ nome: "Carlos Menezes", genero: "masculino" })
    );
    const r = afinidadeScore(dandara, carlos);
    expect(r.alertas[0]).toContain("Dandara prefere mentora");
    expect(r.alertas[0]).toContain("Carlos se cadastrou como masculino");
    expect(r.score).toBe(-3);
  });

  it("gênero não informado vira nota sem penalizar", () => {
    const r = afinidadeScore(
      {
        nome: "Ana",
        papel: "mentorado",
        genero: "feminino",
        pref_genero_par: "feminino",
      },
      { nome: "Beto", papel: "mentor", genero: null }
    );
    expect(r.alertas[0]).toContain("não informou o gênero");
    expect(r.score).toBe(0);
  });

  it("indiferente não gera alerta", () => {
    const r = afinidadeScore(
      { papel: "mentorado", genero: "feminino", pref_genero_par: "indiferente" },
      { papel: "mentor", genero: "masculino" }
    );
    expect(r.alertas).toHaveLength(0);
  });

  it("cidade pesa mais que UF — proximidade real, não administrativa", () => {
    const cidade = afinidadeScore(
      { cidade: "São Paulo", uf: "SP" },
      { cidade: "são paulo", uf: "SP" }
    );
    const uf = afinidadeScore(
      { cidade: "Guarulhos", uf: "SP" },
      { cidade: "Osasco", uf: "SP" }
    );
    expect(cidade.score).toBe(2);
    expect(uf.score).toBe(1);
    expect(uf.motivos[0]).toBe("mesmo estado (SP)");
  });
});

describe("ocupacaoMentor / teto por trilha", () => {
  it("DPP mede contra `capacidade`, especialista contra `capacidade_especialista` (0073)", () => {
    const dpp = mkProfile({ role: "mentor_dpp" });
    const esp = mkProfile({ role: "mentor_especialista" });
    const ficha = mp(3, { capacidade_especialista: 5 });
    expect(ocupacaoMentor(dpp, ficha, 2)).toEqual({ usadas: 2, teto: 3 });
    expect(ocupacaoMentor(esp, ficha, 2)).toEqual({ usadas: 2, teto: 5 });
  });

  it("sem linha em mentor_profiles o teto vale 1 — régua do trigger", () => {
    const dpp = mkProfile({ role: "mentor_dpp" });
    expect(ocupacaoMentor(dpp, undefined, 1).teto).toBe(1);
    expect(ocupacaoMentor(dpp, undefined, undefined).usadas).toBe(0);
  });
});

describe("ranquearMentores", () => {
  const mentores = [
    mkProfile({ id: "p-livre", nome: "Zilda Livre", role: "mentor_dpp" }),
    mkProfile({ id: "p-cheio", nome: "Ana Cheia", role: "mentor_dpp" }),
    mkProfile({ id: "p-atual", nome: "Mentor Atual", role: "mentor_dpp" }),
    mkProfile({ id: "p-inativo", nome: "Ina Tivo", role: "mentor_dpp", ativo: false }),
    mkProfile({ id: "p-esp", nome: "Esp Dado", role: "mentor_especialista" }),
    mkProfile({ id: "p-super", nome: "Super Visor", role: "supervisor" }),
  ];

  it("pool = mesmo papel da trilha, ativos, menos quem já está na dupla", () => {
    const ranked = ranquearMentores(
      mentores,
      "mentor_dpp",
      {},
      {},
      { papel: "mentorado" },
      "p-atual"
    );
    const ids = ranked.map((c) => c.profile.id);
    // o atual, o inativo, o especialista e o supervisor ficam fora;
    // empate de score desempata por nome (Ana Cheia antes de Zilda)
    expect(ids).toEqual(["p-cheio", "p-livre"]);
  });

  it("cheio fica marcado 'sem vaga' no fim, não some — a saída dele é capacidade", () => {
    const ranked = ranquearMentores(
      mentores,
      "mentor_dpp",
      { "p-cheio": mp(1), "p-livre": mp(1) },
      { "p-cheio:dpp": 1 },
      { papel: "mentorado" },
      "p-atual"
    );
    expect(ranked.map((c) => c.profile.id)).toEqual(["p-livre", "p-cheio"]);
    expect(ranked[1].livre).toBe(false);
    expect(ranked[1].usadas).toBe(1);
    expect(ranked[1].teto).toBe(1);
  });

  it("caso real da issue: capacidade 2 com 1 ativa + 1 pausada = cheio (pausada conta)", () => {
    const evelyn = mkProfile({
      id: "p-evelyn",
      nome: "Evelyn",
      role: "mentor_dpp",
    });
    // Lilian ativa + Wendel pausada → 2/2: a contagem chega pronta (a
    // régua ativa|pausada é do getDuplasResumo, espelho do trigger)
    const ranked = ranquearMentores(
      [evelyn],
      "mentor_dpp",
      { "p-evelyn": mp(2) },
      { "p-evelyn:dpp": 2 },
      { papel: "mentorado" }
    );
    expect(ranked[0].livre).toBe(false);
    expect(ranked[0].usadas).toBe(2);
    // uma pausada saindo da contagem → vaga volta
    const livre = ranquearMentores(
      [evelyn],
      "mentor_dpp",
      { "p-evelyn": mp(2) },
      { "p-evelyn:dpp": 1 },
      { papel: "mentorado" }
    );
    expect(livre[0].livre).toBe(true);
  });

  it("híbrido (primário DPP + papel esp) entra no pool da trilha esp — WP6b", () => {
    const hib = mkProfile({
      id: "p-hib",
      nome: "Hib Rido",
      role: "mentor_dpp",
      papeis: ["mentor_dpp", "mentor_especialista"],
    });
    const ranked = ranquearMentores(
      [hib],
      "mentor_especialista",
      // pool esp dele tem teto 3 com 1 usada — a DPP cheia (1/1) não conta
      { "p-hib": { ...mp(1), profile_id: "p-hib", capacidade_especialista: 3 } },
      { "p-hib:dpp": 1, "p-hib:especialista": 1 },
      { papel: "mentorado" }
    );
    expect(ranked.map((c) => c.profile.id)).toEqual(["p-hib"]);
    expect(ranked[0].livre).toBe(true);
    expect(ranked[0].usadas).toBe(1);
    expect(ranked[0].teto).toBe(3);
    // e no pool DPP ele mede contra a pool DPP — cheio, some do fim marcado
    const rankedDpp = ranquearMentores(
      [hib],
      "mentor_dpp",
      { "p-hib": { ...mp(1), profile_id: "p-hib", capacidade_especialista: 3 } },
      { "p-hib:dpp": 1, "p-hib:especialista": 1 },
      { papel: "mentorado" }
    );
    expect(rankedDpp[0].livre).toBe(false);
    expect(rankedDpp[0].usadas).toBe(1);
    expect(rankedDpp[0].teto).toBe(1);
  });

  it("afinidade decide entre livres; nome desempata o empate", () => {
    const perto = mkProfile({
      id: "p-1",
      nome: "Zuleica",
      cidade: "São Paulo",
      uf: "SP",
    });
    const longe = mkProfile({ id: "p-2", nome: "Alba", cidade: "Recife", uf: "PE" });
    const par = {
      papel: "mentorado" as const,
      cidade: "São Paulo",
      uf: "SP",
    };
    const ranked = ranquearMentores(
      [longe, perto],
      "mentor_dpp",
      { "p-1": mp(2), "p-2": mp(2) },
      {},
      par
    );
    expect(ranked[0].profile.id).toBe("p-1");
    expect(ranked[0].pontuacao.motivos[0]).toContain("São Paulo");
  });

  it("trilha especialista só ranqueia especialista", () => {
    const ranked = ranquearMentores(
      mentores,
      "mentor_especialista",
      {},
      {},
      { papel: "mentorado" }
    );
    expect(ranked.map((c) => c.profile.id)).toEqual(["p-esp"]);
  });
});

describe("ranquearMentorados", () => {
  it("a entrada é a fila pura — quem não está nela não aparece", () => {
    const ms = [
      mkMentorado({ id: "m-fila", nome: "Na Fila" }),
      mkMentorado({ id: "m-ocupado", nome: "Ocupado" }),
    ];
    const ranked = ranquearMentorados(
      [filaItem("m-fila")],
      ms,
      { papel: "mentor" }
    );
    expect(ranked.map((c) => c.mentorado.id)).toEqual(["m-fila"]);
  });

  it("afinidade ordena; a ordem da fila (espera) é o desempate", () => {
    const ms = [
      mkMentorado({ id: "m-novo", nome: "Novo", interesses: ["música"] }),
      mkMentorado({ id: "m-antigo", nome: "Antigo" }),
      mkMentorado({ id: "m-afim", nome: "Afim", interesses: ["tecnologia"] }),
    ];
    // fila: antigo primeiro (desde mais antigo), depois afim, depois novo
    const fila = [
      filaItem("m-antigo", "2026-01-01T00:00:00Z"),
      filaItem("m-afim", "2026-01-05T00:00:00Z"),
      filaItem("m-novo", "2026-01-10T00:00:00Z"),
    ];
    const ranked = ranquearMentorados(fila, ms, {
      papel: "mentor",
      areas: ["tecnologia"],
    });
    // afim tem tema em comum → primeiro apesar da espera menor
    expect(ranked[0].mentorado.id).toBe("m-afim");
    expect(ranked[0].desde).toBe("2026-01-05T00:00:00Z");
    // os empatados seguem a ordem da fila: antigo antes de novo
    expect(ranked[1].mentorado.id).toBe("m-antigo");
    expect(ranked[2].mentorado.id).toBe("m-novo");
  });

  it("ladoDeMentor prefere a ficha (mentor_profiles.areas) ao perfil público", () => {
    const lado = ladoDeMentor(
      mkProfile({ nome: "N", areas: ["vazio"] }),
      mp(1, { areas: ["educação"] })
    );
    expect(lado.areas).toEqual(["educação"]);
    const semFicha = ladoDeMentor(mkProfile({ areas: ["público"] }), null);
    expect(semFicha.areas).toEqual(["público"]);
  });
});
