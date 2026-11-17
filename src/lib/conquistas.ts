import { limiaresMarcos, maxEncontros } from "./ciclo";
import type { MarcoJornada } from "./ciclo";
import { estacoesJornada } from "./jornada";
import type {
  EstacaoChave,
  JovemJornadaDados,
} from "./jornada";
import { INSTRUMENTO_TOM } from "@/components/instrumento-icone";

// "Suas conquistas" do perfil do jovem (v2 — estante estilo GitHub + faixa
// "a caminho" estilo Duolingo). Derivação pura: recebe os arrays já lidos
// pelas queries do perfil e devolve a estrutura — nada persiste, nada
// compete: é a régua individual da própria jornada, sem streak nem ranking.
//
// O que vira conquista:
//   · marcos da jornada (os 4 limiares de marcosEntre, datados pelo p-ésimo
//     realizado por ordem de realizado_em)
//   · instrumentos entregues (as estações "feito" de estacoesJornada —
//     a recorrente avaliacao_encontro fica fora: a contagem de avaliações
//     já a cobre)
//   · contagens: avaliações enviadas, combinados feitos e sessões com
//     especialista
//
// O que NUNCA aparece: cadeado/locked — marco futuro não vira falta (regra
// de ciclo.ts); o futuro vive só na faixa "a caminho".

/** Glifo do emblema: o símbolo SVG do instrumento (mesma gramática do
 *  InstrumentoEmblema) ou um Phosphor canonizado — marcos mantêm
 *  Flag/Medal/FlagCheckered/Trophy da trilha, contagens usam os ícones da
 *  casa. */
export type ConquistaGlifo =
  | { tipo: "instrumento"; chave: EstacaoChave }
  | { tipo: "phosphor"; nome: ConquistaPhosphor };

export type ConquistaPhosphor =
  | "flag"
  | "medal"
  | "flagCheckered"
  | "trophy"
  | "listChecks"
  | "usersThree";

export type Conquista = {
  /** chave estável — "marco:primeiro", "inst:visao", "conta:avaliacoes" */
  chave: string;
  /** nome do emblema na estante */
  titulo: string;
  /** a linha narrativa do detalhe (dialog) — passado, uma frase */
  detalhe: string;
  /** carimbo ISO — realizado_em/respondido_em da conquista (contagens:
   *  a da ocorrência mais recente). Null quando a fonte não expõe a data
   *  do feito — a view jovem_encaminhamentos não tem feito_em. */
  data: string | null;
  glifo: ConquistaGlifo;
  /** par cor/tinta do emblema — var()s do globals, mesma gramática de
   *  INSTRUMENTO_TOM (os tons de instrumento vêm direto dele) */
  tom: { cor: string; tinta: string };
};

export type ProximoMarco = {
  marco: MarcoJornada;
  rotulo: string;
  /** realizados até agora — o numerador da barra */
  atual: number;
  /** limiar do próximo marco — o denominador */
  alvo: number;
  /** a frase do que falta — "Faltam 3 encontros com seu mentor" */
  texto: string;
};

export type ConquistasJovem = {
  /** estante em ordem cronológica; sem data vai pro fim (a contagem de
   *  combinados acumula — não é um instante) */
  conquistas: Conquista[];
  /** o próximo limiar a cruzar — null quando a jornada está completa ou
   *  não existe */
  proximoMarco: ProximoMarco | null;
  /** a jornada existe pro jovem (tem dupla DPP ou sessão de especialista
   *  já feita) — a página não renderiza o card sem ela */
  temJornada: boolean;
};

export type ConquistasInput = {
  /** getJovemEncontros() — as duas trilhas juntas */
  encontros: {
    id: string;
    dupla_id: string;
    numero: number;
    status: string;
    realizado_em: string | null;
    data_hora: string | null;
  }[];
  /** getJovemDuplas() — trilha/status/início por dupla */
  duplas: {
    id: string | null;
    trilha: string | null;
    status: string | null;
    iniciada_em: string | null;
  }[];
  /** getJovemJornada() — null quando a RPC falha ou não há dupla DPP */
  jornada: JovemJornadaDados | null;
  /** getJovemAvaliacoes() — as estrelas enviadas pelo jovem */
  avaliacoes: {
    encontro_id: string | null;
    dupla_id: string | null;
    created_at: string;
  }[];
  /** getJovemEncaminhamentos() — a view não expõe feito_em */
  encaminhamentos: {
    status: string | null;
    created_at: string | null;
  }[];
  /** relógio injetável — os testes fixam a vigência dos links da jornada */
  agora?: Date;
};

const ROTULO_MARCO: Record<MarcoJornada, string> = {
  primeiro: "Primeiro encontro",
  metade: "Metade do caminho",
  reta_final: "Reta final",
  completo: "Jornada completa",
};

const ICONE_MARCO: Record<MarcoJornada, ConquistaPhosphor> = {
  primeiro: "flag",
  metade: "medal",
  reta_final: "flagCheckered",
  completo: "trophy",
};

