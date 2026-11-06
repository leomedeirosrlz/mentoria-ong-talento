import type {
  ItemMenuPapel,
  SecaoComoFunciona,
} from "@/lib/ajuda/conteudo";

/** A aba "Como funciona": as seções do papel efetivo + o mapa do menu
 *  mergeado dos papéis efetivos. Cada seção é um card com uma lista
 *  termo→texto — o dt ancora a leitura (nome da fase, do papel, do
 *  destino) e um dd pode trazer mais de uma linha quando o destino vale
 *  pra mais de um papel (o híbrido lê os dois mundos). */
export function AjudaComoFunciona({
  secoes,
  menu,
}: {
  secoes: SecaoComoFunciona[];
  menu: ItemMenuPapel[];
}) {
  return (
    <div className="space-y-5">
      {secoes.map((s) => (
        <section
          key={s.id}
          aria-labelledby={`ajuda-cf-${s.id}`}
          className="rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5 sm:py-5"
        >
          <h2 id={`ajuda-cf-${s.id}`} className="text-base font-semibold">
            {s.titulo}
          </h2>
          {s.intro && (
            <p className="mt-1 text-sm text-muted-foreground">{s.intro}</p>
          )}
          <dl className="mt-3 divide-y divide-border/60">
            {s.itens.map((item) => (
              <div
                key={item.rotulo}
                className="grid gap-0.5 py-2.5 sm:grid-cols-[11rem_1fr] sm:gap-4"
              >
                <dt className="text-sm font-medium">{item.rotulo}</dt>
                <dd className="text-sm text-muted-foreground">{item.texto}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {menu.length > 0 && (
        <section
          aria-labelledby="ajuda-cf-menu"
          className="rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5 sm:py-5"
        >
          <h2 id="ajuda-cf-menu" className="text-base font-semibold">
            Onde fica cada coisa
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Os destinos do seu menu, na ordem em que aparecem.
          </p>
          <dl className="mt-3 divide-y divide-border/60">
            {menu.map((item) => (
              <div
                key={item.rotulo}
                className="grid gap-0.5 py-2.5 sm:grid-cols-[11rem_1fr] sm:gap-4"
              >
                <dt className="text-sm font-medium">{item.rotulo}</dt>
                <dd className="space-y-1 text-sm text-muted-foreground">
                  {item.textos.map((texto) => (
                    <p key={texto}>{texto}</p>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
