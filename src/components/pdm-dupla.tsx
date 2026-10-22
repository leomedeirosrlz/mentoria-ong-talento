"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Compass,
  FlagCheckered,
  Lightbulb,
  PencilSimple,
  Plus,
} from "@phosphor-icons/react";
import {
  pdmReordenar,
  pdmRemoverItem,
  pdmSalvarItem,
  pdmSalvarVisao,
  pdmStatusItem,
} from "@/lib/actions-pdm";
import { formatDate } from "@/lib/ciclo";
import type { PdmDoc, PdmItemStatus, PdmNo } from "@/lib/pdm";
import {
  metasAtivas,
  montaArvorePdm,
  PDM_AREAS_VIDA,
  PDM_MAX_METAS,
  PDM_MAX_SUBITENS,
  progressoPdm,
  subitensAtivos,
} from "@/lib/pdm";
import { PdmArvore } from "@/components/pdm-arvore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// "Plano de desenvolvimento" — o documento vivo da dupla (REALIZA-181).
// Recebe o doc já resolvido pelo servidor (RPC pdm_da_dupla) e delega toda
// escrita às RPCs escopadas via actions; depois de cada gesto,
// router.refresh() traz o doc novo (a RPC é a fonte da verdade — sem
// estado otimista a reconciliar). `podeEditar` = mentor/mentorado da dupla
// viva; coord e supervisor recebem o mesmo bloco em leitura.

