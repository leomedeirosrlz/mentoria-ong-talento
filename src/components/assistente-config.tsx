"use client";

// Aba de ajustes do assistente (REALIZA-328) — só coordenação a vê (o
// botão que a abre já é coord-gated na bolha) e a RLS de ia_config fecha
// a escrita no servidor: aqui é só a superfície. Modelos por tier, nível
// de esforço e o interruptor do roteador — tudo salva ao tocar (upsert
// por chave), porque "quota acabou" é cenário de troca em segundos, não
// de formulário com salvar no fim.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CircleNotch,
  Copy,
  Key,
  Trash,
  X,
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
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Tier = "rapido" | "balanceado" | "forte";
type Esforco = "baixo" | "medio" | "alto";

type Config = {
  modelos: Partial<Record<Tier, string>>;
  /** cadeia ordenada por tier — [0] é a 1ª tentativa após o primário;
   *  grava dentro da mesma chave `modelos` (modelos.fallbacks) */
  fallbacks: Record<Tier, string[]>;
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

type SaudeMap = Record<
  string,
  { ok: boolean; ms: number; status: number } | "medindo"
>;

/** Cache de probe por conjunto de slugs (3min, nível módulo — sobrevive
 *  a abrir/fechar a aba): reabrir a tela não refaz 8 chamadas ao
 *  provider; um slug trocado refaz só o conjunto novo. */
let probeCache: { chave: string; ate: number; saude: SaudeMap } | null = null;
const PROBE_CACHE_MS = 3 * 60_000;

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
  /** saude por slug: probe de 1 token via /api/ia/modelos — undefined =
   *  não provado (fora do cap de 8), medindo = probe em voo */
  const [saude, setSaude] = useState<
    Record<string, { ok: boolean; ms: number; status: number } | "medindo">
  >({});
  const salvoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let vivo = true;

    // 1) ia_config é o único fetch que destrava a tela — resolve sozinho
    //    e renderiza já; catálogo e tokens chegam em paralelo depois
    void (async () => {
      const { data } = await supabase.from("ia_config").select("chave, valor");
      if (!vivo) return;
      const modelos: Config["modelos"] = {};
      const fallbacks: Config["fallbacks"] = {
        rapido: [],
        balanceado: [],
        forte: [],
      };
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
          // cadeia por-tier (objeto) ou legado (array solto = pros 3)
          const f = m.fallbacks;
          const strs = (v: unknown) =>
            Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
          if (Array.isArray(f)) {
            for (const t of TIERS) fallbacks[t.chave] = strs(f);
          } else if (f && typeof f === "object") {
            const o = f as Record<string, unknown>;
            for (const t of TIERS) fallbacks[t.chave] = strs(o[t.chave]);
          }
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
      setCfg({ modelos, fallbacks, esforco, roteamento });

      // reconhecimento automático: probe dos slugs configurados — com
      // cache de 3min: reabrir a aba não refaz chamadas ao provider
      const slugs = [
        ...new Set(
          TIERS.flatMap((t) => [modelos[t.chave], ...fallbacks[t.chave]])
        ),
      ].filter((s): s is string => Boolean(s));
      const chaveProbe = slugs.join("|");
      if (probeCache?.chave === chaveProbe && probeCache.ate > Date.now()) {
        setSaude(probeCache.saude);
      } else if (slugs.length) {
        setSaude(Object.fromEntries(slugs.map((s) => [s, "medindo" as const])));
        fetch("/api/ia/modelos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slugs }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => {
            if (j?.saude && typeof j.saude === "object") {
              probeCache = {
                chave: chaveProbe,
                ate: Date.now() + PROBE_CACHE_MS,
                saude: j.saude,
              };
              if (vivo) setSaude(j.saude);
            }
          })
          .catch(() => {});
      }
    })();

    // 2) catálogo alimenta os selects — chega quando chega, os selects
    //    já mostram o valor salvo antes disso
    fetch("/api/ia/modelos")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (vivo)
          setCatalogo(Array.isArray(res?.modelos) ? (res.modelos as string[]) : []);
      })
      .catch(() => {});

    // 3) tokens MCP — seção própria, skeleton enquanto não resolve
    void supabase
      .from("ia_mcp_tokens")
      .select("id, rotulo, created_at, ultimo_uso_em")
      .is("revogado_em", null)
      .order("created_at", { ascending: false })
      .then(({ data: tks }) => {
        if (vivo) setTokens((tks ?? []) as TokenMcp[]);
      });

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

  // a chave `modelos` no banco carrega primários + cadeias juntos —
  // gravar sempre o objeto inteiro evita perder metade num upsert
  const gravarModelos = (campo: string, modelos: Config["modelos"], fallbacks: Config["fallbacks"]) =>
    gravar(campo, "modelos", { ...modelos, fallbacks });

  const mudarModelo = (tier: Tier, slug: string) => {
    if (!cfg) return;
    const modelos = { ...cfg.modelos, [tier]: slug };
    // o primário novo não pode continuar na própria cadeia
    const fallbacks = {
      ...cfg.fallbacks,
      [tier]: cfg.fallbacks[tier].filter((s) => s !== slug),
    };
    setCfg({ ...cfg, modelos, fallbacks });
    void gravarModelos(`modelo:${tier}`, modelos, fallbacks);
  };

  const mudarFallbacks = (tier: Tier, lista: string[]) => {
    if (!cfg) return;
    const limpa = [...new Set(lista)].filter(
      (s) => s && s !== cfg.modelos[tier]
    );
    const fallbacks = { ...cfg.fallbacks, [tier]: limpa };
    setCfg({ ...cfg, fallbacks });
    void gravarModelos(`fallback:${tier}`, cfg.modelos, fallbacks);
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

  /** dot de saúde do slug (probe 1-token): verde <2,5s, âmbar ≥2,5s,
   *  vermelho falhou, neutro pulsante enquanto mede / não provado */
  const pontoSaude = (slug: string | undefined) => {
    if (!slug) return null;
    const s = saude[slug];
    const [cor, rotulo, pulsa] =
      s === "medindo"
        ? ["bg-muted-foreground/40", "verificando…", true]
        : s === undefined
          ? ["bg-muted-foreground/30", "não verificado", false]
          : !s.ok
            ? ["bg-[var(--danger-text)]", `falhou (HTTP ${s.status || "rede"})`, false]
            : s.ms < 2500
              ? ["bg-[var(--ok-text)]", `ok · ${(s.ms / 1000).toFixed(1)}s`, false]
              : ["bg-[var(--warn-text)]", `lento · ${(s.ms / 1000).toFixed(1)}s`, false];
    return (
      <span
        role="img"
        aria-label={`${slug}: ${rotulo}`}
        title={`${slug}: ${rotulo}`}
        className={cn(
          "inline-block h-2 w-2 shrink-0 rounded-full",
          cor,
          pulsa && "animate-pulse"
        )}
      />
    );
  };

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
          /* skeleton no formato do painel — label+select+segmento por
             tier; o usuário lê a estrutura antes do conteúdo chegar */
          <div className="space-y-5" aria-busy="true" aria-label="Carregando ajustes">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3.5 w-56" />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-7 w-full rounded-md" />
                <Skeleton className="h-3 w-44" />
              </div>
            ))}
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-52" />
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
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
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        {t.rotulo}
                        {pontoSaude(cfg.modelos[t.chave])}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {marcaDeSalvo(`modelo:${t.chave}`)}
                        {marcaDeSalvo(`esforco:${t.chave}`)}
                        {marcaDeSalvo(`fallback:${t.chave}`)}
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
                    {/* cadeia de fallback: se o primário falha (cota,
                        janela de 5h, slug removido), tenta em ordem */}
                    <div className="space-y-1">
                      {cfg.fallbacks[t.chave].length > 0 && (
                        <ol className="space-y-0.5" aria-label={`Fallbacks do tier ${t.rotulo}`}>
                          {cfg.fallbacks[t.chave].map((slug, idx) => (
                            <li
                              key={slug}
                              className="flex items-center gap-1.5 rounded-md bg-muted/60 py-0.5 pl-2 pr-1 text-[11px]"
                            >
                              <span className="w-3.5 shrink-0 text-muted-foreground">
                                {idx + 1}.
                              </span>
                              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                                {pontoSaude(slug)}
                                <span className="truncate font-mono">{slug}</span>
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={idx === 0}
                                aria-label={`Subir ${slug}`}
                                onClick={() => {
                                  const l = [...cfg.fallbacks[t.chave]];
                                  [l[idx - 1], l[idx]] = [l[idx], l[idx - 1]];
                                  mudarFallbacks(t.chave, l);
                                }}
                                className="h-5 w-5 rounded p-0"
                              >
                                <ArrowUp size={11} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={idx === cfg.fallbacks[t.chave].length - 1}
                                aria-label={`Descer ${slug}`}
                                onClick={() => {
                                  const l = [...cfg.fallbacks[t.chave]];
                                  [l[idx], l[idx + 1]] = [l[idx + 1], l[idx]];
                                  mudarFallbacks(t.chave, l);
                                }}
                                className="h-5 w-5 rounded p-0"
                              >
                                <ArrowDown size={11} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`Remover ${slug}`}
                                onClick={() =>
                                  mudarFallbacks(
                                    t.chave,
                                    cfg.fallbacks[t.chave].filter((s) => s !== slug)
                                  )
                                }
                                className="h-5 w-5 rounded p-0 text-muted-foreground hover:text-destructive"
                              >
                                <X size={11} />
                              </Button>
                            </li>
                          ))}
                        </ol>
                      )}
                      <Select
                        value=""
                        onValueChange={(v) =>
                          mudarFallbacks(t.chave, [
                            ...cfg.fallbacks[t.chave],
                            v as string,
                          ])
                        }
                      >
                        <SelectTrigger
                          aria-label={`Adicionar fallback ${t.rotulo}`}
                          className="h-7 border-dashed text-[11px] text-muted-foreground"
                        >
                          <SelectValue placeholder="+ fallback" />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogo
                            .filter(
                              (s) =>
                                s !== cfg.modelos[t.chave] &&
                                !cfg.fallbacks[t.chave].includes(s)
                            )
                            .map((slug) => (
                              <SelectItem key={slug} value={slug}>
                                {slug}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
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
                <div className="space-y-1.5" aria-busy="true" aria-label="Carregando tokens">
                  <Skeleton className="h-9 w-full rounded-lg" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
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
