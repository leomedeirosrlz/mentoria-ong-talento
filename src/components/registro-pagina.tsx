"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RegistroForm } from "@/components/registro-form";
import type { PassoGuia } from "@/lib/ciclo";
import type { Encaminhamento, Registro, Trilha } from "@/lib/types";

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
  registro = null,
  combinadosDoRegistro,
  combinadosPendentes,
  proximosRegistros,
  cobertura,
  sessaoGrupo,
  origem,
}: {
  encontroId: string;
  duplaId: string;
  evento: PassoGuia | null;
  trilha: Trilha | null;
  /** Registro já gravado — só existe quando a rota abre sob `?salvo=1`
   *  (pós-save re-renderizado pela action, ou refresh no meio dele): o
   *  form nasce em modo edição, mesma régua da ficha. */
  registro?: Registro | null;
  combinadosDoRegistro?: Encaminhamento[];
  combinadosPendentes: Encaminhamento[];
  /** Fila do "Registrar o Nº também" — a página passa só os encontros que
   *  ainda devem registro (filaRegistrosPendentes). */
  proximosRegistros: { encontroId: string; numero: number }[];
  /** Passos que a mesma sessão pode cobrir (007 US11) — a página deriva com
   *  `coberturaDaSessao`; null na trilha especialista. */
  cobertura: { numero: number; titulo: string }[] | null;
  /** Membros do grupo sessao_id do encontro (sessão planejada, 018) — a
   *  página deriva com `sessaoGrupoDaSessao`; travados no form. */
  sessaoGrupo?: { numero: number; titulo: string }[] | null;
  origem: "novo" | "retroativo";
}) {
  const router = useRouter();
  const pathname = usePathname();

  // `?salvo=1` é a marca explícita do fluxo "acabei de salvar": a action do
  // salvarRegistro revalida a rota no mesmo roundtrip e a página reexecuta
  // o guard — sem a marca, o registro novo cairia em `ja_registrado` e o
  // redirect expulsaria o mentor pra ficha antes da etapa de evidências
  // (K1). Setada no mount, muito antes do primeiro save possível, pro
  // POST da action já sair da URL marcada. `location.search` (não
  // useSearchParams) lê a URL atual sem exigir boundary de Suspense —
  // mesmo padrão do turma-contexto-select.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("salvo") === "1") return;
    params.set("salvo", "1");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router]);

  return (
    <RegistroForm
      encontroId={encontroId}
      duplaId={duplaId}
      evento={evento}
      trilha={trilha}
      registro={registro}
      combinadosDoRegistro={combinadosDoRegistro}
      combinadosPendentes={combinadosPendentes}
      proximosRegistros={proximosRegistros}
      cobertura={cobertura}
      sessaoGrupo={sessaoGrupo}
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
