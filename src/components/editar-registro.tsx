"use client";

import { useState } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import type { PassoGuia } from "@/lib/ciclo";
import type { Encaminhamento, Registro } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { RegistroFormLazy } from "@/components/registro-form-lazy";

export function EditarRegistro({
  encontroId,
  duplaId,
  evento,
  registro,
  combinados = [],
}: {
  encontroId: string;
  duplaId: string;
  evento: PassoGuia | null;
  registro: Registro;
  /** Combinados gravados por este registro — hidratam a etapa 3 do form de
   *  edição (o id do banco é o que o salvarRegistro casa por id). */
  combinados?: Encaminhamento[];
}) {
  const [aberto, setAberto] = useState(false);

  if (aberto) {
    return (
      <div className="space-y-2">
        <RegistroFormLazy
          encontroId={encontroId}
          duplaId={duplaId}
          evento={evento}
          registro={registro}
          combinadosDoRegistro={combinados}
          onSaved={() => setAberto(false)}
        />
        <Button type="button" variant="ghost" size="sm" onClick={() => setAberto(false)}>
          Cancelar edição
        </Button>
      </div>
    );
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={() => setAberto(true)}>
      <PencilSimple size={14} /> Editar registro
    </Button>
  );
}
