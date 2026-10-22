# Review consolidada — persona QA/E2E (51 pastas com acceptance.md)

Agente 0c947818. Base: inventário real de `tests/e2e/` (17 specs demo read-only,
20 app com writes, `workers:1` ~14/25min) + `ops-mapa.md` §e2e.

**Vereditos: 38 APROVADO · 13 COM-AJUSTES (16, 20, 39, 49, 68, 98, 143, 144, 157, 172, 173, 174, 175) · 0 REPROVADO.**

## Cobertura real verificada

- Públicos cobertos: `/f` (`demo/instrumentos.spec.ts:117-139`), `/avaliar` (`app/avaliacao.spec.ts`), `/t` (`app/terceiros.spec.ts`).
- **Zero cobertura hoje**: `/assinar`, `/resumo`, `/duplas` lista, `/pessoas` lista, `/registros`, `/formularios/[id]` (só toques indiretos).
- `demoAssinaturaPorToken` hardcoda `identidade:"anon"` (`demo/queries.ts:1681`) — 172 item 5 exige estender o stub (plano já cobre).
- Deps ausentes: `axe-core`/`@axe-core/playwright`, `msw`.
- Specs citados que não existem: 98 `especialista.spec.ts` (real: `especialista-agenda.spec.ts`/`solicitacao-esp.spec.ts`); 174 "specs demo de duplas" (só `hibrido.spec.ts:83` toca `/duplas`); 68 "export.spec.ts se existir" — não existe.
- Convenção NOVA `/api/jobs/*`+`CRON_SECRET`+`vercel.json` assumida por 168/169/178/182 — quem mergear 1º define o helper comum (evitar duplicação divergente).
- Pressão de runtime: serial, ~14min de 25min; specs novas anunciadas somam minutos — monitorar no item 12 da 166.

## Ajustes por issue (só COM-AJUSTES)

- **16** — `/f` público sem spec proposta: estender spec app (submit real) ou marcar cobertura existente; critérios condicionais "se adotado" travam A/B no sdd; demo fixture órfã→vinculada ou "demo não afetado".
- **20** — rascunho sem spec nomeado: criar `app/f-rascunho.spec.ts` (write real; `jovem.spec.ts:380` já planta `rascunho:/f/`); offline via `context.setOffline`; dois tabs com dois `page`s; "a verificar se RPC checa status da dupla" resolve no sdd.
- **39** — `/pessoas` sem spec demo: criar `demo/pessoas.spec.ts` (chips+contadores, read-only, roda até em prod).
- **49** — propor `demo/formularios.spec.ts` ou justificar ausência; borda: mesma pessoa em 2 links → 2 linhas? (declarar).
- **68** — escolher: criar spec com `waitForEvent('download')` (demo-safe, sem write) ou fechar unit+manual.
- **98** — corrigir nome do spec no gate (`solicitacao-esp.spec.ts`); incluir a query de conferência no plan.
- **143** — estender `demo/instrumentos.spec.ts` com viewport ≥1280 assertando 16 labels; `axe` não é dep — adicionar ou checklist manual.
- **144** — itens 1-5 sem escrita → spec `demo/` cobre nav/pill/reduced-motion (spec app só pro submit); `beforeunload` flaky → manual ou marker via `page.evaluate`; bordas: duplo submit, Back mid-wizard, token expirado entre etapas.
- **157** — "specs verdes" não prova o fix: assert positivo (largura do item = popup; `toBeFocused()` no trigger).
- **172** — gate "e2e demo" mas item 6 é write app-side — espelhar "demo+app onde aplicável"; fixture `outra_pessoa` e `terceiros_contatos` expirado declarados.
- **173** — criar `demo/materiais.spec.ts`; "≤5s" → assert estrutural (badges por tom vs dataset); cobertura do seed demo resolver no PR.
- **174** — nomear `demo/duplas.spec.ts` a criar; asserts de densidade (`boundingBox` 52-60px, truncate+title).
- **175** — `/registros` sem spec em projeto nenhum: `demo/registros.spec.ts` + app se writes; borda `?grupo=<lixo>`→fallback.

## Notas nas APROVADAS (cobrar no PR)

138 (`sairDaDemo`/`limparDemo` são server actions, não helpers de spec), 153/154 (nomear spec da ficha), 159 (nomear spec demo do item 6), 166 (gate de runtime vira alarme natural), 167 (`/resumo` slug→200/404 caberia em spec app barato), 168 (tornar `lembrete-registro.spec.ts` obrigatório; fixture demo `registro_pendente`), 169 (fixture demo `trilha_prazo`+sino), 170 (confirmar Sentry no fail-open), 176 (assert "primeiro h2=Para acompanhar"), 178/179/180 (provider-mock sem mecanismo no preview Vercel: rota de teste ou restringir asserts provider-dependentes ao `backend=local`; 179 validador de PII queryable ILIKE vs nomes de fixtures), 181 (confirmar dupla do fixture com PDM ou criar no spec), 182 (item 18 é verificação cross-issue da 56), 183 (declarar onde o validador REST roda no CI).

Padrão a reforçar: specs app novos citam convenção `convergirPiso`; asserts pós-write `{timeout:15_000}`.
