/** GenUI direto (assistente v3) — blocos que a ROTA emite assim que uma
 *  tool retorna, antes de o modelo escrever: o card chega ~1–3s antes do
 *  texto e o número vem do dado, não de o modelo copiar certo.
 *
 *  Contrato SSE: `{ type: "ui", b: UiBloco }`. Um bloco por tool que
 *  respondeu de fato (ok + dado não vazio); o cliente guarda em
 *  `Msg.ui` (dedup por `kind`, o último vence) e renderiza acima do texto.
 *
 *  Os projetores são PUROS e recortam o payload ao que o card mostra —
 *  o escopo é o mesmo que a RLS já entregou à tool (e ao modelo); nada
 *  aqui amplia leitura. `duplas_do_usuario` não vira card: é lookup de id
 *  intermediário, não resposta. Tool negada/erro nunca vira card.
 *
 *  Mudou um kind aqui → muda o card (assistente-cards.tsx), o dataset da
 *  demo (lib/demo/ia.ts) e a nota de cards em prompts.ts. */

import type { Semaforo } from "@/lib/ciclo";
import type { DuplaDesfecho } from "@/lib/dupla-desfecho";
import type { DocBloco } from "@/lib/materiais-documentos";
import type {
  AppRole,
  AvaliacaoJovem,
  ChamadoCategoria,
  ChamadoStatus,
  Dificuldade,
  DuplaStatus,
  EncontroStatus,
  ProximoPasso,
  Trilha,
} from "@/lib/types";
import { limparTrecho } from "./fontes";

// ---------- shapes dos blocos ----------

/** Linha de dupla compacta (destaques do resumo). */
export type UiDuplaMini = {
  id: string;
  mentor: string | null;
  mentorado: string | null;
  trilha: Trilha;
  status: DuplaStatus;
  desfecho?: DuplaDesfecho | null;
  semaforo: Semaforo;
  motivo: string | null;
  apoio: boolean;
  feitos: number;
  esperado: number;
  /** próximo encontro marcado (026) — a fonte já calculava e o
   *  projetor descartava; alimenta a linha "quando é o próximo?" */
  proximo?: { numero: number; data_hora: string | null } | null;
};

/** Panorama "como estão minhas duplas?" (026): as mesmas linhas-mini do
 *  destaque do resumo, com o total do escopo e truncado honestos. */
export type UiDuplas = {
  kind: "duplas";
  /** até 6, na ordem da tool (apoio → risco → atenção → ok) */
  itens: UiDuplaMini[];
  total: number;
  truncado: boolean;
};

export type UiSaude = {
  kind: "saude";
  contagem: {
    em_andamento: number;
    risco: number;
    atencao: number;
    em_dia: number;
    apoio: number;
    pausadas: number;
    concluidas: number;
    encerradas: number;
  };
  /** até 5 duplas que pedem ação (apoio → risco → atenção), na ordem da tool */
  destaques: UiDuplaMini[];
  /** quantas pediam ação no total (destaques é o recorte) */
  pedem_acao: number;
};

export type UiDupla = {
  kind: "dupla";
  id: string;
  mentor: string | null;
  mentorado: string | null;
  supervisor: string | null;
  trilha: Trilha;
  status: DuplaStatus;
  desfecho?: DuplaDesfecho | null;
  turma: string | null;
  /** ausente pro jovem — o semáforo é instrumento da equipe */
  semaforo?: Semaforo;
  motivo?: string | null;
  apoio?: boolean;
  registro_pendente?: boolean;
  feitos: number;
  esperado?: number;
  encontros: { numero: number; status: EncontroStatus; tem_registro: boolean }[];
  proximo: { numero: number; data_hora: string | null } | null;
};

export type UiAgenda = {
  kind: "agenda";
  desde: string;
  ate: string;
  total: number;
  /** até 12, em ordem de data (o card agrupa por dia) */
  encontros: {
    dupla_id: string;
    mentor: string | null;
    mentorado: string | null;
    numero: number;
    status: EncontroStatus;
    data_hora: string | null;
  }[];
};

export type UiRegistros = {
  kind: "registros";
  dupla_id: string;
  total: number;
  /** até 4, mais recentes primeiro */
  itens: {
    encontro_numero: number;
    realizado_em: string | null;
    /** avaliação do mentor sobre o encontro */
    avaliacao: AvaliacaoJovem | null;
    dificuldade: Dificuldade | null;
    precisa_apoio: boolean;
    proximo_passo: ProximoPasso | null;
  }[];
};

export type UiFila = {
  kind: "fila";
  /** até 6 de cada lado, quem espera há mais tempo primeiro */
  mentorados: { id: string; nome: string; desde: string | null }[];
  mentores: { id: string; nome: string; vagas: number; desde: string | null }[];
  total_mentorados: number;
  total_mentores: number;
};

export type UiCapacidade = {
  kind: "capacidade";
  /** até 10, mais ocupados primeiro */
  mentores: {
    id: string;
    nome: string;
    trilha: "dpp" | "especialista";
    em_uso: number;
    capacidade: number;
  }[];
  total: number;
};

export type UiPessoas = {
  kind: "pessoas";
  pessoas: { id: string; nome: string; papel: AppRole | null }[];
};

/** BI demográfico da coordenação/auxiliar (onda 5): contagens por
 *  estado, gênero, faixa de idade, papel ou trilha, no recorte que a
 *  sessão já lê por RLS. O card é a própria resposta — o modelo narra,
 *  o número sai daqui. `chave` guarda o valor de máquina pro grupo
 *  "não informado" desenhar hatch (o buraco nomeado, nunca escondido). */
