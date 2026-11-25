import { AVALIACAO_LABEL, cobertosDaDupla, passoEsp } from "@/lib/ciclo";
import { cn } from "@/lib/utils";
import type { Encontro } from "@/lib/types";
import {
  COR_AVALIACAO,
  itensAvaliacao,
  LegendaPontos,
  type PontoLegenda,
} from "@/components/viz";

/** Sequência de dots por nº de encontro — trajetória das avaliações da dupla.
 *  Cheio = avaliado (cor da avaliação — a rampa compartilhada do viz),
 *  contorno = realizado sem avaliação, miúdo e claro = futuro/sem encontro.
 *  `total` vem da trilha (16 DPP / 5 especialista). A chave abaixo nomeia
 *  cor e forma em texto — cor nunca carrega o significado sozinha
 *  (REALIZA-444). Server-safe, sem estado. */
export function TrajetoriaAvaliacoes({
  encontros,
  total,
  sessao = false,
}: {
  encontros: Encontro[];
  total: number;
  /** Trilha esp: o dot ancora no passo do guia (rank), não na tentativa —
   *  e o title fala "Sessão N", não "Encontro N". */
  sessao?: boolean;
}) {
  // sessão combinada (018): a avaliação é do registro, e o registro cobre a
  // sessão inteira — o dot do coberto pinta com a nota da âncora, não
  // "sem avaliação"
  const cobertos = cobertosDaDupla(encontros);
  const registroDe = (e: Encontro) =>
    e.registro ??
    (cobertos.has(e.numero)
      ? (encontros.find((x) => x.numero === cobertos.get(e.numero))
          ?.registro ?? null)
      : null);
  const avaliados = encontros
    .filter((e) => e.status === "realizado" && registroDe(e)?.avaliacao)
    .sort((a, b) => a.numero - b.numero);
  // com menos de 2 avaliações não há trajetória pra ler
  if (avaliados.length < 2) return null;

  const porNumero = new Map(
    encontros.map((e) => [sessao ? passoEsp(e, encontros) : e.numero, e])
  );
  const rotulos = avaliados.map(
    (e) => AVALIACAO_LABEL[registroDe(e)!.avaliacao!]?.toLowerCase() ?? registroDe(e)!.avaliacao!
  );
  const a11y = `avaliações: ${rotulos.join(", ")}`;

  const temSemAvaliacao = encontros.some(
    (e) => e.status === "realizado" && !registroDe(e)?.avaliacao
  );
  const temARealizar = Array.from({ length: total }, (_, i) => i + 1).some(
    (n) => porNumero.get(n)?.status !== "realizado"
  );
  const itens: PontoLegenda[] = [
    ...itensAvaliacao(avaliados.map((e) => registroDe(e)!.avaliacao!)),
    ...(temSemAvaliacao
      ? [
          {
            rotulo: "sem avaliação",
            swatch: (
              <span
                aria-hidden
                className="size-2 rounded-full border border-muted-foreground/50"
              />
            ),
          } satisfies PontoLegenda,
        ]
      : []),
    ...(temARealizar
      ? [
          {
            rotulo: "a realizar",
            swatch: (
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-muted-foreground/25"
              />
            ),
          } satisfies PontoLegenda,
        ]
      : []),
  ];

  return (
    <div className="shrink-0">
      <span className="inline-flex items-center gap-1.5">
        {/* a legenda visível nomeia a trilha — o title/aria-label ficam como
            redundância pro detalhe ponto a ponto */}
        <span className="text-xs text-muted-foreground">avaliações</span>
        <span
          role="img"
          aria-label={a11y}
          title={a11y}
          className="inline-flex items-center gap-1"
        >
          {Array.from({ length: total }, (_, i) => {
            const numero = i + 1;
            const enc = porNumero.get(numero);
            const realizado = enc?.status === "realizado";
            const avaliacao = realizado ? (registroDe(enc)?.avaliacao ?? null) : null;
            return (
              <span
                key={numero}
                title={
                  `${sessao ? "Sessão" : "Encontro"} ${numero}` +
                  (avaliacao
                    ? ` · ${AVALIACAO_LABEL[avaliacao] ?? avaliacao}`
                    : realizado
                      ? " · sem avaliação"
                      : "")
                }
                className={cn(
                  "inline-block rounded-full",
                  realizado
                    ? avaliacao
                      ? cn("size-2.5", COR_AVALIACAO[avaliacao] ?? "bg-muted-foreground")
                      : "size-2.5 border border-muted-foreground/50"
                    : "size-1.5 bg-muted-foreground/25"
                )}
              />
            );
          })}
        </span>
      </span>
      <LegendaPontos itens={itens} className="mt-1" />
    </div>
  );
}
