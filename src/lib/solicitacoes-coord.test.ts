import { describe, expect, it } from "vitest";
import {
  pedidoAcionavel,
  pedidosAcionaveis,
  statusDoPedido,
  statusEfetivoDoPedido,
} from "./solicitacoes-coord";
import type {
  SolicitacaoEspecialista,
  SolicitacaoEspecialistaStatus,
} from "./types";

const sol = (
  id: string,
  status: SolicitacaoEspecialistaStatus,
  statusEfetivo?: SolicitacaoEspecialistaStatus
): SolicitacaoEspecialista =>
  ({
    id,
    status,
    status_efetivo: statusEfetivo,
    created_at: "2026-10-12T10:00:00-03:00",
  }) as SolicitacaoEspecialista;

describe("statusDoPedido", () => {
  it("lê 'aguardando_coord' legado como 'aberta' (0158)", () => {
    // Arrange
    const legado: SolicitacaoEspecialistaStatus = "aguardando_coord";

    // Act
    const status = statusDoPedido(legado);

    // Assert
    expect(status).toBe("aberta");
  });

  it("preserva os demais status", () => {
    // Arrange
    const statuses: SolicitacaoEspecialistaStatus[] = [
      "sugerida",
      "aberta",
      "contra_proposta",
      "aceita",
      "recusada",
      "cancelada",
      "expirada",
    ];

    // Act & Assert
    for (const s of statuses) expect(statusDoPedido(s)).toBe(s);
  });
});

describe("statusEfetivoDoPedido", () => {
  it("prefere o status_efetivo da view sobre a coluna crua", () => {
    // Arrange
    const pedido = sol("s1", "aberta", "expirada");

    // Act
    const status = statusEfetivoDoPedido(pedido);

    // Assert
    expect(status).toBe("expirada");
  });

  it("normaliza o legado também quando ele vem do status_efetivo", () => {
    // Arrange
    const pedido = sol("s1", "aberta", "aguardando_coord");

    // Act
    const status = statusEfetivoDoPedido(pedido);

    // Assert
    expect(status).toBe("aberta");
  });
});

describe("pedidoAcionavel", () => {
  it("conta aberta, contra_proposta e expirada", () => {
    // Arrange
    const pedidos = [
      sol("s1", "aberta"),
      sol("s2", "contra_proposta"),
      sol("s3", "expirada"),
    ];

    // Act
    const acionaveis = pedidos.map(pedidoAcionavel);

    // Assert
    expect(acionaveis).toEqual([true, true, true]);
  });

  it("trata o legado 'aguardando_coord' como pedido aberto no mural", () => {
    // Arrange
    const legado = sol("s1", "aguardando_coord");

    // Act
    const acionavel = pedidoAcionavel(legado);

    // Assert
    expect(acionavel).toBe(true);
  });

  it("deixa fora o que já decidiu ou espera o jovem", () => {
    // Arrange
    const pedidos = [
      sol("s1", "sugerida"),
      sol("s2", "aceita"),
      sol("s3", "recusada"),
      sol("s4", "cancelada"),
    ];

    // Act
    const acionaveis = pedidos.map(pedidoAcionavel);

    // Assert
    expect(acionaveis).toEqual([false, false, false, false]);
  });
});

describe("pedidosAcionaveis", () => {
  it("filtra preservando a ordem recebida do banco", () => {
    // Arrange
    const pedidos = [
      sol("s1", "aceita"),
      sol("s2", "aberta"),
      sol("s3", "expirada"),
      sol("s4", "sugerida"),
      sol("s5", "contra_proposta"),
    ];

    // Act
    const acionaveis = pedidosAcionaveis(pedidos);

    // Assert
    expect(acionaveis.map((p) => p.id)).toEqual(["s2", "s3", "s5"]);
  });

  it("devolve lista vazia quando nada pede ação", () => {
    // Arrange
    const pedidos = [sol("s1", "aceita"), sol("s2", "cancelada")];

    // Act
    const acionaveis = pedidosAcionaveis(pedidos);

    // Assert
    expect(acionaveis).toEqual([]);
  });
});
