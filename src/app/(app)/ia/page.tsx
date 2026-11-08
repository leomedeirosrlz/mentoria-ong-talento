import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CaretDown, Info } from "@phosphor-icons/react/dist/ssr";
import { getMe } from "@/lib/queries";
import type { AppRole } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "@/lib/demo/mode";
import { demoIaEventos, demoIaPlano, DEMO_IA_NOMES } from "@/lib/demo/ia-eventos";
import {
  CICLO_PADRAO_DIAS,
  filtrarEventosIa,
  inicioConsultaPlano,
  metricasIa,
  previsaoPlano,
  separarPorRisco,
  serieUsoIa,
  type ConsumoPlanoRow,
  type IaEventoRow,
  type PontoUso,
  type PrevisaoModelo,
  type PrevisaoPlano,
  type StatusPlano,
  type UsoJanela,
} from "@/lib/ia/metricas";
import { getIaConfig, PLANOS_GO, TETOS_GO_USD, type PlanoIa } from "@/lib/ia/config";
import { rotuloTool } from "@/lib/ia/fontes";
import { getConsumoPlanoIa, getPainelIa } from "@/lib/ia/queries";
import { IaEvals } from "@/components/ia-evals";
import { IaLimparEventos } from "@/components/ia-limpar-eventos";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BarraSegmentada, GraficoTempo, type PontoGrafico } from "@/components/viz";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Uso da Liza" };

const DIAS_OPCOES = [7, 30, 90] as const;
const CANAL_OPCOES = ["todos", "chat", "mcp"] as const;
const DIA_MS = 86400_000;

const num = new Intl.NumberFormat("pt-BR");
const dec1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
// vírgula decimal pt-BR. Na leitura, abaixo de 1 centavo vira "< US$ 0,01"
// (quatro casas viravam ruído); usdExato guarda as 4 casas pra tabela de
// dados, listas comparativas e aria
const moeda = (casas: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
const usd2 = moeda(2);
const usd4 = moeda(4);
const usd = (v: number) => (v === 0 ? "US$ 0" : v < 0.01 ? "< US$ 0,01" : usd2.format(v));
const usdExato = (v: number) => (v === 0 ? "US$ 0" : (v < 0.01 ? usd4 : usd2).format(v));
// tokens chegam à casa do milhão: compacto ("15,2 mil") cabe no card de
// meia largura do celular
const compacto = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const ms = (v: number | null) => (v == null ? "n/d" : `${num.format(Math.round(v / 100) / 10)}s`);
const pct = (v: number) => `${Math.round(v * 100)}%`;
/** fração do teto: uso que arredonda pra 0% mas existe vira "< 1%" */
const pctTeto = (v: number) => (v > 0 && v < 0.005 ? "< 1%" : pct(v));

/** "2026-11-04" → "04/11" e "ter, 04/11" (dia civil, sem fuso) */
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const semana = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });
const diaLongo = (d: string) =>
  `${semana.format(new Date(`${d}T12:00:00Z`)).replace(".", "")}, ${ddmm(d)}`;

const REGRAS = [
  {
    termo: "Requisição",
    texto:
      "Cada pergunta respondida pelo modelo na bolha (evento 'resposta'). Pergunta via MCP não chama o modelo da Liza e não entra nos gráficos.",
  },
  {
    termo: "Tokens por requisição",
    texto:
      "Entrada (histórico, instruções e dados das ferramentas) mais saída, somados no período e divididos pelas requisições. Raciocínio aparece à parte; o provedor pode já contá-lo na saída.",
  },
  {
    termo: "Custo por requisição",
    texto:
      "Quanto cada requisição descontou do plano Go (o allowance que o provedor informa). Cobrado é o valor real da fatura, perto de zero dentro do plano; tabela é o preço avulso do mesmo uso.",
  },
  {
    termo: "Picos e médias",
    texto:
      "A linha tracejada é a média do período; o pico é o dia de maior valor. No recorte de 90 dias cada barra é uma semana e o valor é a média por dia dela.",
  },
  {
    termo: "Teto do plano",
    texto:
      "O Go limita em dólares por modelo e por mês. Em qualquer janela de 5 horas cabe 20% do teto e em uma semana, 50%. Passou do limite, o modelo para de responder até a janela liberar. A tabela de tetos é a da documentação do Go; a coordenação pode sobrescrever nos ajustes da Liza.",
  },
  {
    termo: "Ciclo e previsão",
    texto:
      "O ciclo vai do dia de renovação até o mesmo dia do mês seguinte (meia-noite de Brasília, já que o horário exato não é publicado). Sem dia definido, olhamos os últimos 30 dias. O ritmo é a média por dia dos últimos 7 dias; a projeção soma o usado no ciclo com esse ritmo até a renovação.",
  },
  {
    termo: "Situação do plano",
    texto:
      "Com folga: projeção abaixo de 80% do teto. Atenção: projeção entre 80% e 100%, ou uma janela de 5 horas ou da semana acima de 80% do limite. Estoura: o teto acaba antes de renovar. A previsão não depende dos filtros da página.",
  },
  {
    termo: "Modelo",
    texto:
      "O slug que de fato respondeu. Quando o primário falha e o reserva assume, é o reserva que aparece, por isso o resumo pode diferir da configuração.",
  },
  {
    termo: "Latência",
    texto:
      "Tempo total da pergunta: rodadas do modelo mais as ferramentas, até o fim da resposta. p95 é o limite dos 5% mais lentos.",
  },
  {
    termo: "Cache do input",
    texto:
      "Fração dos tokens de entrada que o provedor serviu do cache (prefixo repetido entre requisições): tokens relidos custam menos e voltam mais rápido. Sem leitura de cache no período aparece como n/d.",
  },
] as const;

