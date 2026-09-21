"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { agendarEncontro, registrarEncontroRetroativo } from "@/lib/actions";
import { MOTIVOS_REAGENDAMENTO } from "@/lib/ciclo";
import type { Encontro } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
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
 * Agenda OU registra o encontro nº `numero` da dupla — data passada cria o
 * encontro já realizado (fluxo retroativo) e leva direto pro follow-up, em vez
 * de devolver um erro apontando pra outro lugar. Com `atual` (remarcação),
 * data passada segue proibida — mover agendado pro passado esconderia atraso.
 */
export function AgendarEncontroDialog({
  duplaId,
  numero,
  atual,
  sugerido,
  piso,
  trigger,
  onCreated,
}: {
  duplaId: string;
  numero: number;
  atual: Encontro | null;
  /** YYYY-MM-DD — pré-preenche a data (19h) quando não é remarcação. */
  sugerido?: string;
  /** YYYY-MM-DD do início da dupla — a sugestão nunca cai antes dele (o
   *  retroativo rejeitaria a data oficial de um encontro pré-dupla). */
  piso?: string;
  /** Elemento do trigger — default é o botão padrão da casa. */
  trigger?: React.ReactElement;
  /** Só no ramo retroativo (data passada): recebe (id do encontro criado,
   *  "YYYY-MM-DD" dele) e substitui a navegação pra ficha — a agenda usa pra
   *  abrir o registro inline no dia em que ele caiu. */
  onCreated?: (encontroId: string, dia: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  // controlado pra revelar o campo de texto livre quando o motivo é "outro"
  const [motivo, setMotivo] = useState("");
  // motivo só é obrigatório quando a data muda — salvar a mesma data (ex.: só
  // pra trocar o link) não é reagendamento e o server também não exige motivo
  const [dataMudou, setDataMudou] = useState(false);
  // valor vivo do campo — decide se o submit agenda ou registra (modo dual)
  const [valorData, setValorData] = useState("");
  // id do card recém-criado — scroll quando o refresh terminar (o card não
  // existia no DOM velho, então o hash sozinho não rola)
  const scrollTarget = useRef<string | null>(null);
  const router = useRouter();

  const valorAtual = atual?.data_hora ? paraInputLocal(new Date(atual.data_hora)) : null;
  const agora = paraInputLocal(new Date());
  // com remarcação o piso segue valendo (ou a data original, se já vencida —
  // salvar sem mudar a data não pode virar inválido). Encontro novo aceita
  // passado: vira registro retroativo no submit.
  const minimo = !atual
    ? undefined
    : dataMudou || !valorAtual || valorAtual > agora
      ? agora
      : valorAtual;
  const sugeridoLocal = sugerido ? `${sugerido}T19:00` : "";
  // encontro novo: o dia sugerido vale mesmo já passado — cai no ramo
  // retroativo; mas nunca antes do início da dupla (a action rejeitaria)
  const pisoLocal = piso ? `${piso}T19:00` : "";
  const defaultValue =
    valorAtual ??
    (sugeridoLocal && pisoLocal && sugeridoLocal < pisoLocal ? pisoLocal : sugeridoLocal);
  // modo retroativo só existe pra encontro novo (sem row editável)
  const ehRetroativo = !atual && valorData !== "" && valorData <= agora;

  useEffect(() => {
    if (pending) return;
    const alvo = scrollTarget.current;
    if (!alvo) return;
    scrollTarget.current = null;
    document.getElementById(alvo)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [pending]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("dupla_id", duplaId);
    fd.set("numero", String(numero));
    const local = String(fd.get("data_hora") ?? "");
    // datetime-local é naïve — vai cru; o server resolve o instante
    // (sem offset = horário de São Paulo; ISO com fuso também é aceito)
    start(async () => {
      try {
        if (ehRetroativo) {
          const res = await registrarEncontroRetroativo(duplaId, numero, local);
          if (res?.error) {
            toast.error(res.error);
            return;
          }
          toast.success("Encontro registrado — agora complete o registro.");
          setOpen(false);
          if (res.encontroId) {
            if (onCreated) {
              // a agenda navega pro dia do encontro e abre o form nela —
              // "local" é o datetime naïve (horário de SP), o dia é o slice
              onCreated(res.encontroId, local.slice(0, 10));
            } else {
              scrollTarget.current = `registrar-${res.encontroId}`;
              // cobre a navegação entre páginas (ex.: registrar a partir da agenda)
              router.push(`/duplas/${duplaId}#registrar-${res.encontroId}`);
              // pushState não dispara hashchange — avisa os cards pra abrir o
              // form do encontro recém-criado (mesma página) ou ignorar (outra)
              window.dispatchEvent(new Event("realiza:hash"));
            }
          }
          router.refresh();
          return;
        }
        const res = await agendarEncontro(fd);
        if (res?.error) toast.error(res.error);
        else {
          toast.success(atual ? `${numero}º encontro remarcado.` : `${numero}º encontro agendado.`);
          setOpen(false);
          router.refresh();
        }
      } catch {
        toast.error("Sem conexão — tente de novo.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setMotivo("");
          setDataMudou(false);
          setValorData(defaultValue);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{numero}º encontro</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="data_hora">Data e horário</Label>
            <Input
              id="data_hora"
              name="data_hora"
              type="datetime-local"
              required
              min={minimo}
              defaultValue={defaultValue}
              onChange={(e) => {
                setValorData(e.target.value);
                setDataMudou(valorAtual != null && e.target.value !== valorAtual);
              }}
            />
            {!atual && (
              <p className="text-xs text-muted-foreground">
                Se o encontro já aconteceu, escolha a data real — ele entra como realizado.
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
              <Label htmlFor="motivo_outro">Descreva o motivo</Label>
              <Input
                id="motivo_outro"
                name="motivo_outro"
                required
                minLength={2}
                maxLength={140}
                placeholder="ex.: mentorado não pôde comparecer"
              />
            </div>
          )}
          {/* origem/link não se aplicam a encontro que já aconteceu — nasce
              "externo" e sem link de chamada. Esconder evita campo mentiroso. */}
          {!ehRetroativo && (
            <>
              <div className="space-y-2">
                <Label id="origem-label">Onde foi marcado</Label>
                <Select
                  name="origem"
                  defaultValue={atual?.origem ?? "plataforma"}
                  items={{ plataforma: "Aqui na plataforma", externo: "Na plataforma oficial (Top2You) ou WhatsApp" }}
                >
                  <SelectTrigger id="origem-select" aria-labelledby="origem-label origem-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plataforma">Aqui na plataforma</SelectItem>
                    <SelectItem value="externo">Na plataforma oficial (Top2You) ou WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="link">Link da chamada (opcional)</Label>
                <Input id="link" name="link" type="url" placeholder="https://meet.google.com/…" defaultValue={atual?.link ?? ""} />
              </div>
            </>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando…" : ehRetroativo ? "Registrar encontro" : atual ? "Confirmar remarcação" : "Confirmar agendamento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
