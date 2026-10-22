# REALIZA-176 — design

## Persona & JTBD

**Persona**: coordenação abrindo `/agenda` no começo do dia.

**JTBD**: "em 5 s, quem precisa de lembrete/ação? e o que o calendário
oficial cobra essa semana?"

## Hierarquia — observação × proposta

**Observação (ordem atual)**: 1) resumo por turma (cards grandes), 2) "Para
acompanhar" (a fila de ação), 3) "Semana no programa". A pergunta
operacional está no meio; acima dela, cartões com 3 sinais sobrepostos.

**Proposta (ordem nova)**:

1. **"Para acompanhar"** sobe pra 1ª posição — é a resposta dos 5 s. Tag
   vira só o `N` (sem texto longo): `Para acompanhar · 7`.
2. **"Semana no programa"** sobe pra 2ª — o que o calendário impõe
   (LinhaPrograma já é a forma certa: linha simples).
3. **"Semana do encontro"** desce pra 3ª e **compacta**: `CardResumo` →
   linha única por turma:
   `PillTurma` + `Encontro N` + `dd/mm` + `X/Y realizaram` + **uma** barra
   de progresso `h-1.5` (fill lime, fundo muted — mesmo padrão da
   `LinhaDupla` de `/duplas`). O número gigante 3xl sai — `text-sm
   font-semibold tabular-nums` basta.
4. `Tag`s (`:204`, `:238`) saem do `<h2>` — a explicação "por turma, nunca
   global" vira `text-xs text-muted-foreground` dentro da seção, não chip.

## O "gráfico" correto por dado

| Dado | Forma (identidade existente) |
|---|---|
| X/Y realizaram | barra `bg-muted` + `bg-[var(--brand-lime)]` — **não** a barra 3-segmentos com danger-tracejado (única do app) |
| Semana do programa | lista `LinhaPrograma` — já certa |
| Fila de ação | linhas com motivo + CTA — já certa, sobe de posição |

A barra 3-segmentos (`:318-405`) é o "fora da identidade": `danger`
tracejado pra "sem data" sinaliza erro onde deveria ser neutro ("não
agendado" ≠ "problema"). Substituir pela barra única lime — "sem data" vira
parte do fundo muted, não cor própria.

## Densidade & Gestalt

- `CardResumo` → linha: ~120px de card → ~44-52px de linha; a seção inteira
  de 2 turmas passa de ~300px pra ~110px.
- Semelhança: todas as linhas-turma compartilham anatomia (pill+nome+data+
  X/Y+barra) — olho compara por posição.
- Continuidade: a barra de progresso conecta visualmente com a mesma barra
  em `/duplas` — uma linguagem só.

## Estados

- Sem cronogramas: mensagem de borda tracejada já existe (`:221-224`) —
  manter microcopy.
- Fila vazia: "Tudo em dia — nenhuma dupla pede atenção." — manter.
- Semana sem eventos: manter o caso `:262-264`.
- Permissão: bloco só renderiza pra coord — `page.tsx` já gateia por papel.

## Microcopy pt-BR

- Seção: `Para acompanhar · N` (Tag = só o número).
- Linha turma: `{Turma} · Encontro {N} · {dd/mm} · {X} de {Y} realizaram`.
- Nota interna: `Resumo por turma — cada uma no seu encontro.` (fora do
  título, `text-xs`).

## Cor semântica

- `brand-lime` = realizado/progredido; `muted` = não acontecido (não é
  "problema"); `warn` só em sinais de atenção da fila; **sem `danger`
  tracejado** — sai o único uso fora do padrão.

## Ordem de implementação

1. Reordenar as 3 seções (JSX move — trivial).
2. `CardResumo` → `LinhaResumo` (nova função no mesmo arquivo) com barra
   única; deletar a barra 3-segmentos.
3. `Tag`s viram notas dentro da seção (ou `· N` no título).
4. Revisão de paddings (`mt-3`, `gap-4`) pra altura-alvo da linha.

## Pergunta de fechamento

Detectar → entender → agir: a fila operacional no topo é a detecção; a
linha-turma compacta é o entendimento sem ruído; "Lembrar" já é a ação.
O redesenho só reordena e padroniza — sem perder nenhuma informação real.
