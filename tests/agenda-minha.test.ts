import { describe, expect, it } from "vitest";
import {
  chipsDaAgenda,
  deriveAgendaMinha,
  encontrosCobertos,
  filtraAgenda,
  primeiroNomeDaDupla,
  rotuloChipDupla,
  secoesDaAgenda,
  type AgendaItem,
} from "@/lib/agenda-minha";
import type {
  CicloEvento,
  Cronograma,
  Dupla,
  Encaminhamento,
  Encontro,
  MentoradoPar,
  Profile,
  Supervisao,
  TrilhaJovem,
  TrilhaJovemSessao,
} from "@/lib/types";

// Âncora dos testes: quarta 07/10/2026 (TZ=America/Sao_Paulo no vitest).
// Instantes sempre com offset explícito pra não depender do fuso da máquina.
const HOJE = "2026-10-07";
const AGORA = Date.parse("2026-10-07T20:00:00-03:00"); // 20h de quarta
const AMANHA = "2026-10-08";
const DEPOIS = "2026-10-10";

function mkProfile(nome: string): Profile {
  return {
    id: `p-${nome}`,
    user_id: null,
    nome,
    email: `${nome}@x.test`,
    whatsapp: null,
    role: "mentor_dpp",
    ativo: true,
    bio: null,
    linkedin: null,
    areas: null,
    voluntariado: null,
    onboarded_em: null,
  };
}

function mkMentorado(nome: string, nome_social: string | null = null): MentoradoPar {
  return {
    id: `m-${nome}`,
    nome,
    nome_social,
    avatar_path: null,
    whatsapp: null,
    email: null,
    ong_origem: null,
    cidade: null,
    uf: null,
    interesses: [],
    disponibilidade: null,
    situacao: "ativo",
  };
}

function mkEncontro(over: Partial<Encontro>): Encontro {
  return {
    id: `e-${Math.random().toString(36).slice(2, 8)}`,
    dupla_id: "d1",
    numero: 1,
    data_hora: null,
    realizado_em: null,
    duracao_min: 60,
    status: "agendado",
    origem: "plataforma",
    link: null,
    motivo_reagendamento: null,
    registro: null,
    ...over,
  };
}

function mkEncaminhamento(over: Partial<Encaminhamento>): Encaminhamento {
  return {
    id: `enc-${Math.random().toString(36).slice(2, 8)}`,
    dupla_id: "d1",
    registro_id: null,
    descricao: "Ler o capítulo 3 do guia",
    responsavel: "mentor",
    prazo: null,
    status: "pendente",
    created_at: "2026-10-01T00:00:00Z",
    ...over,
  };
}

function mkDupla(over: Partial<Dupla> = {}): Dupla {
  return {
    id: "d1",
    turma: "2026/2027",
    cronograma_id: "c1",
    status: "ativa",
    iniciada_em: "2026-09-01",
    trilha: "dpp",
    demanda: null,
    solicitacao_id: null,
    mentor: mkProfile("André Lima"),
    mentorado: mkMentorado("Ana Souza"),
    supervisor: null,
    encontros: [],
    encaminhamentos: [],
    ...over,
  };
}

/** Evento do calendário oficial — o mínimo que alvoAgendamento/saudadeDaDupla
 *  consomem (tipo encontro com numero+data; cronograma da dupla). */
function mkEvento(
  numero: number | null,
  data: string,
  tipo: CicloEvento["tipo"] = "encontro",
  cronogramaId = "c1"
): CicloEvento {
  return {
    id: `ev-${tipo}-${numero ?? data}`,
    cronograma_id: cronogramaId,
    tipo,
    numero,
    data,
    data_fim: null,
    status: "pendente",
    observacao: null,
    ordem: numero ?? 90,
    titulo: numero != null ? `Encontro ${numero}` : "Evento",
    fase: null,
    instrumentos: [],
  };
}

const CRONOGRAMA: Cronograma = {
  id: "c1",
  nome: "Turma 2026/2027",
  turma: "2026/2027",
  trilha: "dpp",
  inicio_em: "2026-10-01",
  fim_em: "2027-06-30",
  encontros_esperados: 16,
  status: "ativo",
  created_by: null,
  created_at: "2026-01-01T00:00:00Z",
};

