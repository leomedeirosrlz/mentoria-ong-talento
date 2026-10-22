# REALIZA-18 — SDD

## Alternativas

**A. Dois SVGs lado a lado** — antes e depois em painéis separados. Pró:
simples. Contra: a issue pede overlay ("antes/depois" sobreposto é a leitura
do guia — o PDF oficial mostra uma roda só com duas linhas); lado a lado
exige comparação mental eixo a eixo. Rejeitada como default (pode ser
fallback mobile estreito — decisão de design).

**B. Overlay no mesmo `RodaSvg`** (escolhida) — um `<path>` extra com
`valoresAnterior`. Reusa malha, escala, labels e quadrantes — zero duplicação
de geometria.

**C. Novo componente `RodaComparativa`** — mais um componente pra manter;
rejeitada em favor da prop opcional.

## Modelo de dados

**Nenhuma mudança.** As duas respostas já vivem em `formulario_respostas`
via links da mesma `dupla_id` e `formularios.sistema='roda_vida'`;
`contexto.momento` distingue inicial×formal (setado pela emissão — verificar
em `emitir_instrumento_core` se `momento` é carimbado hoje; se não, a
**a verificar** vira tarefa: carimbar `contexto.momento` na emissão ou derivar
por `encontro_num` no contexto/ordem cronológica — primeira respondida =
inicial, segunda = formal; a heurística por ordem resolve mesmo sem carimbo).

Decisão: **derivar por ordem cronológica** (`respondido_em` mais antigo =
inicial dentro de `roda_vida` da dupla) como fallback robusto — funciona pra
dados já coletados sem backfill.

## Contratos

```ts
// roda-svg.tsx
<RodaSvg estrutura={e} valores={depois} valoresAnterior={antes}? modo="resultado" />

// roda-compara.ts
comparaRodas(estrutura: EstruturaRoda, antes: RespostaValor | null,
             depois: RespostaValor | null): EixoComparado[]
resumoDelta(eixos): { geral: number | null; porQuadrante: Record<string, number|null> }
```

## Invariantes

1. Overlay só aparece quando **as duas** respostas existem na mesma dupla —
   nunca inventa "antes" vazio.
2. Casamento por `campo_id`; eixo sem par → ponto ausente naquele lado
   (polígono recua pro centro? não — omite o vértice / usa 0 visual marcado;
   decisão: `null` → vértice no centro com opacidade menor, legenda avisa
   "eixo não comparável").
3. Entrada (input) nunca mostra overlay — comparativo é só leitura
   (`modo="resultado"`); a jovem responde a formal com roda limpa.

## Performance

Cálculo O(16) client-side — desprezível; sem query nova se os payloads
existentes já carregam as duas respostas (ficha: `instrumentos_da_dupla`;
jovem: `jovem_jornada` — ambas já trazem respostas por link).
