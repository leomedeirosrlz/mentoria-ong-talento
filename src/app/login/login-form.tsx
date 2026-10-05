"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type Session } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "motion/react";
import { CircleNotch, EnvelopeSimple, Key, WarningCircle } from "@phosphor-icons/react";
import { createAuthClient, createOtpClient } from "@/lib/supabase/client";
import { limparCookiesDemo } from "@/lib/demo/shared";
import { SiteFooter } from "@/components/site-footer";
import { fade, T } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { cn, pathInterno } from "@/lib/utils";

// janela do resend do supabase — quando o 429 traz "after N seconds" usa o N real
const COOLDOWN = 60;

function mensagemErro(error: { message: string; code?: string }, modo: "link" | "senha"): string {
  const texto = `${error.code ?? ""} ${error.message}`.toLowerCase();
  if (texto.includes("invalid_credentials") || texto.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos. Confira e tente de novo.";
  }
  if (texto.includes("email_not_confirmed") || texto.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }
  // e-mail fora da allowlist: o trigger 0045 aborta o insert e o GoTrue
  // devolve um 500 genérico; otp_disabled cobre signup desligado no painel
  if (
    texto.includes("otp_disabled") ||
    texto.includes("signups not allowed") ||
    texto.includes("database error saving new user") ||
    texto.includes("cadastrados do programa")
  ) {
    return "E-mail não cadastrado. Fale com a coordenação pra liberar seu acesso.";
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
  const supabase = useMemo(() => createAuthClient(), []);
  // client implícito só pro pedido do link — o ssr força pkce, que prende o
  // acesso ao browser que pediu (ver createOtpClient)
  const otp = useMemo(() => createOtpClient(), []);
  // nonce do handoff: viaja no link (?h=) — a aba que abre devolve os tokens
  // pro servidor, e esta aba os resgata no poll (login_handoffs, 0049). É o
  // que faz a sessão chegar na aba que pediu mesmo se o link abrir em outro
  // navegador/app de e-mail — cookies não atravessam, a RPC atravessa.
  const handoffRef = useRef<string | null>(null);
  // e-mail do pedido que gerou o nonce — os tokens resgatados são bearer:
  // a sessão só entra se o e-mail bater (fixação via depósito de tokens
  // alheios morre na checagem do poll)
  const emailPedidoRef = useRef<string | null>(null);
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
    // só a âncora da app é repassada — #error=/#access_token= do GoTrue não
    const hash = location.hash.startsWith("#registrar-") ? location.hash : "";
    return (pathInterno(next) ?? "/") + hash;
  }, [params]);

  // url do estado "link inválido" — a mesma que o /auth/confirm produz
  const urlErroLink = useCallback(() => {
    const next = params.get("next");
    return `/login?erro=link-invalido${next ? `&next=${encodeURIComponent(next)}` : ""}`;
  }, [params]);

  // verify falhou (otp expirado/usado): o supabase despeja #error=… na raiz,
  // o middleware manda pra cá e o fragment sobrevive — normaliza pro mesmo
  // estado ?erro=link-invalido que o /auth/confirm já produz
  useEffect(() => {
    if (!location.hash.startsWith("#error=")) return;
    router.replace(urlErroLink());
  }, [router, urlErroLink]);

  // destino pós-login com sessão: quem nunca definiu senha (nem dispensou o
  // onboarding) passa por ele primeiro — o desvio que o /auth/confirm fazia
  // no fluxo pkce, agora aplicado na aba que AGUARDA o link
  const entrar = useCallback(
    (session: Session | null) => {
      // login real venceu — a demo (se estava ativa) morre junto
      limparCookiesDemo();
      const destino = destinoFinal();
      const meta = session?.user?.user_metadata;
      const resolveuSenha = !!meta?.senha_em || !!meta?.senha_dispensada;
      router.push(
        resolveuSenha ? destino : `/auth/definir-senha?next=${encodeURIComponent(destino)}`
      );
    },
    [router, destinoFinal]
  );

  // sessão ativa ao abrir a página: quem já está logado não fica preso no
  // /login. O magic link implícito cai AQUI com #access_token quando o link
  // é antigo — esta aba NUNCA cria sessão com ele: sem o nonce (?h=) o link
  // não prova que veio do pedido feito aqui (um redirect_to adulterado
  // plantaria a conta de outra pessoa neste navegador). Com nonce ela só
  // devolve os tokens pra aba que pediu e mostra a confirmação
  useEffect(() => {
    let entrou = false;
    const ir = (session: Session | null) => {
      if (entrou || !session) return;
      entrou = true;
      entrar(session);
    };
    const frag = new URLSearchParams(location.hash.slice(1));
    const access_token = frag.get("access_token");
    const refresh_token = frag.get("refresh_token");
    // location.search, não useSearchParams — ver /auth/link
    const handoff = new URLSearchParams(location.search).get("h");
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") ir(session);
    });
    if (access_token && refresh_token) {
      // tokens E nonce fora da barra/histórico antes de qualquer await
      history.replaceState(null, "", location.pathname);
      entrou = true;
      if (!handoff) {
        router.replace(urlErroLink());
      } else {
        // aba do e-mail: não grava nada (o refresh_token é de uso único e
        // pertence à aba original) — publica e confirma. Se a RPC falhar o
        // nonce morre marcado: nunca entra aqui
        void supabase
          .rpc("registrar_login_handoff", {
            p_nonce: handoff,
            p_access: access_token,
            p_refresh: refresh_token,
          })
          .then(({ error }) => {
            if (error) {
              void supabase
                .rpc("falhar_login_handoff", { p_nonce: handoff })
                .then(() => {}, () => {});
              router.replace(urlErroLink());
              return;
            }
            router.replace(
              `/auth/confirmado?next=${encodeURIComponent(destinoFinal())}`
            );
          });
      }
    } else {
      void supabase.auth.getSession().then(({ data }) => ir(data.session));
    }
    return () => subscription.unsubscribe();
  }, [supabase, entrar, router, urlErroLink, params, destinoFinal]);

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
    // o SIGNED_IN do próprio setSession do handoff não pode entrar antes da
    // checagem de e-mail — o evento dispara durante o await e correria o ir
    let conferindo = false;
    const ir = (session: Session | null) => {
      if (entrou || !session) return;
      entrou = true;
      entrar(session);
    };
    const checar = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        ir(data.session);
        return;
      }
      // link aberto em outro navegador/app: a aba do e-mail depositou os
      // tokens no handoff — resgata aqui (uso único) e assina nesta aba
      const nonce = handoffRef.current;
      if (!nonce) return;
      const { data: h } = await supabase.rpc("pegar_login_handoff", {
        p_nonce: nonce,
      });
      const tokens = h as {
        access_token?: string;
        refresh_token?: string;
        failed?: boolean;
      } | null;
      // a aba do e-mail achou o link queimado/expirado — para de esperar e
      // mostra o mesmo card de link inválido (aqui o "pedir novo link" faz
      // sentido: é o mesmo navegador)
      if (tokens?.failed) {
        entrou = true;
        setEnviado(false);
        router.replace(urlErroLink());
        return;
      }
      if (!tokens?.access_token || !tokens.refresh_token) return;
      conferindo = true;
      const { data: s, error } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      // tokens rejeitados = nonce envenenado/morto — parar o poll e avisar;
      // esperar num nonce consumido não resolve nada
      if (error || !s.session) {
        entrou = true;
        setEnviado(false);
        router.replace(urlErroLink());
        return;
      }
      // o nonce é bearer: quem conhece o h pode depositar tokens de OUTRA
      // conta (fixação). A sessão só vale se o e-mail bater com o que pediu
      // o link — mismatch derruba a sessão plantada na hora
      const { data: u } = await supabase.auth.getUser();
      const emailSessao = (u.user?.email ?? s.session.user.email)?.toLowerCase();
      if (emailSessao !== emailPedidoRef.current) {
        entrou = true;
        await supabase.auth.signOut();
        setEnviado(false);
        setErro("Este link não corresponde a este e-mail. Peça um novo.");
        return;
      }
      entrou = true;
      entrar(s.session);
    };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && !conferindo) ir(session);
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
  }, [enviado, supabase, entrar, router, urlErroLink]);

  async function pedirLink() {
    setLoading(true);
    setErro(null);
    try {
      const destino = destinoFinal();
      const handoff = crypto.randomUUID();
      const { error } = await otp.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          // precisa ser true: pré-cadastrado existe em profiles mas ainda
          // não tem row em auth.users (o vínculo é no 1º login, via
          // handle_new_user). Com false o GoTrue não manda link nenhum pra
          // quem nunca entrou. Quem NÃO está na allowlist é barrado pelo
          // trigger 0045 — o 500 volta e vira "e-mail não cadastrado" no
          // mapeamento de erro
          shouldCreateUser: true,
          // implicit: a sessão chega no hash (#access_token) — o destino
          // precisa ser uma página de client, rota de servidor não vê hash.
          // /auth/link, não /login: lá o middleware desvia usuário já logado
          // (browser do e-mail com sessão antiga) antes da página rodar, e o
          // hash morreria no redirect. ?h= é o nonce do handoff (0049)
          emailRedirectTo: `${location.origin}/auth/link?next=${encodeURIComponent(destino)}&h=${handoff}`,
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
        // o nonce só vale pro link que saiu de verdade — num 429 nenhum
        // e-mail novo carrega este h, e sobrescrever o ref orfanaria o
        // nonce do link anterior que ainda pode ser clicado
        handoffRef.current = handoff;
        emailPedidoRef.current = email.trim().toLowerCase();
        setEnviado(true);
        setCooldown(COOLDOWN);
      }
    } catch {
      setErro("Sem conexão. Tente de novo.");
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
      else {
        // login real venceu — sai da demo antes de entrar
        limparCookiesDemo();
        router.push(destinoFinal());
      }
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  const mmss = `${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, "0")}`;
  // link expirado/usado chega como ?erro=link-invalido (de /auth/confirm ou
  // do normalizador de #error=) — merece tela própria, não o form com um aviso
  const erroLink = params.get("erro") != null;

  return (
    // flex + m-auto (não place-items-center): com o teclado virtual
    // encolhendo o viewport (resizes-content), o topo continua rolável.
    // flex, não grid: em grid o w-full do filho resolve contra o padding
    // box e vaza os px-4
    <div className="flex min-h-[100dvh] flex-col bg-background px-4">
      <div className="m-auto w-full max-w-sm">
        <div className="mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-realiza.png" alt="Realiza.vc" className="h-8 w-auto" />
          <h1 className="text-lg font-semibold tracking-tight mt-3">Programa de Mentoria Social</h1>
        </div>

        {/* feedback: crossfade form ↔ confirmação — o painel sucede o form no
            mesmo espaço em vez de corte seco (§2); ref/tabIndex de foco migram
            pro motion.div entrante */}
        <AnimatePresence mode="wait" initial={false}>
          {erroLink ? (
            <motion.div
              key="erro-link"
              ref={focoEnviado}
              tabIndex={-1}
              {...fade}
              transition={T.enter}
              className="rounded-xl bg-card shadow-[var(--shadow-border)] p-6 outline-none"
            >
              <div className="grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive">
                <WarningCircle size={20} weight="bold" aria-hidden="true" />
              </div>
              <p className="mt-4 font-medium">Link inválido ou expirado</p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Peça um novo link pra entrar.
              </p>
              <Button
                type="button"
                className="mt-5 w-full"
                onClick={() => {
                  const next = params.get("next");
                  router.replace(
                    `/login${next ? `?next=${encodeURIComponent(next)}` : ""}`
                  );
                }}
              >
                Pedir novo link
              </Button>
            </motion.div>
          ) : enviado ? (
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
                <span className="font-medium text-foreground">{email}</span>. Se
                não chegar em alguns minutos, confira o spam.
              </p>
              <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <CircleNotch size={13} className="animate-spin shrink-0" aria-hidden="true" />
                Esta página entra sozinha quando você abrir o link.
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
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
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
                        <PasswordInput
                          id="senha"
                          required
                          autoComplete="current-password"
                          value={senha}
                          onChange={(e) => setSenha(e.target.value)}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {erro && (
                  <p role="alert" className="text-sm text-destructive">
                    {erro}
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