function mkSessao(over: Partial<TrilhaJovemSessao>): TrilhaJovemSessao {
  return {
    id: `s-${Math.random().toString(36).slice(2, 8)}`,
    numero: 1,
    data_hora: null,
    realizado_em: null,
    status: "agendado",
    duracao_min: 50,
    estrelas: null,
    motivo_reagendamento: null,
    registro: null,
    ...over,
  };
}

function mkTrilha(over: Partial<TrilhaJovem> = {}): TrilhaJovem {
  return {
    dupla_id: "d1",
    especialista_nome: "Luísa Prado",
    demanda: "Carreira e portfólio",
    status: "ativa",
    iniciada_em: null,
    encerrada_em: null,
    motivo_encerramento: null,
    devolutiva_pdm: null,
    sessoes: [],
    devolutivas: [],
    ...over,
  };
}

function mkSupervisao(over: Partial<Supervisao>): Supervisao {
  return {
    id: `sup-${Math.random().toString(36).slice(2, 8)}`,
    supervisor_id: "ps",
    mentor_id: "pm",
    dupla_id: null,
    data: HOJE,
    resumo: "rotina das duplas",
    created_by: "ps",
    created_at: "2026-10-01T00:00:00Z",
    supervisor: { id: "ps", nome: "Paula Nunes" },
    mentor: { id: "pm", nome: "André Lima" },
    dupla: null,
    ...over,
  };
}

const BASE = {
  trilhas: {} as Record<string, TrilhaJovem[]>,
  eventos: [] as CicloEvento[],
  cronogramas: [CRONOGRAMA],
  supervisoes: [] as Supervisao[],
  meuId: "pm",
  hoje: HOJE,
  agora: AGORA,
};

/** todos os itens da derivação achatados, na ordem de exibição */
function todosOsItens(a: ReturnType<typeof deriveAgendaMinha>): AgendaItem[] {
  return a.secoes.flatMap((s) => s.grupos.flatMap((g) => g.itens));
}

describe("escopo — chips e nomes", () => {
  it("chip do jovem = 1º nome + turma da dupla ('Ana · 2026/2027')", () => {
    const d = mkDupla();
    expect(rotuloChipDupla(d)).toBe("Ana · 2026/2027");
    const chips = chipsDaAgenda([d]);
    expect(chips.map((c) => c.id)).toEqual(["dupla:d1", "eu", "tudo"]);
    expect(chips[0].rotulo).toBe("Ana · 2026/2027");
  });

  it("nome social ganha do civil no primeiro nome", () => {
    const d = mkDupla({ mentorado: mkMentorado("Beatriz Costa", "Bia") });
    expect(primeiroNomeDaDupla(d)).toBe("Bia");
  });

  it("com uma dupla só ainda saem os três chips; sem dupla, Eu + Tudo", () => {
    expect(chipsDaAgenda([mkDupla()])).toHaveLength(3);
    expect(chipsDaAgenda([]).map((c) => c.id)).toEqual(["eu", "tudo"]);
  });
});

