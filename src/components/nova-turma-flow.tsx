"use client";

// REALIZA-34 — entrada de /turmas/novo: montar com parâmetros (o builder
// da 103) ou importar o cronograma de um arquivo. A importação NUNCA grava:
// o parse devolve um rascunho que cai na mesma prévia editável do builder.

import { useRef, useState, useTransition } from "react";
import {
  CircleNotch,
  FileArrowUp,
  Sparkle,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { CronogramaBuilder } from "@/components/cronograma-builder";
import { Button } from "@/components/ui/button";
import {
  ACCEPT_IMPORT,
} from "@/lib/importar-cronograma/extrair";
import {
  importarCronogramaComIa,
  importarCronogramaRascunho,
  type ResultadoImportacao,
} from "@/lib/actions-importar-cronograma";
import type { RascunhoImportacao } from "@/lib/importar-cronograma/normalizar";
import type { CicloEvento, Cronograma } from "@/lib/types";

type Modo = "montar" | "importar" | "revisar";

export function NovaTurmaFlow({
  cronogramas,
  eventos,
}: {
  cronogramas: Cronograma[];
  eventos: CicloEvento[];
}) {
  const [modo, setModo] = useState<Modo>("montar");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [importado, setImportado] =
    useState<{ rascunho: RascunhoImportacao; arquivo: string } | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function enviar(viaIa: boolean) {
    if (!arquivo) {
      toast.error("Escolha o arquivo do cronograma.");
      return;
    }
    const fd = new FormData();
    fd.set("arquivo", arquivo);
    start(async () => {
      try {
        const res = viaIa
          ? await importarCronogramaComIa(fd)
          : await importarCronogramaRascunho(fd);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        setResultado(res.resultado);
        if (!res.resultado.rascunho.eventos.length)
          toast.info("Nenhum evento reconhecido ainda — revise os avisos ou tente com a IA.");
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  if (modo === "montar")
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setModo("importar")}>
            <FileArrowUp aria-hidden />
            Importar de arquivo
          </Button>
        </div>
        <CronogramaBuilder cronogramas={cronogramas} eventos={eventos} />
      </div>
    );

  if (modo === "revisar" && importado)
    return (
      <CronogramaBuilder
        cronogramas={cronogramas}
        eventos={eventos}
        importado={importado}
        onVoltar={() => {
          setImportado(null);
          setResultado(null);
          setModo("importar");
        }}
      />
    );

  // ---------- modo importar ----------
  const rasc = resultado?.rascunho ?? null;
  return (
    <div className="space-y-5">
      <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
        <h2 className="text-sm font-semibold">Arquivo do cronograma</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF, planilha (xlsx, csv, tsv), DOCX ou TXT, até 8 MB. O arquivo é
          só lido pra montar o rascunho — nada é salvo antes da sua revisão.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_IMPORT}
            className="block w-full max-w-sm text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/70"
            onChange={(e) => {
              setArquivo(e.target.files?.[0] ?? null);
              setResultado(null);
            }}
          />
          <Button
            size="sm"
            disabled={pending || !arquivo}
            onClick={() => enviar(false)}
          >
            {pending && <CircleNotch className="animate-spin" />}
            {pending ? "Lendo arquivo…" : "Ler arquivo"}
          </Button>
        </div>
      </section>

      {rasc && (
        <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
          <h2 className="text-sm font-semibold">Leitura do arquivo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {rasc.eventos.length}{" "}
            {rasc.eventos.length === 1 ? "evento reconhecido" : "eventos reconhecidos"}
            {" · "}confiança {Math.round(rasc.confianca * 100)}%
            {rasc.turma && ` · turma “${rasc.turma}”`}
          </p>
          {rasc.avisos.length > 0 && (
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {rasc.avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={!rasc.eventos.length}
              onClick={() => {
                setImportado({ rascunho: rasc, arquivo: arquivo!.name });
                setModo("revisar");
              }}
            >
              Revisar prévia editável
            </Button>
            {resultado!.iaDisponivel && (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => enviar(true)}
              >
                {pending ? (
                  <CircleNotch className="animate-spin" />
                ) : (
                  <Sparkle aria-hidden />
                )}
                {rasc.confianca < 0.6 ? "Tentar com IA" : "Reprocessar com IA"}
              </Button>
            )}
          </div>
          {resultado!.iaDisponivel && rasc.confianca < 0.6 && (
            <p className="mt-2 text-xs text-muted-foreground">
              A leitura saiu incompleta — a IA pode mapear layouts fora do
              padrão. O resultado dela também passa pela sua revisão.
            </p>
          )}
        </section>
      )}

      <Button variant="ghost" size="sm" onClick={() => setModo("montar")}>
        Voltar
      </Button>
    </div>
  );
}
