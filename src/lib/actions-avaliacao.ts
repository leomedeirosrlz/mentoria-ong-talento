"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "./demo/mode";
import { DEMO_MSG } from "./demo/shared";
import { enviarEmailsLote, SITE_URL } from "./email";
import { emailApoioJovem } from "./email-templates";
import {
  AVANCEI_AVALIACAO_LABEL,
  SENTIMENTO_AVALIACAO_LABEL,
  TEMA_AVALIACAO_LABEL,
} from "./ciclo";
import { avaliacaoPorToken, linkAvaliacaoMeta } from "./queries-avaliacao";
import { erroAmigavel } from "./utils";

// Escrita da avaliação estrela do jovem (REALIZA-109 / D4, migration 0071).
// Toda a decisão de "pode ou não pode" mora na RPC submeter_avaliacao —
// os dois caminhos (token público e jovem logado) convergem nela:
//
//   · token → o link pendente é o fator de posse; logado, precisa ser o
//     destinatário (híbrido 0070, validado de novo no banco)
//   · logado sem token → a própria sessão prova o vínculo com a dupla
//
// O que fica aqui é saneamento de UX (o que um form honesto mandaria) e os
// efeitos colaterais que não são do banco: e-mail redundante do pedido de
// ajuda (Resend fica no app) + o log em emails_enviados via RPC definer.

const TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMENTARIO_MAX = 2000;

async function me() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data } = await supabase
    .from("profiles")
    .select("id, role, nome, ativo")
    .eq("user_id", (claimsData?.claims?.sub as string) ?? "")
    .single();
  return { supabase, me: data };
}

/** As exceções da RPC já vêm em pt-BR e são a copy certa pro toast —
 *  repassa as conhecidas e delega o inesperado pro erroAmigavel. */
function erroAvaliacao(e: { message: string; code?: string }): string {
  if (
    /link inválido|já foi usado ou expirou|de outra pessoa|já foi avaliado|encontro não encontrado|estrelas é obrigatória|avancei inválido|avaliação não encontrada|dupla não encontrada/i.test(
      e.message
    )
  )
    return e.message;
  return erroAmigavel(e);
}

export type EnvioAvaliacao = {
  /** Caminho público /avaliar/<token> — o encontro é resolvido no servidor,
   *  nunca confiado ao payload do client. */
  token?: string;
  /** Caminho logado (/jovem e agenda) — a RPC valida o vínculo pela sessão. */
  encontroId?: string;
  estrelas: number;
  sentimento?: string | null;
  avancei?: string | null;
  temas?: string[];
  comentario?: string | null;
  pedirApoio?: boolean;
  /** Só existe na trilha DPP — especialista nunca lê linha alguma, e um
   *  true gravado lá seria dado morto que a copy não prometeu. */
  visivelMentor?: boolean;
};

type RetornoSubmit = {
  ok: boolean;
  avaliacao_id: string;
  pedir_apoio: boolean;
  chamado_id?: string | null;
  chamado_numero?: string | null;
  destinatarios: { profile_id: string; email: string; nome: string }[];
};

