"use client";

import {
  cloneElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Warning } from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import {
  agendarEncontroJovem,
  conflitoEncontro,
  type ConflitoEncontro,
} from "@/lib/actions";
import {
  formatDate,
  formatDiaHora,
  MOTIVOS_REAGENDAMENTO,
  toDateStr,
} from "@/lib/ciclo";
import type { JovemEncontro } from "@/lib/queries-jovem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { elementoReal } from "@/lib/elemento-lazy";
import {
  SeletorDiaHora,
  type SeletorSugestoes,
} from "@/components/seletor-dia-hora";

/** "YYYY-MM-DDTHH:mm" local → par civil pro seletor. */
function splitLocal(v: string): { data: string; hora: string } {
  return { data: v.slice(0, 10), hora: v.slice(11, 16) };
}
/** horário local "YYYY-MM-DDTHH:mm" — o guard "sempre pra frente" compara civil. */
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
 * `numeros`. Agendar é sempre pra frente: o que já aconteceu sem marcar
 * entra pelo JovemRetroativoDialog (0207), então o piso do campo segue
 * sendo hoje. Com `atual` (remarcação), o motivo só é obrigatório quando
 * a data muda — mesma regra da RPC e do dialog do mentor. O dia+hora usa
 * o SeletorDiaHora (530): chips quando `sugestoes` vem do motor, campos
 * nativos separados no manual.
 */
