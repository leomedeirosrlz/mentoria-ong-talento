import type { ReactNode } from "react";
import { CheckCircle, FlagCheckered, SealCheck } from "@phosphor-icons/react/dist/ssr";
import {
  AVALIACAO_LABEL,
  formatDate,
  TRILHA_LABEL,
} from "@/lib/ciclo";
import { extraiRodaDaVida } from "@/lib/forms/schema";
import type { DadosRetrospectiva } from "@/lib/retrospectiva";
import { ImprimirButton } from "@/components/imprimir-button";
import {
  CompetenciasResultado,
} from "@/components/instrumento-resultado";
import { RodaComparada } from "@/components/instrumentos/roda-comparada";
import { RodaSvg } from "@/components/instrumentos/roda-svg";
import { cn } from "@/lib/utils";

// REALIZA-359 — a retrospectiva da jornada: tela derivada (nada se edita,
// nada se gera) que abre quando o 16º encontro é realizado ou a dupla já
// fechou. Ordem narrativa do spec: cabeçalho da dupla, linha do tempo
// completa, combinados, roda antes × depois, PDM, excertos dos registros
// e — só no recorte mentor/staff — o checklist de competências.
// `dados` já vem recortado por papel (dadosRetrospectiva): a versão da
// jovem chega sem campos internos e o caller esconde o checklist.

function Secao({
  titulo,
  children,
  className,
}: {
  titulo: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2.5", className)}>
      <h3 className="text-sm font-semibold">{titulo}</h3>
      {children}
    </section>
  );
}

