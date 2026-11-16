import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { FilterChipRow } from "@/components/ui/filter-chip";
import { formatDate, tempoRelativo } from "@/lib/ciclo";
import {
  JANELA_DEFAULT,
  JANELAS,
  PAPEIS_ADOCAO,
  ROTULO_PAPEL,
  ROTULO_SUPERFICIE,
  SUPERFICIES,
  coorteParaGrade,
  deltaPct,
  matrizParaGrade,
  type Caminho,
  type CelulaMatriz,
  type DiaSerie,
  type EventoRecente,
  type Janela,
  type LinhaCoorte,
  type LinhaSuperficie,
  type MedidaAdocao,
  type ResumoAdocao,
} from "@/lib/adocao";
import {
  FUNIL_JANELA_DIAS,
  dadosAdocaoCaminhos,
  dadosAdocaoCaminhosDemo,
  dadosAdocaoCoorte,
  dadosAdocaoCoorteDemo,
  dadosAdocaoMatriz,
  dadosAdocaoMatrizDemo,
  dadosAdocaoRecentes,
  dadosAdocaoRecentesDemo,
  dadosAdocaoResumo,
  dadosAdocaoResumoDemo,
  dadosAdocaoSerieDia,
  dadosAdocaoSerieDiaDemo,
  dadosAdocaoSuperficies,
  dadosAdocaoSuperficiesDemo,
  dadosFunilInstrumentos,
  dadosFunilInstrumentosDemo,
  type FunilInstrumento,
} from "@/lib/relatorios/adocao";
import type { DemoData } from "@/lib/demo/data";
import {
  CaminhosFluxo,
  CoorteGrade,
  FunilEtapas,
  GraficoTempo,
  MapaCalor,
  MetricTile,
  Sparkline,
  type PontoGrafico,
} from "@/components/viz";
import { GestosVivos } from "./gestos-vivos";

// Aba Adoção (REALIZA-417 fase 2): a 8ª do workbench, na anatomia do
// design.md — régua própria (janela × papel × medida, chips-link como o
// RecorteTurma), L1 = os 4 KPIs (hero = Pessoas ativas), L2 = mapa de
// calor e as formas (série diária, funil de instrumentos, coorte,
// caminhos), L3 = a tabela de superfícies e o feed vivo. Evento não tem
// turma: a régua de turma do workbench não aparece aqui — os params
// legados só atravessam os chips como passageiros (extraParams).

const FMT_INT = new Intl.NumberFormat("pt-BR");
const FMT_COMPACTO = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const FMT_MES_ANO = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

const SEMANAS_COORTE = 10;
const TOP_CAMINHOS = 8;
const MAX_RECENTES = 30;

const CARD = "rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5";

const ORDEM_PAPEL = new Map(PAPEIS_ADOCAO.map((p, i) => [p.id, i]));
const ordenaPapeis = (ids: string[]) =>
  [...ids].sort(
    (a, b) => (ORDEM_PAPEL.get(a) ?? 99) - (ORDEM_PAPEL.get(b) ?? 99)
  );

type Supa = SupabaseClient;

