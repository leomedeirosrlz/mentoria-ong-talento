"use client";

import { useEffect, useRef, useState } from "react";
import {
  CircleNotch,
  FilePdf,
  Paperclip,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { descartarChamadoAnexo } from "@/lib/actions-chamados";
import { formatTamanho } from "@/lib/ciclo";
import { cn } from "@/lib/utils";

const LIMITE_BYTES = 10 * 1024 * 1024;
const BUCKET = "chamado-anexos";
const TIPOS_ACEITOS = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];
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

/** Tipo pra rótulo/capa do anexo (thumb de imagem × bloco PDF × genérico). */
export function tipoAnexo(mime: string | null | undefined) {
  if (mime === "application/pdf") return "pdf" as const;
  if (mime?.startsWith("image/")) return "imagem" as const;
  return "arquivo" as const;
}

export const ROTULO_ANEXO = {
  imagem: "Imagem",
  pdf: "PDF",
  arquivo: "Arquivo",
} as const;

export type AnexoPendente = {
  key: string;
  file: File;
  /** object URL local — só imagem ganha thumb antes do upload */
  preview: string | null;
  status: "aguardando" | "enviando" | "erro";
};

/** Anexos escolhidos no composer: ficam pendentes (com preview local) até o
 *  envio — o rascunho nunca vaza pro chamado antes da mensagem sair. No
 *  envio cada arquivo sobe row → binário; se o binário falha a row é
 *  descartada (descartarChamadoAnexo) pra não sobrar metadado órfão.
 *  `meuId` carimba created_by — sem ele o descarte do órfão negava até o
 *  próprio autor (NULL nunca casa com profile.id); o trigger stamp da 0119
 *  é a garantia no banco. */
export function useAnexosPendentes(chamadoId: string, meuId: string) {
  const [pendentes, setPendentes] = useState<AnexoPendente[]>([]);
  const previewsRef = useRef<Set<string>>(new Set());

  // object URLs morrem com o componente — revoke centralizado no unmount
  useEffect(
    () => () => {
      for (const url of previewsRef.current) URL.revokeObjectURL(url);
    },
    []
  );

  function adicionar(file: File) {
    if (!TIPOS_ACEITOS.includes(file.type)) {
      toast.error("Formato não aceito: use PDF, PNG, JPG ou WebP.");
      return;
    }
    if (file.size > LIMITE_BYTES) {
      toast.error("O arquivo passa de 10 MB. Envie uma versão menor.");
      return;
    }
    const preview = file.type.startsWith("image/")
      ? URL.createObjectURL(file)
      : null;
    if (preview) previewsRef.current.add(preview);
    setPendentes((l) => [
      ...l,
      { key: crypto.randomUUID(), file, preview, status: "aguardando" },
    ]);
  }

  /** `forcar` é só do fluxo interno do envio (pós-upload). Pela UI, remover
   *  enquanto um irmão está "enviando" é corrida: o upload já capturou o
   *  arquivo e a row subiria invisível — some da lista mas chega na trilha.
   *  O botão também fica desabilitado nesse estado (AnexosPendentes). */
  function remover(key: string, forcar = false) {
    setPendentes((l) => {
      if (!forcar && l.some((p) => p.status === "enviando")) return l;
      const alvo = l.find((p) => p.key === key);
      if (alvo?.preview) {
        previewsRef.current.delete(alvo.preview);
        URL.revokeObjectURL(alvo.preview);
      }
      return l.filter((p) => p.key !== key);
    });
  }

  function marcar(key: string, status: AnexoPendente["status"]) {
    setPendentes((l) =>
      l.map((p) => (p.key === key ? { ...p, status } : p))
    );
  }

  /** Sobe os pendentes sequencialmente. Devolve o nº de falhas — os que
   *  deram erro ficam na lista marcados pra retry no próximo envio. */
  async function enviar(interno: boolean): Promise<number> {
    const supabase = createClient();
    const alvo = pendentes.filter((p) => p.status !== "enviando");
    let falhas = 0;
    for (const p of alvo) {
      marcar(p.key, "enviando");
      const path = `${chamadoId}/${crypto.randomUUID()}-${saneiaNome(p.file.name)}`;
      try {
        // row primeiro: a policy do storage confere os metadados antes de
        // aceitar o binário (molde registro_anexos). Se o upload falha,
        // descarta a row — nada de metadado órfão na trilha.
        const { data: row, error: rowErr } = await supabase
          .from("chamado_anexos")
          .insert({
            chamado_id: chamadoId,
            path,
            nome: p.file.name,
            tamanho: p.file.size,
            mime: p.file.type,
            interno,
            created_by: meuId,
          })
          .select("id")
          .single();
        if (rowErr || !row) throw rowErr ?? new Error("sem row");
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, p.file, { contentType: p.file.type });
        if (upErr) {
          const limpeza = await descartarChamadoAnexo(row.id);
          if (limpeza?.error)
            console.error("anexo: falha ao descartar row órfã", limpeza.error);
          throw upErr;
        }
        remover(p.key, true); // a trilha recarrega com o item real no refresh
      } catch (err) {
        console.error("anexo:", err);
        marcar(p.key, "erro");
        falhas++;
      }
    }
    return falhas;
  }

  return { pendentes, adicionar, remover, enviar };
}

