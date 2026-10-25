"use client";

import { useState } from "react";
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
  Trash,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/ciclo";
import type { PdmItemStatus, PdmNo } from "@/lib/pdm";
import { PDM_STATUS_LABEL } from "@/lib/pdm";
import { cn } from "@/lib/utils";

// A árvore recursiva do PDM (REALIZA-181): metas na raiz, submetas
// aninhadas sem limite de profundidade. Acessível como role="tree" —
// treeitem + group, caret com aria-expanded, checkbox do status com
// rótulo falado. A partir do nível 4 o recuo para de crescer (mobile) e
// um chip "nível N" marca a profundidade — o plano pede contexto, não
// indentação infinita. Em lg cada meta veste uma ficha própria (mais
// respiro entre seções do documento) e o indicador de sucesso deixa de
// truncar — metadados do plano merecem ser lidos inteiros.

export type PdmArvoreAcoes = {
  onStatus: (item: PdmNo, status: PdmItemStatus) => void;
  onEditar: (item: PdmNo) => void;
  onNovaSubmeta: (pai: PdmNo) => void;
  onMover: (item: PdmNo, direcao: -1 | 1, irmaos: PdmNo[]) => void;
  onExcluir: (item: PdmNo) => void;
};

const NIVEL_MAX_RECUO = 3; // a partir do 4º nível: recuo fixo + chip

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
  const [aberto, setAberto] = useState(nivel === 0);
  const ehMeta = nivel === 0;
  const filhosVisiveis = no.filhos;
  const temFilhos = filhosVisiveis.length > 0;
  const descartada = no.status === "descartada";
  const atingida = no.status === "atingida";
  const profundo = nivel >= NIVEL_MAX_RECUO;

  return (
    <li
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
        {/* caret do nó — 44px de alvo no mobile (32px a partir de sm),
            gira com o estado */}
        {temFilhos ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setAberto((v) => !v)}
            aria-label={
              aberto
                ? `Recolher subitens de "${no.titulo}"`
                : `Expandir ${filhosVisiveis.length} subitens de "${no.titulo}"`
            }
            className="shrink-0 text-muted-foreground"
          >
            <CaretRight
              className={cn("transition-transform", aberto && "rotate-90")}
              aria-hidden
            />
          </Button>
        ) : (
          <span aria-hidden className="size-11 shrink-0 sm:size-8" />
        )}

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
        <div className="min-w-0 flex-1 pt-1">
          <p
            className={cn(
              "text-sm leading-snug",
              ehMeta ? "font-semibold sm:text-[15px]" : "font-medium",
              (atingida || descartada) && "text-muted-foreground",
              descartada && "line-through decoration-muted-foreground/50"
            )}
          >
            {profundo && (
              <span className="mr-1.5 inline-block rounded bg-muted px-1 py-0.5 align-middle text-[10px] font-semibold text-muted-foreground">
                nível {nivel + 1}
              </span>
            )}
            {no.titulo}
          </p>
          {no.porque && (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {no.porque}
            </p>
          )}
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground sm:gap-x-3">
            {no.areaVida && (
              <Badge variant="outline" className="text-[10px] font-medium">
                {no.areaVida}
              </Badge>
            )}
            {no.indicador && (
              <span className="inline-flex items-center gap-1">
                <Target size={12} aria-hidden className="shrink-0" />
                {/* cresce com a tela e em lg para de truncar — o IS é a
                    prova da meta, não decoração */}
                <span className="max-w-64 truncate sm:max-w-80 lg:max-w-none lg:whitespace-normal">
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
          </span>
        </div>

        {/* ações do item — menu de overflow (mobile-friendly: um alvo só) */}
        {podeEditar && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Ações de "${no.titulo}"`}
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
                  onClick={() => acoes.onStatus(no, "atingida")}
                >
                  <Flag size={16} aria-hidden data-icon="inline-start" />
                  Marcar como atingida
                </DropdownMenuItem>
              )}
              {descartada ? (
                <DropdownMenuItem
                  onClick={() => acoes.onStatus(no, "ativa")}
                >
                  <CheckCircle size={16} aria-hidden data-icon="inline-start" />
                  Retomar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => acoes.onStatus(no, "descartada")}
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
          profundidade); aberto por padrão nas metas */}
      {temFilhos && aberto && (
        <div
          className={cn(
            "border-l border-dashed border-border",
            // recuo um pouco mais generoso a partir de sm — a hierarquia
            // do mapa lê melhor com folga na borda
            profundo ? "ml-8 sm:ml-10" : "ml-5 sm:ml-7"
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
        </div>
      )}
    </li>
  );
}
