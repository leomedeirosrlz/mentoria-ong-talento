"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClockCounterClockwise } from "@phosphor-icons/react";
import { toast } from "sonner";
import { registrarRetroativoJovem } from "@/lib/actions-jovem";
import type { JovemEncontro } from "@/lib/queries-jovem";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/** datetime-local espera horário local — toISOString exibiria UTC (3h adiantado). */
function paraInputLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Retroativo do jovem (REALIZA-437 / 0207): o encontro que aconteceu sem
 * agendamento prévio nasce realizado — entra na lista dele pra avaliar na
 * hora e o mentor é avisado pra contar como foi no registro (segue devido).
 * Com `atual` vira a correção de data do retroativo que ele mesmo criou —
 * mesma RPC, upsert por (dupla,numero); o banco só deixa mexer enquanto o
 * mentor não registrou.
 */
export function JovemRetroativoDialog({
  duplaId,
  numeros,
  atual,
  trigger,
}: {
  duplaId: string;
  /** Candidatos do Select — nº sem row na agenda (criação). */
  numeros?: number[];
  /** Correção de um retroativo criado por ele — fixa o nº e pré-preenche a data. */
  atual?: JovemEncontro | null;
  /** Elemento do trigger — cada ponto da UI escolhe a aparência. */
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [numero, setNumero] = useState("");
  const [quando, setQuando] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  // teto do datetime-local: retroativo é sempre pra trás (o server revalida)
  const agora = paraInputLocal(new Date());
  const numeroFixo = atual?.numero ?? null;
  const dataAtual = atual?.realizado_em ?? atual?.data_hora ?? null;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const n = numeroFixo ?? (numero !== "" ? Number(numero) : null);
    if (n == null) {
      toast.error("Escolha qual encontro foi.");
      return;
    }
    const local = String(new FormData(e.currentTarget).get("data_hora") ?? "");
    if (!local) return;
    // datetime-local é naïve — vai cru; o server lê como horário de SP
    start(async () => {
      try {
        const res = await registrarRetroativoJovem(duplaId, n, local);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success(
          atual
            ? "Data corrigida."
            : `${n}º encontro registrado. Já dá pra avaliar.`
        );
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setNumero("");
          setQuando(dataAtual ? paraInputLocal(new Date(dataAtual)) : "");
        } else {
          setNumero("");
          setQuando("");
        }
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            {atual
              ? `Corrigir a data do ${numeroFixo}º encontro`
              : "Registrar encontro que já aconteceu"}
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            {atual
              ? "O encontro continua realizado, só com a data certa."
              : "Se vocês se encontraram sem agendar por aqui (combinaram por WhatsApp, por exemplo), conte quando foi. O encontro já entra como realizado e você pode avaliar na hora. Seu mentor é avisado pra contar como foi no registro dele."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {!atual && numeros && numeros.length > 0 && (
            <div className="space-y-2">
              <Label id="retro-numero-label">Qual encontro foi</Label>
              <Select
                name="numero"
                required
                value={numero}
                items={Object.fromEntries(
                  numeros.map((n) => [String(n), `${n}º encontro`])
                )}
                onValueChange={(v) => setNumero(v ?? "")}
              >
                <SelectTrigger
                  id="retro-numero-select"
                  aria-labelledby="retro-numero-label retro-numero-select"
                >
                  <SelectValue placeholder="Escolha o encontro" />
                </SelectTrigger>
                <SelectContent>
                  {numeros.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}º encontro
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="data_hora">Quando foi</Label>
            <Input
              id="data_hora"
              name="data_hora"
              type="datetime-local"
              required
              max={agora}
              value={quando}
              onChange={(e) => setQuando(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              <ClockCounterClockwise size={16} />
              {pending
                ? "Salvando…"
                : atual
                  ? "Salvar correção"
                  : "Registrar encontro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
