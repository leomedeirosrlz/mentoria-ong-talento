import Link from "next/link";
import type { CSSProperties } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { filterChipCls, FilterChipRow } from "@/components/ui/filter-chip";
import { formatDate } from "@/lib/ciclo";
import {
  JANELA_DEFAULT,
  JANELAS,
  PAPEIS_ADOCAO,
  ROTULO_PAPEL,
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
  MetricTile,
  type PontoGrafico,
} from "@/components/viz";
import { GestosVivos } from "./gestos-vivos";
import { AdocaoExplorador } from "./adocao-explorador";
import { MapaCalorDrill } from "./adocao-interativo";
import { TabelaSuperficies } from "./tabela-superficies";

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
const MAX_RECENTES = 12;

const CARD = "rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5";

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
    celulas = dadosAdocaoMatrizDemo(d, janela);
    const serieDemo = dadosAdocaoSerieDiaDemo(d, janela);
    serie = papel ? serieDemo.filter((s) => s.papel === papel) : serieDemo;
    linhasSup = linhasSuperficieDemo(d, papel, janela, agora);
    linhasCoorte = dadosAdocaoCoorteDemo(SEMANAS_COORTE);
    caminhos = dadosAdocaoCaminhosDemo(papel, janela);
    funil = dadosFunilInstrumentosDemo();
    recentes = dadosAdocaoRecentesDemo(janela);
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
    <section className="min-w-0 space-y-3">
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
          i={6}
        />
      </div>
    </section>
  );

  const secaoRecentes = (
    <section className="min-w-0 space-y-3">
      <div>
        <h2 className="text-base font-semibold">Gestos recentes</h2>
        <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
          Os últimos gestos coletados, com os novos chegando em tempo
          real{papel ? " · todos os papéis" : ""}.
        </p>
      </div>
      {/* GestosVivos não tem animate próprio — a entrada mora no card */}
      <div
        className={cn(CARD, "animate-enter")}
        style={{ "--i": 10 } as CSSProperties}
      >
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
        {/* re-key do recorte: remontar os blocos re-roda o animate-enter
            de cada card — a convenção pede animação em toda troca de
            filtro, nunca repaint seco */}
        <div key={`${janela}-${papel}-${medida}`} className="space-y-5">
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
      </div>
    );
  }

  // um slot por dia da janela — dia sem evento é zero (existe e ninguém
  // usou), não buraco: a barra simplesmente não sobe
  const gestosDia = new Map<string, number>();
  const ativasDia = new Map<string, number>();
  for (const s of serie) {
    gestosDia.set(s.dia, (gestosDia.get(s.dia) ?? 0) + s.gestos);
    ativasDia.set(s.dia, (ativasDia.get(s.dia) ?? 0) + s.pessoas);
  }
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
  // spark do herói: ativas por dia nos mesmos slots do gráfico. A soma
  // por papel pode inflar um dia (uma pessoa em dois papéis conta 2×) —
  // pro formato da janela, que é o que o spark mostra, serve; o número
  // oficial é o resumo.ativas ao lado
  const sparkAtivas = pontos.map((p) => ativasDia.get(p.chave) ?? 0);
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

      {/* re-key do recorte: remontar os blocos re-roda o animate-enter
          + --i de cada card — a convenção pede animação em toda troca de
          filtro, nunca repaint seco de página inteira */}
      <div key={`${janela}-${papel}-${medida}`} className="space-y-5">
        {/* L1 — os quatro números de relance; o hero é quem usa */}
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Panorama</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
              Os números de relance dos últimos {janela} dias: quem usa,
              quanto usa e quanto responde.
            </p>
          </div>
          {/* 2 colunas já na base: uma coluna só empilhava 4 tiles de
              ~155px antes do mapa no celular; o herói fica full-width */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricTile
              rotulo="Pessoas ativas"
              valor={FMT_INT.format(resumo.ativas)}
              delta={deltaPct(resumo.ativas, resumo.ativas_prev)}
              deltaRotulo={`vs. os ${janela} dias anteriores`}
              deltaBom="sobe"
              destaque
              spark={sparkAtivas}
              animate
              i={0}
              className={cn(CARD, "col-span-2 lg:col-span-1")}
            />
            <MetricTile
              rotulo="Gestos por dia"
              valor={FMT_COMPACTO.format(
                Math.round(resumo.gestos / janela)
              )}
              // média por dia nos dois lados — janelas do mesmo tamanho,
              // a fração sai igual direto do total
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
              superfície e papel nos últimos {janela} dias
              {rotuloPapel ? ` · só ${rotuloPapel}` : ""}.
            </p>
          </div>
          <div className={CARD}>
            <MapaCalorDrill
              grade={grade}
              medida={medida}
              medidaRotulo={
                medida === "pessoas" ? "pessoas únicas" : "gestos"
              }
              contexto={`nos últimos ${janela} dias`}
              papelAtivo={papel}
              animate
              i={4}
            />
          </div>
        </section>

        {/* L2 — formas: ritmo diário e destino dos instrumentos.
            grid-cols-1 explícito + min-w-0 nos filhos: sem eles o
            min-width de conteúdo (tabela, mapa) empurrava a página pra
            fora da viewport no mobile — medido: 586px num viewport de
            390 */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="min-w-0 space-y-3">
            <div>
              <h2 className="text-base font-semibold">Gestos por dia</h2>
              <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
                Total de gestos por dia no período
                {rotuloPapel ? ` · só ${rotuloPapel}` : ""}.
              </p>
            </div>
            {/* GraficoTempo não aceita animate — a entrada mora no card */}
            <div
              className={cn(CARD, "animate-enter")}
              style={{ "--i": 5 } as CSSProperties}
            >
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
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="min-w-0 space-y-3">
            <div>
              <h2 className="text-base font-semibold">
                Retorno por coorte
              </h2>
              <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
                % de pessoas ativas por semana após o primeiro uso, por
                semana de entrada. Programa inteiro: retenção é por
                pessoa, não por papel.
              </p>
            </div>
            <div className={CARD}>
              <CoorteGrade grade={gradeCoorte} animate i={7} />
            </div>
          </section>
          <section className="min-w-0 space-y-3">
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
              <CaminhosFluxo caminhos={caminhos} animate i={8} />
            </div>
          </section>
        </div>

        {/* L3 — a lista de trabalho: melhorar, matar ou ensinar */}
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Superfícies</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
              Gestos, alcance por papel e último uso de cada superfície
              nos últimos {janela} dias
              {rotuloPapel ? ` · só ${rotuloPapel}` : ""}.
            </p>
          </div>
          {/* ordenação/links são interativos — a tabela mora no boundary
              client próprio; a entrada fica aqui no card */}
          <div
            className={cn(CARD, "animate-enter")}
            style={{ "--i": 9 } as CSSProperties}
          >
            <TabelaSuperficies
              linhas={linhasSup}
              janela={janela}
              agora={agora}
            />
          </div>
        </section>

        {secaoRecentes}

        {/* fase B — explorador ad-hoc: o fechado é só um convite; abrir
            baixa o motor DuckDB-WASM no navegador e registra o parquet
            do /api/adocao/export na mesma janela da régua */}
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Explorar os dados</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
              Perguntas fora do script: SQL livre sobre os gestos dos
              últimos {janela} dias, no navegador.
            </p>
          </div>
          <div
            className={cn(CARD, "animate-enter")}
            style={{ "--i": 11 } as CSSProperties}
          >
            <AdocaoExplorador desde={desde.toISOString().slice(0, 10)} />
          </div>
        </section>
      </div>
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
      className={filterChipCls(on)}
    >
      {rotulo}
    </Link>
  );
  const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground";
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-3">
      <div className="min-w-0 space-y-1.5">
        <p className={eyebrow}>período</p>
        <FilterChipRow role="group" aria-label="Período" className="gap-1.5">
          {JANELAS.map((j) =>
            chip(`${j} dias`, href({ janela: j }), j === janela)
          )}
        </FilterChipRow>
      </div>
      <div className="min-w-0 space-y-1.5">
        <p className={eyebrow}>papel</p>
        <FilterChipRow role="group" aria-label="Papel" className="gap-1.5">
          {chip("Todos os papéis", href({ papel: null }), !papel)}
          {papeis.map((p) =>
            chip(p.rotulo, href({ papel: p.id }), papel === p.id)
          )}
        </FilterChipRow>
      </div>
      <div className="min-w-0 space-y-1.5">
        <p className={eyebrow}>medida</p>
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
  janela: number,
  agora: number
): LinhaSuperficie[] {
  const completas = dadosAdocaoSuperficiesDemo(d, janela);
  if (!papel) return completas;
  const completa = new Map(completas.map((l) => [l.superficie, l]));
  const porSup = new Map<string, LinhaSuperficie>();
  for (const c of dadosAdocaoMatrizDemo(d, janela)) {
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
