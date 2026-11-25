#!/usr/bin/env node
// Lista os modelos *-free do catálogo do provider (GET $IA_API_BASE/models,
// mesmo endpoint que api/ia/modelos usa) pro eval-gate: imprime uma linha
// com os slugs separados por vírgula — um só, porque cada slug extra
// repete o corpus inteiro e o gate já roda na beira do limite de 20
// msg/60s por profile. Amplitude de modelos fica pro painel /ia.
// Os *-free não estão no TETOS_GO_USD de propósito (a tabela só cobre os
// pagos — "sem teto conhecido") — são a aposta certa pro gate: não queimam
// quota do plano. Sair sem nada (exit 1) faz o workflow cair no fallback.

const base = process.env.IA_API_BASE;
const key = process.env.IA_API_KEY;
if (!base || !key) {
  console.error("precisa de IA_API_BASE e IA_API_KEY");
  process.exit(2);
}

try {
  const res = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const frees = (json.data ?? [])
    .map((m) => m?.id)
    .filter((s) => typeof s === "string" && /-free$|:free$/.test(s))
    .sort();
  if (!frees.length) process.exit(1);
  console.log(frees[0]);
} catch (e) {
  console.error(`catálogo falhou: ${e.message ?? e}`);
  process.exit(1);
}
