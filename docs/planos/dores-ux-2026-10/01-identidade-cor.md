# Plano 01 — Identidade visual e sistema de cor

> Fundação. Os planos 03 a 06 dependem deste: eles trocam a cor de status e
> de ação pelos tokens definidos aqui.

## Problema (medido em 25/out, `main` = `b5684a8`)

Tokens atuais em `src/app/globals.css:51-117`, convertidos para hex:

| Token | Valor | Hex | Matiz |
|---|---|---|---|
| `--brand-lime` / `--primary` | `hsl(78 56% 53%)` | `#A2CA44` | 78° |
| `--brand-ink` / `--foreground` | `hsl(0 0% 15%)` | `#262626` | — |
| `--ok` (em dia) | `hsl(78 58% 38%)` | `#779929` | **78°** |
| `--warn` (atenção) | `hsl(43 95% 44%)` | `#DB9E06` | **43°** |
| `--role-mentorado` | `hsl(48 100% 60%)` | `#FFD633` | 48° |
| `--danger` | `hsl(0 80% 48%)` | `#DC1818` | 0° |
| `--info` (apoio) | `hsl(207 82% 45%)` | `#157CD1` | 207° |

Marca: `#323232` (tinta), `#FFD531` (amarelo, 48°), `#A0C644` (lima, 78°).
Complementares: `#4CA9C2` 193°, `#91C868` 94°, `#F9D54E` 47°, `#592A56` 304°,
`#6DC6C6` 180°, `#F3AD42` 36°, `#1A4766` 204°.

Achados:

1. **Um matiz, dois significados (lima).** "Em dia" (`--ok`, 78°) tem o
   mesmo matiz da ação primária (`--primary`, 78°). Na `/duplas`, a barra
   verde de progresso, o botão "Nova dupla" e o pill "Em andamento" falam
   a mesma cor. O usuário não distingue "isto é clicável" de "isto está bem".
2. **Atenção colide com a marca (amarelo).** `--warn` (43°) está a 5° do
   amarelo da marca e do acento do jovem (48°). Por isso o amarelo da marca
   quase não aparece: qualquer amarelo vira "problema". Hoje o amarelo só
   existe no portal do jovem, e lá ele ao mesmo tempo é identidade e alerta.
3. **Tinta da marca não aplicada.** O texto é `#262626` e a marca pede
   `#323232`. Com `#323232` sobre branco o contraste é 12,82:1, folgado.
4. **Tokens de status usados como cor de texto com contraste insuficiente.**
   - `text-[var(--ok)]`: 13 usos, 3,30:1 sobre branco (texto pede 4,5:1).
     Arquivos incluem `src/app/(jovem)/jovem/materiais/page.tsx`,
     `copiar-chamada.tsx`, `encontro-detalhe-dialog.tsx` e
     `avaliacao-jovem-acoes.tsx`.
   - `text-[var(--warn)]`: 4 usos, 2,36:1, abaixo até dos 3:1 de ícone.
     Arquivos: `estrelas.tsx`, `avaliacao-encontro-form.tsx` e
     `trilha-fechamento.tsx`.
   - `text-[var(--brand-lime)]`: 6 usos, 1,97:1.
   - Os tokens `-text` já existem e passam (`--ok-text` 5,09:1,
     `--warn-text` 5,77:1). O problema é que não são usados nesses lugares.
5. **Complementares ociosas.** Só os instrumentos usam cores fora do trio,
   com valores próprios (`--inst-*`, `globals.css:110-117`) que não são as
   complementares da marca.

Pares que passam e podem ficar como estão: corpo em card 15,13:1; muted em
card 5,49:1; muted em fundo 4,97:1; texto no botão lima 8,69:1;
`#323232` em `#FFD531` 9,04:1; `#323232` em `#A0C644` 6,51:1.

Ponto proibido: branco sobre lima (1,90:1). Nunca usar texto branco em fundo
lima ou amarelo.

## Proposta

### 1. Um papel por cor (regra a registrar no AGENTS.md)

| Cor | Significa | Não significa |
|---|---|---|
| Tinta `#323232` | texto, superfícies escuras de destaque (header de card de dupla do mentor, item ativo da nav) | — |
| Lima `#A0C644` | **ação**: o único botão preenchido da tela, item ativo da nav, foco | "está tudo bem" |
| Amarelo `#FFD531` | **destaque positivo da marca**: o próximo passo, a jornada, celebração, o acento do jovem | alerta |
| Status | sempre com rótulo de texto, nunca só cor | decoração |

### 2. Status com matizes que não colidem com a marca

| Estado da dupla | Hoje | Proposta | Matiz | Motivo |
|---|---|---|---|---|
| Em risco | vermelho `#DC1818` | manter vermelho | 0° | crítico real |
| Atenção | âmbar `#DB9E06` (43°) | laranja derivado de `#F3AD42`, escurecido para preenchimento | ~30° | sai de perto do amarelo da marca (48°) |
| Em dia | lima escuro `#779929` (78°) | verde da complementar `#91C868` escurecido (~94–100°), ou neutro com ícone de check | ~95° | sai do matiz da ação |
| Apoio aberto | azul `#157CD1` | azul petróleo `#1A4766` / `#4CA9C2` da marca | ~200° | já é eixo separado; passa a ser cor da marca |
| Pausada / concluída | cinza | manter neutro | — | — |

