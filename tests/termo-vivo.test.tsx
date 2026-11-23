// @vitest-environment jsdom

// REALIZA-509 (R21) — o documento vivo em dois níveis:
//   · civisPreview/preambulo: merge parcial com os blanks e a caixa alta do
//     docx — inclusive o caminho de volta (campo apagado reemite "" e o
//     blank reaparece, o caso que o par de testes da 503 não cobre)
//   · TermoVivo no jsdom: o form reemite o retrato a cada tecla e o doc
//     interpola na hora — digitar entra, apagar sai
// DOM mínimo: createRoot + act (ver tests/dom.ts).

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

import { TermoVivo } from "@/components/termo-vivo";
import {
  CIVIS_EM_BRANCO,
  civisPreview,
  preambuloTermo,
  TERMO_TITULO,
} from "@/lib/documentos/texto";
import type { DadosCivis } from "@/lib/types";
import { digitar, montar } from "./dom";

const acaoOk = () => vi.fn(async () => ({ ok: true }));

const ENDERECO_VAZIO = {
  logradouro: null,
  numero: null,
  complemento: null,
  bairro: null,
  cidade: null,
  uf: null,
  cep: null,
};

describe("civisPreview — merge parcial com os blanks", () => {
  it("sem ficha devolve o retrato inteiro em branco", () => {
    expect(civisPreview(null)).toEqual(CIVIS_EM_BRANCO);
    expect(civisPreview(undefined)).toEqual(CIVIS_EM_BRANCO);
    expect(civisPreview({})).toEqual(CIVIS_EM_BRANCO);
  });

  it("o que veio preenchido sobrepõe; o resto segue blank", () => {
    const p = civisPreview({
      nome_civil: "Maria Silva",
      endereco: { ...ENDERECO_VAZIO, cidade: "São Paulo" },
    });
    expect(p.nome_civil).toBe("Maria Silva");
    expect(p.rg).toBe(CIVIS_EM_BRANCO.rg);
    expect(p.cpf).toBe(CIVIS_EM_BRANCO.cpf);
    expect(p.endereco.cidade).toBe("São Paulo");
    expect(p.endereco.logradouro).toBe(CIVIS_EM_BRANCO.endereco.logradouro);
  });

  it("campo apagado volta ao blank — vazio e só-espaços contam como falta", () => {
    // é o caminho do "apaguei o que digitei": o retrato reemite "" e o
    // documento volta a mostrar a linha, como no papel
    expect(civisPreview({ nome_civil: "" }).nome_civil).toBe(
      CIVIS_EM_BRANCO.nome_civil
    );
    expect(civisPreview({ nome_civil: "   " }).nome_civil).toBe(
      CIVIS_EM_BRANCO.nome_civil
    );
    expect(
      civisPreview({ endereco: { ...ENDERECO_VAZIO, logradouro: " " } })
        .endereco.logradouro
    ).toBe(CIVIS_EM_BRANCO.endereco.logradouro);
  });

  it("complemento passa cru — é o único campo que nunca vira blank", () => {
    // decisão do doc: complemento em branco não imprime "______" na linha
    expect(civisPreview({}).endereco.complemento).toBeNull();
    expect(
      civisPreview({ endereco: { ...ENDERECO_VAZIO, complemento: "cj 42" } })
        .endereco.complemento
    ).toBe("cj 42");
  });
});

describe("preambulo — o nome civil sai em caixa alta", () => {
  it("interpola o preview e grita o nome como no docx", () => {
    const [, qualificacao] = preambuloTermo(
      civisPreview({ nome_civil: "maria silva souza" })
    );
    expect(qualificacao).toContain("MARIA SILVA SOUZA");
  });

  it("campo apagado devolve o blank ao preâmbulo", () => {
    const [, qualificacao] = preambuloTermo(
      civisPreview({ nome_civil: "" })
    );
    expect(qualificacao).toContain(CIVIS_EM_BRANCO.nome_civil);
    expect(qualificacao).not.toContain("MARIA");
  });
});

describe("TermoVivo — o documento acompanha o form", () => {
  const civis: DadosCivis = {
    nome_civil: "ricardo tavares lima",
    rg: "12.345.678-9",
    cpf: "12345678909",
    data_nascimento: "1990-04-12",
    endereco: {
      logradouro: "Rua Vergueiro",
      numero: "1200",
      complemento: null,
      bairro: "Liberdade",
      cidade: "São Paulo",
      uf: "SP",
      cep: "01504001",
    },
  };

  it("prefill sai em caixa alta sob o título canônico do termo", () => {
    const { alvo } = montar(
      <TermoVivo
        doc="voluntario"
        civis={civis}
        acao={acaoOk()}
        cabecalho={null}
      />
    );
    // o título é o do docx oficial — o preview e o PDF leem a mesma fonte
    expect(alvo.textContent).toContain(TERMO_TITULO);
    expect(alvo.textContent).toContain("RICARDO TAVARES LIMA");
  });

  it("apagar o campo devolve o blank ao documento", () => {
    const { alvo } = montar(
      <TermoVivo
        doc="voluntario"
        civis={civis}
        acao={acaoOk()}
        cabecalho={null}
      />
    );
    expect(alvo.textContent).toContain("RICARDO TAVARES LIMA");

    const nome = alvo.querySelector<HTMLInputElement>(
      '[name="nome_civil"]'
    )!;
    act(() => digitar(nome, ""));
    // apagou: o retrato reemite "", o preview volta à linha de papel
    expect(alvo.textContent).not.toContain("RICARDO TAVARES LIMA");
    expect(alvo.textContent).toContain(CIVIS_EM_BRANCO.nome_civil);

    // e continua vivo: redigitar interpola de novo, em caixa alta
    act(() => digitar(nome, "outra pessoa"));
    expect(alvo.textContent).toContain("OUTRA PESSOA");
    expect(alvo.textContent).not.toContain(CIVIS_EM_BRANCO.nome_civil);
  });
});
