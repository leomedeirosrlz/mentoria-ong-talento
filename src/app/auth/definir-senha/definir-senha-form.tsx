"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { avisarSenhaAlterada } from "@/lib/actions-conta";
import { pathInterno, sessaoFresca } from "@/lib/utils";
import { fade, T } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

export function DefinirSenhaForm() {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // recovery = veio do link "esqueci a senha" (#type=recovery): muda o
  // título e some o "pular" — quem pediu reset quer a senha, não onboarding
  const [recovery, setRecovery] = useState(false);
  const [fase, setFase] = useState<"carregando" | "ok" | "expirada">("carregando");
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const next = params.get("next");
  const destino = pathInterno(next) ?? "/";

  // /auth/* é rota pública pro middleware — a página só faz sentido com a
  // sessão que o link acabou de criar. Dois caminhos chegam aqui: o magic
  // link (sessão já depositada pelo handoff) e o recovery do "esqueci a
  // senha" (link implícito traz #access_token no hash — consome antes de
  // medir frescor; o iat do token mintado no clique passa no gate). Sem
  // sessão, volta pro login; sessão velha demais não vira credencial nova.
  useEffect(() => {
    async function entrar() {
      const hash = window.location.hash;
      if (hash.length > 1) {
        const p = new URLSearchParams(hash.slice(1));
        const accessToken = p.get("access_token");
        const refreshToken = p.get("refresh_token");
        const linkQueimado = p.get("error") ?? p.get("error_code");
        setRecovery(p.get("type") === "recovery");
        // tira os tokens da barra de endereço em qualquer desfecho
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
        if (linkQueimado) {
          setFase("expirada");
          return;
        }
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            setFase("expirada");
            return;
          }
        }
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.replace("/login");
      else setFase(sessaoFresca(data.session) ? "ok" : "expirada");
    }
    void entrar();
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
            ? "Senha fraca: combine letras e números."
            : "Não foi possível salvar a senha. Tente de novo."
        );
      } else {
        // aviso "senha alterada" pro e-mail da conta — await porque o push
        // abortaria um POST solto; a action nunca lança
        await avisarSenhaAlterada();
        router.push(destino);
      }
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  // pular: marca pra não cobrar de novo — a senha continua definível no
  // perfil. No recovery o botão não existe (quem pediu reset não pula)
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
            {recovery ? "Redefina sua senha" : "Crie sua senha"}
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
              <p className="mt-4 font-medium">
                {recovery ? "Link expirado" : "Peça um novo link"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {recovery
                  ? "O link de redefinição expira e só vale uma vez. Peça um novo em Perfil → Senha → Esqueci minha senha."
                  : "Por segurança, peça um novo link de acesso e defina a senha logo em seguida."}
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
                <Label htmlFor="senha">
                  {recovery ? "Nova senha" : "Senha"}
                </Label>
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
                  Mínimo 8 caracteres · o link por e-mail continua valendo.
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
              {!recovery && (
                <button
                  type="button"
                  onClick={() => void pular()}
                  className="w-full min-h-11 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Prefiro entrar só pelo link
                </button>
              )}
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