export type UiAgregado = {
  kind: "agregado";
  /** "Pessoas por estado (UF)" — o título pronto vem do payload */
  titulo: string;
  /** filtros aplicados como a equipe os lê ("Mentorado · SP") —
   *  null quando a pergunta não filtrou (programa todo) */
  recorte: string | null;
  /** pessoas que passaram nos filtros — o denominador de cada barra */
  total: number;
  /** "pessoas ativas" | "pessoas cadastradas" — o universo honesto */
  universo: string;
  itens: { chave: string; rotulo: string; n: number; pct: number }[];
  /** cauda dobrada fora do top N — null quando o top cobriu tudo */
  outros: { pessoas: number; grupos: number } | null;
  /** papel/trilha contam participação: uma pessoa entra em mais de uma
   *  linha e a soma dos pct pode passar de 100 — o card avisa */
  participacao_multipla: boolean;
};

export type UiChamados = {
  kind: "chamados";
  aberto: number;
  em_atendimento: number;
  /** até 5, mais recentes primeiro */
  chamados: {
    /** uuid — o deep-link da linha (?c=); opcional por defesa a bloco
     *  montado sem id */
    id?: string;
    numero: string;
    categoria: ChamadoCategoria;
    assunto: string | null;
    status: ChamadoStatus;
    criado_em: string;
  }[];
};

export type UiInstrumentos = {
  kind: "instrumentos";
  dupla_id: string;
  itens: {
    sistema: string;
    titulo: string;
    respondidos: number;
    pendentes: number;
  }[];
};

/** Plano "ficar em dia" (REALIZA-397): a sequência calculada pelo planner —
 *  cada passo com a data sugerida e a ação (agendar, remarcar, já marcado).
 *  O card aponta pra ficha, onde o mentor executa — o plano é proposta,
 *  nunca cronograma gravado pela IA. */
export type UiPlano = {
  kind: "plano";
  dupla_id: string;
  /** a dupla nomeada (026) — o card diz de quem é o plano e linka a ficha */
  mentor: string | null;
  mentorado: string | null;
  em_dia: boolean;
  data_recuperacao: string | null;
  /** a data "em dia" mesmo depois do encerramento — a evidência do
   *  conversa: o card diz quando o plano fecha, nunca só que não fecha */
  data_projetada: string | null;
  /** no ritmo devolvido, quantos dos encontros que faltam cabem até o
   *  encerramento — null quando o calendário não tem encerramento */
  cabem_ate_encerramento: { cabem: number; faltam: number } | null;
  encerramento: string | null;
  /** encontros/semana da simulação devolvida — o card fala em palavras
   *  (rotuloRitmo); deriva do nivel quando a tool não serializa o número */
  ritmo: number | null;
  passos: {
    numero: number;
    titulo: string;
    acao: "agendar" | "remarcar" | "travado";
    /** encontro a editar no remarcar/travado — viaja pro deep-link da
     *  ficha, nunca vira texto do card */
    encontro_id: string | null;
    data: string;
    /** data oficial do passo — o "oficial era" que mostra a divergência */
    data_oficial: string;
    /** oficial que vence durante a recuperação — a conta honesta do plano */
    vence_no_caminho: boolean;
    precondicao: string | null;
    aviso: string | null;
  }[];
  /** limbo/registro pendente que vem antes do plano */
  pendencias: { numero: number; estado: "limbo" | "pendente_registro" }[];
  /** Recessos do cronograma ainda sem decisão da dupla (527) — travam a
   *  proposta até a dupla responder (declarar_recesso / wizard). */
  recessos_pendentes: {
    ciclo_evento_id: string;
    titulo: string;
    inicio: string;
    fim: string;
  }[];
  /** Grade semanal dos dois lados (518): quem já marcou e os dias em
   *  comum — o card diz por que as datas preferem (ou não) certos dias. */
  grade: {
    mentor: boolean;
    jovem: boolean;
    dias_comuns: number;
    sem_grade: boolean;
  } | null;
  /** Rascunho do documento do combinado (montarDocCombinado, o mesmo do
   *  wizard da aba Agora) — o card deixa a dupla ler o que vai propor. */
  doc: DocBloco[] | null;
  avisos: string[];
  /** Nível nomeado de flexibilização (FR-011) + ação sugerida. */
  nivel:
    | "ritmo_normal"
    | "semana_dupla"
    | "semana_tripla"
    | "um_por_dia"
    | "conversa_coord"
    | null;
  /** em_dia · recuperacao · conversa (513): conversa = nem 1 por dia
   *  fecha antes do encerramento, o card não promete a data. */
  estado: "em_dia" | "recuperacao" | "conversa" | null;
  sugestao: string | null;
  /** Motor de cenários (1126): o caminho viável mais cedo quando a
   *  simulação base não fecha. O card abre por ele em vez de dizer que só
   *  a coordenação resolve. */
  melhor: {
    id: string;
    rotulo: string;
    data: string | null;
    sessoes: number;
    decisao_recesso: "pausa" | "segue" | null;
    fusao: number[][];
  } | null;
  /** os outros caminhos viáveis (sem repetir o melhor) — até 3 */
  alternativas: { rotulo: string; data: string | null }[];
  /** Caminho completo de menor fricção (1126): quando a simulação base é
   *  "conversa", o card mostra ESTE caminho, com todos os passos dele. */
  caminho: {
    rotulo: string;
    data: string | null;
    sessoes: number;
    ritmo: number;
    fusao: number[][];
    decisao_recesso: "pausa" | "segue" | null;
    /** o que a dupla precisa aceitar pra esse caminho fechar */
    exigencias: string[];
    passos: UiPlano["passos"];
  } | null;
  /** TODOS os cenários do motor (1126) — a interface do simulador: cada
   *  opção tem data, sessões, ritmo e o que precisa ser decidido pra
   *  propor aquele caminho. */
  cenarios: {
    id: string;
    rotulo: string;
    viavel: boolean;
    data: string | null;
    sessoes: number;
    ritmo: number;
    fusao: number[][];
    decisao_recesso: "pausa" | "segue" | null;
    recesso: { ciclo_evento_id: string; usa: boolean } | null;
  }[];
  /** Plano persistido vivo (0219) — quando existe, o card mostra o
   *  combinado (status/versão/quem aprovou) em vez de só a proposta. */
  plano: {
    id: string;
    status: string;
    versao: number;
    aprovado_lado: "mentor" | "mentorado" | null;
    /** ciência de cada lado (0225 — o aceite é ÚNICO, um carimbo basta) */
    aceito_mentor: boolean;
    aceito_mentorado: boolean;
    /** quem falta aceitar (aceite ÚNICO, 0225) — "dupla" = nenhum lado
     *  carimbou (proposta da equipe esperando a dupla) */
    falta: "mentor" | "mentorado" | "dupla" | null;
    expira_em: string;
    ritmo: number | null;
  } | null;
};

