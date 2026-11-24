import { limiaresMarcos, maxEncontros } from "./ciclo";
import type { MarcoJornada } from "./ciclo";
import type { Trilha } from "./types";
import { estacoesJornada } from "./jornada";
import type {
  Estacao,
  EstacaoChave,
  JovemJornadaDados,
} from "./jornada";
import { INSTRUMENTO_TOM } from "@/components/instrumento-icone";

// "Suas conquistas" do perfil do jovem (v2 — estante estilo GitHub + faixa
// "Próximo marco" estilo Duolingo). Derivação pura: recebe os arrays já lidos
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
// de ciclo.ts); o futuro vive só na faixa "Próximo marco".

/** Glifo do emblema: o símbolo SVG do instrumento (mesma gramática do
 *  InstrumentoEmblema) ou um Phosphor canonizado — marcos mantêm
 *  Flag/Medal/FlagCheckered/Trophy da trilha, contagens usam os ícones da
 *  casa. O `familia` (024) carrega família + tier: a arte evolui por
 *  degrau (`fam-<familia>-<tier>`) e o squircle usa o Phosphor da família. */
export type ConquistaGlifo =
  | { tipo: "instrumento"; chave: EstacaoChave }
  | { tipo: "phosphor"; nome: ConquistaPhosphor }
  | { tipo: "nivel"; chave: NivelChave }
  | { tipo: "familia"; familia: FamiliaChave; tier: number };

export type ConquistaPhosphor =
  | "flag"
  | "medal"
  | "flagCheckered"
  | "trophy"
  | "listChecks"
  | "usersThree";

/** Famílias com tiers (024) — uma peça evolutiva por contagem, estilo
 *  Duolingo: o glifo é o mesmo, o metal e os raios sobem por degrau. */
export type FamiliaChave =
  | "combinados"
  | "horas"
  | "metas"
  | "submetas"
  | "avaliacoes"
  | "presenca"
  | "perfil"
  | "termo";

/** Raridade por posição na escada — inicial → constancia → marco_grande →
 *  lendaria no topo. Família de 3 degraus para no marco_grande. */
export type RaridadeConquista =
  | "inicial"
  | "constancia"
  | "marco_grande"
  | "lendaria";

/** Nº de degraus por família — o gerador de arte (badges.ts +
 *  scripts/gerar-badges.mjs) itera 1..N pra montar `fam-<fam>-<tier>.svg`. */
export const FAMILIA_TIERS: Record<FamiliaChave, number> = {
  combinados: 4,
  horas: 4,
  metas: 3,
  submetas: 3,
  avaliacoes: 3,
  presenca: 3,
  perfil: 1,
  termo: 1,
};

/** Um degrau da escada da família — o que o detalhe mostra inteiro. */
export type TierConquista = {
  /** 1-based — a posição na escada (compõe a chave `familia:tier`) */
  n: number;
  /** o nome deste degrau — "Palavra cumprida", "Voz constante" */
  titulo: string;
  /** infinitivo, o que conquista o degrau — "Concluir 15 combinados…" */
  criterio: string;
  /** passado, uma frase — a linha narrativa quando está ganho */
  detalhe: string;
  raridade: RaridadeConquista;
  ganho: boolean;
  /** o carimbo do limiar — null quando a fonte não expõe data do feito */
  data: string | null;
};

export type Conquista = {
  /** chave estável — "marco:primeiro", "inst:visao", "conta:avaliacoes";
   *  nas famílias é `familia:tier` ("conta:combinados-2") e troca quando
   *  a contagem cruza o próximo degrau */
  chave: string;
  /** nome do emblema na estante */
  titulo: string;
  /** a linha narrativa do detalhe (dialog) — passado, uma frase */
  detalhe: string;
  /** carimbo ISO — realizado_em/respondido_em da conquista (contagens:
   *  a da ocorrência mais recente). Null quando a fonte não expõe a data
   *  do feito — a view jovem_encaminhamentos não tem feito_em. */
  data: string | null;
  /** o que conquista a peça, em texto — o "como se conquista" do detalhe */
  criterio: string;
  glifo: ConquistaGlifo;
  /** par cor/tinta do emblema — var()s do globals, mesma gramática de
   *  INSTRUMENTO_TOM (os tons de instrumento vêm direto dele) */
  tom: { cor: string; tinta: string };
  /** família evolutiva (024) — ausente em marco, instrumento e contador */
  familia?: FamiliaChave;
  /** o tier desta peça na estante — o MAIOR degrau ganho da família */
  tier?: number;
  /** a escada inteira da família, pro detalhe */
  tiers?: TierConquista[];
  /** o próximo degrau — null no topo da escada */
  proximo?: {
    n: number;
    titulo: string;
    criterio: string;
    /** a linha honesta do que falta — "Faltam 3 combinados com seu mentor" */
    linha: string | null;
    progresso: { atual: number; alvo: number } | null;
  } | null;
  /** a raridade do tier em exibição — label só no detalhe */
  raridade?: RaridadeConquista;
};

export type ProximoMarco = {
  marco: MarcoJornada;
  rotulo: string;
  /** realizados até agora — o numerador da barra e da frase de progresso */
  atual: number;
  /** limiar do próximo marco — a distância sai em `texto`, nunca como
   *  denominador exibido (a régua única é `atual`/`total`, REALIZA-498) */
  alvo: number;
  /** tamanho da trilha — o denominador da frase e da barra */
  total: number;
  /** trilha de especialista — a frase fala de sessão, não de encontro */
  sessao: boolean;
  /** a frase do que falta — "Faltam 3 encontros com seu mentor" */
  texto: string;
};

/** Marco de AÇÃO da faixa "Próximo marco" no topo da jornada (485/515): o que o
 *  jovem faz, não níveis por tempo — 1º encontro, 1ª avaliação, PDM
 *  entregue, jornada concluída. Na trilha de especialista (sem PDM)
 *  ficam 3. Estado ganho/não ganho sempre em texto — marco futuro nunca
 *  vira cadeado, a linha diz o que falta. */
