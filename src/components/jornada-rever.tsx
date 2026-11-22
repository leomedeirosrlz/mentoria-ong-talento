"use client";

import type { ReactElement } from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowCounterClockwise, CircleNotch, Eye } from "@phosphor-icons/react";
import { toast } from "sonner";
import { InstrumentoResultado } from "@/components/instrumento-resultado";
import { RespostaLista } from "@/components/resposta-lista";
import { refazerInstrumentoJovem } from "@/lib/actions-formularios";
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
import { ehInstrumentoDeDupla } from "@/lib/forms/instrumentos";
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
  respostasAnterior = null,
  label = "Rever resposta",
  trigger,
  acao,
  refazerSistema,
  refazerNota,
}: {
  titulo: string;
  respondidoEm: string | null;
  sistema: FormularioSistema | null;
  campos: FormularioCampo[];
  respostas: Record<string, RespostaValor>;
  /** earlier-moment payload (initial roda / início checklist) — enables
   *  the before/after reading in InstrumentoResultado */
  respostasAnterior?: Record<string, RespostaValor> | null;
  label?: string;
  /** gatilho custom — o card inteiro da estante (v5c) é render prop com
   *  `nativeButton={false}` (role=button + tabstop pela base); sem ele,
   *  o botão "Rever resposta" de sempre. */
  trigger?: ReactElement;
  /** saída contextual no rodapé ("Abrir o plano" no PDM) */
  acao?: { rotulo: string; href: string };
  /** self-serve do jovem (0209): "Refazer" no rodapé minta link novo em
   *  branco pra ele mesmo — a resposta lida aqui segue guardada */
  refazerSistema?: string;
  /** o que a resposta nova substitui (486) — a frase da confirmação que
   *  diz qual leitura o link novo reescreve (a inicial é o "antes" da
   *  comparação; a formal, o "depois") */
  refazerNota?: string;
}) {
  const estruturado = ehInstrumentoDeDupla(sistema);
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [pending, start] = useTransition();

  function refazer() {
    if (!refazerSistema) return;
    start(async () => {
      const r = await refazerInstrumentoJovem(refazerSistema);
      if ("error" in r) {
        toast.error(r.error);
        setConfirmando(false);
        return;
      }
      router.push(`/f/${r.token}`);
    });
  }
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
            respostasAnterior={respostasAnterior}
          />
        ) : (
          <RespostaLista campos={campos} respostas={respostas} />
        )}
        {(acao || refazerSistema) && (
          <div className="border-t border-border/60 pt-3">
            {confirmando ? (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Um link novo em branco é gerado pra você responder de
                  novo.{" "}
                  {refazerNota ??
                    "A resposta nova passa a valer no lugar desta."}{" "}
                  A anterior fica salva e seu mentor ainda consegue vê-la.
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setConfirmando(false)}
                    disabled={pending}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={refazer} disabled={pending}>
                    {pending ? (
                      <CircleNotch className="animate-spin" aria-hidden />
                    ) : null}
                    Sim, refazer
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                {refazerSistema && (
                  <Button
                    variant="outline"
                    onClick={() => setConfirmando(true)}
                  >
                    <ArrowCounterClockwise aria-hidden />
                    Refazer
                  </Button>
                )}
                {acao && (
                  <Button
                    variant="outline"
                    render={<Link href={acao.href} />}
                    nativeButton={false}
                  >
                    {acao.rotulo}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
