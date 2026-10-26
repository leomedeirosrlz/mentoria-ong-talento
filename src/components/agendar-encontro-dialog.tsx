"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  agendarEncontro,
  conflitoEncontro,
  desmarcarEncontro,
  registrarEncontroRetroativo,
  type ConflitoEncontro,
} from "@/lib/actions";
import { formatDiaHora, MOTIVOS_REAGENDAMENTO } from "@/lib/ciclo";
import type { Encontro } from "@/lib/types";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
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
  jovemNome,
  rotulo,
  trigger,
  onCreated,
  open: openProp,
  onOpenChange,
}: {
  duplaId: string;
  numero: number;
  atual: Encontro | null;
  /** "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm" — pré-preenche a data quando não é
   *  remarcação; dia solto entra às 19h, a grade de horários (REALIZA-25)
   *  chega com a hora do slot clicado. */
  sugerido?: string;
  /** YYYY-MM-DD do início da dupla — a sugestão nunca cai antes dele (o
   *  retroativo rejeitaria a data oficial de um encontro pré-dupla). */
  piso?: string;
  /** Primeiro nome do mentorado — sai no aviso de horário sobreposto. */
  jovemNome?: string;
  /** Como o encontro aparece no título/toasts — default "Nº encontro". Na
   *  trilha especialista a remarcação é de uma sessão que nasceu de pedido:
   *  o rótulo diz isso ("sessão de especialista") sem número de passo. */
  rotulo?: string;
  /** Elemento do trigger — default é o botão padrão da casa. `null` suprime
   *  o trigger embutido: a grade de horários abre o dialog de forma
   *  controlada, a partir do clique na coluna do dia. */
  trigger?: React.ReactElement | null;
  /** Só no ramo retroativo (data passada): recebe (id do encontro criado,
   *  "YYYY-MM-DD" dele) e substitui a navegação pra ficha — a agenda usa pra
   *  abrir o registro inline no dia em que ele caiu. */
  onCreated?: (encontroId: string, dia: string) => void;
  /** Modo controlado (opcional): o pai segura o estado — a grade de horários
   *  abre o dialog com o slot clicado sem depender de trigger. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openInterno, setOpenInterno] = useState(false);
  const open = openProp ?? openInterno;
  const [pending, start] = useTransition();
  // controlado pra revelar o campo de texto livre quando o motivo é "outro"
  const [motivo, setMotivo] = useState("");
  // motivo só é obrigatório quando a data muda — salvar a mesma data (ex.: só
  // pra trocar o link) não é reagendamento e o server também não exige motivo
  const [dataMudou, setDataMudou] = useState(false);
  const [motivoLen, setMotivoLen] = useState(0);
  // overlap com sessão da OUTRA dupla do mesmo jovem — warning, não bloqueio.
  // Guardado com a data consultada: resposta atrasada de data que já mudou
  // não vira aviso mentiroso
  const [conflito, setConflito] = useState<{
    para: string;
    lista: ConflitoEncontro[];
  } | null>(null);
  const timerConflito = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  // a grade de horários passa o slot completo ("…T19:30"); o clique no mês/
  // no dia continua chegando só com a data — entra às 19h, o horário típico
  const sugeridoLocal = sugerido
    ? sugerido.includes("T")
      ? sugerido
      : `${sugerido}T19:00`
    : "";
  // encontro novo: o dia sugerido vale mesmo já passado — cai no ramo
  // retroativo; mas nunca antes do início da dupla (a action rejeitaria)
  const pisoLocal = piso ? `${piso}T19:00` : "";
  const defaultValue =
    valorAtual ??
    (sugeridoLocal && pisoLocal && sugeridoLocal < pisoLocal ? pisoLocal : sugeridoLocal);
  // valor vivo do campo — decide se o submit agenda ou registra (modo dual).
  // Nasce com a sugestão: o mount já-aberto do modo controlado não passa
  // pelo reset da transição de open
  const [valorData, setValorData] = useState(defaultValue);
  // estado fresco por abertura — ajuste na borda de subida do `open`: no
  // modo controlado (menu "Mais", grade de horários) a abertura vem da prop
  // e o Base UI não reemite onOpenChange — a transição é o evento confiável
  // (mesmo padrão do RemanejarDuplaDialog)
  const [abertoAntes, setAbertoAntes] = useState(open);
  if (open !== abertoAntes) {
    setAbertoAntes(open);
    if (open) {
      setMotivo("");
      setDataMudou(false);
      setValorData(defaultValue);
    }
  }
  // modo retroativo só existe pra encontro novo (sem row editável)
  const ehRetroativo = !atual && valorData !== "" && valorData <= agora;
  // sujeito neutro pro copy — "4º encontro" no DPP, "sessão de especialista"
  // na remarcação de pedido aceito; os verbos ficam sem gênero de propósito
  const nome = rotulo ?? `${numero}º encontro`;

  useEffect(() => {
    if (pending) return;
    const alvo = scrollTarget.current;
    if (!alvo) return;
    scrollTarget.current = null;
    // o guard global de prefers-reduced-motion cobre CSS, não o behavior
    // do scrollIntoView — checa aqui (mesmo padrão do trilha-jornada)
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(alvo)
      ?.scrollIntoView({ behavior: reduz ? "auto" : "smooth", block: "start" });
  }, [pending]);

  // warning de overlap (0072): debounce na data — a RPC olha as outras
  // duplas do mesmo jovem (a de especialista o mentor não lê pela RLS);
  // falha vira lista vazia — é aviso, nunca bloqueio do submit
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
          toast.success("Encontro registrado. Agora complete o registro.");
          mudaOpen(false);
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
          toast.success(
            atual
              ? `Remarcação confirmada: ${nome}.`
              : `Agendamento confirmado: ${nome}.`
          );
          mudaOpen(false);
          router.refresh();
        }
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  // fecha pelo estado interno E avisa o pai — no modo controlado é ele quem
  // desmonta o dialog (a grade limpa o slot clicado)
  function mudaOpen(o: boolean) {
    setOpenInterno(o);
    onOpenChange?.(o);
  }

  return (
    <Dialog open={open} onOpenChange={mudaOpen}>
      {trigger !== null && (
        <DialogTrigger render={
          trigger ?? (
            <Button variant={atual ? "outline" : "default"} size="sm">
              <CalendarPlus size={16} />
              {atual ? "Remarcar" : "Agendar encontro"}
            </Button>
          )
        } />
      )}
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{nome}</DialogTitle>
          <DialogDescription>
            Marque a data e o horário. Se a data mudou, conte o motivo da
            remarcação.
          </DialogDescription>
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
                Se o encontro já aconteceu, escolha a data real. Ele entra como realizado.
              </p>
            )}
            {conflitos.length > 0 && (
              <p className="flex items-start gap-1.5 text-xs leading-relaxed text-[var(--warn-text)]">
                <Warning size={13} aria-hidden className="mt-0.5 shrink-0" />
                {jovemNome ?? "O mentorado"} tem{" "}
                {conflitos[0].trilha === "especialista"
                  ? "sessão de especialista"
                  : "encontro de mentoria"}{" "}
                marcada pra {formatDiaHora(conflitos[0].data_hora)}
                {conflitos.length > 1 && ` (e mais ${conflitos.length - 1})`}.
                Confirme antes de seguir.
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
                placeholder="ex.: mentorado não pôde comparecer"
              />
            </div>
          )}
          {/* link não se aplica a encontro que já aconteceu — nasce "externo"
              e sem link de chamada. Esconder evita campo mentiroso. */}
          {!ehRetroativo && (
            <div className="space-y-2">
              <Label htmlFor="link">Link da chamada (opcional)</Label>
              <Input id="link" name="link" type="url" placeholder="https://meet.google.com/…" defaultValue={atual?.link ?? ""} />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando…" : ehRetroativo ? "Registrar encontro" : atual ? "Confirmar remarcação" : "Confirmar agendamento"}
          </Button>
          {/* desmarcar é a saída honesta pra um agendado futuro que não vai
              rolar (0072 — RPC bilateral; passado vai pro "não aconteceu").
              O mentor não tem delete por RLS (0047 coord-only) — a RPC é o
              caminho dos dois lados. */}
          {atual?.status === "agendado" &&
            atual.data_hora != null &&
            new Date(atual.data_hora) > new Date() && (
            <ConfirmDeleteButton
              titulo={`Desmarcar ${rotulo ? "a " : "o "}${nome}?`}
              descricao="O encontro sai da agenda. Vocês podem marcar de novo quando combinarem."
              acao="Desmarcar"
              sucesso="Encontro desmarcado."
              onConfirm={async () => {
                const res = await desmarcarEncontro(atual.id);
                if (!res?.error) mudaOpen(false);
                return res;
              }}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                >
                  Desmarcar encontro
                </Button>
              }
            />
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
