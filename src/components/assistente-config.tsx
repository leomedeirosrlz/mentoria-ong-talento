"use client";

// Aba de ajustes do assistente (REALIZA-328) — só coordenação a vê (o
// botão que a abre já é coord-gated na bolha) e a RLS de ia_config fecha
// a escrita no servidor: aqui é só a superfície. Modelos por tier, nível
// de esforço e o interruptor do roteador — tudo salva ao tocar (upsert
// por chave), porque "quota acabou" é cenário de troca em segundos, não
// de formulário com salvar no fim.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleNotch,
  Copy,
  Key,
  Trash,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Tier = "rapido" | "balanceado" | "forte";
type Esforco = "baixo" | "medio" | "alto";

type Config = {
  modelos: Partial<Record<Tier, string>>;
  /** esforço por tier — no banco a chave `esforco` aceita objeto por
   *  tier ou string legada (mesmo nível pros três); a UI sempre grava
   *  o mapa completo */
  esforco: Record<Tier, Esforco>;
  roteamento: boolean;
};

const TIERS: { chave: Tier; rotulo: string; dica: string }[] = [
  {
    chave: "rapido",
    rotulo: "Rápido",
    dica: "saudações e conversa curta — menor latência",
  },
  {
    chave: "balanceado",
    rotulo: "Balanceado",
    dica: "o padrão — dados de duplas, agenda, guias",
  },
  {
    chave: "forte",
    rotulo: "Forte",
    dica: "análises e sínteses longas — mais lento, mais capaz",
  },
];

const ESFORCOS: { chave: Esforco; rotulo: string }[] = [
  { chave: "baixo", rotulo: "Baixo" },
  { chave: "medio", rotulo: "Médio" },
  { chave: "alto", rotulo: "Alto" },
];

type TokenMcp = {
  id: string;
  rotulo: string;
  created_at: string;
  ultimo_uso_em: string | null;
};

/** rlz_mcp_ + 24 bytes — o token sai daqui UMA vez; no banco fica só o
 *  sha256 (mesma regra dos hashes de segurança do banco). */
