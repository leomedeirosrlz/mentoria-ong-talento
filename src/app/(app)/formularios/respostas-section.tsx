import {
  CaretDown,
  ChatCenteredText,
  DownloadSimple,
} from "@phosphor-icons/react/dist/ssr";
import {
  agregaRespostas,
  respostaFormatada,
  TIPOS_LISTA_RESPOSTA,
  type FormularioCampo,
} from "@/lib/forms/schema";
import type { LinkResolvido } from "@/lib/forms/queries";
import { formatDateTime } from "@/lib/ciclo";
import { buttonVariants } from "@/components/ui/button";
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
      {/* visual "12 · 40%"; leitor de tela ouve "12 de 30" — a fração é a
          informação que o % abstrai (aria-label em span genérico não é
          anunciado de forma confiável — vai texto sr-only) */}
      <span className="min-w-16 shrink-0 text-right tabular-nums whitespace-nowrap text-muted-foreground">
        <span aria-hidden>
          {n} · {pct}%
        </span>
        <span className="sr-only">
          {n} de {total}
        </span>
      </span>
    </li>
  );
}

/** Média de escala tem faixa de leitura — 1,8/5 não pode vestir verde. */
function corMedia(media: number): string {
  if (media >= 4) return "text-[var(--ok-text)]";
  if (media < 2.5) return "text-[var(--warn-text)]";
  return "text-foreground";
}

export function RespostasSection({
  campos,
  links,
}: {
  campos: FormularioCampo[];
  links: LinkResolvido[];
}) {
  // mais recente primeiro — o retorno quente fica no topo dos accordions
  const respondidos = links
    .filter((l) => l.resposta)
    .sort((a, b) =>
      b.resposta!.respondido_em.localeCompare(a.resposta!.respondido_em)
    );
  const agregados = agregaRespostas(
    campos,
    respondidos.map((l) => ({
      autor: l.dest_nome ?? "Link genérico",
      respostas: l.resposta!.respostas,
    }))
  );
  // fechadas (barras/média) primeiro; abertas (lista com autoria) depois
  const numericos = agregados.filter(
    (ag) => !TIPOS_LISTA_RESPOSTA.includes(ag.campo.tipo)
  );
  const listas = agregados.filter(
    (ag) => TIPOS_LISTA_RESPOSTA.includes(ag.campo.tipo) && ag.itens.length > 0
  );
  const campoPorId = new Map(campos.map((c) => [c.id, c]));
  // posição do campo no form — respostas exibidas na ordem das perguntas;
  // órfãs (pergunta removida) caem por último
  const ordemCampos = new Map(campos.map((c, i) => [c.id, i]));

  if (respondidos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        Nenhuma resposta ainda —{" "}
        <a href="#sec-links" className="underline underline-offset-2">
          gere links na seção acima
        </a>{" "}
        e elas aparecem aqui conforme forem respondidas.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* export fica no topo da seção — a ficha é coord-only, o CSV segue a
          mesma regra no handler */}
      <div className="flex justify-end">
        <a
          href={`/api/export?tipo=respostas&id=${respondidos[0].formulario_id}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <DownloadSimple aria-hidden />
          Exportar CSV
        </a>
      </div>

      {/* resumo por pergunta: escala vira média + distribuição, sim_não/
          checkbox/opções viram contagens, texto/data viram lista com autor */}
      {(numericos.length > 0 || listas.length > 0) && (
        <div className="space-y-4 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
          {numericos.map((ag) => (
            <div key={ag.campo.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{ag.campo.label}</p>
                <p className="text-sm text-muted-foreground">
                  {ag.media != null && (
                    <>
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          corMedia(ag.media)
                        )}
                      >
                        {ag.media.toLocaleString("pt-BR")}
                      </span>
                      <span>/5 em média · </span>
                    </>
                  )}
                  <span className="tabular-nums">
                    {ag.respondidas} de {respondidos.length}{" "}
                    {ag.respondidas === 1 ? "respondeu" : "responderam"}
                  </span>
                </p>
              </div>
              <ul className="mt-2 space-y-1.5">
                {ag.contagens.map((c) => (
                  <Contagem
                    key={c.rotulo}
                    rotulo={c.rotulo}
                    n={c.n}
                    total={ag.respondidas}
                    positivo={
                      (ag.campo.tipo === "sim_nao" ||
                        ag.campo.tipo === "checkbox") &&
                      c.rotulo === "Sim"
                    }
                  />
                ))}
              </ul>
            </div>
          ))}
          {listas.length > 0 && (
            <div
              className={cn(
                "space-y-4",
                numericos.length > 0 && "border-t border-border pt-4"
              )}
            >
              {listas.map((ag) => (
                <div key={ag.campo.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{ag.campo.label}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {ag.itens.length}{" "}
                      {ag.itens.length === 1 ? "resposta" : "respostas"}
                    </p>
                  </div>
                  <ul className="mt-2 space-y-2">
                    {ag.itens.map((it, i) => (
                      <li key={i}>
                        <blockquote className="border-l-2 border-border pl-3">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {it.valor}
                          </p>
                          <footer className="mt-0.5 text-xs text-muted-foreground">
                            {it.autor}
                          </footer>
                        </blockquote>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
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
                {Object.entries(l.resposta!.respostas)
                  .sort(
                    ([a], [b]) =>
                      (ordemCampos.get(a) ?? Number.MAX_SAFE_INTEGER) -
                      (ordemCampos.get(b) ?? Number.MAX_SAFE_INTEGER)
                  )
                  .map(([campoId, valor]) => {
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
