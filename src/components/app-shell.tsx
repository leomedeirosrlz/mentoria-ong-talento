"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDots,
  ChartLineUp,
  FolderOpen,
  SignOut,
  UserCircle,
  UsersThree,
} from "@phosphor-icons/react";
import { signOut } from "@/lib/actions";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Visao geral", icon: ChartLineUp, roles: null },
  { href: "/duplas", label: "Duplas", icon: UserCircle, roles: ["coordenacao", "supervisor"] },
  { href: "/agenda", label: "Agenda do ciclo", icon: CalendarDots, roles: null },
  { href: "/materiais", label: "Materiais", icon: FolderOpen, roles: null },
  { href: "/pessoas", label: "Pessoas", icon: UsersThree, roles: ["coordenacao"] },
] as const;

export function AppShell({ me, children }: { me: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const items = NAV.filter((i) => !i.roles || (me.role && (i.roles as readonly string[]).includes(me.role)));

  return (
    <div className="min-h-[100dvh] flex">
      <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col fixed inset-y-0">
        <div className="px-5 pt-6 pb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-realiza.png" alt="Realiza.vc" className="h-6 w-auto" />
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mt-2">Programa de mentoria</p>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {items.map((item) => {
            const ativo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  ativo
                    ? "bg-[var(--brand-lime)] text-sidebar-primary-foreground font-semibold"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon size={18} weight={ativo ? "fill" : "regular"} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="px-2 py-2">
            <p className="text-sm font-medium truncate">{me.nome}</p>
            <p className="text-xs text-muted-foreground truncate">{papelLabel(me.role)}</p>
          </div>
          <form action={signOut}>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
              <SignOut size={18} />
              Sair
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 ml-60 min-w-0">
        <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}

export function papelLabel(role: string | null) {
  switch (role) {
    case "coordenacao": return "Coordenacao";
    case "supervisor": return "Supervisor de relacionamento";
    case "mentor_dpp": return "Mentor DPP";
    case "mentor_especialista": return "Mentor especialista";
    default: return "Sem papel definido";
  }
}
