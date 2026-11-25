// @vitest-environment jsdom

// 022 (US2) — o cabeçalho do link público de avaliação: saudação → h1 do
// gesto → subtítulo com data+dia (a linha `contexto` do servidor) → h3
// com a linha de privacidade, tudo antes do primeiro campo do form.
// Invariante duro: EXATAMENTE um h1 por estado — o do cabeçalho no
// form, o do EstadoCard nos terminais e o do cartão de sucesso após o
// envio (o cabeçalho some quando `submeteu`).

import { act, type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions-avaliacao", () => ({
  submeterAvaliacao: vi.fn(async () => ({ ok: true })),
}));

// jsdom não corre a animação de exit do AnimatePresence — o sucesso nunca
// montaria no teste. O stub troca a coreografia por render direta; o que o
// teste mede é a ORDEM do DOM resultante, não a transição em si.
vi.mock("motion/react", async () => {
  const React = await import("react");
  const PROPS_MOTION = new Set([
    "initial",
    "animate",
    "exit",
    "transition",
    "variants",
    "whileHover",
    "whileTap",
    "whileFocus",
    "whileInView",
    "layout",
    "layoutId",
    "onAnimationComplete",
    "onExitComplete",
  ]);
  const Div = ({
    ref: refProp,
    children,
    ...rest
  }: {
    ref?: React.Ref<HTMLDivElement>;
    children?: React.ReactNode;
  } & Record<string, unknown>) => {
    for (const k of Object.keys(rest))
      if (PROPS_MOTION.has(k)) delete rest[k];
    return (
      <div ref={refProp} {...rest}>
        {children}
      </div>
    );
  };
  return {
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => (
      <>{children}</>
    ),
    // qualquer motion.* resolve pro mesmo div — o form só usa motion.div
    motion: new Proxy({}, { get: () => Div }),
  };
});

import { AvaliarTokenFlow } from "@/components/avaliar-token-flow";
import { AvaliacaoEncontroForm } from "@/components/avaliacao-encontro-form";
import { clicar, montar, submeter } from "./dom";

const BASE = {
  token: "tok-0123456789abcdef01234567",
  trilha: "dpp",
  jaRegistrada: false,
  primeiroNome: "Maria",
  contexto: "Encontro 3 com Fulano · terça-feira, 24/11 às 19:00",
  sessao: [3],
  demo: false,
  retryHref: "/avaliar/tok-0123456789abcdef01234567",
};

function montarFlow(
  over: Partial<ComponentProps<typeof AvaliarTokenFlow>> = {}
) {
  return montar(<AvaliarTokenFlow {...BASE} {...over} />);
}

const h1s = (alvo: ParentNode) => [...alvo.querySelectorAll("h1")];

const paragrafos = (alvo: ParentNode, texto: string) =>
  [...alvo.querySelectorAll("p")].filter((p) =>
    p.textContent?.includes(texto)
  );

