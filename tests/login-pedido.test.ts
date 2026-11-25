import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cooldownRestante,
  gravarPedido,
  JANELA_PEDIDO,
  lerPedido,
  limparPedido,
  pedidoDeJson,
  type PedidoLogin,
} from "@/lib/login-pedido";

const PEDIDO: PedidoLogin = {
  h: "9f2b3c4d-1234-4abc-8def-0123456789ab",
  email: "ana@realiza.test",
  em: 1_700_000_000_000,
};

/** sessionStorage fake em Map — vitest roda em node, sem DOM. */
function storageFake() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    map,
  };
}

const st = storageFake();
vi.stubGlobal("sessionStorage", st);

afterEach(() => {
  st.map.clear();
});

describe("pedidoDeJson — validação do que sai do storage", () => {
  it("pedido bem-formado dentro da janela volta intacto", () => {
    const raw = JSON.stringify(PEDIDO);
    expect(pedidoDeJson(raw, PEDIDO.em + 60_000)).toEqual(PEDIDO);
    // em no limite exato da janela ainda vale
    expect(pedidoDeJson(raw, PEDIDO.em + JANELA_PEDIDO)).toEqual(PEDIDO);
  });

  it("JSON quebrado → null", () => {
    expect(pedidoDeJson("não é json{{{")).toBeNull();
    expect(pedidoDeJson("")).toBeNull();
    expect(pedidoDeJson(null)).toBeNull();
    expect(pedidoDeJson("null")).toBeNull();
    expect(pedidoDeJson("42")).toBeNull();
    expect(pedidoDeJson('"só uma string"')).toBeNull();
  });

  it("h que não é uuid → null (a RPC rejeitaria e o nonce nunca casa)", () => {
    const ruim = { ...PEDIDO, h: "nao-uuid" };
    expect(pedidoDeJson(JSON.stringify(ruim), PEDIDO.em + 1)).toBeNull();
    expect(
      pedidoDeJson(JSON.stringify({ ...PEDIDO, h: 123 }), PEDIDO.em + 1)
    ).toBeNull();
  });

  it("email ausente/vazio → null (o resgate compararia contra nada)", () => {
    expect(
      pedidoDeJson(JSON.stringify({ ...PEDIDO, email: "" }), PEDIDO.em + 1)
    ).toBeNull();
    expect(
      pedidoDeJson(JSON.stringify({ ...PEDIDO, email: 7 }), PEDIDO.em + 1)
    ).toBeNull();
  });

  it("fora da janela → null (o link OTP de 1h já morreu com folga)", () => {
    const raw = JSON.stringify(PEDIDO);
    expect(pedidoDeJson(raw, PEDIDO.em + JANELA_PEDIDO + 1)).toBeNull();
    expect(
      pedidoDeJson(raw, PEDIDO.em + 3 * 60 * 60 * 1000)
    ).toBeNull();
  });

  it("em inválido → null", () => {
    expect(
      pedidoDeJson(JSON.stringify({ ...PEDIDO, em: "agora" }), PEDIDO.em + 1)
    ).toBeNull();
    expect(
      pedidoDeJson(JSON.stringify({ ...PEDIDO, em: NaN }), PEDIDO.em + 1)
    ).toBeNull();
  });
});

describe("gravar/ler/limpar — round-trip na sessionStorage", () => {
  it("grava e lê o mesmo pedido", () => {
    gravarPedido({ ...PEDIDO, em: Date.now() });
    expect(lerPedido()).not.toBeNull();
    expect(lerPedido()?.h).toBe(PEDIDO.h);
    expect(lerPedido()?.email).toBe(PEDIDO.email);
  });

  it("row podre no storage sai na leitura (remove + null)", () => {
    st.map.set("login:pedido", "{quebrado");
    expect(lerPedido()).toBeNull();
    expect(st.map.has("login:pedido")).toBe(false);
  });

  it("pedido vencido sai na leitura", () => {
    st.map.set(
      "login:pedido",
      JSON.stringify({ ...PEDIDO, em: Date.now() - JANELA_PEDIDO - 1 })
    );
    expect(lerPedido()).toBeNull();
    expect(st.map.has("login:pedido")).toBe(false);
  });

  it("limpar remove a chave e lerPedido devolve null", () => {
    gravarPedido({ ...PEDIDO, em: Date.now() });
    limparPedido();
    expect(lerPedido()).toBeNull();
  });

  it("storage que joga (modo privado) → null silencioso, não exceção", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    });
    expect(lerPedido()).toBeNull();
    expect(() => gravarPedido(PEDIDO)).not.toThrow();
    expect(() => limparPedido()).not.toThrow();
    vi.stubGlobal("sessionStorage", st);
  });
});

describe("cooldownRestante — reenvio depois do reload", () => {
  it("60s cheios logo após o envio", () => {
    expect(cooldownRestante(PEDIDO.em, PEDIDO.em)).toBe(60);
    expect(cooldownRestante(PEDIDO.em, PEDIDO.em + 30_000)).toBe(30);
  });

  it("passada a janela de reenvio → 0", () => {
    expect(cooldownRestante(PEDIDO.em, PEDIDO.em + 60_000)).toBe(0);
    expect(cooldownRestante(PEDIDO.em, PEDIDO.em + 120_000)).toBe(0);
  });

  it("arredonda pra cima — fração de segundo ainda é espera", () => {
    expect(cooldownRestante(PEDIDO.em, PEDIDO.em + 59_500)).toBe(1);
  });
});
