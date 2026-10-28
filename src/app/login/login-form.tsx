"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type Session } from "@supabase/supabase-js";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { CircleNotch, EnvelopeSimple, Key, WarningCircle } from "@phosphor-icons/react";
import { createAuthClient, createOtpClient } from "@/lib/supabase/client";
import { limparCookiesDemo } from "@/lib/demo/shared";
import { SiteFooter } from "@/components/site-footer";
import { fade, T, EASE } from "@/components/motion";
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
    // box e vaza o padding lateral (1rem ou o safe-area, o que for maior)
    // lg:pl-[50%] reserva a metade esquerda pro painel fixo da marca
    // (LoginHero) — o form continua centrado na metade que sobra
    <div className="flex min-h-[100dvh] flex-col bg-background lg:pl-[50%]">
      <LoginHero />

      {/* cabeçalho mobile full-bleed: eco do painel desktop — fundo em
          gradiente ink→verde, glow lime que respira, wordmark centralizado e
          a colagem de fotos da turma; no lg+ o LoginHero assume esse papel e
          o form traz a própria marca */}
      <div className="relative overflow-hidden bg-[linear-gradient(165deg,var(--brand-ink),color-mix(in_srgb,var(--brand-ink)_80%,var(--brand-lime)))] px-6 pb-10 pt-[calc(2.5rem+env(safe-area-inset-top))] text-center lg:hidden">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -top-12 left-1/2 size-72 -translate-x-1/2 rounded-full bg-[var(--brand-lime)]/25 blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.55, 0.85, 0.55] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <p className="relative text-3xl font-black italic tracking-tight">
          <span className="text-white">REALIZA</span>
          <span className="text-[var(--role-mentorado)]">.</span>
          <span className="text-[var(--brand-lime)]">VC</span>
        </p>
        <h1 className="relative mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
          Programa de Mentoria Social
        </h1>
        <div className="relative mt-6 flex items-end justify-center gap-3">
          {FOTOS_MOBILE.map((f) => (
            <motion.div
              key={f.fotos[0].src}
              initial={{ opacity: 0, y: 18, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: EASE, delay: f.entradaDelay }}
              className={f.cls}
            >
              <FotoCarrossel fotos={f.fotos} intervalo={f.intervalo} />
            </motion.div>
          ))}
        </div>
      </div>

      <div className="m-auto w-full max-w-sm pb-[calc(1.5rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-6 lg:max-w-md lg:pt-0">
        {/* marca já veio no painel/banda — aqui vai o título da ação */}
        <div className="mb-8 hidden lg:block">
          <h1 className="text-xl font-semibold tracking-tight">Entrar</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Use o e-mail cadastrado no programa.
          </p>
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
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setEnviado(false);
                    setCooldown(0);
                    setErro(null);
                  }}
                >
                  Usar outro e-mail
                </Button>
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
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setModo("link");
                      setErro(null);
                    }}
                  >
                    Esqueceu a senha? Entre pelo link de e-mail
                  </Button>
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

type Foto = { src: string; w: number; h: number; legenda?: string };

const SEDE: Foto = { src: "/login/parceiros.webp", w: 1400, h: 788, legenda: "Sede parceira" };
const DUPLA: Foto = { src: "/login/dupla.webp", w: 1300, h: 731, legenda: "Mentoria em dupla" };
const GRUPO: Foto = { src: "/login/grupo.webp", w: 1300, h: 731, legenda: "Primeira turma" };
const FORMACAO_TV: Foto = { src: "/login/formacao-tv.webp", w: 1300, h: 2311, legenda: "Formação" };
const CONVERSA: Foto = { src: "/login/conversa.webp", w: 1300, h: 2311, legenda: "Encontro de mentoria" };
const AULA: Foto = { src: "/login/aula.webp", w: 1300, h: 2311, legenda: "Aula do programa" };
const ALUNA: Foto = { src: "/login/aluna.webp", w: 900, h: 1600, legenda: "Aluna em atividade" };
const RETRATO: Foto = { src: "/login/retrato.webp", w: 900, h: 1600, legenda: "Voluntária" };
const EDUCADOR: Foto = { src: "/login/educador.webp", w: 900, h: 1600, legenda: "Formação de educadores" };
const ATIVIDADE: Foto = { src: "/login/atividade.webp", w: 900, h: 1600, legenda: "Roda da Vida" };
const FORMACAO: Foto = { src: "/login/formacao.webp", w: 900, h: 1600, legenda: "Equipe Realiza" };
const SELFIE: Foto = { src: "/login/selfie.webp", w: 900, h: 1600, legenda: "Turma 1" };

