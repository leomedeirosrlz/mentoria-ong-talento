// Digest semanal da coordenação (REALIZA-178, configurável na 451): monta
// o HTML a partir dos motores vivos — resumoSemanaDe por cronograma,
// saudadeDaDupla por dupla ativa, emLimbo nos registros — e resolve a
// audiência (papel efetivo via profile_papeis, e-mail via
// profiles_contato, mesmo molde do dispararParaRoles). O guard de dia, o
// dedup e o log ficam em jobs-digest.ts; o disparo manual
// (enviarDigestSemanal) reusa daqui.
//
// A config mora na row singleton `digest_config` (0210): dia, cadência,
// destinatários e seções. Sem row (ou valor inválido) vale o padrão —
// exatamente o comportamento anterior: segunda, coordenação, tudo ligado.
//
// LGPD (spec §7/9): primeiro nome do mentorado + motivos de enum/contagem
// — nunca texto livre (reflexoes/observacoes), contato, dados civis ou
// sobrenome. O detalhe completo fica atrás do CTA autenticado /relatorios.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cobertosDaDupla,
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
import type { AppRole, CicloEvento, Cronograma, Dupla } from "@/lib/types";

/** Janela civil seg–dom (YYYY-MM-DD) — saída do semanaBounds. */
export type SemanaDigest = { seg: string; dom: string };

export type DigestSemanal = {
  assunto: string;
  /** Um envelope por destinatário — ninguém vê o e-mail de ninguém. */
  mensagens: { to: string; subject: string; html: string }[];
  /** Rótulos da audiência resolvida — vai pro log `emails_enviados`. */
  audiencia: string[];
  nRisco: number;
  nPendentes: number;
};

type RiscoLinha = { nome: string; motivo: string };

// ---------- digest_config (REALIZA-451) ----------

export type CadenciaDigest = "semanal" | "quinzenal" | "desligado";

export type DigestDestinatarios = {
  /** Papéis efetivos (profile_papeis) que resolvem destinatários. */
  papeis: AppRole[];
  /** Ids de profiles individuais (ativos) fora dos papéis. */
  profiles: string[];
  /** Endereços explícitos (ex.: e-mail externo sem conta no app). */
  emails: string[];
};

export type DigestSecoes = {
  encontros: boolean;
  riscos: boolean;
  pendencias: boolean;
};

export type DigestConfig = {
  /** 0=domingo … 6=sábado — mesmo índice do Date.getUTCDay do job. */
  diaSemana: number;
  cadencia: CadenciaDigest;
  destinatarios: DigestDestinatarios;
  secoes: DigestSecoes;
};

/** O padrão é o comportamento pré-config: segunda, coordenação, tudo. */
export const DIGEST_CONFIG_PADRAO: DigestConfig = {
  diaSemana: 1,
  cadencia: "semanal",
  destinatarios: { papeis: ["coordenacao"], profiles: [], emails: [] },
  secoes: { encontros: true, riscos: true, pendencias: true },
};

const PAPEIS_APP: readonly AppRole[] = [
  "coordenacao",
  "supervisor",
  "mentor_dpp",
  "mentor_especialista",
  "mentorado",
];
/** A action restringe a escolha a papéis de equipe — pessoa de outro
 *  papel entra como destinatária individual, nunca pelo papel inteiro. */
export const PAPEIS_DIGEST: readonly AppRole[] = ["coordenacao", "supervisor"];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function listaStr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Normaliza a row do banco (ou qualquer objeto) pra uma config válida —
 *  campo inválido cai no default daquele campo, nunca propaga erro: a
 *  config ruim não pode fazer o job enviar errado (spec US14, borda). */
export function normalizarDigestConfig(row: unknown): DigestConfig {
  if (!row || typeof row !== "object") return DIGEST_CONFIG_PADRAO;
  const r = row as Record<string, unknown>;
  const dia = r.dia_semana;
  const cad = r.cadencia;
  const dest =
    r.destinatarios && typeof r.destinatarios === "object"
      ? (r.destinatarios as Record<string, unknown>)
      : null;
  const sec =
    r.secoes && typeof r.secoes === "object"
      ? (r.secoes as Record<string, unknown>)
      : null;
  let destinatarios = DIGEST_CONFIG_PADRAO.destinatarios;
  if (dest) {
    destinatarios = {
      papeis: listaStr(dest.papeis).filter((p): p is AppRole =>
        PAPEIS_APP.includes(p as AppRole)
      ),
      profiles: listaStr(dest.profiles).filter((p) => UUID_RE.test(p)),
      emails: listaStr(dest.emails)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => EMAIL_RE.test(e)),
    };
    // público zerado é config quebrada — a action exige ≥1 destinatário
    // e "desligado" é o off explícito — então vale o padrão em vez de um
    // digest silenciosamente sem destino
    if (
      !destinatarios.papeis.length &&
      !destinatarios.profiles.length &&
      !destinatarios.emails.length
    ) {
      destinatarios = DIGEST_CONFIG_PADRAO.destinatarios;
    }
  }
  return {
    diaSemana:
      typeof dia === "number" && Number.isInteger(dia) && dia >= 0 && dia <= 6
        ? dia
        : DIGEST_CONFIG_PADRAO.diaSemana,
    cadencia:
      cad === "semanal" || cad === "quinzenal" || cad === "desligado"
        ? cad
        : DIGEST_CONFIG_PADRAO.cadencia,
    destinatarios,
    secoes: {
      encontros: sec?.encontros !== false,
      riscos: sec?.riscos !== false,
      pendencias: sec?.pendencias !== false,
    },
  };
}

