"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enviarEmailsLote, SITE_URL } from "@/lib/email";
import {
  emailChamadoAtualizacao,
  emailChamadoUrgencia,
} from "@/lib/email-templates";
import { demoRole } from "./demo/mode";
import { DEMO_MSG } from "./demo/shared";

// Server actions dos chamados unificados (0084). Toda transição vai pras
// RPCs definer — o banco é quem decide papel, dono e transição válida; aqui
// fica validação de entrada, erro pt-BR e os efeitos colaterais (e-mail).

async function me() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data } = await supabase
    .from("profiles")
    .select("id, role, nome")
    .eq("user_id", (claimsData?.claims?.sub as string) ?? "")
    .single();
  return { supabase, me: data };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIAS = ["agenda", "metodologia", "plataforma", "urgencia", "outro"];

/** O erro da RPC chega como { message } — P0001 com texto pt-BR passa direto
 *  (molde marcarCombinadoFeito). */
function erroRpc(error: { message?: string } | null): string {
  return error?.message || "Não foi possível concluir. Tente de novo.";
}

/** Só as telas que mostram chamado: /chamados, a home (MeusChamadosCard e
 *  o badge "sem dono" do layout) e, pro jovem, /jovem/perfil — /jovem não
 *  lista chamado. As páginas são dinâmicas, então isso só invalida o router
 *  cache de quem agiu; a página atual já volta re-renderizada na resposta da
 *  action (qualquer revalidação faz o Next renderizá-la). */
function revalidaChamado(papel: string | null, opts?: { home?: boolean }) {
  revalidatePath("/chamados");
  if (opts?.home !== false) revalidatePath("/");
  if (papel === "mentorado") revalidatePath("/jovem/perfil");
}

/** E-mail redundante + log depois da resposta: o Resend (e o rpc de log)
 *  não seguram o usuário. Em server action o after() ainda enxerga os
 *  cookies, então o client de sessão segue válido pro rpc. Nunca lança. */
function enviaEmailChamadoDepois(
  supabase: Awaited<ReturnType<typeof createClient>>,
  envio: {
    chamadoId: string | undefined;
    para: string[];
    assunto: string;
    html: string;
    contexto: string;
  }
) {
  after(async () => {
    try {
      const r = await enviarEmailsLote({
        para: envio.para,
        assunto: envio.assunto,
        html: envio.html,
      });
      // log via RPC definer — policy de emails_enviados é coord-only
      const { error } = await supabase.rpc("registrar_email_chamado", {
        p_chamado_id: envio.chamadoId,
        p_assunto: envio.assunto,
        p_destinatarios: envio.para.length,
        p_enviados: r.enviados,
        p_falhas: r.falhas,
      });
      if (error) console.error(`${envio.contexto}: log email`, error);
    } catch (e) {
      console.error(`${envio.contexto}: email`, e);
    }
  });
}

export type AbrirChamadoInput = {
  categoria: string;
  assunto: string;
  mensagem?: string;
  descricaoOutro?: string;
  duplaId?: string;
};

export async function abrirChamado(
  input: AbrirChamadoInput
): Promise<{ ok?: boolean; id?: string; numero?: string; error?: string }> {
  if (await demoRole()) return { error: DEMO_MSG };
  const { supabase, me: profile } = await me();
  if (!profile) return { error: "Sem sessão ativa. Entre de novo." };
  if (!CATEGORIAS.includes(input.categoria)) {
    return { error: "Escolha uma categoria válida." };
  }
  const assunto = input.assunto?.trim() ?? "";
  if (assunto.length < 2 || assunto.length > 200) {
    return { error: "O assunto precisa ter entre 2 e 200 caracteres." };
  }
  if ((input.mensagem?.length ?? 0) > 5000) {
    return { error: "A mensagem passa de 5000 caracteres." };
  }
  if (
    input.categoria === "outro" &&
    (input.descricaoOutro?.trim().length ?? 0) < 2
  ) {
    return { error: "Descreva em poucas palavras o assunto do chamado." };
  }
  if (input.duplaId && !UUID_RE.test(input.duplaId)) {
    return { error: "Dupla inválida." };
  }

  const { data, error } = await supabase.rpc("abrir_chamado", {
    p_categoria: input.categoria,
    p_assunto: assunto,
    p_mensagem: input.mensagem?.trim() || null,
    p_descricao_outro: input.descricaoOutro?.trim() || null,
    p_dupla_id: input.duplaId ?? null,
  });
  if (error) return { error: erroRpc(error) };

  const ret = data as {
    id?: string;
    numero?: string;
    destinatarios?: { email?: string | null; nome?: string | null }[];
  };

  // urgência e chamado do jovem → e-mail redundante pro staff (nunca bloqueia)
  const dests = ret?.destinatarios ?? [];
  const emails = dests
    .map((d) => d.email)
    .filter((e): e is string => !!e);
  if (emails.length) {
    enviaEmailChamadoDepois(supabase, {
      chamadoId: ret.id,
      para: emails,
      assunto: `Chamado ${ret.numero ?? ""}: ${assunto}`,
      html: emailChamadoUrgencia({
        numero: ret.numero ?? "",
        assunto,
        categoria: input.categoria,
        autorNome: profile.nome,
        href: `${SITE_URL}/chamados?c=${ret.id}`,
      }),
      contexto: "abrirChamado",
    });
  }

  revalidaChamado(profile.role);
  return { ok: true, id: ret?.id, numero: ret?.numero };
}

