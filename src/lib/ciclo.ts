import type { CicloEvento, Dupla, Encontro } from "./types";

export type Semaforo = "ok" | "atencao" | "risco";

export type DuplaSaude = {
  semaforo: Semaforo;
  motivo: string;
  esperado: number;
  feitos: number;
  proximo: Encontro | null;
  registroPendente: boolean;
  pediuApoio: boolean;
};

/** Encontro esperado do ciclo = quantas datas de encontro ja passaram (ou sao hoje). */
export function encontroEsperado(eventos: CicloEvento[], hoje: Date): number {
  const hojeStr = toDateStr(hoje);
  return eventos.filter((e) => e.tipo === "encontro" && e.data <= hojeStr).length;
}

export function eventoDaSemana(eventos: CicloEvento[], hoje: Date): CicloEvento | null {
  const hojeStr = toDateStr(hoje);
  const ordenados = eventos
    .filter((e) => e.tipo === "encontro")
    .sort((a, b) => a.data.localeCompare(b.data));
  return (
    ordenados.find((e) => e.data >= hojeStr && diffDias(e.data, hojeStr) <= 7) ??
    ordenados.filter((e) => e.data <= hojeStr).at(-1) ??
    null
  );
}

export function saudadeDaDupla(dupla: Dupla, eventos: CicloEvento[], hoje = new Date()): DuplaSaude {
  const esperado = encontroEsperado(eventos, hoje);
  const feitos = dupla.encontros.filter((e) => e.status === "realizado").length;
  const proximo =
    dupla.encontros
      .filter((e) => e.status === "agendado" && e.data_hora && new Date(e.data_hora) >= hoje)
      .sort((a, b) => new Date(a.data_hora!).getTime() - new Date(b.data_hora!).getTime())[0] ??
    null;

  const pediuApoio = dupla.encontros.some((e) => e.registro?.precisa_apoio);
  const registroPendente = dupla.encontros.some(
    (e) =>
      e.status === "realizado" &&
      !e.registro &&
      hoje.getTime() - new Date(e.data_hora ?? 0).getTime() > 24 * 3600 * 1000
  );
  const atraso = esperado - feitos;
  const encaminhamentoVencido = dupla.encaminhamentos.some(
    (t) => t.status === "pendente" && t.prazo && t.prazo < toDateStr(hoje)
  );

  if (pediuApoio)
    return { semaforo: "risco", motivo: "Mentor pediu apoio", esperado, feitos, proximo, registroPendente, pediuApoio };
  if (atraso >= 2)
    return { semaforo: "risco", motivo: `${atraso} encontros em atraso`, esperado, feitos, proximo, registroPendente, pediuApoio };
  if (atraso === 1)
    return {
      semaforo: "atencao",
      motivo: `Encontro ${esperado} ainda nao aconteceu (reposicao na mesma semana)`,
      esperado, feitos, proximo, registroPendente, pediuApoio,
    };
  if (registroPendente)
    return { semaforo: "atencao", motivo: "Encontro realizado sem registro", esperado, feitos, proximo, registroPendente, pediuApoio };
  if (encaminhamentoVencido)
    return { semaforo: "atencao", motivo: "Encaminhamento com prazo vencido", esperado, feitos, proximo, registroPendente, pediuApoio };
  return {
    semaforo: "ok",
    motivo: proximo ? `Proximo encontro ${formatDate(proximo.data_hora)}` : "Em dia",
    esperado, feitos, proximo, registroPendente, pediuApoio,
  };
}

export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function diffDias(a: string, b: string): number {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "a definir";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "a definir";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function waLink(phone: string | null | undefined, mensagem: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(mensagem)}`;
}
