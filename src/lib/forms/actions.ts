"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "../demo/mode";
import { DEMO_MSG } from "../demo/shared";
import {
  validaCampos,
  type FormularioCampo,
  type RespostaValor,
} from "./schema";
import { erroAmigavel as erroAmigavelBase } from "../utils";

// Actions da engine de formulários (0034).
// · coordenação: salvar/ativar/excluir forms, gerar e revogar links
// · público: submeterRespostaFormulario — vai pela RPC security definer (o
//   token é o fator de posse; validação real mora no banco)

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** base64url de 24 bytes = 32 chars; aceita folga pra esquemas futuros e os
 *  tokens legíveis da demo */
const TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/;

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

type EuCoord = { id: string; role: string; nome: string };

async function meCoord(): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; eu: EuCoord; error: null }
  | { supabase: Awaited<ReturnType<typeof createClient>>; eu: null; error: string }
> {
  const { supabase, me: eu } = await me();
  if (!eu)
    return { supabase, eu: null, error: "Sessão expirada — entre de novo." };
  if (eu.role !== "coordenacao")
    return { supabase, eu: null, error: "Só a coordenação gerencia formulários." };
  return { supabase, eu, error: null };
}

/** Erro de UI do motor de formulários — P0001 = raise exception de trigger
 *  de domínio (ex.: guard de formulário oficial, 0042): a mensagem já é pt-BR
 *  pensada pra UI e passa direto; o resto segue a tradução comum. */
function erroAmigavel(e: { message: string; code?: string }): string {
  if (e.code === "P0001" && e.message) return e.message;
  return erroAmigavelBase(e);
}

// ---------- formulários ----------

export async function salvarFormulario(input: {
  id?: string;
  titulo: string;
  descricao: string | null;
  campos: unknown;
}): Promise<{ error: string } | { ok: true; id: string }> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, eu, error } = await meCoord();
  if (error || !eu) return { error: error! };

  const titulo = String(input.titulo ?? "").trim();
  if (titulo.length < 3 || titulo.length > 140)
    return { error: "O título precisa ter entre 3 e 140 caracteres." };
  const descricao = String(input.descricao ?? "").trim() || null;
  if (descricao && descricao.length > 2000)
    return { error: "A descrição passa de 2.000 caracteres." };

  const campos = validaCampos(input.campos);
  if (!Array.isArray(campos)) return campos;
  const camposOk: FormularioCampo[] = campos;

  if (!input.id) {
    const { data, error: insErr } = await supabase
      .from("formularios")
      .insert({ titulo, descricao, campos: camposOk, created_by: eu.id })
      .select("id")
      .single();
    if (insErr) return { error: erroAmigavel(insErr) };
    revalidatePath("/formularios");
    return { ok: true, id: data.id };
  }

  // edição: compara campos pra subir a versão — resposta antiga guarda só o
  // id do campo; a versão na row diz que a definição mudou
  const { data: atual, error: getErr } = await supabase
    .from("formularios")
    .select("id, campos, versao")
    .eq("id", input.id)
    .maybeSingle();
  if (getErr) return { error: erroAmigavel(getErr) };
  if (!atual) return { error: "Formulário não encontrado." };

  const mudouCampos =
    JSON.stringify(atual.campos) !== JSON.stringify(camposOk);
  const { data, error: upErr } = await supabase
    .from("formularios")
    .update({
      titulo,
      descricao,
      campos: camposOk,
      ...(mudouCampos ? { versao: (atual.versao as number) + 1 } : {}),
    })
    .eq("id", input.id)
    .select("id");
  if (upErr) return { error: erroAmigavel(upErr) };
  if (!data?.length) return { error: "Formulário não encontrado." };
  revalidatePath("/formularios");
  revalidatePath(`/formularios/${input.id}`);
  return { ok: true, id: input.id };
}

export async function setFormularioAtivo(id: string, ativo: boolean) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, error } = await meCoord();
  if (error) return { error };
  const { data, error: upErr } = await supabase
    .from("formularios")
    .update({ ativo })
    .eq("id", id)
    .select("id");
  if (upErr) return { error: erroAmigavel(upErr) };
  if (!data?.length) return { error: "Formulário não encontrado." };
  revalidatePath("/formularios");
  revalidatePath(`/formularios/${id}`);
  return { ok: true };
}

export async function excluirFormulario(id: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, error } = await meCoord();
  if (error) return { error };
  // cascade apaga links e respostas — é a única forma de remover respostas
  const { error: delErr } = await supabase
    .from("formularios")
    .delete()
    .eq("id", id);
  if (delErr) return { error: erroAmigavel(delErr) };
  revalidatePath("/formularios");
  redirect("/formularios");
}

// ---------- links ----------

export type DestinoLink =
  | { tipo: "generico" }
  | { tipo: "profile"; id: string }
  | { tipo: "mentorado"; id: string };

/** Dupla de contexto do destinatário — a resposta sabe a quem/a qual dupla
 *  pertence sem o coordenador precisar informar. Mentor → sua dupla ativa;
 *  mentorado → a dele. Sem dupla ativa, fica null mesmo. */
