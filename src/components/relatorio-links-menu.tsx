"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowSquareOut,
  CaretDown,
  Check,
  Copy,
  Eye,
  Key,
  LinkBreak,
  Lock,
  LockOpen,
  Plus,
  ShareNetwork,
  ShieldCheck,
  CircleNotch,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  listarAcessosLinks,
  redefinirSenhaLink,
  revogarLinkRelatorio,
} from "@/lib/actions-relatorio-links";
import {
  COLUNAS_CONTATO,
  configLinkOk,
  ESTADO_LINK_LABEL,
  estadoLink,
  MOTIVO_ACESSO_LABEL,
  resumoRecorteLink,
} from "@/lib/relatorio";
import type {
  RelatorioLinkItem,
  ResumoAcessoItem,
} from "@/lib/relatorio";
import { formatDate, formatDateTime } from "@/lib/ciclo";
import { turmaLonga } from "@/lib/turma";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { NovoLinkDialog } from "@/components/novo-link-dialog";
import type { ConfigInicialLink } from "@/components/novo-link-dialog";
import type { Cronograma } from "@/lib/types";

// ---------- estilos compartilhados do painel ----------

/** Item de menu com ícone em caixa — o molde do sm-item do mock (e do
 *  "Ver acessos"): hover em faixa, alvo ≥44px no toque. */
const itemCls =
  "flex w-full min-h-11 items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

const itemIconCls =
  "mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-muted text-foreground";

/** Mini-ação da linha de link (copiar/abrir/senha/revogar) — chip pequeno
 *  com borda; ≥44px no mobile, compacta no desktop. */
const miniActCls =
  "inline-flex min-h-11 sm:min-h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors outline-none hover:border-input hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

/** Painel "Compartilhar" da toolbar do builder (REALIZA-201): concentra
 *  criar link (com o recorte da grade na tela), listar/gerir os links
 *  existentes e ver acessos — o que era o card permanente "Links
 *  públicos" vira este popover largo. `links` desce da página (server) e
 *  `router.refresh()` depois de cada mutação o traz atualizado. */