export async function SecaoAdocao({
  d,
  supabase,
  janela,
  papel,
  medida,
  extraParams,
}: {
  /** dataset demo — truthy = modo demo (os gêmeos não tocam supabase) */
  d: DemoData | null;
  supabase: Supa | null;
  janela: Janela;
  papel: string | null;
  medida: MedidaAdocao;
  /** turma/cronograma legados — inertes pra adoção, preservados nos chips */
  extraParams?: string;
}) {
  // relógio único do painel: o `desde` das queries e os "há N min" da
  // tabela nascem do mesmo agora — sem drift entre blocos
  const agora = new Date().getTime();
  const desde = new Date(agora - janela * 86400000);

  let resumo: ResumoAdocao;
  // a matriz desce SEMPRE sem o papel: a régua precisa ver quais papéis
  // têm evento (senão a seleção ativa ficaria cega) e o recorte do mapa
  // é o mesmo filtro que a RPC faria, feito em memória — uma ida a menos.
  // Série e superfícies têm agregação por papel no SQL (dedupe, último),
  // então essas vão filtradas de fábrica.
  let celulas: CelulaMatriz[];
  let serie: DiaSerie[];
  let linhasSup: LinhaSuperficie[];
  let linhasCoorte: LinhaCoorte[];
  let caminhos: Caminho[];
  let funil: FunilInstrumento[];
  let recentes: EventoRecente[];

  if (d) {
    resumo = dadosAdocaoResumoDemo(d, janela, papel);
    celulas = dadosAdocaoMatrizDemo(d);
    const serieDemo = dadosAdocaoSerieDiaDemo(d, janela);
    serie = papel ? serieDemo.filter((s) => s.papel === papel) : serieDemo;
    linhasSup = linhasSuperficieDemo(d, papel, agora);
    linhasCoorte = dadosAdocaoCoorteDemo(SEMANAS_COORTE);
    caminhos = dadosAdocaoCaminhosDemo(papel);
    funil = dadosFunilInstrumentosDemo();
    recentes = dadosAdocaoRecentesDemo();
  } else {
    [resumo, celulas, serie, linhasSup, linhasCoorte, caminhos, funil, recentes] =
      await Promise.all([
        dadosAdocaoResumo(supabase!, desde, papel),
        dadosAdocaoMatriz(supabase!, desde, null),
        dadosAdocaoSerieDia(supabase!, desde, papel),
        dadosAdocaoSuperficies(supabase!, desde, papel),
        dadosAdocaoCoorte(supabase!, SEMANAS_COORTE),
        dadosAdocaoCaminhos(supabase!, desde, TOP_CAMINHOS, papel),
        dadosFunilInstrumentos(supabase!, desde),
        dadosAdocaoRecentes(supabase!, MAX_RECENTES),
      ]);
  }

  const celulasRecorte = papel
    ? celulas.filter((c) => c.papel === papel)
    : celulas;
  const grade = matrizParaGrade(celulasRecorte, medida);

  // papéis do chip: os presentes nos dados + o ativo — papel válido sem
  // evento na janela some da matriz mas não pode sumir da régua (senão a
  // seleção ficaria invisível e sem saída)
  const papeisChips = PAPEIS_ADOCAO.filter(
    (p) => p.id === papel || celulas.some((c) => c.papel === p.id)
  );

  // "vivas" deriva da MESMA matriz que o mapa exibe: com recorte de papel
  // conta as superfícies daquele papel — resumo.sups_vivas é programa
  // inteiro e brigaría com o mapa filtrado logo abaixo
  const usadas = new Set(
    celulasRecorte
      .filter((c) => c.pessoas > 0 || c.gestos > 0)
      .map((c) => c.superficie)
  );
  const vivas = SUPERFICIES.filter((s) => usadas.has(s.id)).length;
  const paradas = SUPERFICIES.filter((s) => !usadas.has(s.id)).map(
    (s) => s.rotulo
  );

  // o KPI divide por instrumento com denominador real — campanhas
  // (multi_uso) somam emitidos=respondidos e inflariam os dois lados
  // igualmente: o % delas não informa nada e puxa a taxa pra 100%
  const emitidos = funil
    .filter((f) => !f.campanha)
    .reduce((s, f) => s + f.emitidos, 0);
  const respondidos = funil
    .filter((f) => !f.campanha)
    .reduce((s, f) => s + f.respondidos, 0);

  const secaoInstrumentos = (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Instrumentos</h2>
        <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
          Emitidos no período e o destino de cada um: resposta em até{" "}
          {FUNIL_JANELA_DIAS} dias, expirado ou aguardando.
        </p>
      </div>
      <div className={CARD}>
        <FunilEtapas
          instrumentos={funil}
          janelaDias={FUNIL_JANELA_DIAS}
          animate
          i={5}
        />
      </div>
    </section>
  );

  const secaoRecentes = (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Gestos recentes</h2>
        <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
          Os últimos gestos coletados, com os novos chegando em tempo
          real{papel ? " · todos os papéis" : ""}.
        </p>
      </div>
      <div className={CARD}>
        <GestosVivos inicial={recentes} />
      </div>
    </section>
  );

  // janela sem nenhum evento (matriz cheia vazia): estado "acumulando"
  // da AbaSaude — o card explica e a régua segue disponível. O que não
  // depende de produto_eventos (funil sai das tabelas de instrumento)
  // continua aparecendo quando tem dado.
  if (resumo.ativas === 0 && celulas.length === 0) {
    return (
      <div className="space-y-5">
        <RecorteAdocao
          janela={janela}
          papel={papel}
          medida={medida}
          papeis={papeisChips}
          extraParams={extraParams}
        />
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Quem usa o quê</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
              Pessoas únicas por superfície e papel, caminhos e retorno.
            </p>
          </div>
          <div className="rounded-xl bg-card px-4 py-6 shadow-[var(--shadow-border)]">
            <p className="text-sm font-medium">Acumulando histórico</p>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {resumo.coletando_desde
                ? `A coleta de gestos começou em ${FMT_MES_ANO.format(new Date(resumo.coletando_desde))} e esta aba enche conforme o uso.`
                : "A coleta de gestos começou agora e esta aba enche conforme o uso."}{" "}
              Nenhum gesto foi registrado neste período ainda.
            </p>
          </div>
        </section>
        {emitidos > 0 && secaoInstrumentos}
        {recentes.length > 0 && secaoRecentes}
      </div>
    );
  }

  // um slot por dia da janela — dia sem evento é zero (existe e ninguém
  // usou), não buraco: a barra simplesmente não sobe
  const gestosDia = new Map<string, number>();
  for (const s of serie)
    gestosDia.set(s.dia, (gestosDia.get(s.dia) ?? 0) + s.gestos);
  const hoje = new Date(agora);
  const pontos: PontoGrafico[] = Array.from({ length: janela }, (_, i) => {
    const dt = new Date(hoje.getTime() - (janela - 1 - i) * 86400000);
    const chave = dt.toISOString().slice(0, 10);
    const v = gestosDia.get(chave) ?? 0;
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    return {
      chave,
      rotuloEixo: `${dd}/${mm}`,
      rotulo: formatDate(chave),
      valor: v,
      valorFmt: v === 1 ? "1 gesto" : `${FMT_INT.format(v)} gestos`,
    };
  });
  // a média vem dos slots (mesma agregação da série) — resumo.gestos
  // respeita o mesmo recorte de papel desde a 0198, mas o slot diário
  // é a conta que o gráfico mostra
  const media = pontos.reduce((s, p) => s + (p.valor ?? 0), 0) / janela;
  const maxDia = Math.max(0, ...pontos.map((p) => p.valor ?? 0));
  const pico = maxDia > 0 ? pontos.findIndex((p) => p.valor === maxDia) : null;

  const rotuloPapel = papel ? (ROTULO_PAPEL.get(papel) ?? papel) : null;
  const ariaSerie =
    `Gestos por dia nos últimos ${janela} dias` +
    (rotuloPapel ? `, só ${rotuloPapel}` : "") +
    `. Média de ${FMT_INT.format(Math.round(media))} gestos por dia` +
    (pico != null
      ? `; pico de ${FMT_INT.format(maxDia)} em ${formatDate(pontos[pico]!.chave)}.`
      : ".");

  const gradeCoorte = coorteParaGrade(linhasCoorte, SEMANAS_COORTE);

  const notaVivas =
    paradas.length === 0
      ? "nenhuma parada no período"
      : `Paradas: ${paradas.slice(0, 4).join(", ")}` +
        (paradas.length > 4 ? ` e mais ${paradas.length - 4}` : "");

  return (
    <div className="space-y-5">
      <RecorteAdocao
        janela={janela}
        papel={papel}
        medida={medida}
        papeis={papeisChips}
        extraParams={extraParams}
      />

      {/* L1 — os quatro números de relance; o hero é quem usa */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Panorama</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            Os números de relance dos últimos {janela} dias: quem usa,
            quanto usa e quanto responde.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            rotulo="Pessoas ativas"
            valor={FMT_INT.format(resumo.ativas)}
            delta={deltaPct(resumo.ativas, resumo.ativas_prev)}
            deltaRotulo={`vs. os ${janela} dias anteriores`}
            deltaBom="sobe"
            destaque
            animate
            i={0}
            className={CARD}
          />
          <MetricTile
            rotulo="Gestos por dia"
            valor={FMT_COMPACTO.format(
              Math.round(resumo.gestos / janela)
            )}
            // média por dia nos dois lados — janelas do mesmo tamanho, a
            // fração sai igual direto do total
            delta={deltaPct(resumo.gestos, resumo.gestos_prev)}
            deltaRotulo={`vs. os ${janela} dias anteriores`}
            deltaBom="neutro"
            nota={`${FMT_INT.format(resumo.gestos)} gestos no período`}
            animate
            i={1}
            className={CARD}
          />
          <MetricTile
            rotulo="Superfícies vivas"
            valor={`${vivas} de ${SUPERFICIES.length}`}
            delta={null}
            deltaRotulo=""
            deltaVazio="sem dado do período anterior"
            nota={notaVivas}
            animate
            i={2}
            className={CARD}
          />
          <MetricTile
            rotulo="Taxa de resposta"
            valor={
              emitidos > 0
                ? `${Math.round((respondidos / emitidos) * 100)}%`
                : "—"
            }
            delta={null}
            deltaRotulo=""
            deltaVazio="sem dado do período anterior"
            nota={
              emitidos > 0
                ? `${FMT_INT.format(respondidos)} de ${FMT_INT.format(emitidos)} respondidos em até ${FUNIL_JANELA_DIAS} dias${papel ? " · todos os papéis" : ""}`
                : "sem instrumentos no período"
            }
            animate
            i={3}
            className={CARD}
          />
        </div>
      </section>

      {/* L2 — o herói: superfície × papel */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Quem usa o quê</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            {medida === "pessoas" ? "Pessoas únicas" : "Gestos"} por
            superfície e papel nos últimos {janela} dias.
          </p>
        </div>
        <div className={CARD}>
          <MapaCalor
            grade={grade}
            medida={medida}
            medidaRotulo={
              medida === "pessoas" ? "pessoas únicas" : "gestos"
            }
            contexto={`nos últimos ${janela} dias`}
            animate
            i={4}
          />
        </div>
      </section>

      {/* L2 — formas: ritmo diário e destino dos instrumentos */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Gestos por dia</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
              Total de gestos por dia no período
              {rotuloPapel ? ` · só ${rotuloPapel}` : ""}.
            </p>
          </div>
          <div className={CARD}>
            <GraficoTempo
              pontos={pontos}
              tipo="barras"
              formato="inteiro"
              media={media}
              pico={pico}
              ariaLabel={ariaSerie}
              rotuloTempo="Dia"
              rotuloValor="Gestos"
            />
          </div>
        </section>
        {secaoInstrumentos}
      </div>

      {/* L2 — o uso fica? coorte de retorno e jornada */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Retorno por coorte</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
              % de pessoas ativas por semana após o primeiro uso, por
              semana de entrada. Programa inteiro: retenção é por
              pessoa, não por papel.
            </p>
          </div>
          <div className={CARD}>
            <CoorteGrade grade={gradeCoorte} animate i={6} />
          </div>
        </section>
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">
              Caminhos mais percorridos
            </h2>
            <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
              As sequências de superfícies mais percorridas no período
              {rotuloPapel ? ` · só ${rotuloPapel}` : ""}.
            </p>
          </div>
          <div className={CARD}>
            <CaminhosFluxo caminhos={caminhos} animate i={7} />
          </div>
        </section>
      </div>

      {/* L3 — a lista de trabalho: melhorar, matar ou ensinar */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Superfícies</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            Gestos, alcance por papel e último uso de cada superfície na
            janela.
          </p>
        </div>
        <div className={CARD}>
          <div
            role="region"
            aria-label="Uso por superfície. Role horizontalmente"
            tabIndex={0}
            className="scroll-fina overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th scope="col" className="py-1 pr-3 font-medium">
                    superfície
                  </th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">
                    gestos
                  </th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">
                    pessoas
                  </th>
                  <th scope="col" className="px-2 py-1 font-medium">
                    papéis
                  </th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">
                    tendência
                  </th>
                  <th scope="col" className="py-1 pl-2 text-right font-medium">
                    último uso
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...linhasSup]
                  .sort((a, b) => b.pessoas - a.pessoas)
                  .map((l) => {
                    const valores = tendenciaParaSerie(l.tendencia, janela, agora);
                    return (
                    <tr key={l.superficie} className="border-t border-border/50">
                      <td className="py-1.5 pr-3 font-medium whitespace-nowrap">
                        {ROTULO_SUPERFICIE.get(l.superficie) ?? l.superficie}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {FMT_INT.format(l.gestos)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {FMT_INT.format(l.pessoas)}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="flex flex-wrap gap-1">
                          {ordenaPapeis(l.papeis).map((p) => (
                            <span
                              key={p}
                              className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
                            >
                              {ROTULO_PAPEL.get(p) ?? p}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td className="w-24 px-2 py-1.5">
                        {valores && (
                          <Sparkline
                            series={[
                              {
                                valores,
                                rotulo: `gestos por dia em ${ROTULO_SUPERFICIE.get(l.superficie) ?? l.superficie}`,
                              },
                            ]}
                            min={0}
                            max={Math.max(1, ...valores.map((v) => v ?? 0))}
                            eixo={false}
                            altura={28}
                            ariaLabel={`tendência diária de gestos em ${ROTULO_SUPERFICIE.get(l.superficie) ?? l.superficie}: ${valores.map((v) => v ?? 0).join(", ")}`}
                          />
                        )}
                      </td>
                      <td className="py-1.5 pl-2 text-right text-muted-foreground whitespace-nowrap">
                        {tempoRelativo(l.ultimo, agora)}
                      </td>
                    </tr>
                    );
                  })}
              </tbody>
            </table>
            {linhasSup.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma superfície com uso neste recorte.
              </p>
            )}
          </div>
        </div>
      </section>

      {secaoRecentes}
    </div>
  );
}

/** Régua da aba — janela × papel × medida em chips-link (deep-linkável,
 *  página segue server; mesmo padrão do RecorteTurma). Cada chip troca um
 *  grupo e preserva os outros dois + os params legados de turma; default
 *  não vai pra URL ("30 dias" ≡ sem ?janela=). */
function RecorteAdocao({
  janela,
  papel,
  medida,
  papeis,
  extraParams,
}: {
  janela: Janela;
  papel: string | null;
  medida: MedidaAdocao;
  /** papéis com evento na janela + o ativo — na ordem PAPEIS_ADOCAO */
  papeis: { id: string; rotulo: string }[];
  extraParams?: string;
}) {
  const href = (mudanca: {
    janela?: Janela;
    papel?: string | null;
    medida?: MedidaAdocao;
  }) => {
    const j = mudanca.janela !== undefined ? mudanca.janela : janela;
    const p = mudanca.papel !== undefined ? mudanca.papel : papel;
    const m = mudanca.medida !== undefined ? mudanca.medida : medida;
    const q = new URLSearchParams({ aba: "adocao" });
    if (j !== JANELA_DEFAULT) q.set("janela", String(j));
    if (p) q.set("papel", p);
    if (m !== "pessoas") q.set("medida", m);
    return `/relatorios/operacionais?${q}${extraParams ? `&${extraParams}` : ""}`;
  };
  const chip = (rotulo: string, destino: string, on: boolean) => (
    <Link
      key={rotulo}
      href={destino}
      scroll={false}
      aria-current={on ? "true" : undefined}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on
          ? "border-[var(--brand-lime)] bg-[var(--brand-lime)]/15 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {rotulo}
    </Link>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <FilterChipRow role="group" aria-label="Janela" className="gap-1.5">
        {JANELAS.map((j) =>
          chip(`${j} dias`, href({ janela: j }), j === janela)
        )}
      </FilterChipRow>
      <FilterChipRow role="group" aria-label="Papel" className="gap-1.5">
        {chip("Todos os papéis", href({ papel: null }), !papel)}
        {papeis.map((p) =>
          chip(p.rotulo, href({ papel: p.id }), papel === p.id)
        )}
      </FilterChipRow>
      <FilterChipRow
        role="group"
        aria-label="Medida do mapa de calor"
        className="gap-1.5"
      >
        {chip(
          "Pessoas únicas",
          href({ medida: "pessoas" }),
          medida === "pessoas"
        )}
        {chip("Gestos", href({ medida: "gestos" }), medida === "gestos")}
      </FilterChipRow>
    </div>
  );
}

/** Gêmeo demo de adocao_superficies com papel: o fetcher demo agrega
 *  todos os papéis de uma vez — refiltrar e reagrupar a partir da matriz
 *  (célula = superfície × papel) é a mesma conta que a RPC faria. O
 *  `ultimo` e a `tendencia` vêm da lista cheia (escalada pelo peso do
 *  recorte); ordena por pessoas como o original. */
function linhasSuperficieDemo(
  d: DemoData,
  papel: string | null,
  agora: number
): LinhaSuperficie[] {
  const completas = dadosAdocaoSuperficiesDemo(d);
  if (!papel) return completas;
  const completa = new Map(completas.map((l) => [l.superficie, l]));
  const porSup = new Map<string, LinhaSuperficie>();
  for (const c of dadosAdocaoMatrizDemo(d)) {
    if (c.papel !== papel) continue;
    const cheia = completa.get(c.superficie);
    const l = porSup.get(c.superficie) ?? {
      superficie: c.superficie,
      gestos: 0,
      pessoas: 0,
      papeis: [] as string[],
      ultimo: cheia?.ultimo ?? new Date(agora).toISOString(),
      tendencia: cheia?.tendencia ?? null,
    };
    l.gestos += c.gestos;
    l.pessoas += c.pessoas;
    if (!l.papeis.includes(c.papel)) l.papeis.push(c.papel);
    porSup.set(c.superficie, l);
  }
  // a tendência cheia soma todos os papéis — escala pela fatia do
  // recorte pra spark não mentir a magnitude sob filtro
  for (const l of porSup.values()) {
    const cheia = completa.get(l.superficie);
    if (!l.tendencia || !cheia || cheia.gestos <= 0) continue;
    const fator = l.gestos / cheia.gestos;
    l.tendencia = l.tendencia.map((t) => ({
      d: t.d,
      g: Math.round(t.g * fator),
    }));
  }
  return [...porSup.values()].sort((a, b) => b.pessoas - a.pessoas);
}

/** Série diária esparsa da RPC → slots da janela pro Sparkline (dia sem
 *  gesto = 0: a linha assenta no chão, não é buraco — a superfície
 *  existe e ninguém usou). null quando a superfície não tem série. */
function tendenciaParaSerie(
  tendencia: { d: string; g: number }[] | null | undefined,
  janela: number,
  agora: number
): (number | null)[] | null {
  if (!tendencia?.length) return null;
  const porDia = new Map(tendencia.map((t) => [t.d, t.g]));
  return Array.from({ length: janela }, (_, i) => {
    const dt = new Date(agora - (janela - 1 - i) * 86400000);
    return porDia.get(dt.toISOString().slice(0, 10)) ?? 0;
  });
}