describe("bucketing Hoje / Amanhã / Próximos", () => {
  it("cada encontro senta no próprio dia e os dias vêm em ordem", () => {
    // os três no futuro do AGORA (20h de hoje) — senão viram limbo/aviso
    const d = mkDupla({
      encontros: [
        mkEncontro({ id: "e-hj", numero: 3, data_hora: `${HOJE}T21:00:00-03:00` }),
        mkEncontro({ id: "e-am", numero: 4, data_hora: `${AMANHA}T19:00:00-03:00` }),
        mkEncontro({ id: "e-dep", numero: 5, data_hora: `${DEPOIS}T19:00:00-03:00` }),
      ],
    });
    const a = deriveAgendaMinha({ ...BASE, duplas: [d] });
    const [hoje, amanha, proximos] = a.secoes;
    expect(hoje.id).toBe("hoje");
    expect(hoje.grupos[0].itens.map((i) => i.id)).toEqual(["enc-e-hj"]);
    expect(amanha.grupos[0].itens.map((i) => i.id)).toEqual(["enc-e-am"]);
    expect(proximos.grupos.map((g) => g.dia)).toEqual([DEPOIS]);
    expect(proximos.grupos[0].itens[0].id).toBe("enc-e-dep");
  });

  it("ordena por horário dentro do dia; item sem hora vai pro fim", () => {
    const d = mkDupla({
      encontros: [
        mkEncontro({ id: "e-tarde", numero: 2, data_hora: `${HOJE}T21:30:00-03:00` }),
        mkEncontro({ id: "e-cedo", numero: 1, data_hora: `${HOJE}T20:30:00-03:00` }),
      ],
    });
    const a = deriveAgendaMinha({
      ...BASE,
      duplas: [d],
      supervisoes: [mkSupervisao({ id: "sup-1", data: HOJE })],
    });
    const ids = a.secoes[0].grupos[0].itens.map((i) => i.id);
    expect(ids).toEqual(["enc-e-cedo", "enc-e-tarde", "sup-sup-1"]);
  });
});

