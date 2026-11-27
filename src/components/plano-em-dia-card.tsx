import Link from "next/link";
import {
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
import { rotuloSessao, sessoesDoEscopo } from "@/lib/plano-combinado";
import type { LadoPlano } from "@/lib/plano-servico";
import type { Dupla } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NovoChamadoDialog } from "@/components/novo-chamado-dialog";
import { CombinarPlano } from "@/components/combinar-plano";
import { buttonVariants } from "@/components/ui/button";
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

// "Para ficar em dia" (REALIZA-397/459/513/518) — a projeção honesta da
// dupla: quando o ritmo fecha antes do encerramento o card mostra o
// custo e abre o "Combinar o plano"; quando nem 1 por dia fecha, ele diz
// isso e aponta a conversa com a coordenação — nunca promete o que o
// calendário não comporta. 518: o card virou leitura — agendar passo a
// passo e declarar recesso aqui dentro saíram; o gesto inteiro (ritmo,
// recesso, grade, combinado) mora na superfície dedicada, e o card só
// mostra onde a decisão da dupla ainda falta.
// 025 (FR-006): com combinado valendo (planoVivo) o card vira FAIXA — a
// projeção que o combinado já carrega não se repete (headline feliz,
// quadrados, passos, avisos não montam); ficam os alertas que o
// combinado não tem (conversa, "não fecha"), as pendências exclusivas
// (recessos, "Antes de seguir o plano") e a saída "Ver o combinado". As
// âncoras #plano-em-dia (e-mail) e #recesso-dupla (fila) seguem vivas.

