import type { Metadata } from "next";
import { AjudaAbas } from "@/app/(app)/ajuda/ajuda-abas-tabs";
import { AjudaComoFunciona } from "@/app/(app)/ajuda/ajuda-como-funciona";
import { AjudaPerguntas } from "@/app/(app)/ajuda/ajuda-perguntas";
import { parseAbaAjuda } from "@/app/(app)/ajuda/ajuda-abas";
import { PageHeader } from "@/components/page-header";
import {
  menuDoPapel,
  papeisDe,
  perguntasPara,
  secoesPara,
} from "@/lib/ajuda/filtrar";
import { COMO_FUNCIONA, PERGUNTAS } from "@/lib/ajuda/conteudo";
import { getMe } from "@/lib/queries";

export const metadata: Metadata = { title: "Ajuda" };

/** Ajuda do jovem (REALIZA-345): a mesma superfície da staff, mas o filtro
 *  de papel entrega só as perguntas e seções escritas pra ele — linguagem
 *  simples, nada de telas de staff nem dados de outras pessoas. */
export default async function JovemAjudaPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const [{ aba }, me] = await Promise.all([searchParams, getMe()]);
  if (!me) return null; // o layout já garante mentorado — guarda de tipo

  const papeis = papeisDe(me);
  const ativa = parseAbaAjuda(aba);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ajuda"
        meta="Perguntas frequentes e como a mentoria funciona."
      />
      <AjudaAbas ativa={ativa} base="/jovem/ajuda">
        {ativa === "perguntas" ? (
          <AjudaPerguntas perguntas={perguntasPara(papeis, PERGUNTAS)} />
        ) : (
          <AjudaComoFunciona
            secoes={secoesPara(papeis, COMO_FUNCIONA)}
            menu={menuDoPapel(papeis)}
          />
        )}
      </AjudaAbas>
    </div>
  );
}
