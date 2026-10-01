import { Paperclip } from "@phosphor-icons/react/dist/ssr";
import { formatDiaMes, formatTamanho } from "@/lib/ciclo";
import type { RegistroAnexo } from "@/lib/types";

export type ArquivoDaDupla = RegistroAnexo & {
  /** Nº do encontro cujo registro recebeu o arquivo. */
  encontroNumero: number | null;
};

/** Todos os arquivos que a dupla anexou nos registros, num lugar só —
 *  evidência solta por encontro é impossível de achar quando se procura "o
 *  PDF do 3º encontro". Read-only: quem anexa/remove faz isso no registro. */
export function ArquivosDupla({ arquivos }: { arquivos: ArquivoDaDupla[] }) {
  if (!arquivos.length) return null;
  return (
    <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Arquivos
      </h2>
      <p className="mb-2 mt-1 text-xs text-muted-foreground">
        Tudo que a dupla anexou nos registros
      </p>
      <ul className="space-y-1.5 text-sm">
        {arquivos.map((a) => (
          <li key={a.id} className="text-xs">
            <span className="flex min-w-0 items-center gap-1.5">
              <Paperclip size={12} className="shrink-0 text-muted-foreground" aria-hidden />
              <a
                href={`/api/anexo/${a.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title={a.nome}
                className="min-w-0 flex-1 truncate underline underline-offset-2 hover:text-foreground"
              >
                {a.nome}
              </a>
            </span>
            <span className="block pl-4.5 text-muted-foreground">
              {[
                a.encontroNumero != null ? `${a.encontroNumero}º encontro` : null,
                a.tamanho != null ? formatTamanho(a.tamanho) : null,
                a.autor?.nome ? `por ${a.autor.nome}` : null,
                formatDiaMes(a.created_at),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
