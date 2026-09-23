"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  CircleNotch,
  CopySimple,
  Link as LinkIcon,
  PaperPlaneTilt,
  Trash,
} from "@phosphor-icons/react";
import {
  excluirLinkFormulario,
  gerarLinksFormulario,
  type DestinoLink,
} from "@/lib/forms/actions";
import { linkStatus, LINK_STATUS_LABEL, type FormularioSistema } from "@/lib/forms/schema";
import type { LinkResolvido } from "@/lib/forms/queries";
import { NudgeButton } from "@/components/nudge-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type DestinoOpcao = {
  tipo: "profile" | "mentorado";
  id: string;
  nome: string;
  /** papel (profiles) ou contexto (mentorado) — chip discreto na lista */
  detalhe: string | null;
};

const VALIDADE_OPCOES = [
  { v: "0", l: "Sem validade" },
  { v: "7", l: "Expira em 7 dias" },
  { v: "15", l: "Expira em 15 dias" },
  { v: "30", l: "Expira em 30 dias" },
  { v: "60", l: "Expira em 60 dias" },
] as const;

function primeiroNome(nome: string | null): string {
  return nome?.split(" ")[0] ?? "";
}

/** URL absoluta do link público — montada no client porque o servidor não
 *  sabe a origem de deploy. */
function urlPublica(token: string): string {
  return `${window.location.origin}/f/${token}`;
}

function CopiarLink({ token }: { token: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(urlPublica(token));
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          toast.error("Não consegui copiar — selecione o link manualmente.");
        }
      }}
    >
      {copiado ? <Check aria-hidden className="text-[var(--ok)]" /> : <CopySimple aria-hidden />}
      {copiado ? "Copiado" : "Copiar"}
    </Button>
  );
}