/** O combinado do plano como o JOVEM o vê (0219 — jovem_plano): sem
 *  semáforo, motivo interno ou sinal — só status, ritmo, datas e passos
 *  aplicados. Mesmo kind "plano_jovem" pro card próprio da agenda/chat. */
export type UiPlanoJovem = {
  kind: "plano_jovem";
  status: string;
  versao: number;
  ritmo: number | null;
  aprovado_lado: "mentor" | "mentorado" | null;
  expira_em: string;
  passos: { numero: number; data: string; acao: string | null }[];
  passos_aplicados: { numero: number; data_nova: string; aplicado_em: string }[];
};

export type UiFontes = {
  kind: "fontes";
  /** até 4 trechos citáveis — o card expande o trecho ao tocar no chip.
   *  Referência citável é guia + seção: o `pagina` do banco é o id
   *  sintético do chunk, não a página do documento — não sai pro card. */
  fontes: {
    guia: string;
    secao: string | null;
    trecho: string;
    /** citação da 0165: slug do doc nativo + âncora da seção — a metaFonte
     *  linka /materiais/documento/<material>#<ancora>; ausentes em fontes
     *  sem página de documento */
    material?: string | null;
    ancora?: string | null;
  }[];
};

// ---------- mentorado (pacote liza nov/2026) ----------

/** Checklist visual dos combinados — pendente com prazo primeiro,
 *  feito recente em tom ok por último. */
export type UiCombinados = {
  kind: "combinados";
  pendentes: { texto: string; prazo: string | null }[];
  feitos: string[];
};

/** Progresso da jornada do jovem — instrumentos com entregas feitas ×
 *  pendentes; o card mostra a esteira de "o que falta responder". */
export type UiJornada = {
  kind: "jornada";
  dupla_id: string;
  instrumentos: {
    sistema: string;
    titulo: string;
    respondidos: number;
    pendentes: number;
  }[];
  total_respondidos: number;
  total_pendentes: number;
};

/** Pedido de especialista do jovem — quem, sobre o quê, em que pé. */
export type UiPedidos = {
  kind: "pedidos";
  pedidos: {
    especialista: string | null;
    sobre: string | null;
    status: string;
    criado_em: string;
  }[];
};

/** Prévia de escrita aguardando o "sim" humano (REALIZA-126): a rota
 *  emite quando a tool devolve `pendente_confirmacao`. O `confirmacao_id`
 *  mora AQUI — vai pro card do usuário, nunca pro histórico do modelo
 *  (com ele na mão a tool se auto-aprovaria). `args` viaja junto porque
 *  o Confirmar reposta o mesmo payload que gravou a prévia. */
export type UiConfirmacao = {
  kind: "confirmacao";
  confirmacao_id: string;
  tool: string;
  args: Record<string, unknown>;
  resumo: string;
  expira_em_minutos: number;
  /** request_id da reserva da mensagem que propôs — o card reposta no
   *  Confirmar e o evento da execução sai com o MESMO id da prévia:
   *  o par "proposto × aprovado" fica correlacionado em ia_eventos. */
  request_id?: string | null;
};

export type UiBloco =
  | UiSaude
  | UiDupla
  | UiAgenda
  | UiRegistros
  | UiFila
  | UiCapacidade
  | UiPessoas
  | UiAgregado
  | UiChamados
  | UiInstrumentos
  | UiFontes
  | UiDuplas
  | UiCombinados
  | UiJornada
  | UiPedidos
  | UiPlano
  | UiPlanoJovem
  | UiConfirmacao;

export type UiKind = UiBloco["kind"];

