import { DIAS_SEMANA } from "./ciclo";
import {
  sugerirDatas,
  sugerirHorarios,
  type PerfilEncontros,
  type SugestaoData,
} from "./sugestoes-encontro";
import type { DiaSemana, Disponibilidade } from "./types";

// ---------- sugestão por passo do combinado (REALIZA-482) ----------
// A mesma régua do agendar aplicada a UM passo do plano: a data já foi
// combinada na proposta (data do passo primeiro), o horário vem do
// hábito/grade com 19:00 de padrão, e a janela do plano limita o que o
// input de data aceita — mesma fronteira que a RPC aplica no banco.

export type SugestaoPasso = {
  /** "YYYY-MM-DD" — a data do passo clampada na janela. */
  data: string;
  /** "HH:mm" — primeiro horário livre do dia, senão 19:00. */
  hora: string;
  /** min do input de data: hoje ou o início da janela, o que for depois. */
  min: string;
  /** max do input: o fim da janela (null sem janela). */
  max: string | null;
};

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const dataOk = (s: string | null | undefined): s is string =>
  typeof s === "string" && DATA_RE.test(s);

const DIA_MS = 86_400_000;
/** +N dias civis pela âncora de meio-dia UTC — nunca muda por fuso. */
const addDia = (iso: string, dias = 1): string =>
  new Date(new Date(`${iso}T12:00:00Z`).getTime() + dias * DIA_MS)
    .toISOString()
    .slice(0, 10);
/** Teto da varredura por horário livre quando não há janela — a mesma
 *  régua do motor (120 dias bastam pra qualquer lista de ocupados real). */
const HORIZONTE_SEM_JANELA = 120;

/** Sem histórico carregado (ficha staff sem sugestões, por exemplo) —
 *  o motor cai no padrão: dias úteis, 19:00/19:30/20:00. */
const perfilVazio = (): PerfilEncontros => ({
  total: 0,
  porDia: Object.fromEntries(DIAS_SEMANA.map((d) => [d, 0])) as Record<
    DiaSemana,
    number
  >,
  porHora: [],
  duracaoMedianaMin: null,
  ultimo: null,
});

export type InputPasso = {
  /** Data combinada do passo ("YYYY-MM-DD"). */
  dataPasso: string;
  /** Hoje civil no fuso do programa. */
  hoje: string;
  /** Janela do combinado — restrição dura quando existe. */
  janela?: { inicio: string; fim: string } | null;
  perfil?: PerfilEncontros | null;
  disponibilidade?: Disponibilidade | null;
  /** Instantes ISO já ocupados do jovem (todas as trilhas). */
  ocupados?: readonly string[] | null;
  duracaoMin?: number | null;
};

/** A sugestão pré-preenchida da linha do passo — null quando a janela já
 *  fechou (min depois do fim): aí a linha não promete gesto que o banco
 *  recusaria. */
export function sugestaoPasso(input: InputPasso): SugestaoPasso | null {
  if (!dataOk(input?.hoje)) return null;
  const jan =
    input.janela && dataOk(input.janela.inicio) && dataOk(input.janela.fim)
      ? input.janela
      : null;
  const min = jan && jan.inicio > input.hoje ? jan.inicio : input.hoje;
  const max = jan ? jan.fim : null;
  if (max && min > max) return null;

  const perfil = input.perfil ?? perfilVazio();
  // dia cheio não pode prometer o instante que os ocupados desmentem: a
  // varredura anda até achar um dia com horário livre — o que dois passos
  // clampados no mesmo `min` precisam pra não sugerir o mesmo instante
  let data = !dataOk(input.dataPasso)
    ? min
    : input.dataPasso < min
      ? min
      : max && input.dataPasso > max
        ? max
        : input.dataPasso;
  const teto = max ?? addDia(data, HORIZONTE_SEM_JANELA);
  while (data <= teto) {
    const livre = sugerirHorarios({
      data,
      perfil,
      disponibilidade: input.disponibilidade,
      ocupados: input.ocupados,
      duracaoMin: input.duracaoMin,
    }).find((h) => !h.conflito);
    if (livre) return { data, hora: livre.hora, min, max };
    data = addDia(data);
  }
  // janela inteira sem horário livre — o null vale "não promete gesto",
  // como a janela fechada
  return null;
}

/** Os chips de dia do "Outra data" de um passo — a data combinada dele
 *  primeiro (o motor a trata como dataSugerida), depois os dias viáveis
 *  na janela no ritmo do combinado. */
