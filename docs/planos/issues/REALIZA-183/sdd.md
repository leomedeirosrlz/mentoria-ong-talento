# REALIZA-183 — software design

## Decisão 1: tabela plana, sem FK

`resumo_acessos.slug` é `text`, não FK. Motivos:

- A tabela de links (`relatorio_links`) só nasce na 167/170 — FK agora bloqueia.
- Mesmo com ela, o log precisa **sobreviver à revogação/exclusão do link** —
  o mesmo raciocínio de `emails_enviados.ref_id` ("sem FK, sobrevive à
  exclusão", 0056). Se a 170 criar `relatorio_links`, a coluna `slug` já casa
  por valor; opcionalmente uma migration futura pode adicionar `link_id` —
  **não é pré-requisito** desta issue.
- `params jsonb` — o recorte muda com o tempo (hoje turma/gran/col; com a 170 o
  config sai da row e params registra só overrides de visualização).

Alternativa considerada: logar via RPC `security definer` grant `anon`. Descartado
porque a escrita é server-side (service role) — RPC não compra nada aqui; o
admin client já insere direto. Quando a 170 precisar de escrita **pelo RPC
anon** (tentativa de senha registrada pela RPC), a RPC definer insere como
dono — sem grant de insert pra anon na tabela (padrão `login_handoffs`: zero
policies + revoke all + RPCs).

## Decisão 2: fire-and-forget com `.then()`, não `await`

Dois objetivos: a latência do log não entra no TTFB do relatório, e falha de
banco no insert nunca derruba a página (auditoria ≠ gate).

Armadilha real do codebase (AGENTS.md): chamadas supabase-js são lazy —
`void supabase.from(...).insert(...)` **não envia nada**. O helper encapsula
`await` dentro de uma função `async` chamada com `void`:

```ts
void logAcessoResumo(slug, sp);  // logAcessoResumo tem await interno + catch
```

Risco residual: em serverless, a função pode encerrar antes do insert completar
após a resposta ser enviada. Mitigação honesta: o insert é 1 row num índice só —
custo <50ms; e a perda de um acesso ocasional é aceitável (é log de auditoria,
não contador de billing). Alternativa (não escolhida): `await` antes do render —
garante o log mas adiciona a latência no caminho crítico.

## Decisão 3: IP hasheado no app, não no banco

`hashIpAcesso` roda no servidor (SHA-256, `node:crypto`) porque o salt é env
(`RESUMO_ACESSO_SALT`) — Postgres não lê env. Alternativa: hash no SQL com salt
em tabela de configuração — adiciona superfície (tabela de segredos) pra um
benefício inexistente: quem gera o hash é sempre o servidor app.

`ip_hash` é `text` livre (64 hex chars do SHA-256 truncado) — sem CHECK de
formato pra não acoplar a coluna ao algoritmo.

## Modelo de dados

| coluna | tipo | notas |
|---|---|---|
| id | uuid pk | `gen_random_uuid()` |
| slug | text | valor do link; check 1–120 |
| acessado_em | timestamptz | default `now()` — gravado pelo servidor |
| ip_hash | text null | SHA-256(salt:ip); null quando sem header |
| user_agent | text ≤500 | truncado no app |
| params | jsonb | `{turma,gran,col}` hoje; livre amanhã |

**Grants/policies:** `revoke all from public, anon`; `revoke insert, update,
delete from authenticated`; `grant select to authenticated`; policy
`for select using (my_role()='coordenacao')`. Supervisor **não** lê — log de
acesso a relatório é dado de auditoria da coordenação (diferente de
`dupla_saude_snapshots` da 182, que é dado operacional das duplas).

**Índice:** `(slug, acessado_em desc)` — serve à leitura "acessos deste link"
da UI da 170 e à contagem de falhas por slug+ip do rate limit (a 170 pode
adicionar índice parcial em `(slug, ip_hash) where ok=false` se a contagem
esquentar — documentado lá).

## Tipos TS

`database.types.ts` regen cobre a tabela. `params` vira `Json` — o helper
digita `Record<string, string | null>` na escrita.

## Invariantes

- Nunca grava IP cru (nenhum código além de `hashIpAcesso` toca o header).
- Insert nunca lança pra fora do helper (try/catch total).
- Sem update/delete por policy — a limpeza (quando existir) é por service role
  ou migration.
- O log só acontece **depois** do gate `notFound()` do slug — slug inválido
  não vira linha (senão a tabela vira sensor de enumeração de slugs).
