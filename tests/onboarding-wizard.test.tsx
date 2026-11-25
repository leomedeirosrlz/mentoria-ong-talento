// @vitest-environment jsdom

// REALIZA-503 — wizards de primeiro acesso: foco preservado nos blocos
// "Sobre você" (R10, staff) e o passo do termo sem dead-end depois de
// assinar (R13, jovem). DOM mínimo: createRoot + act (ver tests/dom.ts).

import { act } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/actions", () => ({
  concluirOnboarding: vi.fn(async () => ({ ok: true })),
  salvarOnboarding: vi.fn(async () => ({ ok: true })),
  signOut: vi.fn(async () => {}),
}));
vi.mock("@/lib/actions-jovem", () => ({
  salvarDisponibilidadeJovem: vi.fn(async () => ({ ok: true })),
  setContatoCompartilhado: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/actions-assinaturas", () => ({
  assinarTermo: vi.fn(async () => ({ ok: true })),
  assinarComToken: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/demo/actions", () => ({
  recomecarDemo: vi.fn(async () => {}),
}));
vi.mock("@/lib/actions-endereco", () => ({
  buscarCep: vi.fn(async () => ({ kind: "erro" as const })),
}));
// LizaBlob usa motion + ResizeObserver — decorativa nos testes
vi.mock("@/components/liza/liza-onboarding", () => ({
  LizaOnboarding: () => null,
}));

import { OnboardingFlow } from "@/components/onboarding-flow";
import { OnboardingJovem } from "@/app/(jovem)/jovem/onboarding-jovem";
import { botao, clicar, digitar, montar, submeter } from "./dom";
import type { JovemPerfil, Profile } from "@/lib/types";

const meStaff = {
  id: "p-staff",
  user_id: "u-staff",
  nome: "Ana Coord Silva",
  nome_social: null,
  email: "ana@test.dev",
  whatsapp: null,
  role: "coordenacao",
  ativo: true,
  onboarded_em: null,
  bio: null,
  linkedin: null,
  areas: null,
  voluntariado: null,
  voluntario: true,
  // LGPD já carimbado — a declaração fica só com a de voluntário
  consent_lgpd_em: "2026-01-10T12:00:00Z",
  cidade: null,
  uf: "SP",
  cargo: null,
  empresa: null,
  origem: null,
  interesses: null,
} as unknown as Profile;

const pessoalImportado = {
  data_nascimento: "1990-05-10",
  genero: "feminino" as const,
  pref_genero_par: null,
  motivacao: null,
};

const meJovem = {
  id: "p-jovem",
  user_id: "u-jovem",
  nome: "Jovem Teste",
  nome_social: null,
  email: "jovem@test.dev",
  whatsapp: null,
  role: "mentorado",
  ativo: true,
  onboarded_em: null,
  bio: null,
  linkedin: null,
  areas: null,
  voluntariado: null,
} as unknown as Profile;

const perfilJovem = {
  dados_civis: null,
  disponibilidade: null,
  contato_compartilhado: false,
  whatsapp: "11999000093",
  email: "jovem@test.dev",
} as unknown as JovemPerfil;

/** Continuar do rodapé — passos com form disparam a action (async),
 *  os demais só avançam (sync). O wrapper de act fica por conta do caso. */
async function continuar(alvo: ParentNode) {
  await act(async () => clicar(botao(alvo, "Continuar")));
}

/** staff coord: 0 boas-vindas → 1 declarações → 2 recursos → 3 sobre você */
async function ateSobre(alvo: ParentNode) {
  await continuar(alvo);
  await continuar(alvo);
  await continuar(alvo);
}

describe("R10 — foco nos blocos 'Sobre você' (staff)", () => {
  it("digitar o último campo do bloco parcial não desmonta o input", async () => {
    // bloco identidade parcial: nascimento+gênero+UF vieram, cidade falta
    const { alvo, desmontar } = montar(
      <OnboardingFlow me={meStaff} pessoal={pessoalImportado} />
    );
    await ateSobre(alvo);

    const form = alvo.querySelector<HTMLFormElement>("#onboarding-passo")!;
    // R11: o form do passo também não usa validação nativa
    expect(form.noValidate).toBe(true);

    const cidade = alvo.querySelector<HTMLInputElement>("#ob-cidade")!;
    cidade.focus();
    act(() => digitar(cidade, "São Paulo")); // a tecla que completa o bloco

    // bug: o resumo assumia na hora e o input focado desmontava
    expect(cidade.isConnected).toBe(true);
    expect(document.activeElement).toBe(cidade);
    desmontar();
  });

  it("Editar expande o resumo e devolve o foco pro primeiro campo", async () => {
    // bloco completo de fábrica: abre em resumo
    const completo = {
      ...meStaff,
      cidade: "São Paulo",
      uf: "SP",
    } as unknown as Profile;
    const { alvo, desmontar } = montar(
      <OnboardingFlow me={completo} pessoal={pessoalImportado} />
    );
    await ateSobre(alvo);

    expect(alvo.textContent).toContain("Já temos esses dados do cadastro");
    act(() => clicar(botao(alvo, "Editar")));

    const primeiro = alvo.querySelector("#ob-social");
    expect(primeiro).toBeTruthy();
    expect(document.activeElement).toBe(primeiro);
    desmontar();
  });
});

describe("R13 — termo do jovem sem dead-end", () => {
  it("assinar → contato → voltar: corpo é o termo e 'Assinar depois' habilitado", async () => {
    const { alvo, atualizar, desmontar } = montar(
      <OnboardingJovem
        me={meJovem}
        perfil={perfilJovem}
        termo={{ token: "tok-1" }}
      />
    );

    // boas-vindas → tour → grade → termo
    await continuar(alvo);
    await continuar(alvo);
    act(() => clicar(botao(alvo, "Preencher depois")));

    const formTermo = alvo.querySelector<HTMLFormElement>("#ob-termo-form")!;
    expect(formTermo).toBeTruthy();
    expect(formTermo.noValidate).toBe(true);

    // assina de verdade — a action mockada resolve ok e o wizard avança
    await act(async () => submeter(formTermo));
    expect(alvo.textContent).toContain("Seu contato tá certo?");

    // o router.refresh da assinatura reentrega termo=null no layout
    atualizar(
      <OnboardingJovem me={meJovem} perfil={perfilJovem} termo={null} />
    );

    // Voltar do contato: o passo tem que ser o termo inteiro, não um
    // corpo de contato com os botões mortos do termo
    act(() =>
      clicar(alvo.querySelector('button[aria-label="Voltar um passo"]')!)
    );

    expect(alvo.textContent).toContain("Seu termo de participação");
    expect(alvo.querySelector("#ob-termo-form")).toBeTruthy();
    const assinarDepois = botao(alvo, "Assinar depois");
    expect(assinarDepois.disabled).toBe(false);
    const primario = alvo.querySelector<HTMLButtonElement>(
      'button[form="ob-termo-form"]'
    );
    expect(primario).toBeTruthy();
    expect(primario!.disabled).toBe(false);
    desmontar();
  });
});
