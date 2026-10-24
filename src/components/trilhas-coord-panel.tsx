import Link from "next/link";
import { ArrowRight, Eye, Warning } from "@phosphor-icons/react/dist/ssr";
import { formatDiaHora, formatDiaMes } from "@/lib/ciclo";
import { painelTrilhasCoord, type PainelTrilhas } from "@/lib/trilhas-coord";
import { turmaCurta } from "@/lib/turma";
import type { Dupla, SolicitacaoEspecialista } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Rótulo do estado da trilha quando não é "ativa" — a ativa não carrega
 *  chip (é o caso comum da lista); as demais marcam o capítulo. */
const STATUS_TRILHA = {
  pausada: "pausada",
  concluida: "concluída",
  encerrada: "encerrada",
} as const;

/** Demanda longa quebra a linha do alerta — corta como o `corta` do card
 *  de solicitações (mesma régua de ~110 chars). */
function corta(texto: string, max = 110): string {
  return texto.length > max ? `${texto.slice(0, max).trimEnd()}…` : texto;
}

/** KPI do painel — número grande em mono + rótulo; o alerta tinge o número
 *  de âmbar quando o que ele conta pede atenção. */
function Kpi({
  n,
  rotulo,
  alerta = false,
}: {
  n: number;
  rotulo: string;
  alerta?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd
        className={cn(
          "font-mono text-2xl font-semibold leading-tight tabular-nums",
          alerta && "text-[var(--warn-text)]"
        )}
      >
        {n}
      </dd>
    </div>
  );
}

/** Painel read-only da coordenação sobre as trilhas de especialista (WP6):
 *  KPIs, alertas de pedido parado no mural e a lista de trilhas com link
 *  pra ficha. A coordenação observa — não designa, não agenda; a única
 *  exceção (encerramento antecipado) mora na ficha da dupla. O cálculo é
 *  do `painelTrilhasCoord` (mesma fonte pra demo e backend real). */
export function TrilhasCoordPanel({
  duplas,
  solicitacoes,
  hoje,
  limiteDias = 5,
  className,
}: {
  duplas: Dupla[];
  solicitacoes: SolicitacaoEspecialista[];
  /** Instante do server — o mesmo da página, pra "N dias" e KPIs coerentes. */
  hoje: Date;
  /** Limiar do alerta de pedido parado — repassado ao cálculo e à copy. */
  limiteDias?: number;
  /** placement no grid da home — merge no <Card> raiz */
  className?: string;
}) {
  const painel: PainelTrilhas = painelTrilhasCoord({
    duplas,
    solicitacoes,
    hoje,
    limiteDiasAlerta: limiteDias,
  });
  const { kpis, trilhas, alertas } = painel;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Trilhas de especialista
          <Badge
            variant="outline"
            className="font-normal text-muted-foreground"
          >
            <Eye size={12} aria-hidden />
            Somente leitura
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Kpi n={kpis.trilhasAtivas} rotulo="Trilhas ativas" />
          <Kpi
            n={kpis.pedidosParados}
            rotulo={`Sem aceite há ≥${limiteDias} dias`}
            alerta={kpis.pedidosParados > 0}
          />
          <Kpi n={kpis.concluidas} rotulo="Concluídas" />
          <Kpi n={kpis.sessoesFeitas} rotulo="Sessões feitas" />
        </dl>

        {/* pedidos sem aceite além do limiar — sinal de observação, não fila
            de trabalho: a coord não designa nem aceita pelo especialista */}
        {alertas.length > 0 && (
          <section aria-label="Pedidos parados">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Pedidos parados
            </h3>
            <ul className="mt-2 space-y-2">
              {alertas.map((a) => (
                <li
                  key={a.solicitacaoId}
                  className="flex gap-2.5 rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/8 px-3 py-2.5"
                >
                  <Warning
                    size={15}
                    aria-hidden
                    className="mt-0.5 shrink-0 text-[var(--warn-text)]"
                  />
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{a.jovemNome}</span>
                      {a.turma ? ` · ${turmaCurta(a.turma)}` : ""}
                      {a.demanda ? ` · ${corta(a.demanda)}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {a.diasParado} {a.diasParado === 1 ? "dia" : "dias"}{" "}
                      {a.onde === "triagem"
                        ? "em triagem"
                        : a.onde === "expirada"
                          ? "com horário expirado"
                          : "no mural"}{" "}
                      (limite: {limiteDias}) · Preferência:{" "}
                      {a.preferenciaNome ?? "qualquer especialista"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Sem ação de designar — quem aceita é o especialista.
            </p>
          </section>
        )}

        <section aria-label="Trilhas de especialista em andamento">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Trilhas
          </h3>
          {trilhas.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nenhuma trilha de especialista ainda.
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-border/60">
              {trilhas.map((t) => (
                <li key={t.duplaId} className="py-2.5 first:pt-2 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm font-medium">
                      {t.jovemNome}{" "}
                      <span className="text-muted-foreground">×</span>{" "}
                      {t.espNome}
                      {t.status !== "ativa" && (
                        <Badge variant="secondary" className="ml-2 font-normal">
                          {STATUS_TRILHA[t.status]}
                        </Badge>
                      )}
                    </p>
                    <Link
                      href={`/duplas/${t.duplaId}`}
                      className="group inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-1 text-xs font-medium underline underline-offset-2 transition-colors hover:text-foreground md:min-h-8"
                    >
                      Ver ficha
                      <ArrowRight
                        size={13}
                        aria-hidden
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </Link>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    sessões {t.sessoesFeitas}/{t.sessoesEsperadas} feitas
                    {t.proximaSessao &&
                      ` · próxima ${formatDiaHora(t.proximaSessao)}`}
                    {t.prazo && ` · prazo ${formatDiaMes(t.prazo)}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* postura do painel: observar e linkar. A única ação de exceção —
            o encerramento antecipado com motivo — mora na ficha da dupla,
            não aqui */}
        <p className="border-t border-border/60 pt-3 text-xs leading-relaxed text-muted-foreground">
          Leitura apenas: quem aceita pedido é o especialista e a sessão é da
          dupla. A única ação de exceção — encerrar uma trilha antes do prazo
          — acontece na ficha da dupla.
        </p>
      </CardContent>
    </Card>
  );
}
