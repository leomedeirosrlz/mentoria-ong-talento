"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"link" | "senha">("link");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  async function enviarLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/confirm` },
    });
    setLoading(false);
    if (error) setErro(error.message);
    else setEnviado(true);
  }

  async function entrarComSenha(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setLoading(false);
    if (error) setErro("E-mail ou senha incorretos.");
    else router.push("/");
  }

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="font-bold italic text-2xl tracking-tight text-foreground">
            REALIZA<span className="text-[oklch(0.62_0.13_140)]">.VC</span>
          </p>
          <p className="text-sm text-muted-foreground mt-1">Programa de Mentoria Social</p>
        </div>

        {enviado ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="font-medium">Link enviado</p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Se este e-mail estiver cadastrado, voce recebeu um link de acesso.
              Confira a caixa de entrada e o spam.
            </p>
          </div>
        ) : (
          <form
            onSubmit={modo === "link" ? enviarLink : entrarComSenha}
            className="rounded-xl border border-border bg-card p-6 space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                O e-mail precisa ter sido cadastrado pela coordenacao.
              </p>
            </div>

            {modo === "senha" && (
              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>
            )}

            {(erro || params.get("erro")) && (
              <p className="text-sm text-destructive">
                {erro ?? "Link invalido ou expirado. Tente novamente."}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Enviando..." : modo === "link" ? "Receber link de acesso" : "Entrar"}
            </Button>

            <button
              type="button"
              onClick={() => setModo(modo === "link" ? "senha" : "link")}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {modo === "link" ? "Entrar com senha (ambiente de teste)" : "Voltar ao link por e-mail"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
