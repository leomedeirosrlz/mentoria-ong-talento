import {
  comparaNome,
  ORDEM_SEMAFORO,
  ultimoRegistro,
  type DuplaSaude,
} from "@/lib/ciclo";
import type { Dupla } from "@/lib/types";

/** A ordenação explícita de /duplas (REALIZA-390/405 + a coluna Situação,
 *  REALIZA-445), na convenção do /relatorios: ausência de ?ordem= é a
 *  ordem do radar; cada coluna cicla asc → desc → default e só uma fica
 *  ativa por vez. ?ordem= carrega coluna+direção ("nome", "nome-desc",
 *  "situacao", …) — os valores legados "az"/"za" ainda resolvem pra nome.
 *  Mora em lib (não no componente) porque a coluna Situação lê a saúde
 *  calculada da dupla — comparador puro com `saudePorId` injetado é
 *  testável fora do React. */
export type OrdemCol = "nome" | "encontros" | "nota" | "situacao";
export type OrdemDupla = { col: OrdemCol; dir: 1 | -1 };

export const parseOrdemDupla = (v: string | null): OrdemDupla | null => {
  if (!v) return null;
  if (v === "az") return { col: "nome", dir: 1 };
  if (v === "za") return { col: "nome", dir: -1 };
  const desc = v.endsWith("-desc");
  const col = (desc ? v.slice(0, -5) : v) as OrdemCol;
  return col === "nome" ||
    col === "encontros" ||
    col === "nota" ||
    col === "situacao"
    ? { col, dir: desc ? -1 : 1 }
    : null;
};

export const escreveOrdem = (o: OrdemDupla) =>
  o.dir === 1 ? o.col : `${o.col}-desc`;

export const ORDEM_ROTULO: Record<OrdemCol, Record<"1" | "-1", string>> = {
  nome: { "1": "nome de A a Z", "-1": "nome de Z a A" },
  encontros: { "1": "menos encontros", "-1": "mais encontros" },
  nota: { "1": "menor nota", "-1": "maior nota" },
  situacao: { "1": "mais graves primeiro", "-1": "em dia primeiro" },
};

/** O nome que a linha mostra (social primeiro) — ordenar e buscar no que
 *  se lê, não no campo civil. */
const nomeExib = (p: { nome: string; nome_social?: string | null }) =>
  p.nome_social ?? p.nome;

/** O A→Z da coluna desempata na ordem de leitura do lockup: mentor, depois
 *  mentorado — "Ana e Bruno" vem antes de "Ana e Carla". */
const porNomeDupla = (a: Dupla, b: Dupla) =>
  comparaNome(nomeExib(a.mentor), nomeExib(b.mentor)) ||
  comparaNome(nomeExib(a.mentorado), nomeExib(b.mentorado));

const encontrosFeitos = (d: Dupla) =>
  d.encontros.reduce((n, e) => n + (e.status === "realizado" ? 1 : 0), 0);

/** O peso da fila do radar — a ordem default de /duplas: apoio aberto
 *  (trabalho pra equipe, pill à parte na mesma célula) → risco → atenção →
 *  em dia → fora da régua (pausada/concluída/encerrada). Fonte única: a
 *  ordem implícita e a coluna "Situação" leem daqui. */
export const pesoFila = (d: Dupla, s: DuplaSaude) => {
  if (s.apoio.aberto) return 0;
  if (d.status !== "ativa") return 5;
  return ORDEM_SEMAFORO[s.semaforo] + 1;
};

const NOTA_PESO: Record<string, number> = {
  baixa: 1,
  regular: 2,
  boa: 3,
  excelente: 4,
};

/** O comparador da coluna ativa — nome e contagem de encontros têm valor
 *  em toda linha; "sem nota" vai sempre pro fim, nas duas direções, e o
 *  desempate cai no A→Z da dupla (ordem estável e previsível). A coluna
 *  Situação segue o peso do radar: asc é "mais graves primeiro" e desc é
 *  "em dia primeiro" — fora da régua fica no fim nas duas direções
 *  (voltar a ler a fila saudável de cima, não os capítulos encerrados). */
export const comparadorDe = (
  o: OrdemDupla,
  saudePorId: Map<string, DuplaSaude>
) => {
  const dir = o.dir;
  if (o.col === "situacao") {
    const peso = (d: Dupla) => {
      const s = saudePorId.get(d.id);
      if (!s) return dir === 1 ? 9 : -9;
      const base = pesoFila(d, s);
      // fora da régua (5) afunda no fim nas DUAS direções: no desc ela
      // precisa do menor peso, não do maior
      return base === 5 ? (dir === 1 ? 9 : -9) : base;
    };
    return (a: Dupla, b: Dupla) =>
      (peso(a) - peso(b)) * dir || porNomeDupla(a, b);
  }
  if (o.col === "encontros")
    return (a: Dupla, b: Dupla) =>
      (encontrosFeitos(a) - encontrosFeitos(b)) * dir || porNomeDupla(a, b);
  if (o.col === "nota")
    return (a: Dupla, b: Dupla) => {
      const na = NOTA_PESO[ultimoRegistro(a)?.avaliacao ?? ""] ?? 0;
      const nb = NOTA_PESO[ultimoRegistro(b)?.avaliacao ?? ""] ?? 0;
      if (na === 0 || nb === 0)
        return na === 0 && nb === 0 ? porNomeDupla(a, b) : na === 0 ? 1 : -1;
      return (na - nb) * dir || porNomeDupla(a, b);
    };
  return (a: Dupla, b: Dupla) => porNomeDupla(a, b) * dir;
};
