import type { CSSProperties } from "react";
import {
  ArrowSquareOut,
  BookOpen,
  CaretDown,
  CaretRight,
  File,
  FileText,
  Info,
  LinkSimple,
  PuzzlePiece,
} from "@phosphor-icons/react/dist/ssr";
import { linkSeguro } from "@/lib/ciclo";
import { guiaDoEncontro } from "@/lib/como-conduzir";
import type { CicloEvento, Material } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { CelulaCobertura } from "@/components/celula-cobertura";
import { MaterialActions, MaterialMenu } from "@/components/material-actions";
import { MaterialThumb } from "@/components/material-thumb";
import { NovoMaterialDialog } from "@/components/novo-material-dialog";
import { cn } from "@/lib/utils";

// Hub da biblioteca (REALIZA-173): faixa de cobertura 1..N + um <details>
// por encontro + o bloco transversal (guias/modelos/conteúdos sem encontro).
// A coord responde "o que falta" sem scroll; os demais papéis veem a mesma
// estrutura em leitura (sem MaterialActions/NovoMaterialDialog).
// REALIZA-194 (v5c): cada <details> de encontro abre com a nota do guia —
// "o que o encontro cobre" pra staff × "como conduzir" pro mentor, mesma
// fonte de como-conduzir.ts da ficha da dupla (o staff lê a sugestão ao
// mentor atrás de um <details> aninhado, sem poluir a leitura dele).

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
 *  ao longo do ciclo), não erro. Exportada: a faixa de KPIs e a contagem
 *  "com material" da trilha usam a mesma régua (REALIZA-184). */
