// Domínio puro das métricas de preenchimento do registro (REALIZA-217,
// fase 1): agrega as linhas de registro_tentativas dos últimos 30 dias no
// resumo que a coordenação lê em /registros. Puro — roda no server render
// e no vitest; o volume (form semanal, dezenas/mês) não justifica uma RPC
// de agregação, então a conta mora aqui sobre as linhas brutas.

/** O mínimo que a agregação lê de cada tentativa — o select da query
 *  satisfaz estruturalmente (manter enxuto deixa a função testável). */
export type TentativaMetrica = {
  origem: string;
  dispositivo: string | null;
  duracao_ms: number | null;
  concluido: boolean;
};

export type MetricasRegistro = {
  /** tentativas no recorte (30 dias). */
  total: number;
  /** sessões que terminaram em registro salvo. */
  concluidas: number;
  /** % concluídas (0–100, inteiro). null sem tentativas. */
  pctConcluidas: number | null;
  /** mediana de duracao_ms das concluídas. null sem concluída. */
  medianaMs: number | null;
  /** contagem por dispositivo informado. */
  mobile: number;
  desktop: number;
  tablet: number;
  /** % mobile sobre as que informaram dispositivo. null sem nenhuma. */
  pctMobile: number | null;
  /** % de tentativas abertas em dialog (retroativo) — o fluxo de
   *  catch-up. null sem tentativas. */
  pctRetroativo: number | null;
};

/** Mediana de um conjunto — para par devolve a média dos dois centrais. */
export function mediana(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const ord = [...nums].sort((a, b) => a - b);
  const meio = ord.length >> 1;
  return ord.length % 2 === 1
    ? ord[meio]!
    : (ord[meio - 1]! + ord[meio]!) / 2;
}

const pct = (parte: number, total: number): number | null =>
  total === 0 ? null : Math.round((parte / total) * 100);

export function agregarTentativas(rows: TentativaMetrica[]): MetricasRegistro {
  const concluidas = rows.filter((r) => r.concluido);
  const duracoes = concluidas
    .map((r) => r.duracao_ms)
    .filter((d): d is number => typeof d === "number" && d >= 0);
  const mobile = rows.filter((r) => r.dispositivo === "mobile").length;
  const desktop = rows.filter((r) => r.dispositivo === "desktop").length;
  const tablet = rows.filter((r) => r.dispositivo === "tablet").length;
  const comDispositivo = mobile + desktop + tablet;
  return {
    total: rows.length,
    concluidas: concluidas.length,
    pctConcluidas: pct(concluidas.length, rows.length),
    medianaMs: mediana(duracoes),
    mobile,
    desktop,
    tablet,
    pctMobile: pct(mobile, comDispositivo),
    pctRetroativo: pct(
      rows.filter((r) => r.origem === "retroativo").length,
      rows.length
    ),
  };
}

/** Duração em texto corrido pt-BR — "45 s" abaixo do minuto, "2min30s" com
 *  segundos quebrados, "12 min" redondo a partir de 10. */
export function fmtDuracaoMs(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  if (min < 10) {
    const resto = s % 60;
    return resto === 0 ? `${min} min` : `${min}min${String(resto).padStart(2, "0")}s`;
  }
  return `${min} min`;
}
