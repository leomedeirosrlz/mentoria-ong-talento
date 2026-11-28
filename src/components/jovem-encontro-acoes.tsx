"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import {
  desmarcarEncontro,
  marcarAconteceuJovem,
  marcarNaoAconteceuJovem,
} from "@/lib/actions";
import { desfazerRetroativoJovem } from "@/lib/actions-jovem";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

/** "Aconteceu" do jovem (0121) — o encontro que já passou vira realizado
 *  pela ponta dele: a avaliação abre na hora e o próximo passo da jornada
 *  libera sem esperar o registro do mentor (que é avisado). Um toque, sem
 *  dialog: confirmar um fato bom não pede fricção. */
export function AconteceuJovem({
  encontroId,
  variant = "default",
}: {
  encontroId: string;
  /** Preenchido só no gesto-âncora da tela; nas demais linhas vai outline. */
  variant?: "default" | "outline";
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant={variant}
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            const res = await marcarAconteceuJovem(encontroId);
            if (res?.error) toast.error(res.error);
            else {
              toast.success("Encontro registrado. Conta pra gente como foi.");
              router.refresh();
            }
          } catch {
            toast.error("Sem conexão. Tente de novo.");
          }
        })
      }
    >
      {pending ? "Salvando…" : "Já aconteceu"}
    </Button>
  );
}

/** "Não aconteceu" do jovem (0072) — encontro agendado já passado, qualquer
 *  trilha da dupla ativa. A cópia não promete desfazer: quem reverte a
 *  marcação é o mentor (o jovem não tem update em encontros). */
export function NaoAconteceuJovem({
  encontroId,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  encontroId: string;
  /** Elemento do trigger — `null` suprime (o ⋯ da linha abre controlado). */
  trigger?: React.ReactElement | null;
  /** Modo controlado (opcional) — o menu de ações abre o dialog direto. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openInterno, setOpenInterno] = useState(false);
  const open = openProp ?? openInterno;
  const [pending, start] = useTransition();
  const router = useRouter();

  function mudaOpen(o: boolean) {
    setOpenInterno(o);
    onOpenChange?.(o);
  }

  return (
    <Dialog open={open} onOpenChange={mudaOpen}>
      {trigger !== null && (
        <DialogTrigger render={
          trigger ?? (
            <Button variant="ghost" size="sm">
              Não aconteceu
            </Button>
          )
        } />
      )}
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>O encontro não aconteceu?</DialogTitle>
        </DialogHeader>
        <DialogDescription className="leading-relaxed">
          O encontro ficará marcado como não realizado. Se rolou de verdade
          ou foi engano, seu mentor registra como foi na ficha dele.
        </DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={() => mudaOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  const res = await marcarNaoAconteceuJovem(encontroId);
                  if (res?.error) toast.error(res.error);
                  else {
                    toast.success("Encontro marcado como não realizado.");
                    mudaOpen(false);
                    router.refresh();
                  }
                } catch {
                  toast.error("Sem conexão. Tente de novo.");
                }
              })
            }
          >
            {pending ? "Salvando…" : "Sim, não aconteceu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Desmarcar" do jovem (0072) — tira o agendado FUTURO da agenda; a RPC é
 *  bilateral, então o gesto vale pra dupla inteira (o mentor é avisado pelo
 *  sino). Passado não se desmarca — vira "não aconteceu". */
export function DesmarcarEncontroJovem({
  encontroId,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  encontroId: string;
  /** Elemento do trigger — `null` suprime (o ⋯ da linha abre controlado). */
  trigger?: React.ReactElement | null;
  /** Modo controlado (opcional) — o menu de ações abre o dialog direto. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openInterno, setOpenInterno] = useState(false);
  const open = openProp ?? openInterno;
  const [pending, start] = useTransition();
  const router = useRouter();

  function mudaOpen(o: boolean) {
    setOpenInterno(o);
    onOpenChange?.(o);
  }

  return (
    <Dialog open={open} onOpenChange={mudaOpen}>
      {trigger !== null && (
        <DialogTrigger render={
          trigger ?? (
            <Button variant="ghost" size="sm">
              Desmarcar
            </Button>
          )
        } />
      )}
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Desmarcar o encontro?</DialogTitle>
        </DialogHeader>
        <DialogDescription className="leading-relaxed">
          O encontro sai da agenda de vocês dois e pode ser marcado de novo
          quando combinarem uma nova data.
        </DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={() => mudaOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  const res = await desmarcarEncontro(encontroId);
                  if (res?.error) toast.error(res.error);
                  else {
                    toast.success("Encontro desmarcado.");
                    mudaOpen(false);
                    router.refresh();
                  }
                } catch {
                  toast.error("Sem conexão. Tente de novo.");
                }
              })
            }
          >
            {pending ? "Salvando…" : "Desmarcar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Desfazer" do retroativo do jovem (0207) — apaga o realizado que ELE
 *  criou enquanto o mentor não registrou (o registro sela o fato). A
 *  avaliação dele cai junto: sem encontro, ela ficava pendurada em nada. */
export function DesfazerRetroativoJovem({
  encontroId,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  encontroId: string;
  /** Elemento do trigger — `null` suprime (o ⋯ da linha abre controlado). */
  trigger?: React.ReactElement | null;
  /** Modo controlado (opcional) — o menu de ações abre o dialog direto. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openInterno, setOpenInterno] = useState(false);
  const open = openProp ?? openInterno;
  const [pending, start] = useTransition();
  const router = useRouter();

  function mudaOpen(o: boolean) {
    setOpenInterno(o);
    onOpenChange?.(o);
  }

  return (
    <Dialog open={open} onOpenChange={mudaOpen}>
      {trigger !== null && (
        <DialogTrigger render={
          trigger ?? (
            <Button variant="ghost" size="sm">
              Desfazer
            </Button>
          )
        } />
      )}
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Desfazer o registro?</DialogTitle>
        </DialogHeader>
        <DialogDescription className="leading-relaxed">
          O encontro sai da sua agenda e a avaliação vai junto, se você já
          respondeu. Se aconteceu de verdade, registre de novo quando quiser.
        </DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={() => mudaOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  const res = await desfazerRetroativoJovem(encontroId);
                  if (res?.error) toast.error(res.error);
                  else {
                    toast.success("Registro desfeito.");
                    mudaOpen(false);
                    router.refresh();
                  }
                } catch {
                  toast.error("Sem conexão. Tente de novo.");
                }
              })
            }
          >
            {pending ? "Salvando…" : "Sim, desfazer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
