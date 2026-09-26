"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  CalendarDots,
  ChartLineUp,
  ClipboardText,
  DotsThree,
  FolderOpen,
  ListChecks,
  SignOut,
  UserCircle,
  UsersThree,
} from "@phosphor-icons/react";
import { signOut } from "@/lib/actions";
import { papelCurto, papelLabel } from "@/lib/ciclo";
import { Avatar } from "@/components/avatar";
import { T } from "@/components/motion";
import { NotificacoesBell, NotificacoesProvider } from "@/components/notificacoes";
import { SiteFooter } from "@/components/site-footer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Notificacao, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Visão geral", curto: "Início", icon: ChartLineUp, roles: null },
  { href: "/duplas", label: "Duplas", curto: "Duplas", icon: UserCircle, roles: ["coordenacao", "supervisor", "mentor_dpp", "mentor_especialista"] },
  { href: "/registros", label: "Registros", curto: "Registros", icon: ClipboardText, roles: ["coordenacao", "supervisor"] },
  { href: "/agenda", label: "Agenda", curto: "Agenda", icon: CalendarDots, roles: null },
  { href: "/materiais", label: "Materiais", curto: "Materiais", icon: FolderOpen, roles: null },
  { href: "/formularios", label: "Formulários", curto: "Forms", icon: ListChecks, roles: ["coordenacao"] },
  { href: "/pessoas", label: "Pessoas", curto: "Pessoas", icon: UsersThree, roles: ["coordenacao"] },
] as const;

export function AppShell({
  me,
  avatarUrl,
  gravatarUrl,
  notificacoes,
  demo,
  children,
}: {
  me: Profile;
  avatarUrl: string | null;
  gravatarUrl: string;
  notificacoes: { itens: Notificacao[]; naoLidas: number };
  /** pill compacta da DemoBar dockada no header mobile (substitui o span de
   *  papel — sempre visível e sem cobrir conteúdo) */
  demo?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = NAV.filter((i) => !i.roles || (me.role && (i.roles as readonly string[]).includes(me.role)));
  const [abertoMais, setAbertoMais] = useState(false);

  // nav mobile com no máx. 5 cells — só a coordenação passa disso (7 itens).
  // Primárias = rotina diária da operação (Início/Duplas/Pessoas/Agenda);
  // leitura consolidada (Registros) e gestão menos diária (Materiais/
  // Formulários) ficam a 1 toque no "Mais". A ordem da sidebar desktop não
  // muda — a prioridade mobile é só do bottom nav.
  const MOBILE_PRIMEIRO = [
    "/",
    "/duplas",
    "/pessoas",
    "/agenda",
    "/registros",
    "/materiais",
    "/formularios",
  ];
  const itemsMobile =
    items.length > 5
      ? [...items].sort(
          (a, b) =>
            MOBILE_PRIMEIRO.indexOf(a.href) - MOBILE_PRIMEIRO.indexOf(b.href)
        )
      : items;
  const visiveis = items.length > 5 ? itemsMobile.slice(0, 4) : items;
  const overflow = items.length > 5 ? itemsMobile.slice(4) : [];
  const maisAtivo = overflow.some((i) => pathname.startsWith(i.href));

  // navegar pelo popover (ou por fora) fecha o Mais — ajuste durante o
  // render (padrão "props mudaram", igual ao provider de notificações)
  const [ultimoPath, setUltimoPath] = useState(pathname);
  if (pathname !== ultimoPath) {
    setUltimoPath(pathname);
    setAbertoMais(false);
  }

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

      {/* top bar — só mobile; min-h + safe-area: com viewportFit=cover o
          sticky top-0 ficaria sob o notch em standalone */}
      <header className="sticky top-0 z-40 flex min-h-14 items-center justify-between border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur md:hidden">
        <div className="flex min-w-0 items-center gap-3">
          {/* convenção logo→home; min-h-11 garante os 44px de toque */}
          <Link href="/" className="flex min-h-11 shrink-0 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-realiza.png" alt="Realiza.vc" className="h-5 w-auto" />
          </Link>
          {demo ?? (
            <span className="text-xs text-muted-foreground truncate max-w-44" title={papelCurto(me.role)}>
              {papelCurto(me.role)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <NotificacoesBell side="bottom" align="end" />
          <Link
            href="/perfil"
            aria-label="Meu perfil"
            aria-current={pathname === "/perfil" ? "page" : undefined}
            className="grid size-11 place-items-center rounded-lg transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Avatar nome={me.nome} src={avatarUrl} fallbackSrc={gravatarUrl} size={28} />
          </Link>
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

        <div className="border-t border-sidebar-border px-3 pb-4 pt-4">
          <div className="flex items-center gap-1">
            <Link
              href="/perfil"
              aria-current={pathname === "/perfil" ? "page" : undefined}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
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
            <button type="submit" className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
              <SignOut size={18} aria-hidden />
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* coluna de conteúdo: único filho in-flow do flex row no desktop —
          md:ml-56 e flex-1 min-w-0 moram aqui pra main e footer não
          disputarem largura na row; no mobile é um flex-col comum */}
      <div className="flex min-w-0 flex-1 flex-col md:ml-56">
        {/* tabIndex=-1: o skip-link consegue mover o foco pro main, não só rolar;
            flex-1 empurra o footer pro rodapé quando a página é curta */}
        <main id="conteudo" tabIndex={-1} className="flex-1">
          {/* medida de scan: 5xl até xl, abre um degrau por breakpoint —
              7xl é o teto absoluto (linha longa demais quebra a leitura) */}
          <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 md:py-8 xl:max-w-6xl 2xl:max-w-7xl">
            {children}
          </div>
        </main>
        {/* footer ink full-bleed, último filho da coluna: fora do <main> —
            dentro ele não expõe o landmark contentinfo — e fora do wrapper
            max-w-5xl pra faixa escura ir de md:ml-56 até a borda direita;
            o padding-bottom mobile mora dentro do bloco (encosta na
            bottom-nav) */}
        <SiteFooter tone="ink" />
      </div>

      {/* bottom nav — só mobile */}
      <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:hidden">
        <div className="flex">
          {visiveis.map((item) => {
            const ativo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
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
          {overflow.length > 0 && (
            <Popover open={abertoMais} onOpenChange={setAbertoMais}>
              <PopoverTrigger
                aria-label={maisAtivo ? `Mais seções, seção atual em ${overflow.find((i) => pathname.startsWith(i.href))?.label}` : "Mais seções"}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                  maisAtivo ? "font-semibold text-[var(--brand-ink)]" : "font-medium text-sidebar-foreground/75 active:text-sidebar-foreground"
                )}
              >
                {/* a rota atual mora no overflow → o indicador viaja pra cell
                    Mais e ela veste o estilo ativo */}
                {maisAtivo && (
                  <motion.span
                    layoutId="nav-bottom"
                    transition={T.pill}
                    aria-hidden
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-[var(--brand-lime)]"
                  />
                )}
                <DotsThree size={20} weight={maisAtivo ? "bold" : "regular"} aria-hidden />
                Mais
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="end"
                sideOffset={8}
                className="w-56 p-1.5"
              >
                <ul>
                  {overflow.map((item) => {
                    const ativo = pathname.startsWith(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={ativo ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors outline-none focus-visible:bg-muted",
                            ativo
                              ? "font-semibold text-[var(--brand-ink)]"
                              : "text-foreground/80 hover:bg-muted"
                          )}
                        >
                          <item.icon size={18} weight={ativo ? "fill" : "regular"} aria-hidden />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </nav>
    </div>
    </NotificacoesProvider>
  );
}
