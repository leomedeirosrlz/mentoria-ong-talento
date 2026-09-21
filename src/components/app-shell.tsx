"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  CalendarDots,
  ChartLineUp,
  ClipboardText,
  FolderOpen,
  SignOut,
  UserCircle,
  UsersThree,
} from "@phosphor-icons/react";
import { signOut } from "@/lib/actions";
import { papelLabel } from "@/lib/ciclo";
import { Avatar } from "@/components/avatar";
import { T } from "@/components/motion";
import { NotificacoesBell, NotificacoesProvider } from "@/components/notificacoes";
import { SiteFooter } from "@/components/site-footer";
import type { Notificacao, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Visão geral", curto: "Início", icon: ChartLineUp, roles: null },
  { href: "/duplas", label: "Duplas", curto: "Duplas", icon: UserCircle, roles: ["coordenacao", "supervisor", "mentor_dpp", "mentor_especialista"] },
  { href: "/registros", label: "Registros", curto: "Registros", icon: ClipboardText, roles: ["coordenacao", "supervisor"] },
  { href: "/agenda", label: "Agenda do ciclo", curto: "Agenda", icon: CalendarDots, roles: null },
  { href: "/materiais", label: "Materiais", curto: "Materiais", icon: FolderOpen, roles: null },
  { href: "/pessoas", label: "Pessoas", curto: "Pessoas", icon: UsersThree, roles: ["coordenacao"] },
] as const;

export function AppShell({
  me,
  avatarUrl,
  gravatarUrl,
  notificacoes,
  children,
}: {
  me: Profile;
  avatarUrl: string | null;
  gravatarUrl: string;
  notificacoes: { itens: Notificacao[]; naoLidas: number };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = NAV.filter((i) => !i.roles || (me.role && (i.roles as readonly string[]).includes(me.role)));

  return (
    <NotificacoesProvider inicial={notificacoes}>
    <div className="min-h-[100dvh] md:flex">
      {/* skip-link: invisível até o primeiro Tab — teclado pula top bar + nav
          inteira e cai direto no <main id="conteudo"> */}
      <a
        href="#conteudo"
        className="pointer-events-none fixed left-4 top-3 z-50 -translate-y-24 rounded-lg bg-[var(--brand-ink)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-lime)] opacity-0 shadow-[var(--shadow-border)] transition-[transform,opacity] duration-200 focus:pointer-events-auto focus:translate-y-0 focus:opacity-100"
      >
        Pular pro conteúdo
      </a>

      {/* top bar — só mobile */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          {/* convenção logo→home; min-h-11 garante os 44px de toque */}
          <Link href="/" className="flex min-h-11 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-realiza.png" alt="Realiza.vc" className="h-5 w-auto" />
          </Link>
          <span className="text-xs text-muted-foreground truncate max-w-44" title={papelCurto(me.role)}>
            {papelCurto(me.role)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <NotificacoesBell side="bottom" align="end" />
          <Link
            href="/perfil"
            aria-label="Meu perfil"
            aria-current={pathname === "/perfil" ? "page" : undefined}
            className="grid size-11 place-items-center rounded-lg transition-colors hover:bg-muted"
          >
            <Avatar nome={me.nome} src={avatarUrl} fallbackSrc={gravatarUrl} size={28} />
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sair"
              className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <SignOut size={20} aria-hidden />
            </button>
          </form>
        </div>
      </header>

      {/* sidebar — só desktop */}
      <aside className="hidden md:flex w-56 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col fixed inset-y-0">
        <div className="px-5 pt-6 pb-8">
          {/* convenção logo→home, igual à top bar mobile */}
          <Link href="/" className="inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-realiza.png" alt="Realiza.vc" className="h-6 w-auto" />
          </Link>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mt-2">Programa de Mentoria Social</p>
        </div>

        <nav aria-label="Navegação principal" className="flex-1 px-3 space-y-1">
          {items.map((item) => {
            const ativo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  ativo
                    ? "text-[var(--brand-ink)] font-semibold"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                {/* continuidade espacial: a pill viaja pra nova seção na troca
                    de rota — o AppShell persiste entre páginas (§2) */}
                {ativo && (
                  <motion.span
                    layoutId="nav-side"
                    transition={T.pill}
                    aria-hidden
                    className="absolute inset-0 -z-10 rounded-lg bg-[var(--brand-lime)]"
                  />
                )}
                <item.icon size={18} weight={ativo ? "fill" : "regular"} aria-hidden className="relative" />
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-1">
            <Link
              href="/perfil"
              aria-current={pathname === "/perfil" ? "page" : undefined}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Avatar nome={me.nome} src={avatarUrl} fallbackSrc={gravatarUrl} size={32} />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" title={me.nome}>{me.nome}</p>
                <p className="text-xs text-muted-foreground truncate" title={papelLabel(me.role)}>{papelLabel(me.role)}</p>
              </div>
            </Link>
            {/* zona de usuário: perfil + sino + sair ficam juntos no desktop —
                não existe top bar pra abrigar o sino fora da sidebar */}
            <NotificacoesBell side="right" align="end" />
          </div>
          <form action={signOut}>
            <button type="submit" className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
              <SignOut size={18} aria-hidden />
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* tabIndex=-1: o skip-link consegue mover o foco pro main, não só rolar */}
      <main id="conteudo" tabIndex={-1} className="flex-1 min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:ml-56 md:pb-0">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:py-8">
          {children}
          <SiteFooter className="mt-14 border-t border-border pt-5" />
        </div>
      </main>

      {/* bottom nav — só mobile */}
      <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:hidden">
        <div className="flex">
          {items.map((item) => {
            const ativo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
                  ativo ? "font-semibold text-[var(--brand-ink)]" : "font-medium text-sidebar-foreground/75 active:text-sidebar-foreground"
                )}
              >
                {/* continuidade espacial: o indicador desliza entre tabs na
                    troca de rota em vez de sumir/reaparecer (§2) */}
                {ativo && (
                  <motion.span
                    layoutId="nav-bottom"
                    transition={T.pill}
                    aria-hidden
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-[var(--brand-lime)]"
                  />
                )}
                <item.icon size={20} weight={ativo ? "fill" : "regular"} aria-hidden />
                {item.curto}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
    </NotificacoesProvider>
  );
}



function papelCurto(role: string | null) {
  switch (role) {
    case "supervisor": return "Supervisor";
    case null:
    case "": return "";
    default: return papelLabel(role);
  }
}