// tons da casa: o marco é o lime de "aconteceu" (o disco da trilha) com o
// glifo em tinta; combinados herdam o violeta do checklist; a sessão de
// especialista veste o verde do instrumento dela
const TOM_MARCO = { cor: "var(--brand-ink)", tinta: "var(--brand-lime)" };
const TOM_COMBINADOS = {
  cor: "var(--inst-checklist)",
  tinta: "var(--inst-checklist-t)",
};
const TOM_ESPECIALISTA = {
  cor: "var(--inst-avaliacao-especialista)",
  tinta: "var(--inst-avaliacao-especialista-t)",
};

/** Rótulo do marco por trilha — o "primeiro" muda de substantivo (sessão
 *  × encontro), os demais já são neutros. */
function rotuloMarco(marco: MarcoJornada, dpp: boolean): string {
  return marco === "primeiro" && !dpp
    ? "Primeira sessão"
    : ROTULO_MARCO[marco];
}

/** A linha narrativa do marco — por trilha (encontro com mentor × sessão
 *  com especialista, mesma distinção do resto do /jovem). */
function detalheMarco(marco: MarcoJornada, dpp: boolean): string {
  switch (marco) {
    case "primeiro":
      return dpp
        ? "Você teve o seu 1º encontro com seu mentor."
        : "Você teve a sua 1ª sessão com especialista.";
    case "metade":
      return dpp
        ? "Metade dos encontros com seu mentor já aconteceu."
        : "Metade das sessões com especialista já aconteceu.";
    case "reta_final":
      return "Você entrou na reta final da jornada.";
    case "completo":
      return dpp
        ? "Você completou os encontros com seu mentor."
        : "Você completou as sessões com especialista.";
  }
}

/** Detalhe das conquistas de instrumento — passado, o que a entrega foi.
 *  A `descricao` da estação é a régua de fallback (instrumento novo entra
 *  na estante com a copy canônica até ganhar frase própria). */
const DETALHE_ESTACAO: Partial<Record<EstacaoChave, string>> = {
  roda_inicial:
    "Você fez a leitura inicial da Roda da Vida, o ponto de partida da sua jornada.",
  visao: "Você escreveu a sua Declaração de Visão.",
  metas: "Você definiu suas metas.",
  pdm: "Você montou o seu Plano de Desenvolvimento.",
  roda_formal:
    "Você refez a Roda da Vida e viu o antes e depois das suas áreas.",
  avaliacao_360: "Você enviou a sua avaliação final do ciclo.",
};

const ts = (iso: string | null | undefined): number =>
  iso ? Date.parse(iso) || 0 : 0;

