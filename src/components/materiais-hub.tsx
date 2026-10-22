import type { CSSProperties } from "react";
import {
  ArrowSquareOut,
  BookOpen,
  CaretRight,
  File,
  FileText,
  LinkSimple,
  PuzzlePiece,
} from "@phosphor-icons/react/dist/ssr";
import { linkSeguro } from "@/lib/ciclo";
import type { CicloEvento, Material } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { MaterialActions } from "@/components/material-actions";
import { NovoMaterialDialog } from "@/components/novo-material-dialog";
import { cn } from "@/lib/utils";

// Hub da biblioteca (REALIZA-173): faixa de cobertura 1..N + um <details>
// por encontro + o bloco transversal (guias/modelos/conteúdos sem encontro).
// A coord responde "o que falta" sem scroll; os demais papéis veem a mesma
// estrutura em leitura (sem MaterialActions/NovoMaterialDialog).

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

// seções do bloco transversal — cada tipo cai no rótulo do próprio tipo
const GRUPO_TIPO = {
  guia: "Guias",
  template: "Modelos gerais",
  conteudo: "Conteúdos",
  link: "Links",
} as const;

/** Material com destino real: arquivo oficial no bucket ou link http(s)
 *  válido. Sem os dois é o "em breve" — estado legítimo (materiais chegam
 *  ao longo do ciclo), não erro. */
function temConteudo(m: Material): boolean {
  return m.path != null || linkSeguro(m.url) != null;
}

/** Separa o catálogo visível: materiais datados por encontro (1..teto do
 *  cronograma, com qualquer nº fora dele que já exista nos dados) ×
 *  transversais (sem encontro_num) agrupados por tipo na ordem do GRUPO_TIPO. */
export function particionarMateriais(
  materiais: Material[],
  maxEncontro: number
) {
  const porEncontro = new Map<number, Material[]>();
  const porTipo = new Map<Material["tipo"], Material[]>();
  for (const m of materiais) {
    if (m.encontro_num != null) {
      const lista = porEncontro.get(m.encontro_num) ?? [];
      lista.push(m);
      porEncontro.set(m.encontro_num, lista);
    } else {
      const lista = porTipo.get(m.tipo) ?? [];
      lista.push(m);
      porTipo.set(m.tipo, lista);
    }
  }
  const teto = Math.max(maxEncontro, 0, ...porEncontro.keys());
  const nums = Array.from({ length: teto }, (_, i) => i + 1);
  const transversais = (Object.keys(GRUPO_TIPO) as (keyof typeof GRUPO_TIPO)[])
    .filter((t) => porTipo.has(t))
    .map((t) => ({ tipo: t, itens: porTipo.get(t)! }));
  return { porEncontro, nums, transversais };
}

/** Título do encontro no calendário oficial — só quando todos os cronogramas
 *  concordam no nº (título divergente entre turmas não se exibe, pra não
 *  prometer a semana errada no summary). */
export function titulosPorNumero(eventos: CicloEvento[]): Map<number, string> {
  const vistos = new Map<number, string | false>();
  for (const e of eventos) {
    if (e.tipo !== "encontro" || e.numero == null) continue;
    const prev = vistos.get(e.numero);
    if (prev === undefined) vistos.set(e.numero, e.titulo);
    else if (prev !== e.titulo) vistos.set(e.numero, false);
  }
  const mapa = new Map<number, string>();
  for (const [n, t] of vistos) if (t !== false) mapa.set(n, t);
  return mapa;
}

/** Faixa de cobertura 1..N — responde em um olhar "quais encontros já têm
 *  material": lime = tem conteúdo, amarelo = material marcado mas ainda
 *  "em breve", tracejado = vazio. Cada célula ancora no <details> do encontro. */
