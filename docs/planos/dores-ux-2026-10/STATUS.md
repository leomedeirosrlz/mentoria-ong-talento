# Status da rodada de polimento — 25/out/2026

Cópia local `~/nb/realiza.vc`, a partir do `main` `b5684a8`. **Nada foi
commitado, sincronizado (`nb push`) nem deployado.**

## Resultado medido

Build de produção local (`:3100`), modo demo. Medição:
`_medicao/mapa-metricas.cjs`. Linha de base: `_medicao/baseline-2026-10-25.json`.

| Tela | Antes | Depois |
|---|---|---|
| Ficha da dupla (mentor, desktop) | 12.482px | 1.416px (aba "Agora") |
| Ficha da dupla (coordenação, celular) | 6.656px | 2.094px |
| Home da coordenação (celular) | 6.477px | 2.327px |
| Home da coordenação (desktop) | 3.541px | 1.590px |
| `/registros` (desktop) | 11.842px | 1.821px |
| `/materiais` coordenação (desktop) | 4.100px | 1.193px |
| Home do mentor (celular) | 4.157px | 2.447px |
| Home do jovem (celular) | 4.734px | 2.851px |
| `/jovem/especialistas` (celular) | 5.444px | 4.946px |

Medidas gerais nas 72 páginas (5 papéis × 390px/1280px + 3 públicas):

| Medida | Antes | Depois |
|---|---|---|
| Texto abaixo de 12px (soma) | 2.769 | 1.397 |
| Páginas com rolagem horizontal | 1 (`/pessoas`, 220px) | 0 |
| Erros de JS | 0 | 0 |
| Travessões fora de comentário (`src/**/*.tsx`) | 487 | ~70, quase todos marcadores de valor vazio em célula (permitido) |

O texto pequeno que restou é, na maior parte, exceção prevista no
`AGENTS.md`: numerais da jornada, eixos de gráfico, rótulos da barra
inferior e pills de status.

**Números consistentes:** home, `/duplas`, `/agenda` e `/registros` mostram a
mesma situação das duplas na demo (10 em andamento · 1 em risco · 6 em atenção
· 3 em dia · 2 com apoio). Antes, cada tela mostrava 10, 14 ou 8.

## Verificação

- `npx tsc --noEmit` e `npx eslint src/ tests/`: limpos.
- `npx vitest run`: 914 passando, 1 skipped (era 915; saiu o teste do componente Donut, removido).
- **e2e demo contra o build local: 114/114 passando.** 39 specs foram
  atualizadas por mudança intencional de interface ou copy, com os testes
  reescritos para proteger o comportamento novo, não enfraquecidos. As
  instâncias que atualizaram as specs não acharam regressão e encontraram 1
  bug antigo na própria spec: `instrumentos.spec.ts` usava um id de dupla
  inexistente e passava sem verificar nada.
- **e2e app (staging) NÃO executado:** exige credenciais e o deploy de
  staging. As specs foram atualizadas por leitura do código e compilam. Rodar
  no staging antes do merge.

## O que mudou, por plano

- **02 Correções rápidas:** registrar encontro rola até o formulário e foca o
  primeiro campo; `/pessoas` sem vazamento; avaliação com um título só; barra
  mobile (Início, Duplas, Pessoas, Agenda e Mais, com ponto quando há chamado
  na fila); pedido de ajuda avisa "Seu mentor não vê este pedido" e o prazo
  ficou unificado. Os alvos de toque (Q4) já estavam no `main`.
- **01 Cor:** paleta da marca nos tokens (`#323232`, `#A0C644`, `#FFD531`);
  atenção em laranja (30°), longe do amarelo da marca; "feito" em verde (105°),
  longe do lima de ação; apoio em petróleo da marca; instrumentos nas cores
  complementares; contraste medido em todos os pares.
