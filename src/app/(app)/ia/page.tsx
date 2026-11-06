import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Info } from "@phosphor-icons/react/dist/ssr";
import { getMe } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "@/lib/demo/mode";
import { demoIaEventos, DEMO_IA_NOMES } from "@/lib/demo/ia-eventos";
import { filtrarEventosIa, metricasIa, type IaEventoRow } from "@/lib/ia/metricas";
import { rotuloTool } from "@/lib/ia/fontes";
import { getPainelIa } from "@/lib/ia/queries";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Uso da Liza" };

const DIAS_OPCOES = [7, 30, 90] as const;
const CANAL_OPCOES = ["todos", "chat", "mcp"] as const;

const num = new Intl.NumberFormat("pt-BR");
// vírgula decimal pt-BR; centavo de dólar some em uso pequeno, então
// abaixo de 1 centavo mostra 4 casas
const usd = (v: number) =>
  v === 0
    ? "US$ 0"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: v >= 0.01 ? 2 : 4,
        maximumFractionDigits: v >= 0.01 ? 2 : 4,
      }).format(v);
// tokens chegam à casa do milhão: compacto ("988 mil") cabe no card de
// meia largura do celular; o valor exato fica no title
const compacto = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const ms = (v: number | null) => (v == null ? "n/d" : `${num.format(Math.round(v / 100) / 10)}s`);

const REGRAS = [
  {
    termo: "Mensagens",
    texto:
      "Cada pergunta aceita na bolha ou via MCP vira um evento 'mensagem', a reserva do limite por minuto. Pedido negado pelo limite não conta aqui.",
  },
  {
    termo: "Tokens por tipo",
    texto:
      "Entrada é o contexto enviado ao modelo (histórico + system prompt + dados das tools); saída é o texto gerado; raciocínio aparece só nos tiers com esforço; cache é a parte da entrada que o provedor reaproveitou (não cobra de novo).",
  },
  {
    termo: "Custo",
    texto:
      "Cobrança real reportada pelo provedor na resposta (usage.cost). 'No plano' é o consumo do allowance do Go; 'tabela' é o preço de list do mesmo uso, pra comparar com pagar por fora.",
  },
  {
    termo: "Modelo",
    texto:
      "O slug que de fato respondeu. Quando o primário da cadeia falha e o fallback assume, é o fallback que aparece, por isso o resumo por modelo pode diferir da configuração.",
  },
  {
    termo: "Latência",
    texto:
      "Tempo total da pergunta: rodadas do modelo + execução das tools, até o fim do stream. p95 é o limite dos 5% mais lentos; a mediana esconderia os casos ruins.",
  },
] as const;

