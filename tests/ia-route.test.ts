// Rota /api/ia/chat — o transporte inteiro é mockado na fronteira:
// createClient (sessão cookie), contextoELimiteIa (identidade + limite numa
// RPC só), o
// provider (stream + fallback JSON) e executarTool. O que se prova aqui é
// o CONTRATO da rota, não o que cada dependência faz:
//   · todo gate responde JSON ANTES do stream abrir — depois do primeiro
//     byte, status e header já foram (o e2e lê esse contrato);
//   · o body é .strict() (regressão REALIZA-283: campos de UI nas
//     mensagens derrubavam o parse — hoje montarEnvioChat limpa no
//     cliente, mas o servidor segue rejeitando sujeira);
//   · aberto o stream, o primeiro byte é o comentário ": ok" (vence o
//     buffer de 1KB do Safari) e tudo vira evento data: {type}.
// prompts.ts fica real de propósito — é puro e prova o system prompt no
// lugar certo do histórico.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ia/chat/route";
import type { MsgChat } from "@/lib/ia/provider";
import { limparCacheIaConfig } from "@/lib/ia/config";
import { limparCacheGuias } from "@/lib/ia/guias";

const m = vi.hoisted(() => ({
  getClaims: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  contextoELimiteIa: vi.fn(),
  providerConfigurado: vi.fn(),
  chamarModelo: vi.fn(),
  chamarModeloStream: vi.fn(),
  executarTool: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims: m.getClaims },
    rpc: m.rpc,
    from: m.from,
  })),
}));
vi.mock("@/lib/ia/rate-limit", () => ({
  contextoELimiteIa: m.contextoELimiteIa,
}));
vi.mock("@/lib/ia/provider", () => ({
  providerConfigurado: m.providerConfigurado,
  chamarModelo: m.chamarModelo,
  chamarModeloStream: m.chamarModeloStream,
}));
vi.mock("@/lib/ia/tools", () => ({ executarTool: m.executarTool }));

// config e guias têm cache por módulo: sem limpar, um teste herdava o
// que o anterior leu
beforeEach(() => {
  limparCacheIaConfig();
  limparCacheGuias();
});

/** Builder de query fake: só `ia_config` (via getIaConfig real) ainda lê
 *  tabela, com select direto awaited. */
