import { describe, expect, it } from "vitest";
import {
  ehErroInfraSignup,
  INSTAVEL,
  mensagemErro,
  NAO_CADASTRADO,
} from "@/lib/login-erros";

// casos em tabela: [descrição, erro, modo, esperado]
const CASOS: [
  string,
  { message: string; code?: string },
  "link" | "senha",
  string,
][] = [
  [
    "credencial inválida por code",
    { code: "invalid_credentials", message: "Invalid login credentials" },
    "senha",
    "E-mail ou senha incorretos. Confira e tente de novo.",
  ],
  [
    "credencial inválida só pela mensagem",
    { message: "Invalid login credentials" },
    "senha",
    "E-mail ou senha incorretos. Confira e tente de novo.",
  ],
  [
    "e-mail não confirmado",
    { code: "email_not_confirmed", message: "Email not confirmed" },
    "senha",
    "Confirme seu e-mail antes de entrar.",
  ],
  [
    "allowlist-miss real: a frase do trigger 0045/0171",
    { message: "Este e-mail não está na lista de cadastrados do programa — fale com a coordenação." },
    "link",
    NAO_CADASTRADO,
  ],
  [
    "o 500 do signup QUANDO traz a frase do trigger embutida",
    { message: "Database error saving new user: cadastrados do programa" },
    "link",
    NAO_CADASTRADO,
  ],
  [
    "signup desligado (otp_disabled)",
    { code: "otp_disabled", message: "Signups not allowed for otp" },
    "link",
    NAO_CADASTRADO,
  ],
  [
    "500 pelado do signup = ambíguo — NÃO acusa não-cadastrado",
    { message: "Database error saving new user" },
    "link",
    INSTAVEL,
  ],
  [
    "idem no modo senha",
    { message: "Database error saving new user", code: "unexpected_failure" },
    "senha",
    INSTAVEL,
  ],
  [
    "rate limit de envio (link)",
    { code: "over_email_send_rate_limit", message: "email rate limit exceeded" },
    "link",
    "Muitos pedidos de uma vez. Tente de novo em alguns minutos.",
  ],
  [
    "rate limit de pedidos (brute-force da senha cai aqui também)",
    { code: "over_request_rate_limit", message: "Request rate limit reached" },
    "senha",
    "Muitos pedidos de uma vez. Tente de novo em alguns minutos.",
  ],
  [
    "desconhecido no modo link",
    { message: "fetch failed" },
    "link",
    "Não foi possível enviar o link. Confira o e-mail ou tente de novo em alguns minutos.",
  ],
  [
    "desconhecido no modo senha",
    { code: "unknown", message: "??? " },
    "senha",
    "Não foi possível entrar. Tente de novo em alguns minutos.",
  ],
];

describe("mensagemErro — tradução dos erros de login", () => {
  it.each(CASOS)("%s", (_desc, erro, modo, esperado) => {
    expect(mensagemErro(erro, modo)).toBe(esperado);
  });
});

describe("ehErroInfraSignup — o 500 ambíguo do signup", () => {
  it("database error saving new user pelado → true", () => {
    expect(ehErroInfraSignup({ message: "Database error saving new user" })).toBe(true);
    expect(
      ehErroInfraSignup({ code: "unexpected_failure", message: "Database error saving new user" })
    ).toBe(true);
  });

  it("com a frase do trigger é allowlist-miss, não infra → false", () => {
    expect(
      ehErroInfraSignup({
        message: "Database error saving new user: cadastrados do programa",
      })
    ).toBe(false);
  });

  it("outros erros → false", () => {
    expect(ehErroInfraSignup({ message: "invalid login credentials" })).toBe(false);
    expect(ehErroInfraSignup({ code: "over_request_rate_limit", message: "x" })).toBe(false);
  });
});
