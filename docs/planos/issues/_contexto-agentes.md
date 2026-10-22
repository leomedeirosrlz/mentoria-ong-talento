# Context pack — contrato para agentes de planejamento (issues REALIZA-*)

> Leitura **obrigatória** antes de escrever qualquer doc em `docs/planos/issues/`.
> Este arquivo + os mapas em `_recon/` são o chão verdadeiro. **Proibido inventar
> tabela, coluna, RPC, rota ou componente** — se não está nos mapas nem no código,
> escreva `a verificar` e explique o que falta confirmar.

## 1. O produto

Plataforma operacional do **Programa de Mentoria Social** (realiza.vc). Vertical
slice completa e polida — **SLC, não MVP**: sem placeholder, stub ou "depois
melhora". Copy sempre pt-BR. Produção real em `https://realizavc.vercel.app` com
dados de menores — LGPD e RLS são linha de frente, não detalhe.

## 2. Personas (quem usa cada superfície)

| Papel | Quem é | Superfície principal |
|---|---|---|
| `coordenacao` | Léo/equipe — opera o ciclo inteiro | tudo; semáforo, matching, nudges, forms, relatórios |
| `mentor_dpp` | mentor de desenvolvimento pessoal | ficha da dupla, agenda, registros, instrumentos |
| `mentor_especialista` | trilha pontual (5 sessões/3 meses) | mural→negociação→grade→sessões→fechamento §13 |
| `supervisor` | "auxiliar executivo" — acompanha conjunto de duplas | leitura escopada + `supervisoes` |
| `mentorado` (jovem) | adolescente/jovem — **login real** + links tokenizados | portal do jovem, onboarding, avaliações, síntese |
| público externo | respondentes de terceiros, assinantes, relatórios | `/f/[token]`, `/t/[token]`, `/assinar/[token]`, `/avaliar/[token]`, `/resumo/[slug]` |

## 3. Domínio — o que já existe (não reinventar)

- `duplas` (mentor × mentorado, `trilha` dpp/especialista, `turma` texto, `cronograma_id`, `supervisor_id`, `status`, `solicitacao_id`, `pdm_url`, `demanda`)
- `encontros` por dupla `unique(dupla_id, numero)`; `realizado` é **imutável** (`0043`)
- `registros` pós-encontro (campos do form semanal) + `registro_anexos` + `encaminhamentos`
- `ciclo_eventos` = calendário oficial (16 encontros) por `cronograma_id`; semáforo `saudadeDaDupla` compara esperados × realizados
- `cronogramas` (entidade já existe — REALIZA-15 parcial/verificar)
- **Forms engine** (`0036`+`0042`): `formularios` + `formulario_links` tokenizado → `/f/[token]` público; oficiais `sistema=true` imutáveis; 8 tipos de campo
- **Assinaturas** (`0033`+`0046`): `documento_templates` versionados, `/assinar/[token]` público, PDF com evidências, `dados_civis` jsonb coord-only
- **Materiais** (`0010`): bucket privado + signed URL; `encontro_num` liga material ao encontro
- **Matching**: `profiles`/`mentorados` campos ricos (`*_pessoal` coord-only), `disponibilidade` grid, `AfinidadePar`
- **Especialista**: `especialista_eventos` (5 passos), mural, aceite atômico, `encerrar_trilha_especialista` (devolutiva + §13 via `0104`), `rematch_dupla` (`0105`)
- **Terceiros** (`0103`): `terceiros_*` — 9 links `/t/[token]`, síntese anônima curada
- **Encerramento** (`0037`): `encerramentos` checklist + autoavaliação mentor
- **Supervisão** (`0041`): `supervisoes`; **Presenças** (`0040`): `presencas` formação
- `notificacoes` por tipo; `interacoes` = log de pings WhatsApp
- **Modo demo** completo: `src/lib/demo/*`, cookies `demo_role`/`demo_onboarded`, client stub — toda feature nova precisa de contraparte demo quando visível em `/demo`
- **Sentry** (11.8.0): 3 runtimes, tunnel `/monitoring`, scrub em `src/lib/sentry-scrub.ts`, sem replay — eventos novos respeitam o scrub

## 4. Arquitetura — invariantes

- Next.js **16** (App Router) + React 19 + Turbopack; **não é o Next do treino** — checar `node_modules/next/dist/docs/` antes de assumir API
- `src/proxy.ts` (não `middleware.ts`) — protege tudo exceto rotas públicas; matcher tem âncoras
- Leituras: `src/lib/queries.ts` (`React.cache` + `auth.getClaims()`); escritas: `src/lib/actions.ts` (**retornam `{error}`/`{ok}`, nunca lançam**)
- RLS via `my_role()`/`my_profile_id()`/`temPapel`; mentor escreve só na própria dupla; `*_pessoal`/`dados_civis` = coord-only
- RPCs `security definer` pra transições atômicas (aceite, rematch, encerramento); delete em encontros/registros é coord-only (`0047`)
- Domínio puro testável em `src/lib/ciclo.ts`; Vitest cobre funções puras
- UI: `src/components/ui/*` (Base UI), Phosphor, tokens em `globals.css`; tabelas densas via `RelatorioCanvas`
- Migrations numeradas `NNNN_nome.sql` em `supabase/migrations/`; **aplicar staging → prod → merge**; nunca escrever DDL sem consultar schema real
- Auth: magic link implícito + handoff `?h=` (nonce único); signup é allowlist (`profiles` pré-cadastrados)
- WhatsApp: nudge = `wa.me` click-to-send logado em `interacoes` via `/api/nudge`; **não há API WA ainda**

