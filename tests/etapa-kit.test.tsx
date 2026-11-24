// @vitest-environment jsdom

// 028 — kit de troca de etapa (ui/etapa): direção do slide (--dir), foco
// pós-commit no título/painel, passos montados preservando o FormData,
// FadeTroca com foco no painel entrante. DOM mínimo: createRoot + act
// (ver tests/dom.ts). O motion é mockado pra passthrough — o timing de
// exit do AnimatePresence não é o que o teste mede (é o montar+focar).

import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  motion: {
    // motion.div vira div comum — os props de animação não vão pro DOM
    div: ({
      children,
      initial: _i,
      animate: _a,
      exit: _e,
      transition: _t,
      ...rest
    }: Record<string, unknown> & { children?: ReactNode }) => (
      <div {...rest}>{children}</div>
    ),
  },
}));

import { User, FileText, Check } from "@phosphor-icons/react";
import {
  Etapa,
  FadeTroca,
  WizardPassos,
  useTrocaDeEtapa,
} from "@/components/ui/etapa";
import { botao, clicar, digitar, montar, submeter } from "./dom";

// ── sonda do hook: expõe etapa/direcao no DOM e os gestos em botões ──
function Sonda({ total = 3 }: { total?: number }) {
  const { etapa, direcao, irPara, assinalar, reiniciar, tituloEtapaRef } =
    useTrocaDeEtapa<HTMLHeadingElement>(total);
  return (
    <div>
      <h2 ref={tituloEtapaRef} tabIndex={-1}>
        Etapa {etapa}
      </h2>
      <p data-p="etapa">{etapa}</p>
      <p data-p="dir">{direcao}</p>
      <button onClick={() => irPara(etapa + 1)}>prox</button>
      <button onClick={() => irPara(etapa - 1)}>ant</button>
      <button onClick={() => irPara(99)}>fim</button>
      <button onClick={() => assinalar(-1)}>marca</button>
      <button onClick={() => reiniciar()}>reset</button>
    </div>
  );
}

describe("useTrocaDeEtapa", () => {
  it("irPara avança: direção +1, foco no título pós-commit", () => {
    const { alvo, desmontar } = montar(<Sonda />);
    act(() => clicar(botao(alvo, "prox")));
    expect(alvo.querySelector("[data-p=etapa]")!.textContent).toBe("1");
    expect(alvo.querySelector("[data-p=dir]")!.textContent).toBe("1");
    expect(document.activeElement).toBe(alvo.querySelector("h2"));
    desmontar();
  });

  it("voltar marca direção -1", () => {
    const { alvo, desmontar } = montar(<Sonda />);
    act(() => clicar(botao(alvo, "prox")));
    act(() => clicar(botao(alvo, "ant")));
    expect(alvo.querySelector("[data-p=etapa]")!.textContent).toBe("0");
    expect(alvo.querySelector("[data-p=dir]")!.textContent).toBe("-1");
    desmontar();
  });

  it("destino clampado: irPara(99) para na última", () => {
    const { alvo, desmontar } = montar(<Sonda />);
    act(() => clicar(botao(alvo, "fim")));
    expect(alvo.querySelector("[data-p=etapa]")!.textContent).toBe("2");
    desmontar();
  });

  it("assinalar não muda etapa e agenda o foco pro próximo commit", () => {
    const { alvo, desmontar } = montar(<Sonda />);
    act(() => clicar(botao(alvo, "marca")));
    // o commit do clique já entrega o pendente — foco no título, etapa igual
    expect(alvo.querySelector("[data-p=etapa]")!.textContent).toBe("0");
    expect(document.activeElement).toBe(alvo.querySelector("h2"));
    desmontar();
  });
});

describe("Etapa", () => {
  it("inativa sai com hidden e o ativa segue no DOM (inputs no FormData)", () => {
    const { alvo, desmontar } = montar(
      <>
        <Etapa ativa={false} direcao={1}>
          <input name="a" defaultValue="x" />
        </Etapa>
        <Etapa ativa direcao={-1} data-marcada>
          <input name="b" />
        </Etapa>
      </>
    );
    const divs = [...alvo.querySelectorAll("div")];
    expect(divs[0].hidden).toBe(true);
    expect(divs[1].hidden).toBe(false);
    // --dir pelo sinal da direção — 8px é o teto do slide
    expect(divs[0].style.getPropertyValue("--dir")).toBe("8px");
    expect(divs[1].style.getPropertyValue("--dir")).toBe("-8px");
    // hidden não desmonta: o input continua queryable → FormData íntegro
    expect(alvo.querySelector("input[name=a]")).not.toBeNull();
    desmontar();
  });
});

