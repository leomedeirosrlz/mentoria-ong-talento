import Link from "next/link";
import {
  CalendarPlus,
  ChatsCircle,
  Flag,
  Info,
  SunHorizon,
  TrendUp,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { formatDate, formatDateTime } from "@/lib/ciclo";
import { META_PASSOS_PLANO } from "@/lib/plano-em-dia.data";
import {
  rotuloRitmo,
  type PlanoEmDia,
} from "@/lib/plano-em-dia";
import type { Dupla } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";
import { NovoChamadoDialog } from "@/components/novo-chamado-dialog";
import { ProporPlanoButton } from "@/components/propor-plano-button";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  PillPlano,
  QuadradosPlano,
  type EstadoQuadrado,
} from "@/components/plano-em-dia-pecas";
import {
  RecessoDecisao,
  type RecessoDaFicha,
} from "@/components/recesso-dupla-card";

// "Para ficar em dia" (REALIZA-397/459/513) — a projeção honesta da
// dupla: quando uma escada de ritmos fecha antes do encerramento o card
// mostra o custo e propõe o combinado; quando nem 1 por dia fecha, ele
// diz isso e aponta a conversa com a coordenação — nunca promete o que
// o calendário não comporta. A decisão de recesso mora aqui dentro,
// onde ela muda a conta na hora. Mentor agenda/remarca inline; a
// proposta é dele, do supervisor ou da coordenação — a RPC revalida.

const REGRAS: { termo: string; texto: string }[] = [
  {
    termo: "Ritmo do plano",
    texto:
      "Dois encontros podem cair na mesma semana, sempre com pelo menos 2 dias entre eles. No limite, 1 encontro por dia.",
  },
  {
    termo: "Semana de prática",
    texto:
      "Encontros que pedem prática real no meio do guia seguram uma semana antes do próximo, mesmo a 1 por dia.",
  },
  {
    termo: "Data 'em dia'",
    texto:
      "O dia em que a dupla para de dever: conta também os encontros oficiais que vencem enquanto vocês recuperam.",
  },
  {
    termo: "Limites do calendário",
    texto:
      "Recesso e encerramento do ciclo são fixos, a menos que a dupla decida seguir se encontrando no recesso.",
  },
];

const TOTAL_TRILHA = Object.keys(META_PASSOS_PLANO).length;

