# Redesign round 2 — brief compartilhado (avaliação da demo)

Feedback do Thiago sobre o preview da rodada 1. Regra de ouro mantida:
identidade lime/papel intacta, sem decoração gratuita, copy pt-BR,
progressive disclosure, a11y preservada.

## Itens (12)

1. **Resumo da semana** — home coord: está por último no rail; precisa de
   mais prioridade/visibilidade.
2. **Indicadores laterais de cor (avisos)** — o rail `border-l-2` ficou ruim.
   Alternativas pedidas: borda real do card colorida OU overlay/fundo
   colorido leve.
3. **Botão de filtro em /registros** — deve ser lime sólido (mesma
   hierarquia do "Cadastrar dupla"), não pill escuro.
4. **Botões dos cards de materiais** — AINDA quebrados em certas larguras
   (o fix da rodada 1 não bastou; precisa reprodução real).
5. **/formularios** — falta filtro na aba.
6. **Todos os filtros** — devem incluir opção de ORDENAR.
7. **Agenda** — nas 3 visões (mês/semana/lista), o encontro da semana
   corrente precisa de indicador visível (overlay lime/verde ou marcador).
8. **Perfil: visual** — "ficou feio"; tudo num mesmo card estreito
   (max-w-lg) não funciona. Direção: LinkedIn/redes sociais — banner
   personalizado por papel/role + avatar + seções em cards.
9. **Perfil: desktop** — relatado como quebrado (cards empilham à direita,
   esquerda estica). Investigar estado real renderizado.
10. **Mentor especialista** — pode ter VÁRIOS encontros/duplas; a home precisa
    ser dinâmica pra N duplas, não assumir uma.
11. **Footer escuro** — sugestão: footer ink pra marcar o fim da página.
12. **Validação dos dados importados** — auditar o intake real: perfis
    parseados direito? campos quebrados? (pesquisa, não código)

## Convenções novas (já em globals.css)

- `shadow-[var(--shadow-overlay)]` / `--shadow-modal` / `--shadow-inset`
- `.fill-grow` barras; icon well `grid size-11 rounded-full bg-muted`;
- `filterChipCls` em ui/filter-chip.ts (ativo=pill escuro);
- hairlines `/60` dentro de card; overline 11px pra labels de seção;
- hover:-translate-y-px só em cards standalone; lime = navegação/ação
  primária; escuro = filtro ligado.

## Processo

Pesquisa em paralelo → eu seleciono e escrevo o plano → redatores com
arquivos disjuntos → validação por subagents (telas/responsivo/a11y/code)
→ validação final minha. Verificação por agente: `npx tsc --noEmit` +
`npx eslint` nos arquivos tocados. Fecho: `pnpm vitest run` + smoke.
