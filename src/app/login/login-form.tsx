"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { CircleNotch, EnvelopeSimple, Key } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { SiteFooter } from "@/components/site-footer";
import { fade, T } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, pathInterno } from "@/lib/utils";

// janela do resend do supabase — quando o 429 traz "after N seconds" usa o N real
const COOLDOWN = 60;

function mensagemErro(error: { message: string; code?: string }, modo: "link" | "senha"): string {
  const texto = `${error.code ?? ""} ${error.message}`.toLowerCase();
  if (texto.includes("invalid_credentials") || texto.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos — confira e tente de novo.";
  }
  if (texto.includes("email_not_confirmed") || texto.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }
  return modo === "link"
    ? "Não foi possível enviar o link. Confira o e-mail ou tente de novo em alguns minutos."
    : "Não foi possível entrar. Tente de novo em alguns minutos.";
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"link" | "senha">("link");
  const [enviado, setEnviado] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  // o painel "enviado" monta só depois do exit do form (mode="wait") — um
  // useEffect([enviado]) dispararia com o ref ainda null e perderia o foco;
  // ref callback foca quando o nó existe de verdade
  const focoEnviado = useCallback((el: HTMLDivElement | null) => {
    el?.focus();
  }, []);

  // destino pós-login: ?next= do middleware (link protegido) + o #registrar-{id}
  // que o browser manteve na barra durante o redirect — o #error= do verify
  // expirado não é âncora da app e não pode vazar pro destino
  const destinoFinal = useCallback(() => {
    const next = params.get("next");
    const hash = location.hash.startsWith("#error=") ? "" : location.hash;
    return (pathInterno(next) ?? "/") + hash;
  }, [params]);

  // verify falhou (otp expirado/usado): o supabase despeja #error=… na raiz,
  // o middleware manda pra cá e o fragment sobrevive — normaliza pro mesmo
  // estado ?erro=link-invalido que o /auth/confirm já produz
  useEffect(() => {
    if (!location.hash.startsWith("#error=")) return;
    const next = params.get("next");
    router.replace(
      `/login?erro=link-invalido${next ? `&next=${encodeURIComponent(next)}` : ""}`
    );
  }, [params, router]);

  // countdown do reenvio — tick de 1s até zerar
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // a aba do e-mail só confirma e se fecha — quem entra é ESTA aba.
  // onAuthStateChange cobre o broadcast multi-tab do supabase-js; o poll +
  // visibilitychange/focus cobrem onde o broadcast não chega
  useEffect(() => {
    if (!enviado) return;
    let entrou = false;
    const entrar = () => {
      if (entrou) return;
      entrou = true;
      router.push(destinoFinal());
    };
    const checar = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) entrar();
    };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") entrar();
    });
    const intervalo = setInterval(checar, 2500);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") checar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      subscription.unsubscribe();
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [enviado, params, router, supabase, destinoFinal]);

  async function pedirLink() {
    setLoading(true);
    setErro(null);
    try {
      const destino = destinoFinal();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${location.origin}/auth/confirm?next=${encodeURIComponent(destino)}`,
        },
      });
      if (error) {
        // 429 = um link acabou de sair — honesto mostrar o painel com o
        // cooldown real ("after N seconds") em vez de um erro
        const seg = /after (\d+) seconds/.exec(error.message);
        if (error.code === "over_email_send_rate_limit" || seg) {
          setEnviado(true);
          setCooldown(seg ? Number(seg[1]) : COOLDOWN);
        } else {
          setErro(mensagemErro(error, "link"));
        }
      } else {
        setEnviado(true);
        setCooldown(COOLDOWN);
      }
    } catch {
      setErro("Sem conexão — tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  async function entrarComSenha(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: senha,
      });
      if (error) setErro(mensagemErro(error, "senha"));
      else router.push(destinoFinal());
    } catch {
      setErro("Sem conexão — tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  const mmss = `${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-realiza.png" alt="Realiza.vc" className="h-8 w-auto" />
          <h1 className="text-lg font-semibold tracking-tight mt-3">Programa de Mentoria Social</h1>
        </div>

        {/* feedback: crossfade form ↔ confirmação — o painel sucede o form no
            mesmo espaço em vez de corte seco (§2); ref/tabIndex de foco migram
            pro motion.div entrante */}
        <AnimatePresence mode="wait" initial={false}>
          {enviado ? (
            <motion.div
              key="enviado"
              ref={focoEnviado}
              tabIndex={-1}
              {...fade}
              transition={T.enter}
              className="rounded-xl bg-card shadow-[var(--shadow-border)] p-6 outline-none"
            >
              <div className="grid size-10 place-items-center rounded-full bg-[var(--brand-lime)] text-[var(--brand-ink)]">
                <EnvelopeSimple size={20} weight="bold" aria-hidden="true" />
              </div>
              <p className="mt-4 font-medium">Link enviado</p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Enviamos um link para{" "}
                <span className="font-medium text-foreground">{email}</span> — ele
                pode levar alguns minutos. Confira a caixa de entrada e o spam.
              </p>
              <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <CircleNotch size={13} className="animate-spin shrink-0" aria-hidden="true" />
                Aguardando a confirmação — ao abrir o link, esta página entra sozinha.
              </p>
              <div className="mt-5 space-y-2">
                {/* falha do reenvio — o form está desmontado, o erro mora aqui */}
                {erro && (
                  <p role="alert" className="text-sm text-destructive">
                    {erro}
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={cooldown > 0 || loading}
                  onClick={pedirLink}
                >
                  {cooldown > 0 ? (
                    <span className="tabular-nums">Reenviar em {mmss}</span>
                  ) : loading ? (
                    "Enviando…"
                  ) : (
                    "Reenviar link"
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setEnviado(false);
                    setCooldown(0);
                    setErro(null);
                  }}
                  className="w-full min-h-11 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Usar outro e-mail
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              {...fade}
              transition={T.enter}
              className="rounded-xl bg-card shadow-[var(--shadow-border)] p-6"
            >
              {/* segmento concêntrico: raio externo = interno + padding (8+4=12).
                  escolha excludente → radio com legend (não tablist): setas e
                  estado "selecionado" vêm de graça, sem tabpanel nem roving tabindex */}
              <fieldset className="rounded-xl bg-muted p-1">
                <legend className="sr-only">Forma de entrada</legend>
                <div className="grid grid-cols-2 gap-1">
                  {(
                    [
                      { id: "link", label: "Link por e-mail", icon: EnvelopeSimple },
                      { id: "senha", label: "Senha", icon: Key },
                    ] as const
                  ).map(({ id, label, icon: Icon }) => (
                    <label
                      key={id}
                      className={cn(
                        "relative flex h-11 cursor-pointer select-none items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 md:h-10",
                        modo === id
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <input
                        type="radio"
                        name="modo-login"
                        value={id}
                        checked={modo === id}
                        onChange={() => {
                          setModo(id);
                          setErro(null);
                        }}
                        className="sr-only"
                      />
                      {/* continuidade espacial: o pill desliza entre as opções
                          no lugar do corte de bg (§2) */}
                      {modo === id && (
                        <motion.span
                          layoutId="login-modo"
                          transition={T.pill}
                          aria-hidden
                          className="absolute inset-0 rounded-lg bg-card shadow-[var(--shadow-border)]"
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        <Icon size={16} aria-hidden="true" />
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <form
                onSubmit={modo === "link" ? (e) => { e.preventDefault(); void pedirLink(); } : entrarComSenha}
                className="mt-5 space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  {modo === "link" && (
                    <p className="text-xs text-muted-foreground">
                      O e-mail precisa ter sido cadastrado pela coordenação.
                    </p>
                  )}
                </div>

                {/* continuidade: o campo cresce e empurra o submit — a altura
                    preserva a continuidade em vez de teleportar o layout (§2) */}
                <AnimatePresence initial={false}>
                  {modo === "senha" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0, transition: T.micro }}
                      transition={T.panel}
                      className="overflow-hidden"
                    >
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
                    </motion.div>
                  )}
                </AnimatePresence>

                {(erro || params.get("erro")) && (
                  <p role="alert" className="text-sm text-destructive">
                    {erro ?? "Link inválido ou expirado — peça um novo link e abra no mesmo navegador."}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading
                    ? modo === "link" ? "Enviando…" : "Entrando…"
                    : modo === "link" ? "Receber link de acesso" : "Entrar"}
                </Button>

                {modo === "senha" && (
                  <button
                    type="button"
                    onClick={() => {
                      setModo("link");
                      setErro(null);
                    }}
                    className="w-full min-h-11 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Esqueceu a senha? Entre pelo link de e-mail
                  </button>
                )}
              </form>
            </motion.div>
          )}
        </AnimatePresence>
        <SiteFooter className="mt-10" />
      </div>
    </div>
  );
}
