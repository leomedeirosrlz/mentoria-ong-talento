// Regex de token opaco das rotas públicas — hoje são duas cópias de cada
// padrão e nenhuma trava: /f, /t e /avaliar validam o token base64url de
// 32 chars (randomBytes(24) no TS, gen_random_bytes(24) no SQL); /assinar
// e /api/assinar-token validam uuid v4 (gen_random_uuid da 0033). Um
// agente que "afrouxa" um deles ({1,}, \w, case-insensitive) abre a RPC
// a varredura de token — ou pior: troca o padrão e os links reais já
// mandados por WhatsApp passam a cair no "link inválido". Este spec lê o
// texto dos arquivos e trava: o conjunto de regexes é exatamente o par
// canônico, cada superfície nomeada usa o padrão do seu token, e os
// padrões compilados aceitam o formato mintado e rejeitam o quase-real.
import { randomBytes, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(process.cwd(), "src");

// os dois padrões canônicos — qualquer terceiro é afrouxamento ou erro
const OPACO = "/^[A-Za-z0-9_-]{20,128}$/"; // token base64url de 32 chars
const UUID = "/^[0-9a-f-]{36}$/"; // uuid v4 com hífens, minúsculo

/** Superfícies públicas por token e o padrão que o token delas exige. A
 *  lib entra junto: a action revalida o MESMO token da página — um regex
 *  trocado aqui quebra o fluxo no submit, não no carregamento. */
const ESPERADO: [string, string][] = [
  ["src/app/f/[token]/page.tsx", OPACO],
  ["src/app/t/[token]/page.tsx", OPACO],
  ["src/app/avaliar/[token]/page.tsx", OPACO],
  ["src/lib/forms/actions.ts", OPACO],
  ["src/lib/actions-avaliacao.ts", OPACO],
  ["src/lib/actions-terceiros.ts", OPACO],
  ["src/app/assinar/[token]/page.tsx", UUID],
  ["src/app/api/assinar-token/[token]/route.ts", UUID],
];

function arquivosTs(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...arquivosTs(p));
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const ENCONTRADOS = arquivosTs(SRC).flatMap((p) =>
  [...readFileSync(p, "utf8").matchAll(/const TOKEN_RE = (\/[^/]+\/);/g)].map(
    (m) => ({ arquivo: path.relative(process.cwd(), p), fonte: m[1] })
  )
);

const regexDe = (fonte: string) => {
  const m = /^\/(.*)\/$/.exec(fonte);
  return new RegExp(m![1]);
};

describe("regexes de token — o conjunto é o par canônico", () => {
  it("nenhum TOKEN_RE diverge dos dois padrões conhecidos", () => {
    const fora = ENCONTRADOS.filter((e) => e.fonte !== OPACO && e.fonte !== UUID);
    expect(
      fora.map((e) => `${e.arquivo}: ${e.fonte}`),
      "regex de token fora do par canônico — afrouxou ou inventou padrão"
    ).toEqual([]);
  });

  it.each(ESPERADO)("%s guarda com o padrão do seu token", (arq, fonte) => {
    const achados = ENCONTRADOS.filter((e) => e.arquivo === arq);
    expect(
      achados.length,
      `${arq} perdeu o TOKEN_RE — a superfície passou a bater na RPC sem pré-filtro`
    ).toBeGreaterThan(0);
    for (const a of achados) {
      expect(
        a.fonte,
        `${arq}: padrão trocado — links reais já enviados caem no "inválido"`
      ).toBe(fonte);
    }
  });
});

describe("os padrões casam com o formato real mintado", () => {
  it("32 chars base64url (randomBytes(24)) passa no opaco", () => {
    const re = regexDe(OPACO);
    const real = randomBytes(24).toString("base64url");
    expect(real).toHaveLength(32); // o mint é 32 — a régua {20,128} cobre
    expect(re.test(real)).toBe(true);
    // o SQL minta o mesmo: translate(encode(gen_random_bytes(24),'base64'),'+/=','-_')
    // também tem 32 chars do mesmo alfabeto — nenhum símbolo de fora
    expect(re.test("aB3_-xY9" + "0".repeat(24))).toBe(true);
  });

  it("uuid v4 minúsculo (gen_random_uuid) passa no de assinatura", () => {
    expect(regexDe(UUID).test(randomUUID())).toBe(true);
  });

  it("o opaco rejeita o que não é o mint (curto, símbolo, estourado)", () => {
    const re = regexDe(OPACO);
    expect(re.test("curto")).toBe(false);
    expect(re.test("a".repeat(19))).toBe(false);
    expect(re.test("a".repeat(129))).toBe(false);
    for (const ch of ["+", "/", ".", "=", " ", "%", "ç"])
      expect(re.test("a".repeat(30) + ch + "b"), `símbolo ${ch}`).toBe(false);
  });

  it("o uuid rejeita maiúsculo, sem hífen e tamanho errado", () => {
    const re = regexDe(UUID);
    const u = randomUUID();
    expect(re.test(u.toUpperCase())).toBe(false);
    expect(re.test(u.replace(/-/g, ""))).toBe(false);
    expect(re.test(u.slice(0, 35))).toBe(false);
    expect(re.test("g".repeat(8) + u.slice(8))).toBe(false);
    expect(re.test(`/${u}`)).toBe(false);
  });
});