export function datasDoPasso(
  input: InputPasso & { ritmo?: number | null; limite?: number }
): SugestaoData[] {
  if (!dataOk(input?.hoje)) return [];
  return sugerirDatas({
    agora: new Date(`${input.hoje}T12:00:00-03:00`),
    perfil: input.perfil ?? perfilVazio(),
    janela: input.janela,
    ritmo: input.ritmo,
    dataSugerida: input.dataPasso,
    disponibilidade: input.disponibilidade,
    ocupados: input.ocupados,
    duracaoMin: input.duracaoMin,
    limite: input.limite ?? 5,
  });
}

// ---------- o combinado persistido, do jeito que as telas leem (513) ----------
// Uma régua só pra ficha, agenda do jovem e os banners das duas homes:
// quem ainda falta aceitar, quantos passos já têm data e qual é o próximo.

/** O que as superfícies precisam do plano persistido: a projeção mínima
 *  comum ao embed da ficha (DuplaPlano) e ao recorte do jovem
 *  (jovem_plano). */
export type PlanoCombinado = {
  id: string;
  status: string;
  versao: number;
  aprovado_lado: "mentor" | "mentorado" | null;
  /** Os dois aceites (0224). Ausente = leitura antiga: vale o
   *  `aprovado_lado`. */
  aceites?: { mentor: boolean; mentorado: boolean } | null;
  /** Janela do combinado: no topo no recorte do jovem; na ficha chega
   *  via escopo.janela (os dois formatos valem). */
  janela?: { inicio: string; fim: string } | null;
  escopo?: {
    ritmo?: number | null;
    janela?: { inicio: string; fim: string } | null;
    passos?: {
      numero: number;
      data: string;
      acao?: string;
      /** Marca de sessão combinada (018) — mesmo valor = mesma sessão. */
      sessao?: string;
      /** Duração da sessão combinada em min (120 = 2h, o padrão). */
      duracao_min?: number;
    }[];
  } | null;
  passos?: { numero: number; data_nova: string }[];
  proposto_em?: string | null;
  /** "app" | "liza" — a copy da proposta da equipe diz quem pediu. */
  proposto_via?: string | null;
  expira_em?: string | null;
  concluido_em?: string | null;
};

export const PLANO_ABERTO = ["proposto", "aceito", "ativo"] as const;

export const planoAberto = (status: string) =>
  (PLANO_ABERTO as readonly string[]).includes(status);

/** Grupos de sessão combinada marcados no escopo (018): passos com a
 *  mesma letra `sessao` dividem uma sessão só. Devolve só grupos com
 *  2+ membros, ordenados por número — o primeiro é a âncora, onde a
 *  aplicação carimba o gesto e o registro mora. */
export function sessoesDoEscopo(
  passos: readonly { numero: number; sessao?: string | null }[]
): Map<string, number[]> {
  const g = new Map<string, number[]>();
  for (const p of passos) {
    if (!p.sessao) continue;
    const l = g.get(p.sessao) ?? [];
    l.push(p.numero);
    g.set(p.sessao, l);
  }
  for (const [k, nums] of g) {
    if (nums.length < 2) g.delete(k);
    else nums.sort((a, b) => a - b);
  }
  return g;
}

/** "6º e 7º" / "6º, 7º e 8º" — a lista curta dos encontros de um grupo
 *  nas linhas e nas descrições. */
export function listaEncontros(numeros: readonly number[]): string {
  const l = numeros.map((n) => `${n}º`);
  if (l.length <= 2) return l.join(" e ");
  return `${l.slice(0, -1).join(", ")} e ${l.at(-1)}`;
}

/** "na mesma sessão do 6º" / "na mesma sessão dos 6º e 7º" — a leitura
 *  da marca na linha do passo, no combinado e na projeção. */
export function rotuloSessao(
  numero: number,
  grupo: readonly number[]
): string {
  const outros = grupo.filter((n) => n !== numero);
  if (outros.length === 1) return `na mesma sessão do ${outros[0]}º`;
  return `na mesma sessão dos ${listaEncontros(outros)}`;
}

/** O "avisado em" / âncora da janela de contestação — a mesma régua do
 *  banco (`coalesce(aprovado_em, created_at)` da plano_responder) em
 *  todas as superfícies. Aceita a row da ficha (created_at) e o recorte
 *  do jovem (a RPC entrega created_at como proposto_em + aprovado_em da
 *  0232); num banco sem a coluna nova vale o campo que existir. */
