# Runbook — turma nova (T3+) sem commit

Desde a 0111 (REALIZA-167) a turma nova é **só dado**: link público mora em
`relatorio_links`, a fila "Sem dupla" mora em `turma_inscricoes`. Nenhum dos
dois passos toca código. Exemplo com a T3 — troque o rótulo conforme a
turma real (o texto é livre, mas precisa ser o mesmo nas duas tabelas e em
`duplas.turma`/`config->>'turma'` pra grade casar).

## 1. Link público do resumo

O caminho correto é a RPC de gestão (170) — ela gera a senha, guarda só o
bcrypt e devolve `slug` + `senha` **uma vez** na resposta:

```sql
select public.criar_relatorio_link(
  'Resumo da turma — T3 · 2027',
  '{"tipo":"grade","turma":"T3 · 2027","granularidade":"pessoas"}'::jsonb,
  interval '370 days'
);
```

→ `{ ok: true, slug: "...", senha: "xxxx-xxxx" }`. Anote os dois: o link é
`https://<host>/resumo/<slug>` e a senha vai junto pro destinatário. Quem
tem o par link+senha vê o resumo — trate como credencial. (`p_validade` é
opcional, teto de 370 dias; `expira_em` vencido vira link morto.)

Roda como `authenticated` de coord (a RPC checa `has_papel`) — pelo
PostgREST autenticado ou SQL com `set role`. Insert direto na tabela ainda
funciona via service role, mas cria link **sem senha** — exceção legada,
não o caminho pra turma nova.

Revogar (vaza o link, troca de turma, fim de ciclo):

```sql
select public.revogar_relatorio_link('<id do link>');
-- ou SQL direto: update relatorio_links set revogado_em = now() where slug = '<slug>';
```

Link novo sempre nasce com slug novo — não existe "des-revogar".
Redefinir a senha (a antiga morre na hora): `redefinir_senha_relatorio_link(<id>)`.

## 2. Fila "Sem dupla"

Cada pessoa da turma que ainda não tem par vira uma inscrição — um lado só
do XOR (`profile_id` pra mentor, `mentorado_id` pra jovem), `papel_esperado`
coerente com a coluna, `status` default `aguardando`:

```sql
insert into public.turma_inscricoes (turma, profile_id, papel_esperado, nota)
values ('T3 · 2027', '<uuid do profile>', 'mentor', 'veio pela ONG X');

insert into public.turma_inscricoes (turma, mentorado_id, papel_esperado)
values ('T3 · 2027', '<uuid do mentorado>', 'mentorado');
```

- `nota` é operacional e curta (≤300c) — nada sensível.
- Formou dupla → a linha some do relatório sozinha (regra "tem dupla ativa");
  marcar `status='formada'` é opcional, fica como registro.
- Desistiu → `status='desistiu'` (some da fila, fica no histórico).
- Uma pessoa ≤1× por turma (unique em `(turma, profile_id, mentorado_id)`
  com `nulls not distinct`).

## 3. Resto do onboarding (já existia)

Cronograma da turma pela UI/SQL como sempre; as duplas nascem com
`turma = 'T3 · 2027'` no insert. A partir daí:

- `/relatorios` (interno) lista T3 no seletor assim que houver dado ou
  inscrição, e o botão de compartilhar usa o slug do passo 1;
- `/resumo/<slug>` abre o resumo público de T3 com a senha gerada.

Zero commits. Rollback de uma turma: revogar o link + `delete` as
inscrições — as tabelas em si ficam.
