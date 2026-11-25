"use client";

import { useState, type CSSProperties } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import {
  CaretDown,
  FolderOpen,
  LockSimple,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { diaMesCurto, linkSeguro } from "@/lib/ciclo";
import { materialLiberadoParaJovem } from "@/lib/jornada";
import type { Material } from "@/lib/types";
import { ContagemTitulo, Linha } from "@/components/biblioteca-lista";
import {
  MaterialCard,
  TIPO_ICONE,
  TIPO_LABEL,
} from "@/components/material-card";
import { MaterialMenu } from "@/components/material-actions";
import { useViewBiblioteca } from "@/components/biblioteca-view-toggle";

// Acervo do jovem (spec 029 + 528): a mesma biblioteca de sempre com as
// duas gramáticas — Cartões (a estante com capa tipográfica, anatomia do
// MaterialCard compartilhado) e Lista (as linhas da BibliotecaLista).
// O alternador mora no header da seção (Acervo) e o estado vem do mesmo
// store por superfície ("jovem"); mentorado sem dupla cai aqui pelo
// fallback da página e vê o mesmo controle. Cada grupo vira uma seção
// colapsável (a régua compacta do mobile) com contagem no rótulo — o
// estado fica neste componente, fora da subárvore re-keyed por
// `${rotulo}:${view}`, pra troca de view não zerar a dobra. O grupo
// "Mais adiante na jornada" segue sendo <details> fechado — ele já é o
// recap de trancados, não uma seção da biblioteca.

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

const DOC_BASE_JOVEM = "/jovem/materiais/documento";

/** O card do acervo é a anatomia compartilhada com o ⋯ de leitura no
 *  canto da capa (MaterialMenu — abrir em nova aba / copiar link). */
function MaterialCardJovem({ m }: { m: Material }) {
  return (
    <MaterialCard
      m={m}
      docBase={DOC_BASE_JOVEM}
      acoes={<MaterialMenu material={m} docBase={DOC_BASE_JOVEM} />}
    />
  );
}

export function MateriaisLista({
  materiais,
  encCorrente = null,
  datasEnc = null,
}: {
  materiais: Material[];
  /** régua do acervo progressivo (REALIZA-160): nº do encontro corrente da
   *  dupla viva. null = sem jornada em curso → tudo liberado. */
  encCorrente?: number | null;
  /** numero → data oficial da turma dela (cronograma), pro "libera em
   *  dd/mm" dos trancados. null no fallback sem cronograma. */
  datasEnc?: Map<number, string> | null;
}) {
  const [view] = useViewBiblioteca("jovem");
  // grupos colapsáveis (528): o estado mora aqui, fora da subárvore
  // re-keyed por `${rotulo}:${view}` — trocar Cartões/Lista não zera a
  // dobra. Set de rótulos FECHADOS: tudo aberto por padrão e o gesto do
  // usuário é o que dobra. "A caminho" e "Mais adiante" não entram: o
  // primeiro já é apagado por desenho, o segundo é <details>.
  const [fechados, setFechados] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const alternaGrupo = (rotulo: string, aberto: boolean) =>
    setFechados((s) => {
      const n = new Set(s);
      if (aberto) n.delete(rotulo);
      else n.add(rotulo);
      return n;
    });
  // REALIZA-162: o que já dá pra abrir vira grid; o "em breve" (sem path e
  // sem url — material real que a coordenação ainda não subiu) sai da
  // vitrine e fecha o acervo no grupo apagado "A caminho" — de-emphasized,
  // nunca escondido.
  // REALIZA-160: o material marcado com encontro futuro vira o terceiro
  // bucket — recolhido no <details> "Mais adiante na jornada", mesmo
  // tratamento das estações trancadas da trilha.
  const prontos: Material[] = [];
  const aCaminho: Material[] = [];
  const trancados: Material[] = [];
  for (const m of materiais) {
    if (!materialLiberadoParaJovem(m, encCorrente)) trancados.push(m);
    else if (m.path || linkSeguro(m.url)) prontos.push(m);
    else aCaminho.push(m);
  }
  trancados.sort((a, b) => (a.encontro_num ?? 0) - (b.encontro_num ?? 0));
  const grupos = agrupar(prontos);
  if (grupos.length === 0 && aCaminho.length === 0 && trancados.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-xl bg-card px-5 py-10 text-center shadow-[var(--shadow-border)]">
        <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <FolderOpen size={18} aria-hidden />
        </span>
        <p className="text-sm font-medium">Nenhum material por aqui ainda</p>
        <p className="text-sm text-muted-foreground">
          Os guias e conteúdos do programa aparecem quando a coordenação
          publicar.
        </p>
      </div>
    );
  }
  return (
    <>
      {grupos.map(([rotulo, itens], i) => (
        <section
          // re-key por view: o grupo remonta e a entrada anima (convenção
          // de movimento — troca nunca é repaint seco)
          key={`${rotulo}:${view}`}
          className="animate-enter space-y-2"
          style={{ "--i": Math.min(i, 10) } as CSSProperties}
        >
          <Collapsible.Root
            open={!fechados.has(rotulo)}
            onOpenChange={(o) => alternaGrupo(rotulo, o)}
          >
            {/* trigger dentro do h3: a região segue nomeada por heading e
                a linha toda vira alvo de toque ≥44px no mobile */}
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <Collapsible.Trigger className="group flex min-h-11 w-full items-center gap-1.5 rounded-lg px-2 -mx-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-7">
                <span className="min-w-0 flex-1">
                  {rotulo}
                  <ContagemTitulo n={itens.length} />
                </span>
                <CaretDown
                  size={14}
                  aria-hidden
                  className="shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
                />
              </Collapsible.Trigger>
            </h3>
            <Collapsible.Panel
              hiddenUntilFound
              className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden"
            >
              {view === "cards" ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {itens.map((m) => (
                    <MaterialCardJovem key={m.id} m={m} />
                  ))}
                </div>
              ) : (
                <ul className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card py-1 shadow-[var(--shadow-border)]">
                  {itens.map((m, j) => (
                    <Linha
                      key={m.id}
                      m={m}
                      ehCoord={false}
                      vigente={null}
                      indice={j}
                      docBase={DOC_BASE_JOVEM}
                      rastrear={false}
                      menu={
                        <MaterialMenu material={m} docBase={DOC_BASE_JOVEM} />
                      }
                    />
                  ))}
                </ul>
              )}
            </Collapsible.Panel>
          </Collapsible.Root>
        </section>
      ))}
      {aCaminho.length > 0 && (
        <section
          className="animate-enter space-y-2"
          style={{ "--i": Math.min(grupos.length, 10) } as CSSProperties}
        >
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            A caminho
          </h3>
          <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-dashed border-border bg-card/60">
            {aCaminho.map((m) => {
              const Icone = TIPO_ICONE[m.tipo];
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-x-4 px-5 py-3 text-muted-foreground"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted/70">
                    <Icone size={17} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground/80">
                      {m.titulo}
                    </p>
                    <span className="sr-only">{TIPO_LABEL[m.tipo]}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    em breve
                  </Badge>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {trancados.length > 0 && (
        <details
          className="group animate-enter rounded-xl border border-dashed border-border bg-card/60"
          style={
            {
              "--i": Math.min(grupos.length + (aCaminho.length ? 1 : 0), 10),
            } as CSSProperties
          }
        >
          {/* summary admite heading direto (phrasing + heading content) —
              mesmo padrão das estações: o grupo inteiro lê como seção */}
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-4 outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:p-5 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Mais adiante na jornada · {trancados.length}{" "}
                {trancados.length === 1 ? "material" : "materiais"}
              </h3>
              <span className="mt-1 block text-sm font-medium">
                {trancados
                  .slice(0, 2)
                  .map((m) => `${m.titulo} (enc. ${m.encontro_num})`)
                  .join(" · ")}
                {trancados.length > 2 && ` · +${trancados.length - 2}`}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Cada um abre sozinho quando a jornada chega no encontro.
              </span>
            </span>
            <CaretDown
              size={16}
              className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <ul className="divide-y divide-border/60 border-t border-dashed border-border px-4 sm:px-5">
            {trancados.map((m) => {
              const Icone = TIPO_ICONE[m.tipo];
              const data =
                m.encontro_num != null
                  ? diaMesCurto(datasEnc?.get(m.encontro_num))
                  : "";
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-x-4 py-3 text-muted-foreground"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted/70">
                    <Icone size={17} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground/80">
                      {m.titulo}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                      <LockSimple
                        size={13}
                        aria-hidden
                        className="shrink-0"
                      />
                      Libera no encontro {m.encontro_num}
                      {/* diaMesCurto já fecha com ponto ("4 de nov.") —
                          sem data a frase precisa dele */}
                      {data ? ` (${data})` : "."}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </>
  );
}
