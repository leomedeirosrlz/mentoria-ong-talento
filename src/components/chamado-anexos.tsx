"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, Paperclip } from "@phosphor-icons/react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const LIMITE_BYTES = 10 * 1024 * 1024;
const BUCKET = "chamado-anexos";
const TIPOS_ACEITOS = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const ACCEPT = TIPOS_ACEITOS.join(",");

/** Nome do arquivo entra no path do storage — fica em ASCII seguro. */
function saneiaNome(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return limpo || "anexo";
}

/** Anexar no chamado: metadados primeiro (a policy do storage exige a row),
 *  depois o binário no bucket privado. interno=true → só a equipe lê. */
export function ChamadoAnexos({
  chamadoId,
  interno,
}: {
  chamadoId: string;
  interno: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!TIPOS_ACEITOS.includes(file.type)) {
      toast.error("Formato não aceito: use PDF, PNG, JPG ou WebP.");
      return;
    }
    if (file.size > LIMITE_BYTES) {
      toast.error("O arquivo passa de 10 MB. Envie uma versão menor.");
      return;
    }
    start(async () => {
      try {
        const supabase = createClient();
        const path = `${chamadoId}/${crypto.randomUUID()}-${saneiaNome(file.name)}`;
        const { error: rowError } = await supabase.from("chamado_anexos").insert({
          chamado_id: chamadoId,
          path,
          nome: file.name,
          tamanho: file.size,
          mime: file.type,
          interno,
        });
        if (rowError) throw rowError;
        const { error: upError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type });
        if (upError) throw upError;
        toast.success("Arquivo anexado ao chamado.");
        router.refresh();
      } catch (err) {
        console.error("ChamadoAnexos:", err);
        toast.error("Não foi possível anexar o arquivo.");
      }
    });
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        onChange={onPick}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={pending}
        className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:min-h-8"
      >
        {pending ? (
          <CircleNotch size={15} className="animate-spin" aria-hidden />
        ) : (
          <Paperclip size={15} aria-hidden />
        )}
        Anexar arquivo
      </button>
    </>
  );
}