export function temConteudo(m: Material): boolean {
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
 *  "em breve", tracejado = vazio. Cada célula ancora no <details> do encontro.
 *  REALIZA-184 — virou o primeiro GRUPO colapsável da página (details +
 *  summary com a contagem "x/y com material"); aberto por padrão em todo
 *  viewport porque é o mapa de navegação da biblioteca. */
export function CoberturaTrilha({
  porEncontro,
  nums,
}: {
  porEncontro: Map<number, Material[]>;
  nums: number[];
}) {
  const cobertos = nums.filter((n) =>
    (porEncontro.get(n) ?? []).some(temConteudo)
  ).length;
  return (
    <details
      open
      className="group animate-enter rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5"
    >
      <summary className="flex min-h-11 sm:min-h-8 cursor-pointer list-none items-center gap-x-2.5 rounded-lg select-none marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <CaretRight
          size={14}
          weight="bold"
          aria-hidden
          className="shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
        />
        {/* role=heading no lugar de <h2>: o content model do summary não
            admite heading — mesmo padrão do EncontroDetails */}
        <span role="heading" aria-level={2} className="text-sm font-semibold">
          Cobertura por encontro
        </span>
        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
          {cobertos}/{nums.length} com material
        </span>
      </summary>
      {/* a legenda é a alternativa touch do title das células — sem ela o
          código de cor não tem como ser lido no toque */}
      <ul className="mt-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
      <ol className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
        {nums.map((n) => {
          // estado/rótulo resolvidos no server — a célula client só cuida
          // do clique que abre o <details> de destino
          const itens = porEncontro.get(n) ?? [];
          const k = itens.length;
          const comConteudo = itens.filter(temConteudo).length;
          const estado =
            k === 0 ? "vazio" : comConteudo > 0 ? "coberto" : "parcial";
          const rotulo =
            estado === "vazio"
              ? `Encontro ${n} · sem material`
              : `Encontro ${n} · ${k} ${k === 1 ? "material" : "materiais"}${
                  comConteudo < k ? ` · ${k - comConteudo} em breve` : ""
                }`;
          return (
            <li key={n} className="shrink-0">
              <CelulaCobertura n={n} estado={estado} rotulo={rotulo} />
            </li>
          );
        })}
      </ol>
    </details>
  );
}

/** A nota do guia no corpo do <details> (v5c) — uma fonte só em
 *  `guiaDoEncontro` (como-conduzir.ts): o mentor lê "como conduzir" em
 *  voz de ação; a staff lê "o que o encontro cobre" em voz de cobertura e
 *  a sugestão ao mentor atrás de gesto. Sem guia pro nº (cronograma
 *  estendido/trilha especialista) não renderiza — regra "não inventar". */
export type GuiaPapel = "staff" | "mentor";

function GuiaNota({
  n,
  guiaPapel,
}: {
  n: number;
  guiaPapel?: GuiaPapel | null;
}) {
  const guia = guiaPapel ? guiaDoEncontro(n) : null;
  if (!guia) return null;
  return (
    <div className="border-t border-border/60 bg-muted/30 px-5 py-3 text-xs leading-relaxed text-muted-foreground">
      {guiaPapel === "mentor" ? (
        <p className="flex items-start gap-2">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold text-foreground">
              Como conduzir:
            </strong>{" "}
            {guia.conduzir}
          </span>
        </p>
      ) : (
        <div className="flex items-start gap-2">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <p>
              <strong className="font-semibold text-foreground">
                O que o encontro cobre:
              </strong>{" "}
              {guia.cobre}
            </p>
            <details className="group mt-1">
              <summary className="inline-flex min-h-11 sm:min-h-8 cursor-pointer list-none items-center gap-1 font-medium underline-offset-2 outline-none transition-colors select-none marker:hidden hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                O que o guia sugere ao mentor
                <CaretDown
                  size={12}
                  aria-hidden
                  className="transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="mt-1">{guia.conduzir}</p>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}

export function EncontroDetails({
  n,
  titulo,
  itens,
  ehCoord,
  maxEncontro,
  indice,
  aberto,
  oculto,
  total,
  atual,
  guiaPapel,
}: {
  n: number;
  titulo?: string;
  itens: Material[];
  ehCoord: boolean;
  maxEncontro: number;
  indice: number;
  /** SSR `open` — usuário continua podendo abrir/fechar à mão (React só
   *  reescreve o atributo se a prop mudar, e ela é estável por encontro). */
  aberto?: boolean;
  /** Filtro zerou os itens do encontro — linha fora da tela, estado mantido. */
  oculto?: boolean;
  /** Contagem sem filtro — summary mostra "x de total" enquanto filtrando. */
  total?: number;
  /** Encontro vigente do calendário — marcado no summary. */
  atual?: boolean;
  /** Quem lê a nota do guia (v5c): staff vê "o que cobre", mentor vê
   *  "como conduzir"; null não renderiza (especialista — a trilha dele
   *  não passa pelas janelas DPP). */
  guiaPapel?: GuiaPapel | null;
}) {
  /* Linha do hub por encontro — <details> colapsado por padrão: o summary
     carrega o nº, a contagem e o pill do pior estado; abrindo, a nota do
     guia + as linhas de material com MaterialActions e o atalho "adicionar
     neste encontro" (coord). */
  const k = itens.length;
  return (
    <details
      id={`mat-encontro-${n}`}
      open={aberto}
      hidden={oculto}
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
        {/* encontro vigente do calendário — explica por que a linha já vem
            aberta no desktop */}
        {atual && (
          <Badge
            variant="outline"
            className="shrink-0 border-[var(--brand-lime)]/50 bg-[var(--brand-lime)]/15 text-[11px] font-semibold"
          >
            semana atual
          </Badge>
        )}
        {/* título do encontro visível em todo viewport — trunca em vez de
            sumir no mobile: "Encontro 7" sozinho não diz o tema da semana */}
        {titulo && (
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {titulo}
          </span>
        )}
        {k > 0 ? (
          <span className="ml-auto flex shrink-0 items-center gap-2 pl-2">
            <span className="text-xs tabular-nums text-muted-foreground">
              {total != null && k < total
                ? `${k} de ${total}`
                : `${k} ${k === 1 ? "material" : "materiais"}`}
            </span>
            <PillEstado itens={itens} />
          </span>
        ) : (
          <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground">
            sem material ainda
          </span>
        )}
      </summary>
      {/* a nota do guia abre o corpo — contexto do encontro antes da
          lista de materiais, nos dois estados (com e sem material) */}
      <GuiaNota n={n} guiaPapel={guiaPapel} />
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
 *  seções por tipo (mesma anatomia de linha do hub). O heading "Transversais"
 *  mora no grupo colapsável do shell (REALIZA-184) — aqui ficam só as
 *  seções. Grupo sem itens (filtro ativo) não renderiza — o pill de
 *  contagem do grupo já avisa o zero. */
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
    <div className="space-y-5">
      {grupos.map(({ tipo, itens }, i) =>
        itens.length === 0 ? null : (
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
        )
      )}
    </div>
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
      {/* REALIZA-185/194 — material com arquivo mostra a capa de verdade
          (1ª página do PDF, lazy; imagem como <img>) no lugar do ícone do
          tipo — agora a thumb CURTA global (material-thumb: crop do topo,
          sem scroll interno), não o preview grande de leitura. O thumb
          portrait ~A4 fica dentro do link — é decorativo, o gesto segue
          sendo a linha */}
      <MaterialThumb
        m={m}
        className="h-20 w-14 shrink-0 rounded-lg"
        icone={18}
        fallback={
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted/70 text-muted-foreground">
            <Icone size={17} aria-hidden />
          </span>
        }
      />
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
        {/* 1 gesto principal (a linha-link) + ⋯ pras secundárias: o menu
            completo da coord (editar/anexar/e-mail/excluir) ou o de
            leitura (abrir/copiar link) pros demais papéis */}
        {ehCoord ? (
          <MaterialActions material={m} maxEncontro={maxEncontro} />
        ) : (
          <MaterialMenu material={m} />
        )}
      </div>
    </div>
  );
}
