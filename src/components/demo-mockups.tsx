"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Flask, X } from "@phosphor-icons/react";
import { MOCKUP_TELAS, parseMockupParam } from "@/lib/demo/mockups";
import { cn } from "@/lib/utils";

/** Seção "Layouts em teste" no popover da DemoBar — catálogo das telas com
 *  as 3 variantes de cada uma. Abre o mockup por ?mockup=<tela>:v<N>, que o
 *  MockupViewer renderiza em tela cheia por cima do app. */
export function MockupsSection() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function abrir(tela: string, variante: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mockup", `${tela}:v${variante}`);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="border-t border-border px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <Flask size={12} aria-hidden />
        Layouts em teste
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        3 propostas por tela — abre por cima do app, sem sair da demo.
      </p>
      <div className="mt-2.5 space-y-2">
        {MOCKUP_TELAS.map((tela) => (
          <div key={tela.id} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {tela.label}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {tela.descricao}
              </span>
            </div>
            <div className="flex shrink-0 gap-1">
              {[1, 2, 3].map((v) => (
                <button
                  key={v}
                  type="button"
                  title={tela.variantes[v - 1]}
                  onClick={() => abrir(tela.id, v)}
                  className="grid min-h-9 min-w-9 place-items-center rounded-lg border border-border text-xs font-semibold outline-none transition-colors hover:bg-muted focus-visible:bg-muted"
                >
                  v{v}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Viewer em tela cheia do mockup selecionado via ?mockup=<tela>:v<N>.
 *  Montado pelos layouts (app)/(jovem) só quando a demo está ativa — fora
 *  dela o param é ignorado. A barra superior troca de variante e devolve
 *  pro app (remove o param, o conteúdo real volta sem reload). */
export function MockupViewer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ativo = parseMockupParam(searchParams.get("mockup"));
  if (!ativo) return null;
  const { tela, variante } = ativo;

  function navegar(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("mockup", value);
    else params.delete("mockup");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-[var(--brand-ink)] px-3 py-2 text-white sm:gap-3 sm:px-4">
        <span className="flex items-center gap-1.5 rounded-full bg-[var(--brand-lime)] px-2 py-0.5 text-[11px] font-bold text-[var(--brand-ink)]">
          <Flask size={11} weight="bold" aria-hidden />
          MOCKUP
        </span>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {tela.label}
            <span className="font-normal text-white/70">
              {" "}
              · {tela.variantes[variante - 1]}
            </span>
          </span>
        </div>
        <div
          role="group"
          aria-label="Variante do mockup"
          className="flex shrink-0 gap-1"
        >
          {[1, 2, 3].map((v) => (
            <button
              key={v}
              type="button"
              aria-current={v === variante || undefined}
              title={tela.variantes[v - 1]}
              onClick={() => navegar(`${tela.id}:v${v}`)}
              className={cn(
                "grid min-h-9 min-w-9 place-items-center rounded-lg text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)]",
                v === variante
                  ? "bg-[var(--brand-lime)] text-[var(--brand-ink)]"
                  : "bg-white/10 text-white hover:bg-white/20",
              )}
            >
              v{v}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => navegar(null)}
          className="grid min-h-9 shrink-0 place-items-center gap-1 rounded-lg bg-white/10 px-2.5 text-xs font-semibold outline-none transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)] sm:px-3"
        >
          <span className="hidden sm:inline">Voltar ao app</span>
          <X size={14} weight="bold" aria-hidden className="sm:hidden" />
        </button>
      </div>
      <iframe
        key={`${tela.id}-v${variante}`}
        src={`/demo/mockups/${tela.id}/v${variante}.html`}
        title={`Mockup ${tela.label} — variante ${variante}`}
        className="min-h-0 flex-1 border-0"
      />
    </div>
  );
}
