"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Plus, X } from "@phosphor-icons/react";
import {
  adicionarExcecao,
  adicionarJanela,
  removerExcecao,
  removerJanela,
} from "@/lib/actions-especialista";
import { formatDate, formatDiaHora, formatDiaSemana } from "@/lib/ciclo";
import type { ExcecaoEspecialista, GradeJanela } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** dow do Postgres (0=domingo) na ordem da semana brasileira — segunda abre
 *  a grade, como em todo calendário do app. */
const DIAS: [string, string][] = [
  ["1", "Segunda"],
  ["2", "Terça"],
  ["3", "Quarta"],
  ["4", "Quinta"],
  ["5", "Sexta"],
  ["6", "Sábado"],
  ["0", "Domingo"],
];

/** PostgREST devolve `time` com segundos ("18:00:00") — a UI corta. */
const horaCurta = (t: string) => t.slice(0, 5);

/** "ter 15/10 às 19:00" — chip de slot: dia da semana curto + dia/hora. */
const rotuloSlot = (iso: string) =>
  `${formatDiaSemana(iso).replace("-feira", "")} ${formatDiaHora(iso)}`;

/** A agenda real do especialista (0073): grade semanal + exceções datadas +
 *  a projeção de slots que os jovens veem. Quem agenda a sessão continua
 *  sendo a dupla — o card deixa isso explícito pra não virar "reserva". */
export function AgendaDisponibilidade({
  grade,
  excecoes,
  slots,
}: {
  grade: GradeJanela[];
  excecoes: ExcecaoEspecialista[];
  slots: string[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function submitJanela(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    start(async () => {
      try {
        const res = await adicionarJanela(new FormData(form));
        if (res?.error) toast.error(res.error);
        else {
          form.reset();
          router.refresh();
        }
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  function submitExcecao(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    start(async () => {
      try {
        const res = await adicionarExcecao(new FormData(form));
        if (res?.error) toast.error(res.error);
        else {
          form.reset();
          router.refresh();
        }
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  function remover(acao: (id: string) => Promise<{ error?: string; ok?: boolean }>, id: string) {
    start(async () => {
      try {
        const res = await acao(id);
        if (res?.error) toast.error(res.error);
        else router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  const gradePorDia = new Map<number, GradeJanela[]>();
  for (const j of grade) {
    const lista = gradePorDia.get(j.dia_semana) ?? [];
    lista.push(j);
    gradePorDia.set(j.dia_semana, lista);
  }

  return (
    <Card className="animate-enter overflow-hidden">
      <CardHeader className="border-b bg-muted/30">
        <CardTitle className="text-lg font-semibold">Sua agenda</CardTitle>
        <CardDescription className="mt-0.5">
          Os jovens com trilha ativa veem esses horários pra combinar as
          sessões de 1h com você — quem marca o encontro é sempre a dupla;
          aqui é a oferta, não o compromisso.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        {/* ---------- grade semanal ---------- */}
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Toda semana
          </h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {DIAS.map(([v, label]) => {
              const janelas = gradePorDia.get(Number(v)) ?? [];
              return (
                <li
                  key={v}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2"
                >
                  <span className="w-20 shrink-0 text-sm text-muted-foreground">
                    {label}
                  </span>
                  {janelas.length === 0 ? (
                    <span className="text-sm text-muted-foreground/60">—</span>
                  ) : (
                    janelas.map((j) => (
                      <span
                        key={j.id}
                        className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-sm tabular-nums"
                      >
                        {horaCurta(j.hora_inicio)}–{horaCurta(j.hora_fim)}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => remover(removerJanela, j.id)}
                          aria-label={`Remover janela de ${label} das ${horaCurta(j.hora_inicio)}`}
                          className="-m-2.5 grid size-11 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:-m-1 sm:size-7"
                        >
                          <X size={11} aria-hidden />
                        </button>
                      </span>
                    ))
                  )}
                </li>
              );
            })}
          </ul>
          <form
            onSubmit={submitJanela}
            className="mt-2.5 flex flex-wrap items-end gap-2"
          >
            <div className="w-full sm:w-36">
              <Select
                name="dia_semana"
                required
                items={Object.fromEntries(DIAS)}
              >
                <SelectTrigger aria-label="Dia da semana">
                  <SelectValue placeholder="Dia" />
                </SelectTrigger>
                <SelectContent>
                  {DIAS.map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-28">
              <Input
                name="hora_inicio"
                type="time"
                required
                aria-label="Início da janela"
              />
            </div>
            <div className="w-28">
              <Input
                name="hora_fim"
                type="time"
                required
                aria-label="Fim da janela"
              />
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              <Plus size={14} aria-hidden />
              Adicionar
            </Button>
          </form>
        </section>

        {/* ---------- exceções datadas ---------- */}
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Dias específicos
          </h3>
          {excecoes.length > 0 && (
            <ul className="mb-2.5 divide-y divide-border rounded-lg border border-border">
              {excecoes.map((x) => (
                <li
                  key={x.id}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{formatDate(x.data)}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {horaCurta(x.hora_inicio)}–{horaCurta(x.hora_fim)}
                    </span>
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      x.tipo === "bloqueio"
                        ? "border-[var(--danger)]/50 text-[var(--danger)]"
                        : "border-[var(--ok)]/50 text-[var(--ok-text)]"
                    }
                  >
                    {x.tipo === "bloqueio" ? "Bloqueio" : "Extra"}
                  </Badge>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remover(removerExcecao, x.id)}
                    aria-label={`Remover ${x.tipo === "bloqueio" ? "bloqueio" : "horário extra"} de ${formatDate(x.data)}`}
                    className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:size-8"
                  >
                    <X size={13} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            onSubmit={submitExcecao}
            className="flex flex-wrap items-end gap-2"
          >
            <div className="w-full sm:w-44">
              <Select
                name="tipo"
                required
                items={{
                  bloqueio: "Bloquear um dia",
                  extra: "Horário extra",
                }}
              >
                <SelectTrigger aria-label="Tipo da exceção">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bloqueio">Bloquear um dia</SelectItem>
                  <SelectItem value="extra">Horário extra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Input name="data" type="date" required aria-label="Data da exceção" />
            </div>
            <div className="w-28">
              <Input name="hora_inicio" type="time" required aria-label="Início da exceção" />
            </div>
            <div className="w-28">
              <Input name="hora_fim" type="time" required aria-label="Fim da exceção" />
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              <Plus size={14} aria-hidden />
              Adicionar
            </Button>
          </form>
        </section>

        {/* ---------- projeção dos slots ---------- */}
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Próximos horários livres
          </h3>
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {grade.length === 0 && excecoes.length === 0
                ? "Cadastre uma janela semanal ou um horário extra pra aparecerem horários aqui — é o que os jovens veem na agenda deles."
                : "Nenhum horário livre nas próximas 3 semanas — está tudo bloqueado ou já marcado."}
            </p>
          ) : (
            <>
              <ul className="flex flex-wrap gap-1.5">
                {slots.slice(0, 12).map((s) => (
                  <li
                    key={s}
                    className="rounded-md border border-border bg-card px-2 py-1 text-xs tabular-nums text-foreground"
                  >
                    {rotuloSlot(s)}
                  </li>
                ))}
              </ul>
              {slots.length > 12 && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  e mais {slots.length - 12} nas próximas 3 semanas
                </p>
              )}
            </>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