describe("pendências — warnrows do topo do Hoje", () => {
  it("realizado há >24h sem registro vira aviso com deep-link #registrar-", () => {
    const e = mkEncontro({
      id: "e4",
      numero: 4,
      status: "realizado",
      data_hora: "2026-10-05T19:00:00-03:00",
      realizado_em: "2026-10-05T19:00:00-03:00",
    });
    const a = deriveAgendaMinha({ ...BASE, duplas: [mkDupla({ encontros: [e] })] });
    expect(a.avisos).toHaveLength(1);
    const av = a.avisos[0];
    expect(av.titulo).toBe("Registro do encontro 4 · Ana · 2026/2027");
    expect(av.href).toBe("/duplas/d1#registrar-e4");
    expect(av.remarcar).toBe(false);
    // a pendência mora no aviso — não duplica como item da lista
    expect(todosOsItens(a).some((i) => i.encontro?.id === "e4")).toBe(false);
  });

  it("realizado de hoje sem registro ainda é item, com 'Registrar como foi'", () => {
    const e = mkEncontro({
      id: "e-hj",
      numero: 8,
      status: "realizado",
      data_hora: `${HOJE}T19:00:00-03:00`,
      realizado_em: `${HOJE}T19:00:00-03:00`,
    });
    const a = deriveAgendaMinha({ ...BASE, duplas: [mkDupla({ encontros: [e] })] });
    const item = todosOsItens(a).find((i) => i.id === "enc-e-hj");
    expect(item).toBeDefined();
    expect(item!.acoes).toContain("registrar");
    // sem as 24h do semáforo ainda não é cobrança — não vira warnrow
    expect(a.avisos).toHaveLength(0);
  });

  it("agendado vencido sem registro (limbo) vira aviso com Remarcar", () => {
    const e = mkEncontro({
      id: "e-limbo",
      numero: 7,
      data_hora: "2026-10-06T19:00:00-03:00",
    });
    const a = deriveAgendaMinha({ ...BASE, duplas: [mkDupla({ encontros: [e] })] });
    expect(a.avisos).toHaveLength(1);
    expect(a.avisos[0].remarcar).toBe(true);
    expect(a.avisos[0].encontro?.id).toBe("e-limbo");
    expect(a.avisos[0].href).toBe("/duplas/d1#registrar-e-limbo");
    // a pendência mora no aviso — o encontro não duplica como item
    expect(todosOsItens(a).every((i) => i.encontro?.id !== "e-limbo")).toBe(true);
    expect(a.avisos[0].cta).toBe("Preencher registro");
  });

  it("remarcado legado vencido tem o mesmo tratamento de limbo que agendado", () => {
    // status pré-RPC: a remarcação antiga gravava "remarcado". Sem a cobertura
    // em limboAberto a row sumia da agenda sem aviso — e travava na action,
    // que só aceitava "agendado".
    const e = mkEncontro({
      id: "e-rem",
      numero: 5,
      status: "remarcado",
      data_hora: "2026-10-06T19:00:00-03:00",
    });
    const a = deriveAgendaMinha({ ...BASE, duplas: [mkDupla({ encontros: [e] })] });
    expect(a.avisos).toHaveLength(1);
    expect(a.avisos[0].encontro?.id).toBe("e-rem");
    expect(a.avisos[0].remarcar).toBe(true);
    expect(todosOsItens(a).every((i) => i.encontro?.id !== "e-rem")).toBe(true);
  });

  it("agendado sem data_hora vira item 'a agendar' em vez de sumir", () => {
    const e = mkEncontro({ id: "e-semd", numero: 5, data_hora: null });
    const a = deriveAgendaMinha({ ...BASE, duplas: [mkDupla({ encontros: [e] })] });
    const item = todosOsItens(a).find((i) => i.encontro?.id === "e-semd");
    expect(item).toBeDefined();
    expect(item!.acoes).toContain("remarcar");
  });

  it("encontro 2 ordena antes do 10 (comparação numérica, não léxica)", () => {
    const e2 = mkEncontro({ id: "e2", numero: 2, data_hora: `${DEPOIS}T19:00:00-03:00` });
    const e10 = mkEncontro({ id: "e10", numero: 10, data_hora: `${DEPOIS}T20:00:00-03:00` });
    const a = deriveAgendaMinha({ ...BASE, duplas: [mkDupla({ encontros: [e10, e2] })] });
    const ids = todosOsItens(a).filter((i) => i.tipo === "encontro").map((i) => i.encontro?.numero);
    expect(ids.indexOf(2)).toBeLessThan(ids.indexOf(10));
  });

  it("agendado em andamento ainda é item (é onde o 'Entrar' mora) — a cobrança espera o fim", () => {
    // 19h–20h, agora 19:30: limbo pelo semáforo mas o encontro está rolando
    const e = mkEncontro({
      id: "e-agora",
      numero: 7,
      data_hora: `${HOJE}T19:00:00-03:00`,
      link: "https://meet.google.com/abc-defg",
    });
    const a = deriveAgendaMinha({
      ...BASE,
      duplas: [mkDupla({ encontros: [e] })],
      agora: Date.parse(`${HOJE}T19:30:00-03:00`),
    });
    expect(a.avisos).toHaveLength(0);
    const item = todosOsItens(a).find((i) => i.id === "enc-e-agora");
    expect(item).toBeDefined();
    expect(item!.acoes).toContain("entrar");
  });

  it("combinado pendente com prazo vencido vira aviso pro #combinados", () => {
    const d = mkDupla({
      encaminhamentos: [
        mkEncaminhamento({ id: "c-venc", prazo: "2026-10-05" }),
        mkEncaminhamento({ id: "c-ok", prazo: "2026-10-20" }),
        mkEncaminhamento({ id: "c-feito", prazo: "2026-10-01", status: "feito" }),
      ],
    });
    const a = deriveAgendaMinha({ ...BASE, duplas: [d] });
    expect(a.avisos).toHaveLength(1);
    expect(a.avisos[0].titulo).toBe("Combinado vencido · Ana · 2026/2027");
    expect(a.avisos[0].href).toBe("/duplas/d1#combinados");
  });
});

