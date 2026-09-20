"use client";

import { useState } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import type { CicloEvento, Registro } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { RegistroForm } from "@/components/registro-form";

export function EditarRegistro({
  encontroId,
  duplaId,
  evento,
  registro,
}: {
  encontroId: string;
  duplaId: string;
  evento: CicloEvento | null;
  registro: Registro;
}) {
  const [aberto, setAberto] = useState(false);

  if (aberto) {
    return (
      <div className="space-y-2">
        <RegistroForm
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
