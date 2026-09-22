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
  type Icon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  listarAssinaturasPessoa,
  reenviarAssinatura,
  revogarAssinatura,
  solicitarAutorizacao,
  subirContraAssinatura,
} from "@/lib/actions-assinaturas";
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
    toast.error("Não foi possível copiar — selecione e copie manualmente.");
    return;
  }
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(sucesso);
  } catch {
    toast.error("Não foi possível copiar — selecione e copie manualmente.");
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
        toast.success("Contra-assinatura atualizada — vale nos próximos PDFs.");
        setOpen(false);
      } catch {
        toast.error("Sem conexão — tente de novo.");
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
            novo substitui a atual — os PDFs já gerados continuam válidos.
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

/** Seção "Assinaturas" da ficha — irmã do DocumentoPessoa dentro dos dialogs
 *  de edição de /pessoas (que só a coordenação abre). O dialog desmonta o
 *  conteúdo ao fechar, então carregar no mount = recarregar a cada abertura. */
export function AssinaturasPessoa({
  tipo,
  id,
  nome,
}: {
  tipo: "profile" | "mentorado";
  id: string;
  /** nome da pessoa — entra no texto de confirmação da revogação */
  nome: string;
}) {
  const [itens, setItens] = useState<Assinatura[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [reenviando, setReenviando] = useState<string | null>(null);
  const [solicitando, startSolicitar] = useTransition();
  const primeiroNome = nome.split(" ")[0];

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

  /** Emite a autorização do responsável e já deixa o link na mão. */
  function solicitar() {
    startSolicitar(async () => {
      try {
        const res = await solicitarAutorizacao(id);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        await copiar(
          `${window.location.origin}${res.link}`,
          "Link copiado — envie ao responsável."
        );
        await carregar();
      } catch {
        toast.error("Sem conexão — tente de novo.");
      }
    });
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
        `${window.location.origin}${res.link}`,
        "Novo link copiado — o anterior foi desativado."
      );
      await carregar();
    } catch {
      toast.error("Sem conexão — tente de novo.");
    } finally {
      setReenviando(null);
    }
  }

  async function revogar(a: Assinatura) {
    const res = await revogarAssinatura(a.id);
    if (!("error" in res)) void carregar();
    return res;
  }

  const temPendente = itens?.some((a) => a.status === "pendente") ?? false;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Assinaturas</p>
        {/* o termo do voluntário é self-service — mas a contra-assinatura é
            config global, então a engrenagem só aparece na ficha de pessoa */}
        {tipo === "profile" && <ContraAssinaturaDialog />}
      </div>

      {tipo === "mentorado" && itens !== null && !temPendente && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={solicitando}
          aria-busy={solicitando}
          onClick={solicitar}
        >
          {solicitando ? (
            <CircleNotch size={14} className="animate-spin" />
          ) : (
            <PaperPlaneTilt size={14} />
          )}
          {solicitando ? "Gerando link…" : "Solicitar autorização do responsável"}
        </Button>
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
            const st = STATUS[a.status];
            return (
              <li key={a.id}>
                <div className="flex items-center gap-2">
                  <st.Icone size={15} className={cn("shrink-0", st.icone)} />
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
                    : `solicitado em ${fmtDia.format(new Date(a.created_at))}`}
                  {a.assinatura_texto ? ` — ${a.assinatura_texto}` : ""}
                </p>
                <div className="flex flex-wrap items-center gap-x-1 pl-4">
                  {a.status === "pendente" && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          copiar(
                            `${window.location.origin}/assinar/${a.token}`,
                            "Link copiado — envie ao responsável."
                          )
                        }
                      >
                        <Copy size={13} />
                        Copiar link
                      </Button>
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
                      className="inline-flex h-6 items-center gap-1.5 rounded-[min(var(--radius-md),10px)] px-2 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                    >
                      <FilePdf size={13} />
                      Baixar PDF
                    </a>
                  )}
                  <ConfirmDeleteButton
                    titulo={`Revogar a assinatura de ${primeiroNome}?`}
                    descricao={`"${a.template?.titulo ?? "Documento"}" fica marcada como revogada — ${
                      tipo === "mentorado" ? "o responsável" : "a pessoa"
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
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
