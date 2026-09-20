import { AVALIACAO_LABEL } from "@/lib/ciclo";
import { cn } from "@/lib/utils";
import type { Encontro } from "@/lib/types";

const TOTAL_ENCONTROS = 16;

// mesma escala do SemaforoDot: verde → âmbar → vermelho; "boa" usa o verde-lima da marca
const COR_AVALIACAO: Record<string, string> = {
  excelente: "bg-[var(--ok)]",
  boa: "bg-[var(--brand-lime)]",
  regular: "bg-[var(--warn)]",
  baixa: "bg-[var(--danger)]",
};

/** Sequência de dots por nº de encontro — trajetória das avaliações da dupla.
 *  Cheio = avaliado (cor da avaliação), contorno = realizado sem avaliação,
 *  miúdo e claro = futuro/sem encontro. Server-safe, sem estado. */
export function TrajetoriaAvaliacoes({ encontros }: { encontros: Encontro[] }) {
  const avaliados = encontros
    .filter((e) => e.status === "realizado" && e.registro?.avaliacao)
    .sort((a, b) => a.numero - b.numero);
  // com menos de 2 avaliações não há trajetória pra ler
  if (avaliados.length < 2) return null;

  const porNumero = new Map(encontros.map((e) => [e.numero, e]));
  const rotulos = avaliados.map(
    (e) => AVALIACAO_LABEL[e.registro!.avaliacao!]?.toLowerCase() ?? e.registro!.avaliacao!
  );
  const a11y = `avaliações: ${rotulos.join(", ")}`;

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      {/* a legenda visível nomeia a trilha — o title/aria-label ficam como
          redundância pro detalhe ponto a ponto */}
      <span className="text-xs text-muted-foreground">avaliações</span>
      <span
        role="img"
        aria-label={a11y}
        title={a11y}
        className="inline-flex items-center gap-1"
      >
        {Array.from({ length: TOTAL_ENCONTROS }, (_, i) => {
          const numero = i + 1;
          const enc = porNumero.get(numero);
          const realizado = enc?.status === "realizado";
          const avaliacao = realizado ? (enc.registro?.avaliacao ?? null) : null;
          return (
            <span
              key={numero}
              title={
                `Encontro ${numero}` +
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
  );
}
