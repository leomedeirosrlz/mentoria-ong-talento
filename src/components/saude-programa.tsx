"use client";

import Link from "next/link";
import { Info, Lifebuoy } from "@phosphor-icons/react";
import type { RecorteFatia, SaudeRecorte } from "@/lib/agenda-coordenacao";
import { cn } from "@/lib/utils";
import { BarraSegmentada } from "@/components/viz";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ============================================================
// Situação das duplas: o resumo de saúde do programa. Uma só leitura
// para /duplas, para a agenda (coordenação e supervisão) e, depois, para
// a home. Recebe os números prontos de `saudeDoRecorte` (lib): o
// componente só apresenta, não recalcula. Denominador explícito, apoio
// como pill à parte, nenhum número dentro dos segmentos.
// ============================================================

/** Regras que a leitura usa. Ficam no popover "Como calculamos", nunca
 *  fixas na tela. Espelham `saudadeDaDupla` (lib/ciclo.ts). */
const REGRAS: { termo: string; texto: string }[] = [
  {
    termo: "Em andamento",
    texto:
      "Duplas ativas. Em risco, em atenção e em dia somam o total em andamento.",
  },
  {
    termo: "Em risco",
    texto:
      "2 ou mais encontros atrasados, ou avaliação baixa junto com dificuldade no último encontro.",
  },
  {
    termo: "Em atenção",
    texto:
      "1 encontro atrasado, avaliação baixa, dificuldade, agendamento vencido sem registro, registro pendente, combinado com prazo vencido ou trilha de especialista parada há 3 meses.",
  },
  {
    termo: "Em dia",
    texto: "Em andamento e sem nenhum desses sinais.",
  },
  {
    termo: "Apoio aberto",
    texto:
      "Pedido de apoio do mentor ou do jovem. Não muda a situação da dupla: ela aparece na situação dela e também no apoio.",
  },
  {
    termo: "Pausadas e concluídas",
    texto:
      "Pausadas têm a jornada congelada, sem cobrança. Concluídas são as jornadas fechadas ou encerradas pelo rito.",
  },
];