function Chip({
  href, ativo, children,
}: { href: string; ativo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={ativo ? "true" : undefined}
      className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors sm:min-h-7 ${
        ativo
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

/** Rótulo + chips de um filtro. No celular é uma fileira só, rolando de
 *  lado até a borda da tela; do sm pra cima quebra linha. */
function GrupoChips({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto overscroll-x-contain px-4 py-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:py-0 [&::-webkit-scrollbar]:hidden">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{rotulo}</span>
      {children}
    </div>
  );
}

function Secao({
  titulo, children, className,
}: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border bg-card p-4 sm:p-5", className)}>
      <h2 className="text-base font-semibold">{titulo}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Kpi({ rotulo, valor, detalhe }: { rotulo: string; valor: React.ReactNode; detalhe?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {rotulo}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

// ---------- plano ----------

const STATUS: Record<StatusPlano, { rotulo: string; cls: string }> = {
  folga: {
    rotulo: "Com folga",
    cls: "border-[var(--ok-border)] bg-[var(--ok-bg)] text-[var(--ok-text)]",
  },
  atencao: {
    rotulo: "Atenção",
    cls: "border-[var(--warn-border)] bg-[var(--warn-bg)] text-[var(--warn-text)]",
  },
  estoura: {
    rotulo: "Estoura antes de renovar",
    cls: "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]",
  },
  sem_teto: {
    rotulo: "Sem teto conhecido",
    cls: "border-border bg-muted text-muted-foreground",
  },
};

function BarraJanela({ rotulo, janela }: { rotulo: string; janela: UsoJanela }) {
  const fr = janela.limite ? janela.usado / janela.limite : null;
  const cor =
    fr == null ? "var(--chart-5)"
    : fr >= 1 ? "var(--danger)"
    : fr >= 0.8 ? "var(--warn)"
    : "var(--chart-5)";
  // abaixo de 1% do limite o valor em dólar é ruído: fica só a fração
  const quaseNada = fr != null && fr < 0.005;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <dt className="text-xs font-medium text-muted-foreground">{rotulo}</dt>
        <dd className="text-xs tabular-nums text-muted-foreground">
          {janela.limite == null ? (
            <span className="font-semibold text-foreground">{usd(janela.usado)}</span>
          ) : quaseNada ? (
            <>
              <span className="font-semibold text-foreground">{pctTeto(fr)}</span> de{" "}
              {usd(janela.limite)}
            </>
          ) : (
            <>
              <span className="font-semibold text-foreground">{usd(janela.usado)}</span> de{" "}
              {usd(janela.limite)}
              <span className="ml-1.5 font-semibold text-foreground">{pct(fr!)}</span>
            </>
          )}
        </dd>
      </div>
      {janela.limite != null && (
        <div
          role="img"
          aria-label={`${rotulo}: ${usdExato(janela.usado)} de ${usd(janela.limite)}, ${pctTeto(fr!)} do limite`}
          className="mt-1 h-2 overflow-hidden rounded-full bg-muted"
        >
          <span
            className="block h-full rounded-full transition-[width] duration-500 ease-snappy"
            style={{ width: `${Math.min(100, fr! * 100)}%`, backgroundColor: cor }}
          />
        </div>
      )}
    </div>
  );
}

/** Frase da previsão: o que acontece no ritmo atual, em linguagem de
 *  decisão (acaba quando / fecha com quanto). */
function frasePrevisao(m: PrevisaoModelo, p: PrevisaoPlano): string {
  if (m.teto == null)
    return `Gasto ${p.cicloConhecido ? "no ciclo" : "nos últimos 30 dias"}: ${usd(m.ciclo.usado)}. Defina um teto nos ajustes para acompanhar.`;
  if (m.ciclo.usado >= m.teto)
    return p.renovacao
      ? `O teto do mês acabou. Volta a responder na renovação, em ${ddmm(p.renovacao)}.`
      : "Passou do teto nos últimos 30 dias.";
  if (m.ritmo === 0)
    return p.cicloConhecido
      ? `Sem uso nos últimos 7 dias. Fecha o ciclo com ${pctTeto(m.projecao / m.teto)} do teto.`
      : `Sem uso nos últimos 7 dias. Usou ${pctTeto(m.ciclo.usado / m.teto)} do teto em 30 dias.`;
  // projeção que não chega a 1% do teto: o valor em dólar não informa nada
  const irrisoria = m.projecao / m.teto < 0.005;
  if (!p.cicloConhecido)
    return m.status === "estoura"
      ? `No ritmo atual, gasta ${usd(m.projecao)} em 30 dias, acima do teto.`
      : irrisoria
        ? "No ritmo atual, gasta menos de 1% do teto em 30 dias."
        : `No ritmo atual, gasta ${usd(m.projecao)} em 30 dias (${pct(m.projecao / m.teto)} do teto).`;
  if (m.status === "estoura" && m.esgotaEm && p.renovacao) {
    const antes = Math.max(1, Math.round((p.diasAteRenovar ?? 0) - (m.diasRestantes ?? 0)));
    return `No ritmo atual, o teto acaba em ${ddmm(m.esgotaEm)}, ${antes} ${antes === 1 ? "dia" : "dias"} antes da renovação (${ddmm(p.renovacao)}).`;
  }
  return irrisoria
    ? "No ritmo atual, fecha o ciclo com menos de 1% do teto."
    : `No ritmo atual, fecha o ciclo com ${usd(m.projecao)} (${pct(m.projecao / m.teto)} do teto).`;
}

function CardModelo({
  m, p, i, className,
}: { m: PrevisaoModelo; p: PrevisaoPlano; i: number; className?: string }) {
  const st = STATUS[m.status];
  const curta =
    m.janela5h.limite && m.janela5h.usado >= 0.8 * m.janela5h.limite
      ? "Perto do limite de 5 horas."
      : m.semana.limite && m.semana.usado >= 0.8 * m.semana.limite
        ? "Perto do limite da semana."
        : null;
  const restante =
    m.diasRestantes == null ? null
    : m.diasRestantes === 0 ? "teto esgotado"
    : m.diasRestantes > (p.diasAteRenovar ?? CICLO_PADRAO_DIAS)
      ? p.cicloConhecido ? "não chega ao teto antes de renovar" : "não chega ao teto em 30 dias"
    : `${num.format(Math.floor(m.diasRestantes))} ${Math.floor(m.diasRestantes) === 1 ? "dia" : "dias"} restantes no ritmo atual`;
  return (
    <article
      className={cn("animate-enter rounded-xl border border-border bg-card p-4", className)}
      style={{ "--i": i } as React.CSSProperties}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold">{m.modelo}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {m.teto != null ? `Teto de ${usd(m.teto)} por mês` : "Sem teto conhecido"}
          </p>
        </div>
        {m.status !== "sem_teto" && (
          <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold", st.cls)}>
            {st.rotulo}
          </span>
        )}
      </div>
      <dl className="mt-3 space-y-2.5">
        <BarraJanela rotulo="Últimas 5 horas" janela={m.janela5h} />
        <BarraJanela rotulo="Últimos 7 dias" janela={m.semana} />
        <BarraJanela rotulo={p.cicloConhecido ? "Ciclo atual" : "Últimos 30 dias"} janela={m.ciclo} />
      </dl>
      <p className="mt-3 text-sm">
        {frasePrevisao(m, p)}
        {curta && <span className="font-medium text-[var(--warn-text)]"> {curta}</span>}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {usd(m.ritmo)}/dia na última semana
        {p.cicloConhecido && ` · ${usd(m.ritmoCiclo)}/dia no ciclo`}
        {restante && ` · ${restante}`}
      </p>
    </article>
  );
}

/** Modelos com folga (e sem teto) numa lista curta: nome e quanto do
 *  teto o ciclo já usou. Os cards completos ficam num <details>. */
function ListaTranquilos({
  modelos, p, sozinha, i, className,
}: { modelos: PrevisaoModelo[]; p: PrevisaoPlano; sozinha: boolean; i: number; className?: string }) {
  const comFolga = modelos.filter((m) => m.status === "folga").length;
  const semTeto = modelos.length - comFolga;
  const n = modelos.length;
  const plural = (q: number, um: string, varios: string) => `${num.format(q)} ${q === 1 ? um : varios}`;
  const titulo =
    semTeto === 0 ? plural(n, "modelo com folga", "modelos com folga")
    : comFolga === 0 ? plural(n, "modelo sem teto conhecido", "modelos sem teto conhecido")
    : plural(n, "outro modelo", "outros modelos");
  const prazo = p.cicloConhecido ? "antes de renovar" : "em 30 dias";
  return (
    <article
      className={cn("@container animate-enter rounded-xl border border-border bg-card p-4", className)}
      style={{ "--i": i } as React.CSSProperties}
    >
      {sozinha && comFolga > 0 ? (
        <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
          <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", STATUS.folga.cls)}>
            {STATUS.folga.rotulo}
          </span>
          {semTeto === 0
            ? `Nenhum modelo chega perto do teto ${prazo}.`
            : `Nenhum modelo com teto chega perto dele ${prazo}.`}
        </h3>
      ) : (
        <h3 className="text-sm font-semibold">{titulo}</h3>
      )}
      <div className="mt-3 flex gap-x-3 border-b border-border/60 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        <span className="min-w-0 flex-1">Modelo</span>
        <span className="shrink-0 text-right">{p.cicloConhecido ? "Do teto no ciclo" : "Do teto em 30 dias"}</span>
      </div>
      <ul className="divide-y divide-border/60">
        {modelos.map((m) => {
          const fr = m.teto ? m.ciclo.usado / m.teto : null;
          return (
            <li key={m.modelo} className="flex items-center gap-x-3 py-2">
              <span className="min-w-0 flex-1 break-words text-sm font-medium">{m.modelo}</span>
              {fr != null && (
                <span aria-hidden className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-muted sm:w-16">
                  <span
                    className="block h-full rounded-full bg-[var(--chart-5)]"
                    style={{ width: `${Math.min(100, fr * 100)}%` }}
                  />
                </span>
              )}
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-foreground">
                {fr == null ? <span className="text-muted-foreground">sem teto</span> : pctTeto(fr)}
              </span>
            </li>
          );
        })}
      </ul>
      <details className="group/folga">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9 [&::-webkit-details-marker]:hidden">
          <CaretDown size={13} aria-hidden className="transition-transform group-open/folga:rotate-180" />
          {n === 1 ? "Ver detalhes do modelo" : "Ver detalhes de cada modelo"}
        </summary>
        <div className="mt-1 grid gap-3 @2xl:grid-cols-2">
          {modelos.map((m, i) => (
            <CardModelo key={m.modelo} m={m} p={p} i={i} className="border-border/70 bg-muted/30" />
          ))}
        </div>
      </details>
    </article>
  );
}

function SecaoPlano({ previsao, plano }: { previsao: PrevisaoPlano; plano: PlanoIa }) {
  const nomePlano = PLANOS_GO.find((x) => x.chave === plano.plano)?.rotulo ?? "Go";
  const dias = previsao.diasAteRenovar;
  // card inteiro só pra quem pede ação (estoura/atenção); o resto cabe
  // numa lista. Com contagem ímpar de blocos, o último ocupa a linha toda
  // no desktop em vez de sobrar sozinho na grade de 2
  const { alerta, tranquilos } = separarPorRisco(previsao.modelos);
  const blocos = alerta.length + (tranquilos.length ? 1 : 0);
  const ultimoLargo = blocos > 1 && blocos % 2 === 1 ? "sm:col-span-2" : undefined;
  return (
    <section aria-labelledby="titulo-plano" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="titulo-plano" className="text-base font-semibold tracking-tight sm:text-lg">
          Plano {nomePlano}
        </h2>
        <p className="text-xs text-muted-foreground">
          {previsao.renovacao
            ? `Ciclo de ${ddmm(previsao.inicio)} a ${ddmm(previsao.renovacao)} · renova em ${
                dias != null && dias < 1 ? "menos de 1 dia" : `${num.format(Math.ceil(dias ?? 0))} dias`
              }`
            : "Últimos 30 dias"}
        </p>
      </div>
      {!previsao.cicloConhecido && (
        <p className="rounded-lg border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2 text-sm text-[var(--warn-text)]">
          <span className="font-semibold">Defina o dia de renovação</span> em Ajustes do
          assistente, na bolha da Liza, para prever pelo ciclo real.
        </p>
      )}
      {blocos ? (
        <div className={cn("grid gap-3", blocos > 1 && "sm:grid-cols-2")}>
          {alerta.map((m, i) => (
            <CardModelo
              key={m.modelo}
              m={m}
              p={previsao}
              i={i}
              className={!tranquilos.length && i === alerta.length - 1 ? ultimoLargo : undefined}
            />
          ))}
          {tranquilos.length > 0 && (
            <ListaTranquilos
              modelos={tranquilos}
              p={previsao}
              sozinha={!alerta.length}
              i={alerta.length}
              className={ultimoLargo}
            />
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum consumo do plano {previsao.cicloConhecido ? "neste ciclo" : "nos últimos 30 dias"}.
        </p>
      )}
    </section>
  );
}

// ---------- gráficos ----------

function CardGrafico({
  titulo, valor, legenda, detalhe, vazio, children,
}: {
  titulo: string;
  valor: string;
  legenda: string;
  detalhe?: React.ReactNode;
  vazio: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 className="text-base font-semibold">{titulo}</h2>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{valor}</span>
        <span className="text-xs text-muted-foreground">{legenda}</span>
      </p>
      {detalhe && <p className="mt-0.5 text-xs text-muted-foreground">{detalhe}</p>}
      <div className="mt-3">
        {vazio ? (
          <p className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            Sem requisições no período.
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/** Leitura do painel fora do render (o relógio também: o recorte por
 *  dias e a previsão andam com o mesmo `agora`). */
async function carregarDados(papel: AppRole, dias: number) {
  const agora = Date.now();
  if (await demoAtivo()) {
    const plano = demoIaPlano();
    const desde = inicioConsultaPlano(plano.diaRenovacao, agora);
    return {
      agora,
      eventos: demoIaEventos(dias),
      nomes: DEMO_IA_NOMES,
      truncado: false,
      plano,
      consumo: demoIaEventos(Math.ceil((agora - desde) / DIA_MS) + 1).filter(
        (e) => e.tool === "resposta"
      ) as ConsumoPlanoRow[],
      modelosCfg: [] as string[],
    };
  }
  // papel já foi checado pela página (coordenação): só então os caches
  // do painel entram; demo fica no ramo de cima, sem cache
  const supabase = await createClient();
  const [res, cfg] = await Promise.all([
    getPainelIa(supabase, papel, dias),
    getIaConfig(supabase),
  ]);
  const eventos = res.eventos as IaEventoRow[];
  // a previsão precisa do ciclo inteiro, independente do período: se o
  // período já cobre (30d/90d sem corte), reaproveita as linhas; senão
  // vai a query enxuta de 3 colunas
  const desde = inicioConsultaPlano(cfg.plano.diaRenovacao, agora);
  const consumo: ConsumoPlanoRow[] =
    !res.truncado && desde >= agora - dias * DIA_MS
      ? eventos.filter((e) => e.tool === "resposta")
      : ((await getConsumoPlanoIa(supabase, papel, desde)) as ConsumoPlanoRow[]);
  return {
    agora,
    eventos,
    nomes: res.nomes,
    truncado: res.truncado,
    plano: cfg.plano,
    consumo,
    // slugs configurados por tier + os da tabela do plano = sugestões do
    // seletor de modelos do eval (slug solto continua possível)
    modelosCfg: [
      ...new Set([
        ...Object.values(cfg.modelos).filter(
          (v): v is string => typeof v === "string"
        ),
        ...Object.keys(TETOS_GO_USD),
      ]),
    ].sort(),
  };
}

export default async function IaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await getMe();
  if (me?.role !== "coordenacao") redirect("/");

  const { dias: dP, canal: cP, modelo: mP } = await searchParams;
  const dias = DIAS_OPCOES.includes(Number(dP) as (typeof DIAS_OPCOES)[number])
    ? Number(dP)
    : 30;
  const canal = (CANAL_OPCOES as readonly string[]).includes(String(cP))
    ? String(cP)
    : "todos";
  const modelo = typeof mP === "string" && mP ? mP : null;

  const { agora, eventos, nomes, truncado, plano, consumo, modelosCfg } = await carregarDados(
    me.role,
    dias
  );
  const previsao = previsaoPlano(consumo, plano, agora);

  // filtros locais (a query já trouxe o período inteiro — canal/modelo são
  // recortes baratos sobre o mesmo conjunto). O canal filtra TODO evento e
  // o modelo casa a request inteira via request_id.
  const filtrados = filtrarEventosIa(eventos, canal, modelo);
  const mt = metricasIa(filtrados, dias);
  const uso = serieUsoIa(filtrados, dias, agora);
  // chips de modelo derivam do recorte POR CANAL (não por modelo — o chip
  // é a opção do próprio filtro). O modelo da URL entra na fileira mesmo
  // fora do recorte: sem o chip ativo não há "Todos" pra desfazer.
  const eventosDoCanal =
    canal === "todos" ? eventos : eventos.filter((e) => e.canal === canal);
  const modelosNoRecorte = [...new Set(eventosDoCanal.filter((e) => e.modelo).map((e) => e.modelo!))].sort();
  const modelosChips =
    modelo && !modelosNoRecorte.includes(modelo)
      ? [...modelosNoRecorte, modelo].sort()
      : modelosNoRecorte;

  const params = (o: { dias?: number; canal?: string; modelo?: string | null }) => {
    const q = new URLSearchParams();
    if (o.dias && o.dias !== 30) q.set("dias", String(o.dias));
    if (o.canal && o.canal !== "todos") q.set("canal", o.canal);
    if (o.modelo) q.set("modelo", o.modelo);
    const s = q.toString();
    return `/ia${s ? `?${s}` : ""}`;
  };

  // ---- pontos dos gráficos (textos prontos: o gráfico é client) ----
  const porSemana = uso.agrupamento === "semana";
  const rotuloPonto = (p: PontoUso) =>
    porSemana ? `${ddmm(p.inicio)} a ${ddmm(p.fim)}` : diaLongo(p.inicio);
  const pontos = (
    valor: (p: PontoUso) => number | null,
    fmt: (v: number, p: PontoUso) => string,
    exato?: (v: number, p: PontoUso) => string
  ): PontoGrafico[] =>
    uso.pontos.map((p) => {
      const v = valor(p);
      return {
        chave: p.inicio,
        rotuloEixo: ddmm(p.inicio),
        rotulo: rotuloPonto(p),
        valor: v,
        valorFmt: v == null ? "sem requisições" : fmt(v, p),
        valorExato: v == null || !exato ? undefined : exato(v, p),
      };
    });
  const req = (n: number) => `${num.format(n)} ${n === 1 ? "requisição" : "requisições"}`;
  const ptsReq = pontos(
    (p) => p.reqPorDia,
    (v, p) => (porSemana ? `${dec1.format(v)} por dia (${req(p.requisicoes)} na semana)` : req(p.requisicoes))
  );
  const ptsTok = pontos(
    (p) => p.tokensPorReq,
    (v, p) =>
      `${num.format(Math.round(v))} tokens${
        p.raciocinioPorReq ? ` (+${num.format(Math.round(p.raciocinioPorReq))} de raciocínio)` : ""
      }, ${req(p.requisicoes)}`
  );
  const ptsPlano = pontos(
    (p) => p.planoPorReq,
    (v, p) => `${usd(v)} do plano, ${req(p.requisicoes)}`,
    (v, p) => `${usdExato(v)} do plano, ${req(p.requisicoes)}`
  );
  const m = uso.medias;
  const nomePico = (i: number | null, pts: PontoGrafico[]) =>
    i == null ? "" : ` Pico em ${pts[i].rotulo}: ${pts[i].valorExato ?? pts[i].valorFmt}.`;
  const periodoTxt = `nos últimos ${dias} dias${porSemana ? ", por semana" : ""}`;
  const unidadeTempo = porSemana ? "Semana" : "Dia";
  const vazio = uso.requisicoes === 0;
  const chaveRecorte = `${dias}|${canal}|${modelo ?? ""}`;

  // fração do input servida do cache do provedor — sem leitura de cache
  // no período vira n/d (provedor pode nem reportar cache_read)
  const cacheEntrada =
    mt.tokensIn > 0 && mt.cacheRead > 0 ? mt.cacheRead / mt.tokensIn : null;
  const totalTier = mt.porTier.reduce((s, t) => s + t.respostas, 0);
  const totalUsos = mt.topTools.reduce((s, t) => s + t.chamadas, 0);
  const totalPerguntas = mt.porPessoa.reduce((s, p) => s + p.mensagens, 0);
  const CORES_TIER: Record<string, string> = {
    rapido: "bg-[var(--chart-3)]",
    balanceado: "bg-[var(--chart-5)]",
    forte: "bg-[var(--chart-4)]",
  };
  const nomeTier = (t: string) => (t === "rapido" ? "rápido" : t);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Dados"
        title="Uso da Liza"
        meta="Consumo do plano, tokens e custo por requisição, quem usou e com qual modelo"
        actions={
          <div className="flex items-center gap-1">
          <IaLimparEventos />
          <Popover>
            <PopoverTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "min-h-11 text-xs font-semibold text-foreground/80 sm:min-h-8"
              )}
            >
              <Info size={14} aria-hidden />
              Como calculamos
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="scroll-fina max-h-[min(70vh,34rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto p-4"
            >
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
          </div>
        }
      />

      <SecaoPlano previsao={previsao} plano={plano} />

      {/* filtros deep-linkáveis: valem pros gráficos e listas abaixo; a
          previsão do plano acima não depende deles */}
      <div className="space-y-2 border-t border-border pt-5 sm:flex sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2 sm:space-y-0">
        <GrupoChips rotulo="Período">
          {DIAS_OPCOES.map((d) => (
            <Chip key={d} href={params({ dias: d, canal, modelo })} ativo={dias === d}>
              {d}d
            </Chip>
          ))}
        </GrupoChips>
        <GrupoChips rotulo="Canal">
          {CANAL_OPCOES.map((c) => (
            <Chip key={c} href={params({ dias, canal: c, modelo })} ativo={canal === c}>
              {c === "todos" ? "Todos" : c === "chat" ? "Bolha" : "MCP"}
            </Chip>
          ))}
        </GrupoChips>
        {(modelosChips.length > 1 || modelo != null) && (
          <GrupoChips rotulo="Modelo">
            <Chip href={params({ dias, canal, modelo: null })} ativo={!modelo}>
              Todos
            </Chip>
            {modelosChips.map((s) => (
              <Chip key={s} href={params({ dias, canal, modelo: s })} ativo={modelo === s}>
                {s}
              </Chip>
            ))}
          </GrupoChips>
        )}
      </div>

      {truncado && (
        <p className="rounded-lg border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2 text-sm text-[var(--warn-text)]">
          Período com volume alto: mostrando só os eventos mais recentes. Os
          totais dos gráficos seguem completos — só as listas abaixo foram
          cortadas.
        </p>
      )}

      <div key={chaveRecorte} className="animate-enter space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <CardGrafico
            titulo="Tokens por requisição"
            valor={m.tokensPorReq == null ? "n/d" : compacto.format(m.tokensPorReq)}
            legenda="média do período"
            detalhe={
              m.raciocinioPorReq
                ? `+${num.format(Math.round(m.raciocinioPorReq))} de raciocínio por requisição`
                : undefined
            }
            vazio={vazio}
          >
            <GraficoTempo
              tipo="linha"
              formato="tokens"
              cor="var(--chart-5)"
              pontos={ptsTok}
              media={m.tokensPorReq}
              pico={uso.picos.tokensPorReq}
              rotuloTempo={unidadeTempo}
              rotuloValor="Tokens por requisição"
              ariaLabel={`Tokens por requisição ${periodoTxt}. Média ${num.format(Math.round(m.tokensPorReq ?? 0))}.${nomePico(uso.picos.tokensPorReq, ptsTok)}`}
            />
          </CardGrafico>

          <CardGrafico
            titulo="Custo por requisição"
            valor={m.planoPorReq == null ? "n/d" : usd(m.planoPorReq)}
            legenda="do plano, em média"
            detalhe={
              m.custoPorReq == null
                ? undefined
                : `cobrado ${usd(m.custoPorReq)} · tabela ${usd(m.tabelaPorReq ?? 0)} por requisição`
            }
            vazio={vazio}
          >
            <GraficoTempo
              tipo="linha"
              formato="usd"
              cor="var(--chart-4)"
              pontos={ptsPlano}
              media={m.planoPorReq}
              pico={uso.picos.planoPorReq}
              rotuloTempo={unidadeTempo}
              rotuloValor="Do plano por requisição"
              ariaLabel={`Custo do plano por requisição ${periodoTxt}. Média ${usdExato(m.planoPorReq ?? 0)}.${nomePico(uso.picos.planoPorReq, ptsPlano)}`}
            />
          </CardGrafico>

          <CardGrafico
            titulo="Requisições por dia"
            valor={dec1.format(m.reqPorDia)}
            legenda="por dia, em média"
            detalhe={`${req(uso.requisicoes)} no período`}
            vazio={vazio}
          >
            <GraficoTempo
              tipo="barras"
              formato={porSemana ? "decimal" : "inteiro"}
              cor="var(--chart-2)"
              pontos={ptsReq}
              media={m.reqPorDia}
              pico={uso.picos.reqPorDia}
              rotuloTempo={unidadeTempo}
              rotuloValor={porSemana ? "Requisições por dia (média)" : "Requisições"}
              ariaLabel={`Requisições por dia ${periodoTxt}. Média ${dec1.format(m.reqPorDia)} por dia.${nomePico(uso.picos.reqPorDia, ptsReq)}`}
            />
          </CardGrafico>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            rotulo="Gasto do plano"
            valor={usd(mt.allowanceUsd)}
            detalhe={`no período · cobrado ${usd(mt.custoUsd)}`}
          />
          <Kpi rotulo="Latência média" valor={ms(mt.msMedio)} detalhe={`p95 ${ms(mt.msP95)}`} />
          <Kpi
            rotulo="Erro"
            valor={
              <span
                className={
                  mt.erroRate > 0.05 ? "text-[var(--danger-text)]" : undefined
                }
              >
                {pct(mt.erroRate)}
              </span>
            }
            detalhe={`${mt.respostas - mt.respostasOk} de ${mt.respostas} respostas`}
          />
          <Kpi
            rotulo="Iterações"
            valor={mt.iterMedia == null ? "n/d" : num.format(mt.iterMedia)}
            detalhe="rodadas por resposta"
          />
          <Kpi
            rotulo="Cache do input"
            valor={cacheEntrada == null ? "n/d" : pct(cacheEntrada)}
            detalhe={cacheEntrada == null ? undefined : "dos tokens de entrada"}
          />
        </div>

        <Secao titulo="Por modelo">
          <div className="flex gap-x-2 border-b border-border/60 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground sm:gap-x-3 [&>span]:shrink-0">
            <span className="hidden sm:block sm:flex-1 sm:shrink">Modelo</span>
            <span className="ml-auto w-10 text-right sm:ml-0">Req.</span>
            <span className="w-20 text-right sm:w-24">Tok./req.</span>
            <span className="w-20 text-right sm:w-24">Plano/req.</span>
            <span className="w-12 text-right sm:w-14">Tempo</span>
          </div>
          <ul className="divide-y divide-border/60">
            {mt.porModelo.map((l) => (
              // no celular o nome ocupa a linha e as métricas descem sob o
              // cabeçalho; título de item não trunca. O modelo do filtro
              // fica marcado na própria lista (feedback do recorte ativo)
              <li
                key={l.modelo}
                className={cn(
                  "flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2 sm:gap-x-3",
                  modelo === l.modelo &&
                    "-mx-2 rounded-md bg-primary/5 px-2 ring-1 ring-primary/20"
                )}
              >
                <span className="w-full min-w-0 break-words text-sm font-medium sm:w-auto sm:flex-1">
                  {l.modelo}
                  {modelo === l.modelo && (
                    <span className="ml-2 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-foreground">
                      filtro
                    </span>
                  )}
                </span>
                <span className="ml-auto w-10 text-right text-xs tabular-nums sm:ml-0">{num.format(l.respostas)}</span>
                <span className="w-20 text-right sm:w-24 text-xs tabular-nums text-muted-foreground">
                  {l.respostas ? num.format(Math.round((l.tokensIn + l.tokensOut) / l.respostas)) : "n/d"}
                </span>
                <span className="w-20 text-right sm:w-24 text-xs tabular-nums text-muted-foreground">
                  {l.respostas ? usdExato(l.allowance / l.respostas) : "n/d"}
                </span>
                <span className="w-12 text-right text-xs tabular-nums text-muted-foreground sm:w-14">{ms(l.msMedio)}</span>
              </li>
            ))}
            {!mt.porModelo.length && (
              <li className="py-2 text-sm text-muted-foreground">Sem respostas no período.</li>
            )}
          </ul>
          {totalTier > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Respostas por tier
              </p>
              <BarraSegmentada
                className="mt-2"
                denominador={totalTier}
                legenda
                segmentos={mt.porTier.map((t) => ({
                  valor: t.respostas,
                  rotulo: nomeTier(t.tier),
                  cls: CORES_TIER[t.tier] ?? "bg-[var(--chart-3)]",
                }))}
                ariaLabel={`Respostas por tier: ${mt.porTier
                  .map((t) => `${t.respostas} ${nomeTier(t.tier)}`)
                  .join(", ")}, total ${totalTier}`}
              />
            </div>
          )}
        </Secao>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Secao titulo="Ferramentas mais usadas">
            <div className="flex gap-x-3 border-b border-border/60 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              <span className="min-w-0 flex-1">Ferramenta</span>
              <span className="w-10 text-right">Usos</span>
              <span className="w-12 text-right">Erro</span>
              <span className="w-12 text-right">Tempo</span>
            </div>
            <ul className="divide-y divide-border/60">
              {mt.topTools.map((t) => {
                const fr = totalUsos ? t.chamadas / totalUsos : 0;
                return (
                <li key={t.tool} className="flex items-baseline gap-x-3 py-2">
                  <span className="min-w-0 flex-1 break-words text-sm font-medium">
                    {rotuloTool(t.tool)}
                  </span>
                  <span aria-hidden className="h-1.5 w-10 shrink-0 self-center overflow-hidden rounded-full bg-muted sm:w-14">
                    <span
                      className="block h-full rounded-full bg-[var(--chart-5)]"
                      style={{ width: `${Math.min(100, fr * 100)}%` }}
                    />
                  </span>
                  <span className="w-10 text-right text-xs tabular-nums">{num.format(t.chamadas)}</span>
                  <span className={cn(
                    "w-12 whitespace-nowrap text-right text-xs tabular-nums",
                    t.erroRate > 0.05 ? "font-medium text-[var(--danger-text)]" : "text-muted-foreground"
                  )}>
                    {pct(t.erroRate)}
                  </span>
                  <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{ms(t.msMedio)}</span>
                </li>
                );
              })}
              {!mt.topTools.length && (
                <li className="py-2 text-sm text-muted-foreground">Nenhuma ferramenta usada no período.</li>
              )}
            </ul>
          </Secao>

          <Secao titulo="Por pessoa">
            <div className="flex gap-x-3 border-b border-border/60 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              <span className="min-w-0 flex-1">Pessoa</span>
              <span className="w-14 text-right">Perguntas</span>
              <span className="w-16 text-right">Plano</span>
            </div>
            <ul className="divide-y divide-border/60">
              {mt.porPessoa.map((p) => {
                const fr = totalPerguntas ? p.mensagens / totalPerguntas : 0;
                return (
                <li key={p.profileId} className="flex items-baseline gap-x-3 py-2">
                  <span className="min-w-0 flex-1 break-words text-sm font-medium">
                    {nomes.get(p.profileId) ?? "Sem nome"}
                  </span>
                  <span aria-hidden className="h-1.5 w-10 shrink-0 self-center overflow-hidden rounded-full bg-muted sm:w-14">
                    <span
                      className="block h-full rounded-full bg-[var(--chart-2)]"
                      style={{ width: `${Math.min(100, fr * 100)}%` }}
                    />
                  </span>
                  <span className="w-14 text-right text-xs tabular-nums">{num.format(p.mensagens)}</span>
                  <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">{usdExato(p.allowance)}</span>
                </li>
                );
              })}
              {!mt.porPessoa.length && (
                <li className="py-2 text-sm text-muted-foreground">Sem uso no período.</li>
              )}
            </ul>
          </Secao>
        </div>

        <div className="border-t border-border pt-6">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Qualidade
          </p>
          <IaEvals modelosSugeridos={modelosCfg} />
        </div>
      </div>
    </div>
  );
}