export function PdmDupla({
  duplaId,
  doc,
  podeEditar,
  mentoradoNome,
  className,
}: {
  duplaId: string;
  doc: PdmDoc;
  /** mentor ou mentorado da dupla ativa/pausada — espelho de
   *  pdm_pode_editar (a RPC revalida; aqui é só UI). */
  podeEditar: boolean;
  mentoradoNome: string;
  className?: string;
}) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [anuncio, setAnuncio] = useState("");

  // dialogs: visão · item (criar/editar) · confirmação de exclusão
  const [visaoAberta, setVisaoAberta] = useState(false);
  const [itemDialog, setItemDialog] = useState<
    | { modo: "nova-meta" }
    | { modo: "nova-submeta"; pai: PdmNo }
    | { modo: "editar"; item: PdmNo }
    | null
  >(null);
  const [excluirItem, setExcluirItem] = useState<PdmNo | null>(null);

  const arvore = useMemo(() => montaArvorePdm(doc.itens), [doc.itens]);
  const metas = useMemo(() => metasAtivas(doc.itens), [doc.itens]);
  const metasDescartadas = useMemo(
    () =>
      arvore.filter((n) => n.status === "descartada"),
    [arvore]
  );
  const nosVisiveis = useMemo(
    () => arvore.filter((n) => n.status !== "descartada"),
    [arvore]
  );
  const progresso = useMemo(() => progressoPdm(doc.itens), [doc.itens]);
  const subsAtivos = subitensAtivos(doc.itens);
  const cabeMeta = metas.length < PDM_MAX_METAS;
  const cabeSub = subsAtivos < PDM_MAX_SUBITENS;
  const tudoAtingido =
    progresso.total > 0 && progresso.atingidas === progresso.total;

  function executar(
    acao: () => Promise<{ error?: string } | { ok: true; data?: unknown }>,
    okMsg: string
  ) {
    setSalvando(true);
    void (async () => {
      try {
        const r = await acao();
        if ("error" in r && r.error) {
          toast.error(r.error);
          return;
        }
        setAnuncio(okMsg);
        toast.success(okMsg);
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      } finally {
        setSalvando(false);
      }
    })();
  }

  const acoes = {
    onStatus: (item: PdmNo, status: PdmItemStatus) =>
      executar(
        () => pdmStatusItem(duplaId, item.id, status),
        status === "atingida"
          ? `"${item.titulo}" marcada como atingida.`
          : status === "descartada"
            ? `"${item.titulo}" foi descartada — segue no histórico.`
            : `"${item.titulo}" voltou a ficar em andamento.`
      ),
    onEditar: (item: PdmNo) => setItemDialog({ modo: "editar", item }),
    onNovaSubmeta: (pai: PdmNo) =>
      setItemDialog({ modo: "nova-submeta", pai }),
    onMover: (item: PdmNo, direcao: -1 | 1, irmaos: PdmNo[]) => {
      const idx = irmaos.findIndex((i) => i.id === item.id);
      const alvo = idx + direcao;
      if (idx < 0 || alvo < 0 || alvo >= irmaos.length) return;
      const nova = [...irmaos];
      [nova[idx], nova[alvo]] = [nova[alvo], nova[idx]];
      executar(
        () => pdmReordenar(duplaId, item.parentId, nova.map((i) => i.id)),
        direcao === -1
          ? `"${item.titulo}" subiu pra ${alvo + 1}ª prioridade.`
          : `"${item.titulo}" desceu pra ${alvo + 1}ª prioridade.`
      );
    },
    onExcluir: (item: PdmNo) => setExcluirItem(item),
  };

  return (
    <section
      aria-label="Plano de desenvolvimento"
      className={cn(
        "rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-6 lg:p-7",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-[var(--brand-lime)]" />
            Plano de desenvolvimento
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            o documento vivo da dupla — visão, metas e o caminho até elas
          </p>
        </div>
        {tudoAtingido && (
          <Badge className="bg-[var(--ok)]/15 text-[var(--ok-text)]">
            <FlagCheckered data-icon="inline-start" aria-hidden />
            Todas as metas atingidas
          </Badge>
        )}
      </div>

      {/* ---------- Declaração de Visão ---------- */}
      <div className="mt-4 rounded-xl border border-[var(--brand-lime)]/40 bg-[var(--brand-lime)]/8 p-3.5 sm:p-4">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ok-text)]">
          <Compass size={13} aria-hidden />
          Declaração de Visão
        </p>
        {doc.visao ? (
          <>
            <blockquote className="mt-1.5 text-sm italic leading-relaxed">
              “{doc.visao}”
            </blockquote>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              {doc.visaoEm && <span>escrita em {formatDate(doc.visaoEm)}</span>}
              {podeEditar && (
                <button
                  type="button"
                  onClick={() => setVisaoAberta(true)}
                  className="inline-flex min-h-11 items-center gap-1 rounded-md px-1 font-medium text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
                >
                  <PencilSimple size={12} aria-hidden />
                  Editar
                </button>
              )}
            </p>
          </>
        ) : podeEditar ? (
          <div className="mt-2">
            <p className="text-xs leading-relaxed text-muted-foreground">
              A frase que aponta o norte da jornada — o que{" "}
              {mentoradoNome.split(" ")[0]} quer ser, alcançar ou conquistar.
              Ela pode sair do instrumento Visão ou ser escrita aqui com a
              dupla.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2.5"
              onClick={() => setVisaoAberta(true)}
            >
              <PencilSimple size={14} data-icon="inline-start" aria-hidden />
              Escrever a Declaração de Visão
            </Button>
          </div>
        ) : (
          <p className="mt-1.5 text-xs italic text-muted-foreground">
            Ainda não escrita — sai do instrumento Visão ou da conversa da
            dupla.
          </p>
        )}
      </div>

      {/* ---------- progresso ---------- */}
      {progresso.total > 0 && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">
                {progresso.atingidas}
              </span>{" "}
              de{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {progresso.total}
              </span>{" "}
              metas atingidas
            </p>
            <p className="text-[11px] text-muted-foreground">
              A ordem é a prioridade — a primeira meta é a mais importante
              agora.
            </p>
          </div>
          <div
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${progresso.atingidas} de ${progresso.total} metas atingidas`}
          >
            <div
              className="h-full rounded-full bg-[var(--brand-lime)] transition-[width]"
              style={{ width: `${progresso.pct}%` }}
            />
          </div>
        </div>
      )}

      {/* ---------- a árvore ---------- */}
      <div className="mt-4 sm:mt-5">
        {nosVisiveis.length === 0 && metasDescartadas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
            <Lightbulb
              size={22}
              aria-hidden
              className="mx-auto text-muted-foreground"
            />
            <p className="mt-2 text-sm font-medium">
              Nenhuma meta no plano ainda
            </p>
            <p className="mx-auto mt-1 max-w-72 text-xs leading-relaxed text-muted-foreground">
              As metas chegam pelos instrumentos Metas e PDM da jornada — ou
              nascem aqui, na conversa da dupla.
            </p>
            {podeEditar && cabeMeta && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setItemDialog({ modo: "nova-meta" })}
              >
                <Plus size={14} data-icon="inline-start" aria-hidden />
                Adicionar a primeira meta
              </Button>
            )}
          </div>
        ) : (
          <>
            <PdmArvore
              nos={nosVisiveis}
              podeEditar={podeEditar}
              podeAdicionarSub={podeEditar && cabeSub}
              acoes={acoes}
            />
            {metasDescartadas.length > 0 && (
              <details className="group mt-3 rounded-xl border border-dashed border-border">
                <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
                  {metasDescartadas.length}{" "}
                  {metasDescartadas.length === 1
                    ? "meta descartada"
                    : "metas descartadas"}{" "}
                  — fora do plano, guardadas no histórico
                </summary>
                <div className="border-t border-dashed border-border px-1 pb-2">
                  <PdmArvore
                    nos={metasDescartadas}
                    podeEditar={podeEditar}
                    podeAdicionarSub={false}
                    acoes={acoes}
                  />
                </div>
              </details>
            )}
            {podeEditar && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {cabeMeta ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setItemDialog({ modo: "nova-meta" })}
                  >
                    <Plus size={14} data-icon="inline-start" aria-hidden />
                    Nova meta
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Limite de {PDM_MAX_METAS} metas por plano — descarte uma
                    pra abrir espaço.
                  </p>
                )}
                {!cabeSub && (
                  <p className="text-xs text-muted-foreground">
                    Limite de ~{PDM_MAX_SUBITENS} subitens no plano atingido.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* leitor de tela ouve a mudança de prioridade/status sem olhar */}
      <span aria-live="polite" className="sr-only">
        {anuncio}
      </span>
      {salvando && (
        <p className="mt-2 text-xs text-muted-foreground">Salvando…</p>
      )}

      {/* ---------- dialog da visão ---------- */}
      <VisaoDialog
        aberta={visaoAberta}
        visao={doc.visao}
        onFechar={() => setVisaoAberta(false)}
        onSalvar={(v) =>
          executar(
            () => pdmSalvarVisao(duplaId, v),
            "Declaração de Visão salva."
          )
        }
      />

      {/* ---------- dialog do item ---------- */}
      {itemDialog && (
        <ItemDialog
          estado={itemDialog}
          onFechar={() => setItemDialog(null)}
          onSalvar={(input) => {
            const ehNova = itemDialog.modo !== "editar";
            executar(
              () =>
                pdmSalvarItem(duplaId, {
                  itemId:
                    itemDialog.modo === "editar" ? itemDialog.item.id : null,
                  parentId:
                    itemDialog.modo === "nova-submeta"
                      ? itemDialog.pai.id
                      : itemDialog.modo === "editar"
                        ? itemDialog.item.parentId
                        : null,
                  ...input,
                }),
              ehNova ? "Item adicionado ao plano." : "Item atualizado."
            );
          }}
        />
      )}

      {/* ---------- confirmação de exclusão ---------- */}
      {excluirItem && (
        <ExcluirDialog
          item={excluirItem}
          onFechar={() => setExcluirItem(null)}
          onDescartar={() =>
            executar(
              () => pdmStatusItem(duplaId, excluirItem.id, "descartada"),
              `"${excluirItem.titulo}" foi descartada — segue no histórico.`
            )
          }
          onExcluir={() =>
            executar(
              () => pdmRemoverItem(duplaId, excluirItem.id),
              `"${excluirItem.titulo}" excluída do plano.`
            )
          }
        />
      )}
    </section>
  );
}

// ---------- dialogs ----------

function VisaoDialog({
  aberta,
  visao,
  onFechar,
  onSalvar,
}: {
  aberta: boolean;
  visao: string | null;
  onFechar: () => void;
  onSalvar: (v: string) => void;
}) {
  const [texto, setTexto] = useState(visao ?? "");
  return (
    <Dialog open={aberta} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Declaração de Visão</DialogTitle>
          <DialogDescription>
            Uma frase no futuro, com prazo: o que o(a) jovem quer ser,
            alcançar ou conquistar ao fim da jornada.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Ex.: Em até 3 anos, serei uma profissional formada e independente, sustentando meus estudos e ajudando minha família."
          aria-label="Declaração de Visão"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            disabled={!texto.trim()}
            onClick={() => {
              onSalvar(texto.trim());
              onFechar();
            }}
          >
            Salvar visão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ItemInput = {
  titulo: string;
  porque: string | null;
  indicador: string | null;
  areaVida: string | null;
  prazoAlvo: string | null;
};

function ItemDialog({
  estado,
  onFechar,
  onSalvar,
}: {
  estado:
    | { modo: "nova-meta" }
    | { modo: "nova-submeta"; pai: PdmNo }
    | { modo: "editar"; item: PdmNo };
  onFechar: () => void;
  onSalvar: (input: ItemInput) => void;
}) {
  const item = estado.modo === "editar" ? estado.item : null;
  const ehMeta = estado.modo === "nova-meta" || (item?.parentId == null && estado.modo === "editar");
  const [titulo, setTitulo] = useState(item?.titulo ?? "");
  const [porque, setPorque] = useState(item?.porque ?? "");
  const [indicador, setIndicador] = useState(item?.indicador ?? "");
  const [areaVida, setAreaVida] = useState<string | null>(item?.areaVida ?? null);
  const [prazo, setPrazo] = useState(item?.prazoAlvo ?? "");

  const tituloDialog =
    estado.modo === "nova-meta"
      ? "Nova meta"
      : estado.modo === "nova-submeta"
        ? "Nova submeta"
        : ehMeta
          ? "Editar meta"
          : "Editar submeta";

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tituloDialog}</DialogTitle>
          <DialogDescription>
            {estado.modo === "nova-submeta"
              ? `Dentro de "${estado.pai.titulo}" — o que precisa acontecer pra essa meta sair do papel?`
              : ehMeta
                ? "Meta SMART: específica, com indicador de sucesso e prazo. A ordem da lista é a prioridade."
                : "O passo concreto dentro da meta — realizável de imediato, com prazo quando fizer sentido."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label
              htmlFor="pdm-titulo"
              className="text-xs font-semibold text-foreground"
            >
              {ehMeta ? "Meta" : "Submeta"}
            </label>
            <Input
              id="pdm-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={500}
              placeholder={
                ehMeta
                  ? "Ex.: Conseguir um jovem aprendiz até dezembro"
                  : "Ex.: Montar o currículo com a Luana da ONG"
              }
              autoFocus
            />
          </div>
          {ehMeta && (
            <div>
              <label
                htmlFor="pdm-porque"
                className="text-xs font-semibold text-foreground"
              >
                Por que é importante (o porquê do jovem)
              </label>
              <Textarea
                id="pdm-porque"
                value={porque}
                onChange={(e) => setPorque(e.target.value)}
                rows={2}
                maxLength={2000}
              />
            </div>
          )}
          <div>
            <label
              htmlFor="pdm-indicador"
              className="text-xs font-semibold text-foreground"
            >
              Indicador de sucesso — como saber que cumpriu
            </label>
            <Input
              id="pdm-indicador"
              value={indicador}
              onChange={(e) => setIndicador(e.target.value)}
              maxLength={500}
              placeholder="Ex.: Média 7,0 no boletim do 3º bimestre"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {ehMeta && (
              <div>
                <label
                  htmlFor="pdm-area"
                  className="text-xs font-semibold text-foreground"
                >
                  Área da vida
                </label>
                <Select
                  value={areaVida}
                  onValueChange={(v) => setAreaVida(v as string | null)}
                >
                  <SelectTrigger id="pdm-area">
                    <SelectValue placeholder="Escolher…" />
                  </SelectTrigger>
                  <SelectContent>
                    {PDM_AREAS_VIDA.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label
                htmlFor="pdm-prazo"
                className="text-xs font-semibold text-foreground"
              >
                Prazo-alvo
              </label>
              <Input
                id="pdm-prazo"
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            disabled={!titulo.trim()}
            onClick={() => {
              onSalvar({
                titulo: titulo.trim(),
                porque: porque.trim() || null,
                indicador: indicador.trim() || null,
                areaVida: ehMeta ? areaVida : null,
                prazoAlvo: prazo || null,
              });
              onFechar();
            }}
          >
            {estado.modo === "editar" ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExcluirDialog({
  item,
  onFechar,
  onDescartar,
  onExcluir,
}: {
  item: PdmNo;
  onFechar: () => void;
  onDescartar: () => void;
  onExcluir: () => void;
}) {
  const temFilhos = item.filhos.length > 0;
  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir “{item.titulo}”?</DialogTitle>
          <DialogDescription>
            Excluir apaga o item{temFilhos ? " e as submetas dentro dele" : ""}{" "}
            pra sempre. Se a meta saiu do plano mas faz parte da história da
            dupla, prefira <strong>descartar</strong>: ela sai da vista e
            continua no documento.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onDescartar();
              onFechar();
            }}
          >
            Descartar (recomendado)
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onExcluir();
              onFechar();
            }}
          >
            Excluir de vez
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
