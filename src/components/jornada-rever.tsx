"use client";

import { Eye } from "@phosphor-icons/react";
import { InstrumentoResultado } from "@/components/instrumento-resultado";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/ciclo";
import { ehInstrumento } from "@/lib/forms/instrumentos";
import {
  camposPerguntas,
  respostaFormatada,
  type FormularioCampo,
  type FormularioSistema,
  type RespostaValor,
} from "@/lib/forms/schema";

/** WP7 — "Rever resposta" da estação feita (mesmo padrão da ficha da dupla,
 *  instrumentos-dupla.tsx): Dialog + leitura estruturada do instrumento
 *  (a roda desenhada, as metas com IS/prazo, a declaração de visão). Fora
 *  dos 4 sistemas de dupla — a Avaliação 360º — cai na lista pergunta a
 *  pergunta (o resultado estruturado não conhece o form genérico). */
export function ReverRespostaDialog({
  titulo,
  respondidoEm,
  sistema,
  campos,
  respostas,
  label = "Rever resposta",
}: {
  titulo: string;
  respondidoEm: string | null;
  sistema: FormularioSistema | null;
  campos: FormularioCampo[];
  respostas: Record<string, RespostaValor>;
  label?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Eye aria-hidden />
            {label}
          </Button>
        }
      />
      {/* xl, não 2xl: a resposta estruturada (roda + áreas, metas) é
          conteúdo de leitura, não prévia tabular; o scroll vem da base */}
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            Sua resposta
            {respondidoEm ? ` — enviada em ${formatDate(respondidoEm)}` : ""}.
          </DialogDescription>
        </DialogHeader>
        {ehInstrumento(sistema) ? (
          <InstrumentoResultado
            sistema={sistema}
            campos={campos}
            respostas={respostas}
          />
        ) : (
          <ListaRespostas campos={campos} respostas={respostas} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Lista pergunta a pergunta pro form genérico (360º e qualquer sistema sem
 *  leitura estruturada). Sem `campos` — resposta de instrumento cujo form
 *  não veio no payload — cai no recorte cru do que ela preencheu. */
function ListaRespostas({
  campos,
  respostas,
}: {
  campos: FormularioCampo[];
  respostas: Record<string, RespostaValor>;
}) {
  const linhas = camposPerguntas(campos)
    .map((c) => ({
      id: c.id,
      label: c.label,
      valor: respostaFormatada(c, respostas[c.id]),
    }))
    .filter((l) => l.valor !== "—" && l.valor.trim() !== "");

  if (!linhas.length) {
    const cruas = Object.entries(respostas).filter(
      ([, v]) => v != null && String(v).trim() !== ""
    );
    if (!cruas.length) {
      return (
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar o detalhe desta resposta.
        </p>
      );
    }
    return (
      <dl className="space-y-3">
        {cruas.map(([id, v]) => (
          <div key={id}>
            <dt className="text-xs font-medium text-muted-foreground">
              {id.replace(/_/g, " ")}
            </dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm">
              {respostaFormatada(undefined, v)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className="space-y-3">
      {linhas.map((l) => (
        <div key={l.id}>
          <dt className="text-xs font-medium text-muted-foreground">
            {l.label}
          </dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-sm">{l.valor}</dd>
        </div>
      ))}
    </dl>
  );
}