/** Botão "Anexar arquivo" do composer — só escolhe; o upload é no envio. */
export function ChamadoAnexos({
  onArquivo,
  disabled,
}: {
  onArquivo: (file: File) => void;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        multiple
        onChange={(e) => {
          for (const file of e.target.files ?? []) onArquivo(file);
          e.target.value = "";
        }}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={disabled}
        className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:min-h-9"
      >
        <Paperclip size={15} aria-hidden />
        Anexar arquivo
      </button>
    </>
  );
}

/** Lista dos anexos pendentes dentro do composer — thumb (imagem) ou capa
 *  de tipo (PDF), nome truncado, tamanho, visibilidade e remover. */
export function AnexosPendentes({
  itens,
  interno,
  visaoAutor,
  onRemover,
}: {
  itens: AnexoPendente[];
  /** composer da equipe: o flag segue o modo (interno/público) do envio */
  interno: boolean;
  /** composer do autor: a legenda vira "a equipe vê" */
  visaoAutor?: boolean;
  onRemover: (key: string) => void;
}) {
  if (itens.length === 0) return null;
  // enquanto um sobe, o remove dos irmãos trava — tirar da lista não
  // cancela o upload já em curso (a row subiria invisível na trilha)
  const travado = itens.some((a) => a.status === "enviando");
  return (
    <ul className="mt-2.5 space-y-1.5" aria-label="Anexos a enviar">
      {itens.map((a) => {
        const tipo = tipoAnexo(a.file.type);
        const quem = visaoAutor
          ? "a equipe vê"
          : interno
            ? "só a equipe vê"
            : "o autor também vê";
        return (
          <li
            key={a.key}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border p-2",
              a.status === "erro"
                ? "border-destructive/50 bg-destructive/5"
                : "border-border bg-muted/30"
            )}
          >
            <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-card">
              {a.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.preview}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : tipo === "pdf" ? (
                <span className="grid place-items-center gap-0.5 text-destructive/70">
                  <FilePdf size={17} aria-hidden />
                  <span className="text-[8px] font-bold tracking-wider">
                    PDF
                  </span>
                </span>
              ) : (
                <Paperclip size={15} aria-hidden className="text-muted-foreground" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">
                {a.file.name}
              </span>
              <span
                className={cn(
                  "block truncate text-[11px]",
                  a.status === "erro"
                    ? "text-destructive"
                    : "text-muted-foreground"
                )}
              >
                {a.status === "erro" ? (
                  <>
                    <WarningCircle size={11} aria-hidden className="mr-1 inline-block -translate-y-px" />
                    Não subiu. Tente enviar de novo
                  </>
                ) : (
                  `${ROTULO_ANEXO[tipo]} · ${formatTamanho(a.file.size)} · ${quem}`
                )}
              </span>
            </span>
            {a.status === "enviando" ? (
              <span
                className="grid size-11 shrink-0 place-items-center text-muted-foreground md:size-8"
                role="status"
                aria-label={`Enviando ${a.file.name}`}
              >
                <CircleNotch size={15} className="animate-spin" aria-hidden />
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onRemover(a.key)}
                disabled={travado}
                aria-label={`Remover anexo ${a.file.name}`}
                className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:hover:bg-transparent md:size-8"
              >
                <X size={14} aria-hidden />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Thumb do anexo na trilha: imagem renderiza o próprio arquivo (o <a> do
 *  /api redireciona pro signed URL — img-src do CSP cobre); se quebrar
 *  (demo sem binário, objeto limpo) cai pro ícone do tipo. */
export function AnexoThumb({
  src,
  mime,
}: {
  src: string;
  mime: string | null | undefined;
}) {
  const [quebrou, setQuebrou] = useState(false);
  const tipo = tipoAnexo(mime);
  const mostraImg = tipo === "imagem" && !quebrou;
  // erro pré-hidratação não dispara onError — complete&&naturalWidth===0
  // denuncia a imagem quebrada já montada (mesmo truque do Avatar)
  const refImg = (el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth === 0) setQuebrou(true);
  };
  return (
    <span
      className="relative grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted"
      aria-hidden="true"
    >
      {mostraImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={refImg}
          src={src}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setQuebrou(true)}
        />
      ) : tipo === "pdf" ? (
        <span className="grid place-items-center gap-0.5 text-destructive/70">
          <FilePdf size={18} aria-hidden />
          <span className="text-[8px] font-bold tracking-wider">PDF</span>
        </span>
      ) : (
        <Paperclip size={16} aria-hidden className="text-muted-foreground" />
      )}
    </span>
  );
}
