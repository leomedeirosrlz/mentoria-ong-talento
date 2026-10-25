"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Collapsible } from "@base-ui/react/collapsible";
import {
  ArrowSquareOut,
  CaretRight,
  CircleNotch,
  FilePdf,
  FileText,
  Link as LinkIcon,
  LockSimple,
  Paperclip,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  definirCurriculoMentorado,
  removerCurriculoMentorado,
  salvarCurriculoUrlMentorado,
} from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Input } from "@/components/ui/input";

const LIMITE_BYTES = 20 * 1024 * 1024;
const BUCKET = "documentos";
// allowlist explícita — mesma do documento oficial (SVG/HEIC fora)
const TIPOS_ACEITOS = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const ACCEPT = TIPOS_ACEITOS.join(",");

/** Nome do arquivo entra no path do storage — fica em ASCII seguro. */
function saneiaNome(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining marks do NFD
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return limpo || "documento";
}

/** Currículo do mentorado (0081) — documento confidencial do matching:
 *  link externo (Drive) que o form coleta e/ou arquivo no bucket privado
 *  `documentos`. Renderiza na ficha de /pessoas pra coordenação e auxiliar
 *  executivo — a page só monta o card pra staff e os campos chegam null
 *  pros demais (view mentorados_curriculo). `podeEditar` é coord-only:
 *  o auxiliar executivo lê, não gerencia. */
export function CurriculoMentorado({
  mentoradoId,
  curriculoPath,
  curriculoUrl,
  podeEditar,
}: {
  mentoradoId: string;
  /** Path no bucket `documentos` — baixado via /api/documento?tipo=curriculo. */
  curriculoPath?: string | null;
  /** Link externo já sanitizado (http/https) pela page. */
  curriculoUrl?: string | null;
  /** Só a coordenação anexa arquivo e edita o link. */
  podeEditar: boolean;
}) {
  const [pending, start] = useTransition();
  const [linkOpen, setLinkOpen] = useState(false);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const temAlgo = Boolean(curriculoPath || curriculoUrl);

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
        // 1) o path entra na row ANTES do upload — a policy de INSERT do
        //    storage só aceita objeto cujo name já é curriculo_path de alguém
        const res = await definirCurriculoMentorado(mentoradoId, path);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        // 2) o arquivo em si
        const { error: upError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file);
        if (upError) {
          // desfaz o vínculo — sem o objeto a referência ficaria morta
          await removerCurriculoMentorado(mentoradoId);
          toast.error("Falha ao enviar o arquivo. Tente de novo.");
          return;
        }
        // 3) na substituição o objeto antigo ficou órfão — remove depois do
        //    upload ok (o path novo já garante a referência)
        if (curriculoPath && curriculoPath !== path) {
          await supabase.storage.from(BUCKET).remove([curriculoPath]);
        }
        toast.success("Currículo anexado.");
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  function salvarLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const url = String(new FormData(e.currentTarget).get("curriculo_url") ?? "");
    start(async () => {
      try {
        const res = await salvarCurriculoUrlMentorado(mentoradoId, url);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success(url.trim() ? "Link do currículo salvo." : "Link removido.");
        setLinkOpen(false);
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  async function removerArquivo(): Promise<{ error?: string; ok?: boolean }> {
    // objeto primeiro: zerar a row depois não deixa arquivo órfão no bucket
    if (curriculoPath) {
      const supabase = createClient();
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([curriculoPath]);
      if (storageError) return { error: "Não foi possível remover o arquivo." };
    }
    return removerCurriculoMentorado(mentoradoId);
  }

  return (
    <section className="rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)] sm:p-5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <FileText size={15} aria-hidden className="shrink-0 text-muted-foreground" />
        Currículo
        {/* o cadeado carrega sozinho o sinal de confidencialidade, como no
            card de notas */}
        <LockSimple
          size={13}
          role="img"
          aria-label="Confidencial: só coordenação e auxiliar executivo"
          className="text-muted-foreground"
        />
      </h2>

      <div className="mt-2 space-y-1">
        {curriculoPath && (
          <div className="flex items-start gap-2 py-1">
            <FilePdf size={15} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <a
                href={`/api/documento/${mentoradoId}?tipo=curriculo`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-sm py-0.5 text-sm underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Ver currículo
              </a>
              <span className="block text-xs text-muted-foreground">
                Arquivo PDF/imagem · abre em nova aba
              </span>
            </span>
            <a
              href={`/api/documento/${mentoradoId}?tipo=curriculo`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir currículo em nova aba"
              className="-my-1.5 inline-flex min-h-11 shrink-0 items-center rounded-md px-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:my-0 sm:min-h-6"
            >
              <ArrowSquareOut size={14} aria-hidden />
            </a>
          </div>
        )}
        {curriculoUrl && (
          <div className="flex items-start gap-2 py-1">
            <LinkIcon size={15} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <a
                href={curriculoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-sm py-0.5 text-sm underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Abrir link do currículo
              </a>
              <span className="block truncate text-xs text-muted-foreground">
                {curriculoUrl}
              </span>
            </span>
            <a
              href={curriculoUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir link do currículo em nova aba"
              className="-my-1.5 inline-flex min-h-11 shrink-0 items-center rounded-md px-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:my-0 sm:min-h-6"
            >
              <ArrowSquareOut size={14} aria-hidden />
            </a>
          </div>
        )}
        {!temAlgo && (
          <p className="text-xs text-muted-foreground">
            {podeEditar
              ? "Nenhum currículo cadastrado. Anexe o arquivo ou cole o link que veio do form."
              : "Nenhum currículo cadastrado."}
          </p>
        )}
      </div>

      {podeEditar && (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={onPick}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              aria-busy={pending}
              onClick={() => fileRef.current?.click()}
            >
              {pending ? (
                <CircleNotch size={14} className="animate-spin" />
              ) : (
                <Paperclip size={14} />
              )}
              {curriculoPath ? "Substituir arquivo" : "Anexar arquivo"}
            </Button>
            {curriculoPath && (
              <ConfirmDeleteButton
                titulo="Remover o currículo?"
                descricao="O arquivo é apagado do bucket e some da ficha do(a) jovem."
                sucesso="Currículo removido."
                acao="Remover"
                onConfirm={removerArquivo}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Remover arquivo do currículo"
                    className="text-muted-foreground"
                  >
                    <Trash size={13} />
                  </Button>
                }
              />
            )}
          </div>
          <Collapsible.Root open={linkOpen} onOpenChange={setLinkOpen}>
            <Collapsible.Trigger className="group flex min-h-8 w-full items-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <PencilSimple size={13} aria-hidden className="shrink-0" />
              {curriculoUrl ? "Editar link externo" : "Adicionar link externo"}
              <CaretRight
                size={12}
                aria-hidden
                className="ml-auto shrink-0 transition-transform duration-150 group-data-[panel-open]:rotate-90"
              />
            </Collapsible.Trigger>
            <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
              <form onSubmit={salvarLink} className="flex items-center gap-2 pt-2">
                <Input
                  name="curriculo_url"
                  type="url"
                  inputMode="url"
                  maxLength={300}
                  defaultValue={curriculoUrl ?? ""}
                  placeholder="https://drive.google.com/…"
                  aria-label="Link externo do currículo"
                  className="h-8 flex-1 text-xs"
                />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  aria-busy={pending}
                >
                  Salvar
                </Button>
              </form>
            </Collapsible.Panel>
          </Collapsible.Root>
        </div>
      )}
    </section>
  );
}
