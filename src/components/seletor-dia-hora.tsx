"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { CalendarDots } from "@phosphor-icons/react";

import { diaSemanaDe, formatDiaSemana } from "@/lib/ciclo";
import {
  ocupadoEmChoque,
  rotuloOrigem,
  sugerirHorarios,
  type OcupadoRotulado,
  type OrigemSugestao,
  type PerfilEncontros,
  type SugestaoData,
} from "@/lib/sugestoes-encontro";
import type { Disponibilidade } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------- seletor de dia/horário compartilhado (481 → 482) ----------
// Nasceu no cartão "Próximo passo" do agendar e agora serve também às
// linhas do combinado: chips de dia e de hora (nunca datetime-local),
// choque marcado no chip com motivo legível e os dois campos nativos
// separados ("Outro dia" date + "Outro horário" time) como saída rara.

/** "YYYY-MM-DD" civil → "dd/mm". */
export const ddmm = (data: string) =>
  `${data.slice(8, 10)}/${data.slice(5, 7)}`;
/** "YYYY-MM-DD" civil → "terça-feira" (âncora de meio-dia UTC não vira de fuso). */
export const dowLongo = (data: string) => formatDiaSemana(`${data}T12:00:00Z`);
/** "19:00" + 60 → "20:00" — a faixa "das 19:00 às 20:00" do cartão. */
export const fimDe = (hora: string, durMin: number) => {
  const [h, m] = hora.split(":").map(Number);
  const t = h * 60 + m + durMin;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
/** dia civil +1 — o "Outro dia" não aceita hoje nem passado (agendar é pra frente). */
const amanhaDe = (hoje: string) => {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

const MQ_DESKTOP = "(min-width: 768px)";
const assinaDesktop = (cb: () => void) => {
  const mq = window.matchMedia(MQ_DESKTOP);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const medeDesktop = () => window.matchMedia(MQ_DESKTOP).matches;

/** O pacote mínimo que o seletor consome — SugestoesEncontro o satisfaz
 *  por inteiro, e o combinado monta um por passo trocando `datas`. */
export type SeletorSugestoes = {
  datas: SugestaoData[];
  perfil: PerfilEncontros;
  disponibilidade: Disponibilidade | null;
  ocupados: OcupadoRotulado[];
  duracaoMin: number;
  hoje: string;
  janela: { inicio: string; fim: string } | null;
};

const chipBase =
  "inline-flex min-h-11 flex-col items-center justify-center rounded-xl border px-3 py-1.5 text-sm leading-tight transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const chipAtivo = "border-foreground bg-foreground text-background";
const chipLivre =
  "border-border bg-transparent hover:bg-accent aria-checked:hover:bg-foreground";
const chipChoque =
  "border-dashed border-border text-muted-foreground opacity-80";

/** Grupo de chips como radiogroup — roving tabindex + setas trocam a
 *  seleção; chip em choque segue navegável (o motivo se descobre) mas não
 *  seleciona. */
function ChipRadio({
  checked,
  choque,
  onSelect,
  label,
  children,
}: {
  checked: boolean;
  /** aria-disabled: foco navega, seleção não acontece. */
  choque?: boolean;
  onSelect: () => void;
  /** Nome acessível completo — começa pelo texto visível do chip. */
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-disabled={choque || undefined}
      aria-label={label}
      tabIndex={checked ? 0 : -1}
      onClick={choque ? undefined : onSelect}
      className={cn(chipBase, checked ? chipAtivo : chipLivre, choque && chipChoque)}
    >
      {children}
    </button>
  );
}

/** Setas/Home/End movem o foco e selecionam o chip quando ele está livre —
 *  o padrão radiogroup com a exceção do aria-disabled (foco sem seleção). */
function navChips(e: React.KeyboardEvent<HTMLDivElement>) {
  const { key } = e;
  if (
    !["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(
      key
    )
  )
    return;
  e.preventDefault();
  const radios = [
    ...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'),
  ];
  const idx = radios.indexOf(document.activeElement as HTMLElement);
  if (idx < 0) return;
  const next =
    key === "Home"
      ? 0
      : key === "End"
        ? radios.length - 1
        : key === "ArrowRight" || key === "ArrowDown"
          ? (idx + 1) % radios.length
          : (idx - 1 + radios.length) % radios.length;
  const alvo = radios[next];
  if (!alvo) return;
  alvo.focus();
  if (alvo.getAttribute("aria-disabled") !== "true") alvo.click();
}

/** Sheet (mobile) / dialog (desktop) de dia+hora: o par pré-selecionado é
 *  o `inicial` (a sugestão que a superfície mostrava), os chips de dia
 *  vêm de `sugestoes.datas` e os de hora do motor no dia escolhido. */
export function SeletorDiaHora({
  aberto,
  onAberto,
  numero,
  numeros = [],
  comQuem,
  descricao,
  rotuloConfirmar = "Confirmar agendamento",
  titulo = "Escolher dia e horário",
  inicial,
  sugestoes,
  pending,
  aviso,
  onAviso,
  onConfirmar,
}: {
  aberto: boolean;
  onAberto: (o: boolean) => void;
  /** Nº no resumo ("6º encontro · ter 01/12 · 19:00"). */
  numero: number;
  /** Nºs alternáveis — o select "Outro encontro" só aparece com >1. */
  numeros?: number[];
  /** O par na descrição — opcional ("6º encontro com Ricardo"). */
  comQuem?: string;
  /** Subtítulo sob o título — quando vem, ganha da linha comQuem+origem. */
  descricao?: string;
  rotuloConfirmar?: string;
  titulo?: string;
  /** Par pré-selecionado — a sugestão que a superfície mostrava. */
  inicial: { data: string; hora: string; origem?: OrigemSugestao };
  sugestoes: SeletorSugestoes;
  pending: boolean;
  aviso: string | null;
  onAviso: (a: string | null) => void;
  onConfirmar: (data: string, hora: string, numero: number) => void;
}) {
  const desktop = useSyncExternalStore(assinaDesktop, medeDesktop, () => true);

  const [numeroSel, setNumeroSel] = useState(numero);
  const [selDia, setSelDia] = useState(inicial.data); // civil ou "outro"
  const [outroDia, setOutroDia] = useState("");
  const [selHora, setSelHora] = useState(inicial.hora); // "HH:mm" ou "outro"
  const [outraHora, setOutraHora] = useState("");
  const [verOutroEncontro, setVerOutroEncontro] = useState(false);

  const datasOrdenadas = useMemo(
    () => [...sugestoes.datas].sort((a, b) => a.data.localeCompare(b.data)),
    [sugestoes.datas]
  );
  const ocupados = sugestoes.ocupados;
  const ocupadosIso = useMemo(() => ocupados.map((o) => o.inicio), [ocupados]);

  const diaEfetivo =
    selDia === "outro" ? (/^\d{4}-\d{2}-\d{2}$/.test(outroDia) ? outroDia : null) : selDia;

  const horarios = useMemo(
    () =>
      diaEfetivo
        ? sugerirHorarios({
            data: diaEfetivo,
            perfil: sugestoes.perfil,
            disponibilidade: sugestoes.disponibilidade,
            ocupados: ocupadosIso,
            duracaoMin: sugestoes.duracaoMin,
          })
        : [],
    [diaEfetivo, sugestoes, ocupadosIso]
  );
  const horariosOrdenados = useMemo(
    () => [...horarios].sort((a, b) => a.hora.localeCompare(b.hora)),
    [horarios]
  );

  const horaEfetiva =
    selHora === "outro" ? (outraHora || null) : selHora;

  // dia livre pode não ter horário livre: o input "Outro horário" já abre
  const semHorarioLivre =
    horarios.length > 0 && horarios.every((h) => h.conflito);

  const choque = useMemo(
    () =>
      diaEfetivo && horaEfetiva
        ? ocupadoEmChoque(
            new Date(`${diaEfetivo}T${horaEfetiva}:00-03:00`),
            ocupados,
            sugestoes.duracaoMin
          )
        : null,
    [diaEfetivo, horaEfetiva, ocupados, sugestoes.duracaoMin]
  );

  const escolherDia = (data: string) => {
    onAviso(null);
    setSelDia(data);
    setOutroDia("");
    // o horário segue o primeiro livre do novo dia
    const hs = sugerirHorarios({
      data,
      perfil: sugestoes.perfil,
      disponibilidade: sugestoes.disponibilidade,
      ocupados: ocupadosIso,
      duracaoMin: sugestoes.duracaoMin,
    });
    const livre = hs.find((h) => !h.conflito);
    setSelHora(livre?.hora ?? "outro");
    setOutraHora("");
  };

  const escolherOutroDia = () => {
    onAviso(null);
    setSelDia("outro");
    if (outroDia) return; // valor já digitado volta a valer
    const a = amanhaDe(sugestoes.hoje);
    setOutroDia(a);
    escolherDiaPorData(a);
  };

  const escolherDiaPorData = (data: string) => {
    setOutroDia(data);
    const hs = sugerirHorarios({
      data,
      perfil: sugestoes.perfil,
      disponibilidade: sugestoes.disponibilidade,
      ocupados: ocupadosIso,
      duracaoMin: sugestoes.duracaoMin,
    });
    const livre = hs.find((h) => !h.conflito);
    setSelHora(livre?.hora ?? "outro");
    setOutraHora("");
  };

  const rotuloOcupado = (o: OcupadoRotulado | null) =>
    o?.rotulo || "outro compromisso";

  const resumo =
    diaEfetivo && horaEfetiva
      ? `${numeroSel}º encontro · ${diaSemanaDe(diaEfetivo)} ${ddmm(diaEfetivo)} · ${horaEfetiva}`
      : `${numeroSel}º encontro · escolha dia e horário`;

  const conteudo = (
    <>
      <div className="space-y-4">
        {/* Dia */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Dia
          </p>
          <div
            role="radiogroup"
            aria-label="Dia do encontro"
            onKeyDown={navChips}
            className="flex flex-wrap gap-2"
          >
            {datasOrdenadas.map((s) => {
              const dowC = diaSemanaDe(s.data);
              return (
                <ChipRadio
                  key={s.data}
                  checked={selDia === s.data}
                  onSelect={() => escolherDia(s.data)}
                  label={`${dowC} ${ddmm(s.data)}, ${dowLongo(s.data)}`}
                >
                  <span className="text-xs">{dowC}</span>
                  <span className="font-medium">{ddmm(s.data)}</span>
                </ChipRadio>
              );
            })}
            <ChipRadio
              checked={selDia === "outro"}
              onSelect={escolherOutroDia}
              label="Outro dia, abre o campo de data"
            >
              <CalendarDots size={16} aria-hidden />
              <span className="font-medium">Outro dia</span>
            </ChipRadio>
          </div>
          {selDia === "outro" && (
            <div className="mt-3 max-w-44">
              <Input
                type="date"
                aria-label="Escolher outro dia"
                min={
                  sugestoes.janela &&
                  sugestoes.janela.inicio > amanhaDe(sugestoes.hoje)
                    ? sugestoes.janela.inicio
                    : amanhaDe(sugestoes.hoje)
                }
                max={sugestoes.janela?.fim}
                value={outroDia}
                onChange={(e) => {
                  onAviso(null);
                  escolherDiaPorData(e.target.value);
                }}
              />
            </div>
          )}
        </div>

        {/* Horário */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Horário
          </p>
          <div
            role="radiogroup"
            aria-label="Horário do encontro"
            onKeyDown={navChips}
            className="flex flex-wrap items-start gap-2"
          >
            {horariosOrdenados.map((h) => {
              const ocupado = h.conflito
                ? ocupadoEmChoque(
                    new Date(`${diaEfetivo}T${h.hora}:00-03:00`),
                    ocupados,
                    sugestoes.duracaoMin
                  )
                : null;
              const motivo = ocupado ? rotuloOcupado(ocupado) : null;
              return (
                <ChipRadio
                  key={h.hora}
                  checked={selHora === h.hora}
                  choque={h.conflito}
                  onSelect={() => {
                    onAviso(null);
                    setSelHora(h.hora);
                    setOutraHora("");
                  }}
                  label={
                    motivo
                      ? `${h.hora}, indisponível, ${ocupado!.rotuloArtigo || motivo}, das ${h.hora} às ${fimDe(h.hora, sugestoes.duracaoMin)}`
                      : h.hora
                  }
                >
                  <span className="font-medium">{h.hora}</span>
                  {motivo && (
                    <span className="max-w-28 text-[10px] leading-tight">
                      {motivo}
                    </span>
                  )}
                </ChipRadio>
              );
            })}
            <ChipRadio
              checked={selHora === "outro"}
              onSelect={() => {
                onAviso(null);
                setSelHora("outro");
              }}
              label="Outro horário, abre o campo de hora"
            >
              <span className="font-medium">Outro horário</span>
            </ChipRadio>
          </div>
          {(selHora === "outro" || semHorarioLivre) && (
            <div className="mt-3 max-w-36">
              <Input
                type="time"
                step={900}
                aria-label="Escolher outro horário"
                value={outraHora}
                onChange={(e) => {
                  onAviso(null);
                  setSelHora("outro");
                  setOutraHora(e.target.value);
                }}
              />
              {semHorarioLivre && selHora !== "outro" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Os horários sugeridos estão ocupados — escolha outro.
                </p>
              )}
            </div>
          )}
        </div>

        {verOutroEncontro ? (
          <div className="max-w-56">
            <Select
              value={String(numeroSel)}
              onValueChange={(v) => setNumeroSel(Number(v))}
              items={Object.fromEntries(
                numeros.map((n) => [String(n), `${n}º encontro`])
              )}
            >
              <SelectTrigger aria-label="Encontro a agendar">
                <SelectValue />
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
        ) : numeros.length > 1 ? (
          <Button
            type="button"
            variant="link"
            size="xs"
            onClick={() => setVerOutroEncontro(true)}
            className="px-0 font-normal text-muted-foreground underline hover:text-foreground"
          >
            Outro encontro
          </Button>
        ) : null}

        {choque && (
          <p role="status" className="text-sm text-destructive">
            Nesse horário você tem{" "}
            {choque.rotuloArtigo || choque.rotulo || "outro compromisso"}.
          </p>
        )}
        {aviso && (
          <p role="status" className="text-sm text-destructive">
            {aviso}
          </p>
        )}
      </div>
    </>
  );

  const rodape = (
    <div className="flex flex-wrap items-center gap-2">
      <p
        aria-live="polite"
        className="min-w-0 flex-1 basis-full text-sm font-medium sm:basis-auto"
      >
        {resumo}
      </p>
      <Button
        className="w-full sm:w-auto"
        disabled={!diaEfetivo || !horaEfetiva || !!choque || pending}
        onClick={() => onConfirmar(diaEfetivo!, horaEfetiva!, numeroSel)}
      >
        {pending ? "Confirmando…" : rotuloConfirmar}
      </Button>
    </div>
  );

  const subtitulo =
    descricao ??
    `${numeroSel}º encontro${comQuem ? ` com ${comQuem}` : ""}${
      inicial.origem ? ` · ${rotuloOrigem(inicial.origem)}` : ""
    }`;

  if (desktop) {
    return (
      <Dialog open={aberto} onOpenChange={onAberto}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription>{subtitulo}</DialogDescription>
          </DialogHeader>
          {conteudo}
          <DialogFooter sticky className="sm:justify-start">
            {rodape}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={aberto} onOpenChange={onAberto}>
      <SheetContent
        side="bottom"
        closeLabel="Fechar"
        className="h-auto max-h-[85dvh] p-4"
      >
        <div className="pr-8">
          <SheetTitle>{titulo}</SheetTitle>
          <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>
        </div>
        <div className="mt-4">{conteudo}</div>
        <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 border-t bg-sidebar p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {rodape}
        </div>
      </SheetContent>
    </Sheet>
  );
}
