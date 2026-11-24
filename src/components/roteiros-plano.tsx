import Link from "next/link";
import { BookOpenText } from "@phosphor-icons/react/dist/ssr";
import {
  rotuloStatusRoteiro,
  roteiroForaDeVersao,
} from "@/lib/plano-roteiros";
import type { DuplaPlanoRoteiro } from "@/lib/types";

/** Lista dos roteiros do plano (020): uma linha por semana do combinado,
 *  vigente primeiro; versões `substituido` agrupadas como "anterior".
 *  A equipe vê além disso os links "Gerar" pras semanas ainda sem
 *  roteiro — o click abre a página da semana com a prévia e o gesto. */
export function RoteirosPlano({
  roteiros,
  planoVersao,
  hrefDe,
  podeGerar = false,
  faltantes = [],
}: {
  roteiros: readonly DuplaPlanoRoteiro[];
  planoVersao: number;
  /** rota da semana — /duplas/[id]/roteiro/N ou /jovem/roteiro/N */
  hrefDe: (numero: number) => string;
  /** equipe gera semana sob demanda; mentor e jovem só leem */
  podeGerar?: boolean;
  /** números do combinado sem nenhuma row na versão vigente */
  faltantes?: readonly number[];
}) {
  // vigente por número: publicado ou o rascunho mais novo
  const vigente = new Map<number, DuplaPlanoRoteiro>();
  for (const r of roteiros) {
    if (r.status === "substituido") continue;
    const cur = vigente.get(r.numero);
    if (!cur || (cur.status !== "publicado" && r.versao > cur.versao))
      vigente.set(r.numero, r);
  }
  const linhas = [...vigente.values()].sort((a, b) => a.numero - b.numero);
  if (linhas.length === 0 && faltantes.length === 0) return null;

  return (
    <section
      aria-label="Roteiros do plano"
      className="space-y-2 border-t border-foreground/10 pt-3"
    >
      <h3 className="text-sm font-semibold">Roteiros do plano</h3>
      <ul className="space-y-1 text-sm">
        {linhas.map((r) => {
          const fora = roteiroForaDeVersao(r, { versao: planoVersao });
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link
                href={hrefDe(r.numero)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
              >
                <BookOpenText size={15} aria-hidden className="shrink-0" />
                Roteiro do {r.numero}º encontro
              </Link>
              <span className="text-xs text-muted-foreground">
                {rotuloStatusRoteiro(r)}
                {r.versao > 1 ? ` · v${r.versao}` : ""}
                {fora ? " · de versão anterior do plano" : ""}
              </span>
            </li>
          );
        })}
        {podeGerar &&
          faltantes.map((n) => (
            <li key={`gerar-${n}`} className="flex items-center gap-2">
              <Link
                href={hrefDe(n)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
              >
                Gerar roteiro do {n}º encontro
              </Link>
            </li>
          ))}
      </ul>
    </section>
  );
}
