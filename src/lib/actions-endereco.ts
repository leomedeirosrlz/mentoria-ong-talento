"use server";

import { demoRole } from "./demo/mode";
import {
  cepNormalizado,
  parseViaCep,
  type ViaCepEndereco,
  type ViaCepResult,
} from "./viacep";

const ENDERECO_DEMO: ViaCepEndereco = {
  logradouro: "Rua das Flores",
  bairro: "Jardim Brasil",
  cidade: "São Paulo",
  uf: "SP",
};

/** Busca de CEP pro autofill do bloco de dados civis — leitura externa
 *  pura, sem auth e sem tocar no banco: por isso funciona também na página
 *  pública `/assinar/<token>`. Server-side (não fetch no browser) pra o
 *  CEP sair do nosso servidor, não do IP do usuário. Nunca lança: union
 *  de retorno, igual aos lookups de token. */
export async function buscarCep(cep: string): Promise<ViaCepResult> {
  const norm = cepNormalizado(cep);
  // a UI nem chama sem 8 dígitos, mas a action é pública — valida de novo
  if (!norm) return { kind: "erro" };

  if (await demoRole()) {
    // fixture determinístico: a demo roda sem rede externa e o e2e do
    // autofill fica estável. 00000000 exercita o ramo "não encontrado".
    return norm === "00000000"
      ? { kind: "nao_encontrado" }
      : { kind: "ok", endereco: ENDERECO_DEMO };
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${norm}/json/`, {
      signal: AbortSignal.timeout(5000),
      // CEP é quase estático — 24h de cache corta a maior parte dos hits
      next: { revalidate: 86400 },
    });
    if (!res.ok) return { kind: "erro" };
    return parseViaCep(await res.json());
  } catch {
    return { kind: "erro" };
  }
}
