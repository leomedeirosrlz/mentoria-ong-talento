// Leitura da aba Saúde (REALIZA-455): prosa sobre a tendência diária dos
// snapshots — nível atual primeiro, depois a direção (7 dias contra os 7
// anteriores). A régua é a mesma dos gráficos: último dia com dado e a
// média da janela, nunca um número solto.

import type { DiaSaude } from "./dados";
import { ordenaAchados, nadaADeclarar, type Achado } from "./leituras";

const plural = (n: number, um: string, muitos: string) =>
  n === 1 ? um : muitos;

function media(t: DiaSaude[], campo: keyof Omit<DiaSaude, "dia">): number {
  if (!t.length) return 0;
  return t.reduce((s, d) => s + d[campo], 0) / t.length;
}

export function leituraSaude(tendencia: DiaSaude[]): Achado[] {
  if (tendencia.length === 0) {
    return [
      {
        tom: "info",
        titulo: "Histórico ainda acumulando",
        metrica: "0 dias com snapshot",
        porque:
          "a leitura diária da situação começou a rodar: ainda não há base pra comparar",
        intervencao: "volte em alguns dias; o registro já está sendo gravado",
      },
    ];
  }

  const out: Achado[] = [];
  const ultimo = tendencia[tendencia.length - 1];
  const total = ultimo.risco + ultimo.atencao + ultimo.ok;

  if (ultimo.risco > 0) {
    out.push({
      tom: "risco",
      titulo: `${ultimo.risco} ${plural(ultimo.risco, "dupla em risco", "duplas em risco")} agora`,
      metrica: `${ultimo.risco} de ${total} ${plural(total, "dupla", "duplas")} no último dia com dados`,
      porque:
        "risco é o sinal mais grave: aceso, pede ação na hora",
      intervencao:
        "abra a aba Aderência e trabalhe a fila de cima pra baixo",
      acao: { rotulo: "Ir para a fila", href: "/relatorios/operacionais?aba=aderencia" },
    });
  }

  if (ultimo.atencao > 0) {
    out.push({
      tom: "atencao",
      titulo: `${ultimo.atencao} ${plural(ultimo.atencao, "dupla em atenção", "duplas em atenção")}`,
      metrica: `${ultimo.atencao} de ${total} ${plural(total, "dupla", "duplas")} no último dia com dados`,
      porque: "atenção é o degrau antes do risco: agir aqui é barato",
      intervencao: "resolva essas antes que virem risco",
    });
  }

  // direção: média de (risco + atenção) dos últimos 7 dias vs os 7 anteriores
  const ultimos7 = tendencia.slice(-7);
  const antes7 = tendencia.slice(-14, -7);
  if (antes7.length > 0) {
    const sinaisAgora = media(ultimos7, "risco") + media(ultimos7, "atencao");
    const sinaisAntes = media(antes7, "risco") + media(antes7, "atencao");
    const delta = sinaisAgora - sinaisAntes;
    if (delta >= 1) {
      out.push({
        tom: "atencao",
        titulo: "Sinais em alta nos últimos 7 dias",
        metrica: `média de ${sinaisAgora.toFixed(1)} sinais/dia, era ${sinaisAntes.toFixed(1)}`,
        porque:
          "a média de duplas com sinal subiu uma dupla ou mais em relação à semana anterior",
        intervencao:
          "veja na fila se é a mesma dupla piorando ou gente nova entrando",
      });
    } else if (delta <= -1) {
      out.push({
        tom: "ok",
        titulo: "Sinais em queda nos últimos 7 dias",
        metrica: `média de ${sinaisAgora.toFixed(1)} sinais/dia, era ${sinaisAntes.toFixed(1)}`,
        porque: "o recorte está desafogando em relação à semana anterior",
        intervencao: "mantenha o ritmo de cobrança que trouxe a melhora",
      });
    }
  }

  if (ultimo.risco === 0 && ultimo.atencao === 0) {
    out.push({
      tom: "ok",
      titulo: "Recorte em dia no último snapshot",
      metrica: `${ultimo.ok} de ${total} ${plural(total, "dupla", "duplas")} em dia`,
      porque: "nenhum sinal aceso",
      intervencao: "siga a rotina: a régua avisa quando algo acender",
    });
  }

  return ordenaAchados(out.length ? out : nadaADeclarar(`${tendencia.length} dias de histórico`));
}