- **03 Consistência:** `DuplaLinha` e `SaudePrograma`/`saudeDoRecorte` como fonte
  única; regra Lembrar/Chamar em `src/lib/acao-lembrete.ts`; chips de filtro
  com popover "Como calculamos"; ~40 títulos de seção corrigidos; textos
  explicativos fixos removidos; jargão e travessões fora da copy, inclusive
  nas strings geradas em `src/lib`.
- **04 Homes:** jovem (próximo encontro em destaque, "Para fazer agora",
  avaliações rotuladas por pessoa, privacidade de fonte única); coordenação e
  supervisão ("Precisa de você hoje", com até 5 itens, mais a situação e a
  semana; avisos e pedidos recolhidos); mentor (ciclos concluídos separados,
  sem card dentro de card, termo depois da primeira dupla).
- **05 Ficha:** abas por URL (Agora / Encontros / Instrumentos / Pessoas),
  cabeçalho com uma ação contextual e "Remanejar" no menu ⋯. O deep link
  `#registrar-<id>` continua funcionando.
- **06 Navegação e páginas longas:** sidebar agrupada (Acompanhar / Programa /
  Dados) e com rolagem; pílula da demo fixa na sidebar, sem cobrir conteúdo;
  `/registros` em mestre-detalhe (`?r=`); `/materiais` em abas, com faixas de
  encontros vazios agrupadas; piso de 12px no celular.
- **Extra:** a regressão do HANDOFF ("Enviar em lote" sumido para o perfil
  híbrido supervisor + coordenação) foi corrigida; trilhas de especialista do
  jovem compactas, com linha do tempo vertical no celular.
- **`AGENTS.md`:** nova seção "Padrões de interface" e regras de título de
  seção e de piso de texto no celular.

Arquivos: 204 modificados, 14 novos, 1 removido (`src/components/viz/donut.tsx`).

## Depende do Thiago

1. **Commit, sincronização e deploy.** Fluxo do projeto: `nb push`, commit no
   remoto com a identidade `thisux1`, PR, e2e app no staging e só então
   produção. Nada disso foi feito.
2. ~~Urgência no pedido de ajuda (Q7, parte de servidor).~~ **Descartado pelo
   Thiago em 25/out:** "É urgente" continua como uma das opções do pedido. A
   parte de interface do Q7 (aviso "Seu mentor não vê este pedido" e prazo
   unificado) foi feita.
3. **Jira (Q5).** REALIZA-194 a 203 já estão no `main`, mas continuam como
   pendentes. Esta rodada também cobre REALIZA-157, 174, 175, 176, 177
   (parcial), 192 (só a base de tokens) e 193.
4. **Decisões ainda abertas:** D3 (Chamados entre os 4 itens da barra mobile,
   no lugar de Pessoas? hoje Chamados fica no "Mais", com ponto indicador); D5
   (termo único para o voluntário executivo; hoje a interface usa "sup." e
   "Auxiliar executivo"); D8 (zero cortado da Mitr em números).
5. **Registros antigos com travessão.** `motivoRemanejo` e `motivoSaida` gravam
   texto no banco: os registros novos saem sem travessão, os antigos mantêm.

## Débitos conhecidos (não bloqueiam)

- `src/lib/registros.ts` ainda calcula `donut` (`PanoramaDonut`), sem uso na
  tela; os testes cobrem esse cálculo.
- "Ver todas" da home da coordenação leva a `/duplas` sem filtro, porque
  `/duplas` não lê filtros da URL.
- O mapeamento das linhas da fila está repetido entre `dashboard-coordenacao.tsx`
  e `agenda-coordenacao.tsx` (a regra é a mesma, na lib); a agenda do
  supervisor tem um terceiro caso parecido (`casoLembreteAux`).
- `/jovem/especialistas` ainda abre com três caixas explicativas ("pedir uma
  trilha / agendar / apoio") antes das trilhas.
- Avisos do jovem: sem estado "lido" no banco; a home usa a prioridade para
  decidir o que fica à vista.
