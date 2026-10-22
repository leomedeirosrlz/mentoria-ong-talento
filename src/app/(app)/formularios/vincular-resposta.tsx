"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleNotch, LinkSimple } from "@phosphor-icons/react";
import { vincularRespostaOrfa } from "@/lib/forms/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// "Vincular a um jovem" (REALIZA-16): a resposta de um link genérico legado
// (anônimo, pré-0116) ganha dest_mentorado_id — e a dupla DPP dele quando
// existe — sem tocar no payload. O picker é o Select de ui/ com a lista de
// mentorados carregada na página (padrão nova-dupla-dialog: Select simples
// com opções resolvidas no servidor, nada de Command/busca assíncrona).

export function VincularResposta({
  linkId,
  formularioTitulo,
  respondidoEm,
  mentorados,
}: {
  linkId: string;
  formularioTitulo: string;
  /** data da resposta — entra na confirmação pra coord saber o que está
   *  vinculando ("form + quando + quem") */
  respondidoEm: string | null;
  mentorados: { id: string; nome: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const escolhido = mentorados.find((m) => m.id === sel) ?? null;

  function confirmar() {
    if (!escolhido) return;
    start(async () => {
      const r = await vincularRespostaOrfa(linkId, escolhido.id);
      if (r.error) {
        toast.error(r.error);
        setOpen(false);
        router.refresh();
        return;
      }
      if (r.aviso) toast.warning(r.aviso);
      toast.success(`Resposta vinculada a ${escolhido.nome}.`);
      setOpen(false);
      setSel(null);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSel(null);
      }}
    >
      <DialogTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <LinkSimple aria-hidden />
        Vincular a um jovem
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular resposta a um jovem</DialogTitle>
          <DialogDescription>
            Esta resposta de “{formularioTitulo}”
            {respondidoEm
              ? `, de ${new Date(respondidoEm).toLocaleDateString("pt-BR")},`
              : ""}{" "}
            chegou por link genérico, sem identificação. Escolha de quem ela é.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label id="vinculo-mentorado-label">Jovem</Label>
          <Select
            value={sel}
            onValueChange={(v) => setSel(v ? String(v) : null)}
            items={Object.fromEntries(mentorados.map((m) => [m.id, m.nome]))}
          >
            <SelectTrigger
              id="vinculo-mentorado"
              aria-labelledby="vinculo-mentorado-label vinculo-mentorado"
            >
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {mentorados.length === 0 && (
                <SelectItem value="__vazio" disabled>
                  Nenhum jovem cadastrado
                </SelectItem>
              )}
              {mentorados.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {escolhido && (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Vincular esta resposta a {escolhido.nome}? Todo o histórico dela
              passa a contar na jornada dessa pessoa — e quem vinculou fica
              registrado.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Voltar
          </Button>
          <Button onClick={confirmar} disabled={pending || !escolhido}>
            {pending && (
              <CircleNotch className="animate-spin" aria-hidden />
            )}
            Vincular resposta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
