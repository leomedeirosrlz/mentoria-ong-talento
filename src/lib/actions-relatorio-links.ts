"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { getMe } from "@/lib/queries";
import { demoAtivo, demoRole } from "@/lib/demo/mode";
import { DEMO_MSG } from "@/lib/demo/shared";
import { demoResumoAcessos } from "@/lib/demo/queries";
import { configLinkOk } from "@/lib/relatorio";
import type { RelatorioLinkConfig, ResumoAcessoItem } from "@/lib/relatorio";

// Gestão dos links públicos de relatório (REALIZA-170/201). As RPCs da
// 0110/0120 fazem o trabalho real — has_papel no banco, senha (gerada ou
// digitada) hasheada por pgcrypto, revogação num update. As actions só
// carregam o gate de papel da sessão, validam o contrato do app e
// revalidam a página.

type Resultado<T> = { ok: true } & T | { ok: false; erro: string };

const ERROS_RPC: Record<string, string> = {
  sem_permissao: "Apenas a coordenação gerencia links públicos.",
  titulo_invalido: "Dê um título ao link (até 120 caracteres).",
  config_invalida: "O recorte do relatório está inválido.",
  validade_invalida: "A validade precisa ser de até 370 dias.",
  senha_invalida:
    "Senha inválida — de 6 a 72 caracteres, ou deixe em branco pra gerar uma forte.",
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

// piso/teto da senha digitada — o mesmo da RPC 0120 (o teto 72 é o limite
// em bytes do bcrypt 'bf'; validar aqui poupa o round-trip num erro óbvio)
const SENHA_MIN = 6;
const SENHA_MAX = 72;

/** Cria o link e devolve slug + senha clara UMA vez — depois disso só o
 *  bcrypt mora no banco (a UI avisa pra copiar na hora).
 *  `senha`: digitada pela coordenação (0120) — em branco/null a RPC gera a
 *  forte "xxxx-xxxx" de sempre. `semSenha`: link abre direto, senha_hash
 *  fica null e a resposta volta `senha: null` — a UI não mostra segredo.
 *  `validadeDias` null = sem prazo (escolha explícita no dialog). */
export async function criarLinkRelatorio(input: {
  titulo: string;
  config: RelatorioLinkConfig;
  validadeDias: number | null;
  senha?: string | null;
  semSenha?: boolean;
}): Promise<Resultado<{ slug: string; senha: string | null }>> {
  const gate = await coordOuErro();
  if (gate) return { ok: false, erro: gate };
  if (!configLinkOk(input.config))
    return { ok: false, erro: "O recorte do relatório está inválido." };

  const senha = input.senha?.trim() ?? "";
  if (!input.semSenha && senha) {
    // mesma régua da RPC: mínimo em chars, teto em BYTES (bcrypt 'bf'
    // trunca em 72 bytes — multibyte estoura o teto antes dos 72 chars)
    if (
      senha.length < SENHA_MIN ||
      new TextEncoder().encode(senha).length > SENHA_MAX
    ) {
      return { ok: false, erro: ERROS_RPC.senha_invalida };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("criar_relatorio_link", {
    p_titulo: input.titulo,
    p_config: input.config,
    p_validade:
      input.validadeDias != null ? `${input.validadeDias} days` : null,
    p_senha: input.semSenha ? null : senha || null,
    p_sem_senha: !!input.semSenha,
  });
  if (error) {
    Sentry.captureException(error);
    return { ok: false, erro: erroRpc(null) };
  }
  if (!data?.ok) return { ok: false, erro: erroRpc(data?.erro) };

  revalidatePath("/relatorios");
  return {
    ok: true,
    slug: data.slug as string,
    senha: (data.senha as string | null) ?? null,
  };
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
 *  do link sem senha (senha_hash null → hash). Sempre gera a forte: senha
 *  digitada é escolha só na criação (201 — a rotação fica de um clique). */
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

/** Log por evento do /resumo (resumo_acessos, 0106+0110) — alimenta o
 *  "Ver acessos" do menu Compartilhar. Query direta: a policy já é
 *  coord-only e o grant existe — sem RPC nova. ip_hash sai truncado (10
 *  chars): pseudônimo suficiente pra "mesma origem?", sem virar índice. */
export async function listarAcessosLinks(): Promise<
  Resultado<{ acessos: ResumoAcessoItem[] }>
> {
  // demo replica a policy coord-only (0106): fora da coordenação o log
  // vem vazio, não fabricado
  const papelDemo = await demoRole();
  if (papelDemo)
    return {
      ok: true,
      acessos: papelDemo === "coordenacao" ? demoResumoAcessos() : [],
    };
  const gate = await coordOuErro();
  if (gate) return { ok: false, erro: gate };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resumo_acessos")
    .select("slug, acessado_em, ok, motivo, user_agent, ip_hash")
    .order("acessado_em", { ascending: false })
    // teto declarado na UI ("os ~60 mais recentes" — AcessosDialog)
    .limit(60);
  if (error) {
    console.error("listarAcessosLinks:", error);
    Sentry.captureException(error);
    return { ok: false, erro: "Não foi possível carregar os acessos." };
  }
  return {
    ok: true,
    acessos: (data ?? []).map((a) => ({
      slug: a.slug,
      acessado_em: a.acessado_em,
      ok: a.ok,
      motivo: a.motivo,
      user_agent: a.user_agent,
      origem: a.ip_hash ? a.ip_hash.slice(0, 10) : null,
    })),
  };
}
