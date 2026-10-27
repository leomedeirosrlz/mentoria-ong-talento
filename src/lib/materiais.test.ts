import { describe, expect, it } from "vitest";
import { audienciaLegada, audienciasDe, veMaterial } from "./materiais";
import type { AppRole } from "./types";

const coord = { role: "coordenacao" as const, papeis: ["coordenacao" as const] };
const supervisor = { role: "supervisor" as const, papeis: ["supervisor" as const] };
const mentorDpp = { role: "mentor_dpp" as const, papeis: ["mentor_dpp" as const] };
const mentorEsp = {
  role: "mentor_especialista" as const,
  papeis: ["mentor_especialista" as const],
};
const hibrido = {
  role: "mentor_dpp" as const,
  papeis: ["mentor_dpp" as const, "mentor_especialista" as const],
};
const jovem = { role: "mentorado" as const, papeis: ["mentorado" as const] };
const semPapel = { role: null, papeis: [] as AppRole[] };

describe("audienciasDe — normaliza a coluna nova com o legado", () => {
  it("usa o array quando ele existe", () => {
    expect(audienciasDe({ audiencias: ["supervisor", "mentor_dpp"] })).toEqual([
      "supervisor",
      "mentor_dpp",
    ]);
  });

  it("ignora valor inválido no array e cai no legado", () => {
    expect(audienciasDe({ audiencias: ["xpto"], audiencia: "dpp" })).toEqual([
      "mentor_dpp",
    ]);
  });

  it("mapeia o legado de valor único", () => {
    expect(audienciasDe({ audiencia: "dpp" })).toEqual(["mentor_dpp"]);
    expect(audienciasDe({ audiencia: "especialista" })).toEqual([
      "mentor_especialista",
    ]);
    expect(audienciasDe({ audiencia: "coordenacao" })).toEqual(["coordenacao"]);
    expect(audienciasDe({ audiencia: "todos" })).toEqual(["todos"]);
    expect(audienciasDe({})).toEqual(["todos"]);
  });
});

describe("veMaterial", () => {
  it("`todos` vale pra qualquer papel, inclusive mentorando", () => {
    for (const p of [coord, supervisor, mentorDpp, mentorEsp, jovem]) {
      expect(veMaterial(["todos"], p)).toBe(true);
    }
  });

  it("coordenação vê tudo, mesmo material de outro papel", () => {
    expect(veMaterial(["supervisor"], coord)).toBe(true);
    expect(veMaterial(["mentor_dpp"], coord)).toBe(true);
  });

  it("auxiliar vê material de auxiliar e não o de mentor", () => {
    expect(veMaterial(["supervisor"], supervisor)).toBe(true);
    expect(veMaterial(["mentor_dpp"], supervisor)).toBe(false);
    expect(veMaterial(["mentorado"], supervisor)).toBe(false);
  });

  it("mentor vê o próprio papel — híbrido vê os dois", () => {
    expect(veMaterial(["mentor_dpp"], mentorDpp)).toBe(true);
    expect(veMaterial(["mentor_especialista"], mentorDpp)).toBe(false);
    expect(veMaterial(["mentor_especialista"], hibrido)).toBe(true);
  });

  it("mentorando só vê o que é dele ou de todos", () => {
    expect(veMaterial(["mentorado"], jovem)).toBe(true);
    expect(veMaterial(["mentor_dpp"], jovem)).toBe(false);
  });

  it("sem papel não vê nada", () => {
    expect(veMaterial(["todos"], semPapel)).toBe(false);
  });
});

describe("audienciaLegada", () => {
  it("deriva o valor único do array pro código antigo durante o deploy", () => {
    expect(audienciaLegada(["todos", "mentor_dpp"])).toBe("todos");
    expect(audienciaLegada(["mentor_dpp", "supervisor"])).toBe("dpp");
    expect(audienciaLegada(["mentor_especialista"])).toBe("especialista");
    expect(audienciaLegada(["supervisor"])).toBe("coordenacao");
    expect(audienciaLegada(["mentorado"])).toBe("coordenacao");
  });
});
