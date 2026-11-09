import { describe, it, expect } from "vitest";
import {
  rolesParaAudiencias,
  enviarEmailsLote,
  EMAIL_ENVIO_LIBERADO,
} from "@/lib/email";

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

// kill-switch global liberado: notificação passa do switch e o guard
// seguinte é a config do transporte — cair no "não configurado" com a
// key stubada vazia prova o caminho sem rede
describe("EMAIL_ENVIO_LIBERADO — kill-switch do envio", () => {
  it("liberado: notificação passa do switch e cai no guard de config", async () => {
    expect(EMAIL_ENVIO_LIBERADO).toBe(true);
    const key = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "";
    try {
      const r = await enviarEmailsLote({
        para: ["a@x.com", "b@x.com"],
        assunto: "teste",
        html: "<p>x</p>",
      });
      expect(r.enviados).toBe(0);
      expect(r.falhas).toEqual(["a@x.com", "b@x.com"]);
      expect(r.error).toMatch(/não configurado/);
    } finally {
      if (key === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = key;
    }
  });

  it("critico segue passando — caminho de conta inalterado", async () => {
    const key = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "";
    try {
      const r = await enviarEmailsLote({
        para: ["a@x.com"],
        assunto: "teste",
        html: "<p>x</p>",
        critico: true,
      });
      expect(r.error).toMatch(/não configurado/);
      expect(r.enviados).toBe(0);
    } finally {
      if (key === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = key;
    }
  });
});
