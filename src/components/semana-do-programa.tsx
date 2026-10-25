import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import type { ItemPrograma, TipoItemPrograma } from "@/lib/agenda-coordenacao";
import { formatDate } from "@/lib/ciclo";
import { dowCurto, PillTurma, Tag } from "@/components/agenda-partes";
import { cn } from "@/lib/utils";

// ============================================================
// Faixa "Semana do programa" (REALIZA-195 · mock v8b) — cards
// compactos em scroll horizontal em TODAS as larguras (nunca
// grade achatada): flex overflow-x + scroll-snap + fade nas
// bordas. Server-safe de propósito: monta no RSC da coordenação/
// auxiliar e dentro do client da Minha agenda do mentor — quem
// precisa de estado (filtro etc.) fica fora da faixa.
// ============================================================

/** Acento superior do card por tipo — a cor mora na borda de 3px, o
 *  corpo segue neutro (badge carrega a cor, card não ganha tinta). */
const ACENTO: Record<TipoItemPrograma, string> = {
  encontro: "border-t-[var(--brand-lime)]",
  formacao: "border-t-[var(--warn)]",
  evento: "border-t-[var(--info)]",
  supervisao: "border-t-[var(--pausa)]",
};

const ROTULO_TIPO: Record<TipoItemPrograma, string> = {
  encontro: "Encontro",
  formacao: "Formação",
  evento: "Evento",
  supervisao: "Supervisão",
};

const TOM_TIPO: Record<TipoItemPrograma, "ok" | "warn" | "info" | "muted"> = {
  encontro: "ok",
  formacao: "warn",
  evento: "info",
  supervisao: "muted",
};

/** Fade lateral do scroller via máscara inline — a utilidade não existe
 *  em globals (e globals é fora de escopo): mask-image respeita o
 *  conteúdo e funciona sem classe nova. */
const FADE_LATERAL = {
  WebkitMaskImage:
    "linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent)",
  maskImage:
    "linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent)",
} as const;

