import { describe, expect, it } from "vitest";
import {
  agregarTentativas,
  fmtDuracaoMs,
  mediana,
  type TentativaMetrica,
} from "@/lib/metricas-registro";
import { dispositivoDe } from "@/lib/tentativa-registro";

// Métricas do form de registro (REALIZA-217, fase 1): agregação pura sobre
// registro_tentativas + heurística de dispositivo — a camada que o card de
// /registros lê e que o vitest cobre sem banco nem browser.

function tentativa(p: Partial<TentativaMetrica> = {}): TentativaMetrica {
  return {
    origem: "novo",
    dispositivo: "mobile",
    duracao_ms: null,
    concluido: false,
    ...p,
  };
}

describe("agregarTentativas", () => {
  it("vazio → zeros e percentuais nulos (o card não renderiza)", () => {
    expect(agregarTentativas([])).toEqual({
      total: 0,
      concluidas: 0,
      pctConcluidas: null,
      medianaMs: null,
      mobile: 0,
      desktop: 0,
      tablet: 0,
      pctMobile: null,
      pctRetroativo: null,
    });
  });

  it("conclui vs. abandona: percentual e mediana só das concluídas", () => {
    const m = agregarTentativas([
      tentativa({ concluido: true, duracao_ms: 60_000 }),
      tentativa({ concluido: true, duracao_ms: 120_000 }),
      tentativa({ concluido: true, duracao_ms: 300_000 }),
      tentativa(), // abandonada — fora da mediana
    ]);
    expect(m.total).toBe(4);
    expect(m.concluidas).toBe(3);
    expect(m.pctConcluidas).toBe(75);
    expect(m.medianaMs).toBe(120_000);
  });

  it("mediana par = média dos dois centrais", () => {
    expect(mediana([10, 30])).toBe(20);
    expect(mediana([30, 10, 50, 20])).toBe(25);
    expect(mediana([7])).toBe(7);
    expect(mediana([])).toBeNull();
  });

  it("concluída sem duracao_ms não derruba a mediana", () => {
    const m = agregarTentativas([
      tentativa({ concluido: true, duracao_ms: 90_000 }),
      tentativa({ concluido: true }), // duracao_ms null
    ]);
    expect(m.medianaMs).toBe(90_000);
  });

  it("split de dispositivo conta cada valor e fecha o denominador", () => {
    const m = agregarTentativas([
      tentativa({ dispositivo: "mobile" }),
      tentativa({ dispositivo: "mobile" }),
      tentativa({ dispositivo: "desktop" }),
      tentativa({ dispositivo: "tablet" }),
      tentativa({ dispositivo: null }), // RPC antiga/erro — fora do %
    ]);
    expect(m.mobile).toBe(2);
    expect(m.desktop).toBe(1);
    expect(m.tablet).toBe(1);
    expect(m.pctMobile).toBe(50); // 2 de 4 com dispositivo informado
  });

  it("pctRetroativo mede a fatia de catch-up", () => {
    const m = agregarTentativas([
      tentativa({ origem: "retroativo" }),
      tentativa({ origem: "novo" }),
      tentativa({ origem: "novo" }),
      tentativa({ origem: "edicao" }),
    ]);
    expect(m.pctRetroativo).toBe(25);
  });
});

describe("fmtDuracaoMs", () => {
  it("abaixo do minuto fala em segundos", () => {
    expect(fmtDuracaoMs(45_000)).toBe("45 s");
    expect(fmtDuracaoMs(500)).toBe("1 s");
  });
  it("minuto quebrado mostra os segundos até 10 min", () => {
    expect(fmtDuracaoMs(90_000)).toBe("1min30s");
    expect(fmtDuracaoMs(9 * 60_000)).toBe("9 min");
    expect(fmtDuracaoMs(2 * 60_000 + 5_000)).toBe("2min05s");
  });
  it("a partir de 10 min arredonda", () => {
    expect(fmtDuracaoMs(10 * 60_000 + 20_000)).toBe("10 min");
    expect(fmtDuracaoMs(25 * 60_000)).toBe("25 min");
  });
});

describe("dispositivoDe", () => {
  const DESKTOP_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36";
  const ANDROID_UA =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36";
  const IPHONE_UA =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1";
  const IPAD_UA =
    "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1";
  const IPADOS_DESKTOP_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15";

  it("UA móvel → mobile", () => {
    expect(dispositivoDe(ANDROID_UA, 5, 412)).toBe("mobile");
    expect(dispositivoDe(IPHONE_UA, 5, 390)).toBe("mobile");
  });

  it("UA de tablet → tablet", () => {
    expect(dispositivoDe(IPAD_UA, 5, 820)).toBe("tablet");
  });

  it("iPadOS 13+ disfarçado de Mac: o toque desempata como mobile", () => {
    expect(dispositivoDe(IPADOS_DESKTOP_UA, 5, 1024)).toBe("mobile");
    // Mac de verdade não tem toque — fica desktop
    expect(dispositivoDe(IPADOS_DESKTOP_UA, 0, 1024)).toBe("desktop");
  });

  it("desktop comum → desktop, mesmo sem viewport", () => {
    expect(dispositivoDe(DESKTOP_UA, 0, 1440)).toBe("desktop");
    expect(dispositivoDe(DESKTOP_UA, 0, null)).toBe("desktop");
  });

  it("janela desktop estreita conta como mobile", () => {
    expect(dispositivoDe(DESKTOP_UA, 0, 500)).toBe("mobile");
  });
});
