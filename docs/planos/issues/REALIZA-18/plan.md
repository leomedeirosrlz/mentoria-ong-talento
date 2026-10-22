# REALIZA-18 — Plano de implementação

## Contexto embutido

A roda da vida já é interativa e já roda nos dois momentos do ciclo
(`contexto.momento`: inicial enc.1 × formal enc.12–14). Falta o
**overlay**: quando a formal estiver respondida, mostrar as duas juntas.
Nenhuma tabela nova — é leitura comparada de duas `formulario_respostas` da
mesma `dupla_id` + mesmo `sistema='roda_vida'`.

## Passos

1. **Lib pura** — `src/lib/roda-compara.ts` `[NOVO]`:
   ```ts
   type EixoComparado = { id: string; label: string; quadrante: string;
     antes: number | null; depois: number | null; delta: number | null };
   comparaRodas(estrutura, respostasAntes, respostasDepois): EixoComparado[]
   ```
   - Casa por `campo_id` (não posição) — form pode ter sido editado entre
     momentos; eixo ausente num lado → `null` + render degracê.
   - `resumoDelta(eixos)`: delta médio geral + por quadrante (pra legenda).
   - Vitest em `src/lib/roda-compara.test.ts`: 16 eixos, eixo novo sumido,
     resposta parcial, delta negativo.

2. **RodaSvg vira comparável** — `src/components/instrumentos/roda-svg.tsx`:
   prop opcional `valoresAnterior?: Record<string, number>` — quando
   presente, desenha o polígono antigo **atrás**: contorno tracejado
   `stroke-dasharray`, fill ~15% opaco, sem labels duplicados. Reusa a mesma
   malha/eixos (a estrutura vem do form atual; pontos antigos casados por id
   via `comparaRodas`).
   Acessibilidade: `aria-label` do grupo vira "Roda da vida — comparativo
   antes (tracejado) e depois (preenchido)".

3. **Ficha da dupla** — `src/components/instrumento-resultado.tsx` +
   `instrumentos-dupla.tsx`: quando `sistema='roda_vida'` ∧ `momento='formal'`
   ∧ existe resposta `momento='inicial'` respondida na mesma dupla → render
   comparativo + legenda ("Inicial — encontro 1" tracejado × "Formal —
   enc. N" preenchido) + delta médio. Busca: `instrumentos_da_dupla` já
   devolve a lista de links+respostas da dupla — **a verificar** se o payload
   inclui `contexto.momento` e `respostas` pra todas (0096 comenta que sim);
   se faltar, estender a projeção da RPC.

4. **Jornada da jovem** — `ReverRespostaDialog`/`jornada-rever.tsx` na
   estação `roda_formal`: o payload `jovem_jornada` já traz `respostas` por
   estação — juntar `roda_inicial.respostas` + `roda_formal.respostas` no
   client e passar `valoresAnterior` pro render. Copy: "A roda tracejada é a
   sua leitura do início — vê o quanto já mudou."

5. **Resultado do submit** (pós-envio da formal em `/f/[token]`): mesma
   lógica — se o servidor sabe que existe inicial, a tela de sucesso pode
   mostrar o overlay. Se exigir nova projeção na RPC pública, avaliar custo;
   fallback: sucesso simples atual + overlay só nas superfícies internas.

6. **Demo** — `src/lib/demo/forms-data.ts`: fixture com as duas rodas
   respondidas da mesma dupla pra o comparativo aparecer na demo.

## Ordem de PR

Um PR só, pequeno: lib+svg primeiro (commit interno), superfícies depois.

## Rollback

Prop opcional: remover `valoresAnterior` dos call-sites volta ao render
atual — sem migration pra desfazer.
