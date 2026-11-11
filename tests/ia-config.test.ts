// Resolução de modelo por tier (REALIZA-299): a precedência
// cfg.modelos[tier] → IA_MODEL_LEVE/MEDIO/FORTE → IA_MODEL e a cadeia de
// fallback do forte com o degrau implícito pro médio.

import { afterEach, describe, expect, it } from "vitest";
import {
  fallbacksDoTier,
  modeloDoTier,
  type IaConfig,
} from "@/lib/ia/config";

const ENVS = [
  "IA_MODEL",
  "IA_MODEL_LEVE",
  "IA_MODEL_MEDIO",
  "IA_MODEL_FORTE",
] as const;

// snapshot + restore manual: process.env é global do processo e outros
// arquivos de teste podem rodar no mesmo worker
let salvo: Partial<Record<(typeof ENVS)[number], string | undefined>> = {};
const guardarEnvs = () => {
  salvo = {};
  for (const k of ENVS) {
    salvo[k] = process.env[k];
    delete process.env[k];
  }
};

afterEach(() => {
  for (const k of ENVS) {
    if (salvo[k] === undefined) delete process.env[k];
    else process.env[k] = salvo[k];
  }
});

const cfg = (modelos: IaConfig["modelos"] = {}): IaConfig => ({
  modelos,
  esforco: { rapido: "medio", balanceado: "medio", forte: "medio" },
  roteamento: true,
  busca: "hibrida",
  plano: { plano: "go", diaRenovacao: null, tetos: {} },
});

describe("modeloDoTier — precedência cfg → env do tier → IA_MODEL", () => {
  it("config vazia cai no env do tier", () => {
    guardarEnvs();
    process.env.IA_MODEL_LEVE = "leve-env";
    process.env.IA_MODEL_MEDIO = "medio-env";
    process.env.IA_MODEL_FORTE = "forte-env";
    process.env.IA_MODEL = "base-env";
    expect(modeloDoTier(cfg(), "rapido")).toBe("leve-env");
    expect(modeloDoTier(cfg(), "balanceado")).toBe("medio-env");
    expect(modeloDoTier(cfg(), "forte")).toBe("forte-env");
  });

  it("env do tier ausente cai no IA_MODEL único (piso)", () => {
    guardarEnvs();
    process.env.IA_MODEL_MEDIO = "medio-env";
    process.env.IA_MODEL = "base-env";
    // rapido e forte não têm env próprio setado → piso comum
    expect(modeloDoTier(cfg(), "rapido")).toBe("base-env");
    expect(modeloDoTier(cfg(), "balanceado")).toBe("medio-env");
    expect(modeloDoTier(cfg(), "forte")).toBe("base-env");
  });

  it("a config viva da coord continua tendo primazia sobre os envs", () => {
    guardarEnvs();
    process.env.IA_MODEL_MEDIO = "medio-env";
    process.env.IA_MODEL = "base-env";
    const c = cfg({ balanceado: "medio-da-config" });
    expect(modeloDoTier(c, "balanceado")).toBe("medio-da-config");
  });

  it("slug em branco na config não trava: segue a cadeia de fallback", () => {
    guardarEnvs();
    process.env.IA_MODEL_FORTE = "forte-env";
    const c = cfg({ forte: "   " });
    expect(modeloDoTier(c, "forte")).toBe("forte-env");
  });
});

describe("fallbacksDoTier — degrau implícito forte → médio", () => {
  it("lista vazia: o forte sempre degrada pro médio", () => {
    guardarEnvs();
    process.env.IA_MODEL_MEDIO = "medio-env";
    process.env.IA_MODEL = "base-env";
    expect(fallbacksDoTier(cfg({ forte: "forte-cfg" }), "forte")).toEqual([
      "medio-env",
    ]);
  });

  it("lista explícita: o médio entra por último na cadeia", () => {
    guardarEnvs();
    process.env.IA_MODEL_MEDIO = "medio-env";
    const c = cfg({
      forte: "forte-cfg",
      fallbacks: { forte: ["fb-1", "fb-2"] },
    });
    expect(fallbacksDoTier(c, "forte")).toEqual(["fb-1", "fb-2", "medio-env"]);
  });

  it("médio já na lista ou igual ao primário não duplica", () => {
    guardarEnvs();
    process.env.IA_MODEL = "base-env";
    const dup = cfg({
      forte: "forte-cfg",
      balanceado: "medio-cfg",
      fallbacks: { forte: ["medio-cfg"] },
    });
    expect(fallbacksDoTier(dup, "forte")).toEqual(["medio-cfg"]);
    // primário do forte resolve pro mesmo slug do médio → degrau some
    const mesmo = cfg({ forte: "base-env" });
    expect(fallbacksDoTier(mesmo, "forte")).toEqual([]);
  });

  it("só o forte ganha o implícito — balanceado/rapido seguem sem degrau", () => {
    guardarEnvs();
    process.env.IA_MODEL_LEVE = "leve-env";
    process.env.IA_MODEL = "base-env";
    expect(fallbacksDoTier(cfg(), "balanceado")).toEqual([]);
    expect(fallbacksDoTier(cfg(), "rapido")).toEqual([]);
  });

  it("sem env nenhuma, médio vazio não entra na cadeia", () => {
    guardarEnvs();
    expect(fallbacksDoTier(cfg({ forte: "forte-cfg" }), "forte")).toEqual([]);
  });
});
