// Cron é um ponto cego: a Vercel chama o endpoint e ninguém olha. Criar
// /api/jobs/<nome> sem bearer vira endpoint público que escreve no banco;
// renomear uma chave do JOBS faz o job sumir do tick diário sem nenhum
// erro. Este spec amarra as três pontas: rotas de job autenticadas, o
// cron único do vercel.json e o registro de jobs do tick.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function rotasDeJob(dir: string): string[] {
  const achadas: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) achadas.push(...rotasDeJob(p));
    else if (e.name === "route.ts") achadas.push(p);
  }
  return achadas;
}

const rotas = rotasDeJob(path.join(ROOT, "src", "app", "api", "jobs"));
const tick = readFileSync(
  rotas.find((r) => r.endsWith(path.join("api", "jobs", "tick", "route.ts"))) ?? "x",
  "utf8"
);
const vercel = JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8"));

describe("rotas de cron", () => {
  it("toda rota em src/app/api/jobs chama autorizarCron", () => {
    expect(rotas.length).toBeGreaterThan(0);
    const semBearer = rotas.filter((r) => !/autorizarCron/.test(readFileSync(r, "utf8")));
    expect(semBearer, `rota de job sem bearer: ${semBearer.join(", ")}`).toEqual([]);
  });

  it("o vercel.json tem um único cron e é o tick", () => {
    expect(vercel.crons).toEqual([{ path: "/api/jobs/tick", schedule: "0 6 * * *" }]);
  });

  it("o tick orquestra exatamente os jobs conhecidos", () => {
    const jobs = [...tick.matchAll(/^  ([a-z_]+): rodar/gm)].map((m) => m[1]);
    expect(new Set(jobs).size, "job duplicado no registro").toBe(jobs.length);
    expect(jobs).toEqual([
      "saude_snapshots",
      "lembretes_trilha",
      "lembretes_registro",
      "digest_semanal",
      "retencao_produto",
    ]);
  });
});