**Decisão pendente com o Thiago (D1):** "em dia" ganha cor própria (verde
~95°) ou vira neutro, com cor só nas exceções? A diretriz da casa,
"superfície neutra, cor nos indicadores" (`docs/planos/feedback-ux-2026-10/README.md`),
puxa para neutro. Recomendo **neutro com check**: o vermelho e o laranja
ganham força justamente porque são minoria.

Validação obrigatória: os matizes finais de atenção (30°) e amarelo da marca
(48°) ficam a 18° um do outro, acima do limite de 15°. Medir lado a lado no
navegador antes de fechar.

### 3. Estrutura de tokens (sem trocar a notação)

O projeto usa `hsl()`. Manter `hsl()`: o objetivo é migrar papéis, não a
notação.

- **Primitivas** (nunca usadas em componente): `--lima-*`, `--amarelo-*`,
  `--tinta-*`, `--laranja-*`, `--petroleo-*`, `--vermelho-*`, `--neutro-*`.
  Cada rampa só com os degraus que algum papel consome.
- **Semânticas** (as únicas usadas em componente):
  - ação: `--acao`, `--acao-hover`, `--acao-texto`;
  - destaque: `--destaque` (amarelo), `--destaque-suave`;
  - cada status: `--status-<estado>` (preenchimento), `--status-<estado>-texto`
    (≥4,5:1 sobre card), `--status-<estado>-fundo` e
    `--status-<estado>-borda`.
- **Compatibilidade:** `--primary`, `--ok`, `--warn` e `--info` passam a
  apontar para as semânticas novas na mesma PR, para não quebrar os ~300
  usos de uma vez. Depois, uma varredura troca os usos diretos.
- **Instrumentos** (`--inst-*`): remapear para as complementares da marca.
  Exemplo: Roda da Vida em `#6DC6C6`, Visão em `#592A56`, Metas em
  `#F3AD42`, PDM em `#1A4766`. Cada um mantém o par fundo claro + traço,
  com contraste medido.

### 4. Varredura de contraste

- Trocar os 13 `text-[var(--ok)]`, os 4 `text-[var(--warn)]` e os 6
  `text-[var(--brand-lime)]` pelo token `-texto` do papel. Antes, classificar
  cada uso: se for ícone ao lado de texto, o mínimo é 3:1. Lima e `--warn`
  falham até nesse limite.
- Adicionar ao `AGENTS.md` (seção "Hierarquia de texto" → "Cor"): token de
  preenchimento nunca vira cor de texto.

### 5. Onde a marca aparece (dosagem)

O amarelo deixa de significar perigo e passa a ser usado de propósito em
poucos lugares:

- **Jovem:** cartão do próximo encontro e barra de progresso da jornada.
- **Mentor:** faixa "O que fazer agora" (hoje com borda âmbar, ou seja,
  um alerta, embora seja um próximo passo).
- **Coordenação:** só no estado "tudo em dia" do resumo (celebração
  discreta), nunca em lista.

O lima fica restrito a um botão preenchido por tela e ao item ativo da nav.
Hoje há telas com três ou mais elementos lima competindo, por exemplo
`/duplas`: "Nova dupla", "Chamar" em todas as linhas e as barras.

## Escopo de arquivos

- `src/app/globals.css` (tokens; bloco `:root`, linhas 51-117)
- `src/lib/ciclo.ts` (mapeamento estado → token)
- Componentes de status: `src/components/duplas-lista.tsx`,
  `numeros-semana.tsx`, `viz/donut.tsx`, `fila-acompanhar.tsx` e badges em
  `src/components/ui/badge.tsx`
- Usos de texto listados no item 4
- `AGENTS.md` (regra de papel por cor)

## Critérios de aceite

- [ ] Nenhum par de matizes entre ação, destaque e status a menos de 15° (lista medida no PR).
- [ ] Todo texto de status ≥4,5:1 sobre o fundo em que renderiza (medido no navegador, não só no CSS).
- [ ] `grep 'text-\[var(--(ok|warn|brand-lime))\]' src` = 0.
- [ ] Cada tela tem no máximo 1 botão preenchido em lima.
- [ ] Capturas antes/depois das 5 homes por papel (390px e 1280px) anexadas ao PR.
- [ ] `npx tsc --noEmit`, `npx eslint src/` e e2e da área verdes no staging.

## Riscos

- Mudar `--warn`, `--ok` e `--info` muda o significado visual de telas que o
  Thiago já aprovou: mostrar a comparação antes de aplicar.
- O modo dark (REALIZA-192) deve nascer desta estrutura de tokens, não da antiga.