export function FormularioLinks({
  formularioId,
  formularioTitulo,
  formularioAtivo,
  formularioSistema,
  links,
  destinatarios,
}: {
  formularioId: string;
  formularioTitulo: string;
  formularioAtivo: boolean;
  /** instrumento oficial (0042) — a 360º ganha nota do wiring no checklist */
  formularioSistema?: FormularioSistema | null;
  links: LinkResolvido[];
  destinatarios: DestinoOpcao[];
}) {
  const [open, setOpen] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [validade, setValidade] = useState<string>("0");
  const [pending, start] = useTransition();
  const router = useRouter();

  // destinatários com link pendente/vigente ficam marcados e desabilitados —
  // a action reutilizaria o token mesmo, mas aqui já dá pra ver o estado
  const comLinkVigente = useMemo(() => {
    const s = new Set<string>();
    for (const l of links) {
      if (linkStatus(l) !== "pendente") continue;
      if (l.dest_profile_id) s.add(`p:${l.dest_profile_id}`);
      if (l.dest_mentorado_id) s.add(`m:${l.dest_mentorado_id}`);
    }
    return s;
  }, [links]);

  const grupos = useMemo(
    () => [
      {
        titulo: "Mentores e equipe",
        itens: destinatarios.filter((d) => d.tipo === "profile"),
      },
      {
        titulo: "Mentorados",
        itens: destinatarios.filter((d) => d.tipo === "mentorado"),
      },
    ],
    [destinatarios]
  );

  function toggle(key: string) {
    setSelecionados((s) => {
      const out = new Set(s);
      if (out.has(key)) out.delete(key);
      else out.add(key);
      return out;
    });
  }

  function gerar(destinos: DestinoLink[]) {
    if (!destinos.length) return;
    start(async () => {
      const r = await gerarLinksFormulario({
        formularioId,
        destinos,
        diasValidade: validade === "0" ? null : Number(validade),
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      const partes = [];
      if (r.criados) partes.push(`${r.criados} ${r.criados === 1 ? "link gerado" : "links gerados"}`);
      if (r.reutilizados)
        partes.push(`${r.reutilizados} já ${r.reutilizados === 1 ? "tinha link" : "tinham links"}`);
      toast.success(partes.join(" · ") + ".");
      setSelecionados(new Set());
      setOpen(false);
      router.refresh();
    });
  }

  function gerarSelecionados() {
    const destinos: DestinoLink[] = destinatarios
      .filter((d) => selecionados.has(`${d.tipo === "profile" ? "p" : "m"}:${d.id}`))
      .map((d) => ({ tipo: d.tipo, id: d.id }) as DestinoLink);
    gerar(destinos);
  }

  const msgWhatsApp = (nome: string | null, token: string) =>
    `Olá${nome ? `, ${primeiroNome(nome)}` : ""}! A equipe Realiza.vc te convida pra responder "${formularioTitulo}" — leva poucos minutos: ${urlPublica(token)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <LinkIcon aria-hidden />
            Gerar links
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Gerar links de resposta</DialogTitle>
              <DialogDescription>
                Cada pessoa recebe um link único — a resposta fica vinculada a
                ela (e à dupla, quando houver).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {!formularioAtivo && (
                <p className="rounded-lg bg-[var(--warn)]/10 px-3 py-2 text-xs text-[var(--warn-text)]">
                  O formulário está encerrado — os links gerados só aceitam
                  resposta depois que você reativar.
                </p>
              )}
              {formularioSistema === "avaliacao_360" && (
                <p className="rounded-lg bg-[var(--brand-lime)]/10 px-3 py-2 text-xs text-foreground">
                  Quando uma resposta 360º chega por um link com dupla, o item
                  do checklist de encerramento marca sozinho.
                </p>
              )}
              <div className="max-h-64 space-y-4 overflow-y-auto pr-1">
                {grupos.map(
                  (g) =>
                    g.itens.length > 0 && (
                      <fieldset key={g.titulo}>
                        <legend className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          {g.titulo}
                        </legend>
                        <ul className="space-y-0.5">
                          {g.itens.map((d) => {
                            const key = `${d.tipo === "profile" ? "p" : "m"}:${d.id}`;
                            const vigente = comLinkVigente.has(key);
                            return (
                              <li key={key}>
                                <label
                                  className={cn(
                                    "flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm transition-colors sm:min-h-10",
                                    vigente
                                      ? "cursor-default text-muted-foreground"
                                      : "cursor-pointer hover:bg-muted"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selecionados.has(key)}
                                    disabled={vigente}
                                    onChange={() => toggle(key)}
                                    className="size-4 shrink-0 accent-primary"
                                  />
                                  <span className="min-w-0 flex-1 truncate">
                                    {d.nome}
                                  </span>
                                  {vigente ? (
                                    <span className="text-xs text-muted-foreground">
                                      link enviado
                                    </span>
                                  ) : (
                                    d.detalhe && (
                                      <span className="text-xs text-muted-foreground">
                                        {d.detalhe}
                                      </span>
                                    )
                                  )}
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </fieldset>
                    )
                )}
                {destinatarios.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma pessoa cadastrada — cadastre em{" "}
                    <Link href="/pessoas" className="underline underline-offset-2">
                      Pessoas
                    </Link>{" "}
                    ou gere um link genérico.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label id="validade-label">Validade dos links</Label>
                <Select value={validade} onValueChange={(v) => setValidade(v ?? "0")}>
                  <SelectTrigger
                    aria-labelledby="validade-label"
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALIDADE_OPCOES.map((o) => (
                      <SelectItem key={o.v} value={o.v}>
                        {o.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                onClick={gerarSelecionados}
                disabled={pending || selecionados.size === 0}
              >
                {pending && <CircleNotch className="animate-spin" aria-hidden />}
                {selecionados.size
                  ? `Gerar ${selecionados.size} ${selecionados.size === 1 ? "link" : "links"}`
                  : "Escolha os destinatários"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => gerar([{ tipo: "generico" }])}
        >
          <PaperPlaneTilt aria-hidden />
          Link genérico
        </Button>
      </div>

      {links.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum link gerado ainda — gere links individuais ou um genérico pra
          divulgar.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
          {links.map((l) => {
            const status = linkStatus(l);
            return (
              <li key={l.id} className="px-4 py-3 sm:px-5">
                {/* a 390px o wrap jogava nome, badge e ações em 3 linhas
                    desalinhadas — agora são 2 linhas deliberadas: nome+badge
                    (token/meta abaixo) e as ações encostadas à direita; a
                    partir de sm: volta à linha única */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {l.dest_nome ?? "Link genérico"}
                      </span>
                      <Badge
                        variant={
                          status === "respondido"
                            ? "default"
                            : status === "expirado"
                              ? "secondary"
                              : "outline"
                        }
                        className={cn(
                          "shrink-0",
                          status === "respondido" &&
                            "bg-[var(--ok)]/15 text-[var(--ok-text)]",
                          status === "expirado" &&
                            "bg-[var(--warn)]/15 text-[var(--warn-text)]"
                        )}
                      >
                        {LINK_STATUS_LABEL[status]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                      /f/{l.token.slice(0, 12)}…
                      {l.dupla && (
                        <span className="font-sans">
                          {" · "}
                          {l.dupla.mentor_nome.split(" ")[0]} ↔{" "}
                          {l.dupla.mentorado_nome.split(" ")[0]}
                        </span>
                      )}
                      {status === "pendente" && l.expira_em && (
                        <span className="font-sans">
                          {" · até "}
                          {new Date(l.expira_em).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            timeZone: "America/Sao_Paulo",
                          })}
                        </span>
                      )}
                      {status === "respondido" && l.usado_em && (
                        <span className="font-sans">
                          {" · "}
                          {new Date(l.usado_em).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            timeZone: "America/Sao_Paulo",
                          })}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex basis-full items-center justify-end gap-1.5 sm:basis-auto">
                    <CopiarLink token={l.token} />
                    {status === "pendente" && (
                      <NudgeButton
                        telefone={l.dest_whatsapp}
                        mensagem={msgWhatsApp(l.dest_nome, l.token)}
                        label="WhatsApp"
                      />
                    )}
                    {status !== "respondido" && (
                      <ConfirmDeleteButton
                        titulo="Excluir link?"
                        descricao={`O link de ${l.dest_nome ?? "uso genérico"} deixa de funcionar na hora.`}
                        sucesso="Link excluído."
                        onConfirm={() => excluirLinkFormulario(l.id, formularioId)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Excluir link de ${l.dest_nome ?? "uso genérico"}`}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash aria-hidden />
                          </Button>
                        }
                      />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
