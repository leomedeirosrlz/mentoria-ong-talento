// REALIZA-417 fase B — núcleo puro do explorador ad-hoc da aba Adoção.
// Aqui não toca bundler nem DuckDB: o guard de leitura (o explorador só
// aceita SELECT), as consultas prontas dos chips e a formatação de
// célula da tabela de resultados. O motor mora em lib/adocao-duckdb.ts,
// carregado sob demanda.

/** Nome da view que o explorador registra sobre o parquet exportado —
 *  é o "from" das consultas, preset e livre. */
export const TABELA_EVENTOS = "eventos";

/** Teto de linhas renderizadas — a query embrulha num LIMIT externo
 *  (ver sqlComLimite), então um `select *` desavisado não congela a aba. */
export const LIMITE_LINHAS = 500;

export type ConsultaPreset = {
  id: string;
  rotulo: string;
  sql: string;
};

/** Perguntas prontas da régua — cada chip injeta a query na caixa e já
 *  roda (a SQL fica visível e editável, o preset também ensina o
 *  esquema). hora é UTC-3: a coluna created_at é timestamptz exportada
 *  como timestamp sem fuso, então o recorte de Brasília sai na conta. */
export const CONSULTAS_PRESET: ConsultaPreset[] = [
  {
    id: "superficies",
    rotulo: "Superfícies mais usadas",
    sql: `select superficie, count(*) as gestos, count(distinct profile_id) as pessoas
from ${TABELA_EVENTOS}
group by superficie
order by gestos desc`,
  },
  {
    id: "acoes",
    rotulo: "Gestos por ação",
    sql: `select acao, count(*) as gestos, count(distinct profile_id) as pessoas
from ${TABELA_EVENTOS}
group by acao
order by gestos desc`,
  },
  {
    id: "horario",
    rotulo: "Horário de uso",
    sql: `select hour(created_at - interval '3' hour) as hora, count(*) as gestos
from ${TABELA_EVENTOS}
group by hora
order by hora`,
  },
  {
    id: "pessoas",
    rotulo: "Pessoas mais ativas",
    sql: `select profile_id, papel, count(*) as gestos,
  count(distinct superficie) as superficies,
  max(created_at) as ultimo_gesto
from ${TABELA_EVENTOS}
group by profile_id, papel
order by gestos desc
limit 20`,
  },
  {
    id: "jornada",
    rotulo: "Jornada de uma pessoa",
    // o explorador não tem parâmetro: o chip roda com a pessoa mais
    // ativa do período e o comentário inicial (que o guard despreza na
    // validação mas a caixa mostra) ensina a trocar pra outro id
    sql: `-- Jornada de uma pessoa: a sequência de gestos no tempo.
-- Roda com a pessoa mais ativa do período. Pra ver outra, troque a
-- subconsulta do WHERE pelo profile_id dela entre aspas — o chip
-- "Pessoas mais ativas" lista os ids.
select created_at, superficie, acao, meta
from ${TABELA_EVENTOS}
where profile_id = (
  select profile_id
  from ${TABELA_EVENTOS}
  group by profile_id
  order by count(*) desc
  limit 1
)
order by created_at
limit 300`,
  },
  {
    id: "heatmap",
    rotulo: "Heatmap de cliques",
    sql: `-- Toques normalizados pela tela de cada gesto: grade 10×10 —
-- fx/fy de 0 a 9 dizem onde na superfície o dedo ou o mouse caiu,
-- somando telas de tamanhos diferentes na mesma célula.
select superficie,
  least(greatest(floor(
    (meta->>'x')::double / nullif((meta->>'vw')::double, 0) * 10
  ), 0), 9)::int as fx,
  least(greatest(floor(
    (meta->>'y')::double / nullif((meta->>'vh')::double, 0) * 10
  ), 0), 9)::int as fy,
  count(*) as toques
from ${TABELA_EVENTOS}
where acao = 'clique'
  and meta->>'x' is not null
  and meta->>'vw' is not null
group by 1, 2, 3
order by superficie, fy, fx`,
  },
  {
    id: "viewport",
    rotulo: "Viewport dos usuários",
    sql: `-- Largura de tela × classe de dispositivo nos pageviews.
-- vw/vh/dev entram na coleta da fase de telemetria rica — gestos
-- mais antigos sem meta.vw ficam de fora de propósito.
select coalesce(meta->>'dev', 'sem classe') as dispositivo,
  case
    when (meta->>'vw')::int < 640 then 'até 639'
    when (meta->>'vw')::int < 768 then '640 a 767'
    when (meta->>'vw')::int < 1024 then '768 a 1023'
    when (meta->>'vw')::int < 1280 then '1024 a 1279'
    else '1280 ou mais'
  end as faixa,
  count(distinct profile_id) as pessoas,
  count(*) as pageviews
from ${TABELA_EVENTOS}
where acao = 'pageview'
  and meta->>'vw' is not null
group by 1, 2
order by min((meta->>'vw')::int), 1`,
  },
  {
    id: "cru",
    rotulo: "Amostra crua",
    sql: `select * from ${TABELA_EVENTOS}
order by created_at desc
limit 100`,
  },
];

