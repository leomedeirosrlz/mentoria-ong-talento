"use client";

// A fila de chamados (staff = master-detail, mentor = "meus chamados"). O
// detalhe mora em chamado-detalhe.tsx e as pills/helpers compartilhados em
// chamados-shared.tsx — home do mentor e perfil do jovem importam só o que
// usam.

import {
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChatCircleText,
  Funnel,
  Lock,
  MagnifyingGlass,
  Plus,
} from "@phosphor-icons/react";
import type { ChamadoFilaItem, ChamadoTimelineItem } from "@/lib/types";
import { CHAMADO_CATEGORIA_LABEL } from "@/lib/ciclo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FilterChipRow, filterChipCls } from "@/components/ui/filter-chip";
import { NovoChamadoDialog } from "@/components/novo-chamado-dialog";
import { ChamadoDetalhe } from "@/components/chamado-detalhe";
import {
  ChamadoStatusBadge,
  UrgenciaMarca,
  relTempo,
  type Equipe,
} from "@/components/chamados-shared";

type Papel = string;

const nadaMuda = () => () => {};

// "sem dono" exclui restrito: pro auxiliar o atribuido_a chega mascarado
// (null) e a linha contaria errado como sem dono
const semDono = (c: ChamadoFilaItem) =>
  c.status === "aberto" && !c.atribuido_a && !c.restrito;
const ehMeu = (c: ChamadoFilaItem, meuId: string) =>
  c.atribuido_a === meuId && c.status !== "resolvido";
type Aba = "semdono" | "meus" | "todos";

const ABAS: { v: Aba; rotulo: string }[] = [
  { v: "semdono", rotulo: "Sem dono" },
  { v: "meus", rotulo: "Meus" },
  { v: "todos", rotulo: "Todos" },
];