export function CoberturaTrilha({
  porEncontro,
  nums,
}: {
  porEncontro: Map<number, Material[]>;
  nums: number[];
}) {
  return (
    <section
      aria-labelledby="materiais-cobertura"
      className="animate-enter rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="materiais-cobertura" className="text-sm font-semibold">
          Cobertura por encontro
        </h2>
        {/* a legenda é a alternativa touch do title das células — sem ela o
            código de cor não tem como ser lido no toque */}
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <i aria-hidden className="size-2.5 rounded-sm bg-[var(--brand-lime)]" />
            com material
          </li>
          <li className="flex items-center gap-1.5">
            <i aria-hidden className="size-2.5 rounded-sm bg-[var(--warn)]" />
            em breve
          </li>
          <li className="flex items-center gap-1.5">
            <i
              aria-hidden
              className="size-2.5 rounded-sm border border-dashed border-muted-foreground/60"
            />
            sem material
          </li>
        </ul>
      </div>
      <ol className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
        {nums.map((n) => (
          <li key={n} className="shrink-0">
            <CelulaCobertura n={n} itens={porEncontro.get(n) ?? []} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function CelulaCobertura({ n, itens }: { n: number; itens: Material[] }) {
  const k = itens.length;
  const comConteudo = itens.filter(temConteudo).length;
  const estado = k === 0 ? "vazio" : comConteudo > 0 ? "coberto" : "parcial";
  const rotulo =
    estado === "vazio"
      ? `Encontro ${n} · sem material`
      : `Encontro ${n} · ${k} ${k === 1 ? "material" : "materiais"}${
          comConteudo < k ? ` · ${k - comConteudo} em breve` : ""
        }`;
  return (
    <a
      href={`#mat-encontro-${n}`}
      title={rotulo}
      aria-label={rotulo}
      className={cn(
        "grid size-9 place-items-center rounded-md text-xs font-semibold tabular-nums transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        estado === "coberto" && "bg-[var(--brand-lime)] text-[var(--brand-ink)]",
        estado === "parcial" &&
          "border border-[var(--warn)]/50 bg-[var(--warn)]/15 text-[var(--warn-text)]",
        estado === "vazio" &&
          "border border-dashed border-input text-muted-foreground/70 hover:border-muted-foreground/40 hover:text-muted-foreground"
      )}
    >
      {n}
    </a>
  );
}

/** Linha do hub por encontro — <details> colapsado por padrão: o summary
 *  carrega o nº, a contagem e o pill do pior estado; abrindo, as linhas de
 *  material com MaterialActions e o atalho "adicionar neste encontro" (coord). */
export function EncontroDetails({
  n,
  titulo,
  itens,
  ehCoord,
  maxEncontro,
  indice,
}: {
  n: number;
  titulo?: string;
  itens: Material[];
  ehCoord: boolean;
  maxEncontro: number;
  indice: number;
}) {
  const k = itens.length;
  return (
    <details
      id={`mat-encontro-${n}`}
      className="group animate-enter scroll-mt-16 rounded-xl bg-card shadow-[var(--shadow-border)]"
      style={{ "--i": Math.min(indice, 10) } as CSSProperties}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-x-2.5 rounded-xl px-4 py-2 text-sm transition-colors marker:hidden select-none hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring group-open:rounded-b-none [&::-webkit-details-marker]:hidden">
        <CaretRight
          size={14}
          weight="bold"
          aria-hidden
          className="shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
        />
        {/* role=heading no lugar de <h3>: o content model do summary não
            admite heading misturado a phrasing — o span com role preserva a
            mesma semântica pros leitores de tela e pros specs */}
        <span role="heading" aria-level={3} className="shrink-0 text-[13px] font-semibold">
          Encontro {n}
        </span>
        {titulo && (
          <span className="hidden min-w-0 truncate text-xs text-muted-foreground sm:inline">
            {titulo}
          </span>
        )}
        {k > 0 ? (
          <span className="ml-auto flex shrink-0 items-center gap-2 pl-2">
            <span className="text-xs tabular-nums text-muted-foreground">
              {k} {k === 1 ? "material" : "materiais"}
            </span>
            <PillEstado itens={itens} />
          </span>
        ) : (
          <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground">
            sem material ainda
          </span>
        )}
      </summary>
      {k > 0 ? (
        <div className="border-t border-border/60">
          {ehCoord && (
            <div className="flex justify-end border-b border-border/60 px-3 py-1.5">
              <NovoMaterialDialog
                maxEncontro={maxEncontro}
                defaultEncontro={n}
                triggerLabel="Adicionar neste encontro"
                triggerVariant="ghost"
              />
            </div>
          )}
          <div className="divide-y divide-border/60">
            {itens.map((m) => (
              <MaterialRow key={m.id} m={m} ehCoord={ehCoord} maxEncontro={maxEncontro} />
            ))}
          </div>
        </div>
      ) : (
        <div className="border-t border-border/60 px-5 py-5 text-center">
          <p className="text-sm text-muted-foreground">
            {ehCoord
              ? "Nenhum material nesse encontro ainda."
              : "Nada publicado pra esse encontro por enquanto."}
          </p>
          {ehCoord && (
            <div className="mt-3 flex justify-center">
              <NovoMaterialDialog
                maxEncontro={maxEncontro}
                defaultEncontro={n}
                triggerLabel="Adicionar material neste encontro"
                triggerVariant="outline"
              />
            </div>
          )}
        </div>
      )}
    </details>
  );
}

/** Pill do pior estado no summary: lime quando todo material do encontro tem
 *  conteúdo; amarelo (warn) quando algo ainda está "em breve" — com a contagem
 *  quando só uma parte falta. Encontro vazio não tem pill. */
function PillEstado({ itens }: { itens: Material[] }) {
  const emBreve = itens.length - itens.filter(temConteudo).length;
  if (emBreve === 0) {
    return (
      <Badge
        variant="outline"
        className="border-[var(--ok)]/40 bg-[var(--ok)]/10 text-[var(--ok-text)]"
      >
        no ar
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-[var(--warn)]/50 bg-[var(--warn)]/10 text-[var(--warn-text)]"
    >
      {emBreve === itens.length ? "em breve" : `${emBreve} em breve`}
    </Badge>
  );
}

/** Bloco transversal — guias/modelos/conteúdos/links sem encontro_num, em
 *  seções por tipo (mesma anatomia de linha do hub). Sempre aberto: o Guia
 *  do Mentor é o material mais acessado da página. */
export function TransversaisMateriais({
  grupos,
  ehCoord,
  maxEncontro,
}: {
  grupos: { tipo: keyof typeof GRUPO_TIPO; itens: Material[] }[];
  ehCoord: boolean;
  maxEncontro: number;
}) {
  if (grupos.length === 0) return null;
  return (
    <section aria-labelledby="materiais-transversais" className="space-y-4">
      <h2
        id="materiais-transversais"
        className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
      >
        Transversais
      </h2>
      <div className="space-y-5">
        {grupos.map(({ tipo, itens }, i) => (
          <div
            key={tipo}
            className="animate-enter space-y-2"
            style={{ "--i": Math.min(i, 10) } as CSSProperties}
          >
            <h3 className="text-[13px] font-semibold">{GRUPO_TIPO[tipo]}</h3>
            <div className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
              {itens.map((m) => (
                <MaterialRow key={m.id} m={m} ehCoord={ehCoord} maxEncontro={maxEncontro} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MaterialRow({
  m,
  ehCoord,
  maxEncontro,
}: {
  m: Material;
  ehCoord: boolean;
  maxEncontro: number;
}) {
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
    // o clique mora no <a> do head, mas :active sobe pros ancestrais — o
    // press afunda a linha inteira, não só a zona clicável
    <div className={cn("flex flex-wrap items-center pr-2 transition-colors", href && "hover:bg-muted/50 active:bg-muted")}>
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
