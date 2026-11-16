"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ImageSquare, type Icon } from "@phosphor-icons/react";
import { cn } from "cn";

/** Um item do passo "O que você pode fazer aqui" do onboarding — a
 *  feature na linguagem do papel + o print da tela real onde ela
 *  acontece. `img` é o nome-base do arquivo em public/onboarding
 *  (scripts/capturar-onboarding.mjs): `<img>.webp` é a coluna de
 *  conteúdo no desktop, `<img>-m.webp` a tela do celular. Sem `img` o
 *  item fica só como texto. */
export type RecursoTour = {
  icon: Icon;
  texto: string;
  img?: string;
  alt?: string;
};

const printDesktop = (img: string) => `/onboarding/${img}.webp`;
const printMobile = (img: string) => `/onboarding/${img}-m.webp`;

/** 1px transparent gif — <img> fallback when the <source media> doesn't
 *  match, so the other breakpoint downloads zero bytes (see PrintShot). */
const PIXEL_VAZIO =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Screen print pinned to one breakpoint: the <source media> only supplies
 *  the file where it actually renders — elsewhere the <img> falls back to
 *  the empty pixel and never hits the network. Plain <img> (no next/image):
 *  the files are captured at the exact display size, and the old `priority`
 *  eagerly fetched the ~100KB DESKTOP print inside a `hidden` figure on
 *  mobile (and the mobile one on desktop). eager/high on the active shot is
 *  now safe — on the wrong breakpoint it resolves to the pixel, not bytes. */
function PrintShot({
  src,
  media,
  ativo,
  alt,
}: {
  src: string;
  /** media query of the breakpoint that uses this print */
  media: string;
  ativo: boolean;
  alt: string;
}) {
  return (
    <picture className="contents">
      <source media={media} srcSet={src} />
      <img
        src={PIXEL_VAZIO}
        alt={alt}
        loading={ativo ? "eager" : "lazy"}
        fetchPriority={ativo ? "high" : "auto"}
        className={cn(
          "absolute inset-0 size-full object-cover object-top transition-opacity duration-300",
          ativo ? "opacity-100" : "opacity-0"
        )}
      />
    </picture>
  );
}

/** Moldura de "janela de navegador" pros prints de tela reais — os três
 *  pontinhos vendem "isso é o produto de verdade" sem custar copy. */
function MolduraTela({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-border",
        className
      )}
    >
      <div
        aria-hidden
        className="flex items-center gap-1.5 border-b border-border/60 bg-muted/60 px-3 py-2"
      >
        <span className="size-2 rounded-full bg-border" />
        <span className="size-2 rounded-full bg-border" />
        <span className="size-2 rounded-full bg-border" />
      </div>
      {children}
    </div>
  );
}

/** Passo "O que você pode fazer aqui" — a lista interativa de features com
 *  o print da tela real de cada uma. Compartilhado entre o wizard de staff
 *  (OnboardingFlow, acento lima) e o do jovem (OnboardingJovem, acento
 *  amarelo --role-mentorado): o acento chega por --rec-acento/
 *  --rec-acento-text no wrapper, então os dois usam o mesmo desenho. */
