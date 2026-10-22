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

// kill-switch global (TODO pendente): enquanto desligado, só auth/conta
// sai — notificação volta como falha de transporte coerente, nunca falso
// sucesso pro caller
describe("EMAIL_ENVIO_LIBERADO — kill-switch do envio", () => {
  it("desligado: notificação não sai, destinos voltam em falhas", async () => {
    expect(EMAIL_ENVIO_LIBERADO).toBe(false);
    const r = await enviarEmailsLote({
      para: ["a@x.com", "b@x.com"],
      assunto: "teste",
      html: "<p>x</p>",
    });
    expect(r.enviados).toBe(0);
    expect(r.falhas).toEqual(["a@x.com", "b@x.com"]);
    expect(r.error).toMatch(/desativado/);
  });

  it("critico fura o switch — e-mail de conta chega ao guard seguinte", async () => {
    // sem RESEND_API_KEY no vitest: passar do kill-switch e cair no guard
    // de config prova o bypass (error muda de "desativado" pra "não
    // configurado"); a key fica stubada vazia por garantia — nunca rede
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
