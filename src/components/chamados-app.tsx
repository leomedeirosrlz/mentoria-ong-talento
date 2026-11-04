"use client";

// A fila de chamados (staff = master-detail, mentor/jovem = "meus
// pedidos"). O detalhe mora em chamado-detalhe.tsx e as pills/helpers
// compartilhados em chamados-shared.tsx — home do mentor e perfil do
// jovem importam só o que usam.

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  CaretRight,
  ChatCircleText,
  Lifebuoy,
  Plus,
} from "@phosphor-icons/react";
import type { ChamadoFilaItem, ChamadoTimelineItem } from "@/lib/types";
import {
  CHAMADO_CATEGORIA_LABEL,
  CHAMADO_ORIGEM_LABEL,
  CHAMADO_STATUS_LABEL,
} from "@/lib/ciclo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FiltrosButton } from "@/components/ui/filtros-button";
import { NovoChamadoDialog } from "@/components/novo-chamado-dialog";
import { ChamadoDetalhe } from "@/components/chamado-detalhe";
import {
  CategoriaBadge,
  ChamadoStatusBadge,
  relTempo,
  type Equipe,
} from "@/components/chamados-shared";

type Papel = string;

const OVERLINE =
  "text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[11px]";

function idadeAberto(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "hoje";
  if (d === 1) return "há 1 dia";
  return `há ${d} dias`;
}

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
  const [fFila, setFFila] = useState<
    "todos" | "fila" | "semdono" | "meus" | "resolvidos"
  >("todos");
  const [fCategoria, setFCategoria] = useState<string>("todas");
  const [fStatus, setFStatus] = useState<string>("todos");
  // categoria/estado são secundários — moram no painel "Filtros (n)",
  // não na barra (o modal aplica de uma vez, como em /registros)
  const [painelAberto, setPainelAberto] = useState(false);
  const [draftCat, setDraftCat] = useState("todas");
  const [draftStatus, setDraftStatus] = useState("todos");

  // critério só oferece valores que existem na fila — categoria/estado
  // sem nenhum chamado não filtra nada; select com <2 opções úteis nem
  // renderiza (um filtro ativo mantém o controle pra não prender ninguém)
  const categoriasPresentes = useMemo(
    () =>
      Object.keys(CHAMADO_CATEGORIA_LABEL).filter((k) =>
        itens.some((c) => c.categoria === k)
      ),
    [itens]
  );
  const estadosPresentes = useMemo(
    () =>
      Object.keys(CHAMADO_STATUS_LABEL).filter((k) =>
        itens.some((c) => c.status === k)
      ),
    [itens]
  );
  const catShow = categoriasPresentes.length >= 2 || fCategoria !== "todas";
  const statusShow = estadosPresentes.length >= 2 || fStatus !== "todos";
  const temSecundarios = catShow || statusShow;
  const ativosSec =
    (fCategoria !== "todas" ? 1 : 0) + (fStatus !== "todos" ? 1 : 0);
  const draftAtivos =
    (draftCat !== "todas" ? 1 : 0) + (draftStatus !== "todos" ? 1 : 0);

  const filtrados = useMemo(() => {
    let l = itens;
    if (staff) {
      if (fFila === "fila") l = l.filter((c) => c.status === "aberto");
      // "sem dono" exclui restrito: pro auxiliar o atribuido_a chega
      // mascarado (null) e a linha contaria errado como sem-dono
      if (fFila === "semdono")
        l = l.filter(
          (c) => c.status === "aberto" && !c.atribuido_a && !c.restrito
        );
      if (fFila === "meus")
        l = l.filter((c) => c.atribuido_a === meuId && c.status !== "resolvido");
      if (fFila === "resolvidos") l = l.filter((c) => c.status === "resolvido");
      if (fCategoria !== "todas")
        l = l.filter((c) => c.categoria === fCategoria);
      if (fStatus !== "todos") l = l.filter((c) => c.status === fStatus);
    }
    const q = busca.trim().toLowerCase();
    if (q) {
      l = l.filter(
        (c) =>
          c.numero.toLowerCase().includes(q) ||
          (c.assunto ?? "").toLowerCase().includes(q) ||
          (c.autor_nome ?? "").toLowerCase().includes(q)
      );
    }
    return l;
  }, [itens, staff, fFila, fCategoria, fStatus, busca, meuId]);

  // contagens dos chips da fila (mock: "Todos 8 · Sem dono 3 · ...") — o
  // predicado é o mesmo do filtro, então chip e resultado nunca divergem
  const contFila = useMemo(
    () => ({
      todos: itens.length,
      fila: itens.filter((c) => c.status === "aberto").length,
      semdono: itens.filter(
        (c) => c.status === "aberto" && !c.atribuido_a && !c.restrito
      ).length,
      meus: itens.filter(
        (c) => c.atribuido_a === meuId && c.status !== "resolvido"
      ).length,
      resolvidos: itens.filter((c) => c.status === "resolvido").length,
    }),
    [itens, meuId]
  );

  const naFila = itens.filter((c) => c.status === "aberto" && !c.restrito);
  const maisAntigo = naFila.length
    ? naFila.reduce((a, b) =>
        new Date(a.created_at) < new Date(b.created_at) ? a : b
      )
    : null;

  const sel = selecionadoInicial;
  const detalhe = detalheInicial;

  function abrir(id: string) {
    router.push(`/chamados?c=${id}`);
  }
  function fechar() {
    router.push("/chamados");
  }

  // mobile: lista OU detalhe; desktop: lado a lado
  return (
    <div
      className={cn(
        "grid gap-4",
        staff && "lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start"
      )}
    >
      <section
        aria-label={staff ? "Fila de chamados" : "Seus chamados"}
        className={cn("min-w-0", sel && staff && "hidden lg:block")}
      >
        {staff && (
          <div className="mb-3 space-y-2.5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lifebuoy size={15} aria-hidden className="shrink-0" />
              <span>
                <strong className="text-foreground">{naFila.length}</strong> na
                fila
                {maisAntigo && (
                  <>
                    {" "}· mais antigo {idadeAberto(maisAntigo.created_at)}
                  </>
                )}
              </span>
            </div>
            {/* "Busca + Filtros (n)" — a linha compacta; categoria/estado
                são secundários e moram no painel (Dialog, padrão
                /registros). Chips de fila ficam inline por serem a
                navegação principal, e chip com 0 resultado não renderiza */}
            <div className="flex items-center gap-2">
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar nº, assunto ou autor…"
                aria-label="Buscar chamado"
                className="h-11 min-w-0 flex-1 text-sm md:h-9 md:max-w-64"
              />
              {temSecundarios && (
                <FiltrosButton
                  ativos={ativosSec}
                  onClick={() => {
                    setDraftCat(fCategoria);
                    setDraftStatus(fStatus);
                    setPainelAberto(true);
                  }}
                />
              )}
            </div>
            <div
              role="group"
              aria-label="Filtrar por fila"
              className="flex flex-wrap gap-1.5"
            >
              {(
                [
                  ["todos", "Todos"],
                  ["fila", "Na fila"],
                  ["semdono", "Sem dono"],
                  ["meus", "Meus"],
                  ["resolvidos", "Resolvidos"],
                ] as const
              ).map(([v, l]) => {
                const n = contFila[v];
                // chip com 0 resultado não filtra nada — esconde (o ativo
                // fica pra não prender a pessoa num filtro sem saída)
                if (v !== "todos" && n === 0 && fFila !== v) return null;
                return (
                  <button
                    key={v}
                    onClick={() => setFFila(v)}
                    aria-pressed={fFila === v}
                    className={cn(
                      "min-h-11 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8",
                      fFila === v
                        ? "border-transparent bg-foreground text-background"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {l}{" "}
                    <span
                      className={cn(
                        "text-[10px] font-semibold tabular-nums",
                        fFila === v ? "opacity-70" : "text-muted-foreground"
                      )}
                    >
                      {n}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {staff && (
          <Dialog open={painelAberto} onOpenChange={setPainelAberto}>
            <DialogContent size="md">
              <DialogHeader>
                <DialogTitle>Filtros</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {catShow && (
                  <fieldset>
                    <legend className={OVERLINE}>Categoria</legend>
                    <div className="mt-1.5">
                      <Select
                        value={draftCat}
                        onValueChange={(v) => setDraftCat(v ?? "todas")}
                      >
                        <SelectTrigger aria-label="Filtrar por categoria">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todas">
                            Todas as categorias
                          </SelectItem>
                          {categoriasPresentes.map((v) => (
                            <SelectItem key={v} value={v}>
                              {
                                CHAMADO_CATEGORIA_LABEL[
                                  v as keyof typeof CHAMADO_CATEGORIA_LABEL
                                ]
                              }
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </fieldset>
                )}
                {statusShow && (
                  <fieldset>
                    <legend className={OVERLINE}>Estado</legend>
                    <div className="mt-1.5">
                      <Select
                        value={draftStatus}
                        onValueChange={(v) => setDraftStatus(v ?? "todos")}
                      >
                        <SelectTrigger aria-label="Filtrar por estado">
                          <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">
                            Todos os estados
                          </SelectItem>
                          {estadosPresentes.map((v) => (
                            <SelectItem key={v} value={v}>
                              {
                                CHAMADO_STATUS_LABEL[
                                  v as keyof typeof CHAMADO_STATUS_LABEL
                                ]
                              }
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </fieldset>
                )}
              </div>
              <DialogFooter sticky>
                <Button
                  type="button"
                  variant="ghost"
                  className="sm:me-auto"
                  disabled={draftAtivos === 0}
                  onClick={() => {
                    setDraftCat("todas");
                    setDraftStatus("todos");
                  }}
                >
                  Limpar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setFCategoria(draftCat);
                    setFStatus(draftStatus);
                    setPainelAberto(false);
                  }}
                >
                  Aplicar{draftAtivos > 0 ? ` (${draftAtivos})` : ""}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        {!staff && (
          <div className="mb-3 flex items-center justify-between gap-3">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nos seus chamados…"
              aria-label="Buscar chamado"
              className="h-11 max-w-72 text-sm md:h-9"
            />
            <NovoChamadoDialog
              papel={papel}
              duplas={duplas}
              trigger={
                <Button size="sm">
                  <Plus size={15} aria-hidden />
                  Novo pedido
                </Button>
              }
            />
          </div>
        )}
        {staff && (
          <div className="mb-3 flex justify-end">
            <NovoChamadoDialog
              papel={papel}
              duplas={duplas}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus size={15} aria-hidden />
                  Abrir chamado
                </Button>
              }
            />
          </div>
        )}
        {/* a troca de filtro/busca re-monta a lista — o animate-enter
            re-roda por linha em vez de um repaint seco (convenção) */}
        <ul
          key={`${fFila}|${fCategoria}|${fStatus}|${busca}`}
          className="space-y-2"
        >
          {filtrados.length === 0 && (
            <li className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
              {staff
                ? "Nenhum chamado nessa visão. Bom trabalho de fila!"
                : "Você ainda não abriu nenhum pedido. Se precisar, é só tocar em “Novo pedido”."}
            </li>
          )}
          {filtrados.map((c, i) => (
            <li
              key={c.id}
              className="animate-enter min-w-0"
              style={{ "--i": Math.min(i, 10) } as CSSProperties}
            >
              <button
                onClick={() => abrir(c.id)}
                aria-current={sel === c.id ? "true" : undefined}
                className={cn(
                  "block w-full min-w-0 rounded-xl border bg-card px-4 py-3 text-left shadow-[var(--shadow-border)] transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  sel === c.id ? "border-foreground/30 ring-1 ring-foreground/20" : "border-transparent"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {c.numero}
                  </span>
                  <CategoriaBadge categoria={c.categoria} />
                  <span className="ml-auto flex shrink-0 items-center gap-1 text-xs sm:text-[11px] text-muted-foreground">
                    <time dateTime={c.created_at}>{relTempo(c.created_at)}</time>
                    <CaretRight size={12} aria-hidden />
                  </span>
                </div>
                <p className="mt-1 break-words text-sm font-medium leading-snug">
                  {c.restrito
                    ? "Chamado restrito à coordenação"
                    : c.assunto}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {c.restrito
                    ? "Assunto e autor visíveis só pra coordenação."
                    : staff
                      ? [
                          c.autor_nome ? `por ${c.autor_nome}` : null,
                          CHAMADO_ORIGEM_LABEL[c.origem],
                          c.contexto,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : [
                          c.mentorado_nome
                            ? `Mentorado: ${c.mentorado_nome}`
                            : null,
                          `Atualizado ${relTempo(c.updated_at)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                </p>
                <div className="mt-1.5">
                  <ChamadoStatusBadge
                    status={c.status}
                    dono={c.restrito ? null : c.atribuido_nome}
                    restrito={c.restrito}
                    visao={staff ? "staff" : "autor"}
                    className="text-[11px]"
                  />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {staff && (
        <section aria-label="Detalhe do chamado" className={cn("min-w-0", !sel && "hidden lg:block")}>
          {detalhe ? (
            <ChamadoDetalhe
              key={detalhe.chamado.id}
              papel={papel}
              meuId={meuId}
              meuNome={meuNome}
              chamado={detalhe.chamado}
              timeline={detalhe.timeline}
              equipe={detalhe.equipe}
              onVoltar={fechar}
            />
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              <ChatCircleText size={28} aria-hidden />
              Selecione um chamado da fila pra ver a conversa.
            </div>
          )}
        </section>
      )}
      {!staff && sel && detalhe && (
        <section aria-label="Detalhe do pedido" className="min-w-0">
          <ChamadoDetalhe
            key={detalhe.chamado.id}
            papel={papel}
            meuId={meuId}
            meuNome={meuNome}
            chamado={detalhe.chamado}
            timeline={detalhe.timeline}
            equipe={detalhe.equipe}
            onVoltar={fechar}
          />
        </section>
      )}
    </div>
  );
}
