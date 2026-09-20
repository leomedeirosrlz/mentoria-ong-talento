import Link from "next/link";
import type { CSSProperties } from "react";
import { Check } from "@phosphor-icons/react/dist/ssr";

type Passo = {
  texto: string;
  feito: boolean;
  /** Passo que a coordenação resolve agora — sub-linha é o link da ação. */
  link?: { href: string; label: string };
  /** Passo que depende da dupla/mentor — sub-linha só explica de quem é a vez. */
  dica?: string;
};

/** Checklist de setup da coordenação — dirigido por dado, não por dismiss.
 *  Cada passo lê uma contagem real; quando as 4 passam de zero o card retorna
 *  null e some sozinho. Não existe "pular" nem "fechar": só sai fazendo. */
export function SetupChecklist({
  pessoas,
  duplas,
  encontros,
  registros,
}: {
  pessoas: number;
  duplas: number;
  encontros: number;
  registros: number;
}) {
  const passos: Passo[] = [
    {
      texto: "Cadastre pessoas",
      feito: pessoas > 0,
      link: { href: "/pessoas", label: "Importar CSV ou cadastrar" },
    },
    {
      texto: "Forme a primeira dupla",
      feito: duplas > 0,
      // o link nomeia o botão do destino ("Nova dupla" em /duplas), não repete o passo
      link: { href: "/duplas", label: "Nova dupla" },
    },
    {
      texto: "Primeiro encontro agendado",
      feito: encontros > 0,
      dica: "A dupla agenda pelo WhatsApp ou aqui",
    },
    {
      texto: "Primeiro registro",
      feito: registros > 0,
      dica: "O mentor registra após o encontro",
    },
  ];

  if (passos.every((p) => p.feito)) return null;

  return (
    <section
      aria-label="Começar por aqui"
      className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Começar por aqui
      </p>
      <ol className="mt-3 space-y-3">
        {passos.map((passo, i) => (
          <li
            key={passo.texto}
            className="animate-enter flex items-start gap-3"
            style={{ "--i": Math.min(i, 10) } as CSSProperties}
          >
            <span
              aria-hidden
              className={
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full " +
                (passo.feito ? "bg-[var(--brand-lime)]" : "bg-muted")
              }
            >
              {passo.feito ? (
                <Check size={12} weight="bold" className="text-[var(--brand-ink)]" />
              ) : (
                <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
              )}
            </span>
            <div className="min-w-0">
              <p
                className={
                  "text-sm " +
                  (passo.feito ? "text-muted-foreground line-through" : "font-medium")
                }
              >
                {passo.feito && <span className="sr-only">Concluído: </span>}
                {passo.texto}
              </p>
              {!passo.feito && passo.link && (
                <Link
                  href={passo.link.href}
                  className="inline-flex min-h-11 items-center text-xs font-medium text-foreground underline underline-offset-2 transition-colors hover:text-muted-foreground md:min-h-8"
                >
                  {passo.link.label}
                </Link>
              )}
              {!passo.feito && passo.dica && (
                <p className="text-xs italic text-muted-foreground/70">{passo.dica}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
