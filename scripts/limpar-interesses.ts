/** Re-deriva `interesses` a partir do form_bruto (texto cru do intake) com o
 *  normLista atual — a versão antiga splitava só em [;|,] e triturava
 *  frases ("cafés e lugares 2. Brincar com pets" virava um badge).
 *
 *  Uso:
 *    ./node_modules/.bin/jiti scripts/limpar-interesses.ts           # dry-run
 *    SUPABASE_SERVICE_ROLE_KEY=... ./node_modules/.bin/jiti scripts/limpar-interesses.ts --apply
 *
 *  Sem --apply só mostra o diff. Service key só por ambiente (mesmo
 *  contrato do importar-intake.ts). Respeita interesses_ok: ≤20 itens,
 *  1–60 chars cada.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { normLista } from "../src/lib/importar";

const APPLY = process.argv.includes("--apply");

function envLocal(k: string): string {
  try {
    const m = new RegExp(`^${k}=(.+)$`, "m").exec(
      readFileSync(".env.local", "utf-8")
    );
    return m?.[1].trim() ?? "";
  } catch {
    return "";
  }
}

const URL = process.env.SUPABASE_URL || envLocal("NEXT_PUBLIC_SUPABASE_URL");
const KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || envLocal("SUPABASE_SERVICE_ROLE_KEY");
if (!URL || !KEY) {
  console.error("Precisa de NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const supabase = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// mesmas fontes do transformar-intake.py (monta_interesses): mentores
// levam hobbies+esportes; mentorados hobbies+"coisas que mais gosta"+esportes
const FONTES: Record<string, RegExp[]> = {
  profiles: [/hobbie/i, /esporte/i],
  mentorados: [/hobbie/i, /coisas.*gosta/i, /esporte/i],
};

function fontesDe(
  bruto: Record<string, unknown> | null,
  matchers: RegExp[]
): string {
  if (!bruto) return "";
  const partes: string[] = [];
  for (const re of matchers) {
    for (const [k, v] of Object.entries(bruto)) {
      if (re.test(k) && typeof v === "string" && v.trim()) partes.push(v);
    }
  }
  return partes.join("\n");
}

const capa = (itens: string[]) =>
  itens.filter((i) => i.length <= 60).slice(0, 20);

async function limpaTabela(tabela: "profiles" | "mentorados") {
  const { data, error } = await supabase
    .from(tabela)
    .select("id, nome, interesses, form_bruto")
    .or("interesses.neq.{},form_bruto.not.is.null");
  if (error) throw error;

  let mudou = 0;
  let igual = 0;
  for (const row of data ?? []) {
    const bruto = row.form_bruto as Record<string, unknown> | null;
    const atual = (row.interesses as string[] | null) ?? [];

    // fonte preferida: o texto cru das perguntas de hobby/esporte.
    // fallback: re-split do array atual (linha por item) — conserta "N."
    // embutido e fragmentos sem precisar do form_bruto
    const fonte = fontesDe(bruto, FONTES[tabela]);
    const texto = fonte || atual.join("\n");
    const novo = capa(normLista(texto));

    const igualArrays =
      novo.length === atual.length && novo.every((v, i) => v === atual[i]);
    if (igualArrays) {
      igual++;
      continue;
    }
    mudou++;
    console.log(`\n[${tabela}] ${row.nome}`);
    console.log(`  antes: ${JSON.stringify(atual)}`);
    console.log(`  depois: ${JSON.stringify(novo)}`);

    if (APPLY) {
      const { error: e2 } = await supabase
        .from(tabela)
        .update({ interesses: novo })
        .eq("id", row.id);
      if (e2) {
        console.error(`  !! falhou: ${e2.message}`);
        mudou--;
      }
    }
  }
  console.log(
    `\n${tabela}: ${mudou} ${APPLY ? "atualizadas" : "mudariam"}, ${igual} já ok`
  );
}

for (const t of ["profiles", "mentorados"] as const) {
  await limpaTabela(t);
}
console.log(APPLY ? "\nAplicado." : "\nDry-run — rode com --apply pra gravar.");
