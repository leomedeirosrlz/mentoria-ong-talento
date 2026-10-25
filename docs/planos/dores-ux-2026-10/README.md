# Dores de UI/UX — rodada out/2026 (pós-merge do PR #98)

> **Estado atual: ver [`STATUS.md`](STATUS.md)** — planos 01–06 implementados
> na cópia local, verificados (tsc, eslint, vitest, e2e demo 114/114),
> sem commit nem deploy.

Planos para corrigir as principais dores de interface da plataforma. A base
é um mapeamento do estado real, não uma opinião sobre mockups.

## Como foi levantado (25/out)

- **Versão analisada:** o `main` `b5684a8`, recompilado em produção local
  (`:3100`), modo demo. Os 435 arquivos de `src/` foram conferidos contra o
  remoto.
- **Escopo:** 72 páginas (5 papéis × 390px e 1280px + 3 públicas) e 7
  fluxos com clique.
- **Métricas de DOM:** rolagem horizontal, texto abaixo de 12px e alvos de
  toque.
- **Crítica `impeccable`** com duas avaliações independentes:
  - A: revisão de design pelo framework da casa (`.devin/skills/ux-review`)
    com as heurísticas de Nielsen;
  - B: detector automático do código + detector injetado em 5 páginas.
- **Cor:** contraste medido em todos os pares renderizados.

**Nota geral (Nielsen): 22/40, "aceitável".** O fundamento técnico é bom:
mobile-first, tokens com intenção, a home do mentor é um padrão excelente.
A dor real está em consistência entre telas (1/4) e excesso de informação
(1/4).

## Diagnóstico em uma frase

As últimas rodadas desenharam **tela por tela**, cada uma com o próprio
mockup. Cada tela ficou coerente sozinha, mas o produto não tem um
vocabulário comum. A mesma dupla aparece de quatro jeitos, a saúde do
programa dá três números diferentes, e a marca (amarelo, complementares)
quase não aparece porque o amarelo foi ocupado pelo alerta.

## Planos

| # | Plano | Natureza | Depende de |
|---|---|---|---|
| 02 | [Correções rápidas](02-correcoes-rapidas.md) | 7 bugs verificados no navegador, isolados | — |
| 01 | [Identidade e cor](01-identidade-cor.md) | tokens: papel por cor, status sem colidir com a marca, contraste | — |
| 03 | [Consistência e ruído](03-consistencia-e-ruido.md) | dupla canônica, resumo de saúde único, UI que não se explica, copy, títulos | 01 |
| 04 | [Homes por papel](04-homes-por-papel.md) | "o que fazer agora" para jovem, coordenação e supervisor | 01, 03 |
| 05 | [Ficha da dupla](05-ficha-da-dupla.md) | cabeçalho com uma ação, registro em sheet, abas | 01, 03 |
| 06 | [Navegação e páginas longas](06-navegacao-e-paginas-longas.md) | sidebar agrupada, `/registros`, `/materiais`, piso de texto no celular | 01 |

### Ordem recomendada

1. **02 primeiro.** É barato, pode ir já e remove os atritos mais
   visíveis:
   - o mentor cai no topo da ficha ao registrar;
   - Agenda e Pessoas somem da barra mobile;
   - `/pessoas` vaza para fora da tela;
   - a avaliação do jovem duplica título e aviso.
2. **01 em seguida**, com uma prévia visual aprovada antes de aplicar. Muda o
   significado das cores em telas já aprovadas.
3. **03**, porque cria os componentes que 04 e 05 consomem (`DuplaLinha`,
   resumo de saúde).
4. **04 e 05 em paralelo.** Os escopos de arquivo são disjuntos, exceto
   `mentor-home.tsx`: a sheet de registro (05) entra antes dos ajustes da
   home do mentor (04).
5. **06** pode correr em paralelo a partir do passo 2.

## Decisões pendentes com o Thiago

| # | Decisão | Recomendação | Plano |
|---|---|---|---|
| D1 | ✅ **Fechada (25/out): neutro com check**; cor só nas exceções | — | 01 |
| D2 | ✅ **Fechada (25/out): abas** (Agora / Encontros / Instrumentos / Pessoas) | — | 05 |
| D3 | Barra inferior mobile da coordenação: Chamados entra no lugar de Pessoas? | Início, Duplas, Agenda, Chamados | 02 |
| D4 | ✅ **Fechada (25/out): "precisam de você hoje"** | — | 03, 04 |
| D5 | Um termo único para o voluntário executivo: "Supervisão", "Auxiliar executivo" ou outro? | — (é vocabulário do programa) | 03 |
| D6 | "Como as pessoas próximas te veem" sai da home do jovem? | vai para a jornada | 04 |
| D7 | Avisos da coordenação: recolhidos na home ou página/drawer próprio? | recolhidos com contador | 04 |
| D8 | Zero cortado da Mitr em números: desligar via feature ou usar mono em dados densos? | testar a feature primeiro | 06 |

## Como medir (critérios de aceite)

- **Script:** `_medicao/mapa-metricas.cjs`, o mesmo usado no levantamento.
  Com o app em `:3100`, rodar `OUT=/tmp/realiza-mapa node
  docs/planos/dores-ux-2026-10/_medicao/mapa-metricas.cjs`. Ele gera
  screenshots e `metricas.json` (rolagem horizontal, texto <12px e alvos
  <44px por papel e rota).
- **Linha de base:** `_medicao/baseline-2026-10-25.json`. Comparar antes e
  depois por rota.
- **Ruído conhecido:** a contagem de alvos inclui campos ocultos 1×1 e o
  link "Pular pro conteúdo". Filtrar antes de comparar.
- **Detector:** `impeccable detect --json src/app src/components`. A linha de
  base é de 20 achados: `side-tab` 17, `border-accent-on-rounded` 2 e 1
  falso positivo (`materiais-hub.tsx:475`, comentário).
- **Gates de sempre:** `npx tsc --noEmit` + `npx eslint src/` + e2e da área
  verdes no staging + validação em 390px.

## Fora de escopo aqui

Banco de dados, IA (REALIZA-178/179/180) e modo dark (REALIZA-192). O dark
deve nascer da estrutura de tokens do plano 01.
