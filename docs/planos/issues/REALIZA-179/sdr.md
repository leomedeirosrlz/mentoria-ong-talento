# REALIZA-179 — sdr.md

Maior superfície de risco do cluster: primeira integração LLM, primeiro
endpoint Bearer, primeira tabela de tokens, primeira escrita por agente.

## 1. Superfícies novas

| Superfície | Acesso | Auth |
|---|---|---|
| `POST /api/ia/chat` | qualquer logado | cookie (middleware protege `/api/*` por default) |
| `/assistente` | qualquer logado | idem |
| `POST/GET /api/mcp` | coord | `Bearer` JWT-Supabase **ou** PAT `rlz_`; rota na lista pública do middleware [NOVO] |
| `ia_chunks` + `match_ia_chunks` | qualquer logado | `grant select authenticated` + RPC definer |
| `ia_tokens` | dono (select/delete) + RPC coord-only | policies novas |
| tools de escrita | por `papeis` + RLS | mesma sessão/token |
| Provider LLM | server-only | `IA_API_KEY` |

## 2. Análise de ameaças

### 2.1 Provider (exfiltração de PII)

- **O que o provider vê**: mensagens do usuário (texto livre — a usuária
  pode colar PII; não controlamos) + **resultados das tools** — que por
  construção já excluem `dados_civis`, currículo, contatos brutos e texto
  livre (`queries.ts` allowlists — invariante testado em
  `ia-tools.test.ts`; **manter essa allowlist intocada ao adicionar
  tools novas**).
- **Gate de lançamento**: DPA + retenção zero contratual — `BLOCKER`
  formal. Sem confirmação → `IA_API_KEY` ausente → feature morta.
- Prompt-injection via tool results: resultados são JSON de dados
  estruturados (sem instruções); system prompt proíbe obedecer texto vindo
  de `tool`/`user` que peça pra ignorar regras — defesa fraca por natureza,
  compensada por: tools são read-mostly, writes exigem confirmação humana.
- Usuária colando PII no chat: aceito — é o dado dela no escopo dela (RLS
  limita o que volta). Documentar na resposta do sdd ao jurídico.
- Sentry: inputs/outputs GenAI já off; confirmar que `messages`/`resumo`
  não entram em breadcrumbs — adicionar `request.body` scrub na rota
  `/api/ia/chat` se o Sentry capturar bodies (verificar `sentry.*.config`).

### 2.2 Endpoint MCP Bearer

- `/api/mcp` entra na lista pública do middleware → **toda a auth é da
  rota** — qualquer request sem Bearer válido recebe 401 JSON (não
  redirect HTML — clientes MCP falham com redirect).
- PAT: `sha256(token)` no DB (hash não reverte), `prefix` só pra lookup;
  mostrado uma única vez; revogável; `ultimo_uso_em` auditável.
- PAT→sessão mintada: cada sessão GoTrue criada via
  `generateLink`+`verifyOtp` aparece na lista de sessões do usuário —
  expõe no `/perfil` se já houver lista de sessões (a verificar; se não
  houver, é auditável via dashboard Supabase Auth).
- **Revogação**: `revogado_em` checado a cada request PAT; a sessão
  mintada expira ≤1h e não se renova com PAT revogado (o cache é
  revalidado contra `revogado_em` a cada mint/refresh).
- Token leak em log: bearer nunca é logado; `ia_eventos.args` guarda só
  args da tool (não o token); Vercel logs não capturam Authorization por
  default (confirmar — o header já está na deny-list do Sentry scrub).

### 2.3 RAG

- `ia_chunks` contém **só guias oficiais** — sem PII por construção da
  ingestão (fonte = PDFs institucionais). QA da ingestão: nenhum chunk com
  nome de pessoa real (grep de verificação no script).
- Policy `using(true)` pra `authenticated`: guia não é segredo — aceito.
  `anon` não lê (grant só authenticated).
- `match_ia_chunks` recebe texto livre — `plainto_tsquery` sanitiza (sem
  injection em tsquery raw); RPC definer não retorna nada além dos chunks.

### 2.4 Tools de escrita

