"use client";

// /registros: lista compacta + registro completo. No desktop (lg+) o
// registro fica à direita; no celular a mesma lista ocupa a tela e o
// registro abre numa folha por cima (REALIZA-211 — a timeline de cards
// inteiros dava ~17 mil px de rolagem). A seleção mora na URL (`?r=<id>`),
// então o deep link, o voltar do navegador e o Cmd+click funcionam como nos
// chips da página. Setas movem o foco entre as linhas e trocam a seleção
// com `replace` (não enche o histórico).

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { DuplaNomes } from "@/components/dupla-nomes";
import { RegistroDetalhe, type EntradaRegistro } from "@/components/registros-detalhe";
import { AVALIACAO_LABEL, formatDiaMes, registroTardio } from "@/lib/ciclo";
import { cn } from "@/lib/utils";

export type BlocoLista = {
  chave: string;
  /** cabeçalho pronto do grupo ("Semana de 13/10", "Avaliação: Boa") */
  rotulo: string;
  /** agrupamento por dupla: o cabeçalho mostra os nomes no padrão da app
   *  (DuplaNomes) em vez do rótulo, e cada linha mostra o tema */
  dupla?: { mentor: string; mentorado: string } | null;
  itens: EntradaRegistro[];
};

export type SecaoLista = {
  chave: string;
  /** título da seção (só no modo prioridade: "Precisam de olho") */
  titulo: string | null;
  blocos: BlocoLista[];
};

const AVALIACAO_TEXTO: Record<string, string> = {
  excelente: "text-[var(--ok-text)]",
  boa: "text-[var(--ok-text)]",
  regular: "text-[var(--warn-text)]",
  baixa: "text-[var(--warn-text)]",
};

