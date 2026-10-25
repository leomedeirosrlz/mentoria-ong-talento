"use client";

import { useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleNotch, Plus, X } from "@phosphor-icons/react";
import {
  adicionarExcecao,
  adicionarJanela,
  removerExcecao,
  removerJanela,
} from "@/lib/actions-especialista";
import { DIAS_SEMANA, DIAS_SEMANA_LABELS, toDateStr } from "@/lib/ciclo";
import { cn } from "@/lib/utils";
import { diaPlural, faixa, resumoExcecao } from "@/lib/horarios-especialista";
import type { ExcecaoEspecialista, GradeJanela } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { FaixaHorario } from "@/components/roda-horario";

/** Dias da semana como botões — o valor é o dow do Postgres (0=domingo …
 *  6=sábado) mas a ordem de leitura é a brasileira: DIAS_SEMANA abre em seg. */
const DIAS_OPCOES = DIAS_SEMANA.map((d, i) => ({
  dow: (i + 1) % 7,
  curto: d === "sab" ? "sáb" : d,
  longo: DIAS_SEMANA_LABELS[d],
}));

/** Janela da faixa de datas das exceções: as próximas 8 semanas. */
const DIAS_FAIXA_DATAS = 56;
const DOW_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Faixa horizontal de dias (deslizar no toque, setas no teclado) — um
 *  radiogroup: um tab stop, ←/→ movem e escolhem. */
