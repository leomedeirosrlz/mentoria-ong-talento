"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Flask, X } from "@phosphor-icons/react";
import {
  MOCKUP_TELAS,
  parseMockupParam,
  rotuloVariante,
  telaPorRota,
} from "@/lib/demo/mockups";
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
        Propostas de layout por tela — abrem por cima da demo.
      </p>
      <div className="mt-2.5 space-y-2">
        {MOCKUP_TELAS.map((tela) => (
          <div key={tela.id} className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <div className="min-w-0 flex-1 basis-40">
              <span className="block truncate text-sm font-medium">
                {tela.label}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {tela.descricao}
              </span>
            </div>
            <div className="flex shrink-0 gap-1">
              {tela.variantes.map((nome, i) => (
                <button
                  key={i}
                  type="button"
                  title={nome}
                  onClick={() => abrir(tela.id, i + 1)}
                  className="grid min-h-9 min-w-9 place-items-center rounded-lg border border-border px-2 text-xs font-semibold outline-none transition-colors hover:bg-muted focus-visible:bg-muted"
                >
                  {rotuloVariante(tela, i + 1)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Switch na própria tela — aparece nas rotas que têm mockup associado
 *  (agenda → /agenda, duplas → /duplas etc.) quando a demo está ativa.
 *  Pill segmentada "App | v1 | v2 | v3" flutuando acima do bottom nav;
 *  escolher uma variante abre o MockupViewer por cima. Escondido enquanto
 *  o overlay está aberto — a barra dele já troca de variante. */
function MockupViewToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tela = telaPorRota(pathname);
  const ativo = parseMockupParam(searchParams.get("mockup"));
  if (!tela || ativo) return null;

  function selecionar(variante: number | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (variante) params.set("mockup", `${tela!.id}:v${variante}`);
    else params.delete("mockup");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div
      role="group"
      aria-label={`Propostas de layout — ${tela.label}`}
      /* acima do bottom nav mobile (4.75rem = altura do nav + folga),
         centrado pra não disputar o canto com a pill da DemoBar */
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 md:bottom-6"
    >
      <div className="flex items-center gap-0.5 rounded-full border border-border bg-card p-1 shadow-lg">
        <span className="hidden pl-2.5 pr-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline">
          {tela.label}
        </span>
        <button
          type="button"
          aria-pressed={!ativo}
          onClick={() => selecionar(null)}
          className="min-h-9 rounded-full bg-[var(--brand-ink)] px-3 text-xs font-semibold text-white outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
        >
          App
        </button>
        {tela.variantes.map((nome, i) => (
          <button
            key={i}
            type="button"
            title={nome}
            onClick={() => selecionar(i + 1)}
            className="min-h-9 rounded-full px-3 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {rotuloVariante(tela, i + 1)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Ponto único de montagem nos layouts — switch da tela + overlay. */
export function DemoMockups() {
  return (
    <>
      <MockupViewToggle />
      <MockupViewer />
    </>
  );
}

/** Viewer em tela cheia do mockup selecionado via ?mockup=<tela>:v<N>.
 *  Montado pelos layouts (app)/(jovem) só quando a demo está ativa — fora
 *  dela o param é ignorado. A barra superior troca de variante e devolve
 *  pro app (remove o param, o conteúdo real volta sem reload). */
export function MockupViewer({ voltarLabel = "Voltar ao app" }: { voltarLabel?: string }) {
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
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-[var(--brand-ink)] px-3 py-2 text-white sm:gap-3 sm:px-4">
        <span className="flex items-center gap-1.5 rounded-full bg-[var(--brand-lime)] px-2 py-0.5 text-[11px] font-bold text-[var(--brand-ink)]">
          <Flask size={11} weight="bold" aria-hidden />
          MOCKUP
        </span>
        {/* seletor de tela — troca de mockup sem sair do viewer (o "menu da
            demo" dentro do mockup) */}
        <select
          aria-label="Tela do mockup"
          value={tela.id}
          onChange={(e) => navegar(
              `${e.target.value}:v${MOCKUP_TELAS.find((t) => t.id === e.target.value)?.final ?? 1}`,
            )}
          className="min-h-9 w-28 shrink-0 cursor-pointer truncate rounded-lg bg-white/10 px-2 text-sm font-semibold text-white outline-none transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)] sm:w-auto sm:min-w-36"
        >
          {MOCKUP_TELAS.map((t) => (
            <option key={t.id} value={t.id} className="text-foreground">
              {t.label}
            </option>
          ))}
        </select>
        <span className="hidden min-w-0 flex-1 truncate text-xs text-white/70 lg:inline">
          {tela.variantes[variante - 1]}
        </span>
        <div
          role="group"
          aria-label="Variante do mockup"
          className="flex shrink-0 gap-1"
        >
          {tela.variantes.map((nome, i) => (
            <button
              key={i}
              type="button"
              aria-current={i + 1 === variante || undefined}
              title={nome}
              onClick={() => navegar(`${tela.id}:v${i + 1}`)}
              className={cn(
                "grid min-h-9 min-w-9 shrink-0 place-items-center rounded-lg px-2 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)]",
                i + 1 === variante
                  ? "bg-[var(--brand-lime)] text-[var(--brand-ink)]"
                  : "bg-white/10 text-white hover:bg-white/20",
              )}
            >
              {rotuloVariante(tela, i + 1)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => navegar(null)}
          className="grid min-h-9 shrink-0 place-items-center gap-1 rounded-lg bg-white/10 px-2.5 text-xs font-semibold outline-none transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)] sm:px-3"
        >
          <span className="hidden sm:inline">{voltarLabel}</span>
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
