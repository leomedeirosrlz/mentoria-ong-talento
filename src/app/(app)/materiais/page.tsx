import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { getCicloEventos, getMateriais, getMe } from "@/lib/queries";
import { linkSeguro, maxNumeroEncontro } from "@/lib/ciclo";
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
  // encontro_num do material é por programa (o guia do 5º vale pras duas
  // turmas) — o teto do seletor é o maior nº que existe, não a soma das linhas
  const maxEncontro = maxNumeroEncontro(eventos);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Materiais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            A biblioteca oficial do programa. A coordenação publica conforme a jornada avança
          </p>
        </div>
        {/* biblioteca vazia: o CTA mora dentro do card de estado vazio, não aqui */}
        {ehCoord && grupos.length > 0 && (
          <NovoMaterialDialog maxEncontro={maxEncontro} />
        )}
      </header>

      {grupos.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-xl bg-card px-5 py-10 text-center shadow-[var(--shadow-border)]">
          <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
            <FolderOpen size={18} aria-hidden />
          </span>
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
              <NovoMaterialDialog maxEncontro={maxEncontro} />
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
            <div className="rounded-xl bg-card shadow-[var(--shadow-border)] divide-y divide-border/60 overflow-hidden">
              {itens.map((m) => (
                <MaterialRow key={m.id} m={m} ehCoord={ehCoord} maxEncontro={maxEncontro} />
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
  // arquivo oficial ganha da url externa; sem os dois, o material ainda não
  // chegou. linkSeguro: o CHECK do banco exige http(s), este guard cobre
  // escrita fora do app — url insegura cai no estado "sem destino"
  const urlOk = linkSeguro(m.url);
  const href = m.path ? `/api/material/${m.id}` : urlOk;
  // o link cobre só ícone + título: a zona trailing inteira vive no container
  // (um cluster só) e cai pra linha de baixo à direita até lg; lg+ o head
  // cresce (basis-0 + grow) e garante linha única determinística — o título
  // quebra internamente e a descrição já tem line-clamp
  const head = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted/70 text-muted-foreground">
        <Icone size={17} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{m.titulo}</p>
        {m.descricao && <p className="line-clamp-2 text-xs text-muted-foreground mt-0.5">{m.descricao}</p>}
        {/* equivalente textual dos ícones de tipo/destino — pro tipo "link" a
            palavra já cobre o destino, sem "link externo" repetido */}
        <span className="sr-only">
          {TIPO_LABEL[m.tipo]}
          {m.path ? " · arquivo" : urlOk && m.tipo !== "link" ? " · link externo" : ""}
        </span>
      </div>
    </>
  );
  const headCls = "flex min-w-0 flex-1 basis-full items-center gap-x-4 px-5 py-3.5 lg:basis-0";
  return (
    <div className={cn("flex flex-wrap items-center pr-2 transition-colors", href && "hover:bg-muted/50")}>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(headCls, "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset")}
        >
          {head}
        </a>
      ) : (
        <div className={headCls}>{head}</div>
      )}
      {/* zona trailing: uma peça só (badge de audiência + ícone de destino +
          ações). <lg cai inteira pra linha 2 encostada à direita — nada cai
          à esquerda nem disputa largura com o título; flex-wrap deixa os
          badges descerem pra sub-linha à direita em vez de clipar em telas
          estreitas */}
      <div className="flex basis-full min-w-0 flex-wrap items-center justify-end gap-2 px-5 pb-3 lg:basis-auto lg:px-0 lg:pb-0">
        {m.audiencia !== "todos" && (
          <Badge variant="outline" className="text-xs">{AUDIENCIA_LABEL[m.audiencia]}</Badge>
        )}
        {m.path ? (
          // path aceita imagem além de PDF — ícone genérico de arquivo
          <File size={15} className="text-muted-foreground" aria-hidden />
        ) : urlOk ? (
          <ArrowSquareOut size={15} className="text-muted-foreground" aria-hidden />
        ) : (
          // sem destino: estado legítimo "a caminho" — badge estático, a row
          // não vira link nem ganha hover pra não parecer clicável/quebrado
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {ehCoord ? "sem conteúdo" : "em breve"}
          </Badge>
        )}
        {ehCoord && <MaterialActions material={m} maxEncontro={maxEncontro} />}
      </div>
    </div>
  );
}
