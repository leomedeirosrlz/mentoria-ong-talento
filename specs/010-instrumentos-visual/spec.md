# Spec — Instrumentos, modais e Roda da Vida

**Feature:** `specs/010-instrumentos-visual` · **Status:** Clarified
**Fila:** `REALIZA-511` · **Dono:** Thiago · **Data:** 23/11/2026

> O QUÊ e o POR QUÊ. Sem stack, sem DDL, sem nome de arquivo de implementação — isso é o `plan.md`.

## Problema e resultado

- **Dor hoje:** no desktop os modais de avaliação e de instrumentos ficam estreitos, com cartões e campos que parecem “default”; a Roda da Vida some no preview quando ainda não há resposta; o formulário da roda ainda usa número em bolinha amarela e texto verde, o hover do card não fecha a moldura e a descrição do instrumento é longa demais. O rótulo “Jornada” também não descreve o destino.
- **Resultado observável:** a pessoa abre um modal no desktop e usa a largura disponível; entende a roda mesmo sem resposta; lê a pergunta em texto neutro com o número no verde da marca; o card inteiro responde ao hover; a descrição cabe em uma leitura curta e o guia completo fica evidente.
- **Como saberemos que funcionou:** prints 1440×900 e 390×844 sem coluna ociosa, Roda vazia visível, nenhuma bolinha amarela no formulário, hover contornando o card inteiro e o menu do jovem dizendo “Materiais”.

## Fora de escopo

- Reestruturar o PDM (spec `011`) e as conquistas (spec `012`).
- Mudar o contrato de respostas, tokens ou RLS.
- Trocar a identidade visual global ou criar dark mode.

## Histórias de usuário

### US1 — Modal de desktop com largura útil (P1)

- **Por que P1:** é a superfície em que o mentor/coordenação passa mais tempo; a coluna de 448px desperdiça a tela.
- **Teste independente:** abrir “Avaliar encontro” em 1440×900 e medir o dialog; comparar com 390×844.
- **Cenários:**
  1. **Dado** o modal de avaliação aberto no desktop **quando** a viewport é ≥1024px **então** a largura é pelo menos 560px e os cartões usam a largura disponível, sem coluna vazia.
  2. **Dado** o mesmo modal no celular **quando** a viewport é 390px **então** ele continua em uma coluna, sem overflow horizontal.
  3. **Dado** um modal de confirmação curta **quando** aberto no desktop **então** ele pode continuar compacto; a largura maior é para formulário/leitura, não para toda caixa.

### US2 — Roda da Vida legível no formulário e no preview (P1)

- **Por que P1:** a roda é o instrumento de entrada e o preview vazio é o que o mentor usa para explicar a ferramenta.
- **Teste independente:** abrir a roda sem resposta na ficha do mentor e o formulário de resposta do jovem.
- **Cenários:**
  1. **Dado** um instrumento de Roda sem nenhuma resposta **quando** o mentor abre o preview **então** a roda vazia aparece, com eixos e estado “ainda sem resposta”.
  2. **Dado** o formulário de resposta **quando** a pessoa lê uma pergunta **então** o número aparece no verde da marca, sem disco/bolinha, e o texto da pergunta usa foreground.
  3. **Dado** a Roda preenchida **quando** aberta no desktop **então** o desenho tem altura confortável (não um selo de 96px) e os nomes das áreas continuam legíveis.
  4. **Dado** `prefers-reduced-motion` **quando** a roda anima **então** a transição é reduzida sem perder o estado.

### US3 — Card de instrumento inteiro como alvo (P2)

- **Por que P2:** o hover quebrado faz o card parecer dois componentes.
- **Teste independente:** passar o mouse no corpo e no rodapé “Ler o guia”.
- **Cenários:**
  1. **Dado** um card de instrumento **quando** o ponteiro entra em qualquer parte do card **então** o anel/contorno envolve o card inteiro, incluindo o rodapé.
  2. **Dado** foco por teclado **quando** o card recebe foco **então** o mesmo contorno aparece com `:focus-visible`.
  3. **Dado** um card trancado **quando** em hover **então** o contorno não promete uma ação que não existe.

