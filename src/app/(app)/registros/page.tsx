import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { ClipboardText } from "@phosphor-icons/react/dist/ssr";
import {
  getAlertasRegistros,
  getCicloEventos,
  getDuplasOpcoes,
  getEncontrosPorDuplas,
  getEspecialistaEventos,
  getMe,
  getRegistros,
  REGISTROS_PAGINA,
  type FiltrosRegistro,
  type RegistroResumo,
} from "@/lib/queries";
import {
  AVALIACAO_LABEL,
  DIFICULDADE_LABEL,
  formatDiaNum,
  formatMesAbrev,
  maxNumeroEncontro,
  passoEsp,
  registroTardio,
} from "@/lib/ciclo";
import { RegistrosFiltros, type OrdemRegistros } from "@/components/registros-filtros";
import {
  agruparRegistros,
  grupoRegistrosDe,
} from "@/lib/registros";
import { buttonVariants } from "@/components/ui/button";
import { ImportarRegistrosDialog } from "@/components/importar-registros-dialog";
import { PageHeader } from "@/components/page-header";
import { RegistroCard } from "@/components/registro-card";
import { cn } from "@/lib/utils";
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

  const eventos = await getCicloEventos();
  // teto do filtro por nº = o maior número entre os cronogramas — contar
  // linhas com duas turmas daria o dobro do que existe de fato
  const maxEncontro = maxNumeroEncontro(eventos);
  const params = await searchParams;
  const filtros = parseFiltros(params, maxEncontro);
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

  const [{ itens, total }, duplas, alertas, espEventos] = await Promise.all([
    getRegistros(filtros),
    getDuplasOpcoes(),
    getAlertasRegistros(),
    getEspecialistaEventos(),
  ]);

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
    if (filtros.q) p.set("q", filtros.q);
    if (ordem !== "recentes") p.set("ordem", ordem);
    if (grupo !== "dupla") p.set("grupo", grupo);
    if (filtros.pagina > 1) p.set("pagina", String(filtros.pagina));
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    return `/registros${qs ? `?${qs}` : ""}`;
  };
  const hrefPagina = (pagina: number) => hrefCom({ pagina: String(pagina) });
  // "limpar filtros" zera só os filtros — ordem e agrupamento são
  // preferência de leitura e sobrevivem (mesma regra do "Limpar tudo")
  const hrefLimpo = hrefCom({
    encontro: null,
    avaliacao: null,
    apoio: null,
    tardio: null,
    dificuldade: null,
    dupla: null,
    q: null,
    pagina: null,
  });

  /** Um item da timeline — extraído porque no modo prioridade a lista
   *  vira duas ("Precisam de olho" / "Sem sinais de atenção"). */
  function linhaRegistro(r: RegistroResumo, i: number, ultimo: boolean) {
    const aconteceuEm = aconteceuEmDe(r);
    const tardio = registroTardio(r, r.encontro);
    return (
      <li
        key={r.id}
        className="animate-enter flex gap-3 sm:gap-4"
        style={{ "--i": Math.min(i, 10) } as CSSProperties}
      >
        <div
          aria-hidden
          className="flex w-10 shrink-0 flex-col items-center sm:w-12"
        >
          <p className="pt-4 text-center leading-none">
            <span className="block text-sm font-semibold tabular-nums">
              {formatDiaNum(aconteceuEm)}
            </span>
            <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {formatMesAbrev(aconteceuEm)}
            </span>
          </p>
          {/* precedência do nó: apoio > tardio > ok — a cor é sinal
              secundário; os badges no card carregam a informação */}
          <span
            className={cn(
              "mt-2 size-2 shrink-0 rounded-full",
              r.precisa_apoio
                ? "bg-[var(--danger)]"
                : tardio
                  ? "bg-[var(--warn)]"
                  : "bg-[var(--ok)]"
            )}
          />
          {!ultimo && <span className="mt-1.5 w-px flex-1 bg-border" />}
        </div>
        <div className={cn("min-w-0 flex-1", !ultimo && "pb-5")}>
          <RegistroCard
            r={r}
            tituloEncontro={tituloEncontro(r)}
            passoEsp={passoDoEncontro(r)}
            souCoord={souCoord}
          />
        </div>
      </li>
    );
  }

  /** Uma lista de registros particionada pelo `?grupo=` corrente — cada
   *  bloco é cabeçalho + <ol> própria: o rail da timeline vive
   *  dentro do grupo (o nó final de cada um fecha a linha, nada pendura
   *  entre grupos). `Tag` desce o nível do cabeçalho quando a lista já está
   *  sob a seção de prioridade ("Precisam de olho"). */
  function listaAgrupada(lista: RegistroResumo[], Tag: "h2" | "h3") {
    const grupos = agruparRegistros(lista, grupo);
    return (
      <div
        className={cn(
          "space-y-6",
          // por dupla a grade em xl põe duas duplas lado a lado (o ganho de
          // densidade da issue); semana/avaliação seguem sequenciais — a
          // timeline conta a linha do tempo, não um board
          grupo === "dupla" &&
            "xl:grid xl:grid-cols-2 xl:items-start xl:gap-8 xl:space-y-0"
        )}
      >
        {grupos.map((g) => (
          // div, não <section>: 16 landmarks nomeados seriam ruído de
          // navegação — o cabeçalho dentro já dá o nome ao grupo
          <div
            key={g.chave}
            className={cn(
              "border-t border-border/60 pt-5 first:border-t-0 first:pt-0",
              // na grade o 1º da fila também ganha a hairline — sem ela a
              // coluna da direita nasceria com borda e a da esquerda não
              grupo === "dupla" && "xl:first:border-t xl:first:pt-5"
            )}
          >
            <Tag className="text-[13px] font-semibold">
              {g.rotulo}
              <span className="font-normal text-muted-foreground">
                {" · "}
                {g.itens.length}{" "}
                {g.itens.length === 1 ? "registro" : "registros"}
              </span>
            </Tag>
            <ol className="mt-3">
              {g.itens.map((r, i) =>
                linhaRegistro(r, i, i === g.itens.length - 1)
              )}
            </ol>
          </div>
        ))}
      </div>
    );
  }

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
        actions={souCoord ? <ImportarRegistrosDialog /> : undefined}
      />

      {/* resumo operacional: o que pede ação vem antes da busca; clicar num
          número aplica o filtro correspondente */}
      {(total > 0 || alertas.apoio > 0 || alertas.tardios > 0) && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {temFiltro ? (
            <Link
              href={hrefLimpo}
              scroll={false}
              className="-my-1.5 py-1.5 font-medium text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
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
                className="-my-1.5 py-1.5 font-medium text-[var(--danger)] underline underline-offset-4 transition-colors hover:text-[var(--danger)]/80"
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
                className="-my-1.5 py-1.5 font-medium text-[var(--warn-text)] underline underline-offset-4 transition-colors hover:text-[var(--warn-text)]/80"
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
                className="-my-1.5 py-1.5 font-medium text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
              >
                {ordem !== "recentes" ? "voltar a mais recentes" : "ordenar por prioridade"}
              </Link>
            </>
          )}
        </p>
      )}

      <RegistrosFiltros
        filtros={filtros}
        duplas={duplas}
        maxEncontro={maxEncontro}
        ordem={ordem}
        grupo={grupo}
      />

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
          {/* timeline: o rail mostra o dia em que o encontro aconteceu e a
              linha conecta os nós — a página conta a sequência, não uma
              coleção genérica de cards */}
          {agrupado ? (
            // prioridade é um agrupamento de blocos — o `?grupo=` corrente
            // particiona DENTRO de cada um (ex.: as duplas que pedem olho)
            <div className="space-y-8">
              <section aria-labelledby="reg-atencao-titulo">
                <h2
                  id="reg-atencao-titulo"
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  Precisam de olho ({atencao.length})
                </h2>
                <div className="mt-4">
                  {listaAgrupada(atencao, "h3")}
                </div>
              </section>
              <section aria-labelledby="reg-demais-titulo">
                <h2
                  id="reg-demais-titulo"
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  Sem sinais de atenção
                </h2>
                <div className="mt-4">
                  {listaAgrupada(demais, "h3")}
                </div>
              </section>
            </div>
          ) : (
            listaAgrupada(ordenados, "h2")
          )}
          {itens.length < total && (
            <div className="flex justify-center pt-1">
              <Link
                href={hrefPagina(filtros.pagina + 1)}
                scroll={false}
                className={buttonVariants({ variant: "outline" })}
              >
                Mostrar mais ({Math.min(total - itens.length, REGISTROS_PAGINA)}{" "}
                restantes)
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
