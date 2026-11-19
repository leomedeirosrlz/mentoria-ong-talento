// Handoff do magic link em SQL — a ordem final é tokens > tombstone >
// nada, e cada peça mora numa migration diferente: 0050 cria o
// tombstone `failed`, 0175 ensina o pegar a distinguir expirado de
// ausente, 0181 faz o registrar resgatar row falha. O bug que a 0181
// documenta era exatamente um `on conflict do nothing` deixando o
// tombstone ganhar pra sempre — link bom morrendo por erro transitório.
// Este spec trava o contrato de texto do ledger: a definição VIGENTE
// (última do repo, o ledger é imutável) de cada função tem a semântica
// certa, e nenhuma migration posterior reintroduz o `do nothing` no
// registrar — a mesma varredura que impediria a regressão se alguém
// "simplificasse" o upsert de volta.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.join(process.cwd(), "supabase", "migrations");
const arquivos = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

const semComentarios = (sql: string) =>
  sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");

/** Cada definição `create [or replace] function public.<fn>` por ordem do
 *  ledger — a última é a que o remoto tem hoje. */
function definicoesDe(fn: string): { nome: string; corpo: string }[] {
  const out: { nome: string; corpo: string }[] = [];
  for (const nome of arquivos) {
    const sql = semComentarios(readFileSync(path.join(DIR, nome), "utf8"));
    for (const bloco of sql.split(
      /(?=create\s+(?:or\s+replace\s+)?function\s+public\.)/i
    )) {
      if (new RegExp(`function\\s+public\\.${fn}\\b`, "i").test(bloco))
        out.push({ nome, corpo: bloco });
    }
  }
  return out;
}

const REGISTRAR = definicoesDe("registrar_login_handoff");
const FALHAR = definicoesDe("falhar_login_handoff");
const PEGAR = definicoesDe("pegar_login_handoff");

describe("handoff do magic link — tokens > tombstone > nada", () => {
  it("as três RPCs existem no ledger (senão o spec testa o vazio)", () => {
    expect(REGISTRAR.length).toBeGreaterThan(0);
    expect(PEGAR.length).toBeGreaterThan(0);
    expect(FALHAR.length).toBeGreaterThan(0);
  });

  it("registrar vigente resgata o tombstone: do update ... where failed", () => {
    const v = REGISTRAR[REGISTRAR.length - 1];
    expect(
      v.corpo,
      `${v.nome}: upsert do registrar não é do update`
    ).toMatch(/on\s+conflict\s*\(nonce\)\s+do\s+update/i);
    // o WHERE é o guard nos dois sentidos: resgata row falha e impede um
    // segundo clique de sobrescrever tokens bons já publicados
    expect(
      v.corpo,
      `${v.nome}: o do update perdeu o where failed`
    ).toMatch(/where\s+public\.login_handoffs\.failed\b/i);
    expect(v.corpo).toMatch(/failed\s*=\s*false/i);
  });

  it("falhar vigente nunca apaga tokens válidos: do nothing", () => {
    const v = FALHAR[FALHAR.length - 1];
    expect(
      v.corpo,
      `${v.nome}: falhar tem que ser do nothing — um 2º clique falho não pode roubar a sessão boa`
    ).toMatch(/on\s+conflict\s*\(nonce\)\s+do\s+nothing/i);
    expect(v.corpo).not.toMatch(/do\s+update/i);
  });

  it("pegar vigente distingue expirado de ausente, ANTES da limpeza global", () => {
    const v = PEGAR[PEGAR.length - 1];
    expect(
      v.corpo,
      `${v.nome}: sem a resposta 'expired' a aba que pediu espera pra sempre`
    ).toMatch(/jsonb_build_object\('expired',\s*true\)/i);
    // o select do expires_at do PRÓPRIO nonce tem que vir antes do delete
    // global — senão expirado e "ainda não chegou" continuam iguais
    const iVenc = v.corpo.search(/into\s+v_expired/i);
    const iDelete = v.corpo.search(
      /delete\s+from\s+public\.login_handoffs\s+where\s+expires_at/i
    );
    expect(iVenc).toBeGreaterThanOrEqual(0);
    expect(iDelete).toBeGreaterThan(iVenc);
    expect(v.corpo.slice(0, iDelete)).toMatch(
      /expires_at\s*<\s*now\(\)[\s\S]*where\s+nonce\s*=\s*p_nonce/i
    );
  });

  it("nenhuma migration posterior ao registrar vigente reintroduz o do nothing", () => {
    const iVigente = arquivos.indexOf(REGISTRAR[REGISTRAR.length - 1].nome);
    const posteriores = REGISTRAR.filter(
      (d) => arquivos.indexOf(d.nome) > iVigente
    );
    for (const d of posteriores) {
      expect(
        d.corpo,
        `${d.nome}: reintroduziu o bug da 0181 — tombstone failed volta a ganhar do link bom`
      ).not.toMatch(/on\s+conflict\s*\(nonce\)\s+do\s+nothing/i);
    }
  });
});