export function RetrospectivaJornada({
  dados,
  mostrarChecklist = false,
}: {
  dados: DadosRetrospectiva;
  /** recorte mentor/staff — a autoavaliação do mentor nunca sai pra jovem */
  mostrarChecklist?: boolean;
}) {
  if (!dados.desbloqueada) return null;
  const { resumo } = dados;
  const combinadosFeitos = dados.combinados.filter(
    (c) => c.status === "feito"
  ).length;

  const rodaInicial = dados.roda?.inicial
    ? extraiRodaDaVida(dados.roda.campos, dados.roda.inicial.respostas)
    : null;
  const rodaFormal = dados.roda?.formal
    ? extraiRodaDaVida(dados.roda.campos, dados.roda.formal.respostas)
    : null;
  const rodaUnica = rodaFormal ?? rodaInicial;
  const encontrosComTrecho = dados.encontros.filter(
    (e) => e.trechos.length > 0
  );

  return (
    <section
      aria-label="Retrospectiva da jornada"
      className="animate-enter space-y-5 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5"
    >
      {/* 1 — cabeçalho da dupla */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <FlagCheckered
              size={17}
              aria-hidden
              className="shrink-0 text-[var(--brand-lime)]"
            />
            Retrospectiva da jornada
          </h2>
          <p className="mt-1 text-sm font-medium">
            {resumo.mentorNome} e {resumo.mentoradoNome}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Trilha {TRILHA_LABEL[resumo.trilha]} · início{" "}
            {formatDate(resumo.inicio)}
            {resumo.fim
              ? ` · encerramento ${formatDate(resumo.fim)}`
              : resumo.status === "concluida" || resumo.status === "encerrada"
                ? " · jornada fechada"
                : ""}
          </p>
        </div>
        <ImprimirButton />
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          [
            "Encontros",
            `${resumo.realizados} de ${resumo.total}`,
            resumo.esperados != null
              ? `esperados: ${resumo.esperados}`
              : null,
          ],
          [
            "Combinados",
            `${combinadosFeitos} de ${dados.combinados.length}`,
            "cumpridos",
          ],
          [
            "Avaliação média",
            resumo.mediaAvaliacao != null
              ? `${resumo.mediaAvaliacao.toFixed(1)}/4`
              : "—",
            resumo.mediaAvaliacao != null ? "do jovem" : null,
          ],
          [
            "Metas do PDM",
            dados.pdm ? `${dados.pdm.atingidas} de ${dados.pdm.total}` : "—",
            dados.pdm ? "atingidas" : null,
          ],
        ].map(([rotulo, valor, sub]) => (
          <div
            key={rotulo as string}
            className="rounded-lg bg-muted/40 px-3 py-2.5"
          >
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {rotulo}
            </dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums">
              {valor}
            </dd>
            {sub && (
              <dd className="text-xs text-muted-foreground">{sub}</dd>
            )}
          </div>
        ))}
      </dl>

      {/* 2 — a linha do tempo completa */}
      {dados.encontros.length > 0 && (
        <Secao titulo="Os encontros">
          <ol className="divide-y divide-border/60">
            {dados.encontros.map((e) => (
              <li
                key={e.numero}
                className="flex items-baseline gap-3 py-1.5 text-sm"
              >
                <span className="w-10 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                  {e.numero}º
                </span>
                <span className="min-w-0 flex-1">
                  {e.tema ?? "Encontro"}
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    {formatDate(e.data)}
                  </span>
                </span>
                {e.avaliacao && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {AVALIACAO_LABEL[e.avaliacao] ?? e.avaliacao}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Secao>
      )}

      {/* 3 — combinados */}
      {dados.combinados.length > 0 && (
        <Secao titulo="Os combinados">
          <ul className="space-y-1.5">
            {dados.combinados.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {c.status === "feito" ? (
                  <CheckCircle
                    size={15}
                    weight="fill"
                    aria-hidden
                    className="mt-0.5 shrink-0 text-[var(--ok-text)]"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="mt-1 size-3.5 shrink-0 rounded-full border border-muted-foreground/50"
                  />
                )}
                <span className="min-w-0 flex-1 leading-snug">
                  {c.descricao}
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {c.responsavel
                      ? `${c.responsavel === "mentor" ? "Mentor" : "Mentorado(a)"} · `
                      : ""}
                    {c.numero != null ? `encontro ${c.numero} · ` : ""}
                    {c.status === "feito"
                      ? c.feitoEm
                        ? `feito em ${formatDate(c.feitoEm)}`
                        : "feito"
                      : c.prazo
                        ? `até ${formatDate(c.prazo)}`
                        : "em aberto"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {/* 4 — roda inicial × formal */}
      {rodaUnica && dados.roda && (
        <Secao titulo="A Roda da Vida, antes e depois">
          {rodaInicial && rodaFormal ? (
            <RodaComparada
              rodaAtual={rodaFormal}
              rodaAnterior={rodaInicial}
              reflexao={
                (dados.roda.formal!.respostas["reflexao"] as string) || null
              }
            />
          ) : (
            <div className="text-center">
              <RodaSvg roda={rodaUnica} className="max-w-[280px]" />
              <p className="mt-1 text-xs text-muted-foreground">
                {rodaFormal
                  ? "Aplicação formal — a leitura inicial não chegou a ser respondida."
                  : "Leitura inicial — a aplicação formal ainda não aconteceu."}
              </p>
            </div>
          )}
        </Secao>
      )}

      {/* 5 — PDM */}
      {dados.pdm && dados.pdm.total > 0 && (
        <Secao titulo="O plano, no fim">
          <p className="text-sm text-muted-foreground">
            {dados.pdm.atingidas} de {dados.pdm.total} metas atingidas
          </p>
          {dados.pdm.atingidasLista.length > 0 && (
            <ul className="space-y-1">
              {dados.pdm.atingidasLista.map((m, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <SealCheck
                    size={15}
                    aria-hidden
                    className="mt-0.5 shrink-0 text-[var(--ok-text)]"
                  />
                  <span className="min-w-0 leading-snug">
                    {m.titulo}
                    {m.atingidaEm && (
                      <span className="block text-xs tabular-nums text-muted-foreground">
                        {formatDate(m.atingidaEm)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      )}

      {/* 6 — excertos dos registros (o que o mentor anotou e pode ser
            mostrado no recorte — jovem vê só o que não é interno) */}
      {encontrosComTrecho.length > 0 && (
        <Secao titulo="Dos registros">
          <div className="space-y-3">
            {encontrosComTrecho.map((e) => (
              <div key={e.numero}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {e.numero}º encontro
                </p>
                <dl className="mt-1 space-y-1.5">
                  {e.trechos.map((t) => (
                    <div key={t.rotulo}>
                      <dt className="text-xs font-medium text-muted-foreground">
                        {t.rotulo}
                      </dt>
                      <dd className="text-sm leading-relaxed whitespace-pre-wrap">
                        {t.texto}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </Secao>
      )}

      {/* 7 — checklist do mentor (recorte staff: nunca pra jovem) */}
      {mostrarChecklist && dados.checklist && (
        <Secao titulo="Competências do mentor, do início ao fim">
          <CompetenciasResultado
            campos={dados.checklist.campos}
            respostas={
              dados.checklist.final?.respostas ??
              dados.checklist.inicio!.respostas
            }
            respostasInicio={
              dados.checklist.final ? dados.checklist.inicio?.respostas ?? null : null
            }
          />
        </Secao>
      )}
    </section>
  );
}
