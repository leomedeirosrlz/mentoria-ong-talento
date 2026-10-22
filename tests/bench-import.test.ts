import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import {
  parseCsvRegistros,
  processaLinhas,
  type DuplaCandidata,
  type UniversoReg,
} from "../src/lib/importar-registros";

/** Benchmark do import semanal contra dados reais — não roda na suíte
 *  padrão (precisa de BENCH_ROSTER + BENCH_CSV apontando pro dump do
 *  cadastro e pro CSV do formulário). Imprime o resultado linha a linha. */
const ROSTER = process.env.BENCH_ROSTER;
const CSV = process.env.BENCH_CSV;
// HOJE default = data real do bench (o CSV é recente; um default congelado
// no passado marca tudo "data no futuro" e distorce o resultado)
const HOJE = process.env.BENCH_HOJE
  ? new Date(process.env.BENCH_HOJE)
  : new Date();

describe.skipIf(!ROSTER || !CSV)("bench import — dados reais", () => {
  it("processa e imprime o resultado por linha", () => {
    const roster = JSON.parse(readFileSync(ROSTER!, "utf8"));
    const calendario = new Map<string, Map<number, string>>();
    for (const ev of roster.ciclo ?? []) {
      if (ev.numero == null || !ev.data) continue;
      let m = calendario.get(ev.cronograma_id);
      if (!m) calendario.set(ev.cronograma_id, (m = new Map()));
      m.set(ev.numero, ev.data);
    }
    const encontros = new Map<string, Map<number, { status: string; data: string | null }>>();
    for (const e of roster.encontros ?? []) {
      let m = encontros.get(e.dupla_id);
      if (!m) encontros.set(e.dupla_id, (m = new Map()));
      m.set(e.numero, { status: e.status, data: e.data_hora ?? e.data ?? null });
    }
    const universo: UniversoReg = {
      mentores: roster.mentores,
      mentorados: roster.mentorados,
      calendario,
      encontros,
      duplas: roster.duplas.map(
        (d: {
          id: string;
          mentor_id: string;
          mentorado_id: string;
          status: string;
          trilha: string;
          cronograma_id?: string | null;
          iniciada_em?: string | null;
          mentorNome: string;
          mentoradoNome: string;
        }): DuplaCandidata => ({
          id: d.id,
          mentor_id: d.mentor_id,
          mentorado_id: d.mentorado_id,
          status: d.status,
          trilha: d.trilha,
          cronograma_id: d.cronograma_id,
          iniciada_em: d.iniciada_em,
          mentorNome: d.mentorNome,
          mentoradoNome: d.mentoradoNome,
        })
      ),
    };

    const { linhas: cruas, ignoradas } = parseCsvRegistros(readFileSync(CSV!, "utf8"));
    const { linhas, stats } = processaLinhas(cruas, universo, HOJE);

    const porNivel = { auto: 0, provavel: 0, manual: 0, sem: 0 };
    for (const l of linhas) {
      if (l.nivel) porNivel[l.nivel]++;
      else porNivel.sem++;
    }
    console.log(`\n═══ BENCH IMPORT ═══ linhas=${cruas.length} ignoradas=${ignoradas}`);
    console.log(
      `stats: ok=${stats.ok} revisar=${stats.revisar} ignorar=${stats.ignorar}` +
        ` · níveis: auto=${porNivel.auto} provável=${porNivel.provavel} manual=${porNivel.manual} s/linha=${porNivel.sem}\n`
    );
    for (const l of linhas) {
      const dupla = l.duplaId
        ? roster.duplas.find((d: { id: string }) => d.id === l.duplaId)
        : null;
      console.log(
        [
          `L${String(l.n).padStart(3)}`,
          l.status.toUpperCase().padEnd(7),
          (l.nivel ?? "-").padEnd(8),
          `score=${String(l.score ?? "-").padStart(3)}`,
          `enc=${String(l.numero ?? "-").padStart(2)}`,
          `m="${l.mentorTxt}"→${l.mentorNome ?? "?"}`,
          `md="${l.mentoradoTxt}"→${l.mentoradoNome ?? "?"}`,
          dupla ? `dupla=${dupla.mentoradoNome}/${dupla.mentorNome}` : "",
          l.motivo ? `motivo="${l.motivo}"` : "",
          `cand=${l.candidatos.length}`,
        ].join(" ")
      );
      for (const ev of (l.evidencias ?? []).slice(0, 4)) {
        console.log(`      · ${ev.texto} [${ev.peso}]`);
      }
    }
  });
});
