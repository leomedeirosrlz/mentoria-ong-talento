import { InstrumentoEmblema } from "@/components/instrumento-icone";
import {
  desfechoPositivo,
  MOMENTO_LABEL,
  type DesfechoEntrega,
} from "@/lib/desfecho";
import { formatDate } from "@/lib/ciclo";

// Ficha da dupla (coord): a resposta individual do "Depois da mentoria",
// junto do resumo da jornada. Aqui vale leitura fina — texto livre fica
// dentro da ficha e nunca sai pro /resumo (LGPD do desenho).

function BlocoEntrega({ e }: { e: DesfechoEntrega }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {MOMENTO_LABEL[e.momento]}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {e.status === "respondido" && e.respondido_em
            ? `respondido em ${formatDate(e.respondido_em)}`
            : e.status === "pendente"
              ? "aguardando resposta"
              : "link expirado"}
        </p>
      </div>
      {e.resposta ? (
        <div className="mt-1.5 space-y-1.5">
          {e.resposta.situacao.length > 0 && (
            <p className="text-sm">
              {e.resposta.situacao.join(" · ")}
              {desfechoPositivo(e.resposta.situacao) && (
                <span className="ml-2 rounded-md bg-[var(--ok)]/15 px-1.5 py-0.5 text-xs font-medium text-[var(--ok-text)]">
                  estudando ou trabalhando
                </span>
              )}
            </p>
          )}
          {e.resposta.ajudou != null && (
            <p className="text-xs text-muted-foreground">
              a mentoria ajudou{" "}
              <span className="font-mono tabular-nums">
                {e.resposta.ajudou}/5
              </span>
            </p>
          )}
          {e.resposta.conquista && (
            <p className="text-xs italic text-muted-foreground">
              “{e.resposta.conquista}”
            </p>
          )}
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {e.status === "pendente"
            ? "O link já está com a jovem."
            : e.status === "respondido"
              ? "Resposta registrada."
              : "Emitir de novo pelo lote quando fizer sentido."}
        </p>
      )}
    </div>
  );
}

export function DesfechoDuplaCard({
  entregas,
}: {
  entregas: DesfechoEntrega[];
}) {
  if (!entregas.length) return null;
  return (
    <section
      aria-label="Depois da mentoria"
      className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]"
    >
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <InstrumentoEmblema instrumento="desfecho" size={28} />
        Depois da mentoria
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        O que a jovem contou sobre como está depois da jornada.
      </p>
      <div className="mt-3 space-y-2.5">
        {entregas.map((e) => (
          <BlocoEntrega key={e.momento} e={e} />
        ))}
      </div>
    </section>
  );
}
