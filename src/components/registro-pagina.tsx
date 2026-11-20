"use client";

import { useRouter } from "next/navigation";
import { RegistroForm } from "@/components/registro-form";
import type { PassoGuia } from "@/lib/ciclo";
import type { Encaminhamento, Trilha } from "@/lib/types";

/** Host cliente mínimo da rota dedicada de registro (REALIZA-473): só monta o
 *  `RegistroForm` — cabeçalho, contexto e links são server. Import estático
 *  de propósito: a rota já é o recorte de bundle, então não passa pelo
 *  `RegistroFormLazy` (que existe pro clique no card) e evita o esqueleto
 *  duplo no meio da tela. */
export function RegistroPagina({
  encontroId,
  duplaId,
  evento,
  trilha,
  combinadosPendentes,
  proximosRegistros,
  cobertura,
  origem,
}: {
  encontroId: string;
  duplaId: string;
  evento: PassoGuia | null;
  trilha: Trilha | null;
  combinadosPendentes: Encaminhamento[];
  /** Fila do "Registrar o Nº também" — a página passa só os encontros que
   *  ainda devem registro (filaRegistrosPendentes). */
  proximosRegistros: { encontroId: string; numero: number }[];
  /** Passos que a mesma sessão pode cobrir (007 US11) — a página deriva com
   *  `coberturaDaSessao`; null na trilha especialista. */
  cobertura: { numero: number; titulo: string }[] | null;
  origem: "novo" | "retroativo";
}) {
  const router = useRouter();

  return (
    <RegistroForm
      encontroId={encontroId}
      duplaId={duplaId}
      evento={evento}
      trilha={trilha}
      combinadosPendentes={combinadosPendentes}
      proximosRegistros={proximosRegistros}
      cobertura={cobertura}
      // o h1 da página nomeia a tarefa — o form não repete o título
      titulo={false}
      origem={origem}
      // "Concluir" volta pra ficha com o bloco aberto, sem refresh extra
      irParaAposSalvar={`/duplas/${duplaId}?aba=encontros#registrar-${encontroId}`}
      onEncadear={(proximoId) =>
        router.replace(`/duplas/${duplaId}/registrar/${proximoId}`)
      }
    />
  );
}
