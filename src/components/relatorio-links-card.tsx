"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowSquareOut,
  Copy,
  DotsThreeVertical,
  Eye,
  Key,
  LinkBreak,
  LockOpen,
  Plus,
  ShieldCheck,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  redefinirSenhaLink,
  revogarLinkRelatorio,
} from "@/lib/actions-relatorio-links";
import {
  configLinkOk,
  ESTADO_LINK_LABEL,
  estadoLink,
  resumoRecorteLink,
} from "@/lib/relatorio";
import type { RelatorioLinkItem } from "@/lib/relatorio";
import { formatDate, formatDateTime } from "@/lib/ciclo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { NovoLinkDialog } from "@/components/novo-link-dialog";
import type { Cronograma } from "@/lib/types";

/** Painel de links públicos (REALIZA-170) — publicar, copiar, redefinir
 *  senha e revogar. Toda mutação é RPC coord-gated; o card só orquestra. */
export function RelatorioLinksCard({
  links,
  turmas,
  cronogramas,
  templates,
}: {
  links: RelatorioLinkItem[];
  turmas: string[];
  cronogramas: Pick<Cronograma, "id" | "nome" | "turma">[];
  templates: { slug: string; titulo: string }[];
}) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  const [senhaNova, setSenhaNova] = useState<
    { id: string; senha: string } | null
  >(null);
  const [revogando, setRevogando] = useState<string | null>(null);

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

  function redefinir(l: RelatorioLinkItem) {
    startTransition(async () => {
      const r = await redefinirSenhaLink(l.id);
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      setSenhaNova({ id: l.id, senha: r.senha });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Links públicos</CardTitle>
          <CardDescription>
            Relatórios compartilháveis por link + senha — pra parceiros,
            diretoria e financiadores. Só dados operacionais; respostas de
            instrumentos nunca saem.
          </CardDescription>
        </div>
        <NovoLinkDialog
          turmas={turmas}
          cronogramas={cronogramas}
          templates={templates}
          trigger={
            <Button size="sm">
              <Plus size={15} aria-hidden /> Novo link
            </Button>
          }
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {links.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum link publicado ainda. Crie o primeiro pra compartilhar um
            recorte operacional com a senha gerada na hora.
          </p>
        )}
        {links.map((l) => {
          const est = estadoLink(l);
          const cfg = configLinkOk(l.config) ? l.config : null;
          const nova = senhaNova?.id === l.id ? senhaNova.senha : null;
          return (
            <div
              key={l.id}
              className="rounded-lg border border-border px-3 py-2.5 sm:px-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.titulo}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {cfg ? resumoRecorteLink(cfg) : "recorte indisponível"} ·{" "}
                    <code className="text-[11px]">/resumo/{l.slug}</code>
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>
                      {l.acessos} acesso{l.acessos === 1 ? "" : "s"}
                      {l.ultimo_acesso
                        ? ` · último ${formatDateTime(l.ultimo_acesso)}`
                        : ""}
                    </span>
                    {l.falhas_24h > 0 && (
                      <span className="text-amber-600">
                        {l.falhas_24h} falha{l.falhas_24h === 1 ? "" : "s"} em 24h
                      </span>
                    )}
                    <span>
                      {l.expira_em
                        ? `válido até ${formatDate(l.expira_em)}`
                        : "sem prazo"}
                    </span>
                    {l.criado_por_nome && <span>por {l.criado_por_nome}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!l.protegido && est === "ativo" && (
                    <Badge variant="outline" className="gap-1 text-amber-700">
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
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Ações do link ${l.titulo}`}
                        >
                          <DotsThreeVertical size={16} aria-hidden />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={() => copiar(l.slug)}>
                        <Copy size={14} aria-hidden /> Copiar link
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        render={
                          <a
                            href={`/resumo/${l.slug}`}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                      >
                        <ArrowSquareOut size={14} aria-hidden /> Abrir público
                      </DropdownMenuItem>
                      {est === "ativo" && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={pendente}
                            onClick={() => redefinir(l)}
                          >
                            <Key size={14} aria-hidden />{" "}
                            {l.protegido ? "Redefinir senha" : "Definir senha"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={pendente}
                            onClick={() => setRevogando(l.id)}
                          >
                            <LinkBreak size={14} aria-hidden /> Revogar link
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                </div>
              </div>
              {nova && (
                <p className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--brand-lime)]/15 px-3 py-2 text-xs">
                  <ShieldCheck size={14} className="shrink-0" aria-hidden />
                  <span>
                    Nova senha <code className="font-semibold">{nova}</code> —
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
            </div>
          );
        })}
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Eye size={12} aria-hidden />
          Toda abertura e tentativa de senha fica registrada por 13 meses.
        </p>
      </CardContent>
    </Card>
  );
}
