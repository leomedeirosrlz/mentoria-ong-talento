# REALIZA-299 — Roteador de modelo por papel, tarefa e complexidade

Issue: `ia`,`modelo`. Fonte: batch REALIZA-290–297 sobre o plano `ia-chatbot-mcp.md`. Status: a fazer.

## O que exige vs. o que existe

A issue pedia um `model-router.ts` novo com envs `IA_MODEL_LEVE/MEDIO/FORTE` e coluna `modelo`. **A maior parte já existe com outros nomes** — verificado no staging:

- `src/lib/ia/roteador.ts` **já é o roteador**: `rotearTier(pergunta, {posTool})` (:24-45) classifica deterministicamente em `rapido`/`balanceado`/`forte` (`TierModelo` :8) por formato da mensagem — `SAUDACAO` (:10), `DOMINIO` (:15) e `PADRAO_COMPLEXO` (:18); pós-tool tem piso `balanceado` (:31). Sem chamada de rede, sem LLM juiz (comentário :1-6). **Não recebe papel nem tarefa.**
- `src/lib/ia/config.ts`: `modeloDoTier` (:259-262) resolve `cfg.modelos[tier] ?? process.env.IA_MODEL`; `fallbacksDoTier` (:270-274) lê `cfg.modelos.fallbacks` (lista ou mapa por tier); `esforcoDoTier` (:265). Fonte = tabela `ia_config` (0148), editável pela coord na bolha, lida por qualquer autenticado, seed com 3 slugs + `roteamento: true`.
- `/api/ia/chat/route.ts:179-199`: `tier = iaCfg.roteamento ? rotearTier(ultimaPergunta) : "balanceado"`; `chamada = {modelo: modeloDoTier, esforco, fallbacks}`; tier `rapido` sai **sem tools** (:198); eval override por header (:184-192).
- Provider (`src/lib/ia/provider.ts`) já caminha a cadeia `fallbacks` em erro transitório/404/400-modelo-indisponível e só faz fallback de stream antes do primeiro byte útil.
- `ia_eventos` **já tem `modelo` e `tier`** (0159:21-23) + tokens/cache/custo; `registrar_ia_evento` aceita `p_modelo`/`p_tier` (:46-81). O evento `resposta` grava o slug real usado pós-fallback.

**Gaps reais**: roteador cego a papel e a tarefa (mentorado pedindo "meu progresso" e coord pedindo "análise do semáforo" caem na mesma heurística); sem envs por tier (config vazia cai tudo em `IA_MODEL` único); `fallbacks` vazio na seed → tier forte **sem fallback** (a issue pede forte→médio garantido).

## Decisões

- **Estender `roteador.ts`, não criar `model-router.ts`.** Um roteador só: o nome pedido na issue é descritivo, o módulo atual já cumpre o papel e tem testes (`roteador.test.ts`). Nova assinatura:
  ```ts
  rotearTier(pergunta: string, opts: {
    posTool?: boolean;
    papel?: Papel | null;
    tarefa?: TarefaIa;
  }): TierModelo
  ```
  Alternativa rejeitada: arquivo paralelo `model-router.ts` chamando o roteador — dupla fonte de verdade pro mesmo conceito.
- **`TarefaIa` concreta e determinística** — enum derivado no caller, sem classificador LLM (rejeitado: latência no caminho crítico + PII pra um modelo extra):
  | tarefa | origem |
  |---|---|
  | `saudacao` | `SAUDACAO`/mensagem curta fora de domínio (regra atual) |
  | `leitura` | pergunta de dados sem padrão analítico — default |
  | `analise` | `PADRAO_COMPLEXO` ou msg > 300 chars (regra atual) |
  | `sintese` | rodada pós-tool-call (`posTool`) |
- **Regras de roteamento (papel × tarefa)** — tabela completa, determinística:
  | papel | saudacao | leitura | analise | sintese |
  |---|---|---|---|---|
  | coordenacao | rapido | balanceado | **forte** | balanceado |
  | supervisor | rapido | balanceado | **forte** | balanceado |
  | mentor_dpp / mentor_especialista | rapido | balanceado | balanceado* | balanceado |
  | mentorado | rapido | balanceado | balanceado* | balanceado |
  | *cap*: não-staff nunca sobe a `forte` — o escopo deles é a própria dupla; `forte` só pagaria latência/custo sem dados pra sintetizar. `PADRAO_COMPLEXO` de mentor/jovem cai no `balanceado`, não no `forte`.
