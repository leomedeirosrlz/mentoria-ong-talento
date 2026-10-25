"use client";

import { useState, useTransition } from "react";
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
import { diaPlural, faixa, resumoExcecao } from "@/lib/horarios-especialista";
import type { ExcecaoEspecialista, GradeJanela } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Select "Dia" — o valor é o dow do Postgres (0=domingo … 6=sábado) mas a
 *  ordem de leitura é a da semana brasileira: DIAS_SEMANA abre em seg. */
const DIAS_OPCOES: [string, string][] = DIAS_SEMANA.map((d, i) => [
  String((i + 1) % 7),
  DIAS_SEMANA_LABELS[d],
]);
const DIAS_MAP = Object.fromEntries(DIAS_OPCOES);

/** step do input `time` é em segundos — meia hora, a régua da agenda. */
const PASSO_SEGUNDOS = 30 * 60;

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
  const [dia, setDia] = useState<string | null>(null);
  const [deFaixa, setDeFaixa] = useState("");
  const [ateFaixa, setAteFaixa] = useState("");
  const [erroFaixa, setErroFaixa] = useState<string | null>(null);

  // exceção datada — bloqueio é o caso comum, já vem marcado
  const [tipo, setTipo] = useState<"bloqueio" | "extra">("bloqueio");
  const [data, setData] = useState("");
  const [deExc, setDeExc] = useState("");
  const [ateExc, setAteExc] = useState("");
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
    if (dia == null || !deFaixa || !ateFaixa) {
      setErroFaixa("Escolha o dia e os dois horários.");
      return;
    }
    if (ateFaixa <= deFaixa) {
      setErroFaixa("O fim precisa ser depois do início.");
      return;
    }
    setErroFaixa(null);
    const fd = new FormData();
    fd.set("dia_semana", dia);
    fd.set("hora_inicio", deFaixa);
    fd.set("hora_fim", ateFaixa);
    start(async () => {
      try {
        const res = await adicionarJanela(fd);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success("Horário adicionado.");
        setDia(null);
        setDeFaixa("");
        setAteFaixa("");
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  function submitExcecao(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data || !deExc || !ateExc) {
      setErroExc("Escolha a data e os dois horários.");
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
        // o tipo fica — quem cadastra exceções costuma mandar várias do mesmo
        setData("");
        setDeExc("");
        setAteExc("");
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
          <form onSubmit={submitFaixa} className="mt-3 space-y-2.5">
            <div className="grid grid-cols-2 items-end gap-x-2 gap-y-3 sm:flex sm:gap-2.5">
              <div className="col-span-2 grid gap-1.5 sm:flex-1">
                <Label id="horarios-dia-label">Dia</Label>
                <Select
                  name="dia_semana"
                  value={dia}
                  onValueChange={(v) => setDia(v)}
                  items={DIAS_MAP}
                  disabled={pending}
                >
                  <SelectTrigger
                    id="horarios-dia"
                    aria-labelledby="horarios-dia-label horarios-dia"
                  >
                    <SelectValue placeholder="Escolha" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIAS_OPCOES.map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:w-28">
                <Label htmlFor="horarios-de">De</Label>
                <Input
                  id="horarios-de"
                  type="time"
                  step={PASSO_SEGUNDOS}
                  value={deFaixa}
                  onChange={(e) => setDeFaixa(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-1.5 sm:w-28">
                <Label htmlFor="horarios-ate">Até</Label>
                <Input
                  id="horarios-ate"
                  type="time"
                  step={PASSO_SEGUNDOS}
                  value={ateFaixa}
                  onChange={(e) => setAteFaixa(e.target.value)}
                  disabled={pending}
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                disabled={pending}
                className="col-span-2"
              >
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
          <form onSubmit={submitExcecao} className="mt-3 space-y-2.5">
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
            <div className="grid grid-cols-2 items-end gap-x-2 gap-y-3 sm:flex sm:gap-2.5">
              <div className="col-span-2 space-y-1.5 sm:flex-1">
                <Label htmlFor="horarios-exc-data">Data</Label>
                <Input
                  id="horarios-exc-data"
                  type="date"
                  min={hoje}
                  max="9999-12-31"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-1.5 sm:w-28">
                <Label htmlFor="horarios-exc-de">De</Label>
                <Input
                  id="horarios-exc-de"
                  type="time"
                  step={PASSO_SEGUNDOS}
                  value={deExc}
                  onChange={(e) => setDeExc(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-1.5 sm:w-28">
                <Label htmlFor="horarios-exc-ate">Até</Label>
                <Input
                  id="horarios-exc-ate"
                  type="time"
                  step={PASSO_SEGUNDOS}
                  value={ateExc}
                  onChange={(e) => setAteExc(e.target.value)}
                  disabled={pending}
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                disabled={pending}
                className="col-span-2"
              >
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
