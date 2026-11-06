"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Collapsible } from "@base-ui/react/collapsible";
import { CaretDown } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  criarCombinadoEncontro,
  editarEncaminhamento,
  excluirEncaminhamento,
  toggleEncaminhamento,
} from "@/lib/actions";
import { formatDiaMes } from "@/lib/ciclo";
import { demoAtivoClient } from "@/lib/demo/shared";
import type { Encaminhamento } from "@/lib/types";
import {
  CombinadoMenu,
  EditarCombinadoDialog,
  ExcluirCombinadoConfirm,
} from "@/components/combinado-acoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { novoUuid } from "@/lib/uuid";

/** Estado "aberto" FORA do componente (REALIZA-21 fix): criar o 1º
 *  pendente tira o card do agrupador "Próximos N encontros" e o React
 *  remonta o bloco — useState interno morreria junto e o painel fechava
 *  logo após criar (bug visto no e2e). O mapa por (dupla,nº) devolve a
 *  escolha do usuário na remontagem; reload de página recomeça pelo padrão. */
const abertoPorBloco = new Map<string, boolean>();

type Responsavel = "mentor" | "mentorado";

/** Combinados do encontro (0157: os afazeres viraram combinados) — uma
 *  lista só por nº do guia, logo abaixo do registro: o que a dupla combinou
 *  no registro e o que o mentor anotou no preparo, cada um com o
 *  responsável. O do mentorado ele vê na área dele; o do mentor fica entre
 *  o mentor e a equipe. Pendentes de nºs anteriores reaparecem aqui
 *  taggeados "do Nº encontro" — a origem evita ler pendência antiga como
 *  item novo. Marcar feito aqui ou na aba Combinados dá no mesmo. */
