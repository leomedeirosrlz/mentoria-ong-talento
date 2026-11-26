// @vitest-environment jsdom

// 025 FR-006 — com combinado valendo (planoVivo) o "Para ficar em dia"
// vira faixa: a projeção que o combinado já carrega (headline feliz,
// quadrados, passos, avisos) não monta; ficam os alertas que o combinado
// não tem, as pendências exclusivas e a saída "Ver o combinado". As
// âncoras #plano-em-dia e #recesso-dupla seguem vivas.

import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/actions-plano", () => ({
  combinarPlano: vi.fn(async () => ({ ok: true })),
  salvarDisponibilidadePlano: vi.fn(async () => ({ ok: true })),
  simularPlano: vi.fn(async () => ({ error: "não usado no teste" })),
}));
vi.mock("@/lib/actions", () => ({
  disponibilidadesDaDupla: vi.fn(async () => ({
    mentor: null,
    jovem: null,
    jovemNome: null,
  })),
}));
vi.mock("@/lib/actions-recesso", () => ({
  declararRecesso: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/actions-chamados", () => ({
  abrirChamado: vi.fn(async () => ({ ok: true })),
}));

import { PlanoEmDiaCard } from "@/components/plano-em-dia-card";
import type { RecessoDaFicha } from "@/components/recesso-dupla-card";
import type { PassoPlano, PlanoAplicavel } from "@/lib/plano-em-dia";
import type { Dupla } from "@/lib/types";
import { montar } from "./dom";

const PASSO: PassoPlano = {
  numero: 5,
  acao: "agendar",
  encontroId: null,
  data: "2026-11-28",
  dataOficial: "2026-11-24",
  titulo: "Escuta ativa",
  fase: null,
  marco: false,
};

const plano = (over: Partial<PlanoAplicavel> = {}): PlanoAplicavel => ({
  aplicavel: true,
  emDia: false,
  estado: "recuperacao",
  pendenciasRegistro: [],
  passos: [PASSO],
  ritmo: 2,
  dataRecuperacao: "2026-12-10",
  dataProjetada: "2026-12-10",
  encerramento: "2027-01-15",
  cabemAteEncerramento: null,
  praticaFlex: null,
  nivel: "semana_dupla",
  sugestao: "Dois encontros por semana recuperam o ritmo.",
  alternativaRitmo: null,
  alternativaRecesso: null,
  recessosPendentes: [],
  avisos: ["O 5º encontro vence no caminho."],
  ...over,
});

const dupla = (over: Partial<Dupla> = {}): Dupla =>
  ({
    id: "d-1",
    turma: "T1",
    cronograma_id: "c-1",
    status: "ativa",
    iniciada_em: "2026-09-01",
    trilha: "dpp",
    demanda: null,
    solicitacao_id: null,
    mentor: { id: "m-1" },
    mentorado: { id: "j-1" },
    supervisor: null,
    encontros: [],
    encaminhamentos: [],
    ...over,
  }) as Dupla;

const RECESSO: RecessoDaFicha = {
  cicloEventoId: "ce-1",
  titulo: "Recesso de fim de ano",
  inicio: "2026-12-22",
  fim: "2027-01-04",
  usa: null,
  declaradoEm: null,
  autorNome: null,
};

const link = (alvo: ParentNode, texto: string) =>
  [...alvo.querySelectorAll("a")].find((a) =>
    a.textContent?.trim().includes(texto)
  );