function queryFake() {
  const q = {
    select: () => q,
    eq: () => q,
    then: (res: (v: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(res),
  };
  return q;
}

const CTX_OK = {
  status: "ok",
  profileId: "prof-1",
  role: "coordenacao",
  papeis: ["coordenacao"],
  usados: 1,
  requestId: "req-teste",
};

/** O caminho feliz: sessão, provider, identidade e limite ok. */
function autenticado() {
  m.getClaims.mockResolvedValue({
    data: { claims: { sub: "auth-1" } },
    error: null,
  });
  m.providerConfigurado.mockReturnValue(true);
  m.from.mockImplementation(() => queryFake());
  m.contextoELimiteIa.mockResolvedValue(CTX_OK);
  m.rpc.mockResolvedValue({ data: null, error: null });
}

/** Chamadas do lote de auditoria (uma por mensagem). */
const chamadasLote = () =>
  m.rpc.mock.calls.filter(([fn]) => fn === "registrar_ia_eventos_lote") as [
    string,
    { p_eventos: Record<string, unknown>[] },
  ][];

const req = (
  body: unknown = { messages: [{ role: "user", content: "oi" }] }
) =>
  new Request("http://app.test/api/ia/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

/** Drena o SSE inteiro — a resposta só termina no controller.close(). */
async function lerStream(res: Response): Promise<string> {
  expect(res.body).toBeTruthy();
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let texto = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    texto += dec.decode(value, { stream: true });
  }
  return texto;
}

const chamadasStream = () =>
  m.chamarModeloStream.mock.calls as unknown as [MsgChat[], string, {
    onToken: (t: string) => void;
    signal: AbortSignal;
    clienteAbortou: () => boolean;
  }][];

describe("gates — JSON antes do stream abrir", () => {
  // a rota mora atrás da mesma flag da bolha — os casos abaixo assumem
  // o ambiente com IA_BOLHA=1 (como o e2e liga explicitamente)
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("IA_BOLHA", "1");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("flag IA_BOLHA desligada devolve 404 antes de autenticar", async () => {
    vi.stubEnv("IA_BOLHA", "0");
    const res = await POST(req());
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining("encontrado"),
    });
    // nem sessão nem limite — o gate corta antes de qualquer custo
    expect(m.getClaims).not.toHaveBeenCalled();
    expect(m.contextoELimiteIa).not.toHaveBeenCalled();
    expect(m.chamarModeloStream).not.toHaveBeenCalled();
  });

  it("sem sessão devolve 401 antes de olhar o provider", async () => {
    m.getClaims.mockResolvedValue({ data: { claims: null }, error: null });
    const res = await POST(req());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining("Sessão"),
    });
    expect(m.providerConfigurado).not.toHaveBeenCalled();
  });

  it("provider não configurado devolve 503 antes de ler identidade/limite", async () => {
    autenticado();
    m.providerConfigurado.mockReturnValue(false);
    const res = await POST(req());
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining("indisponível"),
    });
    expect(m.contextoELimiteIa).not.toHaveBeenCalled();
    expect(m.from).not.toHaveBeenCalled();
  });

  it("sessão válida sem profile ativo devolve 401 (cadastro não encontrado)", async () => {
    autenticado();
    // ia_contexto_e_limite devolve profile_id null pra inativo/desconhecido
    // (my_profile_id filtra ativo) e não reserva slot
    m.contextoELimiteIa.mockResolvedValue({ status: "sem_cadastro" });
    const res = await POST(req());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining("Cadastro"),
    });
    expect(m.chamarModeloStream).not.toHaveBeenCalled();
  });

  it("identidade e limite saem numa RPC só, depois do body", async () => {
    autenticado();
    m.chamarModeloStream.mockResolvedValue({ ok: true, content: "oi", toolCalls: [] });
    await lerStream(await POST(req()));
    expect(m.contextoELimiteIa).toHaveBeenCalledTimes(1);
    expect(m.contextoELimiteIa).toHaveBeenCalledWith(expect.anything(), {
      n_mensagens: 1,
    });
    // nada de select em profiles nem my_papeis separados
    expect(m.from).not.toHaveBeenCalledWith("profiles");
    expect(m.rpc).not.toHaveBeenCalledWith("my_papeis");
    // por mensagem sem tool: só o lote do fim vai pelo rpc do client
    expect(m.rpc.mock.calls.map(([fn]) => fn)).toEqual([
      "registrar_ia_eventos_lote",
    ]);
  });

  it("rate limit estourado devolve 429 e não registra a mensagem", async () => {
    autenticado();
    m.contextoELimiteIa.mockResolvedValue({ status: "negado", usados: 20 });
    const res = await POST(req());
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining("aguarde"),
    });
    // negado não grava nada: nem lote, nem evento avulso
    expect(m.rpc).not.toHaveBeenCalled();
    expect(m.chamarModeloStream).not.toHaveBeenCalled();
  });

  // REALIZA-283: campos de estado da UI (tools/estado) viajavam nas
  // mensagens e o .strict() derrubava a conversa seguinte. O cliente hoje
  // limpa em montarEnvioChat, mas o contrato do servidor continua duro.
  it("body com campo extra na mensagem devolve 400", async () => {
    autenticado();
    const res = await POST(
      req({
        messages: [
          { role: "assistant", content: "oi!", tools: ["guia_consulta"] },
          { role: "user", content: "pergunta" },
        ],
      })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining("inválido"),
    });
    expect(m.contextoELimiteIa).not.toHaveBeenCalled();
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("body malformado devolve 400 em todas as formas", async () => {
    autenticado();
    const bodies: unknown[] = [
      { messages: [{ role: "user", content: "oi" }], meta: 1 }, // extra no body
      { messages: [] }, // lista vazia
      { messages: [{ role: "tool", content: "resultado" }] }, // role fora do enum
      { messages: [{ role: "user", content: "" }] }, // content vazio
      { messages: [{ role: "user", content: "x".repeat(4001) }] }, // acima de 4000
      {
        messages: Array.from({ length: 21 }, (_, i) => ({
          role: i % 2 ? "assistant" : "user",
          content: `m${i}`,
        })),
      }, // acima de 20
      "não é json", // JSON quebrado no corpo
      {}, // sem messages
    ];
    for (const body of bodies) {
      const res = await POST(req(body));
      expect(res.status).toBe(400);
      await res.json();
    }
    expect(m.rpc).not.toHaveBeenCalledWith(
      "registrar_ia_evento",
      expect.anything()
    );
    expect(m.chamarModeloStream).not.toHaveBeenCalled();
    // malformado nunca gasta slot do limite
    expect(m.contextoELimiteIa).not.toHaveBeenCalled();
  });
});

