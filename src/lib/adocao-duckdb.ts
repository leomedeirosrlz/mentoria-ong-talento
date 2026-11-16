// REALIZA-417 fase B — ponte do explorador com o DuckDB-WASM.
//
// MÓDULO PESADO: importar ESTE arquivo só via import() dinâmico (o
// primeiro uso do ExploradorAdocao puxa o chunk). O wasm (~40MB brutos,
// ~8-10MB no fio) e o worker são assets emitidos pelas rules do
// next.config — as URLs chegam prontas e o download só acontece no
// instantiate abaixo. selectBundle escolhe eh (browser moderno) ou mvp
// (fallback) — os dois rodam sem threads, então nada de COOP/COEP.

import * as duckdb from "@duckdb/duckdb-wasm";
import wasmMvp from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm";
import wasmEh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm";
import workerMvp from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js";
import workerEh from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js";
import { LIMITE_LINHAS, TABELA_EVENTOS, sqlComLimite } from "@/lib/adocao-sql";

const ARQUIVO_PARQUET = "eventos.parquet";

export type BancoEventos = {
  /** fecha o worker junto — o banco é só memória wasm */
  fechar: () => Promise<void>;
  /** linhas e janela efetiva do arquivo registrado */
  info: () => Promise<{ gestos: number; primeiro: Date | null; ultimo: Date | null }>;
  /** refaz o download do export e recria a view (botão "atualizar") */
  recarregar: (desde: string) => Promise<void>;
  /** roda SQL já validada pelo guard — devolve colunas + linhas cras */
  consultar: (sql: string) => Promise<ResultadoConsulta>;
};

export type ResultadoConsulta = {
  colunas: string[];
  /** células já em tipo JS simples (Date, number, string, null, objeto) */
  linhas: unknown[][];
  /** resultado passou do teto — a query trouxe LIMITE_LINHAS+1 */
  truncado: boolean;
  ms: number;
};

type Status =
  | { fase: "motor" }
  | { fase: "dados" }
  | { fase: "pronto" };

/** Sobe o banco in-browser: worker + wasm (bundle que o browser aguenta)
 *  + fetch do export parquet registrado como arquivo e virado view.
 *  `etapa` conta pro usuário em que passo está — o download do wasm é a
 *  parte lenta da primeira abertura. */
export async function criarBancoEventos(
  desde: string,
  etapa: (s: Status["fase"]) => void
): Promise<BancoEventos> {
  etapa("motor");
  const bundle = await duckdb.selectBundle({
    mvp: { mainModule: wasmMvp, mainWorker: workerMvp },
    eh: { mainModule: wasmEh, mainWorker: workerEh },
  });
  const worker = new Worker(bundle.mainWorker!);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  const conn = await db.connect();

  const registrar = async () => {
    const res = await fetch(
      `/api/adocao/export?formato=parquet&desde=${encodeURIComponent(desde)}`
    );
    if (!res.ok) {
      const corpo = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(
        corpo?.error ?? `Falha ao baixar os gestos (${res.status}).`
      );
    }
    const buf = await res.arrayBuffer();
    await db.registerFileBuffer(ARQUIVO_PARQUET, new Uint8Array(buf));
    await conn.query(
      `create or replace view ${TABELA_EVENTOS} as ` +
        `select * from parquet_scan('${ARQUIVO_PARQUET}')`
    );
  };

  etapa("dados");
  await registrar();
  etapa("pronto");

  return {
    fechar: async () => {
      await conn.close();
      await db.terminate();
    },
    info: async () => {
      const t = await conn.query(
        `select count(*)::int as n, min(created_at) as mn, max(created_at) as mx
         from ${TABELA_EVENTOS}`
      );
      const r = t.toArray()[0]?.toJSON() as
        | { n?: number; mn?: unknown; mx?: unknown }
        | undefined;
      const data = (v: unknown) => {
        const n = normalizaValor(v, "Timestamp<MICROSECOND>");
        return n instanceof Date ? n : null;
      };
      return {
        gestos: r?.n ?? 0,
        primeiro: data(r?.mn),
        ultimo: data(r?.mx),
      };
    },
    recarregar: async (d: string) => {
      // troca o buffer por baixo da view — a parquet_scan lê o arquivo
      // registrado a cada query, então reescrever o nome basta
      const res = await fetch(
        `/api/adocao/export?formato=parquet&desde=${encodeURIComponent(d)}`
      );
      if (!res.ok) throw new Error(`Falha ao baixar os gestos (${res.status}).`);
      const buf = await res.arrayBuffer();
      await db.registerFileBuffer(ARQUIVO_PARQUET, new Uint8Array(buf));
    },
    consultar: async (sql: string) => {
      const inicio = performance.now();
      // o wrap limita no motor: a linha extra sinaliza "tem mais" sem
      // materializar o resultado inteiro na arrow table
      const tabela = await conn.query(sqlComLimite(sql));
      const colunas = tabela.schema.fields.map((f) => f.name);
      const linhas: unknown[][] = [];
      const campos = tabela.schema.fields;
      for (const row of tabela.toArray()) {
        linhas.push(
          campos.map((f, i) => normalizaValor(row.toArray()[i], String(f.type)))
        );
      }
      const truncado = linhas.length > LIMITE_LINHAS;
      if (truncado) linhas.length = LIMITE_LINHAS;
      return {
        colunas,
        linhas,
        truncado,
        ms: Math.round(performance.now() - inicio),
      };
    },
  };
}

/** Valor cru do Arrow → JS simples pra tabela. Timestamp chega como
 *  bigint (µs/ns) ou number (ms/s) conforme a unidade do campo — a
 *  string do tipo carrega a unidade e dita o divisor. Bigint de outras
 *  colunas vira string (preserva precisão — a célula formata). */
const UNIDADE_TS: Record<string, bigint> = {
  MILLISECOND: BigInt(1),
  MICROSECOND: BigInt(1_000),
  NANOSECOND: BigInt(1_000_000),
};

function normalizaValor(v: unknown, tipo: string): unknown {
  if (v == null) return null;
  const ts = /^Timestamp<(SECOND|MILLISECOND|MICROSECOND|NANOSECOND)>/i.exec(
    tipo
  );
  if (ts) {
    const unidade = ts[1]!.toUpperCase();
    if (typeof v === "bigint") {
      // ns e s chegam como bigint também — o fator pra ms muda por unidade
      if (unidade === "SECOND") return new Date(Number(v * BigInt(1000)));
      return new Date(Number(v / (UNIDADE_TS[unidade] ?? BigInt(1))));
    }
    if (typeof v === "number") return new Date(v);
    return v;
  }
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Date) return v;
  return v;
}
