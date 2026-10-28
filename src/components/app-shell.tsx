"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  CalendarDots,
  ChalkboardTeacher,
  ChartLineUp,
  ClipboardText,
  FolderOpen,
  Lifebuoy,
  List,
  ListChecks,
  Table,
  UserCircle,
  UsersThree,
} from "@phosphor-icons/react";
import { papelCurto, papelLabel } from "@/lib/ciclo";
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

/** Seção de trabalho da sidebar. Visão geral fica sem grupo (null). */
type Grupo = "Acompanhar" | "Programa" | "Dados";

// a ordem do array é a ordem de exibição dentro de cada grupo
const NAV = [
  { href: "/", label: "Visão geral", curto: "Início", icon: ChartLineUp, roles: null, grupo: null },
  { href: "/duplas", label: "Duplas", curto: "Duplas", icon: UserCircle, roles: ["coordenacao", "supervisor", "mentor_dpp", "mentor_especialista"], grupo: "Acompanhar" },
  { href: "/agenda", label: "Agenda", curto: "Agenda", icon: CalendarDots, roles: null, grupo: "Acompanhar" },
  // 0084: a fila de chamados é casa nova da coordenação/auxiliar — badge =
  // chamados sem dono (quem assumir primeiro trata)
  { href: "/chamados", label: "Chamados", curto: "Chamados", icon: Lifebuoy, roles: ["coordenacao", "supervisor"], grupo: "Acompanhar" },
  { href: "/materiais", label: "Materiais", curto: "Materiais", icon: FolderOpen, roles: null, grupo: "Programa" },
  { href: "/formularios", label: "Formulários", curto: "Forms", icon: ListChecks, roles: ["coordenacao"], grupo: "Programa" },
  { href: "/turmas", label: "Turmas", curto: "Turmas", icon: ChalkboardTeacher, roles: ["coordenacao"], grupo: "Programa" },
  { href: "/registros", label: "Registros", curto: "Registros", icon: ClipboardText, roles: ["coordenacao", "supervisor"], grupo: "Dados" },
  { href: "/relatorios", label: "Relatórios", curto: "Relatórios", icon: Table, roles: ["coordenacao"], grupo: "Dados" },
  { href: "/pessoas", label: "Pessoas", curto: "Pessoas", icon: UsersThree, roles: ["coordenacao", "supervisor", "mentor_dpp", "mentor_especialista"], grupo: "Dados" },
] as const;

type Item = (typeof NAV)[number];
type Secao<T> = { titulo: Grupo | null; itens: T[] };

const GRUPOS: readonly (Grupo | null)[] = [null, "Acompanhar", "Programa", "Dados"];

/** Agrupa por trabalho, na ordem fixa dos grupos (a ordem dos itens vem da NAV). */
function porGrupo<T extends { grupo: Grupo | null }>(itens: readonly T[]): Secao<T>[] {
  return GRUPOS.map((titulo) => ({
    titulo,
    itens: itens.filter((i) => i.grupo === titulo),
  })).filter((s) => s.itens.length > 0);
}

// até 7 itens a lista é simples (supervisor = 7, mentor = 5); acima disso,
// só a coordenação, e ela agrupa por trabalho
const LIMITE_LISTA_SIMPLES = 7;

/** A lista de navegação agrupada — a mesma na sidebar do desktop e no
 *  menu lateral do celular. `pill` nomeia o layoutId do indicador ativo
 *  (cada superfície tem o seu: os dois coexistem no DOM). */