async function duplaDoDestino(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dest: DestinoLink
): Promise<string | null> {
  if (dest.tipo === "generico") return null;
  const col = dest.tipo === "profile" ? "mentor_id" : "mentorado_id";
  const { data } = await supabase
    .from("duplas")
    .select("id")
    .eq(col, dest.id)
    .in("status", ["ativa", "pausada"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

const VALIDADES_DIAS = new Set([7, 15, 30, 60]);

/** Link vigente devolvido pela geração — criado agora ou pendente
 *  reutilizado; alimenta o estado "links prontos" dos dialogs (e o
 *  auto-copiar do genérico). */
export type LinkEmitido = {
  id: string;
  tipo: "profile" | "mentorado" | "generico";
  dest_id: string | null;
  token: string;
  expira_em: string | null;
};

export async function gerarLinksFormulario(input: {
  formularioId: string;
  destinos: DestinoLink[];
  diasValidade?: number | null;
}) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, eu, error } = await meCoord();
  if (error || !eu) return { error: error! };

  if (!UUID_RE.test(input.formularioId))
    return { error: "Formulário inválido." };
  const destinos = (input.destinos ?? []).filter(
    (d): d is DestinoLink =>
      d &&
      (d.tipo === "generico" ||
        ((d.tipo === "profile" || d.tipo === "mentorado") && UUID_RE.test(d.id)))
  );
  // dedupe do pedido — a UI manda Set, mas o payload é arbitrário: dois
  // destinos iguais no mesmo lote inseririam dois links vivos
  const chavesVistas = new Set<string>();
  const unicos = destinos.filter((d) => {
    const k = d.tipo === "generico" ? "generico" : `${d.tipo}:${d.id}`;
    if (chavesVistas.has(k)) return false;
    chavesVistas.add(k);
    return true;
  });
  if (!unicos.length) return { error: "Escolha ao menos um destinatário." };
  if (unicos.length > 200)
    return { error: "Gere os links em lotes de até 200 destinatários." };
  const dias =
    input.diasValidade && VALIDADES_DIAS.has(input.diasValidade)
      ? input.diasValidade
      : null;
  const expira_em = dias
    ? new Date(Date.now() + dias * 24 * 3600 * 1000).toISOString()
    : null;

  const { data: form, error: fErr } = await supabase
    .from("formularios")
    .select("id")
    .eq("id", input.formularioId)
    .maybeSingle();
  if (fErr) return { error: erroAmigavel(fErr) };
  if (!form) return { error: "Formulário não encontrado." };

  // links pendentes já emitidos — reenviar pro mesmo destinatário reutiliza o
  // token existente (evita dois links válidos pra mesma pessoa). O genérico
  // entra na mesma regra: um genérico pendente por form, não um por clique.
  const { data: existentes, error: exErr } = await supabase
    .from("formulario_links")
    .select("id, token, dest_profile_id, dest_mentorado_id, usado_em, expira_em")
    .eq("formulario_id", input.formularioId)
    .is("usado_em", null);
  if (exErr) return { error: erroAmigavel(exErr) };
  const agora = Date.now();
  const pendentePorDest = new Map<string, string>();
  for (const l of existentes ?? []) {
    if (l.expira_em && new Date(l.expira_em).getTime() < agora) continue;
    const key = l.dest_profile_id ?? l.dest_mentorado_id ?? "generico";
    pendentePorDest.set(key, l.id);
  }

  let criados = 0;
  let reutilizados = 0;
  for (const dest of unicos) {
    const chave = dest.tipo === "generico" ? "generico" : dest.id;
    if (pendentePorDest.has(chave)) {
      reutilizados++;
      continue;
    }
    const dupla_id = await duplaDoDestino(supabase, dest);
    const { error: insErr } = await supabase.from("formulario_links").insert({
      formulario_id: input.formularioId,
      token: randomBytes(24).toString("base64url"),
      dest_profile_id: dest.tipo === "profile" ? dest.id : null,
      dest_mentorado_id: dest.tipo === "mentorado" ? dest.id : null,
      dupla_id,
      expira_em,
      created_by: eu.id,
    });
    if (insErr) return { error: erroAmigavel(insErr) };
    criados++;
  }

  // relê os vigentes destes destinos — criados agora + pendentes reutilizados
  // voltam pro caller exibir/copiar sem perseguir a lista (ordem do pedido)
  const { data: vigentes } = await supabase
    .from("formulario_links")
    .select("id, token, dest_profile_id, dest_mentorado_id, expira_em")
    .eq("formulario_id", input.formularioId)
    .is("usado_em", null);
  const agora2 = Date.now();
  const vigentesDestes = (vigentes ?? []).filter(
    (l) => !l.expira_em || new Date(l.expira_em).getTime() > agora2
  );
  const links: LinkEmitido[] = [];
  const vistos = new Set<string>();
  for (const dest of unicos) {
    const l = vigentesDestes.find((v) =>
      dest.tipo === "generico"
        ? !v.dest_profile_id && !v.dest_mentorado_id
        : v.dest_profile_id === (dest.tipo === "profile" ? dest.id : null) &&
          v.dest_mentorado_id === (dest.tipo === "mentorado" ? dest.id : null)
    );
    if (!l || vistos.has(l.id)) continue;
    vistos.add(l.id);
    links.push({
      id: l.id,
      tipo: l.dest_profile_id
        ? "profile"
        : l.dest_mentorado_id
          ? "mentorado"
          : "generico",
      dest_id: l.dest_profile_id ?? l.dest_mentorado_id,
      token: l.token,
      expira_em: l.expira_em,
    });
  }

  revalidatePath(`/formularios/${input.formularioId}`);
  return { ok: true, criados, reutilizados, links };
}

/** Reemissão de link expirado: mesmo destinatário e dupla, token novo — o
 *  token velho (já morto) morre de vez. A janela de validade original se
 *  repete (created_at→expira_em do link vencido vira agora→novo prazo); link
 *  que venceu sem validade volta sem validade. */
export async function reemitirLinkFormulario(linkId: string, formularioId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, error } = await meCoord();
  if (error) return { error };
  if (!UUID_RE.test(linkId)) return { error: "Link inválido." };
  const { data: link, error: getErr } = await supabase
    .from("formulario_links")
    .select("id, usado_em, expira_em, created_at")
    .eq("id", linkId)
    .maybeSingle();
  if (getErr) return { error: erroAmigavel(getErr) };
  if (!link) return { error: "Link não encontrado." };
  if (link.usado_em)
    return { error: "Esse link já foi respondido — não dá pra reemitir." };
  const agora = Date.now();
  if (!link.expira_em || new Date(link.expira_em).getTime() > agora)
    return { error: "Só dá pra reemitir link expirado — este ainda vale." };

  const expira_em = new Date(
    agora +
      (new Date(link.expira_em).getTime() - new Date(link.created_at).getTime())
  ).toISOString();

  const token = randomBytes(24).toString("base64url");
  // .is("usado_em", null) trava a corrida com uma resposta que chegue entre
  // a leitura e o update — link respondido nunca troca de token
  const { data: atualizado, error: upErr } = await supabase
    .from("formulario_links")
    .update({ token, expira_em })
    .eq("id", linkId)
    .is("usado_em", null)
    .select("id");
  if (upErr) return { error: erroAmigavel(upErr) };
  if (!atualizado?.length)
    return { error: "Esse link acabou de ser respondido — não dá pra reemitir." };
  revalidatePath(`/formularios/${formularioId}`);
  return { ok: true, token };
}

