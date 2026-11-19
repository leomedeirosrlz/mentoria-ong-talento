"use client";

import { useId, useState, useTransition } from "react";
import { detalheInstrumentoDaDupla } from "@/lib/actions-formularios";
import { InstrumentoResultado } from "@/components/instrumento-resultado";
import {
  RespostaGatilho,
  RespostaPainel,
} from "@/components/resposta-toggle";
import { formatDate } from "@/lib/ciclo";

type Detalhe = Awaited<ReturnType<typeof detalheInstrumentoDaDupla>>;

// Linha expansível da página por instrumento (REALIZA-331): a lista vem
// server-rendered com o estado por dupla; "Ver resposta" carrega a
// resposta sob demanda — a RPC por dupla só roda pra linha aberta, não
// pra coorte inteira. O gatilho/painel é o RespostaGatilho compartilhado
// (REALIZA-441): mesmo chrome dos toggles estáticos + a animação de
// altura do painel.

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
  const painelId = useId();

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
    <div className="mt-1.5">
      <RespostaGatilho
        aberto={aberto}
        onClick={carregar}
        carregando={pending}
        controls={painelId}
      />
      <RespostaPainel aberto={aberto} id={painelId}>
        {dados?.ok ? (
          <div className="mt-2 border-t border-border/60 pt-3">
            <p className="sr-only">
              Resposta de {jovemNome}
              {dados.respondidoEm && ` em ${formatDate(dados.respondidoEm)}`}
            </p>
            <InstrumentoResultado
              sistema={dados.sistema}
              campos={dados.campos}
              respostas={dados.respostas}
              respostasAnterior={dados.anterior}
            />
          </div>
        ) : dados ? (
          <p className="mt-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            A resposta não está disponível pra sua conta.
          </p>
        ) : null}
      </RespostaPainel>
    </div>
  );
}