## 5. Regras de negócio fixas (decisões fechadas — não reabrir)

1. A **dupla agenda os encontros**; coord monitora e faz nudge — nunca agenda por ela
2. Mentorado: 1 DPP ativa + N especialistas; mentor pode ter vários mentorados; índice `(mentorado_id, trilha)` parcial ativo
3. Agendamento DPP = edição livre **com notificação** (qualquer lado marca; outro pode reverter); proposta→aceite só na trilha especialista
4. Coord vê **tudo** de conteúdo (PDM etc.); supervisor da dupla vê como mentor; auxiliar por turma sem dados civis
5. Especialista: budget **5 sessões por PAR** jovem×especialista por ciclo; jovem-iniciado coexiste com fluxo antigo
6. Mentorado sem conta pra transações pontuais → token; mas **toda resposta persiste vinculada à identidade** (futura conta)
7. PDM e Roda da Vida **entram na plataforma** (decisão 04) — nativo, não editor PDF genérico primeiro; PDM nativo = REALIZA-181
8. Intake centralizado na plataforma substituindo Google Forms — com **visões familiares** (grade tipo planilha)
9. Relatórios = página `/relatorios` exportável (não digest por e-mail)
10. IA: escrita **sempre via RPCs/actions existentes**, humano no loop, audit `ia_eventos`, dados mínimos ao provider, retenção zero
11. Storage escasso (1 GB free Supabase) — uploads grandes são dívida conhecida (offload Drive/GCS = REALIZA-53/65)
12. `/resumo` → vira relatório público com senha (REALIZA-170) — links geráveis/revocáveis com filtros do export
13. Supervisor → "auxiliar executivo" (rename de exibição); supervisão escopo = por dupla (pendente confirmação, trava -32)

## 6. Gates de qualidade (todo plano deve respeitar)

- `npx tsc --noEmit` + `npx eslint src/` + `pnpm test` (Vitest — funções puras têm teste)
- `schema-contract` CI: código não pode declarar coluna que o remoto não tem
- Validador REST contra staging pra migration/RLS (padrão `scripts/_valida_*.mjs`)
- e2e: `tests/e2e/demo` (seguro em qualquer ambiente) e `tests/e2e/app` (writes, staging/local)
- Multi-agent review: todo diff substancial passa por ≥2 reviewers independentes

## 7. Contrato de entrega — docs por issue

Cada issue vira `docs/planos/issues/REALIZA-NNN/` com o tier indicado no
`_manifest.md`:

| Arquivo | Obrigatório quando | Conteúdo |
|---|---|---|
| `README.md` | sempre | card de índice: resumo 2 linhas, tier, deps, status |
| `plan.md` | sempre | plano de implementação passo a passo: arquivos tocados (paths reais), ordem, rollback |
| `sdd.md` | toca schema/RPC/API/job | software design: DDL esboço, policies RLS, tipos TS, assinaturas de action, invariantes |
| `design.md` | toca UI | espec UX: hierarquia, anatomia de linha/card, estados (vazio/erro/loading/permissão), tokens, microcopy pt-BR — seguir o framework do skill `.devin/skills/ux-review/SKILL.md` |
| `sdr.md` | dado sensível/público/IA | security & data review: superfície de ataque, LGPD, RLS, rate-limit, auditoria, minimização |
| `acceptance.md` | sempre | critérios de aceite testáveis (dado/quando/então), testes unit/e2e/REST, gates, rollout |
| `decisao.md` | issue DECISÃO | substitui plan: opções, trade-offs, recomendação, o que falta o humano assinar |

Regras dos docs:
- **Citar paths e símbolos reais** (ex.: `src/app/(app)/duplas/page.tsx`, `rematch_dupla`, `materiais.encontro_num`). Vago = refazer.
- Se algo necessário não existe no schema/código: marcar `a verificar` + dizer onde confirmar — **não inventar**.
- Dependências entre issues: listar `REALIZA-NNN` por key com motivo.
- pt-BR nas partes de produto/copy; técnico pode ser pt-BR direto.
- Estimar esforço por tamanho (PP/P/M/G) e risco.
- O plano é pra um implementador (humano ou agente) executar **sem perguntar nada** — todo gap de decisão fica explícito em "Questões em aberto".

## 8. O que NÃO fazer

- Não editar código da app — só docs em `docs/planos/issues/`
- Não propor redesign de coisas já decididas (ver §5)
- Não assumir biblioteca nova sem checar `package.json`
- Não criar deployment/Vercel; não tocar `.env*` nem segredos
- Não duplicar issue: `_manifest.md` marca as absorções/dupes — respeitar