const REGRAS: { termo: string; texto: string }[] = [
  {
    termo: "Encontros por semana",
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
  recessos = [],
  melhor = null,
}: {
  plano: Extract<PlanoEmDia, { aplicavel: true }>;
  dupla: Dupla;
  souMentor: boolean;
  /** coordenação ou supervisor da dupla — leem o plano inteiro e também
   *  podem propor pela superfície (a RPC revalida). */
  souStaff?: boolean;
  /** Já existe combinado aberto — a proposta dupla não cabe; o card
   *  aponta pra ele. */
  planoVivo?: boolean;
  /** Recessos vigentes/futuros do cronograma — estado tri-estado. */
  recessos?: RecessoDaFicha[];
  /** Motor de cenários (1126): caminho viável mais cedo quando a
   *  simulação base não fecha — o card abre por ele em vez de dizer que
   *  só a coordenação resolve. */
  melhor?: {
    rotulo: string;
    data: string | null;
    sessoes: number;
    decisaoRecesso: "pausa" | "segue" | null;
    fusao: number[][];
  } | null;
}) {
  const conversa = plano.estado === "conversa";
  // 1126: "conversa" é o veredito da simulação base, não do calendário —
  // com caminho viável o card promete a data do caminho
  const viavel = conversa && melhor?.data ? melhor : null;
  // 518: o card é leitura pra todo mundo — "mentor vs staff" só sobra na
  // copy ("vocês" vs "a dupla") e no registro de pendências, que segue
  // do lado do mentor
  const lado: LadoPlano = souMentor ? "mentor" : "staff";
  const podeChamar = (souMentor || souStaff) && dupla.status === "ativa";
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
  // 018: a marca de sessão combinada vira o rótulo da linha — a projeção
  // mostra a decisão do mesmo jeito que o combinado lê depois
  const sessaoTxt = new Map<number, string>();
  for (const nums of sessoesDoEscopo(plano.passos).values())
    for (const n of nums) sessaoTxt.set(n, rotuloSessao(n, nums));
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
      // a âncora é o card inteiro (link do e-mail #plano-em-dia); o h2 só
      // rotula — id próprio pra não dividir o alvo do deep link
      id="plano-em-dia"
      aria-labelledby="plano-em-dia-titulo"
      className="scroll-mt-20 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]"
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
            <h2 id="plano-em-dia-titulo" className="text-base font-semibold">
              Para ficar em dia
            </h2>
            {conversa ? (
              viavel ? (
                <PillPlano tom="atencao">
                  {viavel.decisaoRecesso === "segue"
                    ? "Seguindo no recesso"
                    : viavel.fusao.length > 0
                      ? "Com fusão"
                      : "Com ajuste"}
                </PillPlano>
              ) : (
                <PillPlano tom="risco">Não fecha até o encerramento</PillPlano>
              )
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

      {conversa && viavel ? (
        <div className="mt-4">
          <p className="text-2xl font-semibold tracking-tight">
            Em dia em{" "}
            <span className="tabular-nums">{formatDate(viavel.data!)}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Com {viavel.rotulo}
            {plano.encerramento
              ? `, antes do encerramento (${formatDate(plano.encerramento)})`
              : ""}
            .
          </p>
          {plano.dataProjetada && (
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              Sem mudança, só em {formatDate(plano.dataProjetada)}
              {plano.cabemAteEncerramento
                ? ` — cabem ${plano.cabemAteEncerramento.cabem} dos ${plano.cabemAteEncerramento.faltam} encontros`
                : ""}
              .
            </p>
          )}
        </div>
      ) : conversa ? (
        <div className="mt-4">
          <p className="text-2xl font-semibold tracking-tight">
            Nem com 1 encontro por dia fecha
          </p>
          {plano.cabemAteEncerramento && (
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              Cabem {plano.cabemAteEncerramento.cabem} dos{" "}
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
              {souMentor
                ? "Se vocês seguirem se encontrando no recesso, "
                : "Se a dupla seguir se encontrando no recesso, "}
              {rotuloRitmo(plano.alternativaRecesso.ritmo)} fecha o plano em{" "}
              {formatDate(plano.alternativaRecesso.data)}.
            </p>
          )}
        </div>
      ) : plano.dataRecuperacao ? (
        // a data real é a do combinado — a faixa não repete a headline
        // feliz; os estados de alerta (conversa acima, "não fecha"
        // abaixo) ficam porque o combinado não os carrega (025, FR-006)
        !planoVivo && (
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
                {souMentor
                  ? "Se vocês seguirem se encontrando no recesso, "
                  : "Se a dupla seguir se encontrando no recesso, "}
                {rotuloRitmo(plano.alternativaRecesso.ritmo)} já basta: em dia
                em {formatDate(plano.alternativaRecesso.data)}.
              </p>
            )}
          </div>
        )
      ) : (
        <div className="mt-4">
          <p className="text-2xl font-semibold tracking-tight">
            Não fecha até o encerramento
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {plano.alternativaRitmo
              ? `Com ${rotuloRitmo(plano.alternativaRitmo.ritmo)} ficariam em dia em ${formatDate(plano.alternativaRitmo.data)}.`
              : plano.sugestao}
          </p>
        </div>
      )}

      {plano.recessosPendentes.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {plano.recessosPendentes.length === 1
            ? "Falta 1 decisão da dupla pra fechar a proposta."
            : `Faltam ${plano.recessosPendentes.length} decisões da dupla pra fechar a proposta.`}
        </p>
      )}

      {/* um gatilho só: ritmo, recesso e grade viram pergunta por tela na
          superfície; com combinado aberto a saída é ver o que está valendo */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {planoVivo ? (
          <Link
            // caminho da ficha + âncora: cai na aba certa e rola pro
            // combinado mesmo com a aba errada na query
            href={`/duplas/${dupla.id}#acordos`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Ver o plano
          </Link>
        ) : (
          <CombinarPlano duplaId={dupla.id} lado={lado} />
        )}
        {conversa && !viavel && podeChamar && (
          <NovoChamadoDialog
            papel={souMentor ? "mentor_dpp" : "coordenacao"}
            duplaId={dupla.id}
            inicial={{
              categoria: "metodologia",
              assunto: `Plano "ficar em dia" não fecha até o encerramento`,
              mensagem: plano.sugestao,
            }}
            trigger={
              <button
                type="button"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <ChatsCircle aria-hidden />
                Falar com a coordenação
              </button>
            }
          />
        )}
      </div>

      {!planoVivo && (
        <div className="mt-4">
          <QuadradosPlano
            itens={quadrados}
            rotulo={`${feitos.size} de ${TOTAL_TRILHA} encontros feitos`}
          />
        </div>
      )}

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
                    ? `marcado pra ${formatDateTime(p.dataHora)}, ainda sem registro do desfecho`
                    : "realizado, ainda sem registro"}
                  .
                </span>
                {souMentor && (
                  <Link
                    href={`?aba=encontros#registrar-${p.encontroId}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    {p.estado === "limbo" ? "Registrar como foi" : "Registrar"}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!planoVivo && (
        <ol className="mt-4 space-y-3">
          {plano.passos.map((p) => (
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
                        {p.foraDaGrade && <> · fora dos dias livres</>}
                        {sessaoTxt.has(p.numero) && (
                          <> · {sessaoTxt.get(p.numero)}</>
                        )}
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
            </li>
          ))}
        </ol>
      )}

      {recessos.length > 0 && (
        // a âncora do recesso é a mesma do card standalone — a fila do
        // staff aponta pra #recesso-dupla e cai aqui quando o plano está
        // na tela (RecessoDuplaCard nunca monta junto)
        <div id="recesso-dupla" className="mt-4 scroll-mt-20 border-t border-border pt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <SunHorizon size={14} aria-hidden />
            {recessos.length > 1 ? "Recessos no caminho" : "Recesso no caminho"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {souMentor
              ? "Vocês decidem se pausam os encontros ou seguem se encontrando. A resposta entra no Combinar o plano."
              : "A decisão é da dupla."}
          </p>
          <div className="mt-2.5 space-y-2">
            {/* tri-estado, só leitura: a decisão mora na superfície e no
                card próprio quando o plano não está na tela */}
            <RecessoDecisao
              duplaId={dupla.id}
              recessos={recessos}
              podeDeclarar={false}
            />
          </div>
        </div>
      )}

      {!planoVivo && plano.avisos.length > 0 && (
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
