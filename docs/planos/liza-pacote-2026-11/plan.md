# Plano de execução — Pacote Liza nov/2026

Decisões no `sdd.md` do mesmo diretório. Ordem respeita dependências
(telemetria antes do dashboard; segurança antes de qualquer exposição nova).
Cada fase fecha com `tsc --noEmit` + `eslint` + vitest relevante + verificação
funcional no server local (staging, `:3000`).

## Fase 0 — Segurança (auditoria, achados altos+médios)

- [ ] Migration `0159_ia_guard_rails.sql`:
  - `registrar_ia_evento`: `p_profile_id` só honrado com `auth.jwt()->>'role'='service_role'` (D2)
  - `consumir_limite_ia()`: advisory lock + insert + count atômico (D3)
  - `ia_mcp_tokens.expira_em` + enforce em `ia_mcp_autorizar` + revoke public/anon (D2)
  - colunas de telemetria em `ia_eventos` + extensão da RPC (D4 — antecipa fase 1 numa migration só)
- [ ] `src/lib/ia/impersonar.ts` + rewire `mcp/route.ts` → tools com JWT do dono do PAT (D1)
- [ ] `rate-limit.ts` + `chat/route.ts` → `consumir_limite_ia` antes do stream (D3)
- [ ] `queries.ts`: sanitização do termo `.or()` (D3)
- [ ] `provider.ts`: `max_tokens` no body (D3)
- [ ] `prompts.ts`: tool output = dado não-confiável (D3)
- [ ] `tools.ts`: audit args `{n,hash12}` pra pergunta/nome (D3)
- [ ] `assistente-conversa.tsx`: TTL 30d em `assistente:conversas` (D3)
- [ ] Testes novos: forge p_profile_id negado, limite atômico, impersonation client (mock auth), sanitização or()
- [ ] Verificação local: MCP com PAT de supervisor só enxerga escopo dele; forge via REST falha; burst de requests respeita limite

## Fase 1 — Telemetria de modelo

- [ ] `provider.ts`: `stream_options.include_usage` + parse usage (stream + JSON) + `{modelo,usage}` no resultado (D4)
- [ ] `chat/route.ts`: evento-resumo `mensagem` com modelo efetivo, tier, tokens, custo/allowance, iteracoes, duracao_ms, request_id correlacionando tools (D4)
- [ ] Testes: parser de usage no chunk final SSE; evento agrega N rodadas

## Fase 2 — Dashboard `/ia` (coord-only)

- [ ] `src/app/(app)/ia/page.tsx` + queries (`src/lib/ia/dashboard.ts` ou queries.ts) (D5)
- [ ] Aba Uso: KPIs + séries por dia + quebra papel/modelo/tier + filtros `?periodo=&papel=&modelo=`
- [ ] Aba Saúde: catálogo + probe via `/api/ia/modelos`
- [ ] NAV grupo Dados, roles coordenacao; branch demo
- [ ] Verificação local: números batem com ia_eventos; não-coord redireciona

## Fase 3 — Tools mentorado + GenUI + mount

- [ ] `minha_dupla`, `minha_agenda`, `meu_progresso`, `meus_combinados`, `ajuda_faq` (D6)
- [ ] Cards novos `jornada` + `combinados` em assistente-cards/ui.ts; reusa `dupla`/`agenda`/`fontes`
- [ ] Bolha no `JovemShell` atrás de `IA_BOLHA` (flag continua gating)
- [ ] Testes: ctx.papel=mentorado resolve dupla sem id; escopo não vaza
- [ ] Verificação local: login jovem-e2e → bolha abre → pergunta responde com dados próprios

## Fase 4 — Markdown + stream (D7)

- [ ] Parser: `##`/`###`, `>`, `---`, fence `nota`
- [ ] Prompt: formatação liberada com diretrizes (bold em pontos-chave etc.)
- [ ] Fila de stream com cadência adaptativa + cursor; flush no done
- [ ] Verificação local: resposta com heading/quote/nota renderiza; stream sai suave

## Fase 5 — Evals (D8)

- [ ] `tests/evals/casos.json` + `scripts/eval-ia.mjs` (contrato + live opt-in)
- [ ] Rodada de validação no server local

## Fechamento

- [ ] Revisão por subagents (tech-lead + segurança) do diff total
- [ ] `tsc` + `eslint` + vitest full + browser walkthrough final
- [ ] NADA de push sem autorização explícita do Thiago