describe("passo oficial sem row — 'a agendar'", () => {
  it("dupla sem o encontro do próximo número ganha item tracejado", () => {
    // calendário oficial: encontro 1 já passou (faltante), 2 é o próximo
    const eventos = [
      mkEvento(1, "2026-10-06"),
      mkEvento(2, "2026-10-13"),
      mkEvento(3, "2026-10-20"),
    ];
    const a = deriveAgendaMinha({
      ...BASE,
      duplas: [mkDupla()],
      eventos,
    });
    const previstos = todosOsItens(a).filter((i) => i.tipo === "a_agendar");
    // encontro 1 (vencido, sem row) é faltante e também é o proximoNumero —
    // a dedup por número impede o item duplo
    expect(previstos.map((p) => p.numero)).toEqual([1]);
    expect(previstos[0].rotulo).toBe("Encontro 1 · 2026/2027");
    expect(previstos[0].estado).toBe("a agendar");
    expect(previstos[0].acoes).toEqual(["agendar"]);
    // data oficial já passou → cai no grupo "a agendar" do fim de Próximos
    const proximos = a.secoes.find((s) => s.id === "proximos")!;
    expect(proximos.grupos.at(-1)!.dia).toBeNull();
  });

  it("com row agendada do próximo número não nasce 'a agendar' duplicado", () => {
    const eventos = [mkEvento(1, "2026-10-13"), mkEvento(2, "2026-10-20")];
    const d = mkDupla({
      encontros: [
        mkEncontro({ numero: 1, data_hora: "2026-10-13T19:00:00-03:00" }),
      ],
    });
    const a = deriveAgendaMinha({ ...BASE, duplas: [d], eventos });
    // proximoNumero=1 tem row agendada; o 2 tem data oficial FUTURA — só
    // "a agendar" aparece pra passo já esperado ou o próximo sem row;
    // proximoNumero aqui é o 1 (tem row) e não há faltante: nenhum previsto
    expect(todosOsItens(a).filter((i) => i.tipo === "a_agendar")).toHaveLength(0);
  });
});

describe("sessões de especialista — sempre convidadas", () => {
  it("sessão marcada entra como guest sem link nem ação de entrar", () => {
    const trilha = mkTrilha({
      sessoes: [
        mkSessao({ numero: 1, status: "realizado", realizado_em: "2026-09-20T16:00:00-03:00" }),
        mkSessao({ numero: 2, status: "realizado", realizado_em: "2026-09-30T16:00:00-03:00" }),
        mkSessao({ id: "s3", numero: 3, data_hora: `${DEPOIS}T16:00:00-03:00` }),
      ],
    });
    const a = deriveAgendaMinha({
      ...BASE,
      duplas: [mkDupla()],
      trilhas: { d1: [trilha] },
    });
    const item = todosOsItens(a).find((i) => i.id === "esp-s3");
    expect(item).toBeDefined();
    expect(item!.convidado).toBe(true);
    expect(item!.notaConvidado).toBe("agenda de Ana: você não participa");
    expect(item!.rotulo).toBe(
      "Trilha de especialista · sessão 3 de 5 · 2026/2027"
    );
    expect(item!.acoes).toEqual([]);
    expect(item!.link).toBeNull();
    // sessão passada da trilha não reaparece na agenda pra frente
    expect(todosOsItens(a).filter((i) => i.tipo === "sessao_esp")).toHaveLength(1);
  });
});

describe("itens do próprio mentor (escopo eu)", () => {
  it("supervisão de hoje entra como item 'eu' nomeando quem conduz", () => {
    const a = deriveAgendaMinha({
      ...BASE,
      duplas: [mkDupla()],
      supervisoes: [mkSupervisao({ id: "sup-1", data: HOJE })],
    });
    const item = todosOsItens(a).find((i) => i.id === "sup-sup-1");
    expect(item).toBeDefined();
    expect(item!.escopo).toBe("eu");
    expect(item!.titulo).toBe("Supervisão com Paula Nunes");
  });

  it("supervisão já passada não entra na agenda", () => {
    const a = deriveAgendaMinha({
      ...BASE,
      duplas: [mkDupla()],
      supervisoes: [mkSupervisao({ data: "2026-10-01" })],
    });
    expect(todosOsItens(a).filter((i) => i.tipo === "supervisao")).toHaveLength(0);
  });

  it("supervisão conduzida por mim cita o mentor — mesmo com nomes iguais", () => {
    // o bug era classificar por NOME: um supervisor homônimo ("André Lima"
    // conduzindo André Lima) seria lido como recebida. Por id é inequívoco.
    const a = deriveAgendaMinha({
      ...BASE,
      duplas: [mkDupla()],
      supervisoes: [
        mkSupervisao({
          data: HOJE,
          mentor_id: "pm",
          supervisor_id: "ps",
          supervisor: { id: "ps", nome: "André Lima" },
          mentor: { id: "pm", nome: "André Lima" },
        }),
        mkSupervisao({
          data: HOJE,
          mentor_id: "pm-outro",
          supervisor_id: "pm",
          supervisor: { id: "pm", nome: "André Lima" },
          mentor: { id: "pm-outro", nome: "Bruno Reis" },
        }),
      ],
    });
    const itens = todosOsItens(a).filter((i) => i.tipo === "supervisao");
    expect(itens).toHaveLength(2);
    expect(itens.map((i) => i.titulo).sort()).toEqual([
      "Supervisão com André Lima",
      "Supervisão de Bruno Reis",
    ]);
  });

  it("formação futura da minha turma é item 'eu'; encerramento é do jovem", () => {
    const eventos = [
      mkEvento(null, DEPOIS, "formacao"),
      mkEvento(null, DEPOIS, "evento_encerramento"),
      // formação de outra turma/cronograma — não é compromisso do mentor
      mkEvento(null, DEPOIS, "formacao", "c-outra"),
    ];
    const a = deriveAgendaMinha({
      ...BASE,
      duplas: [mkDupla()],
      eventos,
    });
    const formacao = todosOsItens(a).filter(
      (i) => i.tipo === "programa" && i.escopo === "eu"
    );
    expect(formacao).toHaveLength(1);
    expect(formacao[0].rotulo).toBe("Formação de mentores");
    const encerramento = todosOsItens(a).filter(
      (i) => i.tipo === "programa" && i.escopo !== "eu"
    );
    expect(encerramento).toHaveLength(1);
    expect(encerramento[0].escopo).toBe("dupla:d1");
    expect(encerramento[0].convidado).toBe(true);
  });
});

