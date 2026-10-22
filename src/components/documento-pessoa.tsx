"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CircleNotch,
  DotsThreeVertical,
  FileText,
  Paperclip,
  Trash,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { definirDocumentoPessoa, removerDocumentoPessoa } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const LIMITE_BYTES = 20 * 1024 * 1024;
const BUCKET = "documentos";
// allowlist explícita — image/* admitiria SVG (conteúdo ativo) e HEIC (não renderiza)
const TIPOS_ACEITOS = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const ACCEPT = TIPOS_ACEITOS.join(",");

/** Nome do arquivo entra no path do storage — fica em ASCII seguro. */
function saneiaNome(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return limpo || "documento";
}

/** ⋯ do documento anexado (REALIZA-186): substituir e remover — a remoção
 *  abre o ConfirmDeleteButton controlado fora do popup. */
function DocumentoAcoes({
  nomeDoc,
  fem,
  pending,
  onSubstituir,
  onRemover,
}: {
  nomeDoc: string;
  /** feminino do nomeDoc ("a autorização…") — concordância do confirm */
  fem: boolean;
  pending: boolean;
  onSubstituir: () => void;
  onRemover: () => Promise<{ error?: string; ok?: boolean }>;
}) {
  const [removendo, setRemovendo] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Ações d${fem ? "a" : "o"} ${nomeDoc}`}
          aria-busy={pending || undefined}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "size-11 shrink-0 sm:size-8"
          )}
        >
          {pending ? (
            <CircleNotch size={18} className="animate-spin" aria-hidden />
          ) : (
            <DotsThreeVertical size={18} weight="bold" aria-hidden />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem disabled={pending} onClick={onSubstituir}>
            <Paperclip size={16} data-icon="inline-start" aria-hidden />
            {pending ? "Enviando…" : "Substituir documento"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setRemovendo(true)}
          >
            <Trash size={16} data-icon="inline-start" aria-hidden />
            Remover documento
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDeleteButton
        open={removendo}
        onOpenChange={setRemovendo}
        titulo="Remover o documento?"
        descricao={`${fem ? "A" : "O"} ${nomeDoc} é apagad${fem ? "a" : "o"} e a pessoa fica sem documento oficial.`}
        sucesso={`${nomeDoc.charAt(0).toUpperCase()}${nomeDoc.slice(1)} removid${fem ? "a" : "o"}.`}
        onConfirm={onRemover}
      />
    </>
  );
}

/** Documento oficial da pessoa (termo do mentor, autorização do mentorado) —
 *  bloco dentro dos dialogs de edição de /pessoas, que só a coordenação abre. */
export function DocumentoPessoa({
  tipo,
  id,
  documentoPath,
}: {
  tipo: "profile" | "mentorado";
  id: string;
  documentoPath?: string | null;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  // rotas e copy por tipo: profiles guardam o termo, mentorados a autorização
  const tipoUrl = tipo === "mentorado" ? "mentorado" : "pessoa";
  const fem = tipo === "mentorado";
  const nomeDoc = fem
    ? "autorização assinada pelo responsável"
    : "termo de responsabilidade assinado";

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // limpa o input pra escolher o mesmo arquivo de novo disparar onChange
    e.target.value = "";
    if (!file) return;

    if (!TIPOS_ACEITOS.includes(file.type)) {
      toast.error("Formato não aceito. Use PDF, PNG, JPG ou WebP.");
      return;
    }
    if (file.size > LIMITE_BYTES) {
      toast.error("O arquivo passa de 20 MB. Envie uma versão menor.");
      return;
    }

    start(async () => {
      try {
        const supabase = createClient();
        const path = `documentos/${crypto.randomUUID()}-${saneiaNome(file.name)}`;

        // 1) o path entra na row ANTES do upload — a policy de INSERT do storage
        //    só aceita objeto cujo name já exista como documento_path de alguém
        const res = await definirDocumentoPessoa(tipo, id, path);
        if (res?.error) {
          toast.error(res.error);
          return;
        }

        // 2) o arquivo em si
        const { error: upError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file);
        if (upError) {
          // volta documento_path pra null — sem o objeto a referência ficaria morta
          await removerDocumentoPessoa(tipo, id);
          toast.error("Falha ao enviar o arquivo. Tente de novo.");
          return;
        }

        // 3) na substituição o objeto antigo ficou órfão ao trocar o path —
        //    remove depois do upload ok (o doc novo já garante a referência)
        if (documentoPath && documentoPath !== path) {
          await supabase.storage.from(BUCKET).remove([documentoPath]);
        }

        toast.success("Documento anexado.");
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  async function remover(): Promise<{ error?: string; ok?: boolean }> {
    // objeto primeiro: zerar a row depois não deixa arquivo órfão no bucket
    if (documentoPath) {
      const supabase = createClient();
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([documentoPath]);
      if (storageError) return { error: "Não foi possível remover o arquivo." };
    }
    return removerDocumentoPessoa(tipo, id);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Documento oficial</p>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onPick}
      />
      {documentoPath ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* primária visível (REALIZA-186): abrir o documento — substituir
              e remover (com confirm controlado) vão pro ⋯ */}
          <a
            href={`/api/documento/${id}?tipo=${tipoUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="-my-2 inline-flex min-h-11 items-center gap-1.5 text-sm underline underline-offset-2 hover:text-foreground sm:my-0 sm:min-h-0"
          >
            <FileText size={14} className="shrink-0 text-muted-foreground" />
            Ver documento
          </a>
          <DocumentoAcoes
            nomeDoc={nomeDoc}
            fem={fem}
            pending={pending}
            onSubstituir={() => fileRef.current?.click()}
            onRemover={remover}
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            aria-busy={pending}
            onClick={() => fileRef.current?.click()}
          >
            {pending ? <CircleNotch size={14} className="animate-spin" /> : <Paperclip size={14} />}
            {pending ? "Enviando…" : "Anexar documento"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {`Nenhum documento: anexe ${fem ? "a" : "o"} ${nomeDoc} (PDF ou imagem, até 20 MB).`}
          </p>
        </div>
      )}
    </div>
  );
}
