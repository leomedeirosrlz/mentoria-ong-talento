import type { Metadata } from "next";
import type { CSSProperties } from "react";
import {
  ArrowSquareOut,
  BookOpen,
  File,
  FileText,
  FolderOpen,
  LinkSimple,
  PuzzlePiece,
} from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { linkSeguro } from "@/lib/ciclo";
import { getMateriais } from "@/lib/queries";
import type { Material } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Materiais" };

/** Biblioteca do jovem — a RLS (0065) já devolve só audiência 'todos' a
 *  quem tem papel mentorado; nada de filtro de papel por aqui. Versão sem
 *  as ações de staff: o jovem abre, baixa ou espera o "em breve". */

const TIPO_ICONE = {
  guia: BookOpen,
  template: FileText,
  conteudo: PuzzlePiece,
  link: LinkSimple,
} as const;

const TIPO_LABEL = {
  guia: "guia",
  template: "modelo",
  conteudo: "conteúdo",
  link: "link",
} as const;

const GRUPO_TIPO = {
  guia: "Guias",
  template: "Modelos",
  conteudo: "Conteúdos",
  link: "Links",
} as const;

function agrupar(materiais: Material[]): [string, Material[]][] {
  const mapa = new Map<string, Material[]>();
  for (const m of materiais) {
    const rotulo =
      m.encontro_num != null ? `Encontro ${m.encontro_num}` : GRUPO_TIPO[m.tipo];
    mapa.set(rotulo, [...(mapa.get(rotulo) ?? []), m]);
  }
  const peso = (r: string) =>
    r === "Guias"
      ? -1
      : r.startsWith("Encontro")
        ? Number(r.split(" ")[1])
        : r === "Modelos"
          ? 100
          : r === "Conteúdos"
            ? 101
            : 102;
  return [...mapa.entries()].sort(([a], [b]) => peso(a) - peso(b));
}

export default async function JovemMateriais() {
  const materiais = await getMateriais();
  const grupos = agrupar(materiais);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Materiais</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Os guias e conteúdos oficiais do programa.
        </p>
      </header>

      {grupos.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-xl bg-card px-5 py-10 text-center shadow-[var(--shadow-border)]">
          <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
            <FolderOpen size={18} aria-hidden />
          </span>
          <p className="text-sm font-medium">Nenhum material por aqui ainda</p>
          <p className="text-sm text-muted-foreground">
            Os guias e conteúdos do programa aparecem quando a coordenação publicar.
          </p>
        </div>
      ) : (
        grupos.map(([rotulo, itens], i) => (
          <section
            key={rotulo}
            className="animate-enter space-y-2"
            style={{ "--i": Math.min(i, 10) } as CSSProperties}
          >
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {rotulo}
            </h2>
            <div className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
              {itens.map((m) => {
                const Icone = TIPO_ICONE[m.tipo];
                const urlOk = linkSeguro(m.url);
                const href = m.path ? `/api/material/${m.id}` : urlOk;
                const interno = (
                  <>
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted/70 text-muted-foreground">
                      <Icone size={17} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{m.titulo}</p>
                      {m.descricao && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {m.descricao}
                        </p>
                      )}
                      <span className="sr-only">
                        {TIPO_LABEL[m.tipo]}
                        {m.path
                          ? " · arquivo"
                          : urlOk && m.tipo !== "link"
                            ? " · link externo"
                            : ""}
                      </span>
                    </div>
                  </>
                );
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex items-center pr-3 transition-colors",
                      href && "hover:bg-muted/50"
                    )}
                  >
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 flex-1 items-center gap-x-4 px-5 py-3.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                      >
                        {interno}
                      </a>
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center gap-x-4 px-5 py-3.5">
                        {interno}
                      </div>
                    )}
                    {m.path ? (
                      <File size={15} className="shrink-0 text-muted-foreground" aria-hidden />
                    ) : urlOk ? (
                      <ArrowSquareOut size={15} className="shrink-0 text-muted-foreground" aria-hidden />
                    ) : (
                      <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">
                        em breve
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