// ---------- guard: uma consulta, só leitura ----------

// verbos que mudam estado ou saem do banco — num SELECT limpo nenhum
// aparece. `with ... insert` cai aqui também (o primeiro token passa,
// o scan pega o verbo). Falso positivo possível dentro de string
// literal — aceitável: a mensagem explica e a pessoa ajusta a query.
const VERBOS_PROIBIDOS =
  /\b(insert|update|delete|drop|create|alter|attach|detach|copy|pragma|call|export|import|install|load|checkpoint|vacuum|prepare|execute|deallocate|set|reset|begin|commit|rollback|transaction|use|grant|revoke|truncate|merge|replace|security|describe|show|explain|summarize|pivot|unpivot)\b/i;

/** Tira comentários de linha/bloco do começo — o primeiro token real é
 *  o que decide se a consulta é leitura. */
function semComentarioInicial(sql: string): string {
  let s = sql;
  for (;;) {
    const t = s.trimStart();
    if (t.startsWith("--")) {
      const nl = t.indexOf("\n");
      s = nl === -1 ? "" : t.slice(nl + 1);
      continue;
    }
    if (t.startsWith("/*")) {
      const end = t.indexOf("*/");
      s = end === -1 ? "" : t.slice(end + 2);
      continue;
    }
    return t;
  }
}

export type ResultadoGuard =
  | { ok: true; sql: string }
  | { ok: false; erro: string };

/** Valida a query do explorador: uma única declaração, começando em
 *  SELECT ou WITH e sem verbo de escrita/DDL no corpo. Não é muralha de
 *  segurança (o banco é efêmero e local, só tem o parquet da própria
 *  pessoa) — é o contrato de leitura da ferramenta, mantendo o painel
 *  previsível e sem extensão/anexo remoto. */
export function sqlSomenteLeitura(bruta: string): ResultadoGuard {
  const limpa = bruta.trim().replace(/;+\s*$/, "");
  if (!limpa) {
    return { ok: false, erro: "Escreva uma consulta SELECT." };
  }
  // ponto e vírgula interno = mais de uma declaração — o explorador
  // roda uma por vez (dentro de literal dá falso positivo; ajustável)
  if (limpa.includes(";")) {
    return {
      ok: false,
      erro: "Uma consulta por vez. Remova o ponto e vírgula do meio.",
    };
  }
  const s = semComentarioInicial(limpa);
  if (!/^(select|with)\b/i.test(s)) {
    return {
      ok: false,
      erro: "Só consultas de leitura. Comece com SELECT.",
    };
  }
  const proibido = VERBOS_PROIBIDOS.exec(s);
  if (proibido) {
    return {
      ok: false,
      erro: `A consulta tem "${proibido[0]}", que não é leitura. Ajuste para um SELECT puro.`,
    };
  }
  return { ok: true, sql: limpa };
}

/** Embrulha a consulta validada com um teto de linhas — o resultado de
 *  um `select *` nunca passa de LIMITE_LINHAS+1 (a linha extra é o
 *  flag "tem mais" que a UI declara como truncado). */
export function sqlComLimite(sql: string, limite = LIMITE_LINHAS): string {
  return `select * from (\n${sql}\n) as consulta limit ${limite + 1}`;
}

// ---------- célula da tabela de resultados ----------

const FMT_NUM = new Intl.NumberFormat("pt-BR");
const FMT_DATAHORA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Valor crú → texto de célula. Datas/bigints chegam decodificados do
 *  módulo DuckDB (Date e string respectivamente); aqui só a roupa de
 *  exibição — tabular-nums fica no CSS da tabela. */
export function fmtCelula(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return FMT_DATAHORA.format(v);
  if (typeof v === "bigint") return FMT_NUM.format(v);
  if (typeof v === "number") return FMT_NUM.format(v);
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (v instanceof Uint8Array) {
    let hex = "";
    for (let i = 0; i < v.length && i < 16; i++)
      hex += v[i]!.toString(16).padStart(2, "0");
    return v.length > 16 ? `${hex}…` : hex;
  }
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}
