import { celulasComuns, celulasDe, toDateStr } from "./ciclo";
import { disponibilidadesDaDupla } from "./actions";
import type { Disponibilidade } from "./types";
import {
  perfilDeEncontros,
  sugerirDatas,
  type EncontroHistorico,
  type PerfilEncontros,
  type SugestaoData,
} from "./sugestoes-encontro";

// ---------- adaptador server-side (REALIZA-480) ----------
// Monta os inputs do motor puro a partir de dados que o render já
// carregou — encontros e plano chegam por parâmetro, nenhum fetch novo
// no render. A única leitura extra é disponibilidadesDaDupla, que já
// aplica o escopo da RLS e devolve vazio quando o chamador não alcança a
// dupla; o adaptador nunca abre profiles/mentor_profiles direto.

/** O formato mínimo de plano que o adaptador lê — JovemPlano e o
 *  DuplaPlano da ficha satisfazem estruturalmente, então os dois lados
 *  da agenda alimentam o mesmo motor. */
export type PlanoParaSugestao = {
  ritmo?: string | number | null;
  janela?: { inicio: string; fim: string } | null;
  passos?: { numero: number; data: string }[] | null;
  passos_aplicados?: { numero: number }[] | null;
};

export type SugestoesEncontro = {
  perfil: PerfilEncontros;
  datas: SugestaoData[];
  /** Grade combinada dos dois lados (interseção quando ambos marcaram) —
   *  entra direto em sugerirHorarios no client. null = sem grade útil. */
  disponibilidade: Disponibilidade | null;
  janela: { inicio: string; fim: string } | null;
  /** Instantes ISO já ocupados do jovem (encontros das OUTRAS
   *  duplas/trilhas), repassados crus do chamador — entram no motor e
   *  voltam pro client marcar os chips em choque. */
  ocupados: string[];
};

/** A grade que vale pros dois: ambos com células ⇒ interseção; um lado
 *  só ⇒ a grade dele (filtra o que dá pra filtrar); nenhum ⇒ null e o
 *  motor cai no histórico/padrão. Interseção vazia também vira null:
 *  "sem horário em comum" quem avisa é o avisoDisponibilidade, a
 *  sugestão não finge grade onde não há. */
function gradesDaDupla(
  mentor: Disponibilidade | null,
  jovem: Disponibilidade | null
): Disponibilidade | null {
  const celMentor = celulasDe(mentor);
  const celJovem = celulasDe(jovem);
  if (celMentor.length && celJovem.length) {
    const comuns = celulasComuns(mentor, jovem);
    return comuns.length ? { celulas: comuns } : null;
  }
  const unica = celMentor.length ? celMentor : celJovem;
  return unica.length ? { celulas: unica } : null;
}

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** O próximo passo combinado ainda não aplicado com data >= hoje — a
 *  âncora "Data do guia" das sugestões. */
function proximoPasso(
  plano: PlanoParaSugestao | null | undefined,
  hoje: string
): string | null {
  const aplicados = new Set(
    (plano?.passos_aplicados ?? []).map((s) => s.numero)
  );
  const futuros = (plano?.passos ?? [])
    .filter(
      (s) =>
        typeof s?.data === "string" &&
        DATA_RE.test(s.data) &&
        s.data >= hoje &&
        !aplicados.has(s.numero)
    )
    .map((s) => s.data)
    .sort();
  return futuros[0] ?? null;
}

/** Perfil + datas sugeridas + grade combinada da dupla — o pacote que os
 *  cards de agendamento consomem (481/482/483). Sem duplaId não há como
 *  escopar as grades do par — devolve null em vez de sugerir no escuro. */
export async function sugestoesEncontroDaDupla(input: {
  encontros: EncontroHistorico[];
  plano: PlanoParaSugestao | null;
  duplaId: string | null;
  agora?: Date;
  /** data_hora ISO dos encontros já marcados do jovem fora desta dupla —
   *  a 481 junta a lista; sem ela o comportamento é o de antes. */
  ocupados?: string[];
}): Promise<SugestoesEncontro | null> {
  if (!input?.duplaId) return null;
  const agora = input.agora ?? new Date();
  const perfil = perfilDeEncontros(input.encontros ?? [], agora);
  const { mentor, jovem } = await disponibilidadesDaDupla(input.duplaId);
  const disponibilidade = gradesDaDupla(mentor, jovem);
  const jan = input.plano?.janela;
  const janela =
    jan && DATA_RE.test(jan.inicio) && DATA_RE.test(jan.fim) && jan.inicio <= jan.fim
      ? { inicio: jan.inicio, fim: jan.fim }
      : null;
  const ritmoNum = Number(input.plano?.ritmo);
  const ritmo =
    Number.isFinite(ritmoNum) && ritmoNum > 0 ? ritmoNum : null;
  const dataSugerida = proximoPasso(input.plano, toDateStr(agora));
  const ocupados = input.ocupados ?? [];
  const datas = sugerirDatas({
    agora,
    perfil,
    janela,
    ritmo,
    dataSugerida,
    disponibilidade,
    ocupados,
  });
  return { perfil, datas, disponibilidade, janela, ocupados };
}
