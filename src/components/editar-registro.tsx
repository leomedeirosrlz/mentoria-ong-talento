"use client";

import { useState } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import type { PassoGuia } from "@/lib/ciclo";
import type { Registro } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { RegistroFormLazy } from "@/components/registro-form-lazy";

export function EditarRegistro({
  encontroId,
  duplaId,
  evento,
  registro,
}: {
  encontroId: string;
  duplaId: string;
  evento: PassoGuia | null;
  registro: Registro;
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
