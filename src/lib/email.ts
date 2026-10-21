import { Resend } from "resend";

/** Remetente único do sistema — domínio realiza.vc no Resend. */
const FROM = process.env.EMAIL_FROM ?? "Realiza.vc <noreply@realiza.vc>";

/** Teto da API de batch do Resend por chamada. */
const LOTE_MAX = 100;

/** Base pública do app — links de CTA dos e-mails (cai no login quando a
 *  rota exige sessão; o middleware redireciona de volta depois). Vive em
 *  lib/site.ts (módulo neutro que o layout importa pra metadataBase);
 *  re-exporta aqui pra não mexer nos consumidores. */
export { SITE_URL } from "./site";

/** Mesma matriz audiência → papéis do comunicados_select (0019) e do fan-out
 *  de notificações — se divergir, destinatário recebe e-mail de aviso que a
 *  RLS não deixa abrir. Fonte única importada por actions.ts e actions-email. */
export const ROLES_POR_AUDIENCIA: Record<string, string[]> = {
  // 'todos' inclui o mentorado (REALIZA-108): o aviso geral e o e-mail de
  // publicação chegam aos jovens com login — mesma régua dos comunicados
  // in-app e da leitura audiencia='todos' na RLS
  todos: ["coordenacao", "supervisor", "mentor_dpp", "mentor_especialista", "mentorado"],
  dpp: ["mentor_dpp"],
  especialista: ["mentor_especialista"],
  coordenacao: ["coordenacao"],
  equipe: ["coordenacao", "supervisor"],
};

/** Resolve audiências → papéis efetivos do fan-out, dedupado e sem os
 *  papéis explicitamente excluídos (REALIZA-160: material programado não
 *  vaza pro jovem por e-mail). Puro — compartilhado pelo fan-out de
 *  e-mail e testável sem banco. */
export function rolesParaAudiencias(
  audiencias: string[],
  excluirRoles?: string[]
): string[] {
  const excluir = new Set(excluirRoles ?? []);
  return [
    ...new Set(audiencias.flatMap((a) => ROLES_POR_AUDIENCIA[a] ?? [])),
  ].filter((r) => !excluir.has(r));
}

export type EnvioLoteResult = {
  enviados: number;
  /** Endereços que não saíram (lote rejeitado ou falha individual). */
  falhas: string[];
  /** Falha de configuração/transporte — quando presente, nada foi tentado. */
  error?: string;
};

/** TODO(pendente): kill-switch do envio de e-mail — false segura a saída
 *  de NOTIFICAÇÃO (avisos, materiais, chamados, assinaturas) até o
 *  produto estar pronto pro envio real. O early return devolve `error`
 *  coerente e os callers já tratam como falha de transporte (toast
 *  honesto, nunca falso sucesso). Não cobre auth/conta: magic link passa
 *  por fora (SMTP auth@ do Supabase) e os e-mails de segurança da conta
 *  (senha/e-mail alterado) furam o bloqueio com `critico: true` — são
 *  on-demand, disparados pelo próprio usuário. Virar `true` quando
 *  liberar de verdade. */
export const EMAIL_ENVIO_LIBERADO = false;

/** Dispara o mesmo e-mail pra uma lista de destinatários — um envelope por
 *  pessoa (batch, nunca `to:` múltiplo: ninguém vê o e-mail de ninguém).
 *  Validação permissiva: um endereço ruim não derruba o lote, volta em
 *  `falhas`. Nunca lança — e-mail é complemento, quem chama decide o peso. */
export async function enviarEmailsLote({
  para,
  assunto,
  html,
  replyTo,
  critico,
}: {
  para: string[];
  assunto: string;
  html: string;
  replyTo?: string;
  /** fura o kill-switch — só pra e-mail de auth/conta (segurança,
   *  on-demand). Notificação nunca marca. */
  critico?: boolean;
}): Promise<EnvioLoteResult> {
  if (!EMAIL_ENVIO_LIBERADO && !critico) {
    return {
      enviados: 0,
      falhas: [...para],
      error: "Envio de e-mail desativado (pendente de liberação).",
    };
  }
  if (!process.env.RESEND_API_KEY) {
    return {
      enviados: 0,
      falhas: [...para],
      error: "E-mail não configurado no servidor.",
    };
  }
  if (!para.length) return { enviados: 0, falhas: [] };

  const resend = new Resend(process.env.RESEND_API_KEY);
  const falhas: string[] = [];
  let enviados = 0;

  for (let i = 0; i < para.length; i += LOTE_MAX) {
    const lote = para.slice(i, i + LOTE_MAX);
    try {
      const { data, error } = await resend.batch.send(
        lote.map((to) => ({
          from: FROM,
          to,
          subject: assunto,
          html,
          ...(replyTo ? { replyTo } : {}),
        })),
        { batchValidation: "permissive" }
      );
      if (error || !data) {
        // o lote inteiro foi rejeitado (auth, domínio, quota) — todos falham
        falhas.push(...lote);
        continue;
      }
      enviados += data.data.length;
      for (const f of data.errors ?? []) {
        const addr = lote[f.index];
        if (addr) falhas.push(addr);
      }
    } catch {
      falhas.push(...lote);
    }
  }
  return { enviados, falhas };
}

/** Idem enviarEmailsLote, mas cada mensagem leva assunto e HTML próprios —
 *  links de assinatura são individuais por contrato (o token identifica a
 *  pessoa), então não existe "mesmo e-mail pra todos" nesse fluxo. */
export async function enviarEmailsIndividuais({
  mensagens,
  replyTo,
  critico,
}: {
  mensagens: { to: string; subject: string; html: string }[];
  replyTo?: string;
  /** fura o kill-switch — só pra e-mail de auth/conta (segurança,
   *  on-demand). Notificação nunca marca. */
  critico?: boolean;
}): Promise<EnvioLoteResult> {
  const destinos = mensagens.map((m) => m.to);
  if (!EMAIL_ENVIO_LIBERADO && !critico) {
    return {
      enviados: 0,
      falhas: destinos,
      error: "Envio de e-mail desativado (pendente de liberação).",
    };
  }
  if (!process.env.RESEND_API_KEY) {
    return {
      enviados: 0,
      falhas: destinos,
      error: "E-mail não configurado no servidor.",
    };
  }
  if (!mensagens.length) return { enviados: 0, falhas: [] };

  const resend = new Resend(process.env.RESEND_API_KEY);
  const falhas: string[] = [];
  let enviados = 0;

  for (let i = 0; i < mensagens.length; i += LOTE_MAX) {
    const lote = mensagens.slice(i, i + LOTE_MAX);
    try {
      const { data, error } = await resend.batch.send(
        lote.map((m) => ({
          from: FROM,
          to: m.to,
          subject: m.subject,
          html: m.html,
          ...(replyTo ? { replyTo } : {}),
        })),
        { batchValidation: "permissive" }
      );
      if (error || !data) {
        falhas.push(...lote.map((m) => m.to));
        continue;
      }
      enviados += data.data.length;
      for (const f of data.errors ?? []) {
        const addr = lote[f.index]?.to;
        if (addr) falhas.push(addr);
      }
    } catch {
      falhas.push(...lote.map((m) => m.to));
    }
  }
  return { enviados, falhas };
}
