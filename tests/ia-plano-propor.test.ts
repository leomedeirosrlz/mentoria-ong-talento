// 0245 — proposta com suposição de recesso pela Liza: a equipe propõe
// sem declarar_recesso (a decisão é autoral da dupla e só grava no
// aceite); a dupla segue declarando o que mudou antes de propor.
// O run usa contextoPlanoCom/getCicloEventosPlano, que leem pelo client
// de serviço — mockado aqui pras fixtures não tocarem rede.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// tabelas do client de serviço — o mock lê o estado corrente a cada
// chamada (o teste semeia antes de executar a tool)
const svcState = vi.hoisted(() => ({
  tabelas: {} as Record<string, unknown[]>,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => {
    const builder = (tabela: string) => {
      const rows = () => svcState.tabelas[tabela] ?? [];
      const b: Record<string, unknown> = {
        select: () => b,
        eq: () => b,
        in: () => b,
        neq: () => b,
        order: () => b,
        limit: () => b,
        single: () =>
          Promise.resolve({ data: rows()[0] ?? null, error: null }),
        maybeSingle: () =>
          Promise.resolve({ data: rows()[0] ?? null, error: null }),
        then: (
          res: (v: unknown) => unknown,
          rej?: (e: unknown) => unknown
        ) => Promise.resolve({ data: rows(), error: null }).then(res, rej),
      };
      return b;
    };
    return { from: (t: string) => builder(t) };
  },
}));

import { executarTool } from "@/lib/ia/tools";
import { limparCacheIaConfig } from "@/lib/ia/config";
import { limparCacheGuias } from "@/lib/ia/guias";
import { CICLO_16, dt, encRealizado, mkDupla } from "./helpers";
import type { CicloEvento } from "@/lib/types";

// 20/12/2025: o encontro 11 (16/12) já venceu e o recesso (25/12→04/01)
// ainda não foi decidido — a dupla está atrasada com pendência aberta
const HOJE = "2025-12-20";
const DUPLA_ID = "11111111-2222-4333-8444-555555555555";
const EV_RECESSO = "22222222-3333-4444-8555-666666666666";
const MENTOR_ID = "p-mentor";
const MENTORADO_ID = "m-jovem";

// o recesso do CICLO_16 ganha id de uuid — o schema exige pra entrar em
// decisoes_recesso (o banco guarda uuid de verdade)
const EVENTOS: CicloEvento[] = CICLO_16.map((e) =>
  e.id === "ev-recesso" ? { ...e, id: EV_RECESSO } : e
);

const duplaAtrasada = (recessos: unknown[] = []) => ({
  ...mkDupla({ id: DUPLA_ID }),
  mentor_id: MENTOR_ID,
  mentorado_id: MENTORADO_ID,
  // encontros 1-10 realizados; o 11 venceu em 16/12 sem row → devido;
  // 12-16 seguem futuros no caminho da recuperação
  encontros: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) =>
    encRealizado(n, EVENTOS.find((e) => e.numero === n)!.data!)
  ),
  recessos,
  planos: [],
});

const recessoDecidido = (usa: boolean) => ({
  id: "r-1",
  dupla_id: DUPLA_ID,
  ciclo_evento_id: EV_RECESSO,
  usa,
  declarado_por: MENTOR_ID,
  declarado_em: "2025-12-10T00:00:00-03:00",
});

function seed(dupla: unknown) {
  svcState.tabelas = {
    duplas: [dupla],
    ciclo_eventos: EVENTOS,
    mentor_profiles: [],
    mentorados: [{ disponibilidade: null, email: null }],
    profiles: [{ email: null }],
  };
}

/** Client da sessão: RPCs respondem do mapa e toda chamada fica gravada
 *  pra asserção (quem escreveu, quem não devia escrever). */
function sessaoFake({
  tabelas = {},
  rpcData = {},
}: {
  tabelas?: Record<string, unknown[]>;
  rpcData?: Record<string, unknown>;
}) {
  const rpcCalls: { nome: string; args?: Record<string, unknown> }[] = [];
  const builder = (tabela: string) => {
    const rows = () => tabelas[tabela] ?? [];
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      in: () => b,
      order: () => b,
      limit: () => b,
      maybeSingle: () =>
        Promise.resolve({ data: rows()[0] ?? null, error: null }),
      then: (res: (v: unknown) => unknown) =>
        Promise.resolve({ data: rows(), error: null }).then(res),
    };
    return b;
  };
  const supabase = {
    from: (t: string) => builder(t),
    rpc: (nome: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ nome, args });
      return { data: rpcData[nome] ?? null, error: null };
    },
  };
  return {
    supabase: supabase as unknown as SupabaseClient,
    chamadas: (nome: string) => rpcCalls.filter((c) => c.nome === nome),
  };
}

