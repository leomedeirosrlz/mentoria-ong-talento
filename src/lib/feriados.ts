/** Feriados nacionais do calendário civil (REALIZA-513): o plano "ficar em
 *  dia" não sugere encontro num deles. Fixos pela Lei 662/1949 e
 *  sucessoras (Aparecida 6.802/1980, Consciência Negra 14.759/2023);
 *  móveis pela Páscoa: Sexta-feira Santa e a segunda e a terça de
 *  Carnaval, que são ponto facultativo federal mas param o país na
 *  prática. Feriado estadual/municipal fica fora: o programa é nacional e
 *  a dupla combina o resto entre si. Puro: sem fuso, só data civil. */

const FIXOS: Record<string, string> = {
  "01-01": "Confraternização Universal",
  "04-21": "Tiradentes",
  "05-01": "Dia do Trabalho",
  "09-07": "Independência",
  "10-12": "Nossa Senhora Aparecida",
  "11-02": "Finados",
  "11-15": "Proclamação da República",
  "11-20": "Consciência Negra",
  "12-25": "Natal",
};

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, gregoriano). */
function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia, 12));
}

const moveisCache = new Map<number, Map<string, string>>();

function moveis(ano: number): Map<string, string> {
  let m = moveisCache.get(ano);
  if (m) return m;
  const p = pascoa(ano).getTime();
  const dia = (delta: number) =>
    new Date(p + delta * 86_400_000).toISOString().slice(0, 10);
  m = new Map([
    [dia(-48), "Carnaval"],
    [dia(-47), "Carnaval"],
    [dia(-2), "Sexta-feira Santa"],
  ]);
  moveisCache.set(ano, m);
  return m;
}

/** "2026-12-25" → "Natal"; null quando o dia não é feriado nacional. */
export function feriadoNacional(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return FIXOS[iso.slice(5)] ?? moveis(Number(iso.slice(0, 4))).get(iso) ?? null;
}
