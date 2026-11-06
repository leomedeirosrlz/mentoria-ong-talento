import type { CSSProperties } from "react";
import {
  ArrowSquareOut,
  BookOpen,
  CaretDown,
  FileText,
  LinkSimple,
  PuzzlePiece,
} from "@phosphor-icons/react/dist/ssr";
import { formatDiaMes, formatDiaSemana, linkSeguro } from "@/lib/ciclo";
import { guiaDoEncontro } from "@/lib/como-conduzir";
import type { Material } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { BibliotecaLista } from "@/components/biblioteca-lista";
import { cn } from "@/lib/utils";

// Biblioteca do mentor/especialista (rodada dores-ux-2026-10): a mesma
// /materiais da coordenação, lida de outro jeito — sem faixa de números,
// sem cobertura por encontro, sem chips de filtro, sem selo de público (o
// acervo já chega recortado pela audiência) e sem menu ⋯ (a linha inteira
// é o gesto). O que ancora a página é o encontro da semana da turma do
// mentor — um card por turma quando ele tem duplas em cronogramas
// defasados —, os dois encontros seguintes, o resto do ciclo recolhido e
// os guias transversais em lista simples. Especialista (trilha própria,
// sem calendário) lê só a lista plana; o recorte chega com `turmas`
// vazia.

export type EncontroResumo = {
  numero: number;
  titulo?: string;
  data?: string | null;
};

export type TurmaMateriais = {
  /** "Turma 1" só quando o mentor tem duplas em turmas diferentes — com
   *  uma turma só (ou no recorte global sem dupla viva) o rótulo seria
   *  redundante e vem null. */
  rotulo: string | null;
  /** nº do encontro vigente no cronograma desta turma. */
  vigente: number | null;
  /** encontros do cronograma, por numero. */
  encontros: EncontroResumo[];
};

const TIPO_ICONE = {
  guia: BookOpen,
  template: FileText,
  conteudo: PuzzlePiece,
  link: LinkSimple,
} as const;

// nome legível do tipo — os ícones são decorativos, este texto é o
// equivalente pra leitor de tela
const TIPO_LABEL = {
  guia: "guia",
  template: "modelo",
  conteudo: "conteúdo",
  link: "link",
} as const;

/** "ter, 28/10" — curto pro meta do card da semana e dos recolhíveis. */
function quandoCurto(data: string): string {
  const dia = formatDiaSemana(data).replace("-feira", "");
  const dm = formatDiaMes(data).slice(0, 5);
  return dia ? `${dia}, ${dm}` : formatDiaMes(data);
}

/** Linha única do acervo do mentor: ícone do tipo à esquerda, título +
 *  descrição curta, ação à direita (abrir arquivo/link em nova aba). Sem
 *  selo de público nem ⋯ — a linha inteira é o gesto; "em breve" é o
 *  estado legítimo de quem ainda não tem destino e não vira link. */