export function PlanoEmDiaCard({
  plano,
  dupla,
  souMentor,
  souStaff = false,
  planoVivo = false,
  jovemNome,
  recessos = [],
  podeDeclararRecesso = false,
}: {
  plano: Extract<PlanoEmDia, { aplicavel: true }>;
  dupla: Dupla;
  souMentor: boolean;
  /** coordenação ou supervisor da dupla — podem propor como o mentor
   *  (a RPC revalida) e enxergam o plano sem agendar inline. */
  souStaff?: boolean;
  /** Já existe combinado aberto — a RPC recusa proposta dupla, então o
   *  card não oferece o gesto. */
  planoVivo?: boolean;
  jovemNome: string;
  /** Recessos vigentes/futuros do cronograma — a decisão mora aqui dentro. */
  recessos?: RecessoDaFicha[];
  /** mentor da dupla ou coordenação — a RPC revalida na gravação. */
  podeDeclararRecesso?: boolean;
}) {
  const conversa = plano.estado === "conversa";
  const podeAgendar = souMentor && dupla.status === "ativa";
  const podePropor = (souMentor || souStaff) && dupla.status === "ativa";
  const agendaveis = plano.passos.filter((p) => p.acao !== "travado");

  // a régua inteira da trilha: feito, com data, no plano, fora do limite
  // ou quieto na data oficial — o progresso que o combinado promete
  const feitos = new Set(
    dupla.encontros.filter((e) => e.status === "realizado").map((e) => e.numero)
  );
  const comData = new Set(
    dupla.encontros
      .filter(
        (e) =>
          e.data_hora != null &&
          (e.status === "agendado" || e.status === "remarcado")
      )
      .map((e) => e.numero)
  );
  const passoPorNumero = new Map(plano.passos.map((p) => [p.numero, p]));
  const quadrados = Array.from({ length: TOTAL_TRILHA }, (_, i) => {
    const numero = i + 1;
    const passo = passoPorNumero.get(numero);
    const estado: EstadoQuadrado = feitos.has(numero)
      ? "feito"
      : passo?.acao === "travado" || comData.has(numero)
        ? "marcado"
        : passo
          ? plano.encerramento && passo.data > plano.encerramento
            ? "fora"
            : "plano"
          : "vazio";
    return { numero, estado };
  });

  return (
    <section
      aria-labelledby="plano-em-dia"
      className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--destaque)]/15 text-foreground"
        >
          <TrendUp size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <h2 id="plano-em-dia" className="text-base font-semibold">
              Para ficar em dia
            </h2>
            {conversa ? (
              <PillPlano tom="risco">Não fecha até o encerramento</PillPlano>
            ) : (
              <PillPlano tom="atencao">{rotuloRitmo(plano.ritmo)}</PillPlano>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {agendaveis.length}{" "}
            {agendaveis.length === 1
              ? "encontro pra repor"
              : "encontros pra repor"}
          </p>
        </div>
        <ComoCalcula />
      </div>

      {conversa ? (
        <div className="mt-4">
          <p className="text-2xl font-semibold tracking-tight">
            Nem com 1 encontro por dia fecha
          </p>
          {plano.cabemAteEncerramento && (
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              Nesse ritmo cabem {plano.cabemAteEncerramento.cabem} dos{" "}
              {plano.cabemAteEncerramento.faltam} encontros que faltam
              {plano.encerramento
                ? ` até o encerramento (${formatDate(plano.encerramento)})`
                : ""}
              .
            </p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {plano.sugestao}
          </p>
          {plano.alternativaRecesso && (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
              <SunHorizon size={14} aria-hidden className="mt-0.5 shrink-0" />
              Se vocês seguirem se encontrando no recesso,{" "}
              {rotuloRitmo(plano.alternativaRecesso.ritmo)} fecha o plano em{" "}
              {formatDate(plano.alternativaRecesso.data)}.
            </p>
          )}
          {podePropor && (
            <div className="mt-3">
              <NovoChamadoDialog
                papel={souMentor ? "mentor_dpp" : "coordenacao"}
                duplaId={dupla.id}
                inicial={{
                  categoria: "metodologia",
                  assunto: `Plano "ficar em dia" não fecha até o encerramento`,
                  mensagem: plano.sugestao,
                }}
                trigger={
                  <Button variant="outline" size="sm">
                    <ChatsCircle aria-hidden />
                    Falar com a coordenação
                  </Button>
                }
              />
            </div>
          )}
        </div>
      ) : plano.dataRecuperacao ? (
        <div className="mt-4">
          <p className="text-2xl font-semibold tracking-tight">
            Em dia em{" "}
            <span className="tabular-nums">
              {formatDate(plano.dataRecuperacao)}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {plano.sugestao}
          </p>
          {plano.alternativaRecesso && (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
              <SunHorizon size={14} aria-hidden className="mt-0.5 shrink-0" />
              Se vocês seguirem se encontrando no recesso,{" "}
              {rotuloRitmo(plano.alternativaRecesso.ritmo)} já basta: em dia
              em {formatDate(plano.alternativaRecesso.data)}.
            </p>
          )}
          {podePropor && !planoVivo && (
            <div className="mt-3">
              <ProporPlanoButton duplaId={dupla.id} ritmo={plano.ritmo} />
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-2xl font-semibold tracking-tight">
            Nesse ritmo não fecha
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {plano.alternativaRitmo
              ? `Com ${rotuloRitmo(plano.alternativaRitmo.ritmo)} ficariam em dia em ${formatDate(plano.alternativaRitmo.data)}.`
              : plano.sugestao}
          </p>
        </div>
      )}

      <div className="mt-4">
        <QuadradosPlano
          itens={quadrados}
          rotulo={`${feitos.size} de ${TOTAL_TRILHA} encontros feitos`}
        />
      </div>

      {plano.pendenciasRegistro.length > 0 && (
        <div className="mt-4 rounded-lg bg-muted/50 px-3.5 py-3 shadow-[var(--shadow-inset)]">
          <p className="text-xs font-semibold text-foreground">
            Antes de seguir o plano
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {plano.pendenciasRegistro.map((p) => (
              <li
                key={p.encontroId}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
              >
                <span className="text-muted-foreground">
                  {p.numero}º encontro{" "}
                  {p.estado === "limbo"
                    ? `marcado pra ${formatDateTime(p.dataHora)}, ainda sem confirmação`
                    : "realizado, ainda sem registro"}
                  .
                </span>
                {podeAgendar && (
                  <Link
                    href={`?aba=encontros#registrar-${p.encontroId}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    {p.estado === "limbo" ? "Confirmar" : "Registrar"}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="mt-4 space-y-3">
        {plano.passos.map((p) => {
          const encontro = p.encontroId
            ? (dupla.encontros.find((e) => e.id === p.encontroId) ?? null)
            : null;
          return (
            <li key={p.numero} className="flex items-center gap-3">
              <span
                aria-hidden
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold tabular-nums",
                  p.acao === "travado"
                    ? "bg-muted text-muted-foreground"
                    : "bg-[var(--destaque)]/15 text-foreground"
                )}
              >
                {p.numero}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="text-sm font-semibold">{p.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.acao === "travado" ? (
                      <>marcado pra {formatDate(p.data)}</>
                    ) : (
                      <>
                        sugestão{" "}
                        <b className="font-semibold text-foreground">
                          {formatDate(p.data)}
                        </b>
                        {p.dataOficial !== p.data && (
                          <> · oficial era {formatDate(p.dataOficial)}</>
                        )}
                        {p.venceNoCaminho && <> · vence no caminho</>}
                      </>
                    )}
                  </p>
                </div>
                {p.precondicao && (
                  <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                    <Flag size={12} aria-hidden className="mt-0.5 shrink-0" />
                    Precisa antes: {p.precondicao}
                  </p>
                )}
                {p.aviso && (
                  <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                    <Warning size={12} aria-hidden className="mt-0.5 shrink-0" />
                    {p.aviso}
                  </p>
                )}
              </div>
              {p.acao !== "travado" && podeAgendar && (
                <AgendarEncontroDialog
                  duplaId={dupla.id}
                  numero={p.numero}
                  atual={encontro}
                  // a "remarcar" sem data atual é um "a combinar" vencido:
                  // sugerido preenche sem cobrar motivo de remarcação
                  sugerido={
                    p.acao === "agendar" || !encontro?.data_hora
                      ? p.data
                      : undefined
                  }
                  proposta={
                    p.acao === "remarcar" && encontro?.data_hora
                      ? p.data
                      : undefined
                  }
                  piso={dupla.iniciada_em ?? undefined}
                  jovemNome={jovemNome}
                  trigger={
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 sm:min-h-0"
                    >
                      <CalendarPlus aria-hidden />
                      {p.acao === "remarcar" ? "Remarcar" : "Agendar"}
                    </Button>
                  }
                />
              )}
            </li>
          );
        })}
      </ol>

      {recessos.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <SunHorizon size={14} aria-hidden />
            {recessos.length > 1 ? "Recessos no caminho" : "Recesso no caminho"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {souMentor
              ? "Vocês decidem se param ou seguem se encontrando. A projeção acompanha a decisão."
              : "A dupla decide se para ou segue se encontrando."}
          </p>
          <div className="mt-2.5 space-y-2">
            <RecessoDecisao
              duplaId={dupla.id}
              recessos={recessos}
              podeDeclarar={podeDeclararRecesso}
            />
          </div>
        </div>
      )}

      {plano.avisos.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
          {plano.avisos.map((a) => (
            <li key={a} className="flex items-start gap-1.5">
              <Warning size={14} aria-hidden className="mt-0.5 shrink-0" />
              {a}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ComoCalcula() {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Como o plano calcula"
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-8"
      >
        <Info size={14} aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-4">
        <p className="text-sm font-semibold">Como o plano calcula</p>
        <dl className="mt-3 grid gap-3 text-sm">
          {REGRAS.map((r) => (
            <div key={r.termo}>
              <dt className="font-semibold">{r.termo}</dt>
              <dd className="mt-0.5 text-muted-foreground">{r.texto}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