export function PassoRecursos({
  recursos,
  acento = "var(--brand-lime)",
  acentoTexto = "var(--brand-ink)",
}: {
  recursos: RecursoTour[];
  /** cor do estado ativo (borda, fundo do item, disco do ícone) */
  acento?: string;
  /** tinta sobre o acento cheio */
  acentoTexto?: string;
}) {
  // feature whose screen illustrates the "what you can do" step — hover,
  // focus or tap on a row swaps the shot (last gesture wins); on mobile the
  // frame pins under the header so the tap feedback stays in view
  const [recursoAtivo, setRecursoAtivo] = useState(() =>
    Math.max(0, recursos.findIndex((r) => r.img))
  );
  // só o ativo e o anterior ficam montados — o crossfade de 300ms precisa
  // dos dois, mas cada webp conta request: sem o recorte todas as imgs do
  // papel baixavam ao entrar no passo
  const [recursoAnterior, setRecursoAnterior] = useState(recursoAtivo);
  useEffect(() => {
    const t = setTimeout(() => setRecursoAnterior(recursoAtivo), 350);
    return () => clearTimeout(t);
  }, [recursoAtivo]);

  const ativo = recursos[recursoAtivo];
  return (
    <div
      className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-start sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)]"
      style={
        {
          "--rec-acento": acento,
          "--rec-acento-text": acentoTexto,
        } as CSSProperties
      }
    >
      {/* mobile: the frame pins under the fixed header while the list
          scrolls beneath — a tap swaps the shot in place, no layout
          shift. The band is opaque and edge-to-edge (-mx-4 cancels the
          page gutter) so rows slide under it without peeking through
          the gap to the header */}
      {ativo?.img && (
        <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 bg-background px-4 pb-3 pt-2 sm:hidden">
          {/* portrait shot at its native 3:4 — height-driven so the
              whole capture shows uncropped (width follows the ratio);
              object-top keeps the app chrome in frame on any drift */}
          <div className="relative mx-auto aspect-[3/4] h-[clamp(11rem,42dvh,16rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-border" aria-live="polite">
            {recursos.map(
              (r, i) =>
                r.img &&
                (i === recursoAtivo || i === recursoAnterior) && (
                  <PrintShot
                    key={`m-${r.img}`}
                    src={printMobile(r.img)}
                    media="(max-width: 639.98px)"
                    ativo={i === recursoAtivo}
                    alt={i === recursoAtivo ? (r.alt ?? "") : ""}
                  />
                )
            )}
          </div>
        </div>
      )}
      <ul className="space-y-2">
        {recursos.map((r, i) => {
          const aceso = !!r.img && i === recursoAtivo;
          const cartao = cn(
            "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left outline-none transition-colors sm:px-4 sm:py-3",
            aceso
              ? "border-[var(--rec-acento)] bg-[var(--rec-acento)]/10"
              : cn(
                  "border-border bg-card",
                  r.img && "hover:border-foreground/40"
                )
          );
          const conteudo = (
            <>
              {/* o disco é sinal de estado (mesma regra do CaixaSelecao):
                  neutro no repouso, aceso no ativo */}
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
                  aceso
                    ? "bg-[var(--rec-acento)] text-[var(--rec-acento-text)]"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <r.icon size={18} weight="fill" aria-hidden />
              </span>
              <span className="text-sm leading-snug">{r.texto}</span>
              {/* the small screen icon marks which rows have a shot to
                  preview — a caret read as a dropdown that never opened */}
              {r.img && (
                <ImageSquare
                  size={16}
                  aria-hidden
                  className={cn(
                    "ml-auto shrink-0 transition-colors",
                    aceso ? "text-foreground" : "text-muted-foreground/70"
                  )}
                />
              )}
            </>
          );
          return (
            <li key={r.texto}>
              {r.img ? (
                <button
                  type="button"
                  onMouseEnter={() => setRecursoAtivo(i)}
                  onFocus={() => setRecursoAtivo(i)}
                  onClick={() => setRecursoAtivo(i)}
                  aria-current={aceso || undefined}
                  className={cn(
                    cartao,
                    "cursor-pointer focus-visible:ring-2 focus-visible:ring-ring/60"
                  )}
                >
                  {conteudo}
                </button>
              ) : (
                <div className={cartao}>{conteudo}</div>
              )}
            </li>
          );
        })}
      </ul>
      {/* desktop: a coluna de conteúdo da tela real ao lado, com
          crossfade — capturada a 876px, sai perto do tamanho real */}
      {ativo?.img && (
        // a largura acompanha a altura da janela (24rem = header,
        // balão e footer fixos): em 1280×720 a moldura passava do
        // footer e a página rolava; assim a proporção do print se mantém
        <figure className="hidden sm:sticky sm:top-20 sm:block sm:max-w-[calc((100dvh-24rem)*73/60)]">
          <MolduraTela>
            <div className="relative aspect-[73/60]" aria-live="polite">
              {recursos.map(
                (r, i) =>
                  r.img &&
                  (i === recursoAtivo || i === recursoAnterior) && (
                    <PrintShot
                      key={r.img}
                      src={printDesktop(r.img)}
                      media="(min-width: 640px)"
                      ativo={i === recursoAtivo}
                      alt={i === recursoAtivo ? (r.alt ?? "") : ""}
                    />
                  )
              )}
            </div>
          </MolduraTela>
          <figcaption className="mt-2 px-1 text-xs text-muted-foreground">
            {ativo.alt}
          </figcaption>
        </figure>
      )}
    </div>
  );
}
