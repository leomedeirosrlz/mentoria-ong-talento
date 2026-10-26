"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { sugerirEspecialistaMentor } from "@/lib/actions-especialista";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const QUALQUER = "qualquer";

/** "Sugerir especialista" (WP6 / D10) — o mentor DPP registra a demanda em
 *  nome do jovem, mas quem decide é ele: nasce 'sugerida' (fora do mural e
 *  dos tetos) e só vira pedido real quando o jovem confirma na página de
 *  especialistas. Diferente da solicitação direta, que já cai na mesa dos
 *  especialistas sem passar pela vontade dele. */
export function SugerirEspecialistaDialog({
  mentoradoId,
  duplaDppId,
  especialistas,
  nomeJovem,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  mentoradoId: string;
  duplaDppId: string;
  especialistas: { id: string; nome: string; areas: string[] | null }[];
  nomeJovem: string;
  /** Elemento do trigger — default é o botão padrão da casa. `null` suprime:
   *  o menu "Mais" da ficha abre o dialog controlado (REALIZA-157). */
  trigger?: React.ReactElement | null;
  /** Modo controlado (opcional): o pai segura o estado. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openInt, setOpenInt] = useState(false);
  const open = openProp ?? openInt;
  const setOpen = onOpenChangeProp ?? setOpenInt;
  const [pending, start] = useTransition();
  const [demandaLen, setDemandaLen] = useState(0);
  const [esp, setEsp] = useState(QUALQUER);
  const router = useRouter();
  const primeiro = nomeJovem.split(" ")[0];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const res = await sugerirEspecialistaMentor({
          mentoradoId,
          duplaDppId,
          demanda: String(fd.get("demanda") ?? ""),
          objetivo: String(fd.get("objetivo") ?? "") || null,
          especialistaId: esp === QUALQUER ? null : esp,
        });
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success(
          `Sugestão registrada. ${primeiro} confirma ou ajusta na página de especialistas.`
        );
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  // estado fresco por abertura — ajuste na borda de subida do `open`: no
  // modo controlado a abertura vem da prop e o Base UI não reemite
  // onOpenChange (mesmo padrão do RemanejarDuplaDialog)
  const [abertoAntes, setAbertoAntes] = useState(open);
  if (open !== abertoAntes) {
    setAbertoAntes(open);
    if (open) {
      setDemandaLen(0);
      setEsp(QUALQUER);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger
          render={
            trigger ?? (
              <Button variant="outline" size="sm">
                <Sparkle size={16} />
                Sugerir especialista
              </Button>
            )
          }
        />
      )}
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Sugerir especialista pro jovem</DialogTitle>
          <DialogDescription>
            A sugestão chega pra {primeiro} primeiro. A trilha só nasce se a
            pessoa confirmar que faz sentido.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="sug-mentor-demanda">Tema ou necessidade</Label>
              <span
                aria-hidden
                className="text-xs tabular-nums text-muted-foreground"
              >
                {demandaLen}/1.000
              </span>
            </div>
            <Textarea
              id="sug-mentor-demanda"
              name="demanda"
              required
              minLength={10}
              maxLength={1000}
              rows={3}
              onChange={(e) => setDemandaLen(e.target.value.length)}
              placeholder="ex.: vai concorrer a uma vaga e trava na entrevista"
            />
            <p className="text-xs text-muted-foreground">
              Escreva como quem conversou com {primeiro}: é o que ela/ele lê
              ao decidir.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sug-mentor-objetivo">
              O que a trilha destrava (opcional)
            </Label>
            <Textarea
              id="sug-mentor-objetivo"
              name="objetivo"
              maxLength={500}
              rows={2}
              placeholder="ex.: passar na entrevista do jovem aprendiz"
            />
          </div>
          <div className="space-y-2">
            <Label id="sug-mentor-esp-label">
              Pensando em alguém? (opcional)
            </Label>
            <Select
              value={esp}
              onValueChange={(v) => setEsp(v ?? QUALQUER)}
              items={{
                [QUALQUER]: "Deixar a coordenação direcionar",
                ...Object.fromEntries(
                  especialistas.map((e) => [
                    e.id,
                    e.areas?.length ? `${e.nome} · ${e.areas.join(", ")}` : e.nome,
                  ])
                ),
              }}
            >
              <SelectTrigger
                id="sug-mentor-esp"
                aria-labelledby="sug-mentor-esp-label sug-mentor-esp"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={QUALQUER}>
                  Deixar a coordenação direcionar
                </SelectItem>
                {especialistas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.areas?.length
                      ? `${e.nome} · ${e.areas.join(", ")}`
                      : e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Registrando…" : "Registrar sugestão"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
