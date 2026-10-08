// Fila de espera "Aguardando par" (REALIZA-101) — derivação pura, sem
// tabela nova: a fila é o recorte ao vivo de mentorados inscritos sem
// nenhuma dupla no histórico + mentores ativos com vaga livre. O contexto
// que o board "Livres para dupla" não tinha (tempo de espera, origem,
// contato) mora aqui.

import { comparaNome } from "./ciclo";
import type { Mentorado, MentorProfile, Profile } from "./types";

/** Item da fila — o mínimo pra linha: quem é, de onde veio, desde quando
 *  espera e como chamar no WhatsApp. */
export type FilaItem = {
  id: string;
  nome: string;
  avatar_path: string | null | undefined;
  whatsapp: string | null;
  /** Como a pessoa chegou — ONG do jovem, canal de origem do voluntário. */
  origem: string | null;
  /** ISO do começo da espera (ver esperaDesde); null = sem carimbo confiável. */
  desde: string | null;
  /** Só mentor: vagas livres agora (capacidade − duplas ativas/pausadas). */
  vagas?: number;
  /** Só mentor: trilha — especialista pareja pelo mural, não pelo board. */
  trilha?: "dpp" | "especialista";
};

const ehMentor = (p: Profile) =>
  p.role === "mentor_dpp" || p.role === "mentor_especialista";

/** "Carimbo de data/hora" do Google Forms dentro de form_bruto — o intake
 *  (transformar-intake.py) guarda o valor cru da coluna: serial Excel
 *  ("46256.667…") ou texto "dd/mm/aaaa hh:mm[:ss]"; ISO já-parseado também
 *  passa. Formatos fora desses devolvem null em vez de chutar uma data —
 *  fila ordenada por data inventada mente pior que fila sem data. */
export function carimboFormBruto(
  formBruto: Record<string, unknown> | null | undefined
): string | null {
  const v = formBruto?.["Carimbo de data/hora"];
  if (typeof v !== "string" && typeof v !== "number") return null;
  const s = String(v).trim();
  if (!s) return null;
  // serial Excel: dias desde 1899-12-30 — mesma época do carimbo_iso do intake
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const ms = Date.UTC(1899, 11, 30) + parseFloat(s) * 86_400_000;
    return new Date(ms).toISOString();
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (m) {
    const [, dd, mm, yyyy, hh = "0", mi = "0", ss = "0"] = m;
    const d = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(mi),
      Number(ss)
    );
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  // dígitos puros fora do range de serial não são data — Date.parse("123")
  // aceitaria como ano 123 e a fila ganharia uma espera de milênios
  if (/^\d+$/.test(s)) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Início da espera = o carimbo mais antigo que existir. A inscrição chega
 *  por dois caminhos: em profiles o carimbo do form já vem convertido em
 *  `consent_lgpd_em`; em mentorados ele fica cru em form_bruto (a tabela
 *  não tem coluna de consentimento). `created_at` cobre o cadastro manual
 *  (sem form) — e, sendo a primeira presença da pessoa no sistema, também
 *  vale pro pré-cadastro feito antes do consentimento. Por isso o mínimo
 *  dos três: quem chegou pelo formulário conta desde o envio, não desde a
 *  importação da planilha. */
export function esperaDesde(p: {
  consent_lgpd_em?: string | null;
  created_at?: string | null;
  form_bruto?: Record<string, unknown> | null;
}): string | null {
  let melhor: number | null = null;
  for (const f of [
    p.consent_lgpd_em,
    carimboFormBruto(p.form_bruto),
    p.created_at,
  ]) {
    if (!f) continue;
    const t = Date.parse(f);
    if (Number.isNaN(t)) continue;
    if (melhor === null || t < melhor) melhor = t;
  }
  return melhor === null ? null : new Date(melhor).toISOString();
}

/** "há N dias" da espera — granularidade de dia (a fila não mede em horas
 *  como o tempoRelativo do feed). `agoraMs` injetado pelo chamador pra não
 *  divergir SSR × hidratação; carimbo no futuro (relógio torto) vira "hoje". */
export function textoEspera(desdeIso: string, agoraMs: number): string {
  const dias = Math.max(
    0,
    Math.floor((agoraMs - new Date(desdeIso).getTime()) / 86_400_000)
  );
  if (dias === 0) return "hoje";
  return dias === 1 ? "há 1 dia" : `há ${dias} dias`;
}

/** Mais antigo primeiro — a fila é uma promessa por ordem de chegada. Sem
 *  carimbo vai pro fim (e desempata por nome pra ordem ficar estável). */
const porEspera = (a: FilaItem, b: FilaItem) =>
  (a.desde ? Date.parse(a.desde) : Infinity) -
    (b.desde ? Date.parse(b.desde) : Infinity) ||
  comparaNome(a.nome, b.nome);

/** Mentorados aguardando o primeiro par. `ocupados` = quem ocupa vaga
 *  (dupla ativa|pausada); `historico` = qualquer dupla, até encerrada. A
 *  fila é de quem NUNCA teve par — dupla concluída/encerrada no histórico
 *  marca concluinte, saída ou remanejo, não espera (o cadastro de
 *  mentorado não tem flag de desistência: o sinal disponível é justamente
 *  "já teve dupla"). Re-entrar na fila é decisão manual — a pessoa segue
 *  visível no chip "Livres para dupla". */
export function filaMentorados(
  mentorados: Mentorado[],
  ocupados: ReadonlySet<string>,
  historico: ReadonlySet<string>
): FilaItem[] {
  return mentorados
    .filter((m) => !ocupados.has(m.id) && !historico.has(m.id))
    .map((m) => ({
      id: m.id,
      nome: m.nome,
      avatar_path: m.avatar_path,
      whatsapp: m.whatsapp,
      origem: m.ong_origem ?? m.origem ?? null,
      desde: esperaDesde(m),
    }))
    .sort(porEspera);
}

/** Mentores com vaga livre — a reserva proposital do programa: sem dupla
 *  nenhuma OU com capacidade acima das ativas/pausadas (`contagem`). Sem
 *  linha em mentor_profiles vale capacidade 1, a mesma régua do
 *  createDupla/PessoaRow. Inativa (ativo=false = saiu do programa) não
 *  aparece — a reserva é de quem ficou. Mentor de volta de dupla
 *  encerrada conta normal: reserva não exige histórico zerado. */
export function filaMentores(
  pessoas: Profile[],
  mentorProfiles: Record<string, MentorProfile>,
  contagem: Record<string, number>
): FilaItem[] {
  return pessoas
    .filter((p) => {
      if (!ehMentor(p) || !p.ativo) return false;
      const capacidade = mentorProfiles[p.id]?.capacidade ?? 1;
      return capacidade - (contagem[p.id] ?? 0) > 0;
    })
    .map((p) => {
      const capacidade = mentorProfiles[p.id]?.capacidade ?? 1;
      return {
        id: p.id,
        nome: p.nome,
        avatar_path: p.avatar_path,
        whatsapp: p.whatsapp,
        origem: p.origem ?? null,
        desde: esperaDesde(p),
        vagas: capacidade - (contagem[p.id] ?? 0),
        trilha: (p.role === "mentor_especialista"
          ? "especialista"
          : "dpp") as "dpp" | "especialista",
      };
    })
    .sort(porEspera);
}