### US4 — Descrição curta e guia completo evidente (P2)

- **Por que P2:** a descrição atual repete o guia e cansa antes da ação.
- **Teste independente:** abrir `/materiais/instrumentos/roda_inicial` e comparar a altura com o guia.
- **Cenários:**
  1. **Dado** a página de um instrumento **quando** aberta **então** a sinopse tem no máximo 3 parágrafos curtos e não replica a lista inteira do guia.
  2. **Dado** que a pessoa quer o detalhe **quando** termina a sinopse **então** “Ler o guia completo” é uma ação visual de primeira leitura, não um link perdido.
  3. **Dado** um instrumento sem guia nativo **quando** aberto **então** a sinopse usa a descrição canônica sem inventar link.

### US5 — “Materiais” no menu do jovem (P2)

- **Por que P2:** o destino é a página de materiais/instrumentos, não a jornada inteira.
- **Teste independente:** abrir o menu mobile e a sidebar desktop.
- **Cenários:**
  1. **Dado** o menu do jovem **quando** renderizado **então** o item de `/jovem/materiais` se chama “Materiais”.
  2. **Dado** a página aberta **quando** lida **então** título, subnav e “Meus instrumentos” usam a mesma decisão de vocabulário.

## Casos de borda

- Roda sem definição de escala (form editado): mantém o fallback pergunta a pergunta.
- Instrumento sem token, expirado ou já respondido: preview/rota não quebram.
- Texto longo de área/descrição: truncamento não esconde ação.
- Dark mode não existe; validar apenas os tokens atuais.
- Leitor de tela: a roda interativa continua com a lista de sliders como controle acessível.

## Requisitos funcionais

- **FR-001:** formulários e leituras de avaliação DEVEM usar largura de desktop maior que a confirmação curta, sem overflow no mobile.
- **FR-002:** o número da pergunta DEVE ser texto no verde da marca, sem disco amarelo; o enunciado DEVE usar foreground.
- **FR-003:** a Roda sem resposta DEVE renderizar uma moldura vazia no preview do mentor.
- **FR-004:** o preview da Roda DEVE ter altura mínima confortável no desktop.
- **FR-005:** o hover/focus do card DEVE contornar o card inteiro.
- **FR-006:** a descrição do instrumento DEVE ter sinopse curta e CTA “Ler o guia completo”.
- **FR-007:** o menu do jovem DEVE dizer “Materiais” e a página DEVE alinhar título/subnav.
- **FR-008:** nenhuma mudança pode alterar o contrato de resposta ou a ordem de campos.

## Requisitos não funcionais

- **RLS:** nenhuma policy nova; leitura/escrita existentes.
- **Auth:** nenhuma rota pública nova.
- **LGPD:** nenhum dado novo.
- **Demo:** os mesmos estados devem aparecer em `/demo` sem login.
- **A11y/perf:** teclado, foco, alvos ≥44px no mobile, sem animação obrigatória.

## Entidades e dados

Nenhuma entidade nova. A roda vazia usa a estrutura da definição do formulário; a sinopse usa o corpus nativo e um resumo canônico.

## Critérios de sucesso

- **SC-001:** prints de 1440px mostram modal ≥560px para avaliação/leitura sem coluna ociosa.
- **SC-002:** print da Roda vazia no preview e print do formulário sem bolinha amarela.
- **SC-003:** hover no rodapé do card mantém o mesmo anel do corpo.
- **SC-004:** teste e2e demo dos instrumentos continua verde.

## Premissas

- “Materiais” é o rótulo escolhido para o menu; “Meus instrumentos” continua sendo a seção.
- O preview vazio é o mesmo componente da roda preenchida, com notas nulas; não é uma ilustração estática.
- A largura maior não se aplica a diálogos de confirmação de uma linha.
