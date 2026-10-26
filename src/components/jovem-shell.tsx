"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import {
  CalendarDots,
  House,
  List,
  Path,
  Sparkle,
  UserCircle,
  Users,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/avatar";
import { DemoSlotProvider } from "@/components/demo-bar";
import { Logo } from "@/components/logo";
import { T } from "@/components/motion";
import { NotificacoesBell, NotificacoesProvider } from "@/components/notificacoes";
import { SignOutButton } from "@/components/signout-button";
import { SiteFooter } from "@/components/site-footer";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Notificacao, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Lado do jovem (REALIZA-108) — shell próprio, não o AppShell filtrado:
 *  seis destinos fixos e nada de navegação de staff. O acento da nav é o
 *  amarelo --role-mentorado (o verde fica pros adultos) — a mesma cor do
 *  avatar-iniciais do jovem no resto do app. */
const NAV = [
  { href: "/jovem", label: "Início", icon: House },
  { href: "/jovem/agenda", label: "Agenda", icon: CalendarDots },
  { href: "/jovem/especialistas", label: "Especialistas", icon: Sparkle },
  { href: "/jovem/pessoas", label: "Pessoas", icon: Users },
  // trilha de progresso, não pasta: jornada é avanço, o acervo é /materiais
  { href: "/jovem/materiais", label: "Jornada", icon: Path },
  { href: "/jovem/perfil", label: "Perfil", icon: UserCircle },
] as const;

/** Bottom nav: 4 destinos fixos + Menu (REALIZA-221). Primárias = o que
 *  ela mais usa: home, o catálogo de especialistas, a jornada (é onde
 *  moram os links dos forms e o acervo) e a agenda. Pessoas e Perfil
 *  ficam no menu lateral, que tem a navegação inteira. */
const MOBILE_PRIMEIRO = [
  "/jovem",
  "/jovem/especialistas",
  "/jovem/materiais",
  "/jovem/agenda",
] as const;

function ativo(pathname: string, href: string) {
  return href === "/jovem" ? pathname === "/jovem" : pathname.startsWith(href);
}

