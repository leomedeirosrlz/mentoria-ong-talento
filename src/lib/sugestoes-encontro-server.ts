import { celulasComuns, celulasDe, toDateStr } from "./ciclo";
import { disponibilidadesDaDupla } from "./actions";
import type { Disponibilidade, JovemDupla } from "./types";
import type { JovemEncontro } from "./queries-jovem";
import {
  perfilDeEncontros,
  principalDe,
  sugerirDatas,
  type EncontroHistorico,
  type OcupadoRotulado,
  type OrigemSugestao,
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

/** Ocupado na entrada: instante cru (contrato 480b) ou já rotulado — a
 *  481 monta o rótulo a partir dos encontros de origem. */
export type OcupadoInput =
  | string
  | { inicio: string; rotulo?: string; rotuloArtigo?: string };

export type SugestoesEncontro = {
  perfil: PerfilEncontros;
  datas: SugestaoData[];
  /** Grade combinada dos dois lados (interseção quando ambos marcaram) —
   *  entra direto em sugerirHorarios no client. null = sem grade útil. */
  disponibilidade: Disponibilidade | null;
  janela: { inicio: string; fim: string } | null;
  /** Instantes ocupados do jovem em TODAS as duplas/trilhas com o rótulo
   *  do chip ("6º encontro com Ricardo", "sessão com Helena") — entram no
   *  motor pelo `inicio` e voltam pro client marcar chips e mensagens. */
  ocupados: OcupadoRotulado[];
  /** Sugestão principal: o CTA do cartão e o par pré-selecionado do
   *  seletor. null = sem data viável na janela. */
  principal: { data: string; hora: string; origem: OrigemSugestao } | null;
  /** Mediana do histórico ou 60 — a faixa "das 19:00 às 20:00" do cartão
   *  e a janela do choque no seletor. */
  duracaoMin: number;
  /** Hoje civil no fuso do programa — o "Outro dia" abre em amanhã. */
  hoje: string;
};

/** A grade que vale pros dois: ambos com células ⇒ interseção; um lado
 *  só ⇒ a grade dele (filtra o que dá pra filtrar); nenhum ⇒ null e o
 *  motor cai no histórico/padrão. Interseção vazia também vira null:
 *  "sem horário em comum" quem avisa é o avisoDisponibilidade, a
 *  sugestão não finge grade onde não há. Exportada pra ficha alimentar a
 *  projeção do "ficar em dia" com a mesma grade (518). */
export function gradesDaDupla(
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
  /** Instantes já marcados do jovem em TODAS as duplas/trilhas (a 481 junta
   *  via `ocupadosDoJovem` com rótulo; string crua segue aceita). Sem a
   *  lista o comportamento é o de antes. */
  ocupados?: OcupadoInput[];
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
  const hoje = toDateStr(agora);
  const dataSugerida = proximoPasso(input.plano, hoje);
  const ocupados: OcupadoRotulado[] = (input.ocupados ?? [])
    .map((o) =>
      typeof o === "string"
        ? { inicio: o, rotulo: "", rotuloArtigo: "" }
        : {
            inicio: o.inicio,
            rotulo: o.rotulo ?? "",
            rotuloArtigo: o.rotuloArtigo ?? o.rotulo ?? "",
          }
    )
    .filter((o) => typeof o.inicio === "string" && o.inicio);
  const ocupadosIso = ocupados.map((o) => o.inicio);
  const datas = sugerirDatas({
    agora,
    perfil,
    janela,
    ritmo,
    dataSugerida,
    disponibilidade,
    ocupados: ocupadosIso,
  });
  const duracaoMin = perfil.duracaoMedianaMin ?? 60;
  const principal = principalDe({
    datas,
    perfil,
    disponibilidade,
    ocupados: ocupadosIso,
    duracaoMin,
  });
  return {
    perfil,
    datas,
    disponibilidade,
    janela,
    ocupados,
    principal,
    duracaoMin,
    hoje,
  };
}

/** Primeiro nome do par — social quando existe (mesma régua da ficha). */
const primeiroNome = (n: string | null | undefined) =>
  (n ?? "").trim().split(/\s+/)[0] || null;

/** Encontros agendados do jovem em TODAS as duplas/trilhas, com o rótulo
 *  que o chip/mensagem lê ("6º encontro com Ricardo" — forma com artigo:
 *  "o 6º encontro com Ricardo"; "sessão com Helena" — "uma sessão com
 *  Helena"). Inclui a própria dupla DPP: o 7º não pode cair em cima do
 *  6º. O nome sai do mentor da dupla no catálogo `jovem_duplas` — o
 *  especialista da trilha usa o mesmo campo. */
export function ocupadosDoJovem(
  encontros: JovemEncontro[],
  duplas: JovemDupla[]
): OcupadoRotulado[] {
  const infoPorDupla = new Map(
    duplas
      .filter((d) => d.id != null)
      .map((d) => [
        d.id!,
        {
          quem: primeiroNome(d.mentor_nome_social ?? d.mentor_nome),
          esp: (d.trilha ?? "dpp") === "especialista",
        },
      ] as const)
  );
  return encontros
    .filter(
      (e) =>
        (e.status === "agendado" || e.status === "remarcado") &&
        e.data_hora != null
    )
    .map((e) => {
      const info = infoPorDupla.get(e.dupla_id);
      return info?.esp
        ? {
            inicio: e.data_hora!,
            rotulo: `sessão com ${info.quem ?? "especialista"}`,
            rotuloArtigo: `uma sessão com ${info.quem ?? "especialista"}`,
          }
        : {
            inicio: e.data_hora!,
            rotulo: `${e.numero}º encontro com ${info?.quem ?? "seu mentor"}`,
            rotuloArtigo: `o ${e.numero}º encontro com ${info?.quem ?? "seu mentor"}`,
          };
    });
}