const MQ_DESKTOP = "(min-width: 1024px)";
function assinaDesktop(cb: () => void) {
  const mq = window.matchMedia(MQ_DESKTOP);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function RegistrosMestreDetalhe({
  secoes,
  selecionadoId,
  hrefBase,
  chaveLista,
  souCoord,
  souMentor = false,
  perspectiva = "mentor",
  agrupadoPorDupla,
  rodape,
}: {
  secoes: SecaoLista[];
  /** id do registro aberto (vem da URL); cai no primeiro exibido se faltar */
  selecionadoId: string | null;
  /** URL da lista sem `r` — o componente acrescenta `r=<id>` em cada linha */
  hrefBase: string;
  /** muda com filtro, busca, ordem ou agrupamento: re-key anima a troca */
  chaveLista: string;
  souCoord: boolean;
  souMentor?: boolean;
  perspectiva?: "mentor" | "jovem" | "ambos";
  /** agrupado por dupla: os nomes já estão no cabeçalho, então a linha mostra o tema */
  agrupadoPorDupla: boolean;
  /** "Mostrar mais" da página, dentro da rolagem da lista */
  rodape?: ReactNode;
}) {
  const router = useRouter();
  const listaRef = useRef<HTMLDivElement>(null);
  // SSR = desktop: a folha só abre depois da hidratação no celular, nunca
  // pisca aberta no desktop
  const desktop = useSyncExternalStore(
    assinaDesktop,
    () => window.matchMedia(MQ_DESKTOP).matches,
    () => true
  );
  const exibidos = secoes.flatMap((s) => s.blocos.flatMap((b) => b.itens));
  const sel =
    exibidos.find((e) => e.r.id === selecionadoId) ?? exibidos[0] ?? null;
  const hrefDe = (id: string) =>
    `${hrefBase}${hrefBase.includes("?") ? "&" : "?"}r=${id}`;

  function onKeyDown(ev: KeyboardEvent<HTMLDivElement>) {
    const links = Array.from(
      listaRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-registro]") ?? []
    );
    const atual = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (atual < 0) return;
    let alvo: number;
    switch (ev.key) {
      case "ArrowDown":
        alvo = atual + 1;
        break;
      case "ArrowUp":
        alvo = atual - 1;
        break;
      case "Home":
        alvo = 0;
        break;
      case "End":
        alvo = links.length - 1;
        break;
      default:
        return;
    }
    if (alvo < 0 || alvo >= links.length) return;
    ev.preventDefault();
    const el = links[alvo];
    el.focus();
    const id = el.dataset.registro;
    if (id) router.replace(hrefDe(id), { scroll: false });
  }

  if (!sel) return null;

  const posicao = new Map(exibidos.map((e, i) => [e.r.id, i]));
  // no celular só há seleção quando a URL pede (?r=) — sem ela a lista
  // não marca ninguém e a folha fica fechada
  const escolhido = selecionadoId != null && sel.r.id === selecionadoId;
  const marcado = desktop || escolhido ? sel.r.id : null;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(17rem,2fr)_minmax(0,3fr)] lg:items-start">
      <div
        key={chaveLista}
        ref={listaRef}
        onKeyDown={onKeyDown}
        className="scroll-fina min-w-0 rounded-xl bg-card p-1.5 shadow-[var(--shadow-border)] lg:max-h-[38rem] lg:overflow-y-auto"
      >
        {secoes.map((sec) => {
          const TagGrupo = sec.titulo ? "h3" : "h2";
          return (
            <section key={sec.chave} className={cn(sec.titulo && "mb-6 last:mb-0")}>
              {sec.titulo && (
                <h2 className="px-3 pb-1 text-base font-semibold">{sec.titulo}</h2>
              )}
              {sec.blocos.map((b, bi) => (
                <div
                  key={b.chave}
                  className={cn(
                    "border-t border-border/60 first:border-t-0",
                    bi > 0 && "mt-2 pt-2"
                  )}
                >
                  <TagGrupo className="px-3 pb-1 pt-1.5 text-sm font-semibold">
                    {b.dupla ? (
                      <DuplaNomes mentor={b.dupla.mentor} mentorado={b.dupla.mentorado} />
                    ) : (
                      b.rotulo
                    )}
                    <span className="font-normal text-muted-foreground">
                      {" · "}
                      {b.itens.length}{" "}
                      {b.itens.length === 1 ? "registro" : "registros"}
                    </span>
                  </TagGrupo>
                  <ol>
                    {b.itens.map((e) => (
                      <li key={e.r.id}>
                        <LinhaRegistro
                          entrada={e}
                          ativo={e.r.id === marcado}
                          foco={e.r.id === sel.r.id}
                          href={hrefDe(e.r.id)}
                          indice={posicao.get(e.r.id) ?? 0}
                          mostrarTema={agrupadoPorDupla}
                        />
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </section>
          );
        })}
        {rodape && <div className="pt-3">{rodape}</div>}
      </div>

      <div className="hidden min-w-0 lg:sticky lg:top-4 lg:block">
        <RegistroDetalhe key={sel.r.id} entrada={sel} souCoord={souCoord} />
      </div>

      <Dialog
        open={!desktop && escolhido}
        onOpenChange={(aberto) => {
          if (!aberto) router.replace(hrefBase, { scroll: false });
        }}
      >
        {/* shell transparente: o card do RegistroDetalhe é a superfície. O X
            absoluto cai no canto do card — o pr-9 no h2 impede que título
            longo corra por baixo dele (no desktop não há X, então a folga
            mora só aqui) */}
        <DialogContent
          size="xl"
          className="gap-0 bg-transparent p-0 shadow-none [&_h2]:pr-9"
        >
          <DialogTitle className="sr-only">Registro do encontro</DialogTitle>
          <DialogDescription className="sr-only">
            Registro completo do encontro selecionado na lista.
          </DialogDescription>
          <RegistroDetalhe entrada={sel} souCoord={souCoord} souMentor={souMentor} perspectiva={perspectiva} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Uma linha por registro: encontro Nº e data, dupla, avaliação e sinais.
 *  Nome de dupla não trunca (convenção): quebra linha se for longo. */
function LinhaRegistro({
  entrada,
  ativo,
  foco,
  href,
  indice,
  mostrarTema,
}: {
  entrada: EntradaRegistro;
  ativo: boolean;
  /** a linha que recebe o Tab (roving tabindex) — a selecionada, ou a 1ª */
  foco: boolean;
  href: string;
  indice: number;
  mostrarTema: boolean;
}) {
  const { r, passoEsp } = entrada;
  const enc = r.encontro;
  const dupla = enc?.dupla ?? null;
  const numero = passoEsp ?? enc?.numero ?? null;
  const quando = enc?.realizado_em ?? enc?.data_hora ?? r.created_at;
  const tardio = registroTardio(r, enc);
  const dificuldade = r.dificuldade && r.dificuldade !== "nenhuma";

  return (
    <Link
      href={href}
      scroll={false}
      data-registro={r.id}
      tabIndex={foco ? 0 : -1}
      aria-current={ativo ? "true" : undefined}
      style={{ "--i": Math.min(indice, 10) } as CSSProperties}
      className={cn(
        // 5.5rem cabe a data "20/10/2026" sem sobrepor a coluna do nome
        "animate-enter grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-2.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
        ativo ? "bg-muted" : "hover:bg-muted/60"
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight tabular-nums">
          {numero != null ? `${numero}º` : "—"}
        </span>
        <span className="block text-xs tabular-nums text-muted-foreground">
          {formatDiaMes(quando)}
        </span>
      </span>

      <span className="min-w-0 text-sm font-medium leading-snug">
        {mostrarTema ? (
          r.tema ? (
            r.tema
          ) : (
            <span className="font-normal text-muted-foreground">Sem tema registrado</span>
          )
        ) : dupla?.mentor && dupla?.mentorado ? (
          <DuplaNomes mentor={dupla.mentor.nome} mentorado={dupla.mentorado.nome} />
        ) : (
          "Dupla removida"
        )}
      </span>

      <span className="flex max-w-[11rem] flex-wrap justify-end gap-x-2 gap-y-0.5 text-xs">
        {r.avaliacao && (
          <span className={cn("font-medium", AVALIACAO_TEXTO[r.avaliacao])}>
            {AVALIACAO_LABEL[r.avaliacao] ?? r.avaliacao}
          </span>
        )}
        {r.precisa_apoio && (
          <span className="font-semibold text-[var(--danger-text)]">apoio</span>
        )}
        {tardio && <span className="text-[var(--warn-text)]">tardio</span>}
        {dificuldade && (
          <span className="text-[var(--warn-text)]">dificuldade</span>
        )}
      </span>
    </Link>
  );
}