export function propostoEmDoPlano(
  p: {
    aprovado_em?: string | null;
    created_at?: string | null;
    proposto_em?: string | null;
  } | null
): string | null {
  return p?.aprovado_em ?? p?.created_at ?? p?.proposto_em ?? null;
}

/** Recorte da RPC jovem_plano → a projeção que os cards e os banners
 *  leem. A RPC já devolve sem semáforo/motivos; aqui só muda a forma
 *  (ritmo vem texto do jsonb, passos aplicados achatam, os aceites
 *  viram o par). Parâmetro estrutural: a lib não conhece queries. */
export function combinadoDoJovem(p: {
  id: string;
  status: string;
  versao: number;
  ritmo?: string | number | null;
  janela?: { inicio: string; fim: string } | null;
  passos?:
    | {
        numero: number;
        data: string;
        acao?: string;
        sessao?: string;
        duracao_min?: number;
      }[]
    | null;
  aprovado_lado: "mentor" | "mentorado" | null;
  aceito_mentor?: boolean;
  aceito_mentorado?: boolean;
  proposto_em?: string;
  aprovado_em?: string | null;
  proposto_via?: string | null;
  expira_em?: string;
  concluido_em?: string | null;
  passos_aplicados?: { numero: number; data_nova: string }[] | null;
}): PlanoCombinado {
  return {
    id: p.id,
    status: p.status,
    versao: p.versao,
    aprovado_lado: p.aprovado_lado,
    aceites:
      p.aceito_mentor != null || p.aceito_mentorado != null
        ? {
            mentor: p.aceito_mentor === true,
            mentorado: p.aceito_mentorado === true,
          }
        : undefined,
    janela: p.janela ?? null,
    escopo: {
      ritmo: p.ritmo == null ? null : Number(p.ritmo) || null,
      passos: (p.passos ?? []).map((s) => ({
        numero: s.numero,
        data: s.data,
        acao: s.acao,
        sessao: s.sessao,
        duracao_min: s.duracao_min,
      })),
    },
    passos: (p.passos_aplicados ?? []).map((s) => ({
      numero: s.numero,
      data_nova: s.data_nova,
    })),
    proposto_em: propostoEmDoPlano(p),
    proposto_via: p.proposto_via ?? null,
    expira_em: p.expira_em ?? null,
    concluido_em: p.concluido_em ?? null,
  };
}

/** Deriva os dois aceites de uma row de dupla_planos (embed da ficha ou
 *  projeção equivalente): os carimbos da 0224 quando existem; num banco
 *  sem a migration vale o `aprovado_lado` da 0219. */
export function aceitesDoPlano(p: {
  aprovado_lado: "mentor" | "mentorado" | null;
  aceito_mentor_em?: string | null;
  aceito_mentorado_em?: string | null;
}): { mentor: boolean; mentorado: boolean } {
  return {
    mentor: p.aceito_mentor_em != null || p.aprovado_lado === "mentor",
    mentorado: p.aceito_mentorado_em != null || p.aprovado_lado === "mentorado",
  };
}

export type PassoCombinado = {
  numero: number;
  /** data combinada na proposta */
  data: string;
  /** feito = encontro realizado; marcado = a dupla já confirmou a data */
  estado: "feito" | "marcado" | "pendente";
  /** ISO da data confirmada (passo aplicado) */
  marcadoEm: string | null;
};

/** A leitura do plano por quem abre a tela (518 — REALIZA-518, copy da
 *  spec): um aceite da dupla ativa, então "falta o seu" só existe pra
 *  proposta que ainda espera a dupla; o outro lado de um plano ativo foi
 *  avisado, não "ficou devendo aceite". */
export type EstadoLeituraPlano =
  /** equipe propôs e falta um aceite da dupla — o seu pode ser o único */
  | "proposto_staff_falta_meu"
  /** proposta esperando a dupla, do lado de quem não responde (staff ou
   *  o lado que já carimbou num legado bilateral) */
  | "proposto_staff_falta_outro"
  /** combinado em vigor sem o seu carimbo — você foi avisado */
  | "ativo_sem_minha_ciencia"
  | "ativo"
  | "contestado";

/** Deriva a leitura do plano persistido pra quem abre a superfície —
 *  régua única da ficha, das homes e da agenda do jovem. `meuLado` null =
 *  equipe (staff não assina aceite). Status fora do aberto (concluido,
 *  expirado) devolve null — o combinado não pede nada. */
