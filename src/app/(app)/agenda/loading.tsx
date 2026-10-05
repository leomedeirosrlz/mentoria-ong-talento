import { Fragment } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Espelho do AgendaCalendario: card do calendário (chrome, rail 1—16,
// grade de semanas, legenda) + detalhe do dia ao lado em lg + lista do mês.
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      {/* header — título + subtítulo estático */}
      <header>
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </header>

      <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] lg:items-start lg:gap-5 lg:space-y-0">
        {/* ===== calendário mensal ===== */}
        <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)] lg:col-start-1 lg:row-start-1">
          {/* faixa de chrome fundida — abas de visão (Semana | Mês | Lista,
              coord/sup) + seletor Turma à direita; mentor com um cronograma
              não tem a faixa e o card começa direto na nav */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-2 py-1.5 sm:px-3">
            <div className="flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <Skeleton
                  key={i}
                  className="h-11 w-20 rounded-full sm:h-8"
                />
              ))}
            </div>
            <Skeleton className="ms-auto h-8 w-36 rounded-lg" />
          </div>
          {/* chrome: carets + "Hoje" + título do mês */}
          <div className="flex items-center gap-1 border-b px-2 py-1.5 sm:px-3">
            <Skeleton className="size-11 rounded-lg md:size-9" />
            <Skeleton className="size-11 rounded-lg md:size-9" />
            <Skeleton className="ms-0.5 h-11 w-14 rounded-lg md:h-9" />
            <div className="min-w-0 flex-1 px-2.5">
              <Skeleton className="h-6 w-36" />
            </div>
          </div>

          {/* rail do ciclo — 16 discos com conectores, clipa no mobile como o
              real, com a legenda de 3 estados embaixo */}
          <div className="border-b px-3 pb-1.5 pt-2 sm:px-4">
            <div className="flex items-center overflow-hidden pb-1">
              {Array.from({ length: 16 }, (_, i) => (
                <Fragment key={i}>
                  {i > 0 && (
                    <span aria-hidden className="h-px min-w-1.5 flex-1 bg-border" />
                  )}
                  <Skeleton className="size-6 shrink-0 rounded-full sm:size-7" />
                </Fragment>
              ))}
            </div>
            <div className="flex items-center gap-x-3 py-1">
              {["w-16", "w-14", "w-10"].map((w, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Skeleton className="size-3 rounded-full" />
                  <Skeleton className={`h-2.5 ${w}`} />
                </div>
              ))}
            </div>
          </div>

          {/* cabeçalho dos dias da semana */}
          <div className="grid grid-cols-7 border-b">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="py-2">
                <Skeleton className="mx-auto h-3 w-6" />
              </div>
            ))}
          </div>

          {/* grade — 5 semanas × 7 células; uma marcada como selecionada */}
          {Array.from({ length: 5 }, (_, s) => (
            <div key={s} className="grid grid-cols-7">
              {Array.from({ length: 7 }, (_, c) => (
                <div key={c} className="p-0.5">
                  <Skeleton
                    className={
                      "min-h-11 w-full rounded-lg sm:min-h-12" +
                      (s === 2 && c === 2 ? " ring-2 ring-foreground/30" : "")
                    }
                  />
                </div>
              ))}
            </div>
          ))}

          {/* legenda — disco + palavra, 3 itens */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-3">
            {["w-16", "w-14", "w-10"].map((w, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Skeleton className="size-5 rounded-full" />
                <Skeleton className={`h-3 ${w}`} />
              </div>
            ))}
          </div>
        </div>

        {/* ===== detalhe do dia selecionado ===== */}
        <section className="rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5 lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Skeleton className="h-4 w-10" />
              <div className="mt-1.5 flex items-baseline gap-2">
                <Skeleton className="h-9 w-9" />
                <Skeleton className="h-5 w-28" />
              </div>
            </div>
            <Skeleton className="h-4 w-12" />
          </div>

          {/* evento do dia */}
          <div className="mt-3 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>

          {/* encontros das duplas no dia */}
          <div className="mt-4 border-t pt-4">
            <Skeleton className="h-3 w-14" />
            <div className="mt-2 flex items-center gap-x-3 gap-y-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Skeleton className="size-2 rounded-full" />
                  <Skeleton className="h-3 w-14" />
                </div>
              ))}
            </div>
            <ul className="mt-1.5">
              {[0, 1].map((i) => (
                <li key={i} className="flex items-center gap-2.5 px-2 py-2">
                  <Skeleton className="size-2 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-3.5 w-3/5" />
                    <Skeleton className="mt-1 h-3 w-4/5" />
                  </div>
                  <Skeleton className="size-3.5 shrink-0 rounded" />
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ===== lista do mês ===== */}
        <section className="lg:col-span-2">
          <div className="mb-2 px-1">
            <Skeleton className="h-4 w-52" />
          </div>
          <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
            {[3, 2].map((rows, g) => (
              <div key={g}>
                <div className={g === 0 ? "px-4 pb-1 pt-2 sm:px-5" : "border-t px-4 pb-1 pt-3 sm:px-5"}>
                  <Skeleton className="h-3 w-40" />
                </div>
                {Array.from({ length: rows }, (_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5"
                  >
                    <Skeleton className="h-3.5 w-20 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <Skeleton className="h-3.5 w-1/2" />
                      <Skeleton className="mt-1 h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-3.5 w-16 shrink-0" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
