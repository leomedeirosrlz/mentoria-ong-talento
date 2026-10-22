import type { AppRole } from "../types";
import type { PdmDoc, PdmItem, PdmResumo } from "../pdm";
import { resumoPdm } from "../pdm";
import { getDemoData } from "./data";

// ---------- PDM vivo da demo (REALIZA-181) ----------
//
// O dataset conta a mesma história das respostas de instrumento (metas +
// pdm da Ana, visão da Dandara): o documento é o que o backfill da 0109
// produziria, já com os retoques que a dupla faria em encontro — porque
// revisado e uma submeta batida. A d-fim mostra o fim de jornada (metas
// atingidas alimentando o resumo); as demais ficam sem PDM (empty state).
//
// Nota: como toda escrita da demo é bloqueada nas actions, este doc é de
// leitura — a árvore renderiza igual à real, edição devolve DEMO_MSG.

const uid = (n: number): string =>
  `de000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const DIA_MS = 24 * 3600 * 1000;
const HOJE = new Date();
/** Há n dias — mesmo helper de forms-data.ts. */
const haDias = (n: number, hhmm = "10:00"): string =>
  new Date(
    `${new Date(HOJE.getTime() - n * DIA_MS).toISOString().slice(0, 10)}T${hhmm}:00-03:00`
  ).toISOString();

/** "YYYY-MM-DD" daqui a n dias — prazo_alvo vivo, evergreen. */
const daquiDias = (n: number): string =>
  new Date(HOJE.getTime() + n * DIA_MS).toISOString().slice(0, 10);

type ItemSeed = Omit<
  PdmItem,
  "id" | "parentId" | "atingidaEm" | "ordem" | "origem" | "origemCampo"
> & {
  id: number;
  parent?: number;
  ordem: number;
  origem?: PdmItem["origem"];
  origemCampo?: string | null;
  atingidaEm?: string | null;
};

function montaItens(seeds: ItemSeed[]): PdmItem[] {
  return seeds.map((s) => ({
    id: uid(0x4700 + s.id),
    parentId: s.parent != null ? uid(0x4700 + s.parent) : null,
    titulo: s.titulo,
    porque: s.porque,
    indicador: s.indicador,
    areaVida: s.areaVida,
    prazoAlvo: s.prazoAlvo,
    status: s.status,
    atingidaEm: s.atingidaEm ?? null,
    ordem: s.ordem,
    origem: s.origem ?? "manual",
    origemCampo: s.origemCampo ?? null,
  }));
}

function docDupla(
  duplaId: string,
  visao: string | null,
  visaoEm: string | null,
  seeds: ItemSeed[]
): PdmDoc {
  return { duplaId, visao, visaoEm, itens: montaItens(seeds) };
}

/** Os PDMs da demo, por dupla_id. d-ok espelha a projeção das respostas da
 *  Ana (metas → 4 metas com meta_principal="Meta 2"; pdm → revisão com
 *  IS/prazo/submetas e a meta 4 descartada — o doc conta a história do
 *  instrumento); d-fim é a jornada concluída (retro pronta); d-risco só
 *  tem a visão — metas ainda não saíram no ritmo dela. */
function pdmPorDupla(duplaId: string): PdmDoc | null {
  const data = getDemoData();
  const dupla = data.duplas.find((d) => d.id === duplaId);
  if (!dupla) return null;

  // d-ok · Ricardo × Ana — ciclo em curso: a meta mais importante era o
  // jovem aprendiz, a revisão do PDM (enc. ~5) reordenou e detalhou IS e
  // prazos; a meta 4 das Metas saiu do plano na revisão (descartada)
  if (duplaId === uid(0x0601)) {
    return docDupla(
      duplaId,
      "Em até 3 anos, serei uma profissional formada e independente, sustentando meus estudos e ajudando minha família.",
      haDias(7, "19:26"),
      [
        {
          id: 1, ordem: 1, origem: "pdm", origemCampo: "meta_2",
          titulo: "Subir a média de matemática pra 7,0",
          porque: "É a matéria que mais me atrapalha no simulado.",
          indicador: "Média 7,0 ou mais no boletim do 3º bimestre",
          areaVida: "Escola / universidade", prazoAlvo: daquiDias(120),
          status: "ativa",
        },
        {
          id: 11, parent: 1, ordem: 1, origem: "pdm", origemCampo: "sub_2_1",
          titulo: "30 min de exercícios toda terça e quinta",
          porque: null, indicador: null, areaVida: null, prazoAlvo: null,
          status: "atingida", atingidaEm: haDias(2, "20:15"),
        },
        {
          id: 12, parent: 1, ordem: 2, origem: "pdm", origemCampo: "sub_2_2",
          titulo: "Levar as dúvidas pro encontro com o mentor",
          porque: null, indicador: null, areaVida: null, prazoAlvo: null,
          status: "ativa",
        },
        {
          id: 13, parent: 1, ordem: 3, origem: "pdm", origemCampo: "sub_2_3",
          titulo: "Refazer a prova do 2º bimestre em casa",
          porque: null, indicador: null, areaVida: null, prazoAlvo: null,
          status: "ativa",
        },
        {
          id: 2, ordem: 2, origem: "pdm", origemCampo: "meta_1",
          titulo: "Conseguir um jovem aprendiz até dezembro",
          porque: "Quero minha própria renda e experiência de trabalho de verdade.",
          indicador: "Contrato assinado num programa de jovem aprendiz",
          areaVida: "Carreira e trabalho", prazoAlvo: daquiDias(165),
          status: "ativa",
        },
        {
          id: 21, parent: 2, ordem: 1, origem: "pdm", origemCampo: "sub_1_1",
          titulo: "Montar o currículo com a Luana da ONG",
          porque: null, indicador: null, areaVida: null, prazoAlvo: null,
          status: "atingida", atingidaEm: haDias(5, "18:02"),
        },
        {
          id: 22, parent: 2, ordem: 2, origem: "pdm", origemCampo: "sub_1_2",
          titulo: "Me inscrever nos 3 programas de aprendiz da cidade",
          porque: null, indicador: null, areaVida: null, prazoAlvo: daquiDias(9),
          status: "ativa",
        },
        {
          id: 23, parent: 2, ordem: 3, origem: "pdm", origemCampo: "sub_1_3",
          titulo: "Treinar entrevista com o Ricardo no encontro 6",
          porque: null, indicador: null, areaVida: null, prazoAlvo: null,
          status: "ativa",
        },
        {
          id: 3, ordem: 3, origem: "pdm", origemCampo: "meta_3",
          titulo: "Fazer o simulado completo do ENEM sem zerar nenhuma área",
          porque: "É a porta de entrada pra faculdade — sem isso o resto não acontece.",
          indicador: "Simulado completo com nota mínima 500 em cada área",
          areaVida: "Escola / universidade", prazoAlvo: daquiDias(110),
          status: "ativa",
        },
        {
          id: 4, ordem: 4, origem: "metas", origemCampo: "meta_4",
          titulo: "Apresentar um trabalho sem ler os slides",
          porque: "Falar em público me trava — vencer isso muda tudo.",
          indicador: null, areaVida: null, prazoAlvo: null,
          status: "descartada",
        },
      ]
    );
  }

  // d-fim · Luiza × Isabela — jornada concluída: as metas do ciclo dela no
  // estado de chegada — alimenta o card "Metas" do resumo da jornada
  if (duplaId === uid(0x0605)) {
    return docDupla(
      duplaId,
      "Em 2 anos, estarei estudando design na universidade e trabalhando na área.",
      haDias(240, "19:10"),
      [
        {
          id: 51, ordem: 1, origem: "pdm", origemCampo: "meta_1",
          titulo: "Terminar o ensino médio com média suficiente pro vestibular",
          porque: "A faculdade de design é o próximo passo — sem o diploma nada anda.",
          indicador: "Diploma emitido e média final ≥ 7",
          areaVida: "Escola / universidade", prazoAlvo: haDias(230).slice(0, 10),
          status: "atingida", atingidaEm: haDias(225, "10:40"),
        },
        {
          id: 52, ordem: 2, origem: "pdm", origemCampo: "meta_2",
          titulo: "Montar meu portfólio de desenho com 10 peças",
          porque: "O processo seletivo pede portfólio — quero chegar pronta.",
          indicador: "Portfólio digital publicado com 10 trabalhos",
          areaVida: "Carreira e trabalho", prazoAlvo: haDias(180).slice(0, 10),
          status: "atingida", atingidaEm: haDias(196, "16:22"),
        },
        {
          id: 53, ordem: 3, origem: "metas", origemCampo: "meta_3",
          titulo: "Conseguir um estágio de meio período",
          porque: "Quero renda própria sem largar os estudos.",
          indicador: null, areaVida: "Carreira e trabalho", prazoAlvo: null,
          status: "descartada",
        },
      ]
    );
  }

  // d-risco · Fernanda × Dandara — a visão saiu no enc. 1; metas e PDM
  // ficaram pra depois — e a dupla entrou em risco antes deles chegarem
  if (duplaId === uid(0x0603)) {
    return docDupla(
      duplaId,
      "Em 3 anos, serei técnica de enfermagem empregada.",
      haDias(32, "20:15"),
      []
    );
  }

  return null;
}

/** Idem pdm_da_dupla: escopo da dupla (coord; mentor, supervisor e o
 *  mentorado DELA) — fora dele, null como o erro da RPC. */
export function demoPdmDaDupla(role: AppRole, duplaId: string): PdmDoc | null {
  const data = getDemoData();
  const dupla = data.duplas.find((d) => d.id === duplaId);
  if (!dupla) return null;
  const eu = data.personas[role];
  const souMentorado =
    role === "mentorado" &&
    data.mentorados.some(
      (m) => m.id === dupla.mentorado?.id && m.profile_id === eu.id
    );
  const podeVer =
    role === "coordenacao" ||
    dupla.mentor?.id === eu.id ||
    dupla.supervisor?.id === eu.id ||
    souMentorado;
  if (!podeVer) return null;
  return pdmPorDupla(duplaId);
}

/** Idem getPdmResumo — o recorte do resumo sobre o doc demo. */
export function demoPdmResumo(role: AppRole, duplaId: string): PdmResumo | null {
  return resumoPdm(demoPdmDaDupla(role, duplaId));
}
