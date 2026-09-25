"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClockCounterClockwise } from "@phosphor-icons/react";
import { toast } from "sonner";
import { registrarEncontroRetroativo } from "@/lib/actions";
import { formatDate, type EncontroFaltante } from "@/lib/ciclo";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
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
 * Encontro que aconteceu sem agendamento prévio (combinado por WhatsApp etc.).
 * Nasce realizado com origem "externo" e leva direto pro follow-up.
 */
export function RegistrarRetroativoDialog({
  duplaId,
  faltantes,
  trigger,
  numeroInicial,
  quandoPadrao,
  onCreated,
}: {
  duplaId: string;
  faltantes: EncontroFaltante[];
  /** Elemento do trigger — cada ponto da UI escolhe a aparência. */
  trigger: React.ReactElement;
  /** Pré-seleciona o encontro — a agenda já sabe qual dia o usuário clicou. */
  numeroInicial?: number;
  /** YYYY-MM-DD — pré-preenche "quando foi" (19h, caindo em agora se não passou). */
  quandoPadrao?: string;
  /** Recebe (id do encontro criado, "YYYY-MM-DD" dele) e substitui a navegação
   *  pra ficha — a agenda usa pra abrir o registro inline no dia em que ele caiu. */
  onCreated?: (encontroId: string, dia: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [numero, setNumero] = useState<string | null>(
    numeroInicial != null ? String(numeroInicial) : null,
  );
  const [quando, setQuando] = useState("");
  // id do card recém-criado — o efeito abaixo rola até ele quando o refresh
  // termina (router.push com hash não rola: o card não existia no DOM velho)
  const scrollTarget = useRef<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  // teto do datetime-local: não aceita futuro (o server também valida)
  const agora = paraInputLocal(new Date());
  // default de "quando foi": o dia clicado (19h) ou a sugestão do encontro
  // pré-selecionado — se ainda não passou, cai em agora
  const quandoInicial = () => {
    const base = quandoPadrao
      ?? faltantes.find((f) => f.numero === numeroInicial)?.dataSugerida;
    if (!base) return "";
    const pre = `${base}T19:00`;
    return pre > agora ? agora : pre;
  };

  useEffect(() => {
    if (pending) return;
    const alvo = scrollTarget.current;
    if (!alvo) return;
    scrollTarget.current = null;
    document.getElementById(alvo)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [pending]);

  function escolherNumero(v: string | null) {
    setNumero(v);
    const f = faltantes.find((x) => String(x.numero) === v);
    if (!f) return;
    // trilha sem data oficial (especialista) não tem sugestão — prefill cai em agora
    if (!f.dataSugerida) {
      setQuando(agora);
      return;
    }
    // prefill na data sugerida às 19h — se ainda não passou (sugerido hoje), cai em agora
    const pre = `${f.dataSugerida}T19:00`;
    setQuando(pre > agora ? agora : pre);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!numero) {
      toast.error("Escolha qual encontro foi.");
      return;
    }
    const local = String(new FormData(e.currentTarget).get("data_hora") ?? "");
    if (!local) return;
    // datetime-local é naïve — o server interpreta o valor sem fuso como
    // horário de São Paulo, então manda o valor cru
    start(async () => {
      try {
        const res = await registrarEncontroRetroativo(duplaId, Number(numero), local);
        if (res?.error) toast.error(res.error);
        else {
          toast.success("Encontro registrado. Agora complete o registro.");
          setOpen(false);
          setNumero(null);
          setQuando("");
          if (res.encontroId) {
            if (onCreated) {
              // a agenda navega pro dia do encontro e abre o form nela — "local"
              // é o datetime naïve (horário de SP), o dia de calendário é o slice
              onCreated(res.encontroId, local.slice(0, 10));
            } else {
              scrollTarget.current = `registrar-${res.encontroId}`;
              // cobre a navegação entre páginas (ex.: registrar a partir da home)
              router.push(`/duplas/${duplaId}#registrar-${res.encontroId}`);
              // pushState não dispara hashchange — avisa os cards pra abrir o
              // form do encontro recém-criado (mesma página) ou ignorar (outra)
              window.dispatchEvent(new Event("realiza:hash"));
            }
          }
          router.refresh();
        }
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
          // abre no contexto que o trigger trouxe (dia clicado na agenda etc.)
          setNumero(numeroInicial != null ? String(numeroInicial) : null);
          setQuando(quandoInicial());
        } else {
          setNumero(null);
          setQuando("");
        }
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar encontro que já aconteceu</DialogTitle>
        </DialogHeader>
        <DialogDescription className="leading-relaxed">
          Se encontraram sem agendar por aqui (combinaram por WhatsApp, por
          exemplo), conte quando foi. O encontro já nasce como realizado e você
          completa o registro em seguida.
        </DialogDescription>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label id="retro-numero-label">Qual encontro foi</Label>
            <Select
              name="numero"
              required
              value={numero}
              // sem items o trigger fechado mostra só "3" — o label é o texto cheio
              items={Object.fromEntries(faltantes.map((f) => [
                String(f.numero),
                f.dataSugerida
                  ? `${f.numero}º encontro · sugerido ${formatDate(f.dataSugerida)}`
                  : `${f.numero}º encontro`,
              ]))}
              onValueChange={(v) => escolherNumero(v ?? null)}
            >
              <SelectTrigger
                id="retro-numero-select"
                aria-labelledby="retro-numero-label retro-numero-select"
              >
                <SelectValue placeholder="Escolha o encontro" />
              </SelectTrigger>
              <SelectContent>
                {faltantes.map((f) => (
                  <SelectItem key={f.numero} value={String(f.numero)}>
                    {f.dataSugerida
                      ? `${f.numero}º encontro · sugerido ${formatDate(f.dataSugerida)}`
                      : `${f.numero}º encontro`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          <Button type="submit" className="w-full" disabled={pending}>
            <ClockCounterClockwise size={16} />
            {pending ? "Salvando…" : "Registrar encontro"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
