# Camada de IA — chatbot público + MCP + RAG

Brainstorm → spec de arquitetura. Continua `relatorios-inteligencia.md`
(REALIZA-42), que cobria IA como *saída* (narrativa de relatórios). Aqui a
IA vira *interface*: o usuário conversa com os próprios dados e conecta a
IA que já usa ao sistema.

**Decisões do Thiago (out/2026):**
- MCP: **coordenação só**, expandir papel por papel depois.
- Provedor: **API do opencode** (modelo/endpoint configurável via env).
- Chatbot: **público** — cada usuário opera dentro das permissões do
  próprio perfil. Tira dúvidas, edita coisas fáceis via tools, oferece
  tutoriais. Não é um bot de suporte externo: é uma interface a mais do
  app, com o mesmo escopo.

---

## 0. Princípio estrutural — tool layer, não SQL

O modelo nunca gera SQL e nunca escreve em tabela diretamente. Ele chama
**tools tipadas** que delegam pras mesmas queries/RPCs do app:

```
Usuário (chat ou MCP externo)
   │  JWT Supabase do próprio usuário
   ▼
src/lib/ia/tools.ts  — registry tipado, validação zod,
   │                   allowlist de campos por papel, audit log
   ├── leitura → queries.ts / views já escopadas por RLS
   └── escrita → mesmas RPCs das actions (agendar_encontro,
                 marcar_situacao, emitir_link_instrumento, nudge…)
```

Por quê esse é o desenho honesto:

- **RLS faz o escopo de graça.** A tool roda com o JWT do usuário — mentor
  pergunta da própria dupla, jovem dos próprios instrumentos, coord de
  tudo. Não existe "prompt de system tentando segurar permissão"; a
  fronteira é a mesma do banco.
- **Menores protegidos por construção.** `dados_civis`, `curriculo_*`,
  `reflexoes`/texto livre de registro ficam **fora do schema das tools** —
  não é prompt engineering, é a tipagem da tool que não os expõe. Regra do
  doc anterior vale: LLM trafega estruturado/agregado; texto livre sobre
  menor só com flag legal.
- **Os guards de domínio seguem valendo.** "A dupla agenda; coord monitora
  e faz nudge" — se a coord pedir pro chat agendar um encontro, a tool
  chama a mesma RPC que a UI chamaria e o banco recusa igual. A regra sai
  da camada de apresentação e fica no contrato, que é onde ela já mora.
- **Auditoria integral.** Toda tool call grava `ia_eventos` (quem, tool,
  args canônicos, ok/erro, latência) — o rastro de "a IA agiu" fica no
  mesmo padrão de `interacoes`.

## 1. `ia_eventos` — audit log (migration própria)

```sql
create table ia_eventos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  canal text not null check (canal in ('chat','mcp')),
  tool text not null,
  args jsonb not null default '{}',
  ok boolean not null,
  erro text,
  duracao_ms int,
  created_at timestamptz not null default now()
);
-- select: próprio profile + coord; insert: via security definer da tool
```

Não guarda payload de dados retornados (transcript com PII vira
problema de retenção) — guarda a **ação**, não a resposta.

## 2. Catálogo de tools (fase 1 — leitura)

| Tool | Escopo natural | O que responde |
|---|---|---|
| `resumo_semana` | coord/aux | semáforo + motivo por dupla, pendências |
| `duplas_do_usuario` | qualquer papel | as duplas que o papel enxerga (RLS) |
| `ficha_dupla` | escopo do papel | trilha, próximos encontros, semáforo+motivo |
| `registros_da_dupla` | escopo do papel | follow-ups — **campos estruturados só** (avaliação, dificuldade enum, atividades, datas); `reflexoes`/`observacoes` ficam fora até flag legal |
| `agenda_do_periodo` | escopo | encontros por janela |
| `aguardando_par` | coord | a fila derivada (`filaMentorados`/`filaMentores`) |
| `capacidade_mentores` | coord | X/Y por mentor |
| `pendencias_docs` | coord/aux | assinaturas, dados civis faltantes (labels, não valores) |
| `instrumentos_da_dupla` | escopo da RPC homônima | respostas dos 4 instrumentos — mesma allowlist da `instrumentos_da_dupla` |
| `guia_consulta` | todos | **RAG** sobre os PDFs/metodologia (corpus sem PII) |

Regra do escopo: a tool recebe o JWT, monta o client do usuário e deixa a
RLS filtrar. Tools que consultam views `*_pessoal`/`mentorados_curriculo`
não existem na fase 1 — dado sensível só entra quando houver justificativa
de produto, nunca por default.

## 3. Catálogo de tools (fase 2 — escrita, com confirmação)

