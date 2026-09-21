"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, FileText, Paperclip } from "@phosphor-icons/react";
import { toast } from "sonner";
import { definirDocumentoPessoa, removerDocumentoPessoa } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

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
      toast.error("Formato não aceito — use PDF, PNG, JPG ou WebP.");
      return;
    }
    if (file.size > LIMITE_BYTES) {
      toast.error("O arquivo passa de 20 MB — envie uma versão menor.");
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
          toast.error("Falha ao enviar o arquivo — tente de novo.");
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
        toast.error("Sem conexão — tente de novo.");
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
          <a
            href={`/api/documento/${id}?tipo=${tipoUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm underline underline-offset-2 hover:text-foreground"
          >
            <FileText size={14} className="shrink-0 text-muted-foreground" />
            Ver documento
          </a>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            aria-busy={pending}
            onClick={() => fileRef.current?.click()}
          >
            {pending ? <CircleNotch size={14} className="animate-spin" /> : <Paperclip size={14} />}
            {pending ? "Enviando…" : "Substituir"}
          </Button>
          <ConfirmDeleteButton
            titulo="Remover o documento?"
            descricao={`${fem ? "A" : "O"} ${nomeDoc} é apagad${fem ? "a" : "o"} e a pessoa fica sem documento oficial.`}
            sucesso={`${nomeDoc.charAt(0).toUpperCase()}${nomeDoc.slice(1)} removid${fem ? "a" : "o"}.`}
            onConfirm={remover}
            trigger={
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
                Remover
              </Button>
            }
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
            {`Nenhum documento — anexe ${fem ? "a" : "o"} ${nomeDoc} (PDF ou imagem, até 20 MB).`}
          </p>
        </div>
      )}
    </div>
  );
}
