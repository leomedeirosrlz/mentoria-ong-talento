// Cache da camada de IA (lib/ia/cache.ts + lib/ia/guias.ts + config):
// pergunta repetida não refaz embedding nem RPC, falha não fica guardada,
// "fts" nunca chama o embedding e a config viva vale por 30s.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ia/embed", () => ({ embedQuery: vi.fn(), embedConfigurado: () => true }));

import { CacheTtl, chavePergunta } from "@/lib/ia/cache";
import { embedQuery } from "@/lib/ia/embed";
import { buscarNosGuias, catalogoGuias, limparCacheGuias } from "@/lib/ia/guias";
import { getIaConfig, limparCacheIaConfig } from "@/lib/ia/config";

const embed = vi.mocked(embedQuery);

/** supabase falso: rpc(match_ia_chunks) + from(ia_chunks|ia_config) */
function clienteFalso(
  opts: {
    configRows?: { chave: string; valor: unknown }[];
    // erro na 1ª leitura de cada uma; as seguintes respondem normal
    erroTextos?: boolean;
    erroCatalogo?: boolean;
    erroConfig?: boolean;
  } = {}
) {
  const erro = { data: null, error: { message: "falhou" } };
  let { erroTextos, erroCatalogo, erroConfig } = opts;
  const rpc = vi.fn(async () => ({
    data: [
      { guia: "instrumento-roda-da-vida", secao: "O que é", pagina: 1, trecho: "headline" },
      { guia: "instrumento-roda-da-vida", secao: "O que é", pagina: 2, trecho: "dup" },
    ],
    error: null,
  }));
  const from = vi.fn((tabela: string) => {
    if (tabela === "ia_config")
      return {
        select: async () => {
          if (erroConfig) {
            erroConfig = false;
            return erro;
          }
          return { data: opts.configRows ?? [], error: null };
        },
      };
    // ia_chunks: catálogo (select("guia") awaited direto) ou textos (.in().in())
    const textos = { data: [{ guia: "instrumento-roda-da-vida", pagina: 1, texto: "Texto inteiro do chunk." }], error: null };
    const catalogo = { data: [{ guia: "b" }, { guia: "a" }, { guia: "a" }], error: null };
    return {
      select: (cols: string) => {
        if (cols === "guia") {
          if (erroCatalogo) {
            erroCatalogo = false;
            return Promise.resolve(erro);
          }
          return Promise.resolve(catalogo);
        }
        return {
          in: () => ({
            in: async () => {
              if (erroTextos) {
                erroTextos = false;
                return erro;
              }
              return textos;
            },
          }),
        };
      },
    };
  });
  return { rpc, from } as unknown as Parameters<typeof buscarNosGuias>[0] & {
    rpc: typeof rpc;
    from: typeof from;
  };
}

