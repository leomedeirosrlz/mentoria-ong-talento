import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { DuplaAvatares } from "@/components/dupla-avatares";
import { DuplaNomes } from "@/components/dupla-nomes";
import { RegistroView } from "@/components/registro-view";
import { ResolverApoioButton } from "@/components/resolver-apoio-button";
import { diasAtrasoRegistro, formatDate, registroTardio } from "@/lib/ciclo";
import type { RegistroResumo } from "@/lib/queries";

/** Um registro da lista já com o que depende do servidor (título do encontro
 *  e passo da trilha especialista) — a página resolve e o cliente só desenha. */
export type EntradaRegistro = {
  r: RegistroResumo;
  tituloEncontro: string | null;
  passoEsp: number | null;
};

/** Painel do registro selecionado em /registros (desktop). Reaproveita o
 *  `RegistroView` que o card expandido usa, então a leitura é a mesma da
 *  timeline do celular e da ficha. */
export function RegistroDetalhe({
  entrada,
  souCoord,
}: {
  entrada: EntradaRegistro;
  souCoord: boolean;
}) {
  const { r, tituloEncontro, passoEsp } = entrada;
  const enc = r.encontro;
  const dupla = enc?.dupla ?? null;
  const aconteceuEm = enc?.realizado_em ?? enc?.data_hora ?? null;
  const tardio = registroTardio(r, enc);
  const diasAtraso = tardio ? diasAtrasoRegistro(r, enc) : 0;
  const href = dupla && enc ? `/duplas/${dupla.id}#registrar-${enc.id}` : null;
  const numero =
    passoEsp != null
      ? `${passoEsp}º passo`
      : enc?.numero != null
        ? `${enc.numero}º encontro`
        : "Encontro";

  return (
    <article
      aria-labelledby="registro-detalhe-titulo"
      className="animate-enter rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6"
      style={{ "--i": 0 } as CSSProperties}
    >
      <h2
        id="registro-detalhe-titulo"
        className="text-base font-semibold leading-snug tracking-tight sm:text-lg"
      >
        {numero}
        {tituloEncontro ? ` · ${tituloEncontro}` : ""}
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm font-medium">
        {dupla?.mentor && dupla?.mentorado ? (
          <>
            <DuplaAvatares
              mentor={dupla.mentor}
              mentorado={dupla.mentorado}
              size={32}
            />
            <DuplaNomes mentor={dupla.mentor.nome} mentorado={dupla.mentorado.nome} />
          </>
        ) : (
          "Dupla removida"
        )}
        {dupla && dupla.status !== "ativa" && (
          <span className="text-xs font-normal text-muted-foreground">
            (
            {dupla.status === "pausada"
              ? "dupla pausada"
              : dupla.status === "concluida"
                ? "dupla concluída"
                : "dupla encerrada"}
            )
          </span>
        )}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {aconteceuEm ? `Encontro em ${formatDate(aconteceuEm)}` : "Data a definir"}
        {` · registrado em ${formatDate(r.created_at)}`}
        {r.autor?.nome ? ` por ${r.autor.nome}` : ""}
        {diasAtraso > 0 && (
          <span className="font-medium text-[var(--warn-text)]">
            {` · ${diasAtraso} ${diasAtraso === 1 ? "dia" : "dias"} de atraso`}
          </span>
        )}
      </p>

      {(r.precisa_apoio || tardio) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {r.precisa_apoio && (
            <Badge
              variant="outline"
              className="border-[var(--danger)]/60 text-xs text-[var(--danger)]"
            >
              apoio solicitado
            </Badge>
          )}
          {tardio && (
            <Badge
              variant="outline"
              className="border-[var(--warn)]/60 text-xs font-normal text-[var(--warn-text)]"
            >
              registro tardio
            </Badge>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2 border-t pt-4 text-sm">
        <RegistroView reg={r} tardio={tardio} ocultarMeta />
      </div>

      {(href || (souCoord && r.precisa_apoio && dupla)) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4">
          {href && (
            <Link
              href={href}
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium underline underline-offset-4 transition-colors hover:text-muted-foreground sm:min-h-0"
            >
              Abrir na ficha da dupla
              <ArrowUpRight size={14} aria-hidden />
            </Link>
          )}
          {souCoord && r.precisa_apoio && dupla && (
            <ResolverApoioButton registroId={r.id} duplaId={dupla.id} />
          )}
        </div>
      )}
    </article>
  );
}