function NavLista({
  secoes,
  pathname,
  chamadosSemDono,
  pill,
}: {
  secoes: Secao<Item>[];
  pathname: string;
  chamadosSemDono: number;
  pill: string;
}) {
  return (
    <>
      {secoes.map((secao) => (
        // mais espaço acima do título de grupo do que abaixo: o título
        // fica preso ao grupo que ele nomeia
        <div key={secao.titulo ?? "geral"} className="mt-5 space-y-1 first:mt-0">
          {secao.titulo && (
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {secao.titulo}
            </p>
          )}
          {secao.itens.map((item) => {
            const ativo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-0",
                  ativo
                    ? "text-[var(--brand-ink)] font-semibold"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                {/* continuidade espacial: a pill viaja pra nova seção na troca
                    de rota — o AppShell persiste entre páginas (§2) */}
                {ativo && (
                  <motion.span
                    layoutId={pill}
                    transition={T.pill}
                    aria-hidden
                    className="absolute inset-0 -z-10 rounded-lg bg-[var(--brand-lime)]"
                  />
                )}
                <item.icon size={18} weight={ativo ? "fill" : "regular"} aria-hidden className="relative" />
                <span className="relative">{item.label}</span>
                {item.href === "/chamados" && chamadosSemDono > 0 && (
                  <span
                    aria-label={`${chamadosSemDono} chamados na fila`}
                    className="relative ml-auto grid min-w-5 place-items-center rounded-full bg-[var(--warn)]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--warn-text)]"
                  >
                    {chamadosSemDono}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}

/** Destinos fixos da barra do celular, em ordem de prioridade: o papel
 *  pega os 4 primeiros que ele tem. Coordenação e auxiliar ficam com
 *  Início/Duplas/Chamados/Agenda (chamado é trabalho diário com prazo);
 *  mentor, sem Chamados, ganha Materiais. O resto mora no menu lateral. */
const MOBILE_PRIMEIRO = ["/", "/duplas", "/chamados", "/agenda", "/materiais", "/pessoas"];

export function AppShell({
  me,
  avatarUrl,
  gravatarUrl,
  notificacoes,
  chamadosSemDono = 0,
  demo,
  assistente,
  children,
}: {
  me: Profile;
  avatarUrl: string | null;
  gravatarUrl: string;
  notificacoes: { itens: Notificacao[]; naoLidas: number };
  /** badge do item Chamados — fila sem dono (0084) */
  chamadosSemDono?: number;
  /** pill compacta da DemoBar dockada no header mobile (substitui o span de
   *  papel — sempre visível e sem cobrir conteúdo) */
  demo?: React.ReactNode;
  /** a bolha do assistente (AssistenteBolha) — montada no layout com o gate
   *  de papel resolvido; ausente pra quem não tem acesso */
  assistente?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = NAV.filter((i) => !i.roles || (me.role && (i.roles as readonly string[]).includes(me.role)));
  const [menuAberto, setMenuAberto] = useState(false);
  // rodapé da sidebar: a pílula "float" da demo se encaixa aqui no desktop
  const [slotDemo, setSlotDemo] = useState<HTMLDivElement | null>(null);

  // barra do celular: 4 destinos fixos do papel + Menu (a navegação inteira
  // num painel lateral — o drop-up "Mais" saiu, REALIZA-221)
  const visiveis = MOBILE_PRIMEIRO.map((href) => items.find((i) => i.href === href))
    .filter((i): i is Item => i != null)
    .slice(0, 4);
  const rotaNaBarra = visiveis.some((i) =>
    i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)
  );
  // a rota atual fora da barra (Registros, Turmas, Perfil…) acende o Menu
  const menuAtivo = !rotaNaBarra;
  const chamadosForaDaBarra =
    chamadosSemDono > 0 && !visiveis.some((i) => i.href === "/chamados");

  const agrupado = items.length > LIMITE_LISTA_SIMPLES;
  const secoesSidebar: Secao<Item>[] = agrupado
    ? porGrupo(items)
    : [{ titulo: null, itens: items }];

  // navegar pelo menu (ou por fora) fecha o painel — ajuste durante o
  // render (padrão "props mudaram", igual ao provider de notificações)
  const [ultimoPath, setUltimoPath] = useState(pathname);
  if (pathname !== ultimoPath) {
    setUltimoPath(pathname);
    setMenuAberto(false);
  }

  return (
    <NotificacoesProvider inicial={notificacoes}>
    <DemoSlotProvider alvo={slotDemo}>
    {/* coluna no mobile, linha no desktop — o flex sem gate é o que estica
        a coluna de conteúdo (flex-1) a 100dvh em qualquer viewport e põe o
        footer encostado na borda inferior em página curta (antes o flex só
        existia em md: e o footer flutuava no mobile) */}
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* skip-link: invisível até o primeiro Tab — teclado pula top bar + nav
          inteira e cai direto no <main id="conteudo"> */}
      <a
        href="#conteudo"
        className="pointer-events-none fixed left-4 top-3 z-50 inline-flex min-h-11 -translate-y-24 items-center rounded-lg bg-[var(--brand-lime)] px-4 text-sm font-semibold text-[var(--brand-ink)] opacity-0 shadow-[var(--shadow-border)] transition-[transform,opacity] duration-200 focus:pointer-events-auto focus:translate-y-0 focus:opacity-100"
      >
        Pular pro conteúdo
      </a>

      {/* top bar — só mobile; min-h + safe-area: com viewportFit=cover o
          sticky top-0 ficaria sob o notch em standalone */}
      <header className="sticky top-0 z-40 flex min-h-14 items-center justify-between border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur md:hidden">
        <div className="flex min-w-0 items-center gap-3">
          {/* convenção logo→home; min-h-11 garante os 44px de toque */}
          <Link href="/" className="flex min-h-11 shrink-0 items-center">
            <Logo size="sm" />
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
        <div className="px-5 pt-6 pb-6">
          {/* convenção logo→home, igual à top bar mobile */}
          <Link href="/" className="inline-block">
            <Logo />
          </Link>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mt-2">Programa de Mentoria Social</p>
        </div>

        {/* min-h-0 + overflow: com os grupos a lista passa da altura em telas
            baixas — ela rola e o rodapé (demo + usuário) fica sempre visível */}
        <nav aria-label="Navegação principal" className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">

          <NavLista
            secoes={secoesSidebar}
            pathname={pathname}
            chamadosSemDono={chamadosSemDono}
            pill="nav-side"
          />
        </nav>

        <div className="border-t border-sidebar-border px-3 pb-4 pt-4">
          {/* encaixe da pílula da demo (DemoBar float): vazio fora da demo,
              então não ocupa altura; em demo a pílula entra aqui, acima do usuário */}
          <div ref={setSlotDemo} />
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
          {/* em demo o signOut sai da demonstração — a sessão real dormente
              continua e o middleware devolve pro app logado */}
          <SignOutButton
            label={demo ? "Sair da demonstração" : "Sair"}
            className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          />
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
                  "group relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                  ativo ? "font-semibold text-sidebar-foreground" : "font-medium text-sidebar-foreground/75 active:text-sidebar-foreground"
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
                {/* press tactile no ícone — o scale do Button (0.96) adaptado
                    pro alvo pequeno da bottom-nav; :active não desce pro filho,
                    então o dip é group-active do link */}
                <item.icon
                  size={20}
                  weight={ativo ? "fill" : "regular"}
                  aria-hidden
                  className="transition-transform group-active:scale-90"
                />
                {item.curto}
              </Link>
            );
          })}
          <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
            <SheetTrigger
              aria-label={[
                menuAtivo ? "Menu, seção atual fora da barra" : "Menu",
                chamadosForaDaBarra ? `${chamadosSemDono} chamados na fila` : null,
              ].filter(Boolean).join(", ")}
              className={cn(
                "group relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                menuAtivo ? "font-semibold text-sidebar-foreground" : "font-medium text-sidebar-foreground/75 active:text-sidebar-foreground"
              )}
            >
              {/* a rota atual mora no menu → o indicador viaja pra cell
                  Menu e ela veste o estilo ativo */}
              {menuAtivo && (
                <motion.span
                  layoutId="nav-bottom"
                  transition={T.pill}
                  aria-hidden
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-[var(--brand-lime)]"
                />
              )}
              <span className="relative">
                <List
                  size={20}
                  weight={menuAtivo ? "bold" : "regular"}
                  aria-hidden
                  className="transition-transform group-active:scale-90"
                />
                {chamadosForaDaBarra && (
                  <span
                    aria-hidden
                    className="absolute -top-0.5 -right-1 size-2 rounded-full bg-[var(--warn)] ring-2 ring-sidebar"
                  />
                )}
              </span>
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
              <nav aria-label="Menu" className="flex-1 px-3 pb-3">
                <NavLista
                  secoes={secoesSidebar}
                  pathname={pathname}
                  chamadosSemDono={chamadosSemDono}
                  pill="nav-sheet"
                />
              </nav>
              <div className="border-t border-sidebar-border px-3 pt-3 pb-4">
                <Link
                  href="/perfil"
                  aria-current={pathname === "/perfil" ? "page" : undefined}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Avatar nome={me.nome} src={avatarUrl} fallbackSrc={gravatarUrl} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{me.nome}</span>
                    <span className="block truncate text-xs text-muted-foreground">{papelLabel(me.role)}</span>
                  </span>
                </Link>
                <SignOutButton
                  label={demo ? "Sair da demonstração" : "Sair"}
                  className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* bolha do assistente: depois da bottom-nav pra ganhar o empate de
          z-40 na ordem do DOM; fica sob qualquer sheet/dialog (z-50) */}
      {assistente}
    </div>
    </DemoSlotProvider>
    </NotificacoesProvider>
  );
}
