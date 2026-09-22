import { CaretDown, ChatCenteredText } from "@phosphor-icons/react/dist/ssr";
import {
  agregaRespostas,
  respostaFormatada,
  type FormularioCampo,
} from "@/lib/forms/schema";
import type { LinkResolvido } from "@/lib/forms/queries";
import { formatDateTime } from "@/lib/ciclo";

// Seção "Respostas" da ficha do formulário — server component: a expansão
// usa <details>/<summary> nativos (sem JS), e a agregação vem pronta de
// agregaRespostas().

/** Barrinha proporcional de uma contagem — CSS puro. */
function Contagem({ rotulo, n, total }: { rotulo: string; n: number; total: number }) {
  const pct = total ? Math.round((n / total) * 100) : 0;
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="w-40 shrink-0 truncate text-muted-foreground" title={rotulo}>
        {rotulo}
      </span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-[var(--brand-lime)]"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
        {n}
      </span>
    </li>
  );
}

export function RespostasSection({
  campos,
  links,
}: {
  campos: FormularioCampo[];
  links: LinkResolvido[];
}) {
  const respondidos = links.filter((l) => l.resposta);
  const agregados = agregaRespostas(
    campos,
    respondidos.map((l) => l.resposta!.respostas)
  );
  const campoPorId = new Map(campos.map((c) => [c.id, c]));

  if (respondidos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        Nenhuma resposta ainda — elas aparecem aqui conforme os links forem
        respondidos.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* agregado simples: escala vira média + distribuição, sim_não e
          opções viram contagens */}
      {agregados.length > 0 && (
        <div className="space-y-4 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
          {agregados.map((ag) => (
            <div key={ag.campo.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{ag.campo.label}</p>
                {ag.media != null && (
                  <p className="text-sm">
                    <span className="font-semibold tabular-nums text-[var(--ok-text)]">
                      {ag.media.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-muted-foreground">/5 em média</span>
                  </p>
                )}
              </div>
              <ul className="mt-2 space-y-1.5">
                {ag.contagens.map((c) => (
                  <Contagem
                    key={c.rotulo}
                    rotulo={c.rotulo}
                    n={c.n}
                    total={ag.respondidas}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* uma resposta por linha — <details> nativo expande sem JS */}
      <ol className="space-y-2">
        {respondidos.map((l) => (
          <li key={l.id}>
            <details className="group rounded-xl bg-card shadow-[var(--shadow-border)]">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
                <ChatCenteredText
                  size={16}
                  aria-hidden
                  className="shrink-0 text-muted-foreground/60"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {l.dest_nome ?? "Link genérico"}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatDateTime(l.resposta!.respondido_em)}
                </span>
                <CaretDown
                  size={14}
                  aria-hidden
                  className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                />
              </summary>
              <dl className="space-y-3 border-t border-border px-4 py-3 sm:px-5">
                {Object.entries(l.resposta!.respostas).map(([campoId, valor]) => {
                  const campo = campoPorId.get(campoId);
                  return (
                    <div key={campoId}>
                      <dt className="text-xs font-medium text-muted-foreground">
                        {campo?.label ?? (
                          <span className="italic">
                            pergunta removida do formulário
                          </span>
                        )}
                      </dt>
                      <dd className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">
                        {respostaFormatada(campo, valor)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}
