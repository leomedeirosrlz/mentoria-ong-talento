"use client";

import type { ComponentProps } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapaCalor } from "@/components/viz";

/* REALIZA-417 — drill do mapa de calor. A seção é server component e
 *  `onCelula` é função (não serializa), então o handler mora neste
 *  boundary fino: a grade chega pronta por prop e só o mapa hidrata.
 *
 *  Clicar numa célula filtra a régua pelo papel DA COLUNA (grade.colunas
 *  carrega o enum — "coordenacao", não o rótulo); clicar no papel já
 *  ativo tira o filtro (toggle de volta ao mapa cheio). Os params da
 *  régua (?aba/janela/medida) e os legados (turma/cronograma) viajam
 *  intactos — replace porque filtro não empilha histórico. */
export function MapaCalorDrill({
  papelAtivo,
  ...props
}: ComponentProps<typeof MapaCalor> & {
  /** papel do recorte ativo (?papel=) — null = mapa cheio */
  papelAtivo: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const onCelula = (_superficie: string, papel: string) => {
    const q = new URLSearchParams(sp.toString());
    if (papel === papelAtivo) q.delete("papel");
    else q.set("papel", papel);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return <MapaCalor {...props} onCelula={onCelula} />;
}