describe("stream SSE", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("IA_BOLHA", "1");
    autenticado();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("abre text/event-stream e o primeiro byte é o comentário ': ok'", async () => {
    m.chamarModeloStream.mockImplementation(
      async (_msgs: MsgChat[], _s: string, opts: { onToken: (t: string) => void }) => {
        opts.onToken("Tudo certo");
        return { ok: true, content: "Tudo certo", toolCalls: [] };
      }
    );
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("cache-control")).toContain("no-cache");
    // proxies reverso bufferizam SSE por padrão — o header desliga isso
    expect(res.headers.get("x-accel-buffering")).toBe("no");

    const texto = await lerStream(res);
    // comentário SSE sai antes de qualquer rodada do provider
    expect(texto.startsWith(": ok\n\n")).toBe(true);
    expect(texto).toContain('data: {"type":"token","c":"Tudo certo"}');
    expect(texto).toContain('data: {"type":"done","tools":[]}');
  });

  it("o resumo 'resposta' sai no lote com o request_id da reserva", async () => {
    m.chamarModeloStream.mockResolvedValue({
      ok: true,
      content: "oi",
      toolCalls: [],
    });
    await lerStream(await POST(req()));
    const lotes = chamadasLote();
    expect(lotes).toHaveLength(1);
    expect(lotes[0][1].p_eventos).toEqual([
      expect.objectContaining({
        canal: "chat",
        tool: "resposta",
        request_id: "req-teste",
        ok: true,
        iteracoes: 1,
        // hash curto do system prompt montado — compara métricas
        // antes/depois de mexer no prompt
        args: expect.objectContaining({
          prompt_v: expect.stringMatching(/^[0-9a-f]{8}$/),
        }),
      }),
    ]);
    expect(m.rpc).not.toHaveBeenCalledWith(
      "registrar_ia_evento",
      expect.anything()
    );
  });

  it("monta o histórico com o system prompt real e a sessão = profile", async () => {
    m.chamarModeloStream.mockResolvedValue({
      ok: true,
      content: "oi",
      toolCalls: [],
    });
    await lerStream(await POST(req()));
    const [msgs, sessao] = chamadasStream()[0];
    // system prompt na primeira posição, com o label do papel dentro
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("Coordenação");
    expect(msgs[1]).toEqual({ role: "user", content: "oi" });
    // sessão estável por usuário — o provider Go exige pra rotear
    expect(sessao).toBe("prof-1");
  });

  it("roda o loop de tools: call → executarTool → status → resposta", async () => {
    m.executarTool.mockResolvedValue({
      ok: true,
      dados: { total: 0, duplas: [] },
    });
    m.chamarModeloStream
      // rodada 1: o modelo pede a tool
      .mockResolvedValueOnce({
        ok: true,
        content: "",
        toolCalls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "resumo_semana", arguments: "{}" },
          },
        ],
      })
      // rodada 2: responde com o que a tool devolveu
      .mockImplementationOnce(
        async (_msgs: MsgChat[], _s: string, opts: { onToken: (t: string) => void }) => {
          opts.onToken("Sem duplas em risco.");
          return { ok: true, content: "Sem duplas em risco.", toolCalls: [] };
        }
      );

    const texto = await lerStream(await POST(req()));

    // a tool roda com o client da sessão, no canal chat, com o
    // request_id da reserva pra auditoria correlacionada
    expect(m.executarTool).toHaveBeenCalledWith(
      "resumo_semana",
      {},
      expect.anything(),
      "chat",
      ["coordenacao"], // papéis já resolvidos pela rota — a tool não refaz
      undefined, // autorProfileId — idem
      "req-teste",
      {
        coletarEvento: expect.any(Function), // auditoria vai no lote do fim
        dedupKey: "prof-1", // sessão = profile: dedup de leitura na conversa
      }
    );
    // o status chega com o rótulo por tool (STATUS_TOOL em lib/ia/ui.ts)
    expect(texto).toContain(
      'data: {"type":"status","t":"Lendo o resumo da semana…"}'
    );
    expect(texto).toContain('data: {"type":"done","tools":["resumo_semana"]}');

    // a resposta da tool entra no histórico da rodada seguinte
    const hist2 = chamadasStream()[1][0];
    const toolMsg = hist2.find((x) => x.role === "tool");
    expect(toolMsg).toMatchObject({
      role: "tool",
      tool_call_id: "call_1",
      name: "resumo_semana",
    });
    expect(JSON.parse(String(toolMsg?.content))).toEqual({
      ok: true,
      dados: { total: 0, duplas: [] },
    });
  });

  it("papeis vazio cai no papel do profile", async () => {
    m.contextoELimiteIa.mockResolvedValue({
      ...CTX_OK,
      role: "mentor",
      papeis: [],
    });
    m.executarTool.mockResolvedValue({ ok: true, dados: {} });
    m.chamarModeloStream
      .mockResolvedValueOnce({
        ok: true,
        content: "",
        toolCalls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "resumo_semana", arguments: "{}" },
          },
        ],
      })
      .mockResolvedValueOnce({ ok: true, content: "ok", toolCalls: [] });

    await lerStream(await POST(req()));
    expect(m.executarTool).toHaveBeenCalledWith(
      "resumo_semana",
      {},
      expect.anything(),
      "chat",
      ["mentor"],
      undefined,
      "req-teste",
      { coletarEvento: expect.any(Function), dedupKey: "prof-1" }
    );
  });

  it("eventos das tools vão junto do resumo numa chamada só do lote", async () => {
    // executarTool real chama coletarEvento em vez de gravar; o mock imita
    m.executarTool.mockImplementation(
      async (
        nome: string,
        _a: unknown,
        _s: unknown,
        canal: string,
        _p: unknown,
        _autor: unknown,
        requestId: string,
        opcoes: { coletarEvento: (ev: Record<string, unknown>) => void }
      ) => {
        opcoes.coletarEvento({
          canal,
          tool: nome,
          args: {},
          ok: true,
          erro: null,
          duracao_ms: 5,
          request_id: requestId,
        });
        return { ok: true, dados: {} };
      }
    );
    const call = (id: string, name: string) => ({
      id,
      type: "function",
      function: { name, arguments: "{}" },
    });
    m.chamarModeloStream
      .mockResolvedValueOnce({
        ok: true,
        content: "",
        toolCalls: [call("c1", "resumo_semana"), call("c2", "minhas_duplas")],
      })
      .mockResolvedValueOnce({ ok: true, content: "pronto", toolCalls: [] });

    await lerStream(await POST(req()));

    // uma RPC de escrita por mensagem: 2 tools + resumo no mesmo lote
    expect(m.rpc).toHaveBeenCalledTimes(1);
    const lotes = chamadasLote();
    expect(lotes).toHaveLength(1);
    const evs = lotes[0][1].p_eventos;
    expect(evs.map((e) => e.tool)).toEqual([
      "resumo_semana",
      "minhas_duplas",
      "resposta",
    ]);
    expect(evs.every((e) => e.request_id === "req-teste")).toBe(true);
  });

  it("provider sem SSE refaz a rodada em JSON (fallback) e emite o resto", async () => {
    m.chamarModeloStream.mockResolvedValue({
      ok: false,
      erro: "provider recusou stream",
      fallback: true,
    });
    m.chamarModelo.mockResolvedValue({
      ok: true,
      mensagem: { role: "assistant", content: "Resposta via JSON." },
    });

    const texto = await lerStream(await POST(req()));
    expect(m.chamarModelo).toHaveBeenCalled();
    expect(texto).toContain(
      'data: {"type":"token","c":"Resposta via JSON."}'
    );
    expect(texto).toContain('data: {"type":"done","tools":[]}');
  });

  it("falha do provider vira evento error no stream, não exception", async () => {
    m.chamarModeloStream.mockResolvedValue({
      ok: false,
      erro: "caiu geral",
    });
    const res = await POST(req());
    expect(res.status).toBe(200); // o stream já abriu — o erro é evento
    const texto = await lerStream(res);
    expect(texto).toContain('data: {"type":"error","e":"caiu geral"}');
  });
});