export function SaudePrograma({
  saude,
  titulo = "Situação das duplas",
  nivel = "h2",
  comoCalculamos = true,
  className,
  linkBase,
  onRecorte,
}: {
  /** Números de `saudeDoRecorte` — mesmo objeto em qualquer tela. */
  saude: SaudeRecorte;
  titulo?: string;
  /** h2 em página; h3 dentro de um card que já tem título de seção. */
  nivel?: "h2" | "h3";
  /** Mostra o "Como calculamos" com as regras acima. */
  comoCalculamos?: boolean;
  className?: string;
  /** Fora da /duplas: as fatias que têm chip lá viram link
   *  `{linkBase}?recorte=<id>` — o resumo navega pra lista já filtrada. */
  linkBase?: string;
  /** Na própria /duplas: a fatia ativa o chip correspondente em vez de
   *  navegar (mutuamente exclusivo com `linkBase` — ganha se os dois
   *  vierem). Sem os dois o resumo é leitura pura. */
  onRecorte?: (id: RecorteFatia) => void;
}) {
  const Titulo = nivel;
  const { emAndamento, risco, atencao, emDia, apoio, pausadas, concluidas, total } =
    saude;
  const foraDaRegua = pausadas + concluidas;

  const segmentos = [
    { valor: risco, rotulo: "em risco", cls: "bg-[var(--danger)]" },
    { valor: atencao, rotulo: "em atenção", cls: "bg-[var(--warn)]" },
    // dupla em dia é neutra: o segmento é cinza de dado, sem cor de status
    { valor: emDia, rotulo: "em dia", cls: "bg-muted-foreground" },
    { valor: foraDaRegua, rotulo: "pausadas ou concluídas", cls: "bg-[var(--pausa)]" },
  ];

  return (
    <section aria-label={titulo} className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Titulo className="text-base font-semibold">{titulo}</Titulo>
          <p className="mt-1 text-sm text-muted-foreground">
            {/* cada fatia com chip na /duplas vira atalho ("em dia" e
                "pausadas ou concluídas" não têm chip próprio — ficam texto) */}
            <Atalho id="andamento" linkBase={linkBase} onRecorte={onRecorte}>
              <b className="font-semibold text-foreground tabular-nums">
                {emAndamento} em andamento
              </b>
            </Atalho>
            {" · "}
            <Atalho id="concluida" linkBase={linkBase} onRecorte={onRecorte}>
              <span className="tabular-nums">
                {concluidas} {concluidas === 1 ? "concluída" : "concluídas"}
              </span>
            </Atalho>
            {" · "}
            <Atalho id="pausada" linkBase={linkBase} onRecorte={onRecorte}>
              <span className="tabular-nums">
                {pausadas} {pausadas === 1 ? "pausada" : "pausadas"}
              </span>
            </Atalho>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {apoio > 0 && (
            <Atalho
              id="apoio"
              linkBase={linkBase}
              onRecorte={onRecorte}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[var(--info-border)] bg-[var(--info-bg)] px-2.5 text-xs font-semibold text-[var(--info-text)] hover:no-underline"
            >
              <Lifebuoy size={13} aria-hidden />
              <span className="tabular-nums">{apoio}</span>
              com apoio aberto
            </Atalho>
          )}
          {comoCalculamos && <ComoCalculamos />}
        </div>
      </div>

      {total > 0 ? (
        <>
          <BarraSegmentada
            className="mt-3"
            altura="md"
            denominador={total}
            animate
            segmentos={segmentos}
            ariaLabel={`${emAndamento} em andamento: ${risco} em risco, ${atencao} em atenção, ${emDia} em dia. ${foraDaRegua} pausadas ou concluídas. ${apoio} com apoio aberto.`}
          />
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Item
              id="risco"
              n={risco}
              rotulo="em risco"
              dot="bg-[var(--danger)]"
              texto="text-[var(--danger-text)]"
              linkBase={linkBase}
              onRecorte={onRecorte}
            />
            <Item
              id="atencao"
              n={atencao}
              rotulo="em atenção"
              dot="bg-[var(--warn)]"
              texto="text-[var(--warn-text)]"
              linkBase={linkBase}
              onRecorte={onRecorte}
            />
            <Item n={emDia} rotulo="em dia" dot="bg-muted-foreground" texto="text-foreground" />
            <Item
              n={foraDaRegua}
              rotulo="pausadas ou concluídas"
              dot="bg-[var(--pausa)]"
              texto="text-[var(--pausa-text)]"
            />
          </ul>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhuma dupla neste recorte ainda.
        </p>
      )}
    </section>
  );
}

/** Atalho de fatia — `<Link>` fora da /duplas (`linkBase?recorte=<id>`),
 *  `<button>` na própria (`onRecorte` ativa o chip). Sem nenhum dos dois é
 *  um `<span>`: o item existe igual, só não é clicável. */
function Atalho({
  id,
  linkBase,
  onRecorte,
  className,
  children,
}: {
  id: RecorteFatia;
  linkBase?: string;
  onRecorte?: (id: RecorteFatia) => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const cls = cn(
    "rounded-sm underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className
  );
  if (onRecorte)
    return (
      <button
        type="button"
        onClick={() => onRecorte(id)}
        className={cn(cls, "cursor-pointer")}
      >
        {children}
      </button>
    );
  if (linkBase)
    return (
      <Link href={`${linkBase}?recorte=${id}`} className={cls}>
        {children}
      </Link>
    );
  return <span className={className}>{children}</span>;
}

function Item({
  n,
  rotulo,
  dot,
  texto,
  id,
  linkBase,
  onRecorte,
}: {
  n: number;
  rotulo: string;
  dot: string;
  texto: string;
  /** fatia com chip na /duplas — o item vira atalho; sem id fica texto. */
  id?: RecorteFatia;
  linkBase?: string;
  onRecorte?: (id: RecorteFatia) => void;
}) {
  const conteudo = (
    <>
      <b className={cn("font-semibold tabular-nums", texto)}>{n}</b>
      <span className={texto}>{rotulo}</span>
    </>
  );
  return (
    <li className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", dot)} />
      {id ? (
        <Atalho id={id} linkBase={linkBase} onRecorte={onRecorte}>
          {conteudo}
        </Atalho>
      ) : (
        conteudo
      )}
    </li>
  );
}

function ComoCalculamos() {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-8">
        <Info size={14} aria-hidden />
        Como calculamos
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-4">
        <p className="text-sm font-semibold">Como calculamos</p>
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
