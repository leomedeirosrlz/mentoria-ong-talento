// Fila de espera "Aguardando par" (REALIZA-101) — derivação pura, sem
// tabela nova: a fila é o recorte ao vivo de mentorados inscritos sem
// nenhuma dupla no histórico + mentores ativos com vaga livre. O contexto
// que o board "Livres para dupla" não tinha (tempo de espera, origem,
// contato) mora aqui.

import { comparaNome, foraDoPrograma } from "./ciclo";
import { temPapel } from "./types";
import type { Mentorado, MentorProfile, Profile, Trilha } from "./types";

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
};

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
 *  importação da planilha.
 *
 *  `disponivelDesde` é o carimbo da última vez que a pessoa voltou a ficar
 *  disponível (ver disponivelDesdePorId) — a espera ATUAL de quem sai de
 *  uma dupla começa na saída, não na entrada original no programa: sem o
 *  max() o "há N dias" contava o programa inteiro pra quem re-pareia. */
export function esperaDesde(
  p: {
    consent_lgpd_em?: string | null;
    created_at?: string | null;
    form_bruto?: Record<string, unknown> | null;
  },
  disponivelDesde?: string | null
): string | null {
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
  const disp = disponivelDesde ? Date.parse(disponivelDesde) : NaN;
  if (!Number.isNaN(disp) && (melhor === null || disp > melhor)) melhor = disp;
  return melhor === null ? null : new Date(melhor).toISOString();
}

/** Subset de duplas que a derivação de disponibilidade lê — o resumo que
 *  getDuplasResumoTodas busca. `created_at`/`remanejada_de` cobrem o
 *  fechamento sem carimbo próprio (o rematch não grava encerrada_em em
 *  DPP: a sucessora nasce no mesmo instante em que a anterior fecha). */
export type DuplaFecho = {
  id: string;
  mentor_id: string;
  mentorado_id: string;
  status?: string | null;
  trilha?: string | null;
  created_at?: string | null;
  encerrada_em?: string | null;
  concluida_em?: string | null;
  desfecho_em?: string | null;
  remanejada_de?: string | null;
};

const parseMs = (v: string | null | undefined): number | null => {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};

/** id de pessoa (profile OU mentorado) → ISO da disponibilidade mais
 *  recente: quando a última dupla DPP dela fechou. A fila é DPP — a
 *  trilha de especialista nunca ocupou vaga nela, então o fechamento de
 *  uma esp não recomeça a espera DPP.
 *
 *  Carimbo do fechamento, na ordem de confiança:
 *   - os carimbos "do fato" — concluida_em (trigger do status),
 *     encerrada_em (fechamento de trilha esp / rematch esp), a sucessora
 *     criada no rematch (remanejada_de: a fechada por remanejo não grava
 *     carimbo próprio, mas a nova dupla nasce na mesma transação) e o
 *     rito (encerramentos.created_at — a row nasce na decisão ou, quando
 *     'pendente' já existia, no último encontro: o fim de fato da jornada;
 *     o insert antecipado por autoavaliação morreu em 0128)
 *   - desfecho_em só quando nenhum existe: é o carimbo do REGISTRO, que
 *     uma edição tardia do desfecho sobrescreve — usá-lo por cima dos
 *     outros moveria a espera pra data do ajuste, não do fechamento.
 *
 *  Sem nenhum carimbo a pessoa não entra no mapa (a espera cai na entrada
 *  original — comportamento anterior). */
