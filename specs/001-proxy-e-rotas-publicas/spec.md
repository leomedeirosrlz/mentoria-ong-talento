# Spec — proxy e rotas públicas

**Feature:** `specs/001-proxy-e-rotas-publicas` · **Tipo:** as-built · **Status:** Delivered
**Origem:** spec de regressão (18/nov/2026) — congela o contrato do que já existe para que mudança futura seja intencional, não acidental.

## Problema e resultado

O programa depende de superfícies sem login: links de instrumento (`/f`), convite de terceiros (`/t`), avaliação (`/avaliar`), assinatura do responsável (`/assinar`), resumo da turma (`/resumo`), o cron da Vercel (`/api/jobs/*`) e o servidor MCP (`/api/mcp`). Cada link já circula por WhatsApp e e-mail — a assinatura que abre hoje tem que abrir daqui a um ano.

**Resultado:** quem não tem sessão chega exatamente onde o link promete; quem não deveria chegar, recebe 401/403 JSON ou login — nunca redirect para rota que não existe.

## Fora de escopo

Política de expiração/rotação de tokens já emitidos; CSP detalhada (mora no `next.config.ts` e é revisada com o artigo A4 da constituição).

## Requisitos funcionais (contrato congelado)

- **FR-001:** as rotas sem sessão são **exatamente** as declaradas em `isPublic` (`src/lib/supabase/middleware.ts`): `/login`, `/auth/*`, `/demo*`, `/assinar/*`, `/api/assinar-token/*`, `/f/*`, `/t/*`, `/avaliar/*`, `/resumo/*`, `/api/jobs/*`, `/api/mcp`, `/privacidade`. Entrada ou saída é mudança de contrato com spec própria.
- **FR-002:** rota interna sem sessão devolve 307 para `/login?next=<destino codificado>` (path + query preservados).
- **FR-003:** logado em `/login` só aceita `next` interno (`/x`); absoluto (`//host`) cai em `/`.
- **FR-004:** o matcher do proxy exclui assets (`_next/static`, `_next/image`), ícones/arquivos estáticos, metadata gerada (`opengraph-image`, `sitemap.xml`, `llms.txt`, `robots.txt`, `manifest.webmanifest`) e o tunnel do Sentry (`/monitoring`).
- **FR-005:** `/api/jobs/*` sem `CRON_SECRET` responde 503; bearer errado responde 401 **JSON** — nunca redirect.
- **FR-006:** `/api/mcp` autentica por PAT (`rlz_*`); sem/inválido → 401 JSON; sem papel → 403. Nunca redirect.
- **FR-007:** `anon` não tem grant de tabela; todo acesso público é por RPC `security definer` com token de posse.
- **FR-008:** formato de token por porta: formulários/terceiros/avaliação 32 chars base64url; relatório 24 chars; assinatura UUID v4. Unificar formato invalida links em circulação — fora de escopo sem spec.

## Casos de borda

- Token inválido/expirado/queimado: comportamento definido por porta (página própria ou JSON), nunca 500.
- Rota pública aninhada em rota privada (`/f/<token>/opengraph-image`): passa direto pelo matcher (preview de WhatsApp funciona).
- Crawler em metadata sem sessão: recebe o conteúdo, não redirect.

## Verificação (proteção ativa)

- `tests/middleware-publico.test.ts` — FR-001/002/003.
- `tests/proxy-matcher.test.ts` — FR-004.
- `tests/jobs-registry.test.ts` — aut do cron (FR-005, rota).
- E2e por porta: `tests/e2e/app/{formularios,terceiros,avaliacao,resumo,assinatura}.spec.ts` + `mcp.spec.ts` (FR-006/007/008, caminho real).

## Premissas

- Modo demo (`cookie demo_role`) é bypass anterior à auth e não faz parte deste contrato.
- A lista de jobs do tick e do `vercel.json` é travada em `tests/jobs-registry.test.ts`.
