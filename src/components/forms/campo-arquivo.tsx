"use client";

import { useState, useTransition } from "react";
import { ArrowUp, CircleNotch, FileText, X } from "@phosphor-icons/react";
import { subirAnexoFormulario } from "@/lib/forms/actions";
import {
  ARQUIVO_MAX_MB,
  ARQUIVO_MIMES,
  type FormularioCampo,
  type RespostaValor,
} from "@/lib/forms/schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Upload de arquivo (REALIZA-70): escolhe → sobe via action pro bucket
 *  privado → o valor do campo é só o metadado {path,nome,tamanho} que a
 *  resposta grava. Sem o path ninguém baixa — o objeto nunca é público.
 *  Compartilhado pelo renderer genérico e pelo CampoGenerico dos
 *  instrumentos (lá o valor sai controlado pelo useResposta). */
export function CampoArquivo({
  campo,
  token,
  valor,
  onValor,
  preview,
}: {
  campo: FormularioCampo;
  token: string;
  valor: RespostaValor | undefined;
  onValor: (id: string, v: RespostaValor | null) => void;
  preview: boolean;
}) {
  const [pending, start] = useTransition();
  const [erroUp, setErroUp] = useState<string | null>(null);
  const arq =
    valor && typeof valor === "object" && !Array.isArray(valor)
      ? (valor as { path: string; nome: string; tamanho: number })
      : null;

  function escolheu(file: File | null) {
    if (!file || pending) return;
    const maxMb = campo.max_mb ?? ARQUIVO_MAX_MB;
    if (file.size > maxMb * 1024 * 1024) {
      setErroUp(`Arquivo grande demais. Máximo ${maxMb} MB.`);
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    setErroUp(null);
    start(async () => {
      const r = await subirAnexoFormulario(token, campo.id, fd);
      if (r.error || !r.arquivo?.path) {
        setErroUp(r.error ?? "Não deu pra enviar. Tente de novo.");
        return;
      }
      onValor(campo.id, r.arquivo);
    });
  }

  return (
    <div>
      {/* o valor real viaja no hidden — coleta/validação leem o JSON do
          FormData como qualquer outro campo (no useResposta o mesmo
          metadado sai do mapa de valores; o hidden é inofensivo lá) */}
      <input
        type="hidden"
        name={campo.id}
        value={arq ? JSON.stringify(arq) : ""}
      />
      {arq ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
          <FileText size={18} className="shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{arq.nome}</p>
            <p className="text-xs text-muted-foreground">
              {(arq.tamanho / 1024 / 1024).toFixed(1).replace(".", ",")} MB ·
              enviado
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onValor(campo.id, null)}
            aria-label={`Remover ${arq.nome}`}
            className="shrink-0 text-muted-foreground"
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : (
        <label
          className={cn(
            "flex h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-input text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
            (pending || preview) && "pointer-events-none opacity-60"
          )}
        >
          {pending ? (
            <CircleNotch size={20} className="animate-spin" aria-hidden />
          ) : (
            <ArrowUp size={20} aria-hidden />
          )}
          <span className="font-medium">
            {pending ? "Enviando…" : "Toque pra escolher o arquivo"}
          </span>
          <span className="text-xs">
            PDF ou imagem · até {campo.max_mb ?? ARQUIVO_MAX_MB} MB
          </span>
          <input
            type="file"
            accept={(campo.accept ?? ARQUIVO_MIMES).join(",")}
            disabled={pending || preview}
            className="sr-only"
            onChange={(e) => escolheu(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
      {erroUp && (
        <p className="mt-1.5 text-sm leading-snug text-destructive">{erroUp}</p>
      )}
    </div>
  );
}
