// Eval run exporters — pure string builders; `baixarArquivo` is the only
// browser-touched piece. JSON keeps the raw API shape, CSV is one row
// per item for spreadsheets, Markdown is a readable report with the
// case × model table and the failure details.

import {
  dataCurta,
  ms,
  num,
  STATUS_ITEM,
  usd,
  type Item,
  type RunDetalhe,
} from "./tipos";

const rotuloPapel = (p: RunDetalhe["papel"]) =>
  p === "staff" ? "Staff" : "Mentorado";

export function evalJson(run: RunDetalhe, itens: Item[]): string {
  return JSON.stringify(
    { exportado_em: new Date().toISOString(), run, itens },
    null,
    2,
  );
}

// RFC 4180: wrap in quotes when the field carries separators, double the
// quotes inside
const csvCampo = (v: string | number | null | undefined) => {
  const s = v == null ? "" : String(v);
  return /[";,\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function evalCsv(run: RunDetalhe, itens: Item[]): string {
  const cab = [
    "run_id",
    "run_criado_em",
    "ambiente",
    "papel",
    "caso_id",
    "msg",
    "pagina",
    "modelo",
    "repeticao",
    "status",
    "latencia_ms",
    "tokens_in",
    "tokens_out",
    "custo_usd",
    "modelo_usado",
    "tools_usadas",
    "detalhe",
    "request_id",
    "executado_em",
  ];
  const linhas = itens.map((i) =>
    [
      run.id,
      run.created_at,
      run.ambiente,
      run.papel,
      i.caso_id,
      i.msg,
      i.pagina,
      i.modelo,
      i.repeticao,
      i.status,
      i.latencia_ms,
      i.tokens_in,
      i.tokens_out,
      i.custo_usd,
      i.modelo_usado,
      (i.tools_usadas ?? []).join(">"),
      i.detalhe,
      i.request_id,
      i.executado_em,
    ]
      .map(csvCampo)
      .join(","),
  );
  return `${cab.join(",")}\n${linhas.join("\n")}\n`;
}

const GLIFO: Record<Item["status"], string> = {
  ok: "✓",
  falhou: "✗",
  erro: "⚠",
  rodando: "◐",
  pendente: "·",
};

export function evalMarkdown(run: RunDetalhe, itens: Item[]): string {
  const feitos = itens.filter(
    (i) => i.status === "ok" || i.status === "falhou" || i.status === "erro",
  );
  const ok = itens.filter((i) => i.status === "ok").length;
  const pct = itens.length ? Math.round((ok / itens.length) * 100) : 0;
  const lats = feitos
    .map((i) => i.latencia_ms)
    .filter((v): v is number => v != null);
  const latMedia = lats.length
    ? lats.reduce((a, b) => a + b, 0) / lats.length
    : null;
  const custo = itens.reduce((a, i) => a + (i.custo_usd ?? 0), 0);
  const tokIn = itens.reduce((a, i) => a + (i.tokens_in ?? 0), 0);
  const tokOut = itens.reduce((a, i) => a + (i.tokens_out ?? 0), 0);

  const casos = [
    ...new Map(itens.map((i) => [i.caso_id, i.msg])).entries(),
  ];
  const celula = (caso: string, modelo: string) =>
    itens
      .filter((i) => i.caso_id === caso && i.modelo === modelo)
      .sort((a, b) => a.repeticao - b.repeticao)
      .map((i) => GLIFO[i.status])
      .join(" ") || "";

  const falhos = itens.filter(
    (i) => i.status === "falhou" || i.status === "erro",
  );

  const linhas: string[] = [
    `# Eval da Liza · ${dataCurta(run.created_at)}`,
    "",
    `**Ambiente** ${run.ambiente} · **Papel** ${rotuloPapel(run.papel)} · **Status** ${run.status}`,
    `**Modelos** ${run.modelos.join(", ")} · **Repetições** ${run.repeticoes}× por caso`,
    "",
    `**${pct}% passou** (${ok} de ${itens.length} itens) · latência média ${ms(latMedia)} · ${num.format(tokIn)}+${num.format(tokOut)} tok · ${usd(custo)}`,
    "",
    "| Caso | " + run.modelos.join(" | ") + " |",
    "| --- | " + run.modelos.map(() => "---").join(" | ") + " |",
    ...casos.map(
      ([id, msg]) =>
        `| ${msg.replace(/\|/g, "\\|")} | ${run.modelos
          .map((m) => celula(id, m) || "·")
          .join(" | ")} |`,
    ),
    "",
    `Legenda: ✓ passou · ✗ falhou a rubrica · ⚠ erro de infra · ◐ rodando · · na fila`,
  ];

  if (falhos.length) {
    linhas.push("", "## Itens pra revisar", "");
    for (const i of falhos) {
      linhas.push(
        `- **${i.caso_id}** · ${i.modelo} rep ${i.repeticao} · ${STATUS_ITEM[i.status].rotulo} · ${ms(i.latencia_ms)}`,
      );
      if (i.detalhe) linhas.push(`  - ${i.detalhe}`);
      if (i.resposta_trecho) linhas.push(`  - > ${i.resposta_trecho}`);
    }
  }
  return `${linhas.join("\n")}\n`;
}

export function baixarArquivo(nome: string, conteudo: string, mime: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
