"use client";

// Self-service MCP server PAT issuance (REALIZA-295) — the block that
// started inline in the assistant bubble settings tab. Mounts on 3
// surfaces with the same mechanics: coord in the bubble (auto label, no
// field), staff on /perfil and the mentee on /jovem/perfil (label field +
// their own copy). Always self-service: the insert goes straight under the
// ia_mcp_tokens_dono RLS — profile_id is the session owner's, there is no
// path to mint for someone else (a "lent" token would execute under the
// wrong role anyway). The plaintext token appears once in the creation
// card; the table stores only its sha256 (same rule as security hashes).

import {
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Check,
  CircleNotch,
  ClipboardText,
  Copy,
  Key,
  Trash,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { demoAtivoClient } from "@/lib/demo/shared";
import { promptMcp } from "@/lib/ia/mcp-prompt";
import {
  gerarTokenMcp,
  metaTokenMcp,
  rotuloDoToken,
  rotuloPadraoMcp,
  type TokenMcp,
} from "@/lib/ia/mcp-token";
import { cn } from "@/lib/utils";

// browser snapshots never change during the mounted life — the
// subscription is a no-op and React reads the client value once
const semAssinatura = () => () => {};

/** Copy that varies per surface — the core (endpoint, prompt, one-time
 *  display, list, revocation) is identical for everyone. */
export type TokensMcpTextos = {
  /** create button — "Gerar novo token" in the bubble, "Gerar token" on
   *  the profile pages */
  gerar: string;
  /** credential label field: on the profile pages the owner names it
   *  ("ex.: Claude desktop"); absent in the bubble, which auto-labels
   *  "Token dd/mm/yy" */
  campoRotulo?: { label: string; placeholder: string };
};

export function TokensMcp({
  textos,
  rotuloPadrao = rotuloPadraoMcp,
  className,
}: {
  textos: TokensMcpTextos;
  /** label applied when the surface has no field or it stayed empty */
  rotuloPadrao?: () => string;
  className?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const idRotulo = useId();
  const [tokens, setTokens] = useState<TokenMcp[] | null>(null);
  const [tokenNovo, setTokenNovo] = useState<string | null>(null);
  const [rotulo, setRotulo] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [copiadoUrl, setCopiadoUrl] = useState(false);
  const [copiadoPrompt, setCopiadoPrompt] = useState<"token" | "base" | null>(
    null
  );
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // browser-only values via useSyncExternalStore: SSR/hydration read the
  // server snapshot (no mismatch), the client snapshot fills in on mount
  // without a setState in the effect body
  const origem = useSyncExternalStore(
    semAssinatura,
    () => window.location.origin,
    () => ""
  );
  // no real session means the table is unreachable — pages hide the
  // section server-side; this guards a mount without that gate
  const demo = useSyncExternalStore(semAssinatura, demoAtivoClient, () => false);

  useEffect(() => {
    if (demo) return;
    let vivo = true;
    void supabase
      .from("ia_mcp_tokens")
      .select("id, rotulo, created_at, ultimo_uso_em, expira_em")
      .is("revogado_em", null)
      .order("created_at", { ascending: false })
      .then(({ data: tks }) => {
        if (vivo) setTokens((tks ?? []) as TokenMcp[]);
      });
    return () => {
      vivo = false;
    };
  }, [supabase, demo]);

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
      const { cru, hash } = await gerarTokenMcp();
      const { data: row, error } = await supabase
        .from("ia_mcp_tokens")
        .insert({
          profile_id: prof.id,
          token_hash: hash,
          rotulo: rotuloDoToken(rotulo, rotuloPadrao()),
        })
        .select("id, rotulo, created_at, ultimo_uso_em, expira_em")
        .single();
      if (error) throw error;
      setTokenNovo(cru);
      setRotulo("");
      setCopiado(false);
      setTokens((t) => [row as TokenMcp, ...(t ?? [])]);
    } catch {
      setErro("Não consegui gerar o token. Tente de novo.");
    } finally {
      setGerando(false);
    }
  };

  const revogarToken = async (id: string) => {
    const { error } = await supabase
      .from("ia_mcp_tokens")
      .update({ revogado_em: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setErro("Não consegui revogar o token. Tente de novo.");
      return;
    }
    setTokens((t) => (t ?? []).filter((x) => x.id !== id));
  };

  const copiarToken = async () => {
    if (!tokenNovo) return;
    try {
      await navigator.clipboard.writeText(tokenNovo);
      setCopiado(true);
    } catch {
      // clipboard blocked: the token stays selectable in the card
    }
  };

  const copiarUrl = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/api/mcp`);
      setCopiadoUrl(true);
      setTimeout(() => setCopiadoUrl(false), 1600);
    } catch {
      // clipboard blocked: the URL stays selectable in the chip
    }
  };

  const copiarPrompt = async (qual: "token" | "base") => {
    try {
      await navigator.clipboard.writeText(
        promptMcp(window.location.origin, qual === "token" ? tokenNovo : null)
      );
      setCopiadoPrompt(qual);
      setTimeout(() => setCopiadoPrompt((c) => (c === qual ? null : c)), 1600);
    } catch {
      // clipboard blocked: the card's token still has its own copy button
    }
  };

  if (demo) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {erro && <p className="text-sm text-[var(--danger-text)]">{erro}</p>}

      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-2">
        <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
          POST {origem}/api/mcp
        </code>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Copiar endpoint"
          onClick={copiarUrl}
          className="shrink-0"
        >
          {copiadoUrl ? (
            <Check aria-hidden className="text-[var(--ok-text)]" />
          ) : (
            <Copy aria-hidden />
          )}
        </Button>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => copiarPrompt("base")}
        className="w-full"
      >
        {copiadoPrompt === "base" ? (
          <Check aria-hidden className="text-[var(--ok-text)]" />
        ) : (
          <ClipboardText aria-hidden />
        )}
        Copiar prompt de conexão
      </Button>

      {tokenNovo && (
        <div className="space-y-1.5 rounded-lg border border-[var(--warn)]/40 bg-[var(--warn-bg)]/40 p-2.5">
          <p className="text-[11px] font-medium">
            Copie agora, o token não aparece de novo:
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => copiarPrompt("token")}
            className="w-full"
          >
            {copiadoPrompt === "token" ? (
              <Check aria-hidden className="text-[var(--ok-text)]" />
            ) : (
              <ClipboardText aria-hidden />
            )}
            Copiar prompt com contexto + token
          </Button>
        </div>
      )}

      {tokens === null ? (
        <div
          className="space-y-1.5"
          aria-busy="true"
          aria-label="Carregando tokens"
        >
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
              <Key
                size={14}
                aria-hidden
                className="shrink-0 text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.rotulo}</p>
                <p className="text-[11px] text-muted-foreground">
                  {metaTokenMcp(t)}
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

      {textos.campoRotulo && (
        <div className="space-y-2">
          <Label htmlFor={idRotulo}>{textos.campoRotulo.label}</Label>
          <Input
            id={idRotulo}
            value={rotulo}
            onChange={(e) => setRotulo(e.target.value)}
            placeholder={textos.campoRotulo.placeholder}
            maxLength={80}
            autoComplete="off"
          />
        </div>
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
        {textos.gerar}
      </Button>
    </div>
  );
}