- **Envs por tier degrau abaixo da config, acima do `IA_MODEL` único** — precedência em `modeloDoTier`: `cfg.modelos[tier]` → `IA_MODEL_LEVE`/`IA_MODEL_MEDIO`/`IA_MODEL_FORTE` (mapa `rapido→LEVE`, `balanceado→MEDIO`, `forte→FORTE`) → `IA_MODEL`. Preserva a config viva da coord (primazia) e entrega o contrato de env da issue. Alternativa rejeitada: env > config — tiraria o ajuste quente que a `ia_config` existe pra dar.
- **Fallback implícito forte→médio**: `fallbacksDoTier(cfg, "forte")` passa a devolver `[...fallbacksConfigurados, modeloDoTier(cfg,"balanceado")]` deduplicado — mesmo quando `modelos.fallbacks` está vazio (estado atual da seed), o forte degrada pro médio em vez de falhar. Só o forte ganha o degrau implícito — `balanceado`→`rapido` degradaria qualidade de síntese sem ganho real. Regra mora em `config.ts`, não na rota, pra valer em qualquer caller.
- **Auditoria do roteador sem coluna nova**: o evento `mensagem`/`resposta` passa a carregar `args.roteador = {tier, tarefa, papel}` no jsonb já existente — motivo da escolha fica auditável sem DDL. `modelo`/`tier` seguem nas colunas da 0159.
- **`papeis` pra `executarTool` não muda**: o filtro de tools anunciadas (:198) continua `tier === "rapido" ? [] : papeis` — papel não altera quais tools o modelo vê (já é por `roles`); altera só o teto de modelo.

## Schema

**Nenhuma.** `ia_eventos.modelo`+`tier` vieram na 0159 — a "coluna com migration" da issue já está entregue; a spec só a registra. `ia_config` é chave/valor — `modelos.fallbacks` se precisar, via UI da coord, sem DDL.

## Domínio (src/lib/)

- `src/lib/ia/roteador.ts` — assinatura nova (`papel`, `tarefa`); a matriz acima vira a implementação. `PADRAO_COMPLEXO`/`SAUDACAO`/`DOMINIO` permanecem.
- `src/lib/ia/config.ts` — `modeloDoTier` ganha o degrau de env por tier; `fallbacksDoTier` ganha o degrau implícito forte→médio.
- `src/app/api/ia/chat/route.ts` — passa `papel`/`papeis` e `tarefa` derivada ao `rotearTier`; injeta `roteador` no `args` dos eventos.
- `src/lib/ia/mcp-prompt.ts` — sem mudança (MCP não roteia modelo; tools rodam sob o caller).

## UI

- `assistente-config.tsx`: a grade de modelos por tier pode ganhar hint dos envs default (`IA_MODEL_*`) quando `modelos[tier]` vazio — mostra o slug efetivo atual. Opcional, melhora honestidade da tela.

## Seed + demo

- `seed.sql`/`ia_config` de staging pode ganhar `modelos.fallbacks` explícito só se o tuning pedir — o degrau implícito forte→médio já cobre o contrato sem seed nova.
- Demo não chama provider — nada a fazer.

## Testes

- `src/lib/ia/roteador.test.ts` (estender): matriz completa — mentor com `PADRAO_COMPLEXO` → `balanceado` (não forte); coord idem → `forte`; jovem "oi" → `rapido`; `posTool` → `balanceado` em qualquer papel.
- `tests/` config: `modeloDoTier` com cfg vazia + `IA_MODEL_MEDIO` setado → usa o env; cfg setada → cfg vence; `fallbacksDoTier("forte")` com lista vazia → contém o médio; com lista explícita → appended médio por último, sem duplicar.
- `tests/ia-route.test.ts`: evento `resposta`/`mensagem` grava `modelo`, `tier` e `args.roteador` coerentes com a pergunta.

## Critérios de aceite

- [ ] `rotearTier` aceita `papel` e `tarefa`; a matriz papel×tarefa da spec é a implementada — mentor/jovem nunca recebe `forte`.
- [ ] `IA_MODEL_LEVE`/`IA_MODEL_MEDIO`/`IA_MODEL_FORTE` funcionam como default por tier quando `ia_config.modelos` não define o slug; a config continua tendo precedência.
- [ ] Tier `forte` sempre tem cadeia ≥2 (primário → … → médio) mesmo com `fallbacks` vazio — falha transitória/404 do forte cai no médio sem erro ao usuário.
- [ ] `ia_eventos` registra `modelo` (slug real pós-fallback), `tier` e `args.roteador` {tier,tarefa,papel} por mensagem — verificável via service-role no e2e.
- [ ] Nenhum classificador LLM no caminho do roteador — 100% determinístico, sem chamada de rede.
- [ ] Tier `rapido` continua sem tools anunciadas; `posTool` continua com piso `balanceado`.
- [ ] Roteador desligado na config (`roteamento:false`) segue caindo em `balanceado` pra todos.

## Fora de escopo

- Cache/roteamento semântico por embeddings ou LLM-juiz — explícitamente rejeitado (latência + PII); revisitar só com evidência de misclassificação medida nos `ia_eventos`.
- Tier por canal (chat × MCP) — MCP não gera texto, só tools; a decisão não se aplica.
- Rebalanceamento de slugs na seed (`glm-5.3-flash`/`deepseek-*`) — tuning é da coord via `ia_config`.
- Streaming-fallback no meio do stream — provider já cobre o caso pre-bytes; fora desta spec.
