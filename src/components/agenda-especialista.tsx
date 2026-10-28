import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  CalendarPlus,
  ClockCounterClockwise,
  HourglassMedium,
  VideoCamera,
} from "@phosphor-icons/react/dist/ssr";
import {
  limboFechado,
  primeiroNomeDaDupla,
  rotuloDiaAgenda,
} from "@/lib/agenda-minha";
import {
  alvoAgendamento,
  formatDate,
  formatDiaHora,
  jornadaDaDupla,
  linkSeguro,
  passoEsp,
  passosDaTrilha,
  rotuloSlot,
  toDateStr,
  TRILHA_LEN,
  type AlvoAgendamento,
  type JornadaDupla,
  type PassoGuia,
} from "@/lib/ciclo";
import { prazoTrilhaEspecialista, type PrazoTrilha } from "@/lib/encerramento";
import { PAINEL_AGENDA } from "@/lib/agenda-abas";
import type {
  Dupla,
  Encontro,
  EspecialistaEvento,
  ExcecaoEspecialista,
  GradeJanela,
} from "@/lib/types";
import { AgendaEspHorarios } from "@/components/agenda-especialista-horarios";
import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";
import { Avatar } from "@/components/avatar";
import { TrilhaPrazoBadge } from "@/components/trilha-prazo-badge";
import { avatarPublicUrl } from "@/lib/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const DIA_MS = 24 * 3600 * 1000;
/** O aviso de prazo acende na última quinzena — mesma régua do lembrete
 *  D15 que o notifier dispara pro especialista (0108). */
const AVISO_PRAZO_DIAS = 15;

type Sessao = { e: Encontro; dupla: Dupla };

type Pendencia = {
  id: string;
  tipo: "registro" | "prazo";
  titulo: string;
  detalhe: string | null;
  /** destino da ação única — null = a linha é só o alerta (prazo). */
  href: string | null;
  rotuloAcao: string | null;
};

/** Recorte de uma trilha: jornada, fila futura e o que pede ação —
 *  tudo derivado do mesmo `agora` do request (sem Date() novo no meio). */
type RecorteDupla = {
  dupla: Dupla;
  nome: string;
  jornada: JornadaDupla;
  alvo: AlvoAgendamento;
  /** realizado sem registro + agendada/remarcada já vencida sem registro. */
  pendentes: Encontro[];
  /** agendada/remarcada ainda viva (até o fim previsto — a que tá rolando
   *  agora segue aqui, com o "Entrar", e não vira cobrança no meio). */
  proximas: Encontro[];
  prazo: PrazoTrilha | null;
};

function recorteDaDupla(
  d: Dupla,
  passos: PassoGuia[],
  agora: Date,
  agoraMs: number
): RecorteDupla {
  const pendentes: Encontro[] = [];
  const proximas: Encontro[] = [];
  for (const e of d.encontros) {
    if (e.status === "realizado" && !e.registro) {
      pendentes.push(e);
    } else if (e.status === "agendado" || e.status === "remarcado") {
      if (limboFechado(e, agoraMs)) {
        pendentes.push(e);
      } else if (
        e.data_hora != null &&
        new Date(e.data_hora).getTime() +
          Math.max(e.duracao_min, 0) * 60_000 >=
          agoraMs
      ) {
        proximas.push(e);
      }
    }
  }
  const asc = (a: Encontro, b: Encontro) =>
    (a.data_hora ?? "").localeCompare(b.data_hora ?? "");
  pendentes.sort(asc);
  proximas.sort(asc);
  return {
    dupla: d,
    nome: primeiroNomeDaDupla(d) || "Jovem",
    jornada: jornadaDaDupla(d, passos, agora),
    alvo: alvoAgendamento(d, [], agora),
    pendentes,
    proximas,
    prazo:
      d.status === "ativa"
        ? prazoTrilhaEspecialista(d.iniciada_em, agora)
        : null,
  };
}

/** Agenda da trilha especialista (REALIZA-207): a página é pra frente —
 *  o que pede ação ("Precisa de você"), as sessões marcadas por dia e o
 *  retrato compacto das trilhas. A disponibilidade saiu daqui: virou
 *  leitura no "Quando você atende" e edição só no perfil. */
