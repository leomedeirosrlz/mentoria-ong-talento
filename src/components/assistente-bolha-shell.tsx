// Shell visual do FAB da Liza compartilhado entre a bolha real (chunk
// lazy) e o placeholder do `loading` do dynamic — posição e bolha idênticas
// pros dois lados da troca não se notarem.

// acima da bottom-nav (~57px + safe-area): o toaster usa 4.5rem, a pill da
// demo 4.75rem — mesma faixa. z-40: fica sob sheet/dialog/popover (z-50) e
// infinitamente sob o toaster (o sonner não dá pra superar — e não deve)
export const FAB_POS =
  "fixed z-40 right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6";

export const FAB_CLS =
  "group/fab grid size-12 md:size-14 place-items-center rounded-full bg-[var(--brand-lime)] text-[var(--brand-ink)] shadow-[var(--shadow-overlay)] outline-none transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:scale-105 hover:shadow-[var(--shadow-modal)] active:scale-95 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2";

/** Placeholder do FAB enquanto o chunk da bolha carrega (ssr:false): a
 *  Liza dormindo — olhos fechados — entra com a página em vez do canto
 *  piscar vazio. Quando o componente real monta, a bolha é idêntica e o
 *  rosto "acorda" (parado) — o atraso do chunk vira a Liza acordando com
 *  o app, não um elemento tardio. Estático de propósito: importar o
 *  LizaBlob puxaria motion/react de volta pro bundle inicial. */
export function LizaFabShell() {
  return (
    <div
      aria-hidden
      className={`${FAB_POS} animate-in fade-in-0 zoom-in-75 duration-300 ease-snappy`}
    >
      <div className={FAB_CLS}>
        <svg
          viewBox="0 0 100 100"
          className="size-12 md:size-11"
          aria-hidden
          focusable="false"
        >
          <path
            d="M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z"
            fill="var(--brand-lime)"
          />
          {/* pálpebras fechadas — arcos caídos nos centros dos olhos
              (dx ~19, cy ~47 do parado) */}
          <g
            fill="none"
            stroke="var(--brand-ink)"
            strokeWidth={2.8}
            strokeLinecap="round"
          >
            <path d="M23.6 45.5Q30.8 52.5 38 45.5" />
            <path d="M62 45.5Q69.2 52.5 76.4 45.5" />
            {/* sorriso pequeno do sono — mesma boca do parado */}
            <path d="M45.8 61.8Q50 65.8 54.2 61.8" />
          </g>
        </svg>
      </div>
    </div>
  );
}