function Chip({
  href, ativo, children,
}: { href: string; ativo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors sm:min-h-7 ${
        ativo
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
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
      <p className="mt-1 text-2xl font-semibold tracking-tight">{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
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

  const demo = await demoAtivo();
  let eventos: IaEventoRow[];
  let nomes: Map<string, string>;
  let truncado = false;
  if (demo) {
    eventos = demoIaEventos(dias);
    nomes = DEMO_IA_NOMES;
  } else {
    // me.role já foi checado acima (coordenação) — só então o cache do
    // painel entra; demo fica no ramo de cima, sem cache
    const res = await getPainelIa(await createClient(), me.role, dias);
    eventos = res.eventos as IaEventoRow[];
    truncado = res.truncado;
    nomes = res.nomes;
  }

  // filtros locais (a query já trouxe o período inteiro — canal/modelo são
  // recortes baratos sobre o mesmo conjunto). O canal filtra TODO evento e
  // o modelo casa a request inteira via request_id — filtrar e.modelo
  // direto mostrava as mensagens de todos os modelos e escondia as tools.
  const filtrados = filtrarEventosIa(eventos, canal, modelo);
  const mt = metricasIa(filtrados, dias);
  // chips de modelo derivam do recorte POR CANAL (não por modelo — o chip
  // é a opção do próprio filtro): sob ?canal=mcp some tudo, já que evento
  // resposta/modelo só existe no chat. O modelo da URL entra na fileira
  // mesmo fora do recorte: sem o chip ativo o filtro não mostra o que tá
  // filtrando nem dá o "Todos" pra desfazer.
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

  const maxSerie = Math.max(1, ...mt.serie.map((p) => p.mensagens));

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Dados"
        title="Uso da Liza"
        meta="Auditoria de cada mensagem: quem perguntou, que modelo respondeu, quantos tokens e quanto custou"
        actions={
          <Popover>
            <PopoverTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "text-xs font-semibold text-foreground/80"
              )}
            >
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
        }
      />

      {/* filtros deep-linkáveis — período, canal e modelo são parâmetros de
          URL (compartilhável e preserva no voltar) */}
      {/* cada grupo (rótulo + chips) quebra inteiro: o rótulo nunca fica
          órfão no fim de uma linha com os chips na seguinte */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Período</span>
        {DIAS_OPCOES.map((d) => (
          <Chip key={d} href={params({ dias: d, canal, modelo })} ativo={dias === d}>
            {d}d
          </Chip>
        ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Canal</span>
        {CANAL_OPCOES.map((c) => (
          <Chip key={c} href={params({ dias, canal: c, modelo })} ativo={canal === c}>
            {c === "todos" ? "Todos" : c === "chat" ? "Bolha" : "MCP"}
          </Chip>
        ))}
        {/* a fileira fica no ar com filtro ativo mesmo com 0/1 modelo no
            recorte — é o jeito de desfazer o ?modelo= */}
        </div>
        {(modelosChips.length > 1 || modelo != null) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Modelo</span>
            <Chip href={params({ dias, canal, modelo: null })} ativo={!modelo}>
              Todos
            </Chip>
            {modelosChips.map((m) => (
              <Chip key={m} href={params({ dias, canal, modelo: m })} ativo={modelo === m}>
                {m}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {truncado && (
        <p className="text-xs text-muted-foreground">
          Mostrando só os eventos mais recentes deste período.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi rotulo="Mensagens" valor={num.format(mt.mensagens)} detalhe={`${mt.respostasOk} respostas ok`} />
        <Kpi
          rotulo="Tokens (entra / sai)"
          valor={
            <span title={`${num.format(mt.tokensIn)} / ${num.format(mt.tokensOut)}`}>
              {/* cada metade inteira; no card estreito "/ saída" desce de linha */}
              <span className="whitespace-nowrap">{compacto.format(mt.tokensIn)}</span>{" "}
              <span className="whitespace-nowrap">/ {compacto.format(mt.tokensOut)}</span>
            </span>
          }
          detalhe={mt.tokensReasoning ? `+${num.format(mt.tokensReasoning)} de raciocínio` : `${num.format(mt.cacheRead)} de cache`}
        />
        <Kpi
          rotulo="Custo no período"
          valor={usd(mt.custoUsd)}
          detalhe={mt.allowanceUsd ? `${usd(mt.allowanceUsd)} no plano · ${usd(mt.listCostUsd)} tabela` : undefined}
        />
        <Kpi rotulo="Latência média" valor={ms(mt.msMedio)} detalhe={`p95 ${ms(mt.msP95)}`} />
        <Kpi
          rotulo="Erro"
          valor={`${Math.round(mt.erroRate * 100)}%`}
          detalhe={`${mt.respostas - mt.respostasOk} de ${mt.respostas} respostas`}
        />
        <Kpi
          rotulo="Iterações"
          valor={mt.iterMedia == null ? "n/d" : num.format(mt.iterMedia)}
          detalhe="rodadas modelo+tool por resposta"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Secao titulo="Por modelo">
          <ul className="divide-y divide-border/60">
            {mt.porModelo.map((m) => (
              // no celular o nome ocupa a linha e as métricas descem —
              // título de item não trunca (convenção da casa)
              <li key={m.modelo} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
                <span className="w-full min-w-0 break-words text-sm font-medium sm:w-auto sm:flex-1">
                  {m.modelo}
                </span>
                <span className="w-14 text-xs text-muted-foreground sm:w-auto">{num.format(m.respostas)} resp</span>
                <span className="w-20 text-right text-xs text-muted-foreground">
                  {num.format(m.tokensOut)} tok
                </span>
                <span className="w-16 text-right text-xs text-muted-foreground">{usd(m.custo)}</span>
                <span className="w-12 text-right text-xs text-muted-foreground">{ms(m.msMedio)}</span>
              </li>
            ))}
            {!mt.porModelo.length && (
              <li className="py-2 text-sm text-muted-foreground">Sem respostas no período.</li>
            )}
          </ul>
        </Secao>

        <Secao titulo="Série diária de mensagens">
          {/* gap encolhe em períodos longos: com gap-1 as 90 barras de
              90d viravam fios de ~1px numa trama ilegível no mobile */}
          <div className={cn("flex h-28 items-end", dias >= 45 ? "gap-px" : "gap-1")} role="img"
            aria-label={`Mensagens por dia nos últimos ${dias} dias`}>
            {mt.serie.map((p) => (
              <div
                key={p.dia}
                className="group relative min-w-0 flex-1 rounded-t bg-primary/70 transition-colors hover:bg-primary"
                style={{ height: `${Math.max(3, (p.mensagens / maxSerie) * 100)}%` }}
                title={`${p.dia.split("-").reverse().join("/")}: ${p.mensagens} mensagens`}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>{mt.serie[0]?.dia.split("-").reverse().slice(0, 2).join("/")}</span>
            <span>hoje</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {mt.porTier.map((t) => (
              <span key={t.tier}>
                tier {t.tier === "rapido" ? "rápido" : t.tier}: <span className="font-medium text-foreground">{t.respostas}</span>
              </span>
            ))}
            {mt.porCanal.map((c) => (
              <span key={c.canal}>
                {c.canal === "chat" ? "bolha" : c.canal}: <span className="font-medium text-foreground">{c.mensagens}</span>
              </span>
            ))}
          </div>
        </Secao>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Secao titulo="Ferramentas mais usadas">
          <ul className="divide-y divide-border/60">
            {mt.topTools.map((t) => (
              <li key={t.tool} className="flex items-baseline gap-3 py-2">
                <span className="min-w-0 flex-1 break-words text-sm font-medium">
                  {rotuloTool(t.tool)}
                </span>
                <span className="text-xs text-muted-foreground">{t.chamadas}×</span>
                <span className={`w-16 whitespace-nowrap text-right text-xs ${t.erroRate > 0.05 ? "font-medium text-danger" : "text-muted-foreground"}`}>
                  {Math.round(t.erroRate * 100)}% erro
                </span>
                <span className="w-12 text-right text-xs text-muted-foreground">{ms(t.msMedio)}</span>
              </li>
            ))}
            {!mt.topTools.length && (
              <li className="py-2 text-sm text-muted-foreground">Nenhuma ferramenta usada no período.</li>
            )}
          </ul>
        </Secao>

        <Secao titulo="Por pessoa">
          <ul className="divide-y divide-border/60">
            {mt.porPessoa.map((p) => (
              <li key={p.profileId} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
                <span className="w-full min-w-0 break-words text-sm font-medium sm:w-auto sm:flex-1">
                  {nomes.get(p.profileId) ?? "Sem nome"}
                </span>
                <span className="w-14 text-xs text-muted-foreground sm:w-auto">{p.mensagens} msg</span>
                <span className="w-20 text-right text-xs text-muted-foreground">
                  {num.format(p.tokensOut)} tok
                </span>
                <span className="w-16 text-right text-xs text-muted-foreground">{usd(p.custo)}</span>
              </li>
            ))}
            {!mt.porPessoa.length && (
              <li className="py-2 text-sm text-muted-foreground">Sem uso no período.</li>
            )}
          </ul>
        </Secao>
      </div>
    </div>
  );
}
