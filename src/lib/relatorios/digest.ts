// Digest semanal da coordenação (REALIZA-178): monta o HTML a partir dos
// motores vivos — resumoSemanaDe por cronograma, saudadeDaDupla por dupla
// ativa, emLimbo nos registros — e resolve a audiência (papel efetivo
// 'coordenacao' via profile_papeis, e-mail via profiles_contato, mesmo
// molde do dispararParaRoles). O guard de segunda, o dedup e o log ficam
// em jobs-digest.ts; o disparo manual (enviarDigestSemanal) reusa daqui.
//
// LGPD (spec §7/9): primeiro nome do mentorado + motivos de enum/contagem
// — nunca texto livre (reflexoes/observacoes), contato, dados civis ou
// sobrenome. O detalhe completo fica atrás do CTA autenticado /relatorios.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  emLimbo,
  encontrosDaSemana,
  formatDate,
  resumoSemanaDe,
  saudadeDaDupla,
  type ResumoSemana,
} from "@/lib/ciclo";
import { primeiroNomeDaDupla } from "@/lib/agenda-minha";
import { emailLayout, esc } from "@/lib/email-templates";
import { SITE_URL } from "@/lib/email";
import { DUPLA_SELECT } from "@/lib/queries";
import type { CicloEvento, Cronograma, Dupla } from "@/lib/types";

/** Janela civil seg–dom (YYYY-MM-DD) — saída do semanaBounds. */
export type SemanaDigest = { seg: string; dom: string };

export type DigestSemanal = {
  assunto: string;
  /** Um envelope por destinatário — ninguém vê o e-mail de ninguém. */
  mensagens: { to: string; subject: string; html: string }[];
  nRisco: number;
  nPendentes: number;
};

type RiscoLinha = { nome: string; motivo: string };

/** Corpo + resumo do digest — puro sobre o universo resolvido. Separado do
 *  fetch pra o vitest montar o universo fake sem cliente supabase. */
export function corpoDigestSemanal({
  semana,
  resumos,
  riscos,
  nAtencao,
  nLimbo,
  nAssinaturas,
  formacoesSemChamada,
}: {
  semana: SemanaDigest;
  /** Um ResumoSemana por cronograma com encontro oficial na semana. */
  resumos: { rotulo: string; resumo: ResumoSemana }[];
  /** Duplas em risco: 1º nome do mentorado + motivo[0] do semáforo. */
  riscos: RiscoLinha[];
  nAtencao: number;
  /** Encontros em limbo (agendado/remarcado vencido sem registro). */
  nLimbo: number;
  /** Assinaturas sem assinado_em com token vencendo em até 14 dias. */
  nAssinaturas: number;
  /** Formações da semana ainda sem chamada (presencas = 0). */
  formacoesSemChamada: number;
}): { assunto: string; conteudoHtml: string; nPendentes: number } {
  const faixa = `${formatDate(semana.seg)} a ${formatDate(semana.dom)}`;
  const assunto = `Digest semanal — ${faixa}`;
  const nPendentes = nLimbo + nAssinaturas + formacoesSemChamada;

  const partes: string[] = [];
  partes.push(
    `<p style="margin:0 0 18px;font-size:15px;line-height:1.55;">` +
      `Semana de <b>${esc(faixa)}</b> — o panorama do ciclo e quem precisa ` +
      `de atenção hoje.</p>`
  );

  if (resumos.length) {
    partes.push(
      `<h3 style="margin:0 0 8px;font-size:15px;">Encontros da semana</h3><ul style="margin:0 0 18px;padding-left:20px;font-size:14px;line-height:1.6;">` +
        resumos
          .map(
            (r) =>
              `<li><b>${esc(r.rotulo)}</b>: ${r.resumo.realizaram} de ` +
              `${r.resumo.total} se encontraram` +
              (r.resumo.aguardandoRegistro
                ? ` · ${r.resumo.aguardandoRegistro} registro(s) em aberto`
                : "") +
              (r.resumo.reposicao
                ? ` · ${r.resumo.reposicao} em reposição`
                : "") +
              `</li>`
          )
          .join("") +
        `</ul>`
    );
  }

  partes.push(
    `<h3 style="margin:0 0 8px;font-size:15px;">Duplas em risco (${riscos.length})</h3>`
  );
  if (riscos.length) {
    partes.push(
      `<ul style="margin:0 0 6px;padding-left:20px;font-size:14px;line-height:1.6;">` +
        riscos
          .map((r) => `<li><b>${esc(r.nome)}</b> — ${esc(r.motivo)}</li>`)
          .join("") +
        `</ul>`
    );
  } else {
    partes.push(
      `<p style="margin:0 0 6px;font-size:14px;">Nenhuma dupla em risco.</p>`
    );
  }
  if (nAtencao) {
    partes.push(
      `<p style="margin:0 0 18px;font-size:13px;">+ ${nAtencao} em atenção.</p>`
    );
  }

  partes.push(
    `<h3 style="margin:8px 0 8px;font-size:15px;">Pendências</h3><ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.6;">` +
      `<li>${nLimbo} registro(s) de encontro em aberto</li>` +
      `<li>${nAssinaturas} assinatura(s) vencendo em até 14 dias</li>` +
      `<li>${formacoesSemChamada} formação(ões) da semana sem chamada</li>` +
      `</ul>`
  );

  return { assunto, conteudoHtml: partes.join(""), nPendentes };
}

