"use client";

// Card "Perguntar à Liza" (REALIZA-456): botão + dialog de pergunta +
// card persistido com data, modelo e recorte. "Desatualizado" marca quando
// os agregados mudaram depois da resposta — nunca auto-regenera, só a
// coordenação decide pedir de novo.

import { useState, useTransition } from "react";
import { Sparkle, SealWarning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  analisarResposta,
  RespostaMd,
  type ContextoBlocos,
} from "@/components/assistente-md";
import {
  perguntarLizaRelatorio,
  type CardLiza,
} from "@/lib/actions-relatorio-ia";
import {
  PERGUNTA_PADRAO,
  type AbaLiza,
  type RecorteLiza,
} from "@/lib/relatorios/contexto";

const CTX_BLOCOS: ContextoBlocos = {
  onEnviar: () => {},
  respondida: true,
  streaming: false,
};

const fmtDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function dataHora(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : fmtDataHora.format(d);
}

export function PerguntarLiza({
  aba,
  abaRotulo,
  recorte,
  recorteTexto,
  contextoHash,
  card,
}: {
  aba: AbaLiza;
  abaRotulo: string;
  recorte: RecorteLiza;
  /** "Saúde · Turma 1 · janela de 30 dias" — o rótulo gravado no card */
  recorteTexto: string;
  /** hash dos agregados do render — mudou desde a resposta → desatualizado */
  contextoHash: string;
  /** a row vigente vinda do servidor (null = ainda não perguntado) */
  card: CardLiza | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [pergunta, setPergunta] = useState("");
  const [cardAtual, setCardAtual] = useState<CardLiza | null>(card);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const desatualizado =
    cardAtual != null && cardAtual.contexto_hash !== contextoHash;

  function gerar(forcar: boolean) {
    setErro(null);
    start(async () => {
      const r = await perguntarLizaRelatorio({
        aba,
        recorte,
        pergunta: pergunta.trim() || undefined,
        forcar,
      });
      if (r.ok) {
        setCardAtual(r.card);
        setAberto(false);
      } else {
        setErro(r.erro);
      }
    });
  }

  return (
    <section
      aria-label="Perguntar à Liza"
      className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Perguntar à Liza</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            A Liza responde sobre os agregados desta seção — nunca sobre
            texto livre de pessoas.
          </p>
        </div>
        <Button size="sm" onClick={() => setAberto(true)} disabled={busy}>
          <Sparkle aria-hidden />
          {cardAtual ? "Nova pergunta" : "Perguntar à Liza"}
        </Button>
      </div>

      {cardAtual ? (
        <div className="mt-4 space-y-2.5">
          {desatualizado && (
            <p className="flex items-center gap-1.5 rounded-lg bg-[var(--warn)]/12 px-3 py-2 text-xs font-medium text-[var(--warn-text,var(--warn))]">
              <SealWarning aria-hidden />
              Desatualizado — os dados da seção mudaram depois desta resposta.
            </p>
          )}
          <blockquote className="border-l-2 border-border pl-3 text-sm text-muted-foreground">
            {cardAtual.pergunta}
          </blockquote>
          <RespostaMd
            analise={analisarResposta(cardAtual.resposta_md, false)}
            ctx={CTX_BLOCOS}
          />
          <p className="text-xs text-muted-foreground">
            Gerado em {dataHora(cardAtual.gerado_em)}
            {cardAtual.modelo ? ` · ${cardAtual.modelo}` : ""} ·{" "}
            {recorteTexto}
            {desatualizado && (
              <>
                {" "}
                ·{" "}
                <Button
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => gerar(true)}
                  disabled={busy}
                >
                  Gerar nova leitura
                </Button>
              </>
            )}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Ainda não há resposta para este recorte — a primeira geração já
          fica gravada no histórico da seção.
        </p>
      )}

      {erro && (
        <p role="alert" className="mt-3 text-sm text-[var(--danger)]">
          {erro}
        </p>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Perguntar à Liza — {abaRotulo}</DialogTitle>
            <DialogDescription>
              {recorteTexto}. A resposta fica gravada no histórico da seção,
              com data, modelo e o recorte usado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label
              htmlFor="liza-pergunta"
              className="text-sm font-medium"
            >
              Sua pergunta
            </label>
            <Textarea
              id="liza-pergunta"
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              placeholder={PERGUNTA_PADRAO}
              rows={3}
              maxLength={500}
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">
              Deixe em branco para usar a pergunta padrão: “{PERGUNTA_PADRAO}”
            </p>
          </div>
          {erro && (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {erro}
            </p>
          )}
          <DialogFooter showCloseButton>
            <Button onClick={() => gerar(false)} disabled={busy}>
              {busy ? (
                "Gerando…"
              ) : (
                <>
                  <Sparkle aria-hidden />
                  Gerar resposta
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
