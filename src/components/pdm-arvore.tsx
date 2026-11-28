"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  CalendarBlank,
  CaretRight,
  CheckCircle,
  Circle,
  DotsThreeVertical,
  Flag,
  PencilSimple,
  Plus,
  Prohibit,
  Target,
  TextT,
  Trash,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { T } from "@/components/motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/ciclo";
import type { PdmItemStatus, PdmNo } from "@/lib/pdm";
import { autorEdicaoItem, PDM_STATUS_LABEL } from "@/lib/pdm";
import { cn } from "@/lib/utils";

// A árvore recursiva do PDM (REALIZA-181): metas na raiz, submetas
// aninhadas sem limite de profundidade. Acessível como role="tree" —
// treeitem + group, o próprio título do nó é o controle de expandir (sem
// coluna exclusiva de caret — no celular cada pixel conta), checkbox do
// status com rótulo falado. A partir do nível 4 o recuo para de crescer
// (mobile) e um chip "nível N" marca a profundidade — o plano pede
// contexto, não indentação infinita. Em lg cada meta veste uma ficha
// própria (mais respiro entre seções do documento) e o indicador de
// sucesso deixa de truncar — metadados do plano merecem ser lidos
// inteiros.
//
// Edição (REALIZA-487): o título de uma folha editável abre a renomeação
// inline (Enter/blur salvam, Esc cancela); pais renomeiam pelo ⋮. O gesto
// "nova submeta" de cada meta sai do ⋮ e vira um botão visível no fim do
// bloco dela — o menu segue pra prioridade, descarte e exclusão.

export type PdmArvoreAcoes = {
  onStatus: (
    item: PdmNo,
    status: PdmItemStatus,
    origem?: "status" | "menu"
  ) => void;
  onEditar: (item: PdmNo) => void;
  /** Renomeação inline — o pai persiste o título novo com os demais
   *  campos do item intactos. */
  onRenomear: (item: PdmNo, titulo: string) => void;
  onNovaSubmeta: (pai: PdmNo) => void;
  onMover: (item: PdmNo, direcao: -1 | 1, irmaos: PdmNo[]) => void;
  onExcluir: (item: PdmNo) => void;
  /** Abre a resposta que projetou o item (quando a página consegue
   *  resolver a proveniência sem schema novo). */
  onVerOrigem?: (item: PdmNo) => void;
};

const NIVEL_MAX_RECUO = 3; // a partir do 4º nível: recuo fixo + chip

// 526 — proveniência: o doc mistura itens projetados das respostas dos
// instrumentos e escrita à mão; a marca "vinda do instrumento" separa os
// dois sem tirar a editabilidade de nenhum
const ORIGEM_INSTRUMENTO = {
  metas: "Metas",
  pdm: "PDM",
  visao: "Visão",
} as const;

export function PdmArvore({
  nos,
  irmaos,
  nivel = 0,
  podeEditar,
  podeAdicionarSub,
  acoes,
}: {
  nos: PdmNo[];
  /** A lista completa de irmãos deste nível (serve pra desabilitar
   *  subir/descer nas pontas e pra remontar a ordem inteira no servidor). */
  irmaos?: PdmNo[];
  nivel?: number;
  podeEditar: boolean;
  /** true enquanto o doc cabe mais um subitem (teto 20/documento). */
  podeAdicionarSub: boolean;
  acoes: PdmArvoreAcoes;
}) {
  const lista = irmaos ?? nos;
  return (
    <ul
      role={nivel === 0 ? "tree" : "group"}
      className={cn(nivel === 0 && "space-y-2 lg:space-y-3")}
    >
      {nos.map((no, i) => (
        <NoPdm
          key={no.id}
          no={no}
          nivel={nivel}
          posicao={i}
          total={lista.length}
          podeEditar={podeEditar}
          podeAdicionarSub={podeAdicionarSub}
          acoes={acoes}
          irmaos={lista}
        />
      ))}
    </ul>
  );
}

