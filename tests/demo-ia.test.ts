// responderDemoIa — chips do jovem: pergunta conceitual ("o que é…",
// "como funciona…") vai pro card de ajuda oficial, não pro card de
// progresso nem pra lista de pedidos (era o bug dos chips do painel).
// Cookie demo_role mockado — a demo inteira roda no dataset evergreen.
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) =>
      nome === "demo_role" ? { value: "mentorado" } : undefined,
  }),
}));

import { responderDemoIa } from "@/lib/demo/ia";

const kinds = (r: Awaited<ReturnType<typeof responderDemoIa>>) =>
  (r?.ui ?? []).map((b) => b.kind);

describe("responderDemoIa — chips do mentorado", () => {
  it('"O que é o PDM?" cai na ajuda, não no card de jornada', async () => {
    const r = await responderDemoIa("O que é o PDM?");
    expect(r).not.toBeNull();
    expect(kinds(r)).toContain("fontes");
    expect(kinds(r)).not.toContain("jornada");
  });

  it('"Como funciona o especialista?" cai na ajuda, não nos pedidos', async () => {
    const r = await responderDemoIa("Como funciona o especialista?");
    expect(r).not.toBeNull();
    expect(kinds(r)).toContain("fontes");
    expect(kinds(r)).not.toContain("pedidos");
  });

  it("pergunta de dados segue no card dela", async () => {
    expect(kinds(await responderDemoIa("Como tá minha jornada?"))).toContain(
      "jornada"
    );
    expect(
      kinds(await responderDemoIa("E meu pedido de especialista?"))
    ).toContain("pedidos");
    expect(kinds(await responderDemoIa("O que tenho pra fazer?"))).toContain(
      "combinados"
    );
    expect(kinds(await responderDemoIa("Quem é meu mentor?"))).toContain(
      "dupla"
    );
    expect(
      kinds(await responderDemoIa("Quando é o próximo encontro?"))
    ).toContain("agenda");
  });

  it("todo chip do jovem tem resposta demo e nenhuma tem travessão", async () => {
    for (const q of [
      "Quando é o próximo encontro?",
      "Tive encontro essa semana?",
      "O que é o PDM?",
      "E meu pedido de especialista?",
      "Como funciona o especialista?",
      "Como tá minha jornada?",
      "O que tenho pra fazer?",
      "Quem é meu mentor?",
    ]) {
      const r = await responderDemoIa(q);
      expect(r, q).not.toBeNull();
      expect(r!.content, q).not.toContain("—");
    }
  });
});
