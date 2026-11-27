// @vitest-environment jsdom

// 1126: o card do caminho é a interface do simulador — "Propor este
// caminho" chama a action com o que o caminho pede (ritmo, fusão e a
// decisão de recesso) e mostra o retorno sem sair do chat.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";

vi.mock("@/lib/actions-plano", () => ({
  combinarPlano: vi.fn(async () => ({ ok: true })),
}));
import { combinarPlano } from "@/lib/actions-plano";

import { CardPlano } from "@/components/assistente-cards";
import type { UiPlano } from "@/lib/ia/ui";
import { montar } from "./dom";

const futuro = (dias: number) =>
  new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);

const passo = (numero: number, data: string, acao: "agendar" | "travado" = "agendar") => ({
  numero,
  titulo: `Encontro ${numero}`,
  acao,
  encontro_id: null,
  data,
  data_oficial: data,
  vence_no_caminho: false,
  precondicao: null,
  aviso: null,
});

const bloco = (): UiPlano => ({
  kind: "plano",
  dupla_id: "d1",
  mentor: "Rogério",
  mentorado: "Jhonatan",
  em_dia: false,
  data_recuperacao: futuro(47),
  data_projetada: futuro(63),
  cabem_ate_encerramento: { cabem: 12, faltam: 12 },
  encerramento: futuro(49),
  ritmo: 2,
  passos: [
    passo(5, futuro(0), "travado"),
    passo(6, futuro(7)),
    passo(7, futuro(7)),
    passo(8, futuro(14)),
  ],
  pendencias: [],
  recessos_pendentes: [
    {
      ciclo_evento_id: "r1",
      titulo: "Recesso de fim de ano",
      inicio: futuro(19),
      fim: futuro(38),
    },
  ],
  grade: null,
  doc: null,
  avisos: [],
  nivel: null,
  estado: "recuperacao",
  sugestao: null,
  melhor: null,
  alternativas: [{ rotulo: "1 por dia", data: futuro(10) }],
  cenarios: [],
  caminho: {
    rotulo: "fusão em 2 pares",
    data: futuro(47),
    sessoes: 3,
    ritmo: 2,
    fusao: [
      [6, 7],
      [8, 9],
    ],
    decisao_recesso: "segue",
    exigencias: ["juntar 2 pares (6+7, 8+9)", "2 encontros por semana"],
    passos: [
      passo(5, futuro(0), "travado"),
      passo(6, futuro(7)),
      passo(7, futuro(7)),
      passo(8, futuro(14)),
    ],
    recesso: { ciclo_evento_id: "r1", usa: false },
  },
  plano: null,
});

const botao = (alvo: HTMLElement, texto: string) =>
  [...alvo.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(texto)
  );

describe("CardPlano: propor o caminho (1126)", () => {
  beforeEach(() => vi.mocked(combinarPlano).mockClear());

  it("mostra o essencial: data, o que muda e o botão de enviar", () => {
    const { alvo, desmontar } = montar(<CardPlano b={bloco()} />);
    const texto = alvo.textContent ?? "";
    expect(texto).toContain("Em dia em");
    expect(texto).toContain("O que muda");
    expect(texto).toContain("juntar 2 pares (6+7, 8+9)");
    expect(texto).toContain("12 encontros. O ciclo encerra em");
    expect(texto).toContain("A dupla precisa decidir o recesso");
    expect(botao(alvo, "Enviar o plano")).toBeTruthy();
    // detalhe fechado: nada de 4 linhas de encontro antes do clique
    expect(texto).not.toContain("Encontro 6");
    expect(texto).not.toContain("Caminho de menor fricção");
    desmontar();
  });

  it("abre os encontros sob demanda, com sessão e travado marcados", () => {
    const { alvo, desmontar } = montar(<CardPlano b={bloco()} />);
    act(() => {
      botao(alvo, "Ver os 4 encontros")!.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });
    expect(alvo.textContent).toContain("2 encontros juntos"); // 6 e 7
    expect(alvo.textContent).toContain("já marcado"); // 5º travado
    expect(alvo.textContent).toContain("Encontro 6");
    desmontar();
  });

  it("envia com ritmo, fusão e a decisão do recesso do caminho", async () => {
    const { alvo, desmontar } = montar(<CardPlano b={bloco()} />);
    const b = botao(alvo, "Enviar o plano")!;
    await act(async () => {
      b.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(combinarPlano).toHaveBeenCalledWith("d1", {
      ritmo: 2,
      fusao: [
        [6, 7],
        [8, 9],
      ],
      decisoes: [{ cicloEventoId: "r1", usa: false }],
    });
    expect(alvo.textContent).toContain("Plano enviado");
    desmontar();
  });

  it("erro da action fica inline, sem perder o caminho", async () => {
    vi.mocked(combinarPlano).mockResolvedValueOnce({
      error: "A dupla precisa decidir o recesso antes.",
    });
    const { alvo, desmontar } = montar(<CardPlano b={bloco()} />);
    await act(async () => {
      botao(alvo, "Enviar o plano")!.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });
    expect(alvo.textContent).toContain("A dupla precisa decidir o recesso");
    expect(alvo.textContent).toContain("O que muda");
    desmontar();
  });
});
