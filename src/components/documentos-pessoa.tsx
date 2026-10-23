"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Collapsible } from "@base-ui/react/collapsible";
import {
  ArrowSquareOut,
  CircleNotch,
  DotsThreeVertical,
  FileImage,
  FilePdf,
  FileText,
  Paperclip,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  excluirDocumentoPessoa,
  registrarDocumentoPessoa,
} from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { DOCUMENTO_PESSOA_TIPO_LABELS, DOCUMENTO_PESSOA_TIPOS } from "@/lib/ciclo";
import type { DocumentoPessoa } from "@/lib/types";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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

/** Ícone pela extensão do arquivo — pdf e imagem se distinguem na lista. */
function IconeDoc({ nome }: { nome: string | null }) {
  const ext = (nome ?? "").split(".").pop()?.toLowerCase() ?? "";
  const cls = "mt-0.5 shrink-0 text-muted-foreground";
  if (ext === "pdf") return <FilePdf size={15} aria-hidden className={cls} />;
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) {
    return <FileImage size={15} aria-hidden className={cls} />;
  }
  return <FileText size={15} aria-hidden className={cls} />;
}

/** ⋯ da linha do documento: abrir em nova aba (mesmo destino do título,
 *  que já é link) e remover por último — confirm controlado fora do popup. */
function DocPessoaAcoes({
  docId,
  label,
  onRemover,
}: {
  docId: string;
  label: string;
  onRemover: () => Promise<{ error?: string; ok?: boolean }>;
}) {
  const [removendo, setRemovendo] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Ações de "${label}"`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "size-11 shrink-0 sm:size-8"
          )}
        >
          <DotsThreeVertical size={18} weight="bold" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            render={
              <a
                href={`/api/documento/${docId}?tipo=doc`}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <ArrowSquareOut size={16} data-icon="inline-start" aria-hidden />
            Abrir em nova aba
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
        descricao={`${label} é apagado do arquivo e some da ficha da pessoa.`}
        sucesso="Documento removido."
        acao="Remover"
        onConfirm={onRemover}
      />
    </>
  );
}

/** Documentos do intake (RG, comprovante, currículo...) — documentos_pessoa
 *  (0054), N por pessoa. Renderiza só na ficha da coordenação (a query já
 *  vem vazia pros demais; o bloco nem é montado fora dela). O upload fica
 *  atrás do disclosure "Adicionar documento" — a ficha lê mais do que
 *  escreve. */
export function DocumentosPessoa({
  tipo,
  pessoaId,
  documentos,
}: {
  tipo: "profile" | "mentorado";
  pessoaId: string;
  documentos: DocumentoPessoa[];
}) {
  const [pending, start] = useTransition();
  const [docTipo, setDocTipo] = useState<DocumentoPessoa["tipo"]>("rg");
  const [addOpen, setAddOpen] = useState(false);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

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
        // 1) a row entra ANTES do upload — a policy de INSERT do storage só
        //    aceita objeto cujo name já é path de documentos_pessoa
        const res = await registrarDocumentoPessoa(tipo, pessoaId, docTipo, path, file.name);
        if (res?.error || !("id" in (res ?? {}))) {
          toast.error(res?.error ?? "Não foi possível registrar o documento.");
          return;
        }
        const docId = (res as { id: string }).id;
        // 2) o arquivo em si
        const { error: upError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file);
        if (upError) {
          // desfaz a row — sem o objeto a referência ficaria morta
          await excluirDocumentoPessoa(docId, pessoaId);
          toast.error("Falha ao enviar o arquivo. Tente de novo.");
          return;
        }
        toast.success("Documento anexado.");
        setAddOpen(false);
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  async function remover(doc: DocumentoPessoa) {
    // objeto primeiro: a policy de DELETE do bucket é bucket+coord (não
    // exige path registrado), mas manter a ordem do documento oficial evita
    // órfão quando a action falha
    const supabase = createClient();
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([doc.path]);
    if (storageError) return { error: "Não foi possível remover o arquivo." };
    return excluirDocumentoPessoa(doc.id, pessoaId);
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Documentos do cadastro
      </p>
      {documentos.length > 0 ? (
        <ul className="space-y-1">
          {documentos.map((d) => (
            <li key={d.id} className="flex items-start gap-2 py-1">
              <IconeDoc nome={d.nome ?? d.path} />
              <span className="min-w-0 flex-1">
                <a
                  href={`/api/documento/${d.id}?tipo=doc`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-sm py-0.5 text-sm underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {DOCUMENTO_PESSOA_TIPO_LABELS[d.tipo]}
                </a>
                {d.nome && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {d.nome}
                  </span>
                )}
              </span>
              {/* REALIZA-186: abrir + remover eram 2 ícones-fantasma por
                  linha (o "abrir" ainda duplicava o link do título) — um ⋯
                  por documento; remover segue com confirm controlado */}
              <DocPessoaAcoes
                docId={d.id}
                label={DOCUMENTO_PESSOA_TIPO_LABELS[d.tipo]}
                onRemover={() => remover(d)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nenhum documento do cadastro. Os anexos do form de inscrição ficam aqui.
        </p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onPick}
      />
      <Collapsible.Root open={addOpen} onOpenChange={setAddOpen}>
        <Collapsible.Trigger
          render={
            <Button type="button" variant="outline" size="sm" className="mt-1">
              <Plus aria-hidden />
              Adicionar documento
            </Button>
          }
        />
        <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
          <div className="flex items-center gap-2 pt-2">
            <Select
              value={docTipo}
              items={DOCUMENTO_PESSOA_TIPO_LABELS}
              onValueChange={(v) => setDocTipo((v as DocumentoPessoa["tipo"]) ?? "outro")}
            >
              <SelectTrigger size="sm" className="w-44" aria-label="Tipo do documento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENTO_PESSOA_TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>{DOCUMENTO_PESSOA_TIPO_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              aria-busy={pending}
              onClick={() => fileRef.current?.click()}
            >
              {pending ? <CircleNotch size={14} className="animate-spin" /> : <Paperclip size={14} />}
              {pending ? "Enviando…" : "Anexar"}
            </Button>
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
    </div>
  );
}