describe("filtro de escopo", () => {
  it("chip do jovem guarda itens e avisos dele; 'eu' guarda os próprios; 'tudo' tudo", () => {
    const ana = mkDupla({ id: "d1", mentorado: mkMentorado("Ana Souza") });
    const caio = mkDupla({
      id: "d2",
      turma: "2027/2028",
      cronograma_id: "c2",
      mentorado: mkMentorado("Caio Martins"),
      encontros: [
        mkEncontro({
          id: "e-caio",
          numero: 5,
          status: "realizado",
          data_hora: "2026-10-05T19:00:00-03:00",
          realizado_em: "2026-10-05T19:00:00-03:00",
        }),
      ],
    });
    const cronogramas = [
      CRONOGRAMA,
      { ...CRONOGRAMA, id: "c2", turma: "2027/2028", nome: "Turma 2027/2028" },
    ];
    const agenda = deriveAgendaMinha({
      ...BASE,
      duplas: [ana, caio],
      cronogramas,
      eventos: [
        mkEvento(1, "2026-10-13"),
        mkEvento(null, DEPOIS, "formacao", "c2"),
      ],
      supervisoes: [mkSupervisao({ data: HOJE })],
    });

    // Tudo: itens da Ana (previsto) e a formação; a supervisão de HOJE já
    // está na faixa "Minha agenda" e não se repete na lista
    const tudo = filtraAgenda(agenda, "tudo");
    expect(tudo.avisos).toHaveLength(1); // registro do Caio
    const itensTudo = tudo.secoes.flatMap((s) => s.grupos.flatMap((g) => g.itens));
    expect(itensTudo.some((i) => i.tipo === "supervisao")).toBe(false);
    const soAna = filtraAgenda(agenda, "dupla:d1");
    expect(soAna.avisos).toHaveLength(0); // a pendência é do Caio
    expect(
      soAna.secoes.flatMap((s) => s.grupos.flatMap((g) => g.itens)).every(
        (i) => i.escopo === "dupla:d1"
      )
    ).toBe(true);

    const soCaio = filtraAgenda(agenda, "dupla:d2");
    expect(soCaio.avisos[0]?.duplaId).toBe("d2");

    const eu = filtraAgenda(agenda, "eu");
    const itensEu = eu.secoes.flatMap((s) => s.grupos.flatMap((g) => g.itens));
    expect(itensEu.every((i) => i.escopo === "eu")).toBe(true);
    expect(itensEu.some((i) => i.tipo === "supervisao")).toBe(true);
    expect(itensEu.some((i) => i.tipo === "programa")).toBe(true); // formação da turma do Caio é minha também — cronograma c2 é de dupla minha
    // grupos/sessões que ficaram vazios não viram cabeçalho órfão
    expect(eu.secoes.every((s) => s.grupos.every((g) => g.itens.length > 0))).toBe(true);
  });
});

