/** Autocomplete de endereço por CEP (REALIZA-37). Módulo puro: parse da
 *  resposta do ViaCEP e normalização do dígito — nada de fetch aqui, o
 *  transporte mora na server action (actions-endereco.ts). A whitelist de
 *  campos é a defesa contra resposta envenenada: só os 4 campos que o
 *  formulário consome passam. */

export type ViaCepEndereco = {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
};

/** `erro` cobre transporte quebrado e resposta malformada — a UI trata os
 *  dois do mesmo jeito ("preencha manualmente"), então a union não
 *  distingue. */
export type ViaCepResult =
  | { kind: "ok"; endereco: ViaCepEndereco }
  | { kind: "nao_encontrado" }
  | { kind: "erro" };

/** CEP brasileiro são 8 dígitos; a máscara e o parseCivis já normalizam —
 *  aqui é a fronteira da action (chamável por qualquer client). */
export function cepNormalizado(cep: string | null | undefined): string | null {
  const d = String(cep ?? "").replace(/\D/g, "");
  return d.length === 8 ? d : null;
}

export function parseViaCep(json: unknown): ViaCepResult {
  if (typeof json !== "object" || json === null) return { kind: "erro" };
  const j = json as Record<string, unknown>;
  // o contrato do ViaCEP pra "CEP válido que não existe" é {erro: true}
  if (j.erro === true) return { kind: "nao_encontrado" };
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const endereco: ViaCepEndereco = {
    logradouro: s(j.logradouro),
    bairro: s(j.bairro),
    cidade: s(j.localidade),
    uf: s(j.uf).toUpperCase(),
  };
  // resposta ok sempre traz localidade+uf — vazio total ou UF lixo é
  // payload quebrado, não "endereço sem rua" (CEP de cidade única é
  // legítimo com logradouro/bairro vazios, mas nunca sem cidade/UF)
  if (!endereco.cidade || endereco.uf.length !== 2) return { kind: "erro" };
  return { kind: "ok", endereco };
}