export async function submeterAvaliacao(input: EnvioAvaliacao) {
  if (await demoAtivo()) return { error: DEMO_MSG };

  // ---- saneamento de UX: o que um form honesto mandaria. A RPC revalida
  // tudo no banco — isto só poupa a ida e volta das respostas óbvias.
  const estrelas = Number(input.estrelas);
  if (!Number.isInteger(estrelas) || estrelas < 1 || estrelas > 5)
    return { error: "Escolha uma nota de 1 a 5 estrelas." };

  const sentimento = (input.sentimento ?? "").trim() || null;
  if (sentimento && !SENTIMENTO_AVALIACAO_LABEL[sentimento])
    return { error: "Opção de sentimento inválida." };

  const avancei = (input.avancei ?? "").trim() || null;
  if (avancei && !AVANCEI_AVALIACAO_LABEL[avancei])
    return { error: "Opção de avanço inválida." };

  const temas = [
    ...new Set(
      (input.temas ?? []).map((t) => String(t).trim()).filter(Boolean)
    ),
  ];
  if (temas.some((t) => !TEMA_AVALIACAO_LABEL[t]))
    return { error: "Um dos temas marcados não é válido." };

  const comentario = (input.comentario ?? "").trim() || null;
  if (comentario && comentario.length > COMENTARIO_MAX)
    return {
      error: `O comentário passou de ${COMENTARIO_MAX.toLocaleString("pt-BR")} caracteres.`,
    };

  const supabase = await createClient();
  const token = (input.token ?? "").trim() || null;
  let encontroId: string;
  let duplaId: string | null = null;
  let trilha = "dpp";

  if (token) {
    // caminho público: o token resolve o encontro service-side — o
    // encontroId nunca vem do client (e a RPC ainda confere o par)
    if (!TOKEN_RE.test(token)) return { error: "Link inválido." };
    const meta = await linkAvaliacaoMeta(token);
    if (!meta) return { error: "Link inválido ou expirado." };
    encontroId = meta.encontro_id;
    duplaId = meta.dupla_id;
    trilha = meta.trilha;
  } else {
    encontroId = (input.encontroId ?? "").trim();
    if (!UUID_RE.test(encontroId)) return { error: "Encontro inválido." };
    // a trilha decide se o toggle do mentor vale algo — a sessão do jovem
    // lê a própria dupla pela RLS (sem row = especialista ou alheio; nesse
    // caso a RPC barra o submit e a trilha não importa)
    const { data: enc } = await supabase
      .from("encontros")
      .select("dupla_id, dupla:duplas(trilha)")
      .eq("id", encontroId)
      .maybeSingle();
    const d = enc?.dupla as
      | { trilha: string }[]
      | { trilha: string }
      | null
      | undefined;
    const dd = Array.isArray(d) ? (d[0] ?? null) : d;
    if (enc) {
      duplaId = enc.dupla_id;
      trilha = dd?.trilha ?? "dpp";
    }
  }

  const { data, error } = await supabase.rpc("submeter_avaliacao", {
    p_encontro_id: encontroId,
    p_token: token,
    p_estrelas: estrelas,
    p_sentimento: sentimento,
    p_avancei: avancei,
    p_temas: temas.length ? temas : null,
    p_comentario: comentario,
    p_pedir_apoio: !!input.pedirApoio,
    p_visivel_mentor: trilha === "dpp" ? !!input.visivelMentor : false,
  });
  if (error) return { error: erroAvaliacao(error) };

  const ret = (data ?? {}) as Partial<RetornoSubmit>;
  if (!ret.avaliacao_id) return { ok: true };

  // ---- e-mail redundante do pedido de ajuda (0071): o sino pode passar
  // despercebido e é canal de segurança de menor — coord + supervisor da
  // dupla levam o alerta por e-mail também. Falha aqui NÃO desfaz a
  // avaliação: a notificação in-app já saiu no banco; o log registra o
  // resultado pra coord auditar.
  if (ret.pedir_apoio && ret.destinatarios?.length) {
    try {
      // contexto do e-mail: nome do jovem + nº do encontro. No caminho do
      // token (anon) nenhuma tabela é legível — a RPC definer entrega o
      // contexto mínimo; no caminho logado a sessão lê o próprio encontro
      // e o próprio nome no profile.
      let jovemNome = "Um jovem";
      let numero = 0;
      if (token) {
        const info = await avaliacaoPorToken(token);
        if (info.kind === "ok") {
          jovemNome = info.info.alvo?.jovem_nome ?? jovemNome;
          numero = info.info.encontro?.numero ?? numero;
        }
      } else {
        const [{ data: enc }, { data: claims }] = await Promise.all([
          supabase
            .from("encontros")
            .select("numero")
            .eq("id", encontroId)
            .maybeSingle(),
          supabase.auth.getClaims(),
        ]);
        numero = enc?.numero ?? numero;
        const { data: prof } = await supabase
          .from("profiles")
          .select("nome")
          .eq("user_id", (claims?.claims?.sub as string) ?? "")
          .maybeSingle();
        jovemNome = prof?.nome ?? jovemNome;
      }

      const emails = ret.destinatarios
        .map((d) => d.email)
        .filter((e): e is string => !!e);
      if (emails.length && duplaId) {
        const assunto = `Pedido de ajuda · ${jovemNome.split(/\s+/)[0]}`;
        const html = emailApoioJovem({
          jovemNome,
          encontroNumero: numero,
          estrelas,
          comentario,
          duplaId,
          chamadoHref: ret.chamado_id
            ? `${SITE_URL}/chamados?c=${ret.chamado_id}`
            : null,
          chamadoNumero: ret.chamado_numero ?? null,
        });
        const envio = await enviarEmailsLote({ para: emails, assunto, html });
        // log coord-only por RPC definer — registra até a falha total:
        // "e-mail não configurado" também é informação de auditoria
        const { error: logErr } = await supabase.rpc(
          "registrar_email_apoio_avaliacao",
          {
            p_avaliacao_id: ret.avaliacao_id,
            p_assunto: assunto,
            p_destinatarios: emails.length,
            p_enviados: envio.enviados,
            p_falhas: envio.falhas,
          }
        );
        if (logErr)
          console.error("registrar_email_apoio_avaliacao:", logErr);
      }
    } catch (e) {
      // e-mail é redundância — a entrega real foi a notificação in-app;
      // loga e segue com a resposta de sucesso da avaliação
      console.error("submeterAvaliacao: e-mail de apoio falhou", e);
    }
  }

  revalidatePath("/jovem");
  revalidatePath("/jovem/agenda");
  if (duplaId) revalidatePath(`/duplas/${duplaId}`);
  return { ok: true, pedirApoio: !!ret.pedir_apoio };
}

/** O dono do toggle é o jovem: libera UMA avaliação pro mentor DPP ler na
 *  íntegra (com média agregada sendo o default, este é o gesto de "quero
 *  que ele veja esta"). Coord ligando seria coerção — a RPC escopa ao
 *  mentorado dono da dupla. */
export async function definirVisibilidadeAvaliacao(
  avaliacaoId: string,
  visivel: boolean
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (!UUID_RE.test(avaliacaoId)) return { error: "Avaliação inválida." };

  const { error } = await supabase.rpc("definir_visibilidade_avaliacao", {
    p_id: avaliacaoId,
    p_visivel: !!visivel,
  });
  if (error) return { error: erroAvaliacao(error) };
  revalidatePath("/jovem");
  revalidatePath("/jovem/agenda");
  return { ok: true };
}

/** Atendimento do pedido de ajuda do jovem — 0084: resolve o chamado da
 *  avaliação e limpa a flag na mesma transação (resolver_chamado_por_origem);
 *  a notificação chamado_resolvido fecha o ciclo com o jovem que tem login.
 *  Jovem por token recebe o cuidado por WhatsApp da coordenação, como antes. */
export async function resolverApoioJovem(avaliacaoId: string, duplaId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao")
    return { error: "Só a coordenação atende pedidos de ajuda." };
  if (!UUID_RE.test(avaliacaoId)) return { error: "Avaliação inválida." };

  const { error } = await supabase.rpc("resolver_chamado_por_origem", {
    p_registro_id: null,
    p_avaliacao_id: avaliacaoId,
    p_resumo: null,
  });
  if (error) {
    return {
      error:
        error.code === "P0001" && error.message
          ? error.message
          : erroAmigavel(error),
    };
  }
  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath("/chamados");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}
