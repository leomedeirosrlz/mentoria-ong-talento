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
      className="flex items-center gap-3 rounded-xl border border-[var(--warn)]/50 bg-[var(--warn)]/8 px-4 py-3 text-sm transition-colors hover:bg-[var(--warn)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CalendarDots
        size={18}
        aria-hidden
        className="shrink-0 text-[var(--warn-text)]"
      />
      <span className="min-w-0 flex-1">
        <span className="font-medium">Conta quando você pode</span>
        <span className="text-muted-foreground">
          {" "}
          · seus dias e horários livres ajudam a achar um horário em comum
          com seu mentor.
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
