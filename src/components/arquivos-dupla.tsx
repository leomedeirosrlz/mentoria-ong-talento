import Link from "next/link";
import { FileText, Paperclip } from "@phosphor-icons/react/dist/ssr";
import { formatDiaMes, formatTamanho } from "@/lib/ciclo";
import { progressoPdm, type PdmDoc } from "@/lib/pdm";
import type { RegistroAnexo } from "@/lib/types";

export type ArquivoDaDupla = RegistroAnexo & {
  /** Nº do encontro cujo registro recebeu o arquivo. */
  encontroNumero: number | null;
};

/** Os documentos da dupla num lugar só: o PDM (documento vivo — abre na
 *  aba Instrumentos, não é arquivo baixável) e tudo que foi anexado nos
 *  registros — evidência solta por encontro é impossível de achar quando
 *  se procura "o PDF do 3º encontro". A seção fica visível mesmo vazia:
 *  é onde a dupla descobre pra que serve anexar. Read-only: quem
 *  anexa/remove faz isso no registro. */
export function ArquivosDupla({
  arquivos,
  pdm = null,
}: {
  arquivos: ArquivoDaDupla[];
  /** Doc nativo do PDM — entra como primeiro item quando a trilha o tem. */
  pdm?: PdmDoc | null;
}) {
  const progPdm = pdm ? progressoPdm(pdm.itens) : null;
  const vazio = !pdm && arquivos.length === 0;
  return (
    <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <span aria-hidden className="size-1.5 rounded-full bg-[var(--brand-lime)]" />
        Documentos da dupla
      </h2>
      <p className="mb-2 mt-1 text-xs text-muted-foreground">
        {pdm
          ? "O plano de desenvolvimento e as evidências dos registros"
          : "Tudo que a dupla anexou nos registros"}
      </p>
      {vazio ? (
        <p className="text-sm text-muted-foreground">
          Nada anexado ainda. Quando a dupla anexar evidências num registro,
          elas aparecem aqui.
        </p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {pdm && (
            <li className="text-xs">
              <span className="flex min-w-0 items-center gap-1.5">
                <FileText size={12} className="shrink-0 text-muted-foreground" aria-hidden />
                <Link
                  href="?aba=instrumentos#pdm"
                  className="min-w-0 flex-1 truncate underline underline-offset-2 hover:text-foreground"
                >
                  Plano de desenvolvimento
                </Link>
              </span>
              <span className="block pl-4.5 text-muted-foreground">
                {[
                  "documento vivo",
                  progPdm && progPdm.total > 0
                    ? `${progPdm.atingidas} de ${progPdm.total} ${progPdm.total === 1 ? "meta" : "metas"}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          )}
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
      )}
    </section>
  );
}