/** a precede b na ordem do documento */
const antes = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("cabeçalho do link de avaliação (022/US2)", () => {
  it("ordena saudação → h1 → subtítulo → h3 antes do form", () => {
    const { alvo, desmontar } = montarFlow();
    const [saudacao] = paragrafos(alvo, "Olá, Maria!");
    expect(saudacao).toBeTruthy();
    const [h1] = h1s(alvo);
    expect(h1.textContent).toBe("Como foi o encontro?");
    const [subtitulo] = paragrafos(alvo, "terça-feira, 24/11 às 19:00");
    expect(subtitulo.textContent).toContain("Encontro 3 com Fulano");
    const h3 = alvo.querySelector("h3")!;
    expect(h3.textContent).toContain("1 minuto");
    expect(h3.textContent).toContain("mentor vê só a média");
    const form = alvo.querySelector("form")!;
    for (const [a, b] of [
      [saudacao, h1],
      [h1, subtitulo],
      [subtitulo, h3],
      [h3, form],
    ] as const) {
      expect(antes(a, b)).toBe(true);
    }
    desmontar();
  });

  it("o form entra embutido: a saudação e o h1 não se duplicam", () => {
    const { alvo, desmontar } = montarFlow();
    expect(h1s(alvo)).toHaveLength(1);
    // sem embutido o cartão interno repetiria a saudação
    expect(paragrafos(alvo, "Olá, Maria!")).toHaveLength(1);
    desmontar();
  });

  it("exatamente um h1 em cada estado terminal", () => {
    let m = montarFlow({ jaRegistrada: true });
    expect(h1s(m.alvo)).toHaveLength(1);
    expect(h1s(m.alvo)[0].textContent).toBe("Avaliação já registrada");
    m.desmontar();
    // trilha null = leitura do link falhou (rede) → card de erro com retry
    m = montarFlow({ trilha: null });
    expect(h1s(m.alvo)).toHaveLength(1);
    expect(h1s(m.alvo)[0].textContent).toBe("Não foi possível carregar");
    m.desmontar();
  });

  it("sessão agrupada e trilha de especialista pedem 'a sessão' no h1", () => {
    let m = montarFlow({
      sessao: [5, 6],
      contexto:
        "Sessão combinada dos encontros 5 e 6 com Fulano · quarta-feira, 03/12 às 19:00",
    });
    expect(h1s(m.alvo)).toHaveLength(1);
    expect(h1s(m.alvo)[0].textContent).toBe("Como foi a sessão?");
    expect(
      paragrafos(m.alvo, "Sessão combinada dos encontros 5 e 6")
    ).toHaveLength(1);
    m.desmontar();
    m = montarFlow({ trilha: "especialista", sessao: [1] });
    expect(h1s(m.alvo)[0].textContent).toBe("Como foi a sessão?");
    m.desmontar();
  });

  it("sem primeiroNome a saudação some sem quebrar o bloco", () => {
    const { alvo, desmontar } = montarFlow({ primeiroNome: null });
    expect(paragrafos(alvo, "Olá,")).toHaveLength(0);
    expect(h1s(alvo)).toHaveLength(1);
    desmontar();
  });

  it("contexto null não renderiza linha vazia no subtítulo", () => {
    const { alvo, desmontar } = montarFlow({ contexto: null });
    expect(paragrafos(alvo, "às")).toHaveLength(0);
    // h1 e h3 seguem na ordem mesmo sem a linha de contexto
    expect(antes(h1s(alvo)[0], alvo.querySelector("h3")!)).toBe(true);
    desmontar();
  });

  it("após o envio o cabeçalho sai e o sucesso segue com um h1", async () => {
    const { alvo, desmontar } = montarFlow();
    act(() =>
      clicar(alvo.querySelector('input[name="estrelas"][value="4"]')!)
    );
    act(() => submeter(alvo.querySelector("form")!));
    // a troca form → sucesso passa pelo exit/enter do AnimatePresence
    // (~180ms cada) — um respiro de verdade dentro de act cobre a
    // coreografia inteira, sem depender de timing de frame
    await act(async () => {
      await new Promise((r) => setTimeout(r, 450));
    });
    expect(h1s(alvo)).toHaveLength(1);
    expect(h1s(alvo)[0].textContent).toBe("Avaliação enviada!");
    expect(paragrafos(alvo, "Olá, Maria!")).toHaveLength(0);
    desmontar();
  });
});

describe("embutido no form de avaliação (FR-004)", () => {
  it("embutido suprime o cartão de contexto; sem ele o h1 interno volta", () => {
    const { alvo, desmontar } = montar(
      <AvaliacaoEncontroForm trilha="dpp" primeiroNome="Ana" embutido />
    );
    expect(alvo.querySelectorAll("h1")).toHaveLength(0);
    expect(paragrafos(alvo, "Olá, Ana!")).toHaveLength(0);
    desmontar();
    const m2 = montar(
      <AvaliacaoEncontroForm trilha="dpp" primeiroNome="Ana" />
    );
    expect(m2.alvo.querySelectorAll("h1")).toHaveLength(1);
    expect(h1s(m2.alvo)[0].textContent).toBe("Como foi o encontro?");
    m2.desmontar();
  });
});