function CardPrograma({
  item,
  hoje,
  modo,
  sufixoVisao,
  comLinkDia,
  podeChamada,
}: {
  item: ItemPrograma;
  hoje: string;
  /** coord/auxiliar leem "o que cobre"; o mentor lê "como conduzir". */
  modo: "coord" | "mentor";
  /** "&visao=dpp" quando o link precisa preservar a visão híbrida. */
  sufixoVisao: string;
  /** O título linka `?aba=calendario&dia=` — false quando o ramo do
   *  viewer engole o param (supervisor sem papel mentor). */
  comLinkDia: boolean;
  /** "Abrir chamada" — o painel de presença só existe pra coordenação
   *  (`ehCoord` no calendário); auxiliar/supervisor nunca tem a ação. */
  podeChamada: boolean;
}) {
  const dia = new Date(`${item.diaKey}T12:00:00`);
  const ehHoje = item.diaKey === hoje;
  const amanha = new Date(`${hoje}T12:00:00`);
  amanha.setDate(amanha.getDate() + 1);
  const ehAmanha = item.diaKey === amanha.toISOString().slice(0, 10);
  const href = `/agenda?aba=calendario&dia=${item.diaKey}${sufixoVisao}`;
  const guia = item.guia
    ? modo === "mentor"
      ? { rotulo: "Como conduzir", texto: item.guia.conduzir }
      : { rotulo: "O que cobre", texto: item.guia.cobre }
    : null;

  return (
    <li
      className={cn(
        "flex w-[236px] shrink-0 snap-start flex-col rounded-xl border border-t-2 bg-card p-3.5",
        ACENTO[item.tipoItem],
        // convidado = agenda alheia: borda tracejada é o marcador visual
        // (a nota carrega o texto) — opacidade nunca, card é conteúdo
        item.convidado && "border-dashed"
      )}
    >
      {/* linha de chips: data compacta + tipo + turma + etiqueta do dia */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="inline-flex items-baseline gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
          title={formatDate(`${item.diaKey}T12:00:00`)}
        >
          {dowCurto(item.diaKey)} {dia.getDate()}
        </span>
        <Tag tom={TOM_TIPO[item.tipoItem]}>{ROTULO_TIPO[item.tipoItem]}</Tag>
        {item.turma && <PillTurma turma={item.turma} />}
        {(ehHoje || ehAmanha) && (
          <Tag tom="warn">{ehHoje ? "Hoje" : "Amanhã"}</Tag>
        )}
      </div>

      <h3 className="mt-2 text-sm leading-snug font-semibold">
        {comLinkDia ? (
          <Link
            href={href}
            className="rounded-sm underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item.titulo}
          </Link>
        ) : (
          item.titulo
        )}
      </h3>
      {item.detalhe && (
        <p className="mt-0.5 text-xs text-muted-foreground">{item.detalhe}</p>
      )}
      {item.aviso && (
        <p className="mt-1.5">
          <Tag tom="warn">{item.aviso}</Tag>
        </p>
      )}

      {/* tema da semana: título editorial + fase + chips de instrumento
          (os nomes que o cronograma declara — a fonte é ciclo_eventos,
          não dicionário nosso) */}
      {item.tema && (
        <div className="mt-2">
          <p className="text-[13px] leading-snug font-medium">
            “{item.tema.titulo}”
          </p>
          {item.tema.fase && (
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-[11px]">
              {item.tema.fase}
            </p>
          )}
          {item.tema.instrumentos.length > 0 && (
            <p className="mt-1.5 flex flex-wrap gap-1">
              {item.tema.instrumentos.map((i) => (
                <span
                  key={i}
                  className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  {i}
                </span>
              ))}
            </p>
          )}
        </div>
      )}

      {/* condução atrás de <details> nativo — disclosure com teaser,
          sem estado JS; voz por papel (conduzir × cobre) */}
      {guia && (
        <details className="group mt-2 border-t border-border/60 pt-1.5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground select-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 [&::-webkit-details-marker]:hidden">
            <CaretDown
              aria-hidden
              size={12}
              className="shrink-0 transition-transform group-open:rotate-180"
            />
            {guia.rotulo}
            <span className="min-w-0 flex-1 truncate text-right font-normal group-open:hidden">
              {guia.texto.slice(0, 42).trimEnd()}…
            </span>
          </summary>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {guia.texto}
          </p>
        </details>
      )}

      {/* rodapé: nota contextual + ação da coordenação (chamada só no
          dia e só pra quem tem o painel — `podeChamada` resolve no RSC) */}
      {(item.nota || (item.eventoId && ehHoje && podeChamada)) && (
        <p className="mt-auto flex items-center gap-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
          {item.nota && <span className="min-w-0 flex-1">{item.nota}</span>}
          {item.eventoId && ehHoje && podeChamada && (
            <Link
              href={href}
              className="ml-auto shrink-0 rounded-sm font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Abrir chamada
            </Link>
          )}
        </p>
      )}
    </li>
  );
}

/** A faixa completa — heading + caption + scroller. `ariaLabel` nomeia a
 *  seção (a spec e o leitor de tela leem "Semana do programa" / "Minha
 *  agenda"). */
export function SemanaDoPrograma({
  itens,
  hoje,
  modo,
  titulo,
  nota,
  ariaLabel,
  sufixoVisao = "",
  comLinkDia = true,
  podeChamada = false,
}: {
  itens: ItemPrograma[];
  /** "YYYY-MM-DD" de hoje (São Paulo) — âncora das etiquetas. */
  hoje: string;
  modo: "coord" | "mentor";
  titulo: string;
  nota?: string;
  ariaLabel: string;
  sufixoVisao?: string;
  /** false ⇒ os cards são leitura pura — sem link `?dia=` e sem
   *  "Abrir chamada" (supervisor sem superfície de dia). */
  comLinkDia?: boolean;
  /** true só na coordenação — o painel de presença é dela. */
  podeChamada?: boolean;
}) {
  return (
    <section aria-label={ariaLabel}>
      <h2 className="text-base font-semibold">{titulo}</h2>
      {nota && <p className="mt-0.5 text-xs text-muted-foreground">{nota}</p>}
      {itens.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Nada marcado na semana do programa.
        </p>
      ) : (
        <div
          role="region"
          aria-label={`${titulo}. Role horizontalmente`}
          tabIndex={0}
          className="scroll-fina -mx-4 mt-3 overflow-x-auto px-4 pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={FADE_LATERAL}
        >
          <ul className="flex w-max snap-x snap-proximity gap-3">
            {itens.map((item) => (
              <CardPrograma
                key={item.id}
                item={item}
                hoje={hoje}
                modo={modo}
                sufixoVisao={sufixoVisao}
                comLinkDia={comLinkDia}
                podeChamada={podeChamada}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
