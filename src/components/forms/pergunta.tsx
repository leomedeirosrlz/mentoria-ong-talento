import type { FormularioCampo } from "@/lib/forms/schema";
import { cn } from "@/lib/utils";

// Gramática pergunta→resposta dos instrumentos e formulários
// (REALIZA-442, reescrita na 010/REALIZA-511): o número lê como texto no
// verde da marca — sem disco —, o enunciado veste o primeiro plano e a
// resposta fica em primeiro plano na leitura. A mesma hierarquia vale
// na escrita (/f/<token> e prévias) e na leitura (resultado
// estruturado, lista de respostas) — o "3" que a pessoa preencheu é o
// "3" que a equipe lê. Sem "use client": componente puro, serve aos
// dois lados.

/** Pergunta — o enunciado em primeiro plano (o verde ficou pro número). */
export const PERGUNTA_TEXTO =
  "text-[15px] font-semibold leading-snug text-foreground";

/** Resposta na leitura — primeiro plano, ritmo de texto corrido. */
export const RESPOSTA_TEXTO = "text-base leading-relaxed";

/** O número da pergunta como texto no verde da marca — a posição na
 *  régua do form (1-base), alinhado pela linha de base do enunciado.
 *  `compacto` cabe em listas densas (as 16 áreas da roda). */
export function NumeroPergunta({
  n,
  compacto = false,
  className,
}: {
  n: number;
  compacto?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      data-numero-pergunta
      className={cn(
        "shrink-0 font-bold tabular-nums text-[var(--ok-text)]",
        compacto ? "text-[13px]" : "text-[15px]",
        className
      )}
    >
      {n}.
    </span>
  );
}

/** Rótulo compartilhado da pergunta na escrita — enunciado em primeiro
 *  plano + "(opcional)" + descricao, com o número verde quando a posição
 *  é conhecida (n > 0). Com htmlFor vira <label>; dentro de grupos o
 *  caller usa <legend> e recebe <span>. */
export function RotuloPergunta({
  campo,
  n,
  htmlFor,
  className,
}: {
  campo: FormularioCampo;
  n?: number;
  htmlFor?: string;
  className?: string;
}) {
  const inner = (
    <>
      {campo.label}
      {!campo.obrigatorio && (
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
          (opcional)
        </span>
      )}
      {/* instrução da pergunta ("Responda com até 2 linhas…") mora na
          descricao — nos headers de secao ela já renderiza separada */}
      {campo.tipo !== "secao" && campo.descricao && (
        <span className="mt-0.5 block text-xs font-normal leading-relaxed text-muted-foreground">
          {campo.descricao}
        </span>
      )}
    </>
  );
  const classes = cn("block", PERGUNTA_TEXTO, "@xl:text-base", className);
  const corpo =
    n != null && n > 0 ? (
      <span className="flex items-baseline gap-2">
        <NumeroPergunta n={n} />
        <span className="min-w-0 flex-1">{inner}</span>
      </span>
    ) : (
      inner
    );
  return htmlFor ? (
    <label htmlFor={htmlFor} className={classes}>
      {corpo}
    </label>
  ) : (
    <span className={classes}>{corpo}</span>
  );
}
