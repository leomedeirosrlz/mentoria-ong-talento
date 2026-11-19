# Auditoria — Relatórios (nov/2025)

Escopo: REALIZA-375, REALIZA-389, REALIZA-407 na branch `feat/relatorios-nov`.
Método: `.devin-ctx/jira.md` × código × e2e (`tests/e2e/app/relatorios.spec.ts`,
`tests/e2e/demo/relatorios.spec.ts`). Fora de escopo: REALIZA-379.

| Issue | Evidência | Status | O que faltava | Comentário sugerido no Jira |
| --- | --- | --- | --- | --- |
| **REALIZA-375** — grade livre é a página principal | `/relatorios` renderiza `RelatorioBuilder` sem tabstrip, com ação "Outros relatórios" → `/relatorios/operacionais`; `?aba=grade` volta a `/relatorios` e `?aba=<seção>` redireciona a `/relatorios/operacionais?aba=<seção>` preservando `?turma=`/`?cronograma=` (`page.tsx`); tabelas operacionais usam `RelatorioTabela` (mesma pele do canvas); `/api/export`, links públicos, digest e recorte intactos; e2e app cobre redirects e tabs. | **cumprido** | nada — código intocado nesta rodada | Grade livre é a página principal; os demais relatórios ficam atrás de "Outros relatórios". Deep links `?aba=` redirecionam preservando recorte; exports, links públicos e digest seguem iguais. |
| **REALIZA-389** — redesign visual dos operacionais | `SecaoAderencia` e `SecaoEncerramento` já seguiam resumo + fila `DuplaLinha` + tabela colapsada; Saúde e Adoção já visuais. Faltavam: assinaturas, interações, especialistas e formulários — todas só `RelatorioSecao` (dump de tabela). | **parcial → implementado** | as 4 seções restantes ganharam resumo (cards derivados das mesmas linhas do CSV), fila acionável com drill para a ficha (`/pessoas`, `/duplas`, `/formularios`) e prévia do export colapsada; `dados.ts` expõe `itens*` com os ids de drill-down em uma derivação só | Resumo + listas acionáveis estendidos a assinaturas, interações, especialistas e formulários, no mesmo padrão de aderência/encerramento. Tabela densa continua como prévia colapsada do CSV; `?turma=`, links públicos, digest e `/api/export` preservados. |
| **REALIZA-407** — staging/demo sem seções vazias | `src/lib/demo/*` já cobre todas as seções (assinaturas variadas, solicitações em todos os status, formulários, terceiros, saúde evergreen). `scripts/seed-demo-staging.mjs` só inseria ritos decididos (fila "Aguardando decisão" vazia), não semeava `terceiros_*` nem assinatura expirada. | **parcial → implementado** | seed agora insere 2 ritos pendentes (checklist parcial e completo) em duplas encerradas de desistentes, avaliação por terceiros completa na dupla âncora (3 respostas + consolidação publicada + 1 pendente + 1 expirado) e 1 assinatura expirada; cleanup já cobria o range | Staging agora mostra a fila "Aguardando decisão" de Encerramento, o painel de terceiros da ficha da dupla âncora e pendências/expirada em Assinaturas. Demo em memória já estava completa. |

## Observações

- O estado "Acumulando histórico" da aba Saúde é legítimo (só aparece sem
  snapshots) e permanece — em demo/staging a tendência aparece com dados.
- Nenhuma mudança de schema/RLS: a 407 é dado, a 389 é apresentação sobre
  os mesmos fetchers que o CSV usa (paridade literal com o export).
- Spec da mudança: `specs/003-relatorios-nov/spec.md`.
