// @vitest-environment jsdom

// 022/US4 — o remate da linha de instrumento na ficha: 1 badge de estado
// dominante (respondido > link vivo > expirado > não enviado) + 1 ação
// primária contextual + ⋯ com as secundárias. O chip da janela do guia e
// "Como conduzir"/"Ler o guia" saíram da linha pro metadado e pro menu.

import { act } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/duplas/d1",
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/actions-formularios", () => ({
  enviarInstrumentoMentorado: vi.fn(async () => ({
    ok: true,
    token: "tok-novo",
    reutilizado: false,
  })),
}));

import { InstrumentosDupla } from "@/app/(app)/duplas/[id]/instrumentos-dupla";
import type {
  InstrumentoDupla,
  InstrumentoEntrega,
} from "@/lib/forms/queries";
import {
  INSTRUMENTO_INFO,
  type InstrumentoDuplaSistema,
} from "@/lib/forms/schema";
import { assentar, clicar, montar } from "./dom";

Object.assign(navigator, {
  clipboard: { writeText: vi.fn(async () => {}) },
});

function entrega(parcial: Partial<InstrumentoEntrega>): InstrumentoEntrega {
  return {
    link_id: `l-${Math.random().toString(36).slice(2, 8)}`,
    token: "tok1",
    destino: "mentorado",
    status: "pendente",
    respondido_em: null,
    respostas: null,
    ...parcial,
  };
}

function item(
  sistema: InstrumentoDuplaSistema,
  entregas: InstrumentoEntrega[]
): InstrumentoDupla {
  return {
    sistema,
    formulario_id: `f-${sistema}`,
    titulo: INSTRUMENTO_INFO[sistema].titulo,
    descricao: null,
    ativo: true,
    campos: [],
    entregas,
  };
}

function montarLista(itens: InstrumentoDupla[], souMentor = false) {
  return montar(
    <InstrumentosDupla
      duplaId="d1"
      itens={itens}
      mentoradoNome="Ana Souza"
      mentoradoWhatsapp="5511987654321"
      mentorNome="Paulo Lima"
      mentorWhatsapp="5511912345678"
      podeEnviar
      jornadaViva
      souMentor={souMentor}
    />
  );
}

function linhaDe(alvo: ParentNode, sistema: InstrumentoDuplaSistema) {
  const li = [...alvo.querySelectorAll("li")].find((l) =>
    l.textContent?.includes(INSTRUMENTO_INFO[sistema].titulo)
  );
  if (!li) throw new Error(`linha ${sistema} não achada`);
  return li as HTMLElement;
}

const badges = (li: ParentNode) => [
  ...li.querySelectorAll('[data-slot="badge"]'),
];

/** O ⋯ da linha — trigger icon-only nomeado pelo instrumento. */
const gatilhoMenu = (li: ParentNode) =>
  li.querySelector<HTMLElement>('button[aria-label^="Ações de"]');

/** Botão de texto da linha (a primária) — o ⋯ é o único botão sem texto. */
const primaria = (li: ParentNode) =>
  [...li.querySelectorAll("button")].find(
    (b) => b.getAttribute("aria-label")?.startsWith("Ações de") !== true
  );

const RESPONDIDA = {
  status: "respondido",
  respondido_em: "2026-11-10T14:00:00-03:00",
  respostas: { c1: "ok" },
} as const;

