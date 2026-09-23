"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, Paperclip, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatDiaMes } from "@/lib/ciclo";
import type { RegistroAnexo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

const LIMITE_BYTES = 10 * 1024 * 1024;
const BUCKET = "registro-anexos";
// allowlist explícita — image/* admitiria SVG (conteúdo ativo) e HEIC (não renderiza)
const TIPOS_ACEITOS = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const ACCEPT = TIPOS_ACEITOS.join(",");

/** "3,4 MB" / "218 KB" — pt-BR com vírgula decimal. */
export function formatTamanho(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1).replace(".", ",")} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Nome do arquivo entra no path do storage — fica em ASCII seguro. */
function saneiaNome(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return limpo || "anexo";
}

export function AnexosRegistro({
  registroId,
  autorId,
  podeAnexar,
  podeRemover,
  anexos,
}: {
  registroId: string;
  /** Mantido no contrato do bloco do registro (o path é por registro_id). */
  duplaId: string;
  /** Profile de quem anexa — vira `created_by` na row de metadados. */
  autorId: string;
  /** Anexar é escrita do mentor (RLS mentor-only). */
  podeAnexar: boolean;
  /** Remover cobre moderação da coordenação (RLS mentor+coord). */
  podeRemover: boolean;
  anexos: RegistroAnexo[];
}) {
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
      toast.error("O arquivo passa de 10 MB — envie uma versão menor.");
      return;
    }

    start(async () => {
      try {
        const supabase = createClient();
        const path = `${registroId}/${crypto.randomUUID()}-${saneiaNome(file.name)}`;

        // 1) a row de metadados vem ANTES do arquivo — a policy de INSERT do
        //    storage só aceita objeto cujo path já exista em registro_anexos
        const { data: row, error: rowError } = await supabase
          .from("registro_anexos")
          .insert({
            registro_id: registroId,
            path,
            nome: file.name,
            tamanho: file.size,
            mime: file.type,
            created_by: autorId,
          })
          .select("id")
          .single();
        if (rowError || !row) {
          toast.error("Não foi possível registrar o anexo — tente de novo.");
          return;
        }

        // 2) o arquivo em si
        const { error: upError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file);
        if (upError) {
          // sem o arquivo a row não vale (e seguraria o path pra sempre)
          await supabase.from("registro_anexos").delete().eq("id", row.id);
          toast.error("Falha ao enviar o arquivo — tente de novo.");
          return;
        }

        toast.success("Evidência anexada.");
        router.refresh();
      } catch {
        toast.error("Sem conexão — tente de novo.");
      }
    });
  }

  async function removerAnexo(a: RegistroAnexo): Promise<{ error?: string; ok?: boolean }> {
    const supabase = createClient();
    // objeto primeiro: a policy de DELETE do storage exige a row de metadados
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([a.path]);
    if (storageError) return { error: "Não foi possível remover o arquivo." };
    const { error: rowError } = await supabase
      .from("registro_anexos")
      .delete()
      .eq("id", a.id);
    if (rowError)
      return { error: "O arquivo saiu, mas a referência ficou — atualize a página." };
    return { ok: true };
  }

  // estado vazio não renderiza nada — o botão de anexar mora junto ao registro
  if (anexos.length === 0 && !podeAnexar) return null;

  return (
    <div className="space-y-2 pt-1">
      {anexos.length > 0 && (
        <ul className="space-y-1.5">
          {anexos.map((a) => (
            <li key={a.id} className="text-xs">
              <span className="flex min-w-0 items-center gap-1.5">
                <Paperclip size={12} className="shrink-0 text-muted-foreground" />
                <a
                  href={`/api/anexo/${a.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={a.nome}
                  className="min-w-0 flex-1 truncate underline underline-offset-2 hover:text-foreground"
                >
                  {a.nome}
                </a>
                {podeRemover && (
                  <ConfirmDeleteButton
                    titulo={`Remover "${a.nome}"?`}
                    descricao="A evidência sai do registro e o arquivo é apagado."
                    sucesso={`Anexo "${a.nome}" removido.`}
                    onConfirm={() => removerAnexo(a)}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Remover anexo"
                        className="text-muted-foreground"
                      >
                        <Trash size={13} />
                      </Button>
                    }
                  />
                )}
              </span>
              {/* meta na linha 2 — nome fica com a largura total (o recuo
                  alinha com o texto, depois do clipe de 12px + gap 6px) */}
              <span className="block pl-4.5 text-muted-foreground">
                {[
                  a.tamanho != null ? formatTamanho(a.tamanho) : null,
                  a.autor?.nome ? `por ${a.autor.nome}` : null,
                  formatDiaMes(a.created_at),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
      {podeAnexar && (
        <div>
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
            variant="outline"
            size="sm"
            disabled={pending}
            aria-busy={pending}
            onClick={() => fileRef.current?.click()}
          >
            {pending ? <CircleNotch size={14} className="animate-spin" /> : <Paperclip size={14} />}
            {pending ? "Enviando…" : "Anexar evidência"}
          </Button>
        </div>
      )}
    </div>
  );
}