function LinhaMaterial({ m }: { m: Material }) {
  const Icone = TIPO_ICONE[m.tipo];
  // arquivo oficial ganha da url externa; "doc:<slug>" é documento nativo
  // (página do app); sem os três, "em breve"
  const urlOk = linkSeguro(m.url);
  const ehDoc = m.path?.startsWith("doc:") ?? false;
  const href = ehDoc
    ? `/materiais/documento/${m.path!.slice(4)}`
    : m.path
      ? `/api/material/${m.id}`
      : urlOk;
  const conteudo = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted/70 text-muted-foreground">
        <Icone size={17} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{m.titulo}</span>
        {m.descricao && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
            {m.descricao}
          </span>
        )}
        <span className="sr-only">
          {TIPO_LABEL[m.tipo]}
          {m.path
            ? m.path.startsWith("doc:")
              ? " · documento"
              : " · arquivo"
            : urlOk && m.tipo !== "link"
              ? " · link externo"
              : ""}
        </span>
      </span>
    </>
  );
  // padding uniforme em toda linha: px-4/py-3 (sm:px-5), alvo ≥44px no
  // toque via min-h-11
  const cls = "flex min-h-11 items-center gap-x-3 px-4 py-3 sm:px-5";
  if (!href) {
    return (
      <div className={cls}>
        {conteudo}
        <span className="shrink-0 text-xs text-muted-foreground">
          em breve
        </span>
      </div>
    );
  }
  return (
    <a
      href={href}
      {...(ehDoc ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      className={cn(
        cls,
        "transition-colors hover:bg-muted/50 active:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      )}
    >
      {conteudo}
      {/* um ícone só no trilho direito — "Abrir em nova aba", o mesmo do
          ⋯ do MaterialMenu; documento nativo navega na mesma aba e não
          leva o ícone de saída */}
      {!ehDoc && (
        <ArrowSquareOut
          size={17}
          aria-hidden
          className="shrink-0 text-muted-foreground"
        />
      )}
    </a>
  );
}

/** "Encontro desta semana" — card neutro com acento de jornada na borda
 *  (o amarelo é próximo passo, não banho de fundo: REALIZA-335), o "Como
 *  conduzir" do guia e os materiais do encontro como linhas clicáveis.
 *  O texto longo vai em <details>: a prévia de 3 linhas mora no summary
 *  (única parte visível fechado) e o texto INTEIRO no corpo — antes o
 *  corpo era vazio e o texto morava todo no summary, então o "dropdown"
 *  não tinha nada dentro. Texto curto sai como parágrafo, sem um toggle
 *  que abriria pro mesmo trecho. */
const CONDUZIR_LIMITE = 240;

function CardSemana({
  turma,
  itens,
  indice,
}: {
  turma: TurmaMateriais;
  itens: Material[];
  indice: number;
}) {
  const encontro = turma.encontros.find((e) => e.numero === turma.vigente);
  if (!encontro) return null;
  const conduzir = guiaDoEncontro(encontro.numero)?.conduzir;
  const id = `semana-${turma.rotulo ? turma.rotulo.replace(/\s+/g, "-") : "ciclo"}`;
  return (
    <section
      aria-labelledby={id}
      className="animate-enter overflow-hidden rounded-xl border border-border border-l-[3px] border-l-[var(--destaque)] bg-card text-foreground"
      style={{ "--i": Math.min(indice, 10) } as CSSProperties}
    >
      <div className="px-4 pb-3.5 pt-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <p
            id={id}
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            Encontro desta semana
          </p>
          {turma.rotulo && (
            <Badge variant="outline" className="font-semibold">
              {turma.rotulo}
            </Badge>
          )}
          {encontro.data && (
            <span className="ml-auto text-xs text-muted-foreground">
              {quandoCurto(encontro.data)}
            </span>
          )}
        </div>
        <h2 className="mt-1 text-base font-semibold">
          Encontro {encontro.numero}
          {encontro.titulo && ` · ${encontro.titulo}`}
        </h2>
        {conduzir &&
          (conduzir.length > CONDUZIR_LIMITE ? (
            <details className="group/cc mt-1.5">
              <summary className="cursor-pointer list-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                {/* prévia truncada — a única parte do details visível
                    fechado; aria-hidden pra não virar nome acessível */}
                <span
                  aria-hidden
                  className="line-clamp-3 text-sm leading-relaxed text-muted-foreground group-open/cc:hidden"
                >
                  <strong className="font-semibold text-foreground">
                    Como conduzir:
                  </strong>{" "}
                  {conduzir}
                </span>
                <span className="mt-1 inline-flex min-h-8 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                  <span className="group-open/cc:hidden">Ler tudo</span>
                  <span className="hidden group-open/cc:inline">
                    Mostrar menos
                  </span>
                  <CaretDown
                    size={12}
                    aria-hidden
                    className="transition-transform group-open/cc:rotate-180"
                  />
                </span>
              </summary>
              {/* corpo real do dropdown — fechado o browser nem renderiza;
                  o texto completo mora aqui, não no summary */}
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                <strong className="font-semibold text-foreground">
                  Como conduzir:
                </strong>{" "}
                {conduzir}
              </p>
            </details>
          ) : (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              <strong className="font-semibold text-foreground">
                Como conduzir:
              </strong>{" "}
              {conduzir}
            </p>
          ))}
      </div>
      <div className="border-t border-border/60">
        {itens.length > 0 ? (
          <div className="divide-y divide-border/60">
            {itens.map((m) => (
              <LinhaMaterial key={m.id} m={m} />
            ))}
          </div>
        ) : (
          <p className="px-4 py-3 text-sm text-muted-foreground sm:px-5">
            Nada publicado pra esse encontro por enquanto.
          </p>
        )}
      </div>
    </section>
  );
}

export function MateriaisMentorBiblioteca({
  turmas,
  porEncontro,
  referenciais,
}: {
  /** Turmas do mentor DPP (vigente + encontros do cronograma); vazia =
   *  especialista — a biblioteca vira lista plana, sem encontros. */
  turmas: TurmaMateriais[];
  /** materiais por nº de encontro (mesmo recorte de audiência da page). */
  porEncontro: Map<number, Material[]>;
  /** transversais pro mentor DPP; pro especialista, tudo que ele vê. */
  referenciais: Material[];
}) {
  // um card por turma com o encontro da semana; abaixo, o acervo agrupado
  // por categoria (REALIZA-250) — sem próximos/adiante/anteriores
  const todos = new Map<string, Material>();
  for (const lista of porEncontro.values())
    for (const m of lista) todos.set(m.id, m);
  for (const m of referenciais) todos.set(m.id, m);
  const vigentes = turmas.map((t) => t.vigente).filter((n): n is number => n != null);

  return (
    // o marco "Resumo da biblioteca" é contrato dos specs do mentor
    <section className="space-y-6" aria-label="Resumo da biblioteca">
      {turmas.map((t, i) => {
        const vigenteE = t.encontros.find((e) => e.numero === t.vigente);
        return vigenteE ? (
          <CardSemana
            key={t.rotulo ?? "ciclo"}
            turma={t}
            itens={porEncontro.get(vigenteE.numero) ?? []}
            indice={i}
          />
        ) : null;
      })}
      <BibliotecaLista
        materiais={[...todos.values()]}
        vigente={vigentes.length === 1 ? vigentes[0]! : null}
      />
    </section>
  );
}
