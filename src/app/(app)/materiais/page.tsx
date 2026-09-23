import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { getCicloEventos, getMateriais, getMe } from "@/lib/queries";
import { totalEncontros } from "@/lib/ciclo";
import { ArrowSquareOut, File, FileText, FolderOpen, LinkSimple, BookOpen, PuzzlePiece } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { NovoMaterialDialog } from "@/components/novo-material-dialog";
import { MaterialActions } from "@/components/material-actions";
import type { Material } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Materiais" };

const TIPO_ICONE = {
  guia: BookOpen,
  template: FileText,
  conteudo: PuzzlePiece,
  link: LinkSimple,
} as const;

const AUDIENCIA_LABEL = {
  todos: "todos",
  dpp: "mentores DPP",
  especialista: "mentores especialistas",
  coordenacao: "coordenação",
} as const;

// nome legível do tipo — os ícones de TIPO_ICONE são decorativos, este texto é
// o equivalente pra leitor de tela
const TIPO_LABEL = {
  guia: "guia",
  template: "modelo",
  conteudo: "conteúdo",
  link: "link",
} as const;

// seções fixas pra material sem encontro — cada tipo cai no rótulo do próprio tipo
const GRUPO_TIPO = {
  guia: "Guias",
  template: "Modelos gerais",
  conteudo: "Conteúdos",
  link: "Links",
} as const;

export default async function MateriaisPage() {
  const [materiais, me, eventos] = await Promise.all([
    getMateriais(),
    getMe(),
    getCicloEventos(),
  ]);

  const visiveis = materiais.filter((m) => {
    if (m.audiencia === "todos") return true;
    if (me?.role === "coordenacao") return true;
    if (m.audiencia === "dpp") return me?.role === "mentor_dpp";
    if (m.audiencia === "especialista") return me?.role === "mentor_especialista";
    return false;
  });

  const ehCoord = me?.role === "coordenacao";
  const grupos = agrupar(visiveis);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Materiais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            A biblioteca oficial do programa — a coordenação publica conforme a jornada avança
          </p>
        </div>
        {/* biblioteca vazia: o CTA mora dentro do card de estado vazio, não aqui */}
        {ehCoord && grupos.length > 0 && (
          <NovoMaterialDialog maxEncontro={totalEncontros(eventos)} />
        )}
      </header>

      {grupos.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-xl bg-card px-5 py-10 text-center shadow-[var(--shadow-border)]">
          <FolderOpen size={32} className="text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">
            {ehCoord ? "Nenhum material publicado ainda" : "Nenhum material disponível para o seu perfil"}
          </p>
          <p className="text-sm text-muted-foreground">
            {ehCoord
              ? "Publique o primeiro guia, modelo ou instrumento do programa."
              : "Os guias e instrumentos do programa aparecem aqui quando a coordenação publicar."}
          </p>
          <div className="mt-3">
            {ehCoord ? (
              <NovoMaterialDialog maxEncontro={totalEncontros(eventos)} />
            ) : (
              <Link
                href="/agenda"
                className="text-sm font-medium underline underline-offset-2 transition-colors hover:text-muted-foreground"
              >
                Ver a agenda
              </Link>
            )}
          </div>
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
            <div className="rounded-xl bg-card shadow-[var(--shadow-border)] divide-y divide-border overflow-hidden">
              {itens.map((m) => (
                <MaterialRow key={m.id} m={m} ehCoord={ehCoord} maxEncontro={totalEncontros(eventos)} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function agrupar(materiais: Material[]): [string, Material[]][] {
  const mapa = new Map<string, Material[]>();
  for (const m of materiais) {
    const rotulo =
      m.encontro_num != null ? `Encontro ${m.encontro_num}` : GRUPO_TIPO[m.tipo];
    mapa.set(rotulo, [...(mapa.get(rotulo) ?? []), m]);
  }
  // guias da metodologia primeiro, encontros na ordem do ciclo, grupos soltos
  // por último numa ordem fixa (não depende da ordem dos dados)
  const peso = (r: string) =>
    r === "Guias"
      ? -1
      : r.startsWith("Encontro")
        ? Number(r.split(" ")[1])
        : r === "Modelos gerais"
          ? 100
          : r === "Conteúdos"
            ? 101
            : 102;
  return [...mapa.entries()].sort(([a], [b]) => peso(a) - peso(b));
}

function MaterialRow({ m, ehCoord, maxEncontro }: { m: Material; ehCoord: boolean; maxEncontro: number }) {
  const Icone = TIPO_ICONE[m.tipo];
  // arquivo oficial ganha da url externa; sem os dois, o material ainda não chegou
  const href = m.path ? `/api/material/${m.id}` : m.url;
  const inner = (
    <>
      <Icone size={18} className="shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{m.titulo}</p>
        {m.descricao && <p className="line-clamp-2 text-xs text-muted-foreground mt-0.5">{m.descricao}</p>}
        {/* equivalente textual dos ícones de tipo/destino — pro tipo "link" a
            palavra já cobre o destino, sem "link externo" repetido */}
        <span className="sr-only">
          {TIPO_LABEL[m.tipo]}
          {m.path ? " — arquivo" : m.url && m.tipo !== "link" ? " — link externo" : ""}
        </span>
      </div>
      {/* a 390px o shrink-0 (badge de audiência ~150px + ícone) deixava
          60-110px pro título — uma palavra por linha. basis-full manda o
          cluster pra linha de baixo no mobile; sm+ volta ao shrink-0 de sempre */}
      <div className="flex basis-full items-center gap-2 sm:basis-auto sm:shrink-0">
        {m.audiencia !== "todos" && (
          <Badge variant="outline" className="text-xs">{AUDIENCIA_LABEL[m.audiencia]}</Badge>
        )}
        {m.path ? (
          // path aceita imagem além de PDF — ícone genérico de arquivo
          <File size={15} className="text-muted-foreground" aria-hidden />
        ) : m.url ? (
          <ArrowSquareOut size={15} className="text-muted-foreground" aria-hidden />
        ) : (
          // sem destino: estado legítimo "a caminho" — badge estático, a row
          // não vira link nem ganha hover pra não parecer clicável/quebrado
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {ehCoord ? "sem conteúdo" : "em breve"}
          </Badge>
        )}
      </div>
    </>
  );
  return (
    <div className={cn("flex flex-wrap items-center pr-2 transition-colors", href && "hover:bg-muted/50")}>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:basis-auto"
        >
          {inner}
        </a>
      ) : (
        <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5 sm:basis-auto">{inner}</div>
      )}
      {/* os 3 botões size-11 (132px) disputavam a linha com o título a 390px —
          no mobile o link toma a linha toda e as ações caem na linha de baixo,
          encostadas à direita; sm+ volta a dividir a mesma linha */}
      {ehCoord && (
        <div className="flex basis-full justify-end sm:basis-auto">
          <MaterialActions material={m} maxEncontro={maxEncontro} />
        </div>
      )}
    </div>
  );
}
