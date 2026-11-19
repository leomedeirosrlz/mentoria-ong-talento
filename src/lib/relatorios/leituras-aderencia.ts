// Leitura da aba Aderência (REALIZA-455): a mesma régua do resumo, só que
// em prosa priorizada — pedido de apoio primeiro (é gente pedindo ajuda),
// depois calendário, registro e remarcação. Toda métrica sai do próprio
// ResumoAderencia, então o denominador é o que a tela já mostra.

import type { ResumoAderencia } from "./operacional";
import { ordenaAchados, nadaADeclarar, type Achado } from "./leituras";

const plural = (n: number, um: string, muitos: string) =>
  n === 1 ? um : muitos;

export function leituraAderencia(r: ResumoAderencia): Achado[] {
  if (r.itens.length === 0) {
    return nadaADeclarar("0 duplas no recorte");
  }
  const out: Achado[] = [];
  const ativas = r.saude.emAndamento;

  const comApoio = r.itens.filter((i) => i.saude.apoio.aberto);
  if (comApoio.length > 0) {
    out.push({
      tom: "risco",
      titulo: `${comApoio.length} ${plural(comApoio.length, "pedido de apoio em aberto", "pedidos de apoio em aberto")}`,
      metrica: `${comApoio.length} de ${r.itens.length} ${plural(r.itens.length, "dupla", "duplas")} do recorte`,
      porque:
        "pedido de apoio é alguém pedindo ajuda de propósito — nenhuma outra fila vem antes dele",
      intervencao:
        "responda cada pedido hoje, antes de trabalhar o resto da fila",
      acao: { rotulo: "Abrir a primeira dupla", href: `/duplas/${comApoio[0].dupla.id}` },
    });
  }

  if (r.atrasDoCalendario > 0) {
    out.push({
      tom: "atencao",
      titulo: `${r.atrasDoCalendario} ${plural(r.atrasDoCalendario, "dupla atrás do calendário", "duplas atrás do calendário")}`,
      metrica: `${r.atrasDoCalendario} de ${ativas} ${plural(ativas, "dupla ativa", "duplas ativas")}`,
      porque:
        "fez menos encontros do que o cronograma já devia — a lacuna só cresce se ninguém cobrar",
      intervencao:
        "chame cada dupla com o lembrete da fila e realinhe o próximo encontro",
    });
  }

  if (r.registrosPendentes > 0) {
    out.push({
      tom: "atencao",
      titulo: `${r.registrosPendentes} ${plural(r.registrosPendentes, "dupla com registro pendente", "duplas com registro pendente")}`,
      metrica: `${r.registrosPendentes} de ${ativas} ${plural(ativas, "dupla ativa", "duplas ativas")}`,
      porque:
        "encontro acontecido sem registro apaga a evidência do trabalho — e o semáforo cobra",
      intervencao:
        "lembre o mentor de registrar; se virou rotina, veja o que está travando o formulário",
    });
  }

  if (r.atrasoMedioRegistro != null && r.atrasoMedioRegistro > 3) {
    out.push({
      tom: "info",
      titulo: `Registro chega com ${r.atrasoMedioRegistro.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias de atraso médio`,
      metrica: `média de ${r.atrasoMedioRegistro.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias por registro`,
      porque:
        "registro tardio distorce a leitura da semana — o painel atrasa junto",
      intervencao:
        "puxe o registro para perto do encontro no próximo contato com a equipe",
    });
  }

  if (r.remarcacoes > 2) {
    out.push({
      tom: "info",
      titulo: `${r.remarcacoes} remarcações acumuladas no ciclo`,
      metrica: `${r.remarcacoes} remarcações em ${r.itens.length} ${plural(r.itens.length, "dupla", "duplas")}`,
      porque:
        "remarcar demais desgasta os dois lados — agenda que sempre muda tende a esfriar",
      intervencao:
        "veja se as remarcações concentram em poucas duplas e realinhe o horário fixo",
    });
  }

  if (r.adiantados > 0) {
    out.push({
      tom: "ok",
      titulo: `${r.adiantados} ${plural(r.adiantados, "encontro adiantado ou em reposição", "encontros adiantados ou em reposição")}`,
      metrica: `${r.adiantados} realizados além dos ${r.esperados} devidos`,
      porque: "parte do recorte correu na frente do calendário",
      intervencao: "nada a fazer — é folga, não dívida",
    });
  }

  return ordenaAchados(
    out.length
      ? out
      : nadaADeclarar(
          `${r.itens.length} ${plural(r.itens.length, "dupla", "duplas")} no recorte`
        )
  );
}
