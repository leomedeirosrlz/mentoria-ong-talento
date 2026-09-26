"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  CircleNotch,
  Copy,
  FilePdf,
  GearSix,
  PaperPlaneTilt,
  Prohibit,
  Signature,
  Timer,
  UploadSimple,
  WhatsappLogo,
  type Icon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { waLink } from "@/lib/ciclo";
import { useOrigem } from "@/components/forms/use-origem";
import {
  listarAssinaturasPessoa,
  reenviarAssinatura,
  revogarAssinatura,
  solicitarAssinaturaMentorado,
  subirContraAssinatura,
} from "@/lib/actions-assinaturas";
import { TEMPLATES_MENTORADO } from "@/lib/documentos/texto";
import type { Assinatura, AssinaturaStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

/** "dd/mm/aaaa" — no histórico o dia é o que importa, não a hora. */
const fmtDia = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const STATUS: Record<
  AssinaturaStatus,
  { rotulo: string; badge: string; Icone: Icon; icone: string }
> = {
  pendente: {
    rotulo: "pendente",
    badge: "border-[var(--warn)]/60 text-[var(--warn-text)]",
    Icone: Timer,
    icone: "text-[var(--warn-text)]",
  },
  assinado: {
    rotulo: "assinado",
    badge: "border-[var(--ok)]/60 text-[var(--ok-text)]",
    Icone: Signature,
    icone: "text-[var(--ok-text)]",
  },
  revogado: {
    rotulo: "revogado",
    badge: "text-muted-foreground",
    Icone: Prohibit,
    icone: "text-muted-foreground",
  },
  expirado: {
    rotulo: "expirado",
    badge: "text-muted-foreground",
    Icone: Timer,
    icone: "text-muted-foreground",
  },
};

/** Mesma guarda do CopiarResumoButton — clipboard API some em http/insecure. */
async function copiar(texto: string, sucesso: string) {
  if (!navigator.clipboard?.writeText) {
    toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    return;
  }
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(sucesso);
  } catch {
    toast.error("Não foi possível copiar. Selecione e copie manualmente.");
  }
}

/** Contra-assinatura do presidente — imagem única do bucket `documentos`
 *  (sistema/contra-assinatura.png, policy da 0033) que o PDF do termo carimba.
 *  Ajuste global, não da pessoa da ficha — por isso atrás da engrenagem. */
