// @vitest-environment jsdom

// REALIZA-520 — o bloco "Sua semana" por estado de leitura: CTA por
// estado (Ver e responder quando falta o meu aceite), vínculo "este é o
// Nº", disclosure de materiais e a ausência de "aceitar" num combinado
// valendo. E a regressão do P0: sem encontro futuro, o ProximoEncontro
// caía no JovemAgendarSugestao SEM a prop plano — a jovem com plano
// proposto/ativo não via aceite, vínculo nem "Não serve pra mim".

import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/actions", () => ({
  agendarEncontroJovem: vi.fn(async () => ({ ok: true })),
  conflitoEncontro: vi.fn(async () => ({ conflitos: [] })),
  salvarLinkEncontro: vi.fn(async () => ({ ok: true })),
}));

import { ProximoEncontro } from "@/components/jovem-proximo-encontro";
import { SuaSemanaPlano } from "@/components/sua-semana-plano";
import { suaSemana } from "@/lib/sua-semana";
import type { PlanoCombinado } from "@/lib/plano-combinado";
import { perfilDeEncontros } from "@/lib/sugestoes-encontro";
import { montar } from "./dom";

const HOJE = "2026-11-23";

const planoCom = (over: Partial<PlanoCombinado>): PlanoCombinado => ({
  id: "pl-1",
  status: "ativo",
  versao: 1,
  aprovado_lado: null,
  aceites: { mentor: true, mentorado: true },
  escopo: {
    ritmo: 2,
    passos: [
      { numero: 5, data: "2026-11-28" },
      { numero: 6, data: "2026-12-02" },
    ],
  },
  proposto_em: "2026-11-20T10:00:00Z",
  ...over,
});

const links = (alvo: ParentNode) =>
  [...alvo.querySelectorAll("a")].map((a) => ({
    texto: a.textContent?.trim() ?? "",
    href: a.getAttribute("href") ?? "",
  }));

describe("ProximoEncontro — o plano entra em TODO ramo (P0)", () => {
  const agendar = {
    duplaId: "d-1",
    numero: 7,
    numeros: [7, 8],
    comQuem: "Ricardo",
    sugestoes: {
      perfil: perfilDeEncontros([], new Date(`${HOJE}T12:00:00-03:00`)),
      datas: [],
      disponibilidade: null,
      janela: null,
      ocupados: [],
      principal: { data: "2026-11-24", hora: "19:00", origem: "padrao" as const },
      duracaoMin: 60,
      hoje: HOJE,
    },
  };

  it("sem encontro futuro e com sugestão: o combinado renderiza no mesmo cartão", () => {
    const { alvo, desmontar } = montar(
      <ProximoEncontro
        proximo={null}
        rotulo={null}
        hoje={HOJE}
        agendar={agendar}
        linkEditavel={false}
        emCurso
        concluida={false}
        primeiroNome="Bia"
        plano={<div data-slot="semana">o combinado da dupla</div>}
      />
    );
    const secao = alvo.querySelector("section")!;
    expect(secao.textContent).toContain("7º encontro com Ricardo");
    expect(secao.querySelector('[data-slot="semana"]')?.textContent).toBe(
      "o combinado da dupla"
    );
    desmontar();
  });

  it("sem sugestão viável o ramo antigo também leva o plano", () => {
    const { alvo, desmontar } = montar(
      <ProximoEncontro
        proximo={null}
        rotulo={null}
        hoje={HOJE}
        agendar={{ ...agendar, sugestoes: null }}
        linkEditavel={false}
        emCurso
        concluida={false}
        primeiroNome="Bia"
        plano={<div data-slot="semana">o combinado da dupla</div>}
      />
    );
    expect(alvo.querySelector('[data-slot="semana"]')).not.toBeNull();
    desmontar();
  });
});

describe("SuaSemanaPlano — CTA e pill por estado", () => {
  const base = {
    perspectiva: "mentor" as const,
    outro: "Ana",
    quem: "a equipe",
    combinadoHref: "/duplas/d-1#plano-em-dia",
    confirmarHref: "/duplas/d-1#acordos",
  };

  it("falta o meu aceite: 'Ver e responder' primário, nunca 'Confirmar data'", () => {
    const semana = suaSemana({
      plano: planoCom({
        status: "proposto",
        aceites: { mentor: false, mentorado: false },
      }),
      meuLado: "mentor",
    })!;
    const { alvo, desmontar } = montar(
      <SuaSemanaPlano {...base} semana={semana} />
    );
    expect(alvo.textContent).toContain("Falta o seu aceite");
    const ls = links(alvo);
    const responder = ls.find((l) => l.texto.startsWith("Ver e responder"));
    expect(responder?.href).toBe("/duplas/d-1#acordos");
    expect(ls.some((l) => l.texto === "Confirmar data")).toBe(false);
    desmontar();
  });

  it("valendo sem o meu carimbo: 'Ver o combinado', sem pedir aceite nem data", () => {
    const semana = suaSemana({
      plano: planoCom({
        status: "aceito",
        aceites: { mentor: true, mentorado: false },
      }),
      meuLado: "mentorado",
    })!;
    const { alvo, desmontar } = montar(
      <SuaSemanaPlano
        {...base}
        perspectiva="jovem"
        outro="Ricardo"
        quem="Ricardo"
        combinadoHref="/jovem/agenda#plano"
        semana={semana}
      />
    );
    expect(alvo.textContent).toContain("Plano valendo");
    const ls = links(alvo);
    // "Ver e responder" não aparece — quem não carimbou foi avisado
    expect(ls.some((l) => l.texto.startsWith("Ver e responder"))).toBe(false);
    expect(ls.some((l) => l.texto === "Confirmar data")).toBe(false);
    expect(
      ls.find((l) => l.texto.startsWith("Ver o combinado"))?.href
    ).toBe("/jovem/agenda#plano");
    desmontar();
  });

  it("ativo: 'Confirmar data' primário + 'Ver o combinado', sem falar em aceite", () => {
    const semana = suaSemana({
      plano: planoCom({ status: "ativo" }),
      meuLado: "mentor",
      proximoNumero: 5,
    })!;
    const { alvo, desmontar } = montar(
      <SuaSemanaPlano {...base} semana={semana} quem="Ricardo" />
    );
    expect(alvo.textContent).toContain(
      "Este é o 5º encontro do plano que Ricardo combinou."
    );
    // nada pede aceite num combinado já valendo
    expect(alvo.textContent).not.toMatch(/aceit/i);
    const ls = links(alvo);
    expect(ls.find((l) => l.texto === "Confirmar data")?.href).toBe(
      "/duplas/d-1#acordos"
    );
    expect(
      ls.find((l) => l.texto.startsWith("Ver o combinado"))?.href
    ).toBe("/duplas/d-1#plano-em-dia");
    desmontar();
  });

  it("disclosure de roteiro/materiais usa o passo do vínculo", () => {
    const semana = suaSemana({
      plano: planoCom({ status: "ativo" }),
      meuLado: "mentor",
      proximoNumero: 6,
    })!;
    const { alvo, desmontar } = montar(
      <SuaSemanaPlano
        {...base}
        semana={semana}
        materiais={[{ href: "/materiais/roteiro-6", titulo: "Roteiro do 6º" }]}
      />
    );
    const summary = alvo.querySelector("summary")!;
    expect(summary.textContent).toContain(
      "Roteiro e materiais do 6º encontro"
    );
    desmontar();
  });
});
