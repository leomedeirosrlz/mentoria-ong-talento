import { describe, expect, it } from "vitest";
import { resumoAderencia } from "@/lib/relatorios/operacional";
import { leituraAderencia } from "@/lib/relatorios/leituras-aderencia";
import { leituraSaude } from "@/lib/relatorios/leituras-saude";
import { leituraAdocao } from "@/lib/relatorios/leituras-adocao";
import { nadaADeclarar, ordenaAchados } from "@/lib/relatorios/leituras";
import type { DiaSaude } from "@/lib/relatorios/dados";
import type { FunilInstrumento } from "@/lib/relatorios/adocao";
import type {
  CicloEvento,
  Cronograma,
  Dupla,
  Encontro,
  MentoradoPar,
  Profile,
} from "@/lib/types";

// Leituras determinísticas das abas piloto (REALIZA-455): achados
// priorizados, explicáveis (métrica + denominador + regra) e com
// intervenção — o vazio diz "nada a declarar", nunca inventa urgência.
//
// Âncora: quarta 07/10/2026 meio-dia SP. Mesma fixture do
// relatorios-operacional.test.ts (encontros 6, 7 e 8 devidos).

const HOJE = new Date("2026-10-07T12:00:00-03:00");

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

function mkMentorado(nome: string): MentoradoPar {
  return {
    id: `m-${nome}`,
    nome,
    nome_social: null,
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

function enc(
  duplaId: string,
  numero: number,
  dia: string,
  // registro no mesmo dia — atraso médio não acende achado na fixture "em dia"
  registro: Encontro["registro"] = {
    id: `r-${duplaId}-${numero}`,
    tema: "Escuta ativa",
    created_at: `${dia}T23:00:00Z`,
  } as Encontro["registro"]
): Encontro {
  return {
    id: `e-${duplaId}-${numero}`,
    dupla_id: duplaId,
    numero,
    data_hora: `${dia}T22:00:00Z`,
    realizado_em: `${dia}T22:00:00Z`,
    duracao_min: 60,
    status: "realizado",
    origem: "plataforma",
    link: null,
    motivo_reagendamento: null,
    registro,
  };
}

function mkDupla(over: Partial<Dupla> = {}): Dupla {
  return {
    id: "d1",
    turma: "T1",
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

function mkEvento(numero: number, data: string): CicloEvento {
  return {
    id: `ev-${numero}`,
    cronograma_id: "c1",
    tipo: "encontro",
    numero,
    data,
    data_fim: null,
    status: "pendente",
    observacao: null,
    ordem: numero,
    titulo: `Encontro ${numero}`,
    fase: null,
    instrumentos: [],
  };
}

const CRONS = [
  {
    id: "c1",
    nome: "Ciclo T1",
    turma: "T1",
    trilha: "dpp",
    inicio_em: "2026-09-01",
    fim_em: "2027-06-30",
    encontros_esperados: 16,
    status: "ativo",
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
  },
] as Cronograma[];

const EVENTOS = [
  mkEvento(6, "2026-09-22"),
  mkEvento(7, "2026-09-29"),
  mkEvento(8, "2026-10-06"),
  mkEvento(9, "2026-10-13"),
];

const dEmDia = mkDupla({
  id: "dEmDia",
  encontros: [
    enc("dEmDia", 6, "2026-09-22"),
    enc("dEmDia", 7, "2026-09-29"),
    enc("dEmDia", 8, "2026-10-06"),
  ],
});
const dAtrasada = mkDupla({ id: "dAtrasada" }); // 0 de 3 devidos
const dApoio = mkDupla({
  id: "dApoio",
  encontros: [
    enc("dApoio", 6, "2026-09-22"),
    enc("dApoio", 7, "2026-09-29"),
    enc("dApoio", 8, "2026-10-06", {
      id: "r-apoio",
      created_at: "2026-10-07T12:00:00Z",
      precisa_apoio: true,
    } as Encontro["registro"]),
  ],
});

describe("leituraAderencia", () => {
  it("pedido de apoio vem primeiro, com denominador e link pra dupla", () => {
    const resumo = resumoAderencia([dApoio, dAtrasada, dEmDia], EVENTOS, CRONS, HOJE);
    const achados = leituraAderencia(resumo);
    expect(achados[0].tom).toBe("risco");
    expect(achados[0].titulo).toContain("apoio");
    expect(achados[0].metrica).toContain("de 3");
    expect(achados[0].acao?.href).toBe(`/duplas/${dApoio.id}`);
    expect(achados.every((a) => a.intervencao.length > 0)).toBe(true);
  });

  it("recorte em dia diz nada a declarar — sem urgência inventada", () => {
    const resumo = resumoAderencia([dEmDia], EVENTOS, CRONS, HOJE);
    const achados = leituraAderencia(resumo);
    expect(achados).toHaveLength(1);
    expect(achados[0].titulo).toBe("Nada a declarar");
    expect(achados[0].tom).toBe("ok");
  });

  it("recorte vazio é honesto", () => {
    const resumo = resumoAderencia([], EVENTOS, CRONS, HOJE);
    expect(leituraAderencia(resumo)[0].metrica).toContain("0 duplas");
  });

  it("atraso de calendário vira achado de atenção com denominador", () => {
    const resumo = resumoAderencia([dAtrasada, dEmDia], EVENTOS, CRONS, HOJE);
    const achados = leituraAderencia(resumo);
    const atraso = achados.find((a) => a.titulo.includes("calendário"));
    expect(atraso?.tom).toBe("atencao");
    expect(atraso?.metrica).toContain("1 de 2");
  });
});

describe("leituraSaude", () => {
  const dia = (d: string, risco: number, atencao: number, ok: number): DiaSaude => ({
    dia: d,
    risco,
    atencao,
    ok,
  });

  it("sem histórico é estado acumulando, não alarme", () => {
    const achados = leituraSaude([]);
    expect(achados[0].tom).toBe("info");
    expect(achados[0].metrica).toContain("0 dias");
  });

  it("risco no último dia é o primeiro achado, com denominador", () => {
    const t = [dia("2026-10-05", 0, 1, 9), dia("2026-10-06", 2, 1, 7)];
    const achados = leituraSaude(t);
    expect(achados[0].tom).toBe("risco");
    expect(achados[0].metrica).toContain("2 de 10");
  });

  it("tendência de piora aparece como atenção com as médias", () => {
    const t = [
      ...Array.from({ length: 7 }, (_, i) =>
        dia(`2026-09-2${i}`, 0, 1, 9)
      ),
      ...Array.from({ length: 7 }, (_, i) =>
        dia(`2026-10-0${i + 1}`, 0, 3, 7)
      ),
    ];
    const achados = leituraSaude(t);
    const piora = achados.find((a) => a.titulo.includes("alta"));
    expect(piora?.tom).toBe("atencao");
    expect(piora?.metrica).toContain("3.0");
    expect(piora?.metrica).toContain("1.0");
  });

  it("tudo em dia fecha com achado ok", () => {
    const t = [dia("2026-10-06", 0, 0, 12)];
    const achados = leituraSaude(t);
    expect(achados.at(-1)?.tom).toBe("ok");
    expect(achados.at(-1)?.metrica).toContain("12 de 12");
  });
});

describe("leituraAdocao", () => {
  const resumo = {
    ativas: 10,
    ativas_prev: 10,
    gestos: 100,
    gestos_prev: 100,
    sups_vivas: 4,
  };
  const celulas = [
    { superficie: "duplas", papel: "coordenacao", pessoas: 5, gestos: 50 },
    { superficie: "agenda", papel: "mentor_dpp", pessoas: 5, gestos: 50 },
  ];
  const funil = (emitidos: number, respondidos: number): FunilInstrumento[] => [
    { instrumento: "semanal", emitidos, respondidos, tardios: 0, expirados: 0, pendentes: 0 },
  ];

  const args = {
    resumo,
    celulas,
    coorte: [],
    funil: funil(10, 8),
    janela: 30 as const,
    papel: null,
    medida: "pessoas" as const,
  };

  it("sem uso nenhum é nada a declarar", () => {
    const a = leituraAdocao({
      ...args,
      resumo: { ...resumo, gestos: 0, ativas: 0 },
      celulas: [],
    });
    expect(a).toHaveLength(1);
    expect(a[0].titulo).toBe("Nada a declarar");
  });

  it("queda ≥20% na janela é achado de atenção com as duas janelas", () => {
    const a = leituraAdocao({
      ...args,
      resumo: { ...resumo, ativas: 7, ativas_prev: 10 },
    });
    const queda = a.find((x) => x.titulo.includes("caiu"));
    expect(queda?.tom).toBe("atencao");
    expect(queda?.metrica).toContain("7");
    expect(queda?.metrica).toContain("10");
  });

  it("superfícies paradas e papéis sem uso viram achados de info", () => {
    const a = leituraAdocao(args);
    const paradas = a.find((x) => x.titulo.includes("parada"));
    expect(paradas?.tom).toBe("info");
    expect(paradas?.metrica).toMatch(/de \d+ áreas/);
    const papeis = a.find((x) => x.titulo.includes("Papel") || x.titulo.includes("Papéis"));
    expect(papeis?.tom).toBe("info");
  });

  it("taxa de resposta baixa com denominador suficiente vira atenção", () => {
    const a = leituraAdocao({ ...args, funil: funil(20, 4) });
    const taxa = a.find((x) => x.titulo.includes("Taxa de resposta"));
    expect(taxa?.tom).toBe("atencao");
    expect(taxa?.metrica).toContain("4 de 20");
  });

  it("medida gestos troca o denominador do delta", () => {
    const a = leituraAdocao({
      ...args,
      medida: "gestos",
      resumo: { ...resumo, gestos: 70, gestos_prev: 100 },
    });
    const queda = a.find((x) => x.titulo.includes("caiu"));
    expect(queda?.metrica).toContain("70 gestos");
  });
});

describe("ordenaAchados / nadaADeclarar", () => {
  it("urgência primeiro, boa notícia por último, estável por tom", () => {
    const a = ordenaAchados([
      { tom: "ok", titulo: "b", metrica: "", porque: "", intervencao: "" },
      { tom: "risco", titulo: "a", metrica: "", porque: "", intervencao: "" },
      { tom: "info", titulo: "c", metrica: "", porque: "", intervencao: "" },
    ]);
    expect(a.map((x) => x.tom)).toEqual(["risco", "info", "ok"]);
  });

  it("nadaADeclarar carrega o motivo como métrica", () => {
    const [a] = nadaADeclarar("5 duplas no recorte");
    expect(a.tom).toBe("ok");
    expect(a.metrica).toBe("5 duplas no recorte");
  });
});
