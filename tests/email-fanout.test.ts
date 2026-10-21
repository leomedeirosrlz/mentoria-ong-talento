import { describe, it, expect } from "vitest";
import { rolesParaAudiencias } from "@/lib/email";

// REALIZA-160 — o fan-out de e-mail é o caminho que furava a liberação
// programada: material 'todos' com encontro futuro chegava ao jovem no
// ato da publicação. A resolução audiência→papéis é a fronteira testável
// (o resto do disparo é I/O supabase/resend).
describe("rolesParaAudiencias — fan-out audiência → papéis", () => {
  it("'todos' cobre os 5 papéis (mentorado incluso desde a 108)", () => {
    expect(rolesParaAudiencias(["todos"])).toEqual(
      expect.arrayContaining([
        "coordenacao",
        "supervisor",
        "mentor_dpp",
        "mentor_especialista",
        "mentorado",
      ])
    );
  });

  it("excluirRoles tira o papel da audiência que o contém", () => {
    const roles = rolesParaAudiencias(["todos"], ["mentorado"]);
    expect(roles).not.toContain("mentorado");
    expect(roles).toContain("coordenacao");
    expect(roles).toContain("mentor_dpp");
  });

  it("excluir papel inexistente na audiência não muda nada", () => {
    expect(rolesParaAudiencias(["dpp"], ["mentorado"])).toEqual([
      "mentor_dpp",
    ]);
  });

  it("audiências somadas dedupam; audiência desconhecida ignora", () => {
    expect(rolesParaAudiencias(["dpp", "dpp"])).toEqual(["mentor_dpp"]);
    expect(rolesParaAudiencias(["inexistente"])).toEqual([]);
  });

  it("excluir o único papel zera a lista — disparo vira no-op coerente", () => {
    expect(rolesParaAudiencias(["dpp"], ["mentor_dpp"])).toEqual([]);
  });
});