describe("remate da linha de instrumento (022)", () => {
  it("não enviado: 1 badge, primária 'Gerar link', ⋯ nomeado pelo título", () => {
    const { alvo, desmontar } = montarLista([item("metas", [])]);
    const li = linhaDe(alvo, "metas");
    expect(badges(li).map((b) => b.textContent)).toEqual(["não enviado"]);
    expect(primaria(li)?.textContent).toContain("Gerar link");
    expect(gatilhoMenu(li)?.getAttribute("aria-label")).toBe(
      `Ações de ${INSTRUMENTO_INFO.metas.titulo}`
    );
    desmontar();
  });

  it("pendente (link vivo): 1 badge 'link enviado', primária 'Copiar link'", () => {
    const { alvo, desmontar } = montarLista([
      item("visao", [entrega({ status: "pendente" })]),
    ]);
    const li = linhaDe(alvo, "visao");
    expect(badges(li).map((b) => b.textContent)).toEqual(["link enviado"]);
    expect(primaria(li)?.textContent).toContain("Copiar link");
    desmontar();
  });

  it("pendente com origem jovem: badge 'pedido pelo jovem'", () => {
    const { alvo, desmontar } = montarLista([
      item("visao", [
        entrega({ status: "pendente", contexto: { origem: "jovem" } }),
      ]),
    ]);
    const li = linhaDe(alvo, "visao");
    expect(badges(li).map((b) => b.textContent)).toEqual([
      "pedido pelo jovem",
    ]);
    expect(primaria(li)?.textContent).toContain("Copiar link");
    desmontar();
  });

  it("respondido: badge único 'respondido', primária 'Ver resposta', data na linha", () => {
    const { alvo, desmontar } = montarLista([
      item("visao", [entrega(RESPONDIDA)]),
    ]);
    const li = linhaDe(alvo, "visao");
    expect(badges(li).map((b) => b.textContent)).toEqual(["respondido"]);
    expect(primaria(li)?.textContent).toContain("Ver resposta");
    expect(li.textContent).toContain("Respondido em");
    desmontar();
  });

  it("respondido + link vivo: ainda 1 badge, pendência vira metadado", () => {
    const { alvo, desmontar } = montarLista([
      item("visao", [entrega(RESPONDIDA), entrega({ status: "pendente" })]),
    ]);
    const li = linhaDe(alvo, "visao");
    // o link vivo ao lado do respondido não vira 2º badge — desce pro meta
    expect(badges(li)).toHaveLength(1);
    expect(badges(li)[0]?.textContent).toBe("respondido");
    expect(li.textContent).toContain("link enviado");
    expect(primaria(li)?.textContent).toContain("Ver resposta");
    desmontar();
  });

  it("expirado: badge 'link expirado', primária 'Gerar novo link'", () => {
    const { alvo, desmontar } = montarLista([
      item("pdm", [entrega({ status: "expirado" })]),
    ]);
    const li = linhaDe(alvo, "pdm");
    expect(badges(li).map((b) => b.textContent)).toEqual(["link expirado"]);
    expect(primaria(li)?.textContent).toContain("Gerar novo link");
    desmontar();
  });

  it("'Como conduzir' e 'Ler o guia' não ficam na linha — vivem no ⋯", () => {
    const { alvo, desmontar } = montarLista([
      item("visao", [entrega(RESPONDIDA)]),
    ]);
    const li = linhaDe(alvo, "visao");
    expect(li.querySelector("details")).toBeNull();
    expect(li.textContent).not.toContain("Como conduzir");
    expect(li.textContent).not.toContain("Ler o guia");
    expect([...li.querySelectorAll("a")]).toHaveLength(0);
    desmontar();
  });

  it("o ⋯ lista as secundárias do estado respondido (Pedir pra refazer + docs)", async () => {
    const { alvo, desmontar } = montarLista([
      item("visao", [entrega(RESPONDIDA)]),
    ]);
    act(() => clicar(gatilhoMenu(linhaDe(alvo, "visao"))!));
    await assentar();
    const popup = document.querySelector('[data-slot="dropdown-menu-content"]');
    expect(popup).not.toBeNull();
    const rotulos = [...popup!.querySelectorAll('[role="menuitem"]')].map(
      (i) => i.textContent
    );
    expect(rotulos).toContain("Pedir pra refazer");
    expect(rotulos).toContain("Como conduzir");
    expect(rotulos).toContain("Ler o guia");
    desmontar();
  });

  it("respondido + link vivo: o ⋯ carrega Copiar/WhatsApp e esconde refazer", async () => {
    const { alvo, desmontar } = montarLista([
      item("visao", [entrega(RESPONDIDA), entrega({ status: "pendente" })]),
    ]);
    act(() => clicar(gatilhoMenu(linhaDe(alvo, "visao"))!));
    await assentar();
    const popup = document.querySelector('[data-slot="dropdown-menu-content"]');
    const rotulos = [...popup!.querySelectorAll('[role="menuitem"]')].map(
      (i) => i.textContent
    );
    expect(rotulos).toContain("Copiar link");
    expect(rotulos).toContain("Enviar no WhatsApp");
    // refazerVivo: já há link vivo da mesma marcação — o gesto some
    expect(rotulos).not.toContain("Pedir pra refazer");
    desmontar();
  });

  it("copiar pela primária escreve /f/<token> e vira 'Copiado'", async () => {
    const { alvo, desmontar } = montarLista([
      item("visao", [entrega({ status: "pendente" })]),
    ]);
    const li = linhaDe(alvo, "visao");
    await act(async () => clicar(primaria(li)!));
    await assentar();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("/f/tok1")
    );
    expect(primaria(li)?.textContent).toContain("Copiado");
    desmontar();
  });
});

