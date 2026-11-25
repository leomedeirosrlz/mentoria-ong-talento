// smoke dos cards do genUI direto — renderToStaticMarkup (node, sem DOM):
// cada kind de UiBloco renderiza sem explodir, com rótulo em texto (status
// nunca só na cor), links pras telas certas e sem travessão na copy
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UiCard } from "../src/components/assistente-cards";
import type { UiBloco } from "../src/lib/ia/ui";

const hoje = new Date();
const em = (dias: number, h = 19) => {
  const d = new Date(hoje.getTime() + dias * 86_400_000);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};

const BLOCOS: UiBloco[] = [
  {
    kind: "saude",
    contagem: { em_andamento: 12, risco: 2, atencao: 3, em_dia: 7, apoio: 1, pausadas: 1 },
    pedem_acao: 6,
    destaques: [
      {
        id: "d1",
        mentor: "Ana Souza",
        mentorado: "João Lima",
        trilha: "dpp",
        status: "ativa",
        semaforo: "risco",
        motivo: "2 encontros atrasados",
        apoio: true,
        feitos: 3,
        esperado: 5,
      },
    ],
  },
  {
    kind: "dupla",
    id: "d1",
    mentor: "Ana Souza",
    mentorado: "João Lima",
    supervisor: "Paulo Reis",
    trilha: "dpp",
    status: "ativa",
    turma: "T1 · 2026/2027",
    semaforo: "atencao",
    motivo: "Registro pendente do encontro 4",
    apoio: false,
    registro_pendente: true,
    feitos: 4,
    esperado: 5,
    encontros: [
      { numero: 1, status: "realizado", tem_registro: true },
      { numero: 2, status: "realizado", tem_registro: true },
      { numero: 3, status: "nao_aconteceu", tem_registro: false },
      { numero: 4, status: "realizado", tem_registro: false },
      { numero: 5, status: "agendado", tem_registro: false },
    ],
    proximo: { numero: 5, data_hora: em(1) },
  },
  {
    kind: "agenda",
    desde: "2026-11-09",
    ate: "2026-11-15",
    total: 14,
    encontros: [
      { dupla_id: "d1", mentor: "Ana", mentorado: "João", numero: 5, status: "agendado", data_hora: em(0) },
      { dupla_id: "d2", mentor: "Bia", mentorado: "Caio", numero: 3, status: "realizado", data_hora: em(0, 10) },
      { dupla_id: "d3", mentor: "Rui", mentorado: "Lia", numero: 2, status: "agendado", data_hora: null },
    ],
  },
  {
    kind: "registros",
    dupla_id: "d1",
    total: 6,
    itens: [
      {
        encontro_numero: 4,
        realizado_em: "2026-11-03",
        avaliacao: "baixa",
        dificuldade: "participacao",
        precisa_apoio: true,
        proximo_passo: "acompanhar_de_perto",
      },
    ],
  },
  {
    kind: "fila",
    mentorados: [{ id: "m1", nome: "Lia Prado", desde: new Date(Date.now() - 12.5 * 86_400_000).toISOString() }],
    mentores: [],
    total_mentorados: 1,
    total_mentores: 0,
  },
  {
    kind: "capacidade",
    total: 2,
    mentores: [
      { id: "p1", nome: "Ana Souza", trilha: "dpp", em_uso: 3, capacidade: 3 },
      { id: "p2", nome: "Rui Melo", trilha: "especialista", em_uso: 1, capacidade: 4 },
    ],
  },
  {
    kind: "pessoas",
    pessoas: [{ id: "p1", nome: "Ana Souza", papel: "mentor_dpp" }],
  },
  {
    kind: "chamados",
    aberto: 2,
    em_atendimento: 1,
    chamados: [
      { numero: "CHA-000012", categoria: "agenda", assunto: "Remarcar encontro", status: "aberto", criado_em: new Date(Date.now() - 30 * 3_600_000).toISOString() },
    ],
  },
  {
    kind: "instrumentos",
    dupla_id: "d1",
    itens: [
      { sistema: "visao", titulo: "Construindo a sua Visão", respondidos: 1, pendentes: 0 },
      { sistema: "metas", titulo: "Definindo Minhas Metas", respondidos: 0, pendentes: 1 },
      { sistema: "pdm", titulo: "PDM", respondidos: 0, pendentes: 0 },
    ],
  },
  {
    kind: "fontes",
    fontes: [
      { guia: "instrumento-definindo-minhas-metas", secao: "Metas SMART", trecho: "Cada meta tem prazo." },
    ],
  },
];

const html = (b: UiBloco, jovem?: boolean) =>
  renderToStaticMarkup(createElement(UiCard, { bloco: b, jovem }));
