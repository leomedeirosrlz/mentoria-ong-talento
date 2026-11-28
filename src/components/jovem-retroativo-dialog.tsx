"use client";

import { cloneElement, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { registrarRetroativoJovem } from "@/lib/actions-jovem";
import type { JovemEncontro } from "@/lib/queries-jovem";
import { elementoReal } from "@/lib/elemento-lazy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SeletorDiaHora } from "@/components/seletor-dia-hora";

/** ISO → par civil local pro seletor (data "YYYY-MM-DD" + "HH:mm"). */
function splitLocal(iso: string): { data: string; hora: string } {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    data: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    hora: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}

/**
 * Retroativo do jovem (REALIZA-437 / 0207): o encontro que aconteceu sem
 * agendamento prévio nasce realizado — entra na lista dele pra avaliar na
 * hora e o mentor é avisado pra contar como foi no registro (segue devido).
 * Com `atual` vira a correção de data do retroativo que ele mesmo criou —
 * mesma RPC, upsert por (dupla,numero); o banco só deixa mexer enquanto o
 * mentor não registrou. O "quando foi" usa o SeletorDiaHora em modo
 * retroativo (530): dois campos nativos, dia limitado a hoje pra trás.
 */
export function JovemRetroativoDialog({
  duplaId,
  numeros,
  atual,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  duplaId: string;
  /** Candidatos do Select — nº sem row na agenda (criação). */
  numeros?: number[];
  /** Correção de um retroativo criado por ele — fixa o nº e pré-preenche a data. */
  atual?: JovemEncontro | null;
  /** Elemento do trigger — `null` suprime (o menu abre controlado). */
  trigger?: React.ReactElement | null;
  /** Modo controlado (opcional) — o ⋯ da linha abre o dialog direto. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openInterno, setOpenInterno] = useState(false);
  const open = openProp ?? openInterno;
  const [aviso, setAviso] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const numeroFixo = atual?.numero ?? null;
  const dataAtual = atual?.realizado_em ?? atual?.data_hora ?? null;
  const semElegivel = !atual && numeros != null && numeros.length === 0;

  // estado fresco por abertura — o seletor reseta os campos na borda de
  // subida; aqui cai o aviso de uma visita anterior
  const [abertoAntes, setAbertoAntes] = useState(open);
  if (open !== abertoAntes) {
    setAbertoAntes(open);
    if (open) setAviso(null);
  }

  function mudaOpen(o: boolean) {
    setOpenInterno(o);
    onOpenChange?.(o);
  }

  // o gatilho mora fora da superfície — o seletor já É o dialog/sheet
  // trigger via RSC chega lazy — resolve antes de clonar (elementoReal)
  const gatilho =
    trigger === null
      ? null
      : cloneElement(
          elementoReal(
            trigger ?? (
              <Button variant="outline" size="sm">
                Registrar encontro
              </Button>
            )
          ),
          { onClick: () => mudaOpen(true), "aria-haspopup": "dialog" }
        );

  if (semElegivel) {
    return (
      <>
        {gatilho}
        <Dialog open={open} onOpenChange={mudaOpen}>
          <DialogContent size="md">
            <DialogHeader>
              <DialogTitle>Registrar encontro que já aconteceu</DialogTitle>
              <DialogDescription className="leading-relaxed">
                Se vocês se encontraram sem agendar por aqui (combinaram por
                WhatsApp, por exemplo), conte quando foi. O encontro já entra
                como realizado e você pode avaliar na hora. Seu mentor é
                avisado pra contar como foi no registro dele.
              </DialogDescription>
            </DialogHeader>
            {/* sem passo elegível a copy não manda "pedir pro mentor" — ela
                explica a fronteira: o que falta na lista é passo ainda não
                vencido no guia ou o encontro de encerramento, e esses são
                dele por desenho, não por falta de permissão do jovem */}
            <p className="text-sm leading-relaxed text-muted-foreground">
              Todos os encontros do guia que já venceram estão na sua agenda.
              O que falta entrar é um passo que ainda não chegou no calendário
              oficial ou o encontro de encerramento. Esse quem registra é o
              seu mentor, que fecha a jornada com vocês.
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => mudaOpen(false)}
              >
                Entendi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  function confirmar(data: string, hora: string, n: number) {
    // o par civil vai naïve — o server lê como horário de SP
    const local = `${data}T${hora}`;
    start(async () => {
      try {
        const res = await registrarRetroativoJovem(duplaId, n, local);
        if (res?.error) {
          setAviso(res.error);
          return;
        }
        toast.success(
          atual
            ? "Data corrigida."
            : `${n}º encontro registrado. Já dá pra avaliar.`
        );
        mudaOpen(false);
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <>
      {gatilho}
      <SeletorDiaHora
        aberto={open}
        onAberto={mudaOpen}
        numero={numeroFixo ?? numeros?.[0] ?? 0}
        numeros={atual ? [] : (numeros ?? [])}
        encontroPrimario={!atual && (numeros?.length ?? 0) > 0}
        idEncontro="retro-numero-select"
        rotuloEncontro="Qual encontro foi"
        modo="retroativo"
        rotuloDia="Quando foi"
        titulo={
          atual
            ? `Corrigir a data do ${numeroFixo}º encontro`
            : "Registrar encontro que já aconteceu"
        }
        descricao={
          atual
            ? "O encontro continua realizado, só com a data certa."
            : "Se vocês se encontraram sem agendar por aqui (combinaram por WhatsApp, por exemplo), conte quando foi. O encontro já entra como realizado e você pode avaliar na hora. Seu mentor é avisado pra contar como foi no registro dele."
        }
        inicial={dataAtual ? splitLocal(dataAtual) : null}
        rotuloConfirmar={atual ? "Salvar correção" : "Registrar encontro"}
        pending={pending}
        aviso={aviso}
        onAviso={setAviso}
        onConfirmar={confirmar}
      >
      </SeletorDiaHora>
    </>
  );
}