describe("FadeTroca", () => {
  it("troca de chave: o painel entrante recebe o foco", () => {
    const { alvo, atualizar, desmontar } = montar(
      <FadeTroca chave="form" foco>
        <p data-p="form">form</p>
      </FadeTroca>
    );
    // primeira pintura não é troca — nada de roubar foco no mount
    expect(document.activeElement).not.toBe(
      alvo.querySelector("[data-p=form]")?.parentElement
    );
    atualizar(
      <FadeTroca chave="ok" foco>
        <p data-p="ok">ok</p>
      </FadeTroca>
    );
    const painel = alvo.querySelector("[data-p=ok]")!.parentElement!;
    expect(document.activeElement).toBe(painel);
    expect(alvo.querySelector("[data-p=form]")).toBeNull();
    desmontar();
  });

  it("sem foco: a troca não move o activeElement", () => {
    const { alvo, atualizar, desmontar } = montar(
      <FadeTroca chave="a">
        <p data-p="a">a</p>
      </FadeTroca>
    );
    atualizar(
      <FadeTroca chave="b">
        <p data-p="b">b</p>
      </FadeTroca>
    );
    expect(alvo.querySelector("[data-p=b]")).not.toBeNull();
    expect(document.activeElement).not.toBe(
      alvo.querySelector("[data-p=b]")!.parentElement
    );
    desmontar();
  });
});

// ── WizardPassos: 3 passos com input não-controlado cada ──
function Wizard({ onSubmit }: { onSubmit: (dados: FormData) => void }) {
  return (
    <WizardPassos
      passos={[
        {
          titulo: "Um",
          icone: User,
          conteudo: <input name="nome" defaultValue="" />,
        },
        {
          titulo: "Dois",
          icone: FileText,
          conteudo: <input name="cidade" defaultValue="" />,
        },
        {
          titulo: "Três",
          icone: Check,
          conteudo: <input name="obs" defaultValue="" />,
        },
      ]}
      pending={false}
      submitLabel="Salvar"
      onSubmit={(e) => onSubmit(new FormData(e.currentTarget))}
    />
  );
}

describe("WizardPassos", () => {
  it("os três passos ficam montados — só o ativo sai do hidden", () => {
    const { alvo, desmontar } = montar(<Wizard onSubmit={() => {}} />);
    const etapas = [...alvo.querySelectorAll(".animate-enter-x")];
    expect(etapas).toHaveLength(3);
    expect(etapas.map((e) => (e as HTMLElement).hidden)).toEqual([
      false,
      true,
      true,
    ]);
    expect(alvo.querySelector("input[name=nome]")).not.toBeNull();
    expect(alvo.querySelector("input[name=cidade]")).not.toBeNull();
    expect(alvo.querySelector("input[name=obs]")).not.toBeNull();
    desmontar();
  });

  it("Avançar troca a etapa, foca o heading e desliza pra frente", () => {
    const { alvo, desmontar } = montar(<Wizard onSubmit={() => {}} />);
    act(() => clicar(botao(alvo, "Avançar")));
    const etapas = [...alvo.querySelectorAll(".animate-enter-x")];
    expect((etapas[1] as HTMLElement).hidden).toBe(false);
    expect((etapas[0] as HTMLElement).hidden).toBe(true);
    expect(document.activeElement!.textContent).toContain("Passo 2 de 3");
    expect(
      (etapas[1] as HTMLElement).style.getPropertyValue("--dir")
    ).toBe("8px");
    desmontar();
  });

  it("submit no último passo viaja com o FormData inteiro (valor do passo 1)", () => {
    const recebidos: FormData[] = [];
    const { alvo, desmontar } = montar(
      <Wizard onSubmit={(d) => recebidos.push(d)} />
    );
    const nome = alvo.querySelector("input[name=nome]") as HTMLInputElement;
    act(() => digitar(nome, "Ana"));
    act(() => clicar(botao(alvo, "Avançar")));
    act(() => clicar(botao(alvo, "Avançar")));
    const form = alvo.querySelector("form")!;
    act(() => submeter(form));
    expect(recebidos).toHaveLength(1);
    expect(recebidos[0].get("nome")).toBe("Ana");
    desmontar();
  });

  it("Enter num input antes do último passo avança, não salva", () => {
    const recebidos: FormData[] = [];
    const { alvo, desmontar } = montar(
      <Wizard onSubmit={(d) => recebidos.push(d)} />
    );
    const nome = alvo.querySelector("input[name=nome]") as HTMLInputElement;
    act(() =>
      nome.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      )
    );
    expect((alvo.querySelectorAll(".animate-enter-x")[1] as HTMLElement).hidden).toBe(false);
    expect(recebidos).toHaveLength(0);
    desmontar();
  });
});
