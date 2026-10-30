"use client";

import { useState, useTransition } from "react";
import { CircleNotch, Eye } from "@phosphor-icons/react";
import { detalheInstrumentoDaDupla } from "@/lib/actions-formularios";
import { InstrumentoResultado } from "@/components/instrumento-resultado";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/ciclo";

type Detalhe = Awaited<ReturnType<typeof detalheInstrumentoDaDupla>>;

// Linha expansível da página por instrumento (REALIZA-331): a lista vem
// server-rendered com o estado por dupla; "Ver respostas" carrega a
// resposta sob demanda — a RPC por dupla só roda pra linha aberta, não
// pra coorte inteira.

export function DetalheInstrumentoLazy({
  duplaId,
  chave,
  jovemNome,
}: {
  duplaId: string;
  /** chave da estação da página (roda_inicial separa da formal dentro
   *  do mesmo sistema roda_vida) */
  chave: string;
  jovemNome: string;
}) {
  const [pending, start] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<Detalhe | null>(null);

  function carregar() {
    if (aberto) {
      setAberto(false);
      return;
    }
    setAberto(true);
    if (dados) return; // já carregou uma vez — só reabre
    start(async () => {
      try {
        setDados(await detalheInstrumentoDaDupla(duplaId, chave));
      } catch {
        setDados({ ok: false });
      }
    });
  }

  return (
    <div className="pt-1.5">
      <Button
        type="button"
        onClick={carregar}
        aria-expanded={aberto}
        variant="ghost"
        size="sm"
        className="-ml-2"
      >
        {pending ? (
          <CircleNotch size={13} className="animate-spin" aria-hidden />
        ) : (
          <Eye size={13} aria-hidden />
        )}
        {aberto ? "Esconder respostas" : "Ver respostas"}
      </Button>
      {aberto &&
        (pending ? null : dados?.ok ? (
          <div className="mt-2 border-t border-border/60 pt-3">
            <p className="sr-only">
              Resposta de {jovemNome}
              {dados.respondidoEm && ` em ${formatDate(dados.respondidoEm)}`}
            </p>
            <InstrumentoResultado
              sistema={dados.sistema}
              campos={dados.campos}
              respostas={dados.respostas}
            />
          </div>
        ) : dados ? (
          <p className="mt-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            A resposta não está disponível pra sua conta.
          </p>
        ) : null)}
    </div>
  );
}
