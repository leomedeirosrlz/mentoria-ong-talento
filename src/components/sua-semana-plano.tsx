import type { ReactNode } from "react";
import Link from "next/link";
import { CaretDown, CaretRight } from "@phosphor-icons/react/dist/ssr";
import {
  PillPlano,
  QuadradosCombinado,
  fraseDoCombinado,
} from "@/components/plano-em-dia-pecas";
import { buttonVariants } from "@/components/ui/button";
import type { SemanaPlano } from "@/lib/sua-semana";
import { cn } from "@/lib/utils";

/** O bloco do combinado dentro da "Sua semana" (REALIZA-520) — extensão
 *  do hero do jovem e da seção do card do mentor, NUNCA superfície
 *  própria: nas duas casas ele entra depois do conteúdo da seção, com
 *  divisória. A frase, a pill e os quadrados são os mesmos da ficha —
 *  a home não inventa outra leitura do plano. */
export function SuaSemanaPlano({
  semana,
  perspectiva,
  outro,
  quem,
  combinadoHref,
  confirmarHref,
  contestar,
  materiais,
}: {
  semana: SemanaPlano;
  perspectiva: "mentor" | "jovem";
  /** primeiro nome de quem está do outro lado da dupla */
  outro: string;
  /** autoria do plano já resolvida — "Ricardo", "você", "a equipe" */
  quem: string;
  /** "Ver o combinado": /jovem/agenda#plano ou /duplas/[id]#plano-em-dia */
  combinadoHref: string;
  /** onde o passo pendente se confirma (ficha do mentor #acordos); sem
   *  passo pendente ou sem gesto aqui, null — o jovem confirma na agenda */
  confirmarHref?: string | null;
  /** "Não serve pra mim" — botão client que o caller passa quando a
   *  janela de contestação está aberta (semana.contestavel) */
  contestar?: ReactNode;
  /** roteiro/materiais do próximo passo — disclosure em linha; vazio
   *  esconde o detalhe (sem promessa vazia) */
  materiais?: { href: string; titulo: string }[];
}) {
  const f = fraseDoCombinado(semana.resumo, perspectiva, outro);
  const proximoPasso = semana.resumo.proximo;
  // o disclosure cobre o passo que vem agora: o encontro agendado quando
  // é do plano, senão o primeiro pendente
  const numeroDoDisclosure = semana.vinculo ?? proximoPasso?.numero ?? null;

  return (
    <div className="mt-4 space-y-3 border-t border-foreground/10 pt-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <PillPlano tom={f.tom}>{f.pill}</PillPlano>
        {semana.ritmo && (
          <span className="text-xs text-muted-foreground">{semana.ritmo}</span>
        )}
      </div>

      {/* o vínculo é o que distingue "um encontro" de "um passo do
          combinado" — só quando o próximo é passo do plano */}
      {semana.vinculo != null && (
        <p className="text-sm font-medium">
          Este é o {semana.vinculo}º encontro do plano que {quem} combinou.
        </p>
      )}

      <p className="text-sm text-pretty">{f.texto}</p>

      <QuadradosCombinado resumo={semana.resumo} />

      <div className="flex flex-wrap items-center gap-2">
        {confirmarHref && proximoPasso && (
          <Link
            href={confirmarHref}
            className={cn(buttonVariants({ size: "sm" }), "min-h-11 sm:min-h-8")}
          >
            Confirmar data
          </Link>
        )}
        <Link
          href={combinadoHref}
          className={cn(
            buttonVariants({
              variant: confirmarHref && proximoPasso ? "outline" : "default",
              size: "sm",
            }),
            "group min-h-11 sm:min-h-8"
          )}
        >
          Ver o combinado
          <CaretRight
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5"
          />
        </Link>
        {contestar}
      </div>

      {numeroDoDisclosure != null && materiais != null && materiais.length > 0 && (
        <details className="group/mat">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-md text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 [&::-webkit-details-marker]:hidden">
            Roteiro e materiais do {numeroDoDisclosure}º encontro
            <CaretDown
              aria-hidden
              className="size-3.5 transition-transform group-open/mat:rotate-180"
            />
          </summary>
          <ul className="mt-1.5 space-y-1 text-sm">
            {materiais.map((m) => (
              <li key={m.href}>
                <Link
                  href={m.href}
                  className="inline-flex min-h-11 items-center gap-1 rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
                >
                  {m.titulo}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
