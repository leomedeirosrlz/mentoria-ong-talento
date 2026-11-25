import Link from "next/link";
import { ArrowRight, CalendarDots } from "@phosphor-icons/react/dist/ssr";

/** Faixa "disponibilidade pendente" da home do jovem (REALIZA-114) — a
 *  página decide quando mostrar (grade null ou sem dia); aqui é só o
 *  visual. O lembrete é permanente e não-dismissível: sem a grade o
 *  cruzamento da agenda não encontra horário em comum com o mentor.
 *  Clica o card inteiro: uma ação só — preencher no Perfil. */
export function LembreteDisponibilidade() {
  return (
    <Link
      href="/jovem/perfil"
      className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-[var(--shadow-border)] transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CalendarDots
        size={18}
        aria-hidden
        className="shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">Conte quando você pode</span>
        <span className="block text-xs text-muted-foreground">
          Ajuda a achar um horário em comum com seu mentor.
        </span>
      </span>
      <ArrowRight
        size={15}
        aria-hidden
        className="shrink-0 text-muted-foreground"
      />
    </Link>
  );
}