async function rpcSimples(
  nome: string,
  args: Record<string, unknown>,
  opts?: { home?: boolean }
): Promise<{ ok?: boolean; error?: string }> {
  if (await demoRole()) return { error: DEMO_MSG };
  const { supabase, me: profile } = await me();
  if (!profile) return { error: "Sem sessão ativa. Entre de novo." };
  if (!UUID_RE.test(String(args.p_id ?? ""))) {
    return { error: "Chamado não encontrado." };
  }
  const { error } = await supabase.rpc(nome, args);
  if (error) return { error: erroRpc(error) };
  revalidaChamado(profile.role, opts);
  return { ok: true };
}

export async function assumirChamado(id: string) {
  return rpcSimples("assumir_chamado", { p_id: id });
}

export async function devolverChamadoFila(id: string) {
  return rpcSimples("devolver_chamado_fila", { p_id: id });
}

export async function reabrirChamado(id: string) {
  return rpcSimples("reabrir_chamado", { p_id: id });
}

export async function pedirReaberturaChamado(id: string) {
  return rpcSimples("pedir_reabertura_chamado", { p_id: id });
}

export async function resolverChamado(id: string, resumo: string) {
  if (!resumo?.trim()) return { error: "Escreva um resumo da resolução." };
  return rpcSimples("resolver_chamado", { p_id: id, p_resumo: resumo.trim() });
}

export async function atribuirChamado(id: string, responsavelId: string | null) {
  if (responsavelId && !UUID_RE.test(responsavelId)) {
    return { error: "Responsável inválido." };
  }
  if (await demoRole()) return { error: DEMO_MSG };
  const { supabase, me: profile } = await me();
  if (!profile) return { error: "Sem sessão ativa. Entre de novo." };
  if (!UUID_RE.test(id)) return { error: "Chamado não encontrado." };
  const { error } = await supabase.rpc("atribuir_chamado", {
    p_id: id,
    p_para: responsavelId,
  });
  if (error) return { error: erroRpc(error) };
  revalidaChamado(profile.role);
  return { ok: true };
}

export async function publicarAtualizacaoChamado(id: string, texto: string) {
  if (await demoRole()) return { error: DEMO_MSG };
  const { supabase, me: profile } = await me();
  if (!profile) return { error: "Sem sessão ativa. Entre de novo." };
  if (!UUID_RE.test(id)) return { error: "Chamado não encontrado." };
  if (!texto?.trim() || texto.length > 4000) {
    return { error: "Escreva a atualização (até 4000 caracteres)." };
  }
  const { data, error } = await supabase.rpc("publicar_atualizacao_chamado", {
    p_id: id,
    p_texto: texto.trim(),
  });
  if (error) return { error: erroRpc(error) };

  // e-mail redundante pro autor — molde do apoio_jovem; nunca bloqueia
  const autor = (data as { autor?: { email?: string | null; nome?: string | null; profile_id?: string } | null })
    ?.autor;
  if (autor?.email) {
    // jovem não alcança /chamados (o layout manda pra /jovem e o pedido se
    // perde) — os pedidos dele vivem em /jovem/perfil. Admin client: quem
    // atende nem sempre lê o profile do jovem pelo RLS
    let jovem = false;
    if (autor.profile_id) {
      const { createAdminClient } = await import("./supabase/admin");
      const { data: papel } = await createAdminClient()
        .from("profiles").select("role").eq("id", autor.profile_id).maybeSingle();
      jovem = papel?.role === "mentorado";
    }
    enviaEmailChamadoDepois(supabase, {
      chamadoId: id,
      para: [autor.email],
      assunto: "Atualização no seu pedido de apoio",
      html: emailChamadoAtualizacao({
        autorNome: autor.nome ?? "",
        texto: texto.trim(),
        href: jovem
          ? `${SITE_URL}/jovem/perfil?c=${id}`
          : `${SITE_URL}/chamados?c=${id}`,
      }),
      contexto: "publicarAtualizacaoChamado",
    });
  }
  revalidaChamado(profile.role);
  return { ok: true };
}

