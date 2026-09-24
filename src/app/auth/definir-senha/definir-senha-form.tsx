"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type Session } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "motion/react";
import { CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { pathInterno } from "@/lib/utils";
import { fade, T } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

// credencial só se define com autenticação recente — o fluxo legítimo chega
// aqui segundos depois do magic link; uma sessão velha (esquecida aberta ou
// roubada) não pode virar senha persistente
const SESSAO_FRESCA_MS = 15 * 60 * 1000;

function sessaoFresca(session: Session | null): boolean {
  if (!session) return false;
  const login = Date.parse(session.user.last_sign_in_at ?? "");
  if (!Number.isNaN(login)) return Date.now() - login < SESSAO_FRESCA_MS;
  // fallback: iat do próprio access_token
  try {
    const payload = JSON.parse(
      atob(session.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return typeof payload.iat === "number" && Date.now() - payload.iat * 1000 < SESSAO_FRESCA_MS;
  } catch {
    return false;
  }
}

export function DefinirSenhaForm() {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fase, setFase] = useState<"carregando" | "ok" | "expirada">("carregando");
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const next = params.get("next");
  const destino = pathInterno(next) ?? "/";

  // /auth/* é rota pública pro middleware — a página só faz sentido com a
  // sessão que o link acabou de criar; sem ela, volta pro login. Sessão
  // antiga demais também não vale: credencial exige reautenticação recente
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else setFase(sessaoFresca(data.session) ? "ok" : "expirada");
    });
  }, [supabase, router]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha !== confirmacao) {
      setErro("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      // a sessão pode ter envelhecido com o form aberto — revalida antes de
      // gravar a credencial
      const { data } = await supabase.auth.getSession();
      if (!sessaoFresca(data.session)) {
        setFase("expirada");
        return;
      }
      const { error } = await supabase.auth.updateUser({
        password: senha,
        data: { senha_em: new Date().toISOString() },
      });
      if (error) {
        setErro(
          error.code === "weak_password"
            ? "Senha fraca — combine letras e números."
            : "Não foi possível salvar a senha. Tente de novo."
        );
      } else {
        router.push(destino);
      }
    } catch {
      setErro("Sem conexão — tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  // pular: marca pra não cobrar de novo — a senha continua definível no perfil
  async function pular() {
    try {
      await supabase.auth.updateUser({ data: { senha_dispensada: true } });
    } catch {
      // marca falhou — entra mesmo assim; o pior caso é a tela voltar
    }
    router.push(destino);
  }

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-realiza.png" alt="Realiza.vc" className="h-8 w-auto" />
          <h1 className="text-lg font-semibold tracking-tight mt-3">
            Crie sua senha
          </h1>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {fase === "expirada" ? (
            <motion.div
              key="expirada"
              {...fade}
              transition={T.enter}
              className="rounded-xl bg-card shadow-[var(--shadow-border)] p-6"
            >
              <div className="grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive">
                <WarningCircle size={20} weight="bold" aria-hidden="true" />
              </div>
              <p className="mt-4 font-medium">Peça um novo link</p>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Por segurança, peça um novo link de acesso e defina a senha
                logo em seguida.
              </p>
              <Button
                type="button"
                className="mt-5 w-full"
                onClick={() => router.push("/login")}
              >
                Ir para o login
              </Button>
            </motion.div>
          ) : fase === "ok" ? (
            <motion.form
              key="form"
              onSubmit={salvar}
              {...fade}
              transition={T.enter}
              className="rounded-xl bg-card shadow-[var(--shadow-border)] p-6 space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <PasswordInput
                  id="senha"
                  required
                  minLength={8}
                  autoFocus
                  autoComplete="new-password"
                  aria-describedby="senha-hint"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <p id="senha-hint" className="text-xs text-muted-foreground">
                  Mínimo 8 caracteres — o link por e-mail continua valendo.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmacao">Confirmar senha</Label>
                <PasswordInput
                  id="confirmacao"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                />
              </div>

              {erro && (
                <p role="alert" className="text-sm text-destructive">
                  {erro}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando…" : "Salvar senha e entrar"}
              </Button>
              <button
                type="button"
                onClick={() => void pular()}
                className="w-full min-h-11 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Prefiro entrar só pelo link
              </button>
            </motion.form>
          ) : (
            <motion.div
              key="loading"
              {...fade}
              transition={T.enter}
              className="rounded-xl bg-card shadow-[var(--shadow-border)] p-6"
            >
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <CircleNotch size={14} className="animate-spin shrink-0" aria-hidden="true" />
                Confirmando acesso…
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
