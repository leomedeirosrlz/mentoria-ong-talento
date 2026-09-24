import { CaretDown, ChatCenteredText } from "@phosphor-icons/react/dist/ssr";
import {
  agregaRespostas,
  respostaFormatada,
  type FormularioCampo,
} from "@/lib/forms/schema";
import type { LinkResolvido } from "@/lib/forms/queries";
import { formatDateTime } from "@/lib/ciclo";
import { cn } from "@/lib/utils";

// Seção "Respostas" da ficha do formulário — server component: a expansão
// usa <details>/<summary> nativos (sem JS), e a agregação vem pronta de
// agregaRespostas().

/** Barrinha proporcional de uma contagem — CSS puro. Lime só onde a
 *  semântica é positiva ("Sim"); opções neutras/negativas ficam em
 *  muted-foreground. */
function Contagem({
  rotulo,
  n,
  total,
  positivo = false,
}: {
  rotulo: string;
  n: number;
  total: number;
  positivo?: boolean;
}) {
  const pct = total ? Math.round((n / total) * 100) : 0;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
      {/* basis-full no mobile: o rótulo ganha a linha inteira em vez de
          truncar sem saída; a partir de sm volta a coluna fixa com
          ellipsis (mesmo wrap do formulario-links) */}
      <span
        className="basis-full text-muted-foreground sm:w-40 sm:shrink-0 sm:basis-auto sm:truncate"
        title={rotulo}
      >
        {rotulo}
      </span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className={cn(
            "block h-full rounded-full",
            positivo ? "bg-[var(--brand-lime)]" : "bg-muted-foreground/40"
          )}
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
      <p className="text-xs italic text-muted-foreground">
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
                    positivo={
                      ag.campo.tipo === "sim_nao" && c.rotulo === "Sim"
                    }
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
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-open:rounded-b-none sm:px-5 [&::-webkit-details-marker]:hidden">
                <ChatCenteredText
                  size={16}
                  aria-hidden
                  className="shrink-0 text-muted-foreground/60"
                />
                {/* nomes longos quebram em 2 linhas em vez de perder pro
                    timestamp shrink-0 — o clamp mantém a ellipsis no excesso */}
                <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium">
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
