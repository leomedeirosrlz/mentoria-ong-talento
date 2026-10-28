"use client";

import { useState } from "react";
import { AUDIENCIAS, AUDIENCIA_LABEL, type Audiencia } from "@/lib/materiais";
import { filterChipCls } from "@/components/ui/filter-chip";

/** Público de um material por papel — chips cumulativos, não dropdown.
 *  "Todos" é exclusivo (limpa os demais); desmarcar o último volta pra
 *  "Todos" porque material sem público não existe. O valor viaja no
 *  FormData como CSV num input hidden (mesmo contrato dos outros forms). */
export function AudienciasPicker({
  value,
  onChange,
  defaultValues,
  name = "audiencias",
  id,
}: {
  /** Controlado (a tela precisa do valor pra ajustar teto de encontro). */
  value?: Audiencia[];
  onChange?: (v: Audiencia[]) => void;
  /** Não-controlado: valor inicial. */
  defaultValues?: readonly string[] | null;
  name?: string;
  id?: string;
}) {
  const iniciais = (defaultValues ?? []).filter((a): a is Audiencia =>
    (AUDIENCIAS as readonly string[]).includes(a)
  );
  const [interno, setInterno] = useState<Audiencia[]>(
    iniciais.length ? iniciais : ["todos"]
  );
  const sel = value ?? interno;
  const setSel = (v: Audiencia[]) => {
    if (value === undefined) setInterno(v);
    onChange?.(v);
  };

  function alternar(a: Audiencia) {
    if (a === "todos") {
      setSel(["todos"]);
      return;
    }
    const semTodos = sel.filter((x) => x !== "todos");
    const proximo = semTodos.includes(a)
      ? semTodos.filter((x) => x !== a)
      : [...semTodos, a];
    setSel(proximo.length ? proximo : ["todos"]);
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium leading-none">Quem recebe</span>
      <div
        role="group"
        aria-label="Quem recebe o material"
        className="flex flex-wrap gap-1.5"
      >
        {AUDIENCIAS.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={sel.includes(a)}
            onClick={() => alternar(a)}
            className={filterChipCls(sel.includes(a))}
          >
            {AUDIENCIA_LABEL[a]}
          </button>
        ))}
      </div>
      <input type="hidden" name={name} id={id} value={sel.join(",")} hidden readOnly />
      <p className="text-xs text-muted-foreground">
        Pode combinar papéis. “Todos” inclui o mentorando.
      </p>
    </div>
  );
}