/** Rótulo da linha "Consultou: …" e do status por tool. */
export const STATUS_TOOL: Record<string, string> = {
  resumo_semana: "Lendo o resumo da semana…",
  operacional_insights: "Lendo adesão, saúde e adoção…",
  ficha_dupla: "Abrindo a ficha da dupla…",
  registros_da_dupla: "Lendo os registros da dupla…",
  plano_em_dia: "Montando o plano pra ficar em dia…",
  plano_propor: "Preparando a proposta do plano…",
  plano_responder: "Preparando a resposta do plano…",
  plano_aplicar_passo: "Preparando o passo do plano…",
  resumo_dupla: "Lendo o resumo consolidado da dupla…",
  meu_plano: "Vendo o seu plano…",
  intervencao_sugerir: "Preparando a sugestão de intervenção…",
  guia_ajustar: "Preparando o ajuste do guia…",
  guia_limpar: "Preparando pra voltar ao guia…",
  aguardando_par: "Olhando a fila de pareamento…",
  capacidade_mentores: "Conferindo as vagas dos mentores…",
  pessoas_agregado: "Contando as pessoas do programa…",
  adocao_por_superficie: "Lendo a adoção por superfície…",
  adocao_por_dia: "Lendo a série diária de gestos…",
  adocao_caminhos: "Lendo os caminhos de navegação…",
  adocao_coorte: "Lendo a retenção por coorte…",
  adocao_funil: "Lendo o funil de instrumentos…",
  duplas_do_usuario: "Procurando a dupla…",
  duplas_panorama: "Lendo o panorama das duplas…",
  agenda_do_periodo: "Abrindo a agenda…",
  guia_consulta: "Buscando nos guias…",
  chamados_resumo: "Lendo os chamados…",
  combinados_das_duplas: "Lendo os combinados…",
  pessoas_busca: "Procurando a pessoa…",
  mensagem_template: "Pegando o template da mensagem…",
  instrumentos_da_dupla: "Abrindo os instrumentos…",
  minha_dupla: "Olhando sua dupla…",
  minha_agenda: "Abrindo sua agenda…",
  meus_combinados: "Vendo seus combinados…",
  meu_progresso: "Olhando sua jornada…",
  meus_pedidos: "Vendo seus pedidos…",
  ajuda_faq: "Buscando na ajuda…",
  encontros_retroativo: "Vendo o que dá pra registrar…",
  jovem_registrar_retroativo: "Preparando o registro do encontro…",
  jovem_desfazer_retroativo: "Preparando pra desfazer o registro…",
  // escritas do domínio (126) — a 1ª chamada só prepara a prévia, então
  // o status conta "preparando", não "executando"
  registrar_interacao: "Preparando o registro de contato…",
  marcar_situacao_mentorado: "Preparando a mudança de situação…",
  emitir_link_instrumento: "Preparando o link do instrumento…",
  agendar_encontro: "Preparando o agendamento…",
  jovem_agendar_encontro: "Preparando o agendamento…",
  jovem_registrar_encontro: "Preparando o registro do encontro…",
  declarar_recesso: "Preparando a decisão do recesso…",
  disponibilidade_semana: "Preparando sua grade semanal…",
  jovem_pedir_especialista: "Preparando o pedido de especialista…",
  editar_campo_pessoa: "Preparando a edição…",
};

// ---------- projetores (puros) ----------

const corta = (t: string | null | undefined, max: number) =>
  t == null ? null : t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null;
const arr = (v: unknown): Obj[] =>
  Array.isArray(v) ? (v.filter((x) => obj(x)) as Obj[]) : [];
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Linha-mini de dupla — os destaques do resumo e os itens do panorama
 *  leem o mesmo recorte do projetarResumo (mesmo shape, mesma ordem). */
function duplaMini(x: Obj): UiDuplaMini {
  const prox = obj(x.proximo_encontro);
  return {
    id: String(x.dupla_id),
    mentor: str(x.mentor),
    mentorado: str(x.mentorado),
    trilha: x.trilha as Trilha,
    status: x.status as DuplaStatus,
    desfecho: (str(x.desfecho) as DuplaDesfecho | null) ?? null,
    semaforo: x.semaforo as Semaforo,
    motivo: corta(str(x.motivo), 120),
    apoio: obj(x.apoio)?.aberto === true,
    feitos: num(x.feitos),
    esperado: num(x.esperado),
    proximo: prox
      ? { numero: num(prox.numero), data_hora: str(prox.data_hora) }
      : null,
  };
}

/** Ritmo (encontros/semana) por trás de cada nível nomeado — o inverso
 *  do NIVEL_DO_RITMO do planner; cobre payload sem o `ritmo` serializado. */
const RITMO_DO_NIVEL: Record<NonNullable<UiPlano["nivel"]>, number> = {
  ritmo_normal: 1,
  semana_dupla: 2,
  semana_tripla: 3,
  um_por_dia: 7,
  // o conversa mostra a melhor simulação — o degrau de 1 por dia
  conversa_coord: 7,
};

/** Tool que respondeu → bloco do card, ou null quando não há o que
 *  mostrar (lista vazia, lookup intermediário, tool sem card). Recebe o
 *  `dados` do envelope ok da executarTool. */