const RPC_ESCRITA = {
  ia_confirmacao_consumir: true,
  plano_propor: { ok: true, id: "pl-1", versao: 1, status: "proposto" },
  declarar_recesso: { ok: true },
};

// o lado sai das RPCs de identidade (my_profile_id/my_mentorado_id contra
// mentor_id/mentorado_id da dupla; supervisiona_dupla/has_papel pra equipe)
const RPC_STAFF = {
  ...RPC_ESCRITA,
  my_profile_id: "p-coord",
  my_mentorado_id: "m-outro",
  supervisiona_dupla: false,
  has_papel: true,
};
const RPC_MENTOR = {
  ...RPC_ESCRITA,
  my_profile_id: MENTOR_ID,
  my_mentorado_id: "m-outro",
  supervisiona_dupla: false,
  has_papel: false,
};
const RPC_JOVEM = {
  ...RPC_ESCRITA,
  my_profile_id: "p-outro",
  my_mentorado_id: MENTORADO_ID,
  supervisiona_dupla: false,
  has_papel: false,
};

const propor = (
  supabase: SupabaseClient,
  papeis: ("coordenacao" | "supervisor" | "mentor_dpp" | "mentorado")[],
  args: Record<string, unknown> = {}
) =>
  executarTool(
    "plano_propor",
    { dupla_id: DUPLA_ID, confirmacao_id: "cid-1", ...args },
    supabase,
    "chat",
    papeis
  );

type DecisaoEscopo = {
  cicloEventoId: string;
  usa: boolean;
  origem?: string;
};

const escopoDaChamada = (chamada?: { args?: Record<string, unknown> }) => {
  const escopo = chamada?.args?.p_escopo as
    | { decisoes?: { recessos?: DecisaoEscopo[] } }
    | undefined;
  return escopo?.decisoes?.recessos ?? [];
};

