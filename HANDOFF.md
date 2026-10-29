# Handoff — sessão 24/out/2026

Contexto pra continuar o trabalho de correção de UI pós-merge. Ler junto com `AGENTS.md`.

## TL;DR

- PR #98 (ux-refresh) mergeada na main (`21f81b3`); feedback do Thiago: "ficou uma bosta… parece que hardcodaram os mocks sem adaptar nada pro que já existia".
- Rodamos **graphify** no repo inteiro → grafo persistente em `graphify-out/` (ver abaixo).
- 3 agentes auditaram cada superfície do merge × pré-merge (`436065e^`) × mockups aprovados × planos → relatórios completos em `docs/planos/feedback-ux-2026-10/auditoria/`.
- Veredito da auditoria: **a maioria das suspeitas não se confirma** (nada de mock hardcoded — dados reais em tudo). Existem **2 regressões funcionais reais**, ~15 desvios/ruídos/copy e ~12 decisões de produto em aberto que o plano não fechou.
- **Nada de código foi corrigido ainda** — paramos pra colher decisões do Thiago.

## Estado do repo e deploy

- `main` = `21f81b3` (merge PR #98) + `b5684a8` (BACKLOG via PR #99, auto-merge armado).
- Migrations `0119` e `0120` aplicadas em **staging e produção**.
- ⚠️ **Produção NÃO deployou**: o merge não tinha `[deploy]` na mensagem → Ignored Build Step da Vercel cancelou. Deploy prod é manual (dashboard → Redeploy, ou `vercel deploy --prod`).
- Server local `http://localhost:3100` roda **neste PC** (`~/nb/realiza.vc`, build de produção). Morreu 2× na sessão; subir com `setsid node_modules/.bin/next start -p 3100` — sem `npm exec` (engole o `-p`).
- CI/e2e: `e2e-app` é required check do main e roda contra **staging** (secrets `E2E_*`); specs `tests/e2e/app` têm hard-stop se a URL contém ref de prod. Fixtures são globais — nunca rodar suite app local contra prod.

## Workflow (obrigatório)

- **Editar em `~/nb/realiza.vc`** (cópia local). Antes de qualquer git/build/test: `nb push` → `ssh nbl 'cd ~/realiza.vc && <cmd>'`. `nb pull` se o remoto mudou.
- **Git só no remoto** (`.git` não sincroniza). Commits sempre com `-c user.name=thisux1 -c user.email=125291983+thisux1@users.noreply.github.com`; proibido co-authored-by.
- `npx tsc --noEmit` + `npx eslint src/` limpos antes de considerar pronto; `pnpm test` (vitest) quando mexer em lib.
- Convenções vivas no `AGENTS.md`: hierarquia de texto (piso 10px, `<dt>` 11px+tracking, sem terceiro tom de cor), motion (`.animate-enter` + re-key — filtro/busca/ordenação **sempre anima**, guard global de reduced-motion, nunca media query por componente), semáforo/domínio, modo demo.

## Graphify (mapa do repo)

- `graphify-out/graph.json`: **9676 nós · 23213 edges · 636 comunidades nomeadas** (AST c/ SQL + 55 chunks semânticos subagentes; 96% EXTRACTED).
- `graphify-out/GRAPH_REPORT.md`: god nodes (`schema-mapa.md`, `telas-mapa.md`, `createClient`, `demoAtivo`, `Button`), surprising connections, suggested questions, inventário de comunidades.
- `graph.html` não gerado (limite 5000 nós — `GRAPHIFY_VIZ_NODE_LIMIT` pra forçar; `graphify tree` é alternativa mais leve).
- Consultar: `/home/thiago/.local/bin/graphify query "<pergunta>" | path "A" "B" | explain "X" | god-nodes --graph graphify-out/graph.json`.
- Saúde honesta: 1183 edges dangling (IDs semânticos↔AST divergentes — esperado em grafo doc↔código), 1 self-loop, ~300 collapsed. Não bloqueia.
- Chunks fonte preservados em `graphify-out/.graphify_chunk_*.json` (55); pipeline completo documentado no skill (`~/nb/.claude/skills/graphify/SKILL.md`).

## Auditoria pós-merge — achados consolidados

Relatórios completos (evidência arquivo:linha + refs aos mocks): `docs/planos/feedback-ux-2026-10/auditoria/{duplas-home,materiais-agenda,restante}.md`.

### Regressões funcionais reais (prioridade)

1. **`/materiais` — "Enviar em lote" sumiu pra supervisor+papel coordenacao.** `ehCoord`/`papelInstrumentos` derivam do role **primário**; a RPC `emitir_instrumento_lote` autoriza por `has_papel('coordenacao')`. Voltar a `temPapel` + página fica incoerente pro híbrido (voz coord × voz supervisor no mesmo render). `src/app/(app)/materiais/page.tsx:51,149-153,245`.
2. **Apoio na lista /duplas sem link pro chamado.** v6a prevê "Abrir chamado"; pill aponta pra ficha **sem âncora** `#apoio` (fallback mínimo já ajuda). `duplas-lista.tsx:301-311,1046-1084`.
3. ~~"Registrar supervisão" em ⋮ de 1 item~~ — **Thiago disse "isso não existe"**: remover da lista de fixes ou investigar o que o auditor viu (provável: ação de supervisão na linha do auxiliar).

### Copy/ruído a corrigir (lote rápido)

- `/materiais` caixa de escopo do supervisor perdeu cláusula "você não faz" (`page.tsx:212-221`).
- `/turmas` stat "N fora da conta" sem nomear status (`turma-card.tsx:531-537`; mock nomeava).
- `/turmas/[id]` meta do header duplica linha mono do banner (`page.tsx:70-91`).
- Tipografia abaixo do piso: `/chamados` 9px (`chamados-app.tsx:1102,1123,1168,1653,1758`), `/registros` 9–9.5px (`registros-painel.tsx:535,561,981`, `viz/sparkline.tsx:281`).
- `/duplas`: segmento do ResumoSemaforo seta filtro mas não desfaz (`:813-828`); linha de turma perdeu "terças 19h" (`:~855-885`); busca repinta seco — re-key omite `q` (`:1653`); pausada+apoio recebe mensagem neutra genérica (`:1052-1068`); `key={c.turma}` colide (`:859`).
- `/jovem/materiais` "Celebração da jornada" hardcoded — não lê `eventoFim.titulo` (`:461-470`).
- `/materiais` voz do guia divergente pro híbrido staff+mentor vs agenda (`:309-312` vs `agenda-calendario.tsx:671`).
- "trancada"/"trancado" gênero divergente entre superfícies.
- `/registros` pills `font-semibold` vs SegLocal `font-bold`; links de triagem `/registros?apoio=1` derrubam recorte `?turma=` etc. (pré-existente, piorou com panorama).
- `/agenda` `?jw=` engolido em silêncio pro supervisor puro (`page.tsx:338-346`).

### NÃO é regressão — não "desfazer"

- WhatsApp pro mentorado: nunca existiu na lista; ficha `/duplas/[id]` byte-identical com ambos os destinos (`:776-785`, `:1622`); lista **ganhou** contato ao jovem em apoio com origem jovem/ambos (template `apoio_jovem`).
- Home/dashboards coord/supervisor/mentor: sem remoções (refactors `Seg→BarraSegmentada`, `turmaLonga`).
- `/agenda`: grade mensal e painel lateral do dia preservados conforme decisão; nenhuma affordance de agendamento pra coord/sup.
- Chamados: `@` staff-only, composer autor sem menções — decisão honrada.
- Contrato WA v6a implementado inteiro (Lembrar nudge com cap 48h × Chamar contato, menu wa.me/copiar/ver texto, disabled "sem WhatsApp", quadrado verde mobile).

### Decisões pendentes com o Thiago (perguntas feitas, aguardando)

1. **Eixo apoio**: implementar link pro chamado (query por `dupla_id`, RLS) vs pill→`#apoio` vs manter.
2. **WA em pausada/concluída/encerrada + LinhaMini**: esconder (mock) vs manter Chamar em toda linha.
3. **Cards de instrumento do mentor em /materiais**: manter catálogo+deep-link vs agregados ("N de M devolutiva") via query leve vs workbench por dupla (RPC nova — caro).
4. Aux: nudge "Lembrar mentor" visível pro supervisor em /materiais — mock marca como em aberto; `?jw=` pro supervisor; `guiaPapel` híbrido; denominador do TurmaCard (só ativas vs total); ação `.tacts` no card de turma; custo `getDuplas()` na home coord; legados `turma` fora do padrão `T<N>` aparecendo como título.

## Achados do scan de sessões anteriores (out 21–24)

- **`~/nb/realiza-118/` existe** — cópia paralela antiga do repo (migrations só até ~0081), **não consta na lista de proibidos do AGENTS.md**. Risco real de agente editar/grepar a árvore errada. Adicionar à lista ou apagar.
- **`RESUMO_ACESSO_SALT` é env obrigatória em prod** — sem ela o `ip_hash` do log de acessos do `/resumo/[slug]` sai nulo com "falha visível". Confirmar no projeto Vercel (prod + preview) **antes/depois do redeploy**.
- **`/resumo/[slug]` é superfície pública em prod** (`RESUMO_SLUG_T2 = "t2-x7k4m9qf2w8j"`, sem login — middleware libera `/resumo/*`). Rotacionar o link = novo slug + redeploy.
- **`NB_HOST=nblan`** — `nb` respeita override de host (`~/.local/bin/nb:16`). Quando `ssh nbl` (Tailscale) cai e a LAN está ok, `NB_HOST=nblan nb push` resolve.
- **Onde o Thiago viu a UI "bosta"**: quase certamente o **preview alias** da branch (`realizavc-git-feat-ux-refresh-2026-10-…vercel.app` estava ao vivo) — não prod, que segue sem deploy. Confirmar ao comunicar.
- **"Registrar supervisão"**: o mock `v6a.html` **mostra** a ação nas linhas da visão auxiliar — o auditor leu o mock, não inventou. Thiago disse "isso não existe" → a decisão real é **o mock está errado / a ação não deve existir**, não um bug do impl. Resolver com ele antes de mexer.
- **Regra já explicitada**: "spec velho → conserta spec, não app" — falha de e2e pós-refactor quase sempre foi spec desatualizado; só tocar app quando a spec estiver certa e ainda quebrar.
- **Débitos e2e prováveis**: seed `seed-e2e-staging.mjs` ao recriar encontro 16 realizado **não reverte a dupla pra `ativa` nem remove `encerramentos`/notificações de trigger** (anotado como próximo fix do seed). Suite demo teve falhas em `chamados.spec.ts` (×3), `curriculo-mentorado.spec.ts:54`, `disponibilidade-matriz.spec.ts` (×4) num run pré-merge — confirmar que estão verdes hoje.
- **`:3100` caiu 3× no total** (2 nesta sessão + 1 num run anterior com ~35 specs afetadas) — hipótese RAM apertada no PC. Já usou porta 3101 em outra época.
- **Onda anterior de audits por papel** (jovem, mentor, coord, públicas, especialista+supervisor — out/23): transcripts cortam no meio e **não há relatório consolidado em docs/** — findings dessa rodada podem estar órfãos. Se importar, resgatar as threads-filhas em `~/.local/share/devin/cli/summaries/`.
- **Auditoria mobile** (`docs/planos/mobile/`): trilha separada de achados mobile-first já existente — checar pendências dela antes de planejar fixes mobile.
- **Remote tree sujo**: `next-env.d.ts` (regen), `agent/`, `skills-lock.json` seguem não-commitados — ruído conhecido, não mexer sem decidir.
- **`tsc` limpo ≠ sem sobreposição**: agents paralelos viram erros de tarefas irmãs na working copy durante a sprint — sempre rebuildar/verificar depois que todos os agents pousarem.
- **Existe probe anti-deploy-cancelado na suíte e2e** (commit `688ff69`) — diagnosticar "deploy cancelled" futuro por ele.
- **Precedente**: senha de prod do Supabase foi passada em chat e usada pra aplicar migrations — funciona, mas não re-pedir; se precisar de novo, perguntar.

### Decisões do Thiago já fechadas (não re-perguntar)

- **"Preencher junto" NÃO é suportado** — mentor+jovem no mesmo instrumento fica fora de escopo.
- Respostas legadas `rev_*`: **não renderizar** já-submetidas (registrado como REALIZA-191).
- `expor_contato`: comportamento/toggle preservado; só aviso LGPD visível.
- "Semana do programa"/programação futura: mentor e staff veem; **jovem não recebe** a faixa.
- `auxiliar` = `supervisor` existente (sem enum novo); **pode** enviar nudge/lembrete.
- Cards de agenda em excesso → **scroll horizontal**, não apertar na linha.
- Mentor **não** usa `@` mentions em chamados (autocomplete é staff-only).
- Agenda: grade mensal + painel lateral do dia **preservados**; quem agenda é a dupla — coord/sup só monitora e faz nudge (sem affordance de agendamento pra eles).
- Multi-agent é exigido; validação **autônoma local** (server :3100 + subagents), sem human-in-the-loop por fluxo; prioridade = valor do produto pra quem usa.

### Perfil do Thiago (resumo semântico de ~4.300 inputs, set→out)

- **SLC, não MVP** — "nada de placeholder ou template, sem gambiarra, vai iterando até não ter o que melhorar". Qualidade acima de velocidade, sempre.
- **Multi-agent é o padrão** — "tem que ser em pipelines multi agent", "delega prezando pela qualidade e polimento máximo, não importa se demorar". À noite: autonomia total ("vou dormir e quero tudo pronto"). Mas **direção ele aprova**: "cada ideia dos agentes deve ser apresentada pra mim antes de implementar".
- **Método**: recon antes do plano → doc-set por issue em `docs/planos/issues/` → reviews por persona → implementer → validador visual no :3100. Prompts literais com escopo de arquivos, convenções, gates (`tsc`+`eslint`+`vitest`+playwright), report com arquivo:linha.
- **Verificação de verdade** — "verifique de verdade, NÃO adivinhe", "0 regressão?", "tem certeza? pq nao mudou quase nada". Preview antes de prod é regra. "Spec velho → conserta spec, não app".
- **O que irrita**: trabalho pela metade/invisível; agir fora do escopo (WhatsApp: mandou msg pra base inteira); agir sem avisar; git destruindo trabalho; UI densa/plana ("muitas infos iguais, mesmo peso visual", "scroll muito grande"); perguntas genéricas ("seja mais especifico"); lentidão; jargão em copy ("semaforo? ninguem fala assim"), "(s)", em-dash.
- **Produto**: automação do operacional da coordenação; WhatsApp é o canal oficial; mobile-first (jovem no celular, coord WhatsApp-heavy); dados honestos ("denominador real", "número sempre com escala"); gamificação = jornada individual, **NUNCA competição entre duplas**; privacidade (estrela só especialista vê, currículo confidencial); "as demos são só referência pra mudar a interface real" — mockups ≠ produto.
- **Decisões-chave extras**: "Lembrar" = notif + WA, cap 1/dupla/48h server-side; T1 lima/T2 âmbar/T3+ hash; avaliação do jovem = 5 estrelas+comentário **só especialista vê**; 360 só no fim; autoavaliação semanal descontinuada; especialista **aceita** a sessão; mentor pode acumular DPP+especialista; agenda semanal pra coord, mensal pro mentor; e-mails de **notificação** com toggle off (auth segue enviando — religar quando pronto); IA = importação NL + revisão semântica **com visão obrigatória**; Jira = tracker ("in test" = teste humano; review por agente descartado).
- **Segurança**: credenciais já foram coladas no chat (app + banco prod) — tratar como comprometidas, rotacionar quando der; não reutilizar/re-pedir.

### Outras pendências resgatadas das sessões

- **Sentry**: setup no projeto `realizavc` não confirmado; secrets (`CRON_SECRET`, `RESUMO_ACESSO_SALT`, `E2E_*`, `VERCEL_AUTOMATION_BYPASS`) e required check `e2e-app` por confirmar.
- **`main → staging`**: branch staging espelha main pra `staging.realiza.vc` — atualizar pendente.
- Integrações aspiradas não decididas: Google Calendar/login Google, Google Ads conversões (conta 619-599-5576), WhatsApp API oficial (usou OpenWA), possível migração VPS.
- Operacional dele/coord (não-código): remanejos reais (Cibely, Patrícia desistiu, fila Wendel/Jonathan/Vinícius); relatório de leads (27 contatos do Léo); termos da equipe executiva (só termo de voluntariado por enquanto).

### Fora do realiza.vc (portfólio — anotado pra não perder)

- `correioelegante3`: `TURNSTILE_SECRET` vazou commitada em `.env.example` (descartada antes do merge) — **rotacionar a chave Cloudflare**.
- Sessão cortou com "readme quebrou de novo nao ta alinhado" sem resposta; 6 URLs de `.webm` pendentes pra trocar GIFs por players; `~/nb` stale pros repos de portfólio → `nb pull` antes de tocar.

## Próximos passos sugeridos

1. Fechar as 4 decisões com o Thiago.
2. Fix dos bugs reais + lote de copy/ruído (tudo itemizado acima com arquivo:linha).
3. Se mexer em fluxo: atualizar specs e2e (`tests/e2e/{demo,app}`) — convenção `convergirPiso`, asserts com `{ timeout: 15_000 }`.
4. `nb push` → `tsc`+`eslint`+`vitest` remoto → rebuild `:3100` local → probe visual.
5. Push de branch → e2e-app verde → PR → merge. Deploy prod continua manual (sem `[deploy]` no merge).
