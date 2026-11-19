"use client";

import { useState, type CSSProperties } from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "@/lib/utils";
import { filterChipCls } from "@/components/ui/filter-chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fmtDuracao,
  type GestoTrilha,
  type PessoaAtiva,
  type ProfundidadeSup,
  type TempoTela,
} from "@/lib/adocao";
import { ROTULO_ACAO } from "@/lib/adocao";

/* REALIZA-454 — painéis fixos da aba Adoção: as três perguntas que o
 * explorador só respondia com SQL viram leitura direta sobre o cru
 * produto_eventos (heatmap de cliques 10×10, tempo por tela, até onde
 * lê) + a jornada por pessoa. Os dados chegam JÁ derivados do servidor
 * (lib/adocao.ts) — este boundary só segura os dois seletores de estado
 * de vista (superfície do heatmap, pessoa da trilha), sem URL nem fetch.
 *
 * Régua comum: cada painel declara a janela e o denominador (toques,
 * estadias, visitas roláveis). A escala de cor é a mesma família
 * sequencial de --brand-lime do MapaCalor — número impresso dentro da
 * célula é o dado, a cor só reforça. */

const FMT_INT = new Intl.NumberFormat("pt-BR");
const FMT_HORA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

// mesma rampa do MapaCalor (viz/mapa-calor.tsx): 10% piso pra presença
// mínima, sqrt pra separar o miolo — duplicada aqui porque a constante
// é privada do viz e os dois componentes precisam ler igual
const PREENCHIMENTO = (i: number) =>
  `color-mix(in oklab, var(--brand-lime) ${Math.round(10 + Math.sqrt(Math.min(1, Math.max(0, i))) * 85)}%, var(--card))`;

export type HeatmapPainel = {
  superficie: string;
  rotulo: string;
  /** grade[fy][fx] — toques por célula da grade 10×10 */
  grade: number[][];
  toques: number;
  pessoas: number;
};
export type TempoPainel = TempoTela & { rotulo: string };
export type ProfPainel = ProfundidadeSup & { rotulo: string };

function EstadoAcumulando({ texto }: { texto: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      {texto}{" "}
      <span className="text-muted-foreground/80">
        O gesto que alimenta este painel chegou agora — ele enche conforme
        o uso.
      </span>
    </p>
  );
}

/** Heatmap de toques de uma superfície: <table> 10×10 de verdade —
 *  cada célula carrega o número (o dado) e o fill sequencial (o reforço).
 *  fx/fy = fatia da tela onde o toque caiu, normalizada pelo viewport do
 *  próprio gesto — telas de tamanhos diferentes somam na mesma célula. */
