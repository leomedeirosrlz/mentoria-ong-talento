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

  const data = !dataOk(input.dataPasso)
    ? min
    : input.dataPasso < min
      ? min
      : max && input.dataPasso > max
        ? max
        : input.dataPasso;

  const livre = sugerirHorarios({
    data,
    perfil: input.perfil ?? perfilVazio(),
    disponibilidade: input.disponibilidade,
    ocupados: input.ocupados,
    duracaoMin: input.duracaoMin,
  }).find((h) => !h.conflito);

  return { data, hora: livre?.hora ?? "19:00", min, max };
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
