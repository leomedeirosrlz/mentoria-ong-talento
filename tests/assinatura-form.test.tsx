// @vitest-environment jsdom

// REALIZA-503 — form do termo: pending espelhado pro rodapé fixo (R13),
// validação em pt-BR sem bolha nativa (R11) e preview vivo acompanhando
// autofill silencioso (R12). DOM mínimo: createRoot + act (ver tests/dom.ts).

import { act } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/actions-endereco", () => ({
  buscarCep: vi.fn(async () => ({ kind: "erro" as const })),
}));

import {
  AssinaturaForm,
  type CivisDigitados,
} from "@/components/assinatura-form";
import { PassoTermo } from "@/components/termo-vivo";
import {
  assentar,
  autofiliar,
  desfocar,
  digitar,
  focar,
  montar,
  submeter,
} from "./dom";

const acaoOk = () => vi.fn(async () => ({ ok: true }));

describe("pending espelhado pro rodapé (R13)", () => {
  it("desmontar no meio do submit emite false — o rodapé não fica preso", async () => {
    const onPending = vi.fn();
    // o submit segue voando no unmount — a promise resolve DEPOIS do
    // desmontar: uma transição pendente solta enreda (entangles) o
    // pending de qualquer outra que vier em seguida
    let resolver: (v: { ok: boolean }) => void = () => {};
    const acao = vi.fn(
      () =>
        new Promise<{ ok: boolean }>((r) => {
          resolver = r;
        })
    );
    const { alvo, desmontar } = montar(
      <AssinaturaForm modo="termo" acao={acao} onPendingChange={onPending} />
    );

    act(() => submeter(alvo.querySelector("form")!));
    expect(onPending).toHaveBeenLastCalledWith(true);

    desmontar();
    expect(onPending).toHaveBeenLastCalledWith(false);

    resolver({ ok: true });
    await assentar();
  });

  it("action rejeitada libera o pending e mostra erro em pt-BR", async () => {
    const onPending = vi.fn();
    const acao = vi.fn(async () => {
      throw new Error("rede fora");
    });
    const { alvo } = montar(
      <AssinaturaForm modo="termo" acao={acao} onPendingChange={onPending} />
    );

    act(() => submeter(alvo.querySelector("form")!));
    // o catch da action roda num microtask — drena a rejeição, o setErro
    // e o pending=false da transição
    await assentar();

    expect(onPending).toHaveBeenLastCalledWith(false);
    expect(alvo.querySelector('[role="alert"]')?.textContent).toContain(
      "Tente de novo"
    );
  });
});

describe("validação sem bolha nativa (R11)", () => {
  it("form declara noValidate e o submit mostra o erro da action", async () => {
    const acao = vi.fn(async () => ({
      error: "Informe o nome civil completo (como no documento).",
    }));
    const { alvo } = montar(<AssinaturaForm modo="termo" acao={acao} />);
    const form = alvo.querySelector("form")!;

    expect(form.noValidate).toBe(true);

    act(() => submeter(form));
    await act(async () => {});

    expect(acao).toHaveBeenCalledTimes(1);
    expect(alvo.querySelector('[role="alert"]')?.textContent).toContain(
      "nome civil completo"
    );
  });
});

describe("autofill e o termo vivo (R12)", () => {
  it("valor escrito sem evento + blur reemite o retrato", () => {
    const onMudanca = vi.fn();
    const { alvo } = montar(
      <AssinaturaForm modo="termo" acao={acaoOk()} onMudanca={onMudanca} />
    );
    const rg = alvo.querySelector<HTMLInputElement>('[name="rg"]')!;

    // autofill: escreve no DOM e não dispara change nenhum
    autofiliar(rg, "12.345.678-9");
    act(() => desfocar(rg));

    const ultimo = onMudanca.mock.calls.at(-1)?.[0] as CivisDigitados;
    expect(ultimo.rg).toBe("12.345.678-9");
  });

  it("documento vivo interpola o que o autofill trouxe", () => {
    const { alvo } = montar(
      <PassoTermo doc="mentorando" dados={null} acao={acaoOk()} formId="f1" />
    );
    const nome = alvo.querySelector<HTMLInputElement>(
      '[name="nome_civil"]'
    )!;

    autofiliar(nome, "Maria Silva Souza");
    act(() => desfocar(nome));

    // o valor não está só no input — interpolou no texto do documento
    // (o termo renderiza o nome civil em caixa alta)
    expect(alvo.textContent).toContain("MARIA SILVA SOUZA");
  });

  it("campo controlado adota o autofill antes da próxima edição", () => {
    const onMudanca = vi.fn();
    const { alvo } = montar(
      <AssinaturaForm modo="termo" acao={acaoOk()} onMudanca={onMudanca} />
    );
    const logr = alvo.querySelector<HTMLInputElement>('[name="logradouro"]')!;
    const num = alvo.querySelector<HTMLInputElement>('[name="numero"]')!;

    autofiliar(logr, "Rua das Flores");
    // focar outro campo do bloco adota o DOM inteiro — sem isso o setEnd
    // da digitação reporia logradouro="" e apagava o autofill
    act(() => focar(num));
    act(() => digitar(num, "100"));

    expect(logr.value).toBe("Rua das Flores");
    const ultimo = onMudanca.mock.calls.at(-1)?.[0] as CivisDigitados;
    expect(ultimo.endereco.logradouro).toBe("Rua das Flores");
    expect(ultimo.endereco.numero).toBe("100");
  });
});
