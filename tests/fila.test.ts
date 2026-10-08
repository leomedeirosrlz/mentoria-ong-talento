import { describe, expect, it } from "vitest";
import {
  carimboFormBruto,
  esperaDesde,
  filaMentorados,
  filaMentores,
  textoEspera,
} from "@/lib/fila";
import { mkMentorado, mkProfile } from "./helpers";
import type { MentorProfile } from "@/lib/types";

// Fila "Aguardando par" (REALIZA-101) — derivação pura: o corte de quem
// entra na fila, a fonte do carimbo da espera e a ordenação. `agoraMs`
// sempre injetado — nada depende do relógio (mesma régua das outras suítes).

const AGORA = new Date("2026-10-14T12:00:00-03:00").getTime();

describe("carimboFormBruto", () => {
  it("serial Excel vira ISO (época 1899-12-30, mesma do intake)", () => {
    // 44927 = 2023-01-01; +73 dias = 2023-03-15
    expect(carimboFormBruto({ "Carimbo de data/hora": "45000" })).toBe(
      "2023-03-15T00:00:00.000Z"
    );
  });

  it("serial com fração de dia preserva a hora", () => {
    // 45000.5 = 2023-03-15 12:00 UTC
    expect(carimboFormBruto({ "Carimbo de data/hora": "45000.5" })).toBe(
      "2023-03-15T12:00:00.000Z"
    );
  });

  it("texto dd/mm/aaaa hh:mm vira ISO no fuso do teste (SP)", () => {
    expect(carimboFormBruto({ "Carimbo de data/hora": "05/10/2026 14:32" })).toBe(
      "2026-10-05T17:32:00.000Z"
    );
    // sem hora vale também — a planilha exporta os dois
    expect(carimboFormBruto({ "Carimbo de data/hora": "05/10/2026" })).toBe(
      "2026-10-05T03:00:00.000Z"
    );
  });

  it("lixo devolve null — fila sem data mente menos que data inventada", () => {
    expect(carimboFormBruto(null)).toBeNull();
    expect(carimboFormBruto({})).toBeNull();
    expect(carimboFormBruto({ "Carimbo de data/hora": "quarta" })).toBeNull();
    expect(carimboFormBruto({ "Carimbo de data/hora": "  " })).toBeNull();
    expect(carimboFormBruto({ "Carimbo de data/hora": 123 })).toBeNull(); // serial curto demais não é data
    expect(carimboFormBruto({ outra: "45000" })).toBeNull();
  });
});

describe("esperaDesde", () => {
  it("pega o carimbo mais antigo entre consent, form e created_at", () => {
    // inscrição pelo form meses antes da importação do cadastro — a espera
    // real é a do form, não a do created_at
    expect(
      esperaDesde({
        consent_lgpd_em: "2026-09-01T10:00:00-03:00",
        created_at: "2026-10-10T10:00:00-03:00",
      })
    ).toBe("2026-09-01T13:00:00.000Z");
    expect(
      esperaDesde({
        created_at: "2026-10-10T10:00:00-03:00",
        form_bruto: { "Carimbo de data/hora": "45000" },
      })
    ).toBe("2023-03-15T00:00:00.000Z");
  });

  it("pré-cadastro anterior ao consentimento conta do cadastro", () => {
    expect(
      esperaDesde({
        consent_lgpd_em: "2026-10-01T10:00:00-03:00",
        created_at: "2026-09-20T10:00:00-03:00",
      })
    ).toBe("2026-09-20T13:00:00.000Z");
  });

  it("sem nenhum carimbo válido devolve null", () => {
    expect(esperaDesde({})).toBeNull();
    expect(
      esperaDesde({ consent_lgpd_em: null, created_at: "não-data" })
    ).toBeNull();
  });
});

describe("textoEspera", () => {
  it("granularidade de dia: hoje / há 1 dia / há N dias", () => {
    expect(textoEspera("2026-10-14T08:00:00-03:00", AGORA)).toBe("hoje");
    expect(textoEspera("2026-10-13T08:00:00-03:00", AGORA)).toBe("há 1 dia");
    expect(textoEspera("2026-10-02T08:00:00-03:00", AGORA)).toBe("há 12 dias");
  });

  it("carimbo no futuro (relógio torto) clamp em hoje", () => {
    expect(textoEspera("2026-10-20T08:00:00-03:00", AGORA)).toBe("hoje");
  });
});

