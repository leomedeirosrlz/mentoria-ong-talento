# Convenções de execução — rodada de polimento (out/2026)

Valem para toda implementação desta rodada. Complementam o `AGENTS.md`, que
continua sendo a fonte das convenções do projeto: leia as seções "Hierarquia
de texto", "Movimento" e "Modo demo" antes de editar.

## Cor (plano 01, já aplicado em `globals.css`)

| Cor | Token | Uso |
|---|---|---|
| Tinta | `--foreground` / `--brand-ink` (#323232) | texto; superfície escura de destaque |
| Lima | `--primary` / `--brand-lime` | **ação**: um único botão preenchido por tela, item ativo da nav, foco. Nunca texto, nunca "está tudo bem" |
| Amarelo | `--destaque`, `--destaque-suave`, `--destaque-borda` | próximo passo, jornada, celebração. Texto sobre ele é sempre `--foreground`. Nunca alerta |
| Risco | `--danger`, `-text`, `-bg`, `-border` | crítico real, sempre com rótulo |
| Atenção | `--warn`, `-text`, `-bg`, `-border` (laranja) | pendência acompanhável |
| Feito | `--ok`, `-text`, `-bg`, `-border` (verde) | concluído / respondido / check |
| Apoio | `--info`, `-text`, `-bg`, `-border` (petróleo) | chamado aberto; eixo separado da saúde da dupla |
| Pausa | `--pausa`, `-text`, `-bg`, `-border` | pausada / concluída / neutro |

Regras:

- Token sem sufixo é preenchimento (ponto, segmento, ícone). Texto usa o par `-text`.
- Dupla **em dia** é neutra (sem cor de status). Mostre um check discreto ou nada; a cor fica para as exceções.
- Superfície de card sempre neutra. A cor de status mora no ponto, no pill ou no ícone.
- Proibido: borda lateral colorida em card, fundo tingido de card inteiro por status, e card dentro de card.

## Hierarquia e densidade

- **Título de seção** (`h2`): `text-base font-semibold` (seções grandes chegam a `sm:text-lg tracking-tight`).
- O estilo pequeno `text-[11px] uppercase tracking-[0.08em] text-muted-foreground` serve **só** como rótulo de grupo dentro de um card, nunca como título de seção.
- **Título de item não trunca.** O nome da dupla ou da pessoa quebra linha. Metadado pode truncar, com o texto íntegro em `title`.
- **No celular, conteúdo informativo tem no mínimo 12px** (`text-xs`). 10–11px só em badge ou contador puro, ou a partir de `sm:`.
- **Uma ação primária por contexto.** As secundárias são neutras (`variant="outline"`/`ghost`), e o resto vai para um menu ⋯.
- Nenhum ponto de decisão com mais de 4 opções visíveis sem agrupar.

## Copy

- pt-BR, clara e acolhedora; primeira pessoa do plural para a instituição ("A equipe da Realiza.vc…").
- Sem travessão (—) em texto visível novo ou editado. Use ponto, vírgula ou dois-pontos.
- Sem "(s)" e sem jargão interno: nada de "semáforo", "eixo", "estação", "janela" ou "pendência na janela". Use a linguagem do guia: encontro, registro, instrumento, combinado, apoio.
- A interface não explica a si mesma em texto fixo. Definição de regra vai para um popover "Como calculamos" ou para o onboarding.
- Botão diz a ação concreta: "Registrar 5º encontro", "Lembrar dupla", "Agendar". Nunca "Ver detalhes" quando há ação melhor.
- Ao mencionar a dupla ou o papel, use os termos que já existem no código (`papelLabel`, `src/lib/ciclo.ts`).

## Movimento (AGENTS.md → "Movimento")

- Entrada de lista e de card: `.animate-enter` com `--i` (stagger 0–10).
- Filtro, busca ou ordenação sempre animam (re-key no container).
- O guard global de `prefers-reduced-motion` já existe: não crie media query por componente.
- Transições só com `transform` e `opacity`, até 300ms. Easing: `ease-snappy`.
- Feedback pós-ação: toast existente (`sonner`) com o que aconteceu e por qual canal.

## Toque e mobile

- Alvo interativo: `min-h-11` (44px) no mobile, podendo reduzir a partir de `sm:`/`md:`.
- Input com `text-base` no mobile, para não disparar o zoom do iOS.
- Faixas de pills e abas rolam na horizontal (`overflow-x-auto`); nunca espremer.
- Validar mentalmente em 390px: sem rolagem horizontal.

## Limites técnicos

- Não alterar banco, migrations, RPCs, server actions nem Edge Functions. Se o design pedir um dado que não existe, pare essa parte e descreva o que faltaria.
- Os dados do modo demo (`src/lib/demo/`) precisam continuar funcionando. As telas são validadas por ele.
- Não rodar git, `nb push`, ssh, `next build` nem `next dev`, e não parar o servidor da porta 3100. A validação visual é feita pelo orquestrador.
- Ao terminar: `npx tsc --noEmit` e `npx eslint <arquivos editados>` limpos. Erros em arquivos de outro agente que trabalha em paralelo podem ser ignorados.
- Seguir o estilo do arquivo. Comentários curtos em pt-BR, só quando explicam o porquê.