export function ChamadosApp({
  papel,
  meuId,
  meuNome,
  itens,
  duplas,
  selecionadoInicial,
  detalheInicial,
}: {
  papel: Papel;
  meuId: string;
  meuNome: string;
  itens: ChamadoFilaItem[];
  /** Opções do select "Dupla relacionada" do NovoChamadoDialog — só as
   *  duplas em que a pessoa é mentora; vazio esconde o campo. */
  duplas: { id: string; label: string }[];
  selecionadoInicial: string | null;
  detalheInicial: {
    chamado: ChamadoFilaItem;
    timeline: ChamadoTimelineItem[];
    equipe: Equipe;
  } | null;
}) {
  const router = useRouter();
  const staff = papel === "coordenacao" || papel === "supervisor";
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<Aba>("todos");
  const [fCategoria, setFCategoria] = useState<string>("todas");
  const [verResolvidos, setVerResolvidos] = useState(false);
  // a linha clicada acende na hora e o detalhe vira esqueleto enquanto a
  // navegação (server component) não volta — sem isso o clique parece morto
  const [navegando, startNav] = useTransition();
  const [alvo, setAlvo] = useState<string | null>(null);

  const sel = selecionadoInicial;
  const detalhe = detalheInicial;
  const emFoco = navegando ? alvo : sel;
  const carregandoDetalhe =
    navegando && !!alvo && alvo !== detalhe?.chamado.id;

  // categoria só oferece o que existe na fila — filtro sem efeito é ruído
  const categoriasPresentes = useMemo(
    () =>
      (Object.keys(CHAMADO_CATEGORIA_LABEL) as (keyof typeof CHAMADO_CATEGORIA_LABEL)[]).filter(
        (k) => itens.some((c) => c.categoria === k)
      ),
    [itens]
  );
  const nResolvidos = useMemo(
    () => itens.filter((c) => c.status === "resolvido").length,
    [itens]
  );
  const filtrosAtivos =
    (fCategoria !== "todas" ? 1 : 0) + (verResolvidos ? 1 : 0);

  // base da contagem das abas = o recorte dos filtros secundários e da
  // busca; aba e resultado usam o mesmo predicado, então nunca divergem
  const base = useMemo(() => {
    let l = itens;
    if (staff) {
      if (!verResolvidos) l = l.filter((c) => c.status !== "resolvido");
      if (fCategoria !== "todas")
        l = l.filter((c) => c.categoria === fCategoria);
    }
    const q = busca.trim().toLowerCase();
    if (q) {
      l = l.filter(
        (c) =>
          c.numero.toLowerCase().includes(q) ||
          (c.assunto ?? "").toLowerCase().includes(q) ||
          (c.autor_nome ?? "").toLowerCase().includes(q) ||
          (c.contexto ?? "").toLowerCase().includes(q) ||
          (c.mentorado_nome ?? "").toLowerCase().includes(q)
      );
    }
    return l;
  }, [itens, staff, verResolvidos, fCategoria, busca]);

  const meu = (c: ChamadoFilaItem) => ehMeu(c, meuId);
  const contAba = {
    semdono: base.filter(semDono).length,
    meus: base.filter(meu).length,
    todos: base.length,
  };

  const filtrados = !staff
    ? base
    : aba === "semdono"
      ? base.filter(semDono)
      : aba === "meus"
        ? base.filter(meu)
        : base;

  function teclaAba(e: KeyboardEvent<HTMLElement>, i: number) {
    const n = ABAS.length;
    const prox =
      e.key === "ArrowRight"
        ? (i + 1) % n
        : e.key === "ArrowLeft"
          ? (i - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : null;
    if (prox === null) return;
    e.preventDefault();
    setAba(ABAS[prox].v);
    const irmaos = e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]');
    irmaos?.[prox]?.focus();
  }

  function navegar(href: string, id: string | null) {
    setAlvo(id);
    startNav(() => router.push(href));
  }

  function abrir(e: MouseEvent<HTMLAnchorElement>, id: string) {
    // ctrl/cmd/shift-clique segue o Link (nova aba) sem roubar a navegação
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navegar(`/chamados?c=${id}`, id);
  }
  const fechar = () => navegar("/chamados", null);

  const novo = (
    <NovoChamadoDialog
      papel={papel}
      duplas={duplas}
      trigger={
        // com um chamado aberto a ação da tela é a do detalhe (Assumir,
        // Resolver): "Novo chamado" recua pra contorno — um lima por tela
        <Button variant={sel ? "outline" : "default"} className="max-md:hidden">
          <Plus aria-hidden />
          Novo chamado
        </Button>
      }
    />
  );

  // no celular o "Novo chamado" desce pra zona do polegar, acima da
  // bottom-nav e à esquerda da bolha da Liza. Vai por portal: o template da
  // rota anima com transform, que prenderia o `fixed` ao conteúdo
  const noCliente = useSyncExternalStore(
    nadaMuda,
    () => true,
    () => false
  );
  const novoMobile = noCliente && createPortal(
    <NovoChamadoDialog
      papel={papel}
      duplas={duplas}
      trigger={
        <Button className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-30 h-12 rounded-full px-4 shadow-[var(--shadow-overlay)] md:hidden">
          <Plus aria-hidden />
          Novo chamado
        </Button>
      }
    />,
    document.body
  );

  // autor: o detalhe SUBSTITUI a lista em qualquer largura (com voltar)
  const autorNoDetalhe = !staff && !!emFoco;
  const listaVisivelMobile = staff ? !emFoco : !autorNoDetalhe;

  const lista = (
    <section
      aria-label={staff ? "Fila de chamados" : "Seus chamados"}
      className={cn(
        "min-w-0 pb-20 md:pb-0",
        staff && emFoco && "hidden lg:block",
        autorNoDetalhe && "hidden"
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlass
            size={16}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar"
            aria-label="Buscar por assunto, pessoa ou número"
            className="h-11 pl-9 text-base md:h-9 md:text-sm"
          />
        </div>
        {staff && (
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="relative md:size-9"
                  aria-label={
                    filtrosAtivos
                      ? `Filtros, ${filtrosAtivos} ${filtrosAtivos === 1 ? "ativo" : "ativos"}`
                      : "Filtros"
                  }
                />
              }
            >
              <Funnel aria-hidden />
              {filtrosAtivos > 0 && (
                <span
                  aria-hidden
                  className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background"
                >
                  {filtrosAtivos}
                </span>
              )}
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-72 max-w-[calc(100vw-2rem)] space-y-4 p-4"
            >
              {categoriasPresentes.length >= 2 && (
                <fieldset>
                  <legend className="text-xs font-medium text-muted-foreground">
                    Categoria
                  </legend>
                  <FilterChipRow className="mt-2 gap-1.5">
                    {(["todas", ...categoriasPresentes] as const).map((v) => (
                      <Button
                        key={v}
                        variant="outline"
                        aria-pressed={fCategoria === v}
                        onClick={() => setFCategoria(v)}
                        className={cn("h-auto", filterChipCls(fCategoria === v))}
                      >
                        {v === "todas" ? "Todas" : CHAMADO_CATEGORIA_LABEL[v]}
                      </Button>
                    ))}
                  </FilterChipRow>
                </fieldset>
              )}
              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm md:min-h-8">
                <span>
                  Mostrar resolvidos{" "}
                  <span className="text-muted-foreground tabular-nums">
                    {nResolvidos}
                  </span>
                </span>
                <Switch
                  checked={verResolvidos}
                  onCheckedChange={setVerResolvidos}
                />
              </label>
              {filtrosAtivos > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setFCategoria("todas");
                    setVerResolvidos(false);
                  }}
                >
                  Limpar filtros
                </Button>
              )}
            </PopoverContent>
          </Popover>
        )}
        {novo}
      </div>

      {staff && (
        <div
          role="tablist"
          aria-label="Recorte da fila"
          className="mb-3 flex rounded-lg bg-muted p-0.5"
        >
          {ABAS.map(({ v, rotulo }, i) => (
            <Button
              key={v}
              variant="ghost"
              role="tab"
              aria-selected={aba === v}
              tabIndex={aba === v ? 0 : -1}
              onClick={() => setAba(v)}
              onKeyDown={(e) => teclaAba(e, i)}
              className={cn(
                "h-auto min-h-11 flex-1 gap-1.5 rounded-md px-2 md:min-h-8",
                aba === v
                  ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                  : "text-muted-foreground"
              )}
            >
              {rotulo}
              <span
                className={cn(
                  "text-xs tabular-nums",
                  aba === v ? "text-background/70" : "text-muted-foreground"
                )}
              >
                {contAba[v]}
              </span>
            </Button>
          ))}
        </div>
      )}

      {/* a troca de filtro/busca re-monta a lista: o animate-enter re-roda
          por linha em vez de um repaint seco (convenção) */}
      <ul
        key={`${aba}|${fCategoria}|${verResolvidos}|${busca}`}
        className="space-y-1.5"
      >
        {filtrados.length === 0 && (
          <li className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            {busca.trim()
              ? "Nenhum chamado com essa busca."
              : staff
                ? aba === "semdono"
                  ? "Todos os chamados têm dono."
                  : "Nenhum chamado aqui."
                : "Você ainda não abriu nenhum chamado."}
          </li>
        )}
        {filtrados.map((c, i) => {
          const ativo = emFoco === c.id;
          const meta = c.restrito
            ? [CHAMADO_CATEGORIA_LABEL[c.categoria], relTempo(c.created_at)]
            : staff
              ? [c.autor_nome, c.contexto, relTempo(c.created_at)]
              : [
                  // na fila do autor o contexto vem null — o mentorado é a
                  // âncora da dupla (pro jovem é ele mesmo: omite)
                  papel !== "mentorado" && c.mentorado_nome
                    ? `Mentorado: ${c.mentorado_nome}`
                    : c.contexto,
                  relTempo(c.updated_at),
                ];
          return (
            <li
              key={c.id}
              className="animate-enter min-w-0"
              style={{ "--i": Math.min(i, 10) } as CSSProperties}
            >
              <Link
                href={`/chamados?c=${c.id}`}
                prefetch={false}
                onClick={(e) => abrir(e, c.id)}
                aria-current={ativo ? "true" : undefined}
                className={cn(
                  "block min-w-0 rounded-xl border px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  ativo
                    ? "border-foreground/25 bg-muted/70"
                    : "border-transparent bg-card shadow-[var(--shadow-border)] hover:bg-muted/40"
                )}
              >
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 break-words text-sm font-medium leading-snug">
                    {c.restrito ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Lock size={13} aria-hidden className="text-muted-foreground" />
                        Restrito à coordenação
                      </span>
                    ) : (
                      c.assunto
                    )}
                  </p>
                  {c.categoria === "urgencia" && <UrgenciaMarca className="mt-px" />}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {meta.filter(Boolean).join(" · ")}
                  </p>
                  <ChamadoStatusBadge
                    status={c.status}
                    dono={c.restrito ? null : c.atribuido_nome}
                    souDono={c.atribuido_a === meuId}
                    restrito={c.restrito}
                    visao={staff ? "staff" : "autor"}
                    className="shrink-0"
                  />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {listaVisivelMobile && novoMobile}
    </section>
  );

  const painelDetalhe = carregandoDetalhe ? (
    <DetalheEsqueleto />
  ) : detalhe && emFoco === detalhe.chamado.id ? (
    <ChamadoDetalhe
      key={detalhe.chamado.id}
      papel={papel}
      meuId={meuId}
      meuNome={meuNome}
      chamado={detalhe.chamado}
      timeline={detalhe.timeline}
      equipe={detalhe.equipe}
      onVoltar={fechar}
      voltarDesktop={!staff}
    />
  ) : null;

  if (!staff) {
    return (
      <div className="min-w-0">
        {lista}
        {autorNoDetalhe && (
          <section aria-label="Detalhe do chamado" className="min-w-0">
            {painelDetalhe}
          </section>
        )}
      </div>
    );
  }

  // mobile: lista OU detalhe; desktop: lado a lado
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
      {lista}
      <section
        aria-label="Detalhe do chamado"
        className={cn("min-w-0", !emFoco && "hidden lg:block")}
      >
        {painelDetalhe ?? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
            <ChatCircleText size={28} aria-hidden />
            Escolha um chamado para ver a conversa.
          </div>
        )}
      </section>
    </div>
  );
}

/** Esqueleto do detalhe durante a navegação — mesma silhueta do artigo
 *  (cabeçalho, mensagens, composer) pra troca não pular. */
function DetalheEsqueleto() {
  return (
    <div
      aria-busy="true"
      aria-label="Carregando chamado"
      className="min-w-0 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]"
    >
      <div className="space-y-3 border-b border-border px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="ml-auto h-8 w-24" />
        </div>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="space-y-5 px-4 py-5 sm:px-5">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
      <div className="border-t border-border px-4 py-4 sm:px-5">
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    </div>
  );
}