function FaixaDatas({
  inicio,
  valor,
  onChange,
  disabled,
}: {
  /** "YYYY-MM-DD" de hoje. */
  inicio: string;
  valor: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const base = new Date(`${inicio}T12:00:00`);
  const dias = Array.from({ length: DIAS_FAIXA_DATAS }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return {
      iso: toDateStr(d),
      dow: DOW_CURTO[d.getDay()]!,
      dia: d.getDate(),
      mes: MES_CURTO[d.getMonth()]!,
      // o mês aparece no 1º chip e na virada — o resto lê só o dia
      comMes: i === 0 || d.getDate() === 1,
    };
  });
  const iSel = dias.findIndex((d) => d.iso === valor);

  function aoTeclar(e: KeyboardEvent<HTMLDivElement>) {
    const passo = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[
      e.key
    ];
    if (passo == null) return;
    e.preventDefault();
    const alvo = Math.min(dias.length - 1, Math.max(0, (iSel < 0 ? 0 : iSel) + passo));
    onChange(dias[alvo]!.iso);
    const el = ref.current?.querySelectorAll<HTMLButtonElement>("[role=radio]")[alvo];
    el?.focus();
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label="Data"
      onKeyDown={aoTeclar}
      className="scroll-fina -mx-1 flex snap-x snap-proximity gap-1.5 overflow-x-auto px-1 pb-1.5"
    >
      {dias.map((d, i) => {
        const sel = d.iso === valor;
        return (
          <button
            key={d.iso}
            type="button"
            role="radio"
            aria-checked={sel}
            aria-label={`${d.dow}, ${d.dia} de ${d.mes}`}
            tabIndex={sel || (iSel < 0 && i === 0) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(d.iso)}
            className={cn(
              "flex w-12 shrink-0 snap-start flex-col items-center rounded-xl border py-1.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              sel
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted"
            )}
          >
            <span className={cn("text-[11px]", !sel && "text-muted-foreground")}>
              {d.dow}
            </span>
            <span className="text-base font-semibold leading-tight tabular-nums">
              {d.dia}
            </span>
            <span className={cn("h-3.5 text-[10px] leading-none", !sel && "text-muted-foreground")}>
              {d.comMes ? d.mes : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const DE_PADRAO = "18:00";
const ATE_PADRAO = "20:00";

/** Editor "Quando você pode atender" do /perfil (REALIZA-207): as faixas
 *  fixas da semana e as exceções datadas em frases — a grade de horas ficou
 *  na /agenda como leitura visual; o cadastro que alimenta os horários que
 *  o jovem escolhe é daqui. As actions revalidam /agenda; o refresh do
 *  router é o que repuxa a grade e as exceções do próprio perfil. */
export function EspecialistaHorarios({
  grade,
  excecoes,
}: {
  grade: GradeJanela[];
  excecoes: ExcecaoEspecialista[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // faixa recorrente
  const [dias, setDias] = useState<number[]>([]);
  const [deFaixa, setDeFaixa] = useState(DE_PADRAO);
  const [ateFaixa, setAteFaixa] = useState(ATE_PADRAO);
  const [erroFaixa, setErroFaixa] = useState<string | null>(null);

  // exceção datada — bloqueio é o caso comum, já vem marcado
  const [tipo, setTipo] = useState<"bloqueio" | "extra">("bloqueio");
  const [data, setData] = useState("");
  const [deExc, setDeExc] = useState(DE_PADRAO);
  const [ateExc, setAteExc] = useState(ATE_PADRAO);
  const [erroExc, setErroExc] = useState<string | null>(null);

  // "hoje" no fuso do programa — piso do date e da validação de exceção
  const hoje = toDateStr(new Date());

  // uma linha por faixa, seg→dom e por hora — (dow + 6) % 7 reordena o dow
  // do Postgres (dom=0) na ordem de leitura (seg=0 … dom=6)
  const janelas = [...grade].sort(
    (a, b) =>
      ((a.dia_semana + 6) % 7) - ((b.dia_semana + 6) % 7) ||
      a.hora_inicio.localeCompare(b.hora_inicio)
  );

  function submitFaixa(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (dias.length === 0) {
      setErroFaixa("Escolha ao menos um dia.");
      return;
    }
    if (ateFaixa <= deFaixa) {
      setErroFaixa("O fim precisa ser depois do início.");
      return;
    }
    setErroFaixa(null);
    start(async () => {
      try {
        // um dia por chamada — a action valida sobreposição por dia
        for (const dow of dias) {
          const fd = new FormData();
          fd.set("dia_semana", String(dow));
          fd.set("hora_inicio", deFaixa);
          fd.set("hora_fim", ateFaixa);
          const res = await adicionarJanela(fd);
          if ("error" in res) {
            toast.error(res.error);
            router.refresh();
            return;
          }
        }
        toast.success(dias.length > 1 ? "Horários adicionados." : "Horário adicionado.");
        setDias([]);
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  function submitExcecao(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data) {
      setErroExc("Escolha a data.");
      return;
    }
    if (data < hoje) {
      setErroExc("Escolha uma data de hoje em diante.");
      return;
    }
    if (ateExc <= deExc) {
      setErroExc("O fim precisa ser depois do início.");
      return;
    }
    setErroExc(null);
    const fd = new FormData();
    fd.set("data", data);
    fd.set("tipo", tipo);
    fd.set("hora_inicio", deExc);
    fd.set("hora_fim", ateExc);
    start(async () => {
      try {
        const res = await adicionarExcecao(fd);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success(
          tipo === "bloqueio"
            ? "Bloqueio adicionado."
            : "Horário extra adicionado."
        );
        // tipo e horário ficam — quem cadastra exceções costuma mandar
        // várias parecidas
        setData("");
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  function removerFaixa(j: GradeJanela) {
    start(async () => {
      try {
        const res = await removerJanela(j.id);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success("Horário removido.");
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  function removerData(x: ExcecaoEspecialista) {
    start(async () => {
      try {
        const res = await removerExcecao(x.id);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success(
          x.tipo === "bloqueio" ? "Bloqueio removido." : "Horário extra removido."
        );
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <section
      id="horarios"
      className="scroll-mt-20 rounded-xl bg-card p-6 shadow-[var(--shadow-border)]"
    >
      <h2 className="text-base font-semibold">Quando você pode atender</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Os jovens escolhem o horário das sessões dentro dessas faixas.
      </p>

      <div className="mt-5 space-y-6">
        {/* ---------- faixas fixas da semana ---------- */}
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Toda semana
          </h3>
          {janelas.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nenhum horário ainda. Adicione o primeiro.
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-border/60">
              {janelas.map((j) => {
                const texto = `${diaPlural(j.dia_semana)} ${faixa(j.hora_inicio, j.hora_fim)}`;
                return (
                  <li
                    key={j.id}
                    className="flex items-center justify-between gap-3 py-1.5"
                  >
                    <span className="min-w-0 text-sm">{texto}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={pending}
                      onClick={() => removerFaixa(j)}
                      aria-label={`Remover ${texto.charAt(0).toLowerCase()}${texto.slice(1)}`}
                      className="-my-1.5 -mr-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <X aria-hidden />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          <form onSubmit={submitFaixa} className="mt-4 space-y-3">
            <div
              role="group"
              aria-label="Dias da semana"
              className="flex flex-wrap gap-1.5"
            >
              {DIAS_OPCOES.map((d) => {
                const on = dias.includes(d.dow);
                return (
                  <button
                    key={d.dow}
                    type="button"
                    aria-pressed={on}
                    aria-label={d.longo}
                    disabled={pending}
                    onClick={() =>
                      setDias((v) =>
                        on ? v.filter((x) => x !== d.dow) : [...v, d.dow]
                      )
                    }
                    className={cn(
                      "h-11 min-w-12 rounded-xl border px-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9",
                      on
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {d.curto}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <FaixaHorario
                de={deFaixa}
                ate={ateFaixa}
                onDe={setDeFaixa}
                onAte={setAteFaixa}
                disabled={pending}
              />
              <Button type="submit" variant="outline" disabled={pending}>
                {pending ? (
                  <CircleNotch className="animate-spin" aria-hidden />
                ) : (
                  <Plus aria-hidden />
                )}
                Adicionar
              </Button>
            </div>
            {erroFaixa && (
              <p role="alert" className="text-sm text-destructive">
                {erroFaixa}
              </p>
            )}
          </form>
        </section>

        {/* ---------- exceções datadas ---------- */}
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Exceções
          </h3>
          {excecoes.length > 0 && (
            <ul className="mt-1 divide-y divide-border/60">
              {excecoes.map((x) => {
                const texto = resumoExcecao(x);
                return (
                  <li
                    key={x.id}
                    className="flex items-center justify-between gap-3 py-1.5"
                  >
                    <span className="min-w-0 text-sm">{texto}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={pending}
                      onClick={() => removerData(x)}
                      aria-label={`Remover exceção: ${texto}`}
                      className="-my-1.5 -mr-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <X aria-hidden />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          <form onSubmit={submitExcecao} className="mt-4 space-y-3">
            {/* segmentado — radios nativos com a barra conectada do app:
                um tab stop, setas movem (mesmo padrão dos instrumentos) */}
            <div
              role="radiogroup"
              aria-label="Tipo de exceção"
              className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:w-72"
            >
              {(
                [
                  ["bloqueio", "Não posso"],
                  ["extra", "Posso a mais"],
                ] as const
              ).map(([v, l]) => (
                <label
                  key={v}
                  className="flex h-11 cursor-pointer items-center justify-center rounded-lg px-1 text-sm font-medium text-muted-foreground transition-colors select-none has-checked:bg-primary has-checked:text-primary-foreground has-checked:shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50 md:h-10"
                >
                  <input
                    type="radio"
                    name="horarios-tipo"
                    value={v}
                    checked={tipo === v}
                    onChange={() => setTipo(v)}
                    className="sr-only"
                    aria-label={`Tipo de exceção: ${l}`}
                  />
                  {l}
                </label>
              ))}
            </div>
            <FaixaDatas
              inicio={hoje}
              valor={data}
              onChange={setData}
              disabled={pending}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <FaixaHorario
                de={deExc}
                ate={ateExc}
                onDe={setDeExc}
                onAte={setAteExc}
                disabled={pending}
              />
              <Button type="submit" variant="outline" disabled={pending}>
                {pending ? (
                  <CircleNotch className="animate-spin" aria-hidden />
                ) : (
                  <Plus aria-hidden />
                )}
                Adicionar
              </Button>
            </div>
            {erroExc && (
              <p role="alert" className="text-sm text-destructive">
                {erroExc}
              </p>
            )}
          </form>
        </section>
      </div>
    </section>
  );
}