type SlotHero = {
  /** classes de posicionamento + rotação de repouso (propriedade `rotate`
   *  do CSS — compõe com o transform do float no filho) */
  pos: string;
  /** aspect-[a/b] + largura relativa */
  ar: string;
  largura: string;
  entradaDelay: number;
  bobDur: number;
  bobAmp: number;
  bobDelay: number;
  /** pool do carrossel — o slot alterna entre as fotos em crossfade */
  fotos: Foto[];
  intervalo: number;
};

const SLOTS: SlotHero[] = [
  {
    pos: "top-[2%] left-0 rotate-[-4deg]",
    ar: "aspect-[16/10]",
    largura: "w-[44%]",
    entradaDelay: 0.05,
    bobDur: 6.5,
    bobAmp: -9,
    bobDelay: 0,
    fotos: [SEDE, FORMACAO_TV, CONVERSA],
    intervalo: 6200,
  },
  {
    pos: "top-0 right-[1%] rotate-[3deg]",
    ar: "aspect-[3/4]",
    largura: "w-[29%]",
    entradaDelay: 0.2,
    bobDur: 7.5,
    bobAmp: -12,
    bobDelay: 0.8,
    fotos: [ALUNA, RETRATO, EDUCADOR],
    intervalo: 7800,
  },
  {
    pos: "bottom-[10%] left-[4%] rotate-[2.5deg]",
    ar: "aspect-[3/4]",
    largura: "w-[30%]",
    entradaDelay: 0.35,
    bobDur: 8.5,
    bobAmp: -8,
    bobDelay: 1.6,
    fotos: [ATIVIDADE, FORMACAO, SELFIE],
    intervalo: 8400,
  },
  {
    pos: "bottom-0 right-[5%] rotate-[-2.5deg]",
    ar: "aspect-[16/10]",
    largura: "w-[57%]",
    entradaDelay: 0.5,
    bobDur: 7,
    bobAmp: -10,
    bobDelay: 0.4,
    fotos: [DUPLA, GRUPO, AULA],
    intervalo: 7000,
  },
];

/** mesmos pools do painel, reduzidos pra 3 slots no mobile */
const FOTOS_MOBILE: { cls: string; entradaDelay: number; intervalo: number; fotos: Foto[] }[] = [
  { cls: "aspect-[4/3] w-[46%] rotate-[-2deg]", entradaDelay: 0.05, intervalo: 6500, fotos: [DUPLA, AULA, GRUPO] },
  { cls: "aspect-[3/4] w-[27%] rotate-[2.5deg]", entradaDelay: 0.18, intervalo: 8000, fotos: [ALUNA, EDUCADOR, RETRATO] },
  { cls: "aspect-[3/4] w-[27%] rotate-[-3deg]", entradaDelay: 0.31, intervalo: 7300, fotos: [ATIVIDADE, SELFIE, FORMACAO] },
];

/** Carrossel de crossfade dentro de um slot da colagem: as fotos ficam
 *  empilhadas em absolute (o container segura o aspect) e a ativa sobe de
 *  opacidade; a legenda chip remonta junto. Com prefers-reduced-motion o
 *  intervalo nem liga — fica sempre a primeira foto. */
