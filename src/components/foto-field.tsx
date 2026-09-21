"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "@phosphor-icons/react";
import { AVATAR_ACCEPT, AVATAR_MAX_BYTES } from "@/lib/avatar";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** Campo opcional de foto nos dialogs de cadastro — preview circular local
 *  (object URL, revogada na troca/desmonte); o arquivo viaja no FormData e o
 *  upload acontece dentro da action, depois do insert da pessoa. */
export function FotoField({
  id,
  defaultUrl,
}: {
  id: string;
  /** foto atual (edição) — sem default o preview fica vazio até escolher */
  defaultUrl?: string | null;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(defaultUrl ?? null);
  const objUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (objUrl.current) URL.revokeObjectURL(objUrl.current);
    },
    []
  );

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Foto (opcional)</Label>
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-muted-foreground">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <Camera size={18} aria-hidden />
          )}
        </span>
        {/* fora da tab order — o botão abaixo é o controle (ref.click);
            sr-only deixaria um foco invisível no meio do form */}
        <input
          ref={ref}
          id={id}
          name="foto"
          type="file"
          accept={AVATAR_ACCEPT}
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > AVATAR_MAX_BYTES) {
              toast.error("Imagem grande demais — use uma de até 2 MB.");
              e.target.value = "";
              return;
            }
            if (objUrl.current) URL.revokeObjectURL(objUrl.current);
            objUrl.current = URL.createObjectURL(f);
            setPreview(objUrl.current);
          }}
        />
        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => ref.current?.click()}
          >
            {preview ? "Trocar foto" : "Escolher foto"}
          </Button>
          <p className="text-xs text-muted-foreground">PNG, JPG ou WebP até 2 MB.</p>
        </div>
      </div>
    </div>
  );
}