export function uiDaTool(nome: string, dados: unknown): UiBloco | null {
  const d = obj(dados);
  if (!d) return null;
  switch (nome) {
    case "resumo_semana": {
      const s = obj(d.saude);
      const duplas = arr(d.duplas);
      if (!s || !duplas.length) return null;
      const pedem = duplas.filter(
        (x) => obj(x.apoio)?.aberto === true || x.semaforo !== "ok"
      );
      return {
        kind: "saude",
        contagem: {
          em_andamento: num(s.em_andamento),
          risco: num(s.risco),
          atencao: num(s.atencao),
          em_dia: num(s.em_dia),
          apoio: num(s.apoio),
          pausadas: num(s.pausadas),
          concluidas: num(s.concluidas),
          encerradas: num(s.encerradas),
        },
        pedem_acao: pedem.length,
        destaques: pedem.slice(0, 5).map(duplaMini),
      };
    }
    case "duplas_panorama": {
      const itens = arr(d.duplas);
      if (!itens.length) return null;
      const total = num(d.total) || itens.length;
      return {
        kind: "duplas",
        // a tool já capa em 6 — o slice é defesa pra payload maior
        itens: itens.slice(0, 6).map(duplaMini),
        total,
        truncado: d.truncado === true || total > Math.min(itens.length, 6),
      };
    }
    case "ficha_dupla": {
      if (!str(d.dupla_id)) return null;
      const encontros = arr(d.encontros).map((e) => ({
        numero: num(e.numero),
        status: e.status as EncontroStatus,
        tem_registro: e.tem_registro === true,
      }));
      const prox = obj(d.proximo_encontro);
      const temSemaforo = typeof d.semaforo === "string";
      return {
        kind: "dupla",
        id: String(d.dupla_id),
        mentor: str(d.mentor),
        mentorado: str(d.mentorado),
        supervisor: str(d.supervisor),
        trilha: d.trilha as Trilha,
        status: d.status as DuplaStatus,
        desfecho: (str(d.desfecho) as DuplaDesfecho | null) ?? null,
        turma: str(d.turma),
        ...(temSemaforo
          ? {
              semaforo: d.semaforo as Semaforo,
              motivo: corta(str(d.motivo), 140),
              apoio: obj(d.apoio)?.aberto === true,
              registro_pendente: d.registro_pendente === true,
              esperado: num(d.esperado),
            }
          : {}),
        feitos: temSemaforo
          ? num(d.feitos)
          : encontros.filter((e) => e.status === "realizado").length,
        encontros,
        proximo: prox
          ? { numero: num(prox.numero), data_hora: str(prox.data_hora) }
          : null,
      };
    }
    case "agenda_do_periodo": {
      const encontros = arr(d.encontros);
      if (!encontros.length) return null;
      return {
        kind: "agenda",
        desde: String(d.desde),
        ate: String(d.ate),
        total: num(d.total) || encontros.length,
        encontros: encontros.slice(0, 12).map((e) => ({
          dupla_id: String(e.dupla_id),
          mentor: str(e.mentor),
          mentorado: str(e.mentorado),
          numero: num(e.numero),
          status: e.status as EncontroStatus,
          data_hora: str(e.data_hora),
        })),
      };
    }
    case "plano_em_dia": {
      if (!str(d.dupla_id) || d.aplicavel !== true) return null;
      const mapaPasso = (p: Record<string, unknown>) => ({
        numero: num(p.numero),
        titulo: String(p.titulo ?? ""),
        acao: p.acao as UiPlano["passos"][number]["acao"],
        encontro_id: str(p.encontro_id),
        data: String(p.data_sugerida ?? ""),
        data_oficial: String(p.data_oficial ?? ""),
        vence_no_caminho: p.vence_no_caminho === true,
        precondicao: str(p.precondicao),
        aviso: str(p.aviso),
      });
      const passos = arr(d.passos).map(mapaPasso).filter((p) => p.numero > 0);
      // caminho completo de menor fricção (1126): quando a simulação base
      // é "conversa", o card mostra ESTE caminho — data, exigências e todos
      // os passos dele
      const caminhoBruto = obj(d.caminho);
      const caminho = caminhoBruto
        ? {
            rotulo: String(caminhoBruto.rotulo ?? ""),
            data: str(caminhoBruto.data),
            sessoes: num(caminhoBruto.sessoes),
            ritmo: num(caminhoBruto.ritmo),
            fusao: (Array.isArray(caminhoBruto.fusao)
              ? caminhoBruto.fusao
              : []) as number[][],
            decisao_recesso: (caminhoBruto.decisaoRecesso === "pausa" ||
            caminhoBruto.decisaoRecesso === "segue"
              ? caminhoBruto.decisaoRecesso
              : null) as "pausa" | "segue" | null,
            exigencias: (Array.isArray(caminhoBruto.exigencias)
              ? caminhoBruto.exigencias
              : []
            ).map((x) => String(x)),
            passos: arr(caminhoBruto.passos)
              .map(mapaPasso)
              .filter((p) => p.numero > 0),
          }
        : null;
      const usaCaminho =
        d.estado === "conversa" && (caminho?.passos.length ?? 0) > 0;
      const passosEfetivos = usaCaminho ? caminho!.passos : passos;
      const pendencias = arr(d.pendencias_registro).map((p) => ({
        numero: num(p.numero),
        estado: (str(p.estado) === "limbo" ? "limbo" : "pendente_registro") as
          | "limbo"
          | "pendente_registro",
      }));
      // em dia sem passos nem pendência (convergência trivial, só
      // travados): o veredito positivo ainda vira card — o silêncio lia
      // como card quebrado (026)
      if (
        !passosEfetivos.length &&
        !pendencias.length &&
        d.em_dia !== true &&
        d.estado !== "em_dia"
      )
        return null;
      const plano = obj(d.plano);
      const nivelStr = str(d.nivel);
      const nivel =
        nivelStr === "ritmo_normal" ||
        nivelStr === "semana_dupla" ||
        nivelStr === "semana_tripla" ||
        nivelStr === "um_por_dia" ||
        nivelStr === "conversa_coord"
          ? nivelStr
          : null;
      const cabem = obj(d.cabem_ate_encerramento);
      // motor de cenários (1126): melhor caminho viável + alternativas
      const melhorBruto = obj(d.melhor);
      const melhor =
        melhorBruto && melhorBruto.viavel === true
          ? {
              id: String(melhorBruto.id ?? ""),
              rotulo: String(melhorBruto.rotulo ?? ""),
              data: str(melhorBruto.data),
              sessoes: num(melhorBruto.sessoes),
              decisao_recesso: (melhorBruto.decisaoRecesso === "pausa" ||
              melhorBruto.decisaoRecesso === "segue"
                ? melhorBruto.decisaoRecesso
                : null) as "pausa" | "segue" | null,
              fusao: (Array.isArray(melhorBruto.fusao)
                ? melhorBruto.fusao
                : []) as number[][],
            }
          : null;
      const alternativas = arr(d.cenarios)
        .filter(
          (c) =>
            c.viavel === true &&
            (!melhorBruto || c.id !== melhorBruto.id) &&
            str(c.data) != null
        )
        .slice(0, 3)
        .map((c) => ({ rotulo: String(c.rotulo ?? ""), data: str(c.data) }));
      const cenarios = arr(d.cenarios).map((c) => {
        const rec = obj(c.recesso);
        return {
          id: String(c.id ?? ""),
          rotulo: String(c.rotulo ?? ""),
          viavel: c.viavel === true,
          data: str(c.data),
          sessoes: num(c.sessoes),
          ritmo: num(c.ritmo),
          fusao: (Array.isArray(c.fusao) ? c.fusao : []) as number[][],
          decisao_recesso: (c.decisaoRecesso === "pausa" ||
          c.decisaoRecesso === "segue"
            ? c.decisaoRecesso
            : null) as "pausa" | "segue" | null,
          recesso: rec
            ? {
                ciclo_evento_id: String(rec.cicloEventoId ?? ""),
                usa: rec.usa === true,
              }
            : null,
        };
      });
      return {
        kind: "plano",
        dupla_id: String(d.dupla_id),
        mentor: str(d.mentor),
        mentorado: str(d.mentorado),
        em_dia: d.em_dia === true,
        data_recuperacao: usaCaminho
          ? caminho!.data
          : str(d.data_recuperacao),
        data_projetada: str(d.data_projetada),
        cabem_ate_encerramento: cabem
          ? { cabem: num(cabem.cabem), faltam: num(cabem.faltam) }
          : null,
        encerramento: str(d.encerramento),
        ritmo: usaCaminho
          ? caminho!.ritmo
          : num(d.ritmo) ||
            (nivel ? RITMO_DO_NIVEL[nivel] : 0) ||
            (plano ? num(plano.ritmo) : 0) ||
            null,
        passos: passosEfetivos,
        pendencias,
        recessos_pendentes: arr(d.recessos_pendentes)
          .map((r) => ({
            ciclo_evento_id: String(r.ciclo_evento_id ?? ""),
            titulo: String(r.titulo ?? ""),
            inicio: String(r.inicio ?? ""),
            fim: String(r.fim ?? ""),
          }))
          .filter((r) => r.ciclo_evento_id),
        grade: obj(d.grade)
          ? {
              mentor: obj(d.grade)?.mentor === true,
              jovem: obj(d.grade)?.jovem === true,
              dias_comuns: num(obj(d.grade)?.dias_comuns),
              sem_grade: obj(d.grade)?.sem_grade === true,
            }
          : null,
        doc: Array.isArray(d.doc) ? (d.doc as UiPlano["doc"]) : null,
        avisos: (Array.isArray(d.avisos) ? d.avisos : [])
          .map((a) => str(a))
          .filter((a): a is string => a != null),
        nivel: usaCaminho ? null : nivel,
        estado: usaCaminho
          ? "recuperacao"
          : d.estado === "em_dia" ||
              d.estado === "recuperacao" ||
              d.estado === "conversa"
            ? d.estado
            : null,
        sugestao: str(d.sugestao),
        melhor,
        alternativas,
        cenarios,
        caminho,
        plano: plano
          ? {
              id: String(plano.id ?? ""),
              status: String(plano.status ?? ""),
              versao: num(plano.versao),
              aprovado_lado: (str(plano.aprovado_lado) ?? null) as
                | "mentor"
                | "mentorado"
                | null,
              aceito_mentor: plano.aceito_mentor === true,
              aceito_mentorado: plano.aceito_mentorado === true,
              falta: (str(plano.falta) ?? null) as
                | "mentor"
                | "mentorado"
                | "dupla"
                | null,
              expira_em: String(plano.expira_em ?? ""),
              ritmo: plano.ritmo == null ? null : num(plano.ritmo),
            }
          : null,
      };
    }
    case "meu_plano": {
      // jovem_plano() já chega recortado (sem semáforo/motivos) — o card
      // só repassa o combinado; null quando a dupla não tem plano
      if (!str(d.status)) return null;
      const passosJ = arr(d.passos)
        .map((p) => ({
          numero: num(p.numero),
          data: String(p.data ?? ""),
          acao: str(p.acao),
        }))
        .filter((p) => p.numero > 0);
      return {
        kind: "plano_jovem",
        status: String(d.status),
        versao: num(d.versao),
        // a RPC devolve escopo->>'ritmo' — texto do jsonb
        ritmo: d.ritmo == null ? null : num(Number(d.ritmo)),
        aprovado_lado: (str(d.aprovado_lado) ?? null) as
          | "mentor"
          | "mentorado"
          | null,
        expira_em: String(d.expira_em ?? ""),
        passos: passosJ,
        passos_aplicados: arr(d.passos_aplicados).map((p) => ({
          numero: num(p.numero),
          data_nova: String(p.data_nova ?? ""),
          aplicado_em: String(p.aplicado_em ?? ""),
        })),
      };
    }
    case "registros_da_dupla": {
      const regs = arr(d.registros);
      if (!regs.length || !str(d.dupla_id)) return null;
      return {
        kind: "registros",
        dupla_id: String(d.dupla_id),
        total: num(d.total) || regs.length,
        itens: regs.slice(0, 4).map((r) => ({
          encontro_numero: num(r.encontro_numero),
          realizado_em: str(r.realizado_em),
          avaliacao: (str(r.avaliacao) as AvaliacaoJovem | null) ?? null,
          dificuldade: (str(r.dificuldade) as Dificuldade | null) ?? null,
          precisa_apoio: r.precisa_apoio === true,
          proximo_passo: (str(r.proximo_passo) as ProximoPasso | null) ?? null,
        })),
      };
    }
    case "aguardando_par": {
      const mentorados = arr(d.mentorados);
      const mentores = arr(d.mentores);
      if (!mentorados.length && !mentores.length) return null;
      return {
        kind: "fila",
        total_mentorados: mentorados.length,
        total_mentores: mentores.length,
        mentorados: mentorados.slice(0, 6).map((m) => ({
          id: String(m.id),
          nome: String(m.nome ?? ""),
          desde: str(m.esperando_desde),
        })),
        mentores: mentores.slice(0, 6).map((m) => ({
          id: String(m.id),
          nome: String(m.nome ?? ""),
          vagas: num(m.vagas),
          desde: str(m.esperando_desde),
        })),
      };
    }
    case "capacidade_mentores": {
      const ms = arr(d.mentores);
      if (!ms.length) return null;
      const ocup = (m: Obj) =>
        num(m.capacidade) > 0 ? num(m.em_uso) / num(m.capacidade) : 0;
      return {
        kind: "capacidade",
        total: ms.length,
        mentores: [...ms]
          .sort((a, b) => ocup(b) - ocup(a))
          .slice(0, 10)
          .map((m) => ({
            id: String(m.mentor_id),
            nome: String(m.nome_social ?? m.nome ?? ""),
            trilha: m.trilha === "especialista" ? "especialista" : "dpp",
            em_uso: num(m.em_uso),
            capacidade: num(m.capacidade),
          })),
      };
    }
    case "pessoas_busca": {
      const ps = arr(d.pessoas);
      if (!ps.length) return null;
      return {
        kind: "pessoas",
        pessoas: ps.slice(0, 8).map((p) => ({
          id: String(p.profile_id),
          nome: String(p.nome_social ?? p.nome ?? ""),
          papel: (str(p.papel) as AppRole | null) ?? null,
        })),
      };
    }
    case "pessoas_agregado": {
      const grupos = arr(d.grupos);
      if (!grupos.length) return null;
      const outros = obj(d.outros);
      return {
        kind: "agregado",
        titulo: str(d.titulo) ?? "Pessoas",
        recorte: str(d.recorte) || null,
        total: num(d.total_pessoas),
        universo: str(d.universo) ?? "pessoas",
        // a tool já ordena e capa no top — o card não reordena (a ordem
        // é semântica: faixa segue a idade, "não informado" fecha a lista)
        itens: grupos.map((g) => ({
          chave: String(g.chave),
          rotulo: String(g.rotulo ?? g.chave),
          n: num(g.pessoas),
          pct: num(g.percentual),
        })),
        outros: outros
          ? { pessoas: num(outros.pessoas), grupos: num(outros.grupos) }
          : null,
        participacao_multipla: d.participacao_multipla === true,
      };
    }
    case "chamados_resumo": {
      const cs = arr(d.chamados);
      if (!cs.length) return null;
      return {
        kind: "chamados",
        aberto: num(d.aberto),
        em_atendimento: num(d.em_atendimento),
        chamados: [...cs]
          .sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)))
          .slice(0, 5)
          .map((c) => ({
            id: str(c.id) || undefined,
            numero: String(c.numero),
            categoria: c.categoria as ChamadoCategoria,
            assunto: corta(str(c.assunto), 90),
            status: c.status as ChamadoStatus,
            criado_em: String(c.criado_em),
          })),
      };
    }
    case "guia_consulta": {
      const fs = arr(d.fontes);
      if (!fs.length) return null;
      return {
        kind: "fontes",
        fontes: fs.slice(0, 4).map((f) => ({
          guia: String(f.guia),
          secao: str(f.secao),
          trecho: limparTrecho(str(f.trecho), 320),
          material: str(f.material),
          ancora: str(f.ancora),
        })),
      };
    }
    // ---------- mentorado ----------
    case "minha_dupla": {
      if (!str(d.dupla_id)) return null;
      const encontros = arr(d.encontros).map((e) => ({
        numero: num(e.numero),
        status: e.status as EncontroStatus,
        tem_registro: false,
      }));
      const prox =
        encontros.find(
          (e) => e.status === "agendado" || e.status === "remarcado"
        ) ?? null;
      const dataProx = prox
        ? (arr(d.encontros).find((e) => num(e.numero) === prox.numero)
            ?.data_hora as string | null) ?? null
        : null;
      return {
        kind: "dupla",
        id: String(d.dupla_id),
        mentor: str(d.mentor),
        // o outro lado da dupla é quem tá perguntando — "Você", não
        // "Mentorado a definir" (o jovem não lê o próprio nome aqui)
        mentorado: "Você",
        supervisor: str(d.supervisor),
        trilha: d.trilha as Trilha,
        status: d.status as DuplaStatus,
        desfecho: (str(d.desfecho) as DuplaDesfecho | null) ?? null,
        turma: str(d.turma),
        feitos: encontros.filter((e) => e.status === "realizado").length,
        encontros,
        proximo: prox ? { numero: prox.numero, data_hora: dataProx } : null,
      };
    }
    case "minha_agenda": {
      const proximos = arr(d.proximos);
      if (!proximos.length) return null;
      const datas = proximos
        .map((e) => str(e.data_hora))
        .filter((x): x is string => x != null)
        .sort();
      return {
        kind: "agenda",
        desde: datas[0] ?? "",
        ate: datas[datas.length - 1] ?? "",
        total: proximos.length,
        encontros: proximos.map((e) => ({
          dupla_id: String(e.dupla_id),
          // a tool resolve o adulto de cada dupla (DPP e especialista
          // convivem) — sem ele toda linha virava "a definir"
          mentor: str(e.mentor),
          mentorado: "Você",
          numero: num(e.numero),
          status: e.status as EncontroStatus,
          data_hora: str(e.data_hora),
        })),
      };
    }
    case "meus_combinados": {
      const pendentes = arr(d.pendentes);
      const feitos = arr(d.feitos_recentes);
      if (!pendentes.length && !feitos.length) return null;
      return {
        kind: "combinados",
        pendentes: pendentes.map((c) => ({
          texto: String(c.texto),
          prazo: str(c.prazo),
        })),
        feitos: feitos.map((c) => String(c.texto)),
      };
    }
    case "meu_progresso": {
      const itens = arr(d.instrumentos);
      if (!itens.length) return null;
      return {
        kind: "jornada",
        dupla_id: String(d.dupla_id),
        instrumentos: itens.map((i) => ({
          sistema: String(i.sistema),
          titulo: String(i.titulo ?? i.sistema),
          respondidos: num(i.respondidos),
          pendentes: num(i.pendentes),
        })),
        total_respondidos: num(d.total_respondidos),
        total_pendentes: num(d.total_pendentes),
      };
    }
    case "meus_pedidos": {
      const ps = arr(d.pedidos);
      if (!ps.length) return null;
      // a vez dele primeiro (responder proposta/sugestão), depois o que tá
      // esperando; os encerrados no fim — a ordem alfabética da view
      // escondia justamente os pedidos que pedem ação do jovem
      const ORDEM: Record<string, number> = {
        contra_proposta: 0,
        sugerida: 1,
        aguardando_coord: 2, // legado da triagem (0158): mesmo lugar de aberta
        aberta: 2,
      };
      const ordenados = [...ps].sort(
        (a, b) =>
          (ORDEM[String(a.status)] ?? 3) - (ORDEM[String(b.status)] ?? 3)
      );
      return {
        kind: "pedidos",
        pedidos: ordenados.slice(0, 5).map((p) => ({
          especialista: str(p.especialista),
          sobre: corta(str(p.sobre), 120),
          status: String(p.status),
          criado_em: String(p.criado_em),
        })),
      };
    }
    case "ajuda_faq": {
      const rs = arr(d.respostas);
      if (!rs.length) return null;
      return {
        kind: "fontes",
        fontes: rs.slice(0, 3).map((r) => ({
          guia: "Ajuda do Realiza",
          secao: str(r.pergunta),
          trecho: limparTrecho(str(r.resposta), 320),
        })),
      };
    }
    default:
      return null;
  }
}

