"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { getMe } from "@/lib/queries";
import { demoAtivo } from "@/lib/demo/mode";
import { DEMO_MSG } from "@/lib/demo/shared";
import { configLinkOk } from "@/lib/relatorio";
import type { RelatorioLinkConfig } from "@/lib/relatorio";

// Gestão dos links públicos de relatório (REALIZA-170). As três RPCs da
// 0110 fazem o trabalho real — has_papel no banco, senha gerada e hasheada
// por pgcrypto, revogação num update. As actions só carregam o gate de
// papel da sessão, validam o config no contrato do app e revalidam a página.

type Resultado<T> = { ok: true } & T | { ok: false; erro: string };

const ERROS_RPC: Record<string, string> = {
  sem_permissao: "Apenas a coordenação gerencia links públicos.",
  titulo_invalido: "Dê um título ao link (até 120 caracteres).",
  config_invalida: "O recorte do relatório está inválido.",
  validade_invalida: "A validade precisa ser de até 370 dias.",
  nao_encontrado: "Este link não existe mais (ou já foi revogado).",
};

function erroRpc(codigo: unknown): string {
  return (
    ERROS_RPC[String(codigo)] ??
    "Não foi possível concluir agora. Tente de novo."
  );
}

async function coordOuErro(): Promise<string | null> {
  if (await demoAtivo()) return DEMO_MSG;
  const me = await getMe();
  if (me?.role !== "coordenacao")
    return "Apenas a coordenação gerencia links públicos.";
  return null;
}

/** Cria o link e devolve slug + senha clara UMA vez — depois disso só o
 *  bcrypt mora no banco (a UI avisa pra copiar na hora). `validadeDias`
 *  null = sem prazo (escolha explícita no dialog). */
export async function criarLinkRelatorio(input: {
  titulo: string;
  config: RelatorioLinkConfig;
  validadeDias: number | null;
}): Promise<Resultado<{ slug: string; senha: string }>> {
  const gate = await coordOuErro();
  if (gate) return { ok: false, erro: gate };
  if (!configLinkOk(input.config))
    return { ok: false, erro: "O recorte do relatório está inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("criar_relatorio_link", {
    p_titulo: input.titulo,
    p_config: input.config,
    p_validade:
      input.validadeDias != null ? `${input.validadeDias} days` : null,
  });
  if (error) {
    Sentry.captureException(error);
    return { ok: false, erro: erroRpc(null) };
  }
  if (!data?.ok) return { ok: false, erro: erroRpc(data?.erro) };

  revalidatePath("/relatorios");
  return { ok: true, slug: data.slug as string, senha: data.senha as string };
}

/** Revogação imediata — a próxima abrir_relatorio já recusa (não há sessão:
 *  o cookie do visitante é revalidado a cada render). Idempotente. */
export async function revogarLinkRelatorio(
  id: string
): Promise<Resultado<object>> {
  const gate = await coordOuErro();
  if (gate) return { ok: false, erro: gate };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revogar_relatorio_link", {
    p_id: id,
  });
  if (error) {
    Sentry.captureException(error);
    return { ok: false, erro: erroRpc(null) };
  }
  if (!data?.ok) return { ok: false, erro: erroRpc(data?.erro) };
  revalidatePath("/relatorios");
  return { ok: true };
}

/** Nova senha — devolve o texto claro uma vez. Também é o "definir senha"
 *  do link legado (senha_hash null → hash). */
export async function redefinirSenhaLink(
  id: string
): Promise<Resultado<{ senha: string }>> {
  const gate = await coordOuErro();
  if (gate) return { ok: false, erro: gate };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "redefinir_senha_relatorio_link",
    { p_id: id }
  );
  if (error) {
    Sentry.captureException(error);
    return { ok: false, erro: erroRpc(null) };
  }
  if (!data?.ok) return { ok: false, erro: erroRpc(data?.erro) };
  revalidatePath("/relatorios");
  return { ok: true, senha: data.senha as string };
}
