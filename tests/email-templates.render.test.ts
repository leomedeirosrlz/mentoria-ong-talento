import { describe, it, expect } from "vitest";
import { emailAviso, emailMaterial } from "@/lib/email-templates";

describe("templates de e-mail", () => {
  it("aviso urgente: tagline, selo, preheader e faixa de prioridade", () => {
    const html = emailAviso({
      titulo: "Semana 6 — encontros",
      corpo: "Lembrem de registrar <até> sexta.",
      prioridade: "urgente",
    });
    expect(html).toContain("Aviso da coordenação");
    expect(html).toContain("Aviso · Urgente");
    expect(html).toContain("mso-hide:all");
    expect(html).toContain(">Urgente<"); // faixa de prioridade
    expect(html).toContain("&lt;até&gt;"); // corpo escapado
    expect(html).not.toContain("<até>");
  });

  it("material: card com chip do tipo e selo próprio", () => {
    const html = emailMaterial({
      titulo: "Guia do encontro 6",
      descricao: "Leiam antes do encontro.",
      tipoLabel: "Guia",
      ctaHref: "https://realizavc.vercel.app/materiais",
    });
    expect(html).toContain("Biblioteca de materiais");
    expect(html).toContain("Material novo");
    expect(html).toContain("Abrir material");
  });
});
