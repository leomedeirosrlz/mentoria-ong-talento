"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CalendarDots } from "@phosphor-icons/react";

import {
  diaSemanaDe,
  formatDiaSemana,
  MOTIVOS_REAGENDAMENTO,
  toDateStr,
} from "@/lib/ciclo";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------- seletor de dia/horário compartilhado (481 → 530) ----------
// Nasceu no cartão "Próximo passo" do agendar e hoje é O jeito de escolher
// dia+hora no app inteiro: chips de dia e de hora (nunca datetime-local),
// choque marcado no chip com motivo legível e os campos nativos separados
// ("Outro dia" date + "Outro horário" time) como saída direta — um toque no
// chip já abre o picker do sistema, sem clique extra. Sem `sugestoes` ele
// cai no modo manual: os dois campos nativos aparecem direto (agendar do
// mentor, retroativos dos dois lados).

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
/** dia civil +1 — no modo futuro o "Outro dia" não aceita hoje nem passado. */
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

/** Um toque abre o picker nativo do input — o chip já conta como a seleção,
 *  então o gesto é direto. O rAF espera o campo aparecer (ele monta junto
 *  com a seleção) sem perder a ativação do clique; sem showPicker (jsdom,
 *  browsers velhos) ou sem ativação, o fallback é o foco no campo. */
function abrirPickerNativo(ref: React.RefObject<HTMLInputElement | null>) {
  requestAnimationFrame(() => {
    const input = ref.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === "function") input.showPicker();
      else input.focus();
    } catch {
      input.focus();
    }
  });
}

/** Sheet (mobile) / dialog (desktop) de dia+hora. Com `sugestoes` o par
 *  pré-selecionado é o `inicial` e os chips vêm do motor; sem ele (ou sem
 *  datas) os dois campos nativos aparecem direto — é o modo manual dos
 *  dialogs de remarcar e dos retroativos. */
