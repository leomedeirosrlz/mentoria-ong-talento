// Verificador automático dos planos em docs/planos/issues/REALIZA-NNN/
// Uso: node scripts/check-planos.mjs [--dir docs/planos/issues]
// Checa: (1) docs esperados por tier, (2) paths citados existem,
// (3) tabelas citadas existem no schema/migrations, (4) acceptance numerado,
// (5) BLOCKERs resolvidos ou explicitados. Saída: relatório por issue.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const di = process.argv.indexOf('--dir');
const DIR = join(ROOT, di >= 0 ? process.argv[di + 1] : 'docs/planos/issues');

// universo de paths reais: src/, supabase/migrations/, docs/, scripts/, tests/, .github/
const KNOWN_DIRS = ['src/', 'supabase/migrations/', 'docs/', 'scripts/', 'tests/', '.github/', 'supabase/'];
const PATH_RE = /(?:^|[\s`"'(])((?:src|supabase|docs|scripts|tests|\.github)\/[\w\-./[\]]+\.(?:tsx|ts|jsx|sql|md|mjs|json|yml|yaml|css))/gm;
const TABLE_RE = /\b(?:from|into|table|join|update|alter table)\s+["'`]?([a-z][a-z_]+)/gim;
const TABLES_CACHE = new Set();

// extrai nomes de tabelas das migrations
for (const f of readdirSync(join(ROOT, 'supabase/migrations'))) {
  if (!f.endsWith('.sql')) continue;
  const sql = readFileSync(join(ROOT, 'supabase/migrations', f), 'utf8');
  for (const m of sql.matchAll(/create table (?:if not exists )?(?:public\.)?["'`]?([a-z_]+)/gi)) TABLES_CACHE.add(m[1]);
  for (const m of sql.matchAll(/alter table (?:if exists )?(?:public\.)?["'`]?([a-z_]+)/gi)) TABLES_CACHE.add(m[1]);
}

const TIER_A_DOCS = ['README.md', 'plan.md', 'sdd.md', 'design.md', 'sdr.md', 'acceptance.md'];
const TIER_B_DOCS = ['README.md', 'plan.md', 'acceptance.md'];

// tiers do manifesto (parseia a tabela)
const manifest = readFileSync(join(DIR, '_manifest.md'), 'utf8');
const tierOf = {};
for (const m of manifest.matchAll(/\|\s*(\d+)\s*\|/g)) {
  // inferência simples: seção em que aparece
}
// fallback: Tier A list hardcoded das seções do manifesto
const tierAKeys = [...manifest.matchAll(/^\|\s*(\d+)\s*\|[^\n]*$/gm)].map(m => m[1]);
const tierASection = manifest.split('### Tier A')[1]?.split('### Tier B')[0] ?? '';
for (const m of tierASection.matchAll(/^\|\s*(\d+)\s*\|/gm)) tierOf[m[1]] = 'A';
const tierBSection = manifest.split('### Tier B')[1]?.split('### Tier C')[0] ?? '';
for (const m of tierBSection.matchAll(/^\|\s*(\d+)\s*\|/gm)) tierOf[m[1]] = 'B';

const results = [];
let failCount = 0;

for (const entry of readdirSync(DIR).sort()) {
  if (!/^REALIZA-\d+$/.test(entry)) continue;
  const dir = join(DIR, entry);
  if (!statSync(dir).isDirectory()) continue;
  const num = entry.split('-')[1];
  const tier = tierOf[num] ?? 'B';
  const files = existsSync(dir) ? readdirSync(dir) : [];
  const problems = [];
  const warns = [];

  // issues de evidência/absorção/decisão são isentas de doc-set completo
  const readmePath = join(dir, 'README.md');
  const readme = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : '';
  const isEvidence = /FEITO|entregue|absorvid|duplicat|clone|decisão registrada|DECISÃO respondida|tier\s*:?\s*C\b|SEM PLANO/i.test(readme.slice(0, 1500)) || files.includes('decisao.md');

  // (1) docs esperados — evidência/absorção só exige README
  if (!isEvidence) {
    const expected = tier === 'A' ? TIER_A_DOCS : TIER_B_DOCS;
    for (const d of expected) if (!files.includes(d)) {
      // design.md/sdd.md/sdr.md só obrigatórios quando o tema pede — vira warn
      if (['design.md', 'sdd.md', 'sdr.md'].includes(d)) warns.push(`tier ${tier} sem ${d}`);
      else problems.push(`falta ${d}`);
    }
  }

  // (2)(3)(4)(5) conteúdo — paths novos propostos em QUALQUER lugar do doc
  for (const f of files.filter(x => x.endsWith('.md'))) {
    const txt = readFileSync(join(dir, f), 'utf8');
    // conjunto de paths declarados como novos no doc inteiro
    const novos = new Set();
    for (const m of txt.matchAll(PATH_RE)) {
      const ln = txt.slice(0, m.index).split('\n').length;
      const win = txt.split('\n').slice(Math.max(0, ln - 2), ln + 1).join(' ');
      if (/\[NOVO\]|novo arquivo|criar |nova migration|proposta|será criado|a criar|criar o arquivo|novo:|arquivo novo/i.test(win)) novos.add(m[1].replace(/\/+$/, ''));
    }
    for (const m of txt.matchAll(PATH_RE)) {
      const p = m[1].replace(/\/+$/, '');
      if (existsSync(join(ROOT, p))) continue;
      const line = txt.slice(0, m.index).split('\n').length;
      if (novos.has(p)) continue;
      if (p.endsWith('.ts') && existsSync(join(ROOT, p + 'x'))) {
        problems.push(`${f}:${line} extensão errada: \`${p}\` → \`${p}x\``);
        continue;
      }
      // README/descrição de estado atual: path inexistente = falha.
      // Docs de proposta (plan/sdd/design/sdr/acceptance/decisao): aviso.
      if (f === 'README.md' || /hoje|atual|existe em|implementado em|ver `/.test(txt.split('\n')[line - 1] ?? '')) {
        problems.push(`${f}:${line} cita path inexistente \`${p}\``);
      } else {
        warns.push(`${f}:${line} path ausente (proposta?) \`${p}\``);
      }
    }
    // tabelas SQL citadas
    if (/sql|migration|database/i.test(f + txt.slice(0, 400))) {
      for (const m of txt.matchAll(TABLE_RE)) {
        const t = m[1].toLowerCase();
        if (['select', 'where', 'and', 'or', 'the', 'values', 'set', 'null', 'not'].includes(t)) continue;
        if (!TABLES_CACHE.has(t) && !/\[NOVO\]|criar tabela|nova tabela|proposta|create table/i.test(txt.slice(Math.max(0, m.index - 200), m.index))) {
          warns.push(`${f} cita tabela desconhecida \`${t}\``);
        }
      }
    }
    // acceptance numerado
    if (f === 'acceptance.md') {
      const n = (txt.match(/^\s*\d+[.)]/gm) ?? []).length;
      if (n < 3 && !isEvidence) warns.push(`acceptance.md com ${n} critérios numerados (<3)`);
    }
    // BLOCKER pendente
    for (const m of txt.matchAll(/BLOCKER:\s*(.+)/g)) {
      warns.push(`${f} BLOCKER aberto: ${m[1].slice(0, 80)}`);
    }
  }

  if (!files.length) problems.push('pasta vazia');
  results.push({ entry, tier, files: files.length, problems, warns });
  if (problems.length) failCount++;
}

console.log(`\n${'='.repeat(70)}\nCHECK-PLANOS — ${results.length} pastas, ${failCount} com problemas\n${'='.repeat(70)}`);
for (const r of results) {
  const icon = r.problems.length ? '✗' : r.warns.length ? '~' : '✓';
  console.log(`${icon} ${r.entry} [tier ${r.tier}] ${r.files} docs`);
  for (const p of r.problems) console.log(`    FALHA  ${p}`);
  for (const w of r.warns.slice(0, 5)) console.log(`    aviso  ${w}`);
}
process.exit(failCount ? 1 : 0);
