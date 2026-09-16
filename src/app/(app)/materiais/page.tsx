import { getMateriais, getMe } from "@/lib/queries";
import { ArrowSquareOut, FileText, LinkSimple, BookOpen, PuzzlePiece } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { NovoMaterialDialog } from "@/components/novo-material-dialog";
import type { Material } from "@/lib/types";

const TIPO_ICONE = {
  guia: BookOpen,
  template: FileText,
  conteudo: PuzzlePiece,
  link: LinkSimple,
} as const;

const AUDIENCIA_LABEL = {
  todos: "todos",
  dpp: "mentor DPP",
  especialista: "especialista",
  coordenacao: "coordenacao",
} as const;

export default async function MateriaisPage() {
  const [materiais, me] = await Promise.all([getMateriais(), getMe()]);

  const visiveis = materiais.filter((m) => {
    if (m.audiencia === "todos") return true;
    if (me?.role === "coordenacao") return true;
    if (m.audiencia === "dpp") return me?.role === "mentor_dpp";
    if (m.audiencia === "especialista") return me?.role === "mentor_especialista";
    return false;
  });

  const grupos = agrupar(visiveis);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Materiais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Guias, templates e instrumentos da metodologia
          </p>
        </div>
        {me?.role === "coordenacao" && <NovoMaterialDialog />}
      </header>

      {grupos.map(([rotulo, itens]) => (
        <section key={rotulo} className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {rotulo}
          </h2>
          <div className="rounded-xl border bg-card divide-y divide-border overflow-hidden">
            {itens.map((m) => (
              <MaterialRow key={m.id} m={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function agrupar(materiais: Material[]): [string, Material[]][] {
  const mapa = new Map<string, Material[]>();
  for (const m of materiais) {
    const rotulo =
      m.encontro_num != null
        ? `Encontro ${m.encontro_num}`
        : m.tipo === "guia"
          ? "Guias"
          : m.tipo === "template"
            ? "Templates gerais"
            : "Links";
    mapa.set(rotulo, [...(mapa.get(rotulo) ?? []), m]);
  }
  return [...mapa.entries()].sort(([a], [b]) => {
    const peso = (r: string) =>
      r === "Guias" ? -1 : r.startsWith("Encontro") ? Number(r.split(" ")[1]) : 99;
    return peso(a) - peso(b);
  });
}

function MaterialRow({ m }: { m: Material }) {
  const Icone = TIPO_ICONE[m.tipo];
  const inner = (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <Icone size={18} className="shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{m.titulo}</p>
        {m.descricao && <p className="text-xs text-muted-foreground mt-0.5">{m.descricao}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {m.audiencia !== "todos" && (
          <Badge variant="outline" className="text-xs">{AUDIENCIA_LABEL[m.audiencia]}</Badge>
        )}
        {m.url ? (
          <ArrowSquareOut size={15} className="text-muted-foreground" />
        ) : (
          <span className="text-xs text-muted-foreground">em breve</span>
        )}
      </div>
    </div>
  );
  return m.url ? (
    <a href={m.url} target="_blank" rel="noopener noreferrer" className="block transition-colors hover:bg-muted/50">
      {inner}
    </a>
  ) : (
    <div>{inner}</div>
  );
}
