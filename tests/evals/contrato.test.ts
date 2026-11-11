// Eval de CONTRATO da Liza (pacote liza nov/2026 — sdd D6): casos
// declarativos em casos.json executados contra o código real —
// roteador puro (tier), gate de papel com papéis forçados (sem banco),
// e o prompt montado por papel. Determinístico, CI-safe, sem rede.
// O modo live (HTTP) é irmão deste arquivo: scripts/eval-ia.mjs --live.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rotearTier, type TarefaIa } from "@/lib/ia/roteador";
import { executarTool, IA_TOOLS } from "@/lib/ia/tools";
import { systemPromptIa } from "@/lib/ia/prompts";
import type { AppRole } from "@/lib/types";

type CasoTier = {
  id: string;
  msg: string;
  opts?: {
    posTool?: boolean;
    papel?: AppRole | AppRole[] | null;
    tarefa?: TarefaIa;
  };
  espera: string;
};
type CasoGate = {
  id: string;
  papeis: string[];
  tool: string;
  args?: Record<string, unknown>;
  espera: "permitida" | "negada";
};
type CasoPrompt = {
  id: string;
  papeis: string[];
  contem: string[];
  nao_contem: string[];
};

const casos = JSON.parse(
  readFileSync(join(__dirname, "casos.json"), "utf8")
) as {
  contrato: { tier: CasoTier[]; gate: CasoGate[]; prompt: CasoPrompt[] };
};

// supabase mínimo pro caminho de negação: o gate sai ANTES de ler, então
// qualquer from() conta como bug — e a auditoria precisa existir (rpc
// lazy: retorna thenable pra executarTool dar await sem quebrar)
function supaNulo() {
  const fromCalls: string[] = [];
  const supabase = {
    from: (t: string) => {
      fromCalls.push(t);
      return { select: () => ({ eq: () => ({ data: [], error: null }) }) };
    },
    rpc: () => ({
      data: null,
      error: null,
      then(res: (v: unknown) => unknown) {
        return Promise.resolve(res({ data: null, error: null }));
      },
    }),
  };
  return { supabase: supabase as unknown as SupabaseClient, fromCalls };
}

describe("eval contrato — roteador → tier", () => {
  for (const c of casos.contrato.tier) {
    it(c.id, () => {
      expect(rotearTier(c.msg, c.opts), c.msg).toBe(c.espera);
    });
  }
});

describe("eval contrato — gate de papel", () => {
  for (const c of casos.contrato.gate) {
    it(c.id, async () => {
      const tool = IA_TOOLS[c.tool as keyof typeof IA_TOOLS];
      expect(tool, `tool ${c.tool} existe`).toBeTruthy();
      const papeis = c.papeis as AppRole[];
      // o mesmo predicado do executarTool: algum papel efetivo na allowlist
      const permitida = (tool.roles as readonly string[]).some((r) =>
        papeis.includes(r as AppRole)
      );
      expect(permitida).toBe(c.espera === "permitida");
      if (c.espera === "negada") {
        // negação real: executarTool sai sem tocar no banco
        const { supabase, fromCalls } = supaNulo();
        const r = await executarTool(
          c.tool,
          c.args ?? {},
          supabase,
          "chat",
          papeis
        );
        expect(r.ok).toBe(false);
        expect(fromCalls).toHaveLength(0);
      }
    });
  }
});

describe("eval contrato — prompt por papel", () => {
  for (const c of casos.contrato.prompt) {
    it(c.id, () => {
      const p = systemPromptIa(c.papeis as AppRole[]);
      for (const t of c.contem) expect(p, `faltou: ${t}`).toContain(t);
      for (const t of c.nao_contem) expect(p, `vazou: ${t}`).not.toContain(t);
    });
  }
});
