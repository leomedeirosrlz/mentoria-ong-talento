import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ClipboardText } from "@phosphor-icons/react/dist/ssr";
import {
  getAlertasRegistros,
  getCicloEventos,
  getCronogramas,
  getDuplas,
  getDuplasOpcoes,
  getEncontrosPorDuplas,
  getEspecialistaEventos,
  getMe,
  getMetricasRegistro,
  getRegistros,
  getRegistrosPanorama,
  REGISTROS_PAGINA,
  type FiltrosRegistro,
  type RegistroResumo,
} from "@/lib/queries";
import {
  AVALIACAO_LABEL,
  DIFICULDADE_LABEL,
  maxNumeroEncontro,
  passoEsp,
  toDateStr,
} from "@/lib/ciclo";
import { MetricasRegistroCard } from "@/components/metricas-registro";
import { RegistrosAgrupar } from "@/components/registros-agrupar";
import { RegistrosFiltros, type OrdemRegistros } from "@/components/registros-filtros";
import { RegistrosPainel } from "@/components/registros-painel";
import { RegistrosMestreDetalhe, type SecaoLista } from "@/components/registros-mestre-detalhe";
import type { EntradaRegistro } from "@/components/registros-detalhe";
import {
  agruparRegistros,
  GRUPOS_REGISTROS,
  grupoRegistrosDe,
  PERIODO_REGISTROS_OPCOES,
  periodoRegistrosDe,
  type GrupoRegistros,
} from "@/lib/registros";
import { saudeDoRecorte } from "@/lib/agenda-coordenacao";
import { turmaCurta, turmaLonga } from "@/lib/turma";
import { buttonVariants } from "@/components/ui/button";
import { ImportarRegistrosDialog } from "@/components/importar-registros-dialog";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { temPapel } from "@/lib/types";
import type { AvaliacaoJovem, Dificuldade, Encontro } from "@/lib/types";

