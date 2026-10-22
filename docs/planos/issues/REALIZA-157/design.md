# REALIZA-157 — nota de design

Micro-fix; a decisão de design já está coberta pelo padrão do design system.

- **Anatomia alvo**: `DropdownMenuContent align="end" w-56` + itens
  `DropdownMenuItem` (`flex w-full items-center gap-1.5 rounded-lg px-2.5
  py-2 text-sm`, ícone `[&_svg]:size-4`, `data-highlighted` com `bg-muted`).
- **Alinhamento**: ícone à esquerda, label à esquerda (`justify-start`),
  hit-target = largura inteira do popup — já é o que a classe entrega quando
  o item é o elemento raiz do item (a composição trigger×item quebrava isso).
- **A11y**: `role="menuitem"` com `aria-haspopup="dialog"` implícito pelo
  comportamento (o item abre um dialog, não um submenu) — ao mover o `onClick`
  pro item, considerar `aria-haspopup="dialog"` explícito pra leitores de tela.
- **Foco**: abrir o dialog a partir do item deve devolver o foco pro botão
  "Mais" ao fechar (Base UI `Menu` já gerencia o retorno do foco ao trigger;
  validar que o dialog controlado não rouba o foco de volta pro item
  desmontado — é um dos motivos pra tirar o trigger de dentro).
- **Microcopy**: labels atuais já pt-BR e orientadas a ação ("Agendar
  encontro", "Enviar formulário", "Pedir especialista", "Sugerir
  especialista", "Encerrar trilha de especialista") — manter.
