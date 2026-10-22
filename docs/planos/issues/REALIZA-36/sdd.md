# REALIZA-36 — sdd.md (schema/RPC/decisões)

## Alternativas consideradas

### Upload de `arquivo` por anon

| Opção | Veredito |
|---|---|
| Policy de storage pra `anon` no bucket | ❌ anônimo com write em bucket é superfície sem autenticação nenhuma — token não é identidade Supabase |
| RPC definer retornando signed upload URL | ⚠️ funciona, mas o upload vai direto ao storage e fura a validação tamanho/mime do servidor (signed URL aceita qualquer bytes até o cap do bucket) |
| **Server action + service client** (escolhido) | ✅ bytes passam pelo servidor: validação real de MIME/tamanho, `form_anexo_put` pré-registra path+link, upload via service key. Mesmo padrão `subirFoto` |

### Onde guardar metadados do anexo

| Opção | Veredito |
|---|---|
| Path só dentro de `respostas` jsonb | ❌ impossível listar/limpar órfãos; nada ancorando policy de leitura |
| **`formulario_anexos` [NOVO]** | ✅ row por arquivo: RLS coord-select, sweep de órfãos, auditoria (quem subiu o quê, quando) |
| Reusar `documentos_pessoa` | ❌ respondente de intake ainda não é pessoa — FK não existe |

### `grid_disponibilidade` — shape da resposta

| Opção | Veredito |
|---|---|
| Array de strings `"seg-19"` | ⚠️ simples mas diverge do canônico — precisaria adapter nos dois lados |
| **`{celulas:[{dia,periodo}]}` = `disponibilidade_ok`** | ✅ a resposta JÁ É o formato que `AfinidadePar`/matching consomem; `respostaParaDisponibilidade` vira identidade ou reshape trivial |

> **a verificar**: definição exata de `disponibilidade_ok` em `0034`/`0100`
> (dias como texto `'seg'` ou número? períodos como hora `'09'` ou label
> `'noite'`?). Fixar o payload do grid no MESMO formato — a invariante é
> "resposta do campo grid é um `disponibilidade` válido".

### `visible_if` — shape

| Opção | Veredito |
|---|---|
| DSL livre (expressões) | ❌ overkill, impossível de validar no SQL sem parser |
| `{campo, em: valor[]}` | ✅ cobre o caso real ("mostra X se respondeu Y em Z") e é avaliável em SQL e TS com o mesmo código mental. Multi-condição fica fora de escopo |

## Modelo de dados

```sql
-- [NOVO] anexos de resposta de formulário
create table public.formulario_anexos (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references formulario_links(id) on delete cascade,
  campo_id text not null,
  path text not null unique,           -- form-anexos/<link_id>/<uuid>.<ext>
  nome text not null,                  -- nome original saneado
  mime text not null,
  tamanho int not null check (tamanho > 0),
  created_at timestamptz not null default now()
);
alter table public.formulario_anexos enable row level security;
create policy formulario_anexos_coord on public.formulario_anexos
  for select using (my_role() = 'coordenacao');
-- sem insert/update/delete pra roles normais: escrita só via definer
```

`respostas` jsonb — novos shapes:

```jsonc
// arquivo
"campo_id": { "path": "form-anexos/<link>/<uuid>.pdf", "nome": "cv.pdf", "tamanho": 102400 }
// grid_disponibilidade  (= shape canônico de profiles.disponibilidade)
"campo_id": { "celulas": [ { "dia": "seg", "periodo": "19" }, … ] }
// outro livre
"campo_id": "Outro: gosto de xadrez"          // select
"campo_id": ["Esporte", "Outro: xadrez"]      // multi_select
```

## RPCs/functions

| Função | Definer | Grants | Notas |
|---|---|---|---|
| `form_anexo_put(p_token, p_campo_id, p_nome, p_mime, p_tamanho)` | sim | `anon`, `authenticated` | valida token vivo + campo `arquivo` + allowlist → insert row → devolve path |
| `campo_visivel(campo jsonb, respostas jsonb)` → bool | n/a | interna | avalia `visible_if`; usada por `submeter_resposta_formulario` |
| `formularios_limpa_respostas` / `submeter_resposta_formulario` | sim (já) | já | `CREATE OR REPLACE` com branches novos |
| `formulario_por_token` | já | já | **sem mudança de assinatura** — `campos` jsonb já carrega as chaves novas |

## Action nova

```ts
subirAnexoFormulario(token, campoId, formData) → { path } | { error }
```

## Invariantes

1. Campo com `visible_if` que não se avalia como visível **nunca** grava
   resposta nem bloqueia submit (regra idêntica no client e no sanitizer —
   a fonte do servidor é `campo_visivel()`).
2. `visible_if.campo` aponta pra id **anterior** no array `campos`
   (validado em `validaCampos` + defesa no builder: editor só lista
   anteriores). Sanitizer assume a mesma ordem.
3. `arquivo` obrigatório invisível não exige upload; visível exige path
   prefixado `form-anexos/<link_id>/`.
4. `"Outro: …"` só passa no sanitizer quando `permite_outro=true`;
   texto 1–120 chars após trim.
5. `grid_disponibilidade` responde no formato de
   `disponibilidade_ok` — conversão pra matching é zero-copy.
6. Todo campo desconhecido do sanitizer continua dropado (comportamento
   atual preservado — os novos tipos adicionam branches, não afrouxam).

## Performance

- Sanitizer roda por submit — os branches novos são O(campos); grid
  valida ≤ ~70 células; barato.
- `form_anexo_put` indexa `link_id` (FK indexada) — rate check `count`
  por link é trivial.
- Upload via action: memória do servidor = tamanho do arquivo (≤20MB) —
  aceitável; streaming não vale a complexidade nesta escala.
