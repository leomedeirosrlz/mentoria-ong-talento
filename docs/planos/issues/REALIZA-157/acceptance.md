# REALIZA-157 — aceite

- Dado o demo `coordenacao` numa ficha de dupla ativa, quando clico "Mais",
  então cada item do menu ocupa a **largura total** do popup (ícone alinhado
  à esquerda, label à esquerda, sem coluna morta à direita).
- Dado o menu aberto, quando navego com ↓/↑, então o item destacado mostra
  `bg-muted` na linha inteira e Enter abre o dialog correspondente.
- Dado um item clicado (ex.: "Enviar formulário"), quando o dialog abre e eu
  fecho, então o foco volta pro botão "Mais" — não some nem fica preso.
- Dado menu fechado sem clique (Esc), quando reabro, então os itens estão
  idênticos — o estado interno dos dialogs não vazou entre aberturas.
- Dado `pendenteRegistro && podeAgendar`, quando abro o menu, então "Agendar
  encontro" aparece **primeiro** (ordem atual preservada).
- E2E: specs existentes que exercitam o menu devem seguir verdes
  (`tests/e2e/app/formularios.spec.ts`, `solicitacao-esp.spec.ts`,
  `jovem-especialista-wp6.spec.ts`, `demo/instrumentos.spec.ts:107`).