describe("filaMentorados", () => {
  const vinicius = mkMentorado({
    id: "m-vinicius",
    nome: "Vinícius",
    created_at: "2026-10-01T10:00:00-03:00",
    ong_origem: "ONG Horizonte",
  });
  const wendel = mkMentorado({
    id: "m-wendel",
    nome: "Wendel",
    created_at: "2026-10-12T10:00:00-03:00",
    origem: "Formulário de matching",
  });

  it("lista quem nunca teve dupla, do mais antigo pro mais novo", () => {
    const fila = filaMentorados(
      [wendel, vinicius],
      new Set(),
      new Set()
    );
    expect(fila.map((f) => f.id)).toEqual(["m-vinicius", "m-wendel"]);
  });

  it("exclui quem ocupa vaga (dupla ativa/pausada)", () => {
    const fila = filaMentorados(
      [wendel, vinicius],
      new Set(["m-vinicius"]),
      new Set(["m-vinicius"])
    );
    expect(fila.map((f) => f.id)).toEqual(["m-wendel"]);
  });

  it("exclui quem já teve dupla (concluída/encerrada) — não é espera, é re-entrada", () => {
    // dupla encerrada libera a vaga (não está em `ocupados`) mas fica no
    // histórico — desistente e concluinte não voltam pra fila
    const fila = filaMentorados(
      [wendel, vinicius],
      new Set(),
      new Set(["m-vinicius"])
    );
    expect(fila.map((f) => f.id)).toEqual(["m-wendel"]);
  });

  it("origem prefere a ONG; sem carimbo vai pro fim da fila", () => {
    const semData = mkMentorado({ id: "m-sem", nome: "Sem Data" });
    const fila = filaMentorados([semData, wendel], new Set(), new Set());
    expect(fila[0].id).toBe("m-wendel");
    expect(fila[1].desde).toBeNull();
    const fila2 = filaMentorados([vinicius], new Set(), new Set());
    expect(fila2[0].origem).toBe("ONG Horizonte");
  });
});

describe("filaMentores", () => {
  const mp = (capacidade: number): MentorProfile => ({
    profile_id: "x",
    tipo: "dpp",
    areas: [],
    capacidade,
    termo_ok: true,
    formacao_ok: true,
  });

  it("lista mentor ativo com vaga livre — reserva proposital", () => {
    const marcos = mkProfile({
      id: "p-marcos",
      nome: "Marcos",
      role: "mentor_especialista",
      created_at: "2026-09-20T10:00:00-03:00",
    });
    const fila = filaMentores(
      [marcos],
      { "p-marcos": { ...mp(2), profile_id: "p-marcos" } },
      {}
    );
    expect(fila).toHaveLength(1);
    expect(fila[0].vagas).toBe(2);
    expect(fila[0].trilha).toBe("especialista");
  });

  it("desconta duplas ativas/pausadas da capacidade", () => {
    const mentor = mkProfile({ id: "p-1", role: "mentor_dpp" });
    // 1 de 2 vagas ocupada → entra com 1 vaga livre
    expect(
      filaMentores([mentor], { "p-1": { ...mp(2), profile_id: "p-1" } }, { "p-1": 1 })[0]
        .vagas
    ).toBe(1);
    // lotado → some da fila
    expect(
      filaMentores([mentor], { "p-1": { ...mp(2), profile_id: "p-1" } }, { "p-1": 2 })
    ).toHaveLength(0);
    // sem ficha em mentor_profiles vale capacidade 1 (régua do createDupla)
    expect(filaMentores([mentor], {}, { "p-1": 1 })).toHaveLength(0);
    expect(filaMentores([mentor], {}, {})).toHaveLength(1);
  });

  it("inativa e não-mentor não entram — reserva é de quem ficou", () => {
    const inativa = mkProfile({ id: "p-off", role: "mentor_dpp", ativo: false });
    const supervisor = mkProfile({ id: "p-sup", role: "supervisor" });
    const semPapel = mkProfile({ id: "p-null", role: null });
    expect(filaMentores([inativa, supervisor, semPapel], {}, {})).toHaveLength(0);
  });
});
