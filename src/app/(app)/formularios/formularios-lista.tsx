"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Funnel } from "@phosphor-icons/react";
import type { FormularioListaItem } from "@/lib/forms/queries";
import { SISTEMA_LABEL } from "@/lib/forms/schema";
import { formatDate } from "@/lib/ciclo";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { filterChipCls } from "@/components/ui/filter-chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Filtro = "todos" | "ativos" | "encerrados" | "pendentes";
type Ordem = "recentes" | "titulo" | "pendencias";

const CHIPS: { id: Filtro; label: string; bate: (f: FormularioListaItem) => boolean }[] = [
  { id: "todos", label: "Todos", bate: () => true },
  { id: "ativos", label: "Ativos", bate: (f) => f.ativo },
  { id: "encerrados", label: "Encerrados", bate: (f) => !f.ativo },
  // "com pendências" = links vivos esperando resposta — o número acionável
  { id: "pendentes", label: "Com pendências", bate: (f) => f.pendentes > 0 },
];

const ORDEM_LABEL: Record<Ordem, string> = {
  recentes: "Recentes",
  titulo: "Título A–Z",
  pendencias: "Mais pendências",
};

/** Lista de formulários da coordenação — filtro e ordenação vivem no
 *  cliente: o universo é pequeno e já veio inteiro do server. */
export function FormulariosLista({
  formularios,
}: {
  formularios: FormularioListaItem[];
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [ordem, setOrdem] = useState<Ordem>("recentes");

  const filtrados = formularios.filter(
    (f) => CHIPS.find((c) => c.id === filtro)!.bate(f)
  );
  const exibidos = [...filtrados].sort(
    ordem === "titulo"
      ? (a, b) =>
          a.titulo.localeCompare(b.titulo, "pt-BR", { sensitivity: "base" })
      : ordem === "pendencias"
        ? (a, b) =>
            b.pendentes - a.pendentes ||
            b.created_at.localeCompare(a.created_at)
        : (a, b) => b.created_at.localeCompare(a.created_at)
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* um toque filtra, um toque no ativo volta pra "Todos"; a contagem
            junto do chip já diz se vale o clique */}
        <div
          role="group"
          aria-label="Filtrar formulários"
          className="flex flex-wrap items-center gap-1.5"
        >
          {CHIPS.map((c) => {
            const n = formularios.filter(c.bate).length;
            const ativo = filtro === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={ativo}
                onClick={() => setFiltro(ativo ? "todos" : c.id)}
                className={filterChipCls(ativo)}
              >
                {c.label}
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    ativo ? "text-background/70" : "text-muted-foreground/70"
                  )}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
        <Select
          value={ordem}
          onValueChange={(v) => setOrdem(v as Ordem)}
          items={ORDEM_LABEL}
        >
          <SelectTrigger
            size="sm"
            aria-label="Ordenar"
            className="ml-auto w-auto sm:w-44"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {(Object.entries(ORDEM_LABEL) as [Ordem, string][]).map(
              ([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      {exibidos.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl bg-card px-6 py-10 text-center shadow-[var(--shadow-border)]">
          <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
            <Funnel size={18} aria-hidden />
          </span>
          <p className="mt-3 font-medium">Nenhum formulário nesse filtro.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setFiltro("todos")}
          >
            Ver todos
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {exibidos.map((f, i) => (
            <li
              key={f.id}
              className="animate-enter"
              style={{ "--i": Math.min(i, 10) } as CSSProperties}
            >
              <Link
                href={`/formularios/${f.id}`}
                className={cn(
                  "group block rounded-xl bg-card px-4 py-3.5 shadow-[var(--shadow-border)] transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:shadow-[var(--shadow-border-hover)] sm:px-5",
                  // encerrado é histórico — sai do foco visual sem sumir
                  !f.ativo && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium leading-snug">{f.titulo}</h2>
                      {f.sistema && (
                        <Badge
                          variant="outline"
                          className="border-[var(--brand-lime)]/60 bg-[var(--brand-lime)]/10"
                        >
                          oficial · {SISTEMA_LABEL[f.sistema]}
                        </Badge>
                      )}
                      {!f.ativo && (
                        <Badge variant="secondary">Encerrado</Badge>
                      )}
                    </div>
                    {f.descricao && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {f.descricao}
                      </p>
                    )}
                  </div>
                  <ArrowRight
                    size={16}
                    aria-hidden
                    className="mt-1 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
                  />
                </div>
                {/* meta sem contagens zeradas — zero não informa nada e
                    "nenhum link" ganha warn porque é o próximo passo */}
                <p className="mt-2 text-xs text-muted-foreground">
                  {f.campos.length}{" "}
                  {f.campos.length === 1 ? "pergunta" : "perguntas"}
                  {" · "}
                  {f.linksTotal === 0 ? (
                    <span className="font-medium text-[var(--warn-text)]">
                      nenhum link gerado ainda
                    </span>
                  ) : (
                    <>
                      {f.linksTotal} {f.linksTotal === 1 ? "link" : "links"}
                    </>
                  )}
                  {/* encerrado torna o pendente inacionável — sem warn */}
                  {f.pendentes > 0 && (
                    <>
                      {" · "}
                      <span
                        className={
                          f.ativo
                            ? "font-medium text-[var(--warn-text)]"
                            : undefined
                        }
                      >
                        {f.pendentes}{" "}
                        {f.pendentes === 1 ? "pendente" : "pendentes"}
                      </span>
                    </>
                  )}
                  {f.respondidos > 0 && (
                    <>
                      {" · "}
                      <span className="font-medium text-[var(--ok-text)]">
                        {f.respondidos}{" "}
                        {f.respondidos === 1 ? "resposta" : "respostas"}
                      </span>
                    </>
                  )}
                  {" · "}
                  {f.ultimaResposta
                    ? `última resposta em ${formatDate(f.ultimaResposta)}`
                    : `criado em ${formatDate(f.created_at)}`}
                  {f.versao > 1 && ` · v${f.versao}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