/** Monta o digest sobre o cliente passado (admin no job, sessão no
 *  disparo manual — a coordenação lê tudo pela RLS nos dois caminhos).
 *  `semana` é a janela que o e-mail cobre; `agora` ancora semáforo/limbo. */
export async function montarDigestSemanal(
  supabase: SupabaseClient,
  semana: SemanaDigest,
  agora = new Date()
): Promise<DigestSemanal> {
  const segunda = new Date(`${semana.seg}T12:00:00Z`);
  const limiteAssinatura = new Date(
    agora.getTime() + 14 * 86400000
  ).toISOString();

  const [dRes, eRes, cRes, aRes, pRes, fRes] = await Promise.all([
    supabase
      .from("duplas")
      .select(DUPLA_SELECT)
      .in("status", ["ativa", "pausada"]),
    supabase.from("ciclo_eventos").select("*").order("ordem"),
    supabase.from("cronogramas").select("id, nome, turma"),
    supabase
      .from("assinaturas")
      .select("id", { count: "exact", head: true })
      .is("assinado_em", null)
      .neq("status", "revogado")
      .lte("token_expira_em", limiteAssinatura),
    supabase
      .from("profiles")
      .select("id, profile_papeis!inner(papel)")
      .in("profile_papeis.papel", ["coordenacao"])
      .eq("ativo", true),
    supabase
      .from("ciclo_eventos")
      .select("id, titulo, data, presencas(count)")
      .eq("tipo", "formacao")
      .gte("data", semana.seg)
      .lte("data", semana.dom),
  ]);
  if (dRes.error) throw dRes.error;
  if (eRes.error) throw eRes.error;
  if (cRes.error) throw cRes.error;
  if (pRes.error) throw pRes.error;
  if (fRes.error) throw fRes.error;

  const duplas = (dRes.data ?? []) as unknown as Dupla[];
  const eventos = (eRes.data ?? []) as CicloEvento[];
  const crons = (cRes.data ?? []) as Pick<
    Cronograma,
    "id" | "nome" | "turma"
  >[];

  // resumo da semana por cronograma — o encontro oficial da janela naquele
  // cronograma ancora o resumoSemanaDe (mesma métrica do board da agenda)
  const porCronograma = new Map(encontrosDaSemana(eventos, segunda)
    .map((e) => [e.cronograma_id, e] as const));
  const resumos = crons
    .map((c) => {
      const ev = porCronograma.get(c.id);
      const resumo = ev ? resumoSemanaDe(duplas, ev, semana) : null;
      return resumo ? { rotulo: c.nome, resumo } : null;
    })
    .filter((r): r is { rotulo: string; resumo: ResumoSemana } => !!r);

  const riscos: RiscoLinha[] = [];
  let nAtencao = 0;
  const agoraMs = agora.getTime();
  for (const d of duplas.filter((x) => x.status === "ativa")) {
    const saude = saudadeDaDupla(d, eventos, agora);
    if (saude.semaforo === "risco") {
      riscos.push({
        nome: primeiroNomeDaDupla(d) || "Jovem",
        motivo: saude.motivos[0] ?? "",
      });
    } else if (saude.semaforo === "atencao") nAtencao++;
  }
  const nLimbo = duplas
    .filter((d) => d.status === "ativa")
    .flatMap((d) => d.encontros)
    .filter((e) => emLimbo(e, agoraMs)).length;

  const formacoesSemChamada = (fRes.data ?? []).filter(
    (f) =>
      ((f.presencas as { count: number }[] | null)?.[0]?.count ?? 0) === 0
  ).length;

  // audiência: papel efetivo 'coordenacao' → e-mail via profiles_contato
  // (mesmo molde do dispararParaRoles — papel secundário também recebe)
  const ids = [...new Set((pRes.data ?? []).map((p) => p.id))];
  let para: string[] = [];
  if (ids.length) {
    const { data: contatos } = await supabase
      .from("profiles_contato")
      .select("id, email")
      .in("id", ids)
      .not("email", "is", null);
    para = [
      ...new Set(
        (contatos ?? []).map((c) => c.email).filter((e): e is string => !!e)
      ),
    ];
  }

  const { assunto, conteudoHtml, nPendentes } = corpoDigestSemanal({
    semana,
    resumos,
    riscos,
    nAtencao,
    nLimbo,
    nAssinaturas: aRes.count ?? 0,
    formacoesSemChamada,
  });

  const html = emailLayout({
    titulo: "Digest semanal",
    tagline: "Programa de Mentoria",
    preheader: `${riscos.length} em risco · ${nPendentes} pendência(s)`,
    conteudoHtml,
    ctaLabel: "Abrir relatórios",
    ctaHref: `${SITE_URL}/relatorios`,
  });

  return {
    assunto,
    mensagens: para.map((to) => ({ to, subject: assunto, html })),
    nRisco: riscos.length,
    nPendentes,
  };
}