export function RelatorioLinksMenu({
  links,
  turmas,
  cronogramas,
  templates,
  configInicial,
}: {
  links: RelatorioLinkItem[];
  turmas: string[];
  cronogramas: Pick<Cronograma, "id" | "nome" | "turma">[];
  templates: { slug: string; titulo: string }[];
  /** recorte da grade na tela — o "Novo link público" nasce dele */
  configInicial?: ConfigInicialLink;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [novoAberto, setNovoAberto] = useState(false);
  const [acessosAberto, setAcessosAberto] = useState(false);
  const [senhaNova, setSenhaNova] = useState<
    { id: string; senha: string } | null
  >(null);
  const [revogando, setRevogando] = useState<string | null>(null);
  const [redefinindo, setRedefinindo] = useState<string | null>(null);
  // trigger "Compartilhar" — os dialogs que nascem de dentro do popover
  // devolvem o foco aqui ao fechar (o botão clicado desmonta com o popup)
  const shareBtnRef = useRef<HTMLButtonElement | null>(null);

  // resumo curto do recorte — a linha pequena do item "Novo link público"
  const resumoCurto = configInicial
    ? [
        configInicial.turma ? turmaLonga(configInicial.turma) : "Todas as turmas",
        configInicial.granularidade === "duplas" ? "por dupla" : "por pessoa",
        `${configInicial.colunas.length} ${
          configInicial.colunas.length === 1 ? "coluna" : "colunas"
        }`,
        configInicial.linhas != null
          ? `${configInicial.linhas} ${
              configInicial.linhas === 1 ? "linha" : "linhas"
            }`
          : null,
        configInicial.colunas.some((c) => COLUNAS_CONTATO.has(c))
          ? "com contato"
          : "sem contato",
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  async function copiar(slug: string) {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/resumo/${slug}`
      );
      toast.success("Link copiado.");
    } catch {
      toast.error("Não consegui copiar o link.");
    }
  }

  return (
    <>
      <Popover
        open={aberto}
        onOpenChange={(v) => {
          setAberto(v);
          // a senha nova só existe nesta "sessão" do painel — fechar o
          // popover a esquece (o "não aparece de novo" tem que valer)
          if (!v) setSenhaNova(null);
        }}
      >
        <PopoverTrigger
          render={
            <Button ref={shareBtnRef} variant="outline" size="sm">
              <ShareNetwork aria-hidden /> Compartilhar
              <CaretDown weight="bold" className="text-muted-foreground" aria-hidden />
            </Button>
          }
        />
        <PopoverContent
          align="start"
          sideOffset={8}
          className="w-[min(28rem,calc(100vw-2rem))] max-h-(--available-height) overflow-y-auto p-0"
        >
          {/* criar — usa o recorte da grade como ela está na tela */}
          <div className="p-1.5">
            <button
              type="button"
              className={itemCls}
              onClick={() => {
                setAberto(false);
                setNovoAberto(true);
              }}
            >
              <span className={itemIconCls}>
                <Plus size={15} weight="bold" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  Novo link público
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  Usa o recorte da grade na tela
                  {resumoCurto ? ` — ${resumoCurto}` : ""}
                </span>
              </span>
            </button>
          </div>

          <div className="border-t border-border" />

          {/* lista — todos os links, com scroll quando muitos (ordenados
              pelo mais recente na RPC) */}
          <div className="flex items-center justify-between gap-2 px-3.5 pb-1 pt-2.5">
            <PopoverTitle className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Links · {links.length}
            </PopoverTitle>
            <span className="text-[11px] text-muted-foreground">
              revogar tira o ar na hora
            </span>
          </div>

          {links.length === 0 ? (
            <p className="px-3.5 pb-3 text-xs leading-relaxed text-muted-foreground">
              Nenhum link publicado ainda — o primeiro sai pelo “Novo link
              público” acima.
            </p>
          ) : (
            <ul className="scroll-fina max-h-[min(22rem,55vh)] list-none space-y-1.5 overflow-y-auto px-1.5 pb-1.5">
              {links.map((l) => {
                const est = estadoLink(l);
                const cfg = configLinkOk(l.config) ? l.config : null;
                const nova =
                  senhaNova?.id === l.id ? senhaNova.senha : null;
                return (
                  <li
                    key={l.id}
                    className="rounded-lg border border-border px-3 py-2.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <p className="min-w-0 flex-1 truncate text-[13px] font-medium">
                        {l.titulo}
                      </p>
                      {!l.protegido && est === "ativo" && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-amber-300/70 text-amber-700 dark:text-amber-300"
                        >
                          <LockOpen size={11} aria-hidden /> Sem senha
                        </Badge>
                      )}
                      <Badge
                        variant={
                          est === "ativo"
                            ? "default"
                            : est === "expirado"
                              ? "outline"
                              : "destructive"
                        }
                      >
                        {ESTADO_LINK_LABEL[est]}
                      </Badge>
                    </div>
                    <code className="mt-1 block truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      /resumo/{l.slug}
                    </code>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {cfg ? resumoRecorteLink(cfg) : "recorte indisponível"}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>
                        {l.acessos} acesso{l.acessos === 1 ? "" : "s"}
                        {l.ultimo_acesso
                          ? ` · último ${formatDateTime(l.ultimo_acesso)}`
                          : ""}
                      </span>
                      {l.falhas_24h > 0 && (
                        <span className="font-medium text-amber-600">
                          {l.falhas_24h} falha{l.falhas_24h === 1 ? "" : "s"}{" "}
                          em 24h
                        </span>
                      )}
                      <span>
                        {l.expira_em
                          ? `válido até ${formatDate(l.expira_em)}`
                          : "sem prazo"}
                      </span>
                      <span>
                        criado {formatDate(l.created_at)}
                        {l.criado_por_nome ? ` por ${l.criado_por_nome}` : ""}
                      </span>
                    </p>
                    {est === "ativo" && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          className={miniActCls}
                          onClick={() => copiar(l.slug)}
                        >
                          <Copy size={12} aria-hidden /> Copiar link
                        </button>
                        <a
                          href={`/resumo/${l.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Abrir “${l.titulo}” em nova aba`}
                          className={miniActCls}
                        >
                          <ArrowSquareOut size={12} aria-hidden /> Abrir
                        </a>
                        <button
                          type="button"
                          className={miniActCls}
                          title={
                            l.protegido
                              ? "A senha atual para de valer na hora"
                              : "O link passa a pedir senha pra abrir"
                          }
                          onClick={() => setRedefinindo(l.id)}
                        >
                          <Key size={12} aria-hidden />{" "}
                          {l.protegido ? "Redefinir senha" : "Definir senha"}
                        </button>
                        <button
                          type="button"
                          className={cn(miniActCls, "text-destructive hover:border-destructive/50 hover:text-destructive")}
                          onClick={() => setRevogando(l.id)}
                        >
                          <LinkBreak size={12} aria-hidden /> Revogar
                        </button>
                      </div>
                    )}
                    {est !== "ativo" && (
                      <div className="mt-2">
                        <button
                          type="button"
                          className={miniActCls}
                          onClick={() => copiar(l.slug)}
                        >
                          <Copy size={12} aria-hidden /> Copiar link
                        </button>
                      </div>
                    )}
                    <ConfirmDeleteButton
                      open={revogando === l.id}
                      onOpenChange={(v) => setRevogando(v ? l.id : null)}
                      titulo="Revogar link público"
                      descricao={`Quem tiver “${l.titulo}” perde o acesso na hora — o endereço deixa de abrir o relatório. O histórico de acessos é mantido.`}
                      acao="Revogar"
                      sucesso="Link revogado."
                      onConfirm={async () => {
                        const r = await revogarLinkRelatorio(l.id);
                        if (!r.ok) return { error: r.erro };
                        router.refresh();
                        return { ok: true };
                      }}
                    />
                    {/* rotação/definição também é irreversível — a senha atual
                        morre na hora (ou o link deixa de abrir direto), e a
                        nova não se recupera depois. Mesma casca do Revogar. */}
                    <ConfirmDeleteButton
                      open={redefinindo === l.id}
                      onOpenChange={(v) => setRedefinindo(v ? l.id : null)}
                      titulo={
                        l.protegido
                          ? "Redefinir senha do link"
                          : "Definir senha no link"
                      }
                      descricao={
                        l.protegido
                          ? `A senha atual de “${l.titulo}” para de valer na hora — quem a tiver perde o acesso. Geramos uma senha nova forte, que aparece uma única vez pra copiar.`
                          : `“${l.titulo}” passa a pedir senha — quem tiver o endereço não abre mais direto. Geramos uma senha forte, que aparece uma única vez pra copiar.`
                      }
                      acao={l.protegido ? "Redefinir" : "Definir"}
                      sucesso={
                        l.protegido ? "Senha redefinida." : "Senha definida."
                      }
                      onConfirm={async () => {
                        const r = await redefinirSenhaLink(l.id);
                        if (!r.ok) return { error: r.erro };
                        setSenhaNova({ id: l.id, senha: r.senha });
                        router.refresh();
                        return { ok: true };
                      }}
                    />
                    {nova && (
                      <p className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--brand-lime)]/15 px-3 py-2 text-xs">
                        <ShieldCheck size={14} className="shrink-0" aria-hidden />
                        <span>
                          Nova senha{" "}
                          <code className="font-semibold">{nova}</code> —
                          copie agora, ela não aparece de novo.
                        </span>
                        <button
                          type="button"
                          className="font-medium underline underline-offset-2"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(nova);
                              toast.success("Senha copiada.");
                            } catch {
                              toast.error("Copie manualmente.");
                            }
                          }}
                        >
                          copiar
                        </button>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-border" />

          {/* acessos — log por evento (resumo_acessos) */}
          <div className="p-1.5">
            <button
              type="button"
              className={itemCls}
              onClick={() => {
                setAberto(false);
                setAcessosAberto(true);
              }}
            >
              <span className={itemIconCls}>
                <Eye size={15} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">Ver acessos</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  Aberturas e tentativas de senha — guardado por 13 meses
                </span>
              </span>
            </button>
          </div>

          <p className="flex items-center gap-1.5 border-t border-border px-3.5 py-2 text-[11px] text-muted-foreground">
            <Lock size={11} aria-hidden />
            Só dados operacionais saem por link — respostas de instrumentos
            nunca.
          </p>
        </PopoverContent>
      </Popover>

      {/* o dialog de criação mora FORA do popover: o popup desmonta ao
          fechar e levaria o dialog junto */}
      <NovoLinkDialog
        open={novoAberto}
        onOpenChange={setNovoAberto}
        turmas={turmas}
        cronogramas={cronogramas}
        templates={templates}
        configInicial={configInicial}
        finalFocus={shareBtnRef}
      />

      <AcessosDialog
        open={acessosAberto}
        onOpenChange={setAcessosAberto}
        links={links}
        finalFocus={shareBtnRef}
      />
    </>
  );
}

/** "Ver acessos" — log por evento de resumo_acessos (fetch sob demanda;
 *  a policy já é coord-only). Título do link resolve pelo slug — a linha
 *  de auditoria sobrevive à vida do link, então o fallback é o slug cru. */
function AcessosDialog({
  open,
  onOpenChange,
  links,
  finalFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  links: RelatorioLinkItem[];
  /** aonde o foco volta ao fechar (o item clicado desmonta com o popover) */
  finalFocus?: React.RefObject<HTMLElement | null>;
}) {
  const [acessos, setAcessos] = useState<ResumoAcessoItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const tituloDe = new Map(links.map((l) => [l.slug, l.titulo]));

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      // limpa o erro dentro da transição — setState síncrono no corpo do
      // efeito cascateia render (react-hooks/set-state-in-effect)
      setErro(null);
      const r = await listarAcessosLinks();
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setAcessos(r.acessos);
    });
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" finalFocus={finalFocus}>
        <DialogHeader>
          <DialogTitle>Acessos aos links</DialogTitle>
          <DialogDescription>
            Aberturas e tentativas de senha do /resumo — guardado por 13
            meses, mostrando os ~60 mais recentes. “Origem” é o pseudônimo
            do visitante (mesma sigla = mesmo acesso provável).
          </DialogDescription>
        </DialogHeader>

        {erro ? (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        ) : acessos === null || pendente ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <CircleNotch className="animate-spin" size={16} aria-hidden />
            Carregando acessos…
          </p>
        ) : acessos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum acesso registrado ainda.
          </p>
        ) : (
          <ul className="scroll-fina -mx-1 max-h-[min(24rem,60vh)] divide-y divide-border/60 overflow-y-auto px-1">
            {acessos.map((a, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full",
                    a.ok
                      ? "bg-[var(--brand-lime)]/20 text-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {a.ok ? (
                    <Check size={13} weight="bold" aria-hidden />
                  ) : (
                    <X size={13} weight="bold" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="font-medium">
                      {a.ok
                        ? "Abriu"
                        : (MOTIVO_ACESSO_LABEL[a.motivo ?? ""] ??
                          "Não abriu")}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      · {tituloDe.get(a.slug) ?? a.slug}
                    </span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                    <span>{formatDateTime(a.acessado_em)}</span>
                    {a.origem && <span>origem {a.origem}</span>}
                    {a.user_agent && (
                      <span className="max-w-56 truncate" title={a.user_agent}>
                        {a.user_agent}
                      </span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
