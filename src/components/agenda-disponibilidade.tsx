"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CaretDown, Plus, X } from "@phosphor-icons/react";
import {
  adicionarExcecao,
  adicionarJanela,
  removerExcecao,
  removerJanela,
} from "@/lib/actions-especialista";
import {
  gradeVisualSemana,
  type SessaoEntrada,
} from "@/lib/agenda-especialista";
import { formatDate, rotuloSlot, toDateStr } from "@/lib/ciclo";
import type { ExcecaoEspecialista, GradeJanela } from "@/lib/types";
import { AgendaGradeSemanal } from "@/components/agenda-grade-semanal";
import { AgendaGradeEdicao } from "@/components/agenda-grade-edicao";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

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

/** minutos-do-dia → "HH:mm" — o formato do input `time` que a action
 *  valida (a pintura da grade manda minutos snapados, não o input). */
const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** A agenda real do especialista (0073): grade semanal + exceções datadas +
 *  a projeção de slots que os jovens veem. Quem agenda a sessão continua
 *  sendo a dupla — o card deixa isso explícito pra não virar "reserva". */
export function AgendaDisponibilidade({
  grade,
  excecoes,
  slots,
  sessoes,
  hojeIso,
}: {
  grade: GradeJanela[];
  excecoes: ExcecaoEspecialista[];
  slots: string[];
  /** Sessões já marcadas que aparecem na grade — o flatten das duplas do
   *  mentor (esp + DPP do híbrido) mora no caller. */
  sessoes: SessaoEntrada[];
  /** "YYYY-MM-DD" âncora da semana que a grade desenha. */
  hojeIso: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  // Abre por default só sem grade; o estado (não a prop) manda daí em
  // diante — cadastrar a 1ª janela não pode colapsar o editor no meio do
  // fluxo, e o toggle do usuário sobrevive ao router.refresh().
  const [editorAberto, setEditorAberto] = useState(() => grade.length === 0);

  // Até 2 chips por dia dentro do total — um corte flat nos primeiros N
  // esconderia dias tardios da semana quando os dias anteriores projetam
  // muitos slots (ex.: o "domingo 10h" do extra desapareceria numa run de
  // segunda). 16 = 8×2 cobre o pior caso de datas anteriores na janela.
  const slotsVisiveis = useMemo(() => {
    const porDia = new Map<string, number>();
    const visiveis: string[] = [];
    for (const s of slots) {
      if (visiveis.length >= 16) break;
      const dia = toDateStr(new Date(s));
      const n = porDia.get(dia) ?? 0;
      if (n >= 2) continue;
      porDia.set(dia, n + 1);
      visiveis.push(s);
    }
    return visiveis;
  }, [slots]);

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

  // a projeção da semana — a grade de leitura desenha tudo; o editor usa o
  // mesmo resultado pro contexto read-only (sessões/extras/bloqueios)
  const diasGrade = useMemo(
    () => gradeVisualSemana({ hojeIso, grade, excecoes, sessoes, slots }),
    [hojeIso, grade, excecoes, sessoes, slots]
  );

  /** Pintura na grade (REALIZA-163): a mesma action do form, mas o FormData
   *  vem do gesto (dow + minutos snapados) em vez dos inputs. */
  function adicionarNaGrade(diaSemana: number, iniMin: number, fimMin: number) {
    const fd = new FormData();
    fd.set("dia_semana", String(diaSemana));
    fd.set("hora_inicio", hhmm(iniMin));
    fd.set("hora_fim", hhmm(fimMin));
    start(async () => {
      try {
        const res = await adicionarJanela(fd);
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
          sessões de 1h com você. Quem marca o encontro é sempre a dupla;
          aqui é a oferta, não o compromisso.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        {/* ---------- grade visual da semana — a leitura é o default ---------- */}
        <AgendaGradeSemanal dias={diasGrade} />

        {/* ---------- edição — recolhida quando a grade já existe ----------
            <details> nativo: o `open` vem de state (default = grade vazia);
            onToggle mantém o estado do usuário e o router.refresh() não
            reverte — nem colapsa quando a 1ª janela nasce */}
        <details
          open={editorAberto}
          onToggle={(e) => setEditorAberto(e.currentTarget.open)}
          className="group/editar"
        >
          <summary
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden"
            )}
          >
            <CaretDown
              aria-hidden
              className="transition-transform group-open/editar:rotate-180"
            />
            Editar grade
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Mudanças valem para propostas futuras; sessões confirmadas não são
            movidas.
          </p>
          <div className="mt-4 space-y-6">
            {/* editor primário (REALIZA-163): pintar direto na grade — a
                lista por dia embaixo segue como o caminho de teclado/leitor
                de tela e o único no <md (a grade é desktop-only) */}
            <AgendaGradeEdicao
              grade={grade}
              dias={diasGrade}
              pending={pending}
              onAdicionar={adicionarNaGrade}
              onRemover={(id) => remover(removerJanela, id)}
            />

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
                              aria-label={`Remover horário de ${label} das ${horaCurta(j.hora_inicio)}`}
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
                    aria-label="Início do horário"
                  />
                </div>
                <div className="w-28">
                  <Input
                    name="hora_fim"
                    type="time"
                    required
                    aria-label="Fim do horário"
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
          </div>
        </details>

        {/* ---------- projeção dos slots ---------- */}
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Próximos horários livres
          </h3>
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {grade.length === 0 && excecoes.length === 0
                ? "Cadastre um horário fixo por semana ou um horário extra pra aparecerem horários aqui. É o que os jovens veem na agenda deles."
                : "Nenhum horário livre nas próximas 3 semanas: está tudo bloqueado ou já marcado."}
            </p>
          ) : (
            <>
              <ul className="flex flex-wrap gap-1.5">
                {slotsVisiveis.map((s) => (
                  <li
                    key={s}
                    className="rounded-md border border-border bg-card px-2 py-1 text-xs tabular-nums text-foreground"
                  >
                    {rotuloSlot(s)}
                  </li>
                ))}
              </ul>
              {slots.length > slotsVisiveis.length && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  e mais {slots.length - slotsVisiveis.length} nas próximas 3
                  semanas
                </p>
              )}
            </>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