export function AgendaEspecialista({
  duplas,
  espEventos,
  grade,
  excecoes,
  hojeIso,
  agoraMs,
  abas,
}: {
  /** Só as trilhas de especialista do mentor (a página já filtra). */
  duplas: Dupla[];
  espEventos: EspecialistaEvento[];
  grade: GradeJanela[];
  excecoes: ExcecaoEspecialista[];
  /** "YYYY-MM-DD" do dia corrente no fuso do programa. */
  hojeIso: string;
  /** epoch ms do `agora` da página — mesmo snapshot do request. */
  agoraMs: number;
  /** Barra de modos da página (AbasAgenda) — uma por página, no header. */
  abas?: ReactNode;
}) {
  const agora = new Date(agoraMs);
  const passos = passosDaTrilha("especialista", [], espEventos);
  const amanhaIso = toDateStr(new Date(agoraMs + DIA_MS));
  const recortes = duplas.map((d) => recorteDaDupla(d, passos, agora, agoraMs));

  // uma pendência, uma ação — só a primeira carrega o lima preenchido
  const pendencias: Pendencia[] = [];
  for (const r of recortes) {
    const d = r.dupla;
    if (d.status !== "ativa") continue;
    for (const e of r.pendentes) {
      const passo = passoEsp(e, d.encontros);
      pendencias.push(
        e.status === "realizado"
          ? {
              id: `reg-${e.id}`,
              tipo: "registro",
              titulo: `Sessão ${passo} com ${r.nome} está sem registro`,
              detalhe: `Aconteceu ${formatDiaHora(
                e.realizado_em ?? e.data_hora
              )}. Conte como foi.`,
              href: `/duplas/${d.id}#registrar-${e.id}`,
              rotuloAcao: "Registrar sessão",
            }
          : {
              id: `lim-${e.id}`,
              tipo: "registro",
              titulo: `Sessão ${passo} com ${r.nome} ficou sem confirmação`,
              detalhe: `Estava marcada para ${formatDiaHora(
                e.data_hora
              )}. Aconteceu? Confirme ou remarque na ficha.`,
              href: `/duplas/${d.id}#registrar-${e.id}`,
              rotuloAcao: "Registrar sessão",
            }
      );
    }
    if (
      r.prazo &&
      (r.prazo.estado === "passou" ||
        r.prazo.diasRestantes <= AVISO_PRAZO_DIAS)
    ) {
      pendencias.push({
        id: `prazo-${d.id}`,
        tipo: "prazo",
        titulo:
          r.prazo.estado === "passou"
            ? `A trilha com ${r.nome} completou 3 meses`
            : `A trilha com ${r.nome} completa 3 meses em ${formatDate(
                r.prazo.fim
              )}`,
        detalhe:
          r.prazo.estado === "passou"
            ? "Se o foco foi cumprido, feche com a devolutiva na ficha."
            : null,
        href: null,
        rotuloAcao: null,
      });
    }
  }

  // próximas sessões: fila única por dia (Hoje / Amanhã / data por extenso)
  const proximas: Sessao[] = recortes
    .flatMap((r) => r.proximas.map((e) => ({ e, dupla: r.dupla })))
    .sort((a, b) => (a.e.data_hora ?? "").localeCompare(b.e.data_hora ?? ""));
  const grupos: { dia: string; rotulo: string; itens: Sessao[] }[] = [];
  for (const s of proximas) {
    const dia = toDateStr(new Date(s.e.data_hora!));
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) {
      ultimo.itens.push(s);
    } else {
      grupos.push({
        dia,
        rotulo:
          dia === hojeIso
            ? "Hoje"
            : dia === amanhaIso
              ? "Amanhã"
              : rotuloDiaAgenda(dia),
        itens: [s],
      });
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mentoria especializada · até 5 sessões de 1h em até 3 meses
        </p>
      </header>

      {abas}

      <div id={PAINEL_AGENDA} role="tabpanel" className="space-y-6">

        {pendencias.length > 0 && (
          <section aria-label="Precisa de você">
            <h2 className="text-base font-semibold">Precisa de você</h2>
            <div className="mt-2.5 space-y-2">
              {pendencias.map((p, i) => (
                <LinhaPendencia
                  key={p.id}
                  p={p}
                  indice={i}
                  destaque={i === 0}
                />
              ))}
            </div>
          </section>
        )}

        <section aria-label="Próximas sessões">
          <h2 className="text-base font-semibold">Próximas sessões</h2>
          {grupos.length === 0 ? (
            <p className="mt-2.5 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground sm:px-5">
              Nenhuma sessão marcada.
            </p>
          ) : (
            <div className="mt-2.5 space-y-4">
              {grupos.map((g) => (
                <div key={g.dia}>
                  <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {g.rotulo}
                  </h3>
                  <ul className="space-y-2">
                    {g.itens.map((s, i) => (
                      <LinhaSessao
                        key={s.e.id}
                        s={s}
                        passos={passos}
                        hojeIso={hojeIso}
                        indice={i}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Suas trilhas">
          <h2 className="text-base font-semibold">Suas trilhas</h2>
          <div className="mt-2.5 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {recortes.map((r, i) => (
              <CardTrilha key={r.dupla.id} r={r} indice={i} />
            ))}
          </div>
        </section>

        <AgendaEspHorarios grade={grade} excecoes={excecoes} />
      </div>
    </div>
  );
}

const ICONE_PENDENCIA = {
  registro: ClockCounterClockwise,
  prazo: HourglassMedium,
} as const;

/** Linha de pendência — mesma grade de 3 colunas das linhas da agenda do
 *  mentor (trilho w-18 + conteúdo + ação à direita). `destaque` = só a 1ª
 *  pendência carrega o CTA lima; as demais saem em outline. */
function LinhaPendencia({
  p,
  indice,
  destaque,
}: {
  p: Pendencia;
  indice: number;
  destaque: boolean;
}) {
  const Icone = ICONE_PENDENCIA[p.tipo];
  return (
    <div
      className="animate-enter flex flex-wrap items-start gap-x-3 gap-y-2.5 rounded-xl border border-[var(--warn)]/40 bg-[var(--warn)]/[0.07] px-4 py-3 sm:flex-nowrap sm:px-5"
      style={{ "--i": Math.min(indice, 10) } as CSSProperties}
    >
      <div className="w-18 shrink-0 pt-0.5 text-center">
        <Icone
          size={20}
          aria-hidden
          className="inline text-[var(--warn-text)]"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{p.titulo}</p>
        {p.detalhe && (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {p.detalhe}
          </p>
        )}
      </div>
      {p.href && p.rotuloAcao && (
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:shrink-0 sm:self-center">
          <Link
            href={p.href}
            className={buttonVariants({
              variant: destaque ? "default" : "outline",
              size: "sm",
            })}
          >
            {p.rotuloAcao}
          </Link>
        </div>
      )}
    </div>
  );
}

/** Linha de sessão marcada — a mesma grade da agenda do mentor: horário
 *  fixo em w-18, kicker + título + meta, uma ação à direita. No dia da
 *  sessão a ação é "Entrar" (quando há link de chamada); fora do dia,
 *  "Remarcar" pelo mesmo diálogo da ficha. */
function LinhaSessao({
  s,
  passos,
  hojeIso,
  indice,
}: {
  s: Sessao;
  passos: PassoGuia[];
  hojeIso: string;
  indice: number;
}) {
  const { e, dupla } = s;
  const inicioMs = new Date(e.data_hora!).getTime();
  const fimMs = inicioMs + Math.max(e.duracao_min, 0) * 60_000;
  const link = linkSeguro(e.link);
  const passo = passoEsp(e, dupla.encontros);
  const guia = passos.find((p) => p.numero === passo);
  const ehHoje = toDateStr(new Date(e.data_hora!)) === hojeIso;
  const nome = primeiroNomeDaDupla(dupla) || "Jovem";
  const meta: string[] = [];
  if (guia?.titulo) meta.push(guia.titulo);
  if (e.motivo_reagendamento)
    meta.push(`Remarcada: ${e.motivo_reagendamento}`);
  if (e.origem === "externo") meta.push("marcada fora da plataforma");
  return (
    <li
      className="animate-enter"
      style={{ "--i": Math.min(indice, 10) } as CSSProperties}
    >
      <article className="rounded-xl border bg-card px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2.5 sm:flex-nowrap sm:gap-x-4">
          <div className="w-18 shrink-0 pt-0.5 text-center">
            <span className="block text-sm font-semibold tabular-nums">
              {fmtHora.format(new Date(inicioMs))}
            </span>
            <span className="block text-xs leading-tight text-muted-foreground tabular-nums">
              até {fmtHora.format(new Date(fimMs))}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              Trilha · sessão {passo} de {TRILHA_LEN.especialista}
            </p>
            <h3 className="mt-0.5 text-sm font-semibold leading-snug">
              Sessão com {nome}
            </h3>
            {meta.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {meta.map((m) => (
                  <p
                    key={m}
                    className="text-xs leading-snug text-muted-foreground"
                  >
                    {m}
                  </p>
                ))}
              </div>
            )}
          </div>
          {dupla.status === "ativa" && (
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:shrink-0 sm:self-center">
              {ehHoje && link ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "border-[var(--ok)]/40 bg-[var(--ok)]/10 text-[var(--ok-text)] hover:bg-[var(--ok)]/15 hover:text-[var(--ok-text)]"
                  )}
                >
                  <VideoCamera aria-hidden />
                  Entrar
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              ) : (
                <AgendarEncontroDialog
                  duplaId={dupla.id}
                  numero={e.numero}
                  atual={e}
                  piso={dupla.iniciada_em ?? undefined}
                  jovemNome={nome}
                  rotulo="sessão de especialista"
                  trigger={
                    <Button variant="outline" size="sm">
                      <CalendarPlus aria-hidden />
                      Remarcar
                    </Button>
                  }
                />
              )}
            </div>
          )}
        </div>
      </article>
    </li>
  );
}

/** Card compacto da trilha — quem é o jovem e o foco, o progresso "N de 5
 *  sessões", o marco de 3 meses e o próximo passo numa frase. Sem lista
 *  de sessões nem botões soltos: as ações moram nas seções acima e a ficha
 *  fica a um "Abrir trilha". */
function CardTrilha({ r, indice }: { r: RecorteDupla; indice: number }) {
  const { dupla: d, jornada } = r;
  const nome = primeiroNomeDaDupla(d) || "Jovem";
  const encerrada =
    d.encerrada_em != null ||
    d.status === "concluida" ||
    d.status === "encerrada";
  let frase: string;
  if (encerrada) {
    frase = `Trilha concluída${d.encerrada_em ? ` em ${formatDate(d.encerrada_em)}` : ""}.`;
  } else if (d.status === "pausada") {
    frase = "Trilha pausada.";
  } else if (r.pendentes.length > 0) {
    const e = r.pendentes[0];
    frase =
      e.status === "realizado"
        ? `Conte como foi a sessão ${passoEsp(e, d.encontros)}.`
        : `Confirme se a sessão de ${formatDiaHora(e.data_hora)} aconteceu.`;
  } else if (r.proximas.length > 0 && r.proximas[0].data_hora) {
    frase = `Sessão ${passoEsp(r.proximas[0], d.encontros)} marcada pra ${rotuloSlot(r.proximas[0].data_hora)}.`;
  } else if (jornada.completa) {
    frase = "As 5 sessões aconteceram. Falta fechar a trilha na ficha.";
  } else {
    // na trilha esp ninguém "agenda o próximo": a sessão nasce de um
    // pedido aceito (0074) — a frase diz de onde ela vem
    frase = `A sessão ${r.alvo.proximoNumero} ainda não tem data. Ela é marcada quando ${nome} ou a coordenação pedir e você aceitar.`;
  }
  const pct = jornada.total ? (jornada.feitos / jornada.total) * 100 : 0;
  return (
    <div
      className="animate-enter rounded-xl border bg-card p-4"
      style={{ "--i": Math.min(indice, 10) } as CSSProperties}
    >
      <div className="flex items-start gap-3">
        <Avatar
          nome={nome}
          src={
            d.mentorado.avatar_path
              ? avatarPublicUrl(d.mentorado.avatar_path)
              : null
          }
          papel="mentorado"
          size={36}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{nome}</p>
          <p
            className="mt-0.5 truncate text-xs text-muted-foreground"
            title={d.demanda ?? undefined}
          >
            {d.demanda ?? "Trilha de especialista"}
          </p>
        </div>
        <TrilhaPrazoBadge dupla={d} />
      </div>
      <div className="mt-3">
        <p className="text-xs font-medium">
          {jornada.feitos} de {jornada.total} sessões
        </p>
        <div
          role="progressbar"
          aria-label={`${jornada.feitos} de ${jornada.total} sessões realizadas`}
          aria-valuemin={0}
          aria-valuemax={jornada.total}
          aria-valuenow={jornada.feitos}
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="fill-grow h-full rounded-full bg-[var(--destaque)]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-3">
        <p className="min-w-0 flex-1 basis-44 text-xs text-muted-foreground">
          {frase}
        </p>
        <Link
          href={`/duplas/${d.id}`}
          className="inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
        >
          Abrir trilha ›
        </Link>
      </div>
    </div>
  );
}