export function JovemShell({
  me,
  notificacoes,
  demo,
  children,
}: {
  me: Profile;
  notificacoes: { itens: Notificacao[]; naoLidas: number };
  /** pill compacta da DemoBar dockada no header mobile (no lugar do nome —
   *  mesmo trade-off do AppShell, que docka sobre o rótulo de papel) */
  demo?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);
  // rodapé da sidebar: a pílula "float" da demo se encaixa aqui no desktop
  const [slotDemo, setSlotDemo] = useState<HTMLDivElement | null>(null);
  const visiveis = MOBILE_PRIMEIRO.map((href) => NAV.find((i) => i.href === href)!);
  const menuAtivo = !visiveis.some((i) => ativo(pathname, i.href));

  // navegar pelo menu (ou por fora) fecha o painel — ajuste durante o
  // render (padrão "props mudaram", igual ao AppShell)
  const [ultimoPath, setUltimoPath] = useState(pathname);
  if (pathname !== ultimoPath) {
    setUltimoPath(pathname);
    setMenuAberto(false);
  }

  // nome de uso primeiro — o cadastro guarda o civil, mas a tela chama pelo
  // que a pessoa escolheu; o primeiro nome já basta de saudação no header
  const nomeTela = me.nome_social || me.nome;
  const primeiroNome = nomeTela.split(" ")[0];

  return (
    <NotificacoesProvider inicial={notificacoes}>
    <DemoSlotProvider alvo={slotDemo}>
      {/* coluna no mobile, linha no desktop — o flex sem gate estica a
          coluna de conteúdo (flex-1) a 100dvh e ancora o footer na borda
          inferior em página curta (mesmo fix do AppShell: o md:flex
          deixava o footer flutuando no mobile) */}
      <div className="flex min-h-dvh flex-col md:flex-row">
        {/* skip-link — mesmo contrato do shell de staff */}
        <a
          href="#conteudo"
          className="pointer-events-none fixed left-4 top-3 z-50 -translate-y-24 rounded-lg bg-[var(--brand-lime)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-ink)] opacity-0 shadow-[var(--shadow-border)] transition-[transform,opacity] duration-200 focus:pointer-events-auto focus:translate-y-0 focus:opacity-100"
        >
          Pular pro conteúdo
        </a>

        {/* top bar mobile: logo + nome + sino + sair (o header pede o nome
            do jovem e a saída à mão — o avatar mora no item Perfil) */}
        <header className="sticky top-0 z-40 flex min-h-14 items-center justify-between border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur md:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/jovem"
              className="flex min-h-11 shrink-0 items-center"
              aria-label="Início"
            >
              <Logo size="sm" />
            </Link>
            {demo ?? (
              <span
                className="truncate text-xs font-medium text-muted-foreground max-w-44"
                title={nomeTela}
              >
                {primeiroNome}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <NotificacoesBell side="bottom" align="end" />
            <SignOutButton
              somenteIcone
              label="Sair"
              className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
        </header>

        {/* sidebar desktop — mesma linguagem do AppShell, cinco destinos */}
        <aside className="hidden md:flex w-56 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col fixed inset-y-0">
          <div className="px-5 pt-6 pb-8">
            <Link href="/jovem" className="inline-block" aria-label="Início">
              <Logo />
            </Link>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mt-2">
              Programa de Mentoria Social
            </p>
          </div>

          <nav aria-label="Navegação principal" className="flex-1 px-3 space-y-1">
            {NAV.map((item) => {
              const at = ativo(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={at ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    at
                      ? "text-[var(--destaque-foreground)] font-semibold"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  {at && (
                    <motion.span
                      layoutId="nav-jovem-side"
                      transition={T.pill}
                      aria-hidden
                      className="absolute inset-0 -z-10 rounded-lg bg-[var(--role-mentorado)]"
                    />
                  )}
                  <item.icon
                    size={18}
                    weight={at ? "fill" : "regular"}
                    aria-hidden
                    className="relative"
                  />
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border px-3 pb-4 pt-4">
            {/* encaixe da pílula da demo (DemoBar float): vazio fora da demo,
                então não ocupa altura; em demo a pílula entra aqui, acima do usuário */}
            <div ref={setSlotDemo} />
            <div className="flex items-center gap-1">
              <Link
                href="/jovem/perfil"
                aria-current={ativo(pathname, "/jovem/perfil") ? "page" : undefined}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {/* foto nunca: a decisão de produto é iniciais na v1 — o
                    disco amarelo já é a marca do jovem no app inteiro */}
                <Avatar nome={nomeTela} papel="mentorado" size={32} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" title={nomeTela}>
                    {nomeTela}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">Mentorado</p>
                </div>
              </Link>
              <NotificacoesBell side="right" align="end" />
            </div>
            <SignOutButton className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50" />
          </div>
        </aside>

        {/* coluna de conteúdo */}
        <div className="flex min-w-0 flex-1 flex-col md:ml-56">
          <main id="conteudo" tabIndex={-1} className="flex-1">
            {/* medida mobile-first que abre um degrau por breakpoint no
                desktop (mesma régua do AppShell, um degrau abaixo — a
                jornada do jovem é leitura, não planilha) */}
            <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:py-8 xl:max-w-5xl 2xl:max-w-6xl">
              {children}
            </div>
          </main>
          <SiteFooter tone="ink" />
        </div>

        {/* bottom nav mobile — 4 destinos + Menu lateral (mesmo padrão do
            AppShell; 6 labels a 375px colidiam) */}
        <nav
          aria-label="Navegação principal"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:hidden"
        >
          <div className="flex">
            {visiveis.map((item) => {
              const at = ativo(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={at ? "page" : undefined}
                  className={cn(
                    "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                    at
                      ? "font-semibold text-sidebar-foreground"
                      : "font-medium text-sidebar-foreground/75 active:text-sidebar-foreground"
                  )}
                >
                  {at && (
                    <motion.span
                      layoutId="nav-jovem-bottom"
                      transition={T.pill}
                      aria-hidden
                      className="absolute top-0 h-0.5 w-8 rounded-full bg-[var(--role-mentorado)]"
                    />
                  )}
                  <item.icon size={20} weight={at ? "fill" : "regular"} aria-hidden />
                  {item.label}
                </Link>
              );
            })}
            <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
              <SheetTrigger
                aria-label={menuAtivo ? "Menu, seção atual fora da barra" : "Menu"}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                  menuAtivo
                    ? "font-semibold text-sidebar-foreground"
                    : "font-medium text-sidebar-foreground/75 active:text-sidebar-foreground"
                )}
              >
                {/* a rota atual mora no menu → o indicador viaja pra
                    cell Menu e ela veste o estilo ativo */}
                {menuAtivo && (
                  <motion.span
                    layoutId="nav-jovem-bottom"
                    transition={T.pill}
                    aria-hidden
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-[var(--role-mentorado)]"
                  />
                )}
                <List size={20} weight={menuAtivo ? "bold" : "regular"} aria-hidden />
                Menu
              </SheetTrigger>
              <SheetContent side="left" className="pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
                <div className="px-5 pt-5 pb-5">
                  <SheetTitle className="sr-only">Menu</SheetTitle>
                  <Logo />
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Programa de Mentoria Social
                  </p>
                </div>
                <nav aria-label="Menu" className="flex-1 space-y-1 px-3 pb-3">
                  {NAV.map((item) => {
                    const at = ativo(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={at ? "page" : undefined}
                        className={cn(
                          "relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          at
                            ? "font-semibold text-[var(--destaque-foreground)]"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        {at && (
                          <motion.span
                            layoutId="nav-jovem-sheet"
                            transition={T.pill}
                            aria-hidden
                            className="absolute inset-0 -z-10 rounded-lg bg-[var(--role-mentorado)]"
                          />
                        )}
                        <item.icon size={18} weight={at ? "fill" : "regular"} aria-hidden className="relative" />
                        <span className="relative">{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
                <div className="border-t border-sidebar-border px-3 pt-3 pb-4">
                  <SignOutButton className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50" />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>
    </DemoSlotProvider>
    </NotificacoesProvider>
  );
}