function ContraAssinaturaDialog() {
  const [open, setOpen] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/png" || file.size > 1024 * 1024) {
      e.target.value = "";
      setNomeArquivo(null);
      toast.error("Use um PNG de até 1 MB (fundo transparente).");
      return;
    }
    setNomeArquivo(file.name);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("arquivo");
    if (!(file instanceof File) || file.size === 0) {
      toast.error("Escolha uma imagem PNG.");
      return;
    }
    start(async () => {
      try {
        const res = await subirContraAssinatura(fd);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success("Contra-assinatura atualizada. Vale nos próximos PDFs.");
        setOpen(false);
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setNomeArquivo(null);
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Contra-assinatura do presidente"
            title="Contra-assinatura do presidente"
            className="text-muted-foreground"
          />
        }
      >
        <GearSix size={15} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contra-assinatura do presidente</DialogTitle>
          <DialogDescription className="leading-relaxed">
            A imagem sai em todos os termos de voluntário assinados. Subir de
            novo substitui a atual. Os PDFs já gerados continuam válidos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            name="arquivo"
            accept="image/png"
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={onPick}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <UploadSimple size={14} />
              Escolher PNG
            </Button>
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              {nomeArquivo ?? "PNG com fundo transparente, até 1 MB"}
            </span>
          </div>
          <Button type="submit" size="sm" disabled={pending || !nomeArquivo}>
            {pending && <CircleNotch size={14} className="animate-spin" />}
            {pending ? "Enviando…" : "Subir imagem"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Texto do wa.me que a coordenação dispara pro contato do jovem — o link
 *  tokenizado é o fator de posse, então vai por WhatsApp comum mesmo. */
function msgLinkAssinatura(
  slug: string | undefined,
  nomeJovem: string,
  link: string
) {
  return slug === "autorizacao-responsavel"
    ? `Olá! Aqui é a coordenação do Realiza.vc. Para a participação de ${nomeJovem} no Programa de Mentoria Social, precisamos que o responsável assine a autorização neste link (leva ~1 minuto): ${link}`
    : `Olá! Aqui é a coordenação do Realiza.vc. O termo de participação de ${nomeJovem} no Programa de Mentoria Social está pronto pra assinar neste link (leva ~1 minuto): ${link}`;
}

/** Seção "Assinaturas" da ficha — irmã do DocumentoPessoa dentro dos dialogs
 *  de edição de /pessoas (que só a coordenação abre). O dialog desmonta o
 *  conteúdo ao fechar, então carregar no mount = recarregar a cada abertura. */
export function AssinaturasPessoa({
  tipo,
  id,
  nome,
  whatsapp,
}: {
  tipo: "profile" | "mentorado";
  id: string;
  /** nome da pessoa — entra no texto de confirmação da revogação */
  nome: string;
  /** contato pra onde vai o link (jovem/responsável) — sem ele o botão
   *  WhatsApp não aparece e resta o "Copiar link" */
  whatsapp?: string | null;
}) {
  const [itens, setItens] = useState<Assinatura[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [reenviando, setReenviando] = useState<string | null>(null);
  const [solicitandoSlug, setSolicitandoSlug] = useState<string | null>(null);
  const primeiroNome = nome.split(" ")[0];
  // window.location.origin SSR-safe — no render o servidor não conhece a
  // origem do deploy (mesmo padrão dos links de /f, link-shared.ts)
  const origem = useOrigem();

  /** Releitura depois das mutações — a lista é estado local do client,
   *  router.refresh() não a alcança. */
  const carregar = useCallback(async () => {
    try {
      const res = await listarAssinaturasPessoa(tipo, id);
      if ("error" in res) {
        setFalhou(true);
        return;
      }
      setItens(res.itens);
      setFalhou(false);
    } catch {
      setFalhou(true);
    }
  }, [tipo, id]);

  // o dialog desmonta ao fechar — mount = abertura. setState vai em callback
  // (.then/.catch), mesmo padrão do fetch de mentor_profiles em pessoa-actions
  useEffect(() => {
    let vivo = true;
    listarAssinaturasPessoa(tipo, id)
      .then((res) => {
        if (!vivo) return;
        if ("error" in res) setFalhou(true);
        else {
          setItens(res.itens);
          setFalhou(false);
        }
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [tipo, id]);

  /** Emite o documento escolhido e já deixa o link na mão. Pending por
   *  slug — com 2 templates o rótulo "Gerando link…" não pode mentir no
   *  botão que não foi clicado. */
  async function solicitar(slug: string) {
    setSolicitandoSlug(slug);
    try {
      const res = await solicitarAssinaturaMentorado(id, slug);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      await copiar(
        `${origem}${res.link}`,
        whatsapp
          ? "Link copiado. Envie direto pelo botão WhatsApp abaixo."
          : "Link copiado. Envie ao responsável."
      );
      await carregar();
    } catch {
      toast.error("Sem conexão. Tente de novo.");
    } finally {
      setSolicitandoSlug(null);
    }
  }

  /** Reenvio = token novo (o anterior morre na RPC) — o link novo já copia. */
  async function reenviar(a: Assinatura) {
    setReenviando(a.id);
    try {
      const res = await reenviarAssinatura(a.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      await copiar(
        `${origem}${res.link}`,
        "Novo link copiado. O anterior foi desativado."
      );
      await carregar();
    } catch {
      toast.error("Sem conexão. Tente de novo.");
    } finally {
      setReenviando(null);
    }
  }

  async function revogar(a: Assinatura) {
    const res = await revogarAssinatura(a.id);
    if (!("error" in res)) void carregar();
    return res;
  }

  // um link por template: só oferece emitir o que ainda não está pendente
  const pendentesPorSlug = new Set(
    (itens ?? [])
      .filter((a) => a.status === "pendente")
      .map((a) => a.template?.slug)
  );
  const emissiveis = TEMPLATES_MENTORADO.filter(
    (t) => !pendentesPorSlug.has(t.slug)
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Assinaturas</p>
        {/* o termo do voluntário é self-service — mas a contra-assinatura é
            config global, então a engrenagem só aparece na ficha de pessoa */}
        {tipo === "profile" && <ContraAssinaturaDialog />}
      </div>

      {tipo === "mentorado" && itens !== null && emissiveis.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {emissiveis.map((t) => (
            <Button
              key={t.slug}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto min-h-8 max-w-full whitespace-normal py-1 text-left"
              disabled={solicitandoSlug !== null}
              aria-busy={solicitandoSlug === t.slug}
              onClick={() => solicitar(t.slug)}
            >
              {solicitandoSlug === t.slug ? (
                <CircleNotch size={14} className="animate-spin" />
              ) : (
                <PaperPlaneTilt size={14} />
              )}
              {solicitandoSlug === t.slug ? "Gerando link…" : `Enviar: ${t.rotulo}`}
            </Button>
          ))}
        </div>
      )}

      {itens === null && !falhou && (
        <div className="space-y-2" aria-label="Carregando assinaturas">
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-5 w-3/5" />
        </div>
      )}

      {falhou && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">
            Não foi possível carregar as assinaturas.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              setFalhou(false);
              void carregar();
            }}
          >
            Tentar de novo
          </Button>
        </div>
      )}

      {itens !== null && itens.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhuma assinatura ainda.</p>
      )}

      {itens !== null && itens.length > 0 && (
        <ul className="space-y-3">
          {itens.map((a) => {
            // o status "expirado" só grava quando o token é tocado (0033) —
            // um pendente com prazo vencido JÁ está morto; renderiza como
            // expirado em vez de prometer link que não funciona
            const vencido =
              a.status === "pendente" &&
              a.token_expira_em != null &&
              new Date(a.token_expira_em) < new Date();
            const st = STATUS[vencido ? "expirado" : a.status];
            const terminal =
              a.status === "expirado" ||
              a.status === "revogado" ||
              vencido;
            return (
              <li key={a.id}>
                <div className="flex items-center gap-2">
                  <st.Icone size={15} aria-hidden className={cn("shrink-0", st.icone)} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {a.template?.titulo ?? "Documento"}
                  </span>
                  <Badge variant="outline" className={cn("shrink-0", st.badge)}>
                    {st.rotulo}
                  </Badge>
                </div>
                <p className="pl-6 text-xs text-muted-foreground">
                  {a.status === "assinado" && a.assinado_em
                    ? `assinado em ${fmtDia.format(new Date(a.assinado_em))}`
                    : `emitido em ${fmtDia.format(new Date(a.created_at))}`}
                  {a.status === "pendente" && a.token_expira_em
                    ? ` · ${vencido ? "expirou" : "expira"} em ${fmtDia.format(new Date(a.token_expira_em))}`
                    : ""}
                  {a.assinatura_texto ? ` · ${a.assinatura_texto}` : ""}
                </p>
                <div className="flex flex-wrap items-center gap-x-1 pl-4">
                  {terminal && tipo === "mentorado" && a.template?.slug && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={solicitandoSlug !== null}
                      aria-busy={solicitandoSlug === a.template!.slug}
                      onClick={() => solicitar(a.template!.slug)}
                    >
                      <PaperPlaneTilt size={13} />
                      Reemitir
                    </Button>
                  )}
                  {a.status === "pendente" && !vencido && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          copiar(
                            `${origem}/assinar/${a.token}`,
                            "Link copiado. Envie ao responsável."
                          )
                        }
                      >
                        <Copy size={13} />
                        Copiar link
                      </Button>
                      {(() => {
                        const url = waLink(
                          whatsapp,
                          msgLinkAssinatura(
                            a.template?.slug,
                            primeiroNome,
                            `${origem}/assinar/${a.token}`
                          )
                        );
                        return url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="-my-2 inline-flex min-h-11 items-center gap-1.5 rounded-[min(var(--radius-md),10px)] px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:my-0 sm:min-h-6"
                          >
                            <WhatsappLogo size={13} />
                            WhatsApp
                          </a>
                        ) : null;
                      })()}
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={reenviando === a.id}
                        aria-busy={reenviando === a.id}
                        onClick={() => reenviar(a)}
                      >
                        {reenviando === a.id ? (
                          <CircleNotch size={13} className="animate-spin" />
                        ) : (
                          <PaperPlaneTilt size={13} />
                        )}
                        Reenviar
                      </Button>
                    </>
                  )}
                  {a.status === "assinado" && (
                    <a
                      href={`/api/assinatura/${a.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="-my-2 inline-flex min-h-11 items-center gap-1.5 rounded-[min(var(--radius-md),10px)] px-2 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline sm:my-0 sm:min-h-6"
                    >
                      <FilePdf size={13} />
                      Ver PDF
                    </a>
                  )}
                  {/* revogar só tem efeito em doc vivo — em linha terminal a
                      ação útil é reemitir (acima), não revogar de novo */}
                  {!terminal && (
                    <ConfirmDeleteButton
                      titulo={`Revogar a assinatura de ${primeiroNome}?`}
                      descricao={`"${a.template?.titulo ?? "Documento"}" fica marcada como revogada. ${
                        tipo === "mentorado" ? "O responsável" : "A pessoa"
                      } precisa assinar de novo pra regularizar.`}
                      sucesso="Assinatura revogada."
                      acao="Revogar"
                      onConfirm={() => revogar(a)}
                      trigger={
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="text-muted-foreground"
                        >
                          Revogar
                        </Button>
                      }
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
