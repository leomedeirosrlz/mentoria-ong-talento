"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, Paperclip } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  anexarArquivoMaterial,
  deleteMaterial,
  removerArquivoMaterial,
} from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import type { Material } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

const LIMITE_BYTES = 20 * 1024 * 1024;
const BUCKET = "materiais";
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
  return limpo || "arquivo";
}

export function MaterialActions({ material }: { material: Material }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

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
        const pathAntigo = material.path;
        const path = `materiais/${crypto.randomUUID()}-${saneiaNome(file.name)}`;

        // 1) o path entra na row ANTES do upload — a policy de INSERT do storage
        //    só aceita objeto cujo name já exista como path em materiais
        const res = await anexarArquivoMaterial(material.id, path);
        if (res?.error) {
          toast.error(res.error);
          return;
        }

        // 2) o arquivo em si
        const { error: upError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file);
        if (upError) {
          // restaura a referência anterior — sem o objeto o path novo ficaria morto
          const rest = pathAntigo
            ? await anexarArquivoMaterial(material.id, pathAntigo)
            : await removerArquivoMaterial(material.id);
          toast.error(
            rest?.error
              ? "Falha ao enviar o arquivo — anexe de novo."
              : "Falha ao enviar o arquivo — tente de novo."
          );
          return;
        }

        // 3) troca concluída — remove o objeto antigo pra não ficar órfão no bucket
        if (pathAntigo) await supabase.storage.from(BUCKET).remove([pathAntigo]);

        toast.success(pathAntigo ? "Arquivo substituído." : "Arquivo anexado.");
        router.refresh();
      } catch {
        toast.error("Sem conexão — tente de novo.");
      }
    });
  }

  async function remover(m: Material): Promise<{ error?: string; ok?: boolean }> {
    // objeto primeiro: o delete da row depois não deixa arquivo órfão no bucket
    if (m.path) {
      const supabase = createClient();
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([m.path]);
      if (storageError) return { error: "Não foi possível remover o arquivo." };
    }
    return deleteMaterial(m.id);
  }

  return (
    <div className="flex items-center">
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onPick}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={
          pending
            ? "Enviando arquivo"
            : material.path
              ? "Trocar arquivo"
              : "Anexar arquivo"
        }
        aria-busy={pending}
        disabled={pending}
        onClick={() => fileRef.current?.click()}
      >
        {pending ? <CircleNotch size={15} className="animate-spin" /> : <Paperclip size={15} />}
      </Button>
      <ConfirmDeleteButton
        titulo={`Excluir "${material.titulo}"?`}
        descricao={
          material.path
            ? "O material e o arquivo anexado saem da biblioteca de todos os perfis. A exclusão é definitiva."
            : "O material sai da biblioteca de todos os perfis. A exclusão é definitiva."
        }
        sucesso={`Material "${material.titulo}" excluído.`}
        onConfirm={() => remover(material)}
      />
    </div>
  );
}