function NoPdm({
  no,
  nivel,
  posicao,
  total,
  podeEditar,
  podeAdicionarSub,
  acoes,
  irmaos,
}: {
  no: PdmNo;
  nivel: number;
  posicao: number;
  total: number;
  podeEditar: boolean;
  podeAdicionarSub: boolean;
  acoes: PdmArvoreAcoes;
  irmaos: PdmNo[];
}) {
  // motion.layout é FLIP: mede antes/depois e anima só transform. Com
  // reduced-motion a reordenação continua acontecendo, só sem deslocamento.
  const reducedMotion = useReducedMotion();
  const [aberto, setAberto] = useState(nivel === 0);
  const [renomeando, setRenomeando] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const tituloBtnRef = useRef<HTMLButtonElement>(null);
  // Esc/Enter devolvem o foco ao título ao fechar a renomeação — no blur
  // a decisão de onde o foco vai é do ponteiro, não nossa
  const focoVolta = useRef(false);
  // Esc desmonta o input: o blur que vem depois não pode salvar o rascunho
  const cancelou = useRef(false);
  const ehMeta = nivel === 0;
  const filhosVisiveis = no.filhos;
  const temFilhos = filhosVisiveis.length > 0;
  const descartada = no.status === "descartada";
  const atingida = no.status === "atingida";
  const profundo = nivel >= NIVEL_MAX_RECUO;
  // autoria (0211): "editado por" só quando a última escrita mudou de
  // mãos — o próprio autor ajustando não vira selo redundante
  const editadoPor = autorEdicaoItem(no);
  // o "+ submeta" visível é gesto de meta (nível 0) — nos níveis
  // aninhados o ⋮ continua sendo a porta
  const botaoSubmetaVisivel = ehMeta && podeAdicionarSub && !descartada;

  useEffect(() => {
    if (!renomeando && focoVolta.current) {
      focoVolta.current = false;
      tituloBtnRef.current?.focus();
    }
  }, [renomeando]);

  function iniciarRenome() {
    setNovoTitulo(no.titulo);
    setRenomeando(true);
  }

  function confirmarRenome() {
    if (cancelou.current) {
      cancelou.current = false;
      return;
    }
    const titulo = novoTitulo.trim();
    if (titulo && titulo !== no.titulo) acoes.onRenomear(no, titulo);
    setRenomeando(false);
  }

  // a linha do título é o controle do nó: em pai ela expande/recolhe
  // (o caret gira dentro dela — sem coluna exclusiva), em folha editável
  // ela abre a renomeação inline; em leitura é texto puro
  const linhaTitulo = (
    <span
      className={cn(
        "block text-sm leading-snug",
        ehMeta ? "font-semibold sm:text-[15px]" : "font-medium",
        (atingida || descartada) && "text-muted-foreground",
        descartada && "line-through decoration-muted-foreground/50"
      )}
    >
      {temFilhos && (
        <CaretRight
          size={13}
          weight="bold"
          aria-hidden
          className={cn(
            "mr-1 inline-block align-[-0.125em] text-muted-foreground transition-transform",
            aberto && "rotate-90"
          )}
        />
      )}
      {profundo && (
        <span className="mr-1.5 inline-block rounded bg-muted px-1 py-0.5 align-middle text-[10px] font-semibold text-muted-foreground">
          nível {nivel + 1}
        </span>
      )}
      {no.titulo}
      {!temFilhos && podeEditar && (
        <PencilSimple
          size={13}
          aria-hidden
          className="ml-1.5 inline-block align-[-0.1em] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-70 group-focus-within:opacity-70"
        />
      )}
    </span>
  );

  return (
    <motion.li
      layout={reducedMotion ? false : "position"}
      transition={T.pill}
      role="treeitem"
      aria-expanded={temFilhos ? aberto : undefined}
      aria-selected={false}
      className={cn(
        nivel > 0 && "mt-1 sm:mt-1.5",
        // em telas largas a meta vira uma ficha — a seção do documento
        // ganha respiro sem mexer na estrutura da árvore
        ehMeta && "lg:rounded-xl lg:border lg:border-border/60 lg:px-3 lg:py-2.5"
      )}
    >
      <div
        className={cn(
          "group flex items-start gap-1 rounded-lg px-1.5 py-1.5 transition-colors sm:gap-1.5 sm:px-2 sm:py-2",
          ehMeta ? "bg-muted/40" : "hover:bg-muted/40",
          descartada && "opacity-60"
        )}
      >
        {/* status — o círculo é o gesto de "bati a meta": atingida ↔ ativa.
            Leitor de tela ouve o título + o que o toque faz */}
        {podeEditar ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={atingida}
            aria-label={
              atingida
                ? `Marcar "${no.titulo}" como em andamento`
                : `Marcar "${no.titulo}" como atingida`
            }
            onClick={() =>
              acoes.onStatus(no, atingida ? "ativa" : "atingida")
            }
            data-pdm-focus={`${no.id}:status`}
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-8",
              atingida
                ? "text-[var(--ok)]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {atingida ? (
              <CheckCircle size={22} weight="fill" aria-hidden />
            ) : (
              <Circle size={22} aria-hidden />
            )}
          </button>
        ) : (
          <span
            aria-hidden
            className={cn(
              "grid size-11 shrink-0 place-items-center sm:size-8",
              atingida ? "text-[var(--ok)]" : "text-muted-foreground/60"
            )}
          >
            {atingida ? (
              <CheckCircle size={22} weight="fill" />
            ) : descartada ? (
              <Prohibit size={20} />
            ) : (
              <Circle size={22} />
            )}
          </span>
        )}

        {/* título + metadados */}
        <div className="min-w-0 flex-1 pt-0.5">
          {renomeando ? (
            <form
              className="px-1 py-0.5"
              onSubmit={(e) => {
                e.preventDefault();
                focoVolta.current = true;
                confirmarRenome();
              }}
            >
              <Input
                value={novoTitulo}
                onChange={(e) => setNovoTitulo(e.target.value)}
                onBlur={confirmarRenome}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancelou.current = true;
                    focoVolta.current = true;
                    setRenomeando(false);
                  }
                }}
                autoFocus
                maxLength={500}
                aria-label={`Renomear "${no.titulo}"`}
                className="h-9 font-medium md:h-8"
              />
            </form>
          ) : (
            <>
              {temFilhos ? (
                <button
                  ref={tituloBtnRef}
                  type="button"
                  onClick={() => setAberto((v) => !v)}
                  aria-expanded={aberto}
                  aria-label={
                    aberto
                      ? `Recolher subitens de "${no.titulo}"`
                      : `Expandir ${filhosVisiveis.length} subitens de "${no.titulo}"`
                  }
                  data-pdm-focus={`${no.id}:titulo`}
                  className="block w-full rounded-md px-1 py-0.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {linhaTitulo}
                </button>
              ) : podeEditar ? (
                <button
                  ref={tituloBtnRef}
                  type="button"
                  onClick={iniciarRenome}
                  title="Renomear"
                  aria-label={`Renomear "${no.titulo}"`}
                  data-pdm-focus={`${no.id}:titulo`}
                  className="block w-full rounded-md px-1 py-0.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {linhaTitulo}
                </button>
              ) : (
                <div className="px-1 py-0.5">{linhaTitulo}</div>
              )}
            </>
          )}
          {no.porque && (
            <p className="mt-0.5 px-1 text-xs leading-relaxed text-muted-foreground">
              {no.porque}
            </p>
          )}
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 px-1 text-xs text-muted-foreground sm:gap-x-3 sm:text-[11px]">
            {no.areaVida && (
              <Badge variant="outline" className="text-[10px] font-medium">
                {no.areaVida}
              </Badge>
            )}
            {no.origem !== "manual" && ORIGEM_INSTRUMENTO[no.origem] && (
              acoes.onVerOrigem ? (
                <button
                  type="button"
                  onClick={() => acoes.onVerOrigem?.(no)}
                  aria-label={`Ver a resposta do instrumento ${ORIGEM_INSTRUMENTO[no.origem]} que projetou "${no.titulo}"`}
                  className="inline-flex items-center gap-1 rounded-sm italic underline decoration-muted-foreground/45 underline-offset-2 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  vinda do instrumento {ORIGEM_INSTRUMENTO[no.origem]} · ver resposta
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 italic">
                  vinda do instrumento {ORIGEM_INSTRUMENTO[no.origem]}
                </span>
              )
            )}
            {no.indicador && (
              <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                <Target size={12} aria-hidden className="shrink-0" />
                {/* cresce com a tela e em lg para de truncar — o IS é a
                    prova da meta, não decoração. min-w-0 + max-w-full: a
                    linha indentada do mobile cabe ~250px e o truncate sem
                    eles estourava o viewport (scrollWidth 406). line-clamp-2
                    em vez de truncate: sem hover no toque e sem ficha pro
                    leitor read-only (coord/supervisor), 2 linhas são o
                    caminho de leitura */}
                <span
                  title={no.indicador}
                  className="min-w-0 max-w-64 line-clamp-2 sm:max-w-80 lg:max-w-none lg:line-clamp-none"
                >
                  {no.indicador}
                </span>
              </span>
            )}
            {no.prazoAlvo && (
              <span className="inline-flex items-center gap-1">
                <CalendarBlank size={12} aria-hidden className="shrink-0" />
                até {formatDate(no.prazoAlvo)}
              </span>
            )}
            {atingida && no.atingidaEm && (
              <span className="inline-flex items-center gap-1 font-medium text-[var(--ok-text)]">
                <CheckCircle size={12} aria-hidden className="shrink-0" />
                atingida em {formatDate(no.atingidaEm)}
              </span>
            )}
            {descartada && (
              <span className="italic">{PDM_STATUS_LABEL.descartada}</span>
            )}
            {editadoPor && (
              <span className="inline-flex items-center gap-1 italic">
                <PencilSimple size={12} aria-hidden className="shrink-0" />
                editado por {editadoPor.nome}
                {no.atualizadoEm ? ` em ${formatDate(no.atualizadoEm)}` : ""}
              </span>
            )}
          </span>
        </div>

        {/* ações do item — menu de overflow (mobile-friendly: um alvo só) */}
        {podeEditar && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Ações de "${no.titulo}"`}
              data-pdm-focus={`${no.id}:menu`}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "size-11 shrink-0 sm:size-8"
              )}
            >
              <DotsThreeVertical size={18} weight="bold" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => acoes.onEditar(no)}>
                <PencilSimple size={16} aria-hidden data-icon="inline-start" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={iniciarRenome}>
                <TextT size={16} aria-hidden data-icon="inline-start" />
                Renomear
              </DropdownMenuItem>
              {!descartada && (
                <>
                  <DropdownMenuItem
                    disabled={posicao === 0}
                    onClick={() => acoes.onMover(no, -1, irmaos)}
                  >
                    <ArrowUp size={16} aria-hidden data-icon="inline-start" />
                    Subir na prioridade
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={posicao === total - 1}
                    onClick={() => acoes.onMover(no, 1, irmaos)}
                  >
                    <ArrowDown size={16} aria-hidden data-icon="inline-start" />
                    Descer na prioridade
                  </DropdownMenuItem>
                </>
              )}
              {podeAdicionarSub && !descartada && (
                <DropdownMenuItem onClick={() => acoes.onNovaSubmeta(no)}>
                  <Plus size={16} aria-hidden data-icon="inline-start" />
                  Adicionar submeta
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {!atingida && !descartada && (
                <DropdownMenuItem
                  onClick={() => acoes.onStatus(no, "atingida", "menu")}
                >
                  <Flag size={16} aria-hidden data-icon="inline-start" />
                  Marcar como atingida
                </DropdownMenuItem>
              )}
              {descartada ? (
                <DropdownMenuItem
                  onClick={() => acoes.onStatus(no, "ativa", "menu")}
                >
                  <CheckCircle size={16} aria-hidden data-icon="inline-start" />
                  Retomar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => acoes.onStatus(no, "descartada", "menu")}
                >
                  <Prohibit size={16} aria-hidden data-icon="inline-start" />
                  Descartar (fica no histórico)
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => acoes.onExcluir(no)}
              >
                <Trash size={16} aria-hidden data-icon="inline-start" />
                Excluir de vez
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* filhos — o recuo para de crescer no nível 4 (o chip já diz a
          profundidade); aberto por padrão nas metas. No mobile o recuo é
          mínimo: o caret virou parte do título e a margem carrega sozinha
          a hierarquia */}
      {temFilhos && aberto && (
        <div
          className={cn(
            "border-l border-dashed border-border",
            profundo ? "ml-2 sm:ml-4" : "ml-4 sm:ml-6"
          )}
        >
          <PdmArvore
            nos={filhosVisiveis}
            irmaos={filhosVisiveis}
            nivel={nivel + 1}
            podeEditar={podeEditar}
            podeAdicionarSub={podeAdicionarSub}
            acoes={acoes}
          />
          {botaoSubmetaVisivel && (
            <div className="px-1.5 pb-1.5 pt-0.5">
              <BotaoNovaSubmeta pai={no} onNovaSubmeta={acoes.onNovaSubmeta} />
            </div>
          )}
        </div>
      )}
      {/* o fim da meta é onde a submeta nasce — o gesto fica visível,
          não depende de abrir o ⋮ (nem de a meta ter filhos ainda) */}
      {botaoSubmetaVisivel && !(temFilhos && aberto) && (
        <div className="ml-4 mt-0.5 sm:ml-6">
          <BotaoNovaSubmeta pai={no} onNovaSubmeta={acoes.onNovaSubmeta} />
        </div>
      )}
    </motion.li>
  );
}

function BotaoNovaSubmeta({
  pai,
  onNovaSubmeta,
}: {
  pai: PdmNo;
  onNovaSubmeta: (pai: PdmNo) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => onNovaSubmeta(pai)}
      aria-label={`Nova submeta em "${pai.titulo}"`}
      className="w-full justify-start text-muted-foreground hover:text-foreground sm:w-auto"
    >
      <Plus size={14} data-icon="inline-start" aria-hidden />
      Nova submeta
    </Button>
  );
}
