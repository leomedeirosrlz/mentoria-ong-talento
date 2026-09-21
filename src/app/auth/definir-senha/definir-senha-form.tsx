"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleNotch } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { pathInterno } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DefinirSenhaForm() {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pronto, setPronto] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const next = params.get("next");
  const destino = pathInterno(next) ?? "/";

  // /auth/* é rota pública pro middleware — a página só faz sentido com a
  // sessão que o /auth/confirm acabou de criar; sem ela, volta pro login
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else setPronto(true);
    });
  }, [supabase, router]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) {
      setErro("Use pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      setErro("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    setErro(null);
    try {
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

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-realiza.png" alt="Realiza.vc" className="h-8 w-auto" />
          <h1 className="text-lg font-semibold tracking-tight mt-3">
            Bem-vindo — crie sua senha
          </h1>
        </div>

        {pronto ? (
          <form
            onSubmit={salvar}
            className="rounded-xl bg-card shadow-[var(--shadow-border)] p-6 space-y-4"
          >
            <p className="text-sm text-muted-foreground leading-relaxed">
              E-mail confirmado. Defina uma senha para entrar mais rápido nas
              próximas vezes — o link por e-mail continua funcionando.
            </p>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                required
                minLength={8}
                autoFocus
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmacao">Confirmar senha</Label>
              <Input
                id="confirmacao"
                type="password"
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
          </form>
        ) : (
          <div className="rounded-xl bg-card shadow-[var(--shadow-border)] p-6">
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleNotch size={14} className="animate-spin shrink-0" aria-hidden="true" />
              Confirmando acesso…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
