"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  agendarEncontroJovem,
  conflitoEncontro,
  type ConflitoEncontro,
} from "@/lib/actions";
import { formatDate, formatDiaHora, MOTIVOS_REAGENDAMENTO } from "@/lib/ciclo";
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

/** Rótulo da sessão que encosta — a trilha vem da RPC conflito_encontro. */
function rotuloConflito(c: ConflitoEncontro): string {
  return c.trilha === "especialista"
    ? "sessão de especialista"
    : "encontro de mentoria";
}

/**
 * Agenda livre do jovem (REALIZA-110): agenda o encontro nº `numero` da
 * própria dupla DPP — ou, sem `numero`, deixa ele escolher na lista
 * `numeros`. Sem retroativo: data passada não é atalho pra nada (o mentor
 * registra como foi), então o piso do input é sempre agora. Com `atual`
 * (remarcação), o motivo só é obrigatório quando a data muda — mesma regra
 * da RPC e do dialog do mentor.
 */
export function JovemAgendarDialog({
  duplaId,
  numero,
  numeros,
  atual,
  trigger,
}: {
  duplaId: string;
  /** Fixo quando a linha já diz qual encontro é (remarcação); undefined
   *  abre o modo "escolher qual encontro agendar" (Select de `numeros`). */
  numero?: number;
  /** Candidatos do Select — nº + data oficial quando o calendário é legível. */
  numeros?: { numero: number; data?: string | null }[];
  /** Edição de um agendado existente — habilita o motivo da remarcação. */
  atual: JovemEncontro | null;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [motivo, setMotivo] = useState("");
  const [motivoLen, setMotivoLen] = useState(0);
  const [dataMudou, setDataMudou] = useState(false);
  const [valorData, setValorData] = useState("");
  // modo "escolher encontro": o nº escolhido dirige o submit e o hint de
  // data oficial (troca o valor do campo pela data do guia)
  const [numeroSel, setNumeroSel] = useState<number | null>(
    numero ?? atual?.numero ?? null
  );
  // resultado guardado com a data consultada — um retorno atrasado de uma
  // data que já mudou (ou de um dialog fechado) não vira aviso mentiroso
  const [conflito, setConflito] = useState<{
    para: string;
    lista: ConflitoEncontro[];
  } | null>(null);
  const timerConflito = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const valorAtual = atual?.data_hora ? paraInputLocal(new Date(atual.data_hora)) : null;
  const agora = paraInputLocal(new Date());
  const inicial = valorAtual ?? "";
  const numeroFinal = numero ?? numeroSel;

  // warning de overlap: debounce na data — a RPC olha as outras duplas do
  // jovem; falha vira lista vazia (best-effort, nunca bloqueia o submit)
  useEffect(() => {
    if (timerConflito.current) clearTimeout(timerConflito.current);
    if (!open || !valorData) return;
    const v = valorData;
    timerConflito.current = setTimeout(() => {
      conflitoEncontro(duplaId, v)
        .then((res) => setConflito({ para: v, lista: res.conflitos ?? [] }))
        .catch(() => setConflito({ para: v, lista: [] }));
    }, 400);
    return () => {
      if (timerConflito.current) clearTimeout(timerConflito.current);
    };
  }, [valorData, duplaId, open]);
  const conflitos = conflito?.para === valorData && open ? conflito.lista : [];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (numeroFinal == null) return;
    const fd = new FormData(e.currentTarget);
    // datetime-local é naïve — vai cru; o server resolve o instante
    const local = String(fd.get("data_hora") ?? "");
    const link = String(fd.get("link") ?? "").trim() || null;
    // motivo final: label do preset ou o texto livre do "outro" — a RPC só
    // cobra quando a data mudou mesmo
    const m = String(fd.get("motivo") ?? "");
    const motivoFinal = !m
      ? null
      : m === "outro"
        ? String(fd.get("motivo_outro") ?? "").trim()
        : (MOTIVOS_REAGENDAMENTO.find((x) => x.value === m)?.label ?? null);
    const n = numeroFinal;
    start(async () => {
      try {
        const res = await agendarEncontroJovem(duplaId, n, local, link, motivoFinal);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success(atual ? `${n}º encontro remarcado.` : `${n}º encontro agendado.`);
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  const avisoConflito =
    conflitos.length > 0
      ? `Você tem ${rotuloConflito(conflitos[0])} marcada pra ${formatDiaHora(
          conflitos[0].data_hora
        )}${conflitos.length > 1 ? ` (e mais ${conflitos.length - 1})` : ""}. Confirme antes de seguir.`
      : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setMotivo("");
          setMotivoLen(0);
          setDataMudou(false);
          setNumeroSel(numero ?? atual?.numero ?? null);
          setValorData(inicial);
        }
      }}
    >
      <DialogTrigger render={
        trigger ?? (
          <Button variant={atual ? "outline" : "default"} size="sm">
            <CalendarPlus size={16} />
            {atual ? "Remarcar" : "Agendar encontro"}
          </Button>
        )
      } />
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {atual || numero ? `${numeroFinal ?? numero}º encontro` : "Agendar encontro"}
          </DialogTitle>
          <DialogDescription>
            Escolha o encontro e marque a data e o horário com seu mentor.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {numero == null && !atual && numeros && numeros.length > 0 && (
            <div className="space-y-2">
              <Label id="numero-label">Qual encontro?</Label>
              <Select
                required
                value={numeroSel != null ? String(numeroSel) : ""}
                onValueChange={(v) => {
                  const n = Number(v);
                  setNumeroSel(n);
                  // a data oficial entra como sugestão — ele ajusta à vontade
                  const d = numeros.find((x) => x.numero === n)?.data;
                  if (d) setValorData(`${d}T19:00`);
                }}
                items={Object.fromEntries(
                  numeros.map((x) => [
                    String(x.numero),
                    x.data
                      ? `${x.numero}º encontro · previsto ${formatDate(x.data)}`
                      : `${x.numero}º encontro`,
                  ])
                )}
              >
                <SelectTrigger id="numero-select" aria-labelledby="numero-label numero-select">
                  <SelectValue placeholder="Escolha o encontro" />
                </SelectTrigger>
                <SelectContent>
                  {numeros.map((x) => (
                    <SelectItem key={x.numero} value={String(x.numero)}>
                      {x.data
                        ? `${x.numero}º encontro · previsto ${formatDate(x.data)}`
                        : `${x.numero}º encontro`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="data_hora">Data e horário</Label>
            <Input
              id="data_hora"
              name="data_hora"
              type="datetime-local"
              required
              min={agora}
              value={valorData}
              onChange={(e) => {
                setValorData(e.target.value);
                setDataMudou(valorAtual != null && e.target.value !== valorAtual);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Combinem a data juntos. Seu mentor é avisado da marcação.
            </p>
            {avisoConflito && (
              <p className="flex items-start gap-1.5 text-xs leading-relaxed text-[var(--warn-text)]">
                <Warning size={13} aria-hidden className="mt-0.5 shrink-0" />
                {avisoConflito}
              </p>
            )}
          </div>
          {atual && (
            <div className="space-y-2">
              <Label id="motivo-label">Motivo da remarcação</Label>
              {!dataMudou && (
                <p className="text-xs text-muted-foreground">Só precisa se mudar a data.</p>
              )}
              <Select name="motivo" required={dataMudou} value={motivo} onValueChange={(v) => setMotivo(v ?? "")} items={Object.fromEntries(MOTIVOS_REAGENDAMENTO.map((m) => [m.value, m.label]))}>
                <SelectTrigger id="motivo-select" aria-labelledby="motivo-label motivo-select"><SelectValue placeholder="Escolha o motivo" /></SelectTrigger>
                <SelectContent>
                  {MOTIVOS_REAGENDAMENTO.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {atual && motivo === "outro" && (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="motivo_outro">Descreva o motivo</Label>
                <span aria-hidden className="text-xs tabular-nums text-muted-foreground">
                  {motivoLen}/140
                </span>
              </div>
              <Input
                id="motivo_outro"
                name="motivo_outro"
                required
                minLength={2}
                maxLength={140}
                onChange={(e) => setMotivoLen(e.target.value.length)}
                placeholder="ex.: prova na escola nesse dia"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="link">Link da chamada (opcional)</Label>
            <Input id="link" name="link" type="url" placeholder="https://meet.google.com/…" defaultValue={atual?.link ?? ""} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || numeroFinal == null}>
              {pending ? "Salvando…" : atual ? "Confirmar remarcação" : "Confirmar agendamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