async function gerarToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const cru = `rlz_mcp_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(cru)
  );
  const hash = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { cru, hash };
}

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

export function AssistenteConfig({ onVoltar }: { onVoltar: () => void }) {
  const supabase = createClient();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [catalogo, setCatalogo] = useState<string[]>([]);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tokens, setTokens] = useState<TokenMcp[] | null>(null);
  const [tokenNovo, setTokenNovo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [gerando, setGerando] = useState(false);
  const salvoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [{ data }, res, { data: tks }] = await Promise.all([
        supabase.from("ia_config").select("chave, valor"),
        fetch("/api/ia/modelos").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        supabase
          .from("ia_mcp_tokens")
          .select("id, rotulo, created_at, ultimo_uso_em")
          .is("revogado_em", null)
          .order("created_at", { ascending: false }),
      ]);
      if (!vivo) return;
      const modelos: Config["modelos"] = {};
      const esforco: Config["esforco"] = {
        rapido: "medio",
        balanceado: "medio",
        forte: "medio",
      };
      let roteamento = true;
      for (const row of data ?? []) {
        if (row.chave === "modelos" && row.valor && typeof row.valor === "object") {
          const m = row.valor as Record<string, unknown>;
          for (const t of TIERS)
            if (typeof m[t.chave] === "string") modelos[t.chave] = m[t.chave] as string;
        }
        if (row.chave === "esforco") {
          if (typeof row.valor === "string") {
            if (ESFORCOS.some((e) => e.chave === row.valor))
              for (const t of TIERS) esforco[t.chave] = row.valor as Esforco;
          } else if (row.valor && typeof row.valor === "object") {
            const e = row.valor as Record<string, unknown>;
            for (const t of TIERS)
              if (ESFORCOS.some((x) => x.chave === e[t.chave]))
                esforco[t.chave] = e[t.chave] as Esforco;
          }
        }
        if (row.chave === "roteamento" && typeof row.valor === "boolean")
          roteamento = row.valor;
      }
      setCfg({ modelos, esforco, roteamento });
      setCatalogo(
        Array.isArray(res?.modelos) ? (res.modelos as string[]) : []
      );
      setTokens((tks ?? []) as TokenMcp[]);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase]);

  const gerarNovoToken = async () => {
    setGerando(true);
    setErro(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", u.user?.id ?? "")
        .maybeSingle();
      if (!prof) throw new Error("sem perfil");
      const { cru, hash } = await gerarToken();
      const rotulo = `Token ${dataCurta(new Date().toISOString())}`;
      const { data: row, error } = await supabase
        .from("ia_mcp_tokens")
        .insert({ profile_id: prof.id, token_hash: hash, rotulo })
        .select("id, rotulo, created_at, ultimo_uso_em")
        .single();
      if (error) throw error;
      setTokenNovo(cru);
      setCopiado(false);
      setTokens((t) => [row as TokenMcp, ...(t ?? [])]);
    } catch {
      setErro("Não consegui gerar o token — tente de novo.");
    } finally {
      setGerando(false);
    }
  };

  const revogarToken = async (id: string) => {
    const { error } = await supabase
      .from("ia_mcp_tokens")
      .update({ revogado_em: new Date().toISOString() })
      .eq("id", id);
    if (!error) setTokens((t) => (t ?? []).filter((x) => x.id !== id));
  };

  const copiarToken = async () => {
    if (!tokenNovo) return;
    try {
      await navigator.clipboard.writeText(tokenNovo);
      setCopiado(true);
    } catch {
      // clipboard bloqueado: o token continua selecionável na caixa
    }
  };

  const flash = useCallback((campo: string) => {
    setSalvo(campo);
    if (salvoTimer.current) clearTimeout(salvoTimer.current);
    salvoTimer.current = setTimeout(() => setSalvo(null), 1600);
  }, []);

  const gravar = useCallback(
    async (campo: string, chave: string, valor: unknown) => {
      setErro(null);
      setSalvando(campo);
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("ia_config").upsert({
        chave,
        valor: valor as Record<string, unknown>,
        atualizado_em: new Date().toISOString(),
        atualizado_por: u.user?.id ?? null,
      });
      setSalvando(null);
      if (error) {
        setErro("Não consegui salvar — tente de novo.");
        return;
      }
      flash(campo);
    },
    [supabase, flash]
  );

  const mudarModelo = (tier: Tier, slug: string) => {
    if (!cfg) return;
    const modelos = { ...cfg.modelos, [tier]: slug };
    setCfg({ ...cfg, modelos });
    void gravar(`modelo:${tier}`, "modelos", modelos);
  };
  const mudarEsforco = (tier: Tier, e: Esforco) => {
    if (!cfg) return;
    const esforco = { ...cfg.esforco, [tier]: e };
    setCfg({ ...cfg, esforco });
    void gravar(`esforco:${tier}`, "esforco", esforco);
  };
  const mudarRoteamento = (v: boolean) => {
    if (!cfg) return;
    setCfg({ ...cfg, roteamento: v });
    void gravar("roteamento", "roteamento", v);
  };

  // função de render, não componente: o lint proíbe componente criado
  // dentro do render (remontaria a cada re-render)
  const marcaDeSalvo = (campo: string) =>
    salvando === campo ? (
      <CircleNotch size={14} aria-hidden className="animate-spin text-muted-foreground" />
    ) : salvo === campo ? (
      <Check size={14} aria-hidden className="text-[var(--ok-text)]" />
    ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-border px-2 py-2">
        <Button variant="ghost" size="icon" aria-label="Voltar" onClick={onVoltar}>
          <ArrowLeft aria-hidden />
        </Button>
        <p className="text-sm font-semibold">Ajustes do assistente</p>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {erro && <p className="text-sm text-[var(--danger-text)]">{erro}</p>}
        {!cfg ? (
          <div className="grid place-items-center py-10">
            <CircleNotch size={20} aria-hidden className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Modelo por tier
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  O roteador escolhe o tier por pergunta; tier vazio usa o
                  modelo padrão do ambiente.
                </p>
              </div>
              {TIERS.map((t) => {
                const opcoes = [
                  ...new Set(
                    [cfg.modelos[t.chave], ...catalogo].filter(
                      (s): s is string => Boolean(s)
                    )
                  ),
                ];
                return (
                  <div key={t.chave} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{t.rotulo}</span>
                      <span className="flex items-center gap-1.5">
                        {marcaDeSalvo(`modelo:${t.chave}`)}
                        {marcaDeSalvo(`esforco:${t.chave}`)}
                      </span>
                    </div>
                    <Select
                      value={cfg.modelos[t.chave] ?? ""}
                      onValueChange={(v) => mudarModelo(t.chave, v as string)}
                    >
                      <SelectTrigger aria-label={`Modelo ${t.rotulo}`}>
                        <SelectValue placeholder="padrão do ambiente" />
                      </SelectTrigger>
                      <SelectContent>
                        {opcoes.map((slug) => (
                          <SelectItem key={slug} value={slug}>
                            {slug}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* esforço granular por tier — o par certo é
                        rápido+baixo, forte+alto */}
                    <div
                      className="grid grid-cols-3 gap-1 rounded-md bg-muted p-0.5"
                      role="group"
                      aria-label={`Esforço do tier ${t.rotulo}`}
                    >
                      {ESFORCOS.map((e) => (
                        <Button
                          key={e.chave}
                          variant="ghost"
                          size="sm"
                          onClick={() => mudarEsforco(t.chave, e.chave)}
                          className={cn(
                            "h-6 rounded px-1.5 text-[11px] transition-colors duration-150",
                            cfg.esforco[t.chave] === e.chave
                              ? "bg-popover font-medium shadow-sm hover:bg-popover"
                              : "text-muted-foreground hover:text-foreground hover:bg-transparent"
                          )}
                        >
                          {e.rotulo}
                        </Button>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{t.dica}</p>
                  </div>
                );
              })}
            </section>

            <section className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium">Roteamento automático</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Classifica cada pergunta num tier. Desligado, tudo cai no
                    balanceado.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {marcaDeSalvo("roteamento")}
                  <Switch
                    checked={cfg.roteamento}
                    onCheckedChange={mudarRoteamento}
                    aria-label="Roteamento automático"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-2 border-t border-border pt-4">
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  IA externa (MCP)
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Token pra conectar Claude, Cursor ou outro cliente MCP em
                  <code className="mx-0.5 rounded bg-muted px-1 font-mono text-[11px]">
                    /api/mcp
                  </code>
                  . Carrega o seu papel — quem tem acesso, revoga aqui.
                </p>
              </div>

              {tokenNovo && (
                <div className="space-y-1.5 rounded-lg border border-[var(--warn)]/40 bg-[var(--warn-bg)]/40 p-2.5">
                  <p className="text-[11px] font-medium">
                    Copie agora — o token não aparece de novo:
                  </p>
                  <div className="flex items-center gap-1.5">
                    <code className="min-w-0 flex-1 select-all truncate rounded bg-muted px-2 py-1.5 font-mono text-[11px]">
                      {tokenNovo}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Copiar token"
                      onClick={copiarToken}
                      className="shrink-0"
                    >
                      {copiado ? (
                        <Check aria-hidden className="text-[var(--ok-text)]" />
                      ) : (
                        <Copy aria-hidden />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {tokens === null ? (
                <CircleNotch size={16} aria-hidden className="animate-spin text-muted-foreground" />
              ) : (
                <ul className="space-y-1.5">
                  {tokens.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2"
                    >
                      <Key size={14} aria-hidden className="shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{t.rotulo}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {t.ultimo_uso_em
                            ? `último uso ${dataCurta(t.ultimo_uso_em)}`
                            : `criado ${dataCurta(t.created_at)}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Revogar ${t.rotulo}`}
                        onClick={() => revogarToken(t.id)}
                        className="shrink-0 text-muted-foreground hover:text-[var(--danger-text)]"
                      >
                        <Trash aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={gerarNovoToken}
                disabled={gerando}
                className="w-full"
              >
                {gerando ? (
                  <CircleNotch size={14} aria-hidden className="animate-spin" />
                ) : (
                  <Key size={14} aria-hidden />
                )}
                Gerar novo token
              </Button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
