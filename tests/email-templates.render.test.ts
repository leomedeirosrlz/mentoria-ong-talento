import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import {
  emailAviso,
  emailMaterial,
  emailDocumentoAssinatura,
  emailSenhaAlterada,
  emailEmailAlterado,
} from "@/lib/email-templates";

// EMAIL_PREVIEW=1 pnpm vitest run … → grava os HTMLs em /tmp pra olhar no browser
const dump = (nome: string, html: string) => {
  if (process.env.EMAIL_PREVIEW) writeFileSync(`/tmp/${nome}.html`, html);
};

describe("templates de e-mail", () => {
  it("aviso urgente: eyebrow, banner, preheader e faixa de prioridade", () => {
    const html = emailAviso({
      titulo: "Semana 6 — encontros",
      corpo: "Lembrem de registrar <até> sexta.",
      prioridade: "urgente",
    });
    dump("email-aviso", html);
    expect(html).toContain("Aviso da coordenação");
    expect(html).toContain("mso-hide:all");
    expect(html).toContain(">Urgente<"); // faixa de prioridade
    expect(html).toContain("&lt;até&gt;"); // corpo escapado
    expect(html).not.toContain("<até>");
    // casca nova: banner da marca abre e fecha, CTA em gradiente lime
    expect((html.match(/vamos-juntos\.png/g) ?? []).length).toBe(2);
    expect(html).toContain("linear-gradient(90deg,#a0c644");
    expect(html).toContain("— Equipe Realiza.vc");
  });

  it("material: card com chip do tipo", () => {
    const html = emailMaterial({
      titulo: "Guia do encontro 6",
      descricao: "Leiam antes do encontro.",
      tipoLabel: "Guia",
      ctaHref: "https://realizavc.vercel.app/materiais",
    });
    dump("email-material", html);
    expect(html).toContain("Biblioteca de materiais");
    expect(html).toContain("Abrir material");
  });

  it("documento: link pessoal escapado no rodapé", () => {
    const html = emailDocumentoAssinatura({
      docTitulo: "Termo de Voluntariado",
      primeiroNome: "Ana",
      link: "https://realizavc.vercel.app/assinar/abc?x=1&y=2",
    });
    dump("email-documento", html);
    expect(html).toContain("Documento para assinar");
    expect(html).toContain("abc?x=1&amp;y=2");
  });

  it("senha alterada: copy de segurança e CTA pro perfil", () => {
    const html = emailSenhaAlterada({ email: "ana@exemplo.com" });
    dump("email-senha", html);
    expect(html).toContain("Sua senha foi alterada");
    expect(html).toContain("ana@exemplo.com");
    expect(html).toContain("Acessar minha conta");
    expect(html).toContain("/perfil");
  });

  it("e-mail alterado: vai pro endereço antigo e cita os dois", () => {
    const html = emailEmailAlterado({
      antigo: "velho@exemplo.com",
      novo: "novo@exemplo.com",
    });
    dump("email-troca", html);
    expect(html).toContain("Seu e-mail de acesso mudou");
    expect(html).toContain("velho@exemplo.com");
    expect(html).toContain("novo@exemplo.com");
    expect(html).toContain("coordenação");
  });
});
