# REALIZA-22 — Design / UX

Posição estável do "Agendar encontro" + microcopy "oficial = sugestão".
Framework: `.devin/skills/ux-review/SKILL.md`. Mudança cirúrgica — o restante
da ficha e da agenda já está entregue (REALIZA-27/28).

## Persona & JTBD

**Mentor DPP** na ficha da dupla — a tela de trabalho dele. JTBD nos 5s:
"o que eu faço agora?" A resposta muda por estado (registrar pendência ×
agendar o próximo), mas **a localização das ferramentas não pode mudar** —
a ação mais frequente escondida dentro de "⋯ Mais" quando a outra assume o
primário é exatamente o bug reportado ("quem mais precisa agendar vê menos o
botão").

**Mentor em `/agenda`** — a confusão da sessão real ("dá pra repor uma data
pela plataforma?") mostra que o modelo "data oficial = sugestão" não se
comunica sozinho. Uma linha resolve o conceito — nunca uma seção.

## Hierarquia — header da ficha

Ordem dos gestos na linha de ações (`page.tsx:818+`), depois da mudança:

1. **Contextual do papel**: `Registrar encontro` (primário — só quando há
   `pendenteRegistro`) ou `Agendar encontro` (primário — quando não há
   pendência).
2. **`Agendar encontro` (outline)** — sempre presente quando `podeAgendar`,
   inclusive ao lado do Registrar. É a posição estável: o botão nunca sai da
   linha nem troca de container.
3. `Pedir apoio` (outline), WhatsApp/Editar/Remanejar por papel, `⋯ Mais`
   (só ações raras: enviar formulário, solicitar especialista, encerrar).

Regra que a mudança codifica: **agendar nunca entra no overflow** — o "Mais"
é pra gestos de segunda ordem (enviar formulário, encerrar trilha); marcar o
próximo encontro é a rotina.

### Anatomia do botão

| Estado | Variante | Rótulo | Posição |
|---|---|---|---|
| Sem pendência | `default` (trigger padrão do dialog) | `Agendar encontro` | 1º da linha |
| Com `pendenteRegistro` | `outline` size sm | `Agendar encontro` | 2º, ao lado de `Registrar encontro` (primário) |
| Trilha especialista | `outline` | `Remarcar` na linha da sessão / `sessão de especialista` no header | inalterado (`:840-851`) |

O dialog segue abrindo com `numero={proximoNumero}` e título interno
"Nº encontro" — o nº explícito mora no dialog, não no rótulo (mesmo padrão
dos outros CTAs do header).

## Microcopy — "oficial = sugestão" na agenda

Princípio da casa: o conceito mora **uma vez por superfície**, no rótulo —
nunca repetido por linha (`page.tsx:1308-1311`, `:1500`). Dois pontos de
contato cobrem as três abas do mentor:

| Ponto | Texto | Quem vê |
|---|---|---|
| Subheader do ramo mentor (`agenda/page.tsx:254-259`) | acréscimo: `As datas oficiais do guia são sugestões — vocês combinam a real e registram aqui.` | mentor (abas minha / por-mentorado / calendário) |
| Rodapé `LegendaAgenda` (`agenda-calendario.tsx:3823+`) | `As datas oficiais são sugestões — vocês combinam e registram a real.` | só quando `temPapel(mentor_dpp)` — coord/sup não precisam da instrução |

A ficha já cobre: `Encontros · datas sugeridas pelo guia`
(`page.tsx:1315-1321`) — **não duplicar** a frase lá.

### Por que esses dois pontos

- O subheader é lido antes da lista — explica o modelo **antes** do usuário
  interpretar os marcadores (figura/fundo: a explicação é texto muted de
  apoio, o conteúdo operacional segue em primeiro plano).
- A `LegendaAgenda` é onde o mentor aprende a ler os marcadores — a nota no
  rodapé acompanha a legenda dos discos (oficial grande vs. dot da dupla),
  fechando o loop "disco cheio = sugestão, o que vale é o que vocês marcam".
- `sm:ml-auto` joga a nota pra borda direita no desktop — separada das chaves
  de legenda, não finge ser mais um swatch.

## Estados

| Estado | Render |
|---|---|
| `pendenteRegistro` | `Registrar encontro` primário + `Agendar encontro` outline ao lado |
| Sem pendência | `Agendar encontro` primário (como hoje) |
| `!podeAgendar` (dupla encerrada/pausada, ciclo completo, não-mentor) | nenhum Agendar — comportamento inalterado |
| `maisItens` vazio | o `⋯ Mais` some sozinho (`:897`) — possível eixo limpo: só os gestos da linha |
| Mobile estreito | `flex-wrap` do container quebra o Agendar pra 2ª linha antes de esmagar o primário; hit areas ≥44px mantidas |
| Calendário sem duplas DPP (coord/sup/especialista) | legenda sem a nota de sugestão |

## A11y

- `AgendarEncontroDialog` já expõe `DialogTrigger` com `Button` real — foco,
  Enter/Espaço, `aria-haspopup` vêm de graça.
- A nota da legenda é texto comum — sem `aria-hidden` (é informação), dentro
  da mesma região da legenda (já `<div>` com conteúdo textual).
- Nenhum estado novo depende de cor sozinha (outline vs. default é peso, a
  ação é texto literal).

## O que NÃO fazer

- Não repetir a frase em cada card/linha de encontro (viola a regra "uma vez
  por superfície").
- Não transformar o Agendar em segundo item dentro do menu — o fix é ele
  estar **fora** do menu.
- Não mudar o `DropdownMenu`/portal (`keepMounted`) — os outros itens ficam.
- Não mexer na versão do jovem (`/jovem/agenda`) — o modelo de sugestão já
  aparece lá via `oficialPorNumero`/hint "sugerido"; a issue é do lado do
  mentor.
