import { InstrumentoEmblema } from "@/components/instrumento-icone";
import {
  DESFECHO_N_MIN,
  formatPct,
  type DesfechoCardMomento,
} from "@/lib/desfecho";

// Card "Depois da mentoria" do /resumo público (REALIZA-216): só números
// agregados, um bloco por momento. A RPC já suprimiu o que tinha n < 5 —
// aqui a linha insuficiente mostra só a régua, nunca uma parcela.

function BlocoMomento({ m }: { m: DesfechoCardMomento }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg bg-muted/40 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {m.rotulo}
      </p>
      {m.suficiente ? (
        <>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
            {m.pctPositivo != null && (
              <p className="font-mono text-lg font-semibold tabular-nums">
                {formatPct(m.pctPositivo)}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              estudando ou trabalhando · {m.n}{" "}
              {m.n === 1 ? "resposta" : "respostas"}
            </p>
          </div>
          {m.mediaAjudou != null && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              a mentoria ajudou{" "}
              <span className="font-mono tabular-nums">
                {m.mediaAjudou.toFixed(1).replace(".", ",")}/5
              </span>{" "}
              em média
            </p>
          )}
          {m.opcoes.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {m.opcoes.map((o) => (
                <li
                  key={o.opcao}
                  className="rounded-md bg-card px-1.5 py-0.5 text-xs text-muted-foreground"
                >
                  {o.opcao}{" "}
                  <span className="font-mono tabular-nums">
                    {formatPct(o.pct)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {m.n > 0
            ? `${m.n} ${m.n === 1 ? "resposta" : "respostas"} por enquanto. Dados insuficientes pra publicar (mínimo de ${DESFECHO_N_MIN}).`
            : "Ainda não perguntamos neste momento."}
        </p>
      )}
    </div>
  );
}

export function ResumoDesfechoCard({
  momentos,
}: {
  momentos: DesfechoCardMomento[];
}) {
  if (!momentos.length) return null;
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
        Como os jovens estão depois da jornada — só números agregados,
        nunca respostas individuais.
      </p>
      <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
        {momentos.map((m) => (
          <BlocoMomento key={m.chave} m={m} />
        ))}
      </div>
    </section>
  );
}
