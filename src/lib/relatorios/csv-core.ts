// Núcleo compartilhado dos exports CSV (/api/export e os previews do hub
// /relatorios). Convenção consolidada: delimitador `;` + tudo entre aspas =
// Excel pt-BR; `""` escapa aspas internas; BOM no início pro Excel abrir os
// acentos como UTF-8; CRLF em toda linha; filename datado.

import { NextResponse } from "next/server";
import { toDateStr } from "@/lib/ciclo";
import { normaliza } from "@/lib/utils";
import { turmaDaDupla } from "@/lib/turma";
import type { Cronograma } from "@/lib/types";

/** Célula CSV — sempre entre aspas. Formula injection: Excel/Sheets
 *  executam célula abrindo com = + - @ (ou após tab/CR) — campos de texto
 *  livre (nota, motivo, reflexão serializada) passam por aqui. */
export function celula(v: string | null | undefined): string {
  let s = v ?? "";
  if (/^[\t\r ]*[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Documento CSV completo: BOM + header + linhas + CRLF final. Header e
 *  células chegam crus — csvDoc passa tudo por celula() (label de pergunta
 *  do form é texto livre e pode conter `;` ou `"`). */
export function csvDoc(header: string[], linhas: string[][]): string {
  const linha = (cells: string[]) => cells.map(celula).join(";");
  return (
    "\uFEFF" + [linha(header), ...linhas.map(linha)].join("\r\n") + "\r\n"
  );
}

/** Resposta `text/csv` como attachment — todos os tipos saem no mesmo formato. */
export function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// ---------- datas no fuso do programa, dd/mm/aaaa (ordena na planilha) ----------

const TZ = "America/Sao_Paulo";
const fmtData = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** timestamptz ISO -> "dd/mm/aaaa hh:mm" no fuso do programa ("" se vazio). */
export function dataHora(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${fmtData.format(d)} ${fmtHora.format(d)}`;
}

/** timestamptz ISO -> "dd/mm/aaaa" no fuso do programa ("" se vazio). */
export function dia(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : fmtData.format(d);
}

// ---------- nomes de arquivo ----------

/** Nome canônico por tipo: `<tipo>-AAAA-MM-DD.csv` — exports de dias
 *  diferentes não se sobrepõem na pasta de downloads. */
export const nomeCsv = (tipo: string) => `${tipo}-${toDateStr(new Date())}.csv`;

// mês no nome do relatório do ciclo: exports de meses diferentes não se
// sobrepõem na pasta de downloads
export const nomeCsvCiclo = () =>
  `encontros-${toDateStr(new Date()).slice(0, 7)}.csv`;
export const nomeCsvPessoas = () => nomeCsv("pessoas");
export const nomeCsvAssinaturas = () => nomeCsv("assinaturas");

// título do form entra no nome do arquivo (ascii kebab) — exports de forms
// diferentes não se sobrepõem na pasta de downloads
export const slugCsv = (s: string) =>
  normaliza(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "formulario";
export const nomeCsvRespostas = (titulo: string) =>
  `respostas-${slugCsv(titulo)}-${toDateStr(new Date())}.csv`;

// ---------- recorte ?turma=/?cronograma= ----------

/** Recorte resolvido dos params — `turma` casa pelo rótulo VIVO
 *  (turmaDaDupla, REALIZA-223), não pelo selo `duplas.turma` congelado no
 *  pareamento; `cronogramaId` casa o id cru. */
export type RecorteCsv = {
  turma?: string | null;
  cronogramaId?: string | null;
};

export function recorteDeParams(p: URLSearchParams): RecorteCsv {
  return {
    turma: p.get("turma")?.trim() || null,
    cronogramaId: p.get("cronograma")?.trim() || null,
  };
}

type DuplaRecorte = { cronograma_id?: string | null; turma?: string | null };

/** A dupla pertence ao recorte? — a regra unitária por trás de
 *  filtraPorRecorte e dos tipos não-dupla (interacao, solicitação…), que
 *  resolvem a dupla vinculada e perguntam a mesma coisa. */
export function duplaNoRecorte(
  d: DuplaRecorte,
  recorte: RecorteCsv,
  crons: readonly Pick<Cronograma, "id" | "turma">[]
): boolean {
  return (
    (!recorte.turma || turmaDaDupla(d, crons) === recorte.turma) &&
    (!recorte.cronogramaId || d.cronograma_id === recorte.cronogramaId)
  );
}

/** Filtro de duplas do recorte — o antigo filtraCsvCiclo da rota de export,
 *  agora compartilhado pelos 6 tipos novos e pelos previews do hub. */
export function filtraPorRecorte<T extends DuplaRecorte>(
  duplas: T[],
  recorte: RecorteCsv,
  crons: readonly Pick<Cronograma, "id" | "turma">[]
): T[] {
  return duplas.filter((d) => duplaNoRecorte(d, recorte, crons));
}
