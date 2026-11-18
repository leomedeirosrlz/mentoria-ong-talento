# Constituição — Realiza.vc

**Versão:** 1.0.0 · **Ratificada:** 18/nov/2026 · **Última emenda:** 18/nov/2026
**Emenda:** via `/speckit-constitution`. MAJOR = princípio removido ou invertido; MINOR = artigo novo; PATCH = clareza.
**Durabilidade:** esta constituição não contém contagem de testes, número de migration, ref de projeto, conteúdo de `.env` nem estado de sprint. Se um número muda a cada PR, ele não mora aqui.

## Escopo e precedência

Produto: painel operacional do Programa de Mentoria Social do Instituto Realiza.vc — duplas, encontros, registros, instrumentos, documentos, relatórios e a assistente Liza.

Fonte do domínio: os guias oficiais em `docs/fontes/`. Em conflito entre guia e código, o guia vence; o código é corrigido.

Em conflito documental, vale o nível mais alto:

1. esta constituição;
2. `AGENTS.md` (contrato operacional);
3. `docs/convencoes/*` (implementação por superfície);
4. `specs/<NNN>-<slug>/spec.md` (intenção daquela mudança);
5. `BACKLOG.md` (fila);
6. `README.md` e `docs/` (visão humana e histórico).

Níveis de baixo não contradizem os de cima. Quem muda uma regra corrige o nível superior **na mesma PR**.

## A1 — SLC, não MVP

Toda entrega é uma fatia vertical completa e polida: sem placeholder, stub, tela morta, botão que não faz nada ou "depois a gente melhora". Uma feature só conta como pronta quando funciona no fluxo real, com estados vazio/erro/carregando resolvidos.
**Verificação:** checklist de aceite da spec + revisão humana. Placeholder visível reprova, mesmo com teste verde.

## A2 — Autorização mora no banco (RLS-first)

Leitura e escrita são escopadas por RLS (`my_role()` / `my_profile_id()`). Nenhuma tela, server action ou tool de IA é a única barreira: se a regra não está no banco, ela não existe. Escrita sensível (delete, encerramento, handoff, avaliação, assinatura) passa por RPC `security definer` auditável.
**Verificação:** matriz papel × operação no plano da spec + caso e2e do papel negado para toda policy/RPC nova.

## A3 — Escritas previsíveis, domínio puro

Server action retorna `{ ok }` ou `{ error }` com mensagem em pt-BR; nunca lança. Leitura server-side usa `React.cache` + `auth.getClaims()`. Regra de domínio (semáforo, jornada, datas, enums) vive em módulo puro (`src/lib/ciclo.ts` e vizinhos) e não importa Next nem Supabase — é o que os testes e a demo consomem.
**Verificação:** `pnpm test` cobre o domínio; revisão rejeita `throw` em action e regra duplicada fora do módulo puro.

## A4 — Superfície pública é exceção explícita

Rota sem sessão só existe por token de posse, declarada em `isPublic` (`src/lib/supabase/middleware.ts`), com RPC escopada e sem grant para `anon`. Matcher do proxy e essa lista são revisáveis e não se "endurecem" por impulso: cada entrada protege um fluxo em circulação (links de WhatsApp, cron, MCP).
**Verificação:** rota pública nova = entrada em `isPublic` + e2e do caminho feliz e do token inválido + revisão de LGPD.

## A5 — Pessoas, especialmente menores

Toda tabela ou coluna com dado pessoal entra em `docs/lgpd/inventario-dados.md` na mesma PR. Campos sensíveis (`*_pessoal`, `dados_civis`) são coordenação-only. Produção nunca é re-seedada; script de seed recusa o ref de produção.
**Verificação:** task explícita no `tasks.md`, schema-contract verde e revisão humana do inventário.

## A6 — Interface: kit, pt-BR, acessibilidade

Classes Tailwind direto no JSX; `Button`/`Input`/`Select`/`Textarea` do kit — `<select>` nativo só nas exceções nomeadas no `eslint.config.mjs`. Copy em pt-BR, sem travessão em texto exibido e sem jargão interno. Status sempre com rótulo textual, nunca só cor.
**Verificação:** `npx eslint src/` (guards de UI) + checklist de UI da spec.

## A7 — Paridade de demonstração

Toda feature de produto funciona em `/demo`, sem login, com dataset evergreen e mutação bloqueada (`DEMO_MSG`). A demo replica o escopo de RLS por papel em TypeScript: mudar policy sem espelhar faz a vitrine ensinar errado.
**Verificação:** task de paridade no `tasks.md` + spec e2e em `tests/e2e/demo`.

## A8 — Qualidade é gate, não intenção

Nenhum merge sem os gates verdes: typegen + `tsc --noEmit`, `eslint src/`, `vitest`, `schema-contract` e `e2e-app / e2e`. Migration só entra se o contrato de schema passar contra o ambiente alvo. Produção só recebe com a tag `[deploy]` autorizada pelo Thiago; preview valida o artefato, não substitui o gate do push.
**Verificação:** checks obrigatórios do GitHub; comandos exatos e ordem de aplicação em `docs/convencoes/ci-e2e.md`.

## A9 — Migrations são ledger imutável

Migration aplicada não se edita nem se apaga: correção é migration nova que reaplica o corpo vigente. Arquivo novo usa o próximo número livre (lacunas existentes são intencionais) e nunca redigita SQL de memória — o conteúdo vai verbatim para o remoto. `src/lib/database.types.ts` é gerado, nunca escrito à mão.
**Verificação:** gate de imutabilidade no CI (arquivos que existem em `main` não podem ser modificados/removidos) + `pnpm schema:check`.

## A10 — Mudança com intenção registrada

Mudança que toca schema/RLS, auth, rota pública, integração externa ou mais de uma superfície exige spec em `specs/NNN-<slug>/` aprovada antes do código. Spec entregue não é reescrita: correção de rumo cria a próxima spec e referencia a anterior.
**Verificação:** `specs/README.md` (índice e status) + link da spec no PR.

## Governança

- Emenda à constituição: PR só de constituição, com justificativa e atualização dos templates afetados.
- Revisão trimestral: artigo que virou letra morta ou não é verificável é removido.
- Violação consciente só no `plan.md`, na tabela "Complexidade e desvios", com a alternativa mais simples rejeitada e o motivo.
- Silêncio não é aprovação: dúvida de produto para e pergunta; não inventa regra.