export type MarcoAcao = {
  /** chave estável — "primeiro", "avaliou", "pdm", "completo" */
  chave: string;
  /** nome do marco na faixa */
  titulo: string;
  /** carimbo ISO do feito — a linha do ganho é "Feito · <data>" na UI.
   *  Null quando a fonte não expõe a data. */
  data: string | null;
  /** estado em texto quando "Feito · data" não basta: a contagem do
   *  ganho ("Avaliou 4 encontros") ou o que falta ("Faltam 12 encontros",
   *  "Libera no encontro 6"). Null no ganho datado. */
  linha: string | null;
  glifo: ConquistaGlifo;
  /** par cor/tinta do emblema ganho — tons da casa, mesma gramática da
   *  estante (o não ganho é apagado na UI, sem consumir o tom) */
  tom: { cor: string; tinta: string };
  /** progresso quantificável do marco — vira barra na faixa (marco
   *  binário, como avaliar ou entregar o PDM, não tem) */
  progresso: { atual: number; alvo: number } | null;
  ganho: boolean;
  /** o primeiro marco não ganho — o único que a faixa mostra (515) */
  proximo: boolean;
};

/** Peça que ainda vem (016) — mora numa área separada da estante, apagada
 *  e NUNCA cadeado: o critério em texto e, quando a fonte permite contar,
 *  o progresso. Não tem data: o futuro não se carimba. */
export type ConquistaFutura = {
  /** a mesma chave que a peça terá na estante quando chegar */
  chave: string;
  titulo: string;
  criterio: string;
  /** o que falta, em texto ("Faltam 4 encontros com seu mentor", "Libera
   *  no encontro 6"). Null quando não há contagem honesta. */
  linha: string | null;
  progresso: { atual: number; alvo: number } | null;
  /** o próximo marco da régua — o anel --destaque da casa */
  proximo: boolean;
  glifo: ConquistaGlifo;
  tom: { cor: string; tinta: string };
  /** família evolutiva (024) — a futura de família mostra o PRÓXIMO tier
   *  (título e glifo do degrau que vem) com o progresso honesto */
  familia?: FamiliaChave;
  /** o degrau que esta futura representa — 1-based */
  tier?: number;
  /** a escada inteira da família, pro detalhe */
  tiers?: TierConquista[];
  raridade?: RaridadeConquista;
};

/** As 4 faixas de nível por tempo de programa (016): a permanência é o
 *  eixo e a participação é piso — ninguém chega à Veterania só esperando. */
export type NivelChave = "inicio" | "constancia" | "veterania" | "completa";

export type NivelJornada = {
  chave: NivelChave;
  titulo: string;
  /** a régua da faixa em texto — "3 meses de programa e 8 encontros com
   *  seu mentor" */
  criterio: string;
  /** o que a faixa reconhece — a linha do detalhe */
  detalhe: string;
  /** ganho = critério cumprido; superado = uma faixa acima já chegou sem
   *  esta ter cumprido o tempo (a trilha fechou antes); futuro = ainda não */
  estado: "ganho" | "superado" | "futuro";
  /** quando o critério se cumpriu — o mais tarde entre o dia de programa
   *  e o encontro-limiar, ambos reais. Null fora do ganho. */
  data: string | null;
  glifo: ConquistaGlifo;
  tom: { cor: string; tinta: string };
};

export type NiveisJornada = {
  /** as 4 faixas em ordem, sempre — a régua inteira é visível */
  faixas: NivelJornada[];
  /** a faixa mais alta alcançada — null antes de a jornada começar */
  atual: NivelChave | null;
  /** a próxima faixa e quanto falta — null quando a jornada completou */
  proximo: {
    chave: NivelChave;
    /** contagem do que falta, nunca data projetada. Null quando a dupla
     *  parou (pausada/encerrada): a contagem não anda sem encontro */
    falta: string | null;
    encontros: { atual: number; alvo: number };
    /** null quando a faixa não pede tempo (início e jornada completa) */
    dias: { atual: number; alvo: number } | null;
  } | null;
  /** dias somados dentro de dupla da régua — null sem data de início */
  diasDePrograma: number | null;
  /** nenhuma dupla da régua ativa: a pausa congela a contagem */
  parada: "pausada" | "encerrada" | null;
  /** trilha de especialista — a UI fala de sessão, não de encontro */
  sessao: boolean;
};

