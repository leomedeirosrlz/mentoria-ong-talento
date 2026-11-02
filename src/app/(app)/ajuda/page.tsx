import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import {
  menuDoPapel,
  papeisDe,
  perguntasPara,
  secoesPara,
} from "@/lib/ajuda/filtrar";
import { COMO_FUNCIONA, PERGUNTAS } from "@/lib/ajuda/conteudo";
import { getMe } from "@/lib/queries";
import { parseAbaAjuda } from "./ajuda-abas";
import { AjudaAbas } from "./ajuda-abas-tabs";
import { AjudaComoFunciona } from "./ajuda-como-funciona";
import { AjudaPerguntas } from "./ajuda-perguntas";

export const metadata: Metadata = { title: "Ajuda" };

/** Ajuda de staff (REALIZA-345): FAQ pesquisável + o mapa do programa, os
 *  dois filtrados pelos papéis efetivos — o híbrido lê a união. Conteúdo
 *  estático (src/lib/ajuda): nada de IA, nada de banco além do getMe. */
export default async function AjudaPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const [{ aba }, me] = await Promise.all([searchParams, getMe()]);
  if (!me) return null; // o layout já barra — guarda de tipo

  const papeis = papeisDe(me);
  const ativa = parseAbaAjuda(aba);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ajuda"
        meta="Perguntas frequentes e o caminho de cada coisa no programa."
      />
      <AjudaAbas ativa={ativa} base="/ajuda">
        {ativa === "perguntas" ? (
          <AjudaPerguntas perguntas={perguntasPara(papeis, PERGUNTAS)} />
        ) : (
          <AjudaComoFunciona
            secoes={secoesPara(papeis, COMO_FUNCIONA)}
            menu={menuDoPapel(me.role)}
          />
        )}
      </AjudaAbas>
    </div>
  );
}