beforeEach(() => {
  limparCacheGuias();
  limparCacheIaConfig();
  embed.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("CacheTtl", () => {
  it("expira no TTL", () => {
    vi.useFakeTimers();
    const c = new CacheTtl<number>(1000, 10);
    c.set("a", 1);
    vi.advanceTimersByTime(999);
    expect(c.get("a")).toBe(1);
    vi.advanceTimersByTime(2);
    expect(c.get("a")).toBeUndefined();
  });

  it("descarta a menos usada quando passa do máximo", () => {
    const c = new CacheTtl<number>(60_000, 2);
    c.set("a", 1);
    c.set("b", 2);
    c.get("a"); // "a" vira a mais recente
    c.set("c", 3);
    expect(c.get("a")).toBe(1);
    expect(c.get("b")).toBeUndefined();
    expect(c.get("c")).toBe(3);
  });

  it("chamadas simultâneas da mesma chave carregam uma vez só", async () => {
    const c = new CacheTtl<number>(60_000, 10);
    const carregar = vi.fn(async () => 7);
    const [x, y] = await Promise.all([c.obter("k", carregar), c.obter("k", carregar)]);
    expect([x, y]).toEqual([7, 7]);
    expect(carregar).toHaveBeenCalledTimes(1);
  });

  it("falha e resultado recusado por `guardar` não ficam guardados", async () => {
    const c = new CacheTtl<number | null>(60_000, 10);
    await expect(c.obter("e", async () => { throw new Error("x"); })).rejects.toThrow();
    await c.obter("n", async () => null, (v) => v !== null);
    const carregar = vi.fn(async () => 1);
    await c.obter("e", carregar);
    await c.obter("n", carregar);
    expect(carregar).toHaveBeenCalledTimes(2);
  });

  it("limpar durante uma carga em voo: o valor velho não volta pro cache", async () => {
    const c = new CacheTtl<number>(60_000, 10);
    let soltarVelha!: (v: number) => void;
    const velha = c.obter("k", () => new Promise<number>((r) => (soltarVelha = r)));
    c.limpar();
    let soltarNova!: (v: number) => void;
    const nova = c.obter("k", () => new Promise<number>((r) => (soltarNova = r)));
    soltarVelha(1);
    await velha;
    expect(c.get("k")).toBeUndefined();
    // o finally da carga velha não apagou a nova: quem chega agora divide ela
    const carregar = vi.fn(async () => 3);
    const junto = c.obter("k", carregar);
    soltarNova(2);
    expect(await nova).toBe(2);
    expect(await junto).toBe(2);
    expect(carregar).not.toHaveBeenCalled();
    expect(c.get("k")).toBe(2);
  });
});

describe("chavePergunta", () => {
  it("ignora caixa, acento, pontuação e espaço", () => {
    expect(chavePergunta("  O que é a Roda da Vida?? ")).toBe(chavePergunta("o que e a roda da vida"));
  });
});

describe("buscarNosGuias", () => {
  it("pergunta repetida não refaz embedding nem RPC", async () => {
    embed.mockResolvedValue([0.1, 0.2]);
    const sb = clienteFalso();
    const a = await buscarNosGuias(sb, "O que é a Roda da Vida?", "hibrida");
    const b = await buscarNosGuias(sb, "o que é a roda da vida", "hibrida");
    expect(b).toEqual(a);
    expect(embed).toHaveBeenCalledTimes(1);
    expect(sb.rpc).toHaveBeenCalledTimes(1);
    // seção única + chunk inteiro no lugar do headline
    expect(a).toEqual([
      { guia: "instrumento-roda-da-vida", secao: "O que é", trecho: "Texto inteiro do chunk." },
    ]);
  });

  it("modo fts nunca chama o embedding", async () => {
    const sb = clienteFalso();
    await buscarNosGuias(sb, "remarcar encontro", "fts");
    expect(embed).not.toHaveBeenCalled();
    expect(sb.rpc).toHaveBeenCalledWith(
      "match_ia_chunks",
      expect.not.objectContaining({ p_embedding: expect.anything() })
    );
  });

  it("embedding que falhou não guarda vetor nem resultado degradado", async () => {
    embed.mockResolvedValueOnce(null).mockResolvedValueOnce([0.3]);
    const sb = clienteFalso();
    await buscarNosGuias(sb, "escuta ativa", "hibrida");
    await buscarNosGuias(sb, "escuta ativa", "hibrida");
    await buscarNosGuias(sb, "escuta ativa", "hibrida");
    // 1ª falhou (null) → 2ª tenta de novo e guarda → 3ª sai do cache
    expect(embed).toHaveBeenCalledTimes(2);
    expect(sb.rpc).toHaveBeenCalledTimes(2);
  });

  it("falha na leitura dos chunks serve o headline e não guarda", async () => {
    const sb = clienteFalso({ erroTextos: true });
    const a = await buscarNosGuias(sb, "remarcar encontro", "fts");
    expect(a[0].trecho).toBe("headline");
    const b = await buscarNosGuias(sb, "remarcar encontro", "fts");
    expect(b[0].trecho).toBe("Texto inteiro do chunk.");
    expect(sb.rpc).toHaveBeenCalledTimes(2);
    await buscarNosGuias(sb, "remarcar encontro", "fts");
    expect(sb.rpc).toHaveBeenCalledTimes(2);
  });

  it("fts e hibrida não dividem a chave do cache", async () => {
    embed.mockResolvedValue([0.1]);
    const sb = clienteFalso();
    await buscarNosGuias(sb, "escuta ativa", "fts");
    await buscarNosGuias(sb, "escuta ativa", "hibrida");
    expect(sb.rpc).toHaveBeenCalledTimes(2);
    expect(embed).toHaveBeenCalledTimes(1);
  });
});

describe("catalogoGuias", () => {
  it("nomes únicos e ordenados, lidos uma vez", async () => {
    const sb = clienteFalso();
    expect(await catalogoGuias(sb)).toEqual(["a", "b"]);
    await catalogoGuias(sb);
    expect(sb.from).toHaveBeenCalledTimes(1);
  });

  it("erro devolve lista vazia sem guardar", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const sb = clienteFalso({ erroCatalogo: true });
    expect(await catalogoGuias(sb)).toEqual([]);
    expect(await catalogoGuias(sb)).toEqual(["a", "b"]);
    expect(sb.from).toHaveBeenCalledTimes(2);
    erro.mockRestore();
  });
});

describe("getIaConfig com cache", () => {
  it("lê a tabela uma vez dentro do TTL e traz a flag busca", async () => {
    const sb = clienteFalso({ configRows: [{ chave: "busca", valor: "fts" }] });
    const a = await getIaConfig(sb);
    await getIaConfig(sb);
    expect(a.busca).toBe("fts");
    expect(sb.from).toHaveBeenCalledTimes(1);
  });

  it("erro de leitura cai no padrão e não fica guardado", async () => {
    const sb = clienteFalso({ erroConfig: true, configRows: [{ chave: "busca", valor: "fts" }] });
    expect((await getIaConfig(sb)).busca).toBe("hibrida");
    expect((await getIaConfig(sb)).busca).toBe("fts");
    expect(sb.from).toHaveBeenCalledTimes(2);
  });

  it("relê a tabela depois dos 30s de TTL", async () => {
    vi.useFakeTimers();
    const sb = clienteFalso();
    await getIaConfig(sb);
    vi.advanceTimersByTime(29_999);
    await getIaConfig(sb);
    expect(sb.from).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2);
    await getIaConfig(sb);
    expect(sb.from).toHaveBeenCalledTimes(2);
  });
});