export type ConquistasJovem = {
  /** estante em ordem cronológica; sem data vai pro fim (a contagem de
   *  combinados acumula — não é um instante) */
  conquistas: Conquista[];
  /** área separada das que ainda vêm (016) — vazia quando tudo foi
   *  conquistado ou não há jornada */
  futuras: ConquistaFutura[];
  /** níveis por tempo de programa (016) — null sem jornada */
  nivel: NiveisJornada | null;
  /** o próximo limiar a cruzar — null quando a jornada está completa ou
   *  não existe */
  proximoMarco: ProximoMarco | null;
  /** os marcos de ação da faixa "Próximo marco" no topo da jornada (485) —
   *  vazio quando não há jornada */
  marcos: MarcoAcao[];
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
    /** a família de horas (024): só o minutado registrado conta — encontro
     *  sem duracao_min não soma nada (nunca assume 60min) */
    duracao_min?: number | null;
    /** sessão combinada (0226): as rows do grupo dividem UMA hora física —
     *  a família de horas deduplica por ela */
    sessao_id?: string | null;
  }[];
  /** getJovemDuplas() — trilha/status/início por dupla */
  duplas: {
    id: string | null;
    trilha: string | null;
    status: string | null;
    iniciada_em: string | null;
    /** fecha o relógio do nível — sem ela, dupla encerrada continuaria
     *  envelhecendo até a Veterania */
    encerrada_em?: string | null;
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
  /** getJovemAssinaturas() (024) — a família "termo" lê o slug
   *  termo-mentorando; sem a leitura a peça só não aparece */
  assinaturas?: {
    slug: string | null;
    status: string | null;
    assinado_em: string | null;
  }[];
  /** itens do PDM das duplas DPP (024) — getPdmDaDupla por dupla,
   *  já achatados; as famílias metas/submetas contam os "atingida" */
  pdmItens?: {
    parentId: string | null;
    status: string;
    atingidaEm: string | null;
  }[];
  /** a ficha do jovem (024) — a família "perfil" pede WhatsApp +
   *  disponibilidade + bio ou interesses; a página resolve o booleano
   *  bio/interesses entre me.bio e perfil.interesses */
  perfil?: {
    whatsapp: string | null;
    disponibilidade: unknown;
    bioOuInteresses: boolean;
  } | null;
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

/** Critério das conquistas de instrumento — infinitivo, o que conquista a
 *  peça (estante e área das futuras falam a mesma frase). */
const CRITERIO_ESTACAO: Partial<Record<EstacaoChave, string>> = {
  roda_inicial: "Fazer a leitura inicial da Roda da Vida",
  visao: "Escrever a sua Declaração de Visão",
  metas: "Definir as suas metas",
  pdm: "Montar o seu Plano de Desenvolvimento",
  roda_formal: "Refazer a Roda da Vida no fim do ciclo",
  avaliacao_360: "Enviar a sua avaliação final do ciclo",
};

const criterioEstacao = (est: Estacao): string =>
  CRITERIO_ESTACAO[est.chave] ?? `Responder: ${est.titulo}`;

// tom das faixas de nível: o amarelo --destaque é a cor da jornada e da
// celebração na casa (nunca alerta)
const TOM_NIVEL = { cor: "var(--brand-ink)", tinta: "var(--destaque)" };

/** Régua das faixas por trilha. Tempo é dia corrido DENTRO de dupla da
 *  trilha (lacuna entre duplas não conta); encontros são os realizados.
 *  A especialista dura ~3 meses inteira, então a régua dela encurta —
 *  "3 meses" lá seria o fim da trilha, não a permanência. */
const REGUA_NIVEL: Record<
  Trilha,
  Record<"constancia" | "veterania", { dias: number; encontros: number }>
> = {
  dpp: {
    constancia: { dias: 30, encontros: 4 },
    veterania: { dias: 90, encontros: 8 },
  },
  especialista: {
    constancia: { dias: 30, encontros: 2 },
    veterania: { dias: 60, encontros: 3 },
  },
};

const TITULO_NIVEL: Record<NivelChave, string> = {
  inicio: "Início",
  constancia: "Constância",
  veterania: "Veterania",
  completa: "Jornada completa",
};

const DIA_MS = 86_400_000;

const ts = (iso: string | null | undefined): number =>
  iso ? Date.parse(iso) || 0 : 0;

/** Data-only (iniciada_em) vira o meio-dia de São Paulo — a mesma leitura
 *  do formatDate; instante completo passa direto. */
const tsDia = (iso: string | null | undefined): number =>
  iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? Date.parse(`${iso}T12:00:00-03:00`)
    : ts(iso);

/** O meio-dia (São Paulo) do dia do instante — os dias de programa são de
 *  calendário: encontro às 19h de 12 dias atrás conta 12, não 11. */
const meioDia = (ms: number): number =>
  Date.parse(
    `${new Date(ms - 3 * 3_600_000).toISOString().slice(0, 10)}T12:00:00-03:00`
  );

const meses = (dias: number) => {
  const m = Math.round(dias / 30);
  return m === 1 ? "1 mês" : `${m} meses`;
};

/** "Faltam 4 encontros e 56 dias" — concorda com o primeiro termo; a
 *  unidade longa ("com seu mentor") só quando o encontro vem sozinho. */
function textoFalta(
  enc: number,
  dias: number,
  unidade: (n: number) => string,
  curta: (n: number) => string
): string | null {
  if (enc <= 0 && dias <= 0) return null;
  const n = enc > 0 ? enc : dias;
  const verbo = n === 1 ? "Falta" : "Faltam";
  const ds = `${dias} ${dias === 1 ? "dia" : "dias"}`;
  if (enc > 0 && dias > 0) return `${verbo} ${curta(enc)} e ${ds}`;
  if (enc > 0) return `${verbo} ${unidade(enc)}`;
  return `${verbo} ${ds} de programa`;
}

/** A linha do PDM não ganho — herda o texto honesto da estação (a
 *  liberação do guia ou o detalhe da re-emissão) com inicial maiúscula;
 *  a_fazer sem detalhe é a espera pela resposta dela. */
function linhaPdmPendente(est: Estacao): string {
  const t =
    est.estado === "a_fazer"
      ? (est.detalhe ?? "Esperando sua resposta")
      : (est.detalhe ?? est.janela.label);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Níveis por tempo de programa (016). Tempo é a soma dos dias dentro de
 *  dupla da trilha da régua — de iniciada_em (ou do 1º encontro, quando a
 *  dupla não tem data) até hoje, ou até encerrada_em na dupla fechada;
 *  lacuna entre uma dupla e outra não conta. Toda data sai de carimbo
 *  real: o dia em que a soma cruzou o limiar ou o encontro que cruzou o
 *  piso, o que veio por último. Nada se projeta pro futuro. */
function niveisDaJornada(a: {
  trilha: Trilha;
  duplas: ConquistasInput["duplas"];
  /** realizados da trilha, por ordem de realizado_em */
  porData: ConquistasInput["encontros"];
  total: number;
  agora: number;
  curta: (n: number) => string;
  unidade: (n: number) => string;
  criterioCompleta: string;
}): NiveisJornada {
  const { trilha, porData, total, agora } = a;
  const quando = (e: ConquistasInput["encontros"][number] | undefined) =>
    e ? ts(e.realizado_em ?? e.data_hora) || null : null;
  const daRegua = a.duplas.filter(
    (d) => ((d.trilha ?? "dpp") === "especialista") === (trilha === "especialista")
  );

  const intervalos: [number, number][] = [];
  for (const d of daRegua) {
    const dela = porData.filter((e) => e.dupla_id === d.id);
    const t0 = tsDia(d.iniciada_em) || quando(dela[0]);
    if (!t0 || t0 > agora) continue;
    const ini = meioDia(t0);
    const fechada = d.status === "encerrada" || d.status === "concluida";
    const fim = meioDia(
      fechada
        ? tsDia(d.encerrada_em) || quando(dela[dela.length - 1]) || t0
        : agora
    );
    intervalos.push([ini, Math.min(Math.max(fim, ini), meioDia(agora))]);
  }
  // remanejo pode encavalar a dupla nova na antiga: o dia conta uma vez
  intervalos.sort((x, y) => x[0] - y[0]);
  const unidos: [number, number][] = [];
  for (const [i, f] of intervalos) {
    const u = unidos[unidos.length - 1];
    if (u && i <= u[1]) u[1] = Math.max(u[1], f);
    else unidos.push([i, f]);
  }
  const diasDePrograma = unidos.length
    ? Math.floor(unidos.reduce((s, [i, f]) => s + f - i, 0) / DIA_MS)
    : null;
  /** o instante em que a soma de dias cruzou `n` — null se não cruzou */
  const cruzouDias = (n: number): number | null => {
    let acc = 0;
    for (const [i, f] of unidos) {
      if (acc + (f - i) >= n * DIA_MS) return i + (n * DIA_MS - acc);
      acc += f - i;
    }
    return null;
  };

  const feitos = porData.length;
  const regua = REGUA_NIVEL[trilha];
  const comeco = [unidos[0]?.[0], quando(porData[0])].filter(
    (t): t is number => t != null && t <= agora
  );
  const dataDe = (chave: NivelChave): number | null => {
    switch (chave) {
      case "inicio":
        return comeco.length ? Math.min(...comeco) : null;
      case "completa":
        return feitos >= total ? quando(porData[total - 1]) : null;
      default: {
        const r = regua[chave];
        const t = cruzouDias(r.dias);
        const e = quando(porData[r.encontros - 1]);
        return t != null && e != null ? Math.max(t, e) : null;
      }
    }
  };

  const esp = trilha === "especialista";
  const CRITERIO: Record<NivelChave, string> = {
    inicio: esp
      ? "Começar a trilha com especialista"
      : "Começar a jornada com seu mentor",
    constancia: `${meses(regua.constancia.dias)} de programa e ${a.unidade(regua.constancia.encontros)}`,
    veterania: `${meses(regua.veterania.dias)} de programa e ${a.unidade(regua.veterania.encontros)}`,
    completa: a.criterioCompleta,
  };
  const DETALHE: Record<NivelChave, string> = {
    inicio: "Toda jornada começa num primeiro passo. A sua já começou.",
    constancia: `Você seguiu firme no seu primeiro mês de programa, ${esp ? "sessão após sessão" : "encontro após encontro"}.`,
    veterania: `${meses(regua.veterania.dias)} de programa: você já tem história para contar aqui.`,
    completa: esp
      ? "Você completou as sessões com especialista."
      : "Você completou os encontros com seu mentor.",
  };

  const ordem: NivelChave[] = ["inicio", "constancia", "veterania", "completa"];
  const datas = ordem.map(dataDe);
  const topo = datas.reduce<number>((m, d, i) => (d != null ? i : m), -1);
  const faixas: NivelJornada[] = ordem.map((chave, i) => ({
    chave,
    titulo: TITULO_NIVEL[chave],
    criterio: CRITERIO[chave],
    detalhe: DETALHE[chave],
    estado: datas[i] != null ? "ganho" : i < topo ? "superado" : "futuro",
    data: datas[i] != null ? new Date(datas[i]!).toISOString() : null,
    glifo: { tipo: "nivel", chave },
    tom: TOM_NIVEL,
  }));

  const ativa = daRegua.some((d) => d.status === "ativa");
  const parada = ativa
    ? null
    : daRegua.some((d) => d.status === "pausada")
      ? "pausada"
      : daRegua.length
        ? "encerrada"
        : null;

  const prox = ordem[topo + 1] ?? null;
  let proximo: NiveisJornada["proximo"] = null;
  if (prox) {
    const piso =
      prox === "inicio" ? 1 : prox === "completa" ? total : regua[prox].encontros;
    const alvoDias =
      prox === "constancia" || prox === "veterania" ? regua[prox].dias : null;
    const dias = diasDePrograma ?? 0;
    proximo = {
      chave: prox,
      falta: parada
        ? null
        : textoFalta(
            Math.max(0, piso - feitos),
            alvoDias == null ? 0 : Math.max(0, alvoDias - dias),
            a.unidade,
            a.curta
          ),
      encontros: { atual: Math.min(feitos, piso), alvo: piso },
      dias: alvoDias == null ? null : { atual: Math.min(dias, alvoDias), alvo: alvoDias },
    };
  }

  return {
    faixas,
    atual: topo >= 0 ? ordem[topo] : null,
    proximo,
    diasDePrograma,
    parada,
    sessao: esp,
  };
}

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
  const curta = (n: number) =>
    temDpp
      ? `${n} ${n === 1 ? "encontro" : "encontros"}`
      : `${n} ${n === 1 ? "sessão" : "sessões"}`;
  const unidade = (n: number) =>
    `${curta(n)} ${temDpp ? "com seu mentor" : "com especialista"}`;
  const criterioMarco = (marco: MarcoJornada, p: number): string =>
    marco === "primeiro"
      ? temDpp
        ? "Ter o 1º encontro com seu mentor"
        : "Ter a 1ª sessão com especialista"
      : marco === "completo"
        ? temDpp
          ? `Completar os ${total} encontros com seu mentor`
          : `Completar as ${total} sessões com especialista`
        : `Chegar a ${unidade(p)}`;

  // o marco é datado pelo encontro que cruzou o limiar — o p-ésimo
  // realizado por ordem de realizado_em (não por numero: a jornada pode
  // começar no meio do ciclo e os realizados saem de ordem oficial)
  const porData = [...daTrilha].sort(
    (a, b) => ts(a.realizado_em ?? a.data_hora) - ts(b.realizado_em ?? b.data_hora)
  );

  const estante: { c: Conquista; ts: number }[] = [];
  const futuras: ConquistaFutura[] = [];
  let proximoMarco: ProximoMarco | null = null;

  // sem jornada (nem dupla DPP nem sessão esp) não há régua — nada de
  // marco nem de "próximo": a página nem renderiza o card
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
          criterio: criterioMarco(marco, p),
          glifo: { tipo: "phosphor", nome: ICONE_MARCO[marco] },
          tom: TOM_MARCO,
        },
      });
      continue;
    }
    // os limiares vêm em ordem — o primeiro não cruzado é o próximo; os
    // de depois vão pra área das futuras com a mesma contagem
    const falta = p - feitos;
    const texto = `${falta === 1 ? "Falta" : "Faltam"} ${unidade(falta)}`;
    if (!proximoMarco)
      proximoMarco = {
        marco,
        rotulo: rotuloMarco(marco, temDpp),
        atual: feitos,
        alvo: p,
        total,
        sessao: !temDpp,
        texto,
      };
    futuras.push({
      chave: `marco:${marco}`,
      titulo: rotuloMarco(marco, temDpp),
      criterio: criterioMarco(marco, p),
      linha: texto,
      progresso: { atual: feitos, alvo: p },
      proximo: proximoMarco.marco === marco,
      glifo: { tipo: "phosphor", nome: ICONE_MARCO[marco] },
      tom: TOM_MARCO,
    });
  }

  // instrumentos entregues — a estação feita vira conquista com a data do
  // respondido_em; a recorrente (avaliação do encontro) não entra, a
  // contagem de avaliações abaixo já a representa
  const jornada = input.jornada;
  // o estado da estação PDM alimenta o marco "pdm" da faixa — capturado
  // na mesma passada dos instrumentos (sem segunda derivação)
  let estPdm: Estacao | null = null;
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
        if (est.chave === "pdm") estPdm = est;
        if (est.chave === "avaliacao_encontro") continue;
        if (est.estado !== "feito") {
          // o texto honesto da estação (liberação, espera) é a linha da
          // futura — mesma fonte do marco PDM da faixa
          futuras.push({
            chave: `inst:${est.chave}`,
            titulo: est.titulo,
            criterio: criterioEstacao(est),
            linha: linhaPdmPendente(est),
            progresso: null,
            proximo: false,
            glifo: { tipo: "instrumento", chave: est.chave },
            tom: INSTRUMENTO_TOM[est.chave],
          });
          continue;
        }
        estante.push({
          ts: ts(est.respondidoEm),
          c: {
            chave: `inst:${est.chave}`,
            titulo: est.titulo,
            detalhe: DETALHE_ESTACAO[est.chave] ?? est.descricao,
            data: est.respondidoEm,
            criterio: criterioEstacao(est),
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
        criterio: temDpp
          ? "Avaliar um encontro depois que ele acontece"
          : "Avaliar uma sessão depois que ela acontece",
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
        criterio: "Concluir um combinado com seu mentor",
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
        criterio: "Fazer uma sessão com especialista",
        glifo: { tipo: "phosphor", nome: "usersThree" },
        tom: TOM_ESPECIALISTA,
      },
    });
  }

  // ---------- famílias com tiers (024): uma peça evolutiva por contagem,
  // estilo Duolingo. O glifo é o mesmo a família inteira — o metal e os
  // raios da arte sobem por degrau; a estante guarda só o MAIOR tier
  // ganho; a escada inteira abre no detalhe; a futura mostra o próximo
  // tier com o progresso honesto. Derivação pura nos dois sentidos: a
  // contagem caiu, o tier desce junto (um combinado desfeito volta a
  // família pra área das futuras)

  /** a raridade segue a posição na escada — família de 3 degraus para no
   *  marco_grande; só a de 4 toca a lendaria */
  const RARIDADE_TIER: RaridadeConquista[] = [
    "inicial",
    "constancia",
    "marco_grande",
    "lendaria",
  ];

  type FamiliaSpec = {
    familia: FamiliaChave;
    /** prefixo da chave estável — `conta:combinados` vira `…-2` no tier 2 */
    prefixo: string;
    tom: { cor: string; tinta: string };
    tiers: { limiar: number; titulo: string; detalhe: string }[];
    criterio: (limiar: number) => string;
    /** a linha honesta do que falta — recebe a distância pro limiar */
    linha: (falta: number) => string | null;
  };

  function emiteFamilia(
    spec: FamiliaSpec,
    /** a contagem atual da família — minutos nas horas, inteira no resto */
    n: number,
    /** o carimbo do limiar — a data do evento que o cruzou; null quando a
     *  fonte não expõe data do feito (combinados não têm feito_em) */
    dataNo: (limiar: number) => string | null,
    /** a barra do próximo degrau, na unidade de exibição da família —
     *  recebe o limiar pra montar o denominador (horas mostra "5 de 7",
     *  não "300 de 420"); null na peça binária */
    progFn: ((limiarProx: number) => { atual: number; alvo: number }) | null
  ): void {
    const tiers: TierConquista[] = spec.tiers.map((t, i) => ({
      n: i + 1,
      titulo: t.titulo,
      detalhe: t.detalhe,
      criterio: spec.criterio(t.limiar),
      raridade: RARIDADE_TIER[Math.min(i, RARIDADE_TIER.length - 1)],
      ganho: n >= t.limiar,
      data: n >= t.limiar ? dataNo(t.limiar) : null,
    }));
    const ganhoAte = tiers.reduce<number>((m, t) => (t.ganho ? t.n : m), 0);
    const proxT = ganhoAte < tiers.length ? tiers[ganhoAte] : null;
    const proximo = proxT
      ? {
          n: proxT.n,
          titulo: proxT.titulo,
          criterio: proxT.criterio,
          linha: spec.linha(Math.max(0, spec.tiers[ganhoAte].limiar - n)),
          progresso: progFn
            ? (() => {
                const p = progFn(spec.tiers[ganhoAte].limiar);
                return { atual: Math.min(p.atual, p.alvo), alvo: p.alvo };
              })()
            : null,
        }
      : null;
    if (ganhoAte > 0) {
      const t = tiers[ganhoAte - 1];
      estante.push({
        ts: t.data ? ts(t.data) : Number.POSITIVE_INFINITY,
        c: {
          chave: `${spec.prefixo}-${t.n}`,
          titulo: t.titulo,
          detalhe: t.detalhe,
          data: t.data,
          criterio: t.criterio,
          glifo: { tipo: "familia", familia: spec.familia, tier: t.n },
          tom: spec.tom,
          familia: spec.familia,
          tier: t.n,
          tiers,
          proximo,
          raridade: t.raridade,
        },
      });
    }
    if (proxT) {
      futuras.push({
        chave: `${spec.prefixo}-${proxT.n}`,
        titulo: proxT.titulo,
        criterio: proxT.criterio,
        linha: proximo!.linha,
        progresso: proximo!.progresso,
        proximo: false,
        glifo: { tipo: "familia", familia: spec.familia, tier: proxT.n },
        tom: spec.tom,
        familia: spec.familia,
        tier: proxT.n,
        tiers,
        raridade: proxT.raridade,
      });
    }
  }

  const plural = (n: number, um: string, muitos: string) =>
    n === 1 ? um : muitos;

  // combinados feitos — 4 degraus; a view não expõe feito_em, então os
  // tiers não carimbam data e a peça ordena no fim da estante. Mesma
  // régua de não-promessa do contador: a futura só nasce na trilha do
  // mentor ou quando já existe combinado feito
  if (temDpp || feitosComb.length > 0) {
    emiteFamilia(
      {
        familia: "combinados",
        prefixo: "conta:combinados",
        tom: TOM_COMBINADOS,
        tiers: [
          {
            limiar: 5,
            titulo: "Palavra cumprida",
            detalhe:
              "Cinco tarefas ditas e feitas. Aqui, combinado é compromisso.",
          },
          {
            limiar: 15,
            titulo: "De palavra",
            detalhe:
              "Quinze combinados concluídos: o que você diz, acontece.",
          },
          {
            limiar: 30,
            titulo: "Compromisso em série",
            detalhe: "Trinta combinados fechados, um depois do outro.",
          },
          {
            limiar: 50,
            titulo: "Lenda da palavra",
            detalhe: "Cinquenta combinados. Pouca gente chega aqui.",
          },
        ],
        criterio: (l) =>
          `Concluir ${l} ${plural(l, "combinado", "combinados")}${temDpp ? " com seu mentor" : ""}`,
        linha: (f) =>
          `${f === 1 ? "Falta" : "Faltam"} ${f} ${plural(f, "combinado", "combinados")}${temDpp ? " com seu mentor" : ""}`,
      },
      feitosComb.length,
      () => null,
      (l) => ({ atual: feitosComb.length, alvo: l })
    );
  }

  // horas de encontro — só o duracao_min registrado conta; a sessão
  // combinada (0226) é UMA hora física, então deduplica por sessao_id
  // (a row coberta tem o mesmo min da âncora). O carimbo do tier é o
  // realizado_em do encontro que cruzou o limiar
  const sessoes = new Map<string, { min: number; quando: string | null }>();
  for (const e of daTrilha) {
    const min = e.duracao_min;
    if (min == null || min <= 0) continue;
    const k = e.sessao_id ?? e.id;
    const quando = e.realizado_em ?? e.data_hora;
    const s = sessoes.get(k);
    if (s) {
      if (ts(quando) < ts(s.quando)) s.quando = quando;
      continue;
    }
    sessoes.set(k, { min, quando });
  }
  const ordemHoras = [...sessoes.values()].sort(
    (a, b) => ts(a.quando) - ts(b.quando)
  );
  const minTotal = ordemHoras.reduce((s, x) => s + x.min, 0);
  const fmtHoras = (min: number): string => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h <= 0) return `${m}min`;
    return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
  };
  if (temJornada) {
    emiteFamilia(
      {
        familia: "horas",
        prefixo: "conta:horas",
        tom: TOM_MARCO,
        tiers: [
          {
            limiar: 420,
            titulo: "Sete horas",
            detalhe:
              "Sete horas cara a cara: a conversa já vira repertório.",
          },
          {
            limiar: 900,
            titulo: "Mês de conversas",
            detalhe: "Quinze horas de escuta compartilhada.",
          },
          {
            limiar: 1800,
            titulo: "Semestre de escuta",
            detalhe: "Trinta horas juntos: um semestre inteiro de conversa.",
          },
          {
            limiar: 3000,
            titulo: "Horas de casa",
            detalhe: "Cinquenta horas de programa: tempo de casa.",
          },
        ],
        criterio: (l) =>
          `Acumular ${l / 60} ${plural(l / 60, "hora", "horas")} de ${temDpp ? "encontro" : "sessão"} registradas`,
        linha: (f) =>
          `${f === 1 ? "Falta" : "Faltam"} ${fmtHoras(f)} para o próximo nível`,
      },
      minTotal,
      (limiar) => {
        let acc = 0;
        for (const s of ordemHoras) {
          acc += s.min;
          if (acc >= limiar) return s.quando;
        }
        return null;
      },
      (l) => ({
        atual: Math.floor(Math.min(minTotal, l) / 60),
        alvo: l / 60,
      })
    );
  }

  // metas e submetas do PDM — só na trilha do mentor (o especialista não
  // tem PDM); a régua de não-promessa é a mesma do conta:combinados
  if (temDpp) {
    const atingidas = (raiz: boolean) =>
      (input.pdmItens ?? [])
        .filter((i) => i.status === "atingida" && (i.parentId == null) === raiz)
        .sort((a, b) => ts(a.atingidaEm) - ts(b.atingidaEm));
    const metasAt = atingidas(true);
    const subsAt = atingidas(false);
    emiteFamilia(
      {
        familia: "metas",
        prefixo: "pdm:metas",
        tom: INSTRUMENTO_TOM.pdm,
        tiers: [
          {
            limiar: 1,
            titulo: "Primeira meta",
            detalhe: "A primeira meta do seu plano saiu do papel.",
          },
          {
            limiar: 3,
            titulo: "No rumo",
            detalhe: "Três metas cumpridas: o plano deixou de ser intenção.",
          },
          {
            limiar: 5,
            titulo: "Plano em movimento",
            detalhe: "Cinco metas atingidas: o plano anda.",
          },
        ],
        criterio: (l) =>
          `Marcar ${l} ${plural(l, "meta", "metas")} do PDM como ${plural(l, "atingida", "atingidas")}`,
        linha: (f) =>
          `${f === 1 ? "Falta" : "Faltam"} ${f} ${plural(f, "meta", "metas")} ${plural(f, "atingida", "atingidas")}`,
      },
      metasAt.length,
      (l) => metasAt[l - 1]?.atingidaEm ?? null,
      (l) => ({ atual: metasAt.length, alvo: l })
    );
    emiteFamilia(
      {
        familia: "submetas",
        prefixo: "pdm:submetas",
        tom: INSTRUMENTO_TOM.pdm,
        tiers: [
          {
            limiar: 3,
            titulo: "Passo a passo",
            detalhe: "Três passos do plano já ficaram pra trás.",
          },
          {
            limiar: 10,
            titulo: "Tijolo a tijolo",
            detalhe: "Dez submetas atingidas: a obra cresce por dentro.",
          },
          {
            limiar: 25,
            titulo: "Obra aberta",
            detalhe: "Vinte e cinco passos concluídos do seu plano.",
          },
        ],
        criterio: (l) =>
          `Marcar ${l} ${plural(l, "submeta", "submetas")} do PDM como ${plural(l, "atingida", "atingidas")}`,
        linha: (f) =>
          `${f === 1 ? "Falta" : "Faltam"} ${f} ${plural(f, "submeta", "submetas")} ${plural(f, "atingida", "atingidas")}`,
      },
      subsAt.length,
      (l) => subsAt[l - 1]?.atingidaEm ?? null,
      (l) => ({ atual: subsAt.length, alvo: l })
    );
  }

  // avaliações enviadas — a mesma fonte do contador (a estante guarda os
  // dois: a conta viva e a família nomeada); o carimbo do tier é o
  // created_at da avaliação que cruzou o limiar
  if (temJornada) {
    const avalOrdem = [...input.avaliacoes].sort(
      (a, b) => ts(a.created_at) - ts(b.created_at)
    );
    emiteFamilia(
      {
        familia: "avaliacoes",
        prefixo: "conta:avaliacoes",
        tom: INSTRUMENTO_TOM.avaliacao_encontro,
        tiers: [
          {
            limiar: 5,
            titulo: "Voz treinada",
            detalhe: "Cinco avaliações enviadas: a sua opinião guia a dupla.",
          },
          {
            limiar: 15,
            titulo: "Voz constante",
            detalhe: "Quinze avaliações: você avalia toda vez.",
          },
          {
            limiar: 30,
            titulo: "Voz do programa",
            detalhe: "Trinta avaliações: a sua leitura faz parte do ciclo.",
          },
        ],
        criterio: (l) =>
          `Enviar ${l} ${plural(l, "avaliação", "avaliações")} de ${temDpp ? "encontro" : "sessão"}`,
        linha: (f) =>
          `${f === 1 ? "Falta" : "Faltam"} ${f} ${plural(f, "avaliação", "avaliações")} enviadas`,
      },
      nAval,
      (l) => avalOrdem[l - 1]?.created_at ?? null,
      (l) => ({ atual: nAval, alvo: l })
    );
  }

  // presença — o run de realizado sem nao_aconteceu intercalado na trilha
  // da régua (agendado não quebra); o carimbo é o último da sequência
  if (temJornada) {
    const ordemTrilha = input.encontros
      .filter((e) => (temDpp ? !ehEsp(e) : ehEsp(e)))
      .sort(
        (a, b) =>
          ts(a.data_hora ?? a.realizado_em) - ts(b.data_hora ?? b.realizado_em)
      );
    let run = 0;
    const marcoRun = new Map<number, string | null>();
    for (const e of ordemTrilha) {
      if (e.status === "realizado") {
        run += 1;
        marcoRun.set(run, e.realizado_em ?? e.data_hora);
      } else if (e.status === "nao_aconteceu") {
        run = 0;
      }
    }
    const seguidos = run;
    emiteFamilia(
      {
        familia: "presenca",
        prefixo: "conta:presenca",
        tom: TOM_MARCO,
        tiers: [
          {
            limiar: 4,
            titulo: "Não faltou",
            detalhe: `Quatro ${temDpp ? "encontros" : "sessões"} seguidos, nenhuma falta: presença é rotina.`,
          },
          {
            limiar: 8,
            titulo: "Presença limpa",
            detalhe: "Oito seguidos sem faltar: ninguém precisou te lembrar.",
          },
          {
            limiar: 16,
            titulo: "Ciclo inteiro",
            detalhe: "O ciclo inteiro de presença limpa.",
          },
        ],
        criterio: (l) =>
          `Realizar ${l} ${temDpp ? "encontros" : "sessões"} seguidos sem faltar`,
        linha: (f) =>
          `${f === 1 ? "Falta" : "Faltam"} ${f} ${temDpp ? "encontros" : "sessões"} seguidos sem faltar`,
      },
      seguidos,
      (l) => marcoRun.get(l) ?? null,
      (l) => ({ atual: seguidos, alvo: l })
    );
  }

  // ---------- peças gerais (024): chegam sem jornada — são as primeiras
  // da estante de quem ainda não tem dupla; binárias, então a futura
  // traz a linha do que falta em vez de barra

  // perfil completo — WhatsApp + disponibilidade + (bio ou interesses)
  const perfil = input.perfil ?? null;
  const faltamFicha: string[] = [];
  if (perfil) {
    if (!perfil.whatsapp?.trim()) faltamFicha.push("WhatsApp");
    if (perfil.disponibilidade == null) faltamFicha.push("disponibilidade");
    if (!perfil.bioOuInteresses) faltamFicha.push("bio ou interesses");
  }
  emiteFamilia(
    {
      familia: "perfil",
      prefixo: "perfil:completo",
      tom: INSTRUMENTO_TOM.intake_mentorado,
      tiers: [
        {
          limiar: 1,
          titulo: "Cara do lugar",
          detalhe: "Ficha completa: quem te acompanha sabe quem você é.",
        },
      ],
      criterio: () =>
        "Completar a ficha: WhatsApp, disponibilidade e bio ou interesses",
      linha: () =>
        perfil == null
          ? "Completar a ficha do perfil"
          : faltamFicha.length === 1
            ? `Falta preencher: ${faltamFicha[0]}`
            : `Faltam preencher: ${faltamFicha.join(", ").replace(/, ([^,]*)$/, " e $1")}`,
    },
    perfil != null && faltamFicha.length === 0 ? 1 : 0,
    () => null,
    null
  );

  // termo assinado — o Termo de Adesão e Participação do onboarding
  const termo = (input.assinaturas ?? []).find(
    (a) => a.slug === "termo-mentorando"
  );
  emiteFamilia(
    {
      familia: "termo",
      prefixo: "doc:termo",
      tom: INSTRUMENTO_TOM.intake_mentorado,
      tiers: [
        {
          limiar: 1,
          titulo: "Termo assinado",
          detalhe: "O documento que abre a sua jornada, assinado.",
        },
      ],
      criterio: () => "Assinar o Termo de Adesão e Participação",
      linha: () => "O seu termo está esperando a assinatura",
    },
    termo?.status === "assinado" ? 1 : 0,
    () => termo?.assinado_em ?? null,
    null
  );

  // ---------- marcos de ação (485/515 — a faixa "Próximo marco" no topo
  // da jornada): o que a jovem faz, não o tempo que ela fica. Sem jornada
  // contas que ainda não começaram — só as que a jornada sempre traz: a
  // avaliação vem depois de todo encontro; o combinado, na trilha do
  // mentor ou quando já existe um em aberto. Sessão com especialista é
  // caminho opcional: não vira promessa na área das futuras
  if (temJornada && nAval === 0) {
    const semAval = [...daTrilha].sort((a, b) => a.numero - b.numero)[0];
    futuras.push({
      chave: "conta:avaliacoes",
      titulo: "Primeira avaliação",
      criterio: temDpp
        ? "Avaliar um encontro depois que ele acontece"
        : "Avaliar uma sessão depois que ela acontece",
      linha: semAval
        ? temDpp
          ? `Falta avaliar o encontro ${semAval.numero}`
          : `Falta avaliar a sessão ${semAval.numero}`
        : temDpp
          ? "Depois do 1º encontro"
          : "Depois da 1ª sessão",
      progresso: null,
      proximo: false,
      glifo: { tipo: "instrumento", chave: "avaliacao_encontro" },
      tom: INSTRUMENTO_TOM.avaliacao_encontro,
    });
  }
  const abertos = input.encaminhamentos.filter(
    (e) => e.status === "pendente" || e.status === "atrasado"
  ).length;
  if (temJornada && feitosComb.length === 0 && (temDpp || abertos > 0)) {
    futuras.push({
      chave: "conta:combinados",
      titulo: "Primeiro combinado feito",
      criterio: "Concluir um combinado com seu mentor",
      linha:
        abertos > 0
          ? `${abertos} ${abertos === 1 ? "combinado em aberto" : "combinados em aberto"}`
          : null,
      progresso: null,
      proximo: false,
      glifo: { tipo: "phosphor", nome: "listChecks" },
      tom: TOM_COMBINADOS,
    });
  }

  const nivel = temJornada
    ? niveisDaJornada({
        trilha: temDpp ? "dpp" : "especialista",
        duplas: input.duplas,
        porData,
        total,
        agora: (input.agora ?? new Date()).getTime(),
        curta,
        unidade,
        criterioCompleta: criterioMarco("completo", total),
      })
    : null;

  // a faixa não renderiza (mesmo gate da estante). O PRÓXIMO é sempre o
  // primeiro não ganho — é o único que a faixa mostra; os ganhos ficam
  // na estante do perfil. Marco de contagem traz a barra. ----------
  const marcos: MarcoAcao[] = [];
  if (temJornada) {
    const primeiroEnc = porData[0] ?? null;
    const ultimoEnc = porData[porData.length - 1] ?? null;

    marcos.push({
      chave: "primeiro",
      titulo: rotuloMarco("primeiro", temDpp),
      data: primeiroEnc?.realizado_em ?? primeiroEnc?.data_hora ?? null,
      linha: feitos >= 1 ? null : `Falta ${unidade(1)}`,
      glifo: { tipo: "phosphor", nome: "flag" },
      tom: TOM_MARCO,
      progresso: { atual: Math.min(feitos, 1), alvo: 1 },
      ganho: feitos >= 1,
      proximo: false,
    });

    // avaliou — as estrelas dela só na trilha da régua: sessão de
    // especialista não infla a régua DPP (a partição de sempre)
    const avalTrilha = input.avaliacoes.filter((a) =>
      temDpp
        ? trilhaPorDupla.get(a.dupla_id) !== "especialista"
        : a.dupla_id != null &&
          trilhaPorDupla.get(a.dupla_id) === "especialista"
    );
    const avaliadosTrilha = new Set(
      avalTrilha
        .map((a) => a.encontro_id)
        .filter((id): id is string => id != null)
    );
    const faltaAvaliar = [...daTrilha]
      .filter((e) => !avaliadosTrilha.has(e.id))
      .sort((a, b) => a.numero - b.numero)[0];
    const nAvalTrilha = avalTrilha.length;
    marcos.push({
      chave: "avaliou",
      titulo: temDpp ? "Avaliação do encontro" : "Avaliação da sessão",
      data: null,
      linha:
        nAvalTrilha > 0
          ? `Avaliou ${unidade(nAvalTrilha)}`
          : faltaAvaliar
            ? temDpp
              ? `Falta avaliar o encontro ${faltaAvaliar.numero}`
              : `Falta avaliar a sessão ${faltaAvaliar.numero}`
            : temDpp
              ? "Depois do 1º encontro"
              : "Depois da 1ª sessão",
      glifo: { tipo: "instrumento", chave: "avaliacao_encontro" },
      tom: INSTRUMENTO_TOM.avaliacao_encontro,
      progresso: null,
      ganho: nAvalTrilha > 0,
      proximo: false,
    });

    // pdm — só existe na jornada DPP (a trilha de especialista não tem
    // instrumento); estPdm veio do bloco dos instrumentos acima
    if (estPdm) {
      marcos.push({
        chave: "pdm",
        titulo: "Plano de Desenvolvimento",
        data: estPdm.respondidoEm,
        linha: estPdm.estado === "feito" ? null : linhaPdmPendente(estPdm),
        glifo: { tipo: "instrumento", chave: "pdm" },
        tom: INSTRUMENTO_TOM.pdm,
        progresso: null,
        ganho: estPdm.estado === "feito",
        proximo: false,
      });
    }

    marcos.push({
      chave: "completo",
      titulo: ROTULO_MARCO.completo,
      data:
        feitos >= total
          ? (ultimoEnc?.realizado_em ?? ultimoEnc?.data_hora ?? null)
          : null,
      linha:
        feitos >= total
          ? null
          : `${total - feitos === 1 ? "Falta" : "Faltam"} ${unidade(total - feitos)}`,
      glifo: { tipo: "phosphor", nome: "trophy" },
      tom: TOM_MARCO,
      progresso: { atual: feitos, alvo: total },
      ganho: feitos >= total,
      proximo: false,
    });

    const prox = marcos.find((m) => !m.ganho);
    if (prox) prox.proximo = true;
  }

  estante.sort((a, b) => a.ts - b.ts);
  return {
    conquistas: estante.map((x) => x.c),
    futuras,
    nivel,
    proximoMarco,
    marcos,
    temJornada,
  };
}