export const metadata: Metadata = { title: "Registros" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function primeiro(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** PostgREST `or()` quebra com vírgula/parenteses/curinga/`::` no valor — limpa. */
function saneiaBusca(q: string): string {
  return q.replace(/[%(),."\\:]/g, " ").replace(/\s+/g, " ").trim();
}

function parseFiltros(
  p: Record<string, string | string[] | undefined>,
  maxEncontro: number
): FiltrosRegistro {
  const f: FiltrosRegistro = { pagina: 1 };
  const encontro = Number(primeiro(p.encontro));
  if (Number.isInteger(encontro) && encontro >= 1 && encontro <= maxEncontro)
    f.encontro = encontro;
  const avaliacao = primeiro(p.avaliacao);
  if (avaliacao && Object.hasOwn(AVALIACAO_LABEL, avaliacao))
    f.avaliacao = avaliacao as AvaliacaoJovem;
  if (primeiro(p.apoio) === "1") f.apoio = true;
  if (primeiro(p.tardio) === "1") f.tardio = true;
  const dificuldade = primeiro(p.dificuldade);
  if (dificuldade === "com" || (dificuldade && Object.hasOwn(DIFICULDADE_LABEL, dificuldade)))
    f.dificuldade = dificuldade as Dificuldade | "com";
  const dupla = primeiro(p.dupla);
  if (dupla && UUID_RE.test(dupla)) f.dupla = dupla;
  const turma = primeiro(p.turma);
  if (turma && UUID_RE.test(turma)) f.turma = turma;
  const periodo = periodoRegistrosDe(primeiro(p.periodo));
  if (periodo !== "ciclo") f.periodo = periodo;
  const q = saneiaBusca(primeiro(p.q) ?? "");
  if (q) f.q = q.slice(0, 80);
  const pagina = Number(primeiro(p.pagina));
  if (Number.isInteger(pagina) && pagina > 1) f.pagina = Math.min(pagina, 50);
  return f;
}

/** Apoio → avaliação baixa → regular → dificuldade: quem precisa de olho sobe. */
function scoreAlerta(r: RegistroResumo): number {
  if (r.precisa_apoio) return 4;
  if (r.avaliacao === "baixa") return 3;
  if (r.avaliacao === "regular") return 2;
  if (r.dificuldade && r.dificuldade !== "nenhuma") return 1;
  return 0;
}

/** Os nomes da dupla de um grupo "por dupla" — o cabeçalho os mostra no padrão
 *  do app (DuplaNomes), sem o prefixo "Dupla:". */
function duplaDoBloco(
  itens: RegistroResumo[]
): { mentor: string; mentorado: string } | null {
  const d = itens[0]?.encontro?.dupla;
  return d?.mentor && d?.mentorado
    ? { mentor: d.mentor.nome, mentorado: d.mentorado.nome }
    : null;
}

/** A data que a timeline exibe — quando o encontro aconteceu de fato. */
function aconteceuEmDe(r: RegistroResumo): string {
  return (
    r.encontro?.realizado_em ?? r.encontro?.data_hora ?? r.created_at
  );
}

export default async function RegistrosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await getMe();
  if (me?.role !== "coordenacao" && me?.role !== "supervisor") redirect("/");
  const souCoord = me.role === "coordenacao";
  const souMentor = temPapel(me, "mentor_dpp") || temPapel(me, "mentor_especialista");

  const eventos = await getCicloEventos();
  // teto do filtro por nº = o maior número entre os cronogramas — contar
  // linhas com duas turmas daria o dobro do que existe de fato
  const maxEncontro = maxNumeroEncontro(eventos);
  const params = await searchParams;
  const filtros = parseFiltros(params, maxEncontro);
  const perspRaw = primeiro(params.persp);
  const perspectiva: "mentor" | "jovem" | "ambos" =
    perspRaw === "jovem" || perspRaw === "ambos" ? perspRaw : "mentor";
  // triagem por scoreAlerta dentro da fatia carregada — a paginação é
  // cumulativa, então "prioridade" cobre tudo que já foi buscado
  const ordemParam = primeiro(params.ordem);
  const ordem: OrdemRegistros =
    ordemParam === "prioridade" || ordemParam === "antigas"
      ? ordemParam
      : "recentes";
  const porPrioridade = ordem === "prioridade";
  // ?grupo=dupla|semana|avaliacao — "dupla" é o default implícito e não
  // viaja na URL; lixo no param cai no default (grupoRegistrosDe)
  const grupo = grupoRegistrosDe(primeiro(params.grupo));
  // ?r= é o registro aberto no painel desktop; id inválido cai no primeiro
  const rParam = primeiro(params.r);
  const rId = rParam && UUID_RE.test(rParam) ? rParam : null;

  const [
    { itens: itensIniciais, total },
    duplas,
    alertas,
    espEventos,
    panorama,
    cronogramas,
    todasDuplas,
    metricas,
  ] = await Promise.all([
    getRegistros(filtros),
    getDuplasOpcoes(),
    getAlertasRegistros(),
    getEspecialistaEventos(),
    getRegistrosPanorama(filtros),
    getCronogramas(),
    getDuplas(),
    getMetricasRegistro(),
  ]);
  // situação das duplas: o mesmo resumo de /duplas, /agenda e da home, no
  // recorte de turma do painel (a URL é a fonte do recorte)
  const saude = saudeDoRecorte(todasDuplas, eventos, new Date(), filtros.turma ?? null);
  // pílula de encontro sem registro no escopo não filtra nada — o modal
  // só oferece os nºs que existem de fato (regra de silêncio da 240)
  const encontrosComRegistro = [
    ...new Set(
      todasDuplas.flatMap((d) =>
        (d.encontros ?? [])
          .filter((e) => e.registro != null && e.numero != null)
          .map((e) => e.numero!)
      )
    ),
  ].sort((a, b) => a - b);

  // ?r= de um registro fora da página carregada: sobe as páginas (cumulativas)
  // até achá-lo, para o link de um registro antigo abrir o registro certo
  let itens = itensIniciais;
  for (
    let p = filtros.pagina + 1;
    rId && p <= 50 && itens.length < total && !itens.some((x) => x.id === rId);
    p++
  ) {
    itens = (await getRegistros({ ...filtros, pagina: p })).itens;
  }

  // trilha especialista (0074): encontro.numero é a TENTATIVA — o passo do
  // guia é o rank entre realizados, e derivá-lo exige o histórico da dupla
  const espDuplaIds = [
    ...new Set(
      itens
        .filter((r) => r.encontro?.dupla?.trilha === "especialista")
        .map((r) => r.encontro!.dupla!.id)
    ),
  ];
  const encEsp = await getEncontrosPorDuplas(espDuplaIds);
  const encPorDupla = new Map<
    string,
    Pick<Encontro, "numero" | "status">[]
  >();
  for (const e of encEsp) {
    const lista = encPorDupla.get(e.dupla_id) ?? [];
    lista.push(e);
    encPorDupla.set(e.dupla_id, lista);
  }
  const passoDoEncontro = (r: RegistroResumo): number | null => {
    const enc = r.encontro;
    if (!enc) return null;
    if (enc.dupla?.trilha !== "especialista") return null;
    const historico = encPorDupla.get(enc.dupla.id) ?? [];
    return passoEsp(enc, historico.length ? historico : [enc]);
  };

  // título do encontro por (cronograma, nº) — por trilha: o nº 3 DPP e o nº 3
  // especialista são eventos diferentes (ciclo_eventos vs especialista_eventos),
  // e o nº 3 da T1 e o da T2 também (0061 — numero solto não identifica)
  const tituloDpp = new Map(
    eventos
      .filter((e) => e.tipo === "encontro" && e.numero != null)
      .map((e) => [`${e.cronograma_id}:${e.numero}`, e.titulo])
  );
  const tituloEsp = new Map(espEventos.map((e) => [e.numero, e.titulo]));
  const tituloEncontro = (r: RegistroResumo) => {
    const passo = passoDoEncontro(r);
    if (passo != null) return tituloEsp.get(passo) ?? null;
    return (
      tituloDpp.get(
        `${r.encontro?.dupla?.cronograma_id}:${r.encontro?.numero}`
      ) ?? null
    );
  };

  // o banco já ordena por realizado_em; o sort estável acerta a fatia
  // carregada e empurra quem pede atenção pra cima dentro do mesmo dia.
  // No modo prioridade o scoreAlerta vira a chave global e a data desempata;
  // "antigas" inverte a linha do tempo (ordem cronológica de leitura).
  const ordenados = [...itens].sort(
    ordem === "prioridade"
      ? (a, b) =>
          scoreAlerta(b) - scoreAlerta(a) ||
          aconteceuEmDe(b).localeCompare(aconteceuEmDe(a)) ||
          b.created_at.localeCompare(a.created_at)
      : ordem === "antigas"
        ? (a, b) =>
            aconteceuEmDe(a).localeCompare(aconteceuEmDe(b)) ||
            a.created_at.localeCompare(b.created_at)
        : (a, b) =>
            aconteceuEmDe(b).localeCompare(aconteceuEmDe(a)) ||
            scoreAlerta(b) - scoreAlerta(a) ||
            b.created_at.localeCompare(a.created_at)
  );
  // com prioridade ligada, os que pedem olho sobem como bloco próprio
  const atencao = porPrioridade ? ordenados.filter((r) => scoreAlerta(r) > 0) : [];
  const demais = porPrioridade ? ordenados.filter((r) => scoreAlerta(r) === 0) : [];
  const agrupado = porPrioridade && atencao.length > 0 && demais.length > 0;

  const temFiltro = !!(
    filtros.encontro ||
    filtros.avaliacao ||
    filtros.apoio ||
    filtros.tardio ||
    filtros.dificuldade ||
    filtros.dupla ||
    filtros.turma ||
    filtros.periodo ||
    filtros.q
  );
  const hrefCom = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    if (filtros.encontro) p.set("encontro", String(filtros.encontro));
    if (filtros.avaliacao) p.set("avaliacao", filtros.avaliacao);
    if (filtros.apoio) p.set("apoio", "1");
    if (filtros.tardio) p.set("tardio", "1");
    if (filtros.dificuldade) p.set("dificuldade", filtros.dificuldade);
    if (filtros.dupla) p.set("dupla", filtros.dupla);
    if (filtros.turma) p.set("turma", filtros.turma);
    if (filtros.periodo) p.set("periodo", filtros.periodo);
    if (filtros.q) p.set("q", filtros.q);
    if (ordem !== "recentes") p.set("ordem", ordem);
    if (grupo !== "dupla") p.set("grupo", grupo);
    if (filtros.pagina > 1) p.set("pagina", String(filtros.pagina));
    if (perspectiva !== "mentor") p.set("persp", perspectiva);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    return `/registros${qs ? `?${qs}` : ""}`;
  };
  // "limpar filtros" zera TUDO — inclusive o recorte do panorama (turma/
  // período), que também filtra a lista. Ordem e agrupamento são preferência
  // de leitura e sobrevivem
  const hrefLimpo = hrefCom({
    encontro: null,
    avaliacao: null,
    apoio: null,
    tardio: null,
    dificuldade: null,
    dupla: null,
    turma: null,
    periodo: null,
    q: null,
    pagina: null,
  });

  const entradaDe = (r: RegistroResumo): EntradaRegistro => ({
    r,
    tituloEncontro: tituloEncontro(r),
    passoEsp: passoDoEncontro(r),
  });
  const blocosDe = (lista: RegistroResumo[]) =>
    agruparRegistros(lista, grupo).map((b) => ({
      chave: b.chave,
      rotulo: b.rotulo,
      dupla: grupo === "dupla" ? duplaDoBloco(b.itens) : null,
      itens: b.itens.map(entradaDe),
    }));
  const secoesLista: SecaoLista[] = agrupado
    ? [
        {
          chave: "atencao",
          titulo: `Precisam de olho (${atencao.length})`,
          blocos: blocosDe(atencao),
        },
        {
          chave: "demais",
          titulo: "Sem sinais de atenção",
          blocos: blocosDe(demais),
        },
      ]
    : [{ chave: "todos", titulo: null, blocos: blocosDe(ordenados) }];
  const exibidos = secoesLista.flatMap((s) =>
    s.blocos.flatMap((b) => b.itens)
  );
  // só a seleção pedida na URL — sem ?r= o componente marca o 1º no
  // desktop e, no celular, mantém a folha fechada
  const pedidoId = rId && exibidos.some((e) => e.r.id === rId) ? rId : null;
  const selecionadoId = pedidoId ?? exibidos[0]?.r.id ?? null;
  // "Mostrar mais" parte da última página já carregada (o ?r= pode ter subido)
  const paginaCarregada = Math.max(
    filtros.pagina,
    Math.ceil(itens.length / REGISTROS_PAGINA)
  );
  const hrefBase = hrefCom({ r: null });
  // eixo de agrupamento: controle de visualização no cabeçalho da lista —
  // os hrefs preservam TODOS os params (inclusive ?pagina= cumulativa,
  // porque reorganizam os mesmos itens, não filtram)
  const hrefsGrupo = Object.fromEntries(
    GRUPOS_REGISTROS.map((g) => [
      g,
      hrefCom({ grupo: g === "dupla" ? null : g }),
    ])
  ) as Record<GrupoRegistros, string>;
  // filtro, busca, ordem ou agrupamento trocados remontam a lista (animam);
  // trocar só a seleção ou carregar mais não remonta
  const chaveLista = JSON.stringify([{ ...filtros, pagina: 0 }, ordem, grupo]);
  const linkMais =
    itens.length < total ? (
      <div className="flex justify-center pt-1">
        <Link
          href={hrefCom({
            pagina: String(paginaCarregada + 1),
            r: selecionadoId,
          })}
          scroll={false}
          className={buttonVariants({ variant: "outline" })}
        >
          Mostrar mais ({Math.min(total - itens.length, REGISTROS_PAGINA)}{" "}
          restantes)
        </Link>
      </div>
    ) : null;

  const hoje = toDateStr(new Date());
  // pills de turma do panorama: só cronogramas com duplas no escopo do
  // papel (o supervisor não vê pill de turma que não supervisiona)
  const cronogramasComDuplas = new Set(
    duplas.map((d) => d.cronograma_id).filter((x): x is string => !!x)
  );
  const turmasPainel = cronogramas.filter((c) =>
    cronogramasComDuplas.has(c.id)
  );
  const pillCls = (ativo: boolean) =>
    cn(
      "inline-flex min-h-11 items-center rounded-full px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-7",
      ativo
        ? "bg-muted font-semibold text-foreground"
        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
    );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* respostas do form semanal externo → encontros + registros
          (só coord — é exceção à regra "o registro é do mentor") */}
      <PageHeader
        title="Registros"
        meta={
          souCoord
            ? "O que os mentores reportaram em cada encontro · todas as duplas"
            : "O que os mentores reportaram em cada encontro · suas duplas"
        }
        actions={
          <div className="flex items-center gap-2">
            {souCoord && <ImportarRegistrosDialog />}
            <div className="inline-flex items-center rounded-full border border-border bg-card p-0.5 text-xs">
              {(["mentor", "jovem", "ambos"] as const).map((v) => (
                <Link
                  key={v}
                  href={hrefCom({ persp: v === "mentor" ? null : v })}
                  scroll={false}
                  aria-current={perspectiva === v ? "page" : undefined}
                  className={cn(
                    "rounded-full px-2.5 py-1 transition-colors",
                    perspectiva === v
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {v === "mentor" ? "Mentor" : v === "jovem" ? "Jovem" : "Ambos"}
                </Link>
              ))}
            </div>
          </div>
        }
      />

      <RegistrosFiltros
        filtros={filtros}
        duplas={duplas}
        turmas={turmasPainel}
        maxEncontro={maxEncontro}
        encontrosComRegistro={encontrosComRegistro}
        ordem={ordem}
        grupo={grupo}
      />

      {/* Panorama do ciclo (REALIZA-198): o recorte turma×período é param de
          URL (links de verdade — Cmd+click, back/forward e aria-current de
          graça, mesma gramática do "Agrupar"); métrica das barras e modo da
          linha são estado local DENTRO do painel. Os gráficos leem o escopo
          inteiro via getRegistrosPanorama — nunca a fatia paginada de 100 */}
      <section aria-labelledby="panorama-titulo" className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <h2
            id="panorama-titulo"
            className="text-base font-semibold"
          >
            Panorama do ciclo
          </h2>
          {turmasPainel.length > 1 && (
            <div
              role="group"
              aria-label="Recortar por turma"
              className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5"
            >
              <span className="text-xs text-muted-foreground">Turma:</span>
              <div className="inline-flex items-center gap-0.5 rounded-full border bg-card p-0.5">
                <Link
                  href={hrefCom({ turma: null, pagina: null })}
                  scroll={false}
                  aria-current={!filtros.turma ? "page" : undefined}
                  className={pillCls(!filtros.turma)}
                >
                  Todas
                </Link>
                {turmasPainel.map((c) => {
                  // WCAG 2.5.3 (label in name): o nome acessível precisa
                  // conter o texto visível — "Turma 1 (T1)" cobre o chip
                  // "T1"; quando sigla = nome (turma livre) não repete
                  const curta = turmaCurta(c.turma);
                  const longa = turmaLonga(c.turma);
                  return (
                    <Link
                      key={c.id}
                      href={hrefCom({ turma: c.id, pagina: null })}
                      scroll={false}
                      aria-label={longa === curta ? curta : `${longa} (${curta})`}
                      aria-current={filtros.turma === c.id ? "page" : undefined}
                      className={pillCls(filtros.turma === c.id)}
                    >
                      {curta}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          <div
            role="group"
            aria-label="Recortar por período"
            className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5"
          >
            <span className="text-xs text-muted-foreground">Período:</span>
            <div className="inline-flex items-center gap-0.5 rounded-full border bg-card p-0.5">
              {PERIODO_REGISTROS_OPCOES.map((o) => {
                const ativo =
                  (filtros.periodo ?? "ciclo") === o.valor;
                return (
                  <Link
                    key={o.valor}
                    href={hrefCom({
                      periodo: o.valor === "ciclo" ? null : o.valor,
                      pagina: null,
                    })}
                    scroll={false}
                    aria-current={ativo ? "page" : undefined}
                    className={pillCls(ativo)}
                  >
                    {o.rotulo}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
        <RegistrosPainel panorama={panorama} hoje={hoje} saude={saude} />
      </section>

      {/* telemetria do form (REALIZA-217): tempo e abandono do
          preenchimento, só pra coordenação — a query já devolve null pra
          supervisor, o gate aqui deixa isso explícito */}
      {souCoord && metricas && <MetricasRegistroCard metricas={metricas} />}

      {/* cabeçalho da lista: contador operacional à esquerda (clicar num
          número aplica o filtro correspondente), controle de agrupamento
          à direita — agrupar é visão, não filtro, então sai da barra */}
      {(total > 0 || alertas.apoio > 0 || alertas.tardios > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <p className="text-sm text-muted-foreground" aria-live="polite">
          {temFiltro ? (
            <Link
              href={hrefLimpo}
              scroll={false}
              className="-my-3 inline-flex min-h-11 items-center font-medium sm:-my-1.5 sm:min-h-8 text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
            >
              {total} {total === 1 ? "registro" : "registros"}
            </Link>
          ) : (
            <span className="font-medium text-foreground">
              {total} {total === 1 ? "registro" : "registros"}
            </span>
          )}
          {itens.length < total && ` · mostrando ${itens.length}`}
          {alertas.apoio > 0 && (
            <>
              {" · "}
              <Link
                href="/registros?apoio=1"
                scroll={false}
                aria-current={filtros.apoio ? "true" : undefined}
                className="-my-3 inline-flex min-h-11 items-center font-medium sm:-my-1.5 sm:min-h-8 text-[var(--danger)] underline underline-offset-4 transition-colors hover:text-[var(--danger)]/80"
              >
                {alertas.apoio}{" "}
                {alertas.apoio === 1 ? "apoio em aberto" : "apoios em aberto"}
              </Link>
            </>
          )}
          {alertas.tardios > 0 && (
            <>
              {" · "}
              <Link
                href="/registros?tardio=1"
                scroll={false}
                aria-current={filtros.tardio ? "true" : undefined}
                className="-my-3 inline-flex min-h-11 items-center font-medium sm:-my-1.5 sm:min-h-8 text-[var(--warn-text)] underline underline-offset-4 transition-colors hover:text-[var(--warn-text)]/80"
              >
                {alertas.tardios}{" "}
                {alertas.tardios === 1 ? "registro tardio" : "registros tardios"}
              </Link>
            </>
          )}
          {/* atalho de triagem: um clique liga a prioridade (ou volta pras
              recentes de qualquer ordem alternativa); a escolha completa
              mora no modal de filtros */}
          {ordenados.length > 1 && (
            <>
              {" · "}
              <Link
                href={hrefCom({ ordem: ordem === "recentes" ? "prioridade" : null })}
                scroll={false}
                className="-my-3 inline-flex min-h-11 items-center font-medium sm:-my-1.5 sm:min-h-8 text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
              >
                {ordem !== "recentes" ? "voltar a mais recentes" : "ordenar por prioridade"}
              </Link>
            </>
          )}
        </p>
        <RegistrosAgrupar grupo={grupo} hrefs={hrefsGrupo} />
      </div>
      )}

      {ordenados.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl bg-card px-6 py-10 text-center shadow-[var(--shadow-border)]">
          <ClipboardText
            size={32}
            aria-hidden
            className="text-muted-foreground/50"
          />
          <p className="mt-3 font-medium">
            {temFiltro
              ? "Nenhum registro com esses filtros."
              : souCoord
                ? "Nenhum registro entregue ainda."
                : "Nenhum registro nas suas duplas ainda."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {temFiltro
              ? "Tente ajustar ou limpar os filtros."
              : "Os registros semanais dos mentores aparecem aqui conforme forem enviados."}
          </p>
          {temFiltro && (
            <Link
              href={hrefLimpo}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "mt-4"
              )}
            >
              Limpar filtros
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* lista + registro em todas as larguras (REALIZA-211): no
              desktop o registro fica ao lado, no celular abre numa folha */}
          <div>
            <RegistrosMestreDetalhe
              secoes={secoesLista}
              selecionadoId={pedidoId}
              hrefBase={hrefBase}
              chaveLista={chaveLista}
              souCoord={souCoord}
              souMentor={souMentor}
              perspectiva={perspectiva}
              agrupadoPorDupla={grupo === "dupla"}
              rodape={linkMais}
            />
          </div>
        </>
      )}
    </div>
  );
}