describe("faixa com plano vivo (FR-006)", () => {
  it("projeção que o combinado já carrega não monta; exclusivos e âncoras ficam", () => {
    const { alvo, desmontar } = montar(
      <PlanoEmDiaCard
        plano={plano({
          pendenciasRegistro: [
            {
              numero: 4,
              encontroId: "e-4",
              estado: "pendente_registro",
              dataHora: null,
            },
          ],
          recessosPendentes: [
            {
              cicloEventoId: "ce-1",
              titulo: "Recesso de fim de ano",
              inicio: "2026-12-22",
              fim: "2027-01-04",
            },
          ],
        })}
        dupla={dupla()}
        souMentor
        planoVivo
        recessos={[RECESSO]}
      />
    );

    // suprimido: headline feliz, quadrados, passos, avisos
    expect(alvo.textContent).not.toContain("Em dia em");
    expect(
      alvo.querySelector('[role="img"][aria-label*="encontros feitos"]')
    ).toBeNull();
    expect(alvo.querySelector("ol")).toBeNull();
    expect(alvo.textContent).not.toContain("vence no caminho");
    // o gatilho "Combinar o plano" some — a saída é "Ver o plano"
    // ("Combinar o plano" segue no texto de ajuda do recesso: é a superfície)
    expect(
      [...alvo.querySelectorAll("button")].some((b) =>
        b.textContent?.includes("Combinar o plano")
      )
    ).toBe(false);

    // mantido: header, "Falta N decisões", exclusivos e o CTA pra ficha
    expect(alvo.textContent).toContain("Para ficar em dia");
    expect(alvo.textContent).toContain("encontro pra repor");
    expect(alvo.textContent).toContain(
      "Falta 1 decisão da dupla pra fechar a proposta."
    );
    expect(alvo.textContent).toContain("Antes de seguir o plano");
    expect(alvo.textContent).toContain("Recesso no caminho");
    expect(link(alvo, "Ver o plano")?.getAttribute("href")).toBe(
      "/duplas/d-1#acordos"
    );

    // âncoras vivas na faixa: root #plano-em-dia + bloco #recesso-dupla
    const secao = alvo.querySelector("#plano-em-dia");
    expect(secao?.getAttribute("aria-labelledby")).toBe("plano-em-dia-titulo");
    expect(alvo.querySelector("#plano-em-dia-titulo")?.textContent).toBe(
      "Para ficar em dia"
    );
    expect(alvo.querySelector("#recesso-dupla")).not.toBeNull();
    desmontar();
  });

  it("estado conversa segue na faixa: alerta, sugestão e falar com a coordenação", () => {
    const { alvo, desmontar } = montar(
      <PlanoEmDiaCard
        plano={plano({
          estado: "conversa",
          dataRecuperacao: null,
          dataProjetada: "2027-03-01",
          cabemAteEncerramento: { cabem: 3, faltam: 5 },
          sugestao: "Vale conversar com a coordenação sobre os caminhos.",
        })}
        dupla={dupla()}
        souMentor
        planoVivo
      />
    );
    expect(alvo.textContent).toContain("Nem com 1 encontro por dia fecha");
    expect(alvo.textContent).toContain("Cabem 3 dos 5 encontros");
    expect(alvo.textContent).toContain("Falar com a coordenação");
    expect(link(alvo, "Ver o plano")).toBeDefined();
    desmontar();
  });

  it("'não fecha' segue na faixa — alerta que o combinado não carrega", () => {
    const { alvo, desmontar } = montar(
      <PlanoEmDiaCard
        plano={plano({
          dataRecuperacao: null,
          alternativaRitmo: { ritmo: 7, data: "2027-01-10" },
        })}
        dupla={dupla()}
        souMentor
        planoVivo
      />
    );
    expect(alvo.textContent).toContain("Não fecha até o encerramento");
    expect(alvo.textContent).toContain("ficariam em dia");
    desmontar();
  });

  it("pluraliza as decisões pendentes", () => {
    const { alvo, desmontar } = montar(
      <PlanoEmDiaCard
        plano={plano({
          recessosPendentes: [
            { cicloEventoId: "ce-1", titulo: "A", inicio: "2026-12-22", fim: "2026-12-26" },
            { cicloEventoId: "ce-2", titulo: "B", inicio: "2027-01-01", fim: "2027-01-05" },
          ],
        })}
        dupla={dupla()}
        souMentor
        planoVivo
      />
    );
    expect(alvo.textContent).toContain(
      "Faltam 2 decisões da dupla pra fechar a proposta."
    );
    desmontar();
  });
});

describe("card completo (sem combinado vivo)", () => {
  it("projeção inteira monta: headline feliz, quadrados, passos e avisos", () => {
    const { alvo, desmontar } = montar(
      <PlanoEmDiaCard
        plano={plano()}
        dupla={dupla()}
        souMentor
        recessos={[RECESSO]}
      />
    );
    expect(alvo.textContent).toContain("Em dia em");
    expect(
      alvo.querySelector('[role="img"][aria-label*="encontros feitos"]')
    ).not.toBeNull();
    expect(alvo.querySelectorAll("ol li").length).toBe(1);
    expect(alvo.textContent).toContain("vence no caminho");
    expect(alvo.textContent).toContain("Combinar o plano");
    // a decisão de recesso lê o efeito, não o mecanismo (025, US1)
    expect(alvo.textContent).toContain(
      "se pausam os encontros ou seguem se encontrando"
    );
    expect(alvo.textContent).not.toContain("se param ou seguem");
    desmontar();
  });
});