- Defesa em camadas: (a) `papeis` no registry; (b) **RLS/policy do
  banco** — a tool escreve com o client do usuário, então um mentor
  escrevendo na dupla alheia falha no insert; (c) guards do domínio
  herdados dos cores (`escritas.ts`) — ex.: dupla viva bloqueia saída,
  coord não agenda.
- Confirmação: `confirmado:true` é flag do **client** — teoricamente um
  MCP client pode auto-confirmar. Aceito: a confirmação é proteção de UX
  contra alucinação, não controle de acesso — o acesso real é o papel.
  O resumo dry-run + par de `ia_eventos` deixa trilha de "proposto vs.
  aprovado".
- `agendar_encontro`: o guard "Quem agenda é a dupla" vem da action core
  — a tool **não pode** agendar como coord porque o core recusa. Mentor
  consegue agendar a própria dupla via chat (comportamento desejado, é o
  papel dele no app).
- `editar_campo_pessoa`: herda a allowlist `CAMPOS_RELATORIO`
  (nome/email/whatsapp/cidade/uf) — **não** ampliar a allowlist na tool
  (LGPD: dados sensíveis ficam fora).
- `IA_ESCRITAS_OK`/`IA_MCP_ESCRITAS` gates de rollout por superfície.

### 2.5 Rate limit / abuso

- `checarLimiteIa`: 20 calls/min (chat) / 30 calls/min (MCP) por
  `profile_id`, contando `ia_eventos` — DB-accurate (não depende de
  memória de instância serverless). Custo: 1 count query por mensagem.
- Loop de tools limitado a 6 iterações/request — modelo não pode ficar
  chamando tool em ciclo (cost cap por request).
- Input cap: `messages` ≤20, `content` ≤4000 chars (zod na rota).
- Custo do provider: `duracao_ms` nos eventos + contagem →
  observabilidade pronta; sem auto-retry.

### 2.6 Transcript / retenção

- Mensagens **não persistem** (memória do client). `ia_eventos` guarda
  metadados: `tool`, `args` canonizados/capados (truncamento já existe em
  `tools.ts`), `ok`, `erro`, `duracao_ms` — **não** guarda resposta da
  tool nem a conversa.
- `args` pode conter nome digitado pelo usuário (ex.: `ficha_dupla` com
  slug?) — args são IDs/enums na maioria das tools; quando contiver texto
  (pergunta do `guia_consulta`), o cap de tamanho do registry limita.
  Aceito: é a própria ação da usuária no DB dela (mesmo nível de
  `interacoes.nota`).
- LGPD menor: `ia_eventos` não contém dados de menores além de IDs/uuids
  de dupla — sem nome, sem texto de menor. Deleção de `profiles` deve
  anonizar/`on delete` — `a verificar` FK `profile_id references
  profiles` (0083) behavior em exclusão de conta (provável RESTRICT ou
  CASCADE — checar e alinhar com política de retenção da coordenação).

## 3. Checklist de lançamento

- [ ] DPA + zero-retention do provider confirmado (Thiago) → set envs.
- [ ] OAuth server do Supabase: habilitado? documenta flow; senão PAT.
- [ ] `mcp-handler` versão pinned; `pnpm audit` limpo.
- [ ] `/api/mcp` na lista pública do middleware + teste 401 sem bearer.
- [ ] `ia_tokens`: grants (select/delete próprio via policy; insert só
  via RPC `emitir_ia_token` definer; **revoke all** primeiro — padrão 0032).
- [ ] Scrub Sentry cobre `/api/ia/*` e `/api/mcp` (headers já negados;
  conferir body).
- [ ] Rate limit testado por papel.
- [ ] `ia_eventos` mostra par proposta/confirmação de cada write.

## 4. Checklist LGPD

- [x] Mínimo necessário nas queries (allowlist já existente — manter).
- [x] Sem transcript persistido.
- [x] Token = hash no DB, revogável, auditável.
- [x] Escrita só com confirmação + regra de domínio + RLS.
- [x] Corpus RAG = material institucional (sem pessoas).
- [ ] Registro no mapa de operadores quando o provider for ligado.