export function SeletorDiaHora({
  aberto,
  onAberto,
  numero,
  numeros = [],
  comQuem,
  descricao,
  rotuloConfirmar = "Confirmar agendamento",
  titulo = "Escolher dia e horário",
  rotuloDia = "Dia",
  rotuloEncontro = "Qual encontro?",
  inicial = null,
  sugestoes,
  modo = "futuro",
  hoje: hojeProp,
  piso,
  teto,
  pedeMotivo = false,
  compararCom = null,
  rotuloNumero,
  dataPorNumero,
  encontroPrimario = false,
  idEncontro,
  children,
  rodapeExtra,
  pending,
  aviso,
  onAviso,
  onConfirmar,
  onMudanca,
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
  titulo?: React.ReactNode;
  /** Cabeçalho da seção de data — o retroativo fala "Quando foi". */
  rotuloDia?: string;
  /** Rótulo do select de encontro no modo primário. */
  rotuloEncontro?: string;
  /** Par pré-selecionado — a sugestão que a superfície mostrava (ou a data
   *  atual na remarcação). Fora dos chips entra como "Outro dia" preenchido. */
  inicial?: { data: string; hora: string; origem?: OrigemSugestao } | null;
  /** Pacote do motor — sem ele o seletor é o par de campos nativos (manual). */
  sugestoes?: SeletorSugestoes;
  /** "retroativo" inverte a janela civil: o campo aceita só passado (max =
   *  hoje por padrão) e o "Outro dia" pré-preenche em hoje, não amanhã. */
  modo?: "futuro" | "retroativo";
  /** "YYYY-MM-DD" civil de hoje — usado quando `sugestoes` não traz um. */
  hoje?: string;
  /** Min/max civil do campo de data — ganham dos padrões do modo. */
  piso?: string;
  teto?: string;
  /** Motivo da remarcação — aparece sempre; vira obrigatório quando a data
   *  escolhida difere de `compararCom` (o encontro de origem). */
  pedeMotivo?: boolean;
  /** Par data/hora do encontro atual — a comparação que liga o motivo. */
  compararCom?: { data: string; hora: string } | null;
  /** Rótulo de cada nº no select de encontro (default "Nº encontro"). */
  rotuloNumero?: (n: number) => string;
  /** Data sugerida por nº — trocar o encontro preenche a data (guia oficial).
   *  `{data, hora}` também traz o horário (o retroativo cai em "agora"). */
  dataPorNumero?: (
    n: number
  ) => string | { data: string; hora: string } | null | undefined;
  /** Select de encontro sempre visível (modo "Qual encontro?"), no topo. */
  encontroPrimario?: boolean;
  /** id do trigger do select de encontro — estabilidade pros e2e. */
  idEncontro?: string;
  /** Extras entre o encontro e os avisos — hint de data antiga, link etc. */
  children?: React.ReactNode;
  /** Slot à esquerda do rodapé — "Desmarcar encontro", "Escolher outro
   *  horário" (a resposta ao aviso de disponibilidade). */
  rodapeExtra?: React.ReactNode;
  pending: boolean;
  aviso: string | null;
  onAviso: (a: string | null) => void;
  /** `motivo` vem cru — null quando a remarcação não pede (mesma data) ou
   *  o select está vazio; quem confirma resolve preset → rótulo/texto. */
  onConfirmar: (
    data: string,
    hora: string,
    numero: number,
    motivo: { preset: string; outro: string } | null
  ) => void;
  /** Espelho da seleção pro pai — debounce de conflito e modo dual vivem lá. */
  onMudanca?: (sel: {
    data: string | null;
    hora: string | null;
    numero: number;
  }) => void;
}) {
  const desktop = useSyncExternalStore(assinaDesktop, medeDesktop, () => true);

  const datasOrdenadas = useMemo(
    () => [...(sugestoes?.datas ?? [])].sort((a, b) => a.data.localeCompare(b.data)),
    [sugestoes?.datas]
  );
  const datasSet = useMemo(
    () => new Set(datasOrdenadas.map((s) => s.data)),
    [datasOrdenadas]
  );
  const hoje = sugestoes?.hoje ?? hojeProp ?? toDateStr(new Date());
  const ocupados = useMemo(() => sugestoes?.ocupados ?? [], [sugestoes?.ocupados]);
  const ocupadosIso = useMemo(() => ocupados.map((o) => o.inicio), [ocupados]);

  // janela civil do campo de data — o piso/teto explícito ganha do modo;
  // "" pede "sem borda" (o modo dual do mentor aceita passado → retroativo)
  const minDia =
    piso ??
    (modo === "retroativo"
      ? undefined
      : sugestoes?.janela && sugestoes.janela.inicio > amanhaDe(hoje)
        ? sugestoes.janela.inicio
        : amanhaDe(hoje));
  const maxDia = teto ?? (modo === "retroativo" ? hoje : sugestoes?.janela?.fim);

  // sem datas sugeridas o grupo de chips não tem o que mostrar — o campo
  // nativo vem direto (modo manual), e o valor inicial entra nele
  const temChipsDia = datasOrdenadas.length > 0;
  const estadoInicial = () => ({
    selDia:
      inicial && temChipsDia && datasSet.has(inicial.data)
        ? inicial.data
        : "outro",
    outroDia: inicial?.data ?? "",
    selHora:
      inicial && !temChipsDia ? "outro" : (inicial?.hora ?? "outro"),
    outraHora: inicial?.hora ?? "",
  });
  const ini = estadoInicial();
  const [numeroSel, setNumeroSel] = useState(numero);
  const [selDia, setSelDia] = useState(ini.selDia);
  const [outroDia, setOutroDia] = useState(ini.outroDia);
  const [selHora, setSelHora] = useState(ini.selHora);
  const [outraHora, setOutraHora] = useState(ini.outraHora);
  const [verOutroEncontro, setVerOutroEncontro] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [motivoOutro, setMotivoOutro] = useState("");
  const inputDiaRef = useRef<HTMLInputElement | null>(null);
  const inputHoraRef = useRef<HTMLInputElement | null>(null);

  // estado fresco por abertura — a borda de subida do `aberto` é o evento
  // confiável (abertura controlada chega pela prop, sem onAberto; mesmo
  // padrão do abertoAntes do AgendarEncontroDialog antigo)
  const [abertoAntes, setAbertoAntes] = useState(aberto);
  if (aberto !== abertoAntes) {
    setAbertoAntes(aberto);
    if (aberto) {
      const e = estadoInicial();
      setNumeroSel(numero);
      setSelDia(e.selDia);
      setOutroDia(e.outroDia);
      setSelHora(e.selHora);
      setOutraHora(e.outraHora);
      setVerOutroEncontro(false);
      setMotivo("");
      setMotivoOutro("");
    }
  }

  const diaEfetivo =
    selDia === "outro" ? (/^\d{4}-\d{2}-\d{2}$/.test(outroDia) ? outroDia : null) : selDia;

  const horarios = useMemo(
    () =>
      sugestoes && diaEfetivo
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
  // o horário inicial pode não ser um chip do motor (prefill de remarcação
  // ou do guia) — aí o campo "Outro horário" já nasce preenchido com ele
  const temChipsHora = sugestoes != null;

  const horaEfetiva =
    selHora === "outro" ? (outraHora || null) : selHora;

  // dia livre pode não ter horário livre: o input "Outro horário" já abre
  const semHorarioLivre =
    horarios.length > 0 && horarios.every((h) => h.conflito);

  // motivo da remarcação: só conta quando o par escolhido difere do atual —
  // trocar só o link (mesma data) não é remarcação e a RPC não cobra
  const dataMudou =
    !!diaEfetivo &&
    !!horaEfetiva &&
    (compararCom == null ||
      diaEfetivo !== compararCom.data ||
      horaEfetiva !== compararCom.hora);
  // o slot do par atual consta dos ocupados — ele é "ocupado" pelo próprio
  // encontro: sem a mesma comparação o confirm trava até pra trocar só o
  // link. Choque só conta quando o par realmente muda.
  const choque = useMemo(
    () =>
      sugestoes && diaEfetivo && horaEfetiva && dataMudou
        ? ocupadoEmChoque(
            new Date(`${diaEfetivo}T${horaEfetiva}:00-03:00`),
            ocupados,
            sugestoes.duracaoMin
          )
        : null,
    [diaEfetivo, horaEfetiva, ocupados, sugestoes, dataMudou]
  );
  // o par cru sai pro caller resolver: a RPC do jovem quer o rótulo, o
  // FormData do mentor quer preset+outro separados (o core resolve)
  const motivoInfo =
    pedeMotivo && dataMudou && motivo
      ? { preset: motivo, outro: motivoOutro.trim() }
      : null;
  const motivoOk =
    !pedeMotivo ||
    !dataMudou ||
    (motivo !== "" && (motivo !== "outro" || motivoOutro.trim().length >= 2));

  const onMudancaRef = useRef(onMudanca);
  useEffect(() => {
    onMudancaRef.current = onMudanca;
  });
  useEffect(() => {
    onMudancaRef.current?.({ data: diaEfetivo, hora: horaEfetiva, numero: numeroSel });
  }, [diaEfetivo, horaEfetiva, numeroSel]);

  const escolherHoraDoDia = (data: string) => {
    if (!sugestoes) {
      setSelHora("outro");
      setOutraHora((h) => h || "19:00");
      return;
    }
    const hs = sugerirHorarios({
      data,
      perfil: sugestoes.perfil,
      disponibilidade: sugestoes.disponibilidade,
      ocupados: ocupadosIso,
      duracaoMin: sugestoes.duracaoMin,
    });
    const livre = hs.find((h) => !h.conflito);
    setSelHora(livre?.hora ?? "outro");
    setOutraHora(livre ? "" : "19:00");
  };

  const escolherDia = (data: string) => {
    onAviso(null);
    setSelDia(data);
    setOutroDia("");
    // o horário segue o primeiro livre do novo dia
    escolherHoraDoDia(data);
  };

  const escolherOutroDia = () => {
    onAviso(null);
    setSelDia("outro");
    abrirPickerNativo(inputDiaRef);
    if (outroDia) return; // valor já digitado volta a valer
    // o campo nasce numa data útil: amanhã no futuro, hoje no retroativo
    const a = modo === "retroativo" ? (maxDia || hoje) : (minDia || amanhaDe(hoje));
    setOutroDia(a);
    escolherHoraDoDia(a);
  };

  const escolherDiaPorData = (data: string) => {
    setOutroDia(data);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return;
    escolherHoraDoDia(data);
  };

  const trocarNumero = (n: number) => {
    setNumeroSel(n);
    onAviso(null);
    const d = dataPorNumero?.(n);
    if (!d) return;
    const par = typeof d === "string" ? { data: d, hora: null } : d;
    // a data oficial do guia entra como sugestão — chip se existir, senão
    // o campo "Outro dia" preenchido; a hora explícita sempre entra no campo
    if (datasSet.has(par.data)) escolherDia(par.data);
    else {
      setSelDia("outro");
      setOutroDia(par.data);
      if (!par.hora) escolherHoraDoDia(par.data);
    }
    if (par.hora) {
      setSelHora("outro");
      setOutraHora(par.hora);
    }
  };

  const rotuloOcupado = (o: OcupadoRotulado | null) =>
    o?.rotulo || "outro compromisso";

  const resumo =
    diaEfetivo && horaEfetiva
      ? `${numeroSel}º encontro · ${diaSemanaDe(diaEfetivo)} ${ddmm(diaEfetivo)} · ${horaEfetiva}`
      : `${numeroSel}º encontro · escolha dia e horário`;

  const selectEncontro = numeros.length > 0 && (
    <Select
      value={String(numeroSel)}
      onValueChange={(v) => trocarNumero(Number(v))}
      items={Object.fromEntries(
        numeros.map((n) => [String(n), rotuloNumero?.(n) ?? `${n}º encontro`])
      )}
    >
      <SelectTrigger
        id={idEncontro}
        {...(encontroPrimario
          ? { "aria-labelledby": `rotulo-encontro${idEncontro ? ` ${idEncontro}` : ""}` }
          : { "aria-label": rotuloEncontro })}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {numeros.map((n) => (
          <SelectItem key={n} value={String(n)}>
            {rotuloNumero?.(n) ?? `${n}º encontro`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const conteudo = (
    <div className="space-y-4">
      {encontroPrimario && numeros.length > 0 && (
        <div className="max-w-72 space-y-2">
          <Label id="rotulo-encontro">{rotuloEncontro}</Label>
          {selectEncontro}
        </div>
      )}

      {/* Dia */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {rotuloDia}
        </p>
        {temChipsDia ? (
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
              label="Outro dia, abre o seletor de data"
            >
              <CalendarDots size={16} aria-hidden />
              <span className="font-medium">Outro dia</span>
            </ChipRadio>
          </div>
        ) : null}
        {(selDia === "outro" || !temChipsDia) && (
          <div className={cn("max-w-44", temChipsDia && "mt-3")}>
            <Input
              ref={inputDiaRef}
              type="date"
              aria-label={
                modo === "retroativo" ? "Dia em que aconteceu" : "Escolher outro dia"
              }
              min={minDia || undefined}
              max={maxDia || undefined}
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
        {temChipsHora && (
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
                    sugestoes!.duracaoMin
                  )
                : null;
              const motivoOcupado = ocupado ? rotuloOcupado(ocupado) : null;
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
                    motivoOcupado
                      ? `${h.hora}, indisponível, ${ocupado!.rotuloArtigo || motivoOcupado}, das ${h.hora} às ${fimDe(h.hora, sugestoes!.duracaoMin)}`
                      : h.hora
                  }
                >
                  <span className="font-medium">{h.hora}</span>
                  {motivoOcupado && (
                    <span className="max-w-28 text-[10px] leading-tight">
                      {motivoOcupado}
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
                abrirPickerNativo(inputHoraRef);
              }}
              label="Outro horário, abre o seletor de hora"
            >
              <span className="font-medium">Outro horário</span>
            </ChipRadio>
          </div>
        )}
        {(selHora === "outro" || semHorarioLivre || !temChipsHora) && (
          <div className={cn("max-w-36", temChipsHora && "mt-3")}>
            <Input
              ref={inputHoraRef}
              type="time"
              step={900}
              aria-label={
                modo === "retroativo" ? "Horário em que aconteceu" : "Escolher outro horário"
              }
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

      {!encontroPrimario &&
        (verOutroEncontro ? (
          <div className="max-w-56">{selectEncontro}</div>
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
        ) : null)}

      {children}

      {pedeMotivo && (
        <div className="space-y-2">
          <Label id="motivo-label">Motivo da remarcação</Label>
          {!dataMudou && (
            <p className="text-xs text-muted-foreground">
              Só precisa se mudar a data.
            </p>
          )}
          <Select
            value={motivo}
            onValueChange={(v) => setMotivo(v ?? "")}
            items={Object.fromEntries(
              MOTIVOS_REAGENDAMENTO.map((m) => [m.value, m.label])
            )}
          >
            <SelectTrigger
              id="motivo-select"
              aria-labelledby="motivo-label motivo-select"
            >
              <SelectValue placeholder="Escolha o motivo" />
            </SelectTrigger>
            <SelectContent>
              {MOTIVOS_REAGENDAMENTO.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {motivo === "outro" && (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="motivo_outro">Descreva o motivo</Label>
                <span
                  aria-hidden
                  className="text-xs tabular-nums text-muted-foreground"
                >
                  {motivoOutro.length}/140
                </span>
              </div>
              <Input
                id="motivo_outro"
                minLength={2}
                maxLength={140}
                value={motivoOutro}
                onChange={(e) => setMotivoOutro(e.target.value)}
                placeholder="ex.: prova na escola nesse dia"
              />
            </div>
          )}
        </div>
      )}

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
  );

  const rodape = (
    <div className="flex flex-wrap items-center gap-2">
      <p
        aria-live="polite"
        className="min-w-0 flex-1 basis-full text-sm font-medium sm:basis-auto"
      >
        {resumo}
      </p>
      {rodapeExtra}
      <Button
        className="w-full sm:w-auto"
        disabled={
          !diaEfetivo || !horaEfetiva || !!choque || !motivoOk || pending
        }
        onClick={() =>
          onConfirmar(diaEfetivo!, horaEfetiva!, numeroSel, motivoInfo)
        }
      >
        {pending ? "Confirmando…" : rotuloConfirmar}
      </Button>
    </div>
  );

  const subtitulo =
    descricao ??
    `${numeroSel}º encontro${comQuem ? ` com ${comQuem}` : ""}${
      inicial?.origem ? ` · ${rotuloOrigem(inicial.origem)}` : ""
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