export function estadoLeituraPlano(input: {
  status: string;
  meuLado: "mentor" | "mentorado" | null;
  aceites: { mentor: boolean; mentorado: boolean };
}): EstadoLeituraPlano | null {
  if (input.status === "contestado") return "contestado";
  if (input.status === "proposto") {
    if (input.meuLado == null) return "proposto_staff_falta_outro";
    return input.aceites[input.meuLado]
      ? "proposto_staff_falta_outro"
      : "proposto_staff_falta_meu";
  }
  if (input.status === "aceito" || input.status === "ativo") {
    if (input.meuLado != null && !input.aceites[input.meuLado])
      return "ativo_sem_minha_ciencia";
    return "ativo";
  }
  return null;
}

/** Contestação ainda vale? (519) A RPC mede `realizado_em >= aprovado_em`
 *  no escopo; a tela aproxima por "nenhum nº do escopo realizado" — passo
 *  já realizado não entra no escopo da proposta (a RPC recusa), então
 *  qualquer realizado aí aconteceu depois do combinado. O botão de
 *  contestar some junto com a janela real em vez de prometer o que o
 *  banco recusa. */
export function planoContestavel(
  escopoPassos: readonly { numero: number }[] | null | undefined,
  realizados: readonly number[]
): boolean {
  return !(escopoPassos ?? []).some((p) => realizados.includes(p.numero));
}

export type ResumoCombinado = {
  aberto: boolean;
  /** status cru do plano — a máquina de leitura (estadoLeituraPlano)
   *  precisa dele com o lado de quem lê */
  status: string;
  /** quando a proposta nasceu — "você foi avisado em X" do plano ativo */
  propostoEm: string | null;
  aceites: { mentor: boolean; mentorado: boolean };
  /** Quem ainda precisa aceitar. Só existe em `proposto`; "dupla" =
   *  nenhum lado carimbou (proposta da equipe esperando a dupla). */
  falta: "mentor" | "mentorado" | "dupla" | null;
  passos: PassoCombinado[];
  total: number;
  /** passos com data confirmada ou já feitos */
  marcados: number;
  feitos: number;
  /** o primeiro passo ainda sem data confirmada */
  proximo: PassoCombinado | null;
  /** a última data combinada: é quando a dupla volta pro calendário */
  ate: string | null;
};

export function resumoCombinado(
  plano: PlanoCombinado,
  /** números de encontro já realizados da dupla (a ficha tem; o jovem
   *  passa os dele) */
  realizados: readonly number[] = []
): ResumoCombinado {
  const aceites = plano.aceites ?? {
    mentor: plano.aprovado_lado === "mentor",
    mentorado: plano.aprovado_lado === "mentorado",
  };
  const falta =
    plano.status !== "proposto"
      ? null
      : !aceites.mentor && !aceites.mentorado
        ? "dupla"
        : !aceites.mentor
          ? "mentor"
          : !aceites.mentorado
            ? "mentorado"
            : null;
  const aplicados = new Map(
    (plano.passos ?? []).map((p) => [p.numero, p.data_nova])
  );
  const feitosSet = new Set(realizados);
  const passos: PassoCombinado[] = [...(plano.escopo?.passos ?? [])]
    .sort((a, b) => a.numero - b.numero)
    .map((p) => ({
      numero: p.numero,
      data: p.data,
      estado: feitosSet.has(p.numero)
        ? "feito"
        : aplicados.has(p.numero)
          ? "marcado"
          : "pendente",
      marcadoEm: aplicados.get(p.numero) ?? null,
    }));
  const datas = passos.map((p) => p.data).filter(dataOk).sort();
  return {
    aberto: planoAberto(plano.status),
    status: plano.status,
    propostoEm: plano.proposto_em ?? null,
    aceites,
    falta,
    passos,
    total: passos.length,
    marcados: passos.filter((p) => p.estado !== "pendente").length,
    feitos: passos.filter((p) => p.estado === "feito").length,
    proximo: passos.find((p) => p.estado === "pendente") ?? null,
    ate: datas.at(-1) ?? null,
  };
}

const DOW_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

/** "2026-11-24" → "ter 24/11": a data curta das linhas do plano (âncora
 *  de meio-dia UTC, não vira de fuso). */
export function diaCurto(iso: string): string {
  if (!dataOk(iso)) return iso;
  const dow = DOW_CURTO[new Date(`${iso}T12:00:00Z`).getUTCDay()];
  return `${dow} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** "2026-11-24" → "24/11". */
export const diaMes = (iso: string) =>
  dataOk(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : iso;