Toda escrita passa por **confirmação explícita**: a tool retorna
`{pendente_confirmacao: {...acao}}`, a UI do chat renderiza card de
confirmação, e só aí executa. No MCP externo, o próprio client (Claude
etc.) apresenta a tool call pro usuário aprovar — mesmo efeito.

| Tool | Delega pra |
|---|---|
| `registrar_interacao` | `interacoes` (nudge/contato logado) |
| `marcar_situacao_mentorado` | flow da 0077 (situacao+motivo) |
| `emitir_link_instrumento` | RPC `emitir_link_instrumento` (0080) |
| `agendar_encontro` | mesma action da agenda — banco recusa coord, como deve ser |
| `editar_campo_pessoa` | allowlist curta de campos "fáceis" (whatsapp, nome_social, observação interna) — nunca papel/status/dados civis |

"Editar coisas fáceis" = a allowlist, por design. Se a coord quiser
"mudar o papel da pessoa pra supervisor" via chat → a tool não existe, o
chat explica que isso é decisão de gestão feita na tela.

## 4. RAG — dois corpus, riscos diferentes

- **Corpus de conhecimento (fase 1):** guias oficiais do programa (PDFs),
  metodologia, instrumentos, FAQ operacional. **Zero PII** — seguro pra
  ativar já. Responde "como conduzir a Roda da Vida no 3º encontro?" com
  o texto do guia citado. Embeddings em `pgvector` no próprio Supabase
  (`ia_chunks` + `match_ia_chunks(query_embedding, k)`) — sem infra nova.
  Chunking por seção do guia, com `fonte` (guia+página) na resposta.
- **Corpus operacional:** NÃO é embedding — pergunta em linguagem natural
  sobre dados vira **tool call determinística** ("quais duplas não se
  encontram há 3 semanas?" → `semaforo` + filtro). Text-to-SQL/embeddings
  sobre PII ficam fora por enquanto — mesma linha da REALIZA-42.

## 5. Chatbot público (`/assistente` ou painel lateral)

- Cliente no app (sheet/drawer persistente ou página própria). Histórico
  por sessão **em memória/estado cliente** — não persistir transcript com
  dados retornados (retenção); se persistir, guardar só a conversa, sem
  tool payloads.
- Tools de leitura rodam direto. Escrita → card de confirmação no chat.
- O system prompt é curto porque o escopo já está na tool: "Você é o
  assistente do Realiza.vc. Responda em pt-BR, cite o que usou (tool ou
  trecho do guia), e nunca invente número — se a tool não existe, diga
  que não tem acesso a isso."
- Tutoriais: `guia_consulta` + respostas guiadas ("quer que eu te leve lá?
  → /agenda") — o chat pode retornar deep-links.

## 6. MCP server — `/api/mcp` (coord-only na fase 1)

- Route handler Next (`mcp-handler` ou implementação própria sobre o
  protocolo Streamable HTTP) no mesmo deploy — stateless, sem servidor
  extra.
- **Auth = identidade real.** Client conecta com OAuth (device flow/PKCE
  do Supabase Auth) ou PAT gerada no `/perfil` ("Conectar IA externa" →
  token de longa duração ligado ao profile, revogável). O server valida
  o JWT e executa tools com ele — RLS decide o que volta.
- Gate de papel no handshake: `my_role()='coordenacao'` na fase 1;
  outros papéis recebem 403 com mensagem clara. Expandir = adicionar o
  papel ao gate + revisar o allowlist de tools pra ele.
- Superfície: as mesmas tools do registry (`tools.ts`) expostas via MCP —
  um registry só, dois transportes (chat interno + MCP).

## 7. LGPD / provedor

- **API do opencode** como provider — requisito: plano/DPA com
  **retenção zero** (não treina, não loga payloads). Confirmar antes de
  ligar — com dados de menores é a cláusula que manda, não o modelo.
- System prompt nunca carrega `dados_civis`/currículo/texto livre de
  registro — o allowlist de campos sai no schema da tool.
- PAT do MCP é credencial — escopo do próprio usuário, revogável,
  `último_uso_em` registrado.

## 8. Sequência

| Fase | Entrega | Esforço |
|---|---|---|
| 0 | `src/lib/ia/tools.ts` registry + `ia_eventos` + client-por-JWT | P |
| 1 | **Chatbot coord** (drawer) com tools de leitura + `guia_consulta` RAG dos guias | M |
| 2 | **MCP read-only** coord-only na mesma lib | P (a lib já existe) |
| 3 | Escritas com confirmação nos dois canais | M |
| 4 | Expandir MCP por papel; corpus operacional se ainda fizer falta | decisão |

Pergunta que segue aberta (não bloqueia a fase 0–2): transcript do chat
persiste (conveniência: reabrir conversa) ou some no refresh (retenção
mínima)? Default proposto: **some** — o que ficou foi a ação em
`ia_eventos`, não a conversa.