export function CombinadosEncontro({
  duplaId,
  numero,
  itens,
  pendentesAnteriores = [],
  jovemNome,
  podeEditar,
  podeMarcar,
}: {
  duplaId: string;
  /** nº do passo do guia — a âncora da lista (não o encontro físico). */
  numero: number;
  /** Combinados deste nº (feitos e pendentes). */
  itens: Encaminhamento[];
  /** Pendentes de nºs anteriores — carry-over marcável aqui mesmo. */
  pendentesAnteriores?: Encaminhamento[];
  /** Primeiro nome do mentorado — rótulo do responsável. */
  jovemNome: string;
  /** Mentor da dupla viva: adiciona e remove. */
  podeEditar: boolean;
  /** Mentor ou coordenação em dupla ativa: marca feito. */
  podeMarcar: boolean;
}) {
  const [pending, start] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [novo, setNovo] = useState("");
  const [prazo, setPrazo] = useState("");
  const [responsavel, setResponsavel] = useState<Responsavel>("mentor");
  // edição/exclusão via menu ⋯ — o item alvo carrega de qual lista ele é
  // (própria ou "De antes") pro modo demo mexer no estado certo
  const [editando, setEditando] = useState<{
    c: Encaminhamento;
    carryOver: boolean;
  } | null>(null);
  const [excluindo, setExcluindo] = useState<{
    c: Encaminhamento;
    carryOver: boolean;
  } | null>(null);
  const chaveBloco = `${duplaId}:${numero}`;
  // abre sozinho quando há o que ver — fechado escondia o que a dupla
  // combinou atrás de um rótulo que ninguém abria
  const [aberto, setAberto] = useState(
    () =>
      abertoPorBloco.get(chaveBloco) ??
      itens.length + pendentesAnteriores.length > 0
  );
  const router = useRouter();

  // deep link #combinados-<nº> (aviso "Combinados em aberto" da Minha
  // agenda): a aba Encontros já está montada quando este card existe —
  // falta abrir o painel se estiver fechado e rolar até a âncora. O mount
  // cobre a chegada de fora (o AbaPorHash trocou pra ?aba=encontros com
  // scroll desligado); hashchange/popstate/realiza:hash cobrem o clique
  // com a página já aberta — mesmo padrão do #registrar-<id>
  useEffect(() => {
    const alvo = `#combinados-${numero}`;
    const conferir = () => {
      if (window.location.hash !== alvo) return;
      setAberto(true);
      abertoPorBloco.set(chaveBloco, true);
      const el = document.getElementById(`combinados-${numero}`);
      if (!el) return;
      const reduzir = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      el.scrollIntoView({
        block: "start",
        behavior: reduzir ? "auto" : "smooth",
      });
    };
    conferir();
    window.addEventListener("hashchange", conferir);
    window.addEventListener("popstate", conferir);
    window.addEventListener("realiza:hash", conferir);
    return () => {
      window.removeEventListener("hashchange", conferir);
      window.removeEventListener("popstate", conferir);
      window.removeEventListener("realiza:hash", conferir);
    };
  }, [chaveBloco, numero]);
  // demo: criar/marcar/remover funcionam em estado local — nenhuma action
  // dispara (seria toast DEMO_MSG por gesto) e nada sobra pro próximo visitante
  const [demo] = useState(demoAtivoClient);
  const [itensLoc, setItensLoc] = useState(itens);
  const [antLoc, setAntLoc] = useState(pendentesAnteriores);
  const feito = (c: Encaminhamento) => c.status === "feito";
  const lista = (demo ? itensLoc : itens)
    .slice()
    .sort((a, b) =>
      feito(a) !== feito(b)
        ? feito(a)
          ? 1
          : -1
        : a.created_at.localeCompare(b.created_at)
    );
  const anteriores = (demo ? antLoc : pendentesAnteriores)
    .slice()
    .sort(
      (a, b) =>
        (a.numero ?? 0) - (b.numero ?? 0) ||
        a.created_at.localeCompare(b.created_at)
    );

  function toggle(c: Encaminhamento, carryOver: boolean) {
    const alvo = !feito(c);
    if (demo) {
      // item feito sai do "De antes" (o recorte é pendente); item próprio
      // fica na lista, riscado — mesmo resultado do refresh contra o banco
      if (carryOver && alvo) {
        setAntLoc((l) => l.filter((x) => x.id !== c.id));
      } else {
        (carryOver ? setAntLoc : setItensLoc)((l) =>
          l.map((x) =>
            x.id === c.id
              ? {
                  ...x,
                  status: alvo ? "feito" : "pendente",
                  feito_em: alvo ? new Date().toISOString() : null,
                }
              : x
          )
        );
      }
      return;
    }
    setPendingId(c.id);
    start(async () => {
      try {
        const res = await toggleEncaminhamento(c.id, alvo, duplaId);
        if (res?.error) toast.error(res.error);
        else router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      } finally {
        setPendingId(null);
      }
    });
  }

  // exclusão passa pelo dialog de confirmação — na demo remove do estado
  // local (mesmo resultado do refresh contra o banco)
  function excluir() {
    if (!excluindo) return Promise.resolve({});
    const { c, carryOver } = excluindo;
    if (demo) {
      (carryOver ? setAntLoc : setItensLoc)((l) =>
        l.filter((x) => x.id !== c.id)
      );
      return Promise.resolve({ ok: true });
    }
    return excluirEncaminhamento(c.id, duplaId);
  }

  // edição passa pelo EditarCombinadoDialog — na demo aplica o patch no
  // estado local; fora dela vai na mesma action da aba Agora
  function salvarEdicao(fd: FormData) {
    if (!editando) return Promise.resolve({});
    const { c, carryOver } = editando;
    if (demo) {
      const descricao = String(fd.get("descricao") ?? "").trim();
      const resp: Responsavel =
        fd.get("responsavel") === "mentor" ? "mentor" : "mentorado";
      const prazoEd = String(fd.get("prazo") ?? "").trim() || null;
      (carryOver ? setAntLoc : setItensLoc)((l) =>
        l.map((x) =>
          x.id === c.id
            ? { ...x, descricao, responsavel: resp, prazo: prazoEd }
            : x
        )
      );
      return Promise.resolve({ ok: true });
    }
    return editarEncaminhamento(c.id, duplaId, fd);
  }

  function adicionar() {
    const limpo = novo.trim();
    if (!limpo || pending) return;
    const prazoLimpo = prazo;
    setNovo("");
    setPrazo("");
    if (demo) {
      const agora = new Date().toISOString();
      setItensLoc((l) => [
        ...l,
        {
          id: novoUuid(),
          dupla_id: duplaId,
          registro_id: null,
          numero,
          descricao: limpo,
          responsavel,
          prazo: prazoLimpo || null,
          status: "pendente",
          feito_em: null,
          created_by: null,
          created_at: agora,
        },
      ]);
      return;
    }
    start(async () => {
      try {
        const res = await criarCombinadoEncontro(duplaId, numero, limpo, responsavel, prazoLimpo || null);
        if (res?.error) {
          toast.error(res.error);
          // devolve o que estava preenchido — a digitação não se perde
          setNovo(limpo);
          setPrazo(prazoLimpo);
        } else {
          router.refresh();
        }
      } catch {
        toast.error("Sem conexão. Tente de novo.");
        setNovo(limpo);
        setPrazo(prazoLimpo);
      }
    });
  }

  const pendentes = lista.filter((c) => !feito(c)).length + anteriores.length;
  const total = lista.length + anteriores.length;
  // coord/sup sem nada pra ver: a seção nem aparece
  if (!podeEditar && total === 0) return null;
  const sufixo =
    pendentes > 0
      ? `${pendentes} ${pendentes === 1 ? "pendente" : "pendentes"}`
      : total > 0
        ? "tudo feito"
        : null;
  const rotuloResp = (r: Responsavel) =>
    r === "mentor" ? (podeEditar ? "Você" : "Mentor") : jovemNome;

  const texto = (c: Encaminhamento, carryOver: boolean) => (
    <span className="block min-w-0 flex-1">
      {/* o riscado é binário como na aba Combinados — text-decoration não
          anima e um line-through sempre ativo entregaria "texto suprimido"
          pra leitor de tela */}
      <span
        className={cn(
          "block break-words text-sm transition-colors",
          feito(c) && "text-muted-foreground line-through"
        )}
      >
        {carryOver && c.numero != null && (
          <span className="text-muted-foreground">
            do {c.numero}º encontro ·{" "}
          </span>
        )}
        {c.descricao}
      </span>
      <span className="mt-0.5 block text-xs text-muted-foreground">
        {rotuloResp(c.responsavel)}
        {c.prazo ? ` · até ${formatDiaMes(c.prazo)}` : ""}
      </span>
    </span>
  );

  // checkbox nativo + label — teclado e clique no texto de graça; o quadrado
  // estilizado é só a representação (mesmo padrão da aba Combinados)
  const itemMarcavel = (c: Encaminhamento, carryOver: boolean) => (
    <li key={c.id} className="flex items-start gap-1">
      <label
        className={cn(
          "group flex min-w-0 flex-1 cursor-pointer items-start gap-3 py-2 transition-colors",
          pending && pendingId === c.id && "opacity-60"
        )}
      >
        <input
          type="checkbox"
          className="peer sr-only"
          checked={feito(c)}
          disabled={pending && pendingId === c.id}
          onChange={() => toggle(c, carryOver)}
        />
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card",
            feito(c)
              ? "border-[var(--ok)] bg-[var(--ok)] text-[var(--status-foreground)]"
              : "border-muted-foreground/40 group-hover:border-foreground"
          )}
        >
          {feito(c) && (
            <svg
              viewBox="0 0 10 8"
              className="size-2.5 fill-none stroke-current stroke-2"
            >
              <path d="M1 4l2.5 2.5L9 1" />
            </svg>
          )}
        </span>
        {texto(c, carryOver)}
      </label>
      {podeEditar && (
        <CombinadoMenu
          descricao={c.descricao}
          onEditar={() => setEditando({ c, carryOver })}
          onExcluir={() => setExcluindo({ c, carryOver })}
          className="mt-0.5 size-11 shrink-0 sm:size-8"
        />
      )}
    </li>
  );

  // leitura: anel fino é gramática de status, não de controle — um quadrado
  // pareceria checkbox desabilitado (mesma leitura da aba Combinados)
  const itemLeitura = (c: Encaminhamento, carryOver: boolean) => (
    <li key={c.id} className="flex items-start gap-3 py-1.5">
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 size-2.5 shrink-0 rounded-full border-2",
          feito(c) ? "border-[var(--ok)]" : "border-muted-foreground/50"
        )}
      />
      {texto(c, carryOver)}
    </li>
  );
  const item = podeMarcar ? itemMarcavel : itemLeitura;

  return (
    <div id={`combinados-${numero}`} className="scroll-mt-20">
      <Collapsible.Root
        open={aberto}
        onOpenChange={(o) => {
          setAberto(o);
          abertoPorBloco.set(chaveBloco, o);
        }}
      >
        <Collapsible.Trigger className="group grid min-h-11 w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 rounded-md py-1.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9">
          <span className="font-medium text-foreground/80">Combinados</span>
          {sufixo && (
            <span className="min-w-0 truncate text-muted-foreground">
              · {sufixo}
            </span>
          )}
          <CaretDown
            size={14}
            aria-hidden
            className="col-start-3 justify-self-end text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
          />
        </Collapsible.Trigger>
        {/* itens e o rascunho moram no estado acima — fechar desmonta o painel
            sem perder o que estava sendo digitado */}
        <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
          <div className="pb-1 pl-0.5">
            {total === 0 && (
              <p className="py-1 text-sm text-muted-foreground">
                O que você ou {jovemNome} precisam fazer, ex.: enviar o
                material depois.
              </p>
            )}
            {lista.length > 0 && (
              <ul className="divide-y divide-border/60">
                {lista.map((c) => item(c, false))}
              </ul>
            )}
            {anteriores.length > 0 && (
              <div className={cn(lista.length > 0 && "border-t border-border/60")}>
                <p className="pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  De antes
                </p>
                <ul className="divide-y divide-border/60">
                  {anteriores.map((c) => item(c, true))}
                </ul>
              </div>
            )}
            {podeEditar && (
              <form
                className="mt-1 flex flex-wrap items-center gap-2 sm:flex-nowrap"
                onSubmit={(e) => {
                  e.preventDefault();
                  adicionar();
                }}
              >
                <Input
                  value={novo}
                  onChange={(e) => setNovo(e.target.value)}
                  maxLength={500}
                  placeholder="Adicionar combinado…"
                  aria-label={`Novo combinado do ${numero}º encontro`}
                  disabled={pending}
                  className="h-9 min-w-0 flex-1 basis-48 border-0 bg-muted/40 px-3 shadow-none focus-visible:ring-1"
                />
                {/* quem faz — dois botões e não um select: a escolha é
                    binária e fica visível sem abrir nada */}
                <div
                  role="group"
                  aria-label="Quem faz"
                  className="flex shrink-0 rounded-md bg-muted/40 p-0.5"
                >
                  {(["mentor", "mentorado"] as const).map((r) => (
                    <Button
                      key={r}
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-pressed={responsavel === r}
                      onClick={() => setResponsavel(r)}
                      className={cn(
                        "h-8 max-w-[10rem] truncate px-2.5 text-xs",
                        responsavel === r
                          ? "bg-card text-foreground shadow-sm hover:bg-card"
                          : "text-muted-foreground"
                      )}
                    >
                      {rotuloResp(r)}
                    </Button>
                  ))}
                </div>
                {/* prazo opcional — mesmo campo do dialog de edição; vazio
                    grava null */}
                <Input
                  type="date"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                  aria-label="Prazo"
                  disabled={pending}
                  className="h-9 w-40 shrink-0 border-0 bg-muted/40 px-3 shadow-none focus-visible:ring-1"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={pending || novo.trim().length < 2}
                >
                  Adicionar
                </Button>
              </form>
            )}
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
      {/* edição e exclusão — um dialog por bloco, compartilhado com a aba
          Agora; na demo a mutação é o estado local acima */}
      <EditarCombinadoDialog
        editando={editando?.c ?? null}
        onOpenChange={(o) => !o && setEditando(null)}
        onSalvar={salvarEdicao}
      />
      <ExcluirCombinadoConfirm
        excluindo={excluindo?.c ?? null}
        onOpenChange={(o) => !o && setExcluindo(null)}
        onConfirm={excluir}
      />
    </div>
  );
}
