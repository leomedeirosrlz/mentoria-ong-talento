// @vitest-environment jsdom

// REALIZA-512 — o nome do mentorado É o controle, em três regimes: uma
// dupla só esconde o seletor (nada a escolher), até três viram pills com
// aria-current e href que escreve ?dupla= na base da régua/página; acima
// de três a faixa vira o dropdown do kit. "Todas" devolve a lista
// inteira (a régua ganhou comTodas — a escolha não é mais escondida num
// botão "Ficha").

import { describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes, ReactNode } from "react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));
// o Link do Next pede contexto de router que o jsdom não tem — pra
// medir href/aria-current basta a âncora
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}));

import {
  MentoradoSeletor,
  type FichaMentor,
} from "@/components/mentorado-seletor";
import { montar } from "./dom";

const ficha = (n: number): FichaMentor => ({
  id: `d${n}`,
  jovemNome: `Jovem ${n}`,
});
const BASE_REGUA = "/materiais?aba=instrumentos";

describe("MentoradoSeletor — pills até 3, dropdown acima", () => {
  it("uma dupla só: nada a escolher, o seletor some", () => {
    const { alvo, desmontar } = montar(
      <MentoradoSeletor
        fichas={[ficha(1)]}
        selecionada="d1"
        hrefBase={BASE_REGUA}
        comTodas
      />
    );
    expect(alvo.textContent).toBe("");
    desmontar();
  });

  it("três duplas: pills com nome, aria-current e ?dupla= no href", () => {
    const { alvo, desmontar } = montar(
      <MentoradoSeletor
        fichas={[ficha(1), ficha(2), ficha(3)]}
        selecionada="d2"
        hrefBase={BASE_REGUA}
        comTodas
      />
    );
    const nav = alvo.querySelector('nav[aria-label="Filtrar por mentorado"]');
    expect(nav).not.toBeNull();
    const links = [...nav!.querySelectorAll("a")];
    expect(links.map((a) => a.textContent)).toEqual([
      "Todas",
      "Jovem 1",
      "Jovem 2",
      "Jovem 3",
    ]);
    // a escolha mora na URL: pill = base + &dupla=, "Todas" = base nua
    expect(links[0].getAttribute("href")).toBe(BASE_REGUA);
    expect(links[2].getAttribute("href")).toBe(`${BASE_REGUA}&dupla=d2`);
    expect(links[2].getAttribute("aria-current")).toBe("page");
    expect(links[1].getAttribute("aria-current")).toBeNull();
    desmontar();
  });

  it("sem seleção + comTodas: o 'Todas' carrega o aria-current", () => {
    const { alvo, desmontar } = montar(
      <MentoradoSeletor
        fichas={[ficha(1), ficha(2)]}
        selecionada={null}
        hrefBase={BASE_REGUA}
        comTodas
      />
    );
    const links = [...alvo.querySelectorAll("a")];
    expect(links[0].textContent).toBe("Todas");
    expect(links[0].getAttribute("aria-current")).toBe("page");
    desmontar();
  });

  it("quatro duplas: a faixa vira o dropdown nomeado, não 4 pills", () => {
    const { alvo, desmontar } = montar(
      <MentoradoSeletor
        fichas={[ficha(1), ficha(2), ficha(3), ficha(4)]}
        selecionada="d3"
        hrefBase={BASE_REGUA}
        comTodas
      />
    );
    expect(alvo.querySelector('nav[aria-label="Filtrar por mentorado"]')).toBeNull();
    const gatilho = alvo.querySelector(
      'button[aria-label="Mentorado em foco"]'
    );
    expect(gatilho).not.toBeNull();
    // o valor exibido é o nome da dupla em foco — a escolha nunca é um
    // número nem um "Ficha" de link
    expect(gatilho!.textContent).toContain("Jovem 3");
    desmontar();
  });

  it("dropdown sem seleção + comTodas: exibe 'Todas as duplas'", () => {
    const { alvo, desmontar } = montar(
      <MentoradoSeletor
        fichas={[ficha(1), ficha(2), ficha(3), ficha(4)]}
        selecionada={null}
        hrefBase={BASE_REGUA}
        comTodas
      />
    );
    const gatilho = alvo.querySelector(
      'button[aria-label="Mentorado em foco"]'
    );
    expect(gatilho!.textContent).toContain("Todas as duplas");
    desmontar();
  });

  it("hrefBase sem query: o ?dupla= entra com '?' e não '&'", () => {
    const { alvo, desmontar } = montar(
      <MentoradoSeletor
        fichas={[ficha(1), ficha(2)]}
        selecionada={null}
        hrefBase="/materiais/instrumentos/pdm"
        comTodas
      />
    );
    const links = [...alvo.querySelectorAll("a")];
    expect(links[2].getAttribute("href")).toBe(
      "/materiais/instrumentos/pdm?dupla=d2"
    );
    desmontar();
  });
});
