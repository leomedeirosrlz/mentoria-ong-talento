import type { EncontroStatus } from "./types";

// ---------- o próximo encontro, uma fonte só (QA 25/11) ----------
// Card, lista, home e ficha derivavam "o que vem a seguir" por réguas
// diferentes (data vs número), e cada superfície mostrava um encontro.
// A régua única: agendado/remarcado futuro ordenado pela DATA — é a
// ordem em que as coisas acontecem de fato; o número só desempata.
// `adiantado` marca o encontro que furou a fila do cronograma: um
// número menor segue pendente com data depois dele (ou ainda sem data),
// então a sequência das datas cruzou a dos números.

export type EncontroPrevisto = {
  numero: number | null;
  status: EncontroStatus;
  data_hora: string | null;
};

export type Previsto<T> = T & {
  /** Furou a fila: existe pendente de número menor com data depois
   *  (ou sem data nenhuma). */
  adiantado: boolean;
};

const ABERTOS: ReadonlySet<EncontroStatus> = new Set(["agendado", "remarcado"]);

const instanteDe = (e: EncontroPrevisto): number =>
  e.data_hora ? new Date(e.data_hora).getTime() : Number.NaN;

/** Os encontros que ainda vão acontecer, pela régua única: data crescente
 *  (empate pelo número), cada um com `adiantado` marcado. `fila` separa
 *  as competências — o jovem junta trilhas na lista e a pendência do 5º
 *  da DPP não pode marcar a sessão do especialista; sem ela é uma fila só.
 *  `numerosOficiais` (por fila) declara os passos devidos do cronograma:
 *  o passo oficial sem row nenhuma conta pendente sem data — um agendado
 *  de número maior furou a fila do mesmo jeito. */
export function encontrosPrevistos<T extends EncontroPrevisto>(
  encontros: readonly T[],
  agora: Date,
  opts?: {
    fila?: (e: T) => string;
    numerosOficiais?: (fila: string) => readonly number[];
  }
): Previsto<T>[] {
  const agoraMs = agora.getTime();
  const filaDe = opts?.fila ?? (() => "");

  const futuros = encontros.filter(
    (e) =>
      ABERTOS.has(e.status) &&
      e.data_hora != null &&
      instanteDe(e) >= agoraMs
  );

  // pendência por fila, sob demanda: número sem realizado. O instante é
  // o mais próximo já marcado pra frente; null = segue devendo sem data
  // (row fechada/em limbo ou passo oficial sem row nenhuma).
  const pendentes = new Map<string, Map<number, number | null>>();
  const pendenciaDaFila = (fila: string): Map<number, number | null> => {
    let m = pendentes.get(fila);
    if (m) return m;
    m = new Map();
    const feitos = new Set<number>();
    for (const e of encontros)
      if (e.numero != null && filaDe(e) === fila && e.status === "realizado")
        feitos.add(e.numero);
    for (const e of encontros) {
      if (e.numero == null || filaDe(e) !== fila || feitos.has(e.numero))
        continue;
      const inst = ABERTOS.has(e.status) ? instanteDe(e) : Number.NaN;
      const fut = Number.isFinite(inst) && inst >= agoraMs ? inst : null;
      const cur = m.get(e.numero);
      if (cur === undefined || (fut != null && (cur == null || fut < cur)))
        m.set(e.numero, fut);
    }
    for (const n of opts?.numerosOficiais?.(fila) ?? [])
      if (!feitos.has(n) && !m.has(n)) m.set(n, null);
    pendentes.set(fila, m);
    return m;
  };

  return futuros
    .sort(
      (a, b) =>
        instanteDe(a) - instanteDe(b) || (a.numero ?? 0) - (b.numero ?? 0)
    )
    .map((e) => {
      let adiantado = false;
      if (e.numero != null) {
        const inst = instanteDe(e);
        for (const [n, instN] of pendenciaDaFila(filaDe(e))) {
          if (n < e.numero && (instN == null || instN > inst)) {
            adiantado = true;
            break;
          }
        }
      }
      return { ...e, adiantado };
    });
}
