import { describe, expect, it } from "vitest";
import { bloqueioTrocaPapel, type VinculoDupla } from "./papel-vinculo";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";

const comoMentor: VinculoDupla = { mentor_id: A, supervisor_id: B };
const comoAuxiliar: VinculoDupla = { mentor_id: B, supervisor_id: A };
const semVinculo: VinculoDupla = { mentor_id: B, supervisor_id: B };

describe("bloqueioTrocaPapel", () => {
  it("sem vínculo em dupla ativa/pausada, qualquer papel passa", () => {
    expect(bloqueioTrocaPapel(A, "supervisor", [semVinculo])).toBeNull();
    expect(bloqueioTrocaPapel(A, null, [semVinculo])).toBeNull();
    expect(bloqueioTrocaPapel(A, "coordenacao", [])).toBeNull();
  });

  it("mentor de dupla só troca pra papel que ainda conduz como mentor", () => {
    expect(bloqueioTrocaPapel(A, "mentor_dpp", [comoMentor])).toBeNull();
    expect(bloqueioTrocaPapel(A, "mentor_especialista", [comoMentor])).toBeNull();
    expect(bloqueioTrocaPapel(A, "mentor_hibrido", [comoMentor])).toBeNull();
    expect(bloqueioTrocaPapel(A, "supervisor", [comoMentor])).toBe("mentor");
    expect(bloqueioTrocaPapel(A, "coordenacao", [comoMentor])).toBe("mentor");
    expect(bloqueioTrocaPapel(A, null, [comoMentor])).toBe("mentor");
  });

  it("auxiliar de dupla pode virar auxiliar ou coordenação — segue acompanhando", () => {
    expect(bloqueioTrocaPapel(A, "supervisor", [comoAuxiliar])).toBeNull();
    expect(bloqueioTrocaPapel(A, "coordenacao", [comoAuxiliar])).toBeNull();
  });

  it("auxiliar de dupla não vira mentor nem perde papel", () => {
    expect(bloqueioTrocaPapel(A, "mentor_dpp", [comoAuxiliar])).toBe("auxiliar");
    expect(bloqueioTrocaPapel(A, "mentor_hibrido", [comoAuxiliar])).toBe(
      "auxiliar"
    );
    expect(bloqueioTrocaPapel(A, null, [comoAuxiliar])).toBe("auxiliar");
  });

  it("quem é mentor e auxiliar ao mesmo tempo precisa dos dois lados", () => {
    const duplo: VinculoDupla = { mentor_id: A, supervisor_id: A };
    expect(bloqueioTrocaPapel(A, "mentor_dpp", [duplo])).toBe("auxiliar");
    expect(bloqueioTrocaPapel(A, "supervisor", [duplo])).toBe("mentor");
    expect(bloqueioTrocaPapel(A, "coordenacao", [duplo])).toBe("mentor");
  });
});
