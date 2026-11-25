"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  ArrowSquareOut,
  BookOpen,
  File,
  FileText,
  LinkSimple,
  PuzzlePiece,
} from "@phosphor-icons/react";
import { linkSeguro } from "@/lib/ciclo";
import { hrefMaterial, refDoMaterial } from "@/lib/materiais";
import { Badge } from "@/components/ui/badge";
import { LinkComLeitura } from "@/components/material-leitura";
import { MaterialThumb } from "@/components/material-thumb";
import { PreviewLink } from "@/components/material-preview-pdf";
import { HighlightText } from "@/components/highlight-text";
import type { Material } from "@/lib/types";
import { cn } from "@/lib/utils";

// Card do material na view Cartões (spec 029): a anatomia nasceu no
// acervo do jovem (capa borda-a-borda + a linha de sempre embaixo) e é
// compartilhada com a biblioteca do staff — jovem, mentor e coordenação
// veem o mesmo card, sem uma terceira anatomia. A capa segue a tríade:
// documento nativo → faixa "documento"; arquivo → MaterialThumb (1ª
// página do PDF lazy por IO / imagem, fallback de ícone quando o browser
// não embute); link externo → faixa do domínio; sem destino → faixa de
// ícone (o card do jovem nunca chega aí — os "em breve" moram no grupo
// "A caminho"). O card INTEIRO é o link quando há destino e os gestos
// secundários (`acoes`) ficam FORA do <a>, flutuando no canto da capa —
// botão dentro de link seria HTML inválido e comeria o toque.

export const TIPO_ICONE = {
  guia: BookOpen,
  template: FileText,
  conteudo: PuzzlePiece,
  link: LinkSimple,
} as const;

// nome legível do tipo — os ícones são decorativos, este texto é o
// equivalente pra leitor de tela
export const TIPO_LABEL = {
  guia: "guia",
  template: "modelo",
  conteudo: "conteúdo",
  link: "link",
} as const;