export async function comentarChamado(
  id: string,
  texto: string,
  mencionados?: string[]
) {
  if (!texto?.trim() || texto.length > 4000) {
    return { error: "Escreva o comentário (até 4000 caracteres)." };
  }
  const validos = (mencionados ?? []).filter((m) => UUID_RE.test(m));
  // comentário interno não muda estado nem dono: home e badge não mudam
  return rpcSimples(
    "comentar_chamado",
    { p_id: id, p_texto: texto.trim(), p_mencionados: validos },
    { home: false }
  );
}

/** Compensação do pipeline de anexo: a policy do storage exige a row de
 *  chamado_anexos ANTES do upload (mesmo molde de registro_anexos) — se o
 *  binário falha no meio, a metadata vira órfã ("anexo que não abre"). O
 *  usuário não tem DELETE na tabela, então a limpeza é admin — mas escopada:
 *  o select de conferência corre sob a RLS do caller (só vê o que pode ver)
 *  e a row só sai se foi ele quem anexou, ou se é equipe. Já o OBJETO do
 *  bucket só sai pra coordenação: a policy de delete do storage é
 *  coord-only (0084) e o admin a bypassaria — alinhar evita dar ao auxiliar
 *  um delete que o banco não lhe concede. No fluxo real isso não deixa
 *  resto: o descarte corre quando o upload FALHOU (não há binário); se um
 *  upload parcial existir, a remoção do objeto fica com a coordenação. */
export async function descartarChamadoAnexo(
  anexoId: string
): Promise<{ ok?: boolean; error?: string }> {
  if (await demoRole()) return { error: DEMO_MSG };
  const { supabase, me: profile } = await me();
  if (!profile) return { error: "Sem sessão ativa. Entre de novo." };
  if (!UUID_RE.test(anexoId)) return { error: "Anexo inválido." };
  const { data: row } = await supabase
    .from("chamado_anexos")
    .select("id, path, created_by")
    .eq("id", anexoId)
    .maybeSingle();
  if (!row) return { ok: true }; // nada a limpar — ou fora do escopo da RLS
  const equipe = profile.role === "coordenacao" || profile.role === "supervisor";
  if (row.created_by !== profile.id && !equipe) {
    return { error: "Só quem anexou pode remover o arquivo." };
  }
  const { createAdminClient } = await import("./supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin
    .from("chamado_anexos")
    .delete()
    .eq("id", row.id);
  if (error) {
    console.error("descartarChamadoAnexo:", error);
    return { error: "Não foi possível descartar o anexo." };
  }
  // objeto só pra coordenação — espelha a delete policy coord-only do bucket
  if (profile.role === "coordenacao") {
    await admin.storage.from("chamado-anexos").remove([row.path]);
  }
  revalidaChamado(profile.role, { home: false });
  return { ok: true };
}

export async function acrescentarInfoChamado(id: string, texto: string) {
  if (!texto?.trim() || texto.length > 4000) {
    return { error: "Escreva a informação (até 4000 caracteres)." };
  }
  return rpcSimples("acrescentar_info_chamado", {
    p_id: id,
    p_texto: texto.trim(),
  });
}

/** Botão "marcar como atendido" da ficha do registro — resolve o chamado
 *  correspondente e limpa a flag na mesma transação (RPC). */
export async function resolverApoioChamado(
  origem: { registroId?: string; avaliacaoId?: string },
  resumo?: string
) {
  if (await demoRole()) return { error: DEMO_MSG };
  const { supabase, me: profile } = await me();
  if (!profile) return { error: "Sem sessão ativa. Entre de novo." };
  const { error } = await supabase.rpc("resolver_chamado_por_origem", {
    p_registro_id: origem.registroId ?? null,
    p_avaliacao_id: origem.avaliacaoId ?? null,
    p_resumo: resumo?.trim() || null,
  });
  if (error) return { error: erroRpc(error) };
  revalidaChamado(profile.role);
  // a flag de apoio sai do registro/avaliação na mesma RPC
  revalidatePath("/registros");
  revalidatePath("/duplas/[id]", "page");
  return { ok: true };
}
