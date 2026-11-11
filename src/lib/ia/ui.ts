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
 *  demo (lib/demo/ia-ui.ts) e a nota de cards em prompts.ts. */

import type { Semaforo } from "@/lib/ciclo";
import type { DuplaDesfecho } from "@/lib/dupla-desfecho";
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
    desistentes: number;
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

export type UiChamados = {
  kind: "chamados";
  aberto: number;
  em_atendimento: number;
  /** até 5, mais recentes primeiro */
  chamados: {
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
  | UiChamados
  | UiInstrumentos
  | UiFontes
  | UiCombinados
  | UiJornada
  | UiPedidos
  | UiConfirmacao;

export type UiKind = UiBloco["kind"];

/** Rótulo da linha "Consultou: …" e do status por tool. */
export const STATUS_TOOL: Record<string, string> = {
  resumo_semana: "Lendo o resumo da semana…",
  ficha_dupla: "Abrindo a ficha da dupla…",
  registros_da_dupla: "Lendo os registros da dupla…",
  aguardando_par: "Olhando a fila de pareamento…",
  capacidade_mentores: "Conferindo as vagas dos mentores…",
  duplas_do_usuario: "Procurando a dupla…",
  agenda_do_periodo: "Abrindo a agenda…",
  guia_consulta: "Buscando nos guias…",
  chamados_resumo: "Lendo os chamados…",
  pessoas_busca: "Procurando a pessoa…",
  instrumentos_da_dupla: "Abrindo os instrumentos…",
  minha_dupla: "Olhando sua dupla…",
  minha_agenda: "Abrindo sua agenda…",
  meus_combinados: "Vendo seus combinados…",
  meu_progresso: "Olhando sua jornada…",
  meus_pedidos: "Vendo seus pedidos…",
  ajuda_faq: "Buscando na ajuda…",
  // escritas do domínio (126) — a 1ª chamada só prepara a prévia, então
  // o status conta "preparando", não "executando"
  registrar_interacao: "Preparando o registro de contato…",
  marcar_situacao_mentorado: "Preparando a mudança de situação…",
  emitir_link_instrumento: "Preparando o link do instrumento…",
  agendar_encontro: "Preparando o agendamento…",
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
          desistentes: num(s.desistentes),
          encerradas: num(s.encerradas),
        },
        pedem_acao: pedem.length,
        destaques: pedem.slice(0, 5).map((x) => ({
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
        })),
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
            nome: String(m.nome ?? ""),
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
          nome: String(p.nome ?? ""),
          papel: (str(p.papel) as AppRole | null) ?? null,
        })),
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
        aguardando_coord: 2,
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