export function conquistasDoJovem(input: ConquistasInput): ConquistasJovem {
  const trilhaPorDupla = new Map(
    input.duplas.map((d) => [d.id, d.trilha ?? "dpp"] as const)
  );
  const realizados = input.encontros.filter((e) => e.status === "realizado");
  const ehEsp = (e: { dupla_id: string }) =>
    trilhaPorDupla.get(e.dupla_id) === "especialista";
  const realizadosDpp = realizados.filter((e) => !ehEsp(e));
  const realizadosEsp = realizados.filter(ehEsp);

  // a régua dos marcos é UMA trilha — a do mentor quando existe (mesma
  // partição da home: nunca soma encontro e sessão no mesmo número)
  const temDpp = input.duplas.some(
    (d) => (d.trilha ?? "dpp") !== "especialista"
  );
  const temJornada = temDpp || realizadosEsp.length > 0;
  const daTrilha = temDpp ? realizadosDpp : realizadosEsp;
  const total = maxEncontros(temDpp ? "dpp" : "especialista");
  const feitos = daTrilha.length;
  const unidade = (n: number) =>
    temDpp
      ? `${n} ${n === 1 ? "encontro" : "encontros"} com seu mentor`
      : `${n} ${n === 1 ? "sessão" : "sessões"} com especialista`;

  // o marco é datado pelo encontro que cruzou o limiar — o p-ésimo
  // realizado por ordem de realizado_em (não por numero: a jornada pode
  // começar no meio do ciclo e os realizados saem de ordem oficial)
  const porData = [...daTrilha].sort(
    (a, b) => ts(a.realizado_em ?? a.data_hora) - ts(b.realizado_em ?? b.data_hora)
  );

  const estante: { c: Conquista; ts: number }[] = [];
  let proximoMarco: ProximoMarco | null = null;

  // sem jornada (nem dupla DPP nem sessão esp) não há régua — nada de
  // marco nem de "a caminho": a página nem renderiza o card
  for (const [marco, p] of temJornada ? limiaresMarcos(total) : []) {
    if (feitos >= p) {
      const enc = porData[p - 1];
      const data = enc?.realizado_em ?? enc?.data_hora ?? null;
      estante.push({
        ts: ts(data),
        c: {
          chave: `marco:${marco}`,
          titulo: rotuloMarco(marco, temDpp),
          detalhe: detalheMarco(marco, temDpp),
          data,
          glifo: { tipo: "phosphor", nome: ICONE_MARCO[marco] },
          tom: TOM_MARCO,
        },
      });
    } else {
      // os limiares vêm em ordem — o primeiro não cruzado é o próximo
      const falta = p - feitos;
      proximoMarco = {
        marco,
        rotulo: rotuloMarco(marco, temDpp),
        atual: feitos,
        alvo: p,
        texto: `${falta === 1 ? "Falta" : "Faltam"} ${unidade(falta)}`,
      };
      break;
    }
  }

  // instrumentos entregues — a estação feita vira conquista com a data do
  // respondido_em; a recorrente (avaliação do encontro) não entra, a
  // contagem de avaliações abaixo já a representa
  const jornada = input.jornada;
  if (jornada && (jornada.cronograma?.length ?? 0) > 0) {
    const dupla =
      input.duplas.find((d) => d.id === jornada.dupla_id) ?? null;
    const encontrosDpp = input.encontros.filter(
      (e) => e.dupla_id === jornada.dupla_id
    );
    const avaliacoesFeitas = input.avaliacoes
      .filter((a) => a.dupla_id === jornada.dupla_id)
      .map((a) => a.encontro_id)
      .filter((id): id is string => id != null);
    try {
      for (const est of estacoesJornada({
        cronograma: jornada.cronograma,
        instrumentos: jornada.instrumentos ?? [],
        avaliacao360: jornada.avaliacao_360 ?? [],
        encontros: encontrosDpp.map((e) => ({
          id: e.id,
          numero: e.numero,
          status: e.status,
          data: e.realizado_em ?? e.data_hora,
        })),
        avaliacoesFeitas,
        ativa: dupla?.status === "ativa",
        inicio: dupla?.iniciada_em,
        agora: input.agora,
      })) {
        if (est.estado !== "feito" || est.chave === "avaliacao_encontro")
          continue;
        estante.push({
          ts: ts(est.respondidoEm),
          c: {
            chave: `inst:${est.chave}`,
            titulo: est.titulo,
            detalhe: DETALHE_ESTACAO[est.chave] ?? est.descricao,
            data: est.respondidoEm,
            glifo: { tipo: "instrumento", chave: est.chave },
            tom: INSTRUMENTO_TOM[est.chave],
          },
        });
      }
    } catch {
      // jornada malformada não derruba o resto da estante — o mesmo
      // try/catch que a /materiais faz ao redor de estacoesJornada
    }
  }

  // avaliações enviadas — a estrela recorrente vira uma conta com a data
  // do envio mais recente (created_at = quando o jovem respondeu)
  const nAval = input.avaliacoes.length;
  if (nAval > 0) {
    const ultima = input.avaliacoes.reduce((a, b) =>
      ts(a.created_at) >= ts(b.created_at) ? a : b
    );
    estante.push({
      ts: ts(ultima.created_at) || Number.POSITIVE_INFINITY,
      c: {
        chave: "conta:avaliacoes",
        titulo:
          nAval === 1 ? "1 avaliação enviada" : `${nAval} avaliações enviadas`,
        detalhe: "Sua nota e seu comentário depois de cada encontro.",
        data: ultima.created_at,
        glifo: { tipo: "instrumento", chave: "avaliacao_encontro" },
        tom: INSTRUMENTO_TOM.avaliacao_encontro,
      },
    });
  }

  // combinados feitos — a view não expõe feito_em: a posição na estante
  // usa a created_at mais recente do lote e o carimbo fica vazio (sem
  // data inventada)
  const feitosComb = input.encaminhamentos.filter(
    (e) => e.status === "feito"
  );
  if (feitosComb.length > 0) {
    const datas = feitosComb.map((e) => ts(e.created_at)).filter((t) => t > 0);
    estante.push({
      ts: datas.length ? Math.max(...datas) : Number.POSITIVE_INFINITY,
      c: {
        chave: "conta:combinados",
        titulo:
          feitosComb.length === 1
            ? "1 combinado feito"
            : `${feitosComb.length} combinados feitos`,
        detalhe:
          "Tarefas que você se comprometeu a fazer entre um encontro e outro.",
        data: null,
        glifo: { tipo: "phosphor", nome: "listChecks" },
        tom: TOM_COMBINADOS,
      },
    });
  }

  // sessões com especialista — fora da régua DPP, a trilha curta vira
  // conta com a data da última sessão realizada
  if (realizadosEsp.length > 0) {
    const ultima = realizadosEsp.reduce((a, b) =>
      ts(a.realizado_em ?? a.data_hora) >= ts(b.realizado_em ?? b.data_hora)
        ? a
        : b
    );
    const data = ultima.realizado_em ?? ultima.data_hora;
    estante.push({
      ts: ts(data),
      c: {
        chave: "conta:especialista",
        titulo:
          realizadosEsp.length === 1
            ? "1 sessão com especialista"
            : `${realizadosEsp.length} sessões com especialista`,
        detalhe: "Sessões da sua trilha com o especialista.",
        data,
        glifo: { tipo: "phosphor", nome: "usersThree" },
        tom: TOM_ESPECIALISTA,
      },
    });
  }

  estante.sort((a, b) => a.ts - b.ts);
  return { conquistas: estante.map((x) => x.c), proximoMarco, temJornada };
}