describe("'Entrar' só existe com link válido e encontro acontecendo", () => {
  const base = () =>
    mkDupla({
      encontros: [
        mkEncontro({
          id: "e-now",
          numero: 2,
          data_hora: `${HOJE}T19:00:00-03:00`,
          link: "https://meet.google.com/abc-defg",
        }),
      ],
    });

  it("perto da hora e durante vale; muito cedo, encerrado ou sem link não", () => {
    // 19h, agora 19:30 — em andamento (limbo aberto, ainda é item)
    let a = deriveAgendaMinha({
      ...BASE,
      duplas: [base()],
      agora: Date.parse(`${HOJE}T19:30:00-03:00`),
    });
    expect(
      todosOsItens(a).find((i) => i.id === "enc-e-now")!.acoes
    ).toContain("entrar");

    // agora 18h44 — antes da janela de 15min
    a = deriveAgendaMinha({
      ...BASE,
      duplas: [base()],
      agora: Date.parse(`${HOJE}T18:44:00-03:00`),
    });
    expect(
      todosOsItens(a).find((i) => i.id === "enc-e-now")!.acoes
    ).not.toContain("entrar");

    // agora 20:30 — encontro 19h–20h já encerrou sem registro: limbo fechado,
    // sai da lista e vira aviso (não tem "Entrar" pra chamada encerrada)
    a = deriveAgendaMinha({
      ...BASE,
      duplas: [base()],
      agora: Date.parse(`${HOJE}T20:30:00-03:00`),
    });
    expect(todosOsItens(a).every((i) => i.id !== "enc-e-now")).toBe(true);
    expect(a.avisos[0].remarcar).toBe(true);

    // link inseguro nunca vira ação
    const semLink = mkDupla({
      encontros: [
        mkEncontro({
          numero: 2,
          data_hora: `${HOJE}T19:00:00-03:00`,
          link: "javascript:alert(1)",
        }),
      ],
    });
    a = deriveAgendaMinha({
      ...BASE,
      duplas: [semLink],
      agora: Date.parse(`${HOJE}T19:30:00-03:00`),
    });
    const item = todosOsItens(a).find((i) => i.tipo === "encontro")!;
    expect(item.acoes).not.toContain("entrar");
    expect(item.link).toBeNull();
  });
});

describe("resumo da semana e rail", () => {
  it("conta encontros da semana (seg–dom), realizados e pendências", () => {
    // semana de 07/10/2026 = seg 05/10 → dom 11/10
    const d = mkDupla({
      encontros: [
        mkEncontro({ numero: 1, status: "realizado", data_hora: "2026-10-06T19:00:00-03:00", realizado_em: "2026-10-06T19:00:00-03:00", registro: { id: "r1" } as Encontro["registro"] }),
        mkEncontro({ numero: 2, data_hora: `${DEPOIS}T19:00:00-03:00` }),
        // semana que vem — fora da contagem
        mkEncontro({ numero: 3, data_hora: "2026-10-14T19:00:00-03:00" }),
      ],
      encaminhamentos: [mkEncaminhamento({ prazo: "2026-10-05" })],
    });
    const a = deriveAgendaMinha({ ...BASE, duplas: [d] });
    expect(a.semana.seg).toBe("2026-10-05");
    expect(a.semana.dom).toBe("2026-10-11");
    // enc. 1 (ter, realizado c/ registro) e enc. 2 (sáb, agendado) são da
    // semana; o 3 (14/10) é da próxima — não conta
    expect(a.semana.encontros).toBe(2);
    expect(a.semana.realizados).toBe(1);
    expect(a.semana.pendencias).toBe(1); // combinado vencido
    expect(a.duplasRail[0].saude.semaforo).toBe("atencao"); // encaminhamento vencido
    expect(a.duplasRail[0].proximoTexto).toContain("encontro 2");
  });
});

