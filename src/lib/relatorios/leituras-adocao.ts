// Leitura da aba Adoção (REALIZA-455): tendência de pessoas ativas contra
// a janela anterior, superfícies e papéis sem uso e a taxa de resposta dos
// instrumentos. Medida "gestos" troca o denominador — a leitura acompanha
// a régua ativa da seção.

import type { LinhaCoorte, ResumoAdocao, CelulaMatriz, Janela } from "@/lib/adocao";
import { SUPERFICIES, PAPEIS_ADOCAO, deltaPct } from "@/lib/adocao";
import type { FunilInstrumento } from "./adocao";
import { ordenaAchados, nadaADeclarar, type Achado } from "./leituras";

const plural = (n: number, um: string, muitos: string) =>
  n === 1 ? um : muitos;

export function leituraAdocao({
  resumo,
  celulas,
  coorte,
  funil,
  janela,
  papel,
  medida,
}: {
  resumo: ResumoAdocao;
  celulas: CelulaMatriz[];
  coorte: LinhaCoorte[];
  funil: FunilInstrumento[];
  janela: Janela;
  papel: string | null;
  medida: "pessoas" | "gestos";
}): Achado[] {
  const celulasRecorte = papel
    ? celulas.filter((c) => c.papel === papel)
    : celulas;
  const usadas = new Set(
    celulasRecorte
      .filter((c) => c.pessoas > 0 || c.gestos > 0)
      .map((c) => c.superficie)
  );
  if (resumo.gestos === 0 && usadas.size === 0) {
    return nadaADeclarar(`sem gesto registrado na janela de ${janela} dias`);
  }

  const out: Achado[] = [];
  const porGestos = medida === "gestos";
  const atual = porGestos ? resumo.gestos : resumo.ativas;
  const antes = porGestos ? resumo.gestos_prev : resumo.ativas_prev;
  const sujeito = porGestos ? "gestos" : plural(atual, "pessoa ativa", "pessoas ativas");
  const delta = deltaPct(atual, antes);

  if (delta != null && delta <= -0.2) {
    out.push({
      tom: "atencao",
      titulo: `Uso caiu ${Math.round(-delta * 100)}% na janela`,
      metrica: `${atual} ${sujeito}, eram ${antes} na janela anterior de ${janela} dias`,
      porque:
        "queda de um quinto ou mais entre janelas iguais merece explicação: feriado, bug ou desinteresse",
      intervencao:
        "compare com o calendário e pergunte à equipe se algo mudou no período",
    });
  } else if (delta != null && delta >= 0.2) {
    out.push({
      tom: "ok",
      titulo: `Uso subiu ${Math.round(delta * 100)}% na janela`,
      metrica: `${atual} ${sujeito}, eram ${antes} na janela anterior de ${janela} dias`,
      porque: "crescimento sustentado entre janelas iguais",
      intervencao: "registre o que funcionou: a régua da semana vem daqui",
    });
  }

  const paradas = SUPERFICIES.filter((s) => !usadas.has(s.id));
  if (paradas.length > 0) {
    out.push({
      tom: "info",
      titulo: `${paradas.length} ${plural(paradas.length, "superfície parada", "superfícies paradas")}`,
      metrica: `${paradas.length} de ${SUPERFICIES.length} áreas sem gesto na janela`,
      porque: `sem uso em ${janela} dias: ${paradas.map((s) => s.rotulo).join(", ")}`,
      intervencao:
        "decida por superfície: falta de divulgação, dor resolvida por fora ou dado quebrado",
    });
  }

  const semUso = PAPEIS_ADOCAO.filter(
    (p) =>
      p.id !== "desconhecido" &&
      !celulas.some(
        (c) => c.papel === p.id && (c.pessoas > 0 || c.gestos > 0)
      )
  );
  if (semUso.length > 0 && !papel) {
    out.push({
      tom: "info",
      titulo: `${plural(semUso.length, "Papel sem uso", "Papéis sem uso")}: ${semUso.map((p) => p.rotulo).join(", ")}`,
      metrica: `${semUso.length} de ${PAPEIS_ADOCAO.length - 1} papéis sem gesto na janela`,
      porque: "um papel inteiro sem gesto não é hábito, é porta fechada",
      intervencao:
        "confira se o grupo tem acesso e se alguém apresentou o produto pra ele",
    });
  }

  const emitidos = funil
    .filter((f) => !f.campanha)
    .reduce((s, f) => s + f.emitidos, 0);
  const respondidos = funil
    .filter((f) => !f.campanha)
    .reduce((s, f) => s + f.respondidos, 0);
  if (emitidos >= 5 && respondidos / emitidos < 0.5) {
    out.push({
      tom: "atencao",
      titulo: `Taxa de resposta dos instrumentos em ${Math.round((respondidos / emitidos) * 100)}%`,
      metrica: `${respondidos} de ${emitidos} instrumentos respondidos`,
      porque:
        "menos da metade dos links emitidos volta: o instrumento não está entrando na rotina",
      intervencao:
        "veja qual instrumento concentra a espera e reenvie com contexto, não só o link",
    });
  }

  const w1 = coorte.filter((c) => c.semana === 1 && c.total > 0);
  if (w1.length >= 2) {
    const retencao =
      w1.reduce((s, c) => s + c.ativas / c.total, 0) / w1.length;
    if (retencao < 0.5) {
      out.push({
        tom: "atencao",
        titulo: `Só ${Math.round(retencao * 100)}% volta na semana seguinte`,
        metrica: `média de retenção na semana 1 em ${w1.length} ${plural(w1.length, "coorte", "coortes")}`,
        porque:
          "quem estreia e não volta na semana seguinte dificilmente cria hábito",
        intervencao:
          "trabalhe a primeira semana: onboarding, primeiro gesto guiado e acompanhamento próximo",
      });
    }
  }

  return ordenaAchados(
    out.length ? out : nadaADeclarar(`${atual} ${sujeito} na janela`)
  );
}
