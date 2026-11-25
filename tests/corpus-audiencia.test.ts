// Gate de audiência do corpus (docs/rag/*.md): corpusServeJovem e
// corpusServePapel são fail-closed — doc sem `audiencia` no frontmatter
// não serve o jovem e, no app, só passa pelo bypass de staff. Este spec
// trava a invariante que fecha o buraco: todo md do corpus declara
// `audiencia:` não-vazia e só com papéis do catálogo (AUDIENCIAS de
// materiais.ts). README.md fica fora — ele documenta a convenção, não é
// doc do corpus (o lerCorpus e o ingest o excluem também).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.join(process.cwd(), "docs", "rag");

// mesmo parse do frontmatter() de corpus-doc.ts: chave na coluna 0,
// continuação indentada dobra com espaço — cobre audiencia multi-linha
function audienciaBruta(raw: string): string | null {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n[\s\S]*$/.exec(raw);
  if (!fm) return null;
  let valor: string | null = null;
  let emAudiencia = false;
  for (const linha of fm[1].split("\n")) {
    const m = /^([a-z_]+):\s*(.*)$/.exec(linha);
    if (m) {
      emAudiencia = m[1] === "audiencia";
      if (emAudiencia) valor = m[2].trim();
    } else if (emAudiencia && /^\s+\S/.test(linha)) {
      valor = `${valor} ${linha.trim()}`;
    }
  }
  return valor;
}

function papeisDe(nome: string): string[] {
  const raw = readFileSync(path.join(DIR, nome), "utf8");
  const bruto = audienciaBruta(raw);
  // audienciaDe do corpus-doc, sem o remap de legado: o spec exige os
  // nomes canônicos no frontmatter (dpp/especialista são tolerância de
  // leitura, não convenção de escrita)
  return (bruto ?? "")
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// espelha AUDIENCIAS de src/lib/materiais.ts — um papel novo entra aqui e
// no catálogo juntos, senão o spec apaga o doc da audiência de verdade
const PAPEIS = new Set([
  "todos",
  "coordenacao",
  "supervisor",
  "mentor_dpp",
  "mentor_especialista",
  "mentorado",
]);

const arquivos = readdirSync(DIR)
  .filter((n) => n.endsWith(".md") && n !== "README.md")
  .sort();

describe("audiencia do corpus (docs/rag/*.md)", () => {
  it("o diretório do corpus responde (senão o gate testa o vazio)", () => {
    expect(arquivos.length).toBeGreaterThan(0);
  });

  it.each(arquivos)("%s declara `audiencia:` não-vazia", (nome) => {
    const raw = readFileSync(path.join(DIR, nome), "utf8");
    expect(audienciaBruta(raw)).not.toBeNull();
    expect(papeisDe(nome).length).toBeGreaterThan(0);
  });

  it.each(arquivos)("%s usa só papéis do catálogo de materiais", (nome) => {
    for (const p of papeisDe(nome)) {
      expect(PAPEIS.has(p), `papel desconhecido "${p}"`).toBe(true);
    }
  });
});