describe("agenda vazia", () => {
  it("sem duplas: chips Eu+Tudo, seções vazias e rail limpo", () => {
    const a = deriveAgendaMinha({ ...BASE, duplas: [] });
    expect(a.chips.map((c) => c.id)).toEqual(["eu", "tudo"]);
    expect(a.secoes.every((s) => s.grupos.length === 0)).toBe(true);
    expect(a.avisos).toHaveLength(0);
    expect(a.duplasRail).toHaveLength(0);
  });
});

describe("secoesDaAgenda — estrutura pura", () => {
  it("item sem dia vira grupo 'a agendar' no fim de Próximos", () => {
    const itemSemDia: AgendaItem = {
      id: "prev-x",
      escopo: "dupla:d1",
      tipo: "a_agendar",
      dia: null,
      ts: null,
      hora: null,
      fim: null,
      rotulo: "Encontro 1 · 2026/2027",
      titulo: "Encontro 1 de 16 com Ana",
      estado: "a agendar",
      meta: [],
      tom: "muted",
      convidado: false,
      notaConvidado: null,
      duplaId: "d1",
      encontro: null,
      numero: 1,
      sugeridoDia: null,
      eventoId: null,
      link: null,
      acoes: ["agendar"],
    };
    const secoes = secoesDaAgenda([itemSemDia], HOJE);
    const proximos = secoes.find((s) => s.id === "proximos")!;
    expect(proximos.grupos).toHaveLength(1);
    expect(proximos.grupos[0].rotulo).toContain("agendar");
  });
});

describe("encontrosCobertos — as chaves duplaId:numero que a faixa suprime", () => {
  it("item 'encontro' e aviso de pendência cobrem o mesmo encontro", () => {
    const d = mkDupla({
      encontros: [
        // limbo (agendado vencido): mora no aviso, não tem item na lista —
        // se a faixa só olhasse os itens, esse card reaparecia
        mkEncontro({
          id: "e-limbo",
          numero: 6,
          data_hora: "2026-10-05T19:00:00-03:00",
        }),
        // agendado amanhã: item "encontro" normal da lista
        mkEncontro({
          id: "e8",
          numero: 8,
          data_hora: `${AMANHA}T19:00:00-03:00`,
        }),
      ],
    });
    const a = deriveAgendaMinha({ ...BASE, duplas: [d] });
    expect([...encontrosCobertos(a)].sort()).toEqual(["d1:6", "d1:8"]);
  });

  it("'a agendar' sem row cobre o passo oficial — o card não volta na faixa", () => {
    const eventos = [mkEvento(1, "2026-10-06"), mkEvento(2, "2026-10-13")];
    const a = deriveAgendaMinha({
      ...BASE,
      duplas: [mkDupla()],
      eventos,
    });
    // sem row nenhuma, o encontro 1 faltante vira o item "a agendar" —
    // a chave sai por numero, sem depender de encontro.id
    expect(encontrosCobertos(a).has("d1:1")).toBe(true);
  });

  it("sessão de especialista e supervisão não são o encontro — não cobrem", () => {
    const d = mkDupla({
      encontros: [
        mkEncontro({
          id: "e8",
          numero: 8,
          data_hora: `${AMANHA}T19:00:00-03:00`,
        }),
      ],
    });
    const a = deriveAgendaMinha({
      ...BASE,
      duplas: [d],
      // a sessão tem duplaId+numero como os itens de encontro — só o tipo
      // a separa; usar número diferente prova que ela não vaza pra chave
      trilhas: {
        d1: [
          mkTrilha({
            sessoes: [
              mkSessao({
                id: "s3",
                numero: 3,
                data_hora: `${AMANHA}T20:00:00-03:00`,
              }),
            ],
          }),
        ],
      },
      supervisoes: [mkSupervisao({ data: AMANHA, dupla_id: "d1" })],
    });
    expect([...encontrosCobertos(a)]).toEqual(["d1:8"]);
  });

  it("agenda vazia → conjunto vazio (a faixa mostra tudo que tiver)", () => {
    const a = deriveAgendaMinha({ ...BASE, duplas: [] });
    expect(encontrosCobertos(a).size).toBe(0);
  });
});
