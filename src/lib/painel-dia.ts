import {
  alvoAgendamento,
  encontrosDaSemana,
  eventosDoCronograma,
  toDateStr,
  type ItemEncontroDupla,
} from "@/lib/ciclo";
import type { CicloEvento, Dupla, Encontro } from "@/lib/types";

/** O dia de calendário que ancora o encontro: quando aconteceu de fato se já
 *  rolou, senão o dia agendado — mesma régua do `diaDoEncontro` do
 *  calendário (duplicada aqui pra função ficar livre de componente). */
function diaDoEncontro(e: Encontro): string | null {
  const iso = e.status === "realizado" && e.realizado_em ? e.realizado_em : e.data_hora;
  return iso ? toDateStr(new Date(iso)) : null;
}

function instanteDoEncontro(e: Encontro): number {
  const iso = e.status === "realizado" && e.realizado_em ? e.realizado_em : e.data_hora;
  return iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY;
}

/** Uma linha do quadro do mentor no painel do dia. O tipo já diz qual ação
 *  vai embaixo dela — rótulo e ação falam SEMPRE do mesmo encontro (a regra
 *  de ouro que matou o "a agendar" com Remarcar). */
export type LinhaPainelDia =
  /** Encontro real (row com status/data e as ações dela — chamada, registro,
   *  remarcar em limbo). */
  | { tipo: "encontro"; encontro: Encontro }
  /** Encontro ainda sem row — linha "Nº encontro · a agendar" + "Agendar o
   *  Nº encontro" (retroativo quando o dia já passou). */
  | { tipo: "agendar"; numero: number }
  /** Encontro agendado ainda não realizado que pede remarcação (nº anterior
   *  ao oficial da semana, ou oficial marcado como não-aconteceu) — linha
   *  dele com "Remarcar o Nº". */
  | { tipo: "remarcar"; encontro: Encontro };

export type PainelDia = {
  /** Encontros de dupla com data no dia selecionado, em ordem de horário —
   *  o bloco "Neste dia". */
  noDia: ItemEncontroDupla[];
  /** O bloco "Também nesta semana": por dupla ativa (na ordem em que vem),
   *  o que é da semana do dia selecionado mas não do dia. Dupla sem nada a
   *  mostrar não entra. */
  semana: { dupla: Dupla; linhas: LinhaPainelDia[] }[];
};

/** Monta o quadro de duplas do painel do dia da agenda do mentor: "Neste
 *  dia" separa o que é do dia do que é só da semana — antes tudo se
 *  misturava por dupla e a ação embaixo podia ser de outro encontro. */
export function painelDuplasDoDia({
  duplas,
  eventos,
  selecionado,
  hoje,
}: {
  duplas: Dupla[];
  /** Lista completa — o recorte por cronograma é feito por dupla aqui
   *  dentro (o nº oficial da semana da dupla é o do cronograma DELA, não o
   *  do seletor da tela). */
  eventos: CicloEvento[];
  /** "YYYY-MM-DD" do dia selecionado. */
  selecionado: string;
  /** "YYYY-MM-DD" de hoje — régua do `alvoAgendamento` no ramo sem oficial. */
  hoje: string;
}): PainelDia {
  // âncora no meio-dia pra o dia da semana não depender do fuso da máquina
  const diaSel = new Date(`${selecionado}T12:00:00`);
  const hojeBase = new Date(`${hoje}T12:00:00`);

  const noDia: ItemEncontroDupla[] = [];
  for (const dupla of duplas) {
    if (dupla.status !== "ativa") continue;
    for (const encontro of dupla.encontros)
      if (diaDoEncontro(encontro) === selecionado) noDia.push({ encontro, dupla });
  }
  noDia.sort(
    (a, b) => instanteDoEncontro(a.encontro) - instanteDoEncontro(b.encontro)
  );

  const semana: PainelDia["semana"] = [];
  for (const dupla of duplas) {
    if (dupla.status !== "ativa") continue;
    // o(s) encontro(s) oficial(is) que o calendário DA DUPLA marca pra
    // semana do dia selecionado (a semana dupla da T2 pode trazer dois)
    const oficiais = encontrosDaSemana(
      eventosDoCronograma(eventos, dupla.cronograma_id),
      diaSel
    );
    const linhas: LinhaPainelDia[] = [];
    if (oficiais.length > 0) {
      const numeros = new Set(oficiais.map((o) => o.numero!));
      const primeiroOficial = Math.min(...numeros);
      for (const encontro of dupla.encontros) {
        if (diaDoEncontro(encontro) === selecionado) continue; // já em "Neste dia"
        // realizado e registrado é história: nada a fazer na semana, e a
        // linha só disputaria atenção com o que pede gesto
        if (encontro.status === "realizado" && encontro.registro) continue;
        if (numeros.has(encontro.numero)) {
          // o nº oficial da semana marcado em outro dia — não-aconteceu
          // vira "remarcar" (reagendar), os demais seguem na row de status
          linhas.push(
            encontro.status === "nao_aconteceu"
              ? { tipo: "remarcar", encontro }
              : { tipo: "encontro", encontro }
          );
        } else if (
          encontro.numero < primeiroOficial &&
          (encontro.status === "agendado" || encontro.status === "remarcado")
        ) {
          // agendado de nº anterior ainda não realizado (o 7º marcado na
          // quinta quando o dia é sábado da semana do 8º) — remarcar com o
          // nº no rótulo, nunca um "Remarcar" solto sob a linha de outro
          linhas.push({ tipo: "remarcar", encontro });
        }
      }
      for (const o of oficiais)
        if (!dupla.encontros.some((e) => e.numero === o.numero))
          linhas.push({ tipo: "agendar", numero: o.numero! });
    } else {
      // semana sem oficial no cronograma dela (recesso/gap, ou trilha
      // especialista sem calendário): o próximo pendente — mesmo ramo
      // genérico que o AcaoDiaMentor fazia
      const alvo = alvoAgendamento(dupla, eventos, hojeBase);
      if (!alvo.cicloCompleto) {
        if (!alvo.encontroAlvo) {
          linhas.push({ tipo: "agendar", numero: alvo.proximoNumero });
        } else if (diaDoEncontro(alvo.encontroAlvo) !== selecionado) {
          linhas.push({ tipo: "remarcar", encontro: alvo.encontroAlvo });
        }
      }
    }
    if (linhas.length === 0) continue;
    const numeroDaLinha = (l: LinhaPainelDia) =>
      l.tipo === "agendar" ? l.numero : l.encontro.numero;
    linhas.sort((a, b) => numeroDaLinha(a) - numeroDaLinha(b));
    semana.push({ dupla, linhas });
  }

  return { noDia, semana };
}