const metaDoEvento = (chamada?: { args?: Record<string, unknown> }) => {
  const eventos = chamada?.args?.p_eventos as
    | { meta?: Record<string, unknown> }[]
    | undefined;
  return eventos?.[0]?.meta ?? {};
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(dt(HOJE));
  limparCacheIaConfig();
  limparCacheGuias();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("plano_propor — suposição de recesso da equipe (0245)", () => {
  it("coordenação propõe com recesso pendente sem declarar nada: a suposição de pausa viaja no escopo", async () => {
    const dupla = duplaAtrasada();
    seed(dupla);
    const { supabase, chamadas } = sessaoFake({
      tabelas: { duplas: [dupla] },
      rpcData: RPC_STAFF,
    });
    const r = await propor(supabase, ["coordenacao"]);
    expect(r.ok).toBe(true);
    // staff nunca declara recesso — "propor não é decidir pela dupla"
    expect(chamadas("declarar_recesso")).toHaveLength(0);
    expect(escopoDaChamada(chamadas("plano_propor")[0])).toEqual([
      { cicloEventoId: EV_RECESSO, usa: true, origem: "proposta" },
    ]);
    expect(
      metaDoEvento(chamadas("registrar_produto_eventos")[0]).recesso_assumido
    ).toBe(true);
  });

  it("a suposição 'seguir no recesso' da equipe viaja como proposta e destrava as datas", async () => {
    const dupla = duplaAtrasada();
    seed(dupla);
    const { supabase, chamadas } = sessaoFake({
      tabelas: { duplas: [dupla] },
      rpcData: RPC_STAFF,
    });
    const r = await propor(supabase, ["coordenacao"], {
      decisoes_recesso: [{ ciclo_evento_id: EV_RECESSO, usa: false }],
    });
    expect(r.ok).toBe(true);
    expect(chamadas("declarar_recesso")).toHaveLength(0);
    expect(escopoDaChamada(chamadas("plano_propor")[0])).toEqual([
      { cicloEventoId: EV_RECESSO, usa: false, origem: "proposta" },
    ]);
    expect(
      metaDoEvento(chamadas("registrar_produto_eventos")[0]).recesso_assumido
    ).toBe(true);
  });

  it("a equipe não troca a resposta que a dupla já deu — a divergência é recusada", async () => {
    const dupla = duplaAtrasada([recessoDecidido(true)]);
    seed(dupla);
    const { supabase, chamadas } = sessaoFake({
      tabelas: { duplas: [dupla] },
      rpcData: RPC_STAFF,
    });
    const r = await propor(supabase, ["coordenacao"], {
      decisoes_recesso: [{ ciclo_evento_id: EV_RECESSO, usa: false }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.erro).toBe(
        "A dupla já decidiu esse recesso. Só ela pode trocar a resposta."
      );
    expect(chamadas("declarar_recesso")).toHaveLength(0);
    expect(chamadas("plano_propor")).toHaveLength(0);
  });

  it("entrada que repete a resposta vigente viaja como dupla — sem suposição no evento", async () => {
    const dupla = duplaAtrasada([recessoDecidido(true)]);
    seed(dupla);
    const { supabase, chamadas } = sessaoFake({
      tabelas: { duplas: [dupla] },
      rpcData: RPC_STAFF,
    });
    const r = await propor(supabase, ["coordenacao"], {
      decisoes_recesso: [{ ciclo_evento_id: EV_RECESSO, usa: true }],
    });
    expect(r.ok).toBe(true);
    expect(escopoDaChamada(chamadas("plano_propor")[0])).toEqual([
      { cicloEventoId: EV_RECESSO, usa: true, origem: "dupla" },
    ]);
    expect(
      metaDoEvento(chamadas("registrar_produto_eventos")[0]).recesso_assumido
    ).toBe(false);
  });

  it("mentor sem a decisão da dupla segue bloqueado — a pendência é dela", async () => {
    const dupla = duplaAtrasada();
    seed(dupla);
    const { supabase, chamadas } = sessaoFake({
      tabelas: { duplas: [dupla] },
      rpcData: RPC_MENTOR,
    });
    const r = await propor(supabase, ["mentor_dpp"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toBe("Falta a dupla confirmar o recesso.");
    expect(chamadas("plano_propor")).toHaveLength(0);
    expect(chamadas("declarar_recesso")).toHaveLength(0);
  });

  it("mentor declara a decisão junto — só o que mudou viaja, com origem dupla", async () => {
    const dupla = duplaAtrasada();
    seed(dupla);
    const { supabase, chamadas } = sessaoFake({
      tabelas: { duplas: [dupla] },
      rpcData: RPC_MENTOR,
    });
    const r = await propor(supabase, ["mentor_dpp"], {
      decisoes_recesso: [{ ciclo_evento_id: EV_RECESSO, usa: false }],
    });
    expect(r.ok).toBe(true);
    expect(chamadas("declarar_recesso")).toEqual([
      {
        nome: "declarar_recesso",
        args: { p_dupla: DUPLA_ID, p_evento: EV_RECESSO, p_usa: false },
      },
    ]);
    expect(escopoDaChamada(chamadas("plano_propor")[0])).toEqual([
      { cicloEventoId: EV_RECESSO, usa: false, origem: "dupla" },
    ]);
    expect(
      metaDoEvento(chamadas("registrar_produto_eventos")[0]).recesso_assumido
    ).toBe(false);
  });

  it("jovem sem a decisão também bloqueia — o bloqueio é dos dois lados", async () => {
    const dupla = duplaAtrasada();
    seed(dupla);
    const { supabase } = sessaoFake({
      tabelas: { duplas: [dupla] },
      rpcData: RPC_JOVEM,
    });
    const r = await propor(supabase, ["mentorado"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toBe("Falta a dupla confirmar o recesso.");
  });
});

describe("plano_em_dia — lado de quem perguntou (0245)", () => {
  it("devolve staff pra equipe e mentor pra dupla — a guarda lê pra falar certo", async () => {
    const dupla = duplaAtrasada();
    seed(dupla);
    const staff = sessaoFake({
      tabelas: { duplas: [dupla] },
      rpcData: RPC_STAFF,
    });
    const rStaff = await executarTool(
      "plano_em_dia",
      { dupla_id: DUPLA_ID },
      staff.supabase,
      "chat",
      ["coordenacao"]
    );
    expect(rStaff.ok).toBe(true);
    if (rStaff.ok)
      expect((rStaff.dados as { lado?: string }).lado).toBe("staff");

    const mentor = sessaoFake({
      tabelas: { duplas: [dupla] },
      rpcData: RPC_MENTOR,
    });
    const rMentor = await executarTool(
      "plano_em_dia",
      { dupla_id: DUPLA_ID },
      mentor.supabase,
      "chat",
      ["mentor_dpp"]
    );
    expect(rMentor.ok).toBe(true);
    if (rMentor.ok)
      expect((rMentor.dados as { lado?: string }).lado).toBe("mentor");
  });
});