const de = (kind: UiBloco["kind"]) => BLOCOS.find((b) => b.kind === kind)!;

describe("UiCard: todo kind renderiza", () => {
  it.each(BLOCOS.map((b) => [b.kind, b] as const))("%s", (_kind, b) => {
    const out = html(b);
    expect(out).toContain("<section");
    expect(out).toContain("<h3");
    expect(out).toContain("animate-enter");
    // copy: sem travessão em texto exibido
    expect(out.replace(/<[^>]+>/g, " ")).not.toContain("—");
  });
});

describe("UiCard: conteúdo", () => {
  it("saude: contagens nomeadas, apoio como pill à parte e ver todas", () => {
    const out = html(de("saude"));
    expect(out).toContain("em risco");
    expect(out).toContain("com apoio aberto");
    expect(out).toContain("Apoio pedido");
    expect(out).toContain("Ver todas as 6 que pedem ação");
    expect(out).toContain('href="/duplas/d1"');
  });

  it("saude sem destaques mostra a linha calma", () => {
    const out = html({ ...(de("saude") as Extract<UiBloco, { kind: "saude" }>), destaques: [], pedem_acao: 0 });
    expect(out).toContain("Nenhuma dupla pedindo ação agora");
  });

  it("dupla: situação, legenda dos encontros e Turma 1 por extenso", () => {
    const out = html(de("dupla"));
    expect(out).toContain("Atenção");
    expect(out).toContain("Turma 1");
    expect(out).toContain("DPP · T1");
    expect(out).toContain("2 com registro");
    expect(out).toContain("1 sem registro");
    expect(out).toContain("1 não aconteceu");
    expect(out).toContain("Próximo: encontro 5");
    expect(out).toContain("amanhã às");
    expect(out).toContain("Abrir ficha");
  });

  it("dupla do jovem: sem situação e com a rota dele", () => {
    // o projetor do jovem omite semáforo, motivo, apoio e esperado
    const jovem = { ...(de("dupla") as Extract<UiBloco, { kind: "dupla" }>) };
    delete jovem.semaforo;
    delete jovem.motivo;
    delete jovem.apoio;
    delete jovem.esperado;
    const out = html(jovem);
    expect(out).not.toContain("Atenção");
    expect(out).toContain('href="/jovem"');
    expect(out).toContain("Ver minha jornada");
  });

  it("dupla encerrada do jovem lê 'Encerrada', nunca 'Desistente'", () => {
    // na voz do jovem a encerrada é neutra — "desistente" é vocabulário
    // interno da equipe, que segue vendo o rótulo de sempre
    const encerrada = {
      ...(de("dupla") as Extract<UiBloco, { kind: "dupla" }>),
      status: "encerrada" as const,
    };
    const jovem = { ...encerrada };
    delete jovem.semaforo;
    expect(html(jovem)).toContain("Encerrada");
    expect(html(jovem)).not.toContain("Desistente");
    expect(html(encerrada)).toContain("Desistente");
  });

  it("agenda agrupa por dia (Hoje) e deixa sem data no fim", () => {
    const out = html(de("agenda"));
    expect(out).toContain("Hoje");
    expect(out.indexOf("Hoje")).toBeLessThan(out.indexOf("Sem data"));
    expect(out).toContain("Realizado");
    expect(out).toContain("Ver os 14 na agenda");
  });

  it("registros: labels do ciclo", () => {
    const out = html(de("registros"));
    expect(out).toContain("Avaliação baixa");
    expect(out).toContain("Dificuldade: participação");
    expect(out).toContain("Fazer um acompanhamento mais próximo");
  });

  it("fila, capacidade, pessoas, chamados, instrumentos, fontes", () => {
    expect(html(de("fila"))).toContain("Esperando há 12 dias");
    expect(html(de("fila"))).toContain("Nenhum mentor com vaga livre");
    expect(html(de("capacidade"))).toContain("Sem vaga");
    expect(html(de("pessoas"))).toContain("Mentor DPP");
    // número CHA não aparece no card — assunto + categoria + status bastam
    expect(html(de("chamados"))).toContain("Remarcar encontro");
    expect(html(de("chamados"))).toContain("ontem");
    const inst = html(de("instrumentos"));
    expect(inst).toContain("1 de 3 respondidos");
    expect(inst).toContain("Aguardando resposta");
    expect(inst).toContain("Não enviado");
    const fontes = html(de("fontes"));
    expect(fontes).toContain("Definindo Minhas Metas");
    expect(fontes).toContain("Metas SMART");
    // a referência citável é guia + seção: "pág." do banco era o id do
    // chunk e lia como página inexistente no documento
    expect(fontes).not.toContain("pág.");
    expect(fontes).toContain('aria-expanded="false"');
  });
});
