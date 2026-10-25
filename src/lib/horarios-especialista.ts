import type { ExcecaoEspecialista, GradeJanela } from "@/lib/types";

// ============================================================
// Horários do especialista em frases ("Terças 18h–20h"). Uma fonte só
// pro editor do perfil, pro resumo da agenda e pra qualquer lugar que
// mostre quando o especialista atende. Puro: sem data atual, sem I/O.
// ============================================================

/** dow do Postgres (0=domingo … 6=sábado) no plural da fala. */
const DIA_PLURAL = [
  "Domingos",
  "Segundas",
  "Terças",
  "Quartas",
  "Quintas",
  "Sextas",
  "Sábados",
] as const;

/** Ordem de leitura da semana: segunda primeiro, domingo por último. */
const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0] as const;

/** "18:00:00" → "18h" · "18:30:00" → "18h30" · "09:00" → "9h". */
export function horaCurta(hora: string): string {
  const [h, m] = hora.split(":");
  const hh = String(Number(h));
  return m && m !== "00" ? `${hh}h${m}` : `${hh}h`;
}

/** "18:00:00", "20:00:00" → "18h–20h". */
export function faixa(inicio: string, fim: string): string {
  return `${horaCurta(inicio)}–${horaCurta(fim)}`;
}

export function diaPlural(diaSemana: number): string {
  return DIA_PLURAL[diaSemana] ?? "";
}

/** Uma linha por dia da semana, na ordem seg → dom, com as faixas do dia
 *  juntas: ["Terças 18h–20h", "Sábados 9h–12h e 14h–16h"]. */
export function resumoGrade(grade: readonly GradeJanela[]): string[] {
  const porDia = new Map<number, GradeJanela[]>();
  for (const j of grade) {
    const lista = porDia.get(j.dia_semana) ?? [];
    lista.push(j);
    porDia.set(j.dia_semana, lista);
  }
  const linhas: string[] = [];
  for (const dia of ORDEM_SEMANA) {
    const janelas = porDia.get(dia);
    if (!janelas?.length) continue;
    const faixas = [...janelas]
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
      .map((j) => faixa(j.hora_inicio, j.hora_fim));
    const juntas =
      faixas.length === 1
        ? faixas[0]
        : `${faixas.slice(0, -1).join(", ")} e ${faixas[faixas.length - 1]}`;
    linhas.push(`${DIA_PLURAL[dia]} ${juntas}`);
  }
  return linhas;
}

/** "2026-11-12" → "12/11". */
function diaMes(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** Exceção em frase: bloqueio = "Não atende em 12/11, 18h–20h";
 *  extra = "Atende também em 15/11, 9h–12h". */
export function resumoExcecao(e: ExcecaoEspecialista): string {
  const quando = `${diaMes(e.data)}, ${faixa(e.hora_inicio, e.hora_fim)}`;
  return e.tipo === "bloqueio"
    ? `Não atende em ${quando}`
    : `Atende também em ${quando}`;
}
