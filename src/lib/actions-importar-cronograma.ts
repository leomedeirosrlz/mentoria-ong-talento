"use server";

// REALIZA-34 — importação de cronograma por arquivo. As duas actions SÓ
// leem o arquivo e devolvem rascunho: nada persiste aqui — a gravação é
// sempre a `criarCronograma` depois da revisão humana no builder.
import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "@/lib/demo/mode";
import { providerConfigurado } from "@/lib/ia/provider";
import { extrairConteudo, type Extraido } from "@/lib/importar-cronograma/extrair";
import {
  normalizarCronograma,
  type RascunhoImportacao,
} from "@/lib/importar-cronograma/normalizar";
import { normalizarComIa } from "@/lib/importar-cronograma/ia";

async function gate(): Promise<string | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data: eu } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", (claimsData?.claims?.sub as string) ?? "")
    .single();
  if (!eu) return "Sessão expirada. Entre de novo.";
  if (eu.role !== "coordenacao")
    return "Só a coordenação importa cronogramas.";
  return null;
}

export type ResultadoImportacao = {
  rascunho: RascunhoImportacao;
  /** provider configurado — a UI só oferece "Tentar com IA" se true. */
  iaDisponivel: boolean;
};

export async function importarCronogramaRascunho(
  formData: FormData
): Promise<{ ok: true; resultado: ResultadoImportacao } | { error: string }> {
  const erro = await gate();
  if (erro) return { error: erro };

  const file = formData.get("arquivo");
  if (!(file instanceof File)) return { error: "Envie o arquivo do cronograma." };

  const ext = await extrairConteudo(file);
  if (!ext.ok) return { error: ext.erro };

  const rascunho = normalizarCronograma(ext.extraido);
  return {
    ok: true,
    resultado: { rascunho, iaDisponivel: providerConfigurado() },
  };
}

/** Camada 3 a pedido: reprocessa o MESMO arquivo com a IA. O cliente manda
 *  o arquivo de novo (não há storage — a reextração é barata e garante que
 *  a IA leia exatamente o que a camada 1 leu). */
export async function importarCronogramaComIa(
  formData: FormData
): Promise<{ ok: true; resultado: ResultadoImportacao } | { error: string }> {
  const erro = await gate();
  if (erro) return { error: erro };
  if (await demoAtivo())
    return { error: "No modo demonstração a IA não processa arquivos." };

  const file = formData.get("arquivo");
  if (!(file instanceof File)) return { error: "Envie o arquivo do cronograma." };

  const ext = await extrairConteudo(file);
  if (!ext.ok) return { error: ext.erro };

  const r = await normalizarComIa(ext.extraido as Extraido);
  if (!r.ok) return { error: r.erro };
  return {
    ok: true,
    resultado: { rascunho: r.rascunho, iaDisponivel: true },
  };
}