/** instrumentos_da_dupla devolve um ARRAY (a RPC passa direto) — o
 *  projetor dele recebe a dupla_id dos args. */
export function uiDosInstrumentos(
  duplaId: string,
  dados: unknown
): UiInstrumentos | null {
  const lista = arr(dados);
  if (!lista.length) return null;
  return {
    kind: "instrumentos",
    dupla_id: duplaId,
    itens: lista.map((i) => {
      const entregas = arr(i.entregas);
      return {
        sistema: String(i.sistema),
        titulo: String(i.titulo ?? i.sistema),
        respondidos: entregas.filter((e) => e.status === "respondido").length,
        pendentes: entregas.filter((e) => e.status === "pendente").length,
      };
    }),
  };
}

/** Dedup por kind — o último bloco do mesmo tipo vence (o modelo pode
 *  chamar a mesma tool duas vezes ao refinar a busca). `confirmacao` é
 *  multi-instância: duas prévias de escrita coexistem na mesma resposta,
 *  então a identidade é o confirmacao_id, não o kind. */
export function juntarUi(lista: UiBloco[], novo: UiBloco): UiBloco[] {
  const chave = (b: UiBloco) =>
    b.kind === "confirmacao" ? `confirmacao:${b.confirmacao_id}` : b.kind;
  return [...lista.filter((b) => chave(b) !== chave(novo)), novo];
}
