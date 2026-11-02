"use client";

import Link from "next/link";
import { useState } from "react";
import { Star } from "@phosphor-icons/react";
import type { CoberturaVigente, NumerosSemana } from "@/lib/agenda-coordenacao";
import { BarraSegmentada } from "@/components/viz";
import { SaudePrograma } from "@/components/saude-programa";
import { PillTurma } from "@/components/agenda-partes";
import { filterChipCls } from "@/components/ui/filter-chip";

// ============================================================
// "Números da semana" (REALIZA-195 · mock v8b) — os três eixos
// honestos do monitoramento: cobertura do encontro vigente por
// turma (uma linha por cronograma, barra lime única — aceite
// REALIZA-176), situação das duplas (a mesma leitura de /duplas)
// e pulso de registro (entregue × aguardando + ★ dos jovens +
// lembretes no cap). O toggle T1/T2/Todas é ESTADO PRÓPRIO da
// seção — não recicla `cronogramaSel` nem `?visao=` (contrato
// REALIZA-195).
// ============================================================

/** A barra única lime desenha só o "com registro" — o resto é o trilho
 *  muted, sem fatia nomeada ("sem data" é buraco honesto do trilho, não
 *  cor própria). O aria-label segue lendo o denominador completo no
 *  mesmo formato da BarraSegmentada: a cobertura continua literal pra
 *  leitor de tela (e pros specs que a verificam). */
function rotuloCobertura(c: CoberturaVigente): string {
  const fatias: [number, string][] = [
    [c.comRegistro, "com registro"],
    [c.aguardandoRegistro, "aguardando registro"],
    [c.agendadas, "agendadas"],
    [c.naoAconteceram, "não aconteceu"],
    [c.semAgendamento, "sem agendamento"],
  ];
  const descricao = fatias
    .filter(([v]) => v > 0)
    .map(([v, r]) => `${v} ${r}`)
    .join(", ");
  return `${descricao || "nenhum"} · total ${c.total}`;
}

export function NumerosSemanaSecao({
  opcoes,
  agregados,
}: {
  opcoes: { id: string; rotulo: string }[];
  agregados: Record<string, NumerosSemana>;
}) {
  const [recorte, setRecorte] = useState("todas");
  const ag = agregados[recorte] ?? agregados.todas;
  return (
    <section aria-label="Números da semana">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-base font-semibold">Números da semana</h2>
        {opcoes.length > 1 && (
          <div
            role="group"
            aria-label="Recortar os números por turma"
            className="flex items-center gap-2"
          >
            {opcoes.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={recorte === o.id}
                onClick={() => setRecorte(o.id)}
                className={filterChipCls(recorte === o.id)}
              >
                {o.rotulo}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {/* (a) cobertura do encontro vigente — uma linha por cronograma:
            pill da turma, link pro dia oficial, "N de M com registro" e a
            barra única lime (REALIZA-176) — "sem data" é trilho, não fatia */}
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-base font-semibold">
            Cobertura do encontro da semana
          </h3>
          <ul className="mt-3 space-y-4">
            {ag.coberturas.map((c) => (
              <li key={c.cronogramaId}>
                <div className="flex flex-wrap items-center gap-2">
                  <PillTurma turma={c.turma} />
                  {c.eventoNumero != null && c.eventoData ? (
                    <Link
                      href={`/agenda?aba=calendario&dia=${c.eventoData}`}
                      className="text-sm font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Encontro {c.eventoNumero}
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Sem encontro na semana
                    </span>
                  )}
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {c.comRegistro} de {c.total} com registro
                  </span>
                </div>
                {c.eventoData && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.meta}
                    {c.eventoTitulo ? ` · “${c.eventoTitulo}”` : ""}
                  </p>
                )}
                {c.total > 0 && (
                  <div
                    role="img"
                    aria-label={rotuloCobertura(c)}
                    className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full rounded-full bg-[var(--brand-lime)] transition-[width] duration-500 ease-snappy"
                      style={{
                        width: `${(c.comRegistro / c.total) * 100}%`,
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
            {ag.coberturas.length === 0 && (
              <li className="text-sm text-muted-foreground">
                Nenhuma turma com cronograma ativo.
              </li>
            )}
          </ul>
        </div>

        {/* (b) situação das duplas — a mesma leitura da /duplas: em andamento
            particionado em risco, atenção e em dia; apoio aberto é pill à
            parte e nunca tira a dupla da sua situação. Cada fatia com chip
            lá é atalho pra lista já filtrada (?recorte=) */}
        <div className="rounded-xl border bg-card p-4">
          <SaudePrograma saude={ag.saude} nivel="h3" linkBase="/duplas" />
        </div>

        {/* (c) pulso — sinais do registro semanal + a voz do jovem; cada
            número com denominador ou escala, nunca solto */}
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-base font-semibold">Pulso da semana</h3>
          <div className="mt-3 space-y-3">
            <div>
              <p className="flex items-baseline justify-between text-xs text-muted-foreground">
                <span>
                  <b className="font-semibold text-foreground">
                    {ag.pulso.registrosEntregues} de {ag.pulso.realizados}
                  </b>{" "}
                  registros entregues
                </span>
                <span className="tabular-nums">
                  {ag.pulso.aguardandoRegistro} aguardando
                </span>
              </p>
              <BarraSegmentada
                className="mt-1.5"
                altura="sm"
                denominador={ag.pulso.realizados}
                segmentos={[
                  {
                    valor: ag.pulso.registrosEntregues,
                    rotulo: "entregues",
                    cls: "bg-[var(--ok)]",
                  },
                  {
                    valor: ag.pulso.aguardandoRegistro,
                    rotulo: "aguardando",
                    cls: "bg-[var(--warn)]",
                  },
                ]}
                ariaLabel={`${ag.pulso.registrosEntregues} de ${ag.pulso.realizados} registros entregues, ${ag.pulso.aguardandoRegistro} aguardando`}
              />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Star
                aria-hidden
                size={13}
                weight="fill"
                className="shrink-0 text-[var(--warn-text)]"
              />
              {ag.pulso.avaliacaoMedia != null ? (
                <>
                  <b className="font-semibold text-foreground tabular-nums">
                    {ag.pulso.avaliacaoMedia.toLocaleString("pt-BR", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                  </b>{" "}
                  de 5, média das avaliações dos jovens (
                  {ag.pulso.avaliacoes}{" "}
                  {ag.pulso.avaliacoes === 1 ? "resposta" : "respostas"})
                </>
              ) : (
                "Sem avaliação do jovem nos últimos 14 dias"
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              <b className="font-semibold text-foreground tabular-nums">
                {ag.pulso.lembretesEm48h}
              </b>{" "}
              {ag.pulso.lembretesEm48h === 1
                ? "lembrete enviado"
                : "lembretes enviados"}{" "}
              nas últimas 48h
            </p>
            <p className="border-t border-border/60 pt-2 text-xs leading-relaxed text-muted-foreground sm:text-[11px]">
              Últimos 14 dias.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
