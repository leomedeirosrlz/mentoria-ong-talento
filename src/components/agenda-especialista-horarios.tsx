import Link from "next/link";
import type { ExcecaoEspecialista, GradeJanela } from "@/lib/types";
import { resumoExcecao, resumoGrade } from "@/lib/horarios-especialista";

/** "Quando você atende" — leitura da agenda publicada do especialista
 *  (0073), em frases ("Terças 18h–21h · Sábados 9h–12h"). A agenda é só
 *  vitrine: a edição mora no perfil (/perfil#horarios), pra onde o link
 *  aponta. Sem grade informada a frase acende warn — sem ela nenhum jovem
 *  consegue propor horário. */
export function AgendaEspHorarios({
  grade,
  excecoes,
}: {
  grade: GradeJanela[];
  /** Já ordenadas por data+hora na query — a lista mostra as 2 próximas. */
  excecoes: ExcecaoEspecialista[];
}) {
  const linhas = resumoGrade(grade);
  const proximas = excecoes.slice(0, 2);
  return (
    <section
      aria-label="Quando você atende"
      className="rounded-xl border bg-card px-4 py-3.5 sm:px-5"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 className="min-w-0 flex-1 text-base font-semibold">
          Quando você atende
        </h2>
        <Link
          href="/perfil#horarios"
          className="inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
        >
          Editar no perfil
        </Link>
      </div>
      {linhas.length > 0 ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            {linhas.join(" · ")}
          </p>
          {proximas.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {proximas.map(resumoExcecao).join(" · ")}
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-sm text-[var(--warn-text)]">
          Você ainda não informou quando atende.
        </p>
      )}
    </section>
  );
}