function FotoCarrossel({
  fotos,
  intervalo,
  legenda,
}: {
  fotos: Foto[];
  intervalo: number;
  legenda?: boolean;
}) {
  const [i, setI] = useState(0);
  const reduzir = useReducedMotion();
  useEffect(() => {
    if (reduzir || fotos.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % fotos.length), intervalo);
    return () => clearInterval(t);
  }, [fotos.length, intervalo, reduzir]);
  const atual = fotos[i];
  return (
    <>
      {fotos.map((f, n) => (
        <motion.img
          key={f.src}
          src={f.src}
          alt=""
          width={f.w}
          height={f.h}
          initial={false}
          animate={{ opacity: n === i ? 1 : 0 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
          style={{ zIndex: n === i ? 1 : 0 }}
          className="absolute inset-0 h-full w-full rounded-2xl object-cover shadow-2xl ring-1 ring-white/15"
        />
      ))}
      {legenda && atual.legenda && (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="absolute bottom-2.5 left-2.5 z-[2] rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm"
        >
          {atual.legenda}
        </motion.span>
      )}
    </>
  );
}

/** Painel institucional do /login — só desktop (lg+), position:fixed, metade
 *  esquerda da tela; a coluna reserva o espaço com lg:pl-[50%]. Superfície ink
 *  da marca com o wordmark centralizado sobre um glow lime que respira, e
 *  uma colagem em carrossel (FotoCarrossel) das fotos reais do programa com
 *  entrada escalonada + bob dessincronizado (com sway de rotação). Tudo
 *  decorativo (aria-hidden) e transform/motion: o MotionConfig
 *  reducedMotion="user" do layout zera a animação pra quem prefere menos
 *  movimento, e o carrossel desliga o intervalo via useReducedMotion. */
function LoginHero() {
  return (
    <aside
      aria-hidden="true"
      className="fixed inset-y-0 left-0 hidden w-1/2 flex-col overflow-hidden bg-[var(--brand-ink)] p-10 lg:flex xl:p-14"
    >
      {/* glow lime atrás do logo — disco borrado que respira devagar */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-4 size-80 -translate-x-1/2 rounded-full bg-[var(--brand-lime)]/20 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* marca centralizada — wordmark em texto puro (o PNG some sobre ink
          no tema claro); mesma construção do SiteFooter/Logo dark */}
      <div className="relative mt-3 text-center">
        <p className="text-4xl font-black italic tracking-tight xl:text-5xl">
          <span className="text-white">REALIZA</span>
          <span className="text-[var(--role-mentorado)]">.</span>
          <span className="text-[var(--brand-lime)]">VC</span>
        </p>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
          Programa de Mentoria Social
        </p>
        <p className="mx-auto mt-6 max-w-sm text-xl font-semibold tracking-tight text-balance text-white xl:text-2xl">
          A jornada da mentoria,{" "}
          <span className="text-[var(--brand-lime)]">toda num lugar só.</span>
        </p>
      </div>

      {/* colagem flutuante: cada slot sobe uma vez na entrada (wrapper com a
          rotação de repouso), o bob+sway mora no filho e o FotoCarrossel
          alterna as fotos em crossfade com cadência própria */}
      <div className="relative mt-4 min-h-0 flex-1">
        {SLOTS.map((f) => (
          <motion.div
            key={f.fotos[0].src}
            // a largura tem que morar no absolute (o pai shrink-wrap);
            // w-% no filho resolveria contra um pai que depende dele
            className={`absolute ${f.pos} ${f.largura}`}
            initial={{ opacity: 0, y: 26, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: EASE, delay: f.entradaDelay }}
          >
            <motion.div
              animate={{ y: [0, f.bobAmp, 0], rotate: [0, 1.2, 0] }}
              transition={{
                duration: f.bobDur,
                repeat: Infinity,
                ease: "easeInOut",
                delay: f.bobDelay,
              }}
              className={`relative ${f.ar}`}
            >
              <FotoCarrossel fotos={f.fotos} intervalo={f.intervalo} legenda />
            </motion.div>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {["Coordenação", "Supervisoras", "Mentores", "Jovens", "Especialistas"].map(
          (papel) => (
            <span
              key={papel}
              className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-medium text-white/65"
            >
              {papel}
            </span>
          )
        )}
      </div>
    </aside>
  );
}
