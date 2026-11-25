// A saída de emergência da sessão: limpa os cookies de auth (inclusive os
// fatias do Supabase) e manda pro login. É o que evita a pessoa ficar
// presa no "recarregar" quando o cookie velho pós-deploy quebra o app.
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "@/app/auth/sair-limpo/route";

describe("/auth/sair-limpo", () => {
  it("manda pro login e apaga sb-* e os cookies da demo", () => {
    const req = new NextRequest("http://app.test/auth/sair-limpo", {
      headers: {
        cookie:
          "sb-ref-auth-token.0=velho; sb-ref-auth-token.1=resto; demo_role=mentorado; outro=fica",
      },
    });
    const res = GET(req);

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "http://app.test/login?motivo=sessao"
    );
    const cookies = res.headers.getSetCookie().join("\n");
    expect(cookies).toContain("sb-ref-auth-token.0=");
    expect(cookies).toContain("sb-ref-auth-token.1=");
    expect(cookies).toContain("demo_role=");
    expect(cookies).not.toContain("outro=");
  });
});