/** Remove um link ainda não respondido — o cascade levaria a resposta junto,
 *  então link usado é protegido (pra apagar resposta, exclui-se o form). */
export async function excluirLinkFormulario(linkId: string, formularioId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, error } = await meCoord();
  if (error) return { error };
  if (!UUID_RE.test(linkId)) return { error: "Link inválido." };
  const { data, error: delErr } = await supabase
    .from("formulario_links")
    .delete()
    .eq("id", linkId)
    .is("usado_em", null)
    .select("id");
  if (delErr) return { error: erroAmigavel(delErr) };
  if (!data?.length)
    return { error: "Esse link já foi respondido — a resposta iria junto." };
  revalidatePath(`/formularios/${formularioId}`);
  return { ok: true };
}

// ---------- público: envio de resposta ----------

/** Mensagens levantadas pelas RPCs chegam em error.message — as de domínio
 *  são pt-BR e nomeiam a pergunta, então passam direto; o resto vira copy
 *  genérica (não vaza detalhe de infra). */
function traduzErroSubmit(message: string): string {
  if (/link inválido/i.test(message))
    return "Este link não é válido — confira o endereço ou peça um novo à equipe Realiza.vc.";
  if (/link expirado/i.test(message))
    return "Este link expirou — peça um novo à equipe Realiza.vc.";
  if (/formulário encerrado/i.test(message))
    return "Este formulário não está recebendo respostas no momento.";
  if (
    /^(Responda|Escolha|Marque|Opção inválida|Formato inválido|Use uma data)/i.test(
      message
    )
  )
    return message;
  return "Não foi possível enviar sua resposta — tente de novo.";
}

export async function submeterRespostaFormulario(
  token: string,
  respostas: Record<string, RespostaValor>,
  honeypot: string
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  // honeypot: bot preencheu o campo invisível — finge sucesso e não grava
  if (honeypot && honeypot.trim()) return { ok: true };
  if (!token || !TOKEN_RE.test(token))
    return { error: "Este link não é válido." };
  if (!respostas || typeof respostas !== "object" || Array.isArray(respostas))
    return { error: "Respostas inválidas." };
  // teto de payload — jsonb arbitrário não pode entrar solto
  let serializado: string;
  try {
    serializado = JSON.stringify(respostas);
  } catch {
    return { error: "Respostas inválidas." };
  }
  if (serializado.length > 200_000)
    return { error: "Sua resposta ficou grande demais — resuma os textos." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submeter_resposta_formulario", {
    p_token: token,
    p_respostas: respostas,
  });
  if (error) return { error: traduzErroSubmit(error.message) };
  if (!data) return { error: "Não foi possível enviar — tente de novo." };
  return { ok: true };
}