// 526 — o checklist de competências é a exceção da lista: o respondente é
// o mentor, não o jovem. Na mão dele a linha vira a ação de responder o
// próprio link; na mão da coord segue o gesto de envio ao mentor.
describe("checklist de competências — ownership e ação (526)", () => {
  it("na mão do mentor: 'Responder agora' abre o /f/ vivo e o ⋯ não nudga pra si", async () => {
    const { alvo, desmontar } = montarLista(
      [
        item("competencias_mentor", [
          entrega({ status: "pendente", destino: "mentor" }),
        ]),
      ],
      true
    );
    const li = linhaDe(alvo, "competencias_mentor");
    expect(badges(li).map((b) => b.textContent)).toEqual([
      "pra você responder",
    ]);
    expect(li.textContent).toContain("responde você");
    const link = li.querySelector<HTMLAnchorElement>('a[href="/f/tok1"]');
    expect(link?.textContent).toContain("Responder agora");
    act(() => clicar(gatilhoMenu(li)!));
    await assentar();
    const popup = document.querySelector(
      '[data-slot="dropdown-menu-content"]'
    );
    const rotulos = [...popup!.querySelectorAll('[role="menuitem"]')].map(
      (i) => i.textContent
    );
    expect(rotulos).toContain("Copiar link");
    expect(rotulos).not.toContain("Enviar no WhatsApp");
    desmontar();
  });

  it("na mão da coord: 'aguardando o mentor' + primária Copiar link", () => {
    const { alvo, desmontar } = montarLista([
      item("competencias_mentor", [
        entrega({ status: "pendente", destino: "mentor" }),
      ]),
    ]);
    const li = linhaDe(alvo, "competencias_mentor");
    expect(badges(li).map((b) => b.textContent)).toEqual([
      "aguardando o mentor",
    ]);
    expect(li.textContent).toContain("responde o mentor");
    expect(primaria(li)?.textContent).toContain("Copiar link");
    desmontar();
  });

  it("respondido + 2ª marcação aberta: 'Responder agora' convive com 'Ver resposta'", () => {
    const { alvo, desmontar } = montarLista(
      [
        item("competencias_mentor", [
          entrega({ ...RESPONDIDA, destino: "mentor" }),
          entrega({ status: "pendente", destino: "mentor" }),
        ]),
      ],
      true
    );
    const li = linhaDe(alvo, "competencias_mentor");
    expect(badges(li).map((b) => b.textContent)).toEqual(["respondido"]);
    expect(li.textContent).toContain("link aberto pra você");
    expect(
      li.querySelector<HTMLAnchorElement>('a[href="/f/tok1"]')?.textContent
    ).toContain("Responder agora");
    desmontar();
  });
});