export function MaterialCard({
  m,
  docBase = "/materiais/documento",
  acoes = null,
  acoesSempre = false,
  rastrear = false,
  lido = false,
  meta = null,
  marca,
  semDestino = "em breve",
  className,
  style,
}: {
  m: Material;
  /** casa dos documentos nativos — "/jovem/materiais/documento" no acervo
   *  do jovem (a rota do staff expulsa o papel dele). */
  docBase?: string;
  /** ⋯ dos gestos secundários (MaterialActions da coord, MaterialMenu do
   *  leitor) — sibling do <a>, nunca dentro dele. */
  acoes?: ReactNode;
  /** mantém o chip de ações mesmo sem destino — pra coord, que precisa do
   *  "Anexar arquivo" do material sem conteúdo. */
  acoesSempre?: boolean;
  /** marca a leitura no clique (contrato das linhas do staff); o card do
   *  jovem mantém a âncora simples de sempre. */
  rastrear?: boolean;
  /** leitura já registrada (0196) — estado do item inteiro: opacidade +
   *  título sublinhado; o selo "lido" chega via `meta`. */
  lido?: boolean;
  /** linha de meta/badges sob a descrição (staff: tipo · encontro · selos). */
  meta?: ReactNode;
  /** busca ativa — marca os trechos casados no título e na descrição,
   *  como a Linha faz na view Lista. */
  marca?: string;
  /** selo do material sem destino — "em breve" pro leitor, "sem conteúdo"
   *  pra coord que publica. */
  semDestino?: string;
  className?: string;
  /** stagger de entrada (.animate-enter + --i) quando o card está numa
   *  grade — a seção é quem decide o índice. */
  style?: CSSProperties;
}) {
  const Icone = TIPO_ICONE[m.tipo];
  const urlOk = linkSeguro(m.url);
  // "doc:<slug>" é documento nativo — navega na mesma aba, sem ícone de
  // saída; o arquivo oficial ganha da url externa
  const ehDoc = m.path?.startsWith("doc:") ?? false;
  const href = hrefMaterial(m, docBase);
  const externo = !ehDoc;

  const faixa = (conteudo: ReactNode) => (
    <div
      aria-hidden
      className="grid h-24 place-items-center bg-muted/60 text-muted-foreground"
    >
      <span className="flex flex-col items-center gap-1.5">{conteudo}</span>
    </div>
  );
  const capa = ehDoc ? (
    faixa(
      <>
        <FileText size={20} weight="duotone" aria-hidden />
        <span className="text-[11px] font-medium">documento</span>
      </>
    )
  ) : m.path ? (
    <MaterialThumb
      m={m}
      fallback={faixa(<Icone size={20} weight="duotone" aria-hidden />)}
    />
  ) : urlOk ? (
    <PreviewLink m={m} />
  ) : (
    faixa(<Icone size={20} weight="duotone" aria-hidden />)
  );

  const interno = (
    <>
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg bg-muted/70 text-muted-foreground",
          lido && "opacity-60"
        )}
      >
        <Icone size={17} aria-hidden />
      </span>
      <div className={cn("min-w-0 flex-1", lido && "opacity-60")}>
        {/* lido é estado do item inteiro (REALIZA-439): título sublinhado +
            conteúdo com opacidade — nunca só cor nem só o selo na meta */}
        <p
          className={cn(
            "text-sm font-medium",
            lido &&
              "underline decoration-muted-foreground/40 underline-offset-2"
          )}
        >
          {marca ? <HighlightText texto={m.titulo} query={marca} /> : m.titulo}
        </p>
        {m.descricao && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {marca ? (
              <HighlightText texto={m.descricao} query={marca} />
            ) : (
              m.descricao
            )}
          </p>
        )}
        {meta}
        <span className="sr-only">
          {TIPO_LABEL[m.tipo]}
          {m.path
            ? ehDoc
              ? " · documento"
              : " · arquivo"
            : urlOk && m.tipo !== "link"
              ? " · link externo"
              : ""}
        </span>
      </div>
      {m.path ? (
        <File size={15} className="shrink-0 text-muted-foreground" aria-hidden />
      ) : urlOk ? (
        <ArrowSquareOut
          size={15}
          className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
          aria-hidden
        />
      ) : (
        <Badge
          variant="outline"
          className="shrink-0 text-xs text-muted-foreground"
        >
          {semDestino}
        </Badge>
      )}
    </>
  );

  const linkCls =
    "group flex h-full flex-col outline-none transition-colors hover:bg-muted/50 active:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]",
        className
      )}
      style={style}
    >
      {href ? (
        rastrear ? (
          <LinkComLeitura
            materialRef={refDoMaterial(m)}
            href={href}
            externo={externo}
            className={linkCls}
          >
            {capa}
            <div className="flex flex-1 items-center gap-x-4 px-5 py-3.5">
              {interno}
            </div>
          </LinkComLeitura>
        ) : (
          <a
            href={href}
            {...(externo
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className={linkCls}
          >
            {capa}
            <div className="flex flex-1 items-center gap-x-4 px-5 py-3.5">
              {interno}
            </div>
          </a>
        )
      ) : (
        <div className="flex h-full flex-col">
          {capa}
          <div className="flex flex-1 items-center gap-x-4 px-5 py-3.5">
            {interno}
          </div>
        </div>
      )}
      {/* ⋯ das secundárias — sibling do <a> (nada de botão dentro de
          link): chip com backdrop pra ler sobre qualquer capa. Sem
          destino, o menu de leitura (MaterialMenu) se esconde sozinho —
          por isso o chip só aparece com link; o da coord (MaterialActions,
          acoesSempre) fica mesmo sem href: é onde mora "Anexar arquivo". */}
      {acoes && (href || acoesSempre) && (
        <div className="absolute right-2 top-2 z-10 rounded-lg bg-background/75 backdrop-blur-sm">
          {acoes}
        </div>
      )}
    </div>
  );
}