export function JovemAgendarDialog({
  duplaId,
  numero,
  numeroPadrao,
  numeros,
  atual,
  sugestoes,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  duplaId: string;
  /** Fixo quando a linha já diz qual encontro é (remarcação); undefined
   *  abre o modo "escolher qual encontro agendar" (Select de `numeros`). */
  numero?: number;
  /** Nº sugerido no modo de escolha (QW7) — o select abre já apontando
   *  pro próximo encontro, sem travar a troca. */
  numeroPadrao?: number;
  /** Candidatos do Select — nº + data oficial quando o calendário é legível. */
  numeros?: { numero: number; data?: string | null }[];
  /** Edição de um agendado existente — habilita o motivo da remarcação. */
  atual: JovemEncontro | null;
  /** Pacote do motor de sugestões — chips de dia/hora quando vem. */
  sugestoes?: SeletorSugestoes | null;
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
  const linkRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const valorAtual = atual?.data_hora
    ? paraInputLocal(new Date(atual.data_hora))
    : null;
  const agora = paraInputLocal(new Date());
  const hoje = toDateStr(new Date());
  const numeroInicial =
    numero ?? numeroPadrao ?? numeros?.[0]?.numero ?? atual?.numero ?? 0;

  // remarcar: o campo abre na data atual quando ela ainda é futura; a
  // comparação pro motivo usa sempre o par do encontro
  const inicial =
    valorAtual && valorAtual > agora ? splitLocal(valorAtual) : null;
  const compararCom = valorAtual ? splitLocal(valorAtual) : null;

  // valor vivo do par escolhido — dirige o debounce do conflito
  const [valorData, setValorData] = useState("");
  const [conflito, setConflito] = useState<{
    para: string;
    lista: ConflitoEncontro[];
  } | null>(null);
  const timerConflito = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mudaSel = useCallback(
    (sel: { data: string | null; hora: string | null }) =>
      setValorData(sel.data && sel.hora ? `${sel.data}T${sel.hora}` : ""),
    []
  );

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

  // estado fresco por abertura — o seletor reseta os campos na borda de
  // subida; aqui caem aviso e espelhos de consulta de visitas anteriores
  const [abertoAntes, setAbertoAntes] = useState(open);
  if (open !== abertoAntes) {
    setAbertoAntes(open);
    if (open) {
      setAviso(null);
      setValorData("");
      setConflito(null);
    }
  }

  function mudaOpen(o: boolean) {
    setOpenInterno(o);
    onOpenChange?.(o);
  }

  function confirmar(
    data: string,
    hora: string,
    n: number,
    motivo: { preset: string; outro: string } | null
  ) {
    // o par civil vai naïve; o server resolve o instante
    const local = `${data}T${hora}`;
    // sempre pra frente — o piso do campo bloqueia o dia, mas o horário
    // de hoje já passado ainda passa; a RPC recusa, o aviso antecipa
    if (local <= paraInputLocal(new Date())) {
      setAviso(
        "Agendar é sempre pra frente — escolha uma data e horário futuros."
      );
      return;
    }
    const link = linkRef.current?.value.trim() || null;
    // motivo final: label do preset ou o texto livre do "outro" — a RPC só
    // cobra quando a data mudou mesmo
    const motivoFinal = !motivo
      ? null
      : motivo.preset === "outro"
        ? motivo.outro
        : (MOTIVOS_REAGENDAMENTO.find((x) => x.value === motivo.preset)
            ?.label ?? null);
    start(async () => {
      try {
        const res = await agendarEncontroJovem(duplaId, n, local, link, motivoFinal);
        if (res?.error) {
          setAviso(res.error);
          return;
        }
        toast.success(atual ? `${n}º encontro remarcado.` : `${n}º encontro agendado.`);
        mudaOpen(false);
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

  // trigger via RSC chega lazy — resolve antes de clonar (elementoReal)
  const gatilho =
    trigger === null
      ? null
      : cloneElement(
          elementoReal(
            trigger ?? (
              <Button variant={atual ? "outline" : "default"} size="sm">
                <CalendarPlus size={16} />
                {atual ? "Remarcar" : "Agendar encontro"}
              </Button>
            )
          ),
          { onClick: () => mudaOpen(true), "aria-haspopup": "dialog" }
        );

  return (
    <>
      {gatilho}
      <SeletorDiaHora
        aberto={open}
        onAberto={mudaOpen}
        numero={numeroInicial}
        numeros={numeros?.map((x) => x.numero) ?? []}
        encontroPrimario={!atual && numero == null && (numeros?.length ?? 0) > 0}
        idEncontro="numero-select"
        rotuloEncontro="Qual encontro?"
        rotuloNumero={(n) => {
          const d = numeros?.find((x) => x.numero === n)?.data;
          return d
            ? `${n}º encontro · previsto ${formatDate(d)}`
            : `${n}º encontro`;
        }}
        dataPorNumero={(n) => numeros?.find((x) => x.numero === n)?.data}
        modo="futuro"
        hoje={hoje}
        piso={hoje}
        sugestoes={sugestoes ?? undefined}
        inicial={inicial}
        pedeMotivo={atual != null}
        compararCom={compararCom}
        rotuloDia="Dia"
        titulo={
          atual || numero ? `${numeroInicial}º encontro` : "Agendar encontro"
        }
        descricao={
          atual
            ? "Escolha a nova data e o horário com seu mentor."
            : "Escolha o encontro e marque a data e o horário com seu mentor."
        }
        rotuloConfirmar={
          atual ? "Confirmar remarcação" : "Confirmar agendamento"
        }
        pending={pending}
        aviso={aviso}
        onAviso={setAviso}
        onMudanca={mudaSel}
        onConfirmar={confirmar}
      >
        {/* o campo abre vazio no vencido — a linha devolve a data
            original e pede a nova */}
        {atual?.data_hora && valorAtual && valorAtual <= agora && (
          <p className="text-xs text-muted-foreground">
            Estava marcado pra {formatDiaHora(atual.data_hora)}.{" "}
            Escolha a nova data.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Combinem a data juntos. Seu mentor é avisado da marcação.
        </p>
        {avisoConflito && (
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-[var(--warn-text)]">
            <Warning size={13} aria-hidden className="mt-0.5 shrink-0" />
            {avisoConflito}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="link">Link da chamada (opcional)</Label>
          <Input
            ref={linkRef}
            id="link"
            type="url"
            placeholder="https://meet.google.com/…"
            defaultValue={atual?.link ?? ""}
          />
        </div>
      </SeletorDiaHora>
    </>
  );
}
