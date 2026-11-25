"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { Eye } from "@phosphor-icons/react";
import { InstrumentoResultado } from "@/components/instrumento-resultado";
import { RespostaLista } from "@/components/resposta-lista";
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
import type {
  FormularioCampo,
  FormularioSistema,
  RespostaValor,
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
  trigger,
  acao,
}: {
  titulo: string;
  respondidoEm: string | null;
  sistema: FormularioSistema | null;
  campos: FormularioCampo[];
  respostas: Record<string, RespostaValor>;
  label?: string;
  /** gatilho custom — o card inteiro da estante (v5c) é render prop com
   *  `nativeButton={false}` (role=button + tabstop pela base); sem ele,
   *  o botão "Rever resposta" de sempre. */
  trigger?: ReactElement;
  /** saída contextual no rodapé ("Abrir o plano" no PDM) */
  acao?: { rotulo: string; href: string };
}) {
  const estruturado = ehInstrumento(sistema);
  return (
    <Dialog>
      <DialogTrigger
        nativeButton={trigger == null}
        render={
          trigger ?? (
            <Button size="sm" variant="outline">
              <Eye aria-hidden />
              {label}
            </Button>
          )
        }
      />
      {/* xl na leitura estruturada (roda + áreas, metas) — conteúdo de
          leitura; 2xl na lista genérica pergunta a pergunta, que é prévia
          tabular e pede largura. O scroll vem da base */}
      <DialogContent size={estruturado ? "xl" : "2xl"}>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            Sua resposta
            {respondidoEm ? ` · enviada em ${formatDate(respondidoEm)}` : ""}.
          </DialogDescription>
        </DialogHeader>
        {estruturado ? (
          <InstrumentoResultado
            sistema={sistema}
            campos={campos}
            respostas={respostas}
          />
        ) : (
          <RespostaLista campos={campos} respostas={respostas} />
        )}
        {acao && (
          <div className="flex justify-end border-t border-border/60 pt-3">
            <Button
              variant="outline"
              render={<Link href={acao.href} />}
              nativeButton={false}
            >
              {acao.rotulo}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