export function disponivelDesdePorId(
  duplas: readonly DuplaFecho[],
  encerramentos: readonly { dupla_id: string; created_at: string | null }[] = []
): Record<string, string> {
  const sucessoraDe = new Map(
    duplas.flatMap((d) => (d.remanejada_de ? [[d.remanejada_de, d] as const] : []))
  );
  const ritoDe = new Map(encerramentos.map((e) => [e.dupla_id, e.created_at]));
  const mapa: Record<string, number> = {};
  const marca = (id: string, t: number | null) => {
    if (t === null) return;
    if (!(id in mapa) || t > mapa[id]) mapa[id] = t;
  };
  for (const d of duplas) {
    if (d.trilha === "especialista") continue;
    if (d.status !== "encerrada" && d.status !== "concluida") continue;
    // carimbos do fato primeiro; desfecho_em (carimbo do registro) só sobra
    const exato = [
      parseMs(d.concluida_em),
      parseMs(d.encerrada_em),
      parseMs(sucessoraDe.get(d.id)?.created_at),
      parseMs(ritoDe.get(d.id)),
    ].reduce<number | null>(
      (m, t) => (t !== null && (m === null || t > m) ? t : m),
      null
    );
    const fecho = exato ?? parseMs(d.desfecho_em);
    marca(d.mentor_id, fecho);
    marca(d.mentorado_id, fecho);
  }
  return Object.fromEntries(
    Object.entries(mapa).map(([id, t]) => [id, new Date(t).toISOString()])
  );
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
 *  marca concluinte, saída ou remanejo, não espera. Quem saiu do programa
 *  (situacao ≠ 'ativo', 0077) também fica de fora — desistente não é
 *  espera nem quando nunca pareou. Re-entrar na fila é decisão manual:
 *  reativar o cadastro devolve a pessoa pra cá. */
export function filaMentorados(
  mentorados: Mentorado[],
  ocupados: ReadonlySet<string>,
  historico: ReadonlySet<string>,
  disponivelDesde: Record<string, string> = {}
): FilaItem[] {
  return mentorados
    .filter(
      (m) => !ocupados.has(m.id) && !historico.has(m.id) && !foraDoPrograma(m)
    )
    .map((m) => ({
      id: m.id,
      // nome de exibição — o social quando existe, como no resto do app
      nome: m.nome_social ?? m.nome,
      avatar_path: m.avatar_path,
      whatsapp: m.whatsapp,
      origem: m.ong_origem ?? m.origem ?? null,
      desde: esperaDesde(m, disponivelDesde[m.id]),
    }))
    .sort(porEspera);
}

/** Teto de vagas do mentor = a pool da trilha pedida (0073) — especialista
 *  conta contra capacidade_especialista, DPP contra capacidade. Sem linha
 *  em mentor_profiles vale 1, a mesma régua do trigger check_mentor_capacidade.
 *  Sem `trilha` explícita cai na do papel primário (o comportamento antigo;
 *  quem decide pool passa a trilha — WP6b, o híbrido tem as duas). */
export function tetoMentor(
  p: Pick<Profile, "role" | "papeis">,
  mp: MentorProfile | undefined,
  trilha?: Trilha
): number {
  const t =
    trilha ?? (p.role === "mentor_especialista" ? "especialista" : "dpp");
  return t === "especialista"
    ? (mp?.capacidade_especialista ?? 1)
    : (mp?.capacidade ?? 1);
}

/** Mentores com vaga livre — a reserva proposital do programa: sem dupla
 *  nenhuma OU com capacidade acima das ativas/pausadas (`contagem`). Sem
 *  linha em mentor_profiles vale capacidade 1, a mesma régua do
 *  createDupla/PessoaRow. Inativa (ativo=false = saiu do programa) não
 *  aparece — a reserva é de quem ficou. Mentor de volta de dupla
 *  encerrada conta normal: reserva não exige histórico zerado.
 *
 *  Só a pool DPP conta (2026-02): especialista não "aguarda par" — é
 *  capacidade sob demanda acionada pelo mural, não obrigação de parear.
 *  O híbrido aparece pelo papel DPP, medido só na pool DPP. */
export function filaMentores(
  pessoas: Profile[],
  mentorProfiles: Record<string, MentorProfile>,
  contagem: Record<string, number>,
  disponivelDesde: Record<string, string> = {}
): FilaItem[] {
  const itens: FilaItem[] = [];
  for (const p of pessoas) {
    if (!p.ativo || !temPapel(p, "mentor_dpp")) continue;
    const teto = tetoMentor(p, mentorProfiles[p.id], "dpp");
    const usadas = contagem[`${p.id}:dpp`] ?? 0;
    if (teto - usadas <= 0) continue;
    itens.push({
      id: p.id,
      nome: p.nome_social ?? p.nome,
      avatar_path: p.avatar_path,
      whatsapp: p.whatsapp,
      origem: p.origem ?? null,
      desde: esperaDesde(p, disponivelDesde[p.id]),
      vagas: teto - usadas,
    });
  }
  return itens.sort(porEspera);
}