function GradeToques({ painel }: { painel: HeatmapPainel }) {
  const max = Math.max(0, ...painel.grade.flat());
  return (
    <div>
      <div
        role="region"
        aria-label={`Grade de toques de ${painel.rotulo}. Role horizontalmente`}
        tabIndex={0}
        className="scroll-fina overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <table className="w-full min-w-[420px] border-separate border-spacing-[3px]">
          <caption className="sr-only">
            Toques em {painel.rotulo} por região da tela, grade 10 por 10.{" "}
            {FMT_INT.format(painel.toques)} toques no período.
          </caption>
          <thead className="sr-only">
            <tr>
              {Array.from({ length: 10 }, (_, fx) => (
                <th key={fx} scope="col">
                  {fx * 10}% a {fx * 10 + 10}% da largura
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {painel.grade.map((linha, fy) => (
              <tr key={fy}>
                {linha.map((v, fx) => {
                  const i = max > 0 ? v / max : 0;
                  return (
                    <td
                      key={fx}
                      title={`${fx * 10}–${fx * 10 + 10}% da largura, ${fy * 10}–${fy * 10 + 10}% da altura: ${v} ${v === 1 ? "toque" : "toques"}`}
                      aria-label={`${v} ${v === 1 ? "toque" : "toques"}`}
                      className="h-7 w-[10%] rounded-[4px] text-center align-middle text-[10px] font-medium tabular-nums"
                      style={
                        v > 0
                          ? {
                              background: PREENCHIMENTO(i),
                              color:
                                i >= 0.6
                                  ? "var(--brand-ink)"
                                  : "var(--foreground)",
                            }
                          : undefined
                      }
                    >
                      {v > 0 ? v : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p
        aria-hidden
        className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground"
      >
        topo da tela acima · menos
        <span
          className="h-2 w-16 rounded-sm"
          style={{
            background: `linear-gradient(90deg, ${PREENCHIMENTO(0)}, ${PREENCHIMENTO(0.25)}, ${PREENCHIMENTO(0.5)}, ${PREENCHIMENTO(0.75)}, ${PREENCHIMENTO(1)})`,
          }}
        />
        mais
      </p>
    </div>
  );
}

/** Os três painéis + o drill de pessoa. Server manda tudo derivado;
 *  o estado local é só qual superfície/pessoa está em foco. */
export function PaineisRicos({
  heatmaps,
  tempos,
  profundidades,
  pessoas,
  trilhas,
  contexto,
  truncado,
}: {
  heatmaps: HeatmapPainel[];
  tempos: TempoPainel[];
  profundidades: ProfPainel[];
  pessoas: PessoaAtiva[];
  /** trilha por profile_id, pré-derivada pra cada pessoa do seletor */
  trilhas: Record<string, GestoTrilha[]>;
  /** "nos últimos 30 dias" — declaração de janela dos denominadores */
  contexto: string;
  /** teto do fetch cortou a cauda antiga — declarado abaixo dos painéis */
  truncado: boolean;
}) {
  const [supMapa, setSupMapa] = useState(heatmaps[0]?.superficie ?? "");
  const [pessoaId, setPessoaId] = useState(pessoas[0]?.profile_id ?? "");
  const painel = heatmaps.find((h) => h.superficie === supMapa);
  const trilha = trilhas[pessoaId] ?? [];
  const pessoa = pessoas.find((p) => p.profile_id === pessoaId);
  const maxMediana = Math.max(0, ...tempos.map((t) => t.mediana_ms));

  return (
    <div className="space-y-5">
      {/* onde o dedo/mouse cai — o preset "heatmap" do explorador, fixo */}
      <section className="min-w-0 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Onde tocam</h3>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            Toques por região da tela {contexto}
            {painel
              ? ` — ${FMT_INT.format(painel.toques)} toques de ${FMT_INT.format(painel.pessoas)} ${painel.pessoas === 1 ? "pessoa" : "pessoas"} em ${painel.rotulo}.`
              : "."}
          </p>
        </div>
        {heatmaps.length === 0 ? (
          <EstadoAcumulando texto="Nenhum toque registrado neste período." />
        ) : (
          <>
            <div
              role="group"
              aria-label="Superfície do mapa de toques"
              className="flex flex-wrap gap-1.5"
            >
              {heatmaps.map((h) => (
                <ButtonPrimitive
                  key={h.superficie}
                  type="button"
                  onClick={() => setSupMapa(h.superficie)}
                  aria-pressed={h.superficie === supMapa}
                  className={filterChipCls(h.superficie === supMapa)}
                >
                  {h.rotulo}
                </ButtonPrimitive>
              ))}
            </div>
            {painel && <GradeToques painel={painel} />}
          </>
        )}
      </section>

      {/* quanto tempo fica — mediana honesta por estadia */}
      <section className="min-w-0 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Quanto tempo fica</h3>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            Duração das estadias por superfície {contexto}. Uma estadia é
            uma visita contínua — a mediana aguenta a aba esquecida aberta.
          </p>
        </div>
        {tempos.length === 0 ? (
          <EstadoAcumulando texto="Nenhuma estadia medida neste período." />
        ) : (
          <div
            role="region"
            aria-label="Tempo de permanência por superfície. Role horizontalmente"
            tabIndex={0}
            className="scroll-fina overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <table className="w-full min-w-[480px]">
              <caption className="sr-only">
                Tempo de permanência por superfície {contexto}: mediana,
                faixa típica e número de estadias.
              </caption>
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-medium text-muted-foreground">
                  <th scope="col" className="py-1.5 pr-3">
                    superfície
                  </th>
                  <th scope="col" className="w-2/5 py-1.5 pr-3">
                    tempo típico
                  </th>
                  <th scope="col" className="py-1.5 pr-3 text-right">
                    mediana
                  </th>
                  <th scope="col" className="py-1.5 pr-3 text-right">
                    faixa típica
                  </th>
                  <th scope="col" className="py-1.5 text-right">
                    estadias
                  </th>
                </tr>
              </thead>
              <tbody>
                {tempos.map((t) => (
                  <tr key={t.superficie} className="border-b border-border/40">
                    <th
                      scope="row"
                      className="py-2 pr-3 text-left text-xs font-medium whitespace-nowrap"
                    >
                      {t.rotulo}
                    </th>
                    <td className="py-2 pr-3">
                      <div
                        className="h-2 rounded-sm"
                        role="img"
                        aria-label={`mediana ${fmtDuracao(t.mediana_ms)}`}
                        style={{
                          width: `${Math.max(4, (t.mediana_ms / (maxMediana || 1)) * 100)}%`,
                          background: PREENCHIMENTO(0.75),
                        }}
                      />
                    </td>
                    <td className="py-2 pr-3 text-right text-xs font-semibold tabular-nums whitespace-nowrap">
                      {fmtDuracao(t.mediana_ms)}
                    </td>
                    <td className="py-2 pr-3 text-right text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                      {fmtDuracao(t.p25_ms)}–{fmtDuracao(t.p75_ms)}
                    </td>
                    <td className="py-2 text-right text-xs tabular-nums text-muted-foreground">
                      {FMT_INT.format(t.estadias)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* até onde lê — marcos de profundidade por superfície */}
      <section className="min-w-0 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Até onde lê</h3>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            % das visitas em páginas roláveis que alcançou cada marca
            {contexto}. Página que cabe na tela não entra — o denominador
            são só visitas onde existia fim pra alcançar.
          </p>
        </div>
        {profundidades.length === 0 ? (
          <EstadoAcumulando texto="Nenhuma visita em página rolável neste período." />
        ) : (
          <div
            role="region"
            aria-label="Profundidade de rolagem por superfície. Role horizontalmente"
            tabIndex={0}
            className="scroll-fina overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <table className="w-full min-w-[480px]">
              <caption className="sr-only">
                Porcentagem de visitas que alcançou cada profundidade da
                página, por superfície {contexto}.
              </caption>
              <thead>
                <tr className="border-b border-border/60 text-xs font-medium text-muted-foreground">
                  <th scope="col" className="py-1.5 pr-3 text-left">
                    superfície
                  </th>
                  {[25, 50, 75, 100].map((m) => (
                    <th
                      key={m}
                      scope="col"
                      className="px-1 py-1.5 text-center"
                    >
                      {m}%
                    </th>
                  ))}
                  <th scope="col" className="py-1.5 pl-3 text-right">
                    visitas
                  </th>
                </tr>
              </thead>
              <tbody>
                {profundidades.map((p) => (
                  <tr key={p.superficie} className="border-b border-border/40">
                    <th
                      scope="row"
                      className="py-1.5 pr-3 text-left text-xs font-medium whitespace-nowrap"
                    >
                      {p.rotulo}
                    </th>
                    {([25, 50, 75, 100] as const).map((m) => {
                      const frac = p.pct[m];
                      const pct = Math.round(frac * 100);
                      return (
                        <td key={m} className="p-0.5">
                          <span
                            className="block rounded-[5px] px-1.5 py-1 text-center text-xs tabular-nums"
                            title={`${pct}% das ${FMT_INT.format(p.visitas)} visitas alcançou ${m}% da página`}
                            style={
                              frac > 0
                                ? {
                                    background: PREENCHIMENTO(frac),
                                    color:
                                      frac >= 0.6
                                        ? "var(--brand-ink)"
                                        : "var(--foreground)",
                                  }
                                : undefined
                            }
                          >
                            {pct}%
                          </span>
                        </td>
                      );
                    })}
                    <td className="py-1.5 pl-3 text-right text-xs tabular-nums text-muted-foreground">
                      {FMT_INT.format(p.visitas)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* a jornada de uma pessoa — o preset "jornada" do explorador, fixo */}
      <section className="min-w-0 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">A jornada de uma pessoa</h3>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            Os gestos de uma pessoa em ordem {contexto}. Escolha entre as
            mais ativas do período.
          </p>
        </div>
        {pessoas.length === 0 ? (
          <EstadoAcumulando texto="Nenhuma pessoa ativa neste período." />
        ) : (
          <>
            <Select
              value={pessoaId}
              onValueChange={(v) => v && setPessoaId(v)}
            >
              <SelectTrigger
                size="sm"
                className="w-full max-w-xs"
                aria-label="Pessoa da jornada"
              >
                <SelectValue placeholder="Escolha a pessoa" />
              </SelectTrigger>
              <SelectContent>
                {pessoas.map((p) => (
                  <SelectItem key={p.profile_id} value={p.profile_id}>
                    {p.nome ?? p.profile_id.slice(0, 8)} ·{" "}
                    {FMT_INT.format(p.gestos)} gestos
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {pessoa
                ? `${FMT_INT.format(pessoa.gestos)} gestos ${contexto}${pessoa.papel !== "desconhecido" ? ` · ${pessoa.papel}` : ""}`
                : ""}
            </p>
            <ol className="max-h-96 space-y-1 overflow-y-auto scroll-fina">
              {trilha.map((g, i) => (
                <li
                  key={`${g.criado_em}-${i}`}
                  className="flex items-baseline gap-2 text-xs"
                >
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {FMT_HORA.format(new Date(g.criado_em))}
                  </span>
                  <span className="text-foreground">
                    {ROTULO_ACAO[g.acao] ?? g.acao}
                  </span>
                  <span className="font-medium">{g.superficie}</span>
                  {g.detalhe && (
                    <span className="text-muted-foreground">
                      · {g.detalhe}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      {truncado && (
        <p className="text-xs text-muted-foreground">
          Volume alto no período: estes painéis leem os gestos mais
          recentes — a cauda antiga ficou de fora.
        </p>
      )}
    </div>
  );
}

/** Wrapper só pra reaproveitar --i do stagger da seção — os cards do
 *  bloco entram juntos, na convenção animate-enter da aba. */
export function PaineisRicosCard({
  i,
  className,
  ...props
}: Parameters<typeof PaineisRicos>[0] & {
  i?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("animate-enter", className)}
      style={{ "--i": i ?? 0 } as CSSProperties}
    >
      <PaineisRicos {...props} />
    </div>
  );
}
