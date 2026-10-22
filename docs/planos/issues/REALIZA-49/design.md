# REALIZA-49 — design.md (grade de respostas)

## Persona & JTBD

**Coordenação** (desktop, avaliando intake): "ler 30 respostas na
horizontal — quem respondeu o quê — sem abrir 30 accordions nem baixar
CSV". Caso forte: matching (69/70) onde o respondente **é** a linha.

## Hierarquia

Seção Respostas da ficha (`#sec-respostas`):
```
Perguntas · Links (N) · Respostas (N)
[ Resumo | Grade ]  (segmento)
────────────────────────────
Resumo: agregados por pergunta (atual)
Grade:  [Respondente ↓][Quando][campo 1][campo 2]…
```

## Regras

- Segmento `Resumo | Grade` — padrão radio (não tabs); `?view=grade`
  persistido na URL.
- Grade = `RelatorioCanvas`: coluna Respondente **sticky-left** com nome
  do destinatário do link ("Link genérico" quando sem destinatário),
  coluna Quando estreita `dd/mm HH:mm`, uma coluna por campo na ordem do
  form; campos removidos do form viram colunas no fim (rótulo em muted +
  `· removido`).
- Célula `arquivo` = link "nome.pdf" (abre `/api/form-anexo/[id]`).
- Célula `grid_disponibilidade` = "N faixas" + title com a lista.
- Célula longa: 2 linhas clamp + title completo (copiar TSV leva o valor
  inteiro).
- Larguras: `storageKey="grade-respostas:{formId}"`, resize arrastando a
  borda (herdado do canvas).

## Estados

- **Vazio**: "Nenhuma resposta ainda — compartilhe o link." (mesmo tom do
  resumo existente).
- **Loading**: skeleton de tabela (3 linhas) — paridade com os
  `loading.tsx` das rotas.
- **Muitos campos**: scroll-x; hint caption "arraste as bordas pra
  ajustar" só no primeiro uso? — não: caption fixo curto.
- **Permissão**: rota já coord-only — sem estado extra.

## Mobile

- `<lg`: tentativa 1 = grade com scroll-x + coluna sticky; se review
  rejeitar (screenshot), fallback = segmento vira só "Resumo" no mobile
  com hint "A grade abre em tela maior". Não fazer cards-por-respondente
  paralelo — os accordions já cumprem isso.

## Microcopy

- "Resumo" / "Grade" · "Link genérico" · "Removido" · "N faixas" ·
  "Nenhuma resposta ainda — compartilhe o link."

## A11y

- `role="grid"`/`gridcell` (canvas já implementa padrão); `aria-sort` se
  ordenação entrar (fase 2 — **fora de escopo agora**: ordenar/filtrar na
  grade fica pra próxima issue; escopo = paridade com cards + TSV).

## Reuso

`RelatorioCanvas`, segmento-radio do login, `Badge`, tokens existentes.