/** Lê a row singleton com o cliente do caller (admin no job, sessão no
 *  disparo manual — a policy coord cobre os dois caminhos). Falha de
 *  leitura também cai no padrão: digest atrasado > digest não enviado. */
export async function lerDigestConfig(
  supabase: SupabaseClient
): Promise<DigestConfig> {
  const { data, error } = await supabase
    .from("digest_config")
    .select("dia_semana, cadencia, destinatarios, secoes")
    .eq("id", true);
  if (error) {
    console.error("lerDigestConfig:", error.message);
    return DIGEST_CONFIG_PADRAO;
  }
  return normalizarDigestConfig(data?.[0] ?? null);
}

/** Validação server-side do input da action (plan D10): rejeita o que a
 *  tela deveria ter impedido, com mensagem em pt-BR — o insert nunca vê
 *  dia fora de 0-6, cadência fora do enum, papel fora da equipe, uuid ou
 *  e-mail malformado. */
export function validarDigestConfigInput(input: {
  diaSemana: unknown;
  cadencia: unknown;
  papeis: unknown;
  profiles: unknown;
  emails: unknown;
  secoes: unknown;
}): { ok: true; config: DigestConfig } | { ok: false; error: string } {
  const dia = input.diaSemana;
  if (
    typeof dia !== "number" ||
    !Number.isInteger(dia) ||
    dia < 0 ||
    dia > 6
  ) {
    return { ok: false, error: "Dia da semana inválido." };
  }
  if (
    input.cadencia !== "semanal" &&
    input.cadencia !== "quinzenal" &&
    input.cadencia !== "desligado"
  ) {
    return { ok: false, error: "Frequência inválida." };
  }
  const papeis = listaStr(input.papeis);
  if (papeis.some((p) => !PAPEIS_DIGEST.includes(p as AppRole))) {
    return { ok: false, error: "Papel inválido na lista de destinatários." };
  }
  const profiles = listaStr(input.profiles);
  if (profiles.some((p) => !UUID_RE.test(p))) {
    return { ok: false, error: "Pessoa inválida na lista de destinatários." };
  }
  const emails = [
    ...new Set(
      listaStr(input.emails)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  const ruim = emails.find((e) => !EMAIL_RE.test(e));
  if (ruim) return { ok: false, error: `E-mail inválido: ${ruim}` };
  if (!papeis.length && !profiles.length && !emails.length) {
    // público vazio = digest que não chega a ninguém — quem quer pausar
    // usa a cadência "desligado"
    return {
      ok: false,
      error: "Marque pelo menos um destinatário: papel, pessoa ou e-mail.",
    };
  }

  const sec = (input.secoes ?? {}) as Record<string, unknown>;
  const secoes: DigestSecoes = {
    encontros: sec.encontros !== false,
    riscos: sec.riscos !== false,
    pendencias: sec.pendencias !== false,
  };
  if (!secoes.encontros && !secoes.riscos && !secoes.pendencias) {
    return { ok: false, error: "Marque pelo menos uma seção do digest." };
  }

  return {
    ok: true,
    config: {
      diaSemana: dia,
      cadencia: input.cadencia,
      destinatarios: {
        papeis: papeis as AppRole[],
        profiles: [...new Set(profiles)],
        emails,
      },
      secoes,
    },
  };
}

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
  secoes,
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
  /** Seções ativas na config — ausente = todas (padrão legado). */
  secoes?: DigestSecoes;
}): { assunto: string; conteudoHtml: string; nPendentes: number } {
  const faixa = `${formatDate(semana.seg)} a ${formatDate(semana.dom)}`;
  const assunto = `Digest semanal: ${faixa}`;
  const nPendentes = nLimbo + nAssinaturas + formacoesSemChamada;

  const partes: string[] = [];
  partes.push(
    `<p style="margin:0 0 18px;font-size:15px;line-height:1.55;">` +
      `Semana de <b>${esc(faixa)}</b>: o panorama do ciclo e quem precisa ` +
      `de atenção hoje.</p>`
  );

  if (secoes?.encontros !== false && resumos.length) {
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

  if (secoes?.riscos !== false) {
    partes.push(
      `<h3 style="margin:0 0 8px;font-size:15px;">Duplas em risco (${riscos.length})</h3>`
    );
    if (riscos.length) {
      partes.push(
        `<ul style="margin:0 0 6px;padding-left:20px;font-size:14px;line-height:1.6;">` +
          riscos
            .map((r) => `<li><b>${esc(r.nome)}</b>: ${esc(r.motivo)}</li>`)
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
  }

  if (secoes?.pendencias !== false) {
    partes.push(
      `<h3 style="margin:8px 0 8px;font-size:15px;">Pendências</h3><ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.6;">` +
        `<li>${nLimbo} registro(s) de encontro em aberto</li>` +
        `<li>${nAssinaturas} assinatura(s) vencendo em até 14 dias</li>` +
        `<li>${formacoesSemChamada} formação(ões) da semana sem chamada</li>` +
        `</ul>`
    );
  }

  return { assunto, conteudoHtml: partes.join(""), nPendentes };
}

/** Monta o digest sobre o cliente passado (admin no job, sessão no
 *  disparo manual — a coordenação lê tudo pela RLS nos dois caminhos).
 *  `semana` é a janela que o e-mail cobre; `agora` ancora semáforo/limbo;
 *  `config` é a digest_config — quem não passa recebe a leitura da row
 *  (ou o padrão quando ela não existe). */
export async function montarDigestSemanal(
  supabase: SupabaseClient,
  semana: SemanaDigest,
  agora = new Date(),
  config?: DigestConfig
): Promise<DigestSemanal> {
  const cfg = config ?? (await lerDigestConfig(supabase));
  const segunda = new Date(`${semana.seg}T12:00:00Z`);
  const limiteAssinatura = new Date(
    agora.getTime() + 14 * 86400000
  ).toISOString();

  const vazio = { data: [], error: null };
  const [dRes, eRes, cRes, aRes, pRes, iRes, fRes] = await Promise.all([
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
    cfg.destinatarios.papeis.length
      ? supabase
          .from("profiles")
          .select("id, profile_papeis!inner(papel)")
          .in("profile_papeis.papel", cfg.destinatarios.papeis)
          .eq("ativo", true)
      : Promise.resolve(vazio),
    cfg.destinatarios.profiles.length
      ? supabase
          .from("profiles")
          .select("id")
          .in("id", cfg.destinatarios.profiles)
          .eq("ativo", true)
      : Promise.resolve(vazio),
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
  if (iRes.error) throw iRes.error;
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
    // a régua do limbo é por dupla (018): o mapa de cobertos só existe
    // dentro da lista da própria dupla — o flat não pode misturar
    .flatMap((d) => {
      const cobertos = cobertosDaDupla(d.encontros);
      return d.encontros.filter((e) => emLimbo(e, agoraMs, cobertos));
    }).length;

  const formacoesSemChamada = (fRes.data ?? []).filter(
    (f) =>
      ((f.presencas as { count: number }[] | null)?.[0]?.count ?? 0) === 0
  ).length;

  // audiência configurada (451): união com dedup de papéis efetivos +
  // profiles individuais (ambos ativos, e-mail via profiles_contato) +
  // endereços explícitos. Mesmo molde do dispararParaRoles.
  const ids = new Set<string>([
    ...(pRes.data ?? []).map((p) => p.id),
    ...(iRes.data ?? []).map((p) => p.id),
  ]);
  const para = new Set<string>(cfg.destinatarios.emails);
  if (ids.size) {
    const { data: contatos } = await supabase
      .from("profiles_contato")
      .select("id, email")
      .in("id", [...ids])
      .not("email", "is", null);
    for (const c of contatos ?? []) {
      if (c.email) para.add(c.email);
    }
  }

  const { assunto, conteudoHtml, nPendentes } = corpoDigestSemanal({
    semana,
    resumos,
    riscos,
    nAtencao,
    nLimbo,
    nAssinaturas: aRes.count ?? 0,
    formacoesSemChamada,
    secoes: cfg.secoes,
  });

  const preheader =
    [
      cfg.secoes.riscos ? `${riscos.length} em risco` : null,
      cfg.secoes.pendencias ? `${nPendentes} pendência(s)` : null,
    ]
      .filter(Boolean)
      .join(" · ") ||
    `Panorama de ${formatDate(semana.seg)} a ${formatDate(semana.dom)}`;

  const html = emailLayout({
    titulo: "Digest semanal",
    tagline: "Programa de Mentoria",
    preheader,
    conteudoHtml,
    ctaLabel: "Abrir relatórios",
    // o panorama do digest mora na subpágina operacional desde a 375 —
    // /relatorios abre direto na grade livre
    ctaHref: `${SITE_URL}/relatorios/operacionais`,
  });

  return {
    assunto,
    mensagens: [...para].map((to) => ({ to, subject: assunto, html })),
    // o log registra os papéis configurados; "lista_direta" marca
    // destinatário fora de papel (profile individual ou e-mail explícito)
    audiencia: [
      ...cfg.destinatarios.papeis,
      ...(cfg.destinatarios.profiles.length || cfg.destinatarios.emails.length
        ? ["lista_direta"]
        : []),
    ],
    nRisco: riscos.length,
    nPendentes,
  };
}
