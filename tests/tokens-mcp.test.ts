// PAT do MCP (REALIZA-295) — o formato da credencial e o comportamento
// puro por trás do TokensMcp: o cru sai uma vez em rlz_mcp_+48hex e o que
// o banco vê é só o sha256; o rótulo nunca vai vazio; a linha da lista
// mostra último uso × criação + expiração. A interação mint→lista→revoga
// fica no e2e (vitest aqui é node puro, sem DOM de eventos).

import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  gerarTokenMcp,
  metaTokenMcp,
  rotuloDoToken,
  rotuloPadraoMcp,
} from "@/lib/ia/mcp-token";
import { TokensMcp } from "@/components/tokens-mcp";

describe("gerarTokenMcp", () => {
  it("emite rlz_mcp_ + 48 hex e o hash é o sha256 do cru", async () => {
    const { cru, hash } = await gerarTokenMcp();
    expect(cru).toMatch(/^rlz_mcp_[0-9a-f]{48}$/);
    expect(hash).toBe(createHash("sha256").update(cru).digest("hex"));
    // o que sobe pro insert é só o digest — o cru nunca vai junto
    expect(hash).not.toContain(cru);
  });

  it("dois tokens nunca colidem", async () => {
    const a = await gerarTokenMcp();
    const b = await gerarTokenMcp();
    expect(a.cru).not.toBe(b.cru);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("rótulo", () => {
  it("padrão nomeia pela data de hoje", () => {
    expect(rotuloPadraoMcp()).toMatch(/^Token \d{2}\/\d{2}\/\d{2}$/);
  });

  it("digitado vazio cai no padrão; preenchido ganha (trim)", () => {
    expect(rotuloDoToken("", "Token 01/01/26")).toBe("Token 01/01/26");
    expect(rotuloDoToken("   ", "Token 01/01/26")).toBe("Token 01/01/26");
    expect(rotuloDoToken("  Claude desktop ", "x")).toBe("Claude desktop");
  });
});

describe("metaTokenMcp", () => {
  const base = {
    created_at: "2026-11-10T12:00:00Z",
    ultimo_uso_em: null,
    expira_em: "2027-02-08T12:00:00Z",
  };

  it("sem uso mostra criação + expiração", () => {
    expect(metaTokenMcp(base)).toBe("criado 10/11/26 · expira em 08/02/27");
  });

  it("com uso troca a criação pelo último uso", () => {
    expect(
      metaTokenMcp({ ...base, ultimo_uso_em: "2026-11-20T12:00:00Z" })
    ).toBe("último uso 20/11/26 · expira em 08/02/27");
  });

  it("sem expiração (token antigo) omite a cláusula", () => {
    expect(metaTokenMcp({ ...base, expira_em: null })).toBe("criado 10/11/26");
  });
});

describe("TokensMcp (SSR)", () => {
  beforeAll(() => {
    // o client browser só constrói com as envs públicas — sem rede aqui
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://sb.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-teste");
  });

  it("monta com endpoint, botão de gerar e o campo de rótulo", () => {
    const html = renderToStaticMarkup(
      createElement(TokensMcp, {
        textos: {
          gerar: "Gerar token",
          campoRotulo: { label: "Rótulo", placeholder: "ex.: Claude desktop" },
        },
      })
    );
    expect(html).toContain("/api/mcp");
    expect(html).toContain("Gerar token");
    expect(html).toContain("Rótulo");
    expect(html).toContain("ex.: Claude desktop");
    // a lista nasce em skeleton (tokens === null até o fetch resolver)
    expect(html).toContain("Carregando tokens");
    // nada de token cru no markup inicial — ele só aparece após gerar
    expect(html).not.toContain("rlz_mcp_");
  });

  it("sem campoRotulo (bolha) não renderiza o input de nome", () => {
    const html = renderToStaticMarkup(
      createElement(TokensMcp, { textos: { gerar: "Gerar novo token" } })
    );
    expect(html).toContain("Gerar novo token");
    expect(html).not.toContain("Rótulo");
    expect(html).not.toContain("<input");
  });
});
